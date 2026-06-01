import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import TierManagement from './dashboard/TierManagement.jsx';
import OrdersTable from './dashboard/OrdersTable.jsx';
import EmailLog from './dashboard/EmailLog.jsx';
import ScannerConfig from './dashboard/ScannerConfig.jsx';
import PromoCodeManager from './dashboard/PromoCodeManager.jsx';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ─── Overview helpers ──────────────────────────────────────────────────────────

function fmtEuro(cents) {
  if (cents == null) return '—';
  return `€${(cents / 100).toFixed(2)}`;
}

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s geleden`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m geleden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}u geleden`;
  return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
}

const MONO = { fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase' };

const CARD_STYLE = {
  background: 'rgba(42,15,51,0.7)',
  border: '1px solid rgba(244,231,208,0.1)',
  borderRadius: 16,
};

function SectionLabel({ children }) {
  return (
    <div style={{ ...MONO, color: 'var(--orange)', opacity: 0.85, marginBottom: 14 }}>
      {children}
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, loading }) {
  return (
    <div style={{ ...CARD_STYLE, padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ ...MONO, color: 'rgba(244,231,208,0.45)' }}>{label}</span>
      <span style={{
        fontFamily: 'var(--display)',
        fontSize: '2.6rem',
        lineHeight: 1,
        color: loading ? 'rgba(244,231,208,0.2)' : 'var(--orange)',
        letterSpacing: '0.02em',
        transition: 'color 0.3s',
      }}>
        {loading ? '—' : value}
      </span>
      {sub && (
        <span style={{ ...MONO, fontSize: 9, color: 'rgba(244,231,208,0.3)', marginTop: -2 }}>{sub}</span>
      )}
    </div>
  );
}

// ─── Tier breakdown card ──────────────────────────────────────────────────────

function TierCard({ tier }) {
  const pct = tier.total_capacity > 0
    ? Math.min(100, (tier.sold_count / tier.total_capacity) * 100)
    : 0;
  const revenue = tier.sold_count * (tier.price_cents || 0);
  const barColor = pct >= 90 ? '#ff7070' : pct >= 60 ? '#d95a2b' : '#f07a3c';

  return (
    <div style={{ ...CARD_STYLE, padding: '20px 24px' }}>
      {/* Name + badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--cream)', lineHeight: 1 }}>
          {tier.name}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 999,
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em',
          background: tier.is_active ? 'rgba(80,200,80,0.12)' : 'rgba(244,231,208,0.06)',
          border: tier.is_active ? '1px solid rgba(120,220,120,0.4)' : '1px solid rgba(244,231,208,0.18)',
          color: tier.is_active ? '#7de87d' : 'rgba(244,231,208,0.4)',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: tier.is_active ? '#7de87d' : 'rgba(244,231,208,0.3)', display: 'inline-block' }} />
          {tier.is_active ? 'ACTIEF' : 'INACTIEF'}
        </span>
      </div>

      {/* Big count */}
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 36, color: 'var(--orange)', lineHeight: 1 }}>
          {tier.sold_count}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'rgba(244,231,208,0.4)', marginLeft: 6 }}>
          / {tier.total_capacity}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(244,231,208,0.1)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999, transition: 'width 0.5s' }} />
      </div>

      {/* Revenue */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...MONO, color: 'rgba(244,231,208,0.35)' }}>{pct.toFixed(0)}% VERKOCHT</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--orange-bright)', letterSpacing: '0.04em' }}>
          {fmtEuro(revenue)}
        </span>
      </div>
    </div>
  );
}

// ─── Scan result badge ────────────────────────────────────────────────────────

