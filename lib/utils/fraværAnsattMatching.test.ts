import { describe, expect, it } from "vitest";
import type { Ansatt } from "@/lib/domain";
import {
  matchAnsattIdForDriverNavn,
  normalizeNavn,
  parseExcelNavn,
} from "./fraværAnsattMatching";

const ansatt = (overrides: Partial<Ansatt> = {}): Ansatt => ({
  id: "a1",
  fornavn: "Ola",
  etternavn: "Nordmann",
  telefon: "",
  epost: "",
  rolle: "Sjåfør",
  avdeling: "Transport",
  stillingsprosent: 100,
  kompetanse: [],
  førerkort: [],
  aktiv: true,
  ...overrides,
});

describe("normalizeNavn", () => {
  it("normaliserer norske tegn og punktum", () => {
    expect(normalizeNavn("Hansen, Øyvind")).toBe("hansen, oyvind");
    expect(normalizeNavn("O.B. Hansen")).toBe("o b hansen");
  });
});

describe("parseExcelNavn", () => {
  it("parser etternavn, fornavn-format", () => {
    expect(parseExcelNavn("Nordmann, Ola")).toEqual({
      etternavn: "Nordmann",
      fornavn: "Ola",
    });
  });
});

describe("matchAnsattIdForDriverNavn", () => {
  it("matcher eksakt Excel-navn", () => {
    const ansatte = [ansatt({ id: "match-1" })];
    expect(matchAnsattIdForDriverNavn("Nordmann, Ola", ansatte)).toBe("match-1");
  });

  it("matcher delvis fornavn når etternavn er unikt", () => {
    const ansatte = [ansatt({ id: "match-2", fornavn: "Ole Martin", etternavn: "Hansen" })];
    expect(matchAnsattIdForDriverNavn("Hansen, Ole", ansatte)).toBe("match-2");
  });

  it("returnerer null ved tvetydig match", () => {
    const ansatte = [
      ansatt({ id: "a1", fornavn: "Ola", etternavn: "Hansen" }),
      ansatt({ id: "a2", fornavn: "Ole", etternavn: "Hansen" }),
    ];
    expect(matchAnsattIdForDriverNavn("Hansen, O", ansatte)).toBeNull();
  });
});
