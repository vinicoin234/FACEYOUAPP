import React, { useState } from 'react';
import { requestWithdrawal } from '../lib/payouts';
import { X, CheckCircle, AlertCircle, Clock, ShieldCheck, ArrowRight, Wallet } from 'lucide-react';
import { User, OPayWithdrawalRequest } from '../types';

interface OPayWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateUser: (updated: Partial<User>) => void;
  withdrawalRequests: OPayWithdrawalRequest[];
  onAddWithdrawalRequest: (req: OPayWithdrawalRequest) => void;
}

// 1 Diamond = 50 NGN creator payout rate
export const DIAMOND_TO_NGN_RATE = 50;

export const OPayWithdrawModal: React.FC<OPayWithdrawModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  withdrawalRequests,
  onAddWithdrawalRequest,
}) => {
  const [opayNumber, setOpayNumber] = useState(user.opayAccountNumber || '');
  const [opayName, setOpayName] = useState(user.opayAccountName || '');
  const [withdrawDiamonds, setWithdrawDiamonds] = useState<number>(user.diamonds > 0 ? user.diamonds : 0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const estimatedNgn = withdrawDiamonds * DIAMOND_TO_NGN_RATE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanNum = opayNumber.trim().replace(/\s+/g, '');
    const cleanName = opayName.trim();

    if (!cleanNum || cleanNum.length < 10) {
      setErrorMessage('Please enter a valid 10-11 digit OPay phone/account number.');
      return;
    }

    if (!cleanName || cleanName.length < 3) {
      setErrorMessage('Please enter your full registered OPay account name.');
      return;
    }

    if (user.diamonds <= 0) {
      setErrorMessage('You currently have 0 Diamonds. Broadcast LIVE or receive gifts in inbox to earn diamonds.');
      return;
    }

    if (withdrawDiamonds <= 0 || withdrawDiamonds > user.diamonds) {
      setErrorMessage(`Please enter a valid amount between 1 and ${user.diamonds} Diamonds.`);
      return;
    }

    try {
      // The server holds the diamonds and records the request. The rate is applied on the server too.
      const { requestId, diamondsLeft } = await requestWithdrawal(withdrawDiamonds, cleanName, cleanNum);
      onUpdateUser({ opayAccountNumber: cleanNum, opayAccountName: cleanName, diamonds: diamondsLeft });
      onAddWithdrawalRequest({
        id: requestId,
        accountName: cleanName,
        phoneNumber: cleanNum,
        amountDiamonds: withdrawDiamonds,
        estimatedNgn,
        requestedAt: Date.now(),
        status: 'pending_monthly_payout',
        payoutMonth: `End of ${currentMonthName}`,
      });
      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Withdrawal request failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#00b956] text-white flex items-center justify-center font-black shadow-lg shadow-emerald-600/30">
              <span className="text-xl font-black">O</span>
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                OPay Creator Withdrawal
              </h3>
              <p className="text-[11px] text-emerald-400 font-bold">
                End-of-Month Automated Payouts
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

        {isSuccess ? (
          <div className="text-center py-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/30">
              <CheckCircle className="w-9 h-9" />
            </div>

            <h4 className="text-lg font-black text-white">OPay Payout Scheduled!</h4>
            <p className="text-xs text-neutral-300 max-w-xs mt-1 mb-4 leading-relaxed">
              Your withdrawal of <strong className="text-amber-400 font-extrabold">{withdrawDiamonds} Diamonds (₦{estimatedNgn.toLocaleString()})</strong> has been saved.
            </p>

            <div className="w-full bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 text-left text-xs space-y-2 mb-5">
              <div className="flex justify-between">
                <span className="text-neutral-400">OPay Account Name:</span>
                <span className="font-bold text-white">{opayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">OPay Phone Number:</span>
                <span className="font-bold text-emerald-400 font-mono">{opayNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Estimated Payout Date:</span>
                <span className="font-bold text-white">End of {currentMonthName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Status:</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 inline" /> Pending End of Month
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setIsSuccess(false);
                onClose();
              }}
              className="w-full py-3 rounded-full bg-[#00b956] hover:bg-[#009e49] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
            >
              Done & Return to Profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Balance Summary Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-950 via-emerald-950/20 to-neutral-950 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-neutral-400 font-semibold block">
                  Available Creator Diamonds
                </span>
                <div className="text-2xl font-black text-amber-400 flex items-center gap-1 mt-0.5">
                  <span>💎</span>
                  <span>{user.diamonds.toLocaleString()}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-neutral-400 block font-semibold">
                  Estimated Value
                </span>
                <span className="text-base font-black text-emerald-400">
                  ₦{(user.diamonds * DIAMOND_TO_NGN_RATE).toLocaleString()}
                </span>
                <span className="text-[9px] text-neutral-500 block">1 💎 = ₦{DIAMOND_TO_NGN_RATE}</span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* OPay Account Phone Number */}
            <div>
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                OPay Phone / Account Number *
              </label>
              <input
                type="tel"
                value={opayNumber}
                onChange={(e) => setOpayNumber(e.target.value)}
                placeholder="e.g. 08012345678"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00b956]"
                required
              />
              <span className="text-[10px] text-neutral-500 mt-0.5 block">
                The mobile number registered to your OPay wallet account.
              </span>
            </div>

            {/* OPay Registered Full Name */}
            <div>
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                OPay Registered Account Name *
              </label>
              <input
                type="text"
                value={opayName}
                onChange={(e) => setOpayName(e.target.value)}
                placeholder="e.g. John Okon"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00b956]"
                required
              />
              <span className="text-[10px] text-neutral-500 mt-0.5 block">
                Must match your verified OPay bank name exactly.
              </span>
            </div>

            {/* Diamonds to Withdraw */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                  Diamonds to Withdraw
                </label>
                {user.diamonds > 0 && (
                  <button
                    type="button"
                    onClick={() => setWithdrawDiamonds(user.diamonds)}
                    className="text-[10px] text-[#00b956] hover:underline font-bold"
                  >
                    Withdraw All ({user.diamonds})
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={user.diamonds}
                  value={withdrawDiamonds || ''}
                  onChange={(e) => setWithdrawDiamonds(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00b956]"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-emerald-400">
                  ≈ ₦{estimatedNgn.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Monthly Payout Notice */}
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-[11px] text-neutral-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00b956] shrink-0 mt-0.5" />
              <span>
                <strong>End of Month Payment:</strong> Payouts are reconciled and transferred directly to your OPay wallet on the last day of each calendar month.
              </span>
            </div>

            <button
              type="submit"
              disabled={user.diamonds <= 0}
              className="w-full py-3.5 rounded-full bg-[#00b956] hover:bg-[#009e49] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 transition-transform active:scale-95 cursor-pointer"
            >
              <span>Submit OPay Withdrawal (₦{estimatedNgn.toLocaleString()})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Existing Payout Requests Log */}
        {withdrawalRequests.length > 0 && (
          <div className="mt-5 pt-4 border-t border-neutral-800">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Recent Payout Requests
            </h4>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {withdrawalRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>💎 {req.amountDiamonds} Diamonds</span>
                      <span className="text-emerald-400">(₦{req.estimatedNgn.toLocaleString()})</span>
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {req.accountName} • {req.phoneNumber}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {req.payoutMonth}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
