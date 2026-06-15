/**
 * Engangs-skript: konverterer *.module.css til dark theme med CSS-variabler.
 * Kjør: node scripts/apply-dark-theme.mjs
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

function transform(css, filePath) {
  if (filePath.includes("TopNav.module.css")) return css;

  let c = css;

  c = c.replace(/var\(--font-geist-sans\)/g, "var(--font-inter)");

  c = c.replace(/background:\s*#fef2f2/g, "background: var(--status-error-bg)");
  c = c.replace(/background:\s*#fefce8/g, "background: var(--status-warn-bg)");
  c = c.replace(/background:\s*#fff7ed/g, "background: var(--status-warn-bg)");
  c = c.replace(/background:\s*#eff6ff/g, "background: var(--status-info-bg)");
  c = c.replace(/background:\s*#ecfdf5/g, "background: var(--status-ok-bg)");
  c = c.replace(/background:\s*#f0fdf4/g, "background: var(--status-ok-bg)");

  c = c.replace(/color:\s*#0f172a/g, "color: var(--foreground)");
  c = c.replace(/color:\s*#1e293b/g, "color: var(--foreground)");
  c = c.replace(/color:\s*#334155/g, "color: var(--foreground-muted)");
  c = c.replace(/color:\s*#475569/g, "color: var(--brand-muted)");
  c = c.replace(/color:\s*#64748b/g, "color: var(--brand-muted)");
  c = c.replace(/color:\s*#94a3b8/g, "color: var(--foreground-muted)");
  c = c.replace(/color:\s*#0369a1/g, "color: var(--brand-sky)");
  c = c.replace(/color:\s*#15803d/g, "color: var(--status-ok)");
  c = c.replace(/color:\s*#b91c1c/g, "color: var(--status-error)");
  c = c.replace(/color:\s*#dc2626/g, "color: var(--status-error)");
  c = c.replace(/color:\s*#ca8a04/g, "color: var(--status-warn)");

  c = c.replace(/background:\s*#f8fafc/g, "background: var(--surface-raised)");
  c = c.replace(/background:\s*#f1f5f9/g, "background: var(--background-subtle)");
  c = c.replace(/background:\s*#ffffff/g, "background: var(--surface)");
  c = c.replace(/background:\s*#fff;/g, "background: var(--surface);");
  c = c.replace(/background:\s*#1e293b/g, "background: var(--surface-hover)");
  c = c.replace(/background:\s*#0f172a/g, "background: var(--surface)");

  c = c.replace(/border(?:-[a-z]+)?:\s*([^;]*?)#e2e8f0/g, "border$1var(--border)");
  c = c.replace(/border(?:-[a-z]+)?:\s*([^;]*?)#cbd5e1/g, "border$1var(--border-strong)");
  c = c.replace(/border(?:-[a-z]+)?:\s*([^;]*?)#f1f5f9/g, "border$1var(--border)");
  c = c.replace(/border(?:-[a-z]+)?:\s*([^;]*?)#f8fafc/g, "border$1var(--border)");
  c = c.replace(/border(?:-[a-z]+)?:\s*([^;]*?)#0f172a/g, "border$1var(--brand-primary)");

  c = c.replace(/border-left:\s*4px solid #22c55e/g, "border-left: 4px solid var(--status-ok)");
  c = c.replace(/border-left:\s*4px solid #ef4444/g, "border-left: 4px solid var(--status-error)");
  c = c.replace(/border-left:\s*4px solid #eab308/g, "border-left: 4px solid var(--status-warn)");
  c = c.replace(/border-left:\s*4px solid #f97316/g, "border-left: 4px solid var(--status-warn)");
  c = c.replace(/border-left:\s*4px solid #e2e8f0/g, "border-left: 4px solid var(--border-strong)");

  c = c.replace(/box-shadow:\s*0 1px 2px rgba\(15,\s*23,\s*42,\s*0\.04\)/g, "box-shadow: var(--shadow)");
  c = c.replace(/box-shadow:\s*0 1px 3px rgba\(0,\s*0,\s*0,\s*0\.04\)/g, "box-shadow: var(--shadow)");
  c = c.replace(/box-shadow:\s*0 8px 24px rgba\(15,\s*23,\s*42,\s*0\.12\)/g, "box-shadow: var(--shadow-lg)");
  c = c.replace(/box-shadow:\s*0 4px 12px rgba\(15,\s*23,\s*42,\s*0\.08\)/g, "box-shadow: var(--shadow-lg)");

  c = c.replace(/border-color:\s*#3b82f6/g, "border-color: var(--brand-primary)");
  c = c.replace(/border-color:\s*#94a3b8/g, "border-color: var(--border-strong)");
  c = c.replace(
    /box-shadow:\s*0 0 0 2px rgba\(59,\s*130,\s*246,\s*0\.1[25]\)/g,
    "box-shadow: var(--focus-ring)",
  );

  for (const cls of [
    "tabBtnActive",
    "dayShortcutActive",
    "filterBtn",
    "primaryBtn",
    "submitBtn",
    "ukeBadge",
    "toggleBtnActive",
    "tabActive",
  ]) {
    const re = new RegExp(`\\.${cls}\\s*\\{[^}]*background:\\s*var\\(--surface\\)`, "g");
    c = c.replace(re, (m) => m.replace("background: var(--surface)", "background: var(--brand-primary)"));
  }

  c = c.replace(/calc\(100vh - 3rem\)/g, "calc(100vh - 3.25rem)");
  c = c.replace(/background:\s*#fafafa/g, "background: var(--background-subtle)");

  return c;
}

const files = walk(root);
let count = 0;
for (const file of files) {
  const before = readFileSync(file, "utf8");
  const after = transform(before, file);
  if (before !== after) {
    writeFileSync(file, after, "utf8");
    count++;
    console.log("Updated:", path.relative(root, file));
  }
}
console.log(`Done. ${count} files updated.`);
