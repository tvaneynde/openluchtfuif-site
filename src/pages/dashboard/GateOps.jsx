import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../../utils/supabase';

// Poortcontrole — de pagina voor tijdens het evenement zelf.
//
// Eén scherm om te zien of de poort draait, en om het te repareren als het
// vastloopt: zoek een bezoeker op, zie wat er met hun ticket aan de hand is,
// en laat ze binnen of draai een verkeerde scan terug.
//
// TWEE DINGEN DIE HIER BEWUST ANDERS ZIJN DAN IN get_scan_stats()
//
// 1. De teller "binnen" komt uit tickets.status, niet uit scan_events van
//    vandaag. De fuif loopt van 16:00 tot 03:00 — een telling die op
//    `scanned_at >= current_date` filtert springt om middernacht terug naar
//    nul, precies wanneer de zaal het volst is. tickets.status kent geen
//    datumgrens en corrigeert zichzelf ook wanneer een scan hieronder wordt
//    teruggedraaid.
//
// 2. Alle vensters hieronder zijn rollend ("laatste 5 minuten", "laatste uur"),
//    niet "sinds middernacht", om dezelfde reden.

const REFRESH_MS       = 15000;
const TICK_MS          = 5000;          // alleen om "x geleden" te laten lopen
const RECENT_LIMIT     = 150;
const FLOW_WINDOW_MS   = 5 * 60 * 1000;
const PROBLEM_WINDOW_MS = 60 * 60 * 1000;
const DEVICE_STALE_MS  = 10 * 60 * 1000;
const SEARCH_DEBOUNCE  = 350;
const MANUAL_SCANNER   = 'dashboard';

// scan_token blijft hier bewust buiten: het is het QR-geheim en de zoeklijst
// heeft het niet nodig. Voor een handmatige toelating wordt het per ticket
// apart opgehaald (zie admitTicket).
const TICKET_SELECT = `
  id, ticket_number, status, scanned_at, scanned_by, attendee_name, attendee_email, issued_at,
  orders ( id, buyer_name, buyer_email, status, order_type, quantity ),
  ticket_tiers ( name )
`;

