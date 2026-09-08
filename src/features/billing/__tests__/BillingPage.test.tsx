import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import BillingPage from '../pages/BillingPage';
import type { PlayerFeeSummary } from '../api/billingTypes';

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111';

const ROWS: PlayerFeeSummary[] = [
  {
    playerId: 'player-1',
    fullName: 'Paid Player',
    email: 'paid@test.com',
    monthlyFeePaise: 200000,
    paidPaiseThisMonth: 200000,
    isPaid: true,
  },
  {
    playerId: 'player-2',
    fullName: 'Unpaid Player',
    email: 'unpaid@test.com',
    monthlyFeePaise: 200000,
    paidPaiseThisMonth: 0,
    isPaid: false,
  },
];

let summariesState: {
  data: PlayerFeeSummary[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

vi.mock('@/features/academies', () => ({
  useActiveAcademy: () => ({ academyId: ACADEMY_ID }),
}));

vi.mock('../hooks/useBilling', () => ({
  useFeeSummaries: () => summariesState,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>,
  );
}

describe('BillingPage', () => {
  it('shows each player with a paid or unpaid badge and links to their detail page', () => {
    summariesState = {
      data: ROWS,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByText('Paid Player')).toBeInTheDocument();
    expect(screen.getByText('Unpaid Player')).toBeInTheDocument();
    expect(screen.getByText('1 paid')).toBeInTheDocument();
    expect(screen.getByText('1 unpaid')).toBeInTheDocument();
    // The link's full accessible name also includes the fee amount and the
    // Paid/Unpaid badge text, and a name regex risks matching "Unpaid Player"
    // as a substring of "Paid Player" -- walking up from the player's own
    // name text to its enclosing <a> sidesteps both problems.
    expect(screen.getByText('Paid Player').closest('a')).toHaveAttribute('href', '/fees/player-1');
  });

  it('shows an empty state when the academy has no players', () => {
    summariesState = { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() };
    renderPage();

    expect(screen.getByText(/no players yet/i)).toBeInTheDocument();
  });
});
