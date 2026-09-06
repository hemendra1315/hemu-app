import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { FamilyTab } from '../FamilyTab';
import type { ParentPlayerLink } from '@/features/parents/api/parentsTypes';

/**
 * Regression guard for the audit finding: "revoke UI can't distinguish
 * same-named parents" — really, it couldn't distinguish parents at all.
 * The "Linked Parents" card only ever rendered the relationship type and
 * a date ("Father — Linked: Jan 1"), never the parent's actual name. A
 * staff member with two "guardian" links on one player (a common case —
 * a remarried family, a legal guardian alongside a parent) had no way to
 * tell which card belonged to which person before hitting revoke.
 */

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111';
const PLAYER_USER_ID = '22222222-2222-2222-2222-222222222222';

const GUARDIAN_ONE: ParentPlayerLink = {
  id: '33333333-3333-3333-3333-333333333333',
  parentUserId: '44444444-4444-4444-4444-444444444444',
  playerUserId: PLAYER_USER_ID,
  academyId: ACADEMY_ID,
  relationshipType: 'guardian',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  parentName: 'Asha Rao',
  parentEmail: 'asha@example.com',
  parentPhone: null,
};

const GUARDIAN_TWO: ParentPlayerLink = {
  id: '55555555-5555-5555-5555-555555555555',
  parentUserId: '66666666-6666-6666-6666-666666666666',
  playerUserId: PLAYER_USER_ID,
  academyId: ACADEMY_ID,
  relationshipType: 'guardian',
  status: 'active',
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  parentName: 'Ravi Kumar',
  parentEmail: null,
  parentPhone: '9876543210',
};

let playerParentsData: ParentPlayerLink[] = [GUARDIAN_ONE, GUARDIAN_TWO];

vi.mock('@/features/parents/hooks/useParents', () => ({
  usePlayerParents: () => ({ data: playerParentsData, isLoading: false }),
  usePlayerLinkingCodes: () => ({ data: [], isLoading: false }),
  useGenerateLinkingCode: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeLinkingCode: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeParentLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/rbac', () => ({
  useCan: () => true,
}));

vi.mock('@/stores', () => ({
  useUiStore: () => vi.fn(),
}));

describe('FamilyTab — telling two same-relationship parents apart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playerParentsData = [GUARDIAN_ONE, GUARDIAN_TWO];
  });

  it('shows each linked parent by name, not just their relationship type', () => {
    render(<FamilyTab academyId={ACADEMY_ID} playerUserId={PLAYER_USER_ID} />);

    expect(screen.getByText(/Asha Rao/)).toBeInTheDocument();
    expect(screen.getByText(/Ravi Kumar/)).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
  });

  it('falls back to a clear placeholder when a linked profile has no name on file', () => {
    playerParentsData = [
      { ...GUARDIAN_ONE, parentName: null, parentEmail: null, parentPhone: null },
    ];

    render(<FamilyTab academyId={ACADEMY_ID} playerUserId={PLAYER_USER_ID} />);

    expect(screen.getByText(/Unnamed parent/)).toBeInTheDocument();
  });
});
