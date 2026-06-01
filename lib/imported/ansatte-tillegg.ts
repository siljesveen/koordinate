import type { Ansatt } from "@/lib/domain";

/** Ansatte som ikke finnes i Bemanning 2026.xlsx, men brukes i planlegger-ressurslisten. */
export const ANSATTE_TILLEGG: Ansatt[] = [
  {
    id: "a-jan-morten",
    fornavn: "Jan",
    etternavn: "Morten",
    telefon: "",
    epost: "",
    rolle: "Sjåfør",
    avdeling: "TF",
    selskap: "TF",
    stillingsprosent: 100,
    kompetanse: [],
    førerkort: [],
    aktiv: true,
    kommentar: "TF-sjåfør · fast bil FT73149 (Ringnes-planlegger)",
  },
];
