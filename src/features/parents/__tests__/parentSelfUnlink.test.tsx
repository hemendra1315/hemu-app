import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ParentDashboardPage from '../pages/ParentDashboardPage';

/**
 * Regression guard for the audit finding: "parent can't unlink
 * themselves." There was no UI anywhere for a parent to remove a linked
 * child from their own account, and the underlying RLS policy
 * (parent_player_links_update) never even allowed a parent to update
 * their own link row — only staff or the player could. Both are fixed:
 * this test covers the UI half (the confirm-then-revoke flow); the RLS
 * half was verified directly against the live policy catalogue.
 */

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111';
const LINK_ID = '22222222-2222-2222-2222-222222222222';
const PLAYER_MEMBER_ID = '33333333-3333-3333-3333-333333333333';

const CHILD = {
  linkId: LINK_ID,
  relationshipType: 'father',
  player: {
    id: PLAYER_MEMBER_ID,
    fullName: 'Test Child',
    avatarUrl: null,
    batchId: null,
    batchName: null,
  },
};

const revokeMutateAsync = vi.fn();
const pushToast = vi.fn();

vi.mock('../hooks/useParents', () => ({
  useLinkedChildren: () => ({
    data: [CHILD],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useRevokeParentLink: () => ({ mutateAsync: revokeMutateAsync, isPending: false }),
}));

vi.mock('@/features/academies/hooks/useAcademies', () => ({
  useActiveAcademy: () => ({
    academyId: ACADEMY_ID,
    membership: { academyName: 'Test Academy' },
  }),
}));

vi.mock('@/features/players/hooks/usePlayers', () => ({
  usePlayerUpcomingSessions: () => ({
    data: [],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/attendance/hooks/useAttendance', () => ({
  usePlayerAttendance: () => ({
    data: [],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/matches/hooks/useMatches', () => ({
  useAcademyMatches: () => ({
    data: [],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePlayerStatisticsById: () => ({
    data: null,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/notifications/hooks/useAnnouncements', () => ({
  useAnnouncements: () => ({
    data: [],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/stores', () => ({
  useUiStore: (selector: (state: { pushToast: typeof pushToast }) => unknown) =>
    selector({ pushToast }),
}));

function renderPage() {
  return render(React.createElement(MemoryRouter, null, React.createElement(ParentDashboardPage)));
}

describe('ParentDashboardPage — a parent unlinking themselves from a child', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for confirmation, then revokes the parent's own link and shows a success toast", async () => {
    revokeMutateAsync.mockResolvedValueOnce(undefined);
    renderPage();

    fireEvent.click(screen.getByTitle('Unlink this child from your account'));

    expect(screen.getByText('Unlink this child?')).toBeInTheDocument();
    expect(revokeMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));

    await waitFor(() => expect(revokeMutateAsync).toHaveBeenCalledWith(LINK_ID));
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Unlinked from this child', variant: 'success' }),
      ),
    );
  });

  it('cancelling the confirm dialog does not revoke anything', () => {
    renderPage();

    fireEvent.click(screen.getByTitle('Unlink this child from your account'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Unlink this child?')).not.toBeInTheDocument();
    expect(revokeMutateAsync).not.toHaveBeenCalled();
  });

  it('shows an error toast if the unlink fails, instead of failing silently', async () => {
    revokeMutateAsync.mockRejectedValueOnce(new Error('network error'));
    renderPage();

    fireEvent.click(screen.getByTitle('Unlink this child from your account'));
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to unlink', variant: 'error' }),
      ),
    );
  });
});
