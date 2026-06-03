"use client";

import SokbarVelger, {
  type KjoretoySøkMedAnsatte,
  type SokbarVelgerValg,
} from "@/components/SokbarVelger";
import TidInput24 from "@/components/TidInput24";
import type { MasterRuteSlot, Skift } from "@/lib/domain";
import { memo } from "react";
import styles from "@/app/masterplan/page.module.css";

const DAGNAVN = ["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

type Props = {
  slot: MasterRuteSlot;
  sjåførOptions: SokbarVelgerValg[];
  bilOptions: SokbarVelgerValg[];
  hengerOptions: SokbarVelgerValg[];
  kjoretoySøkBil: KjoretoySøkMedAnsatte;
  kjoretoySøkHenger: KjoretoySøkMedAnsatte;
  onLagreSjåfør: (slotId: string, ansattId: string | undefined) => void;
  onOppdaterFelt: (slotId: string, felt: Partial<MasterRuteSlot>) => void;
  onOppdater: (slot: MasterRuteSlot, felt: Partial<MasterRuteSlot>) => void;
  onSlett: (slot: MasterRuteSlot) => void;
};

function MasterplanSlotRowInner({
  slot,
  sjåførOptions,
  bilOptions,
  hengerOptions,
  kjoretoySøkBil,
  kjoretoySøkHenger,
  onLagreSjåfør,
  onOppdaterFelt,
  onOppdater,
  onSlett,
}: Props) {
  return (
    <tr className={slot.varighet && slot.varighet > 1 ? styles.rowMultiday : undefined}>
      <td>
        <select
          className={styles.cellSelectSmall}
          value={slot.dag}
          onChange={(e) =>
            onOppdater(slot, { dag: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 | 7 })
          }
        >
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>
              {DAGNAVN[d]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className={styles.cellSelectSmall}
          value={slot.skift}
          onChange={(e) => onOppdater(slot, { skift: e.target.value as Skift })}
        >
          <option value="Dag">Dag</option>
          <option value="Kveld">Kveld</option>
        </select>
      </td>
      <td>
        <input
          className={styles.cellInputCode}
          type="text"
          value={slot.rutekode}
          onChange={(e) => onOppdater(slot, { rutekode: e.target.value.trim() })}
        />
        {slot.koblingsgruppe && <span className={styles.linkBadge}>⟷</span>}
      </td>
      <td>
        <input
          className={styles.cellInput}
          type="text"
          value={slot.rutenavn ?? ""}
          placeholder="—"
          onChange={(e) => onOppdater(slot, { rutenavn: e.target.value || undefined })}
        />
      </td>
      <td>
        <TidInput24
          className={styles.cellInputTime}
          value={slot.startTid}
          onChange={(startTid) => onOppdater(slot, { startTid })}
          ariaLabel={`Starttid, rute ${slot.rutekode}`}
        />
      </td>
      <td>
        <TidInput24
          className={styles.cellInputTime}
          value={slot.sluttTid}
          onChange={(sluttTid) => onOppdater(slot, { sluttTid })}
          ariaLabel={`Slutttid, rute ${slot.rutekode}`}
        />
      </td>
      <td>
        <select
          className={styles.cellSelectSmall}
          value={slot.varighet ?? 1}
          onChange={(e) => {
            const v = Number(e.target.value);
            onOppdater(slot, { varighet: v > 1 ? v : undefined });
          }}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </td>
      <td>
        <SokbarVelger
          compact
          className={styles.cellSelect}
          value={slot.standardSjåførAnsattId ?? ""}
          onChange={(id) => onLagreSjåfør(slot.id, id || undefined)}
          options={sjåførOptions}
          ariaLabel={`Fast sjåfør, rute ${slot.rutekode}`}
          søkPlaceholder="Søk navn…"
          tomTreffTekst="Ingen ansatt funnet"
        />
      </td>
      <td>
        <SokbarVelger
          compact
          className={styles.cellSelect}
          value={slot.standardBilId ?? ""}
          onChange={(id) => onOppdaterFelt(slot.id, { standardBilId: id || undefined })}
          options={bilOptions}
          ariaLabel={`Fast bil, rute ${slot.rutekode}`}
          søkPlaceholder="Søk bil…"
          tomTreffTekst="Ingen bil funnet"
          kjoretoySøkMedAnsatte={kjoretoySøkBil}
        />
      </td>
      <td>
        <SokbarVelger
          compact
          className={styles.cellSelect}
          value={slot.standardHengerId ?? ""}
          onChange={(id) => onOppdaterFelt(slot.id, { standardHengerId: id || undefined })}
          options={hengerOptions}
          ariaLabel={`Fast henger, rute ${slot.rutekode}`}
          søkPlaceholder="Søk henger…"
          tomTreffTekst="Ingen henger funnet"
          kjoretoySøkMedAnsatte={kjoretoySøkHenger}
        />
      </td>
      <td className={styles.deleteCell}>
        <button
          type="button"
          className={styles.deleteRowBtn}
          onClick={() => onSlett(slot)}
          title="Slett rute"
          aria-label={`Slett ${slot.rutekode}`}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

function slotVisningErLik(a: MasterRuteSlot, b: MasterRuteSlot): boolean {
  return (
    a.id === b.id &&
    a.standardBilId === b.standardBilId &&
    a.standardHengerId === b.standardHengerId &&
    a.standardSjåførAnsattId === b.standardSjåførAnsattId &&
    a.rutekode === b.rutekode &&
    a.rutenavn === b.rutenavn &&
    a.startTid === b.startTid &&
    a.sluttTid === b.sluttTid &&
    a.dag === b.dag &&
    a.skift === b.skift &&
    a.varighet === b.varighet &&
    a.koblingsgruppe === b.koblingsgruppe
  );
}

const MasterplanSlotRow = memo(MasterplanSlotRowInner, (prev, next) => {
  return (
    slotVisningErLik(prev.slot, next.slot) &&
    prev.sjåførOptions === next.sjåførOptions &&
    prev.bilOptions === next.bilOptions &&
    prev.hengerOptions === next.hengerOptions &&
    prev.kjoretoySøkBil === next.kjoretoySøkBil &&
    prev.kjoretoySøkHenger === next.kjoretoySøkHenger
  );
});
export default MasterplanSlotRow;
