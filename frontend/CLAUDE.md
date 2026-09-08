# CLAUDE.md (frontend)

Frontend-specific instructions for **Coverland Workbench** ("Workbench"), Coverland's internal tool hub. The root CLAUDE.md and CODING_STANDARDS.md still apply; §6 (React) of the standards is the base ruleset. This file is delta only.

## Stack

React 19 (compiler enabled), TypeScript strict, Vite, Vitest + Testing Library. Deployed as a static SPA to S3 + CloudFront.
Styling: Tailwind CSS v4 · Server/global state: Redux Toolkit + RTK Query · Router: React Router v7.

## Commands (run from repo root)

```
pnpm --filter frontend dev
pnpm --filter frontend test          # vitest
pnpm --filter frontend typecheck     # tsc -b (NOT tsc --noEmit, which checks nothing)
pnpm --filter frontend lint
pnpm --filter frontend build         # must pass before done
```

## Layout

```
frontend/src/
  app/                        # Application bootstrap and composition
    App.tsx                   # Root: wraps <Provider store={store}>, theme/router providers
    router.tsx                # Route definitions, route-level loading state
    store.ts                  # configureStore (Redux Toolkit + RTK Query)
    hooks.ts                  # Typed useAppDispatch / useAppSelector
    workbench-store.tsx       # Cross-module R&D client state (context + localStorage)
    workbench-mock-data.ts    # Seed data for workbench-store, until the API lands
    auth/                     # Reserved auth/permission placeholders (not implemented)
      authSlice.ts
      guards.tsx
      usePermission.ts
    layout/                   # Page shell shared by every business page
      Layout.tsx                # Header + sidebar + content area
      navigation.ts              # Menu items; references ROUTES
      components/                # Layout-only components (header, sidebar, toolbar, ...)

  modules/<domain>/          # One folder per portal module (was: features/)
    auth/pages/               # Route-level pages for this module
    dashboard/pages/
    profile/pages/
                              # R&D department — one module per business tool:
    vehicle-registry/         #   vehicle + configuration research registry
    vehicle-hunt/             #   dealer scan/fitting visit scheduling
    product-development/      #   project tracker + project detail view
    sampling/                 #   factory sample rounds
    quality/                  #   complaints and rework loop
    product-registry/         #   unique vehicles (F#) and SKU status
    reference-data/           # Scaffolded ahead of time (tracked via .gitkeep);
                              # add components/, hooks/, types.ts, slice.ts
                              # inside a module only once it actually needs them

  services/                  # The ONLY API layer — RTK Query
    api.ts                    # createApi base: baseQuery + (eventually) tagTypes
    <domain>.endpoints.ts      # api.injectEndpoints({...}) — one file per domain
    auth.endpoints.ts          # Reserved auth endpoint placeholder
    index.ts                   # Barrel re-exporting the generated hooks

  constants/                 # Shared constants live here only
    routes.ts                  # Path constants — shared by router + nav + <Link>
    roles.ts                   # Reserved role constants placeholder
    index.ts                    # Barrel

  shared/                     # Only things used by 2+ modules
    ui/                        # Vendored ReUI/Metronic kit (Button, Dialog, ...) — do not hand-edit
    components/                 # Our own generic components, built on ui/ primitives.
                                # Grouped by UI shape: button/, table/, form/, dialog/
    domain/                     # Domain-aware shared widgets (e.g. VehicleSearchBox)
    hooks/                      # Hooks actually shared by 2+ modules
    lib/                        # Utilities actually shared by 2+ modules
    styles/                     # Global CSS, theme, per-component style overrides
    types/                      # Entity types shared by 2+ modules (workbench.ts)

  types/                      # Backend-generated; do not write by hand.
                              # [not created yet — no codegen pipeline exists. Decide the
                              #  generator (e.g. openapi-typescript) before adding files here.]
  main.tsx                    # Mounts <App /> into the DOM
```

### Where new code goes

- Pages, components, hooks, and types used by only one domain live inside that domain's `modules/<domain>/`.
- `shared/ui/` holds the vendored ReUI/Metronic kit. Treat it as a dependency: do not hand-edit those files, and do not add ours alongside them. Generic components **we** build go in `shared/components/`, grouped by UI shape (`button/`, `table/`, ...). `shared/domain/` is for components that carry domain knowledge but are still used by 2+ modules (e.g. a vehicle search box).
- `shared/hooks/` and `shared/lib/` are only for hooks/utilities actually shared by two or more modules — something used by exactly one module belongs inside that module's folder instead.
- All API calls go through `services/` (RTK Query `injectEndpoints`), never through a module-local `fetch`.
- Code tied to the app shell (header, sidebar, toolbar) lives in `app/layout/`, not in a module or in `shared/`.
- A new top-level page goes in that module's `pages/` and gets wired into `app/router.tsx`.
- Cross-module client state lives in `app/`, not in a module. `app/workbench-store.tsx` (with its `app/workbench-mock-data.ts` seed) is provided from `App.tsx` and read by every R&D module; a module must not own state that another module also writes. This is a mock-stage holding pattern — see the RTK Query rule below for the target.

As a module grows, expand it internally instead of promoting things to a shared folder too early:

```
modules/<domain>/
  pages/          # Route-level page components
  components/     # UI used only by this domain
  hooks/          # Domain-specific state/data hooks
  types.ts        # Domain type definitions
  slice.ts        # Domain-local Redux state, if the module needs any beyond RTK Query cache
```

## Conventions (delta over the standards doc)

- Workbench is an internal operator tool: favor information density, fast tables, and keyboard-first flows over visual flourish. Clarity beats decoration.
- All filenames are kebab-case, components included (standards §5): `user-table.tsx` exports `UserTable`, `use-permission.ts` exports `usePermission`. One component per file. Tests are colocated: `user-table.test.tsx` next to `user-table.tsx`.
- All server data goes through RTK Query endpoints (single `createApi`, endpoints injected per domain) and lives in the RTK Query cache, never in slices. No `fetch` or axios anywhere else.
- Redux (standards §6.1 is the full ruleset): typed hooks only (`useAppSelector`/`useAppDispatch`); slices hold client-only state (wizard drafts, bulk selection); filters and pagination go in the URL, not in slices; actions are events, not setters (`vehicles/splitCompleted`, never `setX`).
- Never return a fresh object/array literal from `useSelector`; select small values or memoize with `createSelector`.
- The store's dev-mode immutability and serializability checks stay on. Never silence them to make an error go away.
- Environment: client code uses `import.meta.env.VITE_*` only, never `process.env`. Anything prefixed `VITE_` ships to the browser, so secrets must never appear there.
- Every data-driven view renders all four states: loading, error, empty, success (discriminated union pattern, standards §3.3).
- No `useMemo` / `useCallback` / `memo` unless a measured problem exists; the React 19 compiler handles the common cases.
- Every input has a label; every action is keyboard-reachable.
- Route-level code splitting with `lazy` + `Suspense` for new top-level routes.

## Ask a human first (on top of root guardrails)

- Changing anything in `shared/` (`ui/`, `domain/`, `hooks/`, `lib/`) or design tokens used by more than one module.
- Changing `services/api.ts`, `app/auth/`, `app/store.ts`, or other global providers.
