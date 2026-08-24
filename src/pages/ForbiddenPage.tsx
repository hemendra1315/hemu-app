import { Link } from 'react-router-dom';

/** Shown when RequireRole rejects a navigation. */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-fg-muted text-sm font-medium">403</p>
      <h1 className="text-fg text-xl font-semibold">You do not have access to this page</h1>
      <p className="text-fg-muted max-w-md text-sm">
        Ask your academy owner if you believe you should have access.
      </p>
      <Link to="/" className="text-primary text-sm underline-offset-4 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
