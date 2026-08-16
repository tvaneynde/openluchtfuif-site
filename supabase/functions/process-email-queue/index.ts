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
  // x-client-info and x-supabase-api-version are attached automatically by
  // supabase-js on functions.invoke(). Leaving them out of the preflight makes
  // every browser call fail as a CORS error before it reaches this function —
  // which is why the free-ticket mail and the dashboard's "Verstuur opnieuw"
  // buttons did nothing. This is the only function the frontend reaches via
  // functions.invoke; the others use plain fetch with explicit headers.
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version',
}

// ─────────────────────────────────────────────────────────────
// Beautiful email HTML (logo embedded, QR per ticket)
// ─────────────────────────────────────────────────────────────
function buildEmailHtml(
  order: Record<string, any>,
  tickets: Array<{ ticket_number: string; scan_token: string; qrCid: string; attendee_name?: string | null }>,
  // Who this particular copy is addressed to. NULL for the buyer's copy, which
  // carries every ticket; set for a guest on a group order, whose copy carries
  // only their own. Used for the greeting — the ticket cards always show the
  // name that belongs to each individual ticket.
  greetingName: string,
  isGuestCopy: boolean,
): string {
  // The logo is referenced by URL, never inlined as a data: URI.
  //
  // It used to be fetched and base64-embedded, which produced a single
  // 390,780-character src="" attribute (the source PNG is 293 KB). RFC 5322
  // caps a line at 998 octets, so an MTA hard-wrapped that attribute mid-value,
  // terminated the <img> tag early, and dumped the remaining base64 into the
  // document as visible text across the orange header band. Resend's preview
  // renders the pre-transport HTML, so it looked perfect there and broken in
  // the inbox — see Margaux Dunon's ticket, 2026-08-02.
  //
  // Gmail also refuses data: URIs in img src outright, and clips any message
  // body over ~102 KB. A plain HTTPS URL avoids all three problems.
  const logoSrc  = LOGO_URL
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
          <!-- QR code — a cid: reference to an inline attachment, not a data:
               URI. Gmail strips data: URIs in img src, so the QR (the one part
               of this mail that actually gets someone through the gate) simply
               did not render for Gmail recipients.
               Centred by align="center" on a wrapper table, not margin:0 auto:
               mail clients widely ignore auto margins on a block-level image,
               which left-aligned the code inside the card. The white plate sits
               on the wrapper cell so it hugs the QR, and line-height:0 kills the
               descender gap under the image. -->
          <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px;">
            <tr>
              <td align="center" style="background:#ffffff;border-radius:6px;padding:12px;line-height:0;font-size:0;">
                <img src="cid:${t.qrCid}" width="210" height="210" alt="QR code" style="display:block;border:0;" />
              </td>
            </tr>
          </table>
          <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.2em;color:#f07a3c;text-transform:uppercase;">Toon aan de ingang</p>
        </td>
      </tr>

      <!-- Event details row -->
      <tr>
        <td style="background:#1a0820;padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              // The name on THIS ticket. On a group order every ticket can carry
              // a different guest; falling back to the buyer keeps every ticket
              // sold before group tickets existed rendering exactly as it did.
              ['Naam',      t.attendee_name || order.buyer_name],
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
      Hey <strong>${greetingName.split(' ')[0]}</strong>!
    </p>
    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:13px;color:rgba(244,231,208,0.6);line-height:1.65;">
      ${isGuestCopy
        ? `<strong>${order.buyer_name}</strong> heeft een ticket voor je geregeld voor de Openluchtfuif.
           Hieronder vind je je persoonlijke ticket${tickets.length > 1 ? 's' : ''} &mdash; je hoeft dus niet
           samen met de groep binnen te komen.`
        : `Je bestelling is bevestigd. Hieronder vind je je ticket${tickets.length > 1 ? 's' : ''} voor de Openluchtfuif.`}
      Toon de QR-code aan de ingang &mdash; je smartphonescherm volstaat.
    </p>
  </td></tr>

  <!-- Ticket cards -->
  <!-- Carries the 28px bottom padding that the practical-info block used to
       provide; without it the last ticket card butts straight into the footer. -->
  <tr><td style="background:#1e0b28;padding:0 28px 28px;border-left:1px solid #3d1a50;border-right:1px solid #3d1a50;">
    ${ticketCards}
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
async function processEmailJob(job: {
  id: string; order_id: string; attempts: number; recipient_email?: string | null
}) {
  await db.from('email_log').update({
    attempts:        job.attempts + 1,
    last_attempt_at: new Date().toISOString(),
  }).eq('id', job.id)

  try {
    const { data: order, error: oErr } = await db
      .from('orders')
      .select('id, buyer_name, buyer_email, status, ticket_tiers(name), tickets(ticket_number, scan_token, status, attendee_name, attendee_email)')
      .eq('id', job.order_id)
      .single()

    if (oErr || !order) throw new Error(`Order not found: ${job.order_id}`)
    if (order.status !== 'paid') throw new Error(`Order not paid: ${order.status}`)

    const allValid = (order.tickets as any[]).filter((t: any) => t.status !== 'cancelled')
    if (!allValid.length) throw new Error('No valid tickets on order')

    // A guest copy carries only the tickets addressed to that guest; the buyer's
    // copy (recipient_email NULL) carries every ticket on the order, which is
    // exactly what a single-ticket sale has always done.
    const guestAddress = job.recipient_email?.trim().toLowerCase() || null
    const validTickets = guestAddress
      ? allValid.filter((t: any) => (t.attendee_email ?? '').toLowerCase() === guestAddress)
      : allValid

    if (!validTickets.length) {
      // The guest's ticket was cancelled, or the address was edited after the
      // queue row was written. Failing loudly beats mailing them an empty ticket.
      throw new Error(`No tickets for recipient ${guestAddress} on order ${job.order_id}`)
    }

    const toAddress   = guestAddress ?? order.buyer_email
    const greetingName = guestAddress
      ? (validTickets.find((t: any) => t.attendee_name)?.attendee_name ?? guestAddress.split('@')[0])
      : order.buyer_name

    // Generate QR codes for the email. Kept as raw base64 (the data: prefix
    // stripped) because each one is sent as an inline attachment referenced by
    // Content-ID, not embedded in the HTML.
    const ticketsWithQR = await Promise.all(validTickets.map(async (t: any) => {
      const dataUrl = await QRCode.toDataURL(t.scan_token, {
        errorCorrectionLevel: 'H', width: 240, margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
      return {
        ...t,
        // Ticket numbers are unique, so this is unique within the message —
        // which is all a Content-ID has to be.
        qrCid:    `qr-${t.ticket_number}`,
        qrBase64: dataUrl.split(',')[1],
      }
    }))

    // Generate PDF (chunked base64 to avoid call-stack overflow on large files)
    const pdfBytes  = await generateTicketPdf(order as any, validTickets)
    let pdfBinary   = ''
    const chunk     = 0x8000
    for (let i = 0; i < pdfBytes.length; i += chunk) {
      pdfBinary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk))
    }
    const pdfBase64 = btoa(pdfBinary)

    // Build email HTML
    const html       = buildEmailHtml(order as any, ticketsWithQR, greetingName, !!guestAddress)
    const subject    = validTickets.length > 1
      ? `Je ${validTickets.length} tickets voor Openluchtfuif 2026 🎉`
      : `Je ticket voor Openluchtfuif 2026 🎉`

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:    `Bearer ${RESEND_KEY}`,
        'Content-Type':   'application/json',
        // Keyed on the QUEUE ROW, not the order. A group order produces one row
        // for the buyer plus one per guest, all at attempts = 0 — keyed on
        // order_id they would share an idempotency key, and Resend would replay
        // the first response for the other ten instead of sending them.
        // Force resends use a timestamp so they're never blocked by Resend's 24h cache
        'Idempotency-Key': (job as any).force
          ? `ticket-${job.id}-force-${Date.now()}`
          : `ticket-${job.id}-${job.attempts + 1}`,
      },
      body: JSON.stringify({
        from:    `Openluchtfuif 2026 <${FROM_EMAIL}>`,
        to:      toAddress,
        subject,
        html,
        attachments: [
          {
            filename: `tickets-openluchtfuif-2026.pdf`,
            content:  pdfBase64,
          },
          // One inline image per ticket. content_id is what makes the
          // cid: reference in the HTML resolve; without it these would show up
          // as ordinary downloadable attachments instead of rendering in place.
          ...ticketsWithQR.map((t: any) => ({
            filename:     `${t.ticket_number}.png`,
            content:      t.qrBase64,
            content_type: 'image/png',
            content_id:   t.qrCid,
          })),
        ],
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

    let jobs: Array<{ id: string; order_id: string; attempts: number; recipient_email?: string | null }>

    if (forceOrderId) {
      // Every row for this order, not just the newest one. A group order with a
      // split guest list has one row for the buyer and one per guest; a limit(1)
      // resend would mail the buyer and silently drop the ten guests.
      const { data } = await db.from('email_log')
        .select('id, order_id, attempts, recipient_email')
        .eq('order_id', forceOrderId)
        .in('status', force ? ['pending', 'sent', 'failed'] : ['pending'])
        .order('created_at', { ascending: true })
      jobs = data ?? []

      // Whether this order has EVER been queued, independent of the status
      // filter above. The self-heal below must key off this, not off `jobs`.
      //
      // `jobs` being empty does not mean "never queued": on a Mollie webhook
      // retry confirm_payment returns already_processed without inserting a new
      // row, the webhook still calls us with {order_id} and no force, and the
      // existing row is 'sent' so it fails the 'pending' filter. Creating a row
      // in that case would re-send the buyer's tickets on every retry.
      const { count: everQueued } = await db
        .from('email_log')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', forceOrderId)

      // Never queued at all — create the row instead of silently doing nothing.
      //
      // issue_comp_tickets() only inserts an email_log row when p_send_email is
      // true, so every comp batch issued with the "verstuur e-mail" box
      // unchecked has tickets but no queue row. The dashboard's Mail button
      // sends {order_id, force:true} and this branch used to find nothing,
      // return {processed: 0} with HTTP 200, and let the UI report "✓
      // Verzonden" for a mail that was never sent. 21 sponsor batches sat
      // unsent that way.
      //
      // Only for an explicitly requested order: the cron path (no order_id)
      // must keep draining the existing queue and never invent work.
      // `everQueued === 0`, not `!everQueued`: a failed count returns null, and
      // treating that as "never queued" would re-send a buyer's tickets. Only
      // create when we positively know the order has no queue row.
      if (!jobs.length && everQueued === 0) {
        const { data: order } = await db
          .from('orders')
          .select('id, status, tickets(id)')
          .eq('id', forceOrderId)
          .single()

        if (!order) {
          return new Response(JSON.stringify({ processed: 0, error: 'order_not_found' }), {
            status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
        if (order.status !== 'paid') {
          return new Response(JSON.stringify({ processed: 0, error: 'order_not_paid', status: order.status }), {
            status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
        if (!(order.tickets as any[])?.length) {
          return new Response(JSON.stringify({ processed: 0, error: 'no_tickets' }), {
            status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }

        // Buyer copy only. The self-heal exists for comp batches issued with
        // "verstuur e-mail" unchecked, which never have a guest list; a group
        // sale gets its per-guest rows from confirm_payment().
        const { data: created, error: insErr } = await db
          .from('email_log')
          .insert({ order_id: forceOrderId, type: 'ticket_confirmation', status: 'pending' })
          .select('id, order_id, attempts, recipient_email')
          .single()

        if (insErr || !created) {
          console.error('Could not enqueue email for order', forceOrderId, JSON.stringify(insErr))
          return new Response(JSON.stringify({ processed: 0, error: 'enqueue_failed' }), {
            status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
        jobs = [created]
      } else if (force) {
        await db.from('email_log')
          .update({ status: 'pending' })
          .in('id', jobs.map(j => j.id))
        // Mark as force so processEmailJob uses a timestamp idempotency key
        jobs = jobs.map(j => ({ ...j, force: true } as any))
      }
    } else {
      const { data } = await db.from('email_log')
        .select('id, order_id, attempts, recipient_email')
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
