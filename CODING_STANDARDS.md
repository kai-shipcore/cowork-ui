# Coding Standards and Engineering Guidelines

**Stack:** TypeScript · React 19 · NestJS 11 · Prisma · Vitest
**Sources:** Google TypeScript Style Guide, Airbnb JavaScript Style Guide, Clean Code, andredesousa/typescript-best-practices, and the official React and NestJS recommendations, adapted to this codebase. Requirement keywords follow RFC 2119.

---

## 0. How to use this document

- **Audience:** human engineers and AI coding agents.
- **Spirit over letter:** the rules here are strong defaults that are right in the large majority of cases, not laws. Follow them wherever possible; when a rule genuinely stands between you and solving the problem well, deviate through the process in §0.2.
- **Precedence order when rules conflict:**
  1. Automated tooling (Prettier, ESLint, `tsc`)
  2. This document
  3. Consistency with the surrounding code
  4. Personal preference
- **When in doubt, match the module you are touching.** Consistency beats local optimality.
- **For AI agents:** reference this file from `CLAUDE.md` ("Read and follow `CODING_STANDARDS.md` before writing code"). Do not restate rules there; this file is the single source of truth.

### 0.1 Requirement keywords (RFC 2119)

- **MUST / MUST NOT**: an absolute requirement or prohibition.
- **SHOULD / SHOULD NOT**: the default. Valid reasons to deviate may exist in particular circumstances, but the full implications MUST be understood and weighed, and the deviation SHOULD be explained in a comment or the PR description.
- **MAY**: truly optional.
- "Prefer" and "avoid" mean SHOULD and SHOULD NOT. Plain imperative statements ("do X", "never Y") mean MUST.

### 0.2 Exceptions: spirit over letter

These are best practices, not laws. No rule anticipates every situation, and real constraints (a third-party API that forces a pattern, a measured performance hotspot, a framework limitation) can make the compliant version the worse solution. In those special cases, overriding a rule is allowed and correct. A valid exception:

1. **Is a last resort.** The compliant approach was tried, or it is clear why it cannot work here.
2. **Is as narrow as possible.** Confined to the line, function, or file that needs it. Never disable a rule globally to unblock one case.
3. **Is visible and justified.** A short comment at the site names the rule being broken and why; lint suppressions carry the reason on the same line; the PR description mentions it.
4. **Matches the rule's weight.** SHOULD-level rules need only the documented reason. MUST-level rules also need reviewer agreement on the PR.

Convenience, habit, and personal preference are not special cases. Security-relevant rules have no special cases at all: no `eval` or `new Function`, never trust external input, never leak internals or stack traces to clients.

**Recurring exceptions mean the rule is wrong.** If the same justified deviation shows up a third time, change this document instead of writing the comment again.

---

## 1. Enforcement layers

Rules live in two layers. **Never hand-enforce what a machine already enforces.**

### Layer 1: machine-enforced (never debated in code review)

- **Formatting:** Prettier, shared config, run on pre-commit.
- **Lint:** `typescript-eslint` with the `recommended` + `strict` rule sets, plus import ordering and no-floating-promises.
- **Types:** `pnpm typecheck` (`tsc -b`) runs in CI. The CLI is the source of truth; editor squiggles are not. `tsc --noEmit` MUST NOT be used to verify this repo: the app `tsconfig.json` files are solution-style (`"files": []` plus `references`), so `--noEmit` checks zero files and reports success regardless of errors.
- **`tsconfig` MUST enable:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `forceConsistentCasingInFileNames`, `noUnusedLocals`.
- **Pre-commit:** husky + lint-staged. CI blocks merge on lint, type-check, and tests.

### Layer 2: judgment rules (this document, enforced in code review)

Everything below this line.

---

## 2. Core principles

