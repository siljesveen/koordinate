import type { Ansatt } from "@/lib/domain";
import { fullNavn } from "@/lib/domain";
import { skrivUtHtml } from "@/lib/utils/skrivUtHtml";

export type AnsattListeFilter = "alle" | "aktiv" | "inaktiv";

const FILTER_ETIKETT: Record<AnsattListeFilter, string> = {
  aktiv: "Kun aktive",
  inaktiv: "Kun inaktive",
  alle: "Alle",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function skrivUtAnsattListe(ansatte: Ansatt[], filter: AnsattListeFilter): void {
  if (ansatte.length === 0) return;

  const dato = new Date().toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const filterTekst = FILTER_ETIKETT[filter];
  const radHtml = ansatte
    .map(
      (a) => `<tr>
      <td>${escapeHtml(fullNavn(a))}</td>
      <td>${escapeHtml(a.selskap || "Asko")}</td>
      <td>${escapeHtml(a.telefon)}</td>
      <td>${a.aktiv ? "Aktiv" : "Inaktiv"}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <title>Ansatte</title>
  <style>
    @page { margin: 1.2cm 1.5cm; }
    body { font-family: system-ui, sans-serif; font-size: 10pt; margin: 0; color: #000; }
    h1 { font-size: 12pt; margin: 0 0 0.75rem; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.3rem 0.45rem; text-align: left; border-bottom: 1px solid #ccc; vertical-align: top; }
    th { border-bottom: 2px solid #333; font-weight: 700; }
    tfoot td { border: none; padding-top: 0.65rem; color: #444; font-size: 9pt; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
  </style>
</head>
<body>
  <h1>Ansatte · ${escapeHtml(filterTekst)} · ${dato}</h1>
  <table>
    <thead>
      <tr><th>Navn</th><th>Selskap</th><th>Telefon</th><th>Aktiv</th></tr>
    </thead>
    <tbody>${radHtml}</tbody>
    <tfoot>
      <tr><td colspan="4">${ansatte.length} ${ansatte.length === 1 ? "ansatt" : "ansatte"}</td></tr>
    </tfoot>
  </table>
</body>
</html>`;

  skrivUtHtml(html);
}
