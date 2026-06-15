/**
 * Ressursliste fra Ringnes-planlegger (P1_ORD Planner_1), mai 2026.
 * Eksplisitte sjåfør-ID-er — ikke fuzzy matching.
 */
import type { BilTilhørighet } from "@/lib/domain";

export type PlannerRessurs = {
  kjennemerke: string;
  kommentar: string;
  tilhørighet?: BilTilhørighet;
  /** Ansatt.id for fast sjåfør på denne bilen (kan være flere). */
  sjåførAnsattIds?: string[];
};

export const PLANNER_RESSURSLISTE: PlannerRessurs[] = [
  {
    kjennemerke: "EH73079",
    kommentar: "Roger S / Vebjørn",
    sjåførAnsattIds: ["a-roger-haug-skogheim", "a-vebj-rn-sveum"],
  },
  {
    kjennemerke: "EH73080",
    kommentar: "Audun / Mateus",
    sjåførAnsattIds: ["a-audun-esbj-rnsen", "a-mateus-rogstad"],
  },
  { kjennemerke: "EH73082", kommentar: "" },
  {
    kjennemerke: "ER16384",
    kommentar: "Håkon",
    sjåførAnsattIds: ["a-hakon-amb"],
  },
  {
    kjennemerke: "FT62443",
    kommentar: "TF2 Trond",
    tilhørighet: "TF",
    sjåførAnsattIds: ["a-trond-hagen"],
  },
  {
    kjennemerke: "FT65014",
    kommentar: "David B",
    sjåførAnsattIds: ["a-david-baranowski"],
  },
  { kjennemerke: "FT65174", kommentar: "Bama Lillehammer" },
  { kjennemerke: "FT65210", kommentar: "Reserve", tilhørighet: "Reserve" },
  {
    kjennemerke: "FT65424",
    kommentar: "IVAN D / OLAV",
    sjåførAnsattIds: ["a-ivan-morgan-johansen", "a-olav-andreassen"],
  },
  { kjennemerke: "FT65425", kommentar: "Reserve", tilhørighet: "Reserve" },
  { kjennemerke: "FT66179", kommentar: "BRING 1", tilhørighet: "Bring" },
  { kjennemerke: "FT67670", kommentar: "BRING 2", tilhørighet: "Bring" },
  {
    kjennemerke: "FT67772",
    kommentar: "Pelle",
    sjåførAnsattIds: ["a-per-ola-ake-lundgren"],
  },
  {
    kjennemerke: "FT68445",
    kommentar: "Amund",
    sjåførAnsattIds: ["a-amund-nygaard-andersen"],
  },
  {
    kjennemerke: "FT68446",
    kommentar: "Morten S",
    sjåførAnsattIds: ["a-morten-steinbakken"],
  },
  {
    kjennemerke: "FT68448",
    kommentar: "Perti",
    sjåførAnsattIds: ["a-perti-portimo"],
  },
  {
    kjennemerke: "FT68552",
    kommentar: "JØRN",
    sjåførAnsattIds: ["a-j-rn-erik-sanaker"],
  },
  { kjennemerke: "FT68944", kommentar: "TF", tilhørighet: "TF" },
  {
    kjennemerke: "FT69946",
    kommentar: "Christian / Jack",
    sjåførAnsattIds: ["a-christian-elvestad", "a-jack-petersen"],
  },
  {
    kjennemerke: "FT69949",
    kommentar: "Chien / Morten",
    sjåførAnsattIds: ["a-cien-van-cao", "a-morten-steinbakken"],
  },
  {
    kjennemerke: "FT70028",
    kommentar: "John Jevne",
    sjåførAnsattIds: ["a-john-jevne"],
  },
  {
    kjennemerke: "FT70029",
    kommentar: "Bakhshi / Mats",
    sjåførAnsattIds: ["a-mohammad-bakhshi", "a-mats-astr-m"],
  },
  { kjennemerke: "FT70030", kommentar: "reserve", tilhørighet: "Reserve" },
  {
    kjennemerke: "FT70280",
    kommentar: "Gjermund / Ansteir",
    sjåførAnsattIds: ["a-gjermund-petrud", "a-andrius-rukas"],
  },
  {
    kjennemerke: "FT70430",
    kommentar: "Trond big boss",
    sjåførAnsattIds: ["a-trond-hagen"],
  },
  {
    kjennemerke: "FT73149",
    kommentar: "Jan Morten",
    sjåførAnsattIds: ["a-jan-morten"],
  },
  {
    kjennemerke: "FT73780",
    kommentar: "Bjørnar (TF)",
    tilhørighet: "TF",
    sjåførAnsattIds: ["a-bj-rn-luvasen"],
  },
  {
    kjennemerke: "GA13075",
    kommentar: "Pål / Andrejs",
    sjåførAnsattIds: ["a-thorsen-pal", "a-andrejs-seleznovs"],
  },
  {
    kjennemerke: "GA13077",
    kommentar: "Andrius/Ottar",
    sjåførAnsattIds: ["a-andrius-rukas", "a-ottar-luvasen"],
  },
  {
    kjennemerke: "GA13799",
    kommentar: "Roger/John Olav",
    sjåførAnsattIds: ["a-roger-haug-skogheim", "a-john-olav-lundstad"],
  },
  {
    kjennemerke: "GA14224",
    kommentar: "Ivan J",
    sjåførAnsattIds: ["a-ivan-morgan-johansen"],
  },
  {
    kjennemerke: "GA14330",
    kommentar: "Rufad / Jurij",
    sjåførAnsattIds: ["a-ferad-mehmed-rufad", "a-jurij-ciuikov"],
  },
  {
    kjennemerke: "GA14363",
    kommentar: "Josse / Tommy",
    sjåførAnsattIds: ["a-john-arne-johnsen", "a-tommy-iversen"],
  },
  {
    kjennemerke: "GA14364",
    kommentar: "Arnt/Øivind",
    sjåførAnsattIds: ["a-r-stum-arnt-georg", "a-yvind-hagen"],
  },
  {
    kjennemerke: "GA14399",
    kommentar: "Andre Ø",
    sjåførAnsattIds: ["a-andre-stli"],
  },
  {
    kjennemerke: "GA14400",
    kommentar: "Stein Arve /Arthurs",
    sjåførAnsattIds: ["a-stein-arve-lunde", "a-arturs-dambrovskis"],
  },
  {
    kjennemerke: "GA14643",
    kommentar: "Tore / Cato",
    sjåførAnsattIds: ["a-tore-furuli", "a-cato-nilsen"],
  },
  {
    kjennemerke: "GA14645",
    kommentar: "Frode Ø / Erik",
    sjåførAnsattIds: ["a-frode-degardstuen", "a-erik-solbakken"],
  },
  {
    kjennemerke: "GA14646",
    kommentar: "Stian / Iver",
    sjåførAnsattIds: ["a-stian-otnes", "a-iver-tr-nnes"],
  },
  {
    kjennemerke: "GA14647",
    kommentar: "Thomas / Trond",
    sjåførAnsattIds: ["a-thomas-oyen", "a-trond-hagen"],
  },
  {
    kjennemerke: "GA14656",
    kommentar: "Atle - TF",
    tilhørighet: "TF",
    sjåførAnsattIds: ["a-roy-atle-hagen"],
  },
  {
    kjennemerke: "GA14714",
    kommentar: "Rune / Thorbjørn",
    sjåførAnsattIds: ["a-rune-berntsen", "a-thorbj-rn-kjernaas"],
  },
  { kjennemerke: "GA14716", kommentar: "Bring 15 paller", tilhørighet: "Bring" },
  { kjennemerke: "HZ34646", kommentar: "GDF - Ottadalen", tilhørighet: "GDF" },
  { kjennemerke: "HZ34873", kommentar: "GDF Varebil", tilhørighet: "GDF" },
  { kjennemerke: "HZ35312", kommentar: "GDF Dombås", tilhørighet: "GDF" },
  {
    kjennemerke: "HZ35379",
    kommentar: "GDF - Johan",
    tilhørighet: "GDF",
    sjåførAnsattIds: ["a-johan-kartomten"],
  },
  { kjennemerke: "JV28460", kommentar: "Uten Transics", tilhørighet: "Bring" },
];
