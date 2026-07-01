function smoothScrollTo(id, e, onNavigate) {
  e.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  // Set the active indicator immediately — before the scroll animation begins.
  onNavigate?.(id);
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

// Page order matches document flow
const ALL_ITEMS = [
  { id: 'home',     label: 'Home',    always: true },
  { id: 'lineup',   label: 'Line-Up', always: false },
  { id: 'tickets',  label: 'Tickets', always: false },
  { id: 'partners', label: 'Partners',always: false },
  { id: 'info',     label: 'Info',    always: false },
  { id: 'faq',      label: 'FAQ',     always: false },
  { id: 'edities',  label: 'Edities', always: false },
  { id: 'about',    label: 'Over ons',always: false },
];

function MobileNav({ active, sections, onNavigate }) {
  const mobileItems = [
    { id: 'home',    label: 'Home',     icon: '◉', always: true },
    { id: 'lineup',  label: 'Line-up',  icon: '♫', always: false },
    { id: 'tickets', label: 'Tickets',  icon: '⬡', always: false },
    { id: 'info',    label: 'Info',     icon: 'ℹ', always: false },
    { id: 'about',   label: 'Over ons', icon: '●', always: false },
  ];

  const visible = mobileItems.filter(item =>
    item.always || sections[item.id]?.visible !== false
  );

  return (
    <nav className="mobile-nav">
      {visible.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={active === item.id ? 'active' : ''}
          onClick={e => smoothScrollTo(item.id, e, onNavigate)}
        >
          <span className="mobile-nav-icon">{item.icon}</span>
          <span className="mobile-nav-label">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function Nav({ active, sections = {}, onNavigate }) {
  const visible = ALL_ITEMS.filter(item =>
    item.always || sections[item.id]?.visible !== false
  );

  return (
    <>
      <nav className="nav">
        {visible.map(({ id, label }) => (
          <a key={id} href={`#${id}`} className={active === id ? "active" : ""}
            onClick={e => smoothScrollTo(id, e, onNavigate)}>{label}</a>
        ))}
      </nav>
      <MobileNav active={active} sections={sections} onNavigate={onNavigate} />
    </>
  );
}
