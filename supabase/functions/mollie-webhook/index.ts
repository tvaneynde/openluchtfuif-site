import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const MOLLIE_KEY = Deno.env.get('MOLLIE_API_KEY')!

// Always return 200 to Mollie — non-2xx causes retries
const OK = new Response('ok', { status: 200 })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return OK

  let paymentId: string | null = null

  try {
    // Mollie sends: Content-Type: application/x-www-form-urlencoded, body: id=tr_xxx
    const body = await req.text()
    paymentId = new URLSearchParams(body).get('id')

    if (!paymentId) {
      console.warn('Webhook called with no payment ID')
      return OK
    }

    // SECURITY: always fetch fresh payment from Mollie — never trust the webhook body alone
    const mollieRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
    })
    const payment = await mollieRes.json()

    if (!payment.id) {
      console.error('Invalid payment response from Mollie:', JSON.stringify(payment))
      return OK
    }

    const orderId = payment.metadata?.order_id
    if (!orderId) {
      console.error('No order_id in payment metadata for payment:', paymentId)
      return OK
    }

    console.log(`Webhook: payment ${paymentId} status=${payment.status} order=${orderId}`)

    if (payment.status === 'paid') {
      // Atomic confirm — idempotent (safe to call multiple times)
      const { data, error } = await db.rpc('confirm_payment', { p_order_id: orderId })
      if (error) {
        console.error('confirm_payment RPC error:', JSON.stringify(error))
      } else {
        console.log('confirm_payment result:', JSON.stringify(data))

        // Trigger email — awaited with 10s timeout so Deno doesn't cancel it.
        // pg_cron is the fallback if this times out.
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!
          const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          const ctrl        = new AbortController()
          const t           = setTimeout(() => ctrl.abort(), 10_000)
          await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
            method:  'POST',
            signal:  ctrl.signal,
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey':        serviceKey,
            },
            body: JSON.stringify({ order_id: orderId }),
          })
          clearTimeout(t)
        } catch (e) {
          console.error('Email trigger failed (pg_cron will retry):', e)
        }
      }
    } else if (['expired', 'cancelled', 'failed'].includes(payment.status)) {
      const newStatus = payment.status === 'expired' ? 'expired' : 'cancelled'
      const { error } = await db
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('mollie_payment_id', paymentId)
        .in('status', ['pending', 'awaiting_payment']) // only update if not already terminal
      if (error) console.error('Order status update failed:', JSON.stringify(error))
    }
    // For 'open', 'pending', 'authorized' — do nothing, wait for next webhook

  } catch (err) {
    console.error('Unexpected webhook error:', err, 'paymentId:', paymentId)
    // Return 200 to prevent infinite Mollie retries on bugs
  }

  return OK
})
