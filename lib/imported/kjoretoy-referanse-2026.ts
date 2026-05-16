import type { Bil, Henger } from "@/lib/domain";

/** Normaliserer og fjerner duplikater (f.eks. FT65210-FEIL → FT65210). */
function normKjennemerke(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-FEIL$/i, "");
}

function unike(regnr: string[]): string[] {
  const sett = new Set<string>();
  for (const r of regnr) {
    const n = normKjennemerke(r);
    if (n) sett.add(n);
  }
  return [...sett].sort((a, b) => a.localeCompare(b, "nb", { numeric: true }));
}

function bilId(kjennemerke: string): string {
  return `bil-${kjennemerke.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function hengerId(kjennemerke: string): string {
  return `henger-${kjennemerke.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

/** Motorkjøretøy fra referansebilde (venstre tabell). Kun kjennemerke. */
const BIL_REGNR = unike([
  "EH73079",
  "EH73080",
  "EH73082",
  "ER16384",
  "FT62443",
  "FT65014",
  "FT65174",
  "FT65210",
  "FT65210-FEIL",
  "FT65424",
  "FT65425",
  "FT66179",
  "FT67565",
  "FT67670",
  "FT67772",
  "FT68445",
  "FT68446",
  "FT68448",
  "FT68552",
  "FT68944",
  "FT69946",
  "FT69949",
  "FT70028",
  "FT70029",
  "FT70030",
  "FT70280",
  "FT70280-Feil",
  "FT70430",
  "FT73149",
  "FT73780",
  "GA13075",
  "GA13077",
  "GA13799",
  "GA14224",
  "GA14330",
  "GA14363",
  "GA14364",
  "GA14399",
  "GA14400",
  "GA14643",
  "GA14645",
  "GA14646",
  "GA14647",
  "GA14656",
  "GA14714",
  "HZ33787",
  "HZ33850",
  "HZ34646",
  "HZ34873",
  "HZ35312",
  "HZ35379",
  "JV28460",
]);

/** Hengere fra referansebilde (høyre tabell). Kun kjennemerke. */
const HENGER_REGNR = unike([
  "BY5643",
  "CW7604",
  "DT8845",
  "FW1073",
  "FW1443",
  "FW6160",
  "FZ7974",
  "FZ9775",
  "FZ9921",
  "GDF1",
  "GDF2",
  "GDF3",
  "JB5233",
  "JB5234",
  "JC1616",
  "JP8416",
  "JP9583",
  "KA8829",
  "KY5486",
  "LB5061",
  "LB5062",
  "LW2219",
  "TP8410",
  "TP8412",
  "TZ7924",
  "UL1924",
  "UL1925",
  "UL8810",
  "UL8811",
  "UL8812",
  "UL8814",
  "UU7808",
  "UV4370",
  "UV4371",
  "UV8695",
  "UZ5564",
  "UZ5565",
  "VW9367",
  "XB4553",
  "XB7117",
  "XB8762",
]);

export const IMPORTERTE_BILER_REFERANSE_2026: Bil[] = BIL_REGNR.map((kjennemerke) => ({
  id: bilId(kjennemerke),
  kjennemerke,
  aktiv: true,
}));

export const IMPORTERTE_HENGERE_REFERANSE_2026: Henger[] = HENGER_REGNR.map((kjennemerke) => ({
  id: hengerId(kjennemerke),
  kjennemerke,
  aktiv: true,
}));
