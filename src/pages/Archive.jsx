import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase, imgUrl } from '../utils/supabase';

const BATCH_SIZE = 40;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  const touchStart = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 50) { dx < 0 ? onNext() : onPrev(); }
    touchStart.current = null;
  };

  return (
    <div
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(10,4,14,0.96)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Prev */}
      <button
        onClick={e => { e.stopPropagation(); onPrev(); }}
        style={{
          position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(244,231,208,.12)', border: '1px solid rgba(244,231,208,.2)',
          color: 'var(--cream)', borderRadius: 999, width: 52, height: 52,
          fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,.12)'}
      >←</button>

      {/* Image */}
      <img
        src={photos[index]}
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: '88vh', maxWidth: '88vw',
          objectFit: 'contain',
          borderRadius: 12,
          boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
          userSelect: 'none',
        }}
      />

      {/* Next */}
      <button
        onClick={e => { e.stopPropagation(); onNext(); }}
        style={{
          position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(244,231,208,.12)', border: '1px solid rgba(244,231,208,.2)',
          color: 'var(--cream)', borderRadius: 999, width: 52, height: 52,
          fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,.12)'}
      >→</button>

      {/* Counter + close */}
      <div style={{
        position: 'absolute', top: 24, right: 24,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.15em', color: 'rgba(244,231,208,.5)' }}>
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(244,231,208,.12)', border: '1px solid rgba(244,231,208,.2)',
            color: 'var(--cream)', borderRadius: 999, width: 40, height: 40,
            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>
    </div>
  );
}

export default function Archive() {
  const { year } = useParams();
  const folder = year ? `editions/${year}` : 'archive';

  const [photos, setPhotos]   = useState([]);   // array of full imgUrl strings
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [lightbox, setLightbox] = useState(null);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const sentinelRef = useRef(null);

  // Show a "back to top" button once the user has scrolled past one screen.
  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Fetch all photos in the target folder (archive/, or editions/<year>/) and shuffle on load.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setVisibleCount(BATCH_SIZE);
      const { data, error } = await supabase.storage
        .from('images')
        .list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

      if (!cancelled && data && !error) {
        const urls = shuffle(
          data
            .filter(f => f.id && /\.(jpe?g|png|webp)$/i.test(f.name))
            .map(f => imgUrl(`${folder}/${f.name}`))
        );
        setPhotos(urls);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [folder]);

  // Reveal more photos as the user scrolls near the bottom, instead of
  // mounting every <img> (there can be hundreds) up front.
  useEffect(() => {
    if (visibleCount >= photos.length) return;
    const onScroll = () => {
      const el = sentinelRef.current;
      if (!el) return;
      if (el.getBoundingClientRect().top < window.innerHeight + 800) {
        setVisibleCount(c => Math.min(c + BATCH_SIZE, photos.length));
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [photos.length, visibleCount]);

  const open = (i) => { setLightbox(i); document.body.style.overflow = 'hidden'; };
  const close = useCallback(() => { setLightbox(null); document.body.style.overflow = ''; }, []);
  const prev = useCallback(() => setLightbox(i => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setLightbox(i => (i + 1) % photos.length), [photos.length]);

  const visiblePhotos = photos.slice(0, visibleCount);
  const title = year ? `Editie ${year}` : 'Herinneringen';
  const subtitle = year
    ? `Alle foto's van de editie van ${year}.`
    : "Openluchtfuif Pellenberg door de jaren heen — van de eerste editie tot vandaag.";

  return (
    <div style={{ background: 'var(--purple-deep)', minHeight: '100vh', color: 'var(--cream)' }}>
      <div className="grain" />

      {/* Header */}
      <div className="archive-header" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(42,15,51,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(244,231,208,.1)',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <Link
          to="/"
          style={{
            fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em',
            color: 'var(--cream)', textDecoration: 'none', opacity: 0.7,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
        >
          ← TERUG
        </Link>
        <div style={{ width: 1, height: 20, background: 'rgba(244,231,208,.2)' }} />
        <span style={{ fontFamily: 'var(--display)', fontSize: 32, lineHeight: 1 }}>Archief</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', opacity: 0.45, marginLeft: 'auto' }}>
          {loading ? '…' : `${photos.length} FOTO'S`}
        </span>
      </div>

      {/* Intro */}
      <div className="archive-intro">
        <h1 style={{
          fontFamily: 'var(--display)',
          fontSize: 'clamp(56px, 10vw, 140px)',
          lineHeight: 0.88, letterSpacing: '-0.02em',
          marginBottom: 20,
        }}>
          {title}
        </h1>
        <p style={{ fontSize: 16, opacity: 0.6, maxWidth: 480 }}>
          {subtitle}
        </p>
      </div>

      {/* Masonry grid */}
      {loading ? (
        <div style={{ padding: '80px 40px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', opacity: 0.35 }}>
          LADEN…
        </div>
      ) : (
        <div className="archive-grid">
          {visiblePhotos.map((url, i) => (
            <div
              key={url}
              onClick={() => open(i)}
              style={{
                breakInside: 'avoid',
                marginBottom: 10,
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'zoom-in',
                position: 'relative',
                minHeight: 220,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <img
                src={url}
                loading="lazy"
                style={{
                  width: '100%',
                  display: 'block',
                  transition: 'transform 0.5s cubic-bezier(.2,.8,.2,1), filter 0.3s',
                  filter: 'saturate(1.05)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.04)';
                  e.currentTarget.style.filter = 'saturate(1.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.filter = 'saturate(1.05)';
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!loading && visibleCount < photos.length && (
        <div ref={sentinelRef} style={{ height: 1 }} />
      )}

      {/* Lightbox */}
      {lightbox !== null && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}

      {/* Back to top */}
      <button
        onClick={scrollToTop}
        aria-label="Terug naar boven"
        style={{
          position: 'fixed', bottom: 28, left: '50%', zIndex: 200,
          width: 52, height: 52, borderRadius: 999,
          background: 'rgba(244,231,208,.12)', border: '1px solid rgba(244,231,208,.2)',
          backdropFilter: 'blur(12px)',
          color: 'var(--cream)', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: showTopBtn ? 1 : 0,
          transform: showTopBtn ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(12px)',
          pointerEvents: showTopBtn ? 'auto' : 'none',
          transition: 'opacity 0.25s, transform 0.25s, background 0.2s',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,231,208,.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,231,208,.12)'}
      >↑</button>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
