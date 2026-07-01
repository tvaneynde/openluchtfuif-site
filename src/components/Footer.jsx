export default function Footer() {
  return (
    <footer>
      <svg className="mega-wordmark" viewBox="0 0 1000 130" preserveAspectRatio="xMidYMid meet">
        <text x="0" y="112" fontSize="112" textLength="1000" lengthAdjust="spacingAndGlyphs"
          style={{ fontFamily: "var(--display)", fill: "var(--purple-soft)", opacity: 0.45, userSelect: "none" }}
        >OPENLUCHTFUIF</text>
      </svg>
      <div className="footer-grid">
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
          <a href="mailto:openluchtfuif3212@gmail.com">openluchtfuif3212@gmail.com</a>
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
        <a href="#/dashboard" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.15em", color: "rgba(244,231,208,.3)", textDecoration: "none", transition: "color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(244,231,208,.7)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(244,231,208,.3)"}
        >DASHBOARD →</a>
      </div>
    </footer>
  );
}
