import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Peer-to-peer video for live streams and 1:1 calls.
 * Signaling (offers / answers / ICE) travels over Supabase Realtime broadcast channels,
 * so no extra server is needed. Media flows directly between devices.
 *
 * Limits: STUN only works on most home/office networks. Many mobile carriers need a TURN relay.
 * Set VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL to add one.
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];
const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
if (turnUrl) {
  ICE_SERVERS.push({
    urls: turnUrl,
    username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
    credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
  });
}

const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

interface Signal {
  to?: string;
  from?: string;
  kind: string;
  data?: unknown;
}

/** Subscribe to a channel and resolve once the subscription is live. Handlers are attached before subscribing. */
function openChannel(name: string, onSignal: (s: Signal) => void): Promise<RealtimeChannel> {
  return new Promise((resolve, reject) => {
    const ch = supabase
      .channel(name, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'signal' }, ({ payload }) => onSignal(payload as Signal));
    ch.subscribe((status) => {
      const s = String(status);
      if (s === 'SUBSCRIBED') resolve(ch);
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') reject(new Error(s));
    });
  });
}

// ICE candidates can arrive before the remote description is applied. Buffer them until it is.
const pendingIce = new WeakMap<RTCPeerConnection, RTCIceCandidateInit[]>();

async function setRemote(pc: RTCPeerConnection, desc: RTCSessionDescriptionInit) {
  await pc.setRemoteDescription(desc);
  const queued = pendingIce.get(pc) ?? [];
  pendingIce.delete(pc);
  for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
}

async function addIce(pc: RTCPeerConnection | null | undefined, c: RTCIceCandidateInit) {
  if (!pc) return;
  if (!pc.remoteDescription) {
    pendingIce.set(pc, [...(pendingIce.get(pc) ?? []), c]);
    return;
  }
  await pc.addIceCandidate(c).catch(() => {});
}

function sendSignal(ch: RealtimeChannel, payload: Signal) {
  void ch.send({ type: 'broadcast', event: 'signal', payload });
}

/* ------------------------------------------------------------------ */
/* LIVE BROADCAST (host side)                                          */
/* ------------------------------------------------------------------ */

export interface Broadcaster {
  /** Attach the host's camera/mic. Already-connected viewers are renegotiated automatically. */
  setMedia(stream: MediaStream | null): void;
  stop(): void;
}

export function startBroadcast(
  hostId: string,
  opts: { onViewerCount?: (connected: number) => void } = {}
): Broadcaster {
  let media: MediaStream | null = null;
  let stopped = false;
  let channel: RealtimeChannel | null = null;
  const peers = new Map<string, RTCPeerConnection>();

  const reportCount = () => {
    let n = 0;
    peers.forEach((pc) => {
      if (pc.connectionState === 'connected') n++;
    });
    opts.onViewerCount?.(n);
  };

  const sendOffer = async (viewerId: string, pc: RTCPeerConnection) => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (channel) sendSignal(channel, { to: viewerId, from: 'host', kind: 'offer', data: pc.localDescription });
  };

  const addMediaTo = (pc: RTCPeerConnection) => {
    if (!media) return false;
    let added = false;
    media.getTracks().forEach((track) => {
      if (!pc.getSenders().some((s) => s.track === track)) {
        pc.addTrack(track, media as MediaStream);
        added = true;
      }
    });
    return added;
  };

  const createPeer = (viewerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && channel) {
        sendSignal(channel, { to: viewerId, from: 'host', kind: 'ice', data: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        if (peers.get(viewerId) === pc) peers.delete(viewerId);
      }
      reportCount();
    };
    peers.set(viewerId, pc);
    return pc;
  };

  const handle = async (s: Signal) => {
    if (stopped || s.to !== 'host' || !s.from) return;
    const viewerId = s.from;

    if (s.kind === 'viewer-join') {
      const existing = peers.get(viewerId);
      // Ignore duplicate joins from a viewer who is already connected (they retry until connected)
      if (existing && existing.connectionState === 'connected') return;
      existing?.close();
      const pc = createPeer(viewerId);
      addMediaTo(pc);
      await sendOffer(viewerId, pc);
    } else if (s.kind === 'answer') {
      const pc = peers.get(viewerId);
      if (pc) await setRemote(pc, s.data as RTCSessionDescriptionInit).catch(() => {});
    } else if (s.kind === 'ice') {
      await addIce(peers.get(viewerId), s.data as RTCIceCandidateInit);
    } else if (s.kind === 'viewer-leave') {
      peers.get(viewerId)?.close();
      peers.delete(viewerId);
      reportCount();
    }
  };

  openChannel(`live:${hostId}`, (s) => void handle(s))
    .then((ch) => {
      if (stopped) {
        supabase.removeChannel(ch);
        return;
      }
      channel = ch;
    })
    .catch((err) => console.warn('Live channel failed:', err));

  return {
    setMedia(stream) {
      media = stream;
      peers.forEach((pc, viewerId) => {
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed') return;
        if (addMediaTo(pc)) void sendOffer(viewerId, pc); // renegotiate so viewers receive the new tracks
      });
    },
    stop() {
      stopped = true;
      peers.forEach((pc) => pc.close());
      peers.clear();
      if (channel) supabase.removeChannel(channel);
      channel = null;
    },
  };
}

