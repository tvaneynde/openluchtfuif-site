import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateTicketPdf } from '../_shared/generatePdf.ts'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url     = new URL(req.url)
  const orderId = url.searchParams.get('order_id')

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'order_id required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Fetch order + tickets
  const { data: order, error } = await db
    .from('orders')
    .select('buyer_name, buyer_email, status, ticket_tiers(name), tickets(ticket_number, scan_token, status)')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    return new Response(JSON.stringify({ error: 'Order not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (order.status !== 'paid') {
    return new Response(JSON.stringify({ error: 'Order not paid' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const validTickets = (order.tickets as any[]).filter(t => t.status !== 'cancelled')

  try {
    const pdfBytes = await generateTicketPdf(order as any, validTickets)

    const filename = `tickets-openluchtfuif-2026-${orderId.slice(0, 8)}.pdf`

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
