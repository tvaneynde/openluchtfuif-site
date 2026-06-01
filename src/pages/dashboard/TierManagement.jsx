import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

// ─── helpers ────────────────────────────────────────────────────────────────

function centsToEuro(cents) {
  if (cents == null || cents === '') return '';
  return (cents / 100).toFixed(2);
}
function euroToCents(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n * 100);
}
function fmtEuro(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}
function fmtDatetimeLocal(iso) {
  if (!iso) return '';
  // strip seconds/tz for <input type="datetime-local">
  return iso.slice(0, 16);
}

const EMPTY_FORM = {
  name: '',
  description: '',
  price_euros: '',
  fee_euros: '',
  total_capacity: '',
  sale_starts_at: '',
  sale_ends_at: '',
  is_active: false,
  sort_order: 0,
};

// ─── styles ─────────────────────────────────────────────────────────────────

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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  pageTitle: {
    fontFamily: 'var(--display)',
    fontSize: 48,
    lineHeight: 1,
    margin: 0,
  },
  mono: { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em' },
  btnPrimary: {
    background: 'var(--orange)',
    color: '#1a0a00',
    border: 'none',
    borderRadius: 8,
    padding: '10px 22px',
    fontFamily: 'var(--mono)',
    fontSize: 12,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    fontWeight: 700,
    transition: 'background 0.15s',
  },
  btnSecondary: {
    background: 'rgba(244,231,208,0.08)',
    color: 'var(--cream)',
    border: '1px solid rgba(244,231,208,0.18)',
    borderRadius: 8,
    padding: '8px 16px',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btnDanger: {
    background: 'rgba(220,60,60,0.15)',
    color: '#ff7070',
    border: '1px solid rgba(220,60,60,0.3)',
    borderRadius: 8,
    padding: '8px 16px',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(244,231,208,0.1)',
    borderRadius: 16,
    padding: '24px 28px',
    marginBottom: 14,
    position: 'relative',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  tierName: {
    fontFamily: 'var(--display)',
    fontSize: 26,
    lineHeight: 1.1,
    margin: 0,
  },
  badge: (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    borderRadius: 999,
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.14em',
    cursor: 'pointer',
    border: active ? '1px solid rgba(120,220,120,0.4)' : '1px solid rgba(244,231,208,0.18)',
    background: active ? 'rgba(80,200,80,0.12)' : 'rgba(244,231,208,0.06)',
    color: active ? '#7de87d' : 'rgba(244,231,208,0.45)',
    transition: 'all 0.15s',
    userSelect: 'none',
  }),
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 16,
    marginBottom: 14,
  },
  stat: {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: '10px 14px',
  },
  statLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.18em',
    opacity: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    background: 'rgba(244,231,208,0.12)',
    overflow: 'hidden',
  },
  actionRow: {
    display: 'flex',
    gap: 8,
    marginTop: 16,
  },
  // ── modal overlay ──
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(10,4,14,0.82)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 24px',
    overflowY: 'auto',
  },
  modal: {
    background: 'var(--purple-deep)',
    border: '1px solid rgba(244,231,208,0.15)',
    borderRadius: 20,
    padding: '40px',
    width: '100%',
    maxWidth: 560,
    position: 'relative',
  },
  modalTitle: {
    fontFamily: 'var(--display)',
    fontSize: 36,
    margin: '0 0 32px',
    lineHeight: 1,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px 24px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  formGroupFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    gridColumn: '1 / -1',
  },
  label: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.16em',
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(244,231,208,0.18)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--cream)',
    fontFamily: 'var(--body)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  textarea: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(244,231,208,0.18)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--cream)',
    fontFamily: 'var(--body)',
    fontSize: 14,
    outline: 'none',
    resize: 'vertical',
    minHeight: 72,
  },
  modalFooter: {
    display: 'flex',
    gap: 12,
    marginTop: 32,
    justifyContent: 'flex-end',
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

// ─── ToggleSwitch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: checked ? '1.5px solid rgba(120,220,120,0.5)' : '1.5px solid rgba(244,231,208,0.2)',
        background: checked ? 'rgba(80,200,80,0.25)' : 'rgba(244,231,208,0.08)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
      aria-checked={checked}
      role="switch"
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: checked ? 22 : 3,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: checked ? '#7de87d' : 'rgba(244,231,208,0.4)',
        transition: 'left 0.2s, background 0.2s',
      }} />
    </button>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ sold, total }) {
  const pct = total > 0 ? Math.min(100, (sold / total) * 100) : 0;
  const color = pct >= 90 ? '#ff7070' : pct >= 60 ? 'var(--orange)' : 'var(--orange-bright)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ ...s.mono, opacity: 0.5 }}>VERKOCHT</span>
        <span style={{ ...s.mono, fontSize: 10 }}>
          {sold} / {total} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div style={s.progressTrack}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ─── TierForm (shared for create + edit) ────────────────────────────────────

function TierForm({ initial, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(initial);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off">
      {error && <div style={s.errorBanner}>{error}</div>}
      <div style={s.formGrid}>
        <div style={s.formGroupFull}>
          <label style={s.label}>Naam *</label>
          <input
            style={s.input}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
            placeholder="Early Bird, Standaard, VIP…"
          />
        </div>
        <div style={s.formGroupFull}>
          <label style={s.label}>Beschrijving</label>
          <textarea
            style={s.textarea}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Optionele beschrijving van de tier"
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Prijs (€) *</label>
          <input
            style={s.input}
            type="number"
            step="0.01"
            min="0"
            value={form.price_euros}
            onChange={e => set('price_euros', e.target.value)}
            required
            placeholder="12.50"
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Service fee (€)</label>
          <input
            style={s.input}
            type="number"
            step="0.01"
            min="0"
            value={form.fee_euros}
            onChange={e => set('fee_euros', e.target.value)}
            placeholder="1.50"
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Totale capaciteit *</label>
          <input
            style={s.input}
            type="number"
            min="1"
            value={form.total_capacity}
            onChange={e => set('total_capacity', e.target.value)}
            required
            placeholder="500"
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Sorteervolgorde</label>
          <input
            style={s.input}
            type="number"
            min="0"
            value={form.sort_order}
            onChange={e => set('sort_order', e.target.value)}
            placeholder="0"
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Verkoop start</label>
          <input
            style={s.input}
            type="datetime-local"
            value={form.sale_starts_at}
            onChange={e => set('sale_starts_at', e.target.value)}
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Verkoop einde</label>
          <input
            style={s.input}
            type="datetime-local"
            value={form.sale_ends_at}
            onChange={e => set('sale_ends_at', e.target.value)}
          />
        </div>
        <div style={{ ...s.formGroup, gridColumn: '1 / -1' }}>
          <label style={s.label}>Status</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Toggle checked={form.is_active} onChange={val => set('is_active', val)} />
            <span style={{ fontSize: 13, opacity: 0.7 }}>
              {form.is_active ? 'Actief — zichtbaar voor kopers' : 'Inactief — verborgen'}
            </span>
          </div>
        </div>
      </div>
      <div style={s.modalFooter}>
        <button type="button" style={s.btnSecondary} onClick={onCancel} disabled={saving}>
          Annuleer
        </button>
        <button
          type="submit"
          style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1 }}
          disabled={saving}
        >
          {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>
    </form>
  );
}

