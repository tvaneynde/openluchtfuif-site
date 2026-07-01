import { useState, useEffect, useRef } from 'react';
import { supabase, imgUrl } from '../../utils/supabase';
import { useIsMobile } from '../../utils/useIsMobile';

// ── Design tokens ──────────────────────────────────────────────────────────────
const MONO = { fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase' };
const CARD = { background: 'rgba(42,15,51,0.7)', border: '1px solid rgba(244,231,208,0.1)', borderRadius: 14 };
const INPUT_STYLE = {
  background: 'rgba(244,231,208,0.06)', border: '1px solid rgba(244,231,208,0.12)',
  borderRadius: 8, padding: '9px 13px', color: 'var(--cream)',
  fontFamily: 'var(--body)', fontSize: 14, width: '100%', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
};

// ── Shared components ──────────────────────────────────────────────────────────

function Switch({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      title={value ? 'Actief — klik om te verbergen' : 'Verborgen — klik om te activeren'}
      style={{
        width: 38, height: 22, borderRadius: 11, flexShrink: 0,
        background: value ? 'rgba(80,220,110,0.3)' : 'rgba(244,231,208,0.08)',
        border: `1px solid ${value ? 'rgba(80,220,110,0.45)' : 'rgba(244,231,208,0.15)'}`,
        position: 'relative', cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.2s, border-color 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 17 : 3,
        width: 14, height: 14, borderRadius: '50%',
        background: value ? 'rgba(80,220,110,0.95)' : 'rgba(244,231,208,0.25)',
        transition: 'left 0.18s ease, background 0.2s',
        boxShadow: value ? '0 0 6px rgba(80,220,110,0.5)' : 'none',
      }} />
    </button>
  );
}

function StatusBadge({ visible, mode }) {
  const cfg = !visible
    ? { label: 'Verborgen', bg: 'rgba(244,231,208,0.05)', color: 'rgba(244,231,208,0.28)', dot: '○' }
    : mode === 'live'
    ? { label: 'Live',       bg: 'rgba(60,200,100,0.12)', color: 'rgba(80,220,110,0.9)', dot: '●' }
    : { label: 'Binnenkort', bg: 'rgba(255,120,50,0.12)', color: 'var(--orange)', dot: '◐' };
  return (
    <span style={{ ...MONO, background: cfg.bg, color: cfg.color, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {cfg.dot} {cfg.label}
    </span>
  );
}

function ModeSegment({ value, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(244,231,208,0.05)', borderRadius: 8, padding: 3, gap: 2 }}>
      {['live', 'coming_soon'].map(m => (
        <button key={m} onClick={() => onChange(m)} style={{
          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
          ...MONO, fontSize: 9,
          background: value === m ? 'rgba(255,120,50,0.18)' : 'transparent',
          color: value === m ? 'var(--orange)' : 'rgba(244,231,208,0.35)',
          transition: 'all 0.15s',
        }}>
          {m === 'live' ? 'Live' : 'Binnenkort'}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ ...MONO, color: 'rgba(244,231,208,0.3)', marginBottom: 10 }}>{children}</div>;
}

// ── Sections tab ───────────────────────────────────────────────────────────────
function SectionsTab() {
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState({});
  const isMobile = useIsMobile();

  useEffect(() => {
    supabase.from('page_sections').select('*').order('id').then(({ data }) => {
      if (data) setSections(data);
    });
  }, []);

  async function update(id, patch) {
    setSaving(s => ({ ...s, [id]: true }));
    await supabase.from('page_sections').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    setSaving(s => { const n = { ...s }; delete n[id]; return n; });
  }

  const HAS_MODE = new Set(['lineup', 'tickets', 'partners', 'info', 'faq']);
  const ORDER = ['lineup', 'tickets', 'partners', 'info', 'faq', 'edities', 'about'];
  const sorted = [...sections].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(sec => {
        const hasMode = HAS_MODE.has(sec.id);
        return (
          <div key={sec.id} style={{
            ...CARD, padding: '16px 20px',
            display: 'flex', flexDirection: 'column', gap: 12,
            opacity: saving[sec.id] ? 0.5 : 1, transition: 'opacity 0.2s',
          }}>
            {/* Row 1: name + badge + switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 20 }}>{sec.label}</span>
                <StatusBadge visible={sec.visible} mode={sec.mode} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Switch value={sec.visible} onChange={v => update(sec.id, { visible: v })} />
                {!isMobile && (
                  <span style={{ ...MONO, color: sec.visible ? 'rgba(244,231,208,0.5)' : 'rgba(244,231,208,0.2)', fontSize: 9 }}>
                    {sec.visible ? 'Zichtbaar' : 'Verborgen'}
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: mode control (only for sections that support it) */}
            {hasMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...MONO, color: 'rgba(244,231,208,0.3)', fontSize: 9, minWidth: 40 }}>Modus</span>
                <ModeSegment value={sec.mode} onChange={m => update(sec.id, { mode: m })} />
              </div>
            )}
          </div>
        );
      })}
      <p style={{ ...MONO, color: 'rgba(244,231,208,0.2)', marginTop: 8 }}>
        Wijzigingen zijn direct zichtbaar op de site.
      </p>
    </div>
  );
}

