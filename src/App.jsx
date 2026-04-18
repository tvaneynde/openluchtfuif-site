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
      <Edities />
      <Lineup />
      <Tickets />
      <Partners />
      <Info />
      <Faq />
      <About />
      <Footer />
    </>
  );
}
