#!/usr/bin/env node

const SUPABASE_URL = 'https://noihnuouftyvsvzybwer.supabase.co';
const ENDPOINT = `${SUPABASE_URL}/functions/v1/scan`;
const ANON_KEY = 'sb_publishable_j22VhYpjKL875VUoGpFTLw_xu5PjKTS';

const SCANNER_PIN = process.env.SCANNER_PIN || process.argv[2];
const SCAN_TOKEN = process.env.SCAN_TOKEN || process.argv[3];

if (!SCANNER_PIN || !SCAN_TOKEN) {
  console.error('Usage: SCANNER_PIN=1234 SCAN_TOKEN=xxx node tests/load-test-scanner.js');
  process.exit(1);
}

const TOTAL_REQUESTS = 200;
const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 3000; // 10 per 3s = 200/min

async function scanRequest(token, index) {
  const start = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'X-Scanner-Key': SCANNER_PIN,
      },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({}));
    const elapsed = Date.now() - start;
    return { index, status: res.status, result: body?.result, elapsed, ok: res.ok };
  } catch (err) {
    return { index, status: null, result: null, elapsed: Date.now() - start, error: err.message, ok: false };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Starting scanner load test: ${TOTAL_REQUESTS} requests at 200/min`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Scanner PIN: ${SCANNER_PIN}`);
  console.log(`Token: ${SCAN_TOKEN}\n`);

  const allResults = [];
  let batchNum = 0;

  for (let sent = 0; sent < TOTAL_REQUESTS; sent += BATCH_SIZE) {
    const batchStart = Date.now();
    const batchSize = Math.min(BATCH_SIZE, TOTAL_REQUESTS - sent);
    const batch = [];

    for (let j = 0; j < batchSize; j++) {
      const index = sent + j;
      // First request uses real token; all subsequent use the same token to test idempotency
      batch.push(scanRequest(SCAN_TOKEN, index));
    }

    const batchResults = await Promise.all(batch);
    allResults.push(...batchResults);

    batchNum++;
    const elapsed = Date.now() - batchStart;
    process.stdout.write(`Batch ${batchNum}: ${batchSize} requests in ${elapsed}ms\r`);

    // Wait for next batch unless this is the last one
    if (sent + BATCH_SIZE < TOTAL_REQUESTS) {
      const remaining = BATCH_INTERVAL_MS - elapsed;
      if (remaining > 0) await sleep(remaining);
    }
  }

  console.log('\n\n=== RESULTS ===');

  const responseTimes = allResults.map(r => r.elapsed);
  const minTime = Math.min(...responseTimes);
  const maxTime = Math.max(...responseTimes);
  const avgTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);

  const validCount = allResults.filter(r => r.result === 'valid').length;
  const alreadyScannedCount = allResults.filter(r => r.result === 'already_scanned').length;
  const invalidCount = allResults.filter(r => r.result === 'invalid').length;
  const errorCount = allResults.filter(r => r.error).length;
  const otherCount = allResults.length - validCount - alreadyScannedCount - invalidCount - errorCount;

  console.log(`Total requests: ${allResults.length}`);
  console.log(`Results breakdown:`);
  console.log(`  valid:          ${validCount}`);
  console.log(`  already_scanned: ${alreadyScannedCount}`);
  console.log(`  invalid:        ${invalidCount}`);
  console.log(`  network errors: ${errorCount}`);
  if (otherCount > 0) console.log(`  other:          ${otherCount}`);

  console.log(`\nTiming:`);
  console.log(`  min: ${minTime}ms`);
  console.log(`  max: ${maxTime}ms`);
  console.log(`  avg: ${avgTime}ms`);

  console.log('\n=== RACE CONDITION CHECK ===');
  if (validCount === 1) {
    console.log('[PASS] Exactly 1 "valid" response — no duplicate admits (race condition safe)');
  } else if (validCount === 0) {
    console.log('[WARN] 0 "valid" responses — token may already be scanned or invalid before test');
  } else {
    console.log(`[FAIL] ${validCount} "valid" responses — RACE CONDITION DETECTED, token admitted ${validCount} times`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
