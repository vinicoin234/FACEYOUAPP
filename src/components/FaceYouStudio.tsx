import React, { useState, useEffect, useRef } from 'react';
import { fetchFeedPosts, publishFeedPost, FEED_ACCEPT } from '../lib/feed';
import { fetchLikedPostIds, setPostLike, listComments, addComment } from '../lib/social';
import { fetchLiveStreams, subscribeToStreamChanges, LiveStreamInfo } from '../lib/discovery';
import {
  Heart,
  MessageCircle,
  Share2,
  Music2,
  Plus,
  Radio,
  X,
  Send,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Flame,
  Users,
  Video,
  Play,
  Search,
  Check
} from 'lucide-react';
import { PostVideo, VideoComment, User } from '../types';
import { playTapHeartSound } from '../utils/audio';


interface FaceYouStudioProps {
  user?: User | null;
  isStreaming?: boolean;
  likeCount?: number;
  viewerCount?: number;
  streamDuration?: number;
  onGoLive: () => void;
  onOpenShare: (title: string) => void;
  onOpenSearch: () => void;
  onWatchLive?: () => void;
  onJoinStream?: (host: { id: string; name: string; handle: string; avatar: string }) => void;
}

const BG_GRADIENT_PRESETS = [
  { label: 'Neon Cyber', value: 'from-purple-950 via-rose-950 to-black' },
  { label: 'Electric Cyan', value: 'from-blue-950 via-cyan-950 to-black' },
  { label: 'Sunset Glow', value: 'from-amber-950 via-rose-950 to-black' },
  { label: 'Emerald Wave', value: 'from-emerald-950 via-teal-950 to-black' },
  { label: 'Deep Indigo', value: 'from-indigo-950 via-purple-950 to-black' },
];

