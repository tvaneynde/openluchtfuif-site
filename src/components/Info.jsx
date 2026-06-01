const COMING_SOON = true;

const cards = [
  {
    label: "◉ Locatie",
    title: "Kleine Ganzendries",
    body: "Het veld achter de kerk, midden in het dorp van Pellenberg. Makkelijk te vinden, ideaal gelegen — en met de mooiste openluchtsfeer van de regio.",
  },
  {
    label: "◉ Vervoer",
    title: "Kom veilig thuis",
    body: "Bewaakte fietsstalling aanwezig op het terrein. Parkeren kan op aangeduide plaatsen in de buurt. Je kan ook met De Lijn — check de De Lijn-app voor de beste route vanuit jouw gemeente.",
  },
  {
    label: "◉ Betaalsysteem",
    title: "Cashless muntjes",
    body: "Betalen gaat via een cashless muntjessysteem. Koop je munten aan de ingang of op voorhand online. Heb je aan het einde nog over? Die krijg je gewoon terug.",
  },
  {
    label: "◉ Duurzaamheid",
    title: "Geen afval, geen gezever",
    body: "Geen glas, geen wegwerpplastic. Alles is herbruikbaar. We doen ons best om de voetafdruk zo klein mogelijk te houden — help je mee?",
  },
  {
    label: "◉ Veiligheid",
    title: "Veilige sfeer",
    body: "Er is een veiligheidsteam aanwezig de hele avond. Voel je je niet goed of zie je iets verdachts? Spreek gerust een medewerker aan — we zijn er voor iedereen.",
  },
  {
    label: "◉ EHBO",
    title: "Rode Kruis aanwezig",
    body: "Het Rode Kruis staat de hele avond paraat op het terrein. De EHBO-post vind je rechts van het podium. Bij medische nood: ga er direct naartoe of spreek een medewerker aan.",
  },
];

export default function Info() {
  return (
    <section id="info" style={{ background: "var(--purple-deep)" }}>
      <div className="section-head">
        <span className="section-num">06 / Praktisch</span>
        <h2 className="section-title">Info</h2>
      </div>
      {COMING_SOON ? (
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
            <div key={i} className="info-card scroll-reveal" style={{ "--delay": `${i * 0.1}s` }}>
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
