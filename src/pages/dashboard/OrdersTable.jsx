import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabase';

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(orders) {
  const headers = ['Naam', 'Email', 'Tier', 'Aantal', 'Bedrag', 'Status', 'Datum', 'Order ID'];
  const rows = orders
    .filter(o => o.status === 'paid')
    .map(o => [
      o.buyer_name,
      o.buyer_email,
      o.ticket_tiers?.name ?? '',
      o.quantity,
      (o.total_cents / 100).toFixed(2),
      o.status,
      o.paid_at ? new Date(o.paid_at).toLocaleDateString('nl-BE') : '',
      o.id,
    ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'bestellingen-olf2026.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtEuro(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_CONFIG = {
  paid:      { label: 'BETAALD',    bg: 'rgba(80,200,80,0.12)',    border: 'rgba(120,220,120,0.35)', color: '#7de87d' },
  pending:   { label: 'WACHT',      bg: 'rgba(240,200,60,0.12)',   border: 'rgba(240,200,60,0.35)',  color: '#f0d840' },
  expired:   { label: 'VERLOPEN',   bg: 'rgba(244,231,208,0.06)',  border: 'rgba(244,231,208,0.18)', color: 'rgba(244,231,208,0.45)' },
  cancelled: { label: 'GEANNUL.',   bg: 'rgba(220,60,60,0.12)',    border: 'rgba(220,60,60,0.3)',    color: '#ff7070' },
  failed:    { label: 'MISLUKT',    bg: 'rgba(220,60,60,0.12)',    border: 'rgba(220,60,60,0.3)',    color: '#ff7070' },
  refunded:  { label: 'TERUGBET.',  bg: 'rgba(160,80,220,0.12)',   border: 'rgba(160,80,220,0.35)', color: '#c07aff' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status.toUpperCase(), bg: 'rgba(244,231,208,0.06)', border: 'rgba(244,231,208,0.18)', color: 'rgba(244,231,208,0.6)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px',
      borderRadius: 999,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontFamily: 'var(--mono)',
      fontSize: 9,
      letterSpacing: '0.14em',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const s = {
  page: {
    background: 'transparent',
    minHeight: '100vh',
    color: 'var(--cream)',
    fontFamily: 'var(--body)',
    padding: '40px 48px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 16,
  },
  pageTitle: {
    fontFamily: 'var(--display)',
    fontSize: 48,
    lineHeight: 1,
    margin: 0,
  },
  mono: { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em' },
  summaryBar: {
    display: 'flex',
    gap: 0,
    marginBottom: 28,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(244,231,208,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  summaryItem: {
    flex: 1,
    padding: '16px 24px',
    borderRight: '1px solid rgba(244,231,208,0.08)',
  },
  summaryLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.18em',
    opacity: 0.45,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--orange-bright)',
  },
  filtersRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  searchInput: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(244,231,208,0.18)',
    borderRadius: 8,
    padding: '9px 16px',
    color: 'var(--cream)',
    fontFamily: 'var(--body)',
    fontSize: 13,
    outline: 'none',
    minWidth: 260,
  },
  selectInput: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(244,231,208,0.18)',
    borderRadius: 8,
    padding: '9px 16px',
    color: 'var(--cream)',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.1em',
    outline: 'none',
    cursor: 'pointer',
  },
  tableWrap: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(244,231,208,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.18em',
    opacity: 0.45,
    padding: '12px 16px',
    textAlign: 'left',
    borderBottom: '1px solid rgba(244,231,208,0.08)',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
  },
  td: {
    padding: '13px 16px',
    fontSize: 13,
    borderBottom: '1px solid rgba(244,231,208,0.05)',
    verticalAlign: 'top',
  },
  trHover: {
    transition: 'background 0.1s',
  },
  btnSmall: {
    background: 'rgba(244,231,208,0.07)',
    color: 'rgba(244,231,208,0.7)',
    border: '1px solid rgba(244,231,208,0.14)',
    borderRadius: 6,
    padding: '5px 12px',
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  btnGhost: {
    background: 'transparent',
    color: 'var(--cream)',
    border: '1px solid rgba(244,231,208,0.2)',
    borderRadius: 8,
    padding: '9px 18px',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  },
  btnDanger: {
    background: 'rgba(220,60,60,0.1)',
    color: '#ff8080',
    border: '1px solid rgba(220,60,60,0.3)',
    borderRadius: 6,
    padding: '5px 12px',
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  paginationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderTop: '1px solid rgba(244,231,208,0.08)',
  },
  btnPage: {
    background: 'rgba(244,231,208,0.07)',
    color: 'var(--cream)',
    border: '1px solid rgba(244,231,208,0.14)',
    borderRadius: 6,
    padding: '7px 16px',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  detailsBox: {
    background: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    padding: '14px 16px',
    marginTop: 2,
  },
  errorBanner: {
    background: 'rgba(220,60,60,0.15)',
    border: '1px solid rgba(220,60,60,0.35)',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#ff8080',
    fontFamily: 'var(--mono)',
    fontSize: 12,
    marginBottom: 24,
  },
  emptyState: {
    textAlign: 'center',
    opacity: 0.4,
    fontFamily: 'var(--mono)',
    fontSize: 12,
    letterSpacing: '0.14em',
    padding: '60px 0',
  },
};

// ─── TicketDetails ────────────────────────────────────────────────────────────

function TicketDetails({ order, onRefunded }) {
  const orderId = order.id;
  const [tickets, setTickets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resend email state
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState(null);

  // Refund state
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMsg, setRefundMsg] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('tickets')
        .select('ticket_number, scan_token, status')
        .eq('order_id', orderId);
      if (error) { setError(error.message); }
      else { setTickets(data); }
      setLoading(false);
    }
    load();
  }, [orderId]);

  async function handleResend() {
    setResendLoading(true);
    setResendMsg(null);
    try {
      const { error } = await supabase.functions.invoke('process-email-queue', {
        body: { order_id: orderId, force: true },
      });
      if (error) throw error;
      setResendMsg({ ok: true, text: 'E-mail verstuurd.' });
    } catch (err) {
      setResendMsg({ ok: false, text: `Fout: ${err.message || err}` });
    } finally {
      setResendLoading(false);
    }
  }

  async function handleRefund() {
    if (!window.confirm('Weet je zeker dat je deze bestelling wil terugbetalen?')) return;
    setRefundLoading(true);
    setRefundMsg(null);
    try {
      const { error: e1 } = await supabase.from('orders').update({ status: 'refunded' }).eq('id', orderId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('tickets').update({ status: 'cancelled' }).eq('order_id', orderId);
      if (e2) throw e2;
      setRefundMsg({ ok: true, text: 'Terugbetaling geregistreerd.' });
      if (onRefunded) onRefunded(orderId);
    } catch (err) {
      setRefundMsg({ ok: false, text: `Fout: ${err.message || err}` });
    } finally {
      setRefundLoading(false);
    }
  }

  if (loading) return <div style={{ ...s.detailsBox, opacity: 0.5, fontFamily: 'var(--mono)', fontSize: 11 }}>Laden…</div>;
  if (error) return <div style={{ ...s.detailsBox, color: '#ff8080', fontFamily: 'var(--mono)', fontSize: 11 }}>Fout: {error}</div>;

  const ticketStatusCfg = {
    valid:   { color: '#7de87d' },
    scanned: { color: 'var(--orange)' },
    invalid: { color: '#ff7070' },
    cancelled: { color: '#ff7070' },
  };

  return (
    <div style={s.detailsBox}>
      <div style={{ ...s.mono, fontSize: 9, opacity: 0.45, marginBottom: 10, letterSpacing: '0.18em' }}>
        TICKETS {tickets && tickets.length > 0 ? `(${tickets.length})` : ''}
      </div>

      {(!tickets || tickets.length === 0) ? (
        <div style={{ opacity: 0.4, fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 12 }}>Geen tickets gevonden.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {tickets.map((t, i) => {
            const cfg = ticketStatusCfg[t.status] || { color: 'rgba(244,231,208,0.5)' };
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--orange-bright)', minWidth: 120 }}>
                  {t.ticket_number || `#${i + 1}`}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.45, letterSpacing: '0.08em' }}>
                  {t.scan_token ? `${t.scan_token.slice(0, 8)}…` : '—'}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em',
                  color: cfg.color, marginLeft: 'auto',
                  textTransform: 'uppercase',
                }}>
                  {t.status || 'unknown'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        {/* Resend email — only for paid orders */}
        {order.status === 'paid' && (
          <button
            style={{ ...s.btnSmall, opacity: resendLoading ? 0.6 : 1 }}
            disabled={resendLoading}
            onClick={handleResend}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,0.07)'}
          >
            {resendLoading ? 'Versturen…' : 'Verstuur opnieuw'}
          </button>
        )}

        {/* Refund — only for paid orders */}
        {order.status === 'paid' && (
          <button
            style={{ ...s.btnDanger, opacity: refundLoading ? 0.6 : 1 }}
            disabled={refundLoading}
            onClick={handleRefund}
            onMouseEnter={e => { if (!refundLoading) e.currentTarget.style.background = 'rgba(220,60,60,0.22)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,60,60,0.1)'}
          >
            {refundLoading ? 'Bezig…' : 'Terugbetaling'}
          </button>
        )}

        {/* Inline feedback */}
        {resendMsg && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: resendMsg.ok ? '#7de87d' : '#ff8080' }}>
            {resendMsg.text}
          </span>
        )}
        {refundMsg && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: refundMsg.ok ? '#7de87d' : '#ff8080' }}>
            {refundMsg.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrdersTable() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [searchEmail, setSearchEmail] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);

  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // ── load ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('orders')
        .select('*, ticket_tiers(name)')
        .order('created_at', { ascending: false });
      if (error) { setLoadError(error.message); }
      else { setOrders(data); }
      setLoading(false);
    }
    load();
  }, []);

  // ── computed totals (always from full paid set) ──
  const paidOrders = useMemo(() => orders.filter(o => o.status === 'paid'), [orders]);
  const totalRevenue = useMemo(() => paidOrders.reduce((a, o) => a + (o.total_cents || 0), 0), [paidOrders]);

  // ── filters + pagination ──
  const filtered = useMemo(() => {
    let list = orders;
    if (searchEmail.trim()) {
      const q = searchEmail.trim().toLowerCase();
      list = list.filter(o =>
        (o.buyer_email || '').toLowerCase().includes(q) ||
        (o.buyer_name || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      list = list.filter(o => o.status === statusFilter);
    }
    return list;
  }, [orders, searchEmail, statusFilter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // reset to page 0 on filter change
  useEffect(() => { setPage(0); }, [searchEmail, statusFilter]);

  // ── toggle expand ──
  function toggleExpand(orderId) {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  }

  // ── handle refund (update local state) ──
  function handleRefunded(orderId) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'refunded' } : o));
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={{ ...s.mono, opacity: 0.4, margin: '0 0 6px' }}>DASHBOARD / ORDERS</p>
          <h1 style={s.pageTitle}>Bestellingen</h1>
        </div>
        {!loading && !loadError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ ...s.mono, opacity: 0.35, fontSize: 10 }}>
              {orders.length} TOTAAL
            </span>
            <button
              style={s.btnGhost}
              onClick={() => exportCSV(orders)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Exporteer CSV
            </button>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {!loading && !loadError && (
        <div style={s.summaryBar}>
          {[
            { label: 'Betaalde orders', val: paidOrders.length },
            { label: 'Totale omzet', val: fmtEuro(totalRevenue), highlight: true },
            { label: 'Gem. orderwaarde', val: paidOrders.length > 0 ? fmtEuro(Math.round(totalRevenue / paidOrders.length)) : '—' },
            { label: 'Openstaand', val: orders.filter(o => o.status === 'pending').length },
            { label: 'Verlopen / Annul.', val: orders.filter(o => o.status === 'expired' || o.status === 'cancelled').length },
          ].map(({ label, val, highlight }, i) => (
            <div key={label} style={{ ...s.summaryItem, ...(i === 4 ? { borderRight: 'none' } : {}) }}>
              <div style={s.summaryLabel}>{label}</div>
              <div style={{ ...s.summaryValue, color: highlight ? 'var(--orange-bright)' : 'var(--cream)' }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={s.filtersRow}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Zoek op email of naam…"
          value={searchEmail}
          onChange={e => setSearchEmail(e.target.value)}
        />
        <select
          style={s.selectInput}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Alle statussen</option>
          <option value="paid">Betaald</option>
          <option value="pending">Wachtend</option>
          <option value="expired">Verlopen</option>
          <option value="cancelled">Geannuleerd</option>
          <option value="failed">Mislukt</option>
        </select>
        {(searchEmail || statusFilter) && (
          <button
            style={{ ...s.btnPage, fontSize: 10 }}
            onClick={() => { setSearchEmail(''); setStatusFilter(''); }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,0.07)'}
          >
            Wis filters
          </button>
        )}
        {(searchEmail || statusFilter) && (
          <span style={{ ...s.mono, fontSize: 10, opacity: 0.45, alignSelf: 'center' }}>
            {filtered.length} resultaten
          </span>
        )}
      </div>

      {/* States */}
      {loading && <div style={s.emptyState}>Laden…</div>}
      {loadError && <div style={s.errorBanner}>Fout bij laden: {loadError}</div>}
      {!loading && !loadError && orders.length === 0 && (
        <div style={s.emptyState}>Nog geen bestellingen.</div>
      )}
      {!loading && !loadError && orders.length > 0 && filtered.length === 0 && (
        <div style={s.emptyState}>Geen resultaten voor deze filters.</div>
      )}

      {/* Table */}
      {!loading && !loadError && paginated.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Datum', 'Naam', 'Email', 'Tier', 'Aantal', 'Bedrag', 'Status', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(order => {
                const isExpanded = expandedOrderId === order.id;
                return [
                  <tr
                    key={order.id}
                    style={{ ...s.trHover, background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent' }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap' }}>
                      {fmtDate(order.created_at)}
                    </td>
                    <td style={{ ...s.td, fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.buyer_name || <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.75 }}>
                      {order.buyer_email || <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ ...s.td, fontSize: 12, opacity: 0.7 }}>
                      {order.ticket_tiers?.name || <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center' }}>
                      {order.quantity}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--orange-bright)', whiteSpace: 'nowrap' }}>
                      {fmtEuro(order.total_cents)}
                    </td>
                    <td style={s.td}>
                      <StatusBadge status={order.status} />
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button
                        style={{
                          ...s.btnSmall,
                          color: isExpanded ? 'var(--orange-bright)' : 'rgba(244,231,208,0.7)',
                          borderColor: isExpanded ? 'rgba(255,150,30,0.35)' : 'rgba(244,231,208,0.14)',
                          background: isExpanded ? 'rgba(255,150,30,0.1)' : 'rgba(244,231,208,0.07)',
                        }}
                        onClick={() => toggleExpand(order.id)}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,0.14)'}
                        onMouseLeave={e => e.currentTarget.style.background = isExpanded ? 'rgba(255,150,30,0.1)' : 'rgba(244,231,208,0.07)'}
                      >
                        {isExpanded ? 'Verberg ▲' : 'Details ▼'}
                      </button>
                    </td>
                  </tr>,
                  isExpanded && (
                    <tr key={`${order.id}-detail`} style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <td colSpan={8} style={{ padding: '4px 16px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 10 }}>
                          <div>
                            <div style={{ ...s.mono, fontSize: 9, opacity: 0.45, marginBottom: 6, letterSpacing: '0.18em' }}>ORDER INFO</div>
                            <div style={{ fontSize: 12, lineHeight: 1.8, opacity: 0.7 }}>
                              <div><span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.6 }}>ID: </span>{order.id}</div>
                              {order.mollie_payment_id && (
                                <div><span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.6 }}>Mollie: </span>{order.mollie_payment_id}</div>
                              )}
                              {order.paid_at && (
                                <div><span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.6 }}>Betaald: </span>{fmtDate(order.paid_at)}</div>
                              )}
                            </div>
                          </div>
                        </div>
                        <TicketDetails order={order} onRefunded={handleRefunded} />
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {pageCount > 1 && (
            <div style={s.paginationRow}>
              <span style={{ ...s.mono, fontSize: 10, opacity: 0.4 }}>
                Pagina {page + 1} van {pageCount} — {filtered.length} orders
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ ...s.btnPage, opacity: page === 0 ? 0.3 : 1, cursor: page === 0 ? 'default' : 'pointer' }}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  onMouseEnter={e => { if (page > 0) e.currentTarget.style.background = 'rgba(244,231,208,0.14)'; }}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,0.07)'}
                >
                  ← Vorige
                </button>
                {/* Page number pills */}
                {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
                  const p = pageCount <= 7 ? i : (
                    page < 4 ? i :
                    page > pageCount - 5 ? pageCount - 7 + i :
                    page - 3 + i
                  );
                  return (
                    <button
                      key={p}
                      style={{
                        ...s.btnPage,
                        padding: '7px 12px',
                        background: p === page ? 'var(--orange)' : 'rgba(244,231,208,0.07)',
                        color: p === page ? '#1a0a00' : 'var(--cream)',
                        border: p === page ? 'none' : '1px solid rgba(244,231,208,0.14)',
                        fontWeight: p === page ? 700 : 400,
                      }}
                      onClick={() => setPage(p)}
                      onMouseEnter={e => { if (p !== page) e.currentTarget.style.background = 'rgba(244,231,208,0.14)'; }}
                      onMouseLeave={e => { if (p !== page) e.currentTarget.style.background = 'rgba(244,231,208,0.07)'; }}
                    >
                      {p + 1}
                    </button>
                  );
                })}
                <button
                  style={{ ...s.btnPage, opacity: page >= pageCount - 1 ? 0.3 : 1, cursor: page >= pageCount - 1 ? 'default' : 'pointer' }}
                  onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  onMouseEnter={e => { if (page < pageCount - 1) e.currentTarget.style.background = 'rgba(244,231,208,0.14)'; }}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,0.07)'}
                >
                  Volgende →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        select option {
          background: #2a0f33;
          color: #f4e7d0;
        }
        input:focus, select:focus {
          border-color: var(--orange) !important;
          outline: none;
        }
      `}</style>
    </div>
  );
}
