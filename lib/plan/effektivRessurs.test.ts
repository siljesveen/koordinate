import { describe, expect, it } from "vitest";
import type { Ansatt, DagEndring, MasterRuteSlot, PlanRuteTildeling } from "@/lib/domain";
import {
  effektivRessursForSlot,
  sjåførDragAnsattId,
  type EffektivRessursArgs,
} from "./effektivRessurs";
import { byggKoblingsgruppeKontekst } from "./koblingsgrupper";

const dato = "2026-06-16";

const ansatt = (id: string, overrides: Partial<Ansatt> = {}): Ansatt => ({
  id,
  fornavn: "Test",
  etternavn: id,
  telefon: "",
  epost: "",
  rolle: "Sjåfør",
  avdeling: "",
  stillingsprosent: 100,
  kompetanse: [],
  førerkort: [],
  aktiv: true,
  ...overrides,
});

const masterSlot = (overrides: Partial<MasterRuteSlot> = {}): MasterRuteSlot => ({
  id: "ms-1-1-Dag-100",
  uke: 1,
  dag: 1,
  skift: "Dag",
  rutekode: "100",
  rutenavn: "Testrute",
  ...overrides,
});

function lagArgs(overrides: Partial<EffektivRessursArgs> = {}): EffektivRessursArgs {
  const effektiveRuter = overrides.effektiveRuter ?? [masterSlot()];
  const koblingsKontekst =
    overrides.koblingsKontekst ??
    byggKoblingsgruppeKontekst({
      ruter: effektiveRuter,
      dagEndringer: [],
      dato,
      skift: "Dag",
      dag: 1,
    });

  return {
    dato,
    ansattById: new Map([ansatt("sj1"), ansatt("sj2")].map((a) => [a.id, a])),
    fravær: [],
    skiftOverstyringMap: new Map(),
    bilUtilgjengelig: [],
    hengerUtilgjengelig: [],
    tildelingMap: new Map(),
    effektiveRuter,
    koblingsKontekst,
    ...overrides,
  };
}

describe("sjåførDragAnsattId", () => {
  it("returnerer master-id for baseline selv når effektiv sjåfør er nullstilt", () => {
    const ansattById = new Map([["s1", ansatt("s1")]]);
    const slot = masterSlot({ standardSjåførAnsattId: "s1" });
    expect(sjåførDragAnsattId("__baseline__", slot, ansattById)).toBe("s1");
    expect(sjåførDragAnsattId("__ingen__", slot, ansattById)).toBeUndefined();
    expect(sjåførDragAnsattId("s1", slot, ansattById)).toBe("s1");
  });

  it("returnerer undefined for inaktiv ansatt", () => {
    const ansattById = new Map([["s1", ansatt("s1", { aktiv: false })]]);
    const slot = masterSlot({ standardSjåførAnsattId: "s1" });
    expect(sjåførDragAnsattId("__baseline__", slot, ansattById)).toBeUndefined();
  });
});

describe("effektivRessursForSlot", () => {
  it("bruker master-sjåfør når ingen plan-tildeling finnes", () => {
    const slot = masterSlot({ standardSjåførAnsattId: "sj1" });
    const res = effektivRessursForSlot(slot, undefined, lagArgs());
    expect(res.sjåfør?.id).toBe("sj1");
    expect(res.sjåførFraMaster).toBe(true);
  });

  it("fjerner master-sjåfør ved fravær og flagger utilgjengelighet", () => {
    const slot = masterSlot({ standardSjåførAnsattId: "sj1" });
    const res = effektivRessursForSlot(
      slot,
      undefined,
      lagArgs({
        fravær: [
          {
            id: "f1",
            ansattId: "sj1",
            type: "Syk",
            fraDato: dato,
            tilDato: dato,
            planlagt: false,
          },
        ],
      }),
    );
    expect(res.sjåfør).toBeUndefined();
    expect(res.sjåførHarFravær).toBe(true);
    expect(res.sjåførFraMaster).toBe(true);
  });

  it("beholder manuelt valgt sjåfør ved fravær", () => {
    const slot = masterSlot({ standardSjåførAnsattId: "sj1" });
    const til: PlanRuteTildeling = {
      uke: 1,
      dag: 1,
      skift: "Dag",
      rute: "100",
      ansattId: "sj2",
    };
    const res = effektivRessursForSlot(
      slot,
      til,
      lagArgs({
        fravær: [
          {
            id: "f2",
            ansattId: "sj2",
            type: "Syk",
            fraDato: dato,
            tilDato: dato,
            planlagt: false,
          },
        ],
      }),
    );
    expect(res.sjåfør?.id).toBe("sj2");
    expect(res.sjåførHarFravær).toBe(true);
    expect(res.sjåførFraMaster).toBe(false);
  });

  it("flagger master-sjåfør flyttet til motsatt skift", () => {
    const slot = masterSlot({ standardSjåførAnsattId: "sj1" });
    const res = effektivRessursForSlot(
      slot,
      undefined,
      lagArgs({
        skiftOverstyringMap: new Map([["sj1", "Kveld"]]),
      }),
    );
    expect(res.sjåfør).toBeUndefined();
    expect(res.sjåførPåAnnetSkift).toBe("Kveld");
    expect(res.sjåførFraMaster).toBe(true);
  });

  it("arver bil fra koblet rute", () => {
    const ruter = [
      masterSlot({ rutekode: "100" }),
      masterSlot({ id: "ms-1-1-Dag-200", rutekode: "200" }),
    ];
    const koblingsKontekst = byggKoblingsgruppeKontekst({
      koblingsgrupper: { gruppeA: { rutekoder: ["100", "200"] } },
      ruter,
      dagEndringer: [],
      dato,
      skift: "Dag",
      dag: 1,
    });
    const tildelingMap = new Map<string, PlanRuteTildeling>([
      [
        "200",
        { uke: 1, dag: 1, skift: "Dag", rute: "200", bilId: "bil-koblet" },
      ],
    ]);

    const res = effektivRessursForSlot(
      ruter[0],
      undefined,
      lagArgs({ effektiveRuter: ruter, koblingsKontekst, tildelingMap }),
    );

    expect(res.bilId).toBe("bil-koblet");
    expect(res.bilFraMaster).toBe(false);
  });

  it("arver master-henger fra koblet rute", () => {
    const ruter = [
      masterSlot({ rutekode: "100" }),
      masterSlot({
        id: "ms-1-1-Dag-200",
        rutekode: "200",
        standardHengerId: "heng-master",
      }),
    ];
    const koblingsKontekst = byggKoblingsgruppeKontekst({
      koblingsgrupper: { gruppeA: { rutekoder: ["100", "200"] } },
      ruter,
      dagEndringer: [],
      dato,
      skift: "Dag",
      dag: 1,
    });

    const res = effektivRessursForSlot(
      ruter[0],
      undefined,
      lagArgs({ effektiveRuter: ruter, koblingsKontekst }),
    );

    expect(res.hengerId).toBe("heng-master");
    expect(res.hengerFraMaster).toBe(true);
  });

  it("bruker ikke slot-bil når sjåfør er manuelt overstyrt", () => {
    const slot = masterSlot({ standardBilId: "bil-master" });
    const til: PlanRuteTildeling = {
      uke: 1,
      dag: 1,
      skift: "Dag",
      rute: "100",
      ansattId: "sj2",
    };
    const res = effektivRessursForSlot(slot, til, lagArgs());
    expect(res.bilId).toBeUndefined();
    expect(res.bilFraMaster).toBe(false);
  });
});
