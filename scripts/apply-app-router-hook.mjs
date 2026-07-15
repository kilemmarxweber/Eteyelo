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

const routerHookImport =
  'import { useAppRouter as useRouter } from "@/hooks/use-app-router";';

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
  if (!content.includes("useRouter")) return null;
  if (filePath.includes("use-app-router.ts")) return null;
  if (filePath.includes("app-loading-provider.tsx")) return null;

  const hasClientDirective = content.includes('"use client"') || content.includes("'use client'");
  if (!hasClientDirective) return null;

  if (!/import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from\s*["']next\/navigation["']/.test(content)) {
    return null;
  }

  let next = content;

  next = next.replace(
    /import\s*\{([^}]*)\}\s*from\s*["']next\/navigation["'];?/g,
    (full, imports) => {
      const parts = imports
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      const withoutRouter = parts.filter((part) => {
        const name = part.replace(/\s+as\s+\w+$/, "").trim();
        return name !== "useRouter";
      });

      const segments = [];
      if (withoutRouter.length > 0) {
        segments.push(`import { ${withoutRouter.join(", ")} } from "next/navigation";`);
      }
      segments.push(routerHookImport);
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
