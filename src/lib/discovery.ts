import { supabase } from './supabase';
import { User } from '../types';

/**
 * Live stream discovery + people directory.
 * Everything here reads from Supabase so that every device and every user sees the same data.
 * (Previously this was kept in each browser's localStorage, so other users could never see a stream.)
 */

export interface LiveStreamInfo {
  id: string; // host user id
  streamId: string; // streams.id row
  name: string;
  handle: string;
  avatar: string;
  title: string;
  viewerCount: number;
  startedAt: string;
}

/** The host sends a heartbeat every HEARTBEAT_INTERVAL_MS. A stream without one for HEARTBEAT_STALE_MS is hidden. */
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_STALE_MS = 45_000;

const fallbackAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;

interface StreamRow {
  id: string;
  user_id: string;
  title: string;
  viewer_count: number | null;
  started_at: string;
  profiles:
    | { name: string; handle: string; avatar_url: string | null }
    | { name: string; handle: string; avatar_url: string | null }[]
    | null;
}

/** Streams that are flagged live AND whose host has sent a recent heartbeat. */
export async function fetchLiveStreams(): Promise<LiveStreamInfo[]> {
  const cutoff = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();
  const { data, error } = await supabase
    .from('streams')
    .select('id, user_id, title, viewer_count, started_at, profiles(name, handle, avatar_url)')
    .eq('is_live', true)
    .gte('last_heartbeat', cutoff)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('Could not load live streams:', error.message);
    return [];
  }

  const result: LiveStreamInfo[] = [];
  for (const row of (data ?? []) as unknown as StreamRow[]) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!profile) continue;
    result.push({
      id: row.user_id,
      streamId: row.id,
      name: profile.name,
      handle: profile.handle,
      avatar: profile.avatar_url || fallbackAvatar(profile.name),
      title: row.title,
      viewerCount: row.viewer_count ?? 0,
      startedAt: row.started_at,
    });
  }
  return result;
}

/** Calls onChange whenever any row in public.streams changes (requires realtime enabled, see migration SQL). */
export function subscribeToStreamChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('streams-discovery')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Called by the host while live. Keeps the stream listed and updates its viewer count. */
export async function sendStreamHeartbeat(streamId: string, viewerCount: number): Promise<void> {
  const { error } = await supabase
    .from('streams')
    .update({ last_heartbeat: new Date().toISOString(), viewer_count: viewerCount })
    .eq('id', streamId);
  if (error) console.warn('Stream heartbeat failed:', error.message);
}

interface ProfileRow {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number | null;
  following_count: number | null;
  likes_count: number | null;
  is_verified: boolean | null;
}

/**
 * Other users on the platform. Only public columns are selected on purpose:
 * profiles are readable by everyone, so email and coin balances are never fetched here.
 */
export async function fetchPeopleDirectory(excludeUserId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, handle, avatar_url, bio, followers_count, following_count, likes_count, is_verified')
    .neq('id', excludeUserId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('Could not load people directory:', error.message);
    return [];
  }

  return ((data ?? []) as unknown as ProfileRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    handle: p.handle,
    email: '',
    avatar: p.avatar_url || fallbackAvatar(p.name),
    coins: 0,
    followers: p.followers_count ?? 0,
    following: p.following_count ?? 0,
    likes: p.likes_count ?? 0,
    diamonds: 0,
    bio: p.bio || '',
    isVerified: !!p.is_verified,
  }));
}
