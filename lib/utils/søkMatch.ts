import { fullNavn, type Ansatt, type Bil, type Henger, type MasterRuteSlot } from "@/lib/domain";
import { navnMatcherSøk } from "@/lib/utils/kjoretoySjaførSøk";

export function normaliserSøk(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function kompaktSøk(s: string): string {
  return normaliserSøk(s).replace(/\s+/g, "");
}

/** Generell tekstmatch (inkl. kompakt reg.nr uten mellomrom). */
export function tekstMatcherSøk(blob: string, søk: string): boolean {
  const q = normaliserSøk(søk);
  if (!q) return true;
  const b = normaliserSøk(blob);
  const qK = kompaktSøk(søk);
  return b.includes(q) || b.replace(/\s+/g, "").includes(qK);
}

export function kjoretoyMatcherSøk(
  kjennemerke: string,
  merkeEllerType?: string,
  modell?: string,
  søk = "",
): boolean {
  const blob = [kjennemerke, merkeEllerType, modell].filter(Boolean).join(" ");
  return tekstMatcherSøk(blob, søk);
}

export function navnListeMatcherSøk(navn: string[], søk: string): boolean {
  return navn.some((n) => tekstMatcherSøk(n, søk));
}

export function ansattMatcherModulSøk(
  a: Ansatt,
  søk: string,
  opts?: {
    bilById?: Map<string, Bil>;
    hengerById?: Map<string, Henger>;
    rutekoder?: string[];
  },
): boolean {
  if (!søk.trim()) return true;
  if (navnMatcherSøk(a, søk)) return true;
  if (tekstMatcherSøk(a.telefon, søk)) return true;
  if (tekstMatcherSøk(a.epost, søk)) return true;
  if (a.selskap && tekstMatcherSøk(a.selskap, søk)) return true;
  if (a.avdeling && tekstMatcherSøk(a.avdeling, søk)) return true;

  const bil = a.fastBilId ? opts?.bilById?.get(a.fastBilId) : undefined;
  if (bil && kjoretoyMatcherSøk(bil.kjennemerke, bil.merke, bil.modell, søk)) return true;

  const henger = a.fastHengerId ? opts?.hengerById?.get(a.fastHengerId) : undefined;
  if (henger && kjoretoyMatcherSøk(henger.kjennemerke, henger.type, undefined, søk)) return true;

  if (opts?.rutekoder?.some((k) => tekstMatcherSøk(k, søk))) return true;

  return false;
}

export function bilMatcherModulSøk(bil: Bil, søk: string, sjåførNavn: string[] = []): boolean {
  if (!søk.trim()) return true;
  if (kjoretoyMatcherSøk(bil.kjennemerke, bil.merke, bil.modell, søk)) return true;
  return navnListeMatcherSøk(sjåførNavn, søk);
}

export function hengerMatcherModulSøk(henger: Henger, søk: string, sjåførNavn: string[] = []): boolean {
  if (!søk.trim()) return true;
  if (kjoretoyMatcherSøk(henger.kjennemerke, henger.type, undefined, søk)) return true;
  return navnListeMatcherSøk(sjåførNavn, søk);
}

export function slotMatcherModulSøk(
  slot: MasterRuteSlot,
  søk: string,
  ctx: {
    ansattById: Map<string, Ansatt>;
    bilById: Map<string, Bil>;
    hengerById: Map<string, Henger>;
    tildeling?: { ansattId?: string; bilId?: string; hengerId?: string };
  },
): boolean {
  if (!søk.trim()) return true;
  if (tekstMatcherSøk(slot.rutekode, søk)) return true;
  if (slot.rutenavn && tekstMatcherSøk(slot.rutenavn, søk)) return true;

  const sjId = ctx.tildeling?.ansattId ?? slot.standardSjåførAnsattId;
  const bilId = ctx.tildeling?.bilId ?? slot.standardBilId;
  const hengerId = ctx.tildeling?.hengerId ?? slot.standardHengerId;

  const sj = sjId ? ctx.ansattById.get(sjId) : undefined;
  if (sj && navnMatcherSøk(sj, søk)) return true;

  const bil = bilId ? ctx.bilById.get(bilId) : undefined;
  if (bil && kjoretoyMatcherSøk(bil.kjennemerke, bil.merke, bil.modell, søk)) return true;

  const henger = hengerId ? ctx.hengerById.get(hengerId) : undefined;
  if (henger && kjoretoyMatcherSøk(henger.kjennemerke, henger.type, undefined, søk)) return true;

  return false;
}
