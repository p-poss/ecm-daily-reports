import { useTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return <Switch checked={isDark} onCheckedChange={toggleTheme} />;
}
