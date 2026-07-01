function TicketEarlyBird() {
  return (
    <div className="tkt tkt-early">
      <div className="tkt-top">
        <div className="tkt-badge">Vroegvogel</div>
        <div className="tkt-label mono">Beperkt aantal</div>
      </div>
      <div className="tkt-price-block">
        <span className="tkt-currency">€</span>
        <span className="tkt-price">12</span>
      </div>
      <div className="tkt-divider" />
      <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.7, margin: "4px 0 0", flex: 1 }}>
        De goedkoopste manier om erbij te zijn. Wie vroeg boekt, betaalt minder — zo simpel is het.
      </p>
      <a href="#/checkout" className="tkt-btn tkt-btn-cream">Bestel nu →</a>
    </div>
  );
}

function TicketWaves() {
  const waves = [
    { label: "Golf 1", price: "€12", status: "vol" },
    { label: "Golf 2", price: "€14", status: "vol" },
    { label: "Golf 3", price: "€16", status: "actief" },
    { label: "Golf 4", price: "€18", status: "binnenkort" },
  ];
  return (
    <div className="tkt tkt-waves">
      <div className="tkt-top">
        <div className="tkt-badge">Voorverkoop</div>
        <div className="tkt-label mono">Prijs stijgt per golf</div>
      </div>
      <div className="tkt-wave-list">
        {waves.map(w => (
          <div key={w.label} className={`tkt-wave-row ${w.status}`}>
            <span className="tkt-wave-label">{w.label}</span>
            <span className="tkt-wave-price">{w.price}</span>
            <span className={`tkt-wave-status mono ${w.status}`}>
              {w.status === "vol" ? "Vol" : w.status === "actief" ? "● Nu" : "Binnenkort"}
            </span>
          </div>
        ))}
      </div>
      <div className="tkt-divider" />
      <a href="#/checkout" className="tkt-btn tkt-btn-cream">Golf 3 kopen →</a>
    </div>
  );
}

function TicketDoor() {
  return (
    <div className="tkt tkt-door">
      <div className="tkt-top">
        <div className="tkt-badge" style={{ background: "rgba(244,231,208,.12)", color: "rgba(244,231,208,.5)", border: "1px solid rgba(244,231,208,.15)" }}>Aan de kassa</div>
        <div className="tkt-label mono">Als er nog plek is</div>
      </div>
      <div className="tkt-price-block" style={{ opacity: 0.45 }}>
        <span className="tkt-currency">€</span>
        <span className="tkt-price">20</span>
      </div>
      <div className="tkt-divider" />
      <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.5, marginBottom: 24, flex: 1 }}>
        Contant betalen aan de ingang. Geen garantie op toegang — koop op voorhand om zeker te zijn van je plek.
      </p>
      <a href="#tickets" className="tkt-btn" style={{ background: "transparent", border: "1px solid rgba(244,231,208,.2)", color: "rgba(244,231,208,.4)" }}>
        Meer info
      </a>
    </div>
  );
}

export default function Tickets({ mode = 'live' }) {
  return (
    <section id="tickets">
      <div className="section-head">
        <span className="section-num">04 / Toegang</span>
        <h2 className="section-title">Tickets</h2>
      </div>

      {mode === 'coming_soon' ? (
        <div style={{ paddingBottom: 40 }}>
          <div className="mono" style={{ color: "var(--orange-bright)", marginBottom: 16 }}>◉ Binnenkort</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 5vw, 64px)", lineHeight: 0.95, marginBottom: 20 }}>
            Tickets komen<br />snel online
          </div>
          <p style={{ fontSize: 15, opacity: 0.6, maxWidth: 440, marginBottom: 28 }}>
            Schrijf je in op onze mailinglijst en wees de eerste die weet wanneer de tickets in de verkoop gaan.
          </p>
          <a className="btn btn-primary" href="https://www.instagram.com/openluchtfuif3212" target="_blank" rel="noreferrer">Volg ons →</a>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 18, maxWidth: 640, marginBottom: 56, opacity: 0.85 }}>
            Hoe vroeger, hoe goedkoper.
          </p>
          <div className="tickets-grid">
            <TicketEarlyBird />
            <TicketWaves />
            <TicketDoor />
          </div>
          <div className="tkt-notice">
            <span>-18? Kom met ID.</span>
            <span>Alcohol &lt;16 = nee</span>
          </div>
        </>
      )}
    </section>
  );
}
