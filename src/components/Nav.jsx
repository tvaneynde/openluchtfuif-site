function smoothScrollTo(id, e) {
  e.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  const target = el.getBoundingClientRect().top + window.scrollY - 72;
  const start = window.scrollY;
  const distance = target - start;
  const duration = Math.min(900 + Math.abs(distance) * 0.12, 1400);
  const startTime = performance.now();
  const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  const step = now => {
    const p = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, start + distance * ease(p));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function MobileNav({ active }) {
  const items = [
    { id: 'home',    label: 'Home',     icon: '◉' },
    { id: 'lineup',  label: 'Line-up',  icon: '♫' },
    { id: 'tickets', label: 'Tickets',  icon: '⬡' },
    { id: 'info',    label: 'Info',     icon: 'ℹ' },
    { id: 'about',   label: 'Over ons', icon: '●' },
  ];
  return (
    <nav className="mobile-nav">
      {items.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={active === item.id ? 'active' : ''}
          onClick={e => smoothScrollTo(item.id, e)}
        >
          <span className="mobile-nav-icon">{item.icon}</span>
          <span className="mobile-nav-label">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function Nav({ active }) {
  const items = [
    ["home",     "Home"],
    ["edities",  "Edities"],
    ["lineup",   "Line-Up"],
    ["tickets",  "Tickets"],
    ["partners", "Partners"],
    ["info",     "Info"],
    ["faq",      "FAQ"],
    ["about",    "Over ons"],
  ];
  return (
    <>
      <nav className="nav">
        {items.map(([id, label]) => (
          <a key={id} href={`#${id}`} className={active === id ? "active" : ""}
            onClick={e => smoothScrollTo(id, e)}>{label}</a>
        ))}
      </nav>
      <MobileNav active={active} />
    </>
  );
}
