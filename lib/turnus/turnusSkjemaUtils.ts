import type { Turnus, TurnusUke, TurnusUkedag } from "@/lib/domain";

export const TURNUS_DAG_NAVN: Record<string, string> = {
  "1": "Mandag",
  "2": "Tirsdag",
  "3": "Onsdag",
  "4": "Torsdag",
  "5": "Fredag",
  "6": "Lørdag",
  "7": "Søndag",
};

export const TURNUS_ALLE_DAGER = ["1", "2", "3", "4", "5", "6", "7"] as const;

export type TurnusDagRad = {
  dagNr: string;
  aktiv: boolean;
  startTid: string;
  sluttTid: string;
};

export function ukeTilRader(uke: TurnusUke | undefined): TurnusDagRad[] {
  return TURNUS_ALLE_DAGER.map((dagNr) => {
    const info = uke?.dager[dagNr];
    return {
      dagNr,
      aktiv: !!info,
      startTid: info?.startTid ?? "06:00",
      sluttTid: info?.sluttTid ?? "14:00",
    };
  });
}

export function raderTilUke(rader: TurnusDagRad[], skift: "Dag" | "Kveld"): TurnusUke {
  const dager: Partial<Record<string, TurnusUkedag>> = {};
  for (const rad of rader) {
    if (rad.aktiv) {
      dager[rad.dagNr] = { startTid: rad.startTid, sluttTid: rad.sluttTid };
    }
  }
  return { skift, dager };
}

/** Standard dagturnus man–fre for ny ansatt. */
export function standardNyTurnus(): Turnus {
  const hverdag: Partial<Record<string, TurnusUkedag>> = {};
  for (const dag of ["1", "2", "3", "4", "5"] as const) {
    hverdag[dag] = { startTid: "06:00", sluttTid: "14:00" };
  }
  return {
    referanseDato: "2026-06-16",
    aktivUkeVedReferanse: 2,
    uke1: { skift: "Dag", dager: hverdag },
  };
}

export function byggTurnusFraRader(args: {
  basis?: Turnus;
  medRotasjon: boolean;
  skift1: "Dag" | "Kveld";
  skift2: "Dag" | "Kveld";
  rader1: TurnusDagRad[];
  rader2: TurnusDagRad[];
}): Turnus {
  return {
    referanseDato: args.basis?.referanseDato ?? "2026-06-16",
    aktivUkeVedReferanse: args.basis?.aktivUkeVedReferanse ?? 2,
    uke1: raderTilUke(args.rader1, args.skift1),
    uke2: args.medRotasjon ? raderTilUke(args.rader2, args.skift2) : undefined,
    kommentar: args.basis?.kommentar,
  };
}

export function turnusHarArbeidsdager(turnus: Turnus): boolean {
  const tell = (uke: TurnusUke) => Object.keys(uke.dager).length;
  return tell(turnus.uke1) > 0 || (turnus.uke2 ? tell(turnus.uke2) > 0 : false);
}
