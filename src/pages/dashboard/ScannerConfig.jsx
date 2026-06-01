import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../utils/supabase';

// ─── Shared styles (mirrors TierManagement) ──────────────────────────────────

const s = {
  page: {
    background: 'transparent',
    minHeight: '100vh',
    color: 'var(--cream)',
    fontFamily: 'var(--body)',
    padding: '40px 48px',
  },
  header: {
    marginBottom: 36,
  },
  breadcrumb: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.16em',
    opacity: 0.4,
    margin: '0 0 6px',
  },
  pageTitle: {
    fontFamily: 'var(--display)',
    fontSize: 48,
    lineHeight: 1,
    margin: 0,
  },
  sectionTitle: {
    fontFamily: 'var(--display)',
    fontSize: 26,
    lineHeight: 1.1,
    margin: '0 0 20px',
    color: 'var(--cream)',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(244,231,208,0.1)',
    borderRadius: 16,
    padding: '28px 32px',
    marginBottom: 24,
    position: 'relative',
  },
  label: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.16em',
    opacity: 0.6,
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(244,231,208,0.18)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--cream)',
    fontFamily: 'var(--mono)',
    fontSize: 20,
    letterSpacing: '0.18em',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '120px',
    boxSizing: 'border-box',
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
  statCard: {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: '16px 20px',
    flex: 1,
    minWidth: 140,
  },
  statLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.18em',
    opacity: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
    display: 'block',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--orange-bright)',
    lineHeight: 1,
  },
  successBanner: {
    background: 'rgba(80,200,80,0.12)',
    border: '1px solid rgba(120,220,120,0.35)',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#7de87d',
    fontFamily: 'var(--mono)',
    fontSize: 12,
    letterSpacing: '0.1em',
    marginTop: 14,
  },
  errorBanner: {
    background: 'rgba(220,60,60,0.15)',
    border: '1px solid rgba(220,60,60,0.35)',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#ff8080',
    fontFamily: 'var(--mono)',
    fontSize: 12,
    letterSpacing: '0.1em',
    marginTop: 14,
  },
};

const SCANNER_URL = 'https://tvaneynde.github.io/openluchtfuif-site/#/scanner';

// ─── Section 1: PIN management ───────────────────────────────────────────────

