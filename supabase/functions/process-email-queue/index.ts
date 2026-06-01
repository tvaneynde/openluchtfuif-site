import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore
import QRCode from 'https://esm.sh/qrcode@1.5.4'
import { generateTicketPdf } from '../_shared/generatePdf.ts'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_KEY  = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL  = Deno.env.get('FROM_EMAIL') ?? 'tickets@openluchtfuif3212.be'

const LOGO_URL    = 'https://noihnuouftyvsvzybwer.supabase.co/storage/v1/object/public/images/logo/logo-2026.png'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

// ─────────────────────────────────────────────────────────────
// Beautiful email HTML (logo embedded, QR per ticket)
// ─────────────────────────────────────────────────────────────
async function buildEmailHtml(
  order: Record<string, any>,
  tickets: Array<{ ticket_number: string; scan_token: string; qrDataUrl: string }>,
): Promise<string> {
  // Fetch logo as base64 for email embedding (chunked to avoid stack overflow)
  let logoBase64 = ''
  try {
    const res    = await fetch(LOGO_URL)
    const bytes  = new Uint8Array(await res.arrayBuffer())
    let binary   = ''
    const chunk  = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    logoBase64 = btoa(binary)
  } catch (_) {}

  const logoSrc  = logoBase64 ? `data:image/png;base64,${logoBase64}` : LOGO_URL
  const tierName = order.ticket_tiers?.name ?? 'Ticket'

  // Ticket cards — one per ticket, styled exactly like the PDF
  const ticketCards = tickets.map(t => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border-radius:12px;overflow:hidden;border:1px solid #3d1a50;">

      <!-- Orange left accent + QR centered -->
      <tr>
        <td style="background:#160824;padding:32px 24px;text-align:center;border-bottom:1px solid #3d1a50;">
          <!-- Ticket number badge -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:#1e0b28;border:1px solid #3d1a50;border-radius:8px;padding:10px 16px;">
                <p style="margin:0 0 3px;font-family:monospace;font-size:9px;letter-spacing:0.18em;color:#f07a3c;text-transform:uppercase;">Ticket nr</p>
                <p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#f4e7d0;letter-spacing:0.05em;">${t.ticket_number}</p>
              </td>
            </tr>
          </table>
          <!-- QR code -->
          <img src="${t.qrDataUrl}" width="210" height="210" alt="QR code"
            style="display:block;margin:0 auto 14px;padding:12px;background:#ffffff;border-radius:6px;" />
          <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.2em;color:#f07a3c;text-transform:uppercase;">Toon aan de ingang</p>
        </td>
      </tr>

      <!-- Event details row -->
      <tr>
        <td style="background:#1a0820;padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              ['Naam',      order.buyer_name],
              ['Categorie', tierName],
              ['Datum',     'Zaterdag 29 augustus 2026'],
              ['Deuren',    'Vanaf 16:00'],
              ['Locatie',   'Kleine Ganzendries, Pellenberg'],
            ].map(([l, v]) => `
            <tr>
              <td style="font-family:monospace;font-size:9px;color:rgba(180,139,180,0.8);text-transform:uppercase;letter-spacing:0.12em;padding:6px 0 2px;border-top:1px solid #280a38;">${l}</td>
            </tr>
            <tr>
              <td style="font-family:Georgia,serif;font-size:13px;color:#f4e7d0;padding-bottom:4px;">${v}</td>
            </tr>`).join('')}
          </table>
        </td>
      </tr>

      <!-- Tear line footer -->
      <tr>
        <td style="background:#120520;padding:10px 24px;border-top:1px dashed #3d1a50;">
          <p style="margin:0;font-family:monospace;font-size:8px;letter-spacing:0.12em;color:rgba(180,139,180,0.35);text-transform:uppercase;text-align:center;">
            Niet overdraagbaar &nbsp;·&nbsp; Bewaar dit ticket zorgvuldig
          </p>
        </td>
      </tr>

    </table>
  `).join('')

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Je tickets voor Openluchtfuif 2026</title></head>
<body style="margin:0;padding:0;background:#1a0820;font-family:Georgia,serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0820;">
<tr><td align="center" style="padding:40px 20px 60px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

  <!-- Header: orange band with logo — mirrors PDF header -->
  <tr><td style="background:#d95a2b;border-radius:14px 14px 0 0;padding:26px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;">
          <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:26px;color:#f4e7d0;letter-spacing:0.02em;">OPENLUCHTFUIF</p>
          <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:13px;color:rgba(244,231,208,0.85);letter-spacing:0.06em;">PELLENBERG</p>
          <p style="margin:0;font-family:monospace;font-size:9px;letter-spacing:0.18em;color:rgba(244,231,208,0.6);text-transform:uppercase;">Zaterdag 29 Augustus 2026 · Editie XIV</p>
        </td>
        <td align="right" style="width:90px;vertical-align:middle;">
          <img src="${logoSrc}" width="80" height="80" alt="OLF 2026"
            style="display:block;object-fit:contain;" />
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="background:#1e0b28;padding:24px 28px 0;border-left:1px solid #3d1a50;border-right:1px solid #3d1a50;">
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:20px;color:#f4e7d0;">
      Hey <strong>${order.buyer_name.split(' ')[0]}</strong>!
    </p>
    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:13px;color:rgba(244,231,208,0.6);line-height:1.65;">
      Je bestelling is bevestigd. Hieronder vind je je ticket${tickets.length > 1 ? 's' : ''} voor de Openluchtfuif.
      Toon de QR-code aan de ingang &mdash; je smartphonescherm volstaat.
    </p>
  </td></tr>

  <!-- Ticket cards -->
  <tr><td style="background:#1e0b28;padding:0 28px;border-left:1px solid #3d1a50;border-right:1px solid #3d1a50;">
    ${ticketCards}
  </td></tr>

  <!-- Practical info — mirrors PDF info box -->
  <tr><td style="background:#1e0b28;padding:0 28px 28px;border-left:1px solid #3d1a50;border-right:1px solid #3d1a50;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#160824;border-radius:10px;border:1px solid #3d1a50;padding:20px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 10px;font-family:monospace;font-size:9px;letter-spacing:0.15em;color:#f07a3c;text-transform:uppercase;">Praktische info</p>
        <p style="margin:0 0 8px;font-size:13px;color:rgba(244,231,208,0.7);line-height:1.5;">💳 Betalen gaat <strong style="color:#f4e7d0;">cashless</strong> via muntjes — koop ze aan de ingang of op voorhand.</p>
        <p style="margin:0 0 8px;font-size:13px;color:rgba(244,231,208,0.7);line-height:1.5;">🪪 Jonger dan 18? Breng je <strong style="color:#f4e7d0;">identiteitskaart</strong> mee.</p>
        <p style="margin:0;font-size:13px;color:rgba(244,231,208,0.7);line-height:1.5;">🚲 Bewaakte <strong style="color:#f4e7d0;">fietsstalling</strong> aanwezig op het terrein.</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#140622;padding:24px 32px;border-radius:0 0 16px 16px;border:1px solid #3d1a50;border-top:none;text-align:center;">
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

// ─────────────────────────────────────────────────────────────
// Process a single email job
// ─────────────────────────────────────────────────────────────
async function processEmailJob(job: { id: string; order_id: string; attempts: number }) {
  await db.from('email_log').update({
    attempts:        job.attempts + 1,
    last_attempt_at: new Date().toISOString(),
  }).eq('id', job.id)

  try {
    const { data: order, error: oErr } = await db
      .from('orders')
      .select('id, buyer_name, buyer_email, status, ticket_tiers(name), tickets(ticket_number, scan_token, status)')
      .eq('id', job.order_id)
      .single()

    if (oErr || !order) throw new Error(`Order not found: ${job.order_id}`)
    if (order.status !== 'paid') throw new Error(`Order not paid: ${order.status}`)

    const validTickets = (order.tickets as any[]).filter((t: any) => t.status !== 'cancelled')
    if (!validTickets.length) throw new Error('No valid tickets on order')

    // Generate QR codes for the email
    const ticketsWithQR = await Promise.all(validTickets.map(async (t: any) => ({
      ...t,
      qrDataUrl: await QRCode.toDataURL(t.scan_token, {
        errorCorrectionLevel: 'H', width: 240, margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      }),
    })))

    // Generate PDF (chunked base64 to avoid call-stack overflow on large files)
    const pdfBytes  = await generateTicketPdf(order as any, validTickets)
    let pdfBinary   = ''
    const chunk     = 0x8000
    for (let i = 0; i < pdfBytes.length; i += chunk) {
      pdfBinary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk))
    }
    const pdfBase64 = btoa(pdfBinary)

    // Build email HTML
    const html       = await buildEmailHtml(order as any, ticketsWithQR)
    const subject    = validTickets.length > 1
      ? `Je ${validTickets.length} tickets voor Openluchtfuif 2026 🎉`
      : `Je ticket voor Openluchtfuif 2026 🎉`

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:    `Bearer ${RESEND_KEY}`,
        'Content-Type':   'application/json',
        // Force resends use a timestamp so they're never blocked by Resend's 24h cache
        'Idempotency-Key': (job as any).force
          ? `ticket-${job.order_id}-force-${Date.now()}`
          : `ticket-${job.order_id}-${job.attempts + 1}`,
      },
      body: JSON.stringify({
        from:    `Openluchtfuif 2026 <${FROM_EMAIL}>`,
        to:      order.buyer_email,
        subject,
        html,
        attachments: [{
          filename: `tickets-openluchtfuif-2026.pdf`,
          content:  pdfBase64,
        }],
      }),
    })

    const resendData = await resendRes.json()
    if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}: ${JSON.stringify(resendData)}`)

    await db.from('email_log').update({
      status: 'sent', resend_message_id: resendData.id, error_message: null,
    }).eq('id', job.id)

    console.log(`Email sent for order ${job.order_id}, Resend ID: ${resendData.id}`)
    return { success: true }

  } catch (err) {
    const msg = String(err)
    console.error(`Email job ${job.id} failed:`, msg)
    await db.from('email_log').update({
      status:        job.attempts + 1 >= 5 ? 'failed' : 'pending',
      error_message: msg,
    }).eq('id', job.id)
    return { success: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const body        = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const forceOrderId: string | undefined = body.order_id
    const force: boolean = body.force ?? false

    let jobs: Array<{ id: string; order_id: string; attempts: number }>

    if (forceOrderId) {
      const { data } = await db.from('email_log')
        .select('id, order_id, attempts')
        .eq('order_id', forceOrderId)
        .in('status', force ? ['pending', 'sent', 'failed'] : ['pending'])
        .order('created_at', { ascending: false })
        .limit(1)
      jobs = data ?? []
      if (force && jobs[0]) {
        await db.from('email_log').update({ status: 'pending' }).eq('id', jobs[0].id)
        // Mark as force so processEmailJob uses a timestamp idempotency key
        jobs = jobs.map(j => ({ ...j, force: true } as any))
      }
    } else {
      const { data } = await db.from('email_log')
        .select('id, order_id, attempts')
        .eq('status', 'pending')
        .lt('attempts', 5)
        .order('created_at', { ascending: true })
        .limit(20)
      jobs = data ?? []
    }

    if (!jobs.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const results = await Promise.allSettled(jobs.map(j => processEmailJob(j)))
    const sent    = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length

    return new Response(JSON.stringify({ processed: results.length, sent, failed: results.length - sent }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Queue processor error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
