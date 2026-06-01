import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { supabase } from '../utils/supabase'
import {
  lookupToken,
  markScannedLocally,
  queueScan,
  getQueuedScans,
  removeQueuedScan,
  getCachedCount,
  cacheTokens,
} from '../utils/scannerDb'

// ── helpers ──────────────────────────────────────────────────────────────────

function getOrCreateDeviceId() {
  let id = localStorage.getItem('scanner_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('scanner_device_id', id)
  }
  return id
}

function loadSession() {
  try {
    const raw = localStorage.getItem('scanner_session')
    if (!raw) return null
    const s = JSON.parse(raw)
    if (s.expiresAt > Date.now()) return s
    localStorage.removeItem('scanner_session')
    return null
  } catch {
    return null
  }
}

function saveSession(pin) {
  const deviceId = getOrCreateDeviceId()
  const session = { pin, deviceId, expiresAt: Date.now() + 43200000 }
  localStorage.setItem('scanner_session', JSON.stringify(session))
  return session
}

function clearSession() {
  localStorage.removeItem('scanner_session')
}

function playBeep(type) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = type === 'valid' ? 880 : type === 'already_scanned' ? 440 : 220
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // audio not available
  }
}

function vibrate(type) {
  if (!navigator.vibrate) return
  if (type === 'valid')                navigator.vibrate(100)
  else if (type === 'already_scanned') navigator.vibrate([100, 50, 100])
  else                                 navigator.vibrate([200, 100, 200])
}

function formatTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
}

// ── styles ───────────────────────────────────────────────────────────────────

