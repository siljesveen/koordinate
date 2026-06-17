import type { Koblingsgruppe, MasterRuteplan, MasterRuteSlot } from "@/lib/domain";
import { sorterRutekoder } from "@/lib/utils/sort";

/** Gjenopprett koblingsgrupper-dict fra slot.koblingsgruppe når dict mangler. */
function rehydrateFraSlots(
  slots: MasterRuteSlot[],
  grupper: Record<string, Koblingsgruppe>,
): Record<string, Koblingsgruppe> {
  const perNavn = new Map<string, Set<string>>();
  for (const slot of slots) {
    if (!slot.koblingsgruppe) continue;
    if (!perNavn.has(slot.koblingsgruppe)) perNavn.set(slot.koblingsgruppe, new Set());
    perNavn.get(slot.koblingsgruppe)!.add(slot.rutekode);
  }
  const out = { ...grupper };
  for (const [navn, koder] of perNavn) {
    if (koder.size < 2) continue;
    if (out[navn]) continue;
    out[navn] = { rutekoder: sorterRutekoder([...koder]) };
  }
  return out;
}

/** Splitt-ruter (1128-1 / 1128-2 osv.) som ikke allerede er koblet. */
function splittRuteGrupper(rutekoder: readonly string[]): Map<string, string[]> {
  const baseMap = new Map<string, string[]>();
  for (const kode of rutekoder) {
    const match = kode.match(/^(.+)-(\d+)$/);
    if (!match) continue;
    const base = match[1];
    if (!baseMap.has(base)) baseMap.set(base, []);
    baseMap.get(base)!.push(kode);
  }
  const result = new Map<string, string[]>();
  for (const [, koder] of baseMap) {
    if (koder.length < 2) continue;
    const sortert = sorterRutekoder(koder);
    result.set(sortert.join("+"), sortert);
  }
  return result;
}

function ruteErKoblet(kode: string, grupper: Record<string, Koblingsgruppe>): boolean {
  return Object.values(grupper).some((g) => g.rutekoder.includes(kode));
}

/** BAMA dag-rute koblet med ukedags-prefiks (1520 + 1112 på mandag osv.). */
const BAMA_DAG_KOBLINGER: { bama: string; base: string }[] = [
  { bama: "1520", base: "112" },
];

function ensureBamaDagKoblinger(
  slots: MasterRuteSlot[],
  grupper: Record<string, Koblingsgruppe>,
): { slots: MasterRuteSlot[]; grupper: Record<string, Koblingsgruppe> } {
  const alleKoder = new Set(slots.map((s) => s.rutekode));
  let outGrupper = grupper;
  let outSlots = slots;

  for (const { bama, base } of BAMA_DAG_KOBLINGER) {
    if (!alleKoder.has(bama)) continue;
    for (let dag = 1; dag <= 6; dag++) {
      const dagRute = `${dag}${base}`;
      if (!alleKoder.has(dagRute)) continue;
      const navn = `${bama}+${dagRute}:d${dag}`;
      if (outGrupper[navn]) continue;
      const kobling: Koblingsgruppe = {
        rutekoder: sorterRutekoder([bama, dagRute]),
        dag: dag as 1 | 2 | 3 | 4 | 5 | 6,
      };
      outGrupper = { ...outGrupper, [navn]: kobling };
      outSlots = merkSlotsMedGruppe(outSlots, navn, kobling.rutekoder, kobling);
    }
  }

  return { slots: outSlots, grupper: outGrupper };
}

function merkSlotsMedGruppe(
  slots: MasterRuteSlot[],
  gruppenavn: string,
  rutekoder: readonly string[],
  kobling: Koblingsgruppe,
): MasterRuteSlot[] {
  const kodSet = new Set(rutekoder);
  return slots.map((s) => {
    if (!kodSet.has(s.rutekode)) return s;
    if (kobling.skift && s.skift !== kobling.skift) return s;
    if (kobling.dag && s.dag !== kobling.dag) return s;
    return { ...s, koblingsgruppe: gruppenavn };
  });
}

/**
 * Sikrer at koblingsgrupper finnes og at slots er merket.
 * - Gjenoppretter dict fra slot.koblingsgruppe
 * - Legger til standard splitt-rute-koblinger (1128-1 ⟷ 1128-2) når de mangler
 * - Legger til BAMA Hamar (1520) + x112 per ukedag (1112–5112) når de mangler
 */
export function ensureKoblingsgrupper(plan: MasterRuteplan): MasterRuteplan {
  let grupper = rehydrateFraSlots(plan.slots, plan.koblingsgrupper ?? {});
  let slots = plan.slots;

  const alleKoder = [...new Set(slots.map((s) => s.rutekode))];
  for (const [navn, koder] of splittRuteGrupper(alleKoder)) {
    if (koder.some((k) => ruteErKoblet(k, grupper))) continue;
    const kobling: Koblingsgruppe = { rutekoder: koder };
    grupper = { ...grupper, [navn]: kobling };
    slots = merkSlotsMedGruppe(slots, navn, koder, kobling);
  }

  ({ slots, grupper } = ensureBamaDagKoblinger(slots, grupper));

  // Synk slot.koblingsgruppe for alle grupper i dict
  for (const [navn, kobling] of Object.entries(grupper)) {
    slots = merkSlotsMedGruppe(slots, navn, kobling.rutekoder, kobling);
  }

  return {
    ...plan,
    slots,
    koblingsgrupper: Object.keys(grupper).length > 0 ? grupper : undefined,
  };
}
