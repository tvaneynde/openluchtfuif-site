import { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";

export default function Info({ mode = 'coming_soon' }) {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    if (mode !== 'live' || !supabase) return;
    supabase
      .from('info_cards')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setCards(data); });
  }, [mode]);

  return (
    <section id="info" style={{ background: "var(--purple-deep)" }}>
      <div className="section-head">
        <span className="section-num">06 / Praktisch</span>
        <h2 className="section-title">Info</h2>
      </div>
      {mode === 'coming_soon' ? (
        <div style={{ paddingBottom: 40 }}>
          <div className="mono" style={{ color: "var(--orange-bright)", marginBottom: 16 }}>◉ Binnenkort</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 5vw, 64px)", lineHeight: 0.95, marginBottom: 20 }}>
            Praktische info<br />volgt snel
          </div>
          <p style={{ fontSize: 15, opacity: 0.6, maxWidth: 400 }}>
            Locatie, vervoer, betaling en meer — we vullen dit zo snel mogelijk aan.
          </p>
        </div>
      ) : (
        <div className="info-grid">
          {cards.map((c, i) => (
            <div key={c.id} className="info-card">
              <div className="label">{c.label}</div>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