// ─── TierCard ────────────────────────────────────────────────────────────────

function TierCard({ tier, onEdit, onDelete, onToggleActive }) {
  const remaining = tier.total_capacity - tier.sold_count;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h3 style={s.tierName}>{tier.name}</h3>
            <button
              style={s.badge(tier.is_active)}
              onClick={() => onToggleActive(tier)}
              title={tier.is_active ? 'Klik om te deactiveren' : 'Klik om te activeren'}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: tier.is_active ? '#7de87d' : 'rgba(244,231,208,0.3)',
                display: 'inline-block',
              }} />
              {tier.is_active ? 'ACTIEF' : 'INACTIEF'}
            </button>
          </div>
          {tier.description && (
            <p style={{ margin: 0, opacity: 0.55, fontSize: 13, maxWidth: 480 }}>{tier.description}</p>
          )}
        </div>
        <div style={{ ...s.mono, opacity: 0.4, fontSize: 10, whiteSpace: 'nowrap', marginTop: 4 }}>
          #{tier.sort_order}
        </div>
      </div>

      <div style={s.statsRow}>
        <div style={s.stat}>
          <div style={s.statLabel}>Prijs</div>
          <div style={s.statValue}>{fmtEuro(tier.price_cents)}</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>Service fee</div>
          <div style={s.statValue}>{fmtEuro(tier.fee_cents)}</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>Totaal</div>
          <div style={s.statValue}>{fmtEuro(tier.price_cents + tier.fee_cents)}</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>Capaciteit</div>
          <div style={s.statValue}>{tier.total_capacity}</div>
        </div>
        <div style={{ ...s.stat, background: remaining <= 0 ? 'rgba(220,60,60,0.12)' : remaining < 20 ? 'rgba(240,140,40,0.12)' : 'rgba(0,0,0,0.2)' }}>
          <div style={s.statLabel}>Beschikbaar</div>
          <div style={{ ...s.statValue, color: remaining <= 0 ? '#ff7070' : remaining < 20 ? 'var(--orange)' : 'var(--cream)' }}>
            {remaining}
          </div>
        </div>
      </div>

      <ProgressBar sold={tier.sold_count} total={tier.total_capacity} />

      {(tier.sale_starts_at || tier.sale_ends_at) && (
        <div style={{ marginTop: 12, display: 'flex', gap: 24, opacity: 0.5 }}>
          {tier.sale_starts_at && (
            <span style={{ ...s.mono, fontSize: 10 }}>
              START: {new Date(tier.sale_starts_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
          {tier.sale_ends_at && (
            <span style={{ ...s.mono, fontSize: 10 }}>
              EINDE: {new Date(tier.sale_ends_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </div>
      )}

      <div style={s.actionRow}>
        <button
          style={s.btnSecondary}
          onClick={() => onEdit(tier)}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,0.08)'}
        >
          Bewerken
        </button>
        <button
          style={s.btnDanger}
          onClick={() => onDelete(tier)}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,60,60,0.28)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,60,60,0.15)'}
        >
          Verwijderen
        </button>
      </div>
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ tier, onConfirm, onCancel }) {
  return (
    <div style={s.overlay} onClick={onCancel}>
      <div
        style={{ ...s.modal, maxWidth: 420, marginTop: 120 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 28, margin: '0 0 12px' }}>
          Tier verwijderen?
        </h3>
        <p style={{ opacity: 0.65, fontSize: 14, margin: '0 0 32px', lineHeight: 1.6 }}>
          Je staat op het punt om <strong style={{ color: 'var(--orange)' }}>{tier.name}</strong> te verwijderen.
          Dit kan niet ongedaan worden gemaakt. Bestaande orders blijven bewaard.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button style={s.btnSecondary} onClick={onCancel}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,0.08)'}
          >
            Annuleer
          </button>
          <button style={{ ...s.btnDanger, padding: '10px 22px', fontSize: 12 }}
            onClick={onConfirm}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,60,60,0.35)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,60,60,0.15)'}
          >
            Ja, verwijderen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TierManagement() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // modal state: null | 'create' | { tier }
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // delete confirm
  const [deletingTier, setDeletingTier] = useState(null);

  // ── load ──
  async function loadTiers() {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('ticket_tiers')
      .select('*')
      .order('sort_order');
    if (error) { setLoadError(error.message); }
    else { setTiers(data); }
    setLoading(false);
  }

  useEffect(() => { loadTiers(); }, []);

  // ── helpers to build DB payload ──
  function formToPayload(form) {
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: euroToCents(form.price_euros),
      fee_cents: euroToCents(form.fee_euros || '0'),
      total_capacity: parseInt(form.total_capacity, 10),
      sale_starts_at: form.sale_starts_at || null,
      sale_ends_at: form.sale_ends_at || null,
      is_active: form.is_active,
      sort_order: parseInt(form.sort_order, 10) || 0,
    };
  }

  // ── create ──
  async function handleCreate(form) {
    setSaving(true);
    setFormError(null);
    const { error } = await supabase
      .from('ticket_tiers')
      .insert(formToPayload(form));
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    setModal(null);
    loadTiers();
  }

  // ── edit ──
  function openEdit(tier) {
    setFormError(null);
    setModal({
      tier,
      initial: {
        name: tier.name,
        description: tier.description || '',
        price_euros: centsToEuro(tier.price_cents),
        fee_euros: centsToEuro(tier.fee_cents),
        total_capacity: tier.total_capacity,
        sale_starts_at: fmtDatetimeLocal(tier.sale_starts_at),
        sale_ends_at: fmtDatetimeLocal(tier.sale_ends_at),
        is_active: tier.is_active,
        sort_order: tier.sort_order,
      },
    });
  }

  async function handleEdit(form) {
    setSaving(true);
    setFormError(null);
    const { error } = await supabase
      .from('ticket_tiers')
      .update(formToPayload(form))
      .eq('id', modal.tier.id);
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    setModal(null);
    loadTiers();
  }

  // ── toggle active ──
  async function handleToggleActive(tier) {
    await supabase
      .from('ticket_tiers')
      .update({ is_active: !tier.is_active })
      .eq('id', tier.id);
    loadTiers();
  }

  // ── delete ──
  async function handleDelete() {
    const { error } = await supabase
      .from('ticket_tiers')
      .delete()
      .eq('id', deletingTier.id);
    setDeletingTier(null);
    if (!error) loadTiers();
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={{ ...s.mono, opacity: 0.4, margin: '0 0 6px' }}>DASHBOARD / TICKETS</p>
          <h1 style={s.pageTitle}>Ticket Tiers</h1>
        </div>
        <button
          style={s.btnPrimary}
          onClick={() => { setFormError(null); setModal('create'); }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--orange-bright)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--orange)'}
        >
          + Nieuwe tier
        </button>
      </div>

      {/* Summary strip */}
      {!loading && !loadError && tiers.length > 0 && (
        <div style={{
          display: 'flex', gap: 16, marginBottom: 32,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(244,231,208,0.08)',
          borderRadius: 12, padding: '16px 24px',
        }}>
          {[
            { label: 'Tiers', val: tiers.length },
            { label: 'Actief', val: tiers.filter(t => t.is_active).length },
            { label: 'Totale capaciteit', val: tiers.reduce((a, t) => a + t.total_capacity, 0) },
            { label: 'Totaal verkocht', val: tiers.reduce((a, t) => a + t.sold_count, 0) },
            { label: 'Beschikbaar', val: tiers.reduce((a, t) => a + (t.total_capacity - t.sold_count), 0) },
          ].map(({ label, val }) => (
            <div key={label} style={{ paddingRight: 20, borderRight: '1px solid rgba(244,231,208,0.08)', lastChild: { border: 'none' } }}>
              <div style={{ ...s.mono, fontSize: 9, opacity: 0.45, marginBottom: 4 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--orange-bright)' }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* States */}
      {loading && (
        <div style={s.emptyState}>Laden…</div>
      )}
      {loadError && (
        <div style={s.errorBanner}>Fout bij laden: {loadError}</div>
      )}
      {!loading && !loadError && tiers.length === 0 && (
        <div style={s.emptyState}>Nog geen tiers. Maak je eerste tier aan.</div>
      )}

      {/* Tier cards */}
      {!loading && !loadError && tiers.map(tier => (
        <TierCard
          key={tier.id}
          tier={tier}
          onEdit={openEdit}
          onDelete={setDeletingTier}
          onToggleActive={handleToggleActive}
        />
      ))}

      {/* Create modal */}
      {modal === 'create' && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Nieuwe tier</h2>
            <TierForm
              initial={EMPTY_FORM}
              onSave={handleCreate}
              onCancel={() => setModal(null)}
              saving={saving}
              error={formError}
            />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal && modal !== 'create' && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Tier bewerken</h2>
            <TierForm
              initial={modal.initial}
              onSave={handleEdit}
              onCancel={() => setModal(null)}
              saving={saving}
              error={formError}
            />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingTier && (
        <ConfirmDialog
          tier={deletingTier}
          onConfirm={handleDelete}
          onCancel={() => setDeletingTier(null)}
        />
      )}

      <style>{`
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: invert(0.7);
          cursor: pointer;
        }
        input:focus, textarea:focus {
          border-color: var(--orange) !important;
        }
      `}</style>
    </div>
  );
}
