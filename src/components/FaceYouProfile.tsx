import React, { useState } from 'react';
import {
  Edit3,
  Share2,
  Coins,
  Radio,
  Heart,
  Video,
  Settings,
  Lock,
  CheckCircle2,
  RefreshCw,
  Play,
  Grid,
  LogOut,
  Sparkles,
  Trash2,
  VideoOff,
  UserX,
  TrendingUp,
  ArrowUpRight,
  Wallet,
  Award,
  Zap,
  Info,
  Clock,
  Gift
} from 'lucide-react';
import { User, CoinEarningRecord, OPayWithdrawalRequest } from '../types';
import { OPayWithdrawModal, DIAMOND_TO_NGN_RATE } from './OPayWithdrawModal';
import { StreamDashboardModal } from './StreamDashboardModal';
import { calculateStreamerXp, getStreamerLevelInfo } from '../utils/streamerLevel';

interface FaceYouProfileProps {
  user: User;
  onEditProfile: () => void;
  onShareProfile: () => void;
  onTopUpCoins: () => void;
  onGoLive: () => void;
  onResetAccount: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  coinEarnings: CoinEarningRecord[];
  withdrawalRequests: OPayWithdrawalRequest[];
  onAddWithdrawalRequest: (req: OPayWithdrawalRequest) => void;
  onUpdateUser: (updated: Partial<User>) => void;
}

