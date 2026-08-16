import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDiscount(type, value) {
  if (type === 'percent') return `${value}%`;
  return `€${(value / 100).toFixed(2)} korting`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
}

// <input type="datetime-local"> speaks LOCAL time. Slicing the stored ISO string
// would hand it a UTC value, so every edit-and-save would silently drag the
// expiry back by the timezone offset — two hours per save in Belgian summer.
function fmtDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function centsToEuroInput(cents) {
  return (cents / 100).toFixed(2);
}

/** A stored row → the shape the form edits. */
function codeToForm(code) {
  return {
    code: code.code,
    description: code.description || '',
    discount_type: code.discount_type,
    // Fixed discounts are stored in cents and edited in euros.
    discount_value: code.discount_type === 'percent'
      ? String(code.discount_value)
      : centsToEuroInput(code.discount_value),
    max_uses: code.max_uses == null ? '' : String(code.max_uses),
    valid_until: fmtDateInput(code.valid_until),
    tier_id: code.tier_id || '',
    is_active: code.is_active,
  };
}

const EMPTY_FORM = {
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: '',
  max_uses: '',
  valid_until: '',
  tier_id: '',
  is_active: true,
};

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
    padding: '6px 14px',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.12em',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: 'var(--cream)',
    fontFamily: 'var(--body)',
    fontSize: '0.9rem',
    padding: '9px 12px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
  },
  label: {
    display: 'block',
    ...MONO,
    color: 'rgba(244,231,208,0.5)',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  fieldGroup: { marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    ...MONO,
    fontSize: 9,
    color: 'rgba(244,231,208,0.35)',
    textAlign: 'left',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(244,231,208,0.07)',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  },
  td: {
    padding: '13px 14px',
    borderBottom: '1px solid rgba(244,231,208,0.05)',
    fontSize: '0.88rem',
    verticalAlign: 'middle',
  },
  errorBox: {
    background: 'rgba(220,40,40,0.15)',
    border: '1px solid rgba(220,40,40,0.4)',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#ff8080',
    fontSize: '0.85rem',
    marginBottom: 16,
    fontFamily: 'var(--mono)',
    letterSpacing: '0.04em',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,3,14,0.75)',
    backdropFilter: 'blur(3px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 24px',
    overflowY: 'auto',
  },
  modal: {
    ...CARD,
    background: '#2a0f33',
    padding: '28px 32px',
    width: '100%',
    maxWidth: 680,
  },
  successBox: {
    background: 'rgba(80,200,80,0.1)',
    border: '1px solid rgba(80,200,80,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#7de87d',
    fontSize: '0.85rem',
    marginBottom: 16,
    fontFamily: 'var(--mono)',
    letterSpacing: '0.04em',
  },
};

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ActiveToggle({ active, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!active)}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: active ? '1px solid rgba(120,220,120,0.4)' : '1px solid rgba(244,231,208,0.18)',
        background: active ? 'rgba(80,200,80,0.12)' : 'rgba(244,231,208,0.06)',
        color: active ? '#7de87d' : 'rgba(244,231,208,0.4)',
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.14em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#7de87d' : 'rgba(244,231,208,0.3)', display: 'inline-block' }} />
      {active ? 'ACTIEF' : 'INACTIEF'}
    </button>
  );
}

// ─── Create / edit form ───────────────────────────────────────────────────────
// One component for both. `editing` is the stored row when this is an edit, and
// null when it is the create card at the top of the page.

