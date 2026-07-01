import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

function ComingSoon() {
  return (
    <div className="lineup-coming-soon">
      <div className="lineup-cs-inner">
        <div className="mono" style={{ color: "var(--orange-bright)", marginBottom: 16 }}>◉ Binnenkort</div>
        <div style={{ fontFamily: "var(--display)", fontSize: "clamp(36px, 6vw, 80px)", lineHeight: 0.9, marginBottom: 24 }}>
          Line-up volgt<br />snel
        </div>
        <p style={{ fontSize: 15, opacity: 0.7, maxWidth: 400 }}>
          Volg ons op Instagram — je bent de eerste die het weet.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <a href="https://www.instagram.com/openluchtfuif3212" target="_blank" rel="noreferrer" className="btn btn-primary">Volg ons →</a>
        </div>
      </div>
      <div className="lineup-cs-slots">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="lineup-cs-row">
            <span className="lineup-cs-pill" style={{ width: `${60 + (i % 3) * 20}px` }} />
            <span className="lineup-cs-pill" style={{ width: `${120 + (i % 5) * 30}px` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveLineup({ artists }) {
  if (!artists.length) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.3 }}>
        LADEN…
      </div>
    );
  }

  const headliners = artists.filter(a => a.headliner);
  const rest = artists.filter(a => !a.headliner);

  return (
    <div style={{ maxWidth: 860 }}>
      {headliners.map(a => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'baseline', gap: 24,
          padding: '20px 0', borderBottom: '1px solid rgba(244,231,208,0.12)',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--orange)', minWidth: 130, flexShrink: 0 }}>
            {a.time_slot || '—'}
          </span>
          <span style={{ fontFamily: 'var(--display)', fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1, flex: 1 }}>
            {a.name}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(244,231,208,0.35)', flexShrink: 0 }}>
            {a.genre}
          </span>
        </div>
      ))}
      {rest.map(a => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'baseline', gap: 24,
          padding: '14px 0', borderBottom: '1px solid rgba(244,231,208,0.07)',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', color: 'rgba(244,231,208,0.4)', minWidth: 130, flexShrink: 0 }}>
            {a.time_slot || '—'}
          </span>
          <span style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px, 3vw, 36px)', lineHeight: 1.1, flex: 1 }}>
            {a.name}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(244,231,208,0.25)', flexShrink: 0 }}>
            {a.genre}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Lineup({ mode = 'coming_soon' }) {
  const [artists, setArtists] = useState([]);

  useEffect(() => {
    if (mode !== 'live' || !supabase) return;
    supabase
      .from('lineup_artists')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setArtists(data); });
  }, [mode]);

  return (
    <section id="lineup" style={{ background: "var(--purple-deep)" }}>
      <div className="section-head">
        <span className="section-num">03 / Line-Up</span>
        <h2 className="section-title">Line-up</h2>
      </div>

      <div className="lineup-meta-row">
        <div className="mono" style={{ opacity: 0.6 }}>Zaterdag 29 Augustus 2026 · Eén podium · 16:00 → 03:00</div>
      </div>

      {mode === 'coming_soon' ? <ComingSoon /> : <LiveLineup artists={artists} />}
    </section>
  );
}
