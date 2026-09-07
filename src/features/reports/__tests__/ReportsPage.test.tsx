import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ReportsPage from '../pages/ReportsPage';
import type { BatchReport } from '../api/reportsTypes';

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111';
const BATCH_ID = '22222222-2222-2222-2222-222222222222';

const BATCH_REPORT: BatchReport = {
  scope: 'batch',
  batchId: BATCH_ID,
  batchName: 'Morning Batch',
  from: '2026-08-01',
  to: '2026-08-31',
  overallAttendanceRate: 75,
  sessionsHeld: 4,
  players: [
    {
      playerId: '33333333-3333-3333-3333-333333333333',
      fullName: 'Player One',
      attendanceRate: 75,
      sessionsRecorded: 4,
      matchesPlayed: 5,
      battingRuns: 120,
      bowlingWickets: 3,
      fieldingCatches: 2,
    },
  ],
};

const batchReportState = {
  data: undefined as BatchReport | undefined,
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('@/features/academies', () => ({
  useActiveAcademy: () => ({ academyId: ACADEMY_ID }),
}));

vi.mock('@/features/batches', () => ({
  useBatches: () => ({
    data: [{ id: BATCH_ID, name: 'Morning Batch' }],
    isPending: false,
  }),
}));

vi.mock('@/features/members', () => ({
  useAcademyMembers: () => ({ data: [], isPending: false }),
}));

vi.mock('../hooks/useReports', () => ({
  useBatchReport: () => batchReportState,
  usePlayerReport: () => ({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>,
  );
}

describe('ReportsPage', () => {
  it('generates and renders a batch report once a batch and a valid range are chosen', async () => {
    const { rerender } = renderPage();

    fireEvent.change(screen.getByLabelText(/batch/i), { target: { value: BATCH_ID } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    expect(generateButton).not.toBeDisabled();
    fireEvent.click(generateButton);

    // The mocked hook doesn't actually gate on `submitted`/`enabled` (that's
    // real-hook behaviour), so simulate the data arriving after "Generate" is
    // pressed by mutating the shared mock state and forcing a re-render, the
    // same way the drill page test simulates a query resolving after mount.
    batchReportState.data = BATCH_REPORT;
    rerender(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Player One')).toBeInTheDocument());
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download pdf/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/reports/print?scope=batch'),
    );
  });

  it('disables "Generate report" until a batch is selected', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /generate report/i })).toBeDisabled();
  });
});