// ── Artist form panel ──────────────────────────────────────────────────────────
function ArtistPanel({ form, setForm, onSave, onClose, busy, isNew }) {
  return (
    <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <span style={{ ...MONO, color: 'var(--orange)' }}>{isNew ? 'Nieuwe artiest' : 'Bewerken'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(244,231,208,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <Field label="Naam">
          <input style={INPUT_STYLE} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        </Field>
        <Field label="Genre">
          <input style={INPUT_STYLE} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} />
        </Field>
        <Field label="Tijdslot">
          <input style={INPUT_STYLE} value={form.time_slot || ''} placeholder="20:00 – 21:00" onChange={e => setForm(f => ({ ...f, time_slot: e.target.value }))} />
        </Field>
        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
          <ToggleRow label="Headliner" value={form.headliner} onChange={v => setForm(f => ({ ...f, headliner: v }))} />
          <ToggleRow label="Actief" value={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, paddingTop: 20, borderTop: '1px solid rgba(244,231,208,0.08)', marginTop: 20 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(244,231,208,0.15)', borderRadius: 8, color: 'rgba(244,231,208,0.5)', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10 }}>
          Annuleer
        </button>
        <button onClick={onSave} disabled={busy || !form.name} style={{ flex: 2, padding: '10px', background: form.name ? 'var(--orange)' : 'rgba(244,231,208,0.1)', border: 'none', borderRadius: 8, color: form.name ? '#fff' : 'rgba(244,231,208,0.3)', cursor: form.name ? 'pointer' : 'default', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', transition: 'all 0.15s' }}>
          {busy ? '…' : 'Opslaan'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ ...MONO, color: 'rgba(244,231,208,0.35)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Switch value={value} onChange={onChange} />
      <span style={{ ...MONO, color: 'rgba(244,231,208,0.5)' }}>{label}</span>
    </div>
  );
}

// ── Slide-in panel wrapper (desktop) / full-screen overlay (mobile) ────────────
function PanelWrap({ open, children, isMobile }) {
  if (isMobile) {
    if (!open) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: '#1a0820',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{
      width: open ? 340 : 0, overflow: 'hidden', flexShrink: 0,
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      borderLeft: open ? '1px solid rgba(244,231,208,0.08)' : '1px solid transparent',
      background: 'rgba(20,6,28,0.6)',
    }}>
      <div style={{ width: 340 }}>{open && children}</div>
    </div>
  );
}

// ── Lineup tab ─────────────────────────────────────────────────────────────────
const EMPTY_ARTIST = { name: '', genre: 'DJ Set', time_slot: '', headliner: false, active: true };

function LineupTab() {
  const [artists, setArtists] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ARTIST);
  const [busy, setBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('lineup_artists').select('*').order('sort_order').order('created_at');
    if (data) setArtists(data);
  }

  function startEdit(a) { setEditing(a.id); setForm({ ...a }); }
  function startNew() {
    setEditing('new');
    setForm({ ...EMPTY_ARTIST, sort_order: artists.length + 1 });
  }
  function closePanel() { setEditing(null); }

  async function save() {
    setBusy(true);
    if (editing === 'new') {
      const { data } = await supabase.from('lineup_artists')
        .insert({ ...form, sort_order: artists.length + 1 }).select().single();
      if (data) setArtists(prev => [...prev, data]);
    } else {
      await supabase.from('lineup_artists').update(form).eq('id', editing);
      setArtists(prev => prev.map(a => a.id === editing ? { ...a, ...form } : a));
    }
    setEditing(null);
    setBusy(false);
  }

  async function remove(id) {
    if (!confirm('Artiest verwijderen?')) return;
    await supabase.from('lineup_artists').delete().eq('id', id);
    setArtists(prev => prev.filter(a => a.id !== id));
    if (editing === id) setEditing(null);
  }

  async function toggleActive(a) {
    const patch = { active: !a.active };
    await supabase.from('lineup_artists').update(patch).eq('id', a.id);
    setArtists(prev => prev.map(x => x.id === a.id ? { ...x, ...patch } : x));
  }

  // Drag & drop reorder
  function handleDragStart(i) { setDragIdx(i); }
  function handleDragOver(e, i) { e.preventDefault(); setOverIdx(i); }
  function handleDrop(dropI) {
    if (dragIdx === null || dragIdx === dropI) return;
    const next = [...artists];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropI, 0, moved);
    const withOrder = next.map((a, i) => ({ ...a, sort_order: i + 1 }));
    setArtists(withOrder);
    setDragIdx(null); setOverIdx(null);
    // Persist new order
    withOrder.forEach(a => supabase.from('lineup_artists').update({ sort_order: a.sort_order }).eq('id', a.id));
  }

  const panelOpen = editing !== null;
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      {/* List */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ ...MONO, color: 'rgba(244,231,208,0.3)' }}>{artists.length} artiesten</span>
          <button onClick={startNew} style={addBtnStyle}>+ Toevoegen</button>
        </div>

        <div style={{ ...CARD, overflow: 'hidden' }}>
          {artists.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', ...MONO, color: 'rgba(244,231,208,0.2)' }}>
              Nog geen artiesten — voeg er een toe
            </div>
          )}
          {artists.map((a, i) => (
            <div
              key={a.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onClick={() => startEdit(a)}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr auto auto' : '28px 1fr auto auto auto',
                alignItems: 'center', gap: isMobile ? 10 : 14,
                padding: '12px 16px',
                borderBottom: i < artists.length - 1 ? '1px solid rgba(244,231,208,0.05)' : 'none',
                background: editing === a.id ? 'rgba(255,120,50,0.06)' :
                            overIdx === i ? 'rgba(244,231,208,0.04)' : 'transparent',
                borderLeft: overIdx === i && dragIdx !== i ? '2px solid rgba(255,120,50,0.5)' : '2px solid transparent',
                cursor: 'pointer', opacity: a.active ? (dragIdx === i ? 0.35 : 1) : 0.4,
                transition: 'background 0.12s, opacity 0.2s',
              }}
            >
              {!isMobile && <span style={{ color: 'rgba(244,231,208,0.2)', fontSize: 14, cursor: 'grab', userSelect: 'none' }}>⠿</span>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 18, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                {a.headliner && (
                  <span style={{ ...MONO, background: 'rgba(255,120,50,0.12)', color: 'var(--orange)', padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>HL</span>
                )}
              </div>
              <div onClick={e => e.stopPropagation()}>
                <Switch value={a.active} onChange={() => toggleActive(a)} />
              </div>
              <button
                onClick={e => { e.stopPropagation(); remove(a.id); }}
                style={{ background: 'none', border: 'none', color: 'rgba(244,231,208,0.2)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4, transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,80,80,0.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(244,231,208,0.2)'}
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Panel */}
      <PanelWrap open={panelOpen} isMobile={isMobile}>
        <ArtistPanel form={form} setForm={setForm} onSave={save} onClose={closePanel} busy={busy} isNew={editing === 'new'} />
      </PanelWrap>
    </div>
  );
}

// ── Partner form panel ─────────────────────────────────────────────────────────
function PartnerPanel({ form, setForm, onSave, onClose, busy, isNew }) {
  return (
    <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <span style={{ ...MONO, color: 'var(--orange)' }}>{isNew ? 'Nieuwe partner' : 'Bewerken'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(244,231,208,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <Field label="Naam">
          <input style={INPUT_STYLE} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        </Field>
        <Field label="Logo pad (storage)">
          <input style={INPUT_STYLE} value={form.logo_path || ''} placeholder="partners/naam.png" onChange={e => setForm(f => ({ ...f, logo_path: e.target.value }))} />
        </Field>
        {form.logo_path && (
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={imgUrl(form.logo_path)} alt="" style={{ height: 44, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 6 }} onError={e => e.currentTarget.style.display = 'none'} />
            <span style={{ ...MONO, color: 'rgba(244,231,208,0.3)' }}>Preview</span>
          </div>
        )}
        <Field label="Website URL">
          <input style={INPUT_STYLE} value={form.website_url || ''} placeholder="https://…" onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} />
        </Field>
        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
          <ToggleRow label="Hoofdsponsor" value={form.featured} onChange={v => setForm(f => ({ ...f, featured: v }))} />
          <ToggleRow label="Actief" value={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, paddingTop: 20, borderTop: '1px solid rgba(244,231,208,0.08)', marginTop: 20 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(244,231,208,0.15)', borderRadius: 8, color: 'rgba(244,231,208,0.5)', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10 }}>
          Annuleer
        </button>
        <button onClick={onSave} disabled={busy || !form.name} style={{ flex: 2, padding: '10px', background: form.name ? 'var(--orange)' : 'rgba(244,231,208,0.1)', border: 'none', borderRadius: 8, color: form.name ? '#fff' : 'rgba(244,231,208,0.3)', cursor: form.name ? 'pointer' : 'default', fontFamily: 'var(--mono)', fontSize: 10, transition: 'all 0.15s' }}>
          {busy ? '…' : 'Opslaan'}
        </button>
      </div>
    </div>
  );
}

// ── Partners tab ───────────────────────────────────────────────────────────────
const EMPTY_PARTNER = { name: '', logo_path: '', website_url: '', featured: false, active: true };

function PartnersTab() {
  const [partners, setPartners] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_PARTNER);
  const [busy, setBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('partners').select('*').order('featured', { ascending: false }).order('sort_order');
    if (data) setPartners(data);
  }

  function startEdit(p) { setEditing(p.id); setForm({ ...p }); }
  function startNew() { setEditing('new'); setForm({ ...EMPTY_PARTNER, sort_order: partners.length + 1 }); }
  function closePanel() { setEditing(null); }

  async function save() {
    setBusy(true);
    if (editing === 'new') {
      const { data } = await supabase.from('partners').insert({ ...form, sort_order: partners.length + 1 }).select().single();
      if (data) setPartners(prev => [...prev, data]);
    } else {
      await supabase.from('partners').update(form).eq('id', editing);
      setPartners(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p));
    }
    setEditing(null);
    setBusy(false);
  }

  async function remove(id) {
    if (!confirm('Partner verwijderen?')) return;
    await supabase.from('partners').delete().eq('id', id);
    setPartners(prev => prev.filter(p => p.id !== id));
    if (editing === id) setEditing(null);
  }

  async function toggleField(p, field) {
    const patch = { [field]: !p[field] };
    await supabase.from('partners').update(patch).eq('id', p.id);
    setPartners(prev => prev.map(x => x.id === p.id ? { ...x, ...patch } : x));
  }

  function handleDragStart(i) { setDragIdx(i); }
  function handleDragOver(e, i) { e.preventDefault(); setOverIdx(i); }
  function handleDrop(dropI) {
    if (dragIdx === null || dragIdx === dropI) return;
    const next = [...partners];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropI, 0, moved);
    const withOrder = next.map((p, i) => ({ ...p, sort_order: i + 1 }));
    setPartners(withOrder);
    setDragIdx(null); setOverIdx(null);
    withOrder.forEach(p => supabase.from('partners').update({ sort_order: p.sort_order }).eq('id', p.id));
  }

  const panelOpen = editing !== null;
  const isMobile = useIsMobile();
  const featured = partners.filter(p => p.featured);
  const regular = partners.filter(p => !p.featured);

  function PartnerRow({ p, globalIdx }) {
    return (
      <div
        draggable
        onDragStart={() => handleDragStart(globalIdx)}
        onDragOver={e => handleDragOver(e, globalIdx)}
        onDrop={() => handleDrop(globalIdx)}
        onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
        onClick={() => startEdit(p)}
        style={{
          display: 'grid', gridTemplateColumns: isMobile ? '36px 1fr auto auto' : '28px 52px 1fr auto auto auto',
          alignItems: 'center', gap: isMobile ? 10 : 14, padding: '10px 16px',
          borderBottom: '1px solid rgba(244,231,208,0.05)',
          background: editing === p.id ? 'rgba(255,120,50,0.06)' :
                      overIdx === globalIdx ? 'rgba(244,231,208,0.04)' : 'transparent',
          borderLeft: overIdx === globalIdx && dragIdx !== globalIdx ? '2px solid rgba(255,120,50,0.5)' : '2px solid transparent',
          cursor: 'grab', opacity: p.active ? (dragIdx === globalIdx ? 0.35 : 1) : 0.4,
          transition: 'background 0.12s, opacity 0.2s',
        }}
      >
        <span style={{ color: 'rgba(244,231,208,0.2)', fontSize: 14, userSelect: 'none' }}>⠿</span>
        {p.logo_path
          ? <img src={imgUrl(p.logo_path)} alt={p.name} style={{ width: 48, height: 32, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 4 }} onError={e => e.currentTarget.style.opacity = '0.15'} />
          : <div style={{ width: 48, height: 32, background: 'rgba(244,231,208,0.05)', borderRadius: 6 }} />
        }
        <span style={{ fontFamily: 'var(--body)', fontWeight: 500 }}>{p.name}</span>
        {p.featured && (
          <span style={{ ...MONO, background: 'rgba(255,180,50,0.1)', color: 'rgba(255,180,50,0.8)', padding: '2px 8px', borderRadius: 999 }}>★</span>
        )}
        <div onClick={e => e.stopPropagation()}>
          <Switch value={p.active} onChange={() => toggleField(p, 'active')} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); remove(p.id); }}
          style={{ background: 'none', border: 'none', color: 'rgba(244,231,208,0.2)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,80,80,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(244,231,208,0.2)'}
        >✕</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ ...MONO, color: 'rgba(244,231,208,0.3)' }}>{partners.length} partners</span>
          <button onClick={startNew} style={addBtnStyle}>+ Toevoegen</button>
        </div>

        {featured.length > 0 && (
          <>
            <SectionLabel>★ Hoofdsponsors</SectionLabel>
            <div style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
              {featured.map((p, i) => (
                <PartnerRow key={p.id} p={p} globalIdx={partners.indexOf(p)} />
              ))}
            </div>
          </>
        )}

        <SectionLabel>◉ Partners</SectionLabel>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {regular.length === 0 && (
            <div style={{ padding: '32px 24px', textAlign: 'center', ...MONO, color: 'rgba(244,231,208,0.2)' }}>
              Geen reguliere partners
            </div>
          )}
          {regular.map(p => (
            <PartnerRow key={p.id} p={p} globalIdx={partners.indexOf(p)} />
          ))}
        </div>
      </div>

      {/* Panel */}
      <PanelWrap open={panelOpen} isMobile={isMobile}>
        <PartnerPanel form={form} setForm={setForm} onSave={save} onClose={closePanel} busy={busy} isNew={editing === 'new'} />
      </PanelWrap>
    </div>
  );
}

