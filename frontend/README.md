# Coverland Workbench Frontend

This is the React SPA frontend for Coverland Workbench. It uses a module-oriented structure that separates application-wide configuration, business modules, the API layer, and shared code.

## Local shared-grid preview (Workbench Test only)

This checkout links `@coverland-engineering/ui` to the sibling
`../../Coverland_Storybook` directory relative to `frontend/`. Build that package
with `npm run build:lib` in Coverland_Storybook before installing or running this
app; repeat that build after editing library components. The existing Tailwind
`@source` scans its linked `dist/` output. Vite deduplicates React and React DOM
so the local library and this app share one runtime.

- `/vehicle-projects` imports `GroupedDataGrid`: existing stage/product filters,
  group counts, owner/status information and project-detail links are retained.
  Sorting applies to zones within each group. Collapse controls use the shared
  grid's current-page scope and preserve collapse state for other pages.
- `/parts` imports `FlatDataGrid`: search, creation and version-history actions
  are retained. Sorting happens before pagination across all matching parts.
- `/vehicle-research` imports `GroupedDataGrid`: vehicles remain the paging unit,
  with configurations sorted within each vehicle. Search/product/status filters,
  configuration creation, research completion and development links are retained.
  Collapse controls act on the current page and preserve other pages' state.
- The remaining flat tables also import `FlatDataGrid`: Samples (Requests and
  Part Lines), Hunt Board (scan and fitting), Products, Product Registrations,
  Unique Vehicles, Shapes (issued shapes, review queue and part composition),
  and reference data (colors/materials and Seat Cover Parts).
- Existing search/filter controls, row actions and detail dialogs are retained.
  Flat tables sort the full filtered result before pagination using the existing
  TanStack row model; the unpaginated part-composition grid uses client sorting.
  Columns without a meaningful scalar value (such as inspection widgets) are
  not sortable. Column visibility/order/pinning and pagers use the shared grid.
  Grouped grids and card-based lists are unchanged by the flat-table migration.

Run `pnpm --filter frontend exec vite --port 5174 --strictPort` from this checkout
for the test app.
`pnpm --filter frontend test` uses `tsconfig.app.json` so the component-render
regression tests use the same automatic JSX runtime as the app.
The test-only `test-react-runtime.mjs` resolver deduplicates React from the local
UI link, matching Vite's existing `resolve.dedupe` setting (Node 24).
This local link requires both sibling directories; it is not a published package
upgrade and must not be used as production deployment configuration. A later
published UI release can replace the local dependency when explicitly approved.

## Project Structure

```text
src/
|
|-- app/                              # Application-wide configuration and initialization
|   |-- App.tsx                       # Root component that composes global providers and the router
|   |-- router.tsx                    # Application routes and route-level loading behavior
|   |-- store.ts                      # Redux Toolkit and RTK Query store configuration
|   |-- hooks.ts                      # Typed Redux hooks
|   |-- auth/                         # Empty placeholders for future authentication and authorization
|   |   |-- authSlice.ts
|   |   |-- guards.tsx
|   |   `-- usePermission.ts
|   `-- layout/                       # Page shell shared by all business pages
|       |-- Layout.tsx                # Layout containing the header, sidebar, and content area
|       |-- navigation.ts             # Sidebar and toolbar menu definitions and routes
|       `-- components/               # Layout-only components such as the header, sidebar, and toolbar
|
|-- modules/                          # Business domain modules
|   |-- dashboard/
|   |   `-- pages/
|   |-- profile/
|   |   `-- pages/
|   |-- product-development/          # Empty module reserved for future development
|   |-- product-registry/             # Empty module reserved for future development
|   |-- reference-data/               # Empty module reserved for future development
|   `-- vehicle-registry/             # Empty module reserved for future development
|
|-- services/                         # The only API layer, built with RTK Query
|   |-- api.ts                        # Shared createApi configuration
|   |-- index.ts                      # Shared API export
|   |-- auth.endpoints.ts             # Empty placeholder for future authentication endpoints
|   |-- vehicle.endpoints.ts          # Empty endpoint placeholder
|   |-- project.endpoints.ts          # Empty endpoint placeholder
|   |-- shape.endpoints.ts            # Empty endpoint placeholder
|   |-- masterSku.endpoints.ts        # Empty endpoint placeholder
|   |-- reference.endpoints.ts        # Empty endpoint placeholder
|   `-- file.endpoints.ts             # Empty endpoint placeholder
|
|-- constants/                        # Application-wide constants
|   |-- index.ts                      # Shared constant exports
|   |-- routes.ts                     # Routes shared by the router, navigation, and Link components
|   |-- roles.ts                      # Empty placeholder for future role constants
|   |-- ui.ts
|   `-- messages.ts
|
|-- shared/                           # Shared code used by two or more modules
|   |-- ui/                           # Generic UI components without business logic
|   |-- domain/                       # Domain-aware components shared across modules
|   |-- hooks/                        # Shared React hooks
|   |-- lib/                          # Shared utilities and helpers
|   `-- styles/                       # Global CSS, theme, and shared styles
|
|-- main.tsx                          # React application entry point
`-- vite-env.d.ts                     # Vite environment variable type declarations
```

`src/types/` does not exist yet. It will be generated after the backend type-generation approach and codegen pipeline are established. Do not add files to this directory by hand.

## Code Placement Rules

- Pages, components, hooks, and types used by only one business domain belong in that domain's `modules/<domain>/` directory.
- Add a new top-level page to its module's `pages/` directory and register it in `app/router.tsx`.
- All server API calls must go through RTK Query endpoints in `services/`. Do not call `fetch` or Axios directly from components or modules.
- Generic UI without business logic belongs in `shared/ui/`.
- Domain-aware components used by multiple modules belong in `shared/domain/`.
- Only hooks and utilities actually used by two or more modules belong in `shared/hooks/` and `shared/lib/`.
- Code tied to the application shell, such as the header, sidebar, and toolbar, belongs in `app/layout/`.
- Constants shared across multiple locations belong in `constants/` and should be accessed through barrel exports.

Do not create every possible module directory or file in advance. Add the following structure only when a module needs it during feature development:

```text
modules/<domain>/
|-- pages/                            # Page components connected to routes
|-- components/                       # UI used only by this domain
|-- hooks/                            # Domain-specific state and data hooks
|-- types.ts                          # Domain type definitions
`-- slice.ts                          # Client state not represented by the RTK Query cache
```

## File Naming

Source filenames use `kebab-case`, while React component names use `PascalCase`.

```text
vehicle-search-box.tsx -> VehicleSearchBox
use-permission.ts      -> usePermission
```
