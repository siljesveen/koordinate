import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const downloads = "C:\\Users\\sisvee7\\Downloads";
const files = [
  "Uke 1 fra 19.02.26 Ringnes.xlsx",
  "Uke 2 fra  19.02.26 Ringnes.xlsx",
  "Uke 3 fra 19.2.26 Ringnes.xlsx",
  "Uke 4 fra 19.2.26 Ringnes.xlsx",
];

function sheetPreview(wb, sheetName, maxRows = 8) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  return rows.slice(0, maxRows);
}

for (const file of files) {
  const fp = path.join(downloads, file);
  if (!fs.existsSync(fp)) {
    console.error("Mangler fil:", fp);
    continue;
  }
  const wb = XLSX.read(fs.readFileSync(fp), { type: "buffer" });

  console.log("\n=== FIL ===");
  console.log(file);
  console.log("Ark:", wb.SheetNames);

  for (const name of wb.SheetNames.slice(0, 10)) {
    const prev = sheetPreview(wb, name, 10);
    console.log(`\n--- Ark: ${name} (første linjer) ---`);
    for (const row of prev) {
      console.log(row.map((c) => String(c).replace(/\r?\n/g, " ")).join(" | "));
    }
  }

  if (wb.SheetNames.length > 10) {
    console.log(`\n... og ${wb.SheetNames.length - 10} ark til (ikke vist)`);
  }
}