export const FaceYouProfile: React.FC<FaceYouProfileProps> = ({
  user,
  onEditProfile,
  onShareProfile,
  onTopUpCoins,
  onGoLive,
  onResetAccount,
  onLogout,
  onDeleteAccount,
  coinEarnings,
  withdrawalRequests,
  onAddWithdrawalRequest,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'videos' | 'private' | 'liked'>('videos');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showStreamDashboard, setShowStreamDashboard] = useState<boolean>(false);
  const [showLevelGuide, setShowLevelGuide] = useState<boolean>(false);

  // Totally empty portfolio for brand new users (NO pre-seeded mock videos!)
  const userVideos: Array<{ id: number; views: string; bg: string; title: string }> = [];

  const totalCoinsReceived = coinEarnings.reduce((acc, curr) => acc + curr.coins, 0);

  // Streamer Level & XP Calculation
  const totalCoinsFromGifts = (user.coinsEarnedFromGifts || 0) > 0 
    ? user.coinsEarnedFromGifts! 
    : totalCoinsReceived;
  const totalStreamSeconds = user.totalStreamDurationSeconds || 0;
  const totalStreamMinutes = Math.floor(totalStreamSeconds / 60);
  const streamerXp = calculateStreamerXp(totalCoinsFromGifts, totalStreamSeconds);
  const levelInfo = getStreamerLevelInfo(streamerXp);

  return (
    <div className="w-full h-full overflow-y-auto bg-black text-white select-none pb-20">
      {/* Top Header Bar */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-black/90 backdrop-blur-md z-30">
        <div className="w-8" />
        <h2 className="text-sm font-black text-white flex items-center gap-1.5 tracking-tight">
          {user.name}
          {user.isVerified && <CheckCircle2 className="w-4 h-4 text-[#00f2fe] fill-[#00f2fe]/20" />}
        </h2>
        
        {/* Settings Icon at Top Right */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="Settings & OPay Withdrawal"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Header Block */}
      <div className="flex flex-col items-center pt-5 px-4 text-center">
        {/* Avatar with FaceYou Gradient Border */}
        <div className="relative mb-3 group cursor-pointer" onClick={onEditProfile}>
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-[#ff0050] via-purple-600 to-[#00f2fe] shadow-2xl hover:scale-105 transition-transform">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full rounded-full object-cover border-2 border-black"
            />
          </div>
          <button
            onClick={onEditProfile}
            className="absolute bottom-0 right-0 p-2 rounded-full bg-[#ff0050] text-white shadow-md border-2 border-black hover:scale-110 transition-transform"
            title="Upload/Edit Photo"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Handle */}
        <span className="text-sm font-bold text-neutral-300 mb-4">
          {user.handle}
        </span>

        {/* Following | Followers | Likes (Clean 0 for new users) */}
        <div className="flex items-center justify-center gap-8 mb-5">
          <div className="flex flex-col items-center">
            <span className="text-base font-black text-white">
              {user.following.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400 font-semibold">Following</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-base font-black text-white">
              {user.followers.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400 font-semibold">Followers</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-base font-black text-white">
              {user.likes > 999 ? `${(user.likes / 1000).toFixed(1)}k` : user.likes}
            </span>
            <span className="text-xs text-neutral-400 font-semibold">Likes</span>
          </div>
        </div>

        {/* Action Buttons: Edit Profile, Share Profile, Go Live */}
        <div className="flex items-center gap-2 mb-4 w-full max-w-sm">
          <button
            onClick={onEditProfile}
            className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-bold text-xs text-white transition-all active:scale-95 border border-white/10"
          >
            Edit profile
          </button>
          <button
            onClick={onShareProfile}
            className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-bold text-xs text-white transition-all active:scale-95 border border-white/10"
          >
            Share profile
          </button>
          <button
            onClick={onGoLive}
            className="px-4 py-2.5 rounded-xl bg-[#ff0050] hover:bg-[#e00047] font-black text-xs text-white transition-all active:scale-95 shadow-md shadow-rose-600/30 flex items-center gap-1.5"
            title="Start Live Stream"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>LIVE</span>
          </button>
        </div>

        {/* Bio */}
        <p className="text-xs text-neutral-300 max-w-xs leading-relaxed mb-4">
          {user.bio || 'No bio yet.'}
        </p>

        {/* FaceYou Coin Wallet Box with OPay Withdraw Button */}
        <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 mb-2.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-amber-950 font-black flex items-center justify-center shadow-md">
              <Coins className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-black text-white">
                {user.coins.toLocaleString()} Coins
              </span>
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                💎 {user.diamonds} Diamonds
                {user.diamonds > 0 && (
                  <span className="text-emerald-400 font-bold">
                    (≈₦{(user.diamonds * DIAMOND_TO_NGN_RATE).toLocaleString()})
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* OPay Withdraw Button */}
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-3 py-1.5 rounded-full bg-[#00b956] hover:bg-[#009e49] text-white font-black text-[11px] uppercase tracking-wide transition-all active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
              title="Withdraw to OPay"
            >
              <span>Withdraw</span>
            </button>
            <button
              onClick={onTopUpCoins}
              className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-black text-[11px] uppercase tracking-wide transition-all active:scale-95 shadow-md"
            >
              Recharge
            </button>
          </div>
        </div>

        {/* Stream Dashboard Card: Records Every Coin Received from Streaming & Inbox */}
        <div
          onClick={() => setShowStreamDashboard(true)}
          className="w-full max-w-sm bg-gradient-to-r from-neutral-900 via-rose-950/20 to-neutral-900 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl p-3 mb-2.5 flex items-center justify-between cursor-pointer transition-all shadow-md group active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff0050] to-[#00f2fe] text-white flex items-center justify-center shadow-md shadow-rose-600/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white group-hover:text-[#00f2fe] transition-colors">
                  Stream & Earnings Dashboard
                </span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-rose-500/20 text-[#ff0050] rounded-full">
                  LIVE
                </span>
              </div>
              <span className="text-[10px] text-neutral-400">
                {totalCoinsReceived > 0
                  ? `${totalCoinsReceived.toLocaleString()} coins received from streams & inbox`
                  : 'Track every coin received from streams & inbox'}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-[#ff0050] group-hover:translate-x-0.5 transition-transform">
            View →
          </span>
        </div>

        {/* STREAMER LEVEL SYSTEM & XP PROGRESS BAR CARD */}
        <div className={`w-full max-w-sm rounded-2xl p-4 mb-6 border ${levelInfo.borderColor} ${levelInfo.badgeBg} shadow-xl relative overflow-hidden text-left transition-all`}>
          {/* Ambient Corner Glow */}
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-[#ff0050]/20 to-[#00f2fe]/20 blur-2xl pointer-events-none" />

          {/* Level Header with Badge and Info trigger */}
          <div className="flex items-center justify-between mb-2.5 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-xl shadow-md">
                {levelInfo.icon}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">
                    Level {levelInfo.level}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/50 text-amber-300 border border-amber-400/30">
                    {levelInfo.title}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400">
                  Streamer Rank • Higher Feed Visibility
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowLevelGuide(true)}
              className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="How Streamer Level XP Works"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* XP Progress Bar */}
          <div className="space-y-1.5 mb-3 relative z-10">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-white flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>{streamerXp.toLocaleString()} XP Total</span>
              </span>
              <span className="text-neutral-300 font-semibold">
                {levelInfo.xpNeededForNextLevel > 0
                  ? `${levelInfo.xpNeededForNextLevel.toLocaleString()} XP to Lv. ${levelInfo.level + 1}`
                  : 'Max Rank Achieved!'}
              </span>
            </div>

            {/* Visual Animated Progress Bar */}
            <div className="w-full h-3 rounded-full bg-neutral-950 p-0.5 border border-white/10 overflow-hidden relative shadow-inner">
              <div
                style={{ width: `${Math.max(5, levelInfo.progressPercent)}%` }}
                className="h-full rounded-full bg-gradient-to-r from-[#ff0050] via-amber-400 to-[#00f2fe] transition-all duration-700 shadow-md relative"
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Lv. {levelInfo.level}</span>
              <span className="font-extrabold text-amber-300">{levelInfo.progressPercent}% progress</span>
              <span>Lv. {levelInfo.level + 1}</span>
            </div>
          </div>

          {/* XP Breakdown Sub-metrics: Gifts (10 XP) and Duration (5 XP/min) */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[10px] relative z-10">
            <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex flex-col">
              <span className="text-neutral-400 font-semibold flex items-center gap-1">
                <Gift className="w-3 h-3 text-rose-400" />
                <span>Gifts (10 XP/Coin)</span>
              </span>
              <span className="text-xs font-black text-white mt-0.5">
                +{totalCoinsFromGifts * 10} XP
              </span>
              <span className="text-[9px] text-emerald-400 mt-0.5 font-medium">
                💰 Users get paid for coins
              </span>
            </div>

            <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex flex-col">
              <span className="text-neutral-400 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#00f2fe]" />
                <span>Streaming (5 XP/min)</span>
              </span>
              <span className="text-xs font-black text-white mt-0.5">
                +{totalStreamMinutes * 5} XP ({totalStreamMinutes}m)
              </span>
              <span className="text-[9px] text-amber-300 mt-0.5 font-medium">
                ❤️ Likes boost Feed rank
              </span>
            </div>
          </div>

          {/* Active Level Perk */}
          {levelInfo.perks.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-neutral-300">
              <span className="text-neutral-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#00f2fe]" />
                <span>Level Perk:</span>
              </span>
              <span className="font-bold text-[#00f2fe] truncate max-w-[210px]">
                {levelInfo.perks[0]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3 Grid Tabs (FaceYou Video Portfolio) */}
      <div className="flex items-center justify-around border-t border-b border-white/10 max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex-1 py-3 flex items-center justify-center border-b-2 transition-all ${
            activeTab === 'videos' ? 'border-white text-white' : 'border-transparent text-neutral-500'
          }`}
          title="Videos"
        >
          <Grid className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('private')}
          className={`flex-1 py-3 flex items-center justify-center border-b-2 transition-all ${
            activeTab === 'private' ? 'border-white text-white' : 'border-transparent text-neutral-500'
          }`}
          title="Private"
        >
          <Lock className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('liked')}
          className={`flex-1 py-3 flex items-center justify-center border-b-2 transition-all ${
            activeTab === 'liked' ? 'border-white text-white' : 'border-transparent text-neutral-500'
          }`}
          title="Liked"
        >
          <Heart className="w-5 h-5" />
        </button>
      </div>

      {/* Grid Content - Totally Empty for New Users */}
      <div className="max-w-md mx-auto p-4">
        {activeTab === 'videos' && (
          <div className="py-10 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-3 shadow-inner">
              <VideoOff className="w-7 h-7 text-neutral-600" />
            </div>
            <h3 className="text-sm font-black text-white">No videos yet</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs">
              Your uploaded videos and recorded live streams will appear here once published.
            </p>
            <button
              onClick={onGoLive}
              className="mt-4 px-4 py-2 rounded-full bg-[#ff0050] hover:bg-[#e00047] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-transform active:scale-95"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Go LIVE Now</span>
            </button>
          </div>
        )}

        {activeTab === 'private' && (
          <div className="py-10 text-center flex flex-col items-center justify-center text-neutral-500">
            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-3">
              <Lock className="w-7 h-7 text-neutral-600" />
            </div>
            <p className="text-xs font-bold text-neutral-300">Your private videos</p>
            <p className="text-[11px] text-neutral-500 mt-1 max-w-xs">
              Videos you set to private will only be visible to you.
            </p>
          </div>
        )}

        {activeTab === 'liked' && (
          <div className="py-10 text-center flex flex-col items-center justify-center text-neutral-500">
            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-3">
              <Heart className="w-7 h-7 text-neutral-600" />
            </div>
            <p className="text-xs font-bold text-neutral-300">No liked videos yet</p>
            <p className="text-[11px] text-neutral-500 mt-1 max-w-xs">
              Double tap videos or streams you love to save them here.
            </p>
          </div>
        )}
      </div>

      {/* Delete User Direct Action at Bottom of Profile */}
      <div className="max-w-xs mx-auto px-4 mt-6 text-center">
        <button
          onClick={onDeleteAccount}
          className="text-xs font-bold text-rose-500 hover:text-rose-400 flex items-center justify-center gap-1.5 mx-auto py-2 px-3 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Delete current user and start brand new"
        >
          <UserX className="w-3.5 h-3.5" />
          <span>Delete Account & Start Brand New</span>
        </button>
      </div>

      {/* Settings Modal Drawer (Accessible via top-right gear icon) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl">
            <h3 className="text-sm font-black text-white mb-3">FaceYou Settings</h3>
            <div className="space-y-2">
              {/* OPay WITHDRAWAL BUTTON IN SETTINGS */}
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowWithdrawModal(true);
                }}
                className="w-full py-3 px-3.5 rounded-xl bg-[#00b956]/20 hover:bg-[#00b956]/30 border border-[#00b956]/40 text-left text-xs font-black text-emerald-300 flex items-center justify-between transition-colors cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-[#00b956] text-white font-black text-xs flex items-center justify-center shadow">
                    O
                  </span>
                  <div className="flex flex-col">
                    <span className="leading-tight">Withdraw Earnings (OPay)</span>
                    <span className="text-[10px] text-neutral-400 font-normal">
                      End of month payout
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </button>

              {/* STREAM & EARNINGS DASHBOARD IN SETTINGS */}
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowStreamDashboard(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-left text-xs font-bold text-white flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#ff0050]" />
                  <span>Stream & Coins Dashboard</span>
                </div>
                <span className="text-[10px] text-neutral-400 font-bold">Records Log</span>
              </button>

              <button
                onClick={onEditProfile}
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-left text-xs font-bold text-white flex items-center justify-between"
              >
                <span>Edit Profile</span>
                <Edit3 className="w-4 h-4 text-neutral-400" />
              </button>

              <button
                onClick={onTopUpCoins}
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-left text-xs font-bold text-amber-400 flex items-center justify-between"
              >
                <span>Buy FaceYou Coins (Paystack)</span>
                <Coins className="w-4 h-4" />
              </button>

              <button
                onClick={onLogout}
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-left text-xs font-bold text-neutral-200 flex items-center justify-between"
              >
                <span>Log Out of FaceYou</span>
                <LogOut className="w-4 h-4 text-neutral-400" />
              </button>

              {/* DELETE CURRENT USER & MAKE BRAND NEW */}
              <button
                onClick={() => {
                  setShowSettings(false);
                  onDeleteAccount();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-left text-xs font-bold text-rose-400 flex items-center justify-between transition-colors"
              >
                <span>Delete Account & Start Brand New</span>
                <Trash2 className="w-4 h-4 text-rose-400" />
              </button>

              <button
                onClick={onResetAccount}
                className="w-full py-2 px-3 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 text-left text-xs font-semibold text-neutral-400 flex items-center justify-between"
              >
                <span>Clear Local Cache</span>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* OPay Creator Withdrawal Modal */}
      <OPayWithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        user={user}
        onUpdateUser={onUpdateUser}
        withdrawalRequests={withdrawalRequests}
        onAddWithdrawalRequest={onAddWithdrawalRequest}
      />

      {/* Stream & Creator Dashboard Modal */}
      <StreamDashboardModal
        isOpen={showStreamDashboard}
        onClose={() => setShowStreamDashboard(false)}
        user={user}
        coinEarnings={coinEarnings}
        onOpenWithdraw={() => setShowWithdrawModal(true)}
      />

      {/* Streamer Level System Guide Modal */}
      {showLevelGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-amber-950 font-black flex items-center justify-center text-sm shadow">
                  ⚡
                </div>
                <div>
                  <h3 className="text-sm font-black text-white leading-tight">
                    Streamer Level & XP System
                  </h3>
                  <span className="text-[10px] text-neutral-400">
                    How creator experience points are calculated
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowLevelGuide(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rules Overview */}
            <div className="space-y-2.5 mb-4 text-xs">
              <div className="p-3 rounded-2xl bg-neutral-950 border border-rose-500/20">
                <span className="font-black text-rose-400 flex items-center gap-1.5 mb-1">
                  <Gift className="w-3.5 h-3.5" />
                  <span>1. Viewer Gifts (10 XP per Coin)</span>
                </span>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Every coin sent to you by fans during livestreams or in direct inbox tips earns you <strong className="text-white">10 Streamer XP</strong>.
                </p>
                <p className="text-[10px] text-emerald-400 mt-1 font-bold">
                  💰 Streamers get paid real money for coins via OPay monthly payouts.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-950 border border-cyan-500/20">
                <span className="font-black text-cyan-300 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>2. Stream Duration (5 XP per Minute)</span>
                </span>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Broadcasting live earns you <strong className="text-white">5 XP every minute</strong> you host a live stream.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-950 border border-amber-500/20">
                <span className="font-black text-amber-300 flex items-center gap-1.5 mb-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span>3. Likes vs Coins Distinction</span>
                </span>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  ❤️ <strong className="text-white">Stream Likes:</strong> Likes act as Hype points that boost your stream’s rank to appear at the top of the Feed.
                </p>
                <p className="text-[11px] text-neutral-300 leading-relaxed mt-1">
                  🚫 <strong className="text-white">No Self-Gifting:</strong> Streamers cannot gift their own live streams. Gifts must come from audience viewers.
                </p>
              </div>
            </div>

            {/* Current Level Status */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-neutral-950 via-rose-950/20 to-neutral-950 border border-white/10 mb-4 text-center">
              <span className="text-2xl mb-1 block">{levelInfo.icon}</span>
              <h4 className="text-xs font-black text-white">
                You are Level {levelInfo.level} ({levelInfo.title})
              </h4>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Total XP: {streamerXp.toLocaleString()} • {levelInfo.progressPercent}% towards Level {levelInfo.level + 1}
              </p>
            </div>

            <button
              onClick={() => setShowLevelGuide(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
