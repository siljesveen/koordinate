/**
 * Henger-ressursliste fra Ringnes-planlegger, mai 2026.
 * Eksplisitte sjåfør-ID-er — samme mønster som biler.
 */
import type { BilTilhørighet } from "@/lib/domain";

export type PlannerHengerRessurs = {
  kjennemerke: string;
  kommentar: string;
  tilhørighet?: BilTilhørighet;
  sjåførAnsattIds?: string[];
};

export const PLANNER_HENGER_RESSURSLISTE: PlannerHengerRessurs[] = [
  {
    kjennemerke: "BY5643",
    kommentar: "TF - Bjørnar",
    tilhørighet: "TF",
    sjåførAnsattIds: ["a-bj-rn-luvasen"],
  },
  {
    kjennemerke: "CW7604",
    kommentar: "TF-Atle",
    tilhørighet: "TF",
    sjåførAnsattIds: ["a-roy-atle-hagen"],
  },
  {
    kjennemerke: "DT8845",
    kommentar: "TF - Trond",
    tilhørighet: "TF",
    sjåførAnsattIds: ["a-trond-hagen"],
  },
  { kjennemerke: "FW1073", kommentar: "reserve", tilhørighet: "Reserve" },
  {
    kjennemerke: "FW1443",
    kommentar: "Josse",
    sjåførAnsattIds: ["a-john-arne-johnsen"],
  },
  {
    kjennemerke: "FW6160",
    kommentar: "Pelle",
    sjåførAnsattIds: ["a-per-ola-ake-lundgren"],
  },
  { kjennemerke: "FZ7974", kommentar: "Hamar Bilen" },
  {
    kjennemerke: "FZ9775",
    kommentar: "Mohammad Bakhsh",
    sjåførAnsattIds: ["a-mohammad-bakhshi"],
  },
  {
    kjennemerke: "FZ9921",
    kommentar: "JØRN",
    sjåførAnsattIds: ["a-j-rn-erik-sanaker"],
  },
  { kjennemerke: "GDF1", kommentar: "GDF1", tilhørighet: "GDF" },
  { kjennemerke: "GDF2", kommentar: "GDF2(FB9480)", tilhørighet: "GDF" },
  { kjennemerke: "GDF3", kommentar: "GDF3", tilhørighet: "GDF" },
  {
    kjennemerke: "JB5233",
    kommentar: "Pål/Andrejs",
    sjåførAnsattIds: ["a-thorsen-pal", "a-andrejs-seleznovs"],
  },
  {
    kjennemerke: "JB5234",
    kommentar: "Frode Ø/Erik",
    sjåførAnsattIds: ["a-frode-degardstuen", "a-erik-solbakken"],
  },
  { kjennemerke: "JC1616", kommentar: "33 paller" },
  { kjennemerke: "JP8416", kommentar: "BRING 1", tilhørighet: "Bring" },
  { kjennemerke: "JP9583", kommentar: "" },
  { kjennemerke: "KA8829", kommentar: "" },
  { kjennemerke: "KY5486", kommentar: "BRING 2", tilhørighet: "Bring" },
  {
    kjennemerke: "LB5061",
    kommentar: "Amund",
    sjåførAnsattIds: ["a-amund-nygaard-andersen"],
  },
  {
    kjennemerke: "LB5062",
    kommentar: "Morten S",
    sjåførAnsattIds: ["a-morten-steinbakken"],
  },
  {
    kjennemerke: "TP8410",
    kommentar: "Roger S / Vebjørn",
    sjåførAnsattIds: ["a-roger-haug-skogheim", "a-vebj-rn-sveum"],
  },
  {
    kjennemerke: "TP8412",
    kommentar: "Audun/Mateus",
    sjåførAnsattIds: ["a-audun-esbj-rnsen", "a-mateus-rogstad"],
  },
  {
    kjennemerke: "TZ7924",
    kommentar: "Chien",
    sjåførAnsattIds: ["a-cien-van-cao"],
  },
  {
    kjennemerke: "UL1924",
    kommentar: "Rufad / Jurij",
    sjåførAnsattIds: ["a-ferad-mehmed-rufad", "a-jurij-ciuikov"],
  },
  {
    kjennemerke: "UL1925",
    kommentar: "Gjermund / Anstein",
    sjåførAnsattIds: ["a-gjermund-petrud", "a-andrius-rukas"],
  },
  { kjennemerke: "UL8810", kommentar: "GDF - Ottadalen", tilhørighet: "GDF" },
  {
    kjennemerke: "UL8811",
    kommentar: "GDF - Johan Buddin",
    tilhørighet: "GDF",
    sjåførAnsattIds: ["a-johan-kartomten"],
  },
  {
    kjennemerke: "UL8812",
    kommentar: "Perti",
    sjåførAnsattIds: ["a-perti-portimo"],
  },
  { kjennemerke: "UL8814", kommentar: "GDF - Dombås", tilhørighet: "GDF" },
  { kjennemerke: "UU7808", kommentar: "TF", tilhørighet: "TF" },
  {
    kjennemerke: "UV4370",
    kommentar: "Arnt / Øyvind",
    sjåførAnsattIds: ["a-r-stum-arnt-georg", "a-yvind-hagen"],
  },
  {
    kjennemerke: "UV4371",
    kommentar: "Roger/John Olav",
    sjåførAnsattIds: ["a-roger-haug-skogheim", "a-john-olav-lundstad"],
  },
  {
    kjennemerke: "UV8695",
    kommentar: "Tore / Cato",
    sjåførAnsattIds: ["a-tore-furuli", "a-cato-nilsen"],
  },
  {
    kjennemerke: "UZ5564",
    kommentar: "André Ø",
    sjåførAnsattIds: ["a-andre-stli"],
  },
  {
    kjennemerke: "UZ5565",
    kommentar: "Stein Arve / Arthur",
    sjåførAnsattIds: ["a-stein-arve-lunde", "a-arturs-dambrovskis"],
  },
  {
    kjennemerke: "VW9367",
    kommentar: "Christian / Jack",
    sjåførAnsattIds: ["a-christian-elvestad", "a-jack-petersen"],
  },
  {
    kjennemerke: "XB4553",
    kommentar: "Rune / Thorbjørn",
    sjåførAnsattIds: ["a-rune-berntsen", "a-thorbj-rn-kjernaas"],
  },
  {
    kjennemerke: "XB4564",
    kommentar: "TF - Jan Morten",
    tilhørighet: "TF",
    sjåførAnsattIds: ["a-jan-morten"],
  },
  {
    kjennemerke: "XB7117",
    kommentar: "Stian / Iver",
    sjåførAnsattIds: ["a-stian-otnes", "a-iver-tr-nnes"],
  },
  {
    kjennemerke: "XB8762",
    kommentar: "Thomas / Trond",
    sjåførAnsattIds: ["a-thomas-oyen", "a-trond-hagen"],
  },
];
