import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'tickets@openluchtfuif3212.be'
const SITE_URL   = Deno.env.get('SITE_URL') ?? 'https://tvaneynde.github.io/openluchtfuif-site'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

function buildAbandonedEmailHtml(
  buyerName: string,
  tierName: string,
  checkoutUrl: string,
): string {
  const firstName = buyerName.split(' ')[0]
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Heb je je ticket vergeten?</title></head>
<body style="margin:0;padding:0;background:#1a0820;font-family:Georgia,serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0820;">
<tr><td align="center" style="padding:40px 20px 60px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

  <!-- Header -->
  <tr><td style="background:#d95a2b;border-radius:14px 14px 0 0;padding:26px 28px;">
    <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:26px;color:#f4e7d0;letter-spacing:0.02em;">OPENLUCHTFUIF</p>
    <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:13px;color:rgba(244,231,208,0.85);letter-spacing:0.06em;">PELLENBERG</p>
    <p style="margin:0;font-family:monospace;font-size:9px;letter-spacing:0.18em;color:rgba(244,231,208,0.6);text-transform:uppercase;">Zaterdag 29 Augustus 2026 · Editie XIV</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#1e0b28;padding:32px 28px;border-left:1px solid #3d1a50;border-right:1px solid #3d1a50;">
    <p style="margin:0 0 12px;font-family:Georgia,serif;font-size:20px;color:#f4e7d0;">
      Hey <strong>${firstName}</strong>!
    </p>
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:rgba(244,231,208,0.75);line-height:1.65;">
      Je bent gestopt tijdens het bestelproces voor <strong style="color:#f4e7d0;">${tierName}</strong>.
      Tickets zijn beperkt — klik hieronder om je bestelling alsnog af te ronden.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:#d95a2b;border-radius:8px;padding:14px 28px;">
          <a href="${checkoutUrl}" style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#f4e7d0;text-decoration:none;letter-spacing:0.03em;">
            Bestelling afronden →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:rgba(244,231,208,0.35);line-height:1.5;">
      Als je geen ticket wilt kopen, kun je deze e-mail negeren.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#140622;padding:20px 28px;border-radius:0 0 16px 16px;border:1px solid #3d1a50;border-top:none;text-align:center;">
    <p style="margin:0 0 6px;font-size:12px;color:rgba(244,231,208,0.35);">
      Vragen? <a href="mailto:openluchtfuif3212@gmail.com" style="color:#f07a3c;text-decoration:none;">openluchtfuif3212@gmail.com</a>
    </p>
    <p style="margin:0;font-size:11px;color:rgba(244,231,208,0.2);">© 2026 Openluchtfuif 3212 VZW · Pellenberg</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    // Find orders flagged as abandoned (reminder_sent_at set by cron)
    // but for which no abandoned_checkout email has been sent yet.
    const { data: orders, error: qErr } = await db
      .from('orders')
      .select('id, buyer_name, buyer_email, tier_id, ticket_tiers(name)')
      .not('abandoned_reminder_sent_at', 'is', null)
      .not('id', 'in', `(
        SELECT order_id FROM email_log WHERE type = 'abandoned_checkout'
      )`)

    if (qErr) throw new Error(`Query failed: ${qErr.message}`)
    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    let failed = 0

    for (const order of orders) {
      try {
        const tierName    = (order.ticket_tiers as any)?.name ?? 'ticket'
        const checkoutUrl = `${SITE_URL}/#/checkout?tier_id=${order.tier_id}`

        const html = buildAbandonedEmailHtml(order.buyer_name, tierName, checkoutUrl)

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `abandoned-${order.id}`,
          },
          body: JSON.stringify({
            from:    `Openluchtfuif 2026 <${FROM_EMAIL}>`,
            to:      order.buyer_email,
            subject: 'Heb je je ticket vergeten? 🎟',
            html,
          }),
        })

        const resendData = await resendRes.json()
        if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}: ${JSON.stringify(resendData)}`)

        await db.from('email_log').insert({
          order_id:          order.id,
          type:              'abandoned_checkout',
          status:            'sent',
          resend_message_id: resendData.id,
          attempts:          1,
          last_attempt_at:   new Date().toISOString(),
        })

        console.log(`Abandoned reminder sent for order ${order.id}`)
        sent++
      } catch (err) {
        console.error(`Failed to send reminder for order ${order.id}:`, err)

        // Log the failure so we don't retry endlessly on the same order
        await db.from('email_log').insert({
          order_id:        order.id,
          type:            'abandoned_checkout',
          status:          'failed',
          error_message:   String(err),
          attempts:        1,
          last_attempt_at: new Date().toISOString(),
        }).then(() => {})

        failed++
      }
    }

    return new Response(JSON.stringify({ processed: orders.length, sent, failed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-abandoned-reminders error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
