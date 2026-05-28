export type {
  Ansatt,
  AnsattSelskap,
  Bil,
  BilUtilgjengelig,
  DagEndring,
  Dagsplan,
  DagsplanStatus,
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
} from "./types";
export { FRAVÆR_TYPER } from "./types";
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