// ── FAQ tab ────────────────────────────────────────────────────────────────────
const EMPTY_FAQ = { question: '', answer: '', active: true };

function FaqPanel({ form, setForm, onSave, onClose, busy, isNew }) {
  return (
    <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <span style={{ ...MONO, color: 'var(--orange)' }}>{isNew ? 'Nieuwe vraag' : 'Vraag bewerken'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(244,231,208,0.4)', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div>
          <div style={{ ...MONO, color: 'rgba(244,231,208,0.35)', marginBottom: 6 }}>Vraag</div>
          <input style={INPUT_STYLE} value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} autoFocus />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...MONO, color: 'rgba(244,231,208,0.35)', marginBottom: 6 }}>Antwoord</div>
          <textarea
            style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: 120 }}
            value={form.answer}
            onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Switch value={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
          <span style={{ ...MONO, color: 'rgba(244,231,208,0.4)' }}>Actief</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, paddingTop: 20, borderTop: '1px solid rgba(244,231,208,0.08)', marginTop: 20 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(244,231,208,0.15)', borderRadius: 8, color: 'rgba(244,231,208,0.5)', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10 }}>Annuleer</button>
        <button onClick={onSave} disabled={busy || !form.question} style={{ flex: 2, padding: '10px', background: form.question ? 'var(--orange)' : 'rgba(244,231,208,0.1)', border: 'none', borderRadius: 8, color: form.question ? '#fff' : 'rgba(244,231,208,0.3)', cursor: form.question ? 'pointer' : 'default', fontFamily: 'var(--mono)', fontSize: 10, transition: 'all 0.15s' }}>
          {busy ? '…' : 'Opslaan'}
        </button>
      </div>
    </div>
  );
}

