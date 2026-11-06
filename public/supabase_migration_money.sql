-- ============================================================================
-- MIGRATION: real money. Balances change only through these database functions.
-- Run after the live and feed migrations. Safe to re-run.
-- ============================================================================

-- 1. Nobody (not even a logged-in user editing their own profile) can change coins or diamonds directly.
CREATE OR REPLACE FUNCTION public.guard_balances()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.coins IS DISTINCT FROM OLD.coins OR NEW.diamonds IS DISTINCT FROM OLD.diamonds)
     AND coalesce(current_setting('faceyou.balance_bypass', true), '') <> 'on'
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Coin and diamond balances can only change through purchases and transfers';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_balances ON public.profiles;
CREATE TRIGGER guard_balances
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_balances();

-- 2. Gifts / transfers ledger (readable by everyone so live gift activity can be shown).
CREATE TABLE IF NOT EXISTS public.gifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  gift_name TEXT NOT NULL,
  coins INTEGER NOT NULL CHECK (coins > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_gifts_recipient ON public.gifts (recipient_id, created_at DESC);
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gifts are viewable by everyone" ON public.gifts;
CREATE POLICY "Gifts are viewable by everyone" ON public.gifts FOR SELECT USING (true);

-- 3. Send coins or a gift: deducts the sender and credits the recipient in ONE transaction.
CREATE OR REPLACE FUNCTION public.send_gift(
  p_recipient UUID,
  p_amount INTEGER,
  p_gift TEXT,
  p_stream UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_left BIGINT;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Sign in to send coins'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_recipient = v_sender THEN RAISE EXCEPTION 'You cannot send coins to yourself'; END IF;

  PERFORM set_config('faceyou.balance_bypass', 'on', true);

  UPDATE public.profiles SET coins = coins - p_amount
  WHERE id = v_sender AND coins >= p_amount
  RETURNING coins INTO v_left;
  IF v_left IS NULL THEN RAISE EXCEPTION 'Not enough coins'; END IF;

  UPDATE public.profiles SET diamonds = diamonds + (p_amount / 2)
  WHERE id = p_recipient;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient not found'; END IF;

  INSERT INTO public.gifts (sender_id, recipient_id, stream_id, gift_name, coins)
  VALUES (v_sender, p_recipient, p_stream, COALESCE(p_gift, 'Coins'), p_amount);

  -- Show the gift in the live chat so the host sees it
  IF p_stream IS NOT NULL THEN
    INSERT INTO public.stream_messages (stream_id, sender_name, text, type, gift_name, cost)
    SELECT p_stream, COALESCE(p.name, 'Viewer'), 'sent a gift', 'gift', COALESCE(p_gift, 'Gift'), p_amount
    FROM public.profiles p WHERE p.id = v_sender;
  END IF;

  RETURN v_left;
END;
$$;
REVOKE ALL ON FUNCTION public.send_gift(UUID, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift(UUID, INTEGER, TEXT, UUID, TEXT) TO authenticated;

-- 4. Record a verified Paystack purchase exactly once, then credit coins. Server-only.
CREATE OR REPLACE FUNCTION public.record_purchase(
  p_user UUID, p_ref TEXT, p_coins INTEGER, p_price NUMERIC
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new BIGINT;
BEGIN
  INSERT INTO public.coin_transactions (user_id, coins_added, price_ngn, paystack_ref, status)
  VALUES (p_user, p_coins, p_price, p_ref, 'success')
  ON CONFLICT (paystack_ref) DO NOTHING;
  IF NOT FOUND THEN RETURN NULL; END IF; -- already credited once

  PERFORM set_config('faceyou.balance_bypass', 'on', true);
  UPDATE public.profiles SET coins = coins + p_coins WHERE id = p_user
  RETURNING coins INTO v_new;
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.record_purchase(UUID, TEXT, INTEGER, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_purchase(UUID, TEXT, INTEGER, NUMERIC) TO service_role;
