import { useState } from "react";

export default function Footer() {
  const [email, setEmail] = useState("");
  return (
    <footer>
      <svg className="mega-wordmark" viewBox="0 0 1000 130" preserveAspectRatio="xMidYMid meet">
        <text x="0" y="112" fontSize="112" textLength="1000" lengthAdjust="spacingAndGlyphs"
          style={{ fontFamily: "var(--display)", fill: "var(--purple-soft)", opacity: 0.45, userSelect: "none" }}
        >OPENLUCHTFUIF</text>
      </svg>
      <div className="footer-grid">
        <div className="footer-col">
          <h4>◉ Nieuwsbrief</h4>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 12 }}>Geen spam. Alleen wanneer de line-up of tickets droppen.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              placeholder="mail@jou.be"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 999,
                background: "transparent", border: "1px solid rgba(244,231,208,.3)",
                color: "var(--cream)", fontFamily: "var(--body)"
              }}
            />
            <button className="btn btn-primary">OK</button>
          </div>
        </div>
        <div className="footer-col">
          <h4>◉ Navigatie</h4>
          <a href="#home">Home</a>
          <a href="#edities">Edities</a>
          <a href="#lineup">Line-Up</a>
          <a href="#tickets">Tickets</a>
          <a href="#about">Over ons</a>
        </div>
        <div className="footer-col">
          <h4>◉ Contact</h4>
          <a href="mailto:info@openluchtfuif.be">info@openluchtfuif.be</a>
          <a href="mailto:partners@openluchtfuif.be">partners@openluchtfuif.be</a>
          <a href="mailto:vrijwilligers@openluchtfuif.be">Vrijwilliger worden</a>
        </div>
        <div className="footer-col">
          <h4>◉ Sociaal</h4>
          <a href="#">Instagram</a>
          <a href="#">Facebook</a>
          <a href="#">Spotify playlist</a>
        </div>
      </div>
      <div className="footer-bottom">
        <div>© 2026 — Openluchtfuif Pellenberg VZW</div>
      </div>
    </footer>
  );
}