const S = {
  // Pin gate
  pinScreen: {
    position: 'fixed',
    inset: 0,
    background: '#1a0820',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2rem',
    fontFamily: 'var(--body)',
    padding: '2rem',
  },
  pinTitle: {
    fontFamily: 'var(--display)',
    fontSize: '2.5rem',
    color: 'var(--orange)',
    letterSpacing: '0.05em',
    margin: 0,
  },
  pinDots: {
    display: 'flex',
    gap: '1rem',
  },
  pinDot: (filled) => ({
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid var(--orange)',
    background: filled ? 'var(--orange)' : 'transparent',
    transition: 'background 0.15s',
  }),
  numpad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
    width: '100%',
    maxWidth: '320px',
  },
  numBtn: {
    minHeight: '72px',
    fontSize: '1.5rem',
    fontFamily: 'var(--mono)',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--cream)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    transition: 'background 0.1s',
  },
  numBtnDelete: {
    minHeight: '72px',
    fontSize: '1.2rem',
    fontFamily: 'var(--mono)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--cream-dim, #ccc)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
  },
  submitBtn: {
    width: '100%',
    maxWidth: '320px',
    minHeight: '56px',
    fontSize: '1.1rem',
    fontFamily: 'var(--body)',
    fontWeight: 700,
    background: 'var(--orange)',
    color: '#1a0820',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  pinError: {
    color: '#ff6b6b',
    fontFamily: 'var(--mono)',
    fontSize: '0.9rem',
    margin: 0,
  },

  // Camera view
  cameraScreen: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  cameraOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'none',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    pointerEvents: 'all',
  },
  badge: {
    fontFamily: 'var(--display)',
    fontSize: '1.1rem',
    color: 'var(--orange)',
    background: 'rgba(26,8,32,0.75)',
    padding: '4px 12px',
    borderRadius: '8px',
    letterSpacing: '0.05em',
  },
  logoutBtn: {
    fontFamily: 'var(--mono)',
    fontSize: '0.8rem',
    color: 'var(--cream)',
    background: 'rgba(26,8,32,0.75)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    padding: '6px 14px',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  reticleWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: '200px',
    height: '200px',
    position: 'relative',
  },
  corner: (isTop, isLeft) => ({
    position: 'absolute',
    width: '28px',
    height: '28px',
    borderColor: '#fff',
    borderStyle: 'solid',
    borderWidth: 0,
    ...(isTop ? { top: 0, borderTopWidth: '3px' } : { bottom: 0, borderBottomWidth: '3px' }),
    ...(isLeft ? { left: 0, borderLeftWidth: '3px' } : { right: 0, borderRightWidth: '3px' }),
  }),
  bottomBar: {
    padding: '0.75rem 1.25rem',
    display: 'flex',
    justifyContent: 'center',
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontFamily: 'var(--mono)',
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(0,0,0,0.55)',
    padding: '6px 14px',
    borderRadius: '20px',
    backdropFilter: 'blur(4px)',
  },
  statsDivider: {
    color: 'rgba(255,255,255,0.3)',
  },
  statsPct: (pct) => ({
    fontWeight: 700,
    color: pct >= 80 ? '#ff4d4d' : pct >= 50 ? '#ffaa00' : '#4dff88',
  }),

  // Search panel
  searchPanel: {
    background: 'rgba(0,0,0,0.82)',
    backdropFilter: 'blur(8px)',
    padding: '0.75rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    pointerEvents: 'all',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    height: '40px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '8px',
    color: '#fff',
    fontFamily: 'var(--mono)',
    fontSize: '0.85rem',
    padding: '0 12px',
    outline: 'none',
  },
  searchSubmitBtn: {
    height: '40px',
    padding: '0 14px',
    background: 'var(--orange)',
    color: '#1a0820',
    border: 'none',
    borderRadius: '8px',
    fontFamily: 'var(--mono)',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    whiteSpace: 'nowrap',
  },
  searchDismissBtn: {
    height: '40px',
    width: '40px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  searchIconBtn: {
    fontFamily: 'var(--mono)',
    fontSize: '1rem',
    color: 'var(--cream)',
    background: 'rgba(26,8,32,0.75)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    marginRight: '0.5rem',
  },

  // Result overlay
  resultOverlay: (color) => ({
    position: 'fixed',
    inset: 0,
    background: color,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    zIndex: 100,
    padding: '2rem',
  }),
  resultIcon: {
    fontSize: '120px',
    lineHeight: 1,
    color: '#fff',
    fontFamily: 'var(--body)',
    fontWeight: 700,
  },
  resultName: {
    fontFamily: 'var(--display)',
    fontSize: '28px',
    color: '#fff',
    textAlign: 'center',
    margin: 0,
  },
  resultMono: {
    fontFamily: 'var(--mono)',
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    margin: 0,
  },
  resultSmall: {
    fontFamily: 'var(--mono)',
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    margin: 0,
  },

  // HTTPS warning
  httpsWarning: {
    position: 'fixed',
    inset: 0,
    background: '#1a0820',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    gap: '1rem',
    fontFamily: 'var(--body)',
  },
  httpsTitle: {
    fontFamily: 'var(--display)',
    fontSize: '2rem',
    color: 'var(--orange)',
    margin: 0,
  },
  httpsText: {
    color: 'var(--cream)',
    textAlign: 'center',
    maxWidth: '320px',
    lineHeight: 1.5,
  },
}

// ── PinGate ───────────────────────────────────────────────────────────────────

function PinGate({ onSuccess }) {
  const [digits, setDigits] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function pressDigit(d) {
    if (digits.length < 4) {
      setDigits(prev => [...prev, d])
      setError('')
    }
  }

  function pressDelete() {
    setDigits(prev => prev.slice(0, -1))
    setError('')
  }

  async function handleSubmit() {
    if (digits.length < 4) return
    setLoading(true)
    setError('')
    const pin = digits.join('')
    try {
      const { data, error: dbError } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'scanner_pin')
        .single()

      if (dbError) throw dbError

      if (data?.value === pin) {
        const session = saveSession(pin)
        onSuccess(session)
      } else {
        setError('Verkeerde pincode')
        setDigits([])
      }
    } catch {
      setError('Fout bij verbinding. Probeer opnieuw.')
      setDigits([])
    } finally {
      setLoading(false)
    }
  }

  const numpadKeys = ['1','2','3','4','5','6','7','8','9']

  return (
    <div style={S.pinScreen}>
      <h1 style={S.pinTitle}>OLF Scanner</h1>

      <div style={S.pinDots}>
        {[0,1,2,3].map(i => (
          <div key={i} style={S.pinDot(i < digits.length)} />
        ))}
      </div>

      <div style={S.numpad}>
        {numpadKeys.map(n => (
          <button
            key={n}
            style={S.numBtn}
            onPointerDown={() => pressDigit(n)}
          >
            {n}
          </button>
        ))}
        {/* row 4: delete | 0 | submit placeholder */}
        <button style={S.numBtnDelete} onPointerDown={pressDelete}>⌫</button>
        <button style={S.numBtn} onPointerDown={() => pressDigit('0')}>0</button>
        <div /> {/* spacer */}
      </div>

      {digits.length === 4 && (
        <button
          style={S.submitBtn}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Even wachten…' : 'Inloggen'}
        </button>
      )}

      {error && <p style={S.pinError}>{error}</p>}
    </div>
  )
}

