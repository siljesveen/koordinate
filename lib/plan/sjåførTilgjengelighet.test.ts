import { describe, expect, it } from "vitest";
import type { DagEndring, MasterRuteSlot, PlanRuteTildeling } from "@/lib/domain";
import {
  byggEffektiveRuter,
  effektivSjåførIdForSlot,
  planTildelingMap,
} from "./sjåførTilgjengelighet";

const masterSlot = (overrides: Partial<MasterRuteSlot> = {}): MasterRuteSlot => ({
  id: "ms-1-1-Dag-100",
  uke: 1,
  dag: 1,
  skift: "Dag",
  rutekode: "100",
  rutenavn: "Testrute",
  standardSjåførAnsattId: "baseline-sjåfør",
  ...overrides,
});

describe("effektivSjåførIdForSlot", () => {
  it("bruker plan-overstyring når ansattId er satt", () => {
    const slot = masterSlot();
    const til: PlanRuteTildeling = {
      uke: 1,
      dag: 1,
      skift: "Dag",
      rute: "100",
      ansattId: "overstyrt-sjåfør",
    };
    expect(effektivSjåførIdForSlot(slot, til)).toBe("overstyrt-sjåfør");
  });

  it("returnerer undefined når baseline er skjult uten erstatning", () => {
    const slot = masterSlot();
    const til: PlanRuteTildeling = {
      uke: 1,
      dag: 1,
      skift: "Dag",
      rute: "100",
      skjulBaselineSjåfør: true,
    };
    expect(effektivSjåførIdForSlot(slot, til)).toBeUndefined();
  });

  it("faller tilbake til masterplan-baseline uten tildeling", () => {
    const slot = masterSlot({ standardSjåførAnsattId: "baseline-sjåfør" });
    expect(effektivSjåførIdForSlot(slot, undefined)).toBe("baseline-sjåfør");
  });
});

describe("byggEffektiveRuter", () => {
  const dato = "2026-06-16";
  const masterSlots = [
    masterSlot({ rutekode: "100" }),
    masterSlot({ id: "ms-1-1-Dag-200", rutekode: "200", rutenavn: "Annen rute" }),
  ];

  it("fjerner ruter markert som fjernet for dato og skift", () => {
    const dagEndringer: DagEndring[] = [
      {
        id: "de-1",
        dato,
        skift: "Dag",
        type: "fjernet",
        rutekode: "100",
      },
    ];
    const ruter = byggEffektiveRuter({
      uke: 1,
      dag: 1,
      skift: "Dag",
      dato,
      masterSlots,
      dagEndringer,
    });
    expect(ruter.map((r) => r.rutekode)).toEqual(["200"]);
  });

  it("legger til ekstra ruter fra dagEndringer", () => {
    const dagEndringer: DagEndring[] = [
      {
        id: "de-2",
        dato,
        skift: "Dag",
        type: "lagt_til",
        rutekode: "999",
        rutenavn: "Ekstra rute",
      },
    ];
    const ruter = byggEffektiveRuter({
      uke: 1,
      dag: 1,
      skift: "Dag",
      dato,
      masterSlots,
      dagEndringer,
    });
    expect(ruter.map((r) => r.rutekode)).toEqual(["100", "200", "999"]);
  });

  it("ignorerer dagEndringer for annet skift eller annen dato", () => {
    const dagEndringer: DagEndring[] = [
      {
        id: "de-3",
        dato: "2026-06-17",
        skift: "Dag",
        type: "fjernet",
        rutekode: "100",
      },
      {
        id: "de-4",
        dato,
        skift: "Kveld",
        type: "fjernet",
        rutekode: "200",
      },
    ];
    const ruter = byggEffektiveRuter({
      uke: 1,
      dag: 1,
      skift: "Dag",
      dato,
      masterSlots,
      dagEndringer,
    });
    expect(ruter.map((r) => r.rutekode)).toEqual(["100", "200"]);
  });
});

describe("planTildelingMap", () => {
  it("filtrerer tildelinger på uke, dag og skift", () => {
    const tildelinger: PlanRuteTildeling[] = [
      { uke: 1, dag: 1, skift: "Dag", rute: "100", ansattId: "a1" },
      { uke: 1, dag: 1, skift: "Kveld", rute: "100", ansattId: "a2" },
      { uke: 2, dag: 1, skift: "Dag", rute: "100", ansattId: "a3" },
    ];
    const map = planTildelingMap({ uke: 1, dag: 1, skift: "Dag", tildelinger });
    expect(map.get("100")?.ansattId).toBe("a1");
    expect(map.size).toBe(1);
  });
});
