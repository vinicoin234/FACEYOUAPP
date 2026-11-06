import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { User } from '../types';
import {
  CallHandlers,
  CallMediaKind,
  CallPeer,
  CallSession,
  IncomingInvite,
  acceptCall,
  declineCall,
  placeCall,
  subscribeToInvites,
} from '../lib/webrtc';

interface CallContextValue {
  startCall: (peer: CallPeer, mediaKind: CallMediaKind) => void;
}

const CallContext = createContext<CallContextValue>({ startCall: () => {} });

export const useCall = () => useContext(CallContext);

type Phase = 'ringing' | 'connecting' | 'connected';

interface ActiveCall {
  peer: CallPeer;
  mediaKind: CallMediaKind;
  phase: Phase;
}

const INVITE_TIMEOUT_MS = 45000;

export const CallProvider: React.FC<{ currentUser: User; children: React.ReactNode }> = ({
  currentUser,
  children,
}) => {
  const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const busyRef = useRef(false);
  // Ref mirror so call callbacks (which outlive renders) always see the live stream
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  const self: CallPeer = {
    id: currentUser.id,
    name: currentUser.name,
    handle: currentUser.handle,
    avatar: currentUser.avatar,
  };

  // Keep the video elements in sync with the streams
  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteRef.current) {
      remoteRef.current.srcObject = remoteStream;
      void remoteRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setActive(null);
    setMuted(false);
    setCameraOff(false);
    sessionRef.current = null;
    busyRef.current = false;
  }, []);

  const handlers = (): CallHandlers => ({
    onRemoteStream: (s) => setRemoteStream(s),
    onConnected: () => setActive((prev) => (prev ? { ...prev, phase: 'connected' } : prev)),
    onEnd: (reason) => {
      cleanup();
      const messages: Record<string, string> = {
        declined: 'Call declined',
        'no-answer': 'No answer',
        failed: 'Call failed. The network may block direct connections.',
      };
      setNotice(messages[reason] ?? null);
    },
  });

  // Incoming invites for this user
  useEffect(() => {
    const unsubscribe = subscribeToInvites(currentUser.id, (inv) => {
      if (busyRef.current) {
        void declineCall(inv.callId);
        return;
      }
      setIncoming(inv);
      setTimeout(() => setIncoming((cur) => (cur?.callId === inv.callId ? null : cur)), INVITE_TIMEOUT_MS);
    });
    return unsubscribe;
  }, [currentUser.id]);

  const getMedia = (mediaKind: CallMediaKind) =>
    navigator.mediaDevices.getUserMedia({ audio: true, video: mediaKind === 'video' });

  const startCall = async (peer: CallPeer, mediaKind: CallMediaKind) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setNotice(null);
    let stream: MediaStream;
    try {
      stream = await getMedia(mediaKind);
    } catch {
      busyRef.current = false;
      setNotice(mediaKind === 'video' ? 'Allow camera and microphone to make a video call.' : 'Allow microphone access to make a call.');
      return;
    }
    streamRef.current = stream;
    setLocalStream(stream);
    setActive({ peer, mediaKind, phase: 'ringing' });
    try {
      sessionRef.current = await placeCall({ self, peer, mediaKind, stream, handlers: handlers() });
    } catch {
      cleanup();
      setNotice(`Could not reach ${peer.name}.`);
    }
  };

  const accept = async () => {
    const inv = incoming;
    if (!inv) return;
    setIncoming(null);
    if (busyRef.current) {
      void declineCall(inv.callId);
      return;
    }
    busyRef.current = true;
    let stream: MediaStream;
    try {
      stream = await getMedia(inv.mediaKind);
    } catch {
      busyRef.current = false;
      void declineCall(inv.callId);
      setNotice('Allow camera and microphone to answer.');
      return;
    }
    streamRef.current = stream;
    setLocalStream(stream);
    setActive({ peer: inv.from, mediaKind: inv.mediaKind, phase: 'connecting' });
    try {
      sessionRef.current = await acceptCall({ invite: inv, stream, handlers: handlers() });
    } catch {
      cleanup();
      setNotice('Could not connect the call.');
    }
  };

  const decline = () => {
    if (!incoming) return;
    void declineCall(incoming.callId);
    setIncoming(null);
  };

  const hangup = () => {
    sessionRef.current?.hangup(); // triggers onEnd -> cleanup
    if (!sessionRef.current) cleanup();
  };

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };

  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff(!cameraOff);
  };

  const phaseText = active
    ? active.phase === 'ringing'
      ? `Calling ${active.peer.name}…`
      : active.phase === 'connecting'
        ? 'Connecting…'
        : 'Connected'
    : '';

  return (
    <CallContext.Provider value={{ startCall: (p, k) => void startCall(p, k) }}>
      {children}

      {/* Incoming call */}
      {incoming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-xs bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center shadow-2xl">
            <img
              src={incoming.from.avatar}
              alt={incoming.from.name}
              className="w-20 h-20 rounded-full object-cover mx-auto mb-3 ring-2 ring-[#ff0050]"
            />
            <h3 className="text-base font-black text-white">{incoming.from.name}</h3>
            <p className="text-xs text-neutral-400 mb-6">
              Incoming {incoming.mediaKind === 'video' ? 'video' : 'voice'} call
            </p>
            <div className="flex justify-center gap-6">
              <button
                onClick={decline}
                aria-label="Decline call"
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <button
                onClick={() => void accept()}
                aria-label="Accept call"
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-white"
              >
                {incoming.mediaKind === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call */}
      {active && (
        <div className="fixed inset-0 z-[65] bg-black flex flex-col">
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className={`absolute inset-0 w-full h-full object-cover ${active.mediaKind === 'video' && remoteStream ? '' : 'opacity-0'}`}
          />
          {(active.mediaKind === 'audio' || !remoteStream) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-neutral-900 to-black">
              <img src={active.peer.avatar} alt="" className="w-28 h-28 rounded-full object-cover ring-4 ring-[#00f2fe]/50" />
              <p className="text-lg font-black text-white">{active.peer.name}</p>
            </div>
          )}

          {active.mediaKind === 'video' && localStream && (
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="absolute top-4 right-4 w-28 h-40 object-cover rounded-2xl border border-white/20 shadow-xl bg-neutral-900"
            />
          )}

          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/50 text-xs font-bold text-white">
            {phaseText}
          </div>

          <div className="absolute bottom-8 inset-x-0 flex justify-center gap-5">
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="w-14 h-14 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"
            >
              {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            {active.mediaKind === 'video' && (
              <button
                onClick={toggleCamera}
                aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
                className="w-14 h-14 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"
              >
                {cameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
            )}
            <button
              onClick={hangup}
              aria-label="End call"
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Notices (declined, no answer, errors) */}
      {!active && notice && (
        <button
          onClick={() => setNotice(null)}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] max-w-sm px-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-700 text-xs text-white shadow-xl"
        >
          {notice}
        </button>
      )}
    </CallContext.Provider>
  );
};
