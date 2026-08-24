import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-fg-muted text-sm font-medium">404</p>
      <h1 className="text-fg text-xl font-semibold">Page not found</h1>
      <Link to="/" className="text-primary text-sm underline-offset-4 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
