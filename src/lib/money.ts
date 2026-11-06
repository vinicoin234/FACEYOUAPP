import { supabase } from './supabase';

/** Confirm a Paystack payment on the server. The server decides how many coins to credit. */
export async function verifyPurchase(reference: string, packageId: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('paystack-verify', {
    body: { reference, packageId },
  });
  if (error || typeof data?.balance !== 'number') {
    throw new Error(
      `Payment could not be confirmed yet. If you were charged, contact support with reference ${reference}.`
    );
  }
  return data.balance as number;
}

function asError(err: { message: string }) {
  // Database messages such as "Not enough coins" are shown as-is
  return new Error(err.message.replace(/^.*?:\s*/, ''));
}

/** Send coins to another user (inbox). Returns the sender's new balance. */
export async function sendCoins(recipientId: string, amount: number, note: string): Promise<number> {
  const { data, error } = await supabase.rpc('send_gift', {
    p_recipient: recipientId,
    p_amount: amount,
    p_gift: 'Coins',
    p_stream: null,
    p_note: note,
  });
  if (error) throw asError(error);
  return Number(data);
}

/** Send a gift to a live host. Returns the sender's new balance. */
export async function sendGift(
  recipientId: string,
  streamId: string | null,
  giftName: string,
  cost: number
): Promise<number> {
  const { data, error } = await supabase.rpc('send_gift', {
    p_recipient: recipientId,
    p_amount: cost,
    p_gift: giftName,
    p_stream: streamId,
    p_note: null,
  });
  if (error) throw asError(error);
  return Number(data);
}

/** Current balances from the server (the only trusted source). */
export async function fetchBalances(userId: string): Promise<{ coins: number; diamonds: number } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('coins, diamonds')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return { coins: Number(data.coins ?? 0), diamonds: Number(data.diamonds ?? 0) };
}
