import React, { useEffect, useRef, useState } from 'react';
import { X, Radio, Volume2, Send } from 'lucide-react';
import { ViewerStatus, watchBroadcast } from '../lib/webrtc';
import { supabase } from '../lib/supabase';
import { sendGift } from '../lib/money';
import { loadStreamChat, sendStreamChat, subscribeStreamChat } from '../lib/social';
import { FACEYOU_GIFTS } from '../data/mockData';
import { ChatMessage, User } from '../types';

export interface LiveHost {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

interface LiveViewerProps {
  host: LiveHost;
  viewer: User;
  onBalance: (coins: number) => void;
  onClose: () => void;
}

/** Full-screen view of someone else's live stream. Video is peer-to-peer; chat and gifts are stored on the server. */
export const LiveViewer: React.FC<LiveViewerProps> = ({ host, viewer, onBalance, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ViewerStatus>('connecting');
  const [needsTap, setNeedsTap] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const stop = watchBroadcast(
      host.id,
      (stream) => {
        const el = videoRef.current;
        if (!el) return;
        el.srcObject = stream;
        if (stream) el.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
      },
      setStatus
    );
    return stop;
  }, [host.id]);

  // Find the live stream row, then load and follow its chat
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    (async () => {
      const { data } = await supabase
        .from('streams')
        .select('id')
        .eq('user_id', host.id)
        .eq('is_live', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const id = data.id as string;
      setStreamId(id);
      const history = await loadStreamChat(id);
      if (cancelled) return;
      setMessages(history);
      unsubscribe = subscribeStreamChat(id, (m) =>
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.slice(-80), m]))
      );
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [host.id]);

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text || !streamId) return;
    setChatText('');
    try {
      await sendStreamChat(streamId, viewer.name, text);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Message not sent');
    }
  };

  const send = async (gift: { name: string; cost: number; icon: string }) => {
    if (sending) return;
    if (viewer.id === host.id) return setNotice('You cannot send gifts to yourself.');
    setSending(true);
    setNotice(null);
    try {
      const balance = await sendGift(host.id, streamId, gift.name, gift.cost);
      onBalance(balance);
      setNotice(`Sent ${gift.icon} ${gift.name} to ${host.name}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gift could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const statusText = status === 'live' ? 'LIVE' : status === 'connecting' ? 'Connecting to host…' : 'Stream offline';

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onClick={() => videoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {})}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {status !== 'live' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <p className="text-sm text-neutral-300 px-6 text-center">
            {status === 'connecting'
              ? 'Connecting to the host…'
              : 'This stream is offline, or the host has not started their camera yet.'}
          </p>
        </div>
      )}

      {needsTap && (
        <button
          onClick={() => videoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {})}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white"
        >
          <Volume2 className="w-10 h-10" />
          <span className="text-sm font-bold">Tap to play with sound</span>
        </button>
      )}

      <div className="relative p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <img src={host.avatar} alt={host.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-[#ff0050]" />
          <div>
            <p className="text-sm font-black text-white">{host.name}</p>
            <p className="text-[11px] text-neutral-300 flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-[#ff0050]" />
              {statusText}
            </p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Leave stream" className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative mt-auto p-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="max-h-40 overflow-y-auto mb-2 space-y-1">
          {messages.slice(-12).map((m) => (
            <p key={m.id} className="text-xs text-white">
              <span className="font-bold text-[#00f2fe]">{m.sender}</span>{' '}
              <span>{m.type === 'gift' ? `sent ${m.giftIcon ?? ''} ${m.giftName ?? ''}` : m.text}</span>
            </p>
          ))}
        </div>
        {notice && <p className="text-center text-xs text-white mb-2 px-4">{notice}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendChat();
          }}
          className="flex gap-2 mb-2"
        >
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder={streamId ? 'Say something…' : 'Chat opens when the stream is live'}
            disabled={!streamId}
            maxLength={300}
            className="flex-1 px-3 py-2 rounded-full bg-white/10 text-white text-sm outline-none placeholder:text-neutral-500"
          />
          <button type="submit" disabled={!streamId || !chatText.trim()} aria-label="Send" className="p-2 rounded-full bg-[#ff0050] disabled:opacity-40 text-white">
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FACEYOU_GIFTS.map((gift) => (
            <button
              key={gift.id}
              disabled={sending}
              onClick={() => void send(gift)}
              className="shrink-0 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs font-bold flex flex-col items-center"
            >
              <span className="text-xl">{gift.icon}</span>
              <span>{gift.name}</span>
              <span className="text-[10px] text-amber-300">{gift.cost} coins</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-neutral-400 text-center mt-1">Your coins: {viewer.coins.toLocaleString()}</p>
      </div>
    </div>
  );
};
