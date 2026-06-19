import { describe, expect, it } from "vitest";
import type { Ansatt } from "@/lib/domain";
import { harDagKommentarIPlan } from "./bemanningsplanDagKommentar";
import type { BemanningPlanData } from "@/lib/utils/parseBemanningsplanExcel";

const ansatt: Ansatt = {
  id: "a1",
  fornavn: "Ola",
  etternavn: "Nordmann",
  aktiv: true,
  planExcelNavn: "Nordmann, Ola",
};

const plan: BemanningPlanData = {
  generated: "",
  year: 2026,
  fileName: "test.xlsx",
  sheetName: "januar",
  parserVersion: 1,
  drivers: {
    "Nordmann, Ola": {
      name: "Nordmann, Ola",
      absence: {},
      absenceComments: {
        "2026-06-17": "Kontroll sykehus",
      },
    },
  },
};

describe("harDagKommentarIPlan", () => {
  it("returnerer true når det finnes kommentar for dato", () => {
    expect(harDagKommentarIPlan(ansatt, plan, "2026-06-17")).toBe(true);
  });

  it("returnerer false uten kommentar", () => {
    expect(harDagKommentarIPlan(ansatt, plan, "2026-06-18")).toBe(false);
  });

  it("returnerer false uten plan", () => {
    expect(harDagKommentarIPlan(ansatt, null, "2026-06-17")).toBe(false);
  });
});
