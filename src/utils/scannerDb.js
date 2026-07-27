// IndexedDB utility for the scanner PWA
// Caches valid ticket tokens for offline scanning
// Queues failed scan syncs when offline

const DB_NAME    = 'olf-scanner'
const DB_VERSION = 1
const TOKENS_STORE = 'tokens'
const QUEUE_STORE  = 'scan_queue'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(TOKENS_STORE)) {
        db.createObjectStore(TOKENS_STORE, { keyPath: 'scan_token' })
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('queued_at', 'queued_at')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ── Token cache ──────────────────────────────────────────────

/** Store a batch of valid ticket tokens for offline validation */
export async function cacheTokens(tokens) {
  const db    = await openDb()
  const tx    = db.transaction(TOKENS_STORE, 'readwrite')
  const store = tx.objectStore(TOKENS_STORE)
  for (const t of tokens) store.put(t)
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej })
}

/** Look up a token in the offline cache. Returns ticket info or null. */
export async function lookupToken(scanToken) {
  const db     = await openDb()
  const tx     = db.transaction(TOKENS_STORE, 'readonly')
  const store  = tx.objectStore(TOKENS_STORE)
  return new Promise((resolve) => {
    const req      = store.get(scanToken)
    req.onsuccess  = () => resolve(req.result ?? null)
    req.onerror    = () => resolve(null)
  })
}

/**
 * Mark a token as scanned in the local cache.
 *
 * Upserts rather than only updating: a ticket issued after this device's last
 * cache refresh (a freshly generated comp ticket, say) isn't in the store yet,
 * and the old `if (existing)` guard made this a silent no-op for exactly those
 * tickets. They then stayed uncached forever, so a second scan looked like an
 * unknown token instead of a duplicate.
 *
 * `info` carries whatever the server told us, so the cached row can still show
 * a name and tier on the repeat scan.
 */
export async function markScannedLocally(scanToken, info = {}) {
  // Read and write in SEPARATE transactions. Awaiting a promise between get()
  // and put() on one transaction lets IndexedDB auto-commit it first, so the
  // put lands on a closed transaction and is silently dropped — which made this
  // function nondeterministic.
  const existing = await lookupToken(scanToken)

  const record = {
    ...(existing ?? { scan_token: scanToken, buyer_name: '', tier_name: '', ticket_number: '' }),
    ...info,
    scan_token: scanToken,
    status: 'scanned',
    scanned_at: new Date().toISOString(),
  }

  const db    = await openDb()
  const tx    = db.transaction(TOKENS_STORE, 'readwrite')
  tx.objectStore(TOKENS_STORE).put(record)
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej })
}

/** Get total number of cached tokens */
export async function getCachedCount() {
  const db    = await openDb()
  const tx    = db.transaction(TOKENS_STORE, 'readonly')
  const store = tx.objectStore(TOKENS_STORE)
  return new Promise((resolve) => {
    const req = store.count(); req.onsuccess = () => resolve(req.result)
  })
}

/** Clear all cached tokens */
export async function clearTokenCache() {
  const db    = await openDb()
  const tx    = db.transaction(TOKENS_STORE, 'readwrite')
  const store = tx.objectStore(TOKENS_STORE)
  store.clear()
}

// ── Offline scan queue ───────────────────────────────────────

/** Queue a scan for later sync (used when offline) */
export async function queueScan(scanData) {
  const db    = await openDb()
  const tx    = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)
  store.add({ ...scanData, queued_at: new Date().toISOString() })
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej })
}

/** Get all queued scans */
export async function getQueuedScans() {
  const db    = await openDb()
  const tx    = db.transaction(QUEUE_STORE, 'readonly')
  const store = tx.objectStore(QUEUE_STORE)
  return new Promise((resolve) => {
    const req = store.getAll(); req.onsuccess = () => resolve(req.result)
  })
}

/** Remove a queued scan by id after successful sync */
export async function removeQueuedScan(id) {
  const db    = await openDb()
  const tx    = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)
  store.delete(id)
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej })
}
