# Openluchtfuif 2026 — Ticketing Runbook

**Event:** Zaterdag 29 augustus 2026, Kleine Ganzendries, Pellenberg
**Last updated:** 2026-05-31

---

## 1. Contacts & Access

| System | URL | Login |
|---|---|---|
| **Dashboard** | https://openluchtfuif3212.be/#/dashboard | tomas@vaneynde.eu |
| **Scanner** | https://openluchtfuif3212.be/#/scanner | PIN (zie dashboard → Scanner tab) |
| **Supabase** | https://supabase.com/dashboard/project/noihnuouftyvsvzybwer | Supabase account |
| **Mollie** | https://www.mollie.com/dashboard | Mollie account |
| **Resend** | https://resend.com/dashboard | Resend account |

**Contact bij technische problemen:** openluchtfuif3212@gmail.com

---

## 2. Hoe een vastgelopen bestelling manueel bevestigen

Gebruik dit als een klant betaald heeft maar de status nog op `awaiting_payment` staat.

**Stap 1 — Controleer het order in het dashboard**
- Ga naar Dashboard → Bestellingen
- Zoek het order op naam of e-mailadres
- Noteer het **Order ID** (bijv. `a1b2c3d4-...`)

**Stap 2 — Controleer de betaling in Mollie**
- Ga naar https://www.mollie.com/dashboard → Betalingen
- Zoek het bedrag + tijdstip op
- Noteer het **Mollie payment ID** (begint met `tr_`, bijv. `tr_ABC123`)
- Verifieer dat de status **"Betaald"** is — doe dit ALTIJD voor je iets manueel uitvoert

**Stap 3 — Trigger de webhook manueel**

Open Terminal en voer uit (vervang `tr_YOURPAYMENTID`):

```bash
curl -X POST https://noihnuouftyvsvzybwer.supabase.co/functions/v1/mollie-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "id=tr_YOURPAYMENTID"
```

Verwacht resultaat: `ok`

**Stap 4 — Verifieer**
- Herlaad Dashboard → Bestellingen
- Status moet nu `paid` zijn
- De klant ontvangt automatisch zijn/haar ticket per e-mail

**Stap 5 — Noodoplossing (webhook werkt niet)**

Gebruik dit ENKEL als laatste redmiddel, na verificatie in Mollie:

```sql
-- Supabase SQL Editor: https://supabase.com/dashboard/project/noihnuouftyvsvzybwer/sql
-- Vervang ORDER-ID-HERE door het echte order ID
SELECT confirm_payment('ORDER-ID-HERE');
```

Ga naar Supabase → SQL Editor → plak de query → Run.

---

## 3. Hoe een ticket-e-mail opnieuw versturen

**Via het dashboard (makkelijkste):**
1. Dashboard → Bestellingen
2. Klik op het order om het uit te klappen
3. Klik op **"Verstuur opnieuw"**

**Via curl (als dashboard niet bereikbaar is):**

Vervang `ORDER-ID-HERE` en `SUPABASE_SERVICE_ROLE_KEY`:

```bash
curl -X POST https://noihnuouftyvsvzybwer.supabase.co/functions/v1/process-email-queue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"order_id": "ORDER-ID-HERE", "force": true}'
```

De `force: true` zorgt dat een al verzonden e-mail opnieuw gestuurd wordt (omzeilt de 24u-cache van Resend).

**Ticket-PDF opnieuw downloaden (als backup):**

```
https://noihnuouftyvsvzybwer.supabase.co/functions/v1/download-ticket?order_id=ORDER-ID-HERE
```

Stuur deze link door aan de klant zodat hij/zij de PDF zelf kan downloaden.

---

## 4. Hoe de scanner-pincode resetten

1. Ga naar Dashboard → **Scanner** tab
2. Vul een nieuwe 4-cijferige PIN in
3. Klik **Opslaan**
4. Alle scanner-sessies worden automatisch ongeldig (PIN-cache vervalt na max. 5 minuten)
5. Briefer alle vrijwilligers met scanners: zij moeten de nieuwe PIN invullen

> De scanner-app zit op https://openluchtfuif3212.be/#/scanner — geen installatie nodig, werkt als PWA in de browser.

---

