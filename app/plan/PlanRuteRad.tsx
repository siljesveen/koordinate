"use client";

import { type DragEvent, type ReactNode } from "react";
import {
  type Ansatt,
  type BilUtilgjengelig,
  type HengerUtilgjengelig,
  type MasterRuteSlot,
  type PlanRuteTildeling,
} from "@/lib/domain";
import {
  erBilIUtilgjengeligPeriodePåDato,
  erHengerIUtilgjengeligPeriodePåDato,
} from "@/lib/kjoretoyTilgjengelighet";
import { type EffektivRessurs } from "@/lib/plan/effektivRessurs";
import { sorterRutekoder } from "@/lib/utils/sort";
import PlanKjoretoyVelger, { type PlanKjoretoyItem } from "./PlanKjoretoyVelger";
import PlanSjåførVelger, { type PlanSjåførVelg } from "./PlanSjåførVelger";
import styles from "./page.module.css";

type DragAnsattPayload = { ansattId: string; fraRute?: string };

export type PlanRuteRadLogikk = {
  effektivRessursForSlot: (
    slot: MasterRuteSlot,
    til: PlanRuteTildeling | undefined,
  ) => EffektivRessurs;
  masterplanBilIdForSlot: (slot: MasterRuteSlot) => string | undefined;
  masterplanHengerIdForSlot: (slot: MasterRuteSlot) => string | undefined;
  tildelingKjoretoyForRute: (rute: string) => PlanRuteTildeling | undefined;
  bilSelectVerdi: (til: PlanRuteTildeling | undefined, res: EffektivRessurs) => string;
  hengerSelectVerdi: (til: PlanRuteTildeling | undefined, res: EffektivRessurs) => string;
  planHarBilTildelt: (
    til: PlanRuteTildeling | undefined,
    slot: MasterRuteSlot,
    res: EffektivRessurs,
  ) => boolean;
  planHarHengerTildelt: (
    til: PlanRuteTildeling | undefined,
    slot: MasterRuteSlot,
    res: EffektivRessurs,
  ) => boolean;
  finnKoblingForRute: (rutekode: string) => { gruppeKey: string; rutekoder: string[] } | null;
  erKoblingOpphevetForDag: (gruppeKey: string, rutekoder: string[]) => boolean;
  kobleteMedRute: (rutekode: string) => string[];
  bilValgbareForRute: (rute: string) => PlanKjoretoyItem[];
  hengerValgbareForRute: (rute: string) => PlanKjoretoyItem[];
  sjåførSelectVerdi: (til: PlanRuteTildeling | undefined, slot: MasterRuteSlot) => string;
  sjåførDragAnsattIdForRute: (selectVal: string, slot: MasterRuteSlot) => string | undefined;
  sjåførVisningNavn: (
    selectValue: string,
    res: EffektivRessurs,
    masterSjåførNavn?: string,
  ) => string;
  masterSjåførFraværInfo: (
    slot: MasterRuteSlot,
    til: PlanRuteTildeling | undefined,
  ) => { påFravær: boolean; grunn?: string };
  bilErLedigForRute: (kjoretoyId: string, rute: string) => boolean;
  hengerErLedigForRute: (kjoretoyId: string, rute: string) => boolean;
  bilIkkeValgbarEtikett: (kjoretoyId: string) => string;
  hengerIkkeValgbarEtikett: (kjoretoyId: string) => string;
  bilUtilgjengeligGrunn: (bilId: string) => string | undefined;
  hengerUtilgjengeligGrunn: (hengerId: string) => string | undefined;
};

export type PlanRuteRadHandlers = {
  opphevKoblingForDag: (rutekode: string) => void | Promise<void>;
  gjenopprettKoblingForDag: (rutekode: string) => void | Promise<void>;
  applySjåførOnRute: (rutekode: string, valg: PlanSjåførVelg) => void | Promise<void>;
  oppdaterTildeling: (
    rutekode: string,
    felt: "bilId" | "hengerId",
    verdi: string,
  ) => void;
  fjernRuteFraDag: (rutekode: string, rutenavn?: string) => void;
  handleDragOverSlot: (e: DragEvent) => void;
  handleDropPåRute: (e: DragEvent, ruteKode: string) => void;
  handleDragStartAnsatt: (e: DragEvent, payload: DragAnsattPayload) => void;
};

