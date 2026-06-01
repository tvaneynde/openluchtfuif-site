import { useState, useEffect } from "react";
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

function MarqueeStar() {
  return (
    <svg className="star" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon fill="currentColor" points="50,3 57.6,31.5 83.2,16.8 68.5,42.4 97,50 68.5,57.6 83.2,83.2 57.6,68.5 50,97 42.4,68.5 16.8,83.2 31.5,57.6 3,50 31.5,42.4 16.8,16.8 42.4,31.5" />
    </svg>
  );
}

function useActiveSection() {
  const [active, setActive] = useState("home");
  useEffect(() => {
    const ids = ["home", "edities", "lineup", "tickets", "partners", "info", "faq", "about"];
    const onScroll = () => {
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
  return active;
}

export default function App() {
  const active = useActiveSection();

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("in"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".scroll-reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <div className="grain" />
      <Nav active={active} />
      <Hero />
      <Lineup />
      <Tickets />
      <Partners />
      {/* Photo strip + marquee */}
      <div style={{ padding: "0 40px" }}>
        <div className="photo-strip">
          {["photo-1", "photo-3", "photo-4", "photo-5", "photo-6", "photo-2"].map((p, i) => (
            <div
              key={i}
              className="ph"
              style={{ backgroundImage: `url(${import.meta.env.BASE_URL}/assets/${p}.jpg)` }}
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
      <Info />
      <Faq />
      <Edities />
      <About />
      <Footer />
    </>
  );
}
