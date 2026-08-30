# 3. Tracking progress and scores

Everything you do in a smart ebook is remembered **locally** — no account, no server. This
chapter explains what gets tracked and lets you watch the progress dashboard update live.

> 📌 **Key concept**: Reader state (checkpoints, quiz scores, review streaks, game bests)
> lives in your browser via IndexedDB. You can reset it anytime.

## Checkpoints

A `:::checkpoint` records that you finished a section. Tick the box and watch the
"sections done" count rise in the dashboard above.

::checkpoint{id="ch3-checkpoints" label="I understand checkpoints"}

## Scores add up

Quiz points from every chapter are totaled in the dashboard. Try this one:

:::quiz{id="ch3-tracking"}

### Where is your progress stored?

- [ ] On a remote server
- [x] Locally in your browser
- [ ] In a cookie sent to advertisers

> Explanation: Smart ebooks are local-only by design — your data never leaves the device.

:::

## Watch, listen, review

Media and flashcards are tracked too — a watched video, a played audio clip, a review
streak. It all feeds your personal, private dashboard.

::checkpoint{id="ch3-done" label="I finished the tracking chapter"}
