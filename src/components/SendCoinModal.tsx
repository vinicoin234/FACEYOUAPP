import React, { useState } from 'react';
import { X, Coins, Sparkles, ArrowRight, AlertCircle, PlusCircle } from 'lucide-react';
import { User, Conversation } from '../types';

interface SendCoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  recipient: Conversation['participant'];
  onConfirmSend: (amount: number, note: string) => void;
  onOpenRecharge: () => void;
}

const PRESET_AMOUNTS = [10, 50, 100, 250, 500, 1000];

export const SendCoinModal: React.FC<SendCoinModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  recipient,
  onConfirmSend,
  onOpenRecharge,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAmount = customAmount ? parseInt(customAmount, 10) || 0 : selectedAmount;
  const hasEnoughCoins = currentUser.coins >= currentAmount;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (currentAmount <= 0) {
      setErrorMessage('Please select or enter an amount greater than 0 coins.');
      return;
    }

    if (!hasEnoughCoins) {
      setErrorMessage(`Insufficient coins. You need ${currentAmount.toLocaleString()} coins but currently have ${currentUser.coins.toLocaleString()}.`);
      return;
    }

    onConfirmSend(currentAmount, note.trim() || '🪙 Sent you coins!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Send Coins</h3>
              <p className="text-[11px] text-neutral-400">
                To <strong className="text-white">{recipient.name}</strong> ({recipient.handle})
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

        {/* User Balance Bar */}
        <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-neutral-300">Your Coin Balance:</span>
            <span className="text-xs font-black text-white">
              {currentUser.coins.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenRecharge}
            className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1"
          >
            <PlusCircle className="w-3 h-3" />
            <span>Recharge</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          {/* Preset Buttons */}
          <div>
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
              Select Coin Amount
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((amt) => {
                const isSelected = !customAmount && selectedAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount('');
                      setErrorMessage(null);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-amber-400 text-black border-amber-300 shadow-lg shadow-amber-400/20 scale-105'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <span>{amt}</span>
                    <Coins className="w-3 h-3" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
              Or Custom Coin Amount
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Enter custom amount..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
              <Coins className="w-4 h-4 text-amber-400 absolute right-3 top-3" />
            </div>
          </div>

          {/* Note message */}
          <div>
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
              Add a Friendly Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Thanks for the live stream! 🔥"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Action button */}
          {hasEnoughCoins ? (
            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-400/30 transition-transform active:scale-95 cursor-pointer"
            >
              <span>Send {currentAmount.toLocaleString()} Coins</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenRecharge}
              className="w-full py-3.5 rounded-full bg-[#ff0050] hover:bg-[#e00047] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-rose-600/30 transition-transform active:scale-95 cursor-pointer"
            >
              <span>Recharge Coins via Paystack</span>
              <PlusCircle className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
