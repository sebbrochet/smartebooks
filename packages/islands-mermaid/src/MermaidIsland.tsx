import { useEffect, useState } from 'react';
import { attrText, type IslandComponentProps } from '@smart-ebooks/engine';
import { AUTO_THEMES, DEFAULT_THEME, resolveTheme } from './index';
import './mermaid.css';

/** Render ids must be unique in the document, and stable enough to debug. */
let sequence = 0;

/**
 * Whether the reader is in dark mode.
 *
 * The shell writes `data-theme` on `<html>`, and *removes* it for "system" — so
 * the media query is the fallback, not the other way round.
 */
function prefersDark(): boolean {
  if (typeof document === 'undefined') return false;
  const attribute = document.documentElement.getAttribute('data-theme');
  if (attribute === 'dark') return true;
  if (attribute === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Re-renders when the reader switches theme, so `auto` diagrams keep up. */
function useDarkMode(): boolean {
  const [dark, setDark] = useState(prefersDark);

  useEffect(() => {
    const update = () => setDark(prefersDark());

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', update);

    return () => {
      observer.disconnect();
      media?.removeEventListener?.('change', update);
    };
  }, []);

  return dark;
}

/**
 * Draws a Mermaid diagram from the directive's fenced body.
 *
 * Two decisions worth stating, because both are security-relevant:
 *
 * 1. **`securityLevel: 'strict'`.** The diagram source comes from the book, and
 *    an imported book is untrusted. Strict mode makes Mermaid sanitize its own
 *    output and disables click bindings and raw HTML labels. Without it, book
 *    content would reach `innerHTML` unfiltered.
 * 2. **The theme is injected as an `init` directive, not via `initialize()`.**
 *    `initialize` is global, so two diagrams with different themes would race
 *    and the last to mount would win. The value is checked against an
 *    allow-list first, so it cannot break out of the JSON it is placed in.
 *
 * A diagram that fails to parse shows its source rather than disappearing —
 * an author needs to see what was wrong, and a reader still gets the content.
 */
export default function MermaidIsland({ id, attributes, data }: IslandComponentProps) {
  const code = ((data as { code?: string } | undefined)?.code ?? '').trim();
  const declared = resolveTheme(attrText(attributes.theme, DEFAULT_THEME));
  const title = attrText(attributes.title);
  const dark = useDarkMode();
  const theme = declared === 'auto' ? (dark ? AUTO_THEMES.dark : AUTO_THEMES.light) : declared;

  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!code) return;

    let active = true;
    setFailed(false);

    void (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

        const source = `%%{init: {"theme": "${theme}"}}%%\n${code}`;
        const rendered = await mermaid.render(`mermaid-${id || 'x'}-${(sequence += 1)}`, source);

        if (active) setSvg(rendered.svg);
      } catch {
        if (active) {
          setSvg(null);
          setFailed(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [code, theme, id]);

  if (!code) {
    return (
      <div className="island island--mermaid island--unknown" role="note">
        Diagram is empty.
      </div>
    );
  }

  if (failed || !svg) {
    return (
      <figure className="island island--mermaid">
        {failed && (
          <p className="mermaid__error" role="note">
            This diagram could not be drawn; its source is shown instead.
          </p>
        )}
        <pre>
          <code>{code}</code>
        </pre>
        {title && <figcaption>{title}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className="island island--mermaid">
      {/* Mermaid output, sanitized by Mermaid itself under securityLevel:'strict'. */}
      <div className="mermaid__figure" role="img" aria-label={title || 'Diagram'}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
}
