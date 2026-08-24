import { cn } from '@/lib/utils/cn';

/** Content placeholder used while queries are pending. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bg-surface-muted animate-pulse rounded-md', className)} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
