---
name: bmad-qa-generate-unit-tests
description: Generate unit and contract tests for the BMAD story currently marked as "test". Use when the user asks to create unit tests for the story ready for testing.
---

# QA Generate Unit Tests Workflow

**Goal:** Generate unit-level automated tests for the implemented story currently waiting for tests.

**Your Role:** You are a QA automation engineer. Generate tests only. Do not perform code review, story validation, or unrelated refactors.

## Inputs

- Sprint status: `{project-root}/_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story files: resolved from `story_location` in sprint status, usually `{project-root}/_bmad-output/implementation-artifacts/stories/`
- Default summary: `{project-root}/_bmad-output/implementation-artifacts/tests/test-summary.md`

## Workflow

### Step 1: Find The Story To Test

1. Read `sprint-status.yaml`.
2. Under `development_status`, find stories whose status is exactly `test`.
3. Ignore epic keys and retrospective keys.
4. If no story is marked `test`, stop and tell the user no story is ready for unit-test generation.
5. If more than one story is marked `test`, ask the user which one to test.
6. Resolve the story markdown file by matching the story key against files in:
   - `{story_location}/stories/{story-key}.md`
   - `{story_location}/stories/{story-key-with-title}.md`
   - any file in `{story_location}/stories/` whose basename starts with the story key

### Step 2: Read The Story Contract

Load the selected story file and extract:

- status
- user story
- acceptance criteria
- tasks/subtasks
- dev notes
- review findings already patched

Focus the tests on implemented behavior implied by the acceptance criteria and tasks.

### Step 3: Detect The Existing Test Setup

Inspect the repo before choosing a framework:

- `package.json` scripts and dependencies
- existing files under `tests/`, `__tests__/`, `src/**/*.test.*`, `src/**/*.spec.*`
- config files such as `vitest.config.*`, `jest.config.*`, `playwright.config.*`

Use the project’s existing unit test framework if present.

If no unit framework exists:

- Prefer Node’s built-in `node:test` for lightweight unit/contract tests in TypeScript/Next.js projects when no dependency is needed.
- Add scripts:
  - `"test": "node --test \"tests/unit/**/*.test.mjs\""`
  - `"test:unit": "node --test \"tests/unit/**/*.test.mjs\""`
  - `"test:story:<story-id>": "node --test tests/unit/story-<story-id>/<topic>.test.mjs"`
- Do not add browser/E2E dependencies for this workflow.

### Step 4: Design Unit/Contract Tests

Create focused tests that prove the implemented story contract.

Prefer tests that:

- exercise pure functions, use cases, mappers, presenters, controllers, and small modules directly
- assert file/architecture contracts only when the story itself is architectural
- cover each acceptance criterion at least once
- cover happy path plus 1-2 critical error/edge cases when behavior exists
- avoid network calls, real Supabase, browser automation, and local dev servers
- run independently and deterministically

For architecture/refactor stories, valid unit/contract tests include checks for:

- expected files and directories
- required config entries
- stale imports removed
- forbidden APIs centralized, such as direct `process.env` reads
- TypeScript compilation with `npx tsc --noEmit`

### Step 5: Implement Tests

Place tests under:

```text
tests/unit/story-<story-id>/<topic>.test.mjs
```

Keep tests readable and close to the story language.

When using `node:test`:

- use `node:assert/strict`
- use filesystem checks for structural contracts
- use `execFileSync`, not shell string commands, for commands such as `npx tsc --noEmit`
- set `STAGE=TEST` when running TypeScript compilation if the project has validated environments

### Step 6: Run Tests And Fix Test Issues

Run:

```bash
npm run test:story:<story-id>
```

Then run:

```bash
npm test
```

If tests fail because the test is wrong or too brittle, fix the test.
If tests fail because implementation does not satisfy the story, report the failure clearly and do not patch production code unless the user explicitly asks.

### Step 7: Write The Summary

Update `{project-root}/_bmad-output/implementation-artifacts/tests/test-summary.md`:

```markdown
# Test Automation Summary

## Generated Tests

### Unit Tests
- [x] tests/unit/story-<story-id>/<topic>.test.mjs - <short purpose>

## Coverage
- Story <story-id> acceptance criteria: <covered>/<total> covered
- Critical paths: <summary>

## Validation
- `npm run test:story:<story-id>`: passed/failed
- `npm test`: passed/failed

## Notes
- <important constraints or deferred cases>
```

## Checklist

Validate against `checklist.md` before finishing.

## Completion

In the final answer, include:

- story tested
- files created/changed
- commands run and result
- any remaining gap or implementation failure found by tests