type PlanRuteRadProps = {
  slot: MasterRuteSlot;
  til: PlanRuteTildeling | undefined;
  dato: string;
  ansatte: Ansatt[];
  ansattNavnById: Map<string, string>;
  bilById: Map<string, PlanKjoretoyItem>;
  hengerById: Map<string, PlanKjoretoyItem>;
  tilgjengeligeIdSet: ReadonlySet<string>;
  utilgjengeligeGrunner: ReadonlyMap<string, string>;
  bilUtilgjengelig: BilUtilgjengelig[];
  hengerUtilgjengelig: HengerUtilgjengelig[];
  logikk: PlanRuteRadLogikk;
  handlers: PlanRuteRadHandlers;
};

function planRuteStatusCell(
  res: EffektivRessurs,
  manglerSjåfør: boolean,
  manglerBil: boolean,
  manglerHenger: boolean,
  utilgjengelig: boolean,
  sjåførPåAnnetSkift: boolean,
  masterBilAdvarsel: boolean,
  masterHengerAdvarsel: boolean,
): ReactNode {
  if (!manglerSjåfør && !manglerBil && !manglerHenger && !utilgjengelig) {
    return <span className={`${styles.pill} ${styles.pillOk}`}>OK</span>;
  }

  if (manglerSjåfør || manglerBil) {
    const deler: string[] = [];
    if (res.sjåførHarFravær) deler.push("Sjåfør fravær");
    else if (manglerSjåfør) deler.push("Sjåfør");
    if (manglerBil) deler.push("Bil");
    return (
      <span className={`${styles.pill} ${styles.pillBad}`} title={deler.join(", ")}>
        {deler.join(" · ")}
      </span>
    );
  }

  if (utilgjengelig) {
    const deler: string[] = [];
    if (res.sjåførHarFravær) deler.push("Sjåfør fravær");
    if (sjåførPåAnnetSkift) deler.push(`Sjåfør på ${res.sjåførPåAnnetSkift?.toLowerCase()}`);
    if (res.bilUtilgjengelig) deler.push("Bil ute");
    else if (masterBilAdvarsel) deler.push("Masterbil verksted");
    if (res.hengerUtilgjengeligFlag) deler.push("Henger ute");
    else if (masterHengerAdvarsel) deler.push("Masterhenger verksted");
    return (
      <span className={`${styles.pill} ${styles.pillWarn}`} title={deler.join(", ")}>
        {deler.join(" · ")}
      </span>
    );
  }

  return (
    <span className={`${styles.pill} ${styles.pillInfo}`} title="Mangler henger">
      Henger
    </span>
  );
}

