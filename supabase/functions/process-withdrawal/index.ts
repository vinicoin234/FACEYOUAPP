// Supabase Edge Function: an ADMIN sends an approved payout to the user's account via Paystack.
// Deploy:  supabase functions deploy process-withdrawal
// Needs:   PAYSTACK_SECRET_KEY (supabase secrets set ...)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) return json({ error: 'Payouts are not configured' }, 500);

  // 1. Only admins may trigger a payout
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Sign in' }, 401);
  const { data: me } = await userClient.from('profiles').select('is_admin').eq('id', auth.user.id).maybeSingle();
  if (!me?.is_admin) return json({ error: 'Admins only' }, 403);

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return json({ error: 'Missing withdrawal id' }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const reference = `wd-${id}`;

  // 2. Claim it atomically: only an 'approved' request can move to 'processing' (no double payouts)
  const { data: claimed, error: claimError } = await admin.rpc('claim_withdrawal', {
    p_id: id,
    p_reference: reference,
  });
  if (claimError) return json({ error: 'Could not claim the request' }, 500);
  const row = Array.isArray(claimed) ? claimed[0] : null;
  if (!row) return json({ error: 'This request is not approved, or was already paid out' }, 409);

  const paystack = async (path: string, init?: { method?: string; body?: unknown }) => {
    const res = await fetch(`https://api.paystack.co${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.status) throw new Error(body.message ?? `Paystack error ${res.status}`);
    return body;
  };

  const fail = async (message: string) => {
    // Return the held diamonds once and mark the request failed
    await admin.rpc('refund_withdrawal', { p_reference: reference, p_failed: true });
    return json({ error: message, status: 'failed' }, 502);
  };

  try {
    // 3. Find OPay's bank code in Paystack's list (not hard-coded)
    const banks = await paystack('/bank?country=nigeria&perPage=200');
    const opay = (banks.data as { name: string; code: string }[]).find((b) => /opay/i.test(b.name));
    if (!opay) return await fail('OPay is not available as a payout bank right now');

    // 4. Create the recipient and the transfer
    const recipient = await paystack('/transferrecipient', {
      method: 'POST',
      body: {
        type: 'nuban',
        name: row.account_name,
        account_number: row.account_number,
        bank_code: opay.code,
        currency: 'NGN',
      },
    });
    const transfer = await paystack('/transfer', {
      method: 'POST',
      body: {
        source: 'balance',
        amount: Math.round(Number(row.amount_ngn) * 100), // kobo
        recipient: recipient.data.recipient_code,
        reason: `FaceYou payout ${id}`,
        reference,
      },
    });

    await admin.from('withdrawal_requests')
      .update({ paystack_transfer_code: transfer.data.transfer_code })
      .eq('id', id);

    // 'otp' means Paystack wants the admin to confirm in the Paystack dashboard. The webhook settles the rest.
    return json({ status: transfer.data.status, reference, transfer_code: transfer.data.transfer_code });
  } catch (err) {
    return await fail(err instanceof Error ? err.message : 'Payout failed');
  }
});