1. **Prefer Readability over cleverness.** Code is read far more often than it is written. Optimize for the next reader, not the author.
2. **Prefer Single responsibility.** Every function, class, module, and component does one thing. If you need the word "and" to describe it, split it.
3. **Prefer Modularity.** Small units with explicit inputs and outputs, minimal knowledge of each other. Depend on interfaces, not implementations.
4. **Prefer Reusability without premature abstraction.** Duplication is cheaper than the wrong abstraction. Apply the **Rule of Three**: extract shared code the third time a pattern appears, not the first.
5. **Prefer concept of: YAGNI (You Aren't Gonna Need It).** Build what the current requirement needs. No speculative flexibility or "just in case" parameters.
6. **Prefer concept of: KISS (Keep It Simple).** Prefer the simplest design, and the simplest type construct, that can express the code.
7. **Fail fast, trust no data.** Validate every external input at the boundary, throw early with context. Never limp along on bad state.
8. **Immutability by default.** Do not mutate inputs or shared state. Return new values.
9. **Composition over inheritance.** Prefer functions and object composition. Class inheritance only where a framework requires it.
10. **Boy Scout Rule.** Leave touched code slightly better than you found it, but keep refactors out of unrelated PRs.

---

## 3. TypeScript

### 3.1 Source files

- Files MUST be encoded in UTF-8.
- For characters with a special escape sequence (`\n`, `\t`, `\\`, `\'` etc.), that sequence MUST be used instead of the numeric escape. For printable non-ASCII characters, use the actual Unicode character (`'μs'`); for non-printable ones, use the hex/Unicode escape with an explanatory comment.
- A file consists of, in order: license header (if any), `@fileoverview` JSDoc (if any), imports, implementation. Exactly one blank line separates each section.
- One primary concern per file. A file past ~300 lines is a signal to split (house rule).

### 3.2 Variables

- Use `const` by default; `let` only when the variable is reassigned. `var` MUST NOT be used (function scoping causes bugs).
- One variable per declaration: `let a = 1, b = 2;` MUST NOT be used.
- Variables MUST NOT be used before their declaration; declare them in the narrowest scope, close to first use, and initialize at declaration.
- Global variables and functions MUST NOT be created. Do not add symbols to the global object.
- Magic numbers and strings SHOULD NOT appear inline; name them as constants so the meaning is explicit.

### 3.3 Types and type inference

- Code MAY rely on compiler inference. Leave annotations off trivially inferred locals (`const x = new Set<string>()`, not `const x: Set<string> = new Set()`).
- Exported and public functions MUST have explicit parameter and return types (house rule; stricter than Google, which leaves return types to the author). Benefits: documentation and earlier type-error detection.
- Annotate object literals at declaration with `: Foo` so structural mismatches error at the declaration site, not at a distant call site.
- Supply generic type parameters when inference would produce `unknown` (empty arrays, `new Map()`, `new Set()`).
- When a string can only hold a fixed set of values, type it as a literal union (`type Status = 'active' | 'archived'`), never as plain `string`.
- Model state with discriminated unions, not boolean flags. Impossible states should be unrepresentable:

```ts
type LoadState<T> =
  { status: 'loading' } | { status: 'error'; error: Error } | { status: 'success'; data: T };
```

### 3.4 `any`, `unknown`, and error suppression

- `any` MUST NOT be used. In order of preference: provide a specific type, use a generic, or use `unknown` and narrow with type guards.
- If `any` is truly unavoidable (e.g., partial mocks in tests), suppress the lint rule on that single line and document why.
- `{}` as a type SHOULD NOT be used. Prefer `unknown` (opaque values), `Record<string, T>` (dictionaries), or `object` (non-primitive).
- `@ts-ignore` and `@ts-nocheck` MUST NOT be used. `@ts-expect-error` MAY be used in test files only, with a reason on the same line; it MUST NOT appear in production code.

### 3.5 `null` and `undefined`

- Either MAY be used to denote absence; follow the convention of the API you are working with (Prisma returns `null`, `Map.get` returns `undefined`) and be consistent within a module.
- Handle absent values close to where they arise; do not pass nullables through many layers.
- Type aliases MUST NOT bake in `| null` or `| undefined`. Add the nullability at the use site: `getLatte(): CoffeeResponse | undefined`, not `type CoffeeResponse = Latte | undefined`.
- Prefer optional fields and parameters (`milk?: Milk`) over `| undefined` unions. For classes, prefer initializing fields over making them optional.
- Use `?.` (optional chaining) and `??` (nullish coalescing). Do not use `||` for defaults unless `0`, `''`, and `false` are genuinely invalid values.

### 3.6 Type assertions and narrowing

- Type assertions (`x as Foo`) and non-null assertions (`x!`) are unsafe: they silence the compiler without adding a runtime check. They SHOULD NOT be used; write the runtime check instead (`if (x instanceof Foo)`, `if (x != null)`).
- Where local knowledge makes an assertion genuinely safe, it MUST carry a comment explaining why (`// y cannot be null, because ...`), unless the reason is obvious in context.
- Assertions MUST use `as` syntax, never angle brackets (`<Foo>x`).
- When bridging unrelated types, double-assert through `unknown` (`x as unknown as Foo`), never through `any`.
- MUST NOT use an assertion to type an object literal; use an annotation. `const foo: Foo = {...}` catches typos and refactoring drift; `const foo = {...} as Foo` hides them.

### 3.7 Interfaces and type aliases

- Use `interface` for object shapes; use `type` for unions, intersections, tuples, and derived types. (Per the TypeScript team, interfaces have better error display and performance.)
- Do not mark interfaces specially (`IUser`, `UserInterface`). Name for the concept: `class TodoItem` with `interface TodoItemStorage`.
- Only split an interface into smaller nested types when the domain justifies it; aggressive splitting hides the structure.

### 3.8 Utility, mapped, and conditional types

- Built-in utility types (`Partial`, `Readonly`, `Pick`, `Omit`, `Record`, `ReturnType`) SHOULD be used instead of hand-writing derived shapes.
- Always use the simplest type construct that can express the code. A little repetition is often cheaper than a clever type expression the next reader must mentally evaluate; simple interface extension often beats `Pick`.
- Complex mapped/conditional types MAY be used, but the burden of proof is on the author, and IDE tooling (find-references, rename) degrades inside them.
- Avoid APIs with return-type-only generics; when calling one, always specify the generic explicitly.

### 3.9 Arrays and tuples

- MUST NOT use the `Array()` constructor (its one-argument and multi-argument forms behave differently). Use `[...]` literals or `Array.from({length: n})`.
- Type simple arrays as `T[]` or `readonly T[]`; use `Array<T>` / `ReadonlyArray<T>` only when the element type is complex (`Array<string | number>`).
- Do not set non-numeric properties on arrays; use a `Map`.
- Spread only iterables into arrays and only objects into objects; never spread `null`/`undefined` (`[...(cond && arr)]` is a bug: normalize to `[]` first).
- Prefer a tuple (`[string, string]`) over inventing a `Pair` interface; prefer a named object (`{host, port}`) when the elements deserve names.
- Prefer `map` / `filter` / `reduce` / `find` over hand-rolled loops for transformations; they state intent and avoid intermediate mutation.

### 3.10 Objects, Maps, and index signatures

- MUST NOT use the `Object` constructor; use literals (`{}`).
- For dynamic key-value collections, prefer `Map` (and `Set`) over object index signatures; they convey intent and allow non-string keys. When an index signature is used, give the key a meaningful label: `{[fileName: string]: number}`, not `{[key: string]: number}`.
- Use `Record<K, V>` when the key set is statically known.
- Object spread: later properties win; only spread plain objects (spreading class instances or arrays into objects behaves surprisingly).
- Destructured function parameters MUST stay one level deep, with defaults on the left-hand side, and MUST default to `{}` if the whole object is optional: `function f({num, str = 'default'}: Options = {}) {}`.

### 3.11 Strings

- Use single quotes for ordinary strings (Prettier enforces).
- Use template literals for interpolation and multi-line strings, instead of concatenation chains.
- Line continuations (trailing `\` inside a string) MUST NOT be used.
- Keep identifiers and code in English.

### 3.12 Numbers and type coercion

- Coerce explicitly with `String(x)`, `Boolean(x)`, `!!x`, or template literals. MUST NOT invoke wrapper constructors (`new String()`, `new Number()`, `new Boolean()`).
- Parse numbers with `Number(x)` and explicitly handle `NaN` (and, where relevant, `Infinity`). MUST NOT use unary plus (`+x`).
- `parseInt`/`parseFloat` MUST NOT be used except for non-base-10 parsing, and then only after validating the input with a regex (both ignore trailing garbage: `parseInt('12 dwarves')` is `12`).
- Use lowercase `0x`, `0o`, `0b` prefixes for hex/octal/binary. Never a bare leading zero.

### 3.13 Equality and conditionals

- Always `===` / `!==`. Single exception: `x == null` MAY be used to check `null` and `undefined` together.
- Inside `if`/`while` conditions, rely on implicit coercion rather than redundant `!!`: `if (foo)`, not `if (!!foo)`. `if (arr.length)` and `if (arr.length > 0)` are both fine.
- If enums are present, their values MUST NOT be coerced to booleans (the first member is `0`, hence falsy); compare explicitly: `level !== SupportLevel.NONE`.
- Long `if`/`else if` chains keyed on a value SHOULD be replaced with a lookup object, `Map`, or polymorphism.

### 3.14 Control flow

- Control statements (`if`, `for`, `while`, ...) MUST use braced blocks; the only allowed exception is a complete `if` statement on a single line.
- Assignment inside a condition SHOULD NOT be used; when intentional, double-parenthesize: `while ((x = next())) {...}`.
- Iterate arrays with `for...of` (or `forEach`/array methods); use `arr.entries()` when the index is needed. `for...in` MUST NOT be used on arrays (it yields string indices).
- `for...in` on objects MUST be filtered with `hasOwnProperty`; prefer `for...of` over `Object.keys/values/entries` instead.
- Do not wrap the operand of `return`, `throw`, `typeof`, etc. in unnecessary parentheses, but MAY use grouping parentheses where operator precedence is not obvious to every reader.

### 3.15 Switch statements

- Every `switch` MUST end with a `default` group, even if it is empty or just a comment.
- Non-empty `case` groups MUST NOT fall through; end each with `break`, `return`, or `throw`. Empty groups MAY fall through to share a body.
- In exhaustive switches over a union, prefer an exhaustiveness check (`default: assertNever(value)`) so adding a union member fails to compile.

### 3.16 Function mechanics

- Prefer `function` declarations for named top-level functions; use arrow functions for callbacks and nested functions (they capture `this`). Function _expressions_ (`const f = function() {...}`) MUST NOT be used, except generators.
- Use a concise arrow body (`v => v * 2`) only when the return value is used; otherwise use a block body or `void` so a value does not leak into a `void` context: `promise.then(v => { log(v); })`.
- `this` MUST only appear in class constructors/methods, arrow functions defined inside them, or functions with an explicit `this` parameter. Prefer arrow functions over `f.bind(this)` or `const self = this`.
- Wrap named callbacks in an arrow that forwards arguments explicitly; passing them point-free invites the optional-parameter trap: `['11','5','10'].map(parseInt)` yields `[11, NaN, 2]`.
- Default parameter values MUST NOT have side effects and SHOULD be simple. With more than a couple of optional parameters, switch to a destructured options object.
- Use rest parameters (`...args: T[]`) instead of `arguments`; never name anything `arguments`. Use spread instead of `.apply()`.

### 3.17 Classes

- Use TypeScript visibility (`private`, `protected`); ES `#private` fields MUST NOT be used (emit-size and down-level costs, no type-checking benefit).
- Everything is `public` by default; the `public` modifier MUST NOT be written except on non-readonly public parameter properties.
- Mark fields never reassigned outside the constructor as `readonly`. Use parameter properties (`constructor(private readonly ordersRepo: OrdersRepository) {}`) instead of manual assignment: this is the standard NestJS injection style.
- Initialize fields at their declaration when possible; omit empty constructors and constructors that only delegate to `super`. Constructor calls MUST use parentheses: `new Foo()`.
- Do not add or remove properties after construction; explicitly initialize later-filled optional fields to `undefined`.
- Getters MUST be pure (no observable state change). Do not write trivial pass-through get/set pairs; make the property public or `readonly` instead. `Object.defineProperty` MUST NOT be used.
- `this` MUST NOT be used in static contexts; static state SHOULD be avoided (it hurts testability). Prefer module-level functions over private static methods, and prefer file scope over container classes that exist only to namespace statics.
- Prototypes MUST NOT be manipulated directly, and visibility MUST NOT be bypassed with `obj['foo']`.
- Interfaces, not classes, define structural types for plain data.

### 3.18 Enums and constants

- Prefer string-literal unions or `as const` objects over `enum` in new code (house rule; simpler JS output, no runtime surprises):

```ts
const OrderStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  Approved: 'approved',
} as const;
type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
```

- Where an enum is used anyway: `const enum` MUST NOT be used; enum values MUST NOT be coerced to booleans (see 3.13); values SHOULD be explicit strings.
- `CONSTANT_CASE` is reserved for module-level immutable values (including enum values and static readonly fields). It signals "do not modify" even when the value is not deeply frozen.

### 3.19 Exceptions and error handling

- Exceptions are the mechanism for exceptional cases; prefer throwing over ad-hoc error containers or `{error: ...}` return objects. But do not use exceptions for normal control flow: a lookup that commonly misses returns `null`/`undefined`.
- Throw only `Error` or subclasses, always with `new`: `throw new Error('...')`. Never throw strings or plain objects (no stack trace). The same applies to promise rejections: `Promise.reject(new Error('...'))`.
- Custom error classes SHOULD carry structured context and use `cause` to preserve the original:

```ts
catch (err) {
  throw new OrderSyncError(`Failed to sync order ${orderId} to Shopify`, { cause: err });
}
```

- In `catch (e: unknown)`, assume errors are `Error` instances (assert if needed); do not defensively handle non-Error types unless a specific API is known to throw them, and then comment which one.
- Empty catch blocks MUST contain a comment justifying why ignoring the error is correct.
- Keep `try` blocks focused on the statements that can actually throw; move the rest out (exception: hoisting a `try` out of a hot loop for performance is fine).

### 3.20 Asynchronous code

- Use `async/await` over `.then()` chains and over callbacks.
- No floating promises: every promise is awaited, returned, or explicitly `void`-ed with a comment (lint-enforced).
- Parallelize independent work with `Promise.all`; do not `await` sequentially in a loop unless order matters.
- An `async` function that never awaits SHOULD NOT be async.
- Handle rejections at a level that can act on them; adding `catch` just to log-and-rethrow at every layer is noise.

### 3.21 Modules, imports, and exports

- ES modules only. `namespace`, `import x = require(...)`, and `/// <reference>` MUST NOT be used. To namespace code semantically, use separate files.
- Named exports only; default exports MUST NOT be used (no canonical name, silent import mismatches, weaker tooling).
- Mutable exports (`export let`) MUST NOT be used; expose a getter function instead. Resolve conditional exports before exporting: `export const Api = pickApi();`.
- Export only what is used outside the module; minimize the public surface.
- Prefer named imports for frequently used or clearly named symbols; prefer a namespace import (`import * as tableview from './tableview'`) when pulling many generically named symbols from one module. Renaming (`as`) MAY be used to fix collisions or unclear names.
- Use `import type` / `export type` for type-only imports and re-exports.
- Import ordering and unused-import removal are lint-enforced (see §8 for path conventions).

### 3.22 Decorators

- Do not define new decorators; use only those supplied by frameworks (NestJS: `@Module`, `@Controller`, `@Injectable`, `@Get`, class-validator decorators, etc.). The underlying proposal diverged and has known compiler bugs.
- A decorator MUST immediately precede the symbol it decorates, with no blank line between; JSDoc goes above the decorator.

### 3.23 Disallowed outright

- `var`, `with`, `eval`, `new Function(...)`, and string arguments to `setTimeout`/`setInterval`.
- Wrapper types `String`, `Boolean`, `Number`, `Object` as types or constructors; use `string`, `boolean`, `number`, and `unknown`/`Record`/`object`.
- `debugger` statements and stray `console.log` in committed code.
- Relying on Automatic Semicolon Insertion; every statement ends with `;` (Prettier enforces).
- Modifying builtin prototypes or objects, and depending on libraries that do.
- Non-standard or not-yet-standardized language features (TC39 drafts, transpiler-only extensions).

---

## 4. Function design

Mechanics live in §3.16; this section is about design, and it applies to every language in the repo.

- Single purpose. The name states exactly what it does, verb-first: `calculateAtp`, `fetchOrderById`, `mapToResponseDto`.
- Small. A function SHOULD fit on one screen; past ~30-40 lines, look for the second responsibility hiding inside.
- Max ~3 positional parameters (more explodes the test matrix). Beyond that, accept one typed options object and destructure it in the signature.
- No boolean flag parameters that fork behavior; write two functions:

```ts
// Bad
renderOrder(order, true);

// Good
renderOrderCompact(order);
renderOrderDetailed(order);
```

- Guard clauses and early returns over nested conditionals. Keep nesting depth to ~2; heavy nesting is a smell that logic wants extracting.
- Pure by default: same inputs, same output, no side effects. Centralize unavoidable side effects (I/O, database, network) at the edges of the system.

---

## 5. Naming

- **Casing:**
  - `lowerCamelCase`: variables, parameters, functions, methods, properties, module aliases
  - `UpperCamelCase`: classes, interfaces, types, enums, decorators, type parameters, React components
  - `CONSTANT_CASE`: module-level immutable constants and enum values only; a constant re-created per call (a local, or a field of a nested class) is `lowerCamelCase`
  - `snake_case`: database tables and columns only. It MUST NOT appear in TypeScript identifiers; Prisma maps it away at the schema (see the Prisma mapping rule below).
- **Files:** all source filenames are `kebab-case`, in both apps, React component files included: `orders.service.ts`, `user-table.tsx`, `use-permission.ts`. The component's name lives in the export, not the filename: `user-table.tsx` exports `UserTable`. Root-level docs and tool-mandated names (`README.md`, `CLAUDE.md`, `Dockerfile`, `.github/` contents) are exempt. Rationale: one filename rule for the whole repo instead of one per app; no uppercase in filenames, so case-only-rename bugs between case-insensitive dev machines and Linux CI are structurally impossible; and it matches what the NestJS generators emit. Enforced by a filename-case lint rule scoped to source directories.
- **Prisma mapping (MUST):** model names are `UpperCamelCase` with `@@map` to the `snake_case` table; field names are `lowerCamelCase` with `@map` to the `snake_case` column (`configHash String @map("config_hash")`). The generated client is TypeScript and follows TypeScript casing. A schema that mirrors the database unmapped leaks `snake_case` into every service and is a defect, not a style choice.
- **Identifiers** use ASCII letters and digits; `_` prefixes/suffixes MUST NOT be used (including bare `_` for unused values: skip tuple elements with commas instead), and `$` only where a framework convention requires it.
- Names MUST be descriptive to a new reader; no ambiguous or invented abbreviations (`nErr`, `cstmrId`) and no Hungarian notation. Industry-standard short forms are fine: `id`, `url`, `api`, `sku`, `dto`. Variables scoped to ~10 lines MAY use short names (`i`, `x`).
- Treat acronyms as words in camelCase: `loadHttpUrl`, `customerId`, not `loadHTTPURL`, `customerID`.
- Booleans read as questions: `isLoading`, `hasAccess`, `canRetry`, `shouldSync`.
- Name by intent, not implementation or current value: `activeSkus`, not `filteredArray`; `isLegalDrinkingAge()`, not `isOverEighteen()`.
- No `I` prefix or `Interface` suffix on interfaces; when a class and its interface coexist, name the interface for its role (`TodoItem` / `TodoItemStorage`).

---

## 6. React

- Function components and hooks only. No class components.
- One component per file; the file is the kebab-case of the component name (`user-table.tsx` exports `UserTable`, per §5).
- Separate logic from rendering. Extract stateful and business logic into custom hooks (`useOrderFilters`); keep components mostly declarative markup.
- Derive, don't duplicate. Compute derived values during render. Never copy props into state to "keep them in sync."
- `useEffect` is a last resort: it exists to synchronize with external systems. It is not for computing derived state and not for handling user events. Always provide a correct dependency array and a cleanup function where needed.
- Keys come from stable data IDs. Never use the array index for lists that can reorder, insert, or delete.
- Colocate state. Keep state in the lowest component that needs it. Lift only when sharing is required; use context only for genuinely app-wide values.
- Type props with an explicit interface and destructure in the signature. Avoid blind `{...props}` spreading; it hides the component's real API.
- Handle every UI state explicitly: loading, error, empty, success. Use the discriminated union pattern from §3.3.
- Do not memoize by reflex. React 19's compiler covers most cases. Add `useMemo` / `useCallback` / `memo` only after measuring a real problem.
- Route-level code splitting (`lazy` + `Suspense`) SHOULD be used to keep the initial bundle small.
- Accessibility is not optional: semantic HTML elements, a label for every input, full keyboard operability.

### 6.1 Redux state management (Redux Toolkit)

Follows the official [Redux Style Guide](https://redux.js.org/style-guide), adapted to this codebase. Redux Toolkit enforces much of it mechanically; the rules below are what remains ours to hold.

**Machine-enforced (never weaken):**

- `configureStore`'s dev-mode immutability and serializability checks stay ON. Narrowly ignoring a specific path follows §0.2 (commented, justified); disabling a check globally MUST NOT happen.
- Immer's dev-mode freeze makes accidental state mutation throw. Code that works around a frozen object is a defect, not a fix.

**Store and state:**

- Exactly one store, created in one file. Only the app entry imports it; everything else reaches state through hooks.
- State and actions MUST contain only serializable values: no class instances, Maps/Sets, Promises, functions, or Date objects (store timestamps as ISO strings or epoch numbers).
- Keep state minimal and derive the rest in selectors: store the list, select the filtered list.
- Name state slices for the data (`vehicles`, not `vehiclesReducer`) and organize by data type, not by UI screen.
- Server data lives in the RTK Query cache, never in slices. Slices hold client-only state (wizard drafts, bulk selection). Form state stays in component state until submit.
- Request/loading state is a finite status field or discriminated union (§3.3): `'idle' | 'loading' | 'succeeded' | 'failed'`. Independent booleans (`isLoading` + `isError`) allow impossible combinations.

**Reducers:**

- All reducers via `createSlice`. Hand-written switch reducers and action-type constants MUST NOT be written.
- Reducers MUST be pure: no side effects, no async, no `Date.now()` / `Math.random()`. Randomness and timestamps go in `prepare` callbacks.
- Inside a case reducer, either mutate the Immer draft or return a new value, never both in one function.
- Put logic in reducers, not at dispatch sites. The component reports what happened; the slice decides how state changes.
- Reducers own their state shape: no blind `return action.payload` or spreads of unvalidated payloads.

**Actions:**

- Actions are events, not setters: `vehicles/splitCompleted`, not `vehicles/setVehicles`. Type strings follow `domain/eventName` (createSlice's default). The action log in DevTools should read as a history of what the user did.
- Dispatch ONE meaningful event per interaction; multiple slices MAY react to it via `extraReducers`. Dispatching several actions in a row to complete one logical update is a design smell.

**Components (react-redux):**

- Hooks only, and only the pre-typed ones (`useAppSelector` / `useAppDispatch`). Raw `useSelector`/`useDispatch` and `connect` MUST NOT be used.
- Prefer several small `useSelector` calls over one returning an object. NEVER return a fresh object or array literal from `useSelector`: it fails reference equality and re-renders on every store change. Select primitives, or memoize with `createSelector`.
- Name selectors `selectThing`. Memoize with `createSelector` only when the selector derives or computes; plain field reads need no memoization.
- Read state where it is used: many small subscribed components beat one big one passing store data down through props.

**Async:**

- RTK Query is the only data-fetching mechanism. Async logic that is genuinely not a server endpoint MAY live in a thunk; when it does, it SHOULD be `createAsyncThunk` (don't hand-roll pending/fulfilled dispatches). Reactive follow-on logic ("when X happens, do Y") uses the listener middleware. `redux-saga` and `redux-observable` MUST NOT be used.

---

## 7. NestJS

- One feature module per domain concept. A module's exports are its public API; keep them minimal and intentional.
- Respect the layering (hexagonal): `api` (controllers, DTOs) → `application` (use cases, services) → `domain` (entities, business rules) ← `infra` (Prisma, external clients). Dependencies point inward. Domain code imports nothing from outer layers.
- Controllers are thin: validate input, call one service method, shape the response. Zero business logic in controllers.
- Every external input gets a DTO (Data Transfer Object) class validated with `class-validator`, with the global `ValidationPipe` running `whitelist: true`. Never trust request data, query strings, or headers.
- Never return Prisma models directly from a controller. Map to response DTOs so the database shape and the wire shape can evolve independently.
- Database access lives only in the infra layer (repositories). Services depend on repository interfaces, not on Prisma.
- Constructor injection only (`private readonly` parameter properties). Circular module dependencies are a design failure; `forwardRef` is a smell to restructure, not a fix.
- Errors: domain code throws domain errors; the API layer maps them (exception filters) to Nest's `HttpException` subclasses (`NotFoundException`, etc.). Never leak stack traces or internal messages to clients.
- Configuration goes through `ConfigModule` with schema validation at boot. `process.env` appears in exactly one place in the codebase.
- Cross-cutting concerns use the framework: guards for authorization, pipes for validation and transformation, interceptors for logging and response mapping. Not hand-rolled per controller.

---

## 8. Project structure and imports

- Import order (lint-enforced): Node built-ins → external packages → internal path aliases → relative imports. Blank line between groups; alphabetized within groups.
- Prefer relative imports (`./foo`) within a package; use path aliases (`@core/...`) across packages instead of `../../../` climbs.
- Barrel files (`index.ts`) sparingly. They invite circular imports and slow tooling. Prefer direct imports within a package.
- Group by feature/domain, not by technical type. Avoid giant top-level `utils/` or `helpers/` dumping grounds.

---

## 9. Testing

- Testing is not optional: new code ships with tests, and untested code is unfinished code.
- Framework: Vitest. The test file sits next to its source: `verify-caller.ts` + `verify-caller.test.ts`.
- Structure every test as AAA: Arrange, Act, Assert.
- Test behavior and contracts, not implementation details. If a pure refactor breaks tests, the tests were wrong.
- Descriptive names state the behavior: `it('returns 404 when the order does not exist')`. Underscored structured names (`testX_whenY_doesZ`) MAY be used where the framework style calls for it.
- Mock at system boundaries (HTTP, database, clock), not internal functions. Loosened typing for mocks is the one sanctioned use of `any`-suppression (see §3.4).
- Every bug fix starts with a failing regression test.

---

## 10. Comments and documentation

- Code explains _what_; comments explain _why_: constraints, trade-offs, links to decisions or tickets.
- Every exported function, class, and public API MUST have a TSDoc block comment. Use `/** ... */` for documentation and `//` for implementation notes.
- Comments MUST add information. No redundant restatements of the code, no noise comments; omit `@param`/`@return` when they have nothing to add beyond the types.
- JSDoc supports Markdown and goes above decorators, immediately adjacent to the symbol.
- No commented-out code. Git history is the archive; commented-out code just scares the next reader out of deleting it.
- TODOs carry a ticket: `// TODO(SHIP-123): remove after backfill completes`.

---

## 11. Pull requests and review

- Small, single-purpose PRs. Squash-merge to `main`.
- Description covers: what changed, why, and how it was tested.
- Self-review the diff before requesting review. Remove debug code, `debugger` statements, and stray `console.log`s.
- Review time is for Layer 2 (design, naming, correctness). Layer 1 nits belong in tooling config, not review comments.

---

## 12. Directives for AI coding agents

- Follow the rules strictly by default. If a rule genuinely blocks completing the task, deviate per §0.2: smallest possible scope, an inline comment naming the rule and the reason, and an explicit callout of the deviation in your summary so a human can review it.
- Before writing code, read the surrounding module and match its established patterns.
- Before declaring work complete, run `pnpm typecheck` (or `npx tsc -b` inside the app), lint, and the relevant tests. Never substitute `tsc --noEmit` — it silently checks nothing here.
- Do not introduce any of the following without explicit approval from the human: `any`, `@ts-ignore`, default exports, `var`, empty `catch` blocks without a justifying comment, floating promises, business logic in controllers or components, or mutations of function inputs.
