import { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";

export default function Faq({ mode = 'coming_soon' }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (mode !== 'live') return;
    supabase
      .from('faq_items')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setItems(data); });
  }, [mode]);

  return (
    <section id="faq">
      <div className="section-head">
        <span className="section-num">07 / Vragen</span>
        <h2 className="section-title">FAQ</h2>
      </div>
      {mode === 'coming_soon' ? (
        <div style={{ paddingBottom: 40 }}>
          <div className="mono" style={{ color: "var(--orange-bright)", marginBottom: 16 }}>◉ Binnenkort</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 5vw, 64px)", lineHeight: 0.95, marginBottom: 20 }}>
            Vragen &amp; antwoorden<br />volgen snel
          </div>
          <p style={{ fontSize: 15, opacity: 0.6, maxWidth: 400 }}>
            Heb je een vraag? Stuur ons een berichtje via{" "}
            <a href="mailto:openluchtfuif3212@gmail.com" style={{ color: "var(--orange-bright)" }}>
              openluchtfuif3212@gmail.com
            </a>
          </p>
        </div>
      ) : (
        <div style={{ maxWidth: 860 }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`faq-item ${open === item.id ? "open" : ""}`}
              onClick={() => setOpen(open === item.id ? null : item.id)}
            >
              <div className="faq-q">
                <span>{item.question}</span>
                <span className="plus">+</span>
              </div>
              <div className="faq-a">{item.answer}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
