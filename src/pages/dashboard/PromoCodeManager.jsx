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

function fmtDateInput(iso) {
  if (!iso) return '';
  return iso.slice(0, 16);
}

const EMPTY_FORM = {
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: '',
  max_uses: '',
  valid_until: '',
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

// ─── New code form ────────────────────────────────────────────────────────────

function NewCodeForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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
      is_active: form.is_active,
    };

    const { error: insertErr } = await supabase.from('promo_codes').insert(payload);
    setSaving(false);

    if (insertErr) {
      setError(insertErr.message.includes('duplicate') ? 'Deze code bestaat al' : insertErr.message);
      return;
    }

    setSuccess(true);
    setForm(EMPTY_FORM);
    onCreated();
  }

  const fieldStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

  return (
    <div style={{ ...CARD, padding: '28px 32px', marginBottom: 32 }}>
      <div style={{ ...MONO, color: 'var(--orange)', opacity: 0.85, marginBottom: 20, textTransform: 'uppercase' }}>
        Nieuwe promotiecode
      </div>

      {error && <div style={s.errorBox}>{error}</div>}
      {success && <div style={s.successBox}>Code aangemaakt.</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div style={fieldStyle}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Code *</label>
            <input
              type="text"
              value={form.code}
              onChange={e => set('code', e.target.value.toUpperCase())}
              placeholder="PERS2026"
              style={{ ...s.input, textTransform: 'uppercase', letterSpacing: '0.1em' }}
              required
            />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <label style={{ ...s.label, margin: 0 }}>Direct actief</label>
          <ActiveToggle active={form.is_active} onChange={v => set('is_active', v)} />
        </div>

        <button type="submit" disabled={saving} style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Opslaan…' : 'Code aanmaken'}
        </button>
      </form>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PromoCodeManager() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function loadCodes() {
    setLoading(true);
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCodes(data);
    setLoading(false);
  }

  useEffect(() => { loadCodes(); }, []);

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
    await supabase.from('promo_codes').delete().eq('id', code.id);
    setCodes(prev => prev.filter(c => c.id !== code.id));
    setDeletingId(null);
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.pageTitle}>Promo codes</h1>
      </div>

      <NewCodeForm onCreated={loadCodes} />

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
                    <td style={{ ...s.td, textAlign: 'right' }}>
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
