import { useState, useEffect, useRef } from "react";
import WavyText from "./WavyText";
import Countdown from "./Countdown";

export default function Hero() {
  const heroRef = useRef(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="hero" id="home" ref={heroRef}>
      <div className="hero-bg">
        <img
          src="/assets/hero-dancers.png"
          className="hero-fullbleed"
          style={{
            transform: `translateY(${offset * 0.25}px) scale(${1 + offset * 0.0002})`,
          }}
        />
        <div className="hero-vignette" />
      </div>

      <div className="hero-inner">
        <h1 className="hero-title">
          <WavyText text="Openluchtfuif" />
        </h1>
        <div className="hero-sub" style={{ fontStyle: "italic" }}>Pellenberg</div>

        <div className="hero-meta">
          <div className="meta-item">◉ Zaterdag 29 Augustus 2026</div>
          <div className="meta-item">◉ Vanaf 17:00</div>
        </div>

        <Countdown />

        <div className="hero-cta">
          <a href="#tickets" className="btn btn-primary">Tickets kopen →</a>
          <a href="#lineup" className="btn btn-ghost">Bekijk line-up</a>
        </div>
      </div>

      <div className="hero-footer">
        <div>
          <div className="mono" style={{ opacity: 0.7, fontSize: 10 }}>Locatie</div>
          <div style={{ fontFamily: "var(--display)", fontSize: 22, marginTop: 2 }}>Kleine Ganzendries, Pellenberg</div>
        </div>
        <div className="right" style={{ textAlign: "right" }}>
          <div className="mono" style={{ opacity: 0.7, fontSize: 10 }}>Organisatie</div>
          <div style={{ fontFamily: "var(--display)", fontSize: 20, marginTop: 2, lineHeight: 1.2 }}>Chiro Crescendo × De Kluster</div>
        </div>
      </div>
    </section>
  );
}
