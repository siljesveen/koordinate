import type { Ansatt, Fravær, FraværType } from "@/lib/domain";
import { IMPORTERTE_ANSATTE_BEMANNING_2026 } from "@/lib/imported/ansatte-bemanning-2026";
import { mergeTilleggAnsatte } from "@/lib/maintenance/plannerRessurslisteEnrich";
import { matchAnsattIdForPlanNavn } from "@/lib/utils/bemanningsplanKobling";
import type { BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";
import {
  erFraværExcelKode,
  erGyldigPlan,
  mapExcelKodeTilFraværType,
} from "@/lib/utils/bemanningsplanKoder";
import {
  parseDriverNavn,
  type FraværValidering,
  validerFraværMotAnsatte,
} from "@/lib/utils/fraværAnsattMatching";
import {
  grupperFraværDagerTilPerioder,
  type FraværDag,
} from "@/lib/utils/fraværPeriodeGruppering";

export type BemanningDriver = {
  name: string;
  absence?: Record<string, unknown>;
  absenceComments?: Record<string, unknown>;
  comments?: Record<string, unknown>;
  kommentarer?: Record<string, unknown>;
  notes?: Record<string, unknown>;
};

export type BemanningMasterdata = {
  generated?: string;
  year?: number;
  drivers: Record<string, BemanningDriver>;
};

export type ImporterBemanningsFraværResult = {
  fravær: Fravær[];
  unmatchedNavn: string[];
  validering: FraværValidering;
  kilde: "opplastet";
  totaltFraPlan: number;
};

export type ImporterBemanningsFraværOptions = {
  ansatte?: Ansatt[];
  plan?: BemanningPlanData | null;
};

function ansatteForImport(store: Ansatt[]): Ansatt[] {
  const byId = new Map(store.map((a) => [a.id, a] as const));
  for (const a of IMPORTERTE_ANSATTE_BEMANNING_2026) {
    if (!byId.has(a.id)) byId.set(a.id, a);
  }
  return mergeTilleggAnsatte([...byId.values()]);
}

function mapFraværKode(kode: string): FraværType | null {
  if (!erFraværExcelKode(kode)) return null;
  return mapExcelKodeTilFraværType(kode);
}

function tekstFraUkjent(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t || undefined;
}

function slåSammenKommentarer(...deler: Array<string | undefined>): string | undefined {
  const unike = [...new Set(deler.filter(Boolean) as string[])];
  return unike.length ? unike.join("; ") : undefined;
}

function parseAbsenceEntry(raw: unknown): { type: FraværType; kommentar?: string } | null {
  if (typeof raw === "string") {
    const type = mapFraværKode(raw);
    return type ? { type } : null;
  }

  if (raw && typeof raw === "object") {
    const entry = raw as Record<string, unknown>;
    const kode = String(entry.code ?? entry.kode ?? entry.type ?? entry.symbol ?? "");
    const type = mapFraværKode(kode);
    if (!type) return null;
    const kommentar = slåSammenKommentarer(
      tekstFraUkjent(entry.comment),
      tekstFraUkjent(entry.kommentar),
      tekstFraUkjent(entry.note),
      tekstFraUkjent(entry.notes),
      tekstFraUkjent(entry.text),
      tekstFraUkjent(entry.beskrivelse),
    );
    return { type, kommentar };
  }

  return null;
}

function dagKommentarIndex(driver: BemanningDriver): Record<string, string> {
  const index: Record<string, string> = {};
  const kilder = [driver.absenceComments, driver.comments, driver.kommentarer, driver.notes];

  for (const kilde of kilder) {
    if (!kilde || typeof kilde !== "object") continue;
    for (const [dato, raw] of Object.entries(kilde)) {
      const parsed = parseAbsenceEntry(raw);
      const kommentar = parsed?.kommentar ?? tekstFraUkjent(raw);
      if (kommentar) index[dato] = kommentar;
    }
  }

  return index;
}

function normaliserAbsenceDager(driver: BemanningDriver): FraværDag[] {
  const dagKommentarer = dagKommentarIndex(driver);
  const absence = driver.absence ?? {};

  return Object.entries(absence)
    .map(([dato, raw]): FraværDag | null => {
      const parsed = parseAbsenceEntry(raw);
      if (!parsed) return null;
      const excelKode =
        typeof raw === "string" ? raw.trim().toUpperCase() : String(raw ?? "").trim().toUpperCase();
      return {
        dato,
        type: parsed.type,
        excelKode,
        kommentar: slåSammenKommentarer(parsed.kommentar, dagKommentarer[dato]),
      };
    })
    .filter((entry): entry is FraværDag => entry !== null)
    .sort((a, b) => a.dato.localeCompare(b.dato));
}

function nyFraværId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function planTilMasterdata(plan: BemanningPlanData): BemanningMasterdata {
  const drivers: Record<string, BemanningDriver> = {};
  for (const [key, driver] of Object.entries(plan.drivers)) {
    drivers[key] = {
      name: driver.name,
      absence: driver.absence,
      absenceComments: driver.absenceComments,
    };
  }
  return { generated: plan.generated, year: plan.year, drivers };
}

function importerFraMasterdata(
  data: BemanningMasterdata,
  ansatte: Ansatt[],
): ImporterBemanningsFraværResult {
  const fravær: Fravær[] = [];
  const unmatchedNavn: string[] = [];

  for (const driver of Object.values(data.drivers)) {
    if (!parseDriverNavn(driver.name)) {
      unmatchedNavn.push(driver.name);
      continue;
    }

    const ansattId = matchAnsattIdForPlanNavn(driver.name, ansatte);
    if (!ansattId) {
      unmatchedNavn.push(driver.name);
      continue;
    }

    for (const periode of grupperFraværDagerTilPerioder(normaliserAbsenceDager(driver))) {
      fravær.push({
        id: nyFraværId(),
        ansattId,
        type: periode.type,
        fraDato: periode.fraDato,
        tilDato: periode.tilDato,
        kommentar: periode.kommentar,
        excelKode: periode.excelKode,
      });
    }
  }

  const validering = validerFraværMotAnsatte(fravær, ansatte);
  return { fravær, unmatchedNavn, validering, kilde: "opplastet", totaltFraPlan: fravær.length };
}

export async function importerBemanningsFravær(
  options: ImporterBemanningsFraværOptions = {},
): Promise<ImporterBemanningsFraværResult> {
  const ansatte = ansatteForImport(options.ansatte ?? []);

  if (!erGyldigPlan(options.plan)) {
    throw new Error(
      "Last opp bemanningsplan (.xlsx) på nytt før import. Eldre lagrede planer inneholder ikke A, T og K.",
    );
  }

  return importerFraMasterdata(planTilMasterdata(options.plan), ansatte);
}

export { validerFraværMotAnsatte };
