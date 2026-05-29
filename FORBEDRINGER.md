# KOordinate – forbedringsliste (etter kodegjennomgang)

Disse oppgavene er identifisert i en ekstern kodegjennomgang (mai 2026).
Gjennomfør én oppgave om gangen i henhold til `kun-en-endring`-regelen.
Hver oppgave angir berørte filer og hva som skal gjøres.

---

## Oppgave 1 — KRITISK sikkerhetsfix: blokker rolle-eskalering i Supabase (RLS)

**Problem:**
`profiles_update_own`-policyen i `supabase/migrations/001_profiles.sql` tillater at en innlogget
bruker kjører `UPDATE profiles SET role = 'admin' WHERE id = auth.uid()` — ingen kolonne-begrensning finnes.

**Berørte filer:**
- `supabase/migrations/001_profiles.sql` (referanse)
- Ny fil: `supabase/migrations/004_fix_role_escalation.sql`

**Hva som skal gjøres:**
Opprett `supabase/migrations/004_fix_role_escalation.sql` med denne SQL-en:

```sql
-- Blokkér at en bruker kan endre sin egen rolle via profiles_update_own.
-- Kun admin kan oppdatere rolle (gjøres direkte i Supabase-dashbord eller via service role).

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    AND role = (select role from public.profiles where id = auth.uid())
  );
```

Instruer deretter brukeren om å kjøre filen i Supabase SQL Editor.

**Definisjon av ferdig:**
- Ny migrasjonsfil finnes i `supabase/migrations/`.
- Kommentar i filen forklarer hva den fikser og hvorfor.
- Brukeren har kjørt SQL i Supabase SQL Editor.

---

## Oppgave 2 — Flytt syklusuke-beregning til lib/ (duplication fix)

**Problem:**
`syklusUkeFraDato()` er hardkodet inne i `app/plan/page.tsx` med en magisk dato-konstant
(`new Date(2026, 4, 11)`). Den samme logikken finnes delvis i `lib/imported/ringnesCycle.ts`.
Én implementasjon bør ligge i `lib/` og brukes begge steder.

**Berørte filer:**
- `lib/imported/ringnesCycle.ts` — legg til eksportert funksjon her
- `app/plan/page.tsx` — fjern lokal `syklusUkeFraDato`, importer fra lib

**Hva som skal gjøres:**

1. Legg til i `lib/imported/ringnesCycle.ts`:

```ts
/** Anker: 2026-05-11 (mandag) = start av syklus-uke 1. */
const SYKLUS_ANKER = new Date(2026, 4, 11);

export function syklusUkeFraDato(d: Date): 1 | 2 | 3 | 4 {
  const diff = Math.floor(
    (d.getTime() - SYKLUS_ANKER.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const mod = ((diff % 4) + 4) % 4;
  return (mod + 1) as 1 | 2 | 3 | 4;
}
```

2. I `app/plan/page.tsx`:
   - Fjern den lokale `syklusUkeFraDato`-funksjonen og den lokale `anker`-konstanten.
   - Legg til import: `import { syklusUkeFraDato, ukedag1til7FraDato } from "@/lib/imported/ringnesCycle";`

**Definisjon av ferdig:**
- `syklusUkeFraDato` finnes bare ett sted i kodebasen.
- `app/plan/page.tsx` importerer den fra `lib/`.
- Siden kompilerer og planlogikken fungerer som før.

---

## Oppgave 3 — Erstatt window.confirm() med React-bekreftelsesdialog

**Problem:**
`window.confirm()` brukes for viktige bekreftelseshandlinger (opphev kobling, fjern rute).
Dette er blokkerbart av nettlesere, fungerer dårlig på mobil og kan ikke styles.

**Berørte filer:**
- Ny komponent: `components/BekreftDialog.tsx` + `components/BekreftDialog.module.css`
- `app/plan/page.tsx` — bytt ut alle `window.confirm()`-kall
- `app/ansatte/page.tsx` — sjekk for eventuelle `window.confirm()`-kall der også

**Hva som skal gjøres:**

Opprett `components/BekreftDialog.tsx`:

