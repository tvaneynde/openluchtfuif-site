#!/usr/bin/env node
//
// One-off cleanup: permanently delete comp (free) ticket orders.
//
//   node --env-file=.env tests/delete-test-comps.js            # dry run, lists only
//   node --env-file=.env tests/delete-test-comps.js --delete    # actually deletes
//
// Deletion order matters:
//   1. scan_events referencing those tickets (tickets.id FK has no ON DELETE,
//      so the ticket delete would fail while a scan row still points at it)
//   2. email_log rows for the order
//   3. the order itself — tickets cascade via ON DELETE CASCADE
//   4. recompute the comp tier's sold_count from the paid comp orders that remain
//
// Unlike revoke_comp_order() this leaves no trace: use it only for test data.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELETE = process.argv.includes('--delete');

if (!SUPABASE_URL || !KEY) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const req = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: {
    apikey: KEY, Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json', ...(init.headers || {}),
  },
});
const get = async (p) => {
  const r = await req(p);
  if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`);
  return r.json();
};
const del = async (p) => {
  const r = await req(p, { method: 'DELETE' });
  if (!r.ok) throw new Error(`DELETE ${p} → ${r.status} ${await r.text()}`);
};

const euro = (c) => `€${(c / 100).toFixed(2)}`;

(async () => {
  const orders = await get(
    'orders?select=id,buyer_name,buyer_email,quantity,status,total_cents,comp_reason,comp_note,created_at,tier_id,ticket_tiers(name)' +
    '&order_type=eq.comp&order=created_at.asc'
  );

  if (!orders.length) {
    console.log('No comp orders found — nothing to delete.');
    return;
  }

  console.log(`\n${orders.length} comp order(s):\n`);
  let totalTickets = 0, totalScans = 0;

  for (const o of orders) {
    const tickets = await get(`tickets?select=id,ticket_number,status&order_id=eq.${o.id}`);
    const ids = tickets.map(t => t.id);
    const scans = ids.length
      ? await get(`scan_events?select=id,result,scanned_at&ticket_id=in.(${ids.join(',')})`)
      : [];
    o._tickets = tickets;
    o._scans = scans;
    totalTickets += tickets.length;
    totalScans += scans.length;

    const scanned = tickets.filter(t => t.status === 'scanned').length;
    console.log(
      `  ${new Date(o.created_at).toLocaleString('nl-BE')}  ${o.buyer_name} <${o.buyer_email}>\n` +
      `    ${o.quantity}× ${o.ticket_tiers?.name ?? '?'} · ${o.comp_reason} · ${o.status} · ${euro(o.total_cents)}` +
      `${o.comp_note ? ` · "${o.comp_note}"` : ''}\n` +
      `    ${tickets.length} ticket(s)${scanned ? `, ${scanned} gescand` : ''}` +
      `${scans.length ? `, ${scans.length} scan_event(s) to remove` : ''}\n`
    );
  }

  console.log(`Totals: ${orders.length} orders, ${totalTickets} tickets, ${totalScans} scan_events\n`);

  if (!DELETE) {
    console.log('DRY RUN — nothing deleted. Re-run with --delete to remove the above.');
    return;
  }

  const tierIds = new Set();
  for (const o of orders) {
    tierIds.add(o.tier_id);
    const ids = o._tickets.map(t => t.id);
    if (ids.length) await del(`scan_events?ticket_id=in.(${ids.join(',')})`);
    await del(`email_log?order_id=eq.${o.id}`);
    await del(`orders?id=eq.${o.id}`);
    console.log(`  deleted ${o.buyer_name} (${o.quantity} ticket(s))`);
  }

  // Recompute rather than decrement — self-correcting even if counts had drifted.
  for (const tierId of tierIds) {
    const remaining = await get(
      `orders?select=quantity&tier_id=eq.${tierId}&order_type=eq.comp&status=eq.paid`
    );
    const sold = remaining.reduce((a, o) => a + (o.quantity || 0), 0);
    await req(`ticket_tiers?id=eq.${tierId}`, {
      method: 'PATCH', body: JSON.stringify({ sold_count: sold }),
    });
    const [t] = await get(`ticket_tiers?select=name,sold_count&id=eq.${tierId}`);
    console.log(`  ${t.name}.sold_count recomputed → ${t.sold_count}`);
  }

  const left = await get('orders?select=id&order_type=eq.comp');
  const orphanTickets = await get('tickets?select=id&tier_id=in.(' + [...tierIds].join(',') + ')');
  console.log(`\nDone. Comp orders remaining: ${left.length}. Tickets on comp tier(s): ${orphanTickets.length}.`);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
