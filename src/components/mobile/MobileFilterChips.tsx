type FilterOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

type MobileFilterChipsProps<T extends string> = {
  options: FilterOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
};

export function MobileFilterChips<T extends string>({
  options,
  activeId,
  onChange,
  className = '',
}: MobileFilterChipsProps<T>) {
  return (
    <div
      className={`no-scrollbar flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 ${className}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {options.map((opt) => {
        const isActive = opt.id === activeId;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            aria-pressed={isActive}
            className={`flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
              isActive
                ? 'bg-primary text-primary-fg shadow-2xs'
                : 'bg-surface border-border-subtle text-fg-muted hover:text-fg hover:border-border-subtle/80 border'
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`py-0.2 rounded-full px-1.5 text-[10px] ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-muted text-fg-muted'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