/* ------------------------------------------------------------------ */
/* LIVE VIEWER                                                         */
/* ------------------------------------------------------------------ */

export type ViewerStatus = 'connecting' | 'live' | 'offline';

export function watchBroadcast(
  hostId: string,
  onStream: (stream: MediaStream | null) => void,
  onStatus: (status: ViewerStatus) => void
): () => void {
  const selfId = newId();
  let stopped = false;
  let channel: RealtimeChannel | null = null;
  let pc: RTCPeerConnection | null = null;
  let retry: ReturnType<typeof setInterval> | null = null;
  let connected = false;

  const createPeer = () => {
    const p = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    p.onicecandidate = (e) => {
      if (e.candidate && channel) {
        sendSignal(channel, { to: 'host', from: selfId, kind: 'ice', data: e.candidate.toJSON() });
      }
    };
    p.ontrack = (e) => {
      onStream(e.streams[0] ?? new MediaStream([e.track]));
    };
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected') {
        connected = true;
        if (retry) clearInterval(retry);
        onStatus('live');
      } else if (p.connectionState === 'failed' || p.connectionState === 'closed') {
        connected = false;
        onStream(null);
        onStatus('offline');
      }
    };
    return p;
  };

  const handle = async (s: Signal) => {
    if (stopped || s.to !== selfId) return;
    if (s.kind === 'offer') {
      if (!pc || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc?.close();
        pc = createPeer();
      }
      await setRemote(pc, s.data as RTCSessionDescriptionInit);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (channel) sendSignal(channel, { to: 'host', from: selfId, kind: 'answer', data: pc.localDescription });
    } else if (s.kind === 'ice') {
      await addIce(pc, s.data as RTCIceCandidateInit);
    }
  };

  onStatus('connecting');
  openChannel(`live:${hostId}`, (s) => void handle(s))
    .then((ch) => {
      if (stopped) {
        supabase.removeChannel(ch);
        return;
      }
      channel = ch;
      const join = () => {
        if (!stopped && !connected && channel) {
          sendSignal(channel, { to: 'host', from: selfId, kind: 'viewer-join' });
        }
      };
      join();
      retry = setInterval(join, 3000); // host may not be listening yet; keep knocking until connected
    })
    .catch(() => onStatus('offline'));

  return () => {
    stopped = true;
    if (retry) clearInterval(retry);
    if (channel) {
      sendSignal(channel, { to: 'host', from: selfId, kind: 'viewer-leave' });
      supabase.removeChannel(channel);
    }
    pc?.close();
    onStream(null);
  };
}

/* ------------------------------------------------------------------ */
/* 1:1 CALLS (voice & video)                                           */
/* ------------------------------------------------------------------ */

export interface CallPeer {
  id: string;
  name: string;
  handle: string;
  avatar: string;
}

export type CallMediaKind = 'audio' | 'video';

export interface IncomingInvite {
  callId: string;
  mediaKind: CallMediaKind;
  from: CallPeer;
}

export interface CallSession {
  hangup: () => void;
}

export interface CallHandlers {
  onRemoteStream: (stream: MediaStream) => void;
  onConnected: () => void;
  onEnd: (reason: 'ended' | 'declined' | 'no-answer' | 'failed') => void;
}

