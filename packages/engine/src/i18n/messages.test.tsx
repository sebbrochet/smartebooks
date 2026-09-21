// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LANGUAGE_KEY } from '../store/platformSettings';
import { createIslandRegistry } from '../islandRegistry';
import { BookProvider } from '../reader/BookContext';
import { IslandHost } from '../markdown/IslandHost';
import { deviceLanguage, messagesFor, resolveLanguage } from './messages';
import { MessagesProvider } from './MessagesProvider';
import { ReaderBar } from '../reader/ReaderBar';

describe('resolveLanguage', () => {
  it('reads the device when the reader has chosen nothing', () => {
    expect(resolveLanguage('system', ['fr-FR', 'en-GB'])).toBe('fr');
    expect(resolveLanguage('system', ['en-GB', 'fr-FR'])).toBe('en');
  });

  // The rule `wordsFor` already uses for books: a region is not a language.
  it('matches on the primary subtag', () => {
    expect(resolveLanguage('system', ['fr-CA'])).toBe('fr');
    expect(resolveLanguage('FR')).toBe('fr');
  });

  /*
   * The case that decides whether the list is a list at all: a device asking
   * first for a language the shell does not speak must fall through to the next
   * one it does, rather than giving up and answering English.
   */
  it('takes the first language it can actually speak', () => {
    expect(resolveLanguage('system', ['de-DE', 'nl', 'fr-BE', 'en'])).toBe('fr');
  });

  it('falls back to English rather than showing a reader nothing', () => {
    expect(resolveLanguage('system', ['de-DE'])).toBe('en');
    expect(resolveLanguage('system', [])).toBe('en');
    expect(resolveLanguage('qq')).toBe('en');
  });

  // The stored value is the *choice*, so a reader who picked French keeps it on
  // an English device — which is the whole reason it is stored at all.
  it('lets a choice outrank the device', () => {
    expect(resolveLanguage('fr', ['en-GB', 'en-US'])).toBe('fr');
  });
});

describe('deviceLanguage', () => {
  afterEach(() => localStorage.removeItem(LANGUAGE_KEY));

  it('prefers a stored choice over the browser', () => {
    localStorage.setItem(LANGUAGE_KEY, 'fr');

    expect(deviceLanguage()).toBe('fr');
  });
});

/**
 * The wiring, which is the half a table of strings cannot prove: that the
 * resolved language reaches a component at all. `words.test.tsx` names this
 * trap for books; the shell has the same one.
 */
describe('a reader whose shell speaks French', () => {
  const navigation = {
    navOpen: false,
    onToggleNav: () => {},
    onOpenSearch: () => {},
    navToggleRef: { current: null },
  };

  const inA = (language: 'en' | 'fr') =>
    renderToStaticMarkup(
      <MessagesProvider language={language}>
        <ReaderBar title="Un livre" navigation={navigation} />
      </MessagesProvider>,
    );

  it('is offered a sommaire, not contents', () => {
    const html = inA('fr');

    expect(html).toContain('Sommaire');
    expect(html).not.toContain('Contents');
  });

  it('still reads English when that is what the device asks for', () => {
    expect(inA('en')).toContain('Contents');
  });

  // The book's own title is never translated, and sits inside the chrome that is.
  it('keeps the book title exactly as the book wrote it', () => {
    expect(inA('fr')).toContain('Un livre');
  });
});

/**
 * SPEC015 L1.6. The notice a reader gets for an island the book asked for and
 * they cannot have used to name the directive — *"Unknown interactive block:
 * `chess-board`"* — which is the author's problem stated in the author's
 * vocabulary, to somebody who can do nothing with either.
 */
describe('an island the reader cannot have', () => {
  const registry = createIslandRegistry([]);

  const shown = (language: 'en' | 'fr') =>
    renderToStaticMarkup(
      <BookProvider slug="b" registry={registry}>
        <MessagesProvider language={language}>
          <IslandHost type="chess-board" islandId="x" />
        </MessagesProvider>
      </BookProvider>,
    );

  it('says so in the reader’s language, not the author’s vocabulary', () => {
    const html = shown('fr');

    expect(html).toContain('Cette partie du livre');
    expect(html).not.toContain('chess-board');
  });

  // The marker is what the rest of the suite asserts on, so it has to survive
  // the wording changing underneath it.
  it('keeps the placeholder a placeholder', () => {
    expect(shown('en')).toContain('island--unknown');
  });

  /*
   * The information is moved, not dropped. An imported book is the only way to
   * reach this — `lint:content` gates every bundled one — so somebody
   * debugging a book they were given still needs the name.
   */
  it('tells the console what it does not tell the reader', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    shown('en');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('chess-board'));
    warn.mockRestore();
  });
});

describe('a message that carries a value', () => {
  /*
   * The reason these are functions rather than templates the caller fills in:
   * French wants U+00A0 before its colon, so the punctuation belongs to the
   * language and not to the component.
   */
  it('lets the language own its punctuation', () => {
    expect(messagesFor('en').themeTitle('Dark')).toBe('Theme: Dark');
    expect(messagesFor('fr').themeTitle('Sombre')).toBe('Thème\u00a0: Sombre');
  });

  it('says what activating the control does, in both', () => {
    expect(messagesFor('en').themeAction('Dark')).toBe('Theme: Dark. Activate to change.');
    expect(messagesFor('fr').themeAction('Sombre')).toBe(
      'Thème\u00a0: Sombre. Activer pour changer.',
    );
  });

  /*
   * This used to be two counts and two ternaries in the JSX, which can only
   * ever inflect a noun. French inflects the participle with it.
   */
  it('agrees a count with the words around it', () => {
    expect(messagesFor('en').searchCount(1, 1)).toBe('1 matching passage in 1 chapter');
    expect(messagesFor('en').searchCount(9, 2)).toBe('9 matching passages in 2 chapters');

    expect(messagesFor('fr').searchCount(1, 1)).toBe('1 passage trouvé dans 1 chapitre');
    expect(messagesFor('fr').searchCount(9, 2)).toBe('9 passages trouvés dans 2 chapitres');
  });
});

/**
 * One record per setting rather than one keyed by the stored value. Sharing it
 * looked like deduplication and hid a translation bug: the same English
 * "Normal" belongs to a masculine noun in one setting and a feminine one in the
 * other.
 */
describe('two settings that share an English word', () => {
  it('do not have to share the French one', () => {
    const fr = messagesFor('fr');

    expect(fr.lineSpacingName.normal).toBe('Normal');
    expect(fr.lineLengthName.normal).toBe('Normale');
  });

  it('still share it where English is the same word', () => {
    const en = messagesFor('en');

    expect(en.lineSpacingName.normal).toBe(en.lineLengthName.normal);
  });
});
