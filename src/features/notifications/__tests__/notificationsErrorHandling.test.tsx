import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { NotificationsPage } from '../pages/NotificationsPage';
import type { Notification } from '../api/notificationsApi';

/**
 * Regression guard for the announcements-audit finding: "mark as read /
 * mark all read / delete have no error handling." All three used to call
 * `.mutate()` directly with no onError and no try/catch. The app's global
 * mutation-error handler (queryClient.ts) only logs failures silently —
 * it never shows anything to the user — so a failed mutation (RLS denial,
 * network blip) gave zero feedback: the notification just stayed exactly
 * as it was, indistinguishable from success.
 */

const NOTIF: Notification = {
  id: '11111111-1111-1111-1111-111111111111',
  academy_id: '22222222-2222-2222-2222-222222222222',
  announcement_id: null,
  recipient_user_id: '33333333-3333-3333-3333-333333333333',
  title: 'Test notification',
  message: 'Hello',
  notification_type: 'announcement',
  channel: 'in_app',
  status: 'queued',
  metadata: {},
  read_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

const markAsReadMutateAsync = vi.fn();
const markAllAsReadMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
const pushToast = vi.fn();

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ data: [NOTIF], isLoading: false }),
  useMarkAsRead: () => ({ mutateAsync: markAsReadMutateAsync, isPending: false }),
  useMarkAllAsRead: () => ({ mutateAsync: markAllAsReadMutateAsync, isPending: false }),
  useDeleteNotification: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
}));

vi.mock('@/stores', () => ({
  useUiStore: (selector: (state: { pushToast: typeof pushToast }) => unknown) =>
    selector({ pushToast }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  );
}

describe('NotificationsPage — mutation error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error toast when marking a notification as read fails', async () => {
    markAsReadMutateAsync.mockRejectedValueOnce(new Error('network error'));
    renderPage();

    fireEvent.click(screen.getByText('Test notification'));

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to mark as read', variant: 'error' }),
      ),
    );
  });

  it('shows an error toast when "Mark all read" fails', async () => {
    markAllAsReadMutateAsync.mockRejectedValueOnce(new Error('network error'));
    renderPage();

    fireEvent.click(screen.getByText('Mark all read'));

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to mark all as read', variant: 'error' }),
      ),
    );
  });

  it('shows an error toast when deleting a notification fails', async () => {
    deleteMutateAsync.mockRejectedValueOnce(new Error('network error'));
    renderPage();

    // The delete button is icon-only (Trash2, no text), so its accessible
    // name is empty — unlike "Mark all read", which has visible text.
    fireEvent.click(screen.getByRole('button', { name: '' }));

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to delete notification', variant: 'error' }),
      ),
    );
  });
});
