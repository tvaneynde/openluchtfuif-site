import { useState, useEffect } from 'react';
import { supabase, imgUrl } from '../utils/supabase';

function PartnerLogo({ path, name, size = 72 }) {
  return (
    <div className="scatter-logo-wrap" style={{ width: size, height: size }}>
      <img
        src={imgUrl(path)}
        alt={name}
        className="scatter-logo-img"
        onError={e => { e.currentTarget.style.opacity = "0"; }}
      />
    </div>
  );
}

const SCATTER_FEATURED = [{ r: -1.5 }, { r: 0 }, { r: 1.5 }, { r: -1 }, { r: 1 }];
const SCATTER_MAIN = [
  { r: -2 }, { r: 1.5 }, { r: -1 }, { r: 2 }, { r: -1.5 }, { r: 2 },
  { r: -2.5 }, { r: 1 }, { r: -1.5 }, { r: 2 }, { r: -1 }, { r: 1.5 },
  { r: -2 }, { r: 1 }, { r: -0.5 }, { r: 2 },
];

export default function Partners({ mode = 'live' }) {
  const [featured, setFeatured] = useState([]);
  const [regular, setRegular]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (mode !== 'live' || !supabase) { setLoading(false); return; }
    supabase
      .from('partners')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) {
          setFeatured(data.filter(p => p.featured));
          setRegular(data.filter(p => !p.featured));
        }
        setLoading(false);
      });
  }, [mode]);

  return (
    <section id="partners">
      <div className="section-head">
        <span className="section-num">05 / Steun</span>
        <h2 className="section-title">Partners</h2>
      </div>

      {mode === 'coming_soon' ? (
        <div style={{ paddingBottom: 40 }}>
          <div className="mono" style={{ color: "var(--orange-bright)", marginBottom: 16 }}>◉ Binnenkort</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 5vw, 64px)", lineHeight: 0.95, marginBottom: 20 }}>
            Partners volgen<br />snel
          </div>
          <p style={{ fontSize: 15, opacity: 0.6, maxWidth: 440, marginBottom: 28 }}>
            Wil jij mee de Openluchtfuif mogelijk maken? We zijn op zoek naar lokale en regionale partners.
          </p>
          <a className="btn btn-primary" href="mailto:openluchtfuif3212@gmail.com">Word partner →</a>
        </div>
      ) : loading ? (
        <div style={{ padding: '60px 0', fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.3 }}>LADEN…</div>
      ) : (
        <>
          <p style={{ fontSize: 18, maxWidth: 720, marginBottom: 48, opacity: 0.85 }}>
            Zonder deze mensen staat er letterlijk geen podium. Dikke merci.
          </p>

          {featured.length > 0 && (
            <>
              <div className="mono" style={{ color: "var(--orange-bright)", letterSpacing: "0.2em", marginBottom: 20 }}>
                ◉ Hoofdsponsors
              </div>
              <div className="partners-featured-grid">
                {featured.map((p, i) => (
                  <div
                    key={p.id}
                    className="partner-scatter-tile"
                    style={{
                      "--r":     `${(SCATTER_FEATURED[i] || SCATTER_FEATURED[0]).r}deg`,
                      "--delay": `${i * 0.08}s`,
                      padding: "36px 28px 30px",
                    }}
                  >
                    {p.logo_path
                      ? <PartnerLogo path={p.logo_path} name={p.name} size={110} />
                      : <div style={{ width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, opacity: 0.3 }}>{p.name}</div>
                    }
                    <span className="scatter-name" style={{ fontSize: "clamp(18px, 1.8vw, 24px)" }}>
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {regular.length > 0 && (
            <>
              <div className="mono" style={{ color: "rgba(244,231,208,.4)", letterSpacing: "0.2em", marginBottom: 20 }}>
                ◉ Partners
              </div>
              <div className="partners-scatter">
                {regular.map((p, i) => (
                  <div
                    key={p.id}
                    className="partner-scatter-tile"
                    style={{
                      "--r":     `${(SCATTER_MAIN[i] || { r: 0 }).r}deg`,
                      "--delay": `${i * 0.06}s`,
                    }}
                  >
                    {p.logo_path
                      ? <PartnerLogo path={p.logo_path} name={p.name} />
                      : <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, opacity: 0.3 }}>{p.name}</div>
                    }
                    <span className="scatter-name">{p.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="partners-cta">
            <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 4vw, 52px)", marginBottom: 12 }}>
              Jouw logo hier?
            </div>
            <p style={{ opacity: 0.75, maxWidth: 440, margin: "0 auto 24px", fontSize: 15 }}>
              We zoeken nog partners die onze prijs voor jongeren laag willen houden. Elk gebaar telt.
            </p>
            <a className="btn btn-primary" href="mailto:openluchtfuif3212@gmail.com">Word partner →</a>
          </div>
        </>
      )}
    </section>
  );
}
