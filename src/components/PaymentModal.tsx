import React, { useState } from 'react';
import { X, Coins, CreditCard, ShieldCheck, Check, Sparkles, Loader2 } from 'lucide-react';
import { CoinPackage } from '../types';
import { COIN_PACKAGES } from '../data/mockData';
import { playCoinSound } from '../utils/audio';
import { verifyPurchase } from '../lib/money';

const PAYSTACK_PUBLIC_KEY = 'pk_live_a9ad9d573bdf37b3d3162234fe832adb5fad3a28';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
  onSuccess: (newBalance: number, packageLabel: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  userId,
  onSuccess,
}) => {
  const [selectedPkg, setSelectedPkg] = useState<CoinPackage>(COIN_PACKAGES[1]);
  const [email, setEmail] = useState<string>(userEmail || 'streamer@faceyou.live');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePay = () => {
    setIsProcessing(true);
    setNotification(null);

    const win = window as unknown as { PaystackPop?: { setup: (opts: unknown) => { openIframe: () => void } } };
    if (!win.PaystackPop || typeof win.PaystackPop.setup !== 'function') {
      // No fake credit: without Paystack loaded, nothing is paid and nothing is added
      setIsProcessing(false);
      setNotification('Payment could not start. Check your connection and try again.');
      return;
    }

    // Paystack references allow letters, digits, "-", "." and "=" only
    const reference = `FY-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const handler = win.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email.trim(),
        amount: selectedPkg.priceNgn * 100, // kobo
        currency: 'NGN',
        ref: reference,
        metadata: { faceyou_user_id: userId, faceyou_package: selectedPkg.id },
        callback: (response: { reference: string }) => {
          // The server confirms the payment with Paystack before any coins are added
          verifyPurchase(response.reference, selectedPkg.id)
            .then((balance) => {
              setIsProcessing(false);
              playCoinSound();
              onSuccess(balance, selectedPkg.label);
              onClose();
            })
            .catch((err: unknown) => {
              setIsProcessing(false);
              setNotification(err instanceof Error ? err.message : 'Payment could not be confirmed.');
            });
        },
        onClose: () => setIsProcessing(false),
      });
      handler.openIframe();
    } catch {
      setIsProcessing(false);
      setNotification('Payment could not start. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-700/80 rounded-3xl p-6 shadow-2xl overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Coins className="w-6 h-6 text-amber-950" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Get FaceYou Coins
            </h2>
            <p className="text-xs text-neutral-400">
              Power up your live streams with gifts & reactions
            </p>
          </div>
        </div>

        {/* Email Input */}
        <div className="my-4">
          <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">
            Billing Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your-email@example.com"
            className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>

        {/* Package list */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-5">
          {COIN_PACKAGES.map((pkg) => {
            const isSelected = selectedPkg.id === pkg.id;
            const totalCoins = pkg.coins + pkg.bonus;

            return (
              <div
                key={pkg.id}
                onClick={() => setSelectedPkg(pkg)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/15 shadow-md shadow-amber-500/20'
                    : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                      isSelected
                        ? 'bg-amber-400 text-amber-950'
                        : 'bg-neutral-800 text-neutral-400 group-hover:text-amber-400'
                    }`}
                  >
                    <Coins className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white">
                        {totalCoins.toLocaleString()} Coins
                      </span>
                      {pkg.bonus > 0 && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          +{pkg.bonus} Free
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-400">
                      {pkg.label}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-amber-300">
                    ₦{pkg.priceNgn.toLocaleString()}
                  </span>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 ml-auto mt-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Paystack Checkout Button */}
        <button
          onClick={handlePay}
          disabled={isProcessing}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:brightness-110 text-amber-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 transition-all active:scale-95 disabled:opacity-60"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting Paystack Gateway...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>
                Pay ₦{selectedPkg.priceNgn.toLocaleString()} via Paystack
              </span>
            </>
          )}
        </button>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Secured 256-bit encryption • Instant wallet crediting</span>
        </div>
      </div>
    </div>
  );
};
