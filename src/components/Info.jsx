const cards = [
  { label: "◉ Locatie", title: "Veld achter de kerk", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vehicula nulla vel tortor tincidunt, at fringilla nisi sodales." },
  { label: "◉ Shuttle", title: "Bus Leuven ↔ Fuif", body: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam." },
  { label: "◉ Betaalsysteem", title: "Cashless muntjes", body: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti." },
  { label: "◉ Planet", title: "Geen afval, geen gezever", body: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos." },
  { label: "◉ Veiligheid", title: "Safe space", body: "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam nisi ut aliquid ex ea commodi." },
  { label: "◉ EHBO", title: "Rode Kruis aanwezig", body: "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur vel illum qui." },
];

export default function Info() {
  return (
    <section id="info" style={{ background: "var(--purple-deep)" }}>
      <div className="section-head">
        <span className="section-num">06 / Praktisch</span>
        <h2 className="section-title">Info</h2>
      </div>
      <div className="info-grid">
        {cards.map((c, i) => (
          <div key={i} className="info-card scroll-reveal" style={{ "--delay": `${i * 0.1}s` }}>
            <div className="label">{c.label}</div>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
