import { Button } from '@coverland-engineering/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function HeaderToolbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <nav aria-label="Workspace actions" className="flex items-center gap-2">
      <Button
        type="button"
        mode="icon"
        variant="outline"
        aria-label="Change theme"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => {
          setTheme(isDark ? 'light' : 'dark');
        }}
      >
        {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </Button>
    </nav>
  );
}
