# QA Unit Tests - Validation Checklist

## Story Selection

- [ ] Story with status `test` was selected from `sprint-status.yaml`
- [ ] Story markdown file was found and read
- [ ] Acceptance criteria and tasks informed the test design

## Test Generation

- [ ] Existing unit test framework was detected and reused, or `node:test` was chosen because no unit framework existed
- [ ] Tests were saved under `tests/unit/story-<story-id>/`
- [ ] Tests cover the story acceptance criteria
- [ ] Tests cover happy path behavior where applicable
- [ ] Tests cover 1-2 critical edge/error cases where applicable
- [ ] Tests avoid browser automation, real network calls, and real external services

## Test Quality

- [ ] Tests are deterministic and independent
- [ ] Tests use standard test framework APIs
- [ ] Test names are clear and tied to story behavior
- [ ] Structural assertions are used only when the story is architectural or refactor-focused
- [ ] No hardcoded waits or sleeps

## Validation

- [ ] `npm run test:story:<story-id>` was run
- [ ] `npm test` was run
- [ ] Failures were fixed if caused by test issues
- [ ] Implementation failures were reported without unrelated production changes

## Output

- [ ] `test-summary.md` was created or updated
- [ ] Summary includes generated tests
- [ ] Summary includes coverage metrics
- [ ] Summary includes validation results
