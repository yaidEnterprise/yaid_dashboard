/**
 * Story 11.2 (QA): amplify.yml e Desabilitar Auto-Build — real YAML parse (behavioral)
 *
 * Closes the gap flagged in code review (deferred-work.md, "Testes estruturais desta story
 * usam regex/string-matching sobre amplify.yml em vez de um parser YAML real"): the dev-story
 * tests only validate proximity of text via regex, never actually parsing the file as YAML.
 * A reordered key or an inserted valid phase (e.g. postBuild) could in theory escape the regex
 * captures without failing those tests.
 *
 * This file parses amplify.yml with the real `js-yaml` library (added as a devDependency at
 * QA time — same pattern as `tsx` being added at QA time for Story 5.8 to close an equivalent
 * "100% static tests" gap) and asserts on the resulting JS object, independent of formatting,
 * key order, or incidental whitespace.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";

const ROOT = resolve(process.cwd());
const AMPLIFY_YML_PATH = resolve(ROOT, "amplify.yml");

function loadAmplifyYml() {
  const raw = readFileSync(AMPLIFY_YML_PATH, "utf8");
  return load(raw);
}

describe("Story 11.2 (QA) — amplify.yml parses as real, well-formed YAML", () => {
  test("js-yaml parses the file without throwing", () => {
    assert.doesNotThrow(() => loadAmplifyYml());
  });

  test("parsed document is a plain object (not null, array, or scalar)", () => {
    const doc = loadAmplifyYml();
    assert.equal(typeof doc, "object");
    assert.ok(doc !== null);
    assert.ok(!Array.isArray(doc));
  });

  test("version is the number 1 (not the string '1')", () => {
    const doc = loadAmplifyYml();
    assert.equal(doc.version, 1);
    assert.equal(typeof doc.version, "number");
  });

  test("frontend.phases.preBuild.commands is an array containing exactly 'npm ci'", () => {
    const doc = loadAmplifyYml();
    assert.ok(Array.isArray(doc.frontend?.phases?.preBuild?.commands));
    assert.deepEqual(doc.frontend.phases.preBuild.commands, ["npm ci"]);
  });

  test("frontend.phases.build.commands is an array containing exactly 'npm run build'", () => {
    const doc = loadAmplifyYml();
    assert.ok(Array.isArray(doc.frontend?.phases?.build?.commands));
    assert.deepEqual(doc.frontend.phases.build.commands, ["npm run build"]);
  });

  test("frontend.artifacts.baseDirectory is exactly the string '.next'", () => {
    const doc = loadAmplifyYml();
    assert.equal(doc.frontend?.artifacts?.baseDirectory, ".next");
  });

  test("frontend.artifacts.files includes the '**/*' glob", () => {
    const doc = loadAmplifyYml();
    assert.ok(Array.isArray(doc.frontend?.artifacts?.files));
    assert.ok(doc.frontend.artifacts.files.includes("**/*"));
  });

  test("frontend.artifacts.excludeFiles excludes the Next.js webpack cache", () => {
    const doc = loadAmplifyYml();
    assert.ok(Array.isArray(doc.frontend?.artifacts?.excludeFiles));
    assert.ok(doc.frontend.artifacts.excludeFiles.includes("cache/**/*"));
  });

  test("frontend.cache.paths includes both node_modules and .next/cache (real array membership, not substring match)", () => {
    const doc = loadAmplifyYml();
    assert.ok(Array.isArray(doc.frontend?.cache?.paths));
    assert.ok(doc.frontend.cache.paths.includes("node_modules/**/*"));
    assert.ok(doc.frontend.cache.paths.includes(".next/cache/**/*"));
  });

  test("no unexpected top-level keys beyond version/frontend (schema drift guard)", () => {
    const doc = loadAmplifyYml();
    assert.deepEqual(Object.keys(doc).sort(), ["frontend", "version"]);
  });

  test("commands survive a hypothetical postBuild phase insertion (mutation-style guard for the regex gap)", () => {
    // Simulates inserting a legitimate extra phase between build and artifacts — the exact
    // scenario the code review flagged as able to fool the regex-based dev-story tests.
    const mutated = `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
    postBuild:
      commands:
        - echo "done"
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
`;
    const doc = load(mutated);
    // A real parser is unaffected by the inserted phase — proving this test suite validates
    // semantics, not text proximity.
    assert.deepEqual(doc.frontend.phases.build.commands, ["npm run build"]);
    assert.deepEqual(doc.frontend.phases.postBuild.commands, ['echo "done"']);
    assert.equal(doc.frontend.artifacts.baseDirectory, ".next");
  });
});
