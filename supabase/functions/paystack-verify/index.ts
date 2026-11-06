// Supabase Edge Function: verifies a Paystack payment and credits coins.
// Deploy:   supabase functions deploy paystack-verify
// Secret:   supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
//
// The browser never decides how many coins to give. The package and price are defined here,
// and the payment is confirmed directly with Paystack before anything is credited.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Must match COIN_PACKAGES in src/data/mockData.ts
const PACKAGES: Record<string, { coins: number; priceNgn: number }> = {
  'pkg-1': { coins: 70 + 0, priceNgn: 400 },
  'pkg-2': { coins: 350 + 30, priceNgn: 1800 },
  'pkg-3': { coins: 1400 + 180, priceNgn: 5500 },
  'pkg-4': { coins: 3500 + 600, priceNgn: 12500 },
  'pkg-5': { coins: 10500 + 2500, priceNgn: 30000 },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!paystackKey) return json({ error: 'Payment server is not configured' }, 500);

  // 1. Who is asking? (the caller's own login)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Sign in to buy coins' }, 401);

  // 2. What did they ask for?
  const { reference, packageId } = (await req.json().catch(() => ({}))) as {
    reference?: string;
    packageId?: string;
  };
  const pkg = packageId ? PACKAGES[packageId] : undefined;
  if (!reference || !pkg) return json({ error: 'Unknown package or reference' }, 400);

  // 3. Ask Paystack directly whether this payment really succeeded
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackKey}` },
  });
  const body = await res.json().catch(() => ({}));
  const tx = body?.data;
  if (!res.ok || !body?.status || tx?.status !== 'success') {
    return json({ error: 'Payment was not successful' }, 402);
  }
  if (tx.currency !== 'NGN' || tx.amount !== pkg.priceNgn * 100) {
    return json({ error: 'Payment amount does not match this package' }, 400);
  }
  if (tx.metadata?.faceyou_user_id !== auth.user.id || tx.metadata?.faceyou_package !== packageId) {
    return json({ error: 'This payment belongs to a different account or package' }, 403);
  }

  // 4. Credit exactly once (the database rejects a reused reference)
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: newBalance, error } = await admin.rpc('record_purchase', {
    p_user: auth.user.id,
    p_ref: reference,
    p_coins: pkg.coins,
    p_price: pkg.priceNgn,
  });
  if (error) return json({ error: 'Could not record the purchase' }, 500);

  if (newBalance === null) {
    // Already credited earlier: return the current balance, credit nothing new
    const { data: profile } = await admin.from('profiles').select('coins').eq('id', auth.user.id).single();
    return json({ balance: profile?.coins ?? 0, alreadyCredited: true });
  }
  return json({ balance: newBalance, credited: pkg.coins });
});
