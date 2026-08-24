import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsPage } from '../pages/NotificationsPage';
import { AnnouncementsPage } from '../pages/AnnouncementsPage';
import * as useNotificationsHooks from '../hooks/useNotifications';
import * as useAnnouncementsHooks from '../hooks/useAnnouncements';
import { useAcademyStore } from '@/stores/academyStore';
import { useCan } from '@/lib/rbac';

// Mock dependencies
vi.mock('@/stores/academyStore', () => ({
  useAcademyStore: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  useCan: vi.fn(),
}));

describe('Notifications & Announcements UI', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    (useAcademyStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentAcademy: { id: 'test-academy-id', name: 'Test Academy' },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  it('1. Renders empty state for notifications', () => {
    vi.spyOn(useNotificationsHooks, 'useNotifications').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useNotificationsHooks.useNotifications>);

    render(<NotificationsPage />, { wrapper });
    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('2. Renders empty state for announcements', () => {
    vi.spyOn(useAnnouncementsHooks, 'useAnnouncements').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useAnnouncementsHooks.useAnnouncements>);

    (useCan as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false); // Player

    render(<AnnouncementsPage />, { wrapper });
    expect(screen.getByText('No announcements')).toBeInTheDocument();
  });
});
