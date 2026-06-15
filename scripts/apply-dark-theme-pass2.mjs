/**
 * Andre pass: statusfarger og gjenværende lyse flater → dark theme.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (name.endsWith(".module.css")) acc.push(full);
  }
  return acc;
}

const replacements = [
  [/background:\s*linear-gradient\(160deg,\s*#f1f5f9[^)]+\)/g, "background: var(--background)"],
  [/background:\s*linear-gradient\(135deg,\s*#0f172a[^)]+\)/g, "background: linear-gradient(135deg, var(--surface) 0%, var(--surface-hover) 100%)"],
  [/background:\s*linear-gradient\(180deg,\s*#fffbeb[^)]+\)/g, "background: var(--status-warn-bg)"],
  [/background:\s*linear-gradient\(180deg,\s*#fff7ed[^)]+\)/g, "background: var(--status-warn-bg)"],
  [/background:\s*linear-gradient\(90deg,\s*#fffbeb[^)]+\)/g, "background: var(--status-warn-bg)"],
  [/background:\s*#fffbeb/g, "background: var(--status-warn-bg)"],
  [/background:\s*#fef3c7/g, "background: rgba(245, 158, 11, 0.2)"],
  [/background:\s*#fef9c3/g, "background: rgba(245, 158, 11, 0.18)"],
  [/background:\s*#fee2e2/g, "background: var(--status-error-bg)"],
  [/background:\s*#fecaca/g, "background: rgba(239, 68, 68, 0.22)"],
  [/background:\s*#fff1f2/g, "background: var(--status-error-bg)"],
  [/background:\s*#ffe4e6/g, "background: rgba(239, 68, 68, 0.2)"],
  [/background:\s*#f0f9ff/g, "background: var(--status-info-bg)"],
  [/background:\s*#fafbfc/g, "background: var(--background-subtle)"],
  [/background:\s*#e2e8f0/g, "background: var(--surface-hover)"],
  [/background:\s*#cbd5e1/g, "background: var(--surface-hover)"],
  [/border(?:-[a-z]+)?:\s*([^;]*?)#fecaca/g, "border:$1rgba(239, 68, 68, 0.35)"],
  [/border(?:-[a-z]+)?:\s*([^;]*?)#fde047/g, "border:$1rgba(245, 158, 11, 0.4)"],
  [/border(?:-[a-z]+)?:\s*([^;]*?)#fde68a/g, "border:$1rgba(245, 158, 11, 0.35)"],
  [/border(?:-[a-z]+)?:\s*([^;]*?)#fcd34d/g, "border:$1rgba(245, 158, 11, 0.4)"],
  [/border(?:-[a-z]+)?:\s*([^;]*?)#fdba74/g, "border:$1rgba(245, 158, 11, 0.35)"],
  [/border-color:\s*#f59e0b/g, "border-color: var(--status-warn)"],
  [/border:\s*1px solid #fde68a/g, "border: 1px solid rgba(245, 158, 11, 0.35)"],
  [/outline:\s*2px solid #3b82f6/g, "outline: 2px solid var(--brand-primary)"],
  [/\.submit\s*\{[^}]*background:\s*var\(--surface\)/g, (m) =>
    m.replace("background: var(--surface)", "background: var(--brand-primary)")],
  [/\.submit:hover\s*\{[^}]*background:\s*var\(--surface-hover\)/g, (m) =>
    m.replace("background: var(--surface-hover)", "background: var(--brand-primary-hover)")],
  [/\.brandIcon\s*\{[^}]*background:\s*var\(--surface\)/g, (m) =>
    m.replace("background: var(--surface)", "background: transparent")],
];

const files = walk(root);
for (const file of files) {
  if (file.includes("TopNav.module.css")) continue;
  let c = readFileSync(file, "utf8");
  const before = c;
  for (const [pat, rep] of replacements) {
    c = typeof rep === "function" ? c.replace(pat, rep) : c.replace(pat, rep);
  }
  if (c !== before) {
    writeFileSync(file, c, "utf8");
    console.log("Pass 2:", path.relative(root, file));
  }
}
console.log("Pass 2 done.");
