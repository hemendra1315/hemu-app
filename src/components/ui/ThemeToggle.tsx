import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { useThemeStore } from '@/stores';
import { THEMES, type Theme } from '@/types/enums';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/** Light / dark / system switcher backed by the persisted theme store. */
export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="border-border-subtle inline-flex rounded-lg border p-0.5"
    >
      {THEMES.map((option) => {
        const Icon = ICONS[option];
        const active = theme === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${option} theme`}
            onClick={() => setTheme(option)}
            className={cn(
              'rounded-md p-1.5 transition',
              active ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:bg-surface-muted',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
