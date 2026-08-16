import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

function formatCents(cents) {
  return '€' + (cents / 100).toFixed(2).replace('.', ',');
}

// Mirrors MAX_BUNDLES in create-payment. Going past it only earns a rejected
// checkout, so the stepper stops here.
const MAX_BUNDLES = 5;
const MAX_SINGLES = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Checkout() {
  const [tiers, setTiers] = useState([]);
  const [selectedTier, setSelectedTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailRepeat, setEmailRepeat] = useState('');
  // `units` is what the buyer is charged for: bundles on a group tier, single
  // tickets otherwise. The ticket count sent to the server is always
  // units × groupSize, because orders.quantity counts tickets on every tier.
  const [units, setUnits] = useState(1);
  const [splitTickets, setSplitTickets] = useState(false);
  const [attendees, setAttendees] = useState([]); // [{ name, email }] by seat
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null); // null | { discount_cents, description, code } | { error: string }
  const [promoValidating, setPromoValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const preselectedId = params.get('tier_id');

    if (!supabase) { setLoading(false); return; }
    supabase
      // public_ticket_tiers deliberately omits sold_count/total_capacity —
      // scarcity arrives as booleans so the remaining count is never disclosed.
      .from('public_ticket_tiers')
      .select('*')
      .eq('is_door_sale', false)
      .order('sort_order')
      .then(({ data }) => {
        if (data) {
          setTiers(data);
          // Preselect the first tier that can actually be bought, not simply
          // data[0]. Tiers are ordered by sort_order, so once Early Bird sold
          // out every buyer landed on checkout with a sold-out tier selected;
          // filling in the form and pressing Betalen then failed with
          // "Uitverkocht" from create-payment, and only someone who noticed the
          // badge would think to click the other tier. A preselected link
          // (?tier_id=) still wins, even if that tier is sold out — the buyer
          // asked for it by name and should see why it can't be bought.
          const firstAvailable = data.find((t) => !t.is_sold_out) ?? data[0];
          if (preselectedId) {
            const found = data.find((t) => String(t.id) === preselectedId);
            setSelectedTier(found ?? firstAvailable);
          } else if (data.length > 0) {
            setSelectedTier(firstAvailable);
          }
        }
        setLoading(false);
      });
  }, []);

  // ── Bundle maths ───────────────────────────────────────────────────────────
  // Kept identical to create-payment: price and discount are per UNIT, capacity
  // and the guest list are per TICKET.
  const groupSize  = selectedTier?.group_size ?? null;
  const maxUnits   = groupSize ? MAX_BUNDLES : MAX_SINGLES;
  const quantity   = units * (groupSize ?? 1);

  const discountCents = promoResult && !promoResult.error ? promoResult.discount_cents : 0;
  const totalCents = selectedTier
    ? Math.max(0, (selectedTier.price_cents + selectedTier.fee_cents) * units - discountCents)
    : 0;

  // Switching between a bundle tier and a single tier changes what the stepper
  // counts, so a leftover "3" would silently mean 3 bundles instead of 3
  // tickets. Reset it here rather than in an effect, and drop the promo: a
  // tier-scoped code for the old tier would show a discount in the total that
  // create-payment then refuses.
  function selectTier(tier) {
    if (tier.id === selectedTier?.id) return;
    setSelectedTier(tier);
    setUnits(1);
    setPromoResult(null);
  }

  // `attendees` is addressed by seat index and is deliberately allowed to be
  // shorter than the order — a buyer who names three of ten guests sends three
  // rows. Only the first `quantity` entries are ever read, so shrinking the
  // order drops the extra seats without any bookkeeping.
  const seats = Array.from({ length: quantity }, (_, i) => attendees[i] ?? { name: '', email: '' });
  const badSeat = seats.findIndex((a) => a.email.trim() && !EMAIL_RE.test(a.email.trim()));
  const namedSeats = seats.filter((a) => a.email.trim()).length;

  function setSeat(i, field, value) {
    setAttendees((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push({ name: '', email: '' });
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  async function validatePromo() {
    if (!promoCode || !selectedTier || !supabase) return;
    setPromoValidating(true);
    setPromoResult(null);
    const code = promoCode.trim().toUpperCase();
    try {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (!promo) {
        setPromoResult({ error: 'Ongeldige promotiecode' });
        return;
      }
      if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
        setPromoResult({ error: 'Promotiecode is verlopen' });
        return;
      }
      if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
        setPromoResult({ error: 'Promotiecode is niet meer geldig' });
        return;
      }
      // Same rule create-payment applies. Checking it here means the buyer is
      // told before they pay, instead of at the very last click.
      if (promo.tier_id && promo.tier_id !== selectedTier.id) {
        setPromoResult({ error: 'Deze code geldt niet voor dit ticket' });
        return;
      }

      // Per unit, not per ticket: on a group tier price_cents is the price of
      // the whole bundle, so multiplying by the ticket count would promise a
      // discount ten times bigger than the server will give.
      let discount = 0;
      if (promo.discount_type === 'percent') {
        discount = Math.round((selectedTier.price_cents * promo.discount_value / 100) * units);
      } else {
        discount = Math.min(promo.discount_value * units, selectedTier.price_cents * units);
      }

      const discountLabel = promo.discount_type === 'percent'
        ? `${promo.discount_value}% korting`
        : `${formatCents(promo.discount_value)} korting`;

      setPromoResult({
        code,
        discount_cents: discount,
        description: promo.description || discountLabel,
        discount_label: discountLabel,
      });
    } catch {
      setPromoResult({ error: 'Kon promotiecode niet valideren. Probeer opnieuw.' });
    } finally {
      setPromoValidating(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!selectedTier) return setError('Selecteer een ticket type.');
    if (!name.trim()) return setError('Vul je naam in.');
    if (!email.trim()) return setError('Vul je e-mailadres in.');
    if (email !== emailRepeat) return setError('E-mailadressen komen niet overeen.');
    if (splitTickets && badSeat !== -1) {
      return setError(`Het e-mailadres voor ticket ${badSeat + 1} klopt niet.`);
    }

    setSubmitting(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          // No Authorization header — function uses verify_jwt=false
        },
        body: JSON.stringify({
          tier_id: selectedTier.id,
          quantity,
          buyer_name: name,
          buyer_email: email,
          // Omitted entirely when the buyer keeps all tickets — an empty array
          // is still a valid instruction to clear the list, and sending it on
          // every order would be noise.
          ...(splitTickets && namedSeats > 0
            ? {
                attendees: seats.map((a) => ({
                  name: a.name.trim(),
                  email: a.email.trim(),
                })),
              }
            : {}),
          ...(promoResult && !promoResult.error ? { promo_code: promoResult.code } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || `Fout ${res.status}. Probeer opnieuw.`);
        return;
      }
      // location.assign() rather than assigning to location.href: identical
      // behaviour, but the React compiler's immutability rule reads the property
      // assignment as mutating a value it tracks and errors on it.
      if (data.alreadyPaid || data.free) {
        window.location.assign(`/#/bedankt?order_id=${data.orderId}`);
        return;
      }
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setError(data.error || 'Er ging iets mis. Probeer opnieuw.');
    } catch (err) {
      setError('Verbindingsfout. Controleer je internetverbinding en probeer opnieuw.');
      console.error('Checkout error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const s = {
    page: {
      minHeight: '100vh',
      background: 'var(--purple-deep)',
      color: 'var(--cream)',
      fontFamily: 'var(--body)',
      position: 'relative',
    },
    grain: {
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 1,
      opacity: 0.35,
      backgroundImage:
        'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")',
      backgroundSize: '180px',
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--purple-deep)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      height: '3.5rem',
    },
    backLink: {
      color: 'var(--cream-dim)',
      textDecoration: 'none',
      fontFamily: 'var(--mono)',
      fontSize: '0.85rem',
      letterSpacing: '0.04em',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    wordmark: {
      fontFamily: 'var(--display)',
      fontSize: '1.1rem',
      color: 'var(--orange)',
      letterSpacing: '0.06em',
    },
    main: {
      maxWidth: '600px',
      margin: '0 auto',
      padding: '2rem 1.5rem 4rem',
      position: 'relative',
      zIndex: 2,
    },
    sectionLabel: {
      fontFamily: 'var(--mono)',
      fontSize: '0.7rem',
      letterSpacing: '0.12em',
      color: 'var(--orange)',
      textTransform: 'uppercase',
      marginBottom: '0.75rem',
      marginTop: '2.5rem',
    },
    tierCard: (active) => ({
      border: active ? '2px solid var(--orange)' : '1px solid rgba(255,255,255,0.15)',
      borderRadius: '12px',
      padding: '1.1rem 1.25rem',
      marginBottom: '0.75rem',
      cursor: 'pointer',
      background: active ? 'rgba(255,120,0,0.08)' : 'rgba(255,255,255,0.03)',
      transition: 'border-color 0.15s, background 0.15s',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '1rem',
    }),
    tierName: {
      fontFamily: 'var(--display)',
      fontSize: '1.1rem',
      color: 'var(--cream)',
      marginBottom: '0.2rem',
    },
    tierFee: {
      fontSize: '0.78rem',
      color: 'var(--cream-dim)',
    },
    tierPrice: {
      fontFamily: 'var(--display)',
      fontSize: '1.4rem',
      color: 'var(--orange)',
      whiteSpace: 'nowrap',
    },
    capacityBadge: (low) => ({
      display: 'inline-block',
      fontSize: '0.7rem',
      fontFamily: 'var(--mono)',
      letterSpacing: '0.04em',
      padding: '0.15rem 0.5rem',
      borderRadius: '99px',
      background: low ? 'rgba(220,40,40,0.2)' : 'rgba(255,255,255,0.08)',
      color: low ? '#ff6b6b' : 'var(--cream-dim)',
      marginTop: '0.4rem',
    }),
    input: {
      width: '100%',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '8px',
      color: 'var(--cream)',
      fontFamily: 'var(--body)',
      fontSize: '1rem',
      padding: '0.75rem 1rem',
      marginBottom: '0.75rem',
      outline: 'none',
      boxSizing: 'border-box',
    },
    stepperRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    },
    splitBox: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
    },
    splitOption: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.7rem',
      border: '1px solid rgba(255,255,255,0.13)',
      borderRadius: '10px',
      padding: '0.85rem 1rem',
      cursor: 'pointer',
      background: 'rgba(255,255,255,0.03)',
      fontSize: '0.92rem',
      lineHeight: 1.4,
    },
    radio: {
      accentColor: 'var(--orange)',
      marginTop: '0.2rem',
      flexShrink: 0,
    },
    splitHint: {
      display: 'block',
      color: 'var(--cream-dim)',
      fontSize: '0.8rem',
      marginTop: '0.25rem',
      lineHeight: 1.5,
    },
    seatRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.5rem',
    },
    seatNum: {
      fontFamily: 'var(--mono)',
      fontSize: '0.75rem',
      color: 'var(--cream-dim)',
      width: '1.5rem',
      flexShrink: 0,
      textAlign: 'right',
    },
    stepBtn: {
      width: '2.5rem',
      height: '2.5rem',
      borderRadius: '50%',
      border: '1px solid rgba(255,255,255,0.2)',
      background: 'rgba(255,255,255,0.05)',
      color: 'var(--cream)',
      fontSize: '1.3rem',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1,
    },
    qtyDisplay: {
      fontFamily: 'var(--display)',
      fontSize: '1.6rem',
      color: 'var(--cream)',
      minWidth: '2rem',
      textAlign: 'center',
    },
    summaryBox: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '1.25rem',
      marginTop: '0.5rem',
    },
    summaryRow: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '0.9rem',
      color: 'var(--cream-dim)',
      marginBottom: '0.5rem',
    },
    summaryTotal: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      borderTop: '1px solid rgba(255,255,255,0.12)',
      paddingTop: '0.75rem',
      marginTop: '0.5rem',
    },
    totalLabel: {
      fontFamily: 'var(--mono)',
      fontSize: '0.75rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--cream-dim)',
    },
    totalAmount: {
      fontFamily: 'var(--display)',
      fontSize: '2rem',
      color: 'var(--orange)',
    },
    cta: (disabled) => ({
      width: '100%',
      marginTop: '1.5rem',
      padding: '1rem',
      background: disabled ? 'rgba(255,120,0,0.5)' : 'var(--orange)',
      border: 'none',
      borderRadius: '10px',
      color: '#fff',
      fontFamily: 'var(--display)',
      fontSize: '1.2rem',
      letterSpacing: '0.06em',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.15s, transform 0.1s',
    }),
    errorBanner: {
      background: 'rgba(220,40,40,0.15)',
      border: '1px solid rgba(220,40,40,0.4)',
      borderRadius: '8px',
      padding: '0.75rem 1rem',
      color: '#ff8080',
      fontSize: '0.9rem',
      marginTop: '1rem',
    },
    spinner: {
      display: 'inline-block',
      width: '1.2rem',
      height: '1.2rem',
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      verticalAlign: 'middle',
    },
  };

  return (
    <div style={s.page}>
      <div className="grain" style={s.grain} />

      <header style={s.header}>
        <a
          href="/#/"
          style={s.backLink}
          onClick={() => sessionStorage.setItem('scrollTo', 'tickets')}
        >
          ← Terug
        </a>
        <span style={s.wordmark}>OLF 2026</span>
        <span style={{ width: '4rem' }} />
      </header>

      <main style={s.main}>
        <h1
          style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
            color: 'var(--cream)',
            margin: '0 0 0.25rem',
          }}
        >
          Tickets
        </h1>
        <p style={{ color: 'var(--cream-dim)', marginTop: 0, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          Openluchtfuif — zomer 2026
        </p>

        {loading ? (
          <div style={{ marginTop: '2rem' }}>
            <p style={s.sectionLabel}>01 — Kies je ticket</p>
            {[1, 2].map(i => (
              <div key={i} style={{
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '1.1rem 1.25rem',
                marginBottom: '0.75rem',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ width: 120, height: 18, borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: 8, animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ width: 80, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.05)', animation: 'skeleton-pulse 1.5s ease-in-out infinite 0.2s' }} />
                </div>
                <div style={{ width: 50, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.08)', animation: 'skeleton-pulse 1.5s ease-in-out infinite 0.1s' }} />
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Ticket tier selection */}
            <p style={s.sectionLabel}>01 — Kies je ticket</p>
            {tiers.length === 0 ? (
              <p style={{ color: 'var(--cream-dim)' }}>
                Er zijn momenteel geen tickets beschikbaar.
              </p>
            ) : (
              tiers.map((tier) => {
                const active = selectedTier?.id === tier.id;
                const low = !!tier.is_almost_sold_out;
                return (
                  <div
                    key={tier.id}
                    style={s.tierCard(active)}
                    onClick={() => selectTier(tier)}
                    role="radio"
                    aria-checked={active}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && selectTier(tier)}
                  >
                    <div>
                      <div style={s.tierName}>{tier.name}</div>
                      {/* On a bundle tier the big price is the price of the
                          whole bundle, which is easy to misread as a per-person
                          price — so always spell out both. */}
                      {tier.group_size ? (
                        <div style={s.tierFee}>
                          {tier.group_size} tickets ·{' '}
                          {formatCents(Math.round(tier.price_cents / tier.group_size))} per persoon
                          {tier.fee_cents > 0 && ` · + ${formatCents(tier.fee_cents)} transactiekosten`}
                        </div>
                      ) : (
                        <div style={s.tierFee}>+ {formatCents(tier.fee_cents)} transactiekosten</div>
                      )}
                      {/* Scarcity nudge only — never a count */}
                      {(low || tier.is_sold_out) && (
                        <div style={s.capacityBadge(low)}>
                          {tier.is_sold_out ? 'Uitverkocht' : 'Bijna vol'}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={s.tierPrice}>{formatCents(tier.price_cents)}</div>
                      {tier.group_size && (
                        <div style={{ ...s.tierFee, marginTop: '0.15rem' }}>
                          per groep
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Personal details */}
            <p style={s.sectionLabel}>02 — Jouw gegevens</p>
            <input
              type="text"
              placeholder="Naam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={s.input}
              required
            />
            <input
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={s.input}
              required
            />
            <input
              type="email"
              placeholder="Herhaal e-mailadres"
              value={emailRepeat}
              onChange={(e) => setEmailRepeat(e.target.value)}
              style={{
                ...s.input,
                borderColor:
                  emailRepeat && email !== emailRepeat
                    ? 'rgba(220,40,40,0.6)'
                    : 'rgba(255,255,255,0.15)',
              }}
              required
            />

            {/* Quantity — counts bundles on a group tier, tickets otherwise */}
            <p style={s.sectionLabel}>
              03 — {groupSize ? 'Aantal groepstickets' : 'Aantal'}
            </p>
            <div style={s.stepperRow}>
              <button
                type="button"
                style={s.stepBtn}
                onClick={() => setUnits((u) => Math.max(1, u - 1))}
                aria-label="Minder"
              >
                −
              </button>
              <span style={s.qtyDisplay}>{units}</span>
              <button
                type="button"
                style={s.stepBtn}
                // Not a display choice — these are the limits create-payment
                // enforces. Letting the stepper go past them would only produce
                // a rejected checkout further down.
                onClick={() => setUnits((u) => Math.min(maxUnits, u + 1))}
                aria-label="Meer"
              >
                +
              </button>
              {groupSize && (
                <span style={{ color: 'var(--cream-dim)', fontSize: '0.9rem' }}>
                  = <strong style={{ color: 'var(--cream)' }}>{quantity} tickets</strong>
                </span>
              )}
            </div>

            {/* Guest list — every ticket gets its own QR either way; this only
                decides who receives it. */}
            {quantity > 1 && (
              <>
                <p style={s.sectionLabel}>04 — Verdeling</p>
                <div style={s.splitBox}>
                  <label style={s.splitOption}>
                    <input
                      type="radio"
                      checked={!splitTickets}
                      onChange={() => setSplitTickets(false)}
                      style={s.radio}
                    />
                    <span>
                      <strong>Stuur alle {quantity} tickets naar mij</strong>
                      <span style={s.splitHint}>
                        Je krijgt {quantity} aparte QR-codes in één e-mail en één PDF.
                      </span>
                    </span>
                  </label>
                  <label style={s.splitOption}>
                    <input
                      type="radio"
                      checked={splitTickets}
                      onChange={() => setSplitTickets(true)}
                      style={s.radio}
                    />
                    <span>
                      <strong>Stuur elk ticket rechtstreeks naar de persoon zelf</strong>
                      <span style={s.splitHint}>
                        Iedereen krijgt meteen zijn eigen ticket. Jij ontvangt sowieso
                        alle tickets als reserve.
                      </span>
                    </span>
                  </label>
                </div>

                {splitTickets && (
                  <div style={{ marginTop: '1rem' }}>
                    {seats.map((seat, i) => {
                      const invalid = seat.email.trim() && !EMAIL_RE.test(seat.email.trim());
                      return (
                        <div key={i} style={s.seatRow}>
                          <span style={s.seatNum}>{i + 1}</span>
                          <input
                            type="text"
                            placeholder="Naam (optioneel)"
                            value={seat.name}
                            onChange={(e) => setSeat(i, 'name', e.target.value)}
                            style={{ ...s.input, marginBottom: 0, flex: '1 1 34%', minWidth: 0 }}
                          />
                          <input
                            type="email"
                            placeholder="E-mailadres"
                            value={seat.email}
                            onChange={(e) => setSeat(i, 'email', e.target.value)}
                            style={{
                              ...s.input,
                              marginBottom: 0,
                              flex: '1 1 50%',
                              minWidth: 0,
                              borderColor: invalid ? 'rgba(220,40,40,0.6)' : 'rgba(255,255,255,0.15)',
                            }}
                          />
                        </div>
                      );
                    })}
                    <p style={s.splitHint}>
                      Laat een regel leeg als je dat ticket zelf wil houden — dat ticket
                      komt dan gewoon in jouw mail terecht.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Promo code */}
            <p style={s.sectionLabel}>
              {quantity > 1 ? '05' : '04'} — Promotiecode (optioneel)
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                // No placeholder: the example used to be PERS2026, which was
                // retired in migration 0032, so it advertised a code that no
                // longer validates. The section label above already says what
                // this field is for.
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                style={{ ...s.input, marginBottom: 0, flex: 1, textTransform: 'uppercase', letterSpacing: '0.1em' }}
              />
              <button
                type="button"
                onClick={validatePromo}
                disabled={!promoCode || promoValidating}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: 'var(--cream)',
                  cursor: !promoCode || promoValidating ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--mono)',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  opacity: !promoCode || promoValidating ? 0.5 : 1,
                }}
              >
                {promoValidating ? '…' : 'Toepassen'}
              </button>
            </div>
            {promoResult && !promoResult.error && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#7de87d', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
                ✓ {promoResult.description} — -{formatCents(promoResult.discount_cents)}
              </div>
            )}
            {promoResult?.error && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#ff8080', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
                {promoResult.error}
              </div>
            )}

            {/* Summary */}
            <p style={s.sectionLabel}>{quantity > 1 ? '06' : '05'} — Overzicht</p>
            <div style={s.summaryBox}>
              {selectedTier ? (
                <>
                  <div style={s.summaryRow}>
                    <span>
                      {selectedTier.name}
                      {groupSize && (
                        <span style={{ opacity: 0.6 }}> ({quantity} tickets)</span>
                      )}
                    </span>
                    <span>
                      {units} × {formatCents(selectedTier.price_cents)}
                    </span>
                  </div>
                  <div style={s.summaryRow}>
                    <span>Transactiekosten</span>
                    <span>{formatCents(selectedTier.fee_cents * units)}</span>
                  </div>
                  {splitTickets && namedSeats > 0 && (
                    <div style={s.summaryRow}>
                      <span>Rechtstreeks verstuurd</span>
                      <span>{namedSeats} van {quantity}</span>
                    </div>
                  )}
                  {discountCents > 0 && (
                    <div style={{ ...s.summaryRow, color: '#7de87d' }}>
                      <span>Korting</span>
                      <span>-{formatCents(discountCents)}</span>
                    </div>
                  )}
                  <div style={s.summaryTotal}>
                    <span style={s.totalLabel}>Totaal</span>
                    <span style={s.totalAmount}>{formatCents(totalCents)}</span>
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--cream-dim)', margin: 0, fontSize: '0.9rem' }}>
                  Selecteer een ticket om het overzicht te zien.
                </p>
              )}
            </div>

            {error && <div style={s.errorBanner}>{error}</div>}

            {/* Blocked on is_sold_out too: create-payment rejects a sold-out
                tier anyway, so letting the buyer fill in the whole form and
                press Betalen only to be told "Uitverkocht" wastes the sale. */}
            <button
              type="submit"
              style={s.cta(submitting || !selectedTier || selectedTier.is_sold_out || (splitTickets && badSeat !== -1))}
              disabled={submitting || !selectedTier || selectedTier.is_sold_out || (splitTickets && badSeat !== -1)}
            >
              {submitting ? (
                <>
                  <span style={s.spinner} /> Verwerken…
                </>
              ) : (
                'Betalen →'
              )}
            </button>
          </form>
        )}
      </main>

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.3); }
        input:focus { border-color: var(--orange) !important; }
      `}</style>
    </div>
  );
}
