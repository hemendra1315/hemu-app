import { Spinner } from '@/components/ui';

/** Full-height loading state for route-level suspense and auth bootstrapping. */
export function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-6 w-6" />
      <p className="text-fg-muted text-sm">{message}</p>
    </div>
  );
}
