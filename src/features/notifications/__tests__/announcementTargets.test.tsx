import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnnouncementsPage } from '../pages/AnnouncementsPage';
import type { Announcement, AnnouncementTarget } from '../api/announcementsApi';

/**
 * Regression guard for the announcements-audit finding: "getTargets exists in
 * the API layer but is never called from any UI." Staff had no way to
 * confirm exactly who a "One Batch" or "Selected People" announcement
 * actually reached, short of checking Supabase directly.
 */

const BATCH_ANNOUNCEMENT: Announcement = {
  id: '11111111-1111-1111-1111-111111111111',
  academy_id: '22222222-2222-2222-2222-222222222222',
  created_by: 'owner-user-id',
  title: 'Under-14s practice moved',
  message: 'Moved to Saturday',
  audience: 'batch',
  batch_id: 'batch-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const CUSTOM_ANNOUNCEMENT: Announcement = {
  ...BATCH_ANNOUNCEMENT,
  id: '33333333-3333-3333-3333-333333333333',
  title: 'Selected players only',
  audience: 'custom',
  batch_id: null,
};

const EVERYONE_ANNOUNCEMENT: Announcement = {
  ...BATCH_ANNOUNCEMENT,
  id: '44444444-4444-4444-4444-444444444444',
  title: 'Season starts Monday',
  audience: 'all',
  batch_id: null,
};

const BATCHES = [{ id: 'batch-1', name: 'Under-14s' }];
const MEMBERS = [
  { id: 'member-1', fullName: 'Arjun Sharma', email: 'arjun@test.com' },
  { id: 'member-2', fullName: null, email: 'noname@test.com' },
];

const TARGETS: AnnouncementTarget[] = [
  {
    id: 't1',
    announcement_id: CUSTOM_ANNOUNCEMENT.id,
    batch_id: null,
    academy_member_id: 'member-1',
  },
  {
    id: 't2',
    announcement_id: CUSTOM_ANNOUNCEMENT.id,
    batch_id: null,
    academy_member_id: 'member-2',
  },
];

let announcementsData: Announcement[] = [
  BATCH_ANNOUNCEMENT,
  CUSTOM_ANNOUNCEMENT,
  EVERYONE_ANNOUNCEMENT,
];
let canManage = true;
const getTargetsMock = vi.fn();

vi.mock('../hooks/useAnnouncements', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useAnnouncements')>(
    '../hooks/useAnnouncements',
  );
  return {
    ...actual,
    useAnnouncements: () => ({ data: announcementsData, isLoading: false }),
    useDeleteAnnouncement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useAnnouncementTargets: (announcementId: string | null) => ({
      data: announcementId ? getTargetsMock(announcementId) : undefined,
      isPending: false,
      isError: false,
    }),
  };
});

vi.mock('@/lib/rbac', () => ({
  useCan: () => canManage,
}));

vi.mock('@/features/academies/hooks/useAcademies', () => ({
  useActiveAcademy: () => ({
    academyId: '22222222-2222-2222-2222-222222222222',
    membership: { role: 'academy_owner', academyName: 'Test Academy' },
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'owner-user-id' } }),
}));

vi.mock('@/stores', () => ({
  useUiStore: () => vi.fn(),
}));

vi.mock('@/features/batches/hooks/useBatches', () => ({
  useBatches: () => ({ data: BATCHES }),
}));

vi.mock('@/features/members', () => ({
  useAcademyMembers: () => ({ data: MEMBERS }),
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

describe('AnnouncementsPage — who an announcement was sent to', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    announcementsData = [BATCH_ANNOUNCEMENT, CUSTOM_ANNOUNCEMENT, EVERYONE_ANNOUNCEMENT];
    canManage = true;
    getTargetsMock.mockReturnValue(TARGETS);
  });

  it('shows a "Sent to" toggle only for batch and custom audiences, not "all"', () => {
    renderPage();
    const toggles = screen.getAllByRole('button', { name: /sent to/i });
    // BATCH_ANNOUNCEMENT and CUSTOM_ANNOUNCEMENT each get one; EVERYONE_ANNOUNCEMENT does not.
    expect(toggles).toHaveLength(2);
  });

  it('resolves a "One Batch" announcement straight from its batch_id, without fetching targets', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /sent to/i })[0]!);

    // Exact match, not a substring regex -- the announcement's own TITLE is
    // "Under-14s practice moved", which would also match a loose /under-14s/i
    // search and make this assertion pass even if the recipient text were
    // never rendered at all.
    expect(screen.getByText('Under-14s')).toBeInTheDocument();
    expect(getTargetsMock).not.toHaveBeenCalled();
  });

  it('fetches and resolves recipient names for a "Selected People" announcement', async () => {
    renderPage();
    const toggles = screen.getAllByRole('button', { name: /sent to/i });
    fireEvent.click(toggles[1]!); // the custom-audience announcement

    await waitFor(() => expect(getTargetsMock).toHaveBeenCalledWith(CUSTOM_ANNOUNCEMENT.id));
    expect(screen.getByText(/arjun sharma/i)).toBeInTheDocument();
    // A member with no full name falls back to their email.
    expect(screen.getByText(/noname@test\.com/i)).toBeInTheDocument();
  });

  it('collapses the recipient detail when the toggle is clicked again', () => {
    renderPage();
    const toggle = screen.getAllByRole('button', { name: /sent to/i })[0]!;
    fireEvent.click(toggle);
    expect(screen.getByText('Under-14s')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText('Under-14s')).not.toBeInTheDocument();
  });

  it('hides the "Sent to" toggle entirely for a non-staff viewer', () => {
    canManage = false;
    renderPage();
    expect(screen.queryByRole('button', { name: /sent to/i })).not.toBeInTheDocument();
  });
});
