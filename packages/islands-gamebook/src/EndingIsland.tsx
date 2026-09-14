import { type ReactNode } from 'react';
import { useBook, type IslandComponentProps } from '@smart-ebooks/engine';
import { wordsFor } from './words';
import './gamebook.css';

/**
 * `:ending[Your story ends here.]` — a section the reader may legitimately not
 * leave (SPEC011 K4.4).
 *
 * It renders the author's own line and adds nothing, so why an island at all:
 * because a terminal section has to be **declared**. K4.4 exists to catch the
 * other classic gamebook bug — a section a reader can enter and never leave —
 * and inferring "no choices, so it must be an ending" would answer that
 * question with itself.
 *
 * Not inferred from `:restart` either, though every ending in the demo happens
 * to carry one. Restart is an affordance; this is a claim about the story. A
 * book that puts its restart elsewhere would otherwise read as full of dead
 * ends.
 */
export default function EndingIsland({ children }: IslandComponentProps) {
  const { language } = useBook();

  return (
    <span className="gamebook-ending">
      {(children as ReactNode) ?? wordsFor(language).storyEnds}
    </span>
  );
}