function FaqTab() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FAQ);
  const [busy, setBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('faq_items').select('*').order('sort_order').order('created_at');
    if (data) setItems(data);
  }

  function startEdit(item) { setEditing(item.id); setForm({ ...item }); }
  function startNew() { setEditing('new'); setForm({ ...EMPTY_FAQ, sort_order: items.length + 1 }); }
  function closePanel() { setEditing(null); }

  async function save() {
    setBusy(true);
    if (editing === 'new') {
      const { data } = await supabase.from('faq_items').insert({ ...form, sort_order: items.length + 1 }).select().single();
      if (data) setItems(prev => [...prev, data]);
    } else {
      await supabase.from('faq_items').update(form).eq('id', editing);
      setItems(prev => prev.map(x => x.id === editing ? { ...x, ...form } : x));
    }
    setEditing(null); setBusy(false);
  }

  async function remove(id) {
    if (!confirm('Vraag verwijderen?')) return;
    await supabase.from('faq_items').delete().eq('id', id);
    setItems(prev => prev.filter(x => x.id !== id));
    if (editing === id) setEditing(null);
  }

  async function toggleActive(item) {
    const patch = { active: !item.active };
    await supabase.from('faq_items').update(patch).eq('id', item.id);
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, ...patch } : x));
  }

  function handleDragStart(i) { setDragIdx(i); }
  function handleDragOver(e, i) { e.preventDefault(); setOverIdx(i); }
  function handleDrop(dropI) {
    if (dragIdx === null || dragIdx === dropI) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropI, 0, moved);
    const withOrder = next.map((x, i) => ({ ...x, sort_order: i + 1 }));
    setItems(withOrder);
    setDragIdx(null); setOverIdx(null);
    withOrder.forEach(x => supabase.from('faq_items').update({ sort_order: x.sort_order }).eq('id', x.id));
  }

  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ ...MONO, color: 'rgba(244,231,208,0.3)' }}>{items.length} vragen</span>
          <button onClick={startNew} style={addBtnStyle}>+ Toevoegen</button>
        </div>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {items.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', ...MONO, color: 'rgba(244,231,208,0.2)' }}>Nog geen vragen</div>
          )}
          {items.map((item, i) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onClick={() => startEdit(item)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                alignItems: 'center', gap: 12, padding: '14px 16px',
                borderBottom: i < items.length - 1 ? '1px solid rgba(244,231,208,0.05)' : 'none',
                background: editing === item.id ? 'rgba(255,120,50,0.06)' : overIdx === i ? 'rgba(244,231,208,0.04)' : 'transparent',
                borderLeft: overIdx === i && dragIdx !== i ? '2px solid rgba(255,120,50,0.5)' : '2px solid transparent',
                cursor: 'pointer', opacity: item.active ? (dragIdx === i ? 0.35 : 1) : 0.4,
                transition: 'background 0.12s',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--body)', fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.question}</div>
                <div style={{ ...MONO, color: 'rgba(244,231,208,0.3)', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.answer}</div>
              </div>
              <div onClick={e => e.stopPropagation()}>
                <Switch value={item.active} onChange={() => toggleActive(item)} />
              </div>
              <button onClick={e => { e.stopPropagation(); remove(item.id); }} style={{ background: 'none', border: 'none', color: 'rgba(244,231,208,0.2)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4, transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,80,80,0.7)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(244,231,208,0.2)'}>✕</button>
            </div>
          ))}
        </div>
      </div>
      <PanelWrap open={!!editing} isMobile={isMobile}>
        {editing && <FaqPanel form={form} setForm={setForm} onSave={save} onClose={closePanel} busy={busy} isNew={editing === 'new'} />}
      </PanelWrap>
    </div>
  );
}

