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

// ── PIN cache (5-minute TTL) — eliminates a DB round-trip on every scan ────────
let pinCache: { value: string; expiresAt: number } | null = null

async function getStoredPin(): Promise<string> {
  if (pinCache && Date.now() < pinCache.expiresAt) return pinCache.value
  const { data } = await db.from('config').select('value').eq('key', 'scanner_pin').single()
  const pin = data?.value?.toString().replace(/"/g, '') ?? ''
  pinCache = { value: pin, expiresAt: Date.now() + 5 * 60 * 1000 }
  return pin
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const scannerKey = req.headers.get('X-Scanner-Key')
    if (!scannerKey) return json({ error: 'Scanner key required' }, 401)

    const storedPin = await getStoredPin()
    if (scannerKey !== storedPin) {
      // Invalidate cache and retry once (PIN may have just changed)
      pinCache = null
      const freshPin = await getStoredPin()
      if (scannerKey !== freshPin) {
        return json({ error: 'Invalid scanner key' }, 401)
      }
    }

    const body = await req.json()
    const { token, scanner_id, device_info } = body

    if (!token)      return json({ error: 'token required' }, 400)
    if (!scanner_id) return json({ error: 'scanner_id required' }, 400)

    const { data, error } = await db.rpc('validate_scan', {
      p_scan_token:  token,
      p_scanner_id:  scanner_id,
      p_device_info: device_info ?? {},
    })

    if (error) {
      console.error('validate_scan error:', error)
      return json({ error: 'Scan validation failed' }, 500)
    }

    return json(data)

  } catch (err) {
    console.error('Scan error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
