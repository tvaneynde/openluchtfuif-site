import { useState, useEffect } from 'react';
import { supabase, imgUrl } from '../utils/supabase';

const STAGE_LABEL = { main: 'Main Stage', dub: 'Dub Stage' };
const STAGES = ['main', 'dub'];

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

function ArtistAvatar({ artist, size = 80 }) {
  if (artist.photo_path) {
    return (
      <div
        className="artist-avatar"
        style={{ width: size, height: size, backgroundImage: `url(${imgUrl(artist.photo_path)})` }}
      />
    );
  }
  return (
    <div className="artist-avatar artist-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {artist.name.charAt(0)}
    </div>
  );
}

function StageColumn({ stage, artists, onSelect }) {
  if (!artists.length) return null;
  const headliners = artists.filter(a => a.headliner);
  const rest = artists.filter(a => !a.headliner);

  return (
    <div className={`lineup-stage-col stage-${stage}`}>
      <div className="lineup-stage-head mono">
        <span className="lineup-stage-dot" />
        {STAGE_LABEL[stage]}
      </div>
      {[...headliners, ...rest].map(a => (
        <button key={a.id} className={`lineup-row${a.headliner ? ' headliner' : ''}`} onClick={() => onSelect(a)}>
          <span className="time">{a.time_slot || '—'}</span>
          <span className="artist">{a.name}</span>
          <span className="peek" style={a.photo_path ? { backgroundImage: `url(${imgUrl(a.photo_path)})` } : undefined} />
        </button>
      ))}
    </div>
  );
}

function ArtistModal({ artist, onClose }) {
  if (!artist) return null;
  return (
    <div className="artist-modal-backdrop" onClick={onClose}>
      <div className="artist-modal" onClick={e => e.stopPropagation()} style={{ '--rot': '-1deg' }}>
        <button className="artist-modal-close" onClick={onClose} aria-label="Sluiten">✕</button>
        <ArtistAvatar artist={artist} size={120} />
        <div className="artist-modal-stage mono">{STAGE_LABEL[artist.stage] || STAGE_LABEL.main}</div>
        <h3 className="artist-modal-name">{artist.name}</h3>
        <div className="artist-modal-meta mono">
          <span>{artist.time_slot || '—'}</span>
        </div>
        {artist.bio && <p className="artist-modal-bio">{artist.bio}</p>}
      </div>
    </div>
  );
}

function LiveLineup({ artists }) {
  const [selected, setSelected] = useState(null);

  if (!artists.length) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.3 }}>
        LADEN…
      </div>
    );
  }

  return (
    <>
      <div className="lineup-stages-grid">
        {STAGES.map(stage => (
          <StageColumn
            key={stage}
            stage={stage}
            artists={artists.filter(a => a.stage === stage)}
            onSelect={setSelected}
          />
        ))}
      </div>
      <ArtistModal artist={selected} onClose={() => setSelected(null)} />
    </>
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

  const stageCount = new Set(artists.map(a => a.stage || 'main')).size;
  const podiumText = stageCount >= 2 ? 'Twee podia' : 'Eén podium';

  return (
    <section id="lineup" className="section-glow glow-lineup" style={{ background: "var(--purple-deep)" }}>
      <div className="section-head">
        <span className="section-num">03 / Line-Up</span>
        <h2 className="section-title">Line-up</h2>
      </div>

      <div className="lineup-meta-row">
        <div className="mono" style={{ opacity: 0.6 }}>
          Zaterdag 29 Augustus 2026 · {mode === 'live' ? podiumText : 'Twee podia'} · 16:00 → 03:00
        </div>
      </div>

      {mode === 'coming_soon' ? <ComingSoon /> : <LiveLineup artists={artists} />}
    </section>
  );
}
