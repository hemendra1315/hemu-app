import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import MySubscriptionPage from '../pages/MySubscriptionPage';
import type { MySubscriptionStatus } from '../api/platformBillingTypes';
import { toPeriodMonth } from '../api/platformBillingApi';

const USER_ID = '33333333-3333-3333-3333-333333333333';
const CURRENT_PERIOD = toPeriodMonth(new Date());

let statusState: {
  data: MySubscriptionStatus | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

let isSuperAdmin = false;

const submitClaimMutateAsync = vi.fn().mockResolvedValue(undefined);
const withdrawClaimMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ profile: { id: USER_ID, isSuperAdmin } }),
}));

vi.mock('../hooks/usePlatformBilling', () => ({
  useMySubscriptionStatus: () => statusState,
  useSubmitSubscriptionClaim: () => ({ mutateAsync: submitClaimMutateAsync, isPending: false }),
  useWithdrawSubscriptionClaim: () => ({ mutateAsync: withdrawClaimMutateAsync, isPending: false }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MySubscriptionPage />
    </MemoryRouter>,
  );
}

describe('MySubscriptionPage', () => {
  it('shows the amount due and Unpaid badge when this month is unpaid', () => {
    isSuperAdmin = false;
    statusState = {
      data: {
        settings: { paymentQrUrl: null, paymentNote: null, monthlyFeePaise: 20000 },
        payments: [],
        claims: [],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByText('Unpaid')).toBeInTheDocument();
    expect(screen.getByText(/200/)).toBeInTheDocument();
    expect(screen.getByText(/No payment QR code yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i've paid/i })).toBeInTheDocument();
  });

  it('shows the QR code and Paid badge once this month is fully paid', () => {
    isSuperAdmin = false;
    statusState = {
      data: {
        settings: {
          paymentQrUrl: 'https://example.com/platform-qr.png',
          paymentNote: 'cybermentors@upi',
          monthlyFeePaise: 20000,
        },
        payments: [
          {
            id: 'pay-1',
            userId: USER_ID,
            amountPaise: 20000,
            periodMonth: CURRENT_PERIOD,
            paidOn: '2026-09-05',
            method: 'UPI',
            notes: null,
            createdAt: '2026-09-05T00:00:00Z',
          },
        ],
        claims: [],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByAltText('Scan to pay your app subscription')).toHaveAttribute(
      'src',
      'https://example.com/platform-qr.png',
    );
    expect(screen.getByText('cybermentors@upi')).toBeInTheDocument();
  });

  it('ignores a payment from a previous month when computing paid status', () => {
    isSuperAdmin = false;
    statusState = {
      data: {
        settings: { paymentQrUrl: null, paymentNote: null, monthlyFeePaise: 20000 },
        payments: [
          {
            id: 'pay-old',
            userId: USER_ID,
            amountPaise: 20000,
            periodMonth: '2020-01-01',
            paidOn: '2020-01-05',
            method: 'Cash',
            notes: null,
            createdAt: '2020-01-05T00:00:00Z',
          },
        ],
        claims: [],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByText('Unpaid')).toBeInTheDocument();
  });

  it('lets an unpaid user submit an "I\'ve paid" claim with the phone number they paid from', async () => {
    isSuperAdmin = false;
    statusState = {
      data: {
        settings: { paymentQrUrl: null, paymentNote: null, monthlyFeePaise: 20000 },
        payments: [],
        claims: [],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /i've paid/i }));
    await user.type(screen.getByPlaceholderText(/9876543210/), '9123456780');
    await user.click(screen.getByRole('button', { name: /^submit$/i }));

    await waitFor(() => {
      expect(submitClaimMutateAsync).toHaveBeenCalledWith({
        userId: USER_ID,
        input: { periodMonth: CURRENT_PERIOD, payerPhone: '9123456780', note: null },
      });
    });
  });

  it('shows the pending-confirmation state and a withdraw action when a claim is already open', () => {
    isSuperAdmin = false;
    statusState = {
      data: {
        settings: { paymentQrUrl: null, paymentNote: null, monthlyFeePaise: 20000 },
        payments: [],
        claims: [
          {
            id: 'claim-1',
            userId: USER_ID,
            periodMonth: CURRENT_PERIOD,
            payerPhone: '9123456780',
            note: null,
            status: 'pending',
            createdAt: '2026-09-05T00:00:00Z',
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByText('Pending confirmation')).toBeInTheDocument();
    expect(screen.getByText(/9123456780/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /i've paid/i })).not.toBeInTheDocument();
  });

  it('shows a dedicated message for the super admin instead of a payment prompt', () => {
    isSuperAdmin = true;
    statusState = {
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByText(/you're the app creator/i)).toBeInTheDocument();
    isSuperAdmin = false; // reset for subsequent test runs
  });
});
