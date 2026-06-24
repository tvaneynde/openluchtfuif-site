function Star() {
  return (
    <svg className="star" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon fill="currentColor" points="50,3 57.6,31.5 83.2,16.8 68.5,42.4 97,50 68.5,57.6 83.2,83.2 57.6,68.5 50,97 42.4,68.5 16.8,83.2 31.5,57.6 3,50 31.5,42.4 16.8,16.8 42.4,31.5" />
    </svg>
  );
}

const EDITIONS = [
  {
    year: "2025",
    theme: "Editie XIII",
    attendees: "",
    tag: "Latest",
    photo: `${import.meta.env.BASE_URL}assets/photo-1.jpg`,
    link: "",
  },
  {
    year: "2024",
    theme: "De Heropleving",
    attendees: "",
    tag: "",
    photo: `${import.meta.env.BASE_URL}assets/photo-3.jpg`,
    link: "",
  },
  {
    year: "1981–2008",
    theme: "De Gouden Jaren",
    attendees: "17 edities",
    tag: "Heritage",
    photo: `${import.meta.env.BASE_URL}assets/photo-6.jpg`,
    archiveLink: "#/archief",
  },
];

function EditionCard({ ed, size, style }) {
  const href = ed.link || ed.archiveLink || null;
  const Tag = href ? "a" : "div";
  const linkProps = href
    ? { href, ...(ed.link ? { target: "_blank", rel: "noreferrer" } : {}) }
    : {};
  return (
    <Tag className={`edition-card ${size}`} style={{ textDecoration: "none", color: "inherit", ...style }} {...linkProps}>
      <div
        className="edition-bg"
        style={{
          backgroundImage: `url(${ed.photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "absolute",
          inset: 0,
          filter: "saturate(1.1) contrast(1.05)",
        }}
      />
      {ed.tag && <span className="edition-tag">{ed.tag}</span>}
      <div className="edition-cover">
        <div className="edition-year">{ed.year}</div>
        <div className="edition-meta">
          <span>{ed.theme}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {ed.attendees && <span>{ed.attendees}</span>}
            {ed.archiveLink !== undefined && (
              <a
                href={ed.archiveLink || "#"}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  color: "var(--cream)",
                  opacity: ed.archiveLink ? 1 : 0.4,
                  textDecoration: "none",
                  pointerEvents: ed.archiveLink ? "auto" : "none",
                }}
                onClick={e => e.stopPropagation()}
              >
                Alle foto's →
              </a>
            )}
          </div>
        </div>
      </div>
    </Tag>
  );
}

export default function Edities() {
  return (
    <section id="edities">
      <div className="section-head">
        <span className="section-num">02 / Archief</span>
        <h2 className="section-title">Vorige edities</h2>
      </div>
      <p style={{ fontSize: 18, maxWidth: 720, marginBottom: 48, opacity: 0.85 }}>
        Na zeventien jaar stilte bliezen we in 2024 de Openluchtfuif weer leven
        in — dezelfde wei, dezelfde buitenlucht, een nieuwe ploeg. Hieronder een
        doorsnee van de verhalen.
      </p>

      {/* Hero row: 2025 wide + 2024 portrait */}
      <div className="edities-hero-row">
        <EditionCard ed={EDITIONS[0]} size="hero" />
        <EditionCard ed={EDITIONS[1]} size="side" />
      </div>

      {/* Second row: heritage card (wide) + CTA */}
      <div className="edities-row2" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <EditionCard ed={EDITIONS[2]} size="third" style={{ aspectRatio: "unset", height: 480 }} />
        <div className="edition-card third edition-cta-card" style={{ aspectRatio: "unset", height: 480 }}>
          <div className="edition-cover" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 3vw, 48px)", lineHeight: 1.1, marginBottom: 20 }}>
              Jij erbij<br />in 2026?
            </div>
            <a href="#tickets" className="btn btn-primary">Tickets kopen →</a>
          </div>
        </div>
      </div>
    </section>
  );
}
