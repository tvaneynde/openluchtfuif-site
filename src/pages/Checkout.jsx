import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

function formatCents(cents) {
  return '€' + (cents / 100).toFixed(2).replace('.', ',');
}

export default function Checkout() {
  const [tiers, setTiers] = useState([]);
  const [selectedTier, setSelectedTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailRepeat, setEmailRepeat] = useState('');
  const [quantity, setQuantity] = useState(1);
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
      .from('ticket_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) {
          setTiers(data);
          if (preselectedId) {
            const found = data.find((t) => String(t.id) === preselectedId);
            if (found) setSelectedTier(found);
          }
          if (!preselectedId && data.length > 0) setSelectedTier(data[0]);
        }
        setLoading(false);
      });
  }, []);

  const discountCents = promoResult && !promoResult.error ? promoResult.discount_cents : 0;
  const totalCents = selectedTier
    ? Math.max(0, (selectedTier.price_cents + selectedTier.fee_cents) * quantity - discountCents)
    : 0;

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

      let discount = 0;
      if (promo.discount_type === 'percent') {
        discount = Math.round((selectedTier.price_cents * promo.discount_value / 100) * quantity);
      } else {
        discount = Math.min(promo.discount_value * quantity, selectedTier.price_cents * quantity);
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
          ...(promoResult && !promoResult.error ? { promo_code: promoResult.code } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || `Fout ${res.status}. Probeer opnieuw.`);
        return;
      }
      if (data.alreadyPaid || data.free) {
        window.location.href = `/#/bedankt?order_id=${data.orderId}`;
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
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
        <a href="/#tickets" style={s.backLink}>
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
                const remaining = tier.capacity - (tier.sold_count ?? 0);
                const low = remaining <= 20;
                return (
                  <div
                    key={tier.id}
                    style={s.tierCard(active)}
                    onClick={() => setSelectedTier(tier)}
                    role="radio"
                    aria-checked={active}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedTier(tier)}
                  >
                    <div>
                      <div style={s.tierName}>{tier.name}</div>
                      <div style={s.tierFee}>+ {formatCents(tier.fee_cents)} transactiekosten</div>
                      {tier.capacity != null && (
                        <div style={s.capacityBadge(low)}>
                          {low ? `Nog ${remaining} beschikbaar` : `${remaining} beschikbaar`}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={s.tierPrice}>{formatCents(tier.price_cents)}</div>
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

            {/* Quantity */}
            <p style={s.sectionLabel}>03 — Aantal</p>
            <div style={s.stepperRow}>
              <button
                type="button"
                style={s.stepBtn}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Minder"
              >
                −
              </button>
              <span style={s.qtyDisplay}>{quantity}</span>
              <button
                type="button"
                style={s.stepBtn}
                onClick={() => setQuantity((q) => Math.min(4, q + 1))}
                aria-label="Meer"
              >
                +
              </button>
              <span style={{ color: 'var(--cream-dim)', fontSize: '0.82rem', fontFamily: 'var(--mono)' }}>
                max. 4 per bestelling
              </span>
            </div>

            {/* Promo code */}
            <p style={s.sectionLabel}>04 — Promotiecode (optioneel)</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="bv. PERS2026"
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
            <p style={s.sectionLabel}>05 — Overzicht</p>
            <div style={s.summaryBox}>
              {selectedTier ? (
                <>
                  <div style={s.summaryRow}>
                    <span>{selectedTier.name}</span>
                    <span>
                      {quantity} × {formatCents(selectedTier.price_cents)}
                    </span>
                  </div>
                  <div style={s.summaryRow}>
                    <span>Transactiekosten</span>
                    <span>{formatCents(selectedTier.fee_cents * quantity)}</span>
                  </div>
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

            <button
              type="submit"
              style={s.cta(submitting || !selectedTier)}
              disabled={submitting || !selectedTier}
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
