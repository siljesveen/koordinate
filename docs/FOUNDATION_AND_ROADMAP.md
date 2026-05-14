# Fundament og veikart — Bemanning-dashboard

Sist oppdatert: 13. mai 2026

---

## 1. Produktmandat

**Formål:** Gi operativ oversikt og enkel disponering av sjåfører og kjøretøy mot kjent ruteplan — med registrerte ansatte som sannhet for «hvem er hvem» og hvem som faktisk er tilgjengelig på en dag.

**Målgruppe (v1):** Internt bemanningsteam som bruker lokale registre (Excel-import som utgangspunkt, localStorage som database).

**Ikke mål:** Erstatning for lønn/HR-master, eller full TMS.

---

## 2. Moduler — nåværende status

| Modul | Side | Status | Beskrivelse |
|-------|------|--------|-------------|
| **Dagsoversikt** | `/` | Ferdig | Sammendragskort for dagens drift: ruter OK, mangler ressurs, utilgjengelige, ledige sjåfører, fravær. Henter data fra Plan/Master/Fravær-storene. |
| **Plan** | `/plan` | Ferdig | Daglig disponering for én dato × ett skift. DnD av sjåfører, bil/henger-dropdowns, duplikatkontroll, fravær-registrering fra plan, statusfarger (grønn/rød/gul/blå). Dag-navigasjon (‹ ›). |
| **Masterplan** | `/masterplan` | Ferdig | Redigering av 4-ukers syklusmal. Legg til / slett / rediger alle felter. Koblingsgrupper (inkl. daglige mønster for BAMA-ruter). Start/slutt-tid, flerdagsruter. |
| **Ansatte** | `/ansatte` | Ferdig | Stamdata med selskap-filter (Asko/Bring/TF/GDF), aktiv/inaktiv, slett med bekreftelse, duplikatsjekk (navn + telefon). Turnus integrert i rediger-modal med visning i detalj. |
| **Biler** | `/biler` | Ferdig | Bilregister med aktiv-flagg. Sletting rydder referanser i tildelinger og ansatte. |
| **Hengere** | `/henger` | Ferdig | Hengerregister, samme logikk som biler. |
| **Utilgjengelighet** | `/kjoretoy-utilgjengelig`, `/biler/utilgjengelig`, `/henger/utilgjengelig` | Ferdig | Periodebasert utilgjengelighet for bil/henger. Datovalidering (fra ≤ til). |
| **Fravær** | `/fravaer` | Ferdig | Periodebasert fravær per ansatt. Datovalidering. |
| **Turnus** | `/turnus` | Legacy | Standalone side — funksjonaliteten er nå integrert i ansattmodulen. Siden finnes, men er ikke i navigasjonen. |

---

## 3. Arkitekturfundament

| Prinsipp | Konsekvens |
|----------|------------|
| **Klient først / localStorage** | Ingen server, ingen innlogging. Backup = eksport (planlagt). |
| **Ett domene = én lagringskontrakt** | Nye felter → versjonert nøkkel (`*.v2`) eller normaliseringsfunksjon. |
| **Master vs. dynamisk** | Master-ruteplanen er varig. Dag-tildelinger og dag-endringer gjelder kun én dato. Dynamisk plan skriver aldri tilbake til master. |
| **Arv med overstyring** | Tomme felt i dag-tildeling = arv fra master. Kun eksplisitt satte felt overstyrer. |

**Teknologi:** Next.js 16 App Router (Turbopack), React 19, TypeScript. State i `lib/state/*Store.tsx` (context providers). Typer i `lib/domain/types.ts`. Felles hjelpefunksjoner i `lib/domain/index.ts`.

---

## 4. Datamodell og lagring

### 4a. localStorage-nøkler

| Nøkkel | Store-fil | Innhold | Refererer |
|--------|-----------|---------|-----------|
| `bemanning.ansatte.v2` | `ansattStore` | Alle ansatte (stamdata) | — |
| `bemanning.masterplan.v1` | `masterplanStore` | 4-ukers syklus: slots + koblingsgrupper | `ansattId`, `bilId`, `hengerId` |
| `bemanning.planRuteTildeling.v2` | `planRuteTildelingStore` | Dag-tildelinger (overstyring per dato×skift×rute) | `ansattId`, `bilId`, `hengerId` |
| `bemanning.dagendring.v1` | `dagEndringStore` | Ruter lagt til/fjernet for én dato | — |
| `bemanning.fravaer.v1` | `fravaerStore` | Fravær per ansatt og periode | `ansattId` |
| `bemanning.biler.v1` | `bilStore` | Bilregister | — |
| `bemanning.henger.v1` | `hengerStore` | Hengerregister | — |
| `bemanning.bilUtilgjengelig.v1` | `bilUtilgjengeligStore` | Utilgjengelighetsperioder for biler | `bilId` |
| `bemanning.hengerUtilgjengelig.v1` | `hengerUtilgjengeligStore` | Utilgjengelighetsperioder for hengere | `hengerId` |
| `bemanning.turnus4uker.v1` | `turnus4ukerStore` | 4-ukers turnus per ansatt | `ansattId` |
| `bemanning.turnusmal.v1` | `turnusMalStore` | Turnusmaler (ukeoppskrifter) | — |
| `bemanning.dagsplan.v1` | `dagsplanStore` | Legacy dagsplan (ikke lenger i bruk av aktive sider) | `ansattId` |

