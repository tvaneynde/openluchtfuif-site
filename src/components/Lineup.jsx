import { useState } from "react";

const LINEUP = [
  { name: "Thurbo",               slot: "20:00 – 21:00", genre: "DJ Set" },
  { name: "P-Mountain Collective",slot: "21:00 – 22:00", genre: "DJ Set" },
  { name: "Karakals",             slot: "22:00 – 23:00", genre: "DJ Set" },
  { name: "Partyshakerz",         slot: "23:00 – 00:00", genre: "DJ Set" },
  { name: "Pitte & Runkel",       slot: "00:00 – 01:00", genre: "DJ Set" },
  { name: "Kleinefrigo",          slot: "01:00 – 02:00", genre: "DJ Set" },
  { name: "D-Nill",               slot: "02:00 – 03:00", genre: "DJ Set" },
];

function ComingSoon() {
  return (
    <div className="lineup-coming-soon">
      <div className="lineup-cs-inner">
        <div className="mono" style={{ color: "var(--orange-bright)", marginBottom: 16 }}>◉ Binnenkort</div>
        <div style={{ fontFamily: "var(--display)", fontSize: "clamp(36px, 6vw, 80px)", lineHeight: 0.9, marginBottom: 24 }}>
          Line-up volgt<br />snel
        </div>
        <p style={{ fontSize: 15, opacity: 0.7, maxWidth: 400 }}>
          Volg ons op Instagram of schrijf je in op de nieuwsbrief — je bent de eerste die het weet.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
          <a href="#" className="btn btn-primary">Volg ons →</a>
          <a href="#" className="btn btn-ghost">Nieuwsbrief</a>
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

export default function Lineup() {
  const [revealed, setRevealed] = useState(false);

  return (
    <section id="lineup" style={{ background: "var(--purple-deep)" }}>
      <div className="section-head">
        <span className="section-num">03 / Line-Up</span>
        <h2 className="section-title">Wie speelt er?</h2>
      </div>

      <div className="lineup-meta-row">
        <div className="mono" style={{ opacity: 0.6 }}>Zaterdag 29 Augustus 2026 · Eén podium · 17:00 → 03:00</div>
        <button
          className={`lineup-reveal-btn ${revealed ? "active" : ""}`}
          onClick={() => setRevealed(r => !r)}
        >
          {revealed ? "← Verberg line-up" : "Toon line-up →"}
        </button>
      </div>

      {!revealed ? (
        <ComingSoon />
      ) : (
        <>
          <div className="lineup-list">
            {LINEUP.map((a, i) => (
              <div key={a.name} className="lineup-row" style={{ "--i": i }}>
                <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="artist">{a.name}</span>
                <span className="genre">{a.genre}</span>
                <span className="time">{a.slot}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 32, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.2em", opacity: 0.5 }}>
            * LINE-UP ONDER VOORBEHOUD · VOLG ONS VOOR UPDATES
          </p>
        </>
      )}
    </section>
  );
}
