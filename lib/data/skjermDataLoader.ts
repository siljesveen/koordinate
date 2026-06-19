import "server-only";

import type {
  Ansatt,
  Bil,
  BilUtilgjengelig,
  DagEndring,
  Fravær,
  Henger,
  HengerUtilgjengelig,
  MasterRuteplan,
  PlanRuteTildeling,
  SkiftTilgjengelighet,
} from "@/lib/domain";
import { processMasterplanRaw } from "@/lib/masterplan/masterplanCache";
import { byggInfoskjermOversikt, type InfoskjermOversikt } from "@/lib/plan/infoskjermOversikt";
import { syklusUkeFraDato, ukedag1til7FraDato } from "@/lib/imported/ringnesCycle";
import { isoDato, parseISODateInput } from "@/lib/kjoretoyTilgjengelighet";
import type { BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function somListe<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function parseMasterplan(raw: unknown): MasterRuteplan {
  return (
    processMasterplanRaw(raw) ?? {
      syklusLengde: 4,
      slots: [],
      referanseDato: "2026-06-16",
      aktivUkeVedReferanse: 2,
    }
  );
}

function parseBemanningsplan(raw: unknown): BemanningPlanData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.drivers || typeof o.drivers !== "object") return null;
  return {
    generated: String(o.generated ?? ""),
    year: Number(o.year) || new Date().getFullYear(),
    fileName: String(o.fileName ?? ""),
    sheetName: String(o.sheetName ?? ""),
    parserVersion: Number(o.parserVersion) || 0,
    drivers: o.drivers as BemanningPlanData["drivers"],
  };
}

export async function byggInfoskjermFraSky(
  dato?: string,
): Promise<{ data: InfoskjermOversikt } | { error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase er ikke konfigurert" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "SUPABASE_SERVICE_ROLE_KEY mangler på serveren",
    };
  }

  const { data: rows, error } = await admin.from("app_data").select("key, value");

  if (error) {
    return {
      error:
        error.message.includes("permission denied")
          ? "Mangler database-tilgang for infoskjerm — kjør migrasjon 007_app_data_service_role.sql i Supabase"
          : error.message,
    };
  }

  if (!rows?.length) {
    return {
      error:
        "Ingen data i sky ennå — logg inn som admin, gå til Innstillinger og last opp data til Supabase",
    };
  }

  const map = new Map(rows.map((r) => [r.key, r.value] as const));

  const iDag = dato ?? isoDato(new Date());
  const uke = syklusUkeFraDato(parseISODateInput(iDag));
  const dayNo = ukedag1til7FraDato(parseISODateInput(iDag));

  const masterplan = parseMasterplan(map.get("bemanning.masterplan.v1"));

  return {
    data: byggInfoskjermOversikt({
    dato: iDag,
    uke,
    dag: dayNo,
    ansatte: somListe<Ansatt>(map.get("bemanning.ansatte.v2")),
    fravær: somListe<Fravær>(map.get("bemanning.fravaer.v1")),
    masterSlots: masterplan.slots,
    koblingsgrupper: masterplan.koblingsgrupper,
    dagEndringer: somListe<DagEndring>(map.get("bemanning.dagendring.v1")),
    tildelinger: somListe<PlanRuteTildeling>(map.get("bemanning.planRuteTildeling.v2")),
    skiftTilgjengelighet: somListe<SkiftTilgjengelighet>(map.get("bemanning.skiftTilgjengelighet.v1")),
    bilUtilgjengelig: somListe<BilUtilgjengelig>(map.get("bemanning.bilUtilgjengelig.v1")),
    hengerUtilgjengelig: somListe<HengerUtilgjengelig>(map.get("bemanning.hengerUtilgjengelig.v1")),
    biler: somListe<Bil>(map.get("bemanning.biler.v1")),
    hengere: somListe<Henger>(map.get("bemanning.henger.v1")),
    bemanningsplan: parseBemanningsplan(map.get("bemanning.plan.v1")),
    }),
  };
}

export function erGyldigInfoskjermToken(token: string | null | undefined): boolean {
  const secret = process.env.INFOSKJERM_TOKEN?.trim();
  if (!secret) return false;
  const fraUrl = token?.trim();
  return Boolean(fraUrl && fraUrl === secret);
}
