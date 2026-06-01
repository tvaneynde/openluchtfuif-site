import { imgUrl } from '../utils/supabase';

const COMING_SOON = false;

const HOOFDSPONSORS = [
  { name: "Baets",    file: "baets.jpg" },
  { name: "Huurland", file: "huurland.png" },
  { name: "Pasteels", file: "pasteels.png" },
];

const PARTNERS = [
  { name: "Spar Linden",    file: "sparlinden.jpg" },
  { name: "Vlaams-Brabant", file: "vlaamsbrabant.jpg.jpg" },
  { name: "Immodrome",      file: "immodrome.png" },
  { name: "Philippe Spaas", file: "philippespaas.png" },
  { name: "Bits & Baets",   file: "bitsnbaets.png" },
  { name: "Lopharma",       file: "lopharma.png" },
  { name: "De Raaf",        file: "deraaf.png" },
  { name: "Sempels",        file: "sempels.svg" },
  { name: "RGT Cars",       file: "rgtcars.png" },
  { name: "Shaved Monkey",  file: "shavedmonkey.png" },
  { name: "An Wouters",     file: "anwouters.png" },
  { name: "Louis Schreve",  file: "louisschrevebs.png" },
  { name: "Buurt 3212",     file: "buurt3212.jpeg" },
  { name: "Uw Notaris",     file: "uwnotaris.jpg" },
];

const SCATTER_MAIN = [
  { r: -2   }, { r:  1.5 }, { r: -1   }, { r:  2   },
  { r: -1.5 }, { r:  2   }, { r: -2.5 }, { r:  1   },
  { r: -1.5 }, { r:  2   }, { r: -1   }, { r:  1.5 },
  { r: -2   }, { r:  1   },
];

const SCATTER_HOOFDSPONSORS = [
  { r: -1.5 }, { r: 0 }, { r: 1.5 },
];

function PartnerLogo({ file, name, size = 72 }) {
  return (
    <div className="scatter-logo-wrap" style={{ width: size, height: size }}>
      <img
        src={imgUrl(`partners/${file}`)}
        alt={name}
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
      {COMING_SOON ? (
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
      ) : (
        <>
          <p style={{ fontSize: 18, maxWidth: 720, marginBottom: 48, opacity: 0.85 }}>
            Zonder deze mensen staat er letterlijk geen podium. Dikke merci.
          </p>

          {/* Hoofdsponsors */}
          <div className="mono" style={{ color: "var(--orange-bright)", letterSpacing: "0.2em", marginBottom: 20 }}>
            ◉ Hoofdsponsors
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 48 }}>
            {HOOFDSPONSORS.map((p, i) => (
              <div
                key={p.name}
                className="partner-scatter-tile scroll-reveal"
                style={{
                  "--r":     `${SCATTER_HOOFDSPONSORS[i].r}deg`,
                  "--delay": `${i * 0.08}s`,
                  padding: "36px 28px 30px",
                }}
              >
                <PartnerLogo file={p.file} name={p.name} size={110} />
                <span className="scatter-name" style={{ fontSize: "clamp(18px, 1.8vw, 24px)" }}>
                  {p.name}
                </span>
              </div>
            ))}
          </div>

          {/* Regular partners */}
          <div className="mono" style={{ color: "rgba(244,231,208,.4)", letterSpacing: "0.2em", marginBottom: 20 }}>
            ◉ Partners
          </div>
          <div className="partners-scatter">
            {PARTNERS.map((p, i) => (
              <div
                key={p.name}
                className="partner-scatter-tile scroll-reveal"
                style={{
                  "--r":     `${SCATTER_MAIN[i].r}deg`,
                  "--delay": `${i * 0.06}s`,
                }}
              >
                <PartnerLogo file={p.file} name={p.name} />
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
            <a className="btn btn-primary" href="mailto:openluchtfuif3212@gmail.com">Word partner →</a>
          </div>
        </>
      )}
    </section>
  );
}
