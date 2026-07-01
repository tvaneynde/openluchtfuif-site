import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, imgUrl } from '../utils/supabase';

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
  const [photos, setPhotos]   = useState([]);   // array of full imgUrl strings
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  // Fetch all photos from editions/2024/ and shuffle on load
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.storage
        .from('images')
        .list('editions/2024', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

      if (data && !error) {
        const urls = shuffle(
          data
            .filter(f => /\.(jpe?g|png|webp)$/i.test(f.name))
            .map(f => imgUrl(`editions/2024/${f.name}`))
        );
        setPhotos(urls);
      }
      setLoading(false);
    }
    load();
  }, []);

  const open = (i) => { setLightbox(i); document.body.style.overflow = 'hidden'; };
  const close = useCallback(() => { setLightbox(null); document.body.style.overflow = ''; }, []);
  const prev = useCallback(() => setLightbox(i => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setLightbox(i => (i + 1) % photos.length), [photos.length]);

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
          Herinneringen
        </h1>
        <p style={{ fontSize: 16, opacity: 0.6, maxWidth: 480 }}>
          Openluchtfuif Pellenberg door de jaren heen — van de eerste editie tot vandaag.
        </p>
      </div>

      {/* Masonry grid */}
      {loading ? (
        <div style={{ padding: '80px 40px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', opacity: 0.35 }}>
          LADEN…
        </div>
      ) : (
        <div className="archive-grid">
          {photos.map((url, i) => (
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

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
