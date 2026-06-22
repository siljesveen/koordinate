import { describe, expect, it } from "vitest";
import type { ReserveTilgjengelighet } from "@/lib/domain";
import {
  byggReserveMap,
  reserveDekkerDatoOgSkift,
  reserveTilgjengeligTekst,
  standardReserveFraKl,
} from "./reserveTilgjengelighet";

const post: ReserveTilgjengelighet = {
  id: "rt-a1-2026-06-15-Dag",
  ansattId: "a1",
  fraDato: "2026-06-15",
  skift: "Dag",
  fraKl: "06:00",
};

describe("reserveTilgjengelighet", () => {
  it("dekker riktig dato og skift", () => {
    expect(reserveDekkerDatoOgSkift(post, "2026-06-15", "Dag")).toBe(true);
    expect(reserveDekkerDatoOgSkift(post, "2026-06-15", "Kveld")).toBe(false);
    expect(reserveDekkerDatoOgSkift(post, "2026-06-16", "Dag")).toBe(false);
  });

  it("bygger map for aktive reserver", () => {
    const map = byggReserveMap([post], "2026-06-15", "Dag");
    expect(map.get("a1")).toEqual(post);
    expect(byggReserveMap([post], "2026-06-15", "Kveld").size).toBe(0);
  });

  it("formaterer visningstekst og standard klokkeslett", () => {
    expect(reserveTilgjengeligTekst("06:30")).toBe("Reserve fra 06:30");
    expect(standardReserveFraKl("Dag")).toBe("06:00");
    expect(standardReserveFraKl("Kveld")).toBe("14:00");
  });
});
