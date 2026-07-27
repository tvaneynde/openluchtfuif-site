#!/usr/bin/env node
//
// Verifies that free ("comp") sponsor / partner-swap tickets are real, scannable
// tickets that do NOT disturb sales figures or public availability.
//
// Run with:  node --env-file=.env tests/comp-tickets-test.js
//
// Reads credentials from the environment — never hardcode keys in this file.
// Cleans up everything it creates (comp orders cascade-delete their tickets,
// and the giveaway count is restored) so it is safe to run against production.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

let passed = 0, failed = 0;
const pass = (n) => { console.log(`[PASS] ${n}`); passed++; };
const fail = (n, d) => { console.log(`[FAIL] ${n}: ${d}`); failed++; };
const eq = (n, actual, expected) =>
  actual === expected ? pass(n) : fail(n, `expected ${expected}, got ${actual}`);

function svc(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function rpc(fn, args) {
  const res = await svc(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  const body = await res.json();
  if (!res.ok) throw new Error(`${fn} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const get = async (path) => (await svc(path)).json();

// ── snapshot helpers ────────────────────────────────────────────────────────

async function salesSnapshot() {
  const tiers = await get('ticket_tiers?select=id,name,sold_count,total_capacity,is_comp,is_door_sale&order=sort_order');
  const saleOrders = await get('orders?select=total_cents,quantity&status=eq.paid&order_type=eq.sale');
  return {
    tiers,
    sellable: tiers.filter(t => !t.is_comp && !t.is_door_sale)
      .map(t => `${t.name}:${t.sold_count}/${t.total_capacity}`).join(' | '),
    revenue: saleOrders.reduce((a, o) => a + (o.total_cents || 0), 0),
    saleOrderCount: saleOrders.length,
    saleTickets: saleOrders.reduce((a, o) => a + (o.quantity || 0), 0),
  };
}

const createdOrderIds = [];

async function cleanup() {
  for (const id of createdOrderIds) {
    // Roll the giveaway count back by hand — this is teardown, not the revoke path
    const [order] = await get(`orders?select=tier_id,quantity,status&id=eq.${id}`);
    if (order && order.status === 'paid') {
      const [tier] = await get(`ticket_tiers?select=sold_count&id=eq.${order.tier_id}`);
      await svc(`ticket_tiers?id=eq.${order.tier_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sold_count: Math.max(0, tier.sold_count - order.quantity) }),
      });
    }
    await svc(`email_log?order_id=eq.${id}`, { method: 'DELETE' });
    await svc(`orders?id=eq.${id}`, { method: 'DELETE' }); // tickets cascade
  }
}

