export default function About() {
  return (
    <section id="about">
      <div className="section-head">
        <span className="section-num">08 / Wie zijn wij</span>
        <h2 className="section-title">Over ons</h2>
      </div>
      <div className="about-wrap">
        <div className="about-text">
          <p className="scroll-reveal" style={{ "--delay": "0s" }}>
            Openluchtfuif 3212 vzw is een enthousiast team van vrijwilligers met stevige lokale wortels in Pellenberg. We zijn een mix van oud-leiding, oud-kernleden én huidige leiding en kernleden van Chiro Crescendo en Jeugdhuis De Kluster. Met die combinatie van ervaring, jonge energie en een gedeelde passie voor sfeer en verbinding zetten we ons elk jaar in om van de Openluchtfuif een onvergetelijke avond te maken.
          </p>
          <p className="scroll-reveal" style={{ "--delay": "0.1s" }}>
            Na 17 jaar stilte brachten we een geliefde traditie opnieuw tot leven. Geïnspireerd door de verhalen en herinneringen van dorpsgenoten besloten we om de openluchtfuif terug naar Pellenberg te brengen — een plek waar mensen samenkomen om de zomer feestelijk af te sluiten onder de sterrenhemel.
          </p>
          <p className="scroll-reveal" style={{ "--delay": "0.2s" }}>
            Wat voor ons centraal staat? Muziek, ambiance en verbondenheid. We willen een openluchtbeleving creëren waar iedereen zich welkom voelt: van trouwe bezoekers van vroeger tot nieuwe generaties feestvierders, van Pellenberg en ver daarbuiten. Met Openluchtfuif 3212 bouwen we stap voor stap verder aan een jaarlijkse traditie die mensen samenbrengt en nog jaren zal nazinderen.
          </p>

          <div className="about-stats">
            {[
              { n: "1993", l: "Eerste editie" },
              { n: "17", l: "Jaar pauze" },
              { n: "40+", l: "Vrijwilligers" },
              { n: "XIV", l: "Editie in 2026" },
            ].map((s, i) => (
              <div
                key={i}
                className="stat scroll-reveal"
                style={{ "--delay": `${0.1 + i * 0.1}s` }}
              >
                <div className="n">{s.n}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="scroll-reveal"
          style={{
            "--delay": "0.15s",
            position: "relative",
            aspectRatio: "4/5",
            borderRadius: 24,
            overflow: "hidden",
            backgroundImage: `url(https://noihnuouftyvsvzybwer.supabase.co/storage/v1/object/public/images/heroes/olfteam.jpg)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,.75) 0%, transparent 40%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "32px 24px 0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--display)",
                fontSize: "clamp(28px, 3.5vw, 40px)",
                color: "var(--cream)",
                lineHeight: 1.0,
                textShadow: "0 2px 12px rgba(0,0,0,.8)",
              }}
            >
              Wij zijn
              <br />
              <span style={{ color: "var(--orange-bright)" }}>
                Chiro Crescendo
              </span>
              <br />
              <span style={{ color: "var(--orange-bright)" }}>
                × De Kluster.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
