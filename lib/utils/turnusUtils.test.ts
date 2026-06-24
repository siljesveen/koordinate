import { describe, expect, it } from "vitest";
import type { Ansatt, Turnus } from "@/lib/domain";
import {
  aktivTurnusUke,
  ansattErTilgjengeligITurnus,
  ansattHarTurnusArbeidstidPåDag,
  turnusUtilgjengeligGrunn,
  ukedagNummer,
} from "./turnusUtils";

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

const ansattMedTurnus = (turnus: Turnus): Ansatt => ({
  id: "a1",
  fornavn: "Test",
  etternavn: "Sjåfør",
  telefon: "",
  epost: "",
  rolle: "",
  avdeling: "",
  stillingsprosent: 100,
  kompetanse: [],
  førerkort: [],
  aktiv: true,
  turnus,
});

describe("ansattHarTurnusArbeidstidPåDag", () => {
  it("returnerer true når dagen har timer", () => {
    expect(ansattHarTurnusArbeidstidPåDag(ansattMedTurnus(turnus), "2026-06-15")).toBe(true);
  });

  it("returnerer false uten turnus eller fri dag", () => {
    expect(ansattHarTurnusArbeidstidPåDag({ turnus: undefined }, "2026-06-15")).toBe(false);
    expect(ansattHarTurnusArbeidstidPåDag(ansattMedTurnus(turnus), "2026-06-16")).toBe(false);
  });
});

describe("ansattErTilgjengeligITurnus", () => {
  it("krever timer og matchende skift", () => {
    const a = ansattMedTurnus(turnus);
    expect(ansattErTilgjengeligITurnus(a, "2026-06-22", "Dag")).toBe(true);
    expect(ansattErTilgjengeligITurnus(a, "2026-06-15", "Kveld")).toBe(true);
    expect(ansattErTilgjengeligITurnus(a, "2026-06-15", "Dag")).toBe(false);
    expect(ansattErTilgjengeligITurnus(a, "2026-06-16", "Kveld")).toBe(false);
  });

  it("bruker skift-overstyring", () => {
    const a = ansattMedTurnus(turnus);
    expect(ansattErTilgjengeligITurnus(a, "2026-06-22", "Kveld", "Kveld")).toBe(true);
  });

  it("fleksibel turnus er tilgjengelig på begge skift", () => {
    const fleksibel: Turnus = {
      referanseDato: "2026-06-16",
      aktivUkeVedReferanse: 1,
      fleksibelTilgjengelig: true,
      uke1: {
        skift: "Dag",
        dager: { "1": { startTid: "05:00", sluttTid: "23:00" } },
      },
    };
    const a = ansattMedTurnus(fleksibel);
    expect(ansattErTilgjengeligITurnus(a, "2026-06-15", "Dag")).toBe(true);
    expect(ansattErTilgjengeligITurnus(a, "2026-06-15", "Kveld")).toBe(true);
    expect(ansattErTilgjengeligITurnus(a, "2026-06-15", "Dag", "Kveld")).toBe(false);
  });
});

describe("turnusUtilgjengeligGrunn", () => {
  it("forklarer manglende turnus, fri dag og feil skift", () => {
    const a = ansattMedTurnus(turnus);
    expect(turnusUtilgjengeligGrunn({ turnus: undefined }, "2026-06-15", "Dag")).toBe("Ingen turnus");
    expect(turnusUtilgjengeligGrunn(a, "2026-06-16", "Kveld")).toBe("Fri i turnus");
    expect(turnusUtilgjengeligGrunn(a, "2026-06-15", "Dag")).toBe("Turnus: kveld");
    expect(turnusUtilgjengeligGrunn(a, "2026-06-22", "Dag")).toBeNull();
  });

  it("fleksibel turnus gir ingen skift-grunn", () => {
    const fleksibel = ansattMedTurnus({
      referanseDato: "2026-06-16",
      aktivUkeVedReferanse: 1,
      fleksibelTilgjengelig: true,
      uke1: {
        skift: "Dag",
        dager: { "1": { startTid: "05:00", sluttTid: "23:00" } },
      },
    });
    expect(turnusUtilgjengeligGrunn(fleksibel, "2026-06-15", "Kveld")).toBeNull();
  });
});
