import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipDirs = new Set([
  "node_modules",
  ".next",
  ".git",
  "scripts",
  "dist",
]);

const transitionHookImport =
  'import { useAppTransition as useTransition } from "@/hooks/use-app-transition";';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function transform(content, filePath) {
  if (!content.includes("React.useTransition")) return null;
  if (filePath.includes("use-app-transition.ts")) return null;

  const hasClientDirective =
    content.includes('"use client"') || content.includes("'use client'");
  if (!hasClientDirective) return null;

  let next = content.replace(/React\.useTransition\(\)/g, "useTransition()");

  if (!next.includes("use-app-transition")) {
    if (next.includes('"use client";')) {
      next = next.replace(
        '"use client";\n',
        `"use client";\n\n${transitionHookImport}\n`,
      );
    } else if (next.includes("'use client';")) {
      next = next.replace(
        "'use client';\n",
        `'use client';\n\n${transitionHookImport}\n`,
      );
    }
  }

  if (next === content) return null;
  return next;
}

let updated = 0;

for (const file of walk(root)) {
  const rel = path.relative(root, file);
  const original = fs.readFileSync(file, "utf8");
  const transformed = transform(original, rel);
  if (!transformed) continue;
  fs.writeFileSync(file, transformed, "utf8");
  updated += 1;
  console.log(`updated: ${rel}`);
}

console.log(`\nTotal updated files: ${updated}`);
