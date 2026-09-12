# 1. Getting started with smart ebooks

Welcome to your first **smart ebook** chapter. This page is plain Markdown — but it
comes alive. Sprinkled through the prose you'll find interactive **islands**: quizzes,
checkpoints, and videos that remember what you did, entirely in your browser.

> 📌 **Key concept**: A smart ebook keeps _content-first authoring_ (you write Markdown)
> while adding _app-grade interactivity_ (React components mounted where you declare them).

## Why islands?

Everything you're reading renders as static HTML — fast and simple. Only the interactive
directives hydrate into live components, so the page stays light while still being an app
where it matters.

::checkpoint{id="ch1-intro-read" label="I understand what a smart ebook is"}

## Test yourself

Try the quiz below. Your best score is saved locally and restored when you come back.

:::quiz{id="ch1-basics"}

### What does a "token" represent for a language model?

- [ ] A full sentence
- [x] A chunk of text (often a sub-word)
- [ ] A single pixel

> Explanation: LLMs process text as tokens, typically sub-word units.

### Which statements about smart ebooks are true? (select all)

- [x] Content is authored in plain Markdown
- [x] Reader progress is stored locally in the browser
- [ ] A backend server is required to track scores
- [x] Interactivity is added via directives

:::

## Watch it in action

::video{id="ch1-intro-vid" src="https://youtu.be/aqz-KE-bpKQ" title="Big Buck Bunny (demo embed)"}

## Review with a flashcard

Tap the card to flip it, then rate how well you knew the answer. Your review streak is
saved locally.

:::flashcard{id="ch1-token-card"}
**Front:** What is a token?

**Back:** A sub-word unit of text an LLM processes.
:::

## Play a matching game

Match each term on the left to its meaning on the right. Your best (fewest) number of
moves is remembered.

:::matching-pairs{id="ch1-match"}

```json
{
  "pairs": [
    ["token", "sub-word unit of text"],
    ["context window", "how much text the model can consider"],
    ["prompt", "the input you give the model"]
  ]
}
```

:::

## Listen along

Audio clips work the same way. This one is a **packaged asset**: it lives in the book's
own `assets/` folder, so it travels with a `.smartbook` and works offline.

::audio{id="ch1-audio" src="assets/narration.wav" title="Chapter narration (sample)"}

## A recording the prose can drive

A `:::media-lesson` goes further than playing something. It **owns** the recording, keeps
it in view, and lets the prose point into it: the author declares the moments worth naming,
and a moment named in a sentence becomes something the reader can touch.

:::media-lesson{id="ch1-lesson" src="assets/narration.wav"}

```marks
0:00  The opening tone
0:01  Where it turns
0:02  The last word
```

The player above does not scroll away, because it is not in this prose at all — the
container renders it, and these paragraphs scroll underneath. That is the same arrangement
a chess game uses, for the same reason.

Touch :at[0:01] and the recording moves there. Touch :at[0:02] and it moves again, while
the index below follows along on its own as the sound plays.

::media-marks

A time nobody declared, like :at[9:59], stays the plain text it was written as — the same
rule every island follows: the reader never loses a page to a typo, and the linter is what
complains.

:::

This sample is three seconds long, so the moments are close together. The mechanism does
not care: a lecture with forty marks works the same way, which is what the format is for.

## Still on the roadmap

Runnable code (`:::playground`) and reader-contributed content (`:::contribution`) are
described in the editorial charter but have no island yet. Until they ship they are not
part of the vocabulary, so using one is an authoring error rather than a placeholder.

::checkpoint{id="ch1-done" label="I finished chapter 1"}