```tsx
"use client";
import { useEffect, useRef } from "react";
import styles from "./BekreftDialog.module.css";

type Props = {
  melding: string;
  bekreftTekst?: string;
  avbrytTekst?: string;
  onBekreft: () => void;
  onAvbryt: () => void;
};

export default function BekreftDialog({
  melding,
  bekreftTekst = "OK",
  avbrytTekst = "Avbryt",
  onBekreft,
  onAvbryt,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onAvbryt}>
      <p className={styles.melding}>{melding}</p>
      <div className={styles.knapper}>
        <button type="button" onClick={onAvbryt} className={styles.avbryt}>
          {avbrytTekst}
        </button>
        <button type="button" onClick={onBekreft} className={styles.bekreft}>
          {bekreftTekst}
        </button>
      </div>
    </dialog>
  );
}
```

Bruksmønster i `plan/page.tsx` (samme mønster overalt):

```tsx
// Erstatt:
const ok = window.confirm("Oppheve kobling ...");
if (!ok) return;
// ... handling

// Med:
const [bekreftState, setBekreftState] = useState<{
  melding: string;
  onBekreft: () => void;
} | null>(null);

// Vis dialogen:
setBekreftState({
  melding: `Oppheve kobling mellom ${liste} for ${dato} (${skift})?`,
  onBekreft: () => {
    lagreDagEndring({ ... });
    setBekreftState(null);
  },
});

// I render:
{bekreftState && (
  <BekreftDialog
    melding={bekreftState.melding}
    onBekreft={bekreftState.onBekreft}
    onAvbryt={() => setBekreftState(null)}
  />
)}
```

**Definisjon av ferdig:**
- `window.confirm()` er fjernet fra alle sider.
- `BekreftDialog` brukes konsekvent for alle destruktive bekreftelser.
- CSS-modulen matcher mørk/lys-tema via CSS-variabler (ikke hardkodede farger).

---

## Oppgave 4 — Rydd opp dupliserte server actions i skyData.ts

**Problem:**
`app/actions/skyData.ts` har to par med duplikate funksjoner:
- `loadAppDataFromSkyAction` og `fetchAppDataRowAction` gjør det samme.
- `saveAppDataToSkyAction` og `upsertAppDataRowAction` gjør det samme.

**Berørte filer:**
- `app/actions/skyData.ts`
- `lib/data/appDataStorage.ts` — eneste forbruker, sjekk hvilke funksjoner som faktisk brukes

**Hva som skal gjøres:**

1. Finn ut hvilke varianter `appDataStorage.ts` importerer og bruker.
2. Behold disse. Marker de ubrukte med en `// @deprecated`-kommentar øverst i funksjonen
   og legg inn en `console.warn`-linje som beskriver hvilken funksjon som skal brukes i stedet.
3. **Ikke slett** dem ennå (kan brukes fra andre steder som ikke er synlige) — rydding tas i en dedikert PR.

**Definisjon av ferdig:**
- Dupliserte funksjoner er tydelig merket med `@deprecated`-kommentar og `console.warn`.
- Ingen funksjonalitet er endret.

---

## Oppgave 5 — Splitt plan/page.tsx: trekk ut ressursberegning til egen hook

**Problem:**
`app/plan/page.tsx` er 1607 linjer. Kjernefunksjoner som `effektivRessursForSlot`,
`kobleteMedRute`, `blokkerteAvFlerdagsruter` og sammendrag-kalkulasjon er blandet inn
i render-koden. Dette gjør filen vanskelig å lese og umulig å teste.

**Merk:** Dette er den største endringen og bør deles i to steg.

### Steg 5a — Trekk ut til `usePlanLogikk`-hook

**Berørte filer:**
- Ny fil: `app/plan/usePlanLogikk.ts`
- `app/plan/page.tsx`

**Hva som skal gjøres:**

Opprett `app/plan/usePlanLogikk.ts` som tar inn nødvendige parametre og returnerer:

