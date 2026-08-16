import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const MOLLIE_KEY = Deno.env.get('MOLLIE_API_KEY')!
const SITE_URL   = Deno.env.get('SITE_URL') ?? 'https://openluchtfuif3212.be'

// Most bundles someone may buy in one go. With a group_size of 10 that is 50
// tickets — beyond which this stops being a group of friends and starts being
// something the organiser should handle by hand.
const MAX_BUNDLES = 5

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

  let body: {
    tier_id?: string; quantity?: number; buyer_name?: string; buyer_email?: string
    promo_code?: string
    attendees?: Array<{ name?: string; email?: string } | null>
  }
  try { body = await req.json() } catch { return err('Invalid JSON') }

  const { tier_id, quantity = 1, buyer_name, buyer_email } = body

  // ── Input validation ──────────────────────────────────────────
  if (!tier_id)     return err('tier_id is required')
  if (!buyer_name?.trim())  return err('buyer_name is required')
  if (!buyer_email?.trim()) return err('buyer_email is required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer_email)) return err('Invalid email address')
  // Absolute backstop only, matching orders_quantity_check. The real per-order
  // limit depends on the tier and is applied below, once we know whether this is
  // a bundle: 10 tickets for an ordinary tier, MAX_BUNDLES bundles for a group.
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return err('Ongeldig aantal')
  }

  // ── Fetch & validate tier ────────────────────────────────────
  const { data: tier } = await db
    .from('ticket_tiers')
    .select('*')
    .eq('id', tier_id)
    .eq('is_active', true)
    .single()

  if (!tier) return err('Ticket tier not found or inactive', 404)
  if (tier.is_door_sale) return err('This tier is only available at the door', 400)
  // Comp tiers are €0 giveaways for sponsors/partners. They are never purchasable —
  // don't rely on is_active being false, that's one dashboard misclick away.
  if (tier.is_comp) return err('This tier cannot be purchased', 400)

  const now = new Date()
  if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) return err('Tickets are not on sale yet')
  if (tier.sale_ends_at   && new Date(tier.sale_ends_at)   < now) return err('Ticket sales have ended')

  // ── Bundles ──────────────────────────────────────────────────
  // `quantity` is a count of TICKETS on every tier, so capacity, sold_count and
  // mint_tickets need no special case. `units` is what the buyer is CHARGED for:
  // bundles on a group tier, tickets otherwise. Price and discount both use
  // units; nothing else does.
  const groupSize: number | null = tier.group_size ?? null
  let units: number

  if (groupSize) {
    // Half a bundle is not a thing. The UI only ever sends multiples, so this is
    // a guard against a hand-crafted request, not something a buyer will see.
    if (quantity % groupSize !== 0) {
      return err(`Dit groepsticket wordt per ${groupSize} verkocht`)
    }
    units = quantity / groupSize
    if (units > MAX_BUNDLES) {
      return err(`Maximaal ${MAX_BUNDLES} groepstickets per bestelling`)
    }
  } else {
    if (quantity > 10) return err('Maximaal 10 tickets per bestelling')
    units = quantity
  }

  // Deliberately does not report the remaining count — the public site no longer
  // discloses it (see the public_ticket_tiers view), and an error message would
  // be a trivial way to read it back out.
  const remaining = tier.total_capacity - tier.sold_count
  if (remaining < quantity) {
    return err(remaining === 0
      ? 'Uitverkocht'
      : 'Niet genoeg tickets beschikbaar — probeer een kleiner aantal')
  }

  // ── Guest list (optional, any tier) ──────────────────────────
  // "Ticket 3 is for Jan, jan@example.com". Every field is optional: a blank row
  // simply means that ticket stays with the buyer, which is what happens when
  // someone fills in four of their ten names. Validated here rather than trusted
  // from the browser — these addresses get mailed.
  const attendeeRows: Array<{ seat_index: number; name: string | null; email: string | null }> = []
  if (body.attendees != null) {
    if (!Array.isArray(body.attendees)) return err('attendees must be an array')
    if (body.attendees.length > quantity) return err('Meer gasten dan tickets')

    for (let i = 0; i < body.attendees.length; i++) {
      const a = body.attendees[i]
      if (!a) continue
      const name  = (a.name  ?? '').trim()
      const email = (a.email ?? '').trim().toLowerCase()
      if (!name && !email) continue
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return err(`Ongeldig e-mailadres voor ticket ${i + 1}`)
      }
      if (name.length > 120) return err(`Naam voor ticket ${i + 1} is te lang`)
      attendeeRows.push({ seat_index: i + 1, name: name || null, email: email || null })
    }
  }

  /** Replace the order's guest list wholesale — see the call sites for why. */
  async function saveAttendees(orderId: string): Promise<string | null> {
    // Delete-then-insert, unconditionally: an order row is reused across
    // checkout attempts (idempotency key), so a buyer who switches from the
    // 10-person bundle to a single ticket, or who clears a name, must not keep
    // the stale guests. Doing nothing when the list is empty would leave them.
    const { error: dErr } = await db.from('order_attendees').delete().eq('order_id', orderId)
    if (dErr) return String(dErr.message ?? dErr)
    if (!attendeeRows.length) return null
    const { error: iErr } = await db
      .from('order_attendees')
      .insert(attendeeRows.map(r => ({ ...r, order_id: orderId })))
    return iErr ? String(iErr.message ?? iErr) : null
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
    // A code may be tied to one tier — e.g. a discount meant for the group
    // bundle that must not quietly apply to single tickets. NULL = any tier.
    if (promo.tier_id && promo.tier_id !== tier_id) {
      return err('Deze promotiecode geldt niet voor dit ticket')
    }

    // Calculate discount — per UNIT, matching what is actually charged. On a
    // group tier, price_cents is the bundle price, so multiplying by the ticket
    // count would discount ten times the amount the buyer is paying.
    if (promo.discount_type === 'percent') {
      discountCents = Math.round((tier.price_cents * promo.discount_value / 100) * units)
    } else {
      discountCents = Math.min(promo.discount_value * units, tier.price_cents * units)
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
  // Scoped to order_type='sale': comp orders live in the same table, and the
  // reuse branch below happily adopts a cancelled/expired row without resetting
  // order_type — a revoked comp order must never be recycled into a Mollie sale.
  const { data: existingOrder } = await db
    .from('orders')
    .select('id, mollie_payment_id, status')
    .eq('mollie_idempotency_key', iKey)
    .eq('order_type', 'sale')
    .maybeSingle()

  if (existingOrder?.mollie_payment_id && existingOrder.status === 'awaiting_payment') {
    // Re-use existing Mollie payment URL (still valid for 15 min)
    const mp = await fetch(
      `https://api.mollie.com/v2/payments/${existingOrder.mollie_payment_id}`,
      { headers: { Authorization: `Bearer ${MOLLIE_KEY}` } },
    ).then(r => r.json())
    if (mp._links?.checkout?.href) {
      // The amount is fixed at this point (it lives on the Mollie payment), but
      // the guest list is not part of the amount — so a buyer who went back and
      // corrected a friend's address still gets the corrected list.
      const aErr = await saveAttendees(existingOrder.id)
      if (aErr) console.error('Attendee save failed on reused order:', aErr)
      return json({ checkoutUrl: mp._links.checkout.href, orderId: existingOrder.id })
    }
  }

  // ── Create or reuse order row ───────────────────────────────────
  const totalCents = Math.max(0, (tier.price_cents + tier.fee_cents) * units - discountCents)
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

  // Persisted before Mollie is contacted: mint_tickets() reads these rows at
  // confirmation time, and a webhook that arrives before the list is written
  // would produce ten tickets addressed to nobody.
  const attErr = await saveAttendees(orderId)
  if (attErr) {
    console.error('Attendee save failed:', orderId, attErr)
    return err('Kon de gasten niet opslaan. Probeer opnieuw.', 500)
  }

  // ── Never mint a free ticket from the public endpoint ─────────
  // This function runs with verify_jwt=false, so a €0 total used to mean
  // "skip Mollie, mark paid, issue tickets" to anyone who could reach a
  // 100%-discount code. Free tickets now come only from issue_comp_tickets(),
  // which requires an authenticated admin.
  if (totalCents === 0) {
    console.error('Rejected €0 order', { orderId, tier_id, promo: validatedPromoCode })
    return err('Ongeldig ordertotaal', 400)
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
      // "Groepsticket 10 × 2 — 20 tickets" rather than "× 20", so the Mollie
      // dashboard shows the same number of units the buyer was charged for.
      description: groupSize
        ? `${tier.name} × ${units} — ${quantity} tickets — Openluchtfuif 2026${discountDesc}`
        : `${tier.name} × ${quantity} — Openluchtfuif 2026${discountDesc}`,
      redirectUrl,
      webhookUrl,
      metadata: { order_id: orderId, tier_name: tier.name, quantity, units },
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
