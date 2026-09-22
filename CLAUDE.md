# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 5. Project Context

**Coverland Workbench** (codename for in-office discussions: "Co-Work", or simply "Workbench"): the internal tool hub for Coverland (iCarCover), an e-commerce business selling automotive accessories on Shopify, Amazon, eBay, Walmart, and Temu. First set of tools to be built will be for the Research & Development department: such as Catalog management / registry, Product Development Tracker, Vehicle Registry, and more. Second set of tools is most likely for the Listing team to create Listings for the Coverland Products. Later on, this app will house all internal tools for all departments.

Monorepo (pnpm workspaces + Turborepo):

```
frontend/   React 19 + Vite SPA (S3 + CloudFront)   -> has its own CLAUDE.md, read it before frontend work
backend/    NestJS 11 API (ECS Fargate)             -> has its own CLAUDE.md, read it before backend work
```

Shared code: none yet. If cross-app code appears, create `packages/` and register it in `pnpm-workspace.yaml`; do not copy-paste between apps.

Coding standards: @CODING_STANDARDS.md

**Precedence when rules conflict:** Surgical Changes (§3) wins inside existing code: do not restyle or reformat lines you are not otherwise changing. CODING_STANDARDS.md wins for all new code you write. Tooling (Prettier, ESLint, tsc) wins over everything.

## 6. Commands and Definition of Done

From the repo root:

```
pnpm install                  # install all workspaces
pnpm dev                      # run everything  [TODO: confirm turbo script names]
pnpm --filter frontend dev    # run one app (same pattern for backend)
pnpm typecheck                # tsc -b across workspaces
pnpm lint
pnpm test                     # vitest
pnpm build
```

`--filter` matches the `name` field in each app's package.json; keep package name = folder name (`frontend`, `backend`).

**A task is done only when all of these pass:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` for the affected app. `pnpm typecheck` (which runs `tsc -b`) is the source of truth; editor squiggles are not. **Do not use `tsc --noEmit`:** each app uses a solution-style `tsconfig.json` (`"files": []` plus `references`), so `--noEmit` type-checks nothing and exits 0 on code that does not compile. Build mode (`-b`) is what follows the references. Say which checks you ran in your summary.

## 7. Guardrails: ask a human first

Do not do any of the following without explicit approval in the conversation:

- Add, remove, or upgrade a dependency.
- Create or modify database migrations, or run them against anything that is not the local database.
- Delete files, tables, or data; any destructive or irreversible operation.
- Change CI/CD workflows, deploy configuration, Dockerfiles, or the deploy-hold system (GitHub Issues based; promotion is by SHA, never rebuilt per environment).
- Touch `.env` files, secrets, auth configuration, or key material.
- Force-push, rewrite history, or push directly to `main` (squash-merge PRs only).

## 8. Nested instructions

[TODO: instead of 'frontend' or 'backend', change to the right directory later]

`frontend/CLAUDE.md` and `backend/CLAUDE.md` contain app-specific deltas. They add to this file; they never repeat it. If they appear to conflict with this file, the more specific file wins for work inside that app.
