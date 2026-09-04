import { useEffect, useState } from 'react';

/**
 * Whether the browser currently believes it has a network.
 *
 * **Only trustworthy in one direction.** `navigator.onLine === false` means
 * there is definitely no connection; `true` means only that an interface is up,
 * which a captive portal or a dead uplink will happily report. So this is used
 * to *warn* when the answer is certainly no, and never to block when the answer
 * is merely probably yes: a reader who is online but reported offline would be
 * told they cannot play something they can, which is worse than the silence
 * this replaces.
 *
 * Exists because a book's content can be embedded — and therefore available
 * offline — while its external media cannot. SPEC003 E2.1 asks that the reader
 * be told which, rather than pressing play and watching nothing happen.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => {
    try {
      return navigator.onLine;
    } catch {
      // Non-browser environments and old engines: assume a network rather than
      // decorating every media island with a warning that may be wrong.
      return true;
    }
  });

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    // The value can have changed between first render and this effect.
    update();

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
