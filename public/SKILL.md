---
name: task-based-conventional-commits
description: Organizes already-implemented story changes into one Conventional Commit per story task, with a separate test commit for unit tests. Use after development, review, and validation are complete.
---

# Task-Based Conventional Commits Skill

## Purpose

This skill organizes the current Git working tree into clean, traceable commits based on the tasks of a story.

It must create:

1. One commit per implemented story task.
2. One separate `test` commit for unit tests created or changed for the story.

This skill does **not** implement features, fix code, or create tests. Its responsibility is only to inspect existing changes, map them to story tasks, stage them carefully, and create commits using Conventional Commits.

## When to Use

Use this skill after:

- The story has been implemented.
- Code review has passed or the user explicitly accepts the implementation.
- Required checks, tests, linting, and type checks have already passed.
- Unit tests for the story have already been created or updated.

Do not use this skill to perform development work.

## Core Rule

For each story task, create exactly one logical commit containing only the files or hunks related to that task.

Unit tests must be committed separately in a final `test` commit.

## Required Inputs

Before committing, identify:

- The current story name or ID.
- The story description.
- The list of implementation tasks.
- The acceptance criteria.
- The changed files in the Git working tree.
- Which files or hunks belong to each task.

If the current story or tasks cannot be identified from repository context, ask the user for the story and task list before creating commits.

## Workflow

### 1. Inspect Story Context

Read the available story context from the repository, such as BMAD story files, sprint planning files, issue descriptions, task lists, or user-provided context.

Determine:

- Story title.
- Story ID, if available.
- Implementation tasks.
- Test-related task, if any.
- Expected scope of changed files.

Do not create commits before understanding the task structure.

### 2. Inspect Git State

Run:

```bash
git status --short
```

Then inspect changes with:

```bash
git diff
```

For staged changes, also inspect:

```bash
git diff --cached
```

For untracked files, inspect file names and content before staging them.

Classify changed files as:

- Created.
- Modified.
- Deleted.
- Renamed.
- Untracked.
- Test files.
- Non-story files.
- Potentially accidental files.

### 3. Map Changes to Tasks

For each task in the story:

- Identify the files related to the task.
- Identify specific hunks if a file contains changes for multiple tasks.
- Keep the mapping small and logical.

If a file contains changes for more than one task, use partial staging:

```bash
git add -p <file>
```

If partial staging is not safe or not practical, place the file in the commit where it is most logically required and explain this in the final report.

### 4. Validate Scope Before Each Commit

Before each commit, stage only the changes for the current task.

Use:

```bash
git diff --cached
```

Confirm that the staged changes:

- Belong only to the current task.
- Do not include unrelated files.
- Do not include generated artifacts unless intentionally required.
- Do not include secrets, `.env` files, tokens, logs, local build output, or temporary files.
- Represent a single logical unit of work.

Never use `git add .` unless the entire working tree has already been inspected and every changed file belongs to the current commit. Prefer explicit paths or partial staging.

### 5. Create One Commit Per Task

Create one commit for each implemented task using Conventional Commits.

Commit message format:

```text
<type>(<scope>): <short task description>
```

Allowed types:

- `feat`: new user-facing or system-facing functionality.
- `fix`: bug fix.
- `refactor`: internal code improvement without behavior change.
- `test`: test creation or test adjustment.
- `docs`: documentation-only change.
- `chore`: auxiliary maintenance task.
- `build`: build system or dependency change.
- `ci`: CI/CD change.
- `style`: formatting-only change without logic changes.

Examples:

```text
feat(identity): add proof request creation flow
feat(api): expose proof session endpoint
fix(validation): handle expired proof session
refactor(auth): extract api key validation service
chore(config): update environment schema
```

Choose the scope from the module, domain, feature, route, package, or bounded context affected by the task.

### 6. Create a Separate Unit Test Commit

After all implementation task commits are created, identify unit test files created or changed for the story.

Stage only test files.

The unit test commit must use the `test` type:

```text
test(<scope>): add unit tests for <story-name-or-feature>
```

Examples:

```text
test(identity): add unit tests for proof request story
test(auth): add unit tests for api key validation
test(proof): add unit tests for session expiration
```

This commit should contain only test files.

If implementation files are required to make tests possible, they should usually belong to the relevant implementation task commit, not the test commit.

### 7. Validate After Each Commit

After each commit, run:

```bash
git status --short
```

Confirm that remaining changes belong only to future task commits or the final test commit.

Do not continue blindly if unexpected files remain.

### 8. Final Verification

After all commits are created, run:

```bash
git status --short
```

If the working tree is clean, report that no pending changes remain.

If changes remain, classify them as:

- Intentionally uncommitted.
- Unrelated to the story.
- Ambiguous and requiring user decision.
- Unsafe to commit.

Do not push automatically.

## Commit Grouping Rules

### Required

- One commit per story task.
- One separate commit for unit tests.
- Stage files explicitly.
- Use partial staging when needed.
- Keep commits small and reviewable.
- Keep commit messages precise.
- Preserve traceability between task, files, and commit.

### Forbidden

Do not:

- Use generic messages like `update files`, `changes`, `fix stuff`, or `wip`.
- Mix unrelated tasks in the same commit.
- Include files outside the story scope.
- Commit `.env`, secrets, tokens, logs, local caches, or temporary files.
- Push automatically.
- Rewrite Git history without explicit user permission.
- Use `git commit --amend`, `git rebase`, `git reset`, or force-push unless explicitly requested.
- Modify code in order to make commits easier.
- Create empty commits for tasks that did not change files.

## Special Cases

### Task Has No File Changes

Do not create an empty commit.

Mention in the final report:

```text
Task skipped: <task name>
Reason: no commit-worthy file changes found.
```

### File Contains Multiple Task Changes

Use partial staging with:

```bash
git add -p <file>
```

If partial staging is unsafe, include the file in the most coherent task commit and document the reason.

### Unrelated Changes Exist

Do not commit unrelated changes.

Leave them unstaged and list them in the final report.

### Ambiguous Files Exist

If a file cannot be confidently mapped to a task, do not commit it without clarification.

Report:

```text
Ambiguous file: <file>
Reason: cannot safely map to a story task.
```

### Existing Staged Changes

If files are already staged before the skill starts:

1. Inspect `git diff --cached`.
2. Determine whether staged changes match the next intended task commit.
3. If they do not match, unstage safely using:

```bash
git restore --staged <file>
```

Do not discard file content.

## Final Report Format

At the end, provide a concise report:

```text
Story: <story name or ID>

Commits created:
1. <hash> - <commit message>
   Task: <task name>
   Files:
   - <file path>
   - <file path>

2. <hash> - <commit message>
   Task: <task name>
   Files:
   - <file path>

Unit test commit:
- <hash> - <commit message>
  Files:
  - <test file path>

Tasks without commits:
- <task name>: <reason>

Files left uncommitted:
- <file path>: <reason>

Notes:
- <important note, if any>

Final Git status:
- <clean or pending changes summary>
```

## Expected Behavior

Act as a Git commit organizer.

Be conservative with staging.

Prefer traceability over speed.

Never assume unrelated files should be committed.

Never push.

Never change implementation code.

The final result should be a clean, readable Git history where each story task maps to one Conventional Commit and the unit tests are isolated in their own `test` commit.
