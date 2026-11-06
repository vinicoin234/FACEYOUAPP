import { createClient } from '@supabase/supabase-js';
import { User, ChatMessage } from '../types';

// Provided Supabase configuration
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://hwiddexgiwtduuzprsjd.supabase.co';

export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3aWRkZXhnaXd0ZHV1enByc2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMDU1MjMsImV4cCI6MjEwODc4MTUyM30.QyzSo2eUtt0jBzW8_WRkIPutMj1wb5ex_9GgyOguwHI';

// Supabase client instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Check if the Supabase connection is reachable
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      // 42P01 = relation does not exist yet (tables need to be created via SQL)
      if (error.code === '42P01' || error.message.includes('relation "public.profiles" does not exist')) {
        return {
          ok: false,
          message: 'Supabase connected! Database tables not initialized yet. Run the SQL schema to create tables.',
        };
      }
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Supabase connected and tables verified.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown connection error';
    return { ok: false, message: msg };
  }
}

/**
 * Register a user via Supabase Auth + Profiles table
 */
export async function registerWithSupabase(
  params: {
    email: string;
    password: string;
    name: string;
    handle: string;
    avatar: string;
    bio: string;
  }
): Promise<{ user: User | null; error: string | null }> {
  try {
    // 1. Supabase Auth Sign Up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          name: params.name,
          handle: params.handle,
          avatar_url: params.avatar,
          bio: params.bio,
        },
      },
    });

    if (authError) {
      return { user: null, error: authError.message };
    }

    const authUser = authData.user;
    if (!authUser) {
      return { user: null, error: 'Sign up failed. Please check credentials.' };
    }

    const appUser: User = {
      id: authUser.id,
      name: params.name,
      handle: params.handle,
      email: params.email,
      avatar: params.avatar,
      coins: 0,
      followers: 0,
      following: 0,
      likes: 0,
      diamonds: 0,
      bio: params.bio,
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      isVerified: false,
    };

    // 2. Try inserting / upserting into public.profiles
    try {
      await supabase.from('profiles').upsert({
        id: authUser.id,
        name: params.name,
        handle: params.handle,
        email: params.email,
        avatar_url: params.avatar,
        followers_count: 0,
        following_count: 0,
        likes_count: 0,
        bio: params.bio,
        is_verified: false,
      });
    } catch (upsertErr) {
      console.warn('Profile table sync warning (run SQL schema if table is missing):', upsertErr);
    }

    return { user: appUser, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return { user: null, error: msg };
  }
}

/**
 * Log in a user via Supabase Auth + fetch Profile
 */
export async function loginWithSupabase(
  email: string,
  pass: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (authError) {
      return { user: null, error: authError.message };
    }

    const authUser = authData.user;
    if (!authUser) {
      return { user: null, error: 'User not found.' };
    }

    // Try fetching profile from profiles table
    let userProfile: User | null = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profile) {
        userProfile = {
          id: profile.id,
          name: profile.name || authUser.user_metadata?.name || email.split('@')[0],
          handle: profile.handle || authUser.user_metadata?.handle || `@${email.split('@')[0]}`,
          email: profile.email || email,
          avatar:
            profile.avatar_url ||
            authUser.user_metadata?.avatar_url ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.name || email)}`,
          coins: profile.coins ?? 100,
          followers: profile.followers_count ?? 0,
          following: profile.following_count ?? 0,
          likes: profile.likes_count ?? 0,
          diamonds: profile.diamonds ?? 0,
          bio: profile.bio || 'Broadcasting on FaceYou ✨',
          joinedDate: new Date(profile.created_at || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          }),
          isVerified: !!profile.is_verified,
        };
      }
    } catch {
      // Fallback
    }

    if (!userProfile) {
      const meta = authUser.user_metadata || {};
      userProfile = {
        id: authUser.id,
        name: meta.name || email.split('@')[0],
        handle: meta.handle || `@${email.split('@')[0]}`,
        email: authUser.email || email,
        avatar:
          meta.avatar_url ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`,
        coins: 100,
        followers: 0,
        following: 0,
        likes: 0,
        diamonds: 0,
        bio: meta.bio || 'Broadcasting on FaceYou ✨',
        joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        isVerified: false,
      };
    }

    return { user: userProfile, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    return { user: null, error: msg };
  }
}

/**
 * Sync user profile to Supabase
 */
export async function syncUserProfile(user: User): Promise<void> {
  try {
    await supabase.from('profiles').upsert({
      id: user.id,
      name: user.name,
      handle: user.handle,
      email: user.email,
      avatar_url: user.avatar,
      followers_count: user.followers,
      following_count: user.following,
      likes_count: user.likes,
      bio: user.bio,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not sync user profile to Supabase:', err);
  }
}

/**
 * Record live stream start in Supabase
 */
export async function recordStreamStart(
  userId: string,
  title: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('streams')
      .insert({
        user_id: userId,
        title,
        is_live: true,
        viewer_count: 1,
        like_count: 0,
        started_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.warn('Could not record stream start to Supabase:', error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.warn('Error recording stream start:', err);
    return null;
  }
}

/**
 * Record live stream end in Supabase
 */
export async function recordStreamEnd(
  streamId: string | null,
  viewerCount: number,
  likeCount: number
): Promise<void> {
  if (!streamId) return;
  try {
    await supabase
      .from('streams')
      .update({
        is_live: false,
        viewer_count: viewerCount,
        like_count: likeCount,
        ended_at: new Date().toISOString(),
      })
      .eq('id', streamId);
  } catch (err) {
    console.warn('Could not update stream end in Supabase:', err);
  }
}

/**
 * Publish a stream chat/gift message to Supabase
 */
export async function publishStreamMessage(
  streamId: string | null,
  message: ChatMessage
): Promise<void> {
  if (!streamId) return;
  try {
    await supabase.from('stream_messages').insert({
      stream_id: streamId,
      sender_name: message.sender,
      text: message.text,
      type: message.type,
      gift_name: message.giftName || null,
      gift_icon: message.giftIcon || null,
      cost: message.cost || 0,
      created_at: new Date(message.timestamp).toISOString(),
    });
  } catch (err) {
    console.warn('Could not publish message to Supabase:', err);
  }
}
