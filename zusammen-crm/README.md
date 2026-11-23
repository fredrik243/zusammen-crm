# Zusammen CRM

Et let CRM-system for Zusammen med kontaktbank, pipeline, opgaver og statistik. Det er bygget til to brugere, og alle data ligger i EU.

**Status:** Fase 1–3 er færdige. De indeholder login, import, kontaktbank, pipeline med drag-and-drop, aktiviteter og opgaver.

Guiden er skrevet til en, der ikke er udvikler. Første gang tager den cirka 30–45 minutter. Den bagefter er der intet at vedligeholde.

---

## Sådan hænger det sammen

| Del | Hvad gør den | Hvor |
|---|---|---|
| **Supabase** | Database og login. Her ligger alle kontaktdata | Frankfurt (EU) |
| **Vercel** | Kører selve hjemmesiden | Serverne er sat til Frankfurt (`vercel.json`) |
| **GitHub** | Gemmer koden. Vercel henter den herfra | Privat repository |

Hemmelige nøgler ligger aldrig i koden. De indtastes ét sted, nemlig i Vercel under *Environment Variables*. CSV-filer bliver heller aldrig gemt i koden.

---

## 1. Opret de tre konti

Hvis du er i tvivl om, hvorvidt du har en konto, kan du prøve at logge ind med din arbejdsmail på hver side. Hvis "Glemt adgangskode" ikke kender mailen, har du ikke en konto.

1. **GitHub** – <https://github.com/signup>. Gratis.
2. **Supabase** – <https://supabase.com/dashboard>. Vælg *Continue with GitHub*, så har du én login mindre. Gratis-planen er nok til jer.
3. **Vercel** – <https://vercel.com/signup>. Vælg også *Continue with GitHub*.

> **Om priser:** Vercels gratis plan (*Hobby*) er efter Vercels egne vilkår kun til ikke-kommerciel brug. Et internt CRM for et bureau er kommerciel brug, så regn med Vercel *Pro* (cirka 20 USD om måneden). Supabases gratis plan sætter projektet på pause efter en uge uden brug. Det vækkes igen med ét klik i Supabase. Hvis det bliver irriterende, koster *Pro* cirka 25 USD om måneden. Tjek de aktuelle priser på deres sider.

---

## 2. Opsæt Supabase (database og login)

1. Klik **New project** i Supabase.
   - **Name:** `zusammen-crm`
   - **Database password:** Klik *Generate* og gem kodeordet i jeres password-manager.
   - **Region:** **Central EU (Frankfurt)**. Det er vigtigt, fordi det holder persondata i EU.
2. Vent et par minutter, til projektet er klar.
3. Åbn **SQL Editor** i venstremenuen og klik **New query**.
   Åbn filen `supabase/01_fase1.sql` her i mappen, kopiér *alt* indhold, indsæt det og klik **Run**. Der skal stå *Success*.
4. Luk for selvoprettelse: Gå til **Authentication → Sign In / Providers**, og slå **Allow new users to sign up** fra.
5. Invitér jer selv: Gå til **Authentication → Users → Add user → Send invitation**, og gør det for både Fredrik og Thomas.
6. Find nøglerne: Gå til **Project Settings → API Keys**, og notér
   - **Project URL** (fx `https://abcd1234.supabase.co`). Den står også under *Data API*.
   - **Publishable key**, som starter med `sb_publishable_`. Hvis der kun står *anon key*, så brug den.

   Del aldrig nøglen, der hedder *secret* eller *service_role*. Appen bruger den ikke.

---

## 3. Læg koden på GitHub

