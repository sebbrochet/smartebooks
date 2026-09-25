import { useEffect, useState } from 'react';
import { attrText, type IslandComponentProps } from '@smart-ebooks/engine';

export interface AbcSource {
  /** The tune to draw, from the file if there is one, else from the body. */
  source: string;
  /** True while a packaged file is still being read. */
  loading: boolean;
}

/**
 * Where a tune comes from: the directive's body, or a file the book ships.
 *
 * **Only a packaged file is read**, which is the chess pack's rule and its
 * reasoning transfers exactly: `IslandHost` resolves `assets/…` and reports
 * which attributes it resolved, and anything else is left alone. A board plays
 * media the browser fetches; this reads bytes and engraves them, so following
 * an arbitrary URL would let a book put whatever it liked on the page through
 * the reader's own connection.
 *
 * SPEC017 §5.1 is the other half: a body is always ABC, and `src` is the only
 * way to reach MusicXML when that arrives.
 */
export function useAbcSource(
  attributes: IslandComponentProps['attributes'],
  packagedAssets: IslandComponentProps['packagedAssets'],
  body: string,
): AbcSource {
  const assetUrl = packagedAssets.includes('src') ? attrText(attributes.src) : '';
  const [fromFile, setFromFile] = useState<string | null>(null);

  useEffect(() => {
    if (!assetUrl) return;
    let cancelled = false;
    fetch(assetUrl)
      .then((response) => response.text())
      // An empty string rather than null: the difference is "still reading"
      // from "read it, and there is no tune in it".
      .then((text) => !cancelled && setFromFile(text))
      .catch(() => !cancelled && setFromFile(''));
    return () => {
      cancelled = true;
    };
  }, [assetUrl]);

  return {
    source: assetUrl ? (fromFile ?? '') : body,
    loading: assetUrl !== '' && fromFile === null,
  };
}
