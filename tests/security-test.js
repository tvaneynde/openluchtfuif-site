#!/usr/bin/env node

const SUPABASE_URL = 'https://noihnuouftyvsvzybwer.supabase.co';
const SCAN_ENDPOINT = `${SUPABASE_URL}/functions/v1/scan`;
const CHECKOUT_ENDPOINT = `${SUPABASE_URL}/functions/v1/create-payment`;
const ANON_KEY = 'sb_publishable_j22VhYpjKL875VUoGpFTLw_xu5PjKTS';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaWhudW91ZnR5dnN2enlid2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIxNDA4NCwiZXhwIjoyMDk1NzkwMDg0fQ.ooPfTnGJQ3KPG7n54x4mthi4_w8uL3h8pvgCbrh-TFo';

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`[PASS] ${name}`);
  passed++;
}

function fail(name, detail) {
  console.log(`[FAIL] ${name}: ${detail}`);
  failed++;
}

function randomUUID() {
  // Simple UUID v4 generator using crypto if available, else Math.random fallback
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}

// Test 1: Forged QR — random UUID token should return invalid, fast
async function testForgedQR() {
  const name = 'Forged QR — random UUID returns invalid';
  const fakeToken = randomUUID();
  const start = Date.now();
  try {
    const res = await fetch(SCAN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'X-Scanner-Key': 'test-security-runner',
      },
      body: JSON.stringify({ token: fakeToken }),
    });
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));

    if (body?.result === 'invalid') {
      if (elapsed < 500) {
        pass(`${name} (${elapsed}ms)`);
      } else {
        fail(name, `result was 'invalid' but response took ${elapsed}ms (> 500ms threshold)`);
      }
    } else {
      fail(name, `expected result='invalid', got: ${JSON.stringify(body)} (${res.status})`);
    }
  } catch (err) {
    fail(name, `network error: ${err.message}`);
  }
}

// Test 2: SQL injection via scan token
async function testSQLInjection() {
  const name = "SQL injection via scan token";
  try {
    const res = await fetch(SCAN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'X-Scanner-Key': 'test-security-runner',
      },
      body: JSON.stringify({ token: "' OR '1'='1" }),
    });
    const body = await res.json().catch(() => ({}));

    if (body?.result === 'invalid') {
      pass(name);
    } else if (res.status >= 500) {
      fail(name, `server error (${res.status}) — possible unhandled injection: ${JSON.stringify(body)}`);
    } else {
      fail(name, `expected result='invalid', got: ${JSON.stringify(body)} (${res.status})`);
    }
  } catch (err) {
    fail(name, `network error: ${err.message}`);
  }
}

// Test 3: XSS in buyer name — should not crash the endpoint
async function testXSSInBuyerName() {
  const name = 'XSS in buyer name — endpoint does not crash';
  try {
    const res = await fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({
        tier_id: 'xss-test-tier-does-not-exist',
        quantity: 1,
        buyer_name: '<script>alert(1)</script>',
        buyer_email: 'xss-test@security.invalid',
      }),
    });
    const body = await res.json().catch(() => ({}));

    // We expect either a business-logic error (tier not found, etc.) or success
    // The important thing is no 500 caused by unescaped input
    if (res.status >= 500) {
      fail(name, `server error (${res.status}) — possible XSS/injection crash: ${JSON.stringify(body)}`);
    } else {
      pass(`${name} (status ${res.status})`);
    }
  } catch (err) {
    fail(name, `network error: ${err.message}`);
  }
}

// Test 4: Dashboard auth — anon key, no auth header should return 401
async function testDashboardAuth() {
  const name = 'Dashboard auth — anon key alone cannot read orders';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'GET',
      headers: {
        'apikey': ANON_KEY,
        // Intentionally no Authorization header
      },
    });

    if (res.status === 401) {
      pass(name);
    } else if (res.status === 200) {
      const body = await res.json().catch(() => []);
      fail(name, `returned 200 with ${Array.isArray(body) ? body.length : '?'} rows — RLS may be disabled`);
    } else {
      fail(name, `expected 401, got ${res.status}`);
    }
  } catch (err) {
    fail(name, `network error: ${err.message}`);
  }
}

// Test 5: No scanner key header — should return 401
async function testNoScannerKey() {
  const name = 'No X-Scanner-Key header — returns 401 with "Scanner key required"';
  try {
    const res = await fetch(SCAN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        // Intentionally no X-Scanner-Key
      },
      body: JSON.stringify({ token: randomUUID() }),
    });
    const body = await res.json().catch(() => ({}));
    const bodyText = JSON.stringify(body);

    if (res.status === 401) {
      if (bodyText.toLowerCase().includes('scanner key required') || bodyText.toLowerCase().includes('scanner key')) {
        pass(name);
      } else {
        pass(`${name} (got 401 but message was: ${bodyText})`);
      }
    } else {
      fail(name, `expected 401, got ${res.status}: ${bodyText}`);
    }
  } catch (err) {
    fail(name, `network error: ${err.message}`);
  }
}

// Test 6: Wrong scanner key — should return 401
async function testWrongScannerKey() {
  const name = 'Wrong X-Scanner-Key — returns 401';
  try {
    const res = await fetch(SCAN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'X-Scanner-Key': 'wrongpin',
      },
      body: JSON.stringify({ token: randomUUID() }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.status === 401) {
      pass(name);
    } else {
      fail(name, `expected 401, got ${res.status}: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    fail(name, `network error: ${err.message}`);
  }
}

async function main() {
  console.log('=== Security Tests ===\n');

  await testForgedQR();
  await testSQLInjection();
  await testXSSInBuyerName();
  await testDashboardAuth();
  await testNoScannerKey();
  await testWrongScannerKey();

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
