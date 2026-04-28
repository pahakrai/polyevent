#!/usr/bin/env node
/**
 * Validates that all NestJS service Dockerfiles reference every shared lib.
 * Ensures new libs added to the monorepo aren't accidentally omitted from builds.
 *
 * Usage:
 *   node scripts/validate-dockerfiles.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { exit } from "node:process";

// ---------------------------------------------------------------------------
// Discover all shared libs
// ---------------------------------------------------------------------------
const libsDir = "libs";
const expectedLibs = readdirSync(libsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

console.log(`Shared libs found: ${expectedLibs.join(", ")}`);

// ---------------------------------------------------------------------------
// Validate each NestJS Dockerfile
// ---------------------------------------------------------------------------
const servicesDir = "apps/nestjs-services";
const services = readdirSync(servicesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

let errors = 0;

for (const svc of services) {
  const dockerfile = join(servicesDir, svc, "Dockerfile");
  let content;
  try {
    content = readFileSync(dockerfile, "utf8");
  } catch {
    console.log(`  SKIP ${svc}: no Dockerfile`);
    continue;
  }

  const referencedLibs = [];
  for (const lib of expectedLibs) {
    if (content.includes(`libs/${lib}/package.json`)) {
      referencedLibs.push(lib);
    }
  }

  const missing = expectedLibs.filter((l) => !referencedLibs.includes(l));
  const extra = referencedLibs.filter((l) => !expectedLibs.includes(l));

  if (missing.length > 0) {
    console.error(`  FAIL ${svc}: missing lib(s) in Dockerfile — ${missing.join(", ")}`);
    errors++;
  } else if (extra.length > 0) {
    console.warn(`  WARN ${svc}: references non-existent lib(s) — ${extra.join(", ")}`);
  } else {
    console.log(`  OK   ${svc}: all ${referencedLibs.length} lib(s) referenced`);
  }
}

// ---------------------------------------------------------------------------
// Validate frontend Dockerfile
// ---------------------------------------------------------------------------
const frontendDf = "apps/frontend/Dockerfile";
try {
  const content = readFileSync(frontendDf, "utf8");
  const hasLibs = content.includes("libs/");
  const hasNote = content.includes("add COPY libs/");
  console.log(`  OK   frontend: ${hasLibs ? "references libs" : "no lib deps needed"}${hasNote ? " (has future-use note)" : ""}`);
} catch {
  console.log("  SKIP frontend: no Dockerfile");
}

if (errors > 0) {
  console.error(`\n${errors} Dockerfile(s) have missing lib references.`);
  console.error("Add the missing COPY lines to each Dockerfile's deps stage.");
  exit(1);
}

console.log("\nAll Dockerfiles are consistent with libs/ directory.");
