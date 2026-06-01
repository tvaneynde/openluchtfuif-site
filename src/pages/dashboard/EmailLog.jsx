import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabase';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
}

const EMAIL_STATUS_CONFIG = {
  sent:     { label: 'VERZONDEN',  bg: 'rgba(80,200,80,0.12)',   border: 'rgba(120,220,120,0.35)', color: '#7de87d' },
  pending:  { label: 'WACHT',     bg: 'rgba(240,200,60,0.12)',  border: 'rgba(240,200,60,0.35)',  color: '#f0d840' },
  failed:   { label: 'MISLUKT',   bg: 'rgba(220,60,60,0.12)',   border: 'rgba(220,60,60,0.3)',    color: '#ff7070' },
  bounced:  { label: 'BOUNCED',   bg: 'rgba(160,160,160,0.1)',  border: 'rgba(160,160,160,0.28)', color: 'rgba(244,231,208,0.45)' },
};

function StatusBadge({ status }) {
  const cfg = EMAIL_STATUS_CONFIG[status] || {
    label: (status || 'ONBEKEND').toUpperCase(),
    bg: 'rgba(244,231,208,0.06)',
    border: 'rgba(244,231,208,0.18)',
    color: 'rgba(244,231,208,0.6)',
  };
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
    verticalAlign: 'middle',
  },
  trHover: {
    transition: 'background 0.1s',
  },
  btnResend: {
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
  refreshBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.14em',
    color: 'rgba(244,231,208,0.3)',
    textTransform: 'uppercase',
  },
};

// ─── ResendButton ─────────────────────────────────────────────────────────────

