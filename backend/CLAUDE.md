# CLAUDE.md (backend)

Backend-specific instructions for **Coverland Workbench** ("Workbench"), Coverland's internal tool hub. The root CLAUDE.md and CODING_STANDARDS.md still apply; §7 (NestJS) of the standards is the base ruleset. This file is delta only.

## Stack

NestJS 11, Prisma [TODO: confirm ORM choice], PostgreSQL [TODO: confirm target DB: dedicated admin DB vs. Coverland production Postgres], Vitest.
Auth: [TODO: confirm mechanism, e.g. Google Workspace SSO]

## Commands (run from repo root)

[TODO: following assumes we will use 'backend' directory which is probably not right. Change the following to correct directory name later on]

```
pnpm --filter backend start:dev
pnpm --filter backend test              # vitest
pnpm --filter backend typecheck
pnpm --filter backend lint
pnpm --filter backend prisma generate   # after any schema change
pnpm --filter backend prisma migrate dev   # LOCAL database only
```

Done = typecheck + lint + tests green, and if `schema.prisma` changed: a migration exists in the same change and `prisma generate` was run.

## Architecture (must hold in every change)

Four layers, dependencies point inward (standards §7):

```
api  ->  application  ->  domain  <-  infra
```

- `api/`: controllers + DTOs. Thin: validate, call one service method, map to response DTO. Zero business logic.
- `application/`: use cases / services. Orchestration only.
- `domain/`: entities and business rules. Imports nothing from the other layers.
- `infra/`: Prisma repositories and external clients. Prisma is imported here and nowhere else; services depend on repository interfaces.

(Note: `api/` above is the controller layer inside `backend/`, not a folder name requirement.)

Feature modules per domain area (e.g. catalog, product development, vehicle registry, listings) [TODO: adjust to the actual module list]. Cross-module access goes through public module exports only.

## Domain vocabulary (Coverland catalog; use these terms exactly)

- **master_sku** is the product supertype (cover_sku is the cover subtype), identified by **master_sku_code**.
- **product_shape**, never "size".
- **F#** = fitment identity, globally unique per product type. Related entities: **fitment_group**, **unique_vehicle**, **vehicle_family**, **config_hash**, **brand_vehicle_definition**.
- R&D pipeline entities: **vehicle_zone**, **vehicle_component**, **part**, **part_version**.
- Table naming: pure join tables are `{parent}_to_{child}`; all other tables are `{parent}_{what_the_row_is}`.
- Referential and business integrity is enforced at the API layer, not with database triggers.

[Trim this list to the entities this app actually touches once the schema lands.]

## Data safety

- Workbench reads and writes business-critical Coverland data. Treat every write path as production-affecting: validate inputs, make writes idempotent where retries are possible, and never widen a write's scope beyond the request.
- Every schema change ships with its migration in the same PR. Never hand-edit a committed migration; create a new one.
- Prisma schema naming (standards §5): `UpperCamelCase` model names with `@@map` to the `snake_case` table, `lowerCamelCase` field names with `@map` to the `snake_case` column. `snake_case` must never reach the generated client or any TypeScript identifier.
- `migrate dev` and `migrate reset` run against the local database only. Anything else requires a human.
- No raw SQL outside `infra/` repositories, and only when the ORM cannot express the query; comment why.

## Ask a human first (on top of root guardrails)

- Migrations that alter or drop existing columns or tables.
- Changes to auth, guards, or permissions.
- Any write path that touches data consumed by the storefront or marketplace listings (Shopify, Amazon, eBay, Walmart, Temu).
