"use client";

import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { syklusUkeFraDato, ukedag1til7FraDato } from "@/lib/imported/ringnesCycle";
import { useModulSøkFraUrl } from "@/lib/hooks/useModulSøkFraUrl";
import { useAnsattStore } from "@/lib/state/ansattStore";
import {
  fullNavn,
  type Ansatt,
  type Bil,
  type BilUtilgjengelig,
  type DagEndring,
  type Fravær,
  type Henger,
  type HengerUtilgjengelig,
  type MasterRuteSlot,
  type PlanRuteTildeling,
  type Skift,
} from "@/lib/domain";
import {
  erBilIUtilgjengeligPeriodePåDato,
  erBilUtilgjengeligPåDato,
  erHengerIUtilgjengeligPeriodePåDato,
  erHengerUtilgjengeligPåDato,
  overlapperUtilgjengeligPeriodeDisponibilitet,
} from "@/lib/kjoretoyTilgjengelighet";
import { useBilStore } from "@/lib/state/bilStore";
import { useBilUtilgjengeligStore } from "@/lib/state/bilUtilgjengeligStore";
import {
  dagEndringId,
  dagKoblingOpphevetId,
  useDagEndringStore,
} from "@/lib/state/dagEndringStore";
import { useFraværStore } from "@/lib/state/fravaerStore";
import { useHengerStore } from "@/lib/state/hengerStore";
import { useHengerUtilgjengeligStore } from "@/lib/state/hengerUtilgjengeligStore";
import { useMasterplanStore } from "@/lib/state/masterplanStore";
import {
  planRuteSlotId,
  usePlanRuteTildelingStore,
} from "@/lib/state/planRuteTildelingStore";
import PlanKjoretoyVelger from "./PlanKjoretoyVelger";
import { slotMatcherModulSøk } from "@/lib/utils/søkMatch";
import { useBekreftDialog } from "@/components/useBekreftDialog";
import {
  motsattSkift,
  sjåførMotpartsskiftGrunn,
  sjåførerJobberPåSkift,
} from "@/lib/plan/sjåførTilgjengelighet";
import styles from "./page.module.css";

const DRAG_MIME = "application/x-bemanning-plan-ansatt";

type PlanSkift = "Dag" | "Kveld";

type DragAnsattPayload = { ansattId: string; fraRute?: string };

