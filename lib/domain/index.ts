export type {
  Ansatt,
  AnsattSelskap,
  Bil,
  BilTilhørighet,
  BilUtilgjengelig,
  DagEndring,
  Henting,
  HentingDagValg,
  Koblingsgruppe,
  Skift,
  Fravær,
  FraværType,
  Henger,
  HengerUtilgjengelig,
  KjøretøyUtilgjengeligType,
  MasterRuteSlot,
  MasterRuteplan,
  PlanRuteTildeling,
  Rute,
  SkiftTilgjengelighet,
  ReserveTilgjengelighet,
  Turnus,
  TurnusUke,
  TurnusUkedag,
} from "./types";
export { FRAVÆR_TYPER, BIL_TILHØRIGHETER } from "./types";

import type { Ansatt } from "./types";

export function fullNavn(a: Ansatt): string {
  return `${a.fornavn} ${a.etternavn}`.trim();
}
