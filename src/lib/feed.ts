import { supabase } from './supabase';
import { PostVideo, User } from '../types';

/**
 * Feed posts (photos and videos) stored in Supabase Storage bucket "media" + table "posts".
 * Requires a real Supabase Auth session to upload (see migration SQL).
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const FEED_ACCEPT = 'image/*,video/mp4,video/webm,video/quicktime';

interface PostRow {
  id: string;
  user_id: string;
  caption: string;
  media_url: string;
  media_type: 'image' | 'video';
  likes_count: number | null;
  created_at: string;
  profiles:
    | { name: string; handle: string; avatar_url: string | null }
    | { name: string; handle: string; avatar_url: string | null }[]
    | null;
}

const fallbackAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;

const hashtags = (caption: string) => {
  const tags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return tags.length > 0 ? tags : ['#FaceYou'];
};

function mapRow(row: PostRow): PostVideo | null {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  if (!profile) return null;
  return {
    id: row.id,
    creatorId: row.user_id,
    creatorName: profile.name,
    creatorHandle: profile.handle,
    creatorAvatar: profile.avatar_url || fallbackAvatar(profile.name),
    caption: row.caption,
    tags: hashtags(row.caption),
    musicTitle: 'FaceYou Original Sound',
    bgGradient: 'from-neutral-900 via-neutral-950 to-black',
    likes: row.likes_count ?? 0,
    commentsCount: 0,
    sharesCount: 0,
    isLiked: false,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    createdAt: row.created_at,
  };
}

export async function fetchFeedPosts(): Promise<PostVideo[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, caption, media_url, media_type, likes_count, created_at, profiles(name, handle, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('Could not load feed:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as PostRow[]).map(mapRow).filter((p): p is PostVideo => p !== null);
}

/** Upload a photo or video and publish it to the feed. Throws with a readable message on failure. */
export async function publishFeedPost(user: User, file: File, caption: string): Promise<PostVideo> {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) throw new Error('Please choose a photo or video file.');
  if (isImage && file.size > MAX_IMAGE_BYTES) throw new Error('Photos must be 10 MB or smaller.');
  if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error('Videos must be 50 MB or smaller.');

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error('Your account is not signed in to the server. Log out and sign in again to post.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${session.session.user.id}/${Date.now()}-${safeName}`;

  const upload = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`);

  const { data: pub } = supabase.storage.from('media').getPublicUrl(path);

  const { data: row, error } = await supabase
    .from('posts')
    .insert({
      user_id: session.session.user.id,
      caption: caption.trim(),
      media_url: pub.publicUrl,
      media_type: isVideo ? 'video' : 'image',
    })
    .select('id, user_id, caption, media_url, media_type, likes_count, created_at')
    .single();

  if (error || !row) {
    await supabase.storage.from('media').remove([path]);
    throw new Error(`Could not publish: ${error?.message ?? 'unknown error'}`);
  }

  return mapRow({
    ...(row as Omit<PostRow, 'profiles'>),
    profiles: { name: user.name, handle: user.handle, avatar_url: user.avatar },
  }) as PostVideo;
}