Det letteste er programmet **GitHub Desktop** (<https://desktop.github.com>).

1. Log ind med din GitHub-konto.
2. Vælg **File → Add local repository** og vælg mappen `zusammen-crm`.
3. Hvis den spørger, om du vil oprette et repository, så sig ja.
4. Hvis venstre side viser en liste over ændrede filer, så skriv `Fase 1` i feltet *Summary* nederst til venstre og klik **Commit to main**.
5. Klik **Publish repository**, og sørg for, at **Keep this code private** er slået til.

---

## 4. Sæt hjemmesiden i luften på Vercel

1. Klik **Add New → Project** i Vercel, og vælg `zusammen-crm` fra GitHub.
2. Fold **Environment Variables** ud og tilføj de to værdier fra trin 2.6:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |

3. Klik **Deploy**. Efter et par minutter får I en adresse som `https://zusammen-crm.vercel.app`.
4. **Tilbage i Supabase:** Gå til **Authentication → URL Configuration**.
   - **Site URL:** jeres Vercel-adresse.
   - **Redirect URLs:** Tilføj `https://<jeres-adresse>/auth/callback`.

   Hvis I senere også kører appen på din egen computer, så tilføj også `http://localhost:3000/auth/callback`.

Fremover opdateres siden automatisk, hver gang ny kode lægges på GitHub.

---

## 5. Første login og import

1. Åbn jeres Vercel-adresse. Skriv din e-mail og klik **Send login-link**.
2. Åbn linket i mailen **på samme enhed og i samme browser**.
3. Første gang spørger appen **"Hvem er du?"**. Klik på dit navn. Det sker kun én gang.
4. Gå til **Import**, og vælg `bruttoliste.csv`. Du ser nu, hvordan hver række bliver fortolket. Fanen **Kræver opmærksomhed** viser de rækker, der bør tjekkes. Ret det, der skal rettes, og klik **Importér**.
   Importen gemmer enten alt eller intet. Hvis den køres igen, springer den virksomheder over, der allerede findes.

---

## Når der kommer en ny fase

Hver fase består af to dele:

1. **En ny SQL-fil** i mappen `supabase/` (fx `02_fase2.sql`). Åbn den, kopiér alt indhold ind i **Supabase → SQL Editor → New query** og klik **Run**. Vælg *Run and enable RLS*, hvis Supabase spørger.
2. **Ny kode.** Gå til jeres repository på github.com, og åbn **undermappen `zusammen-crm`**. Det er den, Vercel bygger fra, og øverst skal der stå `zusammen-crm / zusammen-crm`. Vælg derefter **Add file → Upload files**. Træk mapperne `src` og `supabase` samt filerne `README.md`, `package.json` og `package-lock.json` ind, og klik **Commit changes**. Vercel opdaterer siden selv efter et par minutter.

Kør SQL-filen først, så den nye kode har det, den skal bruge, når den går i luften.

---

## Miljøvariabler

| Navn | Hvad | Hvor findes den |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adressen på jeres Supabase-projekt | Supabase → Project Settings → API Keys / Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Offentlig nøgle. Den giver kun adgang til data, når man er logget ind | Supabase → Project Settings → API Keys |

Nøglen må gerne være synlig i browseren. Det er databasens adgangsregler, der beskytter data: Kun indloggede brugere kan læse og skrive, og kun inviterede kan logge ind.

---

## Hvis noget driller

- **"Linket virkede ikke":** Linket er brugt, er udløbet (efter 1 time) eller blev åbnet i en anden browser. Bed om et nyt.
- **Ingen mail:** Supabases indbyggede mailafsender sender kun få mails i timen. Vent lidt og tjek spam. Hvis det bliver et problem, kan I koble jeres egen mailserver på under *Authentication → Emails → SMTP Settings*.
- **"Den e-mail har ikke adgang":** Personen er ikke inviteret i Supabase (trin 2.5).
- **"Der er sendt for mange login-mails":** Supabases indbyggede mailafsender sender kun få mails i timen (invitationer tæller med). Vent en time, eller kobl jeres egen mailafsender på under *Authentication → Emails → SMTP Settings*.
- **"Appen kan ikke læse teamet":** Kør `supabase/01_fase1.sql` igen i SQL Editor. Det er ufarligt og retter manglende tabeller og adgang.
- **"Begge navne er allerede koblet til et andet login":** Kør `update public.team_members set user_id = null, email = null;` i SQL Editor, og lad hver især vælge sit navn igen.
- **Supabase siger "paused":** Åbn projektet i Supabase og klik **Restore**.

---

## For udviklere

```bash
npm install
cp .env.example .env.local   # udfyld værdierne
npm run dev                  # http://localhost:3000
npm run preview:import -- sti/til/bruttoliste.csv   # vis fortolkning i terminalen
```

- Next.js 16 (App Router), TypeScript, Tailwind 4, Supabase (`@supabase/ssr`).
- Databaseændringer ligger som nummererede filer i `supabase/` og køres i rækkefølge i SQL Editor.
- Importlogikken ligger i `src/lib/import/parse.ts`. Beslutninger om datoer, kategorier og "Kontakt ikke igen" står øverst i filen.

## Faseplan

1. ✅ Datamodel, login, import og kontaktbank
2. ✅ Pipeline med drag-and-drop
3. ✅ Aktiviteter og opgaver
4. Produkter, omsætning og statistik
5. Budget
