export default function WavyText({ text, className = "" }) {
  return (
    <span className={`wavy ${className}`}>
      {[...text].map((ch, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.08}s` }}>
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}
