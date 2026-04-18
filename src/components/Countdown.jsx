import { useState, useEffect } from "react";

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s };
}

export default function Countdown() {
  const target = new Date("2026-08-29T17:00:00+02:00").getTime();
  const { d, h, m, s } = useCountdown(target);
  const cells = [[d, "Dagen"], [h, "Uren"], [m, "Minuten"], [s, "Seconden"]];
  return (
    <div className="countdown">
      {cells.map(([n, l], i) => (
        <div className="countdown-cell" key={i}>
          <div className="countdown-num">{String(n).padStart(2, "0")}</div>
          <div className="countdown-label">{l}</div>
        </div>
      ))}
    </div>
  );
}
