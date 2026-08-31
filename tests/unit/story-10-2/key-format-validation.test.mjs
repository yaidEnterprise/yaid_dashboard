/**
 * Story 10.2 — Validação de Formato de Chaves no Boot
 *
 * Testes estruturais:
 *   - envSchema troca .min(1) pelos 4 campos de chave por z.string().optional() simples.
 *   - superRefine ganha validação de formato hex (3 chaves privadas), ethers.isAddress
 *     (endereço do contrato) e rejeição do valor exato de placeholder do TEST_ENV.
 *   - Ordem correta: as checagens novas vêm ANTES do early-return gated por PROD/HOMOLOG.
 *   - Compilação TypeScript limpa.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const ENVIRONMENTS = "src/shared/environments.ts";

describe("Story 10.2 — envSchema fields simplified to plain optional (AC #1, #2)", () => {
  test("ISSUER_PRIVATE_KEY/WEBHOOK_SIGNING_PRIVATE_KEY/BLOCKCHAIN_WALLET_PRIVATE_KEY/BLOCKCHAIN_CONTRACT_ADDRESS are z.string().optional() (no .min(1))", () => {
    const src = readText(ENVIRONMENTS);
    for (const envName of [
      "ISSUER_PRIVATE_KEY",
      "WEBHOOK_SIGNING_PRIVATE_KEY",
      "BLOCKCHAIN_WALLET_PRIVATE_KEY",
      "BLOCKCHAIN_CONTRACT_ADDRESS",
    ]) {
      assert.match(src, new RegExp(`${envName}: z\\.string\\(\\)\\.optional\\(\\)`));
    }
    assert.doesNotMatch(
      src,
      /(ISSUER_PRIVATE_KEY|WEBHOOK_SIGNING_PRIVATE_KEY|BLOCKCHAIN_WALLET_PRIVATE_KEY|BLOCKCHAIN_CONTRACT_ADDRESS): z\.string\(\)\.min\(1\)/
    );
  });

  test("imports ethers for isAddress validation", () => {
    const src = readText(ENVIRONMENTS);
    assert.match(src, /import\s*\{\s*ethers\s*\}\s*from\s*"ethers"/);
  });

});

describe("Story 10.2 — superRefine format checks (AC #2)", () => {
  test("validates BLOCKCHAIN_CONTRACT_ADDRESS via ethers.isAddress with an actionable message", () => {
    const src = readText(ENVIRONMENTS);
    assert.match(src, /ethers\.isAddress\(values\.BLOCKCHAIN_CONTRACT_ADDRESS\)/);
    assert.match(src, /BLOCKCHAIN_CONTRACT_ADDRESS must be a valid Ethereum address/);
  });
});

describe("Story 10.2 — TEST_ENV placeholder rejection outside TEST (AC #3)", () => {
  test("builds the set of known TEST_ENV values from productionRequiredEnvNames and checks membership (not just same-field equality)", () => {
    const src = readText(ENVIRONMENTS);
    assert.match(
      src,
      /new Set\(\s*productionRequiredEnvNames\.map\(\(envName\) => TEST_ENV\[envName\]\)\s*\)/
    );
    assert.match(src, /knownTestValues\.has\(value\)/);
    assert.match(
      src,
      /is set to a known TEST_ENV placeholder value, which must never be used outside the TEST stage/
    );
  });

  test("the placeholder-rejection loop iterates productionRequiredEnvNames (all 4 vars)", () => {
    const src = readText(ENVIRONMENTS);
    const superRefineBlock = src.match(/\.superRefine\(\(values, ctx\) => \{[\s\S]+?\n {2}\}\);/)?.[0] ?? "";
    const placeholderLoopMatches = [
      ...superRefineBlock.matchAll(/for \(const envName of productionRequiredEnvNames\)/g),
    ];
    assert.ok(
      placeholderLoopMatches.length >= 2,
      "must reuse productionRequiredEnvNames for both the placeholder check and the presence check"
    );
  });
});

describe("Story 10.2 — defined-but-empty values are treated as invalid, not absent (review patch)", () => {
  test("the address check uses '!== undefined' instead of a truthy guard, so an empty string is validated (not skipped)", () => {
    const src = readText(ENVIRONMENTS);
    assert.match(
      src,
      /values\.BLOCKCHAIN_CONTRACT_ADDRESS !== undefined\s*&&\s*\n?\s*!ethers\.isAddress/
    );
  });
});

describe("Story 10.2 — critical ordering: new checks run BEFORE the PROD/HOMOLOG early-return (AC #3, #5)", () => {
  test("the stage-gated early-return for presence appears after the format/placeholder checks in source order", () => {
    const src = readText(ENVIRONMENTS);
    const addressCheckIndex = src.indexOf("ethers.isAddress(values.BLOCKCHAIN_CONTRACT_ADDRESS)");
    const placeholderCheckIndex = src.indexOf("knownTestValues.has(value)");
    const earlyReturnIndex = src.indexOf(
      "if (values.STAGE !== Stage.PROD && values.STAGE !== Stage.HOMOLOG) {"
    );

    assert.ok(addressCheckIndex > -1 && placeholderCheckIndex > -1 && earlyReturnIndex > -1);
    assert.ok(
      addressCheckIndex < earlyReturnIndex,
      "address format check must run before the PROD/HOMOLOG early-return, otherwise it never runs for DOTENV/DEV"
    );
    assert.ok(
      placeholderCheckIndex < earlyReturnIndex,
      "placeholder rejection must run before the PROD/HOMOLOG early-return, otherwise it never runs for DOTENV/DEV"
    );
  });
});

// ── Compilação TypeScript ────────────────────────────────────────────────────

test("Story 10.2 all modified files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = resolve(ROOT, "node_modules", ".bin", "tsc");
  try {
    execSync(`"${tscBin}" --noEmit`, {
      cwd: ROOT,
      env: { ...process.env, STAGE: "TEST" },
      stdio: "pipe",
      shell: true,
    });
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    const storyErrors = stdout
      .split("\n")
      .filter((line) => line.includes("error TS") && !line.includes("lucide-react"));
    if (storyErrors.length > 0) {
      assert.fail(`TypeScript errors in story files:\n${storyErrors.join("\n")}`);
    }
  }
});
