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

/** Bred arbeidstid for fleksible sjåfører (dekker dag- og kveldruter). */
export const FLEKSIBEL_START_TID = "05:00";
export const FLEKSIBEL_SLUTT_TID = "23:00";

const FLEKSIBEL_HVERDAGER = new Set(["1", "2", "3", "4", "5"]);

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

/** Aktiver man–fre med bred arbeidstid når fleksibel turnus slås på. */
export function raderForFleksibelTurnus(rader: TurnusDagRad[]): TurnusDagRad[] {
  const harAktive = rader.some((r) => r.aktiv);
  return rader.map((rad) => {
    if (rad.aktiv || (!harAktive && FLEKSIBEL_HVERDAGER.has(rad.dagNr))) {
      return {
        ...rad,
        aktiv: true,
        startTid: FLEKSIBEL_START_TID,
        sluttTid: FLEKSIBEL_SLUTT_TID,
      };
    }
    return rad;
  });
}

export function byggTurnusFraRader(args: {
  basis?: Turnus;
  medRotasjon: boolean;
  skift1: "Dag" | "Kveld";
  skift2: "Dag" | "Kveld";
  rader1: TurnusDagRad[];
  rader2: TurnusDagRad[];
  fleksibelTilgjengelig?: boolean;
}): Turnus {
  const turnus: Turnus = {
    referanseDato: args.basis?.referanseDato ?? "2026-06-16",
    aktivUkeVedReferanse: args.basis?.aktivUkeVedReferanse ?? 2,
    uke1: raderTilUke(args.rader1, args.skift1),
    uke2: args.medRotasjon ? raderTilUke(args.rader2, args.skift2) : undefined,
    kommentar: args.basis?.kommentar,
  };
  if (args.fleksibelTilgjengelig) {
    turnus.fleksibelTilgjengelig = true;
  }
  return turnus;
}

export function turnusHarArbeidsdager(turnus: Turnus): boolean {
  const tell = (uke: TurnusUke) => Object.keys(uke.dager).length;
  return tell(turnus.uke1) > 0 || (turnus.uke2 ? tell(turnus.uke2) > 0 : false);
}
