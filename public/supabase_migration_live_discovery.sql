-- ============================================================================
-- MIGRATION: live stream discovery across all users/devices
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- ============================================================================

-- 1. Heartbeat column: the host's browser pings this while live.
--    Streams without a recent heartbeat are hidden from discovery.
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_streams_live_heartbeat
  ON public.streams (is_live, last_heartbeat DESC);

-- 2. Clean up streams left "live" by hosts whose browser closed without ending.
UPDATE public.streams
SET is_live = FALSE,
    ended_at = COALESCE(ended_at, TIMEZONE('utc', NOW()))
WHERE is_live = TRUE
  AND (last_heartbeat IS NULL OR last_heartbeat < TIMEZONE('utc', NOW()) - INTERVAL '5 minutes');

-- 3. Realtime: push stream inserts/updates to every open app instantly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'streams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;
  END IF;
END $$;

-- 4. Policies (already present in supabase_faceyou_schema.sql; re-created only if missing).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'Streams are viewable by everyone') THEN
    CREATE POLICY "Streams are viewable by everyone" ON public.streams FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'Users can create own live streams') THEN
    CREATE POLICY "Users can create own live streams" ON public.streams FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'Users can update own streams') THEN
    CREATE POLICY "Users can update own streams" ON public.streams FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
