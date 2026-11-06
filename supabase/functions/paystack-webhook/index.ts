// Supabase Edge Function: Paystack webhook for transfer outcomes.
// Deploy WITHOUT JWT check (Paystack does not log in):
//   supabase functions deploy paystack-webhook --no-verify-jwt
// Then in Paystack dashboard -> Settings -> Webhook, set the URL to this function.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) return new Response('not configured', { status: 500 });

  // Paystack signs the raw body with HMAC-SHA512 using your secret key
  const raw = await req.text();
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expected !== req.headers.get('x-paystack-signature')) {
    return new Response('invalid signature', { status: 401 });
  }

  const event = JSON.parse(raw) as { event: string; data?: { reference?: string } };
  const reference = event.data?.reference;
  if (!reference) return new Response('ok', { status: 200 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (event.event === 'transfer.success') {
    await admin.rpc('refund_withdrawal', { p_reference: reference, p_failed: false });
  } else if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
    // Idempotent: the database returns the held diamonds only once
    await admin.rpc('refund_withdrawal', { p_reference: reference, p_failed: true });
  }
  return new Response('ok', { status: 200 });
});