// ── Info tab ───────────────────────────────────────────────────────────────────
const EMPTY_INFO = { label: '◉', title: '', body: '', active: true };

function InfoPanel({ form, setForm, onSave, onClose, busy, isNew }) {
  return (
    <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <span style={{ ...MONO, color: 'var(--orange)' }}>{isNew ? 'Nieuwe kaart' : 'Kaart bewerken'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(244,231,208,0.4)', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div>
          <div style={{ ...MONO, color: 'rgba(244,231,208,0.35)', marginBottom: 6 }}>Label (klein, bijv. ◉ Locatie)</div>
          <input style={INPUT_STYLE} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} autoFocus />
        </div>
        <div>
          <div style={{ ...MONO, color: 'rgba(244,231,208,0.35)', marginBottom: 6 }}>Titel</div>
          <input style={INPUT_STYLE} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...MONO, color: 'rgba(244,231,208,0.35)', marginBottom: 6 }}>Tekst</div>
          <textarea style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: 100 }} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Switch value={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
          <span style={{ ...MONO, color: 'rgba(244,231,208,0.4)' }}>Actief</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, paddingTop: 20, borderTop: '1px solid rgba(244,231,208,0.08)', marginTop: 20 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(244,231,208,0.15)', borderRadius: 8, color: 'rgba(244,231,208,0.5)', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10 }}>Annuleer</button>
        <button onClick={onSave} disabled={busy || !form.title} style={{ flex: 2, padding: '10px', background: form.title ? 'var(--orange)' : 'rgba(244,231,208,0.1)', border: 'none', borderRadius: 8, color: form.title ? '#fff' : 'rgba(244,231,208,0.3)', cursor: form.title ? 'pointer' : 'default', fontFamily: 'var(--mono)', fontSize: 10, transition: 'all 0.15s' }}>
          {busy ? '…' : 'Opslaan'}
        </button>
      </div>
    </div>
  );
}

