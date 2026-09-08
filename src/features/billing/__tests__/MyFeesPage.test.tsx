import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import MyFeesPage from '../pages/MyFeesPage';
import type { PlayerFeeDetail } from '../api/billingTypes';
import { toPeriodMonth } from '../api/billingApi';

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111';
const PLAYER_ID = '22222222-2222-2222-2222-222222222222';
const CURRENT_PERIOD = toPeriodMonth(new Date());

let detailState: {
  data: PlayerFeeDetail | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

let academyState: {
  data: { paymentQrUrl: string | null; paymentNote: string | null } | undefined;
  isPending: boolean;
};

let membershipRole: 'player' | 'academy_owner' | 'parent' = 'player';

const CHILD_A_ID = '33333333-3333-3333-3333-333333333333';
const CHILD_B_ID = '44444444-4444-4444-4444-444444444444';

let linkedChildrenState: {
  data: Array<{ player: { id: string; fullName: string } }> | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
} = { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() };

vi.mock('@/features/academies', () => ({
  useActiveAcademy: () => ({
    academyId: ACADEMY_ID,
    membership:
      membershipRole === 'player'
        ? { id: PLAYER_ID, role: membershipRole, academyName: 'Test Academy' }
        : { id: 'staff-1', role: membershipRole, academyName: 'Test Academy' },
  }),
  useAcademy: () => academyState,
}));

vi.mock('../hooks/useBilling', () => ({
  usePlayerFeeDetail: () => detailState,
}));

vi.mock('@/features/parents/hooks/useParents', () => ({
  useLinkedChildren: () => linkedChildrenState,
}));

vi.mock('@/stores', () => ({
  useTestModeStore: (selector: (state: { activeRole: null }) => unknown) =>
    selector({ activeRole: null }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MyFeesPage />
    </MemoryRouter>,
  );
}

describe('MyFeesPage', () => {
  it('shows the amount due and unpaid badge when this month is unpaid', () => {
    detailState = {
      data: {
        playerId: PLAYER_ID,
        fullName: 'Test Player',
        email: 'p@test.com',
        monthlyFeePaise: 150000,
        payments: [],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    academyState = { data: { paymentQrUrl: null, paymentNote: null }, isPending: false };
    renderPage();

    expect(screen.getByText('Unpaid')).toBeInTheDocument();
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
    expect(screen.getByText(/No payment QR code yet/i)).toBeInTheDocument();
  });

  it('shows the QR code and Paid badge once this month is fully paid', () => {
    detailState = {
      data: {
        playerId: PLAYER_ID,
        fullName: 'Test Player',
        email: 'p@test.com',
        monthlyFeePaise: 150000,
        payments: [
          {
            id: 'pay-1',
            playerId: PLAYER_ID,
            amountPaise: 150000,
            periodMonth: CURRENT_PERIOD,
            paidOn: '2026-09-05',
            method: 'UPI',
            notes: null,
            createdAt: '2026-09-05T00:00:00Z',
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    academyState = {
      data: { paymentQrUrl: 'https://example.com/qr.png', paymentNote: 'academy@upi' },
      isPending: false,
    };
    renderPage();

    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByAltText('Scan to pay your academy fees')).toHaveAttribute(
      'src',
      'https://example.com/qr.png',
    );
    expect(screen.getByText('academy@upi')).toBeInTheDocument();
  });

  it('ignores a payment recorded for a previous month when computing paid status', () => {
    detailState = {
      data: {
        playerId: PLAYER_ID,
        fullName: 'Test Player',
        email: 'p@test.com',
        monthlyFeePaise: 150000,
        payments: [
          {
            id: 'pay-old',
            playerId: PLAYER_ID,
            // A prior month, fully paid -- must not count toward this month.
            amountPaise: 150000,
            periodMonth: '2020-01-01',
            paidOn: '2020-01-05',
            method: 'Cash',
            notes: null,
            createdAt: '2020-01-05T00:00:00Z',
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    academyState = { data: { paymentQrUrl: null, paymentNote: null }, isPending: false };
    renderPage();

    expect(screen.getByText('Unpaid')).toBeInTheDocument();
  });

  it('shows the loading state while data is still pending', () => {
    detailState = {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    academyState = { data: undefined, isPending: true };
    renderPage();

    expect(screen.getByText(/loading your fees/i)).toBeInTheDocument();
  });

  it('shows an empty state when the signed-in member is not a player', () => {
    membershipRole = 'academy_owner';
    detailState = {
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    academyState = { data: undefined, isPending: false };
    renderPage();

    expect(screen.getByText(/pay fees is for players/i)).toBeInTheDocument();
    membershipRole = 'player'; // reset for subsequent test runs
  });

  it("shows a linked child's fee info when signed in as a parent", () => {
    membershipRole = 'parent';
    linkedChildrenState = {
      data: [{ player: { id: CHILD_A_ID, fullName: 'Test Child' } }],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    detailState = {
      data: {
        playerId: CHILD_A_ID,
        fullName: 'Test Child',
        email: 'child@test.com',
        monthlyFeePaise: 150000,
        payments: [],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    academyState = { data: { paymentQrUrl: null, paymentNote: null }, isPending: false };
    renderPage();

    expect(screen.getByText("Child's Fees")).toBeInTheDocument();
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
    expect(screen.getByText(/1,500/)).toBeInTheDocument();

    membershipRole = 'player'; // reset for subsequent test runs
    linkedChildrenState = {
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it('lets a parent with multiple linked children switch between them', () => {
    membershipRole = 'parent';
    linkedChildrenState = {
      data: [
        { player: { id: CHILD_A_ID, fullName: 'First Child' } },
        { player: { id: CHILD_B_ID, fullName: 'Second Child' } },
      ],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    detailState = {
      data: {
        playerId: CHILD_A_ID,
        fullName: 'First Child',
        email: 'first@test.com',
        monthlyFeePaise: 150000,
        payments: [],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    academyState = { data: { paymentQrUrl: null, paymentNote: null }, isPending: false };
    renderPage();

    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Second' })).toBeInTheDocument();

    membershipRole = 'player'; // reset for subsequent test runs
    linkedChildrenState = {
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it('shows an empty state when a parent has no linked children', () => {
    membershipRole = 'parent';
    linkedChildrenState = {
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    detailState = {
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    academyState = { data: undefined, isPending: false };
    renderPage();

    expect(screen.getByText(/no child linked yet/i)).toBeInTheDocument();

    membershipRole = 'player'; // reset for subsequent test runs
  });
});
