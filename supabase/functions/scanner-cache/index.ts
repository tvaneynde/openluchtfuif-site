import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, apikey, X-Scanner-Key',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ── PIN cache (5-minute TTL), same pattern as the scan function ──────────────
let pinCache: { value: string; expiresAt: number } | null = null

async function getStoredPin(): Promise<string> {
  if (pinCache && Date.now() < pinCache.expiresAt) return pinCache.value
  const { data } = await db.from('config').select('value').eq('key', 'scanner_pin').single()
  const pin = data?.value?.toString().replace(/"/g, '') ?? ''
  pinCache = { value: pin, expiresAt: Date.now() + 5 * 60 * 1000 }
  return pin
}

// Doubles as the scanner login check: a correct X-Scanner-Key IS a successful login.
// Returns the full valid-ticket cache (for offline scanning) + live gate stats.
// This is the only place scan_token may leave the server — never expose it via
// direct table access, which is what let anyone dump every ticket's QR secret.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const scannerKey = req.headers.get('X-Scanner-Key')
    if (!scannerKey) return json({ error: 'Scanner key required' }, 401)

    const storedPin = await getStoredPin()
    if (scannerKey !== storedPin) {
      pinCache = null
      const freshPin = await getStoredPin()
      if (scannerKey !== freshPin) {
        return json({ error: 'Invalid scanner key' }, 401)
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const [{ data: tickets }, { count: scannedToday }, { count: stillValid }] = await Promise.all([
      db
        .from('tickets')
        .select('scan_token, ticket_number, status, orders(buyer_name), ticket_tiers(name)')
        .eq('status', 'valid'),
      db
        .from('scan_events')
        .select('id', { count: 'exact', head: true })
        .eq('result', 'valid')
        .gte('scanned_at', todayStr),
      db
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'valid'),
    ])

    return json({
      ok: true,
      tickets: (tickets ?? []).map(t => ({
        scan_token:    t.scan_token,
        ticket_number: t.ticket_number,
        status:        'valid',
        buyer_name:    t.orders?.buyer_name ?? '',
        tier_name:     t.ticket_tiers?.name ?? '',
      })),
      stats: {
        scannedToday: scannedToday || 0,
        totalIssued:  (scannedToday || 0) + (stillValid || 0),
      },
    })
  } catch (err) {
    console.error('scanner-cache error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
