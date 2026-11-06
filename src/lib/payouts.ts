import { supabase } from './supabase';

/** Request a payout. Diamonds are held immediately. Returns my remaining diamonds. */
export async function requestWithdrawal(
  diamonds: number,
  accountName: string,
  accountNumber: string
): Promise<{ requestId: string; diamondsLeft: number }> {
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_diamonds: diamonds,
    p_account_name: accountName,
    p_account_number: accountNumber,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ''));
  const row = Array.isArray(data) ? data[0] : data;
  return { requestId: row.request_id as string, diamondsLeft: Number(row.diamonds_left) };
}

/** My payout requests and their status. */
export async function myWithdrawals() {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('id, diamonds, amount_ngn, account_number, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return data ?? [];
}

/** Admin: requests waiting for a decision or a transfer. */
export async function adminWithdrawalQueue() {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('id, user_id, diamonds, amount_ngn, account_name, account_number, status, created_at, profiles(name, handle)')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function reviewWithdrawal(id: string, approve: boolean, note: string): Promise<void> {
  const { error } = await supabase.rpc('review_withdrawal', { p_id: id, p_approve: approve, p_note: note || null });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ''));
}

/** Admin: send an approved payout through Paystack. */
export async function processWithdrawal(id: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('process-withdrawal', { body: { id } });
  if (error) {
    throw new Error('Payout could not be started. Check the Paystack setup and try again.');
  }
  return String(data?.status ?? 'sent');
}

/** Is the signed-in user an admin? (Read from their own profile.) */
export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle();
  return Boolean(data?.is_admin);
}
