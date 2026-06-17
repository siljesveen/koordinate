import type { DagEndring, Koblingsgruppe, MasterRuteSlot, Skift } from "@/lib/domain";
import { sorterRutekoder } from "@/lib/utils/sort";

export type KoblingsgruppeKontekst = {
  koblingsgruppeFraRute: Map<string, string>;
  ruterIKoblingsgruppe: Map<string, string[]>;
  slotsByRute: Map<string, MasterRuteSlot>;
  opphevedeKoblinger: Set<string>;
};

export function byggKoblingsgruppeKontekst(args: {
  koblingsgrupper?: Record<string, Koblingsgruppe>;
  ruter: MasterRuteSlot[];
  dagEndringer: DagEndring[];
  dato: string;
  skift: Skift;
  dag: number;
}): KoblingsgruppeKontekst {
  const koblingsgruppeFraRute = new Map<string, string>();
  const ruterIKoblingsgruppe = new Map<string, string[]>();

  if (args.koblingsgrupper) {
    for (const [gruppe, kobling] of Object.entries(args.koblingsgrupper)) {
      if (kobling.skift && kobling.skift !== args.skift) continue;
      if (kobling.dag && kobling.dag !== args.dag) continue;
      for (const kode of kobling.rutekoder) koblingsgruppeFraRute.set(kode, gruppe);
      ruterIKoblingsgruppe.set(gruppe, sorterRutekoder(kobling.rutekoder));
    }
  }

  const opphevedeKoblinger = new Set<string>();
  for (const e of args.dagEndringer) {
    if (e.dato !== args.dato || e.skift !== args.skift || e.type !== "kobling_opphevet") continue;
    if (e.koblingsgruppe) opphevedeKoblinger.add(e.koblingsgruppe);
    if (e.rutekoder && e.rutekoder.length >= 2) {
      opphevedeKoblinger.add(sorterRutekoder(e.rutekoder).join("|"));
    }
  }

  const slotsByRute = new Map(args.ruter.map((s) => [s.rutekode, s]));

  return { koblingsgruppeFraRute, ruterIKoblingsgruppe, slotsByRute, opphevedeKoblinger };
}

function erKoblingOpphevetForDag(
  ctx: KoblingsgruppeKontekst,
  gruppeKey: string,
  rutekoder: string[],
): boolean {
  if (gruppeKey && ctx.opphevedeKoblinger.has(gruppeKey)) return true;
  if (rutekoder.length >= 2) {
    return ctx.opphevedeKoblinger.has(sorterRutekoder(rutekoder).join("|"));
  }
  return false;
}

export function finnKoblingForRute(
  rutekode: string,
  ctx: KoblingsgruppeKontekst,
): { gruppeKey: string; rutekoder: string[] } | null {
  const gruppe = ctx.koblingsgruppeFraRute.get(rutekode);
  if (gruppe) {
    const rutekoder = ctx.ruterIKoblingsgruppe.get(gruppe) ?? [];
    if (rutekoder.length >= 2) return { gruppeKey: gruppe, rutekoder };
  }

  const slot = ctx.slotsByRute.get(rutekode);
  if (slot?.koblingsgruppe) {
    const rutekoder = [...ctx.slotsByRute.values()]
      .filter((s) => s.koblingsgruppe === slot.koblingsgruppe)
      .map((s) => s.rutekode);
    if (rutekoder.length >= 2) return { gruppeKey: slot.koblingsgruppe, rutekoder };
  }

  return null;
}

/** Samme sjåfør på flere ruter er OK når alle rutene hører til én aktiv koblingsgruppe. */
export function sjåførPåRuterErTillattKoblet(rutekoder: string[], ctx: KoblingsgruppeKontekst): boolean {
  if (rutekoder.length <= 1) return true;

  for (const rutekode of rutekoder) {
    const info = finnKoblingForRute(rutekode, ctx);
    if (!info) continue;
    if (erKoblingOpphevetForDag(ctx, info.gruppeKey, info.rutekoder)) continue;
    const gruppeSet = new Set(info.rutekoder);
    if (rutekoder.every((r) => gruppeSet.has(r))) return true;
  }

  return false;
}