// ── ResultOverlay ─────────────────────────────────────────────────────────────

function ResultOverlay({ result }) {
  if (result.type === 'valid') {
    return (
      <div style={S.resultOverlay('rgba(0,180,80,0.95)')}>
        <div style={S.resultIcon}>✓</div>
        <p style={S.resultName}>{result.name || 'Geldig ticket'}</p>
        {result.tier && <p style={S.resultMono}>{result.tier}</p>}
        {result.ticketNumber && <p style={S.resultSmall}>#{result.ticketNumber}</p>}
      </div>
    )
  }

  if (result.type === 'already_scanned') {
    return (
      <div style={S.resultOverlay('rgba(240,120,0,0.95)')}>
        <div style={S.resultIcon}>!</div>
        <p style={S.resultName}>Al gescand</p>
        {result.scannedAt && <p style={S.resultMono}>{formatTime(result.scannedAt)}</p>}
        {result.scannedBy && <p style={S.resultSmall}>Scanner: {result.scannedBy}</p>}
      </div>
    )
  }

  // invalid / cancelled / unknown
  return (
    <div style={S.resultOverlay('rgba(200,30,30,0.95)')}>
      <div style={S.resultIcon}>✗</div>
      <p style={S.resultName}>Ongeldig ticket</p>
    </div>
  )
}

// ── CameraView ────────────────────────────────────────────────────────────────

function CameraView({ session, onLogout }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)
  const lastTokenRef = useRef({ token: '', ts: 0 })

  const [scanResult, setScanResult] = useState(null) // null | result object
  const [cachedCount, setCachedCount] = useState(0)
  const [cameraError, setCameraError] = useState('')

  // Gate stats
  const [scannedToday, setScannedToday] = useState(null)
  const [totalIssued, setTotalIssued] = useState(null)

  // Search mode
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  // Fetch gate stats
  const refreshStats = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const [{ count: scanned }, { count: stillValid }] = await Promise.all([
        supabase
          .from('scan_events')
          .select('id', { count: 'exact', head: true })
          .eq('result', 'valid')
          .gte('scanned_at', todayStr),
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'valid'),
      ])
      const scannedN = scanned || 0
      const validN = stillValid || 0
      setScannedToday(scannedN)
      setTotalIssued(scannedN + validN)
    } catch {
      // ignore — stats are non-critical
    }
  }, [])

  // Load token cache on mount (includes buyer_name + tier for offline display)
  useEffect(() => {
    async function loadCache() {
      try {
        const { data } = await supabase
          .from('tickets')
          .select('scan_token, ticket_number, status, orders(buyer_name), ticket_tiers(name)')
          .eq('status', 'valid')
        if (data) {
          await cacheTokens(
            data.map(t => ({
              scan_token:    t.scan_token,
              ticket_number: t.ticket_number,
              status:        'valid',
              buyer_name:    t.orders?.buyer_name ?? '',
              tier_name:     t.ticket_tiers?.name ?? '',
            }))
          )
        }
      } catch {
        // offline is fine — we still have IndexedDB
      }
      const count = await getCachedCount()
      setCachedCount(count)
    }
    loadCache()
    refreshStats()
  }, [refreshStats])

  // Subscribe to scan_events INSERT for live scannedToday counter
  useEffect(() => {
    const channel = supabase
      .channel('scan_events_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scan_events', filter: 'result=eq.valid' },
        () => {
          setScannedToday(prev => (prev !== null ? prev + 1 : prev))
          setTotalIssued(prev => (prev !== null ? prev + 1 : prev))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Flush offline queue on reconnect
  useEffect(() => {
    async function flushQueue() {
      if (!navigator.onLine) return
      const queued = await getQueuedScans()
      for (const item of queued) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                'X-Scanner-Key': session.pin,
              },
              body: JSON.stringify({ token: item.token, scanner_id: session.deviceId }),
            }
          )
          if (res.ok) await removeQueuedScan(item.id)
        } catch {
          // still offline
        }
      }
    }

    window.addEventListener('online', flushQueue)
    flushQueue()
    return () => window.removeEventListener('online', flushQueue)
  }, [session])

  // Background server sync — called after showing result, never blocks UI
  const syncWithServer = useCallback(async (token) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'X-Scanner-Key': session.pin,
          },
          body: JSON.stringify({ token, scanner_id: session.deviceId }),
        }
      )
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [session])

  const showResult = useCallback((result) => {
    playBeep(result.type)
    vibrate(result.type)
    setScanResult(result)
    setTimeout(() => setScanResult(null), 1500)
  }, [])

  // Offline-first scan: show from cache immediately (~5ms), sync server in background
  const handleScan = useCallback(async (token) => {
    const cached = await lookupToken(token)

    if (cached) {
      if (cached.status === 'scanned') {
        // Already scanned locally — instant response, no server needed
        showResult({ type: 'already_scanned', scannedAt: cached.scanned_at, scannedBy: 'lokaal' })
      } else {
        // Valid in local cache — show green immediately
        showResult({
          type: 'valid',
          name: cached.buyer_name,
          tier: cached.tier_name,
          ticketNumber: cached.ticket_number,
        })
        await markScannedLocally(token)
        setCachedCount(await getCachedCount())
        refreshStats()

        // Background sync — if another scanner already scanned it, update overlay
        if (navigator.onLine) {
          syncWithServer(token).then(serverResult => {
            if (serverResult?.result === 'already_scanned') {
              // Race condition: another scanner got there first
              showResult({
                type: 'already_scanned',
                scannedAt: serverResult.scanned_at,
                scannedBy: serverResult.scanned_by,
              })
            }
          }).catch(() => {
            queueScan({ token, scanner_id: session.deviceId, queued_at: new Date().toISOString() })
          })
        } else {
          queueScan({ token, scanner_id: session.deviceId, queued_at: new Date().toISOString() })
        }
      }
    } else {
      // Token not in local cache — show invalid immediately
      showResult({ type: 'invalid' })

      // Background server check (handles stale cache edge case)
      if (navigator.onLine) {
        syncWithServer(token).then(serverResult => {
          if (serverResult?.result === 'valid') {
            // Cache was stale — ticket is actually valid
            markScannedLocally(token)
            refreshStats()
            showResult({
              type: 'valid',
              name: serverResult.buyer_name,
              tier: serverResult.tier_name,
              ticketNumber: serverResult.ticket_number,
            })
          }
        }).catch(() => {})
      }
    }
  }, [session, syncWithServer, showResult, refreshStats])

  async function handleManualSearch() {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    await handleScan(searchQuery.trim())
    setSearchLoading(false)
    setSearchQuery('')
  }

  // Start camera + QR reader
  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        // Hint 2 = POSSIBLE_FORMATS (QR only), Hint 3 = TRY_HARDER
        const hints = new Map()
        hints.set(2, [11]) // only decode QR codes, skip other formats
        hints.set(3, true) // try harder on difficult codes
        const reader = new BrowserQRCodeReader(hints, { delayBetweenScanAttempts: 100 })
        readerRef.current = reader

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: 'environment',
              width:     { ideal: 1280 },
              height:    { ideal: 720 },
              frameRate: { ideal: 30, min: 15 },
            },
          },
          videoRef.current,
          (result) => {
            if (cancelled) return
            if (!result) return
            const token = result.getText()
            const now = Date.now()
            // Deduplicate within 2 seconds
            if (
              token === lastTokenRef.current.token &&
              now - lastTokenRef.current.ts < 2000
            ) return
            lastTokenRef.current = { token, ts: now }
            handleScan(token)
          }
        )
        controlsRef.current = controls
      } catch {
        if (!cancelled) {
          setCameraError('Camera niet beschikbaar. Controleer permissies.')
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [handleScan])

  const pct = totalIssued ? Math.round((scannedToday / totalIssued) * 100) : 0

  return (
    <div style={S.cameraScreen}>
      <video
        ref={videoRef}
        style={S.video}
        autoPlay
        muted
        playsInline
      />

      <div style={S.cameraOverlay}>
        <div style={S.topBar}>
          <span style={S.badge}>OLF Scanner</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              style={S.searchIconBtn}
              onClick={() => setSearchMode(m => !m)}
              title="Manueel zoeken"
            >
              🔍
            </button>
            <button style={S.logoutBtn} onClick={onLogout}>Uitloggen</button>
          </div>
        </div>

        {searchMode && (
          <div style={S.searchPanel}>
            <input
              style={S.searchInput}
              type="text"
              placeholder="Ticketnummer of scan token..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
              autoFocus
            />
            <button
              style={S.searchSubmitBtn}
              onClick={handleManualSearch}
              disabled={searchLoading}
            >
              {searchLoading ? '…' : 'Scan'}
            </button>
            <button
              style={S.searchDismissBtn}
              onClick={() => { setSearchMode(false); setSearchQuery('') }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={S.reticleWrapper}>
          {cameraError ? (
            <div style={{
              background: 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '1rem',
              borderRadius: '8px',
              fontFamily: 'var(--mono)',
              fontSize: '0.85rem',
              maxWidth: '260px',
              textAlign: 'center',
            }}>
              {cameraError}
            </div>
          ) : (
            <div style={S.reticle}>
              {/* Top-left */}
              <div style={S.corner(true, true)} />
              {/* Top-right */}
              <div style={S.corner(true, false)} />
              {/* Bottom-left */}
              <div style={S.corner(false, true)} />
              {/* Bottom-right */}
              <div style={S.corner(false, false)} />
            </div>
          )}
        </div>

        <div style={S.bottomBar}>
          <div style={S.statsBar}>
            <span>🎟</span>
            {scannedToday !== null && totalIssued !== null ? (
              <>
                <span>{scannedToday}&nbsp;/&nbsp;{totalIssued}</span>
                <span style={S.statsDivider}>|</span>
                <span style={S.statsPct(pct)}>{pct}%</span>
                <span style={S.statsDivider}>•</span>
              </>
            ) : null}
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>{cachedCount} gecached</span>
          </div>
        </div>
      </div>

      {scanResult && <ResultOverlay result={scanResult} />}
    </div>
  )
}

// ── Scanner (root) ────────────────────────────────────────────────────────────

export default function Scanner() {
  const [session, setSession] = useState(() => loadSession())

  // iOS/Safari HTTPS guard (only warn in production builds)
  const isHttps =
    location.protocol === 'https:' || location.hostname === 'localhost'
  if (!isHttps && import.meta.env.PROD) {
    return (
      <div style={S.httpsWarning}>
        <h1 style={S.httpsTitle}>OLF Scanner</h1>
        <p style={S.httpsText}>
          De scanner vereist HTTPS voor cameratoegang. Open deze pagina via een beveiligde verbinding.
        </p>
      </div>
    )
  }

  function handleLogin(newSession) {
    setSession(newSession)
  }

  function handleLogout() {
    clearSession()
    setSession(null)
  }

  if (!session) {
    return <PinGate onSuccess={handleLogin} />
  }

  return <CameraView session={session} onLogout={handleLogout} />
}
