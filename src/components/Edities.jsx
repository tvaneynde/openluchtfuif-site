function Star() {
  // 8-pointed starburst: alternating outer (r=47) and inner (r=19) points
  return (
    <svg className="star" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon
        fill="currentColor"
        points="50,3 57.6,31.5 83.2,16.8 68.5,42.4 97,50 68.5,57.6 83.2,83.2 57.6,68.5 50,97 42.4,68.5 16.8,83.2 31.5,57.6 3,50 31.5,42.4 16.8,16.8 42.4,31.5"
      />
    </svg>
  );
}

const EDITIONS = [
  { year: "2025", theme: "Editie XIII", attendees: "", tag: "Latest", photo: "/assets/photo-1.jpg" },
  { year: "2024", theme: "De Heropleving", attendees: "", tag: "", photo: "/assets/photo-3.jpg" },
  { year: "1981–2008", theme: "De Gouden Jaren", attendees: "17 edities", tag: "Heritage", photo: "/assets/photo-6.jpg" },
  { year: "Archief", theme: "Alle foto's →", attendees: "", tag: "Gallery", photo: "/assets/photo-4.jpg" },
];

function EditionCard({ ed, size }) {
  return (
    <div className={`edition-card ${size}`}>
      <div className="edition-bg" style={{
        backgroundImage: `url(${ed.photo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "absolute",
        inset: 0,
        filter: "saturate(1.1) contrast(1.05)"
      }} />
      {ed.tag && <span className="edition-tag">{ed.tag}</span>}
      <div className="edition-cover">
        <div className="edition-year">{ed.year}</div>
        <div className="edition-meta">
          <span>{ed.theme}</span>
          <span>{ed.attendees}</span>
        </div>
      </div>
    </div>
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
        Na zeventien jaar stilte bliezen we in 2024 de Openluchtfuif weer
        leven in — dezelfde wei, dezelfde buitenlucht, een nieuwe ploeg.
        Hieronder een doorsnee van de verhalen.
      </p>

      {/* Hero row: 2025 wide landscape + 2024 portrait */}
      <div className="edities-hero-row">
        <EditionCard ed={EDITIONS[0]} size="hero" />
        <EditionCard ed={EDITIONS[1]} size="side" />
      </div>

      {/* Second row: three equal cards */}
      <div className="edities-row2">
        <EditionCard ed={EDITIONS[2]} size="third" />
        <EditionCard ed={EDITIONS[3]} size="third" />
        <div className="edition-card third edition-cta-card">
          <div className="edition-cover" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 3vw, 48px)", lineHeight: 1.1, marginBottom: 20 }}>
              Jij erbij<br />in 2026?
            </div>
            <a href="#tickets" className="btn btn-primary">Tickets kopen →</a>
          </div>
        </div>
      </div>

      <div className="photo-strip">
        {["photo-1", "photo-3", "photo-4", "photo-5", "photo-6", "photo-2"].map((p, i) => (
          <div key={i} className="ph" style={{ backgroundImage: `url(/assets/${p}.jpg)` }} />
        ))}
      </div>

      <div className="marquee-mega" style={{ marginTop: 80 }}>
        <div className="marquee-track">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i}>
              29 AUGUSTUS 2026 <Star />
              MUZIEK ONDER DE OPEN HEMEL <Star />
              17:00 TOT 03:00 <Star />
              EDITIE XIV <Star />
              KLEINE GANZENDRIES, PELLENBERG <Star />
              CASHLESS · DUURZAAM · AMBIANCE <Star />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