### 4b. Datatyper (definert i `lib/domain/types.ts`)

| Type | Formål |
|------|--------|
| `Ansatt` | Stamdata: navn, telefon, selskap, aktiv-flagg, fast bil/henger |
| `Bil`, `Henger` | Kjøretøyregister med kjennemerke og aktiv-flagg |
| `BilUtilgjengelig`, `HengerUtilgjengelig` | Periodebasert utilgjengelighet |
| `Fravær` | Periodebasert fravær med type (Syk, Ferie, Fri, Permisjon, Annet) |
| `MasterRuteplan` | Syklusmal med `slots` og `koblingsgrupper` |
| `MasterRuteSlot` | Én rute i syklusen: uke, dag, skift, rutekode, standard-ressurser, start/slutt-tid, varighet |
| `Koblingsgruppe` | Ruter som deler ressurser, evt. begrenset til dag og/eller skift |
| `PlanRuteTildeling` | Daglig overstyring: sjåfør, bil, henger per rute×dato×skift |
| `DagEndring` | Ruter lagt til eller fjernet for én bestemt dato |
| `AnsattSelskap` | `"Asko" | "Bring" | "TF" | "GDF"` — kun Asko er fleksible ressurser |

### 4c. Beregningsflyt (per dato × skift)

```
1. Finn uke-i-syklus og ukedag fra valgt dato (anker: 11. mai 2026 = uke 1)

2. Hent master-slots for (uke, dag, skift)

3. Anvend dag-endringer for (dato, skift):
   - Fjern ruter merket "fjernet"
   - Legg til ruter merket "lagt_til"
   → Effektive ruter

4. For hver rute — beregn ressurser:
   a) Start med master-verdier (sjåfør, bil, henger)
   b) Sjekk fravær → master-sjåfør med fravær = "mangler sjåfør"
   c) Sjekk utilgjengelighet → bil/henger ute = "mangler"
   d) Sjekk dag-tildeling → eksplisitt satt felt overstyrer
   e) Sjekk koblingsgruppe → arv av bil/henger fra koblet rute
   f) Sjekk flerdagsruter → ressurser blokkert fra foregående dager

5. Statusfarger:
   - Grønn: alt OK
   - Rød: mangler sjåfør eller bil
   - Gul: ressurs tildelt men utilgjengelig/fravær
   - Blå: sjåfør og bil OK, men mangler henger
```

---

## 5. Nøkkelfunksjoner implementert

### Plan-modulen (`/plan`)
- **Drag-and-drop** av sjåfører til ruter, mellom ruter, og til fravær-sone
- **Tilgjengelige sjåfører** med søk. Utilgjengelige vises med grunn ved søk.
- **Tildeling av utilgjengelig sjåfør** med bekreftelses-dialog — vises med ⚠-markering
- **Duplikatkontroll** for biler og hengere med varseldialog
- **Koblede ruter** deler automatisk bil/henger; vises som tooltip på ⟷-ikon
- **Dynamisk dag-endring** — legg til / fjern ruter for én dag uten å endre master
- **Flerdagsruter** blokkerer ressurser på påfølgende dager basert på sluttid
- **Dag-navigasjon** (‹ ›) for rask veksling mellom datoer

### Masterplan (`/masterplan`)
- Redigerbar tabell: alle felter inkl. rutekode, dag, skift
- Legg til rute via popup-modal, slett med bekreftelse
- Koblingsgrupper: manuell kobling, daglig mønster (BAMA), auto-kobling
- Start/slutt-tid og varighet (flerdagsruter)

### Ansatte (`/ansatte`)
- Stamdata med kun navn og telefon som obligatorisk
- Selskapsfilter (Asko/Bring/TF/GDF)
- Faste ruter hentes automatisk fra masterplan
- Aktiv/inaktiv — inaktive fjernes fra plan og tilgjengelighet
- Slett med bekreftelse + opprydding av fravær og tildelinger
- Duplikatsjekk ved opprettelse (navn + telefonnummer)
- Turnus integrert i rediger-modal (4 uker, klikk for å sykle Ingen→Dag→Kveld→Begge)
- Read-only turnus-visning i detalj-modal

### Referanseintegritet ved sletting
- Slett ansatt → fjerner fravær + nullstiller tildelinger med den ansattes ID
- Slett bil → nullstiller `bilId` i tildelinger + `fastBilId` i ansatte
- Slett henger → nullstiller `hengerId` i tildelinger + `fastHengerId` i ansatte

