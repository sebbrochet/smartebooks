import type { ReactNode, RefObject } from 'react';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';
import { ReadingSettings } from './ReadingSettings';

interface ReaderBarProps {
  /** The book's title, shown when there is room for it. Absent on a shelf. */
  title?: string;
  /**
   * The host's own control, rendered first: on the shelf app, the way back to
   * the library. The engine renders *a book* and cannot know whether there is
   * anywhere to go back to — a single-book installable reader has no shelf, and
   * an empty slot must be legal (SPEC009 T10).
   */
  leading?: ReactNode;
  /**
   * The host's own actions, rendered last: export, reset, backup status. These
   * are about packaging and the library rather than about reading, which is why
   * they belong to the host and not to the engine.
   */
  actions?: ReactNode;
  /**
   * The controls that only mean something inside a book. Omitted when there is
   * no book — a shelf has no contents to open and nothing of its own to search
   * — so that one bar serves both rather than two bars drifting apart.
   */
  navigation?: {
    navOpen: boolean;
    onToggleNav: () => void;
    navToggleRef: RefObject<HTMLButtonElement>;
    onOpenSearch: () => void;
  };
}

/**
 * One bar (SPEC009 T10).
 *
 * The reader used to spend two bands of a phone screen on itself: the app's
 * header, and the engine's Contents/Search toolbar as its own grid row. Neither
 * package could compose one bar, because neither may know about the other's
 * controls (SPEC009 V10). Measured before the change: **88px and four wrapped
 * rows at 320–390px**, plus the toolbar row underneath.
 *
 * The order is the one reading apps have settled on rather than the one a docs
 * site uses: **leaving is on the left, navigating within is on the right.** A
 * documentation site puts its hamburger first because it has nowhere to go
 * back to; a reader on a shelf does.
 */
export function ReaderBar({ title, leading, actions, navigation }: ReaderBarProps) {
  return (
    <header className="reader__header">
      {leading}
      {/*
       * The title is allowed to shrink and truncate; the controls are not. On a
       * 320px screen five 44px targets leave about 100px for a title, and a
       * clipped title is far cheaper than a control that wrapped to a second
       * row — which is what used to happen.
       */}
      {title && <span className="reader__booktitle">{title}</span>}
      <div className="reader__actions">
        {navigation && (
          <>
            <button
              type="button"
              ref={navigation.navToggleRef}
              className="ui-btn reader__nav-toggle"
              aria-expanded={navigation.navOpen}
              aria-controls="book-nav"
              onClick={navigation.onToggleNav}
              // The label is hidden on a phone but never removed from the
              // accessibility tree: `aria-label` keeps the accessible name
              // stable at every width, which is what assistive technology
              // announces and what the e2e suite queries by (SPEC009 T10).
              aria-label="Contents"
              title="Contents"
            >
              <Icon name="menu" />
              <span className="ui-btn__label">Contents</span>
            </button>
            <button
              type="button"
              className="ui-btn reader__search-toggle"
              onClick={navigation.onOpenSearch}
              aria-label="Search"
              title="Search"
            >
              <Icon name="search" />
              <span className="ui-btn__label">Search</span>
            </button>
          </>
        )}
        <ThemeToggle />
        <ReadingSettings />
        {actions}
      </div>
    </header>
  );
}
