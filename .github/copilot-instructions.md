# Smart Ebooks — working notes for agents

A monorepo publishing many interactive books on one engine. `packages/engine` is the core,
`apps/library` is the bookshelf, `books/<slug>/` are the books, `scripts/` are plain-Node tools.

## Two names, not interchangeable

- **smartbook** — the portable **package format**: `smartbook.json`, `.smartbook`,
  `SmartbookDescriptor`, `SMARTBOOK_SCHEMA_VERSION`.
- **smart-ebooks** — this **product and platform**: `@smart-ebooks/*`, `SMART_EBOOKS_*` env vars,
  "Smart Ebooks" in the UI.

Anything describing the *file* is a smartbook; anything describing the *app* is smart-ebooks.

## Facts that are easy to get wrong

- **A book is data only** — `smartbook.json` + `content/*.md` + `assets/`. There is no
  `book.config.ts`; island packs are declared in the descriptor.
- **`visibility` is required** on every book. Absent or unrecognised means *private*, and the build
  refuses to run when anything under `books/` is not public.
- **`memory-bank/` and `plan.md` are gitignored.** The specs live there and are not published;
  `editorial-charter.md` **is** committed and is the authoring contract.
- **`island-contract.json` is hand-maintained.** Change an island and you must update it, or
  `islandContract.test.ts` fails. New islands must also be demonstrated in a bundled book, or
  `island-coverage.test.mjs` fails.
- Runtime is **forgiving**, the linter is **strict**: a bad attribute falls back to its default so a
  reader never loses a page, and is an error at lint time.

## Commands

```powershell
npm run validate          # typecheck + lint + lint:content + format + unit & script tests
npm run lint:content      # books only — descriptors, directives, ids, attributes, assets
npm run test:scripts      # node --test for scripts/*.mjs (they are not run by vitest)
$env:E2E_PORT='5400'; npx playwright test   # default 5173 is sometimes reserved on Windows
```

## How work is expected to be done here

- **Verify claims by running something.** Commit messages and reports in this repo cite evidence —
  actual output, a test that failed before the fix. Do not report a pattern match as a fact.
- **Write tests that are proven to fail without the change.** Several bugs here were found because a
  test passed against deliberately broken code.
- **Correct the spec when implementation disproves it**, rather than only fixing the code.
- **Commit messages must not name things outside this repository** — other repos, private or client
  books. Say "a book with 14 diagrams", not the book's name. The reason is coupling: a reference
  nobody reading this repo can resolve.
- Security detail about issues fixed in the same commit is fine to publish; this project does not
  rely on obscurity.
