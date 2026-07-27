import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../utils/supabase';

// Free tickets for sponsors, the partner ticket-swap deal, and crew. Real
// scannable tickets, but booked against a comp tier no purchasable path can
// see — so sales figures and public availability never move. There is no cap on
// how many can be given away; the reason on each batch is what distinguishes
// them. All bookkeeping lives in issue_comp_tickets() / revoke_comp_order().

const REASONS = [
  { value: 'sponsor',      label: 'Sponsor' },
  { value: 'partner_swap', label: 'Partnerruil' },
  { value: 'crew',         label: 'Crew' },
  { value: 'other',        label: 'Andere' },
];

const REASON_LABEL = Object.fromEntries(REASONS.map(r => [r.value, r.label]));

const QUICK_PICKS = [1, 2, 5, 10];

const ERROR_LABEL = {
  name_required:    'Naam van de ontvanger is verplicht.',
  invalid_email:    'Ongeldig e-mailadres.',
  invalid_quantity: 'Aantal moet tussen 1 en 500 liggen.',
  invalid_reason:   'Kies een geldige reden.',
  no_comp_tier:     'Geen gratis-tier gevonden — voer de migratie uit.',
  order_not_found:  'Bestelling niet gevonden.',
  not_a_comp_order: 'Dit is geen gratis bestelling.',
  already_scanned:  'Al gescand aan de poort — intrekken kan niet meer.',
};

const describeError = (res) => ERROR_LABEL[res?.error] ?? res?.error ?? 'Onbekende fout';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── styles ─────────────────────────────────────────────────────────────────

const MONO = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em' };
const CARD = {
  background: 'rgba(42,15,51,0.7)',
  border: '1px solid rgba(244,231,208,0.1)',
  borderRadius: 16,
};

const s = {
  page: {
    background: 'transparent',
    minHeight: '100vh',
    color: 'var(--cream)',
    fontFamily: 'var(--body)',
    padding: '40px 48px',
  },
  header: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    gap: 24, marginBottom: 32, flexWrap: 'wrap',
  },
  pageTitle: { fontFamily: 'var(--display)', fontSize: 48, lineHeight: 1, margin: 0 },
  sectionLabel: {
    ...MONO, fontSize: 9, color: 'rgba(244,231,208,0.35)',
    textTransform: 'uppercase', letterSpacing: '0.18em',
    marginBottom: 14, display: 'block',
  },
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 16, marginBottom: 40,
  },
  statCard: { ...CARD, padding: '18px 22px' },
  statLabel: { ...MONO, fontSize: 9, color: 'rgba(244,231,208,0.4)', textTransform: 'uppercase' },
  statValue: {
    fontFamily: 'var(--display)', fontSize: 34, lineHeight: 1.1,
    color: 'var(--orange)', marginTop: 6,
  },
  btnPrimary: {
    background: 'var(--orange)', color: '#1a0a00', border: 'none', borderRadius: 8,
    padding: '11px 24px', fontFamily: 'var(--mono)', fontSize: 12,
    letterSpacing: '0.12em', cursor: 'pointer', fontWeight: 700, transition: 'background 0.15s',
  },
  btnSecondary: {
    background: 'rgba(244,231,208,0.08)', color: 'var(--cream)',
    border: '1px solid rgba(244,231,208,0.18)', borderRadius: 8, padding: '7px 14px',
    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
    cursor: 'pointer', textDecoration: 'none', transition: 'background 0.15s',
    display: 'inline-block', whiteSpace: 'nowrap',
  },
  btnDanger: {
    background: 'rgba(220,60,60,0.15)', color: '#ff7070',
    border: '1px solid rgba(220,60,60,0.3)', borderRadius: 8, padding: '7px 14px',
    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
    cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap',
  },
  input: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: 'var(--cream)', fontFamily: 'var(--body)',
    fontSize: '0.9rem', padding: '9px 12px', outline: 'none',
    boxSizing: 'border-box', width: '100%',
  },
  label: {
    display: 'block', ...MONO, color: 'rgba(244,231,208,0.5)',
    marginBottom: 5, textTransform: 'uppercase',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    ...MONO, fontSize: 9, color: 'rgba(244,231,208,0.35)', textAlign: 'left',
    padding: '10px 14px', borderBottom: '1px solid rgba(244,231,208,0.07)',
    textTransform: 'uppercase', letterSpacing: '0.14em',
  },
  td: {
    padding: '13px 14px', borderBottom: '1px solid rgba(244,231,208,0.05)',
    fontSize: '0.88rem', verticalAlign: 'middle',
  },
  errorBox: {
    background: 'rgba(220,40,40,0.15)', border: '1px solid rgba(220,40,40,0.4)',
    borderRadius: 8, padding: '10px 14px', color: '#ff8080', fontSize: '0.85rem',
    marginBottom: 16, fontFamily: 'var(--mono)', letterSpacing: '0.04em',
  },
  successBox: {
    background: 'rgba(80,200,80,0.1)', border: '1px solid rgba(80,200,80,0.3)',
    borderRadius: 8, padding: '10px 14px', color: '#7de87d', fontSize: '0.85rem',
    marginBottom: 16, fontFamily: 'var(--mono)', letterSpacing: '0.04em',
  },
  emptyState: {
    ...MONO, fontSize: 11, color: 'rgba(244,231,208,0.3)',
    padding: '48px 0', textAlign: 'center',
  },
  // modal
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(10,4,14,0.75)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '48px 20px', overflowY: 'auto',
  },
  modal: {
    ...CARD,
    background: '#25102f',
    width: '100%', maxWidth: 560,
    boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
  },
  modalHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '22px 26px 18px', borderBottom: '1px solid rgba(244,231,208,0.08)',
  },
  modalTitle: { fontFamily: 'var(--display)', fontSize: 28, lineHeight: 1, margin: 0 },
  modalBody: { padding: '22px 26px' },
  modalFoot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '18px 26px 22px',
    borderTop: '1px solid rgba(244,231,208,0.08)', flexWrap: 'wrap',
  },
  closeBtn: {
    background: 'transparent', border: '1px solid rgba(244,231,208,0.18)',
    color: 'rgba(244,231,208,0.6)', borderRadius: 999,
    width: 32, height: 32, cursor: 'pointer', fontSize: 15, lineHeight: 1,
  },
  fieldRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16, marginBottom: 18,
  },
  quickPick: (active) => ({
    padding: '8px 0', minWidth: 46,
    background: active ? 'var(--orange)' : 'rgba(244,231,208,0.07)',
    border: active ? '1px solid var(--orange)' : '1px solid rgba(244,231,208,0.16)',
    color: active ? '#1a0a00' : 'var(--cream)',
    borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13,
    fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all 0.12s',
  }),
};

