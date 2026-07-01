import { useState, useEffect, useRef } from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Edities from "./components/Edities";
import Lineup from "./components/Lineup";
import Tickets from "./components/Tickets";
import Partners from "./components/Partners";
import Info from "./components/Info";
import Faq from "./components/Faq";
import About from "./components/About";
import Footer from "./components/Footer";
import { supabase } from "./utils/supabase";

function MarqueeStar() {
  return (
    <svg className="star" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon fill="currentColor" points="50,3 57.6,31.5 83.2,16.8 68.5,42.4 97,50 68.5,57.6 83.2,83.2 57.6,68.5 50,97 42.4,68.5 16.8,83.2 31.5,57.6 3,50 31.5,42.4 16.8,16.8 42.4,31.5" />
    </svg>
  );
}

function useActiveSection() {
  const [active, setActive] = useState("home");
  const locked = useRef(false);

  // Call this when a nav link is clicked — immediately sets active and suppresses
  // scroll-detection for 1.6s so the indicator doesn't lag behind the animation.
  function navigateTo(id) {
    setActive(id);
    locked.current = true;
    setTimeout(() => { locked.current = false; }, 1600);
  }

  useEffect(() => {
    // Order must match DOM top-to-bottom order so the last match wins correctly.
    const ids = ["home", "lineup", "tickets", "partners", "info", "faq", "edities", "about"];
    const onScroll = () => {
      if (locked.current) return;
      let cur = "home";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.4) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return [active, navigateTo];
}

export default function App() {
  const [active, navigateTo] = useActiveSection();
  const [sections, setSections] = useState({});

  useEffect(() => {
    if (!supabase) return;
    supabase.from('page_sections').select('*').then(({ data }) => {
      if (data) {
        const map = {};
        data.forEach(s => { map[s.id] = s; });
        setSections(map);
      }
    });
  }, []);

  useEffect(() => {
    const target = sessionStorage.getItem('scrollTo');
    if (target) {
      sessionStorage.removeItem('scrollTo');
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("in"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".scroll-reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // A section is shown by default until settings load; hidden only when explicitly false
  const show = (id) => sections[id]?.visible !== false;
  const mode = (id) => sections[id]?.mode ?? 'live';

  return (
    <>
      <div className="grain" />
      <Nav active={active} sections={sections} onNavigate={navigateTo} />
      <Hero />
      {show('lineup')   && <Lineup   mode={mode('lineup')} />}
      {show('tickets')  && <Tickets  mode={mode('tickets')} />}
      {show('partners') && <Partners mode={mode('partners')} />}
      {/* Photo strip + marquee */}
      <div style={{ padding: "0 40px" }}>
        <div className="photo-strip">
          {["photo-1", "photo-3", "photo-4", "photo-5", "photo-6", "photo-2"].map((p, i) => (
            <div
              key={i}
              className="ph"
              style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/${p}.jpg)` }}
            />
          ))}
        </div>
      </div>
      <div className="marquee-mega">
        <div className="marquee-track">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i}>
              29 AUGUSTUS 2026 <MarqueeStar />
              MUZIEK ONDER DE OPEN HEMEL <MarqueeStar />
              16:00 TOT 03:00 <MarqueeStar />
              EDITIE XIV <MarqueeStar />
              KLEINE GANZENDRIES, PELLENBERG <MarqueeStar />
              CASHLESS · DUURZAAM · AMBIANCE <MarqueeStar />
            </span>
          ))}
        </div>
      </div>
      {show('info') && <Info mode={mode('info')} />}
      {show('faq')  && <Faq  mode={mode('faq')} />}
      {show('edities') && <Edities />}
      {show('about')   && <About />}
      <Footer />
    </>
  );
}
