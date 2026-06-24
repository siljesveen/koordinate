import type { Ansatt, Skift, Turnus, TurnusUke, TurnusUkedag } from "@/lib/domain";

/**
 * Beregn ISO-ukenummer for en dato.
 */
function isoUkenummer(dato: Date): number {
  const d = new Date(Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const årsStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - årsStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Returner aktiv TurnusUke for en gitt dato.
 * Returnerer null hvis sjåføren ikke har turnus.
 */
export function aktivTurnusUke(turnus: Turnus, dato: string): TurnusUke {
  if (!turnus.uke2) return turnus.uke1;

  const d = new Date(dato);
  const ref = new Date(turnus.referanseDato);
  const diffUker =
    (isoUkenummer(d) - isoUkenummer(ref) + (d.getFullYear() - ref.getFullYear()) * 52) % 2;
  const erSammeParitet = ((diffUker % 2) + 2) % 2 === 0;

  return erSammeParitet
    ? turnus.aktivUkeVedReferanse === 1
      ? turnus.uke1
      : turnus.uke2
    : turnus.aktivUkeVedReferanse === 1
      ? turnus.uke2
      : turnus.uke1;
}

/**
 * Ukedagnummer for en ISO-datostreng (1=mandag … 7=søndag).
 */
export function ukedagNummer(dato: string): "1" | "2" | "3" | "4" | "5" | "6" | "7" {
  const dag = new Date(dato).getDay();
  return (dag === 0 ? 7 : dag).toString() as "1" | "2" | "3" | "4" | "5" | "6" | "7";
}

/** Arbeidstid i aktiv turnus-uke for gitt kalenderdag, eller undefined. */
export function turnusDagInfo(turnus: Turnus, dato: string): TurnusUkedag | undefined {
  const uke = aktivTurnusUke(turnus, dato);
  return uke.dager[ukedagNummer(dato)];
}

/** Om ansatt har registrert arbeidstid i turnus på gitt dato. */
export function ansattHarTurnusArbeidstidPåDag(
  ansatt: Pick<Ansatt, "turnus">,
  dato: string,
): boolean {
  if (!ansatt.turnus) return false;
  return Boolean(turnusDagInfo(ansatt.turnus, dato));
}

/** Effektivt skift fra turnus (med evt. plan-overstyring). */
export function ansattTurnusSkiftPåDato(
  ansatt: Pick<Ansatt, "turnus">,
  dato: string,
  skiftOverstyring?: Skift,
): Skift | undefined {
  if (!ansatt.turnus) return undefined;
  if (skiftOverstyring) return skiftOverstyring;
  return aktivTurnusUke(ansatt.turnus, dato).skift;
}

/**
 * Om ansatt skal vises i «tilgjengelige» ut fra turnus:
 * må ha timer den dagen og matche planlagt skift (evt. overstyrt skift).
 * Fleksibel turnus matcher begge skift når det ikke er skift-overstyring.
 */
export function ansattErTilgjengeligITurnus(
  ansatt: Pick<Ansatt, "turnus">,
  dato: string,
  planSkift: Skift,
  skiftOverstyring?: Skift,
): boolean {
  if (!ansattHarTurnusArbeidstidPåDag(ansatt, dato)) return false;
  if (skiftOverstyring) return skiftOverstyring === planSkift;
  if (ansatt.turnus?.fleksibelTilgjengelig) return true;
  const effektivSkift = ansattTurnusSkiftPåDato(ansatt, dato);
  return effektivSkift === planSkift;
}

/** Forklaring når turnus hindrer visning i tilgjengelige-listen. */
export function turnusUtilgjengeligGrunn(
  ansatt: Pick<Ansatt, "turnus">,
  dato: string,
  planSkift: Skift,
  skiftOverstyring?: Skift,
): string | null {
  if (!ansatt.turnus) return "Ingen turnus";
  if (!ansattHarTurnusArbeidstidPåDag(ansatt, dato)) return "Fri i turnus";
  if (ansatt.turnus.fleksibelTilgjengelig && !skiftOverstyring) return null;
  const turnusSkift = aktivTurnusUke(ansatt.turnus, dato).skift;
  const effektiv = skiftOverstyring ?? turnusSkift;
  if (effektiv !== planSkift) {
    return skiftOverstyring
      ? `Overstyrt til ${skiftOverstyring.toLowerCase()}`
      : `Turnus: ${turnusSkift.toLowerCase()}`;
  }
  return null;
}

/**
 * Sjekk om en sjåfør har arbeidstid til en rute.
 * Returnerer en advarselstreng hvis konflikt, null hvis OK.
 *
 * På lørdag gjelder turnus bare når sjåføren faktisk har rute den dagen
 * (styrt av masterplan / 4-ukers syklus). Sett `harLørdagsRuteInPlan: false`
 * for å hoppe over sjekk når det ikke er arbeidshelg.
 */
export function sjekkArbeidstidKonflikt(
  turnus: Turnus,
  dato: string,
  ruteStartTid: string, // "HH:mm"
  options?: { harLørdagsRuteInPlan?: boolean },
): string | null {
  const dagNr = ukedagNummer(dato);
  if (dagNr === "6" && options?.harLørdagsRuteInPlan === false) {
    return null;
  }

  const uke = aktivTurnusUke(turnus, dato);
  const dagInfo = uke.dager[dagNr];

  if (!dagInfo) {
    const dagNavn = ["", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"][
      parseInt(dagNr)
    ];
    return `Sjåføren har ikke arbeidstid på ${dagNavn}`;
  }

  if (ruteStartTid < dagInfo.startTid) {
    return `Ruten starter ${ruteStartTid}, men sjåføren begynner ikke før ${dagInfo.startTid}`;
  }

  if (ruteStartTid >= dagInfo.sluttTid) {
    return `Ruten starter ${ruteStartTid}, men sjåføren slutter ${dagInfo.sluttTid}`;
  }

  return null;
}
