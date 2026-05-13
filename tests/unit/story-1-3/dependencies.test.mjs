import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);
const readJSON = (...segments) => JSON.parse(readFileSync(fromRoot(...segments), "utf8"));

// ── package.json dependencies (AC#2) ──────────────────────────────────────────

test("Story 1.3 package.json lists react-hook-form as a runtime dependency", () => {
  const pkg = readJSON("package.json");
  const deps = pkg.dependencies ?? {};
  assert.ok("react-hook-form" in deps, "react-hook-form must be in dependencies");
  assert.match(deps["react-hook-form"], /^\^?7\./, "react-hook-form version must be in the v7 range");
});

test("Story 1.3 package.json lists @hookform/resolvers as a runtime dependency", () => {
  const pkg = readJSON("package.json");
  const deps = pkg.dependencies ?? {};
  assert.ok("@hookform/resolvers" in deps, "@hookform/resolvers must be in dependencies");
});

// ── TypeScript compilation (AC#2) ─────────────────────────────────────────────

test("Story 1.3 codebase compiles without TypeScript errors after schema migration", { timeout: 120_000 }, () => {
  execFileSync("npx", ["tsc", "--noEmit"], {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
  });
});
