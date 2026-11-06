import { supabase } from './supabase';
import { ChatMessage, VideoComment } from '../types';

/** Feed likes and comments, and live-stream chat. All stored in Supabase. */

const fallbackAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export async function fetchLikedPostIds(me: string): Promise<Set<string>> {
  const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', me);
  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
}

export async function setPostLike(postId: string, me: string, like: boolean): Promise<void> {
  if (like) {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: me });
    if (error && error.code !== '23505') throw new Error(error.message); // 23505 = already liked
  } else {
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', me);
    if (error) throw new Error(error.message);
  }
}

export async function listComments(postId: string): Promise<VideoComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id, body, created_at, profiles(name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []).map((r: any) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      author: p?.name ?? 'Member',
      avatar: p?.avatar_url || fallbackAvatar(p?.name ?? 'Member'),
      text: r.body,
      likes: 0,
      time: ago(r.created_at),
    };
  });
}

export async function addComment(postId: string, me: string, body: string): Promise<void> {
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: me, body });
  if (error) throw new Error(error.message);
}

/** The id of my stream that is live right now (for chat). */
export async function findMyLiveStreamId(me: string): Promise<string | null> {
  const { data } = await supabase
    .from('streams')
    .select('id')
    .eq('user_id', me)
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

interface ChatRow {
  id: string;
  sender_name: string;
  text: string;
  type: string;
  gift_name: string | null;
  gift_icon: string | null;
  cost: number | null;
  created_at: string;
}

const toChat = (r: ChatRow): ChatMessage => ({
  id: r.id,
  sender: r.sender_name,
  text: r.text,
  type: (r.type as ChatMessage['type']) ?? 'user',
  giftName: r.gift_name ?? undefined,
  giftIcon: r.gift_icon ?? undefined,
  cost: r.cost ?? undefined,
  timestamp: new Date(r.created_at).getTime(),
});

export async function loadStreamChat(streamId: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('stream_messages')
    .select('id, sender_name, text, type, gift_name, gift_icon, cost, created_at')
    .eq('stream_id', streamId)
    .order('created_at', { ascending: true })
    .limit(100);
  return ((data ?? []) as ChatRow[]).map(toChat);
}

export async function sendStreamChat(streamId: string, senderName: string, text: string): Promise<void> {
  const { error } = await supabase.from('stream_messages').insert({
    stream_id: streamId,
    sender_name: senderName.slice(0, 40),
    text: text.slice(0, 300),
    type: 'user',
  });
  if (error) throw new Error(error.message);
}

export function subscribeStreamChat(streamId: string, onMessage: (m: ChatMessage) => void): () => void {
  const ch = supabase
    .channel(`stream-chat-${streamId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'stream_messages', filter: `stream_id=eq.${streamId}` },
      (payload) => onMessage(toChat(payload.new as ChatRow))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
