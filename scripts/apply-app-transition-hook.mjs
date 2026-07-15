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
  if (!content.includes("useTransition")) return null;
  if (filePath.includes("use-app-transition.ts")) return null;
  if (filePath.includes("app-loading-provider.tsx")) return null;

  const hasClientDirective =
    content.includes('"use client"') || content.includes("'use client'");
  if (!hasClientDirective) return null;

  if (
    !/import\s*\{[^}]*\buseTransition\b[^}]*\}\s*from\s*["']react["']/.test(
      content,
    )
  ) {
    return null;
  }

  let next = content;

  next = next.replace(
    /import\s*\{([^}]*)\}\s*from\s*["']react["'];?/g,
    (full, imports) => {
      if (!imports.includes("useTransition")) return full;

      const parts = imports
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      const withoutTransition = parts.filter((part) => {
        const name = part.replace(/\s+as\s+\w+$/, "").trim();
        return name !== "useTransition";
      });

      const segments = [];
      if (withoutTransition.length > 0) {
        segments.push(`import { ${withoutTransition.join(", ")} } from "react";`);
      }
      segments.push(transitionHookImport);
      return segments.join("\n");
    },
  );

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
