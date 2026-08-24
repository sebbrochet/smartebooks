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

:::matchingpairs{id="ch1-match"}
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

Audio clips work the same way — this one points to a sample path you would supply in
`public/`.

::audio{id="ch1-audio" src="assets/narration.wav" title="Chapter narration (sample)"}

## Still on the roadmap

Runnable code and reader-contributed content are part of the directive taxonomy and
render as friendly placeholders until their islands ship:

::checkpoint{id="ch1-done" label="I finished chapter 1"}