function InfoTab() {
  const [cards, setCards] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_INFO);
  const [busy, setBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('info_cards').select('*').order('sort_order').order('created_at');
    if (data) setCards(data);
  }

  function startEdit(c) { setEditing(c.id); setForm({ ...c }); }
  function startNew() { setEditing('new'); setForm({ ...EMPTY_INFO, sort_order: cards.length + 1 }); }
  function closePanel() { setEditing(null); }

  async function save() {
    setBusy(true);
    if (editing === 'new') {
      const { data } = await supabase.from('info_cards').insert({ ...form, sort_order: cards.length + 1 }).select().single();
      if (data) setCards(prev => [...prev, data]);
    } else {
      await supabase.from('info_cards').update(form).eq('id', editing);
      setCards(prev => prev.map(x => x.id === editing ? { ...x, ...form } : x));
    }
    setEditing(null); setBusy(false);
  }

  async function remove(id) {
    if (!confirm('Kaart verwijderen?')) return;
    await supabase.from('info_cards').delete().eq('id', id);
    setCards(prev => prev.filter(x => x.id !== id));
    if (editing === id) setEditing(null);
  }

  async function toggleActive(c) {
    const patch = { active: !c.active };
    await supabase.from('info_cards').update(patch).eq('id', c.id);
    setCards(prev => prev.map(x => x.id === c.id ? { ...x, ...patch } : x));
  }

  function handleDragStart(i) { setDragIdx(i); }
  function handleDragOver(e, i) { e.preventDefault(); setOverIdx(i); }
  function handleDrop(dropI) {
    if (dragIdx === null || dragIdx === dropI) return;
    const next = [...cards];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropI, 0, moved);
    const withOrder = next.map((x, i) => ({ ...x, sort_order: i + 1 }));
    setCards(withOrder);
    setDragIdx(null); setOverIdx(null);
    withOrder.forEach(x => supabase.from('info_cards').update({ sort_order: x.sort_order }).eq('id', x.id));
  }

  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ ...MONO, color: 'rgba(244,231,208,0.3)' }}>{cards.length} kaarten</span>
          <button onClick={startNew} style={addBtnStyle}>+ Toevoegen</button>
        </div>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {cards.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', ...MONO, color: 'rgba(244,231,208,0.2)' }}>Nog geen info-kaarten</div>
          )}
          {cards.map((c, i) => (
            <div
              key={c.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onClick={() => startEdit(c)}
              style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr auto auto' : '28px auto 1fr auto auto',
                alignItems: 'center', gap: isMobile ? 10 : 14, padding: '14px 16px',
                borderBottom: i < cards.length - 1 ? '1px solid rgba(244,231,208,0.05)' : 'none',
                background: editing === c.id ? 'rgba(255,120,50,0.06)' : overIdx === i ? 'rgba(244,231,208,0.04)' : 'transparent',
                borderLeft: overIdx === i && dragIdx !== i ? '2px solid rgba(255,120,50,0.5)' : '2px solid transparent',
                cursor: 'pointer', opacity: c.active ? (dragIdx === i ? 0.35 : 1) : 0.4,
                transition: 'background 0.12s',
              }}
            >
              {!isMobile && <span style={{ color: 'rgba(244,231,208,0.2)', fontSize: 14, userSelect: 'none' }}>⠿</span>}
              {!isMobile && <span style={{ ...MONO, color: 'var(--orange)', fontSize: 9, whiteSpace: 'nowrap' }}>{c.label}</span>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--body)', fontWeight: 600, marginBottom: 2 }}>{c.title}</div>
                <div style={{ ...MONO, color: 'rgba(244,231,208,0.3)', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isMobile ? c.label : c.body}</div>
              </div>
              <div onClick={e => e.stopPropagation()}>
                <Switch value={c.active} onChange={() => toggleActive(c)} />
              </div>
              <button onClick={e => { e.stopPropagation(); remove(c.id); }} style={{ background: 'none', border: 'none', color: 'rgba(244,231,208,0.2)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4, transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,80,80,0.7)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(244,231,208,0.2)'}>✕</button>
            </div>
          ))}
        </div>
      </div>
      <PanelWrap open={!!editing} isMobile={isMobile}>
        {editing && <InfoPanel form={form} setForm={setForm} onSave={save} onClose={closePanel} busy={busy} isNew={editing === 'new'} />}
      </PanelWrap>
    </div>
  );
}

