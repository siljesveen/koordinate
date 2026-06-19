import { describe, expect, it } from "vitest";
import type { Turnus } from "@/lib/domain";
import { aktivTurnusUke, ukedagNummer } from "./turnusUtils";

const turnus: Turnus = {
  referanseDato: "2026-06-16",
  aktivUkeVedReferanse: 2,
  uke1: { skift: "Dag", dager: { "1": { startTid: "06:00", sluttTid: "14:00" } } },
  uke2: { skift: "Kveld", dager: { "1": { startTid: "14:00", sluttTid: "22:00" } } },
};

describe("ukedagNummer", () => {
  it("returnerer 1 for mandag og 7 for søndag", () => {
    expect(ukedagNummer("2026-06-15")).toBe("1");
    expect(ukedagNummer("2026-06-21")).toBe("7");
  });
});

describe("aktivTurnusUke", () => {
  it("bruker uke2 på referansedato", () => {
    expect(aktivTurnusUke(turnus, "2026-06-16").skift).toBe("Kveld");
  });

  it("bytter til uke1 én uke etter referanse", () => {
    expect(aktivTurnusUke(turnus, "2026-06-23").skift).toBe("Dag");
  });

  it("returnerer uke1 når uke2 mangler", () => {
    const utenUke2: Turnus = {
      referanseDato: "2026-06-16",
      aktivUkeVedReferanse: 1,
      uke1: { skift: "Dag", dager: {} },
    };
    expect(aktivTurnusUke(utenUke2, "2026-06-16")).toBe(utenUke2.uke1);
  });
});
