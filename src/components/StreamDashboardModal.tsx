import React, { useState } from 'react';
import {
  X,
  Radio,
  MessageSquare,
  Coins,
  TrendingUp,
  Clock,
  Users,
  Heart,
  ArrowUpRight,
  Filter,
  DollarSign
} from 'lucide-react';
import { User, CoinEarningRecord } from '../types';
import { DIAMOND_TO_NGN_RATE } from './OPayWithdrawModal';

interface StreamDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  coinEarnings: CoinEarningRecord[];
  onOpenWithdraw: () => void;
}

export const StreamDashboardModal: React.FC<StreamDashboardModalProps> = ({
  isOpen,
  onClose,
  user,
  coinEarnings,
  onOpenWithdraw,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'live_stream_gift' | 'inbox_tip'>('all');

  if (!isOpen) return null;

  // Compute metrics
  const totalCoinsReceived = coinEarnings.reduce((acc, curr) => acc + curr.coins, 0);
  const totalDiamondsEarned = coinEarnings.reduce((acc, curr) => acc + curr.diamondsEarned, 0);

  const streamEarnings = coinEarnings.filter((c) => c.type === 'live_stream_gift');
  const inboxEarnings = coinEarnings.filter((c) => c.type === 'inbox_tip');

  const streamCoins = streamEarnings.reduce((acc, curr) => acc + curr.coins, 0);
  const inboxCoins = inboxEarnings.reduce((acc, curr) => acc + curr.coins, 0);

  const filteredLogs = coinEarnings.filter((c) => {
    if (filterType === 'all') return true;
    return c.type === filterType;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#ff0050] to-[#00f2fe] flex items-center justify-center shadow-lg shadow-rose-600/30">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Creator Stream & Earnings Dashboard
              </h3>
              <p className="text-[11px] text-neutral-400">
                Live broadcast analytics & inbox coin tips record
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Earnings Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {/* Total Coins Received */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Coins Received</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-2xl font-black text-white">
              {totalCoinsReceived.toLocaleString()}
            </span>
            <span className="text-[10px] text-neutral-500 mt-1">
              From Streams & Inbox Tips
            </span>
          </div>

          {/* Diamonds Balance */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Diamonds Earned</span>
              <span className="text-base">💎</span>
            </div>
            <span className="text-2xl font-black text-amber-400">
              {user.diamonds.toLocaleString()}
            </span>
            <span className="text-[10px] text-neutral-500 mt-1">
              ≈ ₦{(user.diamonds * DIAMOND_TO_NGN_RATE).toLocaleString()} OPay Value
            </span>
          </div>

          {/* Payout Action Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-950 border border-emerald-500/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-xs font-black uppercase tracking-wider">OPay Payout</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[10px] text-neutral-400">
              End-of-month automatic creator settlements.
            </p>
            <button
              onClick={() => {
                onClose();
                onOpenWithdraw();
              }}
              className="mt-2 py-2 px-3 rounded-xl bg-[#00b956] hover:bg-[#009e49] text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer"
            >
              <span>Withdraw to OPay</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Source Breakdown (Live Streams vs Inbox Tips) */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-rose-500/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-[#ff0050] flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-neutral-400 font-bold uppercase">
                Live Stream Gifts
              </span>
              <span className="text-lg font-black text-white">
                {streamCoins.toLocaleString()} <span className="text-xs text-amber-400 font-semibold">Coins</span>
              </span>
              <span className="text-[10px] text-neutral-500">
                {streamEarnings.length} broadcast gifts
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-cyan-500/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-[#00f2fe] flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-neutral-400 font-bold uppercase">
                Inbox Tips & Transfers
              </span>
              <span className="text-lg font-black text-white">
                {inboxCoins.toLocaleString()} <span className="text-xs text-amber-400 font-semibold">Coins</span>
              </span>
              <span className="text-[10px] text-neutral-500">
                {inboxEarnings.length} direct transfers
              </span>
            </div>
          </div>
        </div>

        {/* Transaction History & Records Log */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Earnings History Log</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                {filteredLogs.length}
              </span>
            </h4>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  filterType === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('live_stream_gift')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  filterType === 'live_stream_gift' ? 'bg-rose-600/30 text-rose-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Stream Gifts
              </button>
              <button
                onClick={() => setFilterType('inbox_tip')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  filterType === 'inbox_tip' ? 'bg-cyan-600/30 text-cyan-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Inbox Tips
              </button>
            </div>
          </div>

          {/* List of records */}
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 flex flex-col items-center justify-center">
              <Coins className="w-10 h-10 mb-2 opacity-30 text-amber-400" />
              <p className="text-xs font-bold text-neutral-300">No earnings recorded yet</p>
              <p className="text-[11px] text-neutral-500 mt-1 max-w-xs">
                Coins you receive from fans during your LIVE broadcasts or through direct inbox transfers will be recorded here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
              {filteredLogs.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        item.type === 'live_stream_gift'
                          ? 'bg-rose-500/20 text-[#ff0050]'
                          : 'bg-cyan-500/20 text-[#00f2fe]'
                      }`}
                    >
                      {item.type === 'live_stream_gift' ? (
                        <Radio className="w-4 h-4" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white leading-tight">
                        {item.sourceTitle}
                      </span>
                      <span className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                        From <strong className="text-neutral-300">{item.senderName}</strong> •{' '}
                        {new Date(item.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-emerald-400">
                      +{item.coins.toLocaleString()} Coins
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold">
                      +{item.diamondsEarned} 💎
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            Recorded in your FaceYou creator profile
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
