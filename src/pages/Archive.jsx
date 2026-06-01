import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { imgUrl } from '../utils/supabase';

// All archive photos from Supabase images/archive/
const PHOTOS = [
  '07d0ad22-6f30-4400-8599-6d24da5b867f.jpg',
  '194cf2c5-04c8-427f-a307-dd44414a49da.jpg',
  '2e8bd41a-34bc-4582-831e-8f359fed0c6c.jpg',
  '3cb625ea-8ac7-40b8-8f21-5f7efb82dcc0.jpg',
  '43dd21d7-d517-44f4-99d5-68c756c8358f.jpg',
  '6045f13f-5e09-478f-ad29-9222582c18cc.jpg',
  '73398766-c687-4ad2-8a87-5e7ff61d975b.jpg',
  '8b8023d5-9d50-442e-b0c3-034d9d851129.jpg',
  '91c2dda6-31a7-473a-8c4c-64f77b5955f7.jpg',
  '9d828324-9cc6-48bf-8946-f43acb6345ef.jpg',
  '9eed1574-35ef-420c-9ed2-24e4a0d46948.jpg',
  'ce9b9013-4a8d-4e7c-87ba-552b3b15bb7a.jpg',
  'eec74fe4-3e92-4e93-90ec-154052cf3923.jpg',
  'ef7a2e8d-a1c6-491b-81ea-f59ac02cda84.jpg',
  'f05efddf-3693-4846-b32c-f1ceb5330e3a.jpg',
  'fc9bccbe-a533-4398-8235-8fdb1284c1d2.jpg',
  'fffadb8d-c951-4d7d-b8d7-aa797b285044.jpg',
  'IMG_9408.JPG',
  'IMG_9410.JPG',
  'IMG_9411.JPG',
  'IMG_9412.JPG',
  'OLF 3 affiche.jpg',
  'OLF1 copy.jpg',
  'OLF2.jpg',
  'olf4.jpg',
  'olf5 copy.jpg',
  'olf7.jpg',
];

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  return (
    <div
      onClick={onClose}
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
        src={imgUrl(`archive/${photos[index]}`)}
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
  const [lightbox, setLightbox] = useState(null);

  const open = (i) => { setLightbox(i); document.body.style.overflow = 'hidden'; };
  const close = useCallback(() => { setLightbox(null); document.body.style.overflow = ''; }, []);
  const prev = useCallback(() => setLightbox(i => (i - 1 + PHOTOS.length) % PHOTOS.length), []);
  const next = useCallback(() => setLightbox(i => (i + 1) % PHOTOS.length), []);

  return (
    <div style={{ background: 'var(--purple-deep)', minHeight: '100vh', color: 'var(--cream)' }}>
      <div className="grain" />

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(42,15,51,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(244,231,208,.1)',
        padding: '16px 40px',
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
          {PHOTOS.length} FOTO'S
        </span>
      </div>

      {/* Intro */}
      <div style={{ padding: '60px 40px 40px' }}>
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
      <div style={{
        padding: '0 40px 80px',
        columns: '4 220px',
        gap: 10,
      }}>
        {PHOTOS.map((photo, i) => (
          <div
            key={photo}
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
              src={imgUrl(`archive/${photo}`)}
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

      {/* Lightbox */}
      {lightbox !== null && (
        <Lightbox
          photos={PHOTOS}
          index={lightbox}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @media (max-width: 768px) {
          [data-archive-grid] { columns: 2 !important; padding: 0 20px 60px !important; }
        }
      `}</style>
    </div>
  );
}
