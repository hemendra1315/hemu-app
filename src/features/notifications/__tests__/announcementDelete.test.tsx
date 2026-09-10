import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnnouncementsPage } from '../pages/AnnouncementsPage';
import type { Announcement } from '../api/announcementsApi';

/**
 * Regression guard for the announcements-audit finding: "deleteAnnouncement
 * exists in the API layer but is never called from any UI." There was no
 * delete button anywhere, so a mistaken or stale announcement could only be
 * removed by going into Supabase directly.
 *
 * Also covers the audience badge previously showing the raw enum value
 * (e.g. "all_parents") instead of a readable label.
 */

const OWNED: Announcement = {
  id: '11111111-1111-1111-1111-111111111111',
  academy_id: '22222222-2222-2222-2222-222222222222',
  created_by: 'coach-user-id',
  title: 'Practice moved',
  message: 'Moved to Saturday',
  audience: 'all_parents',
  batch_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const OTHERS: Announcement = {
  ...OWNED,
  id: '33333333-3333-3333-3333-333333333333',
  title: "Another coach's announcement",
  created_by: 'someone-else',
};

const deleteMutateAsync = vi.fn();
const pushToast = vi.fn();

vi.mock('../hooks/useAnnouncements', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useAnnouncements')>(
    '../hooks/useAnnouncements',
  );
  return {
    ...actual,
    useAnnouncements: () => ({ data: [OWNED, OTHERS], isLoading: false }),
    useDeleteAnnouncement: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
  };
});

vi.mock('@/lib/rbac', () => ({
  useCan: () => true, // coach with announcements:manage
}));

vi.mock('@/features/academies/hooks/useAcademies', () => ({
  useActiveAcademy: () => ({
    academyId: '22222222-2222-2222-2222-222222222222',
    membership: { role: 'coach', academyName: 'Test Academy' },
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'coach-user-id' } }),
}));

vi.mock('@/stores', () => ({
  useUiStore: (selector: (state: { pushToast: typeof pushToast }) => unknown) =>
    selector({ pushToast }),
}));

// AnnouncementsPage now also fetches batches/members (to resolve "Sent to"
// recipient names) unconditionally for any staff viewer -- without this
// mock these tests would fire the real Supabase-backed hooks against an
// unmocked client.
vi.mock('@/features/batches/hooks/useBatches', () => ({
  useBatches: () => ({ data: [] }),
}));

vi.mock('@/features/members', () => ({
  useAcademyMembers: () => ({ data: [] }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AnnouncementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AnnouncementsPage — delete announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a readable audience label instead of the raw enum value', () => {
    renderPage();
    expect(screen.getAllByText('All Parents').length).toBeGreaterThan(0);
    expect(screen.queryByText('all_parents')).not.toBeInTheDocument();
  });

  it('a coach only sees the delete button on announcements they created', () => {
    renderPage();
    // One delete button for OWNED, none for OTHERS (created by someone else).
    const deleteButtons = screen.getAllByRole('button', { name: '' });
    expect(deleteButtons).toHaveLength(1);
  });

  it('confirms before deleting, then deletes and shows a success toast', async () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: '' })[0]!);
    expect(screen.getByText('Delete this announcement?')).toBeInTheDocument();
    expect(deleteMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith(OWNED.id));
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Announcement deleted', variant: 'success' }),
      ),
    );
  });

  it('shows an error toast when deletion fails', async () => {
    deleteMutateAsync.mockRejectedValueOnce(new Error('network error'));
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: '' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to delete announcement', variant: 'error' }),
      ),
    );
  });
});