/** Listen for incoming call invites addressed to this user. */
export function subscribeToInvites(userId: string, onInvite: (inv: IncomingInvite) => void): () => void {
  const ch = supabase
    .channel(`user:${userId}`)
    .on('broadcast', { event: 'invite' }, ({ payload }) => onInvite(payload as IncomingInvite));
  ch.subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

/** Deliver an invite to the callee's personal channel (they must be subscribed to receive it). */
async function sendInvite(calleeId: string, invite: IncomingInvite): Promise<void> {
  const ch = supabase.channel(`user:${calleeId}`, { config: { broadcast: { self: false } } });
  await new Promise<void>((resolve, reject) => {
    ch.subscribe((status) => {
      const s = String(status);
      if (s === 'SUBSCRIBED') resolve();
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') reject(new Error(s));
    });
  });
  await ch.send({ type: 'broadcast', event: 'invite', payload: invite });
  supabase.removeChannel(ch);
}

function buildCallPeer(
  ch: RealtimeChannel,
  stream: MediaStream,
  h: CallHandlers,
  finish: (reason: 'ended' | 'failed') => void
) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  pc.onicecandidate = (e) => {
    if (e.candidate) sendSignal(ch, { kind: 'ice', data: e.candidate.toJSON() });
  };
  pc.ontrack = (e) => h.onRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') h.onConnected();
    if (pc.connectionState === 'failed') finish('failed');
  };
  // Caller makes the offer once the callee says it is ready
  const makeOffer = async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(ch, { kind: 'offer', data: pc.localDescription });
  };
  return { pc, makeOffer };
}

/** Caller: rings the callee, and starts the call once they accept. */
export async function placeCall(opts: {
  self: CallPeer;
  peer: CallPeer;
  mediaKind: CallMediaKind;
  stream: MediaStream;
  handlers: CallHandlers;
}): Promise<CallSession> {
  const { self, peer, mediaKind, stream, handlers } = opts;
  const callId = newId();
  let ended = false;
  let peerObj: ReturnType<typeof buildCallPeer> | null = null;
  let ringTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = (reason: 'ended' | 'declined' | 'no-answer' | 'failed', notify = true) => {
    if (ended) return;
    ended = true;
    if (ringTimer) clearTimeout(ringTimer);
    if (notify && ch) sendSignal(ch, { kind: 'hangup' });
    peerObj?.pc.close();
    if (ch) supabase.removeChannel(ch);
    handlers.onEnd(reason);
  };

  let ch: RealtimeChannel | null = null;
  ch = await openChannel(`call:${callId}`, (s) => {
    if (ended) return;
    if (s.kind === 'ready' && !peerObj) {
      peerObj = buildCallPeer(ch as RealtimeChannel, stream, handlers, (r) => finish(r));
      if (ringTimer) clearTimeout(ringTimer);
      void peerObj.makeOffer();
    } else if (s.kind === 'answer') {
      if (peerObj) void setRemote(peerObj.pc, s.data as RTCSessionDescriptionInit).catch(() => {});
    } else if (s.kind === 'ice') {
      void addIce(peerObj?.pc, s.data as RTCIceCandidateInit);
    } else if (s.kind === 'decline') {
      finish('declined', false);
    } else if (s.kind === 'hangup') {
      finish('ended', false);
    }
  });

  ringTimer = setTimeout(() => finish('no-answer'), 45000);
  try {
    await sendInvite(peer.id, { callId, mediaKind, from: self });
  } catch {
    finish('failed', false);
  }

  return { hangup: () => finish('ended') };
}

/** Callee: accept an invite. Opens the call channel and waits for the caller's offer. */
export async function acceptCall(opts: {
  invite: IncomingInvite;
  stream: MediaStream;
  handlers: CallHandlers;
}): Promise<CallSession> {
  const { invite, stream, handlers } = opts;
  let ended = false;
  let peerObj: ReturnType<typeof buildCallPeer> | null = null;
  let ch: RealtimeChannel | null = null;

  const finish = (reason: 'ended' | 'failed', notify = true) => {
    if (ended) return;
    ended = true;
    if (notify && ch) sendSignal(ch, { kind: 'hangup' });
    peerObj?.pc.close();
    if (ch) supabase.removeChannel(ch);
    handlers.onEnd(reason);
  };

  ch = await openChannel(`call:${invite.callId}`, (s) => {
    if (ended) return;
    if (s.kind === 'offer' && !peerObj) {
      peerObj = buildCallPeer(ch as RealtimeChannel, stream, handlers, (r) => finish(r));
      void (async () => {
        const pc = peerObj!.pc;
        await setRemote(pc, s.data as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(ch as RealtimeChannel, { kind: 'answer', data: pc.localDescription });
      })().catch(() => finish('failed'));
    } else if (s.kind === 'ice') {
      void addIce(peerObj?.pc, s.data as RTCIceCandidateInit);
    } else if (s.kind === 'hangup') {
      finish('ended', false);
    }
  });
  sendSignal(ch, { kind: 'ready' });

  return { hangup: () => finish('ended') };
}

/** Callee: decline an invite so the caller stops ringing. */
export async function declineCall(callId: string): Promise<void> {
  try {
    const ch = await openChannel(`call:${callId}`, () => {});
    sendSignal(ch, { kind: 'decline' });
    supabase.removeChannel(ch);
  } catch {
    // Caller will time out anyway
  }
}
