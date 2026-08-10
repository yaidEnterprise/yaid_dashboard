---
name: bmad-story-pipeline
description: BMad story pipeline orchestrator — checks the current state of the active story in sprint-status.yaml and automatically invokes the correct next skill in the development lifecycle sequence: bmad-create-story → bmad-dev-story → bmad-code-review → bmad-qa-generate-unit-tests → story-commit. Use this skill when the user wants to continue story development, start the next story, or asks "qual o próximo passo", "continua o desenvolvimento", "next story", "próxima story", or invokes /bmad-story-pipeline. Always check this skill when starting a new work session in a BMad project.
---

# BMad Story Pipeline

**Goal:** Detect where the active story sits in the development lifecycle and invoke the correct next skill — so the user never has to remember the sequence.

## The Pipeline

Each story transitions through these statuses in `sprint-status.yaml`:

```
backlog → ready-for-dev → in-progress → review → test → done
```

Each status maps to a skill:

| Status | What it means | Skill to invoke |
|---|---|---|
| `backlog` | Story not yet written | `bmad-create-story` |
| `ready-for-dev` | Story file exists, not started | `bmad-dev-story` |
| `in-progress` | Implementation in progress | `bmad-dev-story` (resume) |
| `review` | Awaiting code review | `bmad-code-review` |
| `test` | Awaiting unit tests | `bmad-qa-generate-unit-tests` |
| `done` + uncommitted changes | Tests done, needs commits | `story-commit` |

## Execution

### Step 1 — Read sprint status

Read `_bmad-output/implementation-artifacts/sprint-status.yaml`. If the file doesn't exist, stop and tell the user the project isn't initialized — they need to run `bmad-sprint-planning` first.

Parse `development_status`. Skip epic keys (`epic-N`) and retrospective keys.

### Step 2 — Find the active story

Scan statuses in this priority order (highest wins):

1. **`in-progress`** — an implementation session is already open
2. **`review`** — code is waiting for review
3. **`test`** — code is reviewed and waiting for tests
4. **`ready-for-dev`** — the next story to start implementing
5. **`backlog`** (first in file order) — the next story to create

If you find multiple stories at the same priority level, list them and ask the user which to continue.

If all stories are `done`, check `git status --short`. If there are uncommitted changes that match a recently completed story, suggest running `story-commit`. If the working tree is clean, announce that the current epic is complete and ask the user what to do next (retrospective, next epic, etc.).

### Step 3 — Report and invoke

Tell the user in one short paragraph:
- Story ID and title
- Current status
- What the next step is and why

Then invoke the appropriate skill using the Skill tool. Don't ask for permission first — the user invoked this pipeline to move forward.

**Exception**: If the story is `in-progress` and the user seems to be starting a fresh session (the conversation has no recent implementation context), mention that dev-story will resume from the last incomplete task.

### Step 4 — After the invoked skill finishes

The pipeline runs autonomously end-to-end. After each skill completes, immediately invoke the next one without asking for permission.

| Finished skill | New status | Next action |
|---|---|---|
| `bmad-create-story` | `ready-for-dev` | Invoke `bmad-dev-story` immediately |
| `bmad-dev-story` | `review` | Invoke `bmad-code-review` immediately |
| `bmad-dev-story` | `test` | Invoke `bmad-qa-generate-unit-tests` immediately |
| `bmad-code-review` | `test` | Invoke `bmad-qa-generate-unit-tests` immediately |
| `bmad-qa-generate-unit-tests` | `done` | Invoke `story-commit` immediately |
| `story-commit` | — | Announce story fully complete with a one-line summary. Stop. |

Never ask "Quer continuar?", "Quer rodar o próximo passo?", or any equivalent. The user invoked the pipeline to run the full cycle — just run it.

**Valid reasons to stop mid-pipeline:**
- The invoked skill reached a HALT that requires user input (e.g. an architectural decision during code review)
- An unrecoverable error occurred
- The story reached `done` and commits were created

## Edge cases

- **User specifies a story**: If the user says "continua a story 1.4" or provides a story key, skip auto-detection and target that story directly.
- **Sprint-status modified externally**: Always re-read the file before deciding — don't cache the state from an earlier read.
- **Skill returns a HALT**: Don't try to continue — surface the halt reason and wait for the user.
