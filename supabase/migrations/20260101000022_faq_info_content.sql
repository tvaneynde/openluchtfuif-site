CREATE TABLE faq_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE info_cards (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label      TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO faq_items (question, answer, sort_order) VALUES
  ('Moet ik mijn ticket afprinten?',
   'Nee, een digitaal ticket op je smartphone volstaat. Zorg dat je scherm voldoende oplicht zodat de scanner hem kan lezen.',
   1),
  ('Is er eten en drinken?',
   'Ja! Er zijn verschillende foodstands aanwezig met warme en koude hapjes. Drinken werkt cashless via muntjes die je aan de ingang of op voorhand koopt. Ongebruikte muntjes zijn terugbetaalbaar.',
   2),
  ('Wat als het regent?',
   'De Openluchtfuif gaat door, regen of niet. Neem een regenjas mee voor de zekerheid — het podium en de bars staan paraat, wat het weer ook doet.',
   3),
  ('Hoe geraak ik er?',
   'Je kan er per fiets (bewaakte fietsstalling aanwezig), met de auto (parkeren op aangeduide plaatsen in de buurt) of met De Lijn. Check de De Lijn-app voor de juiste lijn en halte in de buurt van Pellenberg.',
   4),
  ('Is er een minimumleeftijd?',
   'De Openluchtfuif is toegankelijk voor iedereen. -16 jarigen mogen geen alcohol kopen of consumeren. Neem zeker je ID mee — onze medewerkers kunnen ernaar vragen.',
   5),
  ('Ik wil helpen. Kan dat?',
   'Zeker! We zijn altijd op zoek naar enthousiaste vrijwilligers. Stuur een mailtje naar openluchtfuif3212@gmail.com en we nemen zo snel mogelijk contact met je op.',
   6);

INSERT INTO info_cards (label, title, body, sort_order) VALUES
  ('◉ Locatie',
   'Kleine Ganzendries',
   'Het veld achter de kerk, midden in het dorp van Pellenberg. Makkelijk te vinden, ideaal gelegen — en met de mooiste openluchtsfeer van de regio.',
   1),
  ('◉ Vervoer',
   'Kom veilig thuis',
   'Bewaakte fietsstalling aanwezig op het terrein. Parkeren kan op aangeduide plaatsen in de buurt. Je kan ook met De Lijn — check de De Lijn-app voor de beste route vanuit jouw gemeente.',
   2),
  ('◉ Betaalsysteem',
   'Cashless muntjes',
   'Betalen gaat via een cashless muntjessysteem. Koop je munten aan de ingang of op voorhand online. Heb je aan het einde nog over? Die krijg je gewoon terug.',
   3),
  ('◉ Duurzaamheid',
   'Geen afval, geen gezever',
   'Geen glas, geen wegwerpplastic. Alles is herbruikbaar. We doen ons best om de voetafdruk zo klein mogelijk te houden — help je mee?',
   4),
  ('◉ Veiligheid',
   'Veilige sfeer',
   'Er is een veiligheidsteam aanwezig de hele avond. Voel je je niet goed of zie je iets verdachts? Spreek gerust een medewerker aan — we zijn er voor iedereen.',
   5),
  ('◉ EHBO',
   'Rode Kruis aanwezig',
   'Het Rode Kruis staat de hele avond paraat op het terrein. De EHBO-post vind je rechts van het podium. Bij medische nood: ga er direct naartoe of spreek een medewerker aan.',
   6);

ALTER TABLE faq_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE info_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read faq_items"  ON faq_items  FOR SELECT USING (TRUE);
CREATE POLICY "Public read info_cards" ON info_cards FOR SELECT USING (TRUE);
CREATE POLICY "Auth manage faq_items"  ON faq_items  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth manage info_cards" ON info_cards FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON faq_items, info_cards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON faq_items, info_cards TO authenticated;
