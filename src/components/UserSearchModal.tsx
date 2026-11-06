import React, { useState, useEffect } from 'react';
import { X, Search, Radio, UserCheck, UserPlus, Heart, Play } from 'lucide-react';
import { User } from '../types';
import { fetchLiveStreams, fetchPeopleDirectory, LiveStreamInfo } from '../lib/discovery';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onJoinStream: (hostUser: { id: string; name: string; handle: string; avatar: string }) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onJoinStream,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [liveStreams, setLiveStreams] = useState<LiveStreamInfo[]>([]);

  // Load people and live streams from Supabase so every device sees the same data
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      const [people, live] = await Promise.all([
        fetchPeopleDirectory(currentUser.id),
        fetchLiveStreams(),
      ]);
      if (cancelled) return;
      setAllUsers(people);
      setLiveStreams(live);
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen, currentUser.id]);

  if (!isOpen) return null;

  const filteredUsers = allUsers.filter(
    (u) =>
      u.id !== currentUser.id &&
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.bio && u.bio.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[82vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-[#00f2fe]" />
            <h3 className="text-base font-black text-white">Find Users & Live Streams</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @handle or bio..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00f2fe]"
            autoFocus
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No users found matching "{searchQuery}".
            </div>
          ) : (
            filteredUsers.map((userItem) => {
              const isLive = liveStreams.some((s) => s.id === userItem.id);
              return (
                <div
                  key={userItem.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 hover:border-white/15 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={userItem.avatar}
                        alt={userItem.name}
                        className="w-12 h-12 rounded-full object-cover border border-white/15"
                      />
                      {isLive && (
                        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-red-600 text-white font-black text-[9px] rounded-full uppercase tracking-wider animate-pulse border border-black">
                          LIVE
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">{userItem.name}</span>
                        {userItem.isVerified && (
                          <span className="text-[10px] text-[#00f2fe]" title="Verified Creator">✓</span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400">{userItem.handle}</span>
                      <span className="text-[10px] text-neutral-500 mt-0.5">
                        {userItem.followers?.toLocaleString() || 0} followers • {userItem.likes?.toLocaleString() || 0} likes
                      </span>
                    </div>
                  </div>

                  {isLive ? (
                    <button
                      onClick={() => {
                        onJoinStream({
                          id: userItem.id,
                          name: userItem.name,
                          handle: userItem.handle,
                          avatar: userItem.avatar,
                        });
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#ff0050] to-[#e00047] text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Watch</span>
                      <Play className="w-3 h-3 fill-white" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        // Follow action or view profile
                      }}
                      className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Follow</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
