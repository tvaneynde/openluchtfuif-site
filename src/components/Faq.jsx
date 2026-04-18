import { useState } from "react";

const items = [
  ["Moet ik mijn ticket afprinten?", "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque vehicula nulla vel tortor tincidunt, at fringilla nisi sodales pellentesque."],
  ["Mag mijn huisdier mee?", "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae."],
  ["Is er eten?", "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores."],
  ["Wat als het regent?", "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur magni dolores eos qui ratione."],
  ["Hoe geraak ik thuis?", "Ut enim ad minima veniam quis nostrum exercitationem ullam corporis suscipit laboriosam nisi ut aliquid ex ea commodi consequatur."],
  ["Ik wil helpen. Kan dat?", "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur vel illum qui dolorem eum."],
];

export default function Faq() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq">
      <div className="section-head">
        <span className="section-num">07 / Vragen</span>
        <h2 className="section-title">FAQ</h2>
      </div>
      <div style={{ maxWidth: 860 }}>
        {items.map(([q, a], i) => (
          <div key={i} className={`faq-item scroll-reveal ${open === i ? "open" : ""}`}
            style={{ "--delay": `${i * 0.08}s` }}
            onClick={() => setOpen(open === i ? null : i)}>
            <div className="faq-q">
              <span>{q}</span>
              <span className="plus">+</span>
            </div>
            <div className="faq-a">{a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
