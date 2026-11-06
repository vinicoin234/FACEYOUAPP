-- ============================================================================
-- MIGRATION: real messaging, likes & comments, live chat, and payouts.
-- Run after the three earlier migrations. Safe to re-run.
-- ============================================================================

-- ---------- 0. Admin flag (only the service role can set it) ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Balances AND admin status can only change through trusted functions
CREATE OR REPLACE FUNCTION public.guard_balances()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.coins IS DISTINCT FROM OLD.coins
      OR NEW.diamonds IS DISTINCT FROM OLD.diamonds
      OR NEW.is_admin IS DISTINCT FROM OLD.is_admin)
     AND coalesce(current_setting('faceyou.balance_bypass', true), '') <> 'on'
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Protected account fields can only be changed by the system';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin);
$$;

-- ---------- 1. Messaging: members only ----------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_kind_check CHECK (kind IN ('text', 'voice', 'coin'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS coin_amount INTEGER;

CREATE OR REPLACE FUNCTION public.is_conversation_member(conv UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants
                 WHERE conversation_id = conv AND user_id = auth.uid());
$$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Conversations viewable" ON public.conversations;
DROP POLICY IF EXISTS "Messages viewable" ON public.messages;
DROP POLICY IF EXISTS "Members read conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members read participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Members read messages" ON public.messages;
DROP POLICY IF EXISTS "Members send messages" ON public.messages;

CREATE POLICY "Members read conversations" ON public.conversations
  FOR SELECT USING (public.is_conversation_member(id));
CREATE POLICY "Members read participants" ON public.conversation_participants
  FOR SELECT USING (public.is_conversation_member(conversation_id));
CREATE POLICY "Members read messages" ON public.messages
  FOR SELECT USING (public.is_conversation_member(conversation_id));
-- Text and voice only. Coin messages are written by send_coins_chat() so they always match a real transfer.
CREATE POLICY "Members send messages" ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid() AND kind IN ('text', 'voice')
                         AND public.is_conversation_member(conversation_id));

-- Find or create the 1:1 conversation with another user
CREATE OR REPLACE FUNCTION public.start_conversation(p_other UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_conv UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in to message people'; END IF;
  IF p_other = v_me THEN RAISE EXCEPTION 'You cannot message yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other) THEN
    RAISE EXCEPTION 'That user does not exist';
  END IF;

  SELECT a.conversation_id INTO v_conv
  FROM public.conversation_participants a
  JOIN public.conversation_participants b ON b.conversation_id = a.conversation_id
  WHERE a.user_id = v_me AND b.user_id = p_other
  LIMIT 1;
  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO v_conv;
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv, v_me), (v_conv, p_other);
  RETURN v_conv;
END;
$$;
REVOKE ALL ON FUNCTION public.start_conversation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation(UUID) TO authenticated;

-- Find a real user by handle (for "new chat")
CREATE OR REPLACE FUNCTION public.find_user_by_handle(p_handle TEXT)
RETURNS TABLE (id UUID, name TEXT, handle TEXT, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.handle, p.avatar_url FROM public.profiles p
  WHERE lower(p.handle) = lower(regexp_replace(p_handle, '^@', ''))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_user_by_handle(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_handle(TEXT) TO authenticated;

-- Send coins in a conversation: transfer + chat message in ONE transaction
CREATE OR REPLACE FUNCTION public.send_coins_chat(p_conversation UUID, p_amount INTEGER, p_note TEXT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_other UUID;
  v_left BIGINT;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in to send coins'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF NOT public.is_conversation_member(p_conversation) THEN RAISE EXCEPTION 'Not in this conversation'; END IF;

  SELECT user_id INTO v_other FROM public.conversation_participants
  WHERE conversation_id = p_conversation AND user_id <> v_me LIMIT 1;
  IF v_other IS NULL THEN RAISE EXCEPTION 'Nobody to send coins to'; END IF;

  PERFORM set_config('faceyou.balance_bypass', 'on', true);
  UPDATE public.profiles SET coins = coins - p_amount WHERE id = v_me AND coins >= p_amount
  RETURNING coins INTO v_left;
  IF v_left IS NULL THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  UPDATE public.profiles SET diamonds = diamonds + (p_amount / 2) WHERE id = v_other;
  INSERT INTO public.gifts (sender_id, recipient_id, gift_name, coins)
  VALUES (v_me, v_other, 'Coins', p_amount);
  INSERT INTO public.messages (conversation_id, sender_id, text, kind, coin_amount)
  VALUES (p_conversation, v_me, COALESCE(NULLIF(trim(p_note), ''), 'Sent coins'), 'coin', p_amount);
  UPDATE public.conversations SET updated_at = TIMEZONE('utc', NOW()) WHERE id = p_conversation;

  RETURN v_left;
END;
$$;
REVOKE ALL ON FUNCTION public.send_coins_chat(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_coins_chat(UUID, INTEGER, TEXT) TO authenticated;

-- Voice notes bucket (private folder per user, public playback by link)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('voice_notes', 'voice_notes', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

DROP POLICY IF EXISTS "Users upload own voice notes" ON storage.objects;
CREATE POLICY "Users upload own voice notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice_notes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 2. Likes and comments ----------
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments (post_id, created_at);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Likes viewable" ON public.post_likes;
DROP POLICY IF EXISTS "Own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Own unlike" ON public.post_likes;
DROP POLICY IF EXISTS "Comments viewable" ON public.post_comments;
DROP POLICY IF EXISTS "Own comments" ON public.post_comments;
CREATE POLICY "Likes viewable" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Own likes" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own unlike" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Comments viewable" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Own comments" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_post_likes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.posts SET likes_count = (SELECT count(*) FROM public.post_likes
                                         WHERE post_id = coalesce(NEW.post_id, OLD.post_id))
  WHERE id = coalesce(NEW.post_id, OLD.post_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_post_likes ON public.post_likes;
CREATE TRIGGER sync_post_likes AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes();

-- ---------- 3. Live chat: viewers and hosts see the same messages ----------
DROP POLICY IF EXISTS "Stream messages viewable by everyone" ON public.stream_messages;
CREATE POLICY "Stream messages viewable by everyone" ON public.stream_messages FOR SELECT USING (true);

-- ---------- 4. Payouts (diamonds -> bank/OPay), with admin approval ----------
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  diamonds INTEGER NOT NULL CHECK (diamonds > 0),
  amount_ngn NUMERIC(12, 2) NOT NULL CHECK (amount_ngn > 0),
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'rejected', 'failed')),
  paystack_reference TEXT UNIQUE,
  paystack_transfer_code TEXT,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own withdrawals" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins read withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Own withdrawals" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read withdrawals" ON public.withdrawal_requests FOR SELECT USING (public.is_admin_user());

-- Request a payout: diamonds are held immediately so they cannot be spent twice
-- Rate is set here on the server (1 diamond = 50 NGN), never by the browser
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_diamonds INTEGER, p_account_name TEXT, p_account_number TEXT
) RETURNS TABLE (request_id UUID, diamonds_left INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID := auth.uid();
  v_left INTEGER;
  v_id UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in to withdraw'; END IF;
  IF p_diamonds IS NULL OR p_diamonds <= 0 THEN RAISE EXCEPTION 'Enter a positive amount'; END IF;
  IF p_account_number !~ '^[0-9]{10,11}$' THEN RAISE EXCEPTION 'Enter a valid 10-11 digit account number'; END IF;
  IF length(trim(coalesce(p_account_name, ''))) < 3 THEN RAISE EXCEPTION 'Enter the full account name'; END IF;

  PERFORM set_config('faceyou.balance_bypass', 'on', true);
  UPDATE public.profiles SET diamonds = diamonds - p_diamonds
  WHERE id = v_me AND diamonds >= p_diamonds
  RETURNING diamonds INTO v_left;
  IF v_left IS NULL THEN RAISE EXCEPTION 'Not enough diamonds'; END IF;

  INSERT INTO public.withdrawal_requests (user_id, diamonds, amount_ngn, account_name, account_number)
  VALUES (v_me, p_diamonds, round(p_diamonds * 50, 2), trim(p_account_name), p_account_number)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_left;
END;
$$;
REVOKE ALL ON FUNCTION public.request_withdrawal(INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(INTEGER, TEXT, TEXT) TO authenticated;

-- Admin decision. Rejecting returns the held diamonds.
CREATE OR REPLACE FUNCTION public.review_withdrawal(p_id UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request is already %', r.status; END IF;

  IF p_approve THEN
    UPDATE public.withdrawal_requests SET status = 'approved', review_note = p_note, updated_at = NOW() WHERE id = p_id;
    RETURN 'approved';
  END IF;

  PERFORM set_config('faceyou.balance_bypass', 'on', true);
  UPDATE public.profiles SET diamonds = diamonds + r.diamonds WHERE id = r.user_id;
  UPDATE public.withdrawal_requests SET status = 'rejected', review_note = p_note, updated_at = NOW() WHERE id = p_id;
  RETURN 'rejected';
END;
$$;
REVOKE ALL ON FUNCTION public.review_withdrawal(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_withdrawal(UUID, BOOLEAN, TEXT) TO authenticated;

-- Server-only: claim an approved request for transfer (prevents double payouts)
CREATE OR REPLACE FUNCTION public.claim_withdrawal(p_id UUID, p_reference TEXT)
RETURNS SETOF public.withdrawal_requests LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.withdrawal_requests
  SET status = 'processing', paystack_reference = p_reference, updated_at = NOW()
  WHERE id = p_id AND status = 'approved'
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_withdrawal(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_withdrawal(UUID, TEXT) TO service_role;

-- Server-only: a transfer failed or was reversed -> mark failed and return the diamonds once
CREATE OR REPLACE FUNCTION public.refund_withdrawal(p_reference TEXT, p_failed BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.withdrawal_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.withdrawal_requests WHERE paystack_reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF r.status NOT IN ('processing', 'approved') THEN RETURN r.status; END IF;

  IF p_failed THEN
    PERFORM set_config('faceyou.balance_bypass', 'on', true);
    UPDATE public.profiles SET diamonds = diamonds + r.diamonds WHERE id = r.user_id;
    UPDATE public.withdrawal_requests SET status = 'failed', updated_at = NOW() WHERE id = r.id;
    RETURN 'failed';
  END IF;
  UPDATE public.withdrawal_requests SET status = 'paid', updated_at = NOW() WHERE id = r.id;
  RETURN 'paid';
END;
$$;
REVOKE ALL ON FUNCTION public.refund_withdrawal(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_withdrawal(TEXT, BOOLEAN) TO service_role;

-- ---------- 5. Realtime for chat and live chat ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'stream_messages', 'post_comments'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
