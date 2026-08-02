// Reconcile orders whose Mollie webhook never landed.
//
// Mollie is the source of truth here — this function never decides on its own
// that an order was paid. For every order that has a Mollie payment but isn't
// marked paid, it asks the Mollie API what actually happened and only confirms
// the ones Mollie reports as 'paid'.
//
// Two-phase by design: dry_run reports, and only an explicit dry_run:false
// applies. Applying mints real tickets and emails real customers, so the
// operator sees the list before any of that happens.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MOLLIE_KEY   = Deno.env.get('MOLLIE_API_KEY')!

const db = createClient(SUPABASE_URL, SERVICE_KEY)

// x-client-info and x-supabase-api-version are attached automatically by
// supabase-js on functions.invoke(); omitting them from the preflight makes
// every browser call fail as a CORS error before it reaches this handler.
// See the same note in process-email-queue.
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * verify_jwt = true is NOT an authorization check — the anon key is bundled in
 * the public JS build and is itself a perfectly valid JWT. Resolve the caller's
 * token to an actual user; anon has none.
 */
async function isAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const scoped = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data, error } = await scoped.auth.getUser()
  return !error && !!data?.user
}

type MollieLookup = { status: string | null; amount: string | null; error: string | null }

async function fetchMollieStatus(paymentId: string): Promise<MollieLookup> {
  try {
    const res = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
    })
    const payment = await res.json()

    if (!res.ok || !payment.id) {
      return { status: null, amount: null, error: payment?.detail ?? `Mollie ${res.status}` }
    }
    return { status: payment.status, amount: payment.amount?.value ?? null, error: null }
  } catch (e) {
    return { status: null, amount: null, error: String(e) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  if (!await isAdmin(req)) return json({ error: 'Niet geautoriseerd' }, 401)

  const body: { dry_run?: boolean } = await req.json().catch(() => ({}))
  // Default to a dry run: a malformed body must never mint tickets.
  const dryRun = body.dry_run !== false

  // Only sales. Comp orders are inserted straight to 'paid' and have no Mollie
  // payment, so they can never appear here — but filter explicitly rather than
  // relying on that.
  const { data: orders, error: qErr } = await db
    .from('orders')
    .select('id, buyer_name, buyer_email, quantity, total_cents, status, mollie_payment_id, created_at')
    .eq('order_type', 'sale')
    .not('mollie_payment_id', 'is', null)
    .neq('status', 'paid')
    .order('created_at', { ascending: false })

  if (qErr) {
    console.error('Order query failed:', JSON.stringify(qErr))
    return json({ error: 'Kon bestellingen niet ophalen' }, 500)
  }

  if (!orders?.length) {
    return json({ dry_run: dryRun, checked: 0, paid_at_mollie: 0, confirmed: 0, results: [] })
  }

  const results = []
  let confirmedCount = 0

  for (const order of orders) {
    const mollie = await fetchMollieStatus(order.mollie_payment_id!)

    const row = {
      order_id:       order.id,
      buyer_name:     order.buyer_name,
      buyer_email:    order.buyer_email,
      quantity:       order.quantity,
      total_cents:    order.total_cents,
      created_at:     order.created_at,
      our_status:     order.status,
      mollie_status:  mollie.status,
      action:         'none' as string,
      tickets_issued: 0,
      error:          mollie.error as string | null,
    }

    if (mollie.error) {
      row.action = 'lookup_failed'
      results.push(row)
      continue
    }

    if (mollie.status !== 'paid') {
      // Genuinely unpaid — an abandoned checkout, not a victim of the outage.
      row.action = 'skip_unpaid'
      results.push(row)
      continue
    }

    if (dryRun) {
      row.action = 'would_confirm'
      results.push(row)
      continue
    }

    const { data: rpcResult, error: rpcErr } = await db
      .rpc('reconcile_confirm_order', { p_order_id: order.id })

    if (rpcErr) {
      row.action = 'confirm_failed'
      row.error  = rpcErr.message
      console.error(`reconcile_confirm_order failed for ${order.id}:`, JSON.stringify(rpcErr))
    } else if (rpcResult?.success) {
      row.action         = rpcResult.already_paid ? 'already_paid' : 'confirmed'
      row.tickets_issued = rpcResult.tickets_issued ?? 0
      if (row.action === 'confirmed') confirmedCount++
    } else {
      row.action = 'confirm_failed'
      row.error  = rpcResult?.error ?? 'unknown'
      console.error(`reconcile_confirm_order rejected ${order.id}:`, JSON.stringify(rpcResult))
    }

    results.push(row)
  }

  // confirm_payment queues the confirmation email; pg_cron would pick it up
  // within the minute, but an operator who just clicked "send tickets" should
  // not have to wait on a cron tick to find out whether it worked.
  if (!dryRun && confirmedCount > 0) {
    try {
      const ctrl = new AbortController()
      const t    = setTimeout(() => ctrl.abort(), 30_000)
      await fetch(`${SUPABASE_URL}/functions/v1/process-email-queue`, {
        method:  'POST',
        signal:  ctrl.signal,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey':        SERVICE_KEY,
        },
        body: JSON.stringify({}),
      })
      clearTimeout(t)
    } catch (e) {
      // Not fatal: the rows are queued and pg_cron retries. Say so rather than
      // failing a reconcile that already succeeded.
      console.error('Email queue trigger failed (pg_cron will retry):', e)
    }
  }

  return json({
    dry_run:        dryRun,
    checked:        results.length,
    paid_at_mollie: results.filter(r => r.mollie_status === 'paid').length,
    confirmed:      confirmedCount,
    results,
  })
})