// ── Add button style ───────────────────────────────────────────────────────────
const addBtnStyle = {
  background: 'rgba(255,120,50,0.12)', border: '1px solid rgba(255,120,50,0.3)',
  borderRadius: 8, padding: '7px 16px', cursor: 'pointer', color: 'var(--orange)',
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
  transition: 'all 0.15s',
};

// ── Nav rail tabs ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'secties',  label: 'Secties',  icon: '◈' },
  { id: 'lineup',   label: 'Line-up',  icon: '♫' },
  { id: 'partners', label: 'Partners', icon: '★' },
  { id: 'faq',      label: 'FAQ',      icon: '?' },
  { id: 'info',     label: 'Info',     icon: 'ℹ' },
];

export default function ContentManager() {
  const [tab, setTab] = useState('secties');

  return (
    <div className="cms-layout">
      {/* Left nav rail */}
      <nav className="cms-rail">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            textAlign: 'left', padding: '10px 14px', borderRadius: 8,
            border: 'none', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 10,
            background: tab === t.id ? 'rgba(255,120,50,0.1)' : 'transparent',
            color: tab === t.id ? 'var(--orange)' : 'rgba(244,231,208,0.38)',
            borderLeft: tab === t.id ? '2px solid var(--orange)' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 13, opacity: 0.7 }}>{t.icon}</span>
            <span style={{ ...MONO, fontSize: 10 }}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div className="cms-content">
        {tab === 'secties'  && <SectionsTab />}
        {tab === 'lineup'   && <LineupTab />}
        {tab === 'partners' && <PartnersTab />}
        {tab === 'faq'      && <FaqTab />}
        {tab === 'info'     && <InfoTab />}
      </div>
    </div>
  );
}