// ─── Issue modal ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  recipient_name: '', email: '', quantity: '1',
  reason: 'sponsor', note: '', send_email: true,
};

function IssueModal({ onClose, onIssued }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // One key per modal session. A double-clicked submit reuses it, so the RPC
  // recognises the retry and returns the original batch instead of issuing a
  // second set of tickets.
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setError(null);
  }

  const qty = Number(form.quantity);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    if (!form.recipient_name.trim()) return setError('Naam van de ontvanger is verplicht.');
    if (!form.email.trim()) return setError('E-mailadres is verplicht.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) return setError('Aantal moet tussen 1 en 500 liggen.');

    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc('issue_comp_tickets', {
      p_recipient_name:  form.recipient_name,
      p_email:           form.email,
      p_quantity:        qty,
      p_reason:          form.reason,
      p_note:            form.note,
      p_send_email:      form.send_email,
      p_idempotency_key: idempotencyKey.current,
    });
    setSaving(false);

    if (rpcError) return setError(rpcError.message);
    if (!data?.success) return setError(describeError(data));

    if (data.already_processed) {
      onIssued({ ok: true, message: 'Deze tickets waren al uitgegeven — niets dubbel aangemaakt.' });
      return;
    }

    const who = form.recipient_name.trim();
    const made = `${data.tickets_issued} gratis ticket(s) voor ${who} aangemaakt`;

    if (!form.send_email) {
      onIssued({ ok: true, message: `${made}. Download de PDF in de lijst.` });
      return;
    }

    // Kick the queue ourselves. issue_comp_tickets only enqueues the email_log
    // row; a sale gets the worker invoked directly by mollie-webhook, and comps
    // have no webhook — so without this the mail waits on the pg_cron safety net
    // and may never go out at all.
    setSaving(true);
    const { error: mailError } = await supabase.functions.invoke('process-email-queue', {
      body: { order_id: data.order_id },
    });
    setSaving(false);

    onIssued(mailError
      ? { ok: false, message: `${made}, maar de e-mail kon niet verstuurd worden (${mailError.message}). Probeer de Mail-knop in de lijst.` }
      : { ok: true, message: `${made} en gemaild naar ${form.email.trim()}.` });
  }

  return (
    <div style={s.overlay} onClick={() => !saving && onClose()}>
      <form style={s.modal} onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div style={s.modalHead}>
          <h2 style={s.modalTitle}>Gratis tickets uitgeven</h2>
          <button type="button" style={s.closeBtn} onClick={onClose} disabled={saving} aria-label="Sluiten">
            ✕
          </button>
        </div>

        <div style={s.modalBody}>
          {error && <div style={s.errorBox}>{error}</div>}

          <div style={s.fieldRow}>
            <div>
              <label style={s.label}>Ontvanger</label>
              <input
                style={s.input} type="text" placeholder="Brouwerij Van Dale" autoFocus
                value={form.recipient_name} onChange={e => set('recipient_name', e.target.value)}
              />
            </div>
            <div>
              <label style={s.label}>E-mail</label>
              <input
                style={s.input} type="email" placeholder="contact@sponsor.be"
                value={form.email} onChange={e => set('email', e.target.value)}
              />
            </div>
          </div>

          {/* Quantity is the bulk control: one batch, N tickets, one mail. */}
          <div style={{ marginBottom: 18 }}>
            <label style={s.label}>Aantal tickets</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {QUICK_PICKS.map(n => (
                <button
                  key={n} type="button"
                  style={s.quickPick(qty === n)}
                  onClick={() => set('quantity', String(n))}
                >
                  {n}
                </button>
              ))}
              <input
                style={{ ...s.input, width: 90, textAlign: 'center', fontFamily: 'var(--mono)' }}
                type="number" min="1" max="500"
                value={form.quantity} onChange={e => set('quantity', e.target.value)}
              />
              <span style={{ ...MONO, fontSize: 10, opacity: 0.35 }}>OF TYPE EEN AANTAL</span>
            </div>
          </div>

          <div style={s.fieldRow}>
            <div>
              <label style={s.label}>Reden</label>
              <select style={s.input} value={form.reason} onChange={e => set('reason', e.target.value)}>
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Notitie (optioneel)</label>
              <input
                style={s.input} type="text" placeholder="Ruildeal 2026"
                value={form.note} onChange={e => set('note', e.target.value)}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, opacity: 0.85 }}>
            <input
              type="checkbox" checked={form.send_email}
              onChange={e => set('send_email', e.target.checked)}
              style={{ accentColor: 'var(--orange)', width: 16, height: 16 }}
            />
            Stuur de tickets meteen per e-mail naar de ontvanger
          </label>
          {!form.send_email && (
            <p style={{ ...MONO, fontSize: 10, opacity: 0.4, margin: '8px 0 0', letterSpacing: '0.1em' }}>
              DOWNLOAD DE PDF DAARNA MET DE PDF-KNOP IN DE LIJST
            </p>
          )}
        </div>

        <div style={s.modalFoot}>
          <span style={{ ...MONO, fontSize: 10, opacity: 0.4 }}>
            {Number.isInteger(qty) && qty > 0 ? `${qty} TICKET(S)` : ''}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={s.btnSecondary} onClick={onClose} disabled={saving}>
              Annuleer
            </button>
            <button type="submit" style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Bezig…' : 'Genereer tickets'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Batch row actions ───────────────────────────────────────────────────────

