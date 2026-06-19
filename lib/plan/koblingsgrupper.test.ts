import { describe, expect, it } from "vitest";
import type { DagEndring, MasterRuteSlot, PlanRuteTildeling } from "@/lib/domain";
import {
  byggKoblingsgruppeKontekst,
  kobleteMedRute,
  koblingErOpphevetForDag,
  tildelingKjoretoyForRute,
} from "./koblingsgrupper";

const dato = "2026-06-16";

const masterSlot = (overrides: Partial<MasterRuteSlot> = {}): MasterRuteSlot => ({
  id: "ms-1-1-Dag-100",
  uke: 1,
  dag: 1,
  skift: "Dag",
  rutekode: "100",
  rutenavn: "Testrute",
  ...overrides,
});

const ruter = [
  masterSlot({ rutekode: "100" }),
  masterSlot({ id: "ms-1-1-Dag-200", rutekode: "200" }),
];

const koblingsgrupper = { gruppeA: { rutekoder: ["100", "200"] as string[] } };

describe("kobleteMedRute", () => {
  it("returnerer andre ruter i samme koblingsgruppe", () => {
    const ctx = byggKoblingsgruppeKontekst({
      koblingsgrupper,
      ruter,
      dagEndringer: [],
      dato,
      skift: "Dag",
      dag: 1,
    });
    expect(kobleteMedRute("100", ctx)).toEqual(["200"]);
    expect(kobleteMedRute("200", ctx)).toEqual(["100"]);
  });

  it("returnerer tom liste når kobling er opphevet for dagen", () => {
    const dagEndringer: DagEndring[] = [
      {
        id: "de-kobling",
        dato,
        skift: "Dag",
        type: "kobling_opphevet",
        rutekode: "100",
        koblingsgruppe: "gruppeA",
        rutekoder: ["100", "200"],
      },
    ];
    const ctx = byggKoblingsgruppeKontekst({
      koblingsgrupper,
      ruter,
      dagEndringer,
      dato,
      skift: "Dag",
      dag: 1,
    });
    expect(kobleteMedRute("100", ctx)).toEqual([]);
    expect(koblingErOpphevetForDag(ctx, "gruppeA", ["100", "200"])).toBe(true);
  });
});

describe("tildelingKjoretoyForRute", () => {
  it("arver bil og henger fra koblet rute uten egen tildeling", () => {
    const ctx = byggKoblingsgruppeKontekst({
      koblingsgrupper,
      ruter,
      dagEndringer: [],
      dato,
      skift: "Dag",
      dag: 1,
    });
    const tildelingMap = new Map<string, PlanRuteTildeling>([
      [
        "200",
        {
          uke: 1,
          dag: 1,
          skift: "Dag",
          rute: "200",
          bilId: "bil-200",
          hengerId: "heng-200",
        },
      ],
    ]);

    const til = tildelingKjoretoyForRute("100", tildelingMap, ctx);
    expect(til?.bilId).toBe("bil-200");
    expect(til?.hengerId).toBe("heng-200");
  });

  it("foretrekker egen rutes kjøretøy-tildeling", () => {
    const ctx = byggKoblingsgruppeKontekst({
      koblingsgrupper,
      ruter,
      dagEndringer: [],
      dato,
      skift: "Dag",
      dag: 1,
    });
    const tildelingMap = new Map<string, PlanRuteTildeling>([
      [
        "100",
        { uke: 1, dag: 1, skift: "Dag", rute: "100", bilId: "bil-100" },
      ],
      [
        "200",
        { uke: 1, dag: 1, skift: "Dag", rute: "200", bilId: "bil-200" },
      ],
    ]);

    const til = tildelingKjoretoyForRute("100", tildelingMap, ctx);
    expect(til?.bilId).toBe("bil-100");
  });
});
