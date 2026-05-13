#!/usr/bin/env node
/**
 * Builds Docker images only for NX-affected deployable services.
 *
 * Usage:
 *   node scripts/docker-build-affected.mjs              # build only (no push)
 *   node scripts/docker-build-affected.mjs --push       # build + push
 *   node scripts/docker-build-affected.mjs --tag=latest # custom tag (default: git SHA)
 *
 * Requires: node, yarn install already run at root, Docker daemon running.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Service → Dockerfile mapping
// ---------------------------------------------------------------------------
// Only NestJS services + frontend (no python-workers — those are deployed separately)
const SERVICE_MAP = {
  "frontend":       { dockerfile: "apps/frontend/Dockerfile", target: "development" },
  "admin-frontend": { dockerfile: "apps/admin-frontend/Dockerfile", target: "development" },
  "api-gateway":    { dockerfile: "apps/nestjs-services/api-gateway/Dockerfile", target: "development" },
  "auth-service":   { dockerfile: "apps/nestjs-services/auth-service/Dockerfile", target: "development" },
  "user-service":   { dockerfile: "apps/nestjs-services/user-service/Dockerfile", target: "development" },
  "vendor-service": { dockerfile: "apps/nestjs-services/vendor-service/Dockerfile", target: "development" },
  "event-service":  { dockerfile: "apps/nestjs-services/event-service/Dockerfile", target: "development" },
  "agent-service":  { dockerfile: "apps/nestjs-services/agent-service/Dockerfile", target: "development" },
  "search-service": { dockerfile: "apps/nestjs-services/search-service/Dockerfile", target: "development" },
};

const DEPLOYABLE = Object.keys(SERVICE_MAP);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function run(cmd, opts = {}) {
  console.log(`\n\x1b[36m> ${cmd}\x1b[0m`);
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function getTag() {
  // Prefer explicit --tag, then git SHA, then "dev"
  const tagArg = process.argv.find((a) => a.startsWith("--tag="));
  if (tagArg) return tagArg.split("=")[1];
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

function getAffectedServices() {
  const raw = execSync("yarn nx show projects --affected --base=main --head=HEAD --json", {
    encoding: "utf8",
  });
  const allAffected = JSON.parse(raw);
  return allAffected.filter((p) => DEPLOYABLE.includes(p));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const push = process.argv.includes("--push");
const tag = getTag();
const affected = getAffectedServices();

if (affected.length === 0) {
  console.log("No deployable services affected. Nothing to build.");
  process.exit(0);
}

console.log(`\nAffected services: ${affected.join(", ")}`);
console.log(`Tag: ${tag}`);
console.log(`Push: ${push}`);

let failed = [];

for (const svc of affected) {
  const { dockerfile, target } = SERVICE_MAP[svc];

  if (!existsSync(dockerfile)) {
    console.error(`\n\x1b[31mMissing Dockerfile: ${dockerfile}\x1b[0m`);
    failed.push(svc);
    continue;
  }

  const image = `polydom/${svc}:${tag}`;
  const targetArg = target ? `--target ${target}` : "";

  try {
    run(
      `docker build -f ${dockerfile} ${targetArg} -t ${image} .`,
      { stdio: "inherit" }
    );

    if (push) {
      run(`docker push ${image}`, { stdio: "inherit" });
    }

    console.log(`\x1b[32m✓ ${svc} — ${image}\x1b[0m`);
  } catch {
    console.error(`\x1b[31m✗ ${svc} failed\x1b[0m`);
    failed.push(svc);
  }
}

if (failed.length > 0) {
  console.error(`\n\x1b[31mFailed: ${failed.join(", ")}\x1b[0m`);
  process.exit(1);
}

console.log(`\n\x1b[32mAll ${affected.length} image(s) built successfully.\x1b[0m`);