function ResendButton({ row }) {
  const [state, setState] = useState('idle'); // idle | loading | ok | error
  const [errMsg, setErrMsg] = useState('');

  const disabled = row.status === 'sent' || state === 'loading';

  async function handleResend() {
    if (disabled) return;
    setState('loading');
    setErrMsg('');
    try {
      const { error } = await supabase.functions.invoke('process-email-queue', {
        body: { order_id: row.order_id, force: true },
      });
      if (error) {
        setState('error');
        setErrMsg(error.message || 'Onbekende fout');
      } else {
        setState('ok');
        // Reset back to idle after 3s so user can retry again if needed
        setTimeout(() => setState('idle'), 3000);
      }
    } catch (e) {
      setState('error');
      setErrMsg(e.message || 'Onbekende fout');
    }
  }

  if (row.status === 'sent') {
    return (
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.12em',
        color: 'rgba(244,231,208,0.2)',
        whiteSpace: 'nowrap',
      }}>
        —
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <button
        style={{
          ...s.btnResend,
          opacity: state === 'loading' ? 0.5 : 1,
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
          ...(state === 'ok' ? {
            color: '#7de87d',
            borderColor: 'rgba(120,220,120,0.35)',
            background: 'rgba(80,200,80,0.1)',
          } : {}),
          ...(state === 'error' ? {
            color: '#ff7070',
            borderColor: 'rgba(220,60,60,0.35)',
            background: 'rgba(220,60,60,0.1)',
          } : {}),
        }}
        onClick={handleResend}
        disabled={disabled}
        onMouseEnter={e => {
          if (!disabled && state === 'idle') e.currentTarget.style.background = 'rgba(244,231,208,0.14)';
        }}
        onMouseLeave={e => {
          if (state === 'idle') e.currentTarget.style.background = 'rgba(244,231,208,0.07)';
        }}
      >
        {state === 'loading' ? 'Bezig…' : state === 'ok' ? '✓ Verzonden' : state === 'error' ? '✕ Fout' : 'Verstuur opnieuw'}
      </button>
      {state === 'error' && errMsg && (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: '#ff7070',
          maxWidth: 140,
          textAlign: 'right',
          lineHeight: 1.4,
          letterSpacing: '0.06em',
        }}>
          {errMsg}
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmailLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from('email_log')
      .select('*, orders(buyer_email, buyer_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setLoadError(error.message);
    } else {
      setRows(data || []);
    }
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { load(); }, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  // ── summary counts ──
  const counts = {
    sent:    rows.filter(r => r.status === 'sent').length,
    pending: rows.filter(r => r.status === 'pending').length,
    failed:  rows.filter(r => r.status === 'failed').length,
    bounced: rows.filter(r => r.status === 'bounced').length,
  };

  const summaryItems = [
    { label: 'Verzonden', value: counts.sent,    color: '#7de87d' },
    { label: 'In wacht',  value: counts.pending, color: '#f0d840' },
    { label: 'Mislukt',   value: counts.failed,  color: '#ff7070' },
    { label: 'Bounced',   value: counts.bounced, color: 'rgba(244,231,208,0.45)' },
  ];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={{ ...s.mono, opacity: 0.4, margin: '0 0 6px' }}>DASHBOARD / E-MAILS</p>
          <h1 style={s.pageTitle}>E-mail log</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {!loading && !loadError && (
            <span style={{ ...s.mono, opacity: 0.35, fontSize: 10 }}>
              {rows.length} LOGS
            </span>
          )}
          <div style={s.refreshBadge}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'rgba(244,231,208,0.3)',
              display: 'inline-block',
              animation: loading ? 'pulse 1s ease-in-out infinite' : 'none',
            }} />
            {lastRefresh
              ? `vernieuwd ${lastRefresh.toLocaleTimeString('nl-BE', { timeStyle: 'short' })}`
              : 'laden…'
            }
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {!loading && !loadError && (
        <div style={s.summaryBar}>
          {summaryItems.map(({ label, value, color }, i) => (
            <div
              key={label}
              style={{ ...s.summaryItem, ...(i === summaryItems.length - 1 ? { borderRight: 'none' } : {}) }}
            >
              <div style={s.summaryLabel}>{label}</div>
              <div style={{ ...s.summaryValue, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* States */}
      {loading && <div style={s.emptyState}>Laden…</div>}
      {loadError && <div style={s.errorBanner}>Fout bij laden: {loadError}</div>}
      {!loading && !loadError && rows.length === 0 && (
        <div style={s.emptyState}>Nog geen e-mails in de log.</div>
      )}

      {/* Table */}
      {!loading && !loadError && rows.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Datum', 'Naam', 'Email', 'Type', 'Status', 'Pogingen', 'Resend ID', 'Fout', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  style={s.trHover}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Date */}
                  <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap' }}>
                    {fmtDate(row.created_at)}
                  </td>

                  {/* Name */}
                  <td style={{ ...s.td, fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.orders?.buyer_name || <span style={{ opacity: 0.3 }}>—</span>}
                  </td>

                  {/* Email */}
                  <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.75 }}>
                    {row.orders?.buyer_email || <span style={{ opacity: 0.3 }}>—</span>}
                  </td>

                  {/* Type */}
                  <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.65, whiteSpace: 'nowrap', letterSpacing: '0.08em' }}>
                    {row.type || <span style={{ opacity: 0.3 }}>—</span>}
                  </td>

                  {/* Status */}
                  <td style={s.td}>
                    <StatusBadge status={row.status} />
                  </td>

                  {/* Attempts */}
                  <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center', opacity: row.attempts > 1 ? 1 : 0.5, color: row.attempts > 2 ? '#ff7070' : 'inherit' }}>
                    {row.attempts ?? 0}
                  </td>

                  {/* Resend ID */}
                  <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.45, whiteSpace: 'nowrap' }}>
                    {row.resend_message_id
                      ? <span title={row.resend_message_id}>{row.resend_message_id.slice(0, 8)}…</span>
                      : <span style={{ opacity: 0.3 }}>—</span>
                    }
                  </td>

                  {/* Error */}
                  <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 10, color: '#ff8080', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.error_message
                      ? <span title={row.error_message}>{row.error_message.length > 40 ? `${row.error_message.slice(0, 40)}…` : row.error_message}</span>
                      : <span style={{ opacity: 0.2 }}>—</span>
                    }
                  </td>

                  {/* Resend action */}
                  <td style={{ ...s.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <ResendButton row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
