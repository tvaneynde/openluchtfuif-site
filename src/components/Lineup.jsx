const LINEUP = [
  { name: "Thurbo",               slot: "20:00 – 21:00", genre: "DJ Set", photo: "" },
  { name: "P-Mountain Collective",slot: "21:00 – 22:00", genre: "DJ Set", photo: "" },
  { name: "Karakals",             slot: "22:00 – 23:00", genre: "DJ Set", photo: "" },
  { name: "Partyshakerz",         slot: "23:00 – 00:00", genre: "DJ Set", photo: "" },
  { name: "Pitte & Runkel",       slot: "00:00 – 01:00", genre: "DJ Set", photo: "" },
  { name: "Kleinefrigo",          slot: "01:00 – 02:00", genre: "DJ Set", photo: "" },
  { name: "D-Nill",               slot: "02:00 – 03:00", genre: "DJ Set", photo: "" },
];

export default function Lineup() {
  return (
    <section id="lineup" style={{ background: "var(--purple-deep)" }}>
      <div className="section-head">
        <span className="section-num">03 / Line-Up</span>
        <h2 className="section-title">Line-up</h2>
      </div>

      <div className="lineup-meta-row">
        <div className="mono" style={{ opacity: 0.6 }}>Zaterdag 29 Augustus 2026 · Eén podium · 16:00 → 03:00</div>
      </div>

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
    </section>
  );
}
