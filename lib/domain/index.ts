export type {
  Ansatt,
  AnsattSelskap,
  Bil,
  BilTilhørighet,
  BilUtilgjengelig,
  DagEndring,
  Dagsplan,
  DagsplanStatus,
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
  Turnus,
  TurnusUke,
  TurnusUkedag,
} from "./types";
export { FRAVÆR_TYPER, BIL_TILHØRIGHETER } from "./types";
export {
  MOCK_ANSATTE,
  MOCK_FRAVÆR,
  MOCK_RUTER,
  IMPORTERTE_RUTER,
  mockDagsplanForDato,
} from "./mockData";

import type { Ansatt } from "./types";

export function fullNavn(a: Ansatt): string {
  return `${a.fornavn} ${a.etternavn}`.trim();
}
