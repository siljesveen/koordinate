export type DagsplanStatus =
  | "Ledig"
  | "På jobb"
  | "På rute"
  | "Syk"
  | "Fri";

export type Skift = "Dag" | "Kveld";

export type FraværType = "Syk" | "Ferie" | "Fri" | "Permisjon" | "Avspasering" | "Annet";

export const FRAVÆR_TYPER: FraværType[] = [
  "Syk",
  "Ferie",
  "Fri",
  "Permisjon",
  "Avspasering",
  "Annet",
];

export type AnsattSelskap = "Asko" | "Bring" | "TF" | "GDF" | "Kjørekontor";

export type Ansatt = {
  id: string;
  fornavn: string;
  etternavn: string;
  telefon: string;
  epost: string;
  rolle: string;
  avdeling: string;
  /** Selskap/organisasjon. Kun Asko-ansatte er tilgjengelige som fleksible ressurser. */
  selskap?: AnsattSelskap;
  stillingsprosent: number;
  kompetanse: string[];
  førerkort: string[];
  /** Ruter den ansatte er knyttet til (rute.id). */
  ruteIds?: string[];
  /** Fast oppdragbil (bil.id). */
  fastBilId?: string;
  /** Fast henger (henger.id). */
  fastHengerId?: string;
  aktiv: boolean;
  kommentar?: string;
  /** Eksakt navn i kolonne A i bemanningsplan-Excel — sikrer korrekt fravær-import. */
  planExcelNavn?: string;
};

/**
 * Tilhørighet/kategori for en bil som ikke er knyttet til en fast sjåfør:
 * «Reserve» = reservebil tilgjengelig for alle, og eksterne operatører.
 */
export type BilTilhørighet = "Reserve" | "Bring" | "GDF" | "TF";

export const BIL_TILHØRIGHETER: BilTilhørighet[] = ["Reserve", "Bring", "GDF", "TF"];

export type Bil = {
  id: string;
  kjennemerke: string;
  merke?: string;
  modell?: string;
  aktiv: boolean;
  /** Reserve eller ekstern operatør (Bring/GDF/TF). Tomt = vanlig bil. */
  tilhørighet?: BilTilhørighet;
  kommentar?: string;
  /** Fast sjåfør(er) på bilen (ansatt.id). Støtter flere på samme bil. */
  fastSjåførAnsattIds?: string[];
};

export type Henger = {
  id: string;
  kjennemerke: string;
  /** F.eks. kjøl, container, kapell … */
  type?: string;
  aktiv: boolean;
  /** Reserve eller ekstern operatør (Bring/GDF/TF). */
  tilhørighet?: BilTilhørighet;
  kommentar?: string;
  /** Fast sjåfør(er) på hengeren (ansatt.id). */
  fastSjåførAnsattIds?: string[];
};

/** Årsak til at bil/henger ikke kan brukes i en periode (planlagt eller akutt). */
export type KjøretøyUtilgjengeligType =
  | "Verksted"
  | "Vedlikehold"
  | "Havari"
  | "Service"
  | "Inspeksjon"
  | "Annet";

export type BilUtilgjengelig = {
  id: string;
  bilId: string;
  type: KjøretøyUtilgjengeligType;
  fraDato: string;
  /** Utelatt = på verksted/utilgjengelig til noen avslutter perioden. */
  tilDato?: string;
  /**
   * Kalenderdag da perioden ble avsluttet med «tilbake» — skjul i «borte i dag»
   * samme dag (plan/disponibilitet bruker fortsatt lukket til i dag ved behov).
   */
  tilbakeIDriftDato?: string;
  /** Planlagt frem i tid vs akutt problem */
  planlagt?: boolean;
  kommentar?: string;
};

export type HengerUtilgjengelig = {
  id: string;
  hengerId: string;
  type: KjøretøyUtilgjengeligType;
  fraDato: string;
  tilDato: string;
  planlagt?: boolean;
  kommentar?: string;
};

export type Rute = {
  id: string;
  rutenummer: string;
  rutenavn: string;
  område: string;
  starttid: string;
  sluttid: string;
  kravKompetanse: string[];
  fastSjåfør?: string;
  backupSjåfør?: string;
  aktiv: boolean;
};

export type Dagsplan = {
  id: string;
  dato: string;
  ansattId: string;
  status: DagsplanStatus;
  /** Skift gjelder typisk for «På jobb»/«På rute». */
  skift?: Skift;
  ruteId?: string;
  kommentar?: string;
  sistOppdatert: string;
};

export type Fravær = {
  id: string;
  ansattId: string;
  type: FraværType;
  fraDato: string;
  tilDato: string;
  /** Planlagt fravær (f.eks. ferie) vs uplanlagt (f.eks. syk). */
  planlagt?: boolean;
  kommentar?: string;
  /** Opprinnelig Excel-kode (A, T, K …) ved import fra bemanningsplan. */
  excelKode?: string;
};

