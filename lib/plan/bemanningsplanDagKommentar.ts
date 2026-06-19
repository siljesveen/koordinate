import type { Ansatt } from "@/lib/domain";
import type { BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";
import { matchAnsattIdForPlanNavn } from "@/lib/utils/bemanningsplanKobling";

function tekstFraUkjent(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t || undefined;
}

function dagKommentarFraDriver(
  driver: NonNullable<BemanningPlanData["drivers"][string]>,
  dato: string,
): string | undefined {
  const kilder = [
    driver.absenceComments,
    (driver as { comments?: Record<string, unknown> }).comments,
    (driver as { kommentarer?: Record<string, unknown> }).kommentarer,
    (driver as { notes?: Record<string, unknown> }).notes,
  ];

  for (const kilde of kilder) {
    if (!kilde || typeof kilde !== "object") continue;
    const raw = (kilde as Record<string, unknown>)[dato];
    const tekst = tekstFraUkjent(raw);
    if (tekst) return tekst;
  }

  return undefined;
}

/** Sjekk om ansatt har cellekommentar i opplastet bemanningsplan for gitt dato. */
export function harDagKommentarIPlan(
  ansatt: Ansatt,
  plan: BemanningPlanData | null | undefined,
  dato: string,
): boolean {
  if (!plan?.drivers) return false;

  for (const driver of Object.values(plan.drivers)) {
    const matchId = matchAnsattIdForPlanNavn(driver.name, [ansatt]);
    if (matchId !== ansatt.id) continue;
    return Boolean(dagKommentarFraDriver(driver, dato));
  }

  if (ansatt.planExcelNavn) {
    const driver = plan.drivers[ansatt.planExcelNavn];
    if (driver && dagKommentarFraDriver(driver, dato)) return true;
  }

  return false;
}