## 5. Hoe een tickettier toevoegen, deactiveren of aanpassen

**Dashboard → Tickets tab**

| Actie | Wat te doen |
|---|---|
| Tier activeren/deactiveren | Toggle-switch aan/uit |
| Uitverkocht markeren | Zet `total_capacity` gelijk aan huidige `sold_count` |
| Prijs wijzigen | Pas de prijs aan — geldt enkel voor **nieuwe** bestellingen, bestaande orders zijn niet gewijzigd |
| Nieuwe tier aanmaken | "Nieuw tier" knop → vul naam, prijs en capaciteit in |

> Let op: deactiveer een tier meteen als het event vol is, zodat er geen nieuwe bestellingen meer binnenkomen.

---

## 5b. Gratis tickets voor sponsors en de partnerruil

**Dashboard → Gratis tickets**

Dit zijn echte tickets met een werkende QR, maar ze worden geboekt op de
onzichtbare tier "Gratis ticket". Daardoor bewegen de omzet, de verkoopcijfers en
de publieke beschikbaarheid niet mee. Ze tellen wél mee in **Verwachte opkomst**
op het hoofddashboard, want het zijn echte mensen op het terrein.

**Er is geen limiet** op hoeveel je weggeeft. Het onderscheid tussen sponsor,
partnerruil en crew zit in de **reden** per uitgifte, niet in een quotum.

**Tickets uitgeven** — knop **+ Tickets uitgeven** opent een pop-up:
1. Naam + e-mail van de ontvanger
2. **Aantal** — dit is de bulk-knop: 5 tickets voor één sponsor is één uitgifte
   met aantal 5, in één e-mail. Snelkeuze 1 / 2 / 5 / 10, of typ een aantal.
3. Reden (Sponsor / Partnerruil / Crew / Andere); de notitie is voor jezelf
   (bv. "ruildeal 2026")
4. Vink "Stuur de tickets meteen per e-mail" aan als de ontvanger ze zelf moet
   krijgen. Laat het uit als je de PDF liever zelf doorstuurt — download hem dan
   met de **PDF**-knop in de lijst.
5. Dubbelklikken is veilig: dezelfde aanvraag wordt niet twee keer uitgegeven.

Het dashboard triggert de e-mailworker meteen zelf en meldt of het gelukt is. Bij
een verkoop doet `mollie-webhook` dat; gratis tickets hebben geen webhook, dus
zonder die trigger bleef de mail hangen. Als de melding zegt dat de e-mail niet
verstuurd kon worden: gebruik de **Mail**-knop op die regel.

> De pg_cron-vangnet (`process-email-queue`, elke minuut) leest de service role
> key uit Supabase Vault. Als die niet met `vault.create_secret('…',
> 'service_role_key')` op productie gezet is, faalt het vangnet stil — controleer
> `cron.job_run_details` als e-mails blijven hangen.

Meer dan 500 in één keer wordt geweigerd. Dat is geen beleidsgrens maar een
typfout-beveiliging — geef in dat geval twee keer uit.

**Tickets intrekken** — knop **Intrekken** in de lijst. De tickets worden
ongeldig en de teller gaat omlaag. Lukt niet meer zodra iemand met dat ticket
door de poort is (`already_scanned`) — dan zou de opkomsttelling fout gaan.

**Terreincapaciteit** — `venue_capacity` is puur informatief (het getal achter
"Verwachte opkomst"); het blokkeert niets. Aanpassen:

```sql
UPDATE config SET value = '500'::jsonb WHERE key = 'venue_capacity';
```

> Gratis tickets kunnen **niet** via promocodes of de checkout ontstaan. De
> `issue_comp_tickets`-RPC is de enige weg, en die vereist een admin-login.

---

## 6. Wat te doen bij overboeking (oversell)

Dit mag niet voorkomen dankzij de atomische DB-lock, maar bij twijfel:

**Stap 1 — Stop nieuwe verkoop onmiddellijk**
- Dashboard → Tickets → zet `is_active = false` op het betreffende tier

**Stap 2 — Controleer op dubbele scans**

```sql
-- Supabase SQL Editor
SELECT ticket_number, COUNT(*) as keer_gescand
FROM scan_events
WHERE result = 'valid'
GROUP BY ticket_number
HAVING COUNT(*) > 1;
```