// ── tests ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Comp ticket verification ===\n');

  const before = await salesSnapshot();
  const compTiers = before.tiers.filter(t => t.is_comp);

  if (compTiers.length === 0) {
    fail('comp tier exists', 'no is_comp tier found — migration 0035 not applied?');
    return;
  }
  pass(`comp tier exists (${compTiers.map(t => t.name).join(', ')})`);

  const tier = compTiers[0];
  const key = crypto.randomUUID();

  // 1 — issue 2 comps
  const issued = await rpc('issue_comp_tickets', {
    p_recipient_name: 'TEST Sponsor BV',
    p_email: 'comp-test@example.com',
    p_quantity: 2,
    p_reason: 'sponsor',
    p_note: 'automated verification — safe to delete',
    p_send_email: false,
    p_idempotency_key: key,
  });
  if (!issued.success) { fail('issue 2 comps', JSON.stringify(issued)); return; }
  createdOrderIds.push(issued.order_id);
  eq('issue 2 comps → tickets_issued', issued.tickets_issued, 2);

  // 2 — the order looks like a comp, not a sale
  const [order] = await get(`orders?select=*&id=eq.${issued.order_id}`);
  eq('order_type', order.order_type, 'comp');
  eq('total_cents', order.total_cents, 0);
  eq('status', order.status, 'paid');
  eq('comp_reason', order.comp_reason, 'sponsor');
  order.paid_at ? pass('paid_at set') : fail('paid_at set', 'null');
  order.mollie_payment_id === null ? pass('no Mollie payment id') : fail('no Mollie payment id', order.mollie_payment_id);
  order.mollie_idempotency_key === `comp:${key}`
    ? pass('idempotency key namespaced with comp:')
    : fail('idempotency key namespaced', order.mollie_idempotency_key);

  // 3 — real tickets with real scan tokens
  const tickets = await get(`tickets?select=scan_token,ticket_number,status&order_id=eq.${issued.order_id}`);
  eq('2 ticket rows minted', tickets.length, 2);
  const tokensOk = tickets.every(t => /^[0-9a-f]{64}$/.test(t.scan_token));
  tokensOk ? pass('scan tokens are 64-char hex HMACs') : fail('scan tokens', JSON.stringify(tickets.map(t => t.scan_token)));
  const numbersOk = tickets.every(t => /^OLF2026-[0-9A-F]{6}$/.test(t.ticket_number));
  numbersOk ? pass('ticket numbers match OLF2026-XXXXXX') : fail('ticket numbers', JSON.stringify(tickets.map(t => t.ticket_number)));
  tickets.every(t => t.status === 'valid') ? pass('tickets valid') : fail('tickets valid', 'not all valid');

  // Same token shape as tickets minted by a real sale (mint_tickets refactor)
  const saleTicket = await get('tickets?select=scan_token&limit=1&order=issued_at.asc');
  if (saleTicket[0]) {
    eq('token length matches pre-existing sale tickets',
      tickets[0].scan_token.length, saleTicket[0].scan_token.length);
  }

  // 4 — the giveaway count moved, sellable stock did not
  const after = await salesSnapshot();
  const tierAfter = after.tiers.find(t => t.id === tier.id);
  eq('comps given +2', tierAfter.sold_count, tier.sold_count + 2);
  eq('sellable stock untouched', after.sellable, before.sellable);
  eq('revenue untouched', after.revenue, before.revenue);
  eq('paid sale order count untouched', after.saleOrderCount, before.saleOrderCount);
  eq('sale ticket count untouched', after.saleTickets, before.saleTickets);

  // 5 — email opt-out honoured
  const noMail = await get(`email_log?select=id&order_id=eq.${issued.order_id}`);
  eq('send_email=false → nothing queued', noMail.length, 0);

  // 6 — idempotency: same key must not issue twice
  const retry = await rpc('issue_comp_tickets', { p_recipient_name: 'TEST Sponsor BV', p_email: 'comp-test@example.com',
    p_quantity: 2, p_reason: 'sponsor', p_note: null, p_send_email: false, p_idempotency_key: key,
  });
  retry.already_processed === true && retry.order_id === issued.order_id
    ? pass('replayed key → same order, no new batch')
    : fail('idempotency', JSON.stringify(retry));
  const stillTwo = await get(`tickets?select=id&order_id=eq.${issued.order_id}`);
  eq('still only 2 tickets after replay', stillTwo.length, 2);

  // 7 — no allotment: a big batch must go through
  const over = await rpc('issue_comp_tickets', { p_recipient_name: 'TEST Grote gift', p_email: 'comp-test@example.com',
    p_quantity: 99, p_reason: 'sponsor', p_note: null, p_send_email: false,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (over.success) {
    createdOrderIds.push(over.order_id);
    eq('99 tickets in one batch — no giveaway limit', over.tickets_issued, 99);
  } else {
    fail('99-ticket batch', JSON.stringify(over));
  }

  // 8 — exactly one comp tier, so no tier argument is needed
  eq('single comp tier', compTiers.length, 1);

  // 9 — input validation
  const badEmail = await rpc('issue_comp_tickets', { p_recipient_name: 'TEST', p_email: 'not-an-email',
    p_quantity: 1, p_reason: 'sponsor', p_note: null, p_send_email: false,
    p_idempotency_key: crypto.randomUUID(),
  });
  eq('rejects invalid email', badEmail.error, 'invalid_email');

  const badReason = await rpc('issue_comp_tickets', { p_recipient_name: 'TEST', p_email: 'comp-test@example.com',
    p_quantity: 1, p_reason: 'vrienden', p_note: null, p_send_email: false,
    p_idempotency_key: crypto.randomUUID(),
  });
  eq('rejects unknown reason', badReason.error, 'invalid_reason');

  // 10 — email enqueue when requested
  const mailKey = crypto.randomUUID();
  const withMail = await rpc('issue_comp_tickets', { p_recipient_name: 'TEST Partner vzw', p_email: 'comp-test@example.com',
    p_quantity: 1, p_reason: 'partner_swap', p_note: 'ruildeal', p_send_email: true,
    p_idempotency_key: mailKey,
  });
  if (withMail.success) {
    createdOrderIds.push(withMail.order_id);
    const queued = await get(`email_log?select=type,status&order_id=eq.${withMail.order_id}`);
    queued.length === 1 && queued[0].type === 'ticket_confirmation'
      ? pass('send_email=true → ticket_confirmation queued (same path as a sale)')
      : fail('email queued', JSON.stringify(queued));
  } else {
    fail('issue with email', JSON.stringify(withMail));
  }

  // 11 — the public quantity cap (10) must not apply to comps
  const big = await rpc('issue_comp_tickets', { p_recipient_name: 'TEST Grote ruil', p_email: 'comp-test@example.com',
    p_quantity: 12, p_reason: 'partner_swap', p_note: null, p_send_email: false,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (big.success) {
    createdOrderIds.push(big.order_id);
    eq('12-ticket batch allowed (public cap is 10)', big.tickets_issued, 12);
  } else {
    fail('12-ticket batch', JSON.stringify(big));
  }

  // 11b — the fat-finger guard still bites
  const absurd = await rpc('issue_comp_tickets', { p_recipient_name: 'TEST Typo', p_email: 'comp-test@example.com',
    p_quantity: 50000, p_reason: 'other', p_note: null, p_send_email: false,
    p_idempotency_key: crypto.randomUUID(),
  });
  eq('typo guard rejects 50000', absurd.error, 'invalid_quantity');

  // 12 — revoke undoes the giveaway count
  const [beforeRevoke] = await get(`ticket_tiers?select=sold_count&id=eq.${tier.id}`);
  const revoked = await rpc('revoke_comp_order', { p_order_id: issued.order_id });
  revoked.success ? pass(`revoke → ${revoked.tickets_revoked} tickets`) : fail('revoke', JSON.stringify(revoked));
  const [afterRevoke] = await get(`ticket_tiers?select=sold_count&id=eq.${tier.id}`);
  eq('giveaway count decremented', afterRevoke.sold_count, beforeRevoke.sold_count - 2);
  const revokedTickets = await get(`tickets?select=status&order_id=eq.${issued.order_id}`);
  revokedTickets.every(t => t.status === 'cancelled')
    ? pass('revoked tickets cancelled (no longer scannable)')
    : fail('revoked tickets cancelled', JSON.stringify(revokedTickets));
  const [revokedOrder] = await get(`orders?select=status&id=eq.${issued.order_id}`);
  eq("revoked order is 'refunded', not 'cancelled' (create-payment recycles cancelled rows)",
    revokedOrder.status, 'refunded');

  const revokeAgain = await rpc('revoke_comp_order', { p_order_id: issued.order_id });
  revokeAgain.already_processed === true
    ? pass('revoke is idempotent')
    : fail('revoke idempotent', JSON.stringify(revokeAgain));

  // 13 — anon must not see comp tiers, and must not be able to buy one
  const anonTiers = await fetch(
    `${SUPABASE_URL}/rest/v1/ticket_tiers?select=id,name,is_comp`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  ).then(r => r.json());
  Array.isArray(anonTiers) && !anonTiers.some(t => t.is_comp)
    ? pass(`anon cannot see comp tiers (${anonTiers.length} visible)`)
    : fail('anon comp tier leak', JSON.stringify(anonTiers));

  const buyComp = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier_id: tier.id, quantity: 1,
      buyer_name: 'Fraudeur', buyer_email: 'comp-test@example.com',
    }),
  });
  buyComp.status >= 400
    ? pass(`create-payment refuses a comp tier (HTTP ${buyComp.status})`)
    : fail('create-payment comp guard', `HTTP ${buyComp.status} ${await buyComp.text()}`);

  // 14 — final: sales figures still exactly where they started
  const final = await salesSnapshot();
  eq('FINAL sellable stock untouched', final.sellable, before.sellable);
  eq('FINAL revenue untouched', final.revenue, before.revenue);
  eq('FINAL sale ticket count untouched', final.saleTickets, before.saleTickets);
}

main()
  .catch(e => fail('unexpected error', e.message))
  .finally(async () => {
    await cleanup();
    const [t] = await get('ticket_tiers?select=name,sold_count&is_comp=eq.true&order=sort_order');
    console.log(`\nCleaned up ${createdOrderIds.length} test order(s). ${t.name} sold_count is back to ${t.sold_count}.`);
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
