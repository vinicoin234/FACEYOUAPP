import React, { useState } from 'react';
import { X, Search, Users, ShieldAlert, Check, ShieldCheck, UserX } from 'lucide-react';

export interface StreamViewer {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  isVip?: boolean;
  joinedAt: number;
}

interface ViewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewers: StreamViewer[];
  isHost: boolean;
  blockedUserIds: string[];
  onBlockUser: (userId: string) => void;
  onUnblockUser: (userId: string) => void;
}

export const ViewersModal: React.FC<ViewersModalProps> = ({
  isOpen,
  onClose,
  viewers,
  isHost,
  blockedUserIds,
  onBlockUser,
  onUnblockUser,
}) => {
  const [activeTab, setActiveTab] = useState<'viewers' | 'blocked'>('viewers');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const filteredViewers = viewers.filter(
    (v) =>
      !blockedUserIds.includes(v.id) &&
      (v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.handle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const blockedViewers = viewers.filter((v) => blockedUserIds.includes(v.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#ff0050]" />
            <h3 className="text-base font-black text-white">Live Stream Viewers</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs for Host (Active Viewers vs Blocked List) */}
        {isHost && (
          <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-2xl mb-3 border border-neutral-800">
            <button
              onClick={() => setActiveTab('viewers')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'viewers'
                  ? 'bg-[#ff0050] text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Active Viewers ({filteredViewers.length})
            </button>
            <button
              onClick={() => setActiveTab('blocked')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'blocked'
                  ? 'bg-rose-900/60 text-rose-300 border border-rose-500/40 shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Blocked ({blockedViewers.length})</span>
            </button>
          </div>
        )}

        {/* Search Bar */}
        {activeTab === 'viewers' && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active viewers..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
            />
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {activeTab === 'viewers' ? (
            filteredViewers.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No active viewers found.
              </div>
            ) : (
              filteredViewers.map((viewer) => (
                <div
                  key={viewer.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={viewer.avatar}
                      alt={viewer.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">{viewer.name}</span>
                        {viewer.isVip && (
                          <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] font-black rounded-full border border-amber-500/30">
                            VIP
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400">{viewer.handle}</span>
                    </div>
                  </div>

                  {/* Host Moderation: Block from Stream */}
                  {isHost && (
                    <button
                      onClick={() => onBlockUser(viewer.id)}
                      className="px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                      title="Block user from this live stream"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Block</span>
                    </button>
                  )}
                </div>
              ))
            )
          ) : (
            blockedViewers.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No blocked users.
              </div>
            ) : (
              blockedViewers.map((viewer) => (
                <div
                  key={viewer.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-950 border border-rose-900/40"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={viewer.avatar}
                      alt={viewer.name}
                      className="w-10 h-10 rounded-full object-cover border border-rose-500/30 grayscale"
                    />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-black text-neutral-300">{viewer.name}</span>
                      <span className="text-[11px] text-neutral-500">{viewer.handle} • Blocked</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onUnblockUser(viewer.id)}
                    className="px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                    title="Unblock user"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Unblock</span>
                  </button>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};
