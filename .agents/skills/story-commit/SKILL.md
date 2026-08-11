---
name: story-commit
description: Turns a completed BMAD story's git changes into structured Conventional Commits — one commit per implementation task plus a final test commit. Invoke after implementing a story when you want clean, traceable commit history without manually organizing files. Use whenever a story is done and there are uncommitted changes, especially with BMAD stories in _bmad-output/implementation-artifacts/stories/. Also triggers when user says "commit the story changes", "organizar commits da story", "create story commits", or similar.
---

# Story Commit

Creates structured Conventional Commits for a completed BMAD story. Maps every changed file to its story task and commits them automatically — the user never needs to decide which file goes where.

## Step 1 — Find and read the story file

Look for story files in `_bmad-output/implementation-artifacts/stories/`. Match the current story by:

1. Branch name hint (e.g., branch `feat/story-1-2` → story 1.2)
2. Most recently modified story file with `Status: done`
3. If still ambiguous: ask the user one short question — "Which story are we committing?" — and nothing else

Read the whole story file. Extract:

- Story title and ID (e.g., "Story 1.2: Middleware de Autenticação")
- `## Tasks / Subtasks` — list of tasks and their subtasks (used to understand scope and intent)
- `## Dev Agent Record > ### File List` — `Criados`, `Modificados`, `Deletados` sections (the most reliable source for file → task mapping when populated)

## Step 2 — Inspect git changes

Run these commands:

```bash
git status --short
git diff
git diff --cached
```

For untracked files, also read their content to understand what they do.

Classify every changed file as one of:
- **Test file**: matches `tests/`, `*.test.*`, `*.spec.*` → always goes in the final test commit
- **Implementation file**: maps to one of the story tasks
- **Unrelated file**: not covered by the story (do not commit without user confirmation)

## Step 3 — Map files to tasks

For each implementation file, find which task it belongs to:

1. **Check the Dev Agent Record File List first** — if the story has this section, it lists every file created/modified/deleted per category. Cross-reference with the task descriptions to determine task membership.
2. **Reason from task descriptions** — each task describes its purpose and scope. A file like `withSessionAuth.ts` clearly belongs to "Criar withSessionAuth.ts". A file like `companies/route.ts` belongs to the task that modifies route handlers.
3. **When a file spans multiple tasks** — assign it to the task it contributes most to, or use partial staging (`git add -p`) if the changes in the file are truly independent.

Only ask the user if a file genuinely cannot be mapped to any task after reasoning through all available context.

## Step 4 — Decide commit grouping

Default: one commit per task.

**Group multiple tasks into one commit when:**
- All tasks create files for the same subsystem and they're meaningless alone (e.g., `withSessionAuth.ts`, `withApiKeyAuth.ts`, `withDIDAuth.ts` + `middleware.ts` — four tasks, all forming the middleware module)
- Tasks are tightly coupled and splitting them creates a broken intermediate state

**Keep tasks in separate commits when:**
- They touch different parts of the system (new files vs. updating existing files)
- They have different commit types (feat vs. refactor vs. chore)
- Separating them makes the history more readable

Test files always go last in a single `test` commit, regardless of how many test files there are.

Tasks with no file changes are silently skipped and listed in the final report.

## Step 5 — Show the commit plan

Before executing anything, show a concise plan and ask for confirmation:

```
Story: <title>

Commits planned:
1. feat(story-1.2): <description>
   Tasks: Task 1, Task 2, Task 3, Task 4
   Files:
   - src/middleware.ts
   - src/shared/middlewares/withSessionAuth.ts
   - src/shared/middlewares/withApiKeyAuth.ts
   - src/shared/middlewares/withDIDAuth.ts

2. refactor(story-1.2): <description>
   Task: Task 5
   Files:
   - app/api/companies/route.ts
   - app/api/company-apps/route.ts
   (...)

3. test(story-1.2): <description>
   Files:
   - tests/unit/story-1-2/middleware.test.mjs

Tasks with no changes: Task 7 (verification only — no files to commit)
```

Ask one question: "Look good? I'll execute the commits." or in Portuguese: "Tudo certo? Vou criar os commits."

Wait for confirmation before proceeding.

## Step 6 — Execute commits

For each commit in the plan:

1. Stage only the files for this commit:
   ```bash
   git add <file1> <file2> ...
   ```
   For deleted files:
   ```bash
   git rm <file>
   ```
   For partial staging:
   ```bash
   git add -p <file>
   ```

2. Verify staging is correct:
   ```bash
   git diff --cached
   ```

3. Commit using a heredoc to preserve formatting:
   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <description>
   
   Co-Authored-By: Codex Sonnet 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

4. After each commit, run `git status --short` to confirm remaining changes make sense.

Never continue blindly if unexpected files appear in staging.

## Commit message format

```
<type>(<scope>): <description>
```

**Type:**
- `feat` — new functionality
- `refactor` — restructuring or migration without behavior change
- `fix` — bug fix
- `chore` — deletions, cleanup, maintenance
- `test` — test files only
- `docs`, `build`, `ci`, `style` — as appropriate

**Scope:** Use the story ID (e.g., `story-1.2`) when a task spans multiple modules. Use the domain (e.g., `middleware`, `auth`, `routes`) when a task is clearly scoped to one area.

**Description:** Describe what was accomplished, not what changed. Outcome-focused.

Good examples:
```
feat(story-1.2): create Next.js middleware with session, API key, and DID auth routing
refactor(story-1.2): migrate API routes from requireAuthenticatedUser to x-company-id header
chore(story-1.2): delete dead proxy.ts from project root
test(story-1.2): add middleware unit tests
```

## Step 7 — Final report

After all commits, run `git status --short` and show:

```
Story: <title>

Commits created:
1. <hash> <commit message>
   Files: <list>

2. <hash> <commit message>
   Files: <list>

Tasks with no commits:
- <task>: <reason>

Files not committed:
- <file>: <reason>

Working tree: clean / <N files remaining>
```

## Hard constraints

- Never use `git add .` unless every remaining change has been inspected and verified to belong to the current commit
- Never commit `.env`, secrets, tokens, logs, build output, or temporary files
- Never create empty commits for tasks with no file changes
- Never modify implementation code to make commits easier
- Never push, amend, rebase, or force-push
- Never skip the plan confirmation step
