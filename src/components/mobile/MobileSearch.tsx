import { Search, X } from 'lucide-react';

type MobileSearchProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
};

export function MobileSearch({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: MobileSearchProps) {
  return (
    <div className={`relative flex w-full items-center ${className}`}>
      <Search className="text-fg-muted pointer-events-none absolute left-3.5 h-4 w-4" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-border-subtle bg-surface text-fg placeholder:text-fg-muted/70 focus:border-primary focus:ring-primary/20 min-h-[48px] w-full rounded-xl border pr-10 pl-10 text-sm shadow-2xs transition focus:ring-2 focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-fg-muted hover:text-fg absolute right-3 rounded-full p-1"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