/**
 * Kobling av sjåfør og kjøretøy til en rute i planens rutenett
 * (syklus-uke 1–4, ukedag 1–7, skift, rute-kode fra baseline).
 */
export type PlanRuteTildeling = {
  id: string;
  uke: 1 | 2 | 3 | 4;
  dag: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  skift: Skift;
  /** Samme kode som i importert plan (`RingnesPlanRute.rute`). */
  rute: string;
  ansattId?: string;
  bilId?: string;
  hengerId?: string;
  /**
   * Når sann og ingen ansattId: ikke bruk Excel/baseline-sjåfør på denne ruten
   * (f.eks. etter at sjåfør er dratt til tilgjengelig).
   */
  skjulBaselineSjåfør?: boolean;
  /** Når sann og ingen bilId: ingen bil på denne ruten (heller ikke fra master/fast/koblet). */
  skjulBaselineBil?: boolean;
  /** Når sann og ingen hengerId: ingen henger på denne ruten (heller ikke fra master/fast/koblet). */
  skjulBaselineHenger?: boolean;
};

/* ─── Master-ruteplan (4-ukers syklus) ─── */

export type MasterRuteSlot = {
  id: string;
  uke: 1 | 2 | 3 | 4;
  dag: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  skift: Skift;
  rutekode: string;
  rutenavn?: string;
  standardSjåførAnsattId?: string;
  standardBilId?: string;
  standardHengerId?: string;
  /** HH:mm – forventet starttidspunkt */
  startTid?: string;
  /** HH:mm – forventet sluttidspunkt (kan være neste dag) */
  sluttTid?: string;
  /** Antall dager ruten varer (1 = normal, 2 = overnatt/søgn) */
  varighet?: number;
  /** Ruter med samme koblingsgruppe deler ressurser (sjåfør/bil/henger). */
  koblingsgruppe?: string;
};

export type Koblingsgruppe = {
  rutekoder: string[];
  /** Når satt, gjelder koblingen bare for denne ukedagen (1=man, 7=søn). */
  dag?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Når satt, gjelder koblingen bare for dette skiftet. Uten = begge skift. */
  skift?: Skift;
};

export type MasterRuteplan = {
  syklusLengde: number;
  slots: MasterRuteSlot[];
  /** Definerer hvilke rutekoder som deler ressurser. Nøkkel = gruppenavn. */
  koblingsgrupper?: Record<string, Koblingsgruppe>;
};

/* ─── Dynamisk dag-endring (avvik fra master for én dato) ─── */

export type DagEndring = {
  id: string;
  dato: string;
  skift: Skift;
  type: "fjernet" | "lagt_til" | "kobling_opphevet";
  rutekode: string;
  rutenavn?: string;
  /** Masterplan-gruppenavn (når kobling kommer fra koblingsgrupper). */
  koblingsgruppe?: string;
  /** Alle rutekoder som var koblet denne dagen (før oppheving). */
  rutekoder?: string[];
};

/* ─── Hentinger (faste henteoppdrag + daglig avhuking) ─── */

/** Fast henteoppdrag i katalogen. */
export type Henting = {
  id: string;
  /** Kunde/leverandør – hovedidentifikasjon. */
  kunde: string;
  /**
   * Ukeoppsett: rute(r) som henter per ukedag (1 = mandag … 7 = søndag).
   * Tom liste / mangler = henting går normalt ikke den ukedagen.
   */
  ukeRuter: Record<number, string[]>;
  /** Valgfri mengde (fritekst, f.eks. «3 paller»). */
  antall?: string;
  kommentar?: string;
  aktiv: boolean;
};

/** Avhuket henting for en bestemt dato (med evt. overstyrte ruter den dagen). */
export type HentingDagValg = {
  id: string;
  dato: string;
  hentingId: string;
  /** Overstyrte ruter for denne dagen (ellers brukes ukeRuter for ukedagen). */
  ruter?: string[];
  /** Mengde registrert for denne dagen (fritekst, f.eks. «4 paller»). */
  antall?: string;
};

/* ─── Skift-tilgjengelighet (avvik fra turnus for en eller flere datoer) ─── */

/**
 * Overstyrer hvilket skift en sjåfør er tilgjengelig på, uten å endre turnusen.
 * Brukes både for skiftbytte (fast turnus → motsatt skift) og for å «parkere»
 * fleksible sjåfører (tilgjengelig begge skift) på ett skift en periode.
 */
export type SkiftTilgjengelighet = {
  id: string;
  ansattId: string;
  /** Første dato (ISO yyyy-mm-dd) overstyringen gjelder. */
  fraDato: string;
  /** Siste dato (ISO). Utelatt = kun fraDato (én dag). */
  tilDato?: string;
  /** Skiftet sjåføren er tilgjengelig på i perioden. */
  skift: Skift;
  kommentar?: string;
};