function PinSection() {
  const [currentPin, setCurrentPin] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', msg }
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function fetchPin() {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'scanner_pin')
        .single();
      if (error) {
        setLoadError('Kon PIN niet laden: ' + error.message);
      } else {
        setCurrentPin(data.value);
      }
    }
    fetchPin();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (!newPin || newPin.length < 1) return;

    const padded = newPin.padStart(4, '0');
    setSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from('config')
      .update({ value: padded })
      .eq('key', 'scanner_pin');

    setSaving(false);

    if (error) {
      setFeedback({ type: 'error', msg: 'Opslaan mislukt: ' + error.message });
    } else {
      setCurrentPin(padded);
      setNewPin('');
      setFeedback({ type: 'success', msg: 'PIN succesvol bijgewerkt.' });
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  return (
    <div style={s.card}>
      <h2 style={s.sectionTitle}>Scanner PIN</h2>

      {loadError && (
        <div style={{ ...s.errorBanner, marginTop: 0, marginBottom: 16 }}>{loadError}</div>
      )}

      {/* Current PIN display */}
      <div style={{ marginBottom: 24 }}>
        <span style={s.label}>Huidige PIN</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 28,
            letterSpacing: '0.25em',
            color: 'var(--cream)',
            background: 'rgba(0,0,0,0.25)',
            padding: '8px 18px',
            borderRadius: 8,
            display: 'inline-block',
            minWidth: 100,
            textAlign: 'center',
          }}>
            {currentPin === null ? '···' : showPin ? currentPin.padStart(4, '0') : '••••'}
          </span>
          <button
            type="button"
            style={s.btnSecondary}
            onClick={() => setShowPin(v => !v)}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,0.08)'}
          >
            {showPin ? 'Verberg' : 'Toon'}
          </button>
        </div>
      </div>

      {/* Change PIN form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 280 }}>
        <div>
          <label style={s.label}>Nieuwe PIN (4 cijfers)</label>
          <input
            style={s.input}
            type="number"
            min={0}
            max={9999}
            step={1}
            value={newPin}
            onChange={e => {
              // Clamp to max 4 digits
              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
              setNewPin(val);
            }}
            placeholder="0000"
            required
          />
        </div>
        <div>
          <button
            type="submit"
            style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1 }}
            disabled={saving || !newPin}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'var(--orange-bright)'; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = 'var(--orange)'; }}
          >
            {saving ? 'Opslaan…' : 'PIN opslaan'}
          </button>
        </div>
      </form>

      {feedback && (
        <div style={feedback.type === 'success' ? s.successBanner : s.errorBanner}>
          {feedback.msg}
        </div>
      )}

      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type="number"] { -moz-appearance: textfield; }
        input:focus { border-color: var(--orange) !important; }
      `}</style>
    </div>
  );
}

// ─── Section 2: QR code ───────────────────────────────────────────────────────

function QrSection() {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrError, setQrError] = useState(null);

  useEffect(() => {
    QRCode.toDataURL(SCANNER_URL, {
      width: 240,
      margin: 2,
      color: { dark: '#1e0b28', light: '#ffffff' },
    })
      .then(url => setQrDataUrl(url))
      .catch(err => setQrError(err.message));
  }, []);

  return (
    <div style={s.card}>
      <h2 style={s.sectionTitle}>Scanner QR-code</h2>
      <p style={{
        fontFamily: 'var(--body)',
        fontSize: 13,
        opacity: 0.55,
        margin: '0 0 20px',
        lineHeight: 1.6,
      }}>
        Laat vrijwilligers deze QR-code scannen om de scanner-app direct te openen.
      </p>

      {qrError && (
        <div style={{ ...s.errorBanner, marginTop: 0 }}>QR-code genereren mislukt: {qrError}</div>
      )}

      {qrDataUrl && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div style={{
            background: '#ffffff',
            padding: 12,
            borderRadius: 12,
            display: 'inline-block',
            lineHeight: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            <img src={qrDataUrl} alt="Scanner QR-code" style={{ width: 200, height: 200, display: 'block' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', paddingTop: 8 }}>
            <span style={{ ...s.label, marginBottom: 2 }}>Direct URL</span>
            <a
              href={SCANNER_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--orange)',
                opacity: 0.8,
                wordBreak: 'break-all',
                textDecoration: 'none',
                maxWidth: 280,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
            >
              {SCANNER_URL}
            </a>
            <a
              href={qrDataUrl}
              download="scanner-qr.png"
              style={{
                ...s.btnSecondary,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                marginTop: 8,
                width: 'fit-content',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,0.08)'}
            >
              ↓ Download PNG
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section 3: Stats ────────────────────────────────────────────────────────

function StatsSection() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setLoadError(null);

      // Today midnight in local time, converted to ISO
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      // Scans today (valid)
      const { count: todayCount, error: e1 } = await supabase
        .from('scan_events')
        .select('*', { count: 'exact', head: true })
        .eq('result', 'valid')
        .gte('scanned_at', todayIso);

      // Total valid scans
      const { count: totalCount, error: e2 } = await supabase
        .from('scan_events')
        .select('*', { count: 'exact', head: true })
        .eq('result', 'valid');

      // Last scan timestamp (any result)
      const { data: lastData, error: e3 } = await supabase
        .from('scan_events')
        .select('scanned_at')
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const err = e1 || e2 || e3;
      if (err) {
        setLoadError('Fout bij laden van statistieken: ' + err.message);
      } else {
        setStats({
          today: todayCount ?? 0,
          total: totalCount ?? 0,
          lastScan: lastData?.scanned_at ?? null,
        });
      }
      setLoading(false);
    }

    fetchStats();
  }, []);

  function formatTimestamp(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('nl-BE', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  }

  return (
    <div style={s.card}>
      <h2 style={s.sectionTitle}>Scan statistieken</h2>

      {loading && (
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          opacity: 0.4,
          letterSpacing: '0.14em',
          padding: '20px 0',
        }}>
          Laden…
        </div>
      )}

      {loadError && (
        <div style={{ ...s.errorBanner, marginTop: 0 }}>{loadError}</div>
      )}

      {stats && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={s.statCard}>
            <span style={s.statLabel}>Gescand vandaag</span>
            <div style={s.statValue}>{stats.today}</div>
          </div>
          <div style={s.statCard}>
            <span style={s.statLabel}>Totaal geldig</span>
            <div style={s.statValue}>{stats.total}</div>
          </div>
          <div style={{ ...s.statCard, flex: 2, minWidth: 200 }}>
            <span style={s.statLabel}>Laatste scan</span>
            <div style={{
              fontSize: 16,
              fontFamily: 'var(--mono)',
              letterSpacing: '0.06em',
              color: 'var(--cream)',
              opacity: stats.lastScan ? 1 : 0.4,
              paddingTop: 4,
            }}>
              {formatTimestamp(stats.lastScan)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScannerConfig() {
  return (
    <div style={s.page}>
      <div style={s.header}>
        <p style={s.breadcrumb}>DASHBOARD / SCANNER</p>
        <h1 style={s.pageTitle}>Scanner</h1>
      </div>

      <PinSection />
      <QrSection />
      <StatsSection />
    </div>
  );
}
