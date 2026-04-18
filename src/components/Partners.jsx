const PARTNERS = [
  { name: "Red Bull",      domain: "redbull.com" },
  { name: "Proximus",      domain: "proximus.be" },
  { name: "Stella Artois", domain: "stellaartois.com" },
  { name: "Colruyt",       domain: "colruyt.be" },
  { name: "KBC",           domain: "kbc.be" },
  { name: "Duvel",         domain: "duvel.com" },
  { name: "Belfius",       domain: "belfius.be" },
  { name: "ING",           domain: "ing.be" },
  { name: "Coca-Cola",     domain: "coca-cola.com" },
  { name: "Spar",          domain: "spar.be" },
  { name: "VRT",           domain: "vrt.be" },
  { name: "Spotify",       domain: "spotify.com" },
];

const SCATTER = [
  { r: -3,   y: 8  },
  { r:  2.5, y: -5 },
  { r: -1.5, y: 10 },
  { r:  4,   y: -8 },
  { r: -2,   y: 5  },
  { r:  3.5, y: 12 },
  { r: -4,   y: -6 },
  { r:  1,   y: 9  },
  { r: -2.5, y: -4 },
  { r:  3,   y: 7  },
  { r: -1,   y: -9 },
  { r:  2,   y: 4  },
];

function PartnerLogo({ partner }) {
  const initials = partner.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="scatter-logo-wrap">
      <span className="scatter-logo-fallback">{initials}</span>
      <img
        src={`https://logo.clearbit.com/${partner.domain}`}
        alt={partner.name}
        className="scatter-logo-img"
        onError={e => { e.currentTarget.style.opacity = "0"; }}
      />
    </div>
  );
}

export default function Partners() {
  return (
    <section id="partners">
      <div className="section-head">
        <span className="section-num">05 / Steun</span>
        <h2 className="section-title">Partners</h2>
      </div>
      <p style={{ fontSize: 18, maxWidth: 720, marginBottom: 56, opacity: 0.85 }}>
        Zonder deze mensen staat er letterlijk geen podium. Dikke merci.
      </p>

      <div className="partners-scatter">
        {PARTNERS.map((p, i) => (
          <div
            key={p.name}
            className="partner-scatter-tile scroll-reveal"
            style={{
              "--r":         `${SCATTER[i].r}deg`,
              "--ty":        `${SCATTER[i].y}px`,
              "--bob-delay": `${i * 0.25}s`,
              "--delay":     `${i * 0.06}s`,
            }}
          >
            <PartnerLogo partner={p} />
            <span className="scatter-name">{p.name}</span>
          </div>
        ))}
      </div>

      <div className="partners-cta">
        <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 4vw, 52px)", marginBottom: 12 }}>
          Jouw logo hier?
        </div>
        <p style={{ opacity: 0.75, maxWidth: 440, margin: "0 auto 24px", fontSize: 15 }}>
          We zoeken nog partners die onze prijs voor jongeren laag willen houden. Elk gebaar telt.
        </p>
        <a className="btn btn-primary" href="mailto:partners@openluchtfuif.be">Word partner →</a>
      </div>
    </section>
  );
}