function ScanBadge({ result }) {
  const cfg = {
    valid:           { bg: 'rgba(80,200,80,0.12)',   border: 'rgba(120,220,120,0.35)', color: '#7de87d',  label: 'GELDIG' },
    already_scanned: { bg: 'rgba(240,140,40,0.12)',  border: 'rgba(240,140,40,0.35)',  color: '#f07a3c',  label: 'AL GESCAND' },
    invalid:         { bg: 'rgba(220,60,60,0.12)',   border: 'rgba(220,60,60,0.3)',    color: '#ff7070',  label: 'ONGELDIG' },
  }[result] || { bg: 'rgba(244,231,208,0.06)', border: 'rgba(244,231,208,0.18)', color: 'rgba(244,231,208,0.5)', label: result?.toUpperCase() || '?' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

// ─── Overview page ────────────────────────────────────────────────────────────

function Overview() {
  // ── state ──
  const [tiersData, setTiersData] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(null);
  const [scannedToday, setScannedToday] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [salesChart, setSalesChart] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);

  const [orderFeed, setOrderFeed] = useState([]);
  const [scanFeed, setScanFeed] = useState([]);
  const [newOrderIds, setNewOrderIds] = useState(new Set());

  const [alerts, setAlerts] = useState([]);

  // tier map for order feed join
  const tierMapRef = useRef({});

  // ── helpers ──
  const addToOrderFeed = useCallback((order) => {
    setOrderFeed(prev => {
      const exists = prev.find(o => o.id === order.id);
      if (exists) {
        return prev.map(o => o.id === order.id ? order : o);
      }
      return [order, ...prev].slice(0, 10);
    });
    setNewOrderIds(prev => {
      const next = new Set(prev);
      next.add(order.id);
      setTimeout(() => setNewOrderIds(s => { const c = new Set(s); c.delete(order.id); return c; }), 1500);
      return next;
    });
  }, []);

  const addToScanFeed = useCallback((event) => {
    setScanFeed(prev => [event, ...prev].slice(0, 20));
  }, []);

  // ── fetch metrics ──
  useEffect(() => {
    async function loadMetrics() {
      setMetricsLoading(true);

      // Tiers
      const { data: tiers } = await supabase
        .from('ticket_tiers')
        .select('id, name, sold_count, total_capacity, price_cents, fee_cents, is_active')
        .order('sort_order');

      if (tiers) {
        setTiersData(tiers);
        const map = {};
        tiers.forEach(t => { map[t.id] = t; });
        tierMapRef.current = map;
      }

      // Revenue from paid orders
      const { data: orders } = await supabase
        .from('orders')
        .select('total_cents')
        .eq('status', 'paid');

      if (orders) {
        setTotalRevenue(orders.reduce((acc, o) => acc + (o.total_cents || 0), 0));
      }

      // Scanned today
      const todayISO = new Date();
      todayISO.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('scan_events')
        .select('id', { count: 'exact' })
        .eq('result', 'valid')
        .gte('scanned_at', todayISO.toISOString());

      setScannedToday(count ?? 0);
      setMetricsLoading(false);
    }

    loadMetrics();
  }, []);

  // ── fetch sales chart ──
  useEffect(() => {
    async function loadChart() {
      setChartLoading(true);
      const { data } = await supabase
        .from('orders')
        .select('paid_at, quantity')
        .eq('status', 'paid')
        .not('paid_at', 'is', null);

      if (data && data.length > 0) {
        const buckets = {};
        data.forEach(({ paid_at, quantity }) => {
          const key = new Date(paid_at).toISOString().slice(0, 13);
          buckets[key] = (buckets[key] || 0) + (quantity || 1);
        });
        const sorted = Object.entries(buckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, count]) => ({
            hour: `${key.slice(11, 13)}:00`,
            date: key.slice(0, 10),
            tickets: count,
          }));
        setSalesChart(sorted);
      } else {
        setSalesChart([]);
      }
      setChartLoading(false);
    }
    loadChart();
  }, []);

  // ── initial order feed load ──
  useEffect(() => {
    async function loadOrders() {
      const { data } = await supabase
        .from('orders')
        .select('*, ticket_tiers(name)')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(10);
      if (data) setOrderFeed(data);
    }
    loadOrders();
  }, []);

  // ── initial scan feed load + suspicious activity check ──
  useEffect(() => {
    async function loadScans() {
      const { data: recent } = await supabase
        .from('scan_events')
        .select('id, result, scanner_id, ticket_id, scan_token, scanned_at')
        .order('scanned_at', { ascending: false })
        .limit(20);
      if (recent) setScanFeed(recent);

      // suspicious activity: fetch last 500 valid scans
      const { data: allScans } = await supabase
        .from('scan_events')
        .select('scan_token, scanner_id, scanned_at')
        .eq('result', 'valid')
        .order('scanned_at', { ascending: false })
        .limit(500);

      if (allScans && allScans.length > 0) {
        const byToken = {};
        allScans.forEach(ev => {
          if (!byToken[ev.scan_token]) byToken[ev.scan_token] = [];
          byToken[ev.scan_token].push(ev);
        });
        const suspicious = [];
        Object.entries(byToken).forEach(([token, events]) => {
          if (events.length < 2) return;
          // check if 2+ events within 5 min with different scanners
          for (let i = 0; i < events.length; i++) {
            for (let j = i + 1; j < events.length; j++) {
              const diff = Math.abs(
                new Date(events[i].scanned_at).getTime() -
                new Date(events[j].scanned_at).getTime()
              );
              if (diff <= 5 * 60 * 1000 && events[i].scanner_id !== events[j].scanner_id) {
                suspicious.push({
                  token,
                  events: events.slice(0, 5),
                  firstAt: events[events.length - 1].scanned_at,
                });
                return;
              }
            }
          }
        });
        setAlerts(suspicious);
      }
    }
    loadScans();
  }, []);

  // ── Realtime: orders ──
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        if (payload.new.status === 'paid') addToOrderFeed(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [addToOrderFeed]);

  // ── Realtime: scans ──
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-scans')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_events' }, payload => {
        addToScanFeed(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [addToScanFeed]);

  // ── derived metrics ──
  const totalSold = tiersData.reduce((a, t) => a + (t.sold_count || 0), 0);
  const totalCapacity = tiersData.reduce((a, t) => a + (t.total_capacity || 0), 0);
  const pctDoorPoort = totalSold > 0 && scannedToday != null
    ? ((scannedToday / totalSold) * 100).toFixed(1)
    : null;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '40px 48px', color: 'var(--cream)', fontFamily: 'var(--body)' }}>
      {/* Greeting */}
      <h1 style={{
        fontFamily: 'var(--display)',
        fontSize: '3.2rem',
        color: 'var(--cream)',
        margin: '0 0 6px 0',
        letterSpacing: '0.02em',
        lineHeight: 1.1,
      }}>
        Welkom terug
      </h1>
      <p style={{
        fontFamily: 'var(--mono)',
        fontSize: '0.68rem',
        letterSpacing: '0.16em',
        color: 'rgba(244,231,208,0.3)',
        margin: '0 0 40px 0',
        textTransform: 'uppercase',
      }}>
        OLF 2026 — Admin Dashboard
      </p>

      {/* ── 1. Key metrics row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 40,
      }}>
        <MetricCard
          label="Tickets verkocht"
          value={`${totalSold} / ${totalCapacity}`}
          sub={totalCapacity > 0 ? `${((totalSold / totalCapacity) * 100).toFixed(1)}% BEZETTING` : undefined}
          loading={metricsLoading}
        />
        <MetricCard
          label="Omzet"
          value={totalRevenue != null ? fmtEuro(totalRevenue) : '—'}
          loading={metricsLoading}
        />
        <MetricCard
          label="Gescand vandaag"
          value={scannedToday != null ? scannedToday : '—'}
          loading={metricsLoading}
        />
        <MetricCard
          label="% Door poort"
          value={pctDoorPoort != null ? `${pctDoorPoort}%` : '—'}
          sub={scannedToday != null && totalSold > 0 ? `${scannedToday} VAN ${totalSold}` : undefined}
          loading={metricsLoading}
        />
      </div>

      {/* ── 2. Per-tier breakdown ── */}
      {tiersData.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <SectionLabel>Ticket tiers</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {tiersData.map(tier => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Sales chart ── */}
      <div style={{ marginBottom: 40 }}>
        <SectionLabel>Verkopen per uur</SectionLabel>
        <div style={{ ...CARD_STYLE, padding: '24px 28px' }}>
          {chartLoading ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ ...MONO, color: 'rgba(244,231,208,0.25)' }}>Laden…</span>
            </div>
          ) : salesChart.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ ...MONO, color: 'rgba(244,231,208,0.25)' }}>Geen verkoopdata</span>
            </div>
          ) : (
            <div style={{ height: 200 }}>
              <Bar
                data={{
                  labels: salesChart.map(d => d.hour),
                  datasets: [{
                    data: salesChart.map(d => d.tickets),
                    backgroundColor: '#d95a2b',
                    borderRadius: 4,
                    borderSkipped: false,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(26,8,32,0.96)',
                      borderColor: 'rgba(244,231,208,0.15)',
                      borderWidth: 1,
                      titleColor: 'rgba(244,231,208,0.5)',
                      bodyColor: '#f07a3c',
                      callbacks: { label: ctx => `${ctx.raw} tickets` },
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: 'rgba(244,231,208,0.35)', font: { size: 9 } },
                      border: { display: false },
                    },
                    y: {
                      grid: { color: 'rgba(244,231,208,0.06)' },
                      ticks: { color: 'rgba(244,231,208,0.35)', font: { size: 9 }, stepSize: 1 },
                      border: { display: false },
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Suspicious activity alerts ── */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <SectionLabel>Verdachte activiteit ({alerts.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map(alert => (
              <div key={alert.token} style={{
                background: 'rgba(240,120,30,0.1)',
                border: '1px solid rgba(240,120,30,0.35)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}>
                <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>⚠</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...MONO, color: '#f07a3c', marginBottom: 5 }}>
                    Ticket gescand door meerdere scanners binnen 5 minuten
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(244,231,208,0.5)', letterSpacing: '0.06em', wordBreak: 'break-all' }}>
                    TOKEN: {alert.token}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                    {alert.events.map((ev, i) => (
                      <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(244,231,208,0.4)', letterSpacing: '0.06em' }}>
                        Scanner {ev.scanner_id?.slice(0, 8) || '?'} @ {relativeTime(ev.scanned_at)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Live feeds row ── */}
      <div>
        <SectionLabel>Live feeds</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Left: Recent orders */}
          <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px 12px',
              borderBottom: '1px solid rgba(244,231,208,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ ...MONO, color: 'rgba(244,231,208,0.5)' }}>Recente bestellingen</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
                color: '#7de87d',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#7de87d',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #7de87d',
                  animation: 'pulse 2s infinite',
                }} />
                LIVE
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
              {orderFeed.length === 0 ? (
                <div style={{ padding: '32px 20px', ...MONO, color: 'rgba(244,231,208,0.2)', textAlign: 'center' }}>
                  Geen recente bestellingen
                </div>
              ) : (
                orderFeed.map(order => {
                  const isNew = newOrderIds.has(order.id);
                  const tierName = order.ticket_tiers?.name || tierMapRef.current[order.tier_id]?.name || '—';
                  return (
                    <div key={order.id} style={{
                      padding: '12px 20px',
                      borderBottom: '1px solid rgba(244,231,208,0.05)',
                      background: isNew ? 'rgba(217,90,43,0.12)' : 'transparent',
                      transition: 'background 1.5s ease',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {order.buyer_name || <span style={{ opacity: 0.4 }}>Onbekend</span>}
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(244,231,208,0.4)', letterSpacing: '0.06em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {order.buyer_email || '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--orange-bright)', letterSpacing: '0.04em' }}>
                            {fmtEuro(order.total_cents)}
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(244,231,208,0.3)', marginTop: 2, letterSpacing: '0.06em' }}>
                            {relativeTime(order.paid_at)}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(244,231,208,0.35)', letterSpacing: '0.08em' }}>
                          {tierName}
                        </span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(244,231,208,0.2)' }}>·</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(244,231,208,0.35)', letterSpacing: '0.08em' }}>
                          {order.quantity || 1}x
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Live scan feed */}
          <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px 12px',
              borderBottom: '1px solid rgba(244,231,208,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ ...MONO, color: 'rgba(244,231,208,0.5)' }}>Scanner activiteit</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
                color: '#7de87d',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#7de87d',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #7de87d',
                }} />
                LIVE
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
              {scanFeed.length === 0 ? (
                <div style={{ padding: '32px 20px', ...MONO, color: 'rgba(244,231,208,0.2)', textAlign: 'center' }}>
                  Geen scangebeurtenissen
                </div>
              ) : (
                scanFeed.map((ev, i) => (
                  <div key={ev.id || i} style={{
                    padding: '10px 20px',
                    borderBottom: '1px solid rgba(244,231,208,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <ScanBadge result={ev.result} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(244,231,208,0.45)', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                        {ev.scanner_id ? ev.scanner_id.slice(0, 8) : '?'}
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(244,231,208,0.2)' }}>·</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(244,231,208,0.3)', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.ticket_id ? ev.ticket_id.slice(0, 8) : '—'}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(244,231,208,0.25)', letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {relativeTime(ev.scanned_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}


// ─── Login form ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      onLogin(data.session);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1e0b28',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--body)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '0 24px',
      }}>
        {/* Wordmark */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
        }}>
          <span style={{
            fontFamily: 'var(--display)',
            fontSize: '2.8rem',
            color: 'var(--orange)',
            letterSpacing: '0.03em',
            display: 'block',
          }}>OLF 2026</span>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: '0.72rem',
            color: 'var(--cream-dim)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>Admin Dashboard</span>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--purple)',
          borderRadius: '14px',
          padding: '36px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          <h1 style={{
            fontFamily: 'var(--display)',
            fontSize: '1.8rem',
            color: 'var(--cream)',
            margin: '0 0 28px 0',
            letterSpacing: '0.02em',
          }}>Inloggen</h1>

          <label style={labelStyle}>E-mailadres</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="jij@email.com"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: '18px' }}>Wachtwoord</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={inputStyle}
          />

          {error && (
            <div style={{
              marginTop: '16px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255,80,60,0.15)',
              border: '1px solid rgba(255,80,60,0.4)',
              color: '#ff6b5b',
              fontFamily: 'var(--mono)',
              fontSize: '0.82rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '28px',
              width: '100%',
              padding: '14px',
              background: loading ? 'var(--purple-soft, #7a6a9a)' : 'var(--orange)',
              color: 'var(--purple-deep)',
              border: 'none',
              borderRadius: '8px',
              fontFamily: 'var(--display)',
              fontSize: '1.1rem',
              letterSpacing: '0.06em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--orange-bright)'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--orange)'; }}
            onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {loading ? 'Bezig…' : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontFamily: 'var(--mono)',
  fontSize: '0.72rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--cream-dim)',
  marginBottom: '6px',
};

const inputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 14px',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  color: 'var(--cream)',
  fontFamily: 'var(--body)',
  fontSize: '0.95rem',
  outline: 'none',
};

// ─── Page title map ───────────────────────────────────────────────────────────

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/dashboard/': 'Dashboard',
  '/dashboard/tickets': 'Tickets',
  '/dashboard/bestellingen': 'Bestellingen',
  '/dashboard/emails': 'E-mails',
  '/dashboard/scanner': 'Scanner',
  '/dashboard/promo': 'Promo codes',
};

function getPageTitle(pathname) {
  // exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // prefix match for nested routes
  for (const [key, val] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key + '/')) return val;
  }
  return 'Dashboard';
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({ session }) {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 48px',
      background: 'rgba(36,10,48,0.95)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: 'var(--body)',
        fontSize: '0.92rem',
        fontWeight: 600,
        color: 'var(--cream)',
        letterSpacing: '0.01em',
      }}>
        {title}
      </span>
      {session?.user?.email && (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: '0.68rem',
          letterSpacing: '0.1em',
          color: 'rgba(244,231,208,0.4)',
          textTransform: 'uppercase',
        }}>
          {session.user.email}
        </span>
      )}
    </div>
  );
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({ to, label, icon }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = to === '/dashboard'
    ? location.pathname === '/dashboard' || location.pathname === '/dashboard/'
    : location.pathname.startsWith(to);

  return (
    <button
      onClick={() => navigate(to)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '10px 16px 10px 14px',
        background: 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid var(--orange)' : '2px solid transparent',
        borderRadius: '0 8px 8px 0',
        color: active ? 'var(--orange)' : 'var(--cream-dim)',
        fontFamily: 'var(--body)',
        fontSize: '0.9rem',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'color 0.15s ease, border-color 0.15s ease, background 0.15s ease',
        marginBottom: '2px',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.color = 'var(--cream)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.color = 'var(--cream-dim)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: '0.95rem', opacity: active ? 1 : 0.6, transition: 'opacity 0.15s ease' }}>{icon}</span>
      {label}
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ onSignOut }) {
  return (
    <div style={{
      width: '240px',
      minWidth: '240px',
      minHeight: '100vh',
      background: '#1e0b28',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.06)',
      padding: '0',
    }}>
      {/* Wordmark */}
      <div style={{
        padding: '32px 24px 26px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{
          fontFamily: 'var(--display)',
          fontSize: '1.7rem',
          color: 'var(--orange)',
          letterSpacing: '0.04em',
          display: 'block',
          lineHeight: 1.1,
        }}>OLF 2026</span>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: '0.62rem',
          color: 'rgba(244,231,208,0.35)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          marginTop: '4px',
          display: 'block',
        }}>Admin</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '20px 0 20px 0' }}>
        <NavItem to="/dashboard" label="Dashboard" icon="◈" />
        <NavItem to="/dashboard/tickets" label="Tickets" icon="⬡" />
        <NavItem to="/dashboard/bestellingen" label="Bestellingen" icon="≡" />
        <NavItem to="/dashboard/emails" label="E-mails" icon="✉" />
        <NavItem to="/dashboard/scanner" label="Scanner" icon="◎" />
        <NavItem to="/dashboard/promo" label="Promo codes" icon="%" />
      </nav>

      {/* Sign out + version */}
      <div style={{ padding: '16px 16px 28px' }}>
        <button
          onClick={onSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'rgba(244,231,208,0.45)',
            fontFamily: 'var(--body)',
            fontSize: '0.86rem',
            cursor: 'pointer',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#ff6b5b';
            e.currentTarget.style.borderColor = 'rgba(255,80,60,0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(244,231,208,0.45)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
        >
          <span>↩</span> Uitloggen
        </button>

        {/* Version tag */}
        <div style={{
          marginTop: '16px',
          fontFamily: 'var(--mono)',
          fontSize: '0.6rem',
          letterSpacing: '0.1em',
          color: 'rgba(244,231,208,0.2)',
          textAlign: 'center',
        }}>
          v1.0 · Sprint 1
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard shell ─────────────────────────────────────────────────────

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#1e0b28',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: '0.8rem',
          color: 'rgba(244,231,208,0.35)',
          letterSpacing: '0.12em',
        }}>LADEN…</span>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={setSession} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#1e0b28',
      fontFamily: 'var(--body)',
    }}>
      <Sidebar onSignOut={handleSignOut} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        <TopBar session={session} />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="tickets" element={<TierManagement />} />
            <Route path="bestellingen" element={<OrdersTable />} />
            <Route path="emails" element={<EmailLog />} />
            <Route path="scanner" element={<ScannerConfig />} />
            <Route path="promo" element={<PromoCodeManager />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
