export default function Ticker() {
  const items = [
    "◉ 29 Augustus 2026",
    "◉ Pellenberg — Jeugdhuis De Kluster",
    "◉ 17:00 → 03:00",
    "◉ Vroegvogels nu te koop",
    "◉ Editie 14",
    "◉ Geen glas · Geen plastic · Alles herbruikbaar",
  ];
  const doubled = [...items, ...items, ...items];
  return (
    <div className="ticker">
      <div className="ticker-track">
        {doubled.map((it, i) => (
          <span key={i}>{it}</span>
        ))}
      </div>
    </div>
  );
}
