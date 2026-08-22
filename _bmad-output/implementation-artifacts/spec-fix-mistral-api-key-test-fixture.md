---
title: 'Fix MISTRAL_API_KEY-flaky test fixture in Story 10.2 envSchema validation'
type: 'bugfix'
created: '2026-08-22'
status: 'done'
context: []
route: 'one-shot'
---

## Intent

**Problem:** `tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts` — "all 4 keys with valid, non-placeholder values do not throw in PROD" — only passed when the developer's shell already had `MISTRAL_API_KEY` set (a pre-existing, unrelated PROD/HOMOLOG-required var in `productionRequiredEnvNames`), and failed in a clean environment such as CI.

**Approach:** Supply `MISTRAL_API_KEY` explicitly in that test's env fixture, hoisted to a named constant for consistency with the file's other `VALID_*` constants; add a mirroring regression test proving the presence check still fires when `MISTRAL_API_KEY` is absent in PROD; rename the test title to reflect the 5th required var and cite the enforcing schema in a comment.

## Suggested Review Order

**Test fixture fix**

- Adds `VALID_MISTRAL_API_KEY` constant alongside the file's other valid-value fixtures, with a comment citing `productionRequiredEnvNames`/the `superRefine` presence check as the enforcing code.
  [`envSchema-key-validation.dynamic.test.ts:25`](../../tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts#L25)

- Root-cause fix: the PROD "all keys valid" fixture now sets `MISTRAL_API_KEY`, and the test title is renamed to disclose the 5th required var.
  [`envSchema-key-validation.dynamic.test.ts:118`](../../tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts#L118)

**New regression coverage**

- Mirrors the existing `ISSUER_PRIVATE_KEY` PROD-presence regression test, proving `MISTRAL_API_KEY`'s own presence check is independently verified by the suite.
  [`envSchema-key-validation.dynamic.test.ts:345`](../../tests/unit/story-10-2/envSchema-key-validation.dynamic.test.ts#L345)

**Deferred (out of scope for this fix)**

- Six related gaps (no systemic audit of similar latent flakiness, no dedicated `MISTRAL_API_KEY` format/placeholder coverage, no shared PROD-required fixture, Story 10.2 doc not updated to mention the 5th var, `TEST_ENV` missing a `MISTRAL_API_KEY` field, no test tying the new literal to future `TEST_ENV` placeholder collisions) logged in `deferred-work.md`.
  [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md)