export default function PlanRuteRad({
  slot,
  til,
  dato,
  ansatte,
  ansattNavnById,
  bilById,
  hengerById,
  tilgjengeligeIdSet,
  utilgjengeligeGrunner,
  bilUtilgjengelig,
  hengerUtilgjengelig,
  logikk,
  handlers,
}: PlanRuteRadProps) {
  const {
    effektivRessursForSlot,
    masterplanBilIdForSlot,
    masterplanHengerIdForSlot,
    tildelingKjoretoyForRute,
    bilSelectVerdi,
    hengerSelectVerdi,
    planHarBilTildelt,
    planHarHengerTildelt,
    finnKoblingForRute,
    erKoblingOpphevetForDag,
    kobleteMedRute,
    bilValgbareForRute,
    hengerValgbareForRute,
    sjåførSelectVerdi,
    sjåførDragAnsattIdForRute,
    sjåførVisningNavn,
    masterSjåførFraværInfo,
    bilErLedigForRute,
    hengerErLedigForRute,
    bilIkkeValgbarEtikett,
    hengerIkkeValgbarEtikett,
    bilUtilgjengeligGrunn,
    hengerUtilgjengeligGrunn,
  } = logikk;

  const {
    opphevKoblingForDag,
    gjenopprettKoblingForDag,
    applySjåførOnRute,
    oppdaterTildeling,
    fjernRuteFraDag,
    handleDragOverSlot,
    handleDropPåRute,
    handleDragStartAnsatt,
  } = handlers;

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
    masterBilPaVerksted && (bilSelectVal === "__ingen__" || bilValgtErMaster);
  const masterHengerAdvarsel =
    masterHengerPaVerksted && (hengerSelectVal === "__ingen__" || hengerValgtErMaster);

  const sjåførPåAnnetSkift = Boolean(res.sjåførPåAnnetSkift);
  const manglerSjåfør = !res.sjåfør && !sjåførPåAnnetSkift;
  const manglerBil = !planHarBilTildelt(tilKjoretoy, slot, res);
  const manglerHenger = !planHarHengerTildelt(tilKjoretoy, slot, res);
  const utilgjengelig =
    res.bilUtilgjengelig ||
    res.hengerUtilgjengeligFlag ||
    res.sjåførHarFravær ||
    masterBilAdvarsel ||
    masterHengerAdvarsel ||
    sjåførPåAnnetSkift;

  const statusCell = planRuteStatusCell(
    res,
    manglerSjåfør,
    manglerBil,
    manglerHenger,
    utilgjengelig,
    sjåførPåAnnetSkift,
    masterBilAdvarsel,
    masterHengerAdvarsel,
  );

  const masterSjåførNavn = slot.standardSjåførAnsattId
    ? ansattNavnById.get(slot.standardSjåførAnsattId)
    : undefined;

  const kobling = finnKoblingForRute(slot.rutekode);
  const koblingOpphevet =
    kobling !== null && erKoblingOpphevetForDag(kobling.gruppeKey, kobling.rutekoder);
  const bilValgbare = bilValgbareForRute(slot.rutekode);
  const hengerValgbare = hengerValgbareForRute(slot.rutekode);
  const sjåførSelect = sjåførSelectVerdi(til, slot);
  const sjåførDragId = sjåførDragAnsattIdForRute(sjåførSelect, slot);
  const masterSjåførFravær = masterSjåførFraværInfo(slot, til);

  return (
    <tr className={styles.dataRow}>
      <td className={styles.muted}>
        {slot.rutekode}
        {kobling && (
          <button
            type="button"
            className={`${styles.linkIconBtn} ${koblingOpphevet ? styles.linkIconBtnOpphevet : ""}`}
            title={
              koblingOpphevet
                ? `Kobling opphevet for ${dato}. Klikk for å koble ${sorterRutekoder(kobling.rutekoder).join(" ⟷ ")} igjen.`
                : `Koblet med ${sorterRutekoder(kobleteMedRute(slot.rutekode)).join(", ") || sorterRutekoder(kobling.rutekoder.filter((k) => k !== slot.rutekode)).join(", ")}. Klikk for å oppheve kobling denne dagen.`
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
          <PlanSjåførVelger
            rute={slot.rutekode}
            selectValue={sjåførSelect}
            visningNavn={sjåførVisningNavn(sjåførSelect, res, masterSjåførNavn)}
            sjåførFraMaster={res.sjåførFraMaster}
            sjåførHarFravær={res.sjåførHarFravær}
            manueltInnsatt={Boolean(til?.ansattId)}
            masterSjåførNavn={masterSjåførNavn}
            masterPåFravær={masterSjåførFravær.påFravær}
            masterFraværGrunn={
              masterSjåførFravær.påFravær ? masterSjåførFravær.grunn : undefined
            }
            påAnnetSkift={res.sjåførPåAnnetSkift?.toLowerCase()}
            dragAnsattId={sjåførDragId}
            onDragStart={(e, ansattId) =>
              handleDragStartAnsatt(e, {
                ansattId,
                fraRute: slot.rutekode,
              })
            }
            ansatte={ansatte}
            tilgjengeligeIdSet={tilgjengeligeIdSet}
            utilgjengeligeGrunner={utilgjengeligeGrunner}
            onVelg={(valg) => applySjåførOnRute(slot.rutekode, valg)}
            ariaLabel={`Velg sjåfør for rute ${slot.rutekode}`}
          />
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
            masterplanBilId ? bilById.get(masterplanBilId)?.kjennemerke : undefined
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
            masterplanHengerId ? hengerById.get(masterplanHengerId)?.kjennemerke : undefined
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
}
