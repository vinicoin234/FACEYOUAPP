import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Radio,
  Square,
  Users,
  Heart,
  Volume2,
  VolumeX,
  RefreshCw,
  Sparkles,
  Share2,
  Gift as GiftIcon,
  X,
  Send,
  Coins,
  Power,
  CheckCircle,
  VideoOff,
  AlertTriangle,
  ArrowLeft,
  Smile,
  Zap
} from 'lucide-react';
import { User, GiftItem, ChatMessage } from '../types';
import { FACEYOU_GIFTS } from '../data/mockData';
import { playTapHeartSound, playLiveStartBeep, playGiftFanfare } from '../utils/audio';
import { recordStreamStart, recordStreamEnd, publishStreamMessage } from '../lib/supabase';
import { sendStreamHeartbeat, HEARTBEAT_INTERVAL_MS } from '../lib/discovery';
import { startBroadcast, Broadcaster } from '../lib/webrtc';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  color?: string;
  emoji: string;
  animClass?: string;
  sizeClass?: string;
}

export interface LiveReactionItem {
  emoji: string;
  label: string;
  color: string;
}

export const LIVE_REACTIONS: LiveReactionItem[] = [
  { emoji: '😂', label: 'Laugh', color: '#ffb703' },
  { emoji: '😱', label: 'Shocked', color: '#00f2fe' },
  { emoji: '😮', label: 'Wow', color: '#8ecae6' },
  { emoji: '🔥', label: 'Fire', color: '#ff4d00' },
  { emoji: '👏', label: 'Clap', color: '#ffd166' },
  { emoji: '🥳', label: 'Party', color: '#a2d2ff' },
  { emoji: '🤯', label: 'Mindblown', color: '#c77dff' },
  { emoji: '💖', label: 'Love', color: '#ff0050' },
  { emoji: '💯', label: '100', color: '#ff0050' },
  { emoji: '😭', label: 'Sob', color: '#3a86ff' },
  { emoji: '💀', label: 'Dead', color: '#e5e5e5' },
  { emoji: '🚀', label: 'Rocket', color: '#7209b7' },
];

interface ActiveGiftAnimation {
  id: string;
  gift: GiftItem;
  sender: string;
  combo: number;
}

interface FaceYouLiveStreamProps {
  user: User;
  onViewerCountChange?: (count: number) => void;
  isStreaming: boolean;
  setIsStreaming: (val: boolean) => void;
  streamDuration: number;
  viewerCount: number;
  likeCount: number;
  setLikeCount: React.Dispatch<React.SetStateAction<number>>;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSendGift: (gift: GiftItem) => void;
  onOpenRecharge: () => void;
  onOpenShare: (title: string) => void;
  onOpenViewersModal?: () => void;
  onCloseStream: () => void;
  onUpdateUser?: (updated: Partial<User>) => void;
}