// Left join op tickets: een ongeldige scan heeft ticket_id NULL (het token
// hoorde bij geen enkel ticket), dus e.tickets mag niet verondersteld worden.
const EVENT_SELECT = `
  id, result, scanner_id, scanned_at, ticket_id, scan_token,
  tickets ( ticket_number, attendee_name, status, orders ( buyer_name ) )
`;

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtClock(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// `now` wordt van buitenaf meegegeven (zie useNow): de klok uitlezen tijdens
// het renderen levert tijden op die alleen verspringen wanneer de component
// toevallig om een andere reden hertekent — precies wat je aan de poort niet wil.
function relative(ms, now) {
  if (!ms || Number.isNaN(ms)) return '—';
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 10) return 'net';
  if (s < 60) return `${s}s geleden`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m geleden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}u geleden`;
  return `${Math.floor(h / 24)}d geleden`;
}

/** Een klok die met vaste tussenpozen tikt, zodat "x geleden" blijft lopen. */
function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const toMs = (iso) => {
  const t = new Date(iso ?? 0).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// De .or()-filter van PostgREST is één komma-gescheiden string, dus een komma
// of haakje in de zoekterm breekt de query (en % / * zijn ilike-jokers). Eruit
// halen is hier beter dan escapen: niemand zoekt een bezoeker op een komma.
function sanitizeQuery(raw) {
  return (raw ?? '').replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim();
}

const deviceLabel = (id) => {
  if (!id) return 'onbekend';
  if (id === MANUAL_SCANNER) return 'dashboard';
  return id.slice(0, 8);
};

const personOf = (t) =>
  t?.attendee_name?.trim() || t?.orders?.buyer_name?.trim() || 'Naamloos';

// ─── stijl ──────────────────────────────────────────────────────────────────

const MONO = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em' };
const CARD = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(244,231,208,0.1)',
  borderRadius: 16,
};

const s = {
  header: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    marginBottom: 28, flexWrap: 'wrap', gap: 16,
  },
  breadcrumb: { ...MONO, opacity: 0.4, margin: '0 0 6px' },
  pageTitle: { fontFamily: 'var(--display)', fontSize: 48, lineHeight: 1, margin: 0 },
  sectionTitle: {
    ...MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em',
    color: 'var(--orange)', opacity: 0.85, margin: '0 0 12px',
  },
  card: { ...CARD, padding: '20px 22px', marginBottom: 20 },
  metric: { ...CARD, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 },
  metricLabel: { ...MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(244,231,208,0.45)' },
  metricValue: { fontFamily: 'var(--display)', fontSize: '2.5rem', lineHeight: 1, letterSpacing: '0.02em' },
  metricSub: { ...MONO, fontSize: 9, color: 'rgba(244,231,208,0.35)' },
  input: {
    width: '100%', background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(244,231,208,0.18)', borderRadius: 10,
    padding: '14px 16px', color: 'var(--cream)', fontFamily: 'var(--body)',
    fontSize: 16, boxSizing: 'border-box',  // 16px: kleiner laat iOS inzoomen
  },
  btn: {
    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em',
    borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
    border: '1px solid rgba(244,231,208,0.2)', background: 'transparent',
    color: 'var(--cream)', whiteSpace: 'nowrap', transition: 'background 0.15s',
  },
  errorBanner: {
    background: 'rgba(220,60,60,0.15)', border: '1px solid rgba(220,60,60,0.35)',
    borderRadius: 10, padding: '12px 16px', color: '#ff8080',
    fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 20,
  },
  warnBanner: {
    background: 'rgba(240,140,40,0.14)', border: '1px solid rgba(240,140,40,0.35)',
    borderRadius: 10, padding: '10px 14px', color: 'var(--orange-bright)',
    fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6, marginTop: 12,
  },
  empty: {
    textAlign: 'center', opacity: 0.4, fontFamily: 'var(--mono)',
    fontSize: 12, letterSpacing: '0.14em', padding: '32px 0',
  },
  feedRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 0', borderBottom: '1px solid rgba(244,231,208,0.06)',
  },
};

// ─── badges ─────────────────────────────────────────────────────────────────

const RESULT_STYLE = {
  valid:           { label: 'Geldig',     color: '#5ad48a', bg: 'rgba(60,200,120,0.15)', icon: '✓' },
  already_scanned: { label: 'Al gescand', color: '#f0a03c', bg: 'rgba(240,140,40,0.16)', icon: '!' },
  invalid:         { label: 'Ongeldig',   color: '#ff8080', bg: 'rgba(220,60,60,0.16)',  icon: '✗' },
  cancelled:       { label: 'Ingetrokken', color: '#ff8080', bg: 'rgba(220,60,60,0.16)', icon: '✗' },
};

const TICKET_STYLE = {
  valid:       { label: 'Nog niet binnen', color: 'var(--cream)', bg: 'rgba(244,231,208,0.12)' },
  scanned:     { label: 'Binnen',          color: '#5ad48a', bg: 'rgba(60,200,120,0.15)' },
  cancelled:   { label: 'Ingetrokken',     color: '#ff8080', bg: 'rgba(220,60,60,0.16)' },
  transferred: { label: 'Overgedragen',    color: '#b48bb4', bg: 'rgba(180,139,180,0.16)' },
};

function Pill({ label, color, bg, icon }) {
  return (
    <span style={{
      ...MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
      color, background: bg, borderRadius: 999, padding: '4px 9px',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {icon ? `${icon} ` : ''}{label}
    </span>
  );
}

const ResultPill = ({ result }) => {
  const c = RESULT_STYLE[result] ?? { label: result ?? '?', color: 'var(--cream)', bg: 'rgba(244,231,208,0.1)' };
  return <Pill {...c} />;
};

const TicketPill = ({ status }) => {
  const c = TICKET_STYLE[status] ?? { label: status ?? '?', color: 'var(--cream)', bg: 'rgba(244,231,208,0.1)' };
  return <Pill {...c} />;
};

// ─── live data ──────────────────────────────────────────────────────────────

function useGateData() {
  const [data, setData] = useState({ events: [], inside: 0, waiting: 0, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [paused, setPaused]   = useState(false);

  const mounted  = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!supabase || inFlight.current) return;   // nooit twee vluchten tegelijk
    inFlight.current = true;
    try {
      const [ev, inside, waiting] = await Promise.all([
        supabase.from('scan_events').select(EVENT_SELECT)
          .order('scanned_at', { ascending: false }).limit(RECENT_LIMIT),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'scanned'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'valid'),
      ]);
      if (!mounted.current) return;

      const failed = ev.error || inside.error || waiting.error;
      if (failed) { setError(failed.message); return; }

      setError(null);
      setData({
        events: ev.data ?? [],
        inside: inside.count ?? 0,
        waiting: waiting.count ?? 0,
        updatedAt: Date.now(),
      });
    } catch (e) {
      // Verbinding weg: de laatst bekende cijfers blijven staan. Een leeg
      // scherm aan de poort is erger dan cijfers van een minuut oud.
      if (mounted.current) setError(e?.message ?? 'Netwerkfout');
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (paused) return undefined;

    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
    };
  }, [load, paused]);

  return { ...data, loading, error, paused, setPaused, reload: load };
}

// ─── pagina ─────────────────────────────────────────────────────────────────

export default function GateOps() {
  const { events, inside, waiting, updatedAt, loading, error, paused, setPaused, reload } = useGateData();
  const now = useNow(TICK_MS);   // laat "x geleden" lopen zonder opnieuw op te halen

  const { flow, problems, devices } = useMemo(() => {
    const base = updatedAt ?? now;
    const flowCut = base - FLOW_WINDOW_MS;
    const probCut = base - PROBLEM_WINDOW_MS;
    let flowCount = 0;
    const probs = [];
    const byDevice = new Map();

    for (const e of events) {
      const t = toMs(e.scanned_at);
      if (e.result === 'valid' && t >= flowCut) flowCount++;
      if (e.result !== 'valid' && t >= probCut) probs.push(e);

      const d = byDevice.get(e.scanner_id) ?? { id: e.scanner_id, total: 0, bad: 0, last: 0 };
      d.total += 1;
      if (e.result !== 'valid') d.bad += 1;
      if (t > d.last) d.last = t;
      byDevice.set(e.scanner_id, d);
    }
    return {
      flow: flowCount,
      problems: probs,
      devices: [...byDevice.values()].sort((a, b) => b.last - a.last),
    };
  }, [events, updatedAt, now]);

  const issued = inside + waiting;
  const pct = issued > 0 ? Math.round((inside / issued) * 100) : 0;

  if (!supabase) {
    return (
      <div className="dash-page">
        <div style={s.errorBanner}>Supabase niet beschikbaar — controleer de omgevingsvariabelen.</div>
      </div>
    );
  }

  return (
    <div className="dash-page">
      <div style={s.header}>
        <div>
          <p style={s.breadcrumb}>DASHBOARD / POORT</p>
          <h1 style={s.pageTitle}>Poortcontrole</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ ...MONO, fontSize: 10, opacity: 0.5 }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: 999, marginRight: 7,
              background: paused ? 'rgba(244,231,208,0.3)' : '#5ad48a',
              boxShadow: paused ? 'none' : '0 0 8px rgba(90,212,138,0.8)',
            }} />
            {updatedAt ? relative(updatedAt, now) : 'laden…'}
          </span>
          <button
            style={s.btn}
            onClick={() => setPaused(p => !p)}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,231,208,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {paused ? '▶ Auto aan' : '❚❚ Pauze'}
          </button>
          <button
            style={{ ...s.btn, borderColor: 'rgba(240,140,40,0.45)', color: 'var(--orange-bright)' }}
            onClick={reload}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,140,40,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            ↻ Ververs
          </button>
        </div>
      </div>

      {error && (
        <div style={s.errorBanner}>
          Verbinding mislukt: {error} — hieronder staan de laatst bekende cijfers.
        </div>
      )}

      {/* ── tellers ── */}
      <div className="dash-metrics-grid">
        <div style={s.metric}>
          <span style={s.metricLabel}>Binnen</span>
          <span style={{ ...s.metricValue, color: '#5ad48a' }}>{loading && !updatedAt ? '—' : inside}</span>
          <span style={s.metricSub}>{issued > 0 ? `${pct}% van ${issued}` : 'geen tickets'}</span>
        </div>
        <div style={s.metric}>
          <span style={s.metricLabel}>Nog te scannen</span>
          <span style={{ ...s.metricValue, color: 'var(--cream)' }}>{loading && !updatedAt ? '—' : waiting}</span>
          <span style={s.metricSub}>geldige tickets</span>
        </div>
        <div style={s.metric}>
          <span style={s.metricLabel}>Laatste 5 min</span>
          <span style={{ ...s.metricValue, color: 'var(--orange-bright)' }}>{loading && !updatedAt ? '—' : flow}</span>
          <span style={s.metricSub}>{flow === 0 ? 'poort staat stil' : 'scans — poort draait'}</span>
        </div>
        <div style={s.metric}>
          <span style={s.metricLabel}>Problemen (1u)</span>
          <span style={{ ...s.metricValue, color: problems.length ? '#ff8080' : 'rgba(244,231,208,0.35)' }}>
            {loading && !updatedAt ? '—' : problems.length}
          </span>
          <span style={s.metricSub}>mislukte scans</span>
        </div>
      </div>

      {/* voortgang */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(244,231,208,0.1)', overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 999,
            background: 'linear-gradient(90deg, var(--orange), #5ad48a)',
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      <SearchPanel onMutated={reload} />

      <ScannerStrip devices={devices} now={now} />

      <div className="dash-feeds-grid" style={{ marginBottom: 8 }}>
        <FeedCard
          title={`Problemen — laatste uur (${problems.length})`}
          events={problems}
          empty="Geen mislukte scans. Alles loopt."
        />
        <FeedCard
          title="Live scans"
          events={events.slice(0, 25)}
          empty="Nog geen scans."
        />
      </div>
    </div>
  );
}

// ─── zoeken + ingrijpen ─────────────────────────────────────────────────────

function SearchPanel({ onMutated }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState(null);   // null = nog niet gezocht
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState(null);
  const seq = useRef(0);                            // gooit late antwoorden weg

  const run = useCallback(async (raw) => {
    const q = sanitizeQuery(raw);
    if (q.length < 2) { setResults(null); setError(null); setBusy(false); return; }

    const mine = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const pat = `%${q}%`;
      // Twee kanten op zoeken: velden op het ticket zelf, en de koper op de
      // bestelling. Losse queries in plaats van een filter over een embedded
      // tabel — dezelfde uitkomst, maar zonder afhankelijk te zijn van hoe
      // PostgREST foreign-table-filters in deze clientversie heet.
      const [byTicket, byOrder] = await Promise.all([
        supabase.from('tickets').select(TICKET_SELECT)
          .or(`ticket_number.ilike.${pat},attendee_name.ilike.${pat},attendee_email.ilike.${pat}`)
          .limit(30),
        supabase.from('orders').select('id')
          .or(`buyer_name.ilike.${pat},buyer_email.ilike.${pat}`)
          .limit(30),
      ]);
      if (mine !== seq.current) return;
      if (byTicket.error) throw byTicket.error;
      if (byOrder.error) throw byOrder.error;

      const rows = [...(byTicket.data ?? [])];
      const orderIds = (byOrder.data ?? []).map(o => o.id);
      if (orderIds.length) {
        const { data: more, error: e } = await supabase
          .from('tickets').select(TICKET_SELECT).in('order_id', orderIds).limit(60);
        if (mine !== seq.current) return;
        if (e) throw e;
        const seen = new Set(rows.map(r => r.id));
        for (const r of more ?? []) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
      }

      // Wat nog actie nodig heeft eerst.
      const rank = { valid: 0, scanned: 1, transferred: 2, cancelled: 3 };
      rows.sort((a, b) =>
        (rank[a.status] ?? 9) - (rank[b.status] ?? 9) ||
        String(a.ticket_number).localeCompare(String(b.ticket_number))
      );
      setResults(rows);
    } catch (e) {
      if (mine === seq.current) { setError(e?.message ?? 'Zoeken mislukt'); setResults([]); }
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => run(query), SEARCH_DEBOUNCE);
    return () => clearTimeout(id);
  }, [query, run]);

  const patchRow = useCallback((id, patch) => {
    setResults(rs => rs ? rs.map(r => (r.id === id ? { ...r, ...patch } : r)) : rs);
    onMutated?.();
  }, [onMutated]);

  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>Zoek een bezoeker</p>
      <input
        style={s.input}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Naam, e-mail of ticketnummer…"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        type="search"
      />

      <div style={{ ...MONO, fontSize: 10, opacity: 0.4, marginTop: 10 }}>
        {busy ? 'zoeken…'
          : results === null ? 'minstens 2 tekens'
          : `${results.length} ticket${results.length === 1 ? '' : 's'}`}
      </div>

      {error && <div style={{ ...s.errorBanner, marginTop: 12, marginBottom: 0 }}>{error}</div>}

      {results !== null && results.length === 0 && !busy && !error && (
        <div style={s.empty}>Niets gevonden.</div>
      )}

      {results !== null && results.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {results.map(t => <TicketCard key={t.id} ticket={t} onPatched={patchRow} />)}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, onPatched }) {
  const now = useNow(TICK_MS);
  const [confirm, setConfirm] = useState(null);   // 'admit' | 'undo'
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState(null);   // { kind: 'ok'|'warn'|'err', text }

  // Een gewapende knop mag niet blijven staan tot een verkeerde tik hem raakt.
  useEffect(() => {
    if (!confirm) return undefined;
    const id = setTimeout(() => setConfirm(null), 5000);
    return () => clearTimeout(id);
  }, [confirm]);

  const order = ticket.orders;
  const person = personOf(ticket);
  const orderUnpaid = order && order.status !== 'paid';

  // Kwam de voorwaardelijke update op nul rijen uit, dan heeft iemand anders
  // dit ticket net aangeraakt. Toon dan wat er echt staat in plaats van de
  // stand van voor de poging.
  async function syncFromServer() {
    const { data } = await supabase
      .from('tickets').select('status, scanned_at, scanned_by').eq('id', ticket.id).maybeSingle();
    if (data) onPatched(ticket.id, data);
  }

  async function admit() {
    setBusy(true); setMsg(null);
    try {
      // Het scan_token wordt alleen hier opgehaald, per ticket, zodat de
      // zoeklijst geen QR-geheimen in de browser hoeft te hebben.
      const { data: tok, error: tokErr } = await supabase
        .from('tickets').select('scan_token').eq('id', ticket.id).single();
      if (tokErr) throw tokErr;

      // .eq('status','valid') maakt dit veilig tegen een scanner die op
      // hetzelfde moment aan de poort staat: geen rijen terug = te laat.
      const { data: updated, error } = await supabase
        .from('tickets')
        .update({ status: 'scanned', scanned_at: new Date().toISOString(), scanned_by: MANUAL_SCANNER })
        .eq('id', ticket.id).eq('status', 'valid')
        .select('id, status, scanned_at, scanned_by');
      if (error) throw error;

      if (!updated?.length) {
        setMsg({ kind: 'warn', text: 'Niet gewijzigd — dit ticket was intussen al gescand of ingetrokken.' });
        await syncFromServer();
        return;
      }

      const row = updated[0];
      onPatched(ticket.id, { status: row.status, scanned_at: row.scanned_at, scanned_by: row.scanned_by });

      // Auditregel. Mislukt die, dan is de toegang al verleend — dat terugdraaien
      // zou schadelijker zijn dan een gaatje in het logboek, dus alleen melden.
      const { error: logErr } = await supabase.from('scan_events').insert({
        ticket_id: ticket.id,
        scan_token: tok.scan_token,
        result: 'valid',
        scanner_id: MANUAL_SCANNER,
        device_info: { source: 'dashboard-handmatig' },
      });
      setMsg(logErr
        ? { kind: 'warn', text: 'Binnengelaten, maar het logboek kon niet worden bijgewerkt.' }
        : { kind: 'ok', text: 'Binnengelaten en geregistreerd.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e?.message ?? 'Mislukt' });
    } finally {
      setBusy(false); setConfirm(null);
    }
  }

  async function undo() {
    setBusy(true); setMsg(null);
    try {
      const { data: updated, error } = await supabase
        .from('tickets')
        .update({ status: 'valid', scanned_at: null, scanned_by: null })
        .eq('id', ticket.id).eq('status', 'scanned')
        .select('id, status, scanned_at, scanned_by');
      if (error) throw error;

      if (!updated?.length) {
        setMsg({ kind: 'warn', text: 'Niet gewijzigd — dit ticket stond niet op gescand.' });
        await syncFromServer();
        return;
      }
      const row = updated[0];
      onPatched(ticket.id, { status: row.status, scanned_at: row.scanned_at, scanned_by: row.scanned_by });
      // De scan_events-regel blijft bewust staan: dat logboek is de audit van
      // wat er echt gebeurd is, en de tellers hierboven komen uit tickets.status.
      setMsg({ kind: 'ok', text: 'Scan teruggedraaid. Het ticket is weer geldig.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e?.message ?? 'Mislukt' });
    } finally {
      setBusy(false); setConfirm(null);
    }
  }

  const msgColor = msg?.kind === 'err' ? '#ff8080' : msg?.kind === 'warn' ? 'var(--orange-bright)' : '#5ad48a';

  return (
    <div style={{
      background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(244,231,208,0.1)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 17, fontWeight: 600, lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {person}
          </div>
          <div style={{ ...MONO, fontSize: 10, opacity: 0.5, marginTop: 3 }}>
            {ticket.ticket_number}
            {ticket.ticket_tiers?.name ? ` · ${ticket.ticket_tiers.name}` : ''}
          </div>
        </div>
        <TicketPill status={ticket.status} />
      </div>

      <div style={{ ...MONO, fontSize: 10, opacity: 0.55, marginTop: 10, lineHeight: 1.9 }}>
        {order && (
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Besteld door {order.buyer_name} · {order.buyer_email}
            {order.quantity > 1 ? ` · ${order.quantity} tickets` : ''}
            {order.order_type === 'comp' ? ' · gratis' : ''}
          </div>
        )}
        {ticket.status === 'scanned' && (
          <div>
            Gescand om {fmtClock(ticket.scanned_at)} ({relative(toMs(ticket.scanned_at), now)})
            {' · '}scanner {deviceLabel(ticket.scanned_by)}
          </div>
        )}
      </div>

      {orderUnpaid && (
        <div style={s.warnBanner}>
          Let op: de bestelling staat op “{order.status}”, niet op betaald.
        </div>
      )}

      {/* Acties */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {ticket.status === 'valid' && (
          <button
            disabled={busy}
            onClick={() => (confirm === 'admit' ? admit() : setConfirm('admit'))}
            style={{
              ...s.btn,
              opacity: busy ? 0.5 : 1,
              cursor: busy ? 'wait' : 'pointer',
              borderColor: confirm === 'admit' ? '#5ad48a' : 'rgba(90,212,138,0.4)',
              color: '#5ad48a',
              background: confirm === 'admit' ? 'rgba(60,200,120,0.16)' : 'transparent',
            }}
          >
            {busy ? '…' : confirm === 'admit' ? 'Bevestig: binnenlaten' : '✓ Handmatig binnenlaten'}
          </button>
        )}

        {ticket.status === 'scanned' && (
          <button
            disabled={busy}
            onClick={() => (confirm === 'undo' ? undo() : setConfirm('undo'))}
            style={{
              ...s.btn,
              opacity: busy ? 0.5 : 1,
              cursor: busy ? 'wait' : 'pointer',
              borderColor: confirm === 'undo' ? 'var(--orange-bright)' : 'rgba(240,140,40,0.4)',
              color: 'var(--orange-bright)',
              background: confirm === 'undo' ? 'rgba(240,140,40,0.16)' : 'transparent',
            }}
          >
            {busy ? '…' : confirm === 'undo' ? 'Bevestig: scan terugdraaien' : '↺ Scan terugdraaien'}
          </button>
        )}
      </div>

      {confirm === 'undo' && (
        <div style={s.warnBanner}>
          De scannertelefoon die dit ticket scande, onthoudt het offline als
          “gescand”. Die blijft het weigeren tot de app opnieuw inlogt — laat de
          bezoeker binnen via een andere scanner of handmatig.
        </div>
      )}

      {msg && (
        <div style={{ ...MONO, fontSize: 10, marginTop: 10, color: msgColor, lineHeight: 1.6 }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ─── scanners ───────────────────────────────────────────────────────────────

function ScannerStrip({ devices, now }) {
  if (!devices.length) return null;

  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>Scanners ({devices.length})</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {devices.map(d => {
          const stale = now - d.last > DEVICE_STALE_MS;
          return (
            <div key={d.id} style={{
              background: 'rgba(0,0,0,0.22)',
              border: `1px solid ${stale ? 'rgba(240,140,40,0.35)' : 'rgba(244,231,208,0.12)'}`,
              borderRadius: 10, padding: '10px 14px', minWidth: 130,
            }}>
              <div style={{ ...MONO, fontSize: 11, color: stale ? 'var(--orange-bright)' : 'var(--cream)' }}>
                {deviceLabel(d.id)}
              </div>
              <div style={{ ...MONO, fontSize: 9, opacity: 0.5, marginTop: 4 }}>
                {relative(d.last, now)}
              </div>
              <div style={{ ...MONO, fontSize: 9, opacity: 0.5, marginTop: 2 }}>
                {d.total} scans{d.bad > 0 ? ` · ${d.bad} fout` : ''}
              </div>
            </div>
          );
        })}
      </div>
      {devices.some(d => now - d.last > DEVICE_STALE_MS) && (
        <div style={s.warnBanner}>
          Een scanner is al meer dan 10 minuten stil. Controleer batterij en
          verbinding aan de ingang.
        </div>
      )}
    </div>
  );
}

// ─── feeds ──────────────────────────────────────────────────────────────────

function FeedCard({ title, events, empty }) {
  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>{title}</p>
      {events.length === 0 ? (
        <div style={s.empty}>{empty}</div>
      ) : (
        <div>
          {events.map(e => {
            // Een ongeldige scan heeft geen ticket: dan blijft alleen het
            // token over, en daarvan is een prefix genoeg om te herkennen dat
            // dezelfde onbekende code meermaals langskwam.
            const who = e.tickets
              ? personOf(e.tickets)
              : `onbekende code ${String(e.scan_token ?? '').slice(0, 8) || '—'}`;
            return (
              <div key={e.id} style={s.feedRow}>
                <span style={{ ...MONO, fontSize: 10, opacity: 0.45, width: 62, flexShrink: 0 }}>
                  {fmtClock(e.scanned_at)}
                </span>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 13,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  opacity: e.tickets ? 1 : 0.6,
                }}>
                  {who}
                  {e.tickets?.ticket_number && (
                    <span style={{ ...MONO, fontSize: 9, opacity: 0.4 }}> {e.tickets.ticket_number}</span>
                  )}
                </span>
                <span style={{ ...MONO, fontSize: 9, opacity: 0.35, flexShrink: 0 }}>
                  {deviceLabel(e.scanner_id)}
                </span>
                <ResultPill result={e.result} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