export const FaceYouStudio: React.FC<FaceYouStudioProps> = ({
  user,
  isStreaming = false,
  likeCount = 0,
  viewerCount = 0,
  streamDuration = 0,
  onGoLive,
  onOpenShare,
  onOpenSearch,
  onWatchLive,
  onJoinStream,
}) => {
  // Real Feed Posts - NO mock users! Starts clean or loads authentic user posts
  const [posts, setPosts] = useState<PostVideo[]>([]);
  const [feedMuted, setFeedMuted] = useState<boolean>(true);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postError, setPostError] = useState<string | null>(null);
  const touchStartY = useRef<number | null>(null);
  const wheelLockAt = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetchFeedPosts().then((list) => {
      if (!cancelled) setPosts(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [feedFilter, setFeedFilter] = useState<'all' | 'live'>('all');
  const [showComments, setShowComments] = useState<boolean>(false);
  const [burstHearts, setBurstHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  // Active streams registry across users/tabs
  const [activeStreams, setActiveStreams] = useState<LiveStreamInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const streams = await fetchLiveStreams();
      if (!cancelled) setActiveStreams(streams);
    };
    load();
    const unsubscribe = subscribeToStreamChanges(load); // instant update when a host goes live / ends
    const timer = setInterval(load, 15000); // fallback refresh if realtime drops
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);


  // Create Post Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [postCaption, setPostCaption] = useState<string>('');
  const [postMusic, setPostMusic] = useState<string>('FaceYou Original Sound - Afro Beat');
  const [postTags, setPostTags] = useState<string>('#FaceYou #Live');
  const [selectedGradient, setSelectedGradient] = useState<string>(BG_GRADIENT_PRESETS[0].value);

  // Comments mapping
  const [comments, setComments] = useState<Record<string, VideoComment[]>>({});
  const [newCommentText, setNewCommentText] = useState<string>('');

  const currentPost = posts[currentIndex];

  // Double tap to like on feed post
  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentPost) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    playTapHeartSound();
    const newBurst = { id: Date.now() + Math.random(), x, y };
    setBurstHearts((prev) => [...prev, newBurst]);

    setTimeout(() => {
      setBurstHearts((prev) => prev.filter((b) => b.id !== newBurst.id));
    }, 850);

    if (!currentPost.isLiked) toggleLike();
  };

  const toggleLike = () => {
    if (!currentPost || !user) return;
    playTapHeartSound();
    const postId = currentPost.id;
    const like = !currentPost.isLiked;
    const applyLocal = (liked: boolean) =>
      setPosts((prev) =>
        prev.map((v) =>
          v.id === postId ? { ...v, isLiked: liked, likes: Math.max(0, v.likes + (liked ? 1 : -1)) } : v
        )
      );
    applyLocal(like);
    setPostLike(postId, user.id, like).catch(() => applyLocal(!like)); // roll back if the server refused
  };

  const handleNextPost = () => {
    if (posts.length === 0) return;
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrevPost = () => {
    if (posts.length === 0) return;
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = newCommentText.trim();
    if (!body || !currentPost || !user) return;
    setNewCommentText('');
    try {
      await addComment(currentPost.id, user.id, body);
      const list = await listComments(currentPost.id);
      setComments((prev) => ({ ...prev, [currentPost.id]: list }));
      setPosts((prev) => prev.map((v) => (v.id === currentPost.id ? { ...v, commentsCount: v.commentsCount + 1 } : v)));
    } catch (err) {
      setNewCommentText(body);
      window.alert(err instanceof Error ? err.message : 'Comment not posted');
    }
  };

  const handleMediaPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPostError(null);
    setMediaFile(file);
    setMediaPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile || !postCaption.trim() || !user) return;
    setIsPosting(true);
    setPostError(null);
    try {
      const newPost = await publishFeedPost(user, mediaFile, postCaption);
      setPosts((prev) => [newPost, ...prev]);
      setCurrentIndex(0);
      setPostCaption('');
      setMediaFile(null);
      setMediaPreview(null);
      setShowCreateModal(false);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Could not publish.');
    } finally {
      setIsPosting(false);
    }
  };

  // Who I have liked (so hearts show correctly), and comments for the post on screen
  useEffect(() => {
    if (!user || posts.length === 0) return;
    fetchLikedPostIds(user.id).then((liked) =>
      setPosts((prev) => prev.map((v) => ({ ...v, isLiked: liked.has(v.id) })))
    );
  }, [user?.id, posts.length]);

  useEffect(() => {
    if (!currentPost?.id) return;
    const postId = currentPost.id;
    listComments(postId).then((list) => setComments((prev) => ({ ...prev, [postId]: list })));
  }, [currentPost?.id]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (Math.abs(dy) < 60) return;
    if (dy < 0) handleNextPost();
    else handlePrevPost();
  };
  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (Math.abs(e.deltaY) < 20 || now - wheelLockAt.current < 600) return;
    wheelLockAt.current = now;
    if (e.deltaY > 0) handleNextPost();
    else handlePrevPost();
  };

  const currentComments = currentPost ? comments[currentPost.id] || [] : [];

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col justify-center items-center select-none">
      {/* Top FaceYou Feed Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3 pb-2 bg-gradient-to-b from-black/90 to-transparent">
        {/* LIVE Broadcast Quick Trigger */}
        <button
          onClick={onGoLive}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 backdrop-blur-md border border-rose-500/40 text-[#ff0050] font-black text-xs transition-transform hover:scale-105 shadow-lg active:scale-95 cursor-pointer"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>{isStreaming ? 'IN LIVE' : 'GO LIVE'}</span>
        </button>

        {/* Feed Header and Modes */}
        <div className="flex items-center gap-4 text-sm font-bold">
          <button
            onClick={() => setFeedFilter('all')}
            className={`transition-all cursor-pointer ${
              feedFilter === 'all'
                ? 'text-white border-b-2 border-[#ff0050] pb-1 font-extrabold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setFeedFilter('live')}
            className={`transition-all flex items-center gap-1 cursor-pointer ${
              feedFilter === 'live'
                ? 'text-[#00f2fe] border-b-2 border-[#00f2fe] pb-1 font-extrabold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#ff0050]" />
            <span>Trending Live</span>
          </button>
        </div>

        {/* Right Nav Actions: Search & Post */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="Search Users & Streams"
          >
            <Search className="w-3.5 h-3.5 text-[#00f2fe]" />
            <span className="hidden sm:inline">Search</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="Create New Post"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Post</span>
          </button>
        </div>
      </div>

      {/* TOP VISIBILITY: FEATURED LIVE STREAM SPOTLIGHT & ACTIVE STREAMS */}
      {(isStreaming || feedFilter === 'live' || activeStreams.length > 0) && (
        <div className="absolute top-14 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-25 flex flex-col gap-2 max-h-[45vh] overflow-y-auto scrollbar-none animate-fadeIn">
          {/* Current user stream if streaming */}
          {isStreaming && (
            <div
              onClick={onWatchLive || onGoLive}
              className="p-3.5 rounded-2xl bg-neutral-950/95 backdrop-blur-xl border-2 border-rose-500/60 shadow-2xl shadow-rose-600/30 flex items-center justify-between cursor-pointer group hover:scale-[1.02] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#ff0050] to-[#00f2fe] shadow-lg">
                    <img
                      src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                      alt="Streamer"
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-red-600 text-white font-black text-[9px] rounded-full uppercase tracking-wider animate-pulse border border-black">
                    LIVE
                  </span>
                </div>

                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white group-hover:text-[#00f2fe] transition-colors truncate max-w-[130px]">
                      {user?.name || 'Broadcaster'} (You)
                    </span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded-full border border-rose-500/30">
                      Hosting
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-black text-[#ff0050] flex items-center gap-0.5">
                      <Heart className="w-3 h-3 fill-[#ff0050]" />
                      {likeCount.toLocaleString()} Hype
                    </span>
                    <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
                      <Users className="w-3 h-3 text-[#00f2fe]" />
                      {viewerCount > 0 ? viewerCount : 1} watching
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onWatchLive) onWatchLive();
                  else onGoLive();
                }}
                className="px-3.5 py-1.5 rounded-full bg-[#ff0050] group-hover:bg-[#e00047] text-white font-black text-xs uppercase tracking-wider shadow-md shadow-rose-600/40 transition-transform active:scale-95 flex items-center gap-1"
              >
                <span>Stream</span>
                <Play className="w-3 h-3 fill-white" />
              </button>
            </div>
          )}

          {/* Other active streams discovered across users/tabs */}
          {activeStreams
            .filter((s) => !user || s.id !== user.id)
            .map((stream) => (
              <div
                key={stream.id}
                onClick={() => {
                  if (onJoinStream) {
                    onJoinStream(stream);
                  }
                }}
                className="p-3.5 rounded-2xl bg-neutral-950/95 backdrop-blur-xl border-2 border-cyan-500/60 shadow-2xl shadow-cyan-600/20 flex items-center justify-between cursor-pointer group hover:scale-[1.02] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#00f2fe] to-[#ff0050] shadow-lg">
                      <img
                        src={stream.avatar}
                        alt={stream.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-red-600 text-white font-black text-[9px] rounded-full uppercase tracking-wider animate-pulse border border-black">
                      LIVE
                    </span>
                  </div>

                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black text-white group-hover:text-[#00f2fe] transition-colors truncate max-w-[140px]">
                      {stream.name}
                    </span>
                    <span className="text-[11px] text-neutral-400">{stream.handle}</span>
                    <span className="text-[9px] text-[#00f2fe] font-bold mt-0.5">
                      Broadcasting Live Now 🔴
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onJoinStream) onJoinStream(stream);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-[#00f2fe] hover:bg-[#00d4e0] text-black font-black text-xs uppercase tracking-wider shadow-md shadow-cyan-500/40 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>Watch</span>
                  <Play className="w-3 h-3 fill-black" />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Feed Canvas Container or Empty Feed State */}
      {posts.length === 0 ? (
        <div className="w-full max-w-md mx-auto px-6 text-center flex flex-col items-center justify-center z-10">
          <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-4 shadow-xl">
            <Radio className="w-10 h-10 text-[#ff0050] animate-pulse" />
          </div>

          <h2 className="text-xl font-black text-white mb-2">Welcome to FaceYou Feed</h2>
          <p className="text-xs text-neutral-400 max-w-xs leading-relaxed mb-6">
            Real creators, live broadcasts, and clips. Active livestreams with the highest likes earn top visibility spotlight on the feed!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={onGoLive}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#ff0050] to-[#e00047] text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>Go LIVE Now</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Post</span>
            </button>
          </div>

          <div className="mt-8 p-3 rounded-2xl bg-neutral-900/60 border border-white/5 text-[11px] text-neutral-400 max-w-xs text-left flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#00f2fe] shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Streamer Pro Tip:</strong> Likes boost your stream’s rank in the Feed. Coins earned from viewer gifts convert directly into real OPay monthly cash payouts.
            </span>
          </div>
        </div>
      ) : (
        <div
          onDoubleClick={handleDoubleTap}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
          className={`relative w-full h-full max-w-md sm:max-w-lg md:max-w-xl mx-auto flex flex-col justify-between overflow-hidden bg-gradient-to-br ${currentPost.bgGradient} cursor-pointer`}
        >
          {currentPost.mediaUrl && currentPost.mediaType === 'video' && (
            <video
              key={currentPost.id}
              src={currentPost.mediaUrl}
              autoPlay
              loop
              playsInline
              muted={feedMuted}
              onClick={() => setFeedMuted((m) => !m)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {currentPost.mediaUrl && currentPost.mediaType === 'image' && (
            <img
              key={currentPost.id}
              src={currentPost.mediaUrl}
              alt={currentPost.caption}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {currentPost.mediaUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
          )}
          {currentPost.mediaUrl && currentPost.mediaType === 'video' && feedMuted && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/60 text-[10px] font-bold text-white pointer-events-none">
              Tap video for sound
            </div>
          )}

          {!currentPost.mediaUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
            <div className="w-[320px] h-[320px] rounded-full border border-rose-500/40 animate-pulse" />
            <div className="w-[460px] h-[460px] rounded-full border border-cyan-400/20 animate-ping opacity-25" />
          </div>
          )}

          {/* Double-Tap Bursting Neon Hearts */}
          {burstHearts.map((b) => (
            <div
              key={b.id}
              style={{ left: `${b.x}px`, top: `${b.y}px` }}
              className="absolute z-40 pointer-events-none animate-burst-heart text-6xl text-[#ff0050] drop-shadow-[0_4px_25px_rgba(255,0,80,0.8)]"
            >
              ❤️
            </div>
          ))}

          {/* Right-Side Action Bar */}
          <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-4">
            {/* Creator Avatar */}
            <div className="relative mb-2">
              <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#ff0050] to-[#00f2fe] shadow-xl">
                <img
                  src={currentPost.creatorAvatar}
                  alt={currentPost.creatorName}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>

            {/* Like Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike();
              }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 active:scale-95 ${
                  currentPost.isLiked ? 'text-[#ff0050]' : 'text-white'
                }`}
              >
                <Heart
                  className={`w-7 h-7 ${
                    currentPost.isLiked ? 'fill-[#ff0050] text-[#ff0050]' : 'fill-white/10 stroke-[2]'
                  }`}
                />
              </div>
              <span className="text-[11px] font-bold text-white tracking-tight mt-0.5 drop-shadow">
                {currentPost.likes.toLocaleString()}
              </span>
            </button>

            {/* Comments Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(true);
              }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-110 active:scale-95">
                <MessageCircle className="w-7 h-7 fill-white/10 stroke-[2]" />
              </div>
              <span className="text-[11px] font-bold text-white tracking-tight mt-0.5 drop-shadow">
                {currentPost.commentsCount.toLocaleString()}
              </span>
            </button>

            {/* Share Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenShare(currentPost.caption);
              }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-110 active:scale-95">
                <Share2 className="w-7 h-7 stroke-[2]" />
              </div>
              <span className="text-[11px] font-bold text-white tracking-tight mt-0.5 drop-shadow">
                Share
              </span>
            </button>
          </div>

          {/* Up / Down Navigation Controls */}
          <div className="absolute right-4 top-24 z-20 flex flex-col gap-2">
            <button
              onClick={handlePrevPost}
              disabled={currentIndex === 0}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center disabled:opacity-30 transition-all cursor-pointer"
              title="Previous video"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextPost}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all cursor-pointer"
              title="Next video"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Metadata & Sound Track */}
          <div className="absolute bottom-16 sm:bottom-20 left-4 right-20 z-20 flex flex-col text-left">
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5 drop-shadow-md mb-1">
              {currentPost.creatorHandle}
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />
              <span className="text-xs text-neutral-300 font-semibold">
                {currentPost.creatorName}
              </span>
            </h3>

            <p className="text-xs sm:text-sm text-neutral-100 font-medium leading-relaxed drop-shadow line-clamp-3 mb-2.5">
              {currentPost.caption}
            </p>

            <div className="flex items-center gap-2 text-xs text-white/90 overflow-hidden w-full max-w-[280px]">
              <Music2 className="w-3.5 h-3.5 text-white shrink-0 animate-pulse" />
              <div className="overflow-hidden whitespace-nowrap">
                <span className="animate-marquee font-semibold tracking-wide">
                  {currentPost.musicTitle}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#ff0050]" />
                <span>Create Feed Post</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Photo or video</label>
                <input
                  type="file"
                  accept={FEED_ACCEPT}
                  onChange={handleMediaPick}
                  className="w-full text-xs text-neutral-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:bg-[#ff0050] file:text-white file:font-bold"
                />
                {mediaPreview && mediaFile?.type.startsWith('video/') && (
                  <video src={mediaPreview} muted controls className="mt-2 w-full max-h-48 rounded-xl bg-black" />
                )}
                {mediaPreview && mediaFile?.type.startsWith('image/') && (
                  <img src={mediaPreview} alt="" className="mt-2 w-full max-h-48 object-cover rounded-xl" />
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Caption / Description
                </label>
                <textarea
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  placeholder="What are you sharing today? #FaceYou #Creator"
                  rows={3}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Audio / Music Sound
                </label>
                <input
                  type="text"
                  value={postMusic}
                  onChange={(e) => setPostMusic(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff0050]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Visual Canvas Gradient
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {BG_GRADIENT_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => setSelectedGradient(preset.value)}
                      className={`h-10 rounded-xl bg-gradient-to-br ${preset.value} border-2 transition-all flex items-center justify-center ${
                        selectedGradient === preset.value
                          ? 'border-[#ff0050] scale-105 shadow-md'
                          : 'border-transparent hover:border-white/20'
                      }`}
                      title={preset.label}
                    >
                      {selectedGradient === preset.value && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {postError && <p className="text-xs text-red-400">{postError}</p>}
              <button
                type="submit"
                disabled={!postCaption.trim() || !mediaFile || isPosting}
                className="w-full py-3 rounded-full bg-[#ff0050] hover:bg-[#e00047] disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                {isPosting ? 'Uploading…' : 'Publish to Feed'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FaceYou Comments Drawer */}
      {showComments && currentPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-neutral-900 border-t border-white/10 rounded-t-3xl max-h-[75vh] flex flex-col shadow-2xl animate-sheet-up">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="w-6" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                {currentPost.commentsCount.toLocaleString()} comments
              </h3>
              <button
                onClick={() => setShowComments(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentComments.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No comments yet. Be the first to comment!
                </div>
              ) : (
                currentComments.map((com) => (
                  <div key={com.id} className="flex items-start gap-3">
                    <img
                      src={com.avatar}
                      alt={com.author}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-neutral-400 block">
                        {com.author}
                      </span>
                      <p className="text-xs text-neutral-100 font-medium mt-0.5">
                        {com.text}
                      </p>
                      <span className="text-[10px] text-neutral-500 mt-1 block">
                        {com.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleAddComment}
              className="p-3 border-t border-white/10 bg-neutral-950 flex items-center gap-2"
            >
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add comment..."
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-full px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="w-9 h-9 rounded-full bg-[#ff0050] hover:bg-[#e00047] disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
