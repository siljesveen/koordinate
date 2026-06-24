import { describe, expect, it } from "vitest";
import type { Ansatt, MasterRuteplan, MasterRuteSlot } from "@/lib/domain";
import { backfillMasterplanKjoretoyFraAnsatte, slotMedSjåførOgKjoretoy } from "./masterplanKjoretoy";

const slot: MasterRuteSlot = {
  id: "ms-1",
  uke: 1,
  dag: 1,
  skift: "Dag",
  rutekode: "1520",
  standardBilId: "bil-gammel",
  standardHengerId: "heng-gammel",
};

describe("slotMedSjåførOgKjoretoy", () => {
  it("fjerner sjåfør og kjøretøy når ansattId tømmes", () => {
    const result = slotMedSjåførOgKjoretoy(
      { ...slot, standardSjåførAnsattId: "a1" },
      undefined,
    );
    expect(result.standardSjåførAnsattId).toBeUndefined();
    expect(result.standardBilId).toBeUndefined();
    expect(result.standardHengerId).toBeUndefined();
  });

  it("setter fast bil og henger fra ansatt", () => {
    const result = slotMedSjåførOgKjoretoy(slot, "a1", {
      fastBilId: "bil-a1",
      fastHengerId: "heng-a1",
    });
    expect(result.standardSjåførAnsattId).toBe("a1");
    expect(result.standardBilId).toBe("bil-a1");
    expect(result.standardHengerId).toBe("heng-a1");
  });

  it("tømmer bil/henger når ansatt mangler fast kjøretøy", () => {
    const result = slotMedSjåførOgKjoretoy(slot, "a1", { fastBilId: "bil-a1" });
    expect(result.standardBilId).toBe("bil-a1");
    expect(result.standardHengerId).toBeUndefined();
  });
});

const plan: MasterRuteplan = {
  syklusLengde: 4,
  slots: [],
  referanseDato: "2026-06-16",
  aktivUkeVedReferanse: 2,
};

const slotMedSjåfør: MasterRuteSlot = {
  id: "ms-1",
  uke: 1,
  dag: 1,
  skift: "Dag",
  rutekode: "1520",
  standardSjåførAnsattId: "a1",
};

const ansatt: Ansatt = {
  id: "a1",
  fornavn: "Ola",
  etternavn: "Nordmann",
  telefon: "",
  epost: "",
  rolle: "",
  avdeling: "",
  stillingsprosent: 100,
  kompetanse: [],
  førerkort: [],
  aktiv: true,
  fastBilId: "bil-a1",
  fastHengerId: "heng-a1",
};

describe("backfillMasterplanKjoretoyFraAnsatte", () => {
  it("fyller inn manglende bil og henger", () => {
    const { plan: next, updated } = backfillMasterplanKjoretoyFraAnsatte(
      { ...plan, slots: [slotMedSjåfør] },
      new Map([["a1", ansatt]]),
    );
    expect(updated).toBe(1);
    expect(next.slots[0].standardBilId).toBe("bil-a1");
    expect(next.slots[0].standardHengerId).toBe("heng-a1");
  });

  it("overskriver ikke eksisterende bil/henger", () => {
    const { updated } = backfillMasterplanKjoretoyFraAnsatte(
      {
        ...plan,
        slots: [{ ...slotMedSjåfør, standardBilId: "bil-annet", standardHengerId: "heng-annet" }],
      },
      new Map([["a1", ansatt]]),
    );
    expect(updated).toBe(0);
  });

  it("filler kun manglende felt", () => {
    const { plan: next, updated } = backfillMasterplanKjoretoyFraAnsatte(
      { ...plan, slots: [{ ...slotMedSjåfør, standardBilId: "bil-annet" }] },
      new Map([["a1", ansatt]]),
    );
    expect(updated).toBe(1);
    expect(next.slots[0].standardBilId).toBe("bil-annet");
    expect(next.slots[0].standardHengerId).toBe("heng-a1");
  });
});