```ts
export function usePlanLogikk(params: {
  dato: string;
  skift: Skift;
  uke: 1 | 2 | 3 | 4;
  dayNo: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}) {
  // Flytt hit (som useMemo-blokker):
  // - koblingsgruppeFraRute
  // - ruterIKoblingsgruppe
  // - masterSlotsForDag
  // - dagEndringerForDag
  // - opphevedeKoblinger
  // - effektiveRuter
  // - tildelingMap
  // - bilPosterPåDato / hengerPosterPåDato
  // - blokkerteAvFlerdagsruter
  // - planlagteKjøretøy
  // - tilgjengeligeAnsatte
  // - sammendrag

  // Flytt hit (som vanlige funksjoner):
  // - erKoblingOpphevetForDag
  // - finnKoblingForRute
  // - kobleteMedRute
  // - effektivRessursForSlot
  // - masterplanBilIdForSlot
  // - masterplanHengerIdForSlot
  // - bilValgbareForRute
  // - hengerValgbareForRute

  return { effektiveRuter, tilgjengeligeAnsatte, sammendrag, ... };
}
```

`page.tsx` kaller bare `usePlanLogikk(...)` og bruker det returnerte objektet.

### Steg 5b — Trekk ut ruteradkomponent

Etter steg 5a: Trekk ruterad-JSX-blokken ut i `app/plan/PlanRuteRad.tsx`.
Det er én gjenbrukbar komponent per rad i rutetabellen.

**Definisjon av ferdig (steg 5a):**
- `usePlanLogikk.ts` eksisterer og eksporterer all beregningslogikk.
- `plan/page.tsx` er under 700 linjer.
- Ingen funksjonalitet er endret — plan-siden fungerer identisk.
- De to `eslint-disable react-hooks/exhaustive-deps`-linjene er fjernet (avhengighetsarrayene er korrekte etter refaktor).

---

## Oppgave 6 — Fjern legacy-filer og død kode

**Problem:**
Dokumentert teknisk gjeld (fra `FOUNDATION_AND_ROADMAP.md` seksjon 7):

| Hva | Fil/sted |
|-----|----------|
| `dagsplanStore` brukes ikke av aktive sider | `lib/state/dagsplanStore` (hvis den finnes) |
| `turnusMalStore` lite brukt etter turnus ble integrert | `lib/state/turnusMalStore` (hvis den finnes) |
| `/turnus`-siden er ikke i navigasjonen | `app/turnus/` |
| Mock-data importeres fortsatt som fallback | grep etter `MOCK_RUTER`, `MOCK_ANSATTE` |

**Hva som skal gjøres:**

1. Søk etter alle steder filene importeres: `grep -r "dagsplanStore\|turnusMalStore\|MOCK_RUTER\|MOCK_ANSATTE" app/ lib/ components/`
2. Fjern kun filer og imports der **ingen aktiv side** bruker dem.
3. `/app/turnus/page.tsx` kan beholdes men merk øverst i filen: `// Legacy — ikke i navigasjon. Se ansatte-modulen.`

**Definisjon av ferdig:**
- Ingen aktive importer til de fjernede filene.
- TypeScript kompilerer uten feil.
- `FOUNDATION_AND_ROADMAP.md` seksjon 7 oppdatert: fjernede punkter merkes ✅.

---

## Rekkefølge og råd til Cursor

Utfør oppgavene i denne rekkefølgen:

1. **Oppgave 1 (sikkerhet)** — kan gjøres umiddelbart, kun SQL.
2. **Oppgave 2 (duplikat lib)** — liten, trygg endring.
3. **Oppgave 3 (confirm → dialog)** — selvstendig komponent, påvirker ikke lagring.
4. **Oppgave 4 (deprecated actions)** — kun kommentarer, ingen logikkendring.
5. **Oppgave 5a (plan hook)** — størst risiko, test grundig etter.
6. **Oppgave 5b (ruteradkomponent)** — kun etter 5a er bekreftet stabil.
7. **Oppgave 6 (rydding)** — sist, når alt annet er stabilt.

For oppgave 5: Ikke refaktorér og legg til ny funksjonalitet i samme commit.
For oppgave 1: Etter SQL er kjørt — test at en `visning`-bruker ikke kan endre sin egen rolle via Supabase SQL Editor (`UPDATE profiles SET role = 'admin' WHERE id = auth.uid()`).
