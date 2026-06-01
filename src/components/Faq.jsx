import { useState } from "react";

const COMING_SOON = true;

const items = [
  [
    "Moet ik mijn ticket afprinten?",
    "Nee, een digitaal ticket op je smartphone volstaat. Zorg dat je scherm voldoende oplicht zodat de scanner hem kan lezen.",
  ],
  [
    "Is er eten en drinken?",
    "Ja! Er zijn verschillende foodstands aanwezig met warme en koude hapjes. Drinken werkt cashless via muntjes die je aan de ingang of op voorhand koopt. Ongebruikte muntjes zijn terugbetaalbaar.",
  ],
  [
    "Wat als het regent?",
    "De Openluchtfuif gaat door, regen of niet. Neem een regenjas mee voor de zekerheid — het podium en de bars staan paraat, wat het weer ook doet.",
  ],
  [
    "Hoe geraak ik er?",
    "Je kan er per fiets (bewaakte fietsstalling aanwezig), met de auto (parkeren op aangeduide plaatsen in de buurt) of met De Lijn. Check de De Lijn-app voor de juiste lijn en halte in de buurt van Pellenberg.",
  ],
  [
    "Is er een minimumleeftijd?",
    "De Openluchtfuif is toegankelijk voor iedereen. -16 jarigen mogen geen alcohol kopen of consumeren. Neem zeker je ID mee — onze medewerkers kunnen ernaar vragen.",
  ],
  [
    "Ik wil helpen. Kan dat?",
    "Zeker! We zijn altijd op zoek naar enthousiaste vrijwilligers. Stuur een mailtje naar openluchtfuif3212@gmail.com en we nemen zo snel mogelijk contact met je op.",
  ],
];

export default function Faq() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq">
      <div className="section-head">
        <span className="section-num">07 / Vragen</span>
        <h2 className="section-title">FAQ</h2>
      </div>
      {COMING_SOON ? (
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
          {items.map(([q, a], i) => (
            <div
              key={i}
              className={`faq-item ${open === i ? "open" : ""}`}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <div className="faq-q">
                <span>{q}</span>
                <span className="plus">+</span>
              </div>
              <div className="faq-a">{a}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
