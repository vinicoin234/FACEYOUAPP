import { supabase } from './supabase';
import { Conversation, DirectMessage } from '../types';

/** Real inbox: conversations and messages live in Supabase and are shared by both people. */

export interface ChatMeta {
  me: string;
  myName: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  kind: 'text' | 'voice' | 'coin';
  coin_amount: number | null;
  created_at: string;
}

const fallbackAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;

export function toDirectMessage(row: MessageRow, meta: ChatMeta, senderName: string): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName,
    text: row.text ?? undefined,
    audioUrl: row.audio_url ?? undefined,
    audioDuration: row.audio_duration ?? undefined,
    timestamp: new Date(row.created_at).getTime(),
    isSelf: row.sender_id === meta.me,
    status: 'delivered',
    coinAmount: row.coin_amount ?? undefined,
    isCoinGift: row.kind === 'coin',
  };
}

/** Add a message to its conversation once (realtime and the send call can both deliver it). */
export function mergeMessage(convs: Conversation[], msg: DirectMessage): Conversation[] {
  return convs.map((c) => {
    if (c.id !== msg.conversationId) return c;
    if (c.messages.some((m) => m.id === msg.id)) return c;
    const messages = [...c.messages, msg].sort((a, b) => a.timestamp - b.timestamp);
    return { ...c, messages, lastMessage: messages[messages.length - 1] };
  });
}

/** All of my conversations with their messages. */
export async function loadConversations(meta: ChatMeta): Promise<Conversation[]> {
  const { data: mine, error: mineErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', meta.me);
  if (mineErr || !mine || mine.length === 0) return [];
  const ids = mine.map((r: { conversation_id: string }) => r.conversation_id);

  const [{ data: others }, { data: rows }] = await Promise.all([
    supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles(id, name, handle, avatar_url, bio)')
      .in('conversation_id', ids)
      .neq('user_id', meta.me),
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, text, audio_url, audio_duration, kind, coin_amount, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: true })
      .limit(2000),
  ]);

  const nameOf = new Map<string, string>([[meta.me, meta.myName]]);
  const convs: Conversation[] = [];
  for (const row of (others ?? []) as unknown as {
    conversation_id: string;
    user_id: string;
    profiles: { id: string; name: string; handle: string; avatar_url: string | null; bio: string | null } | null;
  }[]) {
    const p = row.profiles;
    if (!p) continue;
    nameOf.set(p.id, p.name);
    convs.push({
      id: row.conversation_id,
      participant: {
        id: p.id,
        name: p.name,
        handle: p.handle,
        avatar: p.avatar_url || fallbackAvatar(p.name),
        online: false,
        bio: p.bio ?? undefined,
      },
      unreadCount: 0,
      messages: [],
    });
  }

  for (const r of (rows ?? []) as MessageRow[]) {
    const conv = convs.find((c) => c.id === r.conversation_id);
    if (!conv) continue;
    const msg = toDirectMessage(r, meta, nameOf.get(r.sender_id) ?? 'Member');
    conv.messages.push(msg);
    conv.lastMessage = msg;
  }
  return convs;
}

/** Find or create the conversation with a person. */
export async function startConversation(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', { p_other: otherId });
  if (error || !data) throw new Error(error?.message ?? 'Could not start the conversation');
  return data as string;
}

/** Look up a FaceYou user by handle. */
export async function findUserByHandle(handle: string) {
  const { data, error } = await supabase.rpc('find_user_by_handle', { p_handle: handle.trim() });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    handle: row.handle as string,
    avatar: (row.avatar_url as string | null) || fallbackAvatar(row.name as string),
  };
}

export async function sendTextMessage(conversationId: string, me: string, text: string): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: me, text, kind: 'text' })
    .select('id, conversation_id, sender_id, text, audio_url, audio_duration, kind, coin_amount, created_at')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Message not sent');
  return data as MessageRow;
}

export async function sendVoiceMessage(
  conversationId: string,
  me: string,
  blob: Blob,
  duration: number
): Promise<MessageRow> {
  const path = `${me}/${Date.now()}.webm`;
  const up = await supabase.storage.from('voice_notes').upload(path, blob, { contentType: 'audio/webm' });
  if (up.error) throw new Error(`Voice note upload failed: ${up.error.message}`);
  const { data: pub } = supabase.storage.from('voice_notes').getPublicUrl(path);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: me,
      audio_url: pub.publicUrl,
      audio_duration: duration,
      kind: 'voice',
    })
    .select('id, conversation_id, sender_id, text, audio_url, audio_duration, kind, coin_amount, created_at')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Voice note not sent');
  return data as MessageRow;
}

/** Subscribe to new messages in my conversations (the database filters to conversations I'm in). */
export function subscribeToMessages(onRow: (row: MessageRow) => void): () => void {
  const ch = supabase
    .channel('chat-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
      onRow(payload.new as MessageRow)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

/** Send coins in a conversation. Returns my new balance; the coin message arrives through realtime. */
export async function sendCoinsChat(conversationId: string, amount: number, note: string): Promise<number> {
  const { data, error } = await supabase.rpc('send_coins_chat', {
    p_conversation: conversationId,
    p_amount: amount,
    p_note: note,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ''));
  return Number(data);
}
