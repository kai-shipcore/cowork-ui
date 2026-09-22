# Coverland Workbench

Internal tool hub for Coverland (iCarCover). First up: R&D tools (catalog management/registry, product development tracker, vehicle registry), then Listing tools, eventually all internal tools for all departments.

## Structure

[TODO: this structure will change with Kai's changes, this is only a PLACEHOLDER]

```
frontend/   React 19 + Vite SPA (S3 + CloudFront)
backend/    NestJS 11 API (ECS Fargate)
```

Monorepo managed with pnpm workspaces + Turborepo. Each app has its own `CLAUDE.md` with app-specific rules; the root `CLAUDE.md` and `CODING_STANDARDS.md` apply everywhere.

## Prerequisites

- Node.js 22+ (`nvm use` reads `.nvmrc`)
- pnpm via corepack: `corepack enable && corepack use pnpm@latest` (this also pins `packageManager` in package.json)

## Getting started

The UI components come from `@coverland-engineering/ui`, published to GitHub
Packages from the `coverland-storybook` repo. That repo is private, so
`pnpm install` cannot resolve the package until the machine has a token —
once per machine:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" <token>
```

Create it under **Settings → Developer settings → Personal access tokens →
Tokens (classic)** with the single `read:packages` scope. It has to be a
classic token; fine-grained tokens do not work against the npm registry yet.

The token is deliberately not read from an environment variable. pnpm refuses
to expand variables in credentials that come from a committed `.npmrc`,
because a one-line edit to that file could point a real secret at somebody
else's registry.

```bash
pnpm install        # installs workspaces and wires the pre-commit hook
pnpm dev            # run all apps
pnpm --filter frontend dev   # run one app
```

## Scaffolding the apps (one-time, not yet done)

[TODO: this folder structure will change with Kai's changes, this is only a PLACEHOLDER]

The `frontend/` and `backend/` folders currently contain only their `CLAUDE.md`. Generators refuse non-empty folders, so temporarily move the `CLAUDE.md` out, scaffold, then move it back:

```bash
# Frontend
pnpm create vite@latest frontend --template react-ts

# Backend
pnpm dlx @nestjs/cli@latest new backend --package-manager pnpm --skip-git --skip-install
```

After scaffolding, in each app's `package.json`: set `"name"` to exactly `frontend` / `backend` (the pnpm `--filter` commands depend on it), extend `tsconfig.base.json`, and add `typecheck` (`tsc --noEmit`), `lint`, and `test` scripts so the Turborepo tasks work.

## Quality gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. All four must pass before merge; CI enforces them. Pre-commit runs Prettier + ESLint on staged files via husky + lint-staged.

## Conventions

- `CODING_STANDARDS.md`: the coding standards (RFC 2119 keywords).
- `CLAUDE.md`: instructions for AI coding agents (and a good read for humans).
- Squash-merge only to `main`; PRs follow the template.