export const FaceYouLiveStream: React.FC<FaceYouLiveStreamProps> = ({
  user,
  isStreaming,
  setIsStreaming,
  onViewerCountChange,
  onOpenViewersModal,
  streamDuration,
  viewerCount,
  likeCount,
  setLikeCount,
  messages,
  onSendMessage,
  onSendGift,
  onOpenRecharge,
  onOpenShare,
  onCloseStream,
  onUpdateUser,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamIdRef = useRef<string | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'none' | 'warm' | 'cyber' | 'mono' | 'glam'>('none');
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [showGiftDrawer, setShowGiftDrawer] = useState<boolean>(false);
  const [showReactionTray, setShowReactionTray] = useState<boolean>(false);
  const [burstMultiplier, setBurstMultiplier] = useState<1 | 3 | 5>(1);
  const [lastReactionNotice, setLastReactionNotice] = useState<string | null>(null);
  const [selfGiftToast, setSelfGiftToast] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<GiftItem>(FACEYOU_GIFTS[0]);
  const [quickRoseCombo, setQuickRoseCombo] = useState<number>(0);
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<ActiveGiftAnimation | null>(null);
  
  // End Livestream Modals & State
  const [showEndConfirm, setShowEndConfirm] = useState<boolean>(false);
  const [showEndSummary, setShowEndSummary] = useState<boolean>(false);
  const [summaryStats, setSummaryStats] = useState({ duration: 0, viewers: 0, likes: 0, xpEarned: 0 });

  // Chat input
  const [chatInputText, setChatInputText] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: isFlipped ? 'environment' : 'user',
        },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err: unknown) {
      console.warn('Webcam permission or device error, using virtual live stage:', err);
      setCameraError('Webcam unavailable. Virtual studio broadcast stage active!');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Turn Camera On or Off
  const toggleCamera = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Start Broadcasting
  // Real video to viewers: peer-to-peer broadcast of the host's camera/mic.
  const broadcasterRef = useRef<Broadcaster | null>(null);
  useEffect(() => {
    if (!isStreaming) return;
    const b = startBroadcast(user.id, { onViewerCount: (n) => onViewerCountChange?.(n) });
    broadcasterRef.current = b;
    return () => {
      b.stop();
      broadcasterRef.current = null;
      onViewerCountChange?.(0);
    };
  }, [isStreaming, user.id]);

  // Attach the camera as soon as it is ready (it may start after going live)
  useEffect(() => {
    broadcasterRef.current?.setMedia(isCameraActive ? streamRef.current : null);
  }, [isCameraActive]);

  // Keep this stream listed for viewers: send a heartbeat while live.
  // Without it, a stream whose host closed the tab would stay "live" forever.
  const viewerCountRef = useRef(viewerCount);
  viewerCountRef.current = viewerCount;
  useEffect(() => {
    if (!isStreaming) return;
    const beat = () => {
      if (streamIdRef.current) sendStreamHeartbeat(streamIdRef.current, viewerCountRef.current);
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isStreaming]);

  const startLive = () => {
    if (!isCameraActive) {
      startCamera();
    }
    playLiveStartBeep();
    setIsStreaming(true);

    // Record stream start in Supabase
    recordStreamStart(user.id, `${user.name}'s FaceYou LIVE`).then((id) => {
      streamIdRef.current = id;
    });
  };

  // End / Stop Live Stream Execution
  const executeEndLivestream = () => {
    const minutesStreamed = Math.floor(streamDuration / 60);
    const durationXp = minutesStreamed * 5; // 5 XP per minute broadcasted
    const newTotalDuration = (user.totalStreamDurationSeconds || 0) + streamDuration;
    const newStreamLikes = (user.streamLikesReceived || 0) + likeCount;

    setSummaryStats({
      duration: streamDuration,
      viewers: viewerCount,
      likes: likeCount,
      xpEarned: durationXp,
    });

    if (onUpdateUser) {
      onUpdateUser({
        totalStreamDurationSeconds: newTotalDuration,
        streamLikesReceived: newStreamLikes,
        likes: (user.likes || 0) + likeCount,
      });
    }

    // Record stream end in Supabase
    recordStreamEnd(streamIdRef.current, viewerCount, likeCount);

    setIsStreaming(false);
    stopCamera();
    setShowEndConfirm(false);
    setShowEndSummary(true);
  };

  // Turn off or confirm ending livestream
  const requestEndLivestream = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowEndConfirm(true);
  };

  const toggleStreaming = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isStreaming) {
      startLive();
    } else {
      requestEndLivestream();
    }
  };

  const handleCloseEntirely = () => {
    if (isStreaming) {
      requestEndLivestream();
    } else {
      stopCamera();
      onCloseStream();
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleFlip = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFlipped(!isFlipped);
    if (isCameraActive) {
      setTimeout(() => startCamera(), 100);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleScreenTap = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Screen tap likes and hearts are STRICTLY active when live streaming only
      if (!isStreaming) {
        return;
      }

      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('.no-tap')) {
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      playTapHeartSound();
      setLikeCount((prev) => prev + 1);

      const emojis = ['💖', '❤️', '🔥', '✨', '⚡', '🥰'];
      const colors = ['#ff0050', '#00f2fe', '#ffd700', '#ff3366'];

      const animOptions = ['animate-floating-heart', 'animate-float-reaction-left', 'animate-float-reaction-right'];
      const newHeart: FloatingHeart = {
        id: Date.now() + Math.random(),
        x,
        y,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        animClass: animOptions[Math.floor(Math.random() * animOptions.length)],
        sizeClass: 'text-3xl',
      };

      setFloatingHearts((prev) => [...prev.slice(-40), newHeart]);

      setTimeout(() => {
        setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
      }, 2200);
    },
    [isStreaming, setLikeCount]
  );

  // Send Floating Reactions from Reaction Tray (laughing, shocked, fire, clap, etc.)
  const sendFloatingReaction = useCallback(
    (emoji: string, count = 1, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      playTapHeartSound();
      setLikeCount((prev) => prev + count);

      const animOptions = [
        'animate-floating-heart',
        'animate-float-reaction-left',
        'animate-float-reaction-right',
      ];
      const sizeOptions = ['text-3xl', 'text-4xl', 'text-5xl'];

      const newParticles: FloatingHeart[] = [];
      const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
      const baseAnchorX = Math.min(containerWidth * 0.72, containerWidth - 70);

      for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * 110;
        const offsetY = Math.random() * 50 + i * 20;
        const targetX = Math.max(35, Math.min(containerWidth - 55, baseAnchorX + offsetX));
        const targetY =
          (typeof window !== 'undefined' ? window.innerHeight * 0.73 : 550) + offsetY;

        const p: FloatingHeart = {
          id: Date.now() + Math.random() + i,
          x: targetX,
          y: targetY,
          emoji,
          animClass: animOptions[Math.floor(Math.random() * animOptions.length)],
          sizeClass: sizeOptions[Math.floor(Math.random() * sizeOptions.length)],
        };
        newParticles.push(p);
      }

      setFloatingHearts((prev) => [...prev.slice(-45), ...newParticles]);

      setTimeout(() => {
        setFloatingHearts((prev) =>
          prev.filter((h) => !newParticles.some((np) => np.id === h.id))
        );
      }, 2300);

      setLastReactionNotice(emoji);
      setTimeout(() => {
        setLastReactionNotice((cur) => (cur === emoji ? null : cur));
      }, 1200);
    },
    [setLikeCount]
  );

  const handleQuickRose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // STREAMERS CANNOT GIFT THEMSELVES!
    if (isStreaming) {
      setSelfGiftToast('⚠️ Broadcasters cannot gift themselves! Viewer gifts and coins must come from audience fans.');
      setTimeout(() => setSelfGiftToast(null), 3500);
      return;
    }

    const roseGift = FACEYOU_GIFTS[0];
    if (user.coins < roseGift.cost) {
      onOpenRecharge();
      return;
    }

    const nextCombo = quickRoseCombo + 1;
    setQuickRoseCombo(nextCombo);

    playGiftFanfare('low');
    onSendGift(roseGift);

    setActiveGiftAnimation({
      id: String(Date.now()),
      gift: roseGift,
      sender: user.name,
      combo: nextCombo,
    });

    setTimeout(() => {
      setActiveGiftAnimation(null);
    }, 2200);
  };

  const handleSendDrawerGift = (gift: GiftItem) => {
    // STREAMERS CANNOT GIFT THEMSELVES!
    if (isStreaming) {
      setSelfGiftToast('⚠️ Broadcasters cannot gift themselves! Viewer gifts and coins must come from fans.');
      setTimeout(() => setSelfGiftToast(null), 3500);
      setShowGiftDrawer(false);
      return;
    }

    if (user.coins < gift.cost) {
      onOpenRecharge();
      return;
    }

    playGiftFanfare(gift.tier);
    onSendGift(gift);
    setShowGiftDrawer(false);

    setActiveGiftAnimation({
      id: String(Date.now()),
      gift,
      sender: user.name,
      combo: 1,
    });

    setTimeout(() => {
      setActiveGiftAnimation(null);
    }, 2500);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    onSendMessage(chatInputText.trim());
    setChatInputText('');
  };

  const getFilterStyle = () => {
    switch (selectedFilter) {
      case 'warm':
        return 'sepia(0.3) saturate(1.4) brightness(1.05)';
      case 'cyber':
        return 'hue-rotate(290deg) contrast(1.2) saturate(1.3)';
      case 'mono':
        return 'grayscale(1) contrast(1.2)';
      case 'glam':
        return 'brightness(1.1) contrast(1.05) saturate(1.2) blur(0.2px)';
      default:
        return 'none';
    }
  };

  return (
    <div
      onClick={handleScreenTap}
      className={`relative w-full h-full bg-black overflow-hidden flex flex-col justify-between select-none ${
        isStreaming ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {/* Real Video Element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          filter: getFilterStyle(),
          transform: !isFlipped ? 'scaleX(-1)' : 'none',
        }}
        className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${
          isCameraActive ? 'opacity-100 z-0' : 'opacity-0 -z-10'
        }`}
      />

      {/* Simulated Live Studio Stage (when camera is off) */}
      {!isCameraActive && (
        <div
          style={{ filter: getFilterStyle() }}
          className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-900 via-rose-950/40 to-black text-center p-6"
        >
          <div className="relative mb-3">
            <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-[#ff0050] via-rose-600 to-[#00f2fe] shadow-2xl animate-pulse">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full rounded-full object-cover border-2 border-black"
              />
            </div>
            {isStreaming && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#ff0050] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 border border-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                LIVE
              </span>
            )}
          </div>

          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
            {user.name}
          </h2>
          <p className="text-xs text-neutral-400 max-w-xs mt-1 mb-4">
            {isStreaming
              ? 'Broadcasting live on FaceYou! Audio is active. Tap camera button to show video.'
              : 'Tap Go Live to start streaming, or turn on your webcam'}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleCamera}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold backdrop-blur-md transition-all hover:scale-105 no-tap flex items-center gap-2"
            >
              <Camera className="w-4 h-4 text-[#ff0050]" />
              <span>Turn On Camera</span>
            </button>

            {isStreaming && (
              <button
                onClick={requestEndLivestream}
                className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider backdrop-blur-md transition-all hover:scale-105 no-tap flex items-center gap-2 shadow-lg shadow-red-600/60 border border-white"
                title="End Livestream"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>End Livestream</span>
              </button>
            )}
          </div>

          {cameraError && (
            <p className="text-[11px] text-amber-300 mt-3 bg-black/60 px-3 py-1 rounded-full border border-amber-500/30">
              {cameraError}
            </p>
          )}
        </div>
      )}

      {/* TOP BAR: Host Info & PROMINENT END LIVESTREAM BUTTON */}
      <div className="relative z-30 flex items-center justify-between px-3 pt-3 pb-2 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
        {/* Host Info Pill */}
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-auto">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover border-1.5 border-[#ff0050]"
          />
          <div className="flex flex-col text-left pr-1">
            <span className="text-xs font-black text-white leading-tight flex items-center gap-1">
              {user.name}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 leading-tight">
              {isStreaming ? (
                <span className="text-[#ff0050] font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff0050] animate-ping" />
                  LIVE • {formatTime(streamDuration)}
                </span>
              ) : (
                <span className="text-neutral-400">Preview Mode</span>
              )}
            </div>
          </div>
        </div>

        {/* Viewers & END LIVESTREAM CONTROLS */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Viewers Badge - Clickable to open Viewers Modal */}
          {isStreaming && (
            <button
              onClick={onOpenViewersModal}
              className="flex items-center gap-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/15 text-xs font-bold text-white transition-all cursor-pointer shadow-lg"
              title="View active live stream viewers & moderate"
            >
              <Users className="w-3.5 h-3.5 text-[#00f2fe]" />
              <span>{viewerCount.toLocaleString()}</span>
            </button>
          )}

          {/* Camera Video Toggle */}
          <button
            onClick={toggleCamera}
            className={`px-2.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border transition-all ${
              isCameraActive
                ? 'bg-neutral-800/80 border-white/20 text-neutral-200 hover:text-white'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            }`}
            title={isCameraActive ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {isCameraActive ? <CameraOff className="w-3.5 h-3.5 text-rose-400" /> : <Camera className="w-3.5 h-3.5 text-amber-400" />}
            <span className="text-[10px] hidden sm:inline">{isCameraActive ? 'Cam Off' : 'Cam On'}</span>
          </button>

          {/* PROMINENT END LIVESTREAM BUTTON (TOP BAR) */}
          {isStreaming ? (
            <button
              onClick={requestEndLivestream}
              className="px-3.5 sm:px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-2xl shadow-red-600/80 border-2 border-white animate-pulse transition-all active:scale-95 cursor-pointer"
              title="End Livestream"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>End Livestream</span>
            </button>
          ) : (
            <button
              onClick={handleCloseEntirely}
              className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center gap-1.5 text-white hover:bg-white/20 text-xs font-bold transition-all"
              title="Close Stream Preview"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          )}
        </div>
      </div>

      {/* FLOATING TOP-CENTER END LIVESTREAM BUTTON (Active Broadcast) */}
      {isStreaming && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-auto no-tap flex items-center gap-2">
          <button
            onClick={requestEndLivestream}
            className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl shadow-red-600/80 border-2 border-white animate-pulse transition-all active:scale-95 cursor-pointer"
            title="End Livestream"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>END LIVESTREAM</span>
          </button>
        </div>
      )}

      {/* Floating Hearts & Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        {floatingHearts.map((heart) => (
          <div
            key={heart.id}
            style={{ left: `${heart.x}px`, top: `${heart.y}px`, color: heart.color }}
            className={`absolute select-none drop-shadow-lg ${heart.sizeClass || 'text-3xl'} ${
              heart.animClass || 'animate-floating-heart'
            }`}
          >
            {heart.emoji}
          </div>
        ))}
      </div>

      {/* Floating Reaction Notice Badge */}
      {lastReactionNotice && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-bounce">
          <div className="bg-black/80 backdrop-blur-md border border-white/20 px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xl">
            <span className="text-xl">{lastReactionNotice}</span>
            <span className="text-[11px] font-black text-white uppercase tracking-wider">Reacted!</span>
          </div>
        </div>
      )}

      {/* Self Gift Prevention Warning Toast */}
      {selfGiftToast && (
        <div className="absolute top-28 left-4 right-4 z-50 pointer-events-none flex justify-center animate-bounce">
          <div className="bg-neutral-900/95 border-2 border-amber-400 text-amber-300 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 max-w-sm text-center">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{selfGiftToast}</span>
          </div>
        </div>
      )}

      {/* Fullscreen Big Gift Animation Overlay */}
      {activeGiftAnimation && (
        <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] animate-gift-pop">
          {activeGiftAnimation.gift.id === 'galaxy' && (
            <div className="absolute w-72 h-72 rounded-full border-4 border-dashed border-purple-500/60 animate-cosmic-spin" />
          )}

          <div className="relative flex flex-col items-center">
            <div className="text-7xl sm:text-8xl filter drop-shadow-[0_10px_25px_rgba(255,0,80,0.7)] animate-bounce mb-2">
              {activeGiftAnimation.gift.icon}
            </div>

            <div className="bg-gradient-to-r from-[#ff0050] via-purple-600 to-[#00f2fe] px-6 py-2 rounded-full shadow-2xl border-2 border-white/40 text-center">
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white/90">
                {activeGiftAnimation.sender} sent
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight drop-shadow">
                {activeGiftAnimation.gift.name}
              </h3>
            </div>

            {activeGiftAnimation.combo > 1 && (
              <div className="mt-2 text-2xl sm:text-3xl font-black italic text-amber-300 drop-shadow-[0_2px_10px_rgba(255,215,0,0.8)] animate-pulse">
                x{activeGiftAnimation.combo} COMBO! 🔥
              </div>
            )}
          </div>
        </div>
      )}

      {/* RIGHT TOOLBAR */}
      <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-3 no-tap">
        <div className="flex flex-col items-center">
          <button
            onClick={(e) => sendFloatingReaction('💖', burstMultiplier, e)}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/15 hover:border-rose-500/50 flex items-center justify-center text-[#ff0050] shadow-lg transition-transform active:scale-125 hover:scale-110 cursor-pointer"
            title="Like & Boost Stream Visibility on Feed"
          >
            <Heart className="w-5 h-5 fill-[#ff0050]" />
          </button>
          <span className="text-[10px] font-extrabold text-white mt-0.5 drop-shadow">
            {likeCount > 999 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
          </span>
          <span className="text-[8px] font-black text-amber-300 uppercase tracking-tight">
            Hype
          </span>
        </div>

        {/* Turn Off / On Camera */}
        <button
          onClick={toggleCamera}
          className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-transform hover:scale-110 shadow-lg ${
            isCameraActive
              ? 'bg-black/50 border-white/15 text-white'
              : 'bg-rose-600/50 border-rose-500 text-rose-300'
          }`}
          title={isCameraActive ? 'Turn Off Webcam' : 'Turn On Webcam'}
        >
          {isCameraActive ? <Camera className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            const filters: Array<'none' | 'warm' | 'cyber' | 'mono' | 'glam'> = ['none', 'warm', 'cyber', 'mono', 'glam'];
            const next = filters[(filters.indexOf(selectedFilter) + 1) % filters.length];
            setSelectedFilter(next);
          }}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#00f2fe] hover:scale-110 shadow-lg transition-transform"
          title={`Filter: ${selectedFilter}`}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Dedicated End Livestream Button in Right Toolbar */}
        {isStreaming && (
          <button
            onClick={requestEndLivestream}
            className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-2xl shadow-red-600/80 border-2 border-white transition-transform hover:scale-110 active:scale-95 animate-pulse cursor-pointer"
            title="End Livestream"
          >
            <Square className="w-5 h-5 fill-white" />
          </button>
        )}

        <button
          onClick={toggleFlip}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:scale-110 shadow-lg transition-transform"
          title="Flip camera"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          onClick={toggleMute}
          className={`w-10 h-10 rounded-full border border-white/15 flex items-center justify-center transition-transform hover:scale-110 shadow-lg ${
            isMuted ? 'bg-red-500/30 text-rose-300' : 'bg-black/50 text-white'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenShare(`Watch ${user.name} LIVE on FaceYou!`);
          }}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:scale-110 shadow-lg transition-transform"
          title="Share Stream"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* FLOATING CHAT OVERLAY */}
      <div className="relative z-20 flex flex-col justify-end px-3 pb-2 w-full max-w-sm pointer-events-none">
        <div className="h-44 overflow-y-auto space-y-1.5 scrollbar-none pr-2 flex flex-col justify-end">
          {messages.slice(-8).map((msg) => {
            if (msg.type === 'system') {
              return (
                <div
                  key={msg.id}
                  className="bg-black/40 backdrop-blur-md border border-amber-500/30 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-xl w-fit"
                >
                  ✨ {msg.text}
                </div>
              );
            }

            if (msg.type === 'gift') {
              return (
                <div
                  key={msg.id}
                  className="bg-gradient-to-r from-rose-950/80 to-black/70 border-l-2 border-[#ff0050] backdrop-blur-md px-2.5 py-1 rounded-xl flex items-center gap-1.5 w-fit"
                >
                  <span className="text-base">{msg.giftIcon || '🎁'}</span>
                  <span className="text-xs font-bold text-white">{msg.sender}</span>
                  <span className="text-[11px] text-rose-300 font-semibold">
                    sent {msg.giftName}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className="bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-xl w-fit max-w-[90%] text-xs border border-white/5"
              >
                <span className="font-extrabold text-[#00f2fe] mr-1.5">
                  {msg.sender}:
                </span>
                <span className="font-medium text-white">{msg.text}</span>
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* FLOATING REACTION TRAY DOCK */}
      {showReactionTray && (
        <div className="absolute bottom-32 sm:bottom-36 left-3 right-3 sm:left-auto sm:right-3 sm:w-96 z-40 no-tap animate-fadeIn">
          <div className="bg-neutral-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-3.5 shadow-2xl shadow-black/90">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#ff0050] to-[#00f2fe] p-0.5 flex items-center justify-center shadow">
                  <div className="w-full h-full bg-black/60 rounded-[10px] flex items-center justify-center text-xs">
                    😂
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5 leading-tight">
                    <span>Live Reaction Tray</span>
                    <span className="text-[9px] font-bold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20">
                      Floating
                    </span>
                  </h4>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    Tap to flood the stream with floating emojis
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Multiplier / Burst pills */}
                <div className="flex items-center bg-neutral-900 border border-white/10 rounded-full p-0.5 text-[10px] font-bold">
                  {([1, 3, 5] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setBurstMultiplier(m)}
                      className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                        burstMultiplier === m
                          ? 'bg-[#ff0050] text-white shadow'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      title={`Send ${m} floating emoji${m > 1 ? 's' : ''} per tap`}
                    >
                      {m}x
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowReactionTray(false)}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close tray"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Reaction Emojis Grid (Laughing, Shocked, Wow, Fire, Clap, etc.) */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {LIVE_REACTIONS.map((item) => (
                <button
                  key={item.emoji}
                  onClick={(e) => sendFloatingReaction(item.emoji, burstMultiplier, e)}
                  className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/25 border border-white/5 hover:border-white/20 transition-all active:scale-125 cursor-pointer group shadow-sm"
                  title={`Send floating ${item.label} (${burstMultiplier}x)`}
                >
                  <span className="text-2xl sm:text-3xl select-none group-hover:scale-110 transition-transform drop-shadow">
                    {item.emoji}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-300 mt-1 leading-none group-hover:text-white">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Storm / Rapid Fire Bar */}
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-1.5">
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Storm:</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <button
                  onClick={(e) => sendFloatingReaction('😂', 5, e)}
                  className="px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-300 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer shrink-0"
                  title="Send 5 Laughing emojis"
                >
                  <span>😂</span>
                  <span>Laugh Storm</span>
                </button>
                <button
                  onClick={(e) => sendFloatingReaction('😱', 5, e)}
                  className="px-2.5 py-1 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer shrink-0"
                  title="Send 5 Shocked emojis"
                >
                  <span>😱</span>
                  <span>Shock Wave</span>
                </button>
                <button
                  onClick={(e) => sendFloatingReaction('🔥', 5, e)}
                  className="px-2.5 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[10px] font-bold text-rose-300 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer shrink-0"
                  title="Send 5 Fire emojis"
                >
                  <span>🔥</span>
                  <span>Fire Blast</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM TOOLBAR WITH GO LIVE / END LIVESTREAM BUTTON */}
      <div className="relative z-30 px-3 pb-3 pt-2 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center gap-2 no-tap mb-16 sm:mb-20">
        <form onSubmit={handleSendChat} className="flex-1 relative">
          <input
            type="text"
            value={chatInputText}
            onChange={(e) => setChatInputText(e.target.value)}
            placeholder="Add comment..."
            className="w-full bg-neutral-900/90 border border-white/15 rounded-full px-4 py-2 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-[#ff0050]"
          />
        </form>

        {/* REACTION TRAY TOGGLE BUTTON */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowReactionTray((prev) => !prev);
          }}
          className={`relative w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg shrink-0 ${
            showReactionTray
              ? 'bg-[#ff0050]/20 border-[#ff0050] text-[#ff0050] scale-105'
              : 'bg-black/60 hover:bg-black/80 border-white/20 text-white'
          }`}
          title="Reaction Tray (Floating Emojis)"
        >
          <Smile className={`w-5 h-5 ${showReactionTray ? 'text-[#ff0050]' : 'text-amber-300'}`} />
          <span className="absolute -top-1 -right-1 text-[10px] leading-none">✨</span>
        </button>

        <button
          onClick={handleQuickRose}
          className="relative w-10 h-10 rounded-full bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 flex items-center justify-center text-xl transition-transform active:scale-90 shrink-0"
          title="Send 1 Rose"
        >
          🌹
          {quickRoseCombo > 0 && (
            <span className="absolute -top-1.5 -right-1 bg-[#ff0050] text-white text-[9px] font-black px-1 rounded-full">
              x{quickRoseCombo}
            </span>
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowGiftDrawer(true);
          }}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#ff0050] to-[#00f2fe] p-0.5 shadow-lg shadow-rose-600/30 transition-transform active:scale-95 shrink-0"
          title="Open FaceYou Gifts"
        >
          <div className="w-full h-full rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-amber-400">
            <GiftIcon className="w-5 h-5 animate-pulse" />
          </div>
        </button>

        {/* PRIMARY TOGGLE / END LIVESTREAM BUTTON */}
        <button
          onClick={toggleStreaming}
          className={`px-4 sm:px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl transition-all active:scale-95 shrink-0 cursor-pointer ${
            isStreaming
              ? 'bg-red-600 hover:bg-red-700 text-white border-2 border-white shadow-red-600/80 animate-pulse'
              : 'bg-[#ff0050] hover:bg-[#e00047] text-white'
          }`}
          title={isStreaming ? "End Livestream" : "Go Live"}
        >
          {isStreaming ? (
            <>
              <Square className="w-4 h-4 fill-white" />
              <span>END LIVESTREAM</span>
            </>
          ) : (
            <>
              <Radio className="w-4 h-4" />
              <span>GO LIVE</span>
            </>
          )}
        </button>
      </div>

      {/* END LIVESTREAM CONFIRMATION MODAL */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn no-tap">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mx-auto mb-3 border border-red-500/30">
              <Power className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-white">End Livestream?</h3>
            <p className="text-xs text-neutral-400 mt-1 mb-5">
              Are you sure you want to end your broadcast? Your stream will finish, video/audio tracks will stop, and your performance report will be generated.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={executeEndLivestream}
                className="w-full py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-red-600/40 active:scale-95 transition-all cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Yes, End Livestream</span>
              </button>

              <button
                onClick={() => setShowEndConfirm(false)}
                className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Cancel & Keep Streaming
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STREAM ENDED SUMMARY MODAL */}
      {showEndSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn no-tap">
          <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
              <CheckCircle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-white">Livestream Ended</h3>
            <p className="text-xs text-neutral-400 mt-0.5 mb-4">
              Broadcast concluded successfully! Here is your performance summary:
            </p>

            <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-3 rounded-2xl border border-neutral-800 mb-3">
              <div className="flex flex-col p-2 rounded-xl bg-neutral-900/60">
                <span className="text-base font-black text-white">
                  {formatTime(summaryStats.duration)}
                </span>
                <span className="text-[10px] text-neutral-400 font-bold">Duration</span>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-neutral-900/60">
                <span className="text-base font-black text-amber-400">
                  +{summaryStats.xpEarned} XP
                </span>
                <span className="text-[10px] text-neutral-400 font-bold">Streamer XP</span>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-neutral-900/60">
                <span className="text-base font-black text-[#00f2fe]">
                  {summaryStats.viewers.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-400 font-bold">Peak Viewers</span>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-neutral-900/60">
                <span className="text-base font-black text-[#ff0050]">
                  {summaryStats.likes.toLocaleString()}
                </span>
                <span className="text-[10px] text-rose-300 font-bold">Hype (Feed Visibility)</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950 border border-white/5 text-[11px] text-neutral-400 text-left mb-4">
              <p>
                ❤️ <strong className="text-white">Likes boost your visibility:</strong> High likes pushed your stream higher on the FaceYou Feed.
              </p>
              <p className="mt-1">
                💰 <strong className="text-white">Monetary Payouts:</strong> Coins earned from viewer gifts are recorded in your profile for monthly OPay cash payouts.
              </p>
            </div>

            <button
              onClick={() => {
                setShowEndSummary(false);
                onCloseStream();
              }}
              className="w-full py-3 rounded-full bg-[#ff0050] hover:bg-[#e00047] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              Done & Return to Feed
            </button>
          </div>
        </div>
      )}

      {/* FACEYOU GIFTS DRAWER */}
      {showGiftDrawer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn no-tap">
          <div className="w-full max-w-lg bg-neutral-900 border-t border-white/10 rounded-t-3xl p-4 flex flex-col shadow-2xl animate-sheet-up">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black text-white">
                  Coins: {user.coins.toLocaleString()}
                </span>
                <button
                  onClick={onOpenRecharge}
                  className="ml-2 text-[10px] font-black text-black bg-amber-400 hover:bg-amber-300 px-2.5 py-0.5 rounded-full uppercase transition-colors"
                >
                  Recharge
                </button>
              </div>

              <button
                onClick={() => setShowGiftDrawer(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning if current user is broadcasting */}
            {isStreaming && (
              <div className="p-2.5 mb-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Broadcaster Mode:</strong> Streamers cannot gift themselves. Viewer gifts and coins are sent by fans to support you!
                </span>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 mb-4">
              {FACEYOU_GIFTS.map((gift) => {
                const isSelected = selectedGift.id === gift.id;

                return (
                  <div
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    className={`p-2 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center ${
                      isSelected
                        ? 'border-[#ff0050] bg-rose-500/20 shadow-md shadow-rose-500/30'
                        : 'border-white/5 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="text-3xl my-1 transition-transform hover:scale-125">
                      {gift.icon}
                    </div>
                    <span className="text-[10px] font-bold text-white truncate max-w-full">
                      {gift.name}
                    </span>
                    <div className="flex items-center gap-1 text-amber-400 font-extrabold text-[10px] mt-0.5">
                      <Coins className="w-2.5 h-2.5" />
                      <span>{gift.cost}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => handleSendDrawerGift(selectedGift)}
              disabled={isStreaming}
              className={`w-full py-3 rounded-full font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                isStreaming
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                  : 'bg-[#ff0050] hover:bg-[#e00047] text-white shadow-rose-600/30'
              }`}
            >
              {isStreaming ? (
                <span>Broadcasters Cannot Gift Themselves</span>
              ) : (
                <>
                  <span>Send {selectedGift.name} ({selectedGift.cost} Coins)</span>
                  <span className="text-base">{selectedGift.icon}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
