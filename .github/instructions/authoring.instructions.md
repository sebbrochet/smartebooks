---
applyTo: "books/**"
description: "Authoring rules for smart ebook content — directive syntax, ids, assets, and the lint loop. Use when writing or editing chapters, or a book's smartbook.json."
---

# Authoring book content

The authoritative rules are in [`editorial-charter.md`](../../editorial-charter.md) — read it before
writing content. It defines every directive, its form, its attributes and its body format. This file
is the short version and the working loop.

## Before writing

- **Prose first.** A chapter must read correctly as plain Markdown with every island stripped.
  Directives are progressive enhancement, never the only carrier of meaning.
- Use only directives listed in the charter §4, in canonical **kebab-case**. Old spellings still
  render but the linter warns.
- A directive from a **pack** (`chess`, `mermaid`) requires that pack in the book's `smartbook.json`:

  ```jsonc
  "islands": { "packs": { "mermaid": {} } }
  ```

## Ids and state

- Every **stateful** directive needs a unique, stable `id` — quiz, flashcard, checkpoint, media,
  games. `:::mermaid` has no state and needs none.
- Prefix by chapter: `ch3-tokens-quiz`. Ids must be unique across the whole book, not just a file.
- **Changing an `id` silently resets that reader's saved progress.** Treat them as permanent.

## Assets

- Reference packaged files as `assets/name.ext`. The path must exist in the book folder — a typo is
  an `asset-missing` lint error, because at runtime it fails silently with an empty player.
- Remote media must be `https:`. In an imported book, only packaged assets, YouTube embeds and
  `https:` sources are allowed to play.

## The loop

```powershell
npm run lint:content
```

It reports `file:line`, a stable rule id and a severity. Errors fail the build; warnings do not.
The rules you will meet most: `directive-unknown`, `directive-alias`, `id-duplicate`,
`attribute-invalid`, `asset-missing`, `visibility-missing`, `pack-unknown`.

To see a book rendered, run `npm run dev` and open it in the bookshelf.

## Do not

- **Do not set `visibility: "public"`** on a book that was not already public. Publication is the
  author's decision, not an editing side effect.
- Do not invent directives or attributes. If content needs something new, that is a charter change
  (§6) plus an island, not an ad-hoc block.
- Do not edit `packages/` or `apps/` while authoring content; a content change should never require
  an engine change.
