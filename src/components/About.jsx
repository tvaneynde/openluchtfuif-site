export default function About() {
  return (
    <section id="about">
      <div className="section-head">
        <span className="section-num">08 / Wie zijn wij</span>
        <h2 className="section-title">Over ons</h2>
      </div>
      <div className="about-wrap">
        <div className="about-text">
          <p className="scroll-reveal" style={{ "--delay": "0s" }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vehicula
            nulla vel tortor tincidunt, at fringilla nisi sodales. Sed ut perspiciatis
            unde omnis iste natus error sit voluptatem accusantium doloremque laudantium
            totam rem aperiam eaque ipsa quae ab illo inventore veritatis.
          </p>
          <p className="scroll-reveal" style={{ "--delay": "0.1s" }}>
            At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
            praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias
            excepturi sint occaecati cupiditate non provident similique sunt in culpa.
          </p>
          <p className="scroll-reveal" style={{ "--delay": "0.2s" }}>
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit,
            sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt
            neque porro quisquam est qui dolorem ipsum quia dolor sit.
          </p>

          <div className="about-stats">
            {[
              { n: "19??", l: "Eerste editie" },
              { n: "17",   l: "Jaar pauze" },
              { n: "40+",  l: "Vrijwilligers" },
              { n: "8",    l: "Kernleden" },
            ].map((s, i) => (
              <div key={i} className="stat scroll-reveal" style={{ "--delay": `${0.1 + i * 0.1}s` }}>
                <div className="n">{s.n}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="scroll-reveal" style={{ "--delay": "0.15s", position: "relative", aspectRatio: "4/5", borderRadius: 24, overflow: "hidden", backgroundImage: "url(/assets/photo-5.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,.8))" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 24px 32px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 3.5vw, 40px)", color: "var(--cream)", lineHeight: 1.0, textShadow: "0 2px 12px rgba(0,0,0,.8)" }}>
              Wij zijn<br />
              <span style={{ color: "var(--orange-bright)" }}>Chiro Crescendo</span><br />
              <span style={{ color: "var(--orange-bright)" }}>× De Kluster.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
