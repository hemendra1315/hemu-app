import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { FamilyTab } from '../FamilyTab';
import type { ParentPlayerLink } from '@/features/parents/api/parentsTypes';

/**
 * Regression guard for the audit finding: "revoke mutations have no
 * onError — clicking revoke on a parent link (or a linking code) that
 * fails just does nothing visible." The global mutation cache
 * (queryClient.ts) only logs failed mutations via reportError, it never
 * shows anything to the user, so a component that calls `.mutate(...)`
 * bare (no onError, no try/catch) gives staff zero feedback when a revoke
 * fails — the row stays in the list and nothing tells them it didn't work.
 */

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111';
const PLAYER_USER_ID = '22222222-2222-2222-2222-222222222222';
const LINK_ID = '33333333-3333-3333-3333-333333333333';

const PARENT_LINK: ParentPlayerLink = {
  id: LINK_ID,
  parentUserId: '44444444-4444-4444-4444-444444444444',
  playerUserId: PLAYER_USER_ID,
  academyId: ACADEMY_ID,
  relationshipType: 'father',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  parentName: 'Test Parent',
  parentEmail: 'parent@example.com',
  parentPhone: null,
};

const revokeLinkMutateAsync = vi.fn();
const pushToast = vi.fn();

vi.mock('@/features/parents/hooks/useParents', () => ({
  usePlayerParents: () => ({ data: [PARENT_LINK], isLoading: false }),
  usePlayerLinkingCodes: () => ({ data: [], isLoading: false }),
  useGenerateLinkingCode: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeLinkingCode: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeParentLink: () => ({ mutateAsync: revokeLinkMutateAsync, isPending: false }),
}));

vi.mock('@/lib/rbac', () => ({
  useCan: () => true,
}));

vi.mock('@/stores', () => ({
  useUiStore: (selector: (state: { pushToast: typeof pushToast }) => unknown) =>
    selector({ pushToast }),
}));

describe('FamilyTab — revoking a parent link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error toast when the revoke mutation fails, instead of failing silently', async () => {
    revokeLinkMutateAsync.mockRejectedValueOnce(new Error('network error'));

    render(<FamilyTab academyId={ACADEMY_ID} playerUserId={PLAYER_USER_ID} />);

    const revokeButton = screen.getByRole('button', { name: '' }); // icon-only Trash2 button
    fireEvent.click(revokeButton);

    await waitFor(() => expect(revokeLinkMutateAsync).toHaveBeenCalledWith(LINK_ID));
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to revoke parent access', variant: 'error' }),
      ),
    );
  });

  it('shows a success toast when the revoke mutation succeeds', async () => {
    revokeLinkMutateAsync.mockResolvedValueOnce(undefined);

    render(<FamilyTab academyId={ACADEMY_ID} playerUserId={PLAYER_USER_ID} />);

    fireEvent.click(screen.getByRole('button', { name: '' }));

    await waitFor(() => expect(revokeLinkMutateAsync).toHaveBeenCalledWith(LINK_ID));
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Parent access revoked', variant: 'success' }),
      ),
    );
  });
});
