import { useTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Switch checked={isDark} onCheckedChange={toggleTheme}>
      {isDark ? (
        <Moon className="size-3" />
      ) : (
        <Sun className="size-3" />
      )}
    </Switch>
  );
}
