import { useTheme, type Theme } from './useTheme';

const LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };
const ICONS: Record<Theme, string> = { light: '☀', dark: '☾', system: '◑' };

export function ThemeToggle() {
  const { theme, cycle } = useTheme();
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${LABELS[theme]}. Activate to change.`}
      title={`Theme: ${LABELS[theme]}`}
    >
      <span aria-hidden="true">{ICONS[theme]}</span> {LABELS[theme]}
    </button>
  );
}
