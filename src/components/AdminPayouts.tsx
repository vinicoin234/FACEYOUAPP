import React, { useEffect, useState } from 'react';
import { Wallet, X } from 'lucide-react';
import { adminWithdrawalQueue, isCurrentUserAdmin, processWithdrawal, reviewWithdrawal } from '../lib/payouts';

interface QueueRow {
  id: string;
  diamonds: number;
  amount_ngn: number;
  account_name: string;
  account_number: string;
  status: 'pending' | 'approved';
  created_at: string;
  profiles: { name: string; handle: string } | { name: string; handle: string }[] | null;
}

/** Visible only to admin accounts. Approve a request, then send it. */
export const AdminPayouts: React.FC<{ userId: string }> = ({ userId }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void isCurrentUserAdmin(userId).then(setIsAdmin);
  }, [userId]);

  const refresh = () =>
    adminWithdrawalQueue()
      .then((list) => setRows(list as unknown as QueueRow[]))
      .catch((err: Error) => setMessage(err.message));

  useEffect(() => {
    if (!open || !isAdmin) return;
    void refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAdmin]);

  if (!isAdmin) return null;

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
      void refresh();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 px-3 py-2 rounded-full bg-neutral-900 border border-neutral-700 text-xs font-bold text-white flex items-center gap-1.5 shadow-xl"
      >
        <Wallet className="w-4 h-4" /> Payouts {rows.length > 0 && `(${rows.length})`}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-white">Payout queue</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 rounded-full hover:bg-white/10 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {message && <p className="text-xs text-amber-300 mb-3">{message}</p>}
            {rows.length === 0 && <p className="text-sm text-neutral-400">No payouts waiting.</p>}

            <div className="space-y-3">
              {rows.map((r) => {
                const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
                return (
                  <div key={r.id} className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-sm font-bold text-white">
                      ₦{Number(r.amount_ngn).toLocaleString()} · {r.diamonds.toLocaleString()} diamonds
                    </p>
                    <p className="text-xs text-neutral-300">
                      {r.account_name} · {r.account_number} (OPay)
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {p?.name ?? 'User'} {p?.handle ? `· ${p.handle}` : ''} · {r.status}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {r.status === 'pending' && (
                        <>
                          <button
                            disabled={busyId === r.id}
                            onClick={() => act(r.id, () => reviewWithdrawal(r.id, true, 'Approved'), 'Approved. Now send it.')}
                            className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busyId === r.id}
                            onClick={() => act(r.id, () => reviewWithdrawal(r.id, false, 'Rejected by admin'), 'Rejected. Diamonds returned.')}
                            className="px-3 py-1.5 rounded-full bg-red-700 text-white text-xs font-bold disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, () => processWithdrawal(r.id), 'Transfer sent to Paystack.')}
                          className="px-3 py-1.5 rounded-full bg-[#ff0050] text-white text-xs font-bold disabled:opacity-50"
                        >
                          Send payout
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