**Stap 3 — Contacteer getroffen kopers**

```sql
-- Haal e-mailadressen op van kopers van een specifiek tier
SELECT o.buyer_name, o.buyer_email, o.id as order_id
FROM orders o
JOIN tickets t ON t.order_id = o.id
WHERE t.tier_id = 'TIER-ID-HERE'
  AND o.status = 'paid';
```

Stuur een persoonlijke e-mail via openluchtfuif3212@gmail.com.

---

## 7. Dag-van-het-event checklist

Voer dit uit voor de deuren opengaan:

- [ ] Scanner-PIN is ingesteld (Dashboard → Scanner tab)
- [ ] Test een scan met een gekend geldig ticket
- [ ] Alle scanners kunnen de PWA openen: https://openluchtfuif3212.be/#/scanner
- [ ] Op iPhones/iPads: open in **Safari**, klik "Voeg toe aan beginscherm" voor offline PWA
- [ ] Dashboard toont het correcte aantal verkochte tickets
- [ ] Verifieer dat Mollie in **live modus** staat (niet testmodus)
- [ ] Controleer Supabase edge function logs op recente fouten
- [ ] Zorg voor een opgeladen reservetelefoon voor scannen
- [ ] Wifi of 4G beschikbaar op de ingang (scanner heeft internet nodig)

---

## 8. Monitoring

### Edge Function logs
https://supabase.com/dashboard/project/noihnuouftyvsvzybwer/logs/edge-functions

Filteren per functie:
- `mollie-webhook` — betalingen binnenkomen
- `process-email-queue` — e-mailverzending
- `scan` — scanactiviteit
- `create-payment` — nieuwe bestellingen

### E-mailstatus
Dashboard → **E-mails** tab

Statussen:
- `sent` — succesvol verstuurd
- `pending` — in wachtrij (wordt automatisch opnieuw geprobeerd, max. 5 pogingen)
- `failed` — 5 pogingen mislukt → manueel opnieuw versturen (zie sectie 3)

### Scanactiviteit
Dashboard → **Scanner** tab → statistieken van vandaag

### Databasetabel: directe queries
```sql
-- Overzicht verkochte tickets per tier
SELECT tt.name, COUNT(*) as verkocht, tt.total_capacity
FROM tickets t
JOIN ticket_tiers tt ON t.tier_id = tt.id
WHERE t.status = 'valid'
GROUP BY tt.name, tt.total_capacity;

-- Recente bestellingen (laatste uur)
SELECT id, buyer_name, buyer_email, status, created_at
FROM orders
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## 9. Noodcontacten & escalatie

| Probleem | Actie |
|---|---|
| Betalingen komen niet binnen | Controleer Mollie dashboard → Betalingen. Controleer edge function logs op `mollie-webhook`. |
| E-mails worden niet verstuurd | Controleer Resend dashboard → Logs. Controleer `process-email-queue` logs in Supabase. |
| Scanner werkt niet | Controleer of PIN correct is. Controleer `scan` logs in Supabase. Controleer internetverbinding op de ingang. |
| Supabase onbereikbaar | https://status.supabase.com — controleer op storingen |
| Mollie onbereikbaar | https://status.mollie.com — Mollie support: +31 20 820 20 70 |
| Resend onbereikbaar | https://status.resend.com |

---

## 10. Systeemoverzicht (referentie)

```
Klant → checkout pagina
  → create-payment (Edge Function)
    → Mollie betaalpagina
      → Mollie webhook (na betaling)
        → mollie-webhook (Edge Function)
          → confirm_payment() [DB RPC, atomisch]
            → process-email-queue (Edge Function)
              → Resend API → e-mail met QR-codes + PDF

Dag van event:
Scanner-app → scan (Edge Function)
  → validate_scan() [DB RPC] → geldig / ongeldig / al gebruikt
```

**Supabase project ID:** `noihnuouftyvsvzybwer`
**Webhook URL (Mollie instelling):** `https://noihnuouftyvsvzybwer.supabase.co/functions/v1/mollie-webhook`
**Frontend:** https://openluchtfuif3212.be/
