import { describe, expect, it } from "vitest";
import {
  byggTurnusFraRader,
  raderTilUke,
  standardNyTurnus,
  turnusHarArbeidsdager,
  ukeTilRader,
} from "./turnusSkjemaUtils";

describe("ukeTilRader", () => {
  it("markerer dager med arbeidstid som aktive", () => {
    const rader = ukeTilRader({
      skift: "Dag",
      dager: { "1": { startTid: "06:00", sluttTid: "14:00" } },
    });
    expect(rader.find((r) => r.dagNr === "1")?.aktiv).toBe(true);
    expect(rader.find((r) => r.dagNr === "2")?.aktiv).toBe(false);
  });
});

describe("raderTilUke", () => {
  it("beholder kun aktive dager", () => {
    const rader = ukeTilRader(undefined);
    rader[0].aktiv = true;
    const uke = raderTilUke(rader, "Kveld");
    expect(uke.skift).toBe("Kveld");
    expect(Object.keys(uke.dager)).toEqual(["1"]);
  });
});

describe("standardNyTurnus", () => {
  it("har man–fre som dagturnus", () => {
    const turnus = standardNyTurnus();
    expect(turnus.uke1.skift).toBe("Dag");
    expect(Object.keys(turnus.uke1.dager).sort()).toEqual(["1", "2", "3", "4", "5"]);
    expect(turnus.uke2).toBeUndefined();
  });
});

describe("byggTurnusFraRader", () => {
  it("inkluderer uke2 når rotasjon er på", () => {
    const rader1 = ukeTilRader(standardNyTurnus().uke1);
    const rader2 = ukeTilRader(undefined);
    rader2[0].aktiv = true;
    const turnus = byggTurnusFraRader({
      medRotasjon: true,
      skift1: "Dag",
      skift2: "Kveld",
      rader1,
      rader2,
    });
    expect(turnus.uke2?.skift).toBe("Kveld");
    expect(turnus.uke2?.dager["1"]).toEqual({ startTid: "06:00", sluttTid: "14:00" });
  });

  it("fjerner uke2 når rotasjon er av", () => {
    const turnus = byggTurnusFraRader({
      basis: standardNyTurnus(),
      medRotasjon: false,
      skift1: "Dag",
      skift2: "Kveld",
      rader1: ukeTilRader(standardNyTurnus().uke1),
      rader2: ukeTilRader(undefined),
    });
    expect(turnus.uke2).toBeUndefined();
  });
});

describe("turnusHarArbeidsdager", () => {
  it("returnerer false uten aktive dager", () => {
    expect(
      turnusHarArbeidsdager({
        referanseDato: "2026-06-16",
        aktivUkeVedReferanse: 1,
        uke1: { skift: "Dag", dager: {} },
      }),
    ).toBe(false);
  });

  it("returnerer true når minst én uke har dager", () => {
    expect(turnusHarArbeidsdager(standardNyTurnus())).toBe(true);
  });
});
