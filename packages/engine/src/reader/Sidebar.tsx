import { useEffect, useState, type MouseEvent } from 'react';
import type { Book, Chapter } from '../types';
import { navSections } from './navSections';
import { useMessages } from '../i18n/messages';

interface SidebarProps {
  book: Book;
  basePath: string;
  view: 'chapter' | 'search' | 'part';
  activeSlug?: string;
  /** The part whose landing page is open, when `view === 'part'`. */
  activePart?: string;
  /**
   * The chapters to list. Defaults to all of them.
   *
   * A gated book passes only the ones its reader has entered: with seven acts,
   * listing them all would name the acts — a spoiler in itself — and let anyone
   * open the last one without earning a section of it. The same rule the
   * contents rail follows, one level up.
   */
  chapters?: Chapter[];
  /** Drawn as an open drawer on a narrow screen; ignored on a wide one. */
  open?: boolean;
  /** Called when the reader picks a destination, so the drawer can close. */
  onNavigate?: () => void;
  /** Opens the search overlay. The sidebar no longer runs the search itself. */
  onSearch?: () => void;
}

export function Sidebar({
  book,
  basePath,
  view,
  activeSlug,
  activePart,
  chapters = book.chapters,
  open = false,
  onNavigate,
  onSearch,
}: SidebarProps) {
  const words = useMessages();
  const currentSlug = view === 'chapter' ? (activeSlug ?? chapters[0]?.slug) : undefined;

  const sections = navSections(chapters, book.descriptor.parts);
  const activePartId =
    activePart ??
    sections.find((section) => section.chapters.some((chapter) => chapter.slug === currentSlug))
      ?.id;

  /*
   * Which parts the reader has opened or closed by hand. Absent means "follow
   * the book": the part being read is open and the rest are shut.
   *
   * Listing every chapter of every part was fine for a four-chapter sample and
   * is a wall on a real book — a published 44-chapter one shows 30 of its 44
   * links, the rest folded away (SPEC002 N2).
   */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  // The invariant: **the list never hides the chapter you are on.** Closing the
  // part you are reading is allowed and sticks, but any move to another chapter
  // unfolds whatever part that chapter is in. Keyed on the chapter rather than
  // the part, because a next-chapter link inside a part the reader had closed
  // changes no part and would otherwise land somewhere the list is hiding.
  useEffect(() => {
    if (!activePartId) return;
    setToggled((previous) =>
      activePartId in previous
        ? Object.fromEntries(Object.entries(previous).filter(([id]) => id !== activePartId))
        : previous,
    );
  }, [activePartId, currentSlug]);

  // One listener on the nav rather than a handler threaded through every link
  // and every part. Picking the chapter you are already reading changes no
  // route, so closing cannot be left to a route change alone.
  function dismissIfLink(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('a')) onNavigate?.();
  }

  return (
    <nav
      id="book-nav"
      className={open ? 'sidebar sidebar--open' : 'sidebar'}
      aria-label={words.bookNavigation}
      onClick={dismissIfLink}
    >
      {/* Looks like a field, behaves like a button: the real input lives in the
          overlay, so there is one search box rather than two that can disagree
          about what was typed. */}
      <button type="button" className="sidebar__search" onClick={onSearch}>
        <span aria-hidden="true">⌕</span>
        <span>{words.searchThisBook}</span>
        <kbd aria-hidden="true">/</kbd>
      </button>
      <ul className="sidebar__list">
        {sections.map((section, index) => {
          const links = section.chapters.map((chapter) => {
            const active = currentSlug === chapter.slug;
            return (
              <li key={chapter.slug}>
                <a
                  href={`#${basePath}/${chapter.slug}`}
                  className={active ? 'is-active' : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  {chapter.title}
                </a>
              </li>
            );
          });

          // A loose run is spliced straight into the list, so a book with no
          // parts renders exactly the markup it always did.
          if (!section.title) return links;

          const listId = `part-${section.id}-chapters`;
          const expanded = toggled[section.id ?? ''] ?? section.id === activePartId;

          // The APG accordion shape: a heading whose only child is the button.
          // Keeping the `h3` matters — it is how a screen reader user skims the
          // parts — and putting the button inside it rather than replacing it
          // with a `<summary>` keeps both the heading and a real toggle.
          return (
            <li key={section.id ?? `loose-${index}`} className="sidebar__part">
              <h3 className="sidebar__part-title" id={`part-${section.id}`}>
                <button
                  type="button"
                  className="sidebar__part-toggle"
                  aria-expanded={expanded}
                  aria-controls={listId}
                  onClick={() =>
                    setToggled((previous) => ({ ...previous, [section.id ?? '']: !expanded }))
                  }
                >
                  <span className="sidebar__part-marker" aria-hidden="true" />
                  {section.title}
                </button>
                {/* The toggle folds the part; this opens it. Two actions on
                    one heading, because collapsing a part and reading about
                    it are different intents and a single control has to
                    guess which was meant — which is what made the heading
                    inert in the first place (SPEC002 N5). */}
                <a
                  className="sidebar__part-link"
                  href={`#${basePath}/part/${section.id}`}
                  aria-label={words.overviewOf(section.title)}
                  aria-current={activePart === section.id ? 'page' : undefined}
                >
                  <span aria-hidden="true">≡</span>
                </a>
              </h3>
              <ul
                className="sidebar__list"
                id={listId}
                aria-labelledby={`part-${section.id}`}
                hidden={!expanded}
              >
                {links}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
