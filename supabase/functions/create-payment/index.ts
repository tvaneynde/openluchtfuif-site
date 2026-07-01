import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const MOLLIE_KEY = Deno.env.get('MOLLIE_API_KEY')!
const SITE_URL   = Deno.env.get('SITE_URL') ?? 'https://tvaneynde.github.io/openluchtfuif-site'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

// ── Rate limiter: max 5 checkout attempts per IP per minute ──────────────────
// Module-level map persists across warm requests within the same Deno isolate.
const _rl = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now   = Date.now()
  const window = 60_000
  const max   = 5
  const hits  = (_rl.get(ip) ?? []).filter(t => now - t < window)
  if (hits.length >= max) return true
  hits.push(now)
  _rl.set(ip, hits)
  return false
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function err(msg: string, status = 400) { return json({ error: msg }, status) }

/** SHA-256 hex of a string */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 5-minute idempotency window: same email+tier within 5 min = same key */
function idempotencyKey(email: string, tierId: string) {
  const window = Math.floor(Date.now() / 300_000)
  return sha256(`${email.toLowerCase().trim()}:${tierId}:${window}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return err('Method not allowed', 405)

  // Rate limit: 5 checkout attempts per IP per minute
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
           ?? req.headers.get('cf-connecting-ip')
           ?? 'unknown'
  if (rateLimited(ip)) {
    return json({ error: 'Te veel pogingen. Wacht een minuut en probeer opnieuw.' }, 429)
  }

  let body: { tier_id?: string; quantity?: number; buyer_name?: string; buyer_email?: string; promo_code?: string }
  try { body = await req.json() } catch { return err('Invalid JSON') }

  const { tier_id, quantity = 1, buyer_name, buyer_email } = body

  // ── Input validation ──────────────────────────────────────────
  if (!tier_id)     return err('tier_id is required')
  if (!buyer_name?.trim())  return err('buyer_name is required')
  if (!buyer_email?.trim()) return err('buyer_email is required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer_email)) return err('Invalid email address')
  if (quantity < 1 || quantity > 10) return err('Quantity must be between 1 and 10')

  // ── Fetch & validate tier ────────────────────────────────────
  const { data: tier } = await db
    .from('ticket_tiers')
    .select('*')
    .eq('id', tier_id)
    .eq('is_active', true)
    .single()

  if (!tier) return err('Ticket tier not found or inactive', 404)

  const now = new Date()
  if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) return err('Tickets are not on sale yet')
  if (tier.sale_ends_at   && new Date(tier.sale_ends_at)   < now) return err('Ticket sales have ended')

  const remaining = tier.total_capacity - tier.sold_count
  if (remaining < quantity) {
    return err(remaining === 0 ? 'Uitverkocht' : `Nog maar ${remaining} ticket(s) beschikbaar`)
  }

  // ── Validate promo code if provided ──────────────────────────
  let discountCents = 0
  let validatedPromoCode: string | null = null
  let promoData: { used_count: number; discount_type: string; discount_value: number } | null = null

  if (body.promo_code) {
    const code = body.promo_code.trim().toUpperCase()
    const { data: promo } = await db
      .from('promo_codes')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (!promo) return err('Ongeldige promotiecode')
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) return err('Promotiecode is verlopen')
    if (promo.max_uses != null && promo.used_count >= promo.max_uses) return err('Promotiecode is niet meer geldig')

    // Calculate discount
    if (promo.discount_type === 'percent') {
      discountCents = Math.round((tier.price_cents * promo.discount_value / 100) * quantity)
    } else {
      discountCents = Math.min(promo.discount_value * quantity, tier.price_cents * quantity)
    }
    validatedPromoCode = code
    promoData = promo
  }

  // ── Idempotency: only reuse if still awaiting payment (double-click protection).
  //    Paid orders are NOT reused — buyer should be able to buy again freely.
  const iKey = await idempotencyKey(buyer_email, tier_id)

  // Look up ANY order with this idempotency key, not just pending/awaiting_payment —
  // mollie_idempotency_key is UNIQUE, so a cancelled/expired row with the same key
  // must be reused (updated) rather than re-inserted, or the insert below fails.
  const { data: existingOrder } = await db
    .from('orders')
    .select('id, mollie_payment_id, status')
    .eq('mollie_idempotency_key', iKey)
    .maybeSingle()

  if (existingOrder?.mollie_payment_id && existingOrder.status === 'awaiting_payment') {
    // Re-use existing Mollie payment URL (still valid for 15 min)
    const mp = await fetch(
      `https://api.mollie.com/v2/payments/${existingOrder.mollie_payment_id}`,
      { headers: { Authorization: `Bearer ${MOLLIE_KEY}` } },
    ).then(r => r.json())
    if (mp._links?.checkout?.href) {
      return json({ checkoutUrl: mp._links.checkout.href, orderId: existingOrder.id })
    }
  }

  // ── Create or reuse order row ───────────────────────────────────
  const totalCents = Math.max(0, (tier.price_cents + tier.fee_cents) * quantity - discountCents)
  const reusable = existingOrder && ['pending', 'awaiting_payment', 'cancelled', 'expired'].includes(existingOrder.status)

  let orderId: string
  if (reusable) {
    orderId = existingOrder.id
    const { error: uErr } = await db
      .from('orders')
      .update({
        quantity,
        total_cents: totalCents,
        buyer_email: buyer_email.toLowerCase().trim(),
        buyer_name:  buyer_name.trim(),
        status: 'pending',
        mollie_payment_id: null,
        promo_code: validatedPromoCode,
        discount_cents: discountCents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
    if (uErr) {
      console.error('Order update failed:', uErr)
      return err('Failed to create order', 500)
    }
  } else {
    const { data: order, error: oErr } = await db
      .from('orders')
      .insert({
        tier_id,
        quantity,
        total_cents: totalCents,
        buyer_email: buyer_email.toLowerCase().trim(),
        buyer_name:  buyer_name.trim(),
        status: 'pending',
        mollie_idempotency_key: iKey,
        promo_code: validatedPromoCode,
        discount_cents: discountCents,
      })
      .select('id')
      .single()
    if (oErr || !order) {
      console.error('Order insert failed:', oErr)
      return err('Failed to create order', 500)
    }
    orderId = order.id
  }

  // ── Handle free orders (100% discount) ───────────────────────
  if (totalCents === 0) {
    // Mark order as paid directly, skip Mollie
    await db.from('orders').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', orderId)

    // Confirm payment (generate tickets etc.)
    await db.rpc('confirm_payment', { p_order_id: orderId })

    // Increment promo usage
    if (validatedPromoCode && promoData) {
      await db.from('promo_codes')
        .update({ used_count: promoData.used_count + 1 })
        .eq('code', validatedPromoCode)
    }

    return json({ orderId, free: true })
  }

  // ── Create Mollie payment ─────────────────────────────────────
  const supabaseHost  = Deno.env.get('SUPABASE_URL')!
  // mollie-webhook has verify_jwt=false so no auth header needed
  const webhookUrl    = `${supabaseHost}/functions/v1/mollie-webhook`
  // Mollie rejects URLs with # fragments — use a real query param instead.
  // index.html detects ?order_id= on load and redirects into the hash router.
  const redirectUrl   = `${SITE_URL}/?order_id=${orderId}`

  const discountDesc = discountCents > 0
    ? ` (korting: -€${(discountCents / 100).toFixed(2)})`
    : ''

  const mollieRes = await fetch('https://api.mollie.com/v2/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${MOLLIE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: { currency: 'EUR', value: (totalCents / 100).toFixed(2) },
      description: `${tier.name} × ${quantity} — Openluchtfuif 2026${discountDesc}`,
      redirectUrl,
      webhookUrl,
      metadata: { order_id: orderId, tier_name: tier.name, quantity },
    }),
  })

  const mp = await mollieRes.json()

  if (!mp.id || !mp._links?.checkout?.href) {
    console.error('Mollie payment creation failed:', JSON.stringify(mp))
    // Clean up pending order
    await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    return err('Payment provider error. Please try again.', 502)
  }

  // ── Update order with Mollie ID ───────────────────────────────
  await db.from('orders').update({
    mollie_payment_id: mp.id,
    status: 'awaiting_payment',
    updated_at: new Date().toISOString(),
  }).eq('id', orderId)

  // ── Increment promo usage after successful payment creation ───
  if (validatedPromoCode && promoData) {
    await db.from('promo_codes')
      .update({ used_count: promoData.used_count + 1 })
      .eq('code', validatedPromoCode)
  }

  return json({ checkoutUrl: mp._links.checkout.href, orderId })
})
