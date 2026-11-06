import React, { useState } from 'react';
import { X, Copy, Check, Database, ExternalLink, Terminal } from 'lucide-react';
import { SUPABASE_URL } from '../lib/supabase';

interface SqlSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlSchemaModal: React.FC<SqlSchemaModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlCode = `-- ==============================================================================
-- FaceYou Live Streaming & Social Voice Messaging Platform
-- Complete PostgreSQL Database Schema for Supabase
-- Target Project: ${SUPABASE_URL}
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE (Linked with Supabase Auth users)
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

-- 3. LIVE STREAMS TABLE
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

-- 4. LIVE STREAM CHAT & GIFTS
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

-- 5. CONVERSATIONS & DIRECT MESSAGING (TEXT & VOICE NOTES)
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

-- 6. COIN TRANSACTIONS (PAYSTACK PAYMENT LOGS)
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coins_added INTEGER NOT NULL,
    price_ngn NUMERIC(12, 2) NOT NULL,
    paystack_ref TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 7. AUTOMATED TRIGGER: CREATE PROFILE WITH 100 STARTER COINS ON SIGN UP
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
        100,
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

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Streams are viewable by everyone" ON public.streams;
CREATE POLICY "Streams are viewable by everyone" ON public.streams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own live streams" ON public.streams;
CREATE POLICY "Users can create own live streams" ON public.streams FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own streams" ON public.streams;
CREATE POLICY "Users can update own streams" ON public.streams FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Stream messages viewable by everyone" ON public.stream_messages;
CREATE POLICY "Stream messages viewable by everyone" ON public.stream_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can post stream comments" ON public.stream_messages;
CREATE POLICY "Authenticated users can post stream comments" ON public.stream_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Conversations viewable" ON public.conversations;
CREATE POLICY "Conversations viewable" ON public.conversations FOR ALL USING (true);

DROP POLICY IF EXISTS "Messages viewable" ON public.messages;
CREATE POLICY "Messages viewable" ON public.messages FOR ALL USING (true);

-- 9. Storage Buckets for Avatars & Voice Notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice_notes', 'voice_notes', true),
       ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public voice note files" ON storage.objects;
CREATE POLICY "Public voice note files" ON storage.objects FOR SELECT USING (bucket_id IN ('voice_notes', 'avatars'));

DROP POLICY IF EXISTS "Upload audio and avatars" ON storage.objects;
CREATE POLICY "Upload audio and avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('voice_notes', 'avatars'));
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Supabase SQL Setup
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Ready
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono truncate max-w-xs sm:max-w-md">
                {SUPABASE_URL}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="my-3 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-300 space-y-1">
          <p className="font-bold text-white flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-[#00f2fe]" /> How to execute in your Supabase project:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 text-neutral-400 text-[11px]">
            <li>Open your Supabase dashboard at <span className="text-[#00f2fe] font-mono">{SUPABASE_URL}</span></li>
            <li>Go to <strong className="text-white">SQL Editor</strong> on the left sidebar</li>
            <li>Click <strong className="text-white">+ New Query</strong>, paste the SQL below, and click <strong className="text-emerald-400">Run</strong></li>
          </ol>
        </div>

        {/* SQL Code Box */}
        <div className="relative flex-1 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#ff0050] hover:bg-[#e00047] text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL Script</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 pt-10 text-[11px] font-mono text-neutral-300 overflow-y-auto h-72 sm:h-80 leading-relaxed scrollbar-thin">
            {sqlCode}
          </pre>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
          <a
            href="https://supabase.com/dashboard/project/hwiddexgiwtduuzprsjd/sql"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#00f2fe] hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Open Supabase SQL Editor</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
