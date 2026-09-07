import type { SVGProps } from 'react';

/**
 * The platform's icon set (SPEC009 T11).
 *
 * Eight inline SVGs rather than a dependency: a repository with no UI
 * dependencies should not acquire one for eight glyphs, and the previous
 * approach — Unicode glyphs in a text run (`☰ ⌕ ◑ ⋯`) — could not be stroked,
 * weighted or aligned, rendered at platform-dependent metrics, and in the case
 * of `⌕` (U+2315) is simply absent from many system fonts (SPEC009 V11).
 *
 * Everything is drawn in `currentColor`, so an icon inherits the theme and the
 * reader's contrast preference without knowing either exists.
 */

export type IconName =
  'menu' | 'search' | 'sun' | 'moon' | 'auto' | 'text' | 'more' | 'back' | 'close';

/**
 * Paths are drawn on a 24×24 grid. Kept as data rather than as components so
 * that adding one is a line, not a file.
 */
const PATHS: Record<IconName, string[]> = {
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M16.5 16.5 20 20'],
  sun: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M12 2v2',
    'M12 20v2',
    'M2 12h2',
    'M20 12h2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M19.1 4.9l-1.4 1.4',
    'M6.3 17.7l-1.4 1.4',
  ],
  moon: ['M21 13.2A9 9 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2z'],
  // "Follow the system": a disc, half of it filled, which is the convention
  // every OS uses for automatic contrast.
  auto: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 3v18a9 9 0 0 0 0-18z'],
  // Reading settings. A letter is clearer here than sliders: the control
  // changes type, and sliders would say only "some settings".
  text: ['M4 19l6-14 6 14', 'M6.5 14h7', 'M16 19h4'],
  more: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
  back: ['M15 5l-7 7 7 7'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
}

/**
 * Decorative by default: every control that uses an icon carries its own
 * `aria-label`, so announcing the glyph as well would say everything twice.
 */
export function Icon({ name, ...rest }: IconProps) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} fill={name === 'auto' && d.includes('v18') ? 'currentColor' : 'none'} />
      ))}
    </svg>
  );
}
