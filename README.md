# Smart Ebooks

**A platform for building and publishing many interactive, app-like "smart ebooks" on one shared engine.**

📖 **Live at [smartebooks.sebbrochet.com](https://smartebooks.sebbrochet.com)** — read the books in your browser.

A *smart ebook* is a static website that reads like a book but behaves like an app: alongside the prose it embeds **quizzes, flashcards, puzzles, exercises, videos and audio**, and it remembers the reader's **progress and scores** — all with **no backend** (everything lives in the browser).

This repository is an **npm-workspaces monorepo**, not a single book:

1. **`packages/engine` (`@smart-ebooks/engine`)** — the one reusable core (Markdown→island pipeline, islands, per-book store, reader shell). Evolve it once; every book benefits.
2. **`books/<slug>/`** — a book is pure data: a `smartbook.json` descriptor + `book.config.ts` + `content/*.md`. No architecture inside.
3. **`apps/library` (`@smart-ebooks/library`)** — the platform: a **bookshelf** that auto-discovers books and publishes them through **one** chain.

---

## The idea in one picture

```text
Markdown chapters                Build pipeline                 Static smart ebook
(prose + :::directives)   ──►   remark/rehype + React    ──►   HTML/JS/CSS (no server)
                                 interactive "islands"          progress + scores in-browser
```

Authors write **plain Markdown**. Interactive elements are declared with **fenced container directives** (e.g. `:::quiz`, `:::flashcard`, `:::video`). A build step parses the Markdown, mounts a matching **React component** for each directive, and emits a fully static site that can be hosted anywhere (GitHub Pages, any CDN).

## What makes an ebook "smart"

| Capability | How it is delivered | Persistence |
| --- | --- | --- |
| Quizzes & knowledge checks | `:::quiz` directive → React quiz component | Score saved locally |
| Flashcards / spaced repetition | `:::flashcard` directive | Review state saved locally |
| Puzzles & exercises | `:::matchingpairs`, plus domain islands (e.g. chess) | Best scores saved locally |
| Embedded video / audio | `:::video`, `:::audio` directives | Watched/played flags |
| Progress tracking | Per-section checkpoints + reading position | Progress map saved locally |
| Score tracking | Aggregated across quizzes and exercises | Score store saved locally |
| Resume where you left off | Last book + chapter, with an optional cover splash | Device preference, local |
| User-contributed content | (Roadmap) Markdown via Git/PR workflow | Merged into the static build |

All reader state is **local-only** (IndexedDB via `idb-keyval`, with `localStorage` for small flags). No accounts, no server, privacy-friendly by default.

## Repository layout (monorepo)

```text
packages/engine/        @smart-ebooks/engine — the ONE reusable core
  src/ markdown/ islands/ store/ reader/ content/ package/ Reader.tsx index.ts
packages/islands-chess/  @smart-ebooks/islands-chess — optional domain islands
  src/ ChessBoardIsland ChessPuzzleIsland StockfishAnalysisIsland
books/<slug>/           a book = data only: smartbook.json + book.config.ts + content/*.md
apps/library/           @smart-ebooks/library — the bookshelf platform
  src/ App.tsx router.ts launch.ts books.ts Bookshelf.tsx  index.html
e2e/                    Playwright tests (run against the platform)
```

Books are **auto-discovered** — the app globs `books/*/book.config.ts`, so adding a book needs no wiring.

## Run it locally

```powershell
npm install                      # npm workspaces
npm run dev                      # platform dev server (bookshelf)
npm run validate                 # typecheck + lint + format + unit tests
npm run build                    # static production build → apps/library/dist/
npm run test:e2e                 # Playwright e2e
```

## Add a new book

1. Create `books/<slug>/smartbook.json` — the descriptor (title, description, chapter list, optional
   `cover`). The same descriptor format is used by portable `.smartbook` packages.
2. Add `books/<slug>/content/*.md` chapters (numbered, e.g. `01-intro.md`).
3. Create `books/<slug>/book.config.ts` exporting `book`, declaring the islands the book may use:

   ```ts
   export const book: Book = makeBook(descriptor, modules, defaultIslands);
   ```

4. That's it — the bookshelf discovers it automatically. No engine changes.

> Books are scoped to the islands they declare, so a domain package (e.g.
> `chessIslands()` from `@smart-ebooks/islands-chess`) is only available to books that opt in.

## Where to start

Read **`books/guide/`** — a worked example whose chapters document the authoring model while exercising
every built-in island. `books/chess/` shows how a domain package adds its own islands.

## License

See [LICENSE](LICENSE) (to be added).
