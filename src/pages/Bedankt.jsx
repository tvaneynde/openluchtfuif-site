import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';

function formatCents(cents) {
  return '€' + (cents / 100).toFixed(2).replace('.', ',');
}

export default function Bedankt() {
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | paid | expired | cancelled | abandoned | timeout | not_found
  const intervalRef   = useRef(null);
  const startTimeRef  = useRef(Date.now());
  const pollCountRef  = useRef(0);
  const syncFiredRef  = useRef(false); // only force-sync once

  const orderId = (() => {
    const hash = window.location.hash; // e.g. #/bedankt?order_id=xxx
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return null;
    return new URLSearchParams(hash.slice(qIndex + 1)).get('order_id');
  })();

  useEffect(() => {
    if (!orderId) {
      setStatus('not_found');
      return;
    }

    async function poll() {
      pollCountRef.current += 1;

      const { data, error } = await supabase
        .from('orders')
        .select('id, status, buyer_name, buyer_email, total_cents, quantity, mollie_payment_id, ticket_tiers(name)')
        .eq('id', orderId)
        .single();

      if (error || !data) {
        setStatus('not_found');
        clearInterval(intervalRef.current);
        return;
      }

      setOrder(data);

      if (data.status === 'paid') {
        setStatus('paid');
        clearInterval(intervalRef.current);
        return;
      }
      if (data.status === 'expired' || data.status === 'cancelled') {
        setStatus(data.status);
        clearInterval(intervalRef.current);
        return;
      }

      // After 2nd poll still awaiting_payment (~6s elapsed):
      // 1. Fire a force-sync against Mollie to catch race conditions
      // 2. If status is STILL awaiting_payment after 3rd poll (~9s), the user
      //    most likely pressed back or closed Mollie — show the retry screen.
      if (pollCountRef.current === 2 && !syncFiredRef.current && data.mollie_payment_id) {
        syncFiredRef.current = true;
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mollie-webhook`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `id=${data.mollie_payment_id}`,
          }
        ).catch(() => {});
      }

      // After 3rd poll (~9s) still pending → user abandoned the payment
      if (pollCountRef.current >= 3 && syncFiredRef.current) {
        setStatus('abandoned');
        clearInterval(intervalRef.current);
        return;
      }

      // Hard timeout after 60s
      if (Date.now() - startTimeRef.current > 60_000) {
        setStatus('timeout');
        clearInterval(intervalRef.current);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => clearInterval(intervalRef.current);
  }, [orderId]);

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
      maxWidth: '520px',
      margin: '0 auto',
      padding: '4rem 1.5rem 5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      position: 'relative',
      zIndex: 2,
    },
    iconCircle: (color) => ({
      width: '5rem',
      height: '5rem',
      borderRadius: '50%',
      background: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '2.2rem',
      marginBottom: '1.5rem',
      flexShrink: 0,
    }),
    heading: {
      fontFamily: 'var(--display)',
      fontSize: 'clamp(2rem, 6vw, 3rem)',
      color: 'var(--orange)',
      margin: '0 0 0.5rem',
      lineHeight: 1.1,
    },
    sub: {
      color: 'var(--cream-dim)',
      fontSize: '1rem',
      margin: '0 0 2rem',
      lineHeight: 1.5,
    },
    summaryBox: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      width: '100%',
      textAlign: 'left',
      marginBottom: '2rem',
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
      fontSize: '1.6rem',
      color: 'var(--orange)',
    },
    homeLink: {
      display: 'inline-block',
      background: 'var(--orange)',
      color: '#fff',
      textDecoration: 'none',
      fontFamily: 'var(--display)',
      fontSize: '1.1rem',
      letterSpacing: '0.06em',
      padding: '0.8rem 2rem',
      borderRadius: '8px',
    },
    retryLink: {
      display: 'inline-block',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.2)',
      color: 'var(--cream)',
      textDecoration: 'none',
      fontFamily: 'var(--display)',
      fontSize: '1.1rem',
      letterSpacing: '0.06em',
      padding: '0.8rem 2rem',
      borderRadius: '8px',
    },
    spinner: {
      width: '3rem',
      height: '3rem',
      border: '3px solid rgba(255,255,255,0.15)',
      borderTopColor: 'var(--orange)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginBottom: '1.5rem',
    },
    refreshBtn: {
      marginTop: '1rem',
      background: 'none',
      border: '1px solid rgba(255,255,255,0.2)',
      color: 'var(--cream-dim)',
      fontFamily: 'var(--mono)',
      fontSize: '0.85rem',
      padding: '0.5rem 1.25rem',
      borderRadius: '6px',
      cursor: 'pointer',
    },
  };

  const tierName = order?.ticket_tiers?.name ?? '—';

  return (
    <div style={s.page}>
      <div className="grain" style={s.grain} />

      <header style={s.header}>
        <a href="/#/" style={s.backLink}>
          ← Home
        </a>
        <span style={s.wordmark}>OLF 2026</span>
        <span style={{ width: '4rem' }} />
      </header>

      <main style={s.main}>
        {status === 'loading' && (
          <>
            <div style={s.spinner} />
            <h1 style={{ ...s.heading, color: 'var(--cream)' }}>Betaling verwerken…</h1>
            <p style={s.sub}>Even geduld, we controleren je betaling.</p>
          </>
        )}

        {status === 'paid' && order && (
          <>
            <div style={s.iconCircle('var(--orange)')}>✓</div>
            <h1 style={s.heading}>Bedankt, {order.buyer_name.split(' ')[0]}!</h1>
            <p style={s.sub}>
              Je tickets zijn onderweg naar{' '}
              <strong style={{ color: 'var(--cream)' }}>{order.buyer_email}</strong>
            </p>
            <div style={s.summaryBox}>
              <div style={s.summaryRow}>
                <span>Ticket</span>
                <span style={{ color: 'var(--cream)' }}>{tierName}</span>
              </div>
              <div style={s.summaryRow}>
                <span>Aantal</span>
                <span style={{ color: 'var(--cream)' }}>{order.quantity}</span>
              </div>
              <div style={s.summaryTotal}>
                <span style={s.totalLabel}>Betaald</span>
                <span style={s.totalAmount}>{formatCents(order.total_cents)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 340 }}>
              <a
                href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-ticket?order_id=${orderId}`}
                download
                style={{
                  display: 'block', textAlign: 'center',
                  background: 'var(--orange)', color: '#fff', textDecoration: 'none',
                  fontFamily: 'var(--display)', fontSize: '1.1rem', letterSpacing: '0.06em',
                  padding: '0.9rem 2rem', borderRadius: '8px',
                }}
              >
                ↓ Download tickets (PDF)
              </a>
              <a href="/#/" style={{ ...s.homeLink, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--cream)' }}>
                Terug naar de site →
              </a>
            </div>
          </>
        )}

        {(status === 'expired' || status === 'cancelled' || status === 'abandoned') && (
          <>
            <div style={{ ...s.iconCircle('rgba(220,40,40,0.25)'), color: '#ff6b6b', border: '2px solid rgba(220,40,40,0.4)' }}>
              ✗
            </div>
            <h1 style={{ ...s.heading, color: 'var(--cream)' }}>Betaling niet voltooid</h1>
            <p style={s.sub}>
              {status === 'expired'
                ? 'De betaaltermijn is verlopen.'
                : status === 'abandoned'
                ? 'Je bent teruggekeerd zonder te betalen.'
                : 'De betaling werd geannuleerd.'}
            </p>
            <a
              href={order ? `/#/checkout?tier_id=${order.ticket_tiers?.id ?? ''}` : '/#/checkout'}
              style={s.retryLink}
            >
              Probeer opnieuw →
            </a>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div style={s.iconCircle('rgba(255,200,0,0.15)')}>⏳</div>
            <h1 style={{ ...s.heading, fontSize: '1.8rem', color: 'var(--cream)' }}>
              Dit duurt langer dan verwacht
            </h1>
            <p style={s.sub}>
              Check je inbox — soms komen betalingen vertraagd binnen.
              <br />
              Ontvang je niks? Neem contact op.
            </p>
            <button
              style={s.refreshBtn}
              onClick={() => {
                startTimeRef.current = Date.now();
                setStatus('loading');
                clearInterval(intervalRef.current);
                intervalRef.current = setInterval(async () => {
                  const { data } = await supabase
                    .from('orders')
                    .select('id, status, buyer_name, buyer_email, total_cents, quantity, mollie_payment_id, ticket_tiers(name)')
                    .eq('id', orderId)
                    .single();
                  if (!data) return;
                  setOrder(data);
                  if (data.status === 'paid') { setStatus('paid'); clearInterval(intervalRef.current); }
                  if (data.status === 'expired' || data.status === 'cancelled') { setStatus(data.status); clearInterval(intervalRef.current); }
                }, 3000);
              }}
            >
              Ververs
            </button>
          </>
        )}

        {status === 'not_found' && (
          <>
            <div style={{ ...s.iconCircle('rgba(255,255,255,0.05)'), fontSize: '1.8rem' }}>?</div>
            <h1 style={{ ...s.heading, fontSize: '1.8rem', color: 'var(--cream)' }}>
              Geen bestelling gevonden
            </h1>
            <p style={s.sub}>De link klopt niet of de bestelling bestaat niet.</p>
            <a href="/#/" style={s.homeLink}>
              Naar de startpagina
            </a>
          </>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
