#!/usr/bin/env node

const SUPABASE_URL = 'https://noihnuouftyvsvzybwer.supabase.co';
const WEBHOOK_ENDPOINT = `${SUPABASE_URL}/functions/v1/mollie-webhook`;
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaWhudW91ZnR5dnN2enlid2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIxNDA4NCwiZXhwIjoyMDk1NzkwMDg0fQ.ooPfTnGJQ3KPG7n54x4mthi4_w8uL3h8pvgCbrh-TFo';

const PAYMENT_ID = process.env.PAYMENT_ID || process.argv[2];
const ORDER_ID = process.env.ORDER_ID || process.argv[3];

if (!PAYMENT_ID || !ORDER_ID) {
  console.error('Usage: PAYMENT_ID=tr_xxx ORDER_ID=xxx node tests/webhook-replay-test.js');
  process.exit(1);
}

const REPLAY_COUNT = 10;
const DELAY_MS = 100;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fireWebhook(i) {
  const start = Date.now();
  try {
    const res = await fetch(WEBHOOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': SERVICE_ROLE_KEY,
      },
      body: new URLSearchParams({ id: PAYMENT_ID }).toString(),
    });
    const elapsed = Date.now() - start;
    const body = await res.text().catch(() => '');
    return { attempt: i + 1, status: res.status, body, elapsed, ok: res.ok };
  } catch (err) {
    return { attempt: i + 1, status: null, error: err.message, elapsed: Date.now() - start, ok: false };
  }
}

async function fetchOrderStatus() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${ORDER_ID}&select=id,status`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch order: ${res.status} ${await res.text()}`);
  }
  const rows = await res.json();
  return rows[0] || null;
}

async function fetchEmailLogCount() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/email_log?order_id=eq.${ORDER_ID}&select=id`,
    {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    // Table might not exist or have a different name — treat as non-fatal
    if (res.status === 404 || text.includes('does not exist')) {
      return null; // unknown — skip this check
    }
    throw new Error(`Failed to fetch email_log: ${res.status} ${text}`);
  }
  const rows = await res.json();
  return rows.length;
}

async function main() {
  console.log(`=== Webhook Idempotency Test ===`);
  console.log(`Payment ID: ${PAYMENT_ID}`);
  console.log(`Order ID:   ${ORDER_ID}`);
  console.log(`Replaying webhook ${REPLAY_COUNT} times with ${DELAY_MS}ms delay between calls\n`);

  const results = [];
  for (let i = 0; i < REPLAY_COUNT; i++) {
    const result = await fireWebhook(i);
    results.push(result);
    process.stdout.write(`  Attempt ${result.attempt}/${REPLAY_COUNT}: status ${result.status ?? 'ERR'} (${result.elapsed}ms)\n`);
    if (i < REPLAY_COUNT - 1) await sleep(DELAY_MS);
  }

  const successCount = results.filter(r => r.ok).length;
  const errorCount = results.filter(r => !r.ok).length;

  console.log(`\nWebhook responses: ${successCount} OK, ${errorCount} errors`);

  // Fetch order status
  let order = null;
  try {
    order = await fetchOrderStatus();
  } catch (err) {
    console.error(`Could not fetch order: ${err.message}`);
  }

  // Fetch email log entries
  let emailLogCount = null;
  try {
    emailLogCount = await fetchEmailLogCount();
  } catch (err) {
    console.warn(`Could not fetch email_log: ${err.message}`);
  }

  console.log('\n=== IDEMPOTENCY CHECK ===');

  const orderStatus = order?.status ?? 'unknown';
  const orderOk = orderStatus === 'paid';
  const emailOk = emailLogCount === null || emailLogCount === 1;

  let summary = `Webhook fired ${REPLAY_COUNT}×. Order status: ${orderStatus}.`;
  if (emailLogCount !== null) {
    summary += ` Email log entries: ${emailLogCount}.`;
  } else {
    summary += ` Email log: (table not found — skipped).`;
  }
  summary += ` IDEMPOTENCY: ${orderOk && emailOk ? 'PASS' : 'FAIL'}`;
  console.log(summary);

  if (!orderOk) {
    console.log(`[FAIL] Expected order status 'paid', got '${orderStatus}'`);
    process.exitCode = 1;
  }

  if (emailLogCount !== null && emailLogCount !== 1) {
    console.log(`[FAIL] Expected 1 email_log entry, found ${emailLogCount} — webhook handler may not be idempotent`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
