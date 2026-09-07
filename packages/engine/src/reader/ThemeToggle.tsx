import { useTheme, type Theme } from './useTheme';
import { Icon, type IconName } from './Icon';

const LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };
const ICONS: Record<Theme, IconName> = { light: 'sun', dark: 'moon', system: 'auto' };

export function ThemeToggle() {
  const { theme, cycle } = useTheme();
  return (
    <button
      type="button"
      className="ui-btn theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${LABELS[theme]}. Activate to change.`}
      title={`Theme: ${LABELS[theme]}`}
    >
      <Icon name={ICONS[theme]} />
      <span className="ui-btn__label">{LABELS[theme]}</span>
    </button>
  );
}
