#!/usr/bin/env node
// Run in test mode only - uses Mollie test API

const SUPABASE_URL = 'https://noihnuouftyvsvzybwer.supabase.co';
const ENDPOINT = `${SUPABASE_URL}/functions/v1/create-payment`;
const ANON_KEY = 'sb_publishable_j22VhYpjKL875VUoGpFTLw_xu5PjKTS';

const TIER_ID = process.env.TIER_ID || process.argv[2];

if (!TIER_ID) {
  console.error('Usage: TIER_ID=xxx node tests/load-test-checkout.js');
  process.exit(1);
}

const CONCURRENCY = 50;

async function attemptCheckout(i) {
  const start = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({
        tier_id: TIER_ID,
        quantity: 1,
        buyer_name: `Load Test User ${i}`,
        buyer_email: `test-${i}@loadtest.invalid`,
      }),
    });

    const body = await res.json().catch(() => ({}));
    const elapsed = Date.now() - start;

    return { index: i, status: res.status, body, elapsed, ok: res.ok };
  } catch (err) {
    return { index: i, status: null, error: err.message, elapsed: Date.now() - start, ok: false };
  }
}

async function main() {
  console.log(`Starting load test: ${CONCURRENCY} concurrent checkout attempts`);
  console.log(`Tier ID: ${TIER_ID}`);
  console.log(`Endpoint: ${ENDPOINT}\n`);

  const tasks = Array.from({ length: CONCURRENCY }, (_, i) => attemptCheckout(i));
  const results = await Promise.allSettled(tasks);

  let initiated = 0;
  let errors = 0;
  const errorDetails = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const r = result.value;
      if (r.ok && r.body?.checkoutUrl) {
        initiated++;
      } else {
        errors++;
        errorDetails.push({ index: r.index, status: r.status, message: r.body?.error || r.error || JSON.stringify(r.body) });
      }
    } else {
      errors++;
      errorDetails.push({ error: result.reason?.message });
    }
  }

  console.log('=== RESULTS ===');
  console.log(`${initiated}/${CONCURRENCY} payments initiated, ${errors} errors`);

  if (errorDetails.length > 0) {
    console.log('\nError breakdown:');
    const grouped = {};
    for (const e of errorDetails) {
      const key = e.message || 'unknown';
      grouped[key] = (grouped[key] || 0) + 1;
    }
    for (const [msg, count] of Object.entries(grouped)) {
      console.log(`  ${count}x — ${msg}`);
    }
  }

  // Oversell check: if initiated > capacity, flag it
  // (actual capacity enforcement is server-side; this just reports)
  console.log('\nNote: Verify initiated count does not exceed tier capacity in Supabase.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