---

## 6. Filstruktur

```
app/
  page.tsx                  Dagsoversikt (dashboard)
  TopNav.tsx                Navigasjon
  layout.tsx                Root layout med alle providers
  plan/page.tsx             Daglig disponering
  masterplan/page.tsx       Masterplan-redigering
  ansatte/page.tsx          Ansattmodul
  biler/page.tsx            Bilregister
  biler/utilgjengelig/      Bil-utilgjengelighet
  henger/page.tsx           Hengerregister
  henger/utilgjengelig/     Henger-utilgjengelighet
  fravaer/page.tsx          Fraværsregistrering
  kjoretoy-utilgjengelig/   Samlet utilgjengelighetsoversikt
  turnus/page.tsx           Legacy turnus (ikke i nav)

lib/
  domain/
    types.ts                Alle datatyper
    index.ts                Re-exports + fullNavn()
    mockData.ts             Mock/importert data
  state/
    *Store.tsx              12 context-baserte stores med localStorage
  imported/
    ansatte-from-excel.ts   Excel-importert ansattedata
    ruter-from-ringnes.ts   Importerte ruter
    ringnesCycle.ts         Syklusberegning (uke fra dato)
  dagsoversikt.ts           Hjelpefunksjoner for dashboard
  kjoretoyTilgjengelighet.ts Sjekk utilgjengelighet på dato
```

---

## 7. Kjente begrensninger og teknisk gjeld

| # | Beskrivelse | Alvorlighet |
|---|-------------|-------------|
| 1 | `dagsplanStore` er legacy — brukes ikke av aktive sider | Lav — kan fjernes |
| 2 | `ansatte-from-excel.ts` har noen duplikat-IDer (data shadowing) | Lav — påvirker kun initial import |
| 3 | Ingen backup/eksport — all data kun i localStorage | **Høy** — planlagt neste |
| 4 | `turnusMalStore` er lite brukt etter turnus ble integrert i ansatte | Lav |
| 5 | Mock-data (`MOCK_RUTER`, `MOCK_ANSATTE` osv.) importeres fortsatt i noen filer | Lav — brukes som fallback |

---

## 8. To planlag (kjerneprinsipp)

| Lag | Varighet | Eksempel |
|-----|----------|----------|
| **Master** | Permanent til neste endring i masterplan | «Rute 1520 er alltid med i uke 1 mandag med sjåfør X» |
| **Dynamisk (per dato)** | Kun den valgte dagen | «I dag kjører vi ikke rute 1520 pga. volum» |

Master-ruteplanen er felles mal i 4-ukers syklus. Endringer der er varige.
Dynamisk plan velger dato, legger til/fjerner ruter for den dagen — skriver aldri til master.

---

## 9. Beslutninger og designprinsipper

1. **Master-ruteplan** er felles mal i 4-ukers syklus; endringer er varige.
2. **Dynamisk plan** per dato — påvirker ikke master.
3. **Dashboard** viser primært dagens drift og status nå.
4. **Én PC / lokalt** inntil løsningen fungerer — ingen krav til flerbruker.
5. **Suksesskriterium:** planlegge og se ressurser på kortest mulig tid.
6. **Visning:** bruker ser én kalenderdag og ett skift om gangen.
7. **Kun Asko-ansatte** er tilgjengelige som fleksible ressurser i plan.
8. **Inaktive ansatte** fjernes automatisk fra plan og tilgjengelighet.
9. **Koblede ruter** deler ressurser permanent (masterdata).
10. **Manuell overstyring av utilgjengelig sjåfør** tillatt med bekreftelses-dialog.

---

## 10. Produkt-backlog

### Neste opp
- [ ] **Eksport / import av data** — backup-mekanisme for all localStorage-data
- [ ] «I morgen»-snarvei i Plan

### Ønskeliste (uprioritert)
- [ ] Innebygd kort hjelp («Slik bruker du Plan»)
- [ ] Rapportering / PDF / ukesoversikt
- [ ] Kalendervisning for kjøretøy-utilgjengelighet
- [ ] Server / database / pålogging (kun etter eget vedtak)
- [ ] Bedre matching av Excel-navn ved import av nye filer
- [ ] Fjern legacy `dagsplanStore` og `/turnus`-side

### Ikke bygg uten avklaring
- Ekstra database uten migreringsplan
- Flere samtidige brukere uten modell for skrivekonflikter
- Ny parallell modell for sjåfør på Plan

---

## 11. Samarbeidsregler

1. **Maks én aktiv stor feature** som endrer domene eller lagring om gangen.
2. **Ikke stor refaktor i samme leveranse som ny forretningslogikk.**
3. **Plan før kode:** kort mål → definisjon av ferdig.
4. **Endrer du lagringsformat:** noter migrering her eller tydelig i commit.
