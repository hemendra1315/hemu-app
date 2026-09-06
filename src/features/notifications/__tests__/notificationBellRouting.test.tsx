import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, matchRoutes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { NotificationBell } from '../components/NotificationBell';
import { router } from '@/app/router';

// Mock the Supabase transport so rendering the bell never talks to the
// network. The bell now runs a `select(..., { count: 'exact', head: true })
// .is('read_at', null)` count query (see notificationsApi.getUnreadCount)
// instead of fetching rows, so the stub needs to be a generic thenable
// chain rather than a fixed `select().order()` shape.
function makeChainableQueryStub(result: { data: unknown[]; error: null; count?: number }) {
  const stub: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'order', 'limit']) {
    stub[method] = vi.fn(() => stub);
  }
  (stub as { then: unknown }).then = (resolve: (value: typeof result) => unknown) =>
    Promise.resolve(result).then(resolve);
  return stub;
}

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => makeChainableQueryStub({ data: [], error: null, count: 0 })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
    })),
    removeChannel: vi.fn(),
  },
}));

/**
 * Regression: clicking the notification bell must reach a real route.
 *
 * The bell previously linked to `/academy/notifications`, which is not registered
 * in src/app/router.tsx, so it fell through to the catch-all route and rendered
 * the "Page Not Found" screen in production.
 */
describe('NotificationBell routing (production regression)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  it('renders the bell as a link to the registered /notifications route', () => {
    render(<NotificationBell />, { wrapper });

    const bell = screen.getByRole('link', { name: 'View notifications' });
    expect(bell).toBeInTheDocument();
    expect(bell).toHaveAttribute('href', '/notifications');
    expect(bell.getAttribute('href')).not.toBe('/academy/notifications');
  });

  it('the destination is a real route, while the old path only hit the NotFound catch-all', () => {
    const destination = bellDestination();

    // The new destination resolves to the actual /notifications route.
    const matches = matchRoutes(router.routes, destination);
    expect(matches).not.toBeNull();
    expect(matches?.at(-1)?.route.path).toBe('/notifications');

    // The previously-broken path only matches the catch-all "*" (NotFoundPage) —
    // that is exactly why it rendered "Page Not Found" in production.
    const broken = matchRoutes(router.routes, '/academy/notifications');
    expect(broken).not.toBeNull();
    expect(broken?.at(-1)?.route.path).toBe('*');
  });
});

// Keep the asserted href in one place so it is exercised by both tests.
function bellDestination(): string {
  return '/notifications';
}
