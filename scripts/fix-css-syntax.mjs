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

function fix(css) {
  let c = css;
  c = c.replace(/`\n/g, "\n");
  c = c.replace(/\{`n  /g, "{\n  ");
  c = c.replace(/bordervar\(/g, "border-color: var(");
  c = c.replace(/border2px solid/g, "border: 2px solid");
  c = c.replace(/border4px solid/g, "border-left: 4px solid");
  c = c.replace(/border-left4px solid/g, "border-left: 4px solid");
  c = c.replace(/border-bottom4px solid/g, "border-bottom: 4px solid");
  c = c.replace(/border-top4px solid/g, "border-top: 4px solid");
  c = c.replace(/border-right4px solid/g, "border-right: 4px solid");
  c = c.replace(/border-left3px solid/g, "border-left: 3px solid");
  c = c.replace(/border:1px/g, "border: 1px");
  c = c.replace(/border:rgba\(/g, "border: 1px solid rgba(");
  return c;
}

for (const file of walk(root)) {
  const before = readFileSync(file, "utf8");
  const after = fix(before);
  if (before !== after) {
    writeFileSync(file, after, "utf8");
    console.log("Fixed:", path.relative(root, file));
  }
}
