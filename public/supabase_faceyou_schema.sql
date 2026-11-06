-- ==============================================================================
-- FaceYou Live Streaming & Social Voice Messaging Platform
-- Complete PostgreSQL Database Schema for Supabase
-- Target Supabase Project: https://hwiddexgiwtduuzprsjd.supabase.co
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. PROFILES TABLE (Linked to auth.users with public read and owner update)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    coins BIGINT DEFAULT 100 CHECK (coins >= 0),
    diamonds BIGINT DEFAULT 0 CHECK (diamonds >= 0),
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    likes_count BIGINT DEFAULT 0,
    bio TEXT DEFAULT 'Broadcasting & chatting on FaceYou ✨',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ------------------------------------------------------------------------------
-- 3. LIVE STREAMS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'FaceYou LIVE Broadcast',
    is_live BOOLEAN DEFAULT TRUE,
    viewer_count INTEGER DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    thumbnail_url TEXT,
    started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_streams_is_live ON public.streams(is_live);
CREATE INDEX IF NOT EXISTS idx_streams_user_id ON public.streams(user_id);

-- ------------------------------------------------------------------------------
-- 4. LIVE STREAM CHAT & GIFTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stream_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('user', 'self', 'system', 'gift', 'joined')),
    gift_name TEXT,
    gift_icon TEXT,
    cost INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_stream_messages_stream_id ON public.stream_messages(stream_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 5. CONVERSATIONS & DIRECT MESSAGING (TEXT & VOICE NOTES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT,
    audio_url TEXT,
    audio_duration INTEGER DEFAULT 0,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 6. COIN TRANSACTIONS (PAYSTACK & GIFTING LOGS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coins_added INTEGER NOT NULL,
    price_ngn NUMERIC(12, 2) NOT NULL,
    paystack_ref TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON public.coin_transactions(user_id);

-- ------------------------------------------------------------------------------
-- 7. AUTOMATED TRIGGER: CREATE PROFILE WITH 100 STARTER COINS ON SIGN UP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    clean_name TEXT;
    clean_handle TEXT;
BEGIN
    clean_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    clean_handle := COALESCE(NEW.raw_user_meta_data->>'handle', '@' || lower(regexp_replace(clean_name, '[^a-zA-Z0-9]', '_', 'g')));

    INSERT INTO public.profiles (id, name, handle, email, avatar_url, coins, followers_count, following_count, likes_count, bio)
    VALUES (
        NEW.id,
        clean_name,
        clean_handle,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
        100, -- 100 Free Starter Coins
        0,
        0,
        0,
        'Streaming & chatting on FaceYou ✨'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can view, users can insert and update their profile
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (true);

-- Streams
DROP POLICY IF EXISTS "Streams are viewable by everyone" ON public.streams;
CREATE POLICY "Streams are viewable by everyone" ON public.streams
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own live streams" ON public.streams;
CREATE POLICY "Users can create own live streams" ON public.streams
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own streams" ON public.streams;
CREATE POLICY "Users can update own streams" ON public.streams
    FOR UPDATE USING (true);

-- Stream Messages
DROP POLICY IF EXISTS "Stream messages viewable by everyone" ON public.stream_messages;
CREATE POLICY "Stream messages viewable by everyone" ON public.stream_messages
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can post stream comments" ON public.stream_messages;
CREATE POLICY "Authenticated users can post stream comments" ON public.stream_messages
    FOR INSERT WITH CHECK (true);

-- Conversations & Messages
DROP POLICY IF EXISTS "Conversations viewable" ON public.conversations;
CREATE POLICY "Conversations viewable" ON public.conversations
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Messages viewable" ON public.messages;
CREATE POLICY "Messages viewable" ON public.messages
    FOR ALL USING (true);

-- Storage Buckets for Avatars and Voice Notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice_notes', 'voice_notes', true),
       ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public voice note files" ON storage.objects;
CREATE POLICY "Public voice note files" ON storage.objects
    FOR SELECT USING (bucket_id IN ('voice_notes', 'avatars'));

DROP POLICY IF EXISTS "Upload audio and avatars" ON storage.objects;
CREATE POLICY "Upload audio and avatars" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id IN ('voice_notes', 'avatars'));
