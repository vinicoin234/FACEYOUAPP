import React from 'react';
import { Home, Radio, Plus, MessageSquare, User as UserIcon, Square } from 'lucide-react';
import { FaceYouTab } from '../types';

interface FaceYouBottomNavProps {
  activeTab: FaceYouTab;
  setActiveTab: (tab: FaceYouTab) => void;
  unreadMessagesCount: number;
  isStreaming: boolean;
  onStopStream?: () => void;
}

export const FaceYouBottomNav: React.FC<FaceYouBottomNavProps> = ({
  activeTab,
  setActiveTab,
  unreadMessagesCount,
  isStreaming,
  onStopStream,
}) => {
  return (
    <nav className="h-14 sm:h-16 bg-black border-t border-neutral-900 fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 max-w-lg mx-auto md:max-w-none">
      {/* 1. Feed */}
      <button
        onClick={() => setActiveTab('feed')}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
          activeTab === 'feed' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        <Home className={`w-5 h-5 sm:w-6 sm:h-6 ${activeTab === 'feed' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px] font-bold">Feed</span>
      </button>

      {/* 2. LIVE Broadcast */}
      <button
        onClick={() => setActiveTab('live')}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors relative ${
          activeTab === 'live' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        <div className="relative">
          <Radio className={`w-5 h-5 sm:w-6 sm:h-6 ${activeTab === 'live' ? 'stroke-[2.5] text-[#ff0050]' : 'stroke-[1.8]'}`} />
          {isStreaming && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          )}
        </div>
        <span className={`text-[10px] font-bold ${activeTab === 'live' ? 'text-[#ff0050]' : ''}`}>
          LIVE
        </span>
      </button>

      {/* 3. Center Create / END LIVESTREAM Action Button */}
      {isStreaming ? (
        <button
          onClick={onStopStream}
          className="flex items-center justify-center flex-1 h-full group cursor-pointer"
          title="End Livestream"
        >
          <div className="relative px-3 py-1.5 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-xl text-white font-black text-[11px] gap-1.5 shadow-xl shadow-red-600/60 border-2 border-white animate-pulse transition-transform hover:scale-105 active:scale-95">
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>END LIVE</span>
          </div>
        </button>
      ) : (
        <button
          onClick={() => setActiveTab('live')}
          className="flex items-center justify-center flex-1 h-full group"
          title="Go Live / Broadcast"
        >
          <div className="relative w-11 h-7 sm:w-12 sm:h-8 flex items-center justify-center transition-transform group-hover:scale-105 active:scale-95">
            <div className="absolute inset-y-0 -left-1 w-4 bg-[#00f2fe] rounded-l-lg" />
            <div className="absolute inset-y-0 -right-1 w-4 bg-[#ff0050] rounded-r-lg" />
            <div className="relative z-10 w-full h-full bg-white rounded-lg flex items-center justify-center text-black">
              <Plus className="w-5 h-5 stroke-[3]" />
            </div>
          </div>
        </button>
      )}

      {/* 4. Inbox Messages & Voice Notes */}
      <button
        onClick={() => setActiveTab('inbox')}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors relative ${
          activeTab === 'inbox' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        <div className="relative">
          <MessageSquare className={`w-5 h-5 sm:w-6 sm:h-6 ${activeTab === 'inbox' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-2 px-1 py-0.2 bg-[#ff0050] text-white text-[9px] font-black rounded-full min-w-4 text-center border border-black">
              {unreadMessagesCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold">Inbox</span>
      </button>

      {/* 5. Profile */}
      <button
        onClick={() => setActiveTab('profile')}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
          activeTab === 'profile' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        <UserIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px] font-bold">Profile</span>
      </button>
    </nav>
  );
};
