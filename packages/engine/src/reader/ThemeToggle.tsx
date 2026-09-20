import { useTheme, type Theme } from './useTheme';
import { useMessages } from '../i18n/messages';
import { Icon, type IconName } from './Icon';

const ICONS: Record<Theme, IconName> = { light: 'sun', dark: 'moon', system: 'auto' };

export function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const words = useMessages();
  const name = words.themeName[theme];

  return (
    <button
      type="button"
      className="ui-btn theme-toggle"
      onClick={cycle}
      aria-label={words.themeAction(name)}
      title={words.themeTitle(name)}
    >
      <Icon name={ICONS[theme]} />
      <span className="ui-btn__label">{name}</span>
    </button>
  );
}
