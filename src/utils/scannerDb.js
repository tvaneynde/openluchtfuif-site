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

/** Mark a token as scanned in the local cache */
export async function markScannedLocally(scanToken) {
  const db     = await openDb()
  const tx     = db.transaction(TOKENS_STORE, 'readwrite')
  const store  = tx.objectStore(TOKENS_STORE)
  const existing = await new Promise(r => {
    const req = store.get(scanToken); req.onsuccess = () => r(req.result)
  })
  if (existing) {
    store.put({ ...existing, status: 'scanned', scanned_at: new Date().toISOString() })
  }
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