function isoDato(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODateInput(value: string): Date {
  const [y, m, d] = value.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}


function normalizeNavn(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function bilTekst(b: Bil): string {
  const mm = [b.merke, b.modell].filter(Boolean).join(" ");
  return mm ? `${b.kjennemerke} · ${mm}` : b.kjennemerke;
}

function hengerTekst(h: Henger): string {
  return h.type ? `${h.kjennemerke} · ${h.type}` : h.kjennemerke;
}

function overlapperDato(p: { fraDato: string; tilDato?: string }, dato: string): boolean {
  if (dato < p.fraDato) return false;
  if (!p.tilDato) return true;
  return dato <= p.tilDato;
}

export default function PlanPage() {
  const { requestBekreft, dialog: bekreftDialog } = useBekreftDialog();
  const [skift, setSkift] = useState<PlanSkift>("Dag");
  const [dato, setDato] = useState<string>(() => isoDato(new Date()));

  const uke = useMemo(() => syklusUkeFraDato(parseISODateInput(dato)), [dato]);
  const { ansatte } = useAnsattStore();
  const { fravær, lagre: lagreFravær } = useFraværStore();
  const { biler } = useBilStore();
  const { hengere } = useHengerStore();
  const { poster: bilUtilgjengelig } = useBilUtilgjengeligStore();
  const { poster: hengerUtilgjengelig } = useHengerUtilgjengeligStore();
  const { tildelinger, lagre: lagreTildeling, lagreFlere } = usePlanRuteTildelingStore();
  const { masterplan } = useMasterplanStore();
  const { endringer: dagEndringer, lagre: lagreDagEndring, fjern: fjernDagEndring } = useDagEndringStore();
  const [leggTilRuteInput, setLeggTilRuteInput] = useState("");
  const [modulSøk, setModulSøk] = useModulSøkFraUrl();
  const [sjåførSøk, setSjåførSøk] = useState("");
  const [draOverTilgjengelig, setDraOverTilgjengelig] = useState(false);
  const [draOverFravær, setDraOverFravær] = useState(false);

  const dayNo = useMemo(() => ukedag1til7FraDato(parseISODateInput(dato)), [dato]);

  /* ── Koblingsgrupper (filtrert på aktivt skift og dag) ── */

  const koblingsgruppeFraRute = useMemo(() => {
    const m = new Map<string, string>();
    if (masterplan.koblingsgrupper) {
      for (const [gruppe, kobling] of Object.entries(masterplan.koblingsgrupper)) {
        if (kobling.skift && kobling.skift !== skift) continue;
        if (kobling.dag && kobling.dag !== dayNo) continue;
        for (const kode of kobling.rutekoder) m.set(kode, gruppe);
      }
    }
    return m;
  }, [masterplan.koblingsgrupper, skift, dayNo]);

  const ruterIKoblingsgruppe = useMemo(() => {
    const m = new Map<string, string[]>();
    if (masterplan.koblingsgrupper) {
      for (const [gruppe, kobling] of Object.entries(masterplan.koblingsgrupper)) {
        if (kobling.skift && kobling.skift !== skift) continue;
        if (kobling.dag && kobling.dag !== dayNo) continue;
        m.set(gruppe, kobling.rutekoder);
      }
    }
    return m;
  }, [masterplan.koblingsgrupper, skift, dayNo]);

  /* ── Effektive ruter: master-slots + dag-endringer ── */

  const masterSlotsForDag = useMemo(
    () =>
      masterplan.slots.filter(
        (s) => s.uke === uke && s.dag === dayNo && s.skift === skift,
      ),
    [masterplan.slots, uke, dayNo, skift],
  );

  const dagEndringerForDag = useMemo(
    () => dagEndringer.filter((e) => e.dato === dato && e.skift === skift),
    [dagEndringer, dato, skift],
  );

  const opphevedeKoblinger = useMemo(() => {
    const set = new Set<string>();
    for (const e of dagEndringerForDag) {
      if (e.type !== "kobling_opphevet") continue;
      if (e.koblingsgruppe) set.add(e.koblingsgruppe);
      if (e.rutekoder && e.rutekoder.length >= 2) {
        set.add([...e.rutekoder].sort().join("|"));
      }
    }
    return set;
  }, [dagEndringerForDag]);

  const effektiveRuter = useMemo(() => {
    const fjernede = new Set(
      dagEndringerForDag.filter((e) => e.type === "fjernet").map((e) => e.rutekode),
    );
    const fra_master: MasterRuteSlot[] = masterSlotsForDag.filter(
      (s) => !fjernede.has(s.rutekode),
    );
    const lagtTil: MasterRuteSlot[] = dagEndringerForDag
      .filter((e) => e.type === "lagt_til")
      .map((e) => ({
        id: `dag-${e.id}`,
        uke,
        dag: dayNo as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        skift: skift as Skift,
        rutekode: e.rutekode,
        rutenavn: e.rutenavn,
      }));
    return [...fra_master, ...lagtTil];
  }, [masterSlotsForDag, dagEndringerForDag, uke, dayNo, skift]);

  function erKoblingOpphevetForDag(gruppeKey: string, rutekoder: string[]): boolean {
    if (gruppeKey && opphevedeKoblinger.has(gruppeKey)) return true;
    if (rutekoder.length >= 2) {
      return opphevedeKoblinger.has([...rutekoder].sort().join("|"));
    }
    return false;
  }

  function finnKoblingForRute(
    rutekode: string,
  ): { gruppeKey: string; rutekoder: string[] } | null {
    const gruppe = koblingsgruppeFraRute.get(rutekode);
    if (gruppe) {
      const rutekoder = ruterIKoblingsgruppe.get(gruppe) ?? [];
      if (rutekoder.length >= 2) return { gruppeKey: gruppe, rutekoder };
    }
    const slot = effektiveRuter.find((s) => s.rutekode === rutekode);
    if (slot?.koblingsgruppe) {
      const rutekoder = effektiveRuter
        .filter((s) => s.koblingsgruppe === slot.koblingsgruppe)
        .map((s) => s.rutekode);
      if (rutekoder.length >= 2) return { gruppeKey: slot.koblingsgruppe, rutekoder };
    }
    return null;
  }

  function koblingLagringsNøkkel(info: { gruppeKey: string; rutekoder: string[] }): string {
    return info.gruppeKey || [...info.rutekoder].sort().join("|");
  }

  function kobleteMedRute(rutekode: string): string[] {
    const gruppe = koblingsgruppeFraRute.get(rutekode);
    if (gruppe) {
      const alle = ruterIKoblingsgruppe.get(gruppe) ?? [];
      if (erKoblingOpphevetForDag(gruppe, alle)) return [];
      return alle.filter((k) => k !== rutekode);
    }
    const slot = effektiveRuter.find((s) => s.rutekode === rutekode);
    if (slot?.koblingsgruppe) {
      const alle = effektiveRuter
        .filter((s) => s.koblingsgruppe === slot.koblingsgruppe)
        .map((s) => s.rutekode);
      if (erKoblingOpphevetForDag(slot.koblingsgruppe, alle)) return [];
      return alle.filter((k) => k !== rutekode);
    }
    return [];
  }

  async function opphevKoblingForDag(rutekode: string) {
    const info = finnKoblingForRute(rutekode);
    if (!info) return;
    const nøkkel = koblingLagringsNøkkel(info);
    const liste = info.rutekoder.join(", ");
    const ok = await requestBekreft(
      `Oppheve kobling mellom ${liste} for ${dato} (${skift})?\n\nRutene kan planlegges separat denne dagen. Masterplan endres ikke.`,
    );
    if (!ok) return;
    lagreDagEndring({
      id: dagKoblingOpphevetId(dato, skift as Skift, nøkkel),
      dato,
      skift: skift as Skift,
      type: "kobling_opphevet",
      rutekode: info.rutekoder[0],
      koblingsgruppe: info.gruppeKey || undefined,
      rutekoder: info.rutekoder,
    });
  }

  async function gjenopprettKoblingForDag(rutekode: string) {
    const info = finnKoblingForRute(rutekode);
    if (!info) return;
    const nøkkel = koblingLagringsNøkkel(info);
    const liste = info.rutekoder.join(", ");
    const ok = await requestBekreft(
      `Gjenopprette kobling mellom ${liste} for ${dato} (${skift})?\n\nSjåfør, bil og henger deles igjen mellom rutene.`,
    );
    if (!ok) return;
    fjernDagEndring(dagKoblingOpphevetId(dato, skift as Skift, nøkkel));
  }

  /* ── Tildelinger og oppslag ── */

  const tildelingMap = useMemo(() => {
    const m = new Map<string, PlanRuteTildeling>();
    for (const t of tildelinger) {
      if (t.uke === uke && t.dag === dayNo && t.skift === skift) {
        m.set(t.rute, t);
      }
    }
    return m;
  }, [tildelinger, uke, dayNo, skift]);

  const ansattById = useMemo(() => {
    const m = new Map<string, Ansatt>();
    for (const a of ansatte) m.set(a.id, a);
    return m;
  }, [ansatte]);

  const bilerValgbarePre = useMemo(
    () =>
      [...biler].sort((a, b) =>
        a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }),
      ),
    [biler],
  );

  const hengereValgbarePre = useMemo(
    () =>
      [...hengere].sort((a, b) =>
        a.kjennemerke.localeCompare(b.kjennemerke, "nb", { numeric: true }),
      ),
    [hengere],
  );

  const ansattNavnById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of ansatte) m.set(a.id, fullNavn(a));
    return m;
  }, [ansatte]);

  const bilById = useMemo(() => new Map(biler.map((b) => [b.id, b] as const)), [biler]);
  const hengerById = useMemo(() => new Map(hengere.map((h) => [h.id, h] as const)), [hengere]);

  const synligeRuter = useMemo(() => {
    const q = modulSøk.trim();
    if (!q) return effektiveRuter;
    const ctx = { ansattById, bilById, hengerById };
    return effektiveRuter.filter((slot) =>
      slotMatcherModulSøk(slot, q, {
        ...ctx,
        tildeling: tildelingMap.get(slot.rutekode),
      }),
    );
  }, [effektiveRuter, modulSøk, ansattById, bilById, hengerById, tildelingMap]);

  const bilPosterPåDato = useMemo(
    () => bilUtilgjengelig.filter((p) => overlapperUtilgjengeligPeriodeDisponibilitet(dato, p)),
    [bilUtilgjengelig, dato],
  );

  const hengerPosterPåDato = useMemo(
    () => hengerUtilgjengelig.filter((p) => overlapperUtilgjengeligPeriodeDisponibilitet(dato, p)),
    [hengerUtilgjengelig, dato],
  );

  /** Dagens bil/henger-valg deles innen koblingsgruppe (som ved lagring). */
  function tildelingKjoretoyForRute(rute: string): PlanRuteTildeling | undefined {
    const egen = tildelingMap.get(rute);
    if (
      egen?.bilId ||
      egen?.hengerId ||
      egen?.skjulBaselineBil ||
      egen?.skjulBaselineHenger
    ) {
      return egen;
    }
    for (const kr of kobleteMedRute(rute)) {
      const kTil = tildelingMap.get(kr);
      if (
        kTil?.bilId ||
        kTil?.hengerId ||
        kTil?.skjulBaselineBil ||
        kTil?.skjulBaselineHenger
      ) {
        return kTil;
      }
    }
    return egen;
  }

  /* ── Effektiv sjåfør/bil/henger per rute (master → sjekk → overstyring) ── */

  function ansattHarFraværPåDato(ansattId: string): boolean {
    return fravær.some((f) => f.ansattId === ansattId && overlapperDato(f, dato));
  }

  function effektivRessursForSlot(
    slot: MasterRuteSlot,
    til: PlanRuteTildeling | undefined,
  ): {
    sjåfør: Ansatt | undefined;
    sjåførFraMaster: boolean;
    sjåførHarFravær: boolean;
    bilId: string | undefined;
    bilFraMaster: boolean;
    bilUtilgjengelig: boolean;
    hengerId: string | undefined;
    hengerFraMaster: boolean;
    hengerUtilgjengeligFlag: boolean;
  } {
    // Sjåfør
    let sjåfør: Ansatt | undefined;
    let sjåførFraMaster = false;
    let sjåførHarFravær = false;

    if (til?.ansattId) {
      sjåfør = ansattById.get(til.ansattId);
    } else if (til?.skjulBaselineSjåfør) {
      sjåfør = undefined;
    } else if (slot.standardSjåførAnsattId) {
      sjåfør = ansattById.get(slot.standardSjåførAnsattId);
      sjåførFraMaster = true;
    }

    if (sjåfør && !sjåfør.aktiv) {
      sjåfør = undefined;
    }

    if (sjåfør && ansattHarFraværPåDato(sjåfør.id)) {
      sjåførHarFravær = true;
      if (sjåførFraMaster) {
        sjåfør = undefined;
      }
    }

    const tilKj = tildelingKjoretoyForRute(slot.rutekode);
    const planSjåførOverstyrt = Boolean(til?.ansattId);

    // Bil
    let bilId = tilKj?.bilId;
    let bilFraMaster = false;
    if (!(tilKj?.skjulBaselineBil && !tilKj?.bilId)) {
      if (!bilId && slot.standardBilId && !planSjåførOverstyrt) {
        bilId = slot.standardBilId;
        bilFraMaster = true;
      }
      // Ikke arv fast bil fra manuelt innsatt sjåfør i Plan — bil velges eksplisitt der.
      if (!bilId && sjåfør?.fastBilId && !planSjåførOverstyrt) {
        bilId = sjåfør.fastBilId;
        bilFraMaster = true;
      }
      // Arv fra koblet rute
      if (!bilId) {
        for (const kr of kobleteMedRute(slot.rutekode)) {
          const kTil = tildelingMap.get(kr);
          if (kTil?.bilId) { bilId = kTil.bilId; bilFraMaster = false; break; }
          if (kTil?.skjulBaselineBil) continue;
          const kSlot = effektiveRuter.find((s) => s.rutekode === kr);
          if (kSlot?.standardBilId) { bilId = kSlot.standardBilId; bilFraMaster = true; break; }
        }
      }
    } else {
      bilId = undefined;
    }
    const bilUtilgjengeligFlag =
      Boolean(bilId) && erBilUtilgjengeligPåDato(bilId!, dato, bilUtilgjengelig);

    // Henger
    let hengerId = tilKj?.hengerId;
    let hengerFraMaster = false;
    if (!(tilKj?.skjulBaselineHenger && !tilKj?.hengerId)) {
      if (!hengerId && slot.standardHengerId && !planSjåførOverstyrt) {
        hengerId = slot.standardHengerId;
        hengerFraMaster = true;
      }
      if (!hengerId && sjåfør?.fastHengerId && !planSjåførOverstyrt) {
        hengerId = sjåfør.fastHengerId;
        hengerFraMaster = true;
      }
      // Arv fra koblet rute
      if (!hengerId) {
        for (const kr of kobleteMedRute(slot.rutekode)) {
          const kTil = tildelingMap.get(kr);
          if (kTil?.hengerId) { hengerId = kTil.hengerId; hengerFraMaster = false; break; }
          if (kTil?.skjulBaselineHenger) continue;
          const kSlot = effektiveRuter.find((s) => s.rutekode === kr);
          if (kSlot?.standardHengerId) { hengerId = kSlot.standardHengerId; hengerFraMaster = true; break; }
        }
      }
    } else {
      hengerId = undefined;
    }
    const hengerUtilgjengeligFlag =
      Boolean(hengerId) && erHengerUtilgjengeligPåDato(hengerId!, dato, hengerUtilgjengelig);

    return {
      sjåfør,
      sjåførFraMaster,
      sjåførHarFravær,
      bilId,
      bilFraMaster,
      bilUtilgjengelig: bilUtilgjengeligFlag,
      hengerId,
      hengerFraMaster,
      hengerUtilgjengeligFlag,
    };
  }

  /** Masterplanens kjøretøy for ruten (inkl. arv fra koblede ruter) — uavhengig av «—» på dagen. */
  function masterplanBilIdForSlot(slot: MasterRuteSlot): string | undefined {
    if (slot.standardBilId) return slot.standardBilId;
    if (slot.standardSjåførAnsattId) {
      const fast = ansattById.get(slot.standardSjåførAnsattId)?.fastBilId;
      if (fast) return fast;
    }
    for (const kr of kobleteMedRute(slot.rutekode)) {
      const kSlot = effektiveRuter.find((s) => s.rutekode === kr);
      if (!kSlot) continue;
      if (kSlot.standardBilId) return kSlot.standardBilId;
      if (kSlot.standardSjåførAnsattId) {
        const fast = ansattById.get(kSlot.standardSjåførAnsattId)?.fastBilId;
        if (fast) return fast;
      }
    }
    return undefined;
  }

  function masterplanHengerIdForSlot(slot: MasterRuteSlot): string | undefined {
    if (slot.standardHengerId) return slot.standardHengerId;
    if (slot.standardSjåførAnsattId) {
      const fast = ansattById.get(slot.standardSjåførAnsattId)?.fastHengerId;
      if (fast) return fast;
    }
    for (const kr of kobleteMedRute(slot.rutekode)) {
      const kSlot = effektiveRuter.find((s) => s.rutekode === kr);
      if (!kSlot) continue;
      if (kSlot.standardHengerId) return kSlot.standardHengerId;
      if (kSlot.standardSjåførAnsattId) {
        const fast = ansattById.get(kSlot.standardSjåførAnsattId)?.fastHengerId;
        if (fast) return fast;
      }
    }
    return undefined;
  }

  /* ── Ressurser blokkert av flerdagsruter (fra foregående dager) ── */

  const KVELD_SKIFT_START = "15:00";

  const blokkerteAvFlerdagsruter = useMemo(() => {
    const blokkerteAnsatte = new Set<string>();
    const blokkerteBiler = new Set<string>();
    const blokkerteHengere = new Set<string>();

    const datoObj = parseISODateInput(dato);

    for (let offset = 1; offset <= 2; offset++) {
      const prevDate = new Date(datoObj);
      prevDate.setDate(prevDate.getDate() - offset);
      const prevDayNo = ukedag1til7FraDato(prevDate);
      const prevUke = syklusUkeFraDato(prevDate);

      const slotsForPrev = masterplan.slots.filter(
        (s) => s.uke === prevUke && s.dag === prevDayNo && s.varighet && s.varighet > offset,
      );

      for (const slot of slotsForPrev) {
        const erReturdagen = slot.varighet === offset + 1;
        const rutenFerdigFørKveld = erReturdagen && slot.sluttTid && slot.sluttTid <= KVELD_SKIFT_START;

        const prevTil = tildelinger.find(
          (t) => t.uke === prevUke && t.dag === prevDayNo && t.skift === slot.skift && t.rute === slot.rutekode,
        );

        const ansattId = prevTil?.ansattId ?? slot.standardSjåførAnsattId;
        const bilId = prevTil?.bilId ?? slot.standardBilId;
        const hengerId = prevTil?.hengerId ?? slot.standardHengerId;

        if (skift === "Kveld" && rutenFerdigFørKveld) {
          // Ruten er ferdig før kveldsskiftet — bil og henger frigjøres.
          // Sjåfør er fortsatt blokkert (ferdig for dagen).
          if (ansattId) blokkerteAnsatte.add(ansattId);
        } else {
          if (ansattId) blokkerteAnsatte.add(ansattId);
          if (bilId) blokkerteBiler.add(bilId);
          if (hengerId) blokkerteHengere.add(hengerId);
        }
      }
    }

    return { blokkerteAnsatte, blokkerteBiler, blokkerteHengere };
  }, [masterplan.slots, tildelinger, dato, skift]);

  /** Kun manuell plan-tildeling (ikke master/fast bil) — brukes til dropdown-filter. */
  const planlagteKjøretøy = useMemo(() => {
    const bilTilRute = new Map<string, string>();
    const hengerTilRute = new Map<string, string>();
    for (const slot of effektiveRuter) {
      const til = tildelingMap.get(slot.rutekode);
      if (til?.bilId) bilTilRute.set(til.bilId, slot.rutekode);
      if (til?.hengerId) hengerTilRute.set(til.hengerId, slot.rutekode);
    }
    return { bilTilRute, hengerTilRute };
  }, [effektiveRuter, tildelingMap]);

  function kobleteRuterSet(rute: string): Set<string> {
    return new Set([rute, ...kobleteMedRute(rute)]);
  }

  function bilValgbareForRute(rute: string): Bil[] {
    const koblet = kobleteRuterSet(rute);
    return bilerValgbarePre.filter((b) => {
      if (!b.aktiv) return false;
      if (erBilUtilgjengeligPåDato(b.id, dato, bilUtilgjengelig)) return false;
      if (blokkerteAvFlerdagsruter.blokkerteBiler.has(b.id)) return false;
      const bruktPå = planlagteKjøretøy.bilTilRute.get(b.id);
      if (bruktPå && !koblet.has(bruktPå)) return false;
      return true;
    });
  }

  function hengerValgbareForRute(rute: string): Henger[] {
    const koblet = kobleteRuterSet(rute);
    return hengereValgbarePre.filter((h) => {
      if (!h.aktiv) return false;
      if (erHengerUtilgjengeligPåDato(h.id, dato, hengerUtilgjengelig)) return false;
      if (blokkerteAvFlerdagsruter.blokkerteHengere.has(h.id)) return false;
      const bruktPå = planlagteKjøretøy.hengerTilRute.get(h.id);
      if (bruktPå && !koblet.has(bruktPå)) return false;
      return true;
    });
  }

  function bilUtilgjengeligGrunn(bilId: string): string | undefined {
    const poster = bilPosterPåDato.filter((p) => p.bilId === bilId);
    if (poster.length === 0) return undefined;
    return poster.map((p) => p.type).join(", ");
  }

  function hengerUtilgjengeligGrunn(hengerId: string): string | undefined {
    const poster = hengerPosterPåDato.filter((p) => p.hengerId === hengerId);
    if (poster.length === 0) return undefined;
    return poster.map((p) => p.type).join(", ");
  }

  function bilIkkeValgbarEtikett(bilId: string): string {
    const grunn = bilUtilgjengeligGrunn(bilId);
    if (grunn) return grunn;
    if (planlagteKjøretøy.bilTilRute.has(bilId)) return "Planlagt";
    if (blokkerteAvFlerdagsruter.blokkerteBiler.has(bilId)) return "Flerdagstur";
    return "Utilgjengelig";
  }

  function hengerIkkeValgbarEtikett(hengerId: string): string {
    const grunn = hengerUtilgjengeligGrunn(hengerId);
    if (grunn) return grunn;
    if (planlagteKjøretøy.hengerTilRute.has(hengerId)) return "Planlagt";
    if (blokkerteAvFlerdagsruter.blokkerteHengere.has(hengerId)) return "Flerdagstur";
    return "Utilgjengelig";
  }

  function bilErLedigForRute(bilId: string, rute: string): boolean {
    return bilValgbareForRute(rute).some((b) => b.id === bilId);
  }

  function hengerErLedigForRute(hengerId: string, rute: string): boolean {
    return hengerValgbareForRute(rute).some((h) => h.id === hengerId);
  }

  /* ── Tilgjengelige ansatte ── */

  const sjåførerPåMotsattSkift = useMemo(
    () =>
      sjåførerJobberPåSkift({
        uke,
        dag: dayNo,
        dato,
        skift: motsattSkift(skift),
        masterSlots: masterplan.slots,
        dagEndringer,
        tildelinger,
        erAktivSjåfør: (id) => ansattById.get(id)?.aktiv === true,
        harFravær: (id) => fravær.some((f) => f.ansattId === id && overlapperDato(f, dato)),
      }),
    [
      uke,
      dayNo,
      dato,
      skift,
      masterplan.slots,
      dagEndringer,
      tildelinger,
      ansattById,
      fravær,
    ],
  );

  const tilgjengeligeAnsatte = useMemo(() => {
    const blocked = new Set<string>();

    for (const slot of effektiveRuter) {
      const til = tildelingMap.get(slot.rutekode);
      const res = effektivRessursForSlot(slot, til);
      if (res.sjåfør) blocked.add(res.sjåfør.id);
    }

    for (const id of sjåførerPåMotsattSkift.keys()) blocked.add(id);
    for (const id of blokkerteAvFlerdagsruter.blokkerteAnsatte) blocked.add(id);

    return ansatte
      .filter((a) => {
        if (!a.aktiv) return false;
        if (a.selskap && a.selskap !== "Asko") return false;
        if (blocked.has(a.id)) return false;
        const harFravær = fravær.some(
          (f) => f.ansattId === a.id && overlapperDato(f, dato),
        );
        const bilBlokk =
          Boolean(a.fastBilId) &&
          erBilUtilgjengeligPåDato(a.fastBilId!, dato, bilUtilgjengelig);
        const hengBlokk =
          Boolean(a.fastHengerId) &&
          erHengerUtilgjengeligPåDato(a.fastHengerId!, dato, hengerUtilgjengelig);
        return !harFravær && !bilBlokk && !hengBlokk;
      })
      .slice()
      .sort((a, b) => fullNavn(a).localeCompare(fullNavn(b), "nb"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ansatte,
    bilUtilgjengelig,
    blokkerteAvFlerdagsruter,
    dato,
    effektiveRuter,
    fravær,
    hengerUtilgjengelig,
    sjåførerPåMotsattSkift,
    tildelingMap,
  ]);

  const tilgjengeligeIdSet = useMemo(
    () => new Set(tilgjengeligeAnsatte.map((a) => a.id)),
    [tilgjengeligeAnsatte],
  );

  const utilgjengeligeGrunner = useMemo(() => {
    const map = new Map<string, string>();
    const tildeltPåRute = new Map<string, string>();
    for (const slot of effektiveRuter) {
      const til = tildelingMap.get(slot.rutekode);
      const res = effektivRessursForSlot(slot, til);
      if (res.sjåfør) tildeltPåRute.set(res.sjåfør.id, slot.rutekode);
    }

    for (const a of ansatte) {
      if (tilgjengeligeIdSet.has(a.id)) continue;
      if (a.selskap && a.selskap !== "Asko") continue;
      const grunner: string[] = [];
      if (!a.aktiv) grunner.push("Inaktiv");
      if (fravær.some((f) => f.ansattId === a.id && overlapperDato(f, dato))) {
        const ftype = fravær.find((f) => f.ansattId === a.id && overlapperDato(f, dato))?.type;
        grunner.push(ftype ?? "Fravær");
      }
      if (tildeltPåRute.has(a.id)) grunner.push(`På rute ${tildeltPåRute.get(a.id)}`);
      const motRute = sjåførerPåMotsattSkift.get(a.id);
      if (motRute) {
        grunner.push(sjåførMotpartsskiftGrunn(motsattSkift(skift), motRute));
      }
      if (blokkerteAvFlerdagsruter.blokkerteAnsatte.has(a.id)) grunner.push("Flerdagstur");
      if (grunner.length > 0) map.set(a.id, grunner.join(", "));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ansatte,
    tilgjengeligeIdSet,
    effektiveRuter,
    tildelingMap,
    fravær,
    dato,
    skift,
    blokkerteAvFlerdagsruter,
    sjåførerPåMotsattSkift,
  ]);

  const filtrerteAnsatte = useMemo(() => {
    const q = sjåførSøk.trim().toLowerCase();
    if (!q) return { tilgjengelige: tilgjengeligeAnsatte, utilgjengelige: [] as (Ansatt & { grunn: string })[] };

    const tilgjengelige = tilgjengeligeAnsatte.filter((a) =>
      fullNavn(a).toLowerCase().includes(q),
    );

    const utilgjengelige = ansatte
      .filter((a) => {
        if (tilgjengeligeIdSet.has(a.id)) return false;
        if (a.selskap && a.selskap !== "Asko") return false;
        if (!utilgjengeligeGrunner.has(a.id)) return false;
        return fullNavn(a).toLowerCase().includes(q);
      })
      .map((a) => ({ ...a, grunn: utilgjengeligeGrunner.get(a.id)! }))
      .sort((a, b) => fullNavn(a).localeCompare(fullNavn(b), "nb"));

    return { tilgjengelige, utilgjengelige };
  }, [tilgjengeligeAnsatte, sjåførSøk, ansatte, tilgjengeligeIdSet, utilgjengeligeGrunner]);

  /* ── Slot-hjelpere og DnD ── */

  function slotForRute(
    rute: string,
    patch: Partial<
      Pick<
        PlanRuteTildeling,
        "bilId" | "hengerId" | "skjulBaselineSjåfør" | "skjulBaselineBil" | "skjulBaselineHenger"
      >
    > & { ansattId?: string | null },
  ): PlanRuteTildeling {
    const cur = tildelingMap.get(rute);
    const harAnsattPatch = "ansattId" in patch;
    const harBilPatch = "bilId" in patch;
    const harHengerPatch = "hengerId" in patch;
    return {
      id: planRuteSlotId(uke, dayNo, skift as Skift, rute),
      uke,
      dag: dayNo as PlanRuteTildeling["dag"],
      skift: skift as Skift,
      rute,
      ansattId: harAnsattPatch ? (patch.ansattId || undefined) : cur?.ansattId,
      bilId: harBilPatch ? patch.bilId || undefined : cur?.bilId,
      hengerId: harHengerPatch ? patch.hengerId || undefined : cur?.hengerId,
      skjulBaselineSjåfør:
        "skjulBaselineSjåfør" in patch ? patch.skjulBaselineSjåfør : cur?.skjulBaselineSjåfør,
      skjulBaselineBil: "skjulBaselineBil" in patch ? patch.skjulBaselineBil : cur?.skjulBaselineBil,
      skjulBaselineHenger:
        "skjulBaselineHenger" in patch ? patch.skjulBaselineHenger : cur?.skjulBaselineHenger,
    };
  }

  function lagreSlot(
    rute: string,
    patch: Partial<
      Pick<
        PlanRuteTildeling,
        | "ansattId"
        | "bilId"
        | "hengerId"
        | "skjulBaselineSjåfør"
        | "skjulBaselineBil"
        | "skjulBaselineHenger"
      >
    >,
  ) {
    lagreTildeling(slotForRute(rute, patch));
  }

  function handleDragStartAnsatt(e: DragEvent, payload: DragAnsattPayload) {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOverSlot(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDropPåRute(e: DragEvent, ruteKode: string) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragAnsattPayload;
    try {
      payload = JSON.parse(raw) as DragAnsattPayload;
    } catch {
      return;
    }
    const { ansattId, fraRute } = payload;
    if (!ansattId) return;
    if (fraRute === ruteKode) return;

    const grunn = utilgjengeligeGrunner.get(ansattId);
    if (grunn) {
      const a = ansatte.find((x) => x.id === ansattId);
      const navn = a ? fullNavn(a) : ansattId;
      const ok = await requestBekreft(
        `${navn} er ikke tilgjengelig (${grunn}). Vil du sette inn likevel?`,
      );
      if (!ok) return;
    }

    const målRuter = [ruteKode, ...kobleteMedRute(ruteKode)];
    const målSet = new Set(målRuter);

    const items: PlanRuteTildeling[] = [];

    for (const slot of effektiveRuter) {
      if (målSet.has(slot.rutekode)) continue;
      const t = tildelingMap.get(slot.rutekode);
      if (t?.ansattId !== ansattId) continue;
      if (fraRute && slot.rutekode === fraRute) continue;
      items.push(slotForRute(slot.rutekode, { ansattId: undefined }));
    }

    if (fraRute && !målSet.has(fraRute)) {
      items.push(slotForRute(fraRute, { ansattId: undefined, skjulBaselineSjåfør: true }));
    }

    for (const mål of målRuter) {
      items.push(slotForRute(mål, { ansattId, skjulBaselineSjåfør: false }));
    }

    lagreFlere(items);
  }

  function handleDropFjernSjåfør(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragAnsattPayload;
    try {
      payload = JSON.parse(raw) as DragAnsattPayload;
    } catch {
      return;
    }
    const { fraRute } = payload;
    if (!fraRute) return;
    const ruter = [fraRute, ...kobleteMedRute(fraRute)];
    lagreFlere(ruter.map((r) => slotForRute(r, { ansattId: undefined, skjulBaselineSjåfør: true })));
  }

  function handleDropRegistrerFravær(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragAnsattPayload;
    try {
      payload = JSON.parse(raw) as DragAnsattPayload;
    } catch {
      return;
    }
    const { ansattId, fraRute } = payload;
    if (!ansattId) return;

    const harOverlapAllerede = fravær.some(
      (f) => f.ansattId === ansattId && overlapperDato(f, dato),
    );
    if (!harOverlapAllerede) {
      const kilde = fraRute ? `rute ${fraRute}` : "tilgjengelig";
      const ny: Fravær = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `f-${Date.now()}`,
        ansattId,
        type: "Syk",
        fraDato: dato,
        tilDato: dato,
        planlagt: false,
        kommentar: `Registrert fra Plan (${kilde}, ${dato})`,
      };
      lagreFravær(ny);
    }

    if (fraRute) {
      lagreSlot(fraRute, { ansattId: undefined, skjulBaselineSjåfør: true });
    }
  }

  function oppdaterTildeling(
    rute: string,
    felt: "bilId" | "hengerId",
    verdi: string,
  ) {
    let patch: Partial<
      Pick<PlanRuteTildeling, "bilId" | "hengerId" | "skjulBaselineBil" | "skjulBaselineHenger">
    >;
    if (felt === "bilId") {
      if (!verdi || verdi === "__ingen__") {
        patch = { bilId: undefined, skjulBaselineBil: true };
      } else if (verdi === "__baseline__") {
        patch = { bilId: undefined, skjulBaselineBil: false };
      } else {
        patch = { bilId: verdi, skjulBaselineBil: false };
      }
    } else if (!verdi || verdi === "__ingen__") {
      patch = { hengerId: undefined, skjulBaselineHenger: true };
    } else if (verdi === "__baseline__") {
      patch = { hengerId: undefined, skjulBaselineHenger: false };
    } else {
      patch = { hengerId: verdi, skjulBaselineHenger: false };
    }

    const målRuter = [rute, ...kobleteMedRute(rute)];
    const items = målRuter.map((r) => slotForRute(r, patch));
    lagreFlere(items);
  }

  function bilSelectVerdi(
    til: PlanRuteTildeling | undefined,
    res: { bilId?: string; bilFraMaster: boolean },
  ): string {
    if (til?.bilId) return til.bilId;
    if (til?.skjulBaselineBil) return "__ingen__";
    if (res.bilId && res.bilFraMaster) return "__baseline__";
    if (res.bilId) return res.bilId;
    return "__ingen__";
  }

  function hengerSelectVerdi(
    til: PlanRuteTildeling | undefined,
    res: { hengerId?: string; hengerFraMaster: boolean },
  ): string {
    if (til?.hengerId) return til.hengerId;
    if (til?.skjulBaselineHenger) return "__ingen__";
    if (res.hengerId && res.hengerFraMaster) return "__baseline__";
    if (res.hengerId) return res.hengerId;
    return "__ingen__";
  }

  /** Status i Plan: bil/henger må være eksplisitt valgt — ikke implisitt via sjåførens fast kjøretøy. */
  function planHarBilTildelt(
    tilKj: PlanRuteTildeling | undefined,
    slot: MasterRuteSlot,
    res: { bilId?: string; bilFraMaster: boolean },
  ): boolean {
    const sel = bilSelectVerdi(tilKj, res);
    if (sel === "__ingen__") return false;
    if (sel === "__baseline__") return Boolean(masterplanBilIdForSlot(slot));
    return true;
  }

  function planHarHengerTildelt(
    tilKj: PlanRuteTildeling | undefined,
    slot: MasterRuteSlot,
    res: { hengerId?: string; hengerFraMaster: boolean },
  ): boolean {
    const sel = hengerSelectVerdi(tilKj, res);
    if (sel === "__ingen__") return false;
    if (sel === "__baseline__") return Boolean(masterplanHengerIdForSlot(slot));
    return true;
  }

  /* ── Dynamisk: fjern/legg til rute for denne dagen ── */

  const fjernedeRuterForDag = useMemo(
    () => dagEndringerForDag.filter((e) => e.type === "fjernet"),
    [dagEndringerForDag],
  );

  const lagtTilRuterForDag = useMemo(
    () => new Set(dagEndringerForDag.filter((e) => e.type === "lagt_til").map((e) => e.rutekode)),
    [dagEndringerForDag],
  );

  function fjernRuteFraDag(rutekode: string, rutenavn?: string) {
    if (lagtTilRuterForDag.has(rutekode)) {
      // Ruten var dynamisk lagt til — bare fjern den "lagt_til"-oppføringen
      const lagtTilId = dagEndringId(dato, skift as Skift, rutekode);
      fjernDagEndring(lagtTilId);
    } else {
      // Ruten er fra master — opprett en "fjernet"-oppføring
      const id = `${dagEndringId(dato, skift as Skift, rutekode)}-fjernet`;
      lagreDagEndring({
        id,
        dato,
        skift: skift as Skift,
        type: "fjernet",
        rutekode,
        rutenavn,
      });
    }
  }

  function angreFjernRute(rutekode: string) {
    const id = `${dagEndringId(dato, skift as Skift, rutekode)}-fjernet`;
    fjernDagEndring(id);
  }

  function leggTilRuteForDag() {
    const kode = leggTilRuteInput.trim();
    if (!kode) return;
    const id = dagEndringId(dato, skift as Skift, kode);
    lagreDagEndring({
      id,
      dato,
      skift: skift as Skift,
      type: "lagt_til",
      rutekode: kode,
    });
    setLeggTilRuteInput("");
  }

  /* ── Beregn sammendrag ── */

  const fraværPåDato = useMemo(
    () => fravær.filter((f) => overlapperDato(f, dato)),
    [fravær, dato],
  );

  const sammendrag = useMemo(() => {
    let ok = 0;
    let rød = 0;
    let gul = 0;
    let blå = 0;
    for (const slot of effektiveRuter) {
      const til = tildelingMap.get(slot.rutekode);
      const res = effektivRessursForSlot(slot, til);
      const tilKj = tildelingKjoretoyForRute(slot.rutekode);
      const bilSel = bilSelectVerdi(tilKj, res);
      const hengSel = hengerSelectVerdi(tilKj, res);
      const mpBil = masterplanBilIdForSlot(slot);
      const mpHeng = masterplanHengerIdForSlot(slot);
      const masterBilV = Boolean(
        mpBil &&
          erBilIUtilgjengeligPeriodePåDato(mpBil, dato, bilUtilgjengelig) &&
          (bilSel === "__ingen__" || bilSel === "__baseline__" || bilSel === mpBil),
      );
      const masterHengV = Boolean(
        mpHeng &&
          erHengerIUtilgjengeligPeriodePåDato(mpHeng, dato, hengerUtilgjengelig) &&
          (hengSel === "__ingen__" || hengSel === "__baseline__" || hengSel === mpHeng),
      );
      const manglerSj = !res.sjåfør;
      const manglerB = !planHarBilTildelt(tilKj, slot, res);
      const manglerH = !planHarHengerTildelt(tilKj, slot, res);
      const utilgj =
        res.bilUtilgjengelig ||
        res.hengerUtilgjengeligFlag ||
        res.sjåførHarFravær ||
        masterBilV ||
        masterHengV;

      if (!manglerSj && !manglerB && !manglerH && !utilgj) ok++;
      else if (manglerSj || manglerB) rød++;
      else if (utilgj) gul++;
      else blå++;
    }
    return { ok, rød, gul, blå };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effektiveRuter, tildelingMap, fravær, dato, bilUtilgjengelig, hengerUtilgjengelig]);

  /* ── Render ── */

  return (
    <div className={styles.page}>
      {/* ── Topplinje ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>Plan</h1>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.dayNavBtn}
            onClick={() => {
              const d = parseISODateInput(dato);
              d.setDate(d.getDate() - 1);
              setDato(isoDato(d));
            }}
            aria-label="Forrige dag"
            title="Forrige dag"
          >
            ‹
          </button>
          <input
            className={styles.input}
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            aria-label="Dato"
          />
          <button
            type="button"
            className={styles.dayNavBtn}
            onClick={() => {
              const d = parseISODateInput(dato);
              d.setDate(d.getDate() + 1);
              setDato(isoDato(d));
            }}
            aria-label="Neste dag"
            title="Neste dag"
          >
            ›
          </button>
          <button
            type="button"
            className={`${styles.dayShortcut}${dato === isoDato(new Date()) ? ` ${styles.dayShortcutActive}` : ""}`}
            onClick={() => setDato(isoDato(new Date()))}
          >
            I dag
          </button>
          <button
            type="button"
            className={`${styles.dayShortcut}${dato === isoDato((() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })()) ? ` ${styles.dayShortcutActive}` : ""}`}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              setDato(isoDato(d));
            }}
          >
            I morgen
          </button>
          <span className={styles.ukeBadge} title="Beregnet automatisk fra dato">
            Uke {uke}
          </span>
          <div className={styles.tabs} role="tablist" aria-label="Skift">
            <button
              type="button"
              role="tab"
              aria-selected={skift === "Dag"}
              className={`${styles.tabBtn} ${skift === "Dag" ? styles.tabBtnActive : ""}`}
              onClick={() => setSkift("Dag")}
            >
              Dag
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={skift === "Kveld"}
              className={`${styles.tabBtn} ${skift === "Kveld" ? styles.tabBtnActive : ""}`}
              onClick={() => setSkift("Kveld")}
            >
              Kveld
            </button>
          </div>
          <input
            className={styles.input}
            type="search"
            value={modulSøk}
            onChange={(e) => setModulSøk(e.target.value)}
            placeholder="Søk rute, navn, bil, henger…"
            aria-label="Søk i ruter"
          />
        </div>
      </header>

      {/* ── Sammendrag ── */}
      <div className={styles.summary}>
        <span>
          {modulSøk.trim()
            ? `${synligeRuter.length} av ${effektiveRuter.length} ruter`
            : `${effektiveRuter.length} ruter`}
        </span>
        <span className={styles.summaryOk}>{sammendrag.ok} OK</span>
        {sammendrag.rød > 0 && (
          <span className={styles.summaryBad}>{sammendrag.rød} mangler sjåfør/bil</span>
        )}
        {sammendrag.gul > 0 && (
          <span className={styles.summaryWarn}>{sammendrag.gul} utilgjengelig</span>
        )}
        {sammendrag.blå > 0 && (
          <span>{sammendrag.blå} uten henger</span>
        )}
        <span>{tilgjengeligeAnsatte.length} tilgjengelige</span>
        <span>{fraværPåDato.length} fraværende</span>
      </div>

      {/* ── Hovedområde ── */}
      <div className={styles.layout}>
        {/* ── Tabell (venstre) ── */}
        <div className={styles.tableArea}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rute</th>
                <th>Navn</th>
                <th>Sjåfør</th>
                <th>Bil</th>
                <th>Henger</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {synligeRuter.map((slot) => {
                const til = tildelingMap.get(slot.rutekode);
                const res = effektivRessursForSlot(slot, til);

                const masterplanBilId = masterplanBilIdForSlot(slot);
                const masterplanHengerId = masterplanHengerIdForSlot(slot);
                const masterBilPaVerksted = Boolean(
                  masterplanBilId &&
                    erBilIUtilgjengeligPeriodePåDato(masterplanBilId, dato, bilUtilgjengelig),
                );
                const masterHengerPaVerksted = Boolean(
                  masterplanHengerId &&
                    erHengerIUtilgjengeligPeriodePåDato(masterplanHengerId, dato, hengerUtilgjengelig),
                );

                const tilKjoretoy = tildelingKjoretoyForRute(slot.rutekode);
                const bilSelectVal = bilSelectVerdi(tilKjoretoy, res);
                const hengerSelectVal = hengerSelectVerdi(tilKjoretoy, res);

                const bilValgtErMaster =
                  bilSelectVal === "__baseline__" ||
                  (masterplanBilId !== undefined && bilSelectVal === masterplanBilId);
                const hengerValgtErMaster =
                  hengerSelectVal === "__baseline__" ||
                  (masterplanHengerId !== undefined && hengerSelectVal === masterplanHengerId);
                const masterBilAdvarsel =
                  masterBilPaVerksted &&
                  (bilSelectVal === "__ingen__" || bilValgtErMaster);
                const masterHengerAdvarsel =
                  masterHengerPaVerksted &&
                  (hengerSelectVal === "__ingen__" || hengerValgtErMaster);

                const manglerSjåfør = !res.sjåfør;
                const manglerBil = !planHarBilTildelt(tilKjoretoy, slot, res);
                const manglerHenger = !planHarHengerTildelt(tilKjoretoy, slot, res);
                const utilgjengelig =
                  res.bilUtilgjengelig ||
                  res.hengerUtilgjengeligFlag ||
                  res.sjåførHarFravær ||
                  masterBilAdvarsel ||
                  masterHengerAdvarsel;

                let statusCell: ReactNode;
                if (!manglerSjåfør && !manglerBil && !manglerHenger && !utilgjengelig) {
                  // Grønn: alt OK
                  statusCell = <span className={`${styles.pill} ${styles.pillOk}`}>OK</span>;
                } else if (manglerSjåfør || manglerBil) {
                  // Rød: sjåfør eller bil mangler
                  const deler: string[] = [];
                  if (res.sjåførHarFravær) deler.push("Sjåfør fravær");
                  else if (manglerSjåfør) deler.push("Sjåfør");
                  if (manglerBil) deler.push("Bil");
                  statusCell = (
                    <span className={`${styles.pill} ${styles.pillBad}`} title={deler.join(", ")}>
                      {deler.join(" · ")}
                    </span>
                  );
                } else if (utilgjengelig) {
                  // Gul: noe er utilgjengelig
                  const deler: string[] = [];
                  if (res.sjåførHarFravær) deler.push("Sjåfør fravær");
                  if (res.bilUtilgjengelig) deler.push("Bil ute");
                  else if (masterBilAdvarsel) deler.push("Masterbil verksted");
                  if (res.hengerUtilgjengeligFlag) deler.push("Henger ute");
                  else if (masterHengerAdvarsel) deler.push("Masterhenger verksted");
                  statusCell = (
                    <span className={`${styles.pill} ${styles.pillWarn}`} title={deler.join(", ")}>
                      {deler.join(" · ")}
                    </span>
                  );
                } else {
                  // Blå: sjåfør og bil OK, men mangler henger
                  statusCell = (
                    <span className={`${styles.pill} ${styles.pillInfo}`} title="Mangler henger">
                      Henger
                    </span>
                  );
                }

                const masterSjåførNavn = slot.standardSjåførAnsattId
                  ? ansattNavnById.get(slot.standardSjåførAnsattId)
                  : undefined;

                const kobling = finnKoblingForRute(slot.rutekode);
                const koblingOpphevet =
                  kobling !== null &&
                  erKoblingOpphevetForDag(kobling.gruppeKey, kobling.rutekoder);
                const bilValgbare = bilValgbareForRute(slot.rutekode);
                const hengerValgbare = hengerValgbareForRute(slot.rutekode);

                return (
                  <tr key={slot.rutekode} className={styles.dataRow}>
                    <td className={styles.muted}>
                      {slot.rutekode}
                      {kobling && (
                        <button
                          type="button"
                          className={`${styles.linkIconBtn} ${koblingOpphevet ? styles.linkIconBtnOpphevet : ""}`}
                          title={
                            koblingOpphevet
                              ? `Kobling opphevet for ${dato}. Klikk for å koble ${kobling.rutekoder.join(" ⟷ ")} igjen.`
                              : `Koblet med ${kobleteMedRute(slot.rutekode).join(", ") || kobling.rutekoder.filter((k) => k !== slot.rutekode).join(", ")}. Klikk for å oppheve kobling denne dagen.`
                          }
                          aria-label={
                            koblingOpphevet
                              ? `Gjenopprett kobling for ${slot.rutekode}`
                              : `Opphev kobling for ${slot.rutekode}`
                          }
                          onClick={() =>
                            koblingOpphevet
                              ? gjenopprettKoblingForDag(slot.rutekode)
                              : opphevKoblingForDag(slot.rutekode)
                          }
                        >
                          {koblingOpphevet ? "⥀" : "⟷"}
                        </button>
                      )}
                    </td>
                    <td>{slot.rutenavn ?? slot.rutekode}</td>
                    <td className={styles.tdTildel}>
                      <div
                        className={styles.dropCell}
                        tabIndex={0}
                        aria-label={`Sjåfør for rute ${slot.rutekode}`}
                        onDragOver={handleDragOverSlot}
                        onDrop={(e) => handleDropPåRute(e, slot.rutekode)}
                      >
                        {res.sjåfør ? (
                          <span
                            className={`${styles.dragChip}${res.sjåførHarFravær ? ` ${styles.dragChipWarn}` : ""}`}
                            draggable
                            onDragStart={(e) =>
                              handleDragStartAnsatt(e, {
                                ansattId: res.sjåfør!.id,
                                fraRute: slot.rutekode,
                              })
                            }
                            title={res.sjåførHarFravær ? "Har fravær — manuelt innsatt" : res.sjåførFraMaster ? "Fra master" : "Overstyrt for denne dagen"}
                          >
                            {fullNavn(res.sjåfør)}{res.sjåførHarFravær ? " ⚠" : ""}
                          </span>
                        ) : (
                          <span className={styles.dropPlaceholder}>
                            {res.sjåførHarFravær && masterSjåførNavn
                              ? `${masterSjåførNavn} — fravær`
                              : "Dra sjåfør hit"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={styles.tdTildel}>
                      <PlanKjoretoyVelger
                        rute={slot.rutekode}
                        selectValue={bilSelectVal}
                        onSelect={(v) => oppdaterTildeling(slot.rutekode, "bilId", v)}
                        valgbare={bilValgbare}
                        byId={bilById}
                        ansatte={ansatte}
                        fastKjoretoyId={(a) => a.fastBilId}
                        erLedig={bilErLedigForRute}
                        statusEtikett={bilIkkeValgbarEtikett}
                        baselineKjennemerke={
                          masterplanBilId
                            ? bilById.get(masterplanBilId)?.kjennemerke
                            : undefined
                        }
                        fraMasterKjoretoyId={masterplanBilId}
                        masterPaVerksted={masterBilPaVerksted}
                        masterPaVerkstedGrunn={
                          masterplanBilId ? bilUtilgjengeligGrunn(masterplanBilId) : undefined
                        }
                        ekstraValgId={
                          bilSelectVal !== "__ingen__" && bilSelectVal !== "__baseline__"
                            ? bilSelectVal
                            : undefined
                        }
                        ekstraValgEtikett={
                          bilSelectVal !== "__ingen__" && bilSelectVal !== "__baseline__"
                            ? bilById.get(bilSelectVal)?.kjennemerke ?? bilSelectVal
                            : undefined
                        }
                        søkPlaceholder="Søk sjåfør eller reg.nr…"
                        søkTomTekst="Ingen bil funnet"
                        ariaLabel={`Søk sjåfør for bil, rute ${slot.rutekode}`}
                      />
                    </td>
                    <td className={styles.tdTildel}>
                      <PlanKjoretoyVelger
                        rute={slot.rutekode}
                        selectValue={hengerSelectVal}
                        onSelect={(v) => oppdaterTildeling(slot.rutekode, "hengerId", v)}
                        valgbare={hengerValgbare}
                        byId={hengerById}
                        ansatte={ansatte}
                        fastKjoretoyId={(a) => a.fastHengerId}
                        erLedig={hengerErLedigForRute}
                        statusEtikett={hengerIkkeValgbarEtikett}
                        baselineKjennemerke={
                          masterplanHengerId
                            ? hengerById.get(masterplanHengerId)?.kjennemerke
                            : undefined
                        }
                        fraMasterKjoretoyId={masterplanHengerId}
                        masterPaVerksted={masterHengerPaVerksted}
                        masterPaVerkstedGrunn={
                          masterplanHengerId ? hengerUtilgjengeligGrunn(masterplanHengerId) : undefined
                        }
                        ekstraValgId={
                          hengerSelectVal !== "__ingen__" && hengerSelectVal !== "__baseline__"
                            ? hengerSelectVal
                            : undefined
                        }
                        ekstraValgEtikett={
                          hengerSelectVal !== "__ingen__" && hengerSelectVal !== "__baseline__"
                            ? hengerById.get(hengerSelectVal)?.kjennemerke ?? hengerSelectVal
                            : undefined
                        }
                        søkPlaceholder="Søk sjåfør eller reg.nr…"
                        søkTomTekst="Ingen henger funnet"
                        ariaLabel={`Søk sjåfør for henger, rute ${slot.rutekode}`}
                      />
                    </td>
                    <td>{statusCell}</td>
                    <td className={styles.removeCell}>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        title={`Fjern rute ${slot.rutekode} for denne dagen`}
                        aria-label={`Fjern rute ${slot.rutekode} for denne dagen`}
                        onClick={() => fjernRuteFraDag(slot.rutekode, slot.rutenavn)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
              {synligeRuter.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.note}>
                    {modulSøk.trim()
                      ? `Ingen treff på «${modulSøk.trim()}».`
                      : "Ingen ruter for valgt uke/dag/skift."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className={styles.addRouteRow}>
            <input
              className={styles.addRouteInput}
              type="text"
              placeholder="Rutekode (f.eks. 1150)"
              value={leggTilRuteInput}
              onChange={(e) => setLeggTilRuteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && leggTilRuteForDag()}
            />
            <button
              type="button"
              className={styles.addRouteBtn}
              onClick={leggTilRuteForDag}
              disabled={!leggTilRuteInput.trim()}
            >
              + Legg til rute for dagen
            </button>
          </div>
        </div>

        {/* ── Sidebar (høyre) ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarInner}>
            {/* Tilgjengelige */}
            <div
              className={`${styles.tilgjengeligSection} ${draOverTilgjengelig ? styles.tilgjengeligDragOver : ""}`}
              onDragOver={(e) => { handleDragOverSlot(e); setDraOverTilgjengelig(true); }}
              onDragLeave={() => setDraOverTilgjengelig(false)}
              onDrop={(e) => { handleDropFjernSjåfør(e); setDraOverTilgjengelig(false); }}
            >
              <div className={styles.sectionLabel}>Tilgjengelige ({tilgjengeligeAnsatte.length})</div>
              <input
                className={styles.sidebarSøk}
                type="search"
                value={sjåførSøk}
                onChange={(e) => setSjåførSøk(e.target.value)}
                placeholder="Søk sjåfør…"
                aria-label="Søk blant tilgjengelige sjåfører"
              />
              <div
                className={styles.driverList}
              >
                {filtrerteAnsatte.tilgjengelige.map((a) => (
                  <div
                    key={a.id}
                    className={styles.driverRow}
                    draggable
                    onDragStart={(e) => handleDragStartAnsatt(e, { ansattId: a.id })}
                    title={`Dra ${fullNavn(a)} til en rute`}
                  >
                    <span className={styles.driverName}>{fullNavn(a)}</span>
                  </div>
                ))}
                {filtrerteAnsatte.utilgjengelige.length > 0 && (
                  <>
                    <div className={styles.driverDivider}>Utilgjengelige</div>
                    {filtrerteAnsatte.utilgjengelige.map((a) => (
                      <div
                        key={a.id}
                        className={`${styles.driverRow} ${styles.driverRowUnavail}`}
                        draggable
                        onDragStart={(e) => handleDragStartAnsatt(e, { ansattId: a.id })}
                        title={`${fullNavn(a)} — ${a.grunn}`}
                      >
                        <span className={styles.driverName}>{fullNavn(a)}</span>
                        <span className={styles.driverGrunn}>{a.grunn}</span>
                      </div>
                    ))}
                  </>
                )}
                {tilgjengeligeAnsatte.length === 0 && !sjåførSøk.trim() && (
                  <span className={styles.note}>Alle tildelt / utilgjengelige</span>
                )}
                {sjåførSøk.trim() && filtrerteAnsatte.tilgjengelige.length === 0 && filtrerteAnsatte.utilgjengelige.length === 0 && (
                  <span className={styles.note}>Ingen treff på «{sjåførSøk.trim()}»</span>
                )}
              </div>
            </div>

            <hr className={styles.divider} />

            {/* Fravær drop-sone */}
            <div
              className={`${styles.fraværSection} ${draOverFravær ? styles.fraværDragOver : ""}`}
              onDragOver={(e) => { handleDragOverSlot(e); setDraOverFravær(true); }}
              onDragLeave={() => setDraOverFravær(false)}
              onDrop={(e) => { handleDropRegistrerFravær(e); setDraOverFravær(false); }}
            >
              <div className={styles.sectionLabel}>Fravær ({fraværPåDato.length})</div>
              <div className={styles.dropPoolMuted}>
                Dra sjåfør hit = registrer syk
              </div>
              {fraværPåDato.map((f) => (
                <span key={f.id} className={styles.tag}>
                  {ansattNavnById.get(f.ansattId) ?? f.ansattId} · {f.type}
                </span>
              ))}
            </div>

            <hr className={styles.divider} />

            {/* Fjernede ruter */}
            {fjernedeRuterForDag.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>Fjernet i dag ({fjernedeRuterForDag.length})</div>
                {fjernedeRuterForDag.map((e) => (
                  <div key={e.id} className={styles.removedRoute}>
                    <span className={styles.removedRouteName}>{e.rutenavn ?? e.rutekode}</span>
                    <button
                      type="button"
                      className={styles.undoBtn}
                      onClick={() => angreFjernRute(e.rutekode)}
                      title="Angre — legg ruten tilbake"
                    >
                      Angre
                    </button>
                  </div>
                ))}
              </div>
            )}

            <hr className={styles.divider} />

            {/* Biler ute */}
            {bilPosterPåDato.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>Bil ute ({bilPosterPåDato.length})</div>
                {bilPosterPåDato.map((p: BilUtilgjengelig) => {
                  const b = bilById.get(p.bilId);
                  return (
                    <span key={p.id} className={styles.tag}>
                      {b ? b.kjennemerke : p.bilId} · {p.type}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Henger ute */}
            {hengerPosterPåDato.length > 0 && (
              <div>
                <div className={styles.sectionLabel}>Henger ute ({hengerPosterPåDato.length})</div>
                {hengerPosterPåDato.map((p: HengerUtilgjengelig) => {
                  const h = hengerById.get(p.hengerId);
                  return (
                    <span key={p.id} className={styles.tag}>
                      {h ? h.kjennemerke : p.hengerId} · {p.type}
                    </span>
                  );
                })}
              </div>
            )}

          </div>
        </aside>
      </div>
      {bekreftDialog}
    </div>
  );
}
