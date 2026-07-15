import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipDirs = new Set(["node_modules", ".next", ".git"]);
const importLine =
  'import { useAppTransition as useTransition } from "@/hooks/use-app-transition";';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

let fixed = 0;

for (const file of walk(root)) {
  const rel = path.relative(root, file);
  if (rel.includes("use-app-transition.ts")) continue;

  let content = fs.readFileSync(file, "utf8");
  if (!content.includes("useTransition()")) continue;
  if (content.includes("use-app-transition")) continue;

  const hasClientDirective =
    content.includes('"use client"') || content.includes("'use client'");
  if (!hasClientDirective) continue;

  const next = content.replace(
    /("use client";|'use client';)\r?\n/,
    `$1\n\n${importLine}\n`,
  );

  if (next === content) continue;
  fs.writeFileSync(file, next, "utf8");
  fixed += 1;
  console.log(`fixed: ${rel}`);
}

console.log(`\nTotal fixed files: ${fixed}`);