function CodeForm({ onSaved, onCancel, tiers, editing = null }) {
  const [form, setForm] = useState(editing ? codeToForm(editing) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // orders.promo_code is a foreign key onto promo_codes.code with no ON UPDATE
  // CASCADE, so renaming a code that an order already points at fails with a raw
  // constraint error. Lock the field instead of letting the save blow up.
  const codeLocked = !!editing && (editing.used_count ?? 0) > 0;

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const code = form.code.trim().toUpperCase();
    if (!code) return setError('Code is verplicht');
    if (!form.discount_value || isNaN(Number(form.discount_value)) || Number(form.discount_value) <= 0) {
      return setError('Voer een geldig kortingsbedrag in');
    }
    if (form.discount_type === 'percent' && Number(form.discount_value) > 100) {
      return setError('Percentage kan niet hoger zijn dan 100');
    }
    // Lowering the cap below what has already been handed out would make the
    // code read as exhausted for reasons nobody can see from the form.
    if (editing && form.max_uses && Number(form.max_uses) < (editing.used_count ?? 0)) {
      return setError(`Deze code is al ${editing.used_count}× gebruikt — max. gebruik kan niet lager liggen`);
    }

    setSaving(true);
    const payload = {
      code,
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      discount_value: form.discount_type === 'percent'
        ? Number(form.discount_value)
        : Math.round(Number(form.discount_value) * 100), // store fixed as cents
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      // NULL = every tier, which is how every code behaved before this field
      // existed. Set = create-payment refuses the code on any other tier.
      tier_id: form.tier_id || null,
      is_active: form.is_active,
    };
    // used_count is deliberately absent from the payload — it is a running total
    // of real orders, not a setting.

    const { error: saveErr } = editing
      ? await supabase.from('promo_codes').update(payload).eq('id', editing.id)
      : await supabase.from('promo_codes').insert(payload);
    setSaving(false);

    if (saveErr) {
      setError(saveErr.message.includes('duplicate') ? 'Deze code bestaat al' : saveErr.message);
      return;
    }

    setSuccess(true);
    if (!editing) setForm(EMPTY_FORM);
    onSaved();
  }

  const fieldStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

  return (
    <div style={editing ? { padding: 0 } : { ...CARD, padding: '28px 32px', marginBottom: 32 }}>
      {!editing && (
        <div style={{ ...MONO, color: 'var(--orange)', opacity: 0.85, marginBottom: 20, textTransform: 'uppercase' }}>
          Nieuwe promotiecode
        </div>
      )}

      {error && <div style={s.errorBox}>{error}</div>}
      {success && <div style={s.successBox}>{editing ? 'Wijzigingen opgeslagen.' : 'Code aangemaakt.'}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div style={fieldStyle}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Code *</label>
            <input
              type="text"
              value={form.code}
              onChange={e => set('code', e.target.value.toUpperCase())}
              placeholder="PERS2026"
              disabled={codeLocked}
              style={{
                ...s.input,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                opacity: codeLocked ? 0.5 : 1,
                cursor: codeLocked ? 'not-allowed' : 'text',
              }}
              required
            />
            {codeLocked && (
              <div style={{ ...MONO, color: 'rgba(244,231,208,0.35)', marginTop: 6, letterSpacing: '0.08em' }}>
                Al gebruikt in {editing.used_count} bestelling(en) — de code zelf
                ligt vast. Zet hem op inactief om hem te stoppen.
              </div>
            )}
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Beschrijving</label>
            <input
              type="text"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="bv. Perskorting 2026"
              style={s.input}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Type korting *</label>
            <select
              value={form.discount_type}
              onChange={e => set('discount_type', e.target.value)}
              style={{ ...s.input, appearance: 'none' }}
            >
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Vast bedrag (€)</option>
            </select>
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Waarde * {form.discount_type === 'percent' ? '(%)' : '(€)'}</label>
            <input
              type="number"
              value={form.discount_value}
              onChange={e => set('discount_value', e.target.value)}
              placeholder={form.discount_type === 'percent' ? '100' : '5.00'}
              min="0"
              max={form.discount_type === 'percent' ? '100' : undefined}
              step={form.discount_type === 'percent' ? '1' : '0.01'}
              style={s.input}
              required
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Max. gebruik (optioneel)</label>
            <input
              type="number"
              value={form.max_uses}
              onChange={e => set('max_uses', e.target.value)}
              placeholder="Onbeperkt"
              min="1"
              style={s.input}
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Geldig tot (optioneel)</label>
            <input
              type="datetime-local"
              value={form.valid_until}
              onChange={e => set('valid_until', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>Geldig voor</label>
          <select
            value={form.tier_id}
            onChange={e => set('tier_id', e.target.value)}
            style={{ ...s.input, appearance: 'none' }}
          >
            <option value="">Alle tickettypes</option>
            {tiers.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}{t.group_size ? ` (groep van ${t.group_size})` : ''}
              </option>
            ))}
          </select>
          <div style={{ ...MONO, color: 'rgba(244,231,208,0.35)', marginTop: 6, letterSpacing: '0.08em' }}>
            Beperk een code tot één type, bv. een korting die alleen op het
            groepsticket mag gelden.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <label style={{ ...s.label, margin: 0 }}>{editing ? 'Actief' : 'Direct actief'}</label>
          <ActiveToggle active={form.is_active} onChange={v => set('is_active', v)} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={saving} style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Opslaan…' : editing ? 'Wijzigingen opslaan' : 'Code aanmaken'}
          </button>
          {editing && (
            <button type="button" onClick={onCancel} disabled={saving} style={s.btnSecondary}>
              Annuleer
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({ code, tiers, onSaved, onClose }) {
  return (
    <div style={s.modalBackdrop} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={{ ...MONO, color: 'var(--orange)', opacity: 0.85, marginBottom: 20, textTransform: 'uppercase' }}>
          Code bewerken — {code.code}
        </div>
        {/* key on the row id so switching straight from one code to another
            re-seeds the form instead of keeping the previous one's values */}
        <CodeForm
          key={code.id}
          editing={code}
          tiers={tiers}
          onSaved={onSaved}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PromoCodeManager() {
  const [codes, setCodes] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editing, setEditing] = useState(null); // null | the code row being edited

  async function loadCodes() {
    setLoading(true);
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCodes(data);
    setLoading(false);
  }

  async function loadTiers() {
    // Comp tiers are never purchased, so a code scoped to one could never fire.
    const { data } = await supabase
      .from('ticket_tiers')
      .select('id, name, group_size')
      .eq('is_comp', false)
      .eq('is_door_sale', false)
      .order('sort_order');
    if (data) setTiers(data);
  }

  useEffect(() => { loadCodes(); loadTiers(); }, []);

  const tierName = id => tiers.find(t => t.id === id)?.name ?? 'Onbekend type';

  async function toggleActive(code) {
    setTogglingId(code.id);
    await supabase
      .from('promo_codes')
      .update({ is_active: !code.is_active })
      .eq('id', code.id);
    setCodes(prev => prev.map(c => c.id === code.id ? { ...c, is_active: !c.is_active } : c));
    setTogglingId(null);
  }

  async function deleteCode(code) {
    if (!window.confirm(`Code "${code.code}" verwijderen?`)) return;
    setDeletingId(code.id);
    const { error } = await supabase.from('promo_codes').delete().eq('id', code.id);
    setDeletingId(null);
    if (error) {
      // orders.promo_code references this row. Deleting a code an order was
      // bought with would erase the record of the discount that was given, so
      // Postgres refuses — the row used to just reappear on the next reload with
      // no explanation.
      window.alert(
        (code.used_count ?? 0) > 0
          ? `"${code.code}" is al gebruikt in ${code.used_count} bestelling(en) en kan niet verwijderd worden. Zet hem op inactief om hem te stoppen.`
          : `Verwijderen mislukt: ${error.message}`,
      );
      return;
    }
    setCodes(prev => prev.filter(c => c.id !== code.id));
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.pageTitle}>Promo codes</h1>
      </div>

      {editing && (
        <EditModal
          code={editing}
          tiers={tiers}
          onSaved={() => { setEditing(null); loadCodes(); }}
          onClose={() => setEditing(null)}
        />
      )}

      <CodeForm onSaved={loadCodes} tiers={tiers} />

      <div style={CARD}>
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid rgba(244,231,208,0.07)' }}>
          <span style={{ ...MONO, color: 'rgba(244,231,208,0.5)', textTransform: 'uppercase' }}>
            Alle codes ({codes.length})
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', ...MONO, color: 'rgba(244,231,208,0.25)' }}>
            Laden…
          </div>
        ) : codes.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', ...MONO, color: 'rgba(244,231,208,0.25)' }}>
            Nog geen promotiecode aangemaakt.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Code</th>
                  <th style={s.th}>Beschrijving</th>
                  <th style={s.th}>Korting</th>
                  <th style={s.th}>Geldig voor</th>
                  <th style={s.th}>Gebruik</th>
                  <th style={s.th}>Geldig tot</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th} />
                </tr>
              </thead>
              <tbody>
                {codes.map(code => (
                  <tr key={code.id}>
                    <td style={{ ...s.td, fontFamily: 'var(--mono)', letterSpacing: '0.1em', color: 'var(--orange)' }}>
                      {code.code}
                    </td>
                    <td style={{ ...s.td, color: 'rgba(244,231,208,0.6)' }}>
                      {code.description || <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: '0.82rem', color: '#7de87d' }}>
                      {fmtDiscount(code.discount_type, code.discount_value)}
                    </td>
                    <td style={{ ...s.td, fontSize: '0.82rem' }}>
                      {code.tier_id
                        ? <span style={{ color: 'var(--orange)' }}>{tierName(code.tier_id)}</span>
                        : <span style={{ opacity: 0.4 }}>Alle types</span>}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>
                      {code.used_count ?? 0}
                      {code.max_uses != null ? ` / ${code.max_uses}` : ''}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'rgba(244,231,208,0.45)' }}>
                      {fmtDate(code.valid_until)}
                    </td>
                    <td style={s.td}>
                      <ActiveToggle
                        active={code.is_active}
                        onChange={() => toggleActive(code)}
                        disabled={togglingId === code.id}
                      />
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        style={{ ...s.btnSecondary, marginRight: 8 }}
                        onClick={() => setEditing(code)}
                      >
                        Bewerk
                      </button>
                      <button
                        style={{ ...s.btnDanger, opacity: deletingId === code.id ? 0.5 : 1 }}
                        onClick={() => deleteCode(code)}
                        disabled={deletingId === code.id}
                      >
                        Verwijder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        select option { background: #2a0f33; color: var(--cream); }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
      `}</style>
    </div>
  );
}
