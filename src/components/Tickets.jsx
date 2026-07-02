import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

function formatPrice(cents) {
  const value = cents / 100;
  return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace('.', ',');
}

function tierStatus(tier) {
  const now = new Date();
  const remaining = tier.total_capacity - (tier.sold_count ?? 0);
  if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now) return 'soon';
  if (tier.sale_ends_at && new Date(tier.sale_ends_at) < now) return 'closed';
  if (remaining <= 0) return 'soldout';
  if (remaining <= 20) return 'low';
  return 'open';
}

const STATUS_LABEL = {
  open: 'Nu te koop',
  low: 'Bijna vol',
  soldout: 'Uitverkocht',
  soon: 'Binnenkort',
  closed: 'Verkoop gesloten',
};

const ROTATIONS = [-1.6, 1.1, -0.7, 1.4];

function TicketStub({ tier, index }) {
  const sold = tier.sold_count ?? 0;
  const remaining = Math.max(0, tier.total_capacity - sold);
  const pctSold = Math.min(100, Math.round((sold / tier.total_capacity) * 100));
  const status = tierStatus(tier);
  const disabled = status === 'soldout' || status === 'soon' || status === 'closed';

  const meterLabel = status === 'low'
    ? `Nog maar ${remaining} over`
    : status === 'soldout'
      ? 'Geen tickets meer'
      : STATUS_LABEL[status];

  return (
    <div
      className={`ticket-stub status-${status}`}
      style={{ '--rot': `${ROTATIONS[index % ROTATIONS.length]}deg` }}
    >
      {status === 'soldout' && <div className="ticket-stamp">Uitverkocht</div>}

      <div className="ticket-main">
        <div className="ticket-kicker mono">Toegangsbewijs · Editie XIV</div>
        <h3 className="ticket-name">{tier.name}</h3>
        <div className="ticket-price-row">
          <span className="ticket-price">€{formatPrice(tier.price_cents)}</span>
          <span className="ticket-fee mono">+ €{formatPrice(tier.fee_cents)} kosten</span>
        </div>
        <p className="ticket-desc">
          {tier.description || 'Toegang tot de volledige avond.'}
        </p>

        <div className="ticket-meter">
          <div className="ticket-meter-fill" style={{ width: `${pctSold}%` }} />
        </div>
        <div className="ticket-meter-label mono">
          <span className={status === 'low' || status === 'soldout' ? 'urgent' : ''}>{meterLabel}</span>
        </div>
      </div>

      <div className="ticket-tear">
        <span className="ticket-notch ticket-notch-top" />
        <span className="ticket-notch ticket-notch-bottom" />
      </div>

      <div className="ticket-stub-side">
        <div className="ticket-vertical mono">Admit one</div>
        <div className="ticket-barcode" aria-hidden="true" />
        {disabled ? (
          <span className="ticket-cta disabled">
            {status === 'soldout' ? 'Vol' : status === 'soon' ? '...' : 'Dicht'}
          </span>
        ) : (
          <a href={`/#/checkout?tier_id=${tier.id}`} className="ticket-cta">Koop →</a>
        )}
      </div>
    </div>
  );
}

function DoorTicket({ tier }) {
  return (
    <div className="ticket-stub status-door" style={{ '--rot': '-0.9deg' }}>
      <div className="ticket-main">
        <div className="ticket-kicker mono">Aan de kassa</div>
        <h3 className="ticket-name">{tier.name}</h3>
        <div className="ticket-price-row">
          <span className="ticket-price">€{formatPrice(tier.price_cents)}</span>
          <span className="ticket-fee mono">als er nog plek is</span>
        </div>
        <p className="ticket-desc">
          {tier.description || 'Beperkt beschikbaar aan de deur.'}
        </p>
      </div>

      <div className="ticket-tear">
        <span className="ticket-notch ticket-notch-top" />
        <span className="ticket-notch ticket-notch-bottom" />
      </div>

      <div className="ticket-stub-side">
        <div className="ticket-vertical mono">Misschien</div>
        <div className="ticket-barcode" aria-hidden="true" />
        <a href="#tickets" className="ticket-cta disabled">Info</a>
      </div>
    </div>
  );
}

function TicketSkeleton({ index }) {
  return (
    <div className="ticket-stub ticket-skeleton" style={{ '--rot': `${ROTATIONS[index % ROTATIONS.length]}deg` }}>
      <div className="ticket-main">
        <div className="ticket-skel-line" style={{ width: '50%', height: 10 }} />
        <div className="ticket-skel-line" style={{ width: '70%', height: 32, margin: '14px 0' }} />
        <div className="ticket-skel-line" style={{ width: '40%', height: 24 }} />
      </div>
    </div>
  );
}

export default function Tickets({ mode = 'live' }) {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode !== 'live' || !supabase) { setLoading(false); return; }
    supabase
      .from('ticket_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setTiers(data);
        setLoading(false);
      });
  }, [mode]);

  return (
    <section id="tickets">
      <div className="section-head">
        <span className="section-num">04 / Toegang</span>
        <h2 className="section-title">Tickets</h2>
      </div>

      {mode === 'coming_soon' ? (
        <div style={{ paddingBottom: 40 }}>
          <div className="mono" style={{ color: "var(--orange-bright)", marginBottom: 16 }}>◉ Binnenkort</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 5vw, 64px)", lineHeight: 0.95, marginBottom: 20 }}>
            Tickets komen<br />snel online
          </div>
          <p style={{ fontSize: 15, opacity: 0.6, maxWidth: 440, marginBottom: 28 }}>
            Schrijf je in op onze mailinglijst en wees de eerste die weet wanneer de tickets in de verkoop gaan.
          </p>
          <a className="btn btn-primary" href="https://www.instagram.com/openluchtfuif3212" target="_blank" rel="noreferrer">Volg ons →</a>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 18, maxWidth: 640, marginBottom: 56, opacity: 0.85 }}>
            Hoe vroeger, hoe goedkoper.
          </p>

          <div className="tickets-grid">
            {loading ? (
              [0, 1, 2].map(i => <TicketSkeleton key={i} index={i} />)
            ) : (
              <>
                {tiers.filter(t => !t.is_door_sale).map((tier, i) => (
                  <TicketStub key={tier.id} tier={tier} index={i} />
                ))}
                {tiers.filter(t => t.is_door_sale).map(tier => (
                  <DoorTicket key={tier.id} tier={tier} />
                ))}
              </>
            )}
          </div>

          <div className="tkt-notice">
            <span>-18? Kom met ID.</span>
            <span>Alcohol &lt;16 = nee</span>
          </div>
        </>
      )}
    </section>
  );
}