function ResendButton({ orderId }) {
  const [state, setState] = useState('idle');

  async function handleResend() {
    if (state === 'loading') return;
    setState('loading');
    const { error } = await supabase.functions.invoke('process-email-queue', {
      body: { order_id: orderId, force: true },
    });
    setState(error ? 'error' : 'ok');
    setTimeout(() => setState('idle'), 3000);
  }

  return (
    <button
      style={{
        ...s.btnSecondary,
        ...(state === 'ok' ? { color: '#7de87d', borderColor: 'rgba(120,220,120,0.35)' } : {}),
        ...(state === 'error' ? { color: '#ff7070', borderColor: 'rgba(220,60,60,0.35)' } : {}),
      }}
      onClick={handleResend}
      disabled={state === 'loading'}
    >
      {state === 'loading' ? 'Bezig…' : state === 'ok' ? '✓ Verzonden' : state === 'error' ? '✕ Fout' : 'Mail'}
    </button>
  );
}

function RevokeButton({ orderId, onRevoked }) {
  const [state, setState] = useState('idle'); // idle | confirm | loading
  const [error, setError] = useState(null);

  async function handleRevoke() {
    setState('loading');
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('revoke_comp_order', { p_order_id: orderId });
    if (rpcError) { setError(rpcError.message); setState('idle'); return; }
    if (!data?.success) { setError(describeError(data)); setState('idle'); return; }
    onRevoked();
  }

  if (state === 'confirm') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={s.btnDanger} onClick={handleRevoke}>Zeker?</button>
        <button style={s.btnSecondary} onClick={() => setState('idle')}>Nee</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <button
        style={{ ...s.btnDanger, opacity: state === 'loading' ? 0.6 : 1 }}
        onClick={() => setState('confirm')}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? 'Bezig…' : 'Intrekken'}
      </button>
      {error && (
        <span style={{ ...MONO, fontSize: 8, color: '#ff7070', maxWidth: 160, textAlign: 'right', lineHeight: 1.4 }}>
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CompTickets() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [flash, setFlash] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from('orders')
      .select('*, ticket_tiers(name)')
      .eq('order_type', 'comp')
      .order('created_at', { ascending: false });

    if (error) setLoadError(error.message);
    if (data) setBatches(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleIssued(result) {
    setModalOpen(false);
    setFlash(result);
    load();
  }

  const active = batches.filter(b => b.status === 'paid');
  const totalIssued = active.reduce((a, b) => a + (b.quantity || 0), 0);
  const byReason = REASONS.map(r => ({
    label: r.label,
    count: active.filter(b => b.comp_reason === r.value).reduce((a, b) => a + (b.quantity || 0), 0),
  })).filter(r => r.count > 0);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <p style={{ ...MONO, fontSize: 10, opacity: 0.4, margin: '0 0 6px' }}>DASHBOARD / GRATIS TICKETS</p>
          <h1 style={s.pageTitle}>Gratis tickets</h1>
        </div>
        <button style={s.btnPrimary} onClick={() => { setFlash(null); setModalOpen(true); }}>
          + Tickets uitgeven
        </button>
      </div>

      {flash && (
        <div style={flash.ok ? s.successBox : s.errorBox}>{flash.message}</div>
      )}
      {loadError && <div style={s.errorBox}>Fout bij laden: {loadError}</div>}

      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statLabel}>Totaal uitgegeven</div>
          <div style={s.statValue}>{totalIssued}</div>
        </div>
        {byReason.map(r => (
          <div key={r.label} style={s.statCard}>
            <div style={s.statLabel}>{r.label}</div>
            <div style={{ ...s.statValue, color: 'var(--purple-mauve)' }}>{r.count}</div>
          </div>
        ))}
      </div>

      <span style={s.sectionLabel}>Uitgegeven</span>
      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading && <div style={s.emptyState}>LADEN…</div>}
        {!loading && batches.length === 0 && (
          <div style={s.emptyState}>NOG NIETS UITGEGEVEN</div>
        )}
        {!loading && batches.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Datum</th>
                  <th style={s.th}>Ontvanger</th>
                  <th style={s.th}>E-mail</th>
                  <th style={s.th}>Reden</th>
                  <th style={s.th}>Aantal</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Acties</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => {
                  const revoked = b.status !== 'paid';
                  return (
                    <tr key={b.id} style={{ opacity: revoked ? 0.45 : 1 }}>
                      <td style={{ ...s.td, ...MONO, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {fmtDate(b.created_at)}
                      </td>
                      <td style={{ ...s.td, fontWeight: 500 }}>
                        {b.buyer_name}
                        {b.comp_note && (
                          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{b.comp_note}</div>
                        )}
                      </td>
                      <td style={{ ...s.td, ...MONO, fontSize: 11, opacity: 0.75 }}>{b.buyer_email}</td>
                      <td style={{ ...s.td, fontSize: 12, opacity: 0.7 }}>
                        {REASON_LABEL[b.comp_reason] ?? b.comp_reason ?? '—'}
                      </td>
                      <td style={{ ...s.td, ...MONO, fontSize: 12 }}>
                        {b.quantity}
                        {revoked && (
                          <span style={{ ...MONO, fontSize: 9, color: '#ff7070', marginLeft: 8 }}>
                            INGETROKKEN
                          </span>
                        )}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        {!revoked && (
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                            <a
                              style={s.btnSecondary}
                              href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-ticket?order_id=${b.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              PDF
                            </a>
                            <ResendButton orderId={b.id} />
                            <RevokeButton orderId={b.id} onRevoked={load} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <IssueModal onClose={() => setModalOpen(false)} onIssued={handleIssued} />
      )}
    </div>
  );
}
