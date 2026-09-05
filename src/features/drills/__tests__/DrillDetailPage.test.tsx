import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import DrillDetailPage from '../pages/DrillDetailPage';
import type { Drill } from '../api/drillsTypes';

/**
 * Regression guard for the audit finding: "the edit form silently overwrites
 * the real drill's category/difficulty/description/duration on save."
 *
 * The page calls `useForm({ defaultValues })` where `defaultValues` is built
 * from `drill`, which is `null` on the very first render (the drills query
 * is still pending). React Hook Form only reads `defaultValues` once, at
 * mount — so if the query is pending when this component first mounts, the
 * form's internal defaults are permanently the empty fallback values, no
 * matter what loads in afterward. The visible inputs use `defaultValue={drill.x}`
 * so the screen LOOKS correct, but the question is what gets submitted when a
 * coach opens a drill and hits Save without changing anything.
 */

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111';
const DRILL_ID = '22222222-2222-2222-2222-222222222222';

const REAL_DRILL: Drill = {
  id: DRILL_ID,
  academyId: ACADEMY_ID,
  name: 'Yorker practice',
  category: 'bowling',
  description: 'Six balls at the base of off stump.',
  durationMinutes: 45,
  difficulty: 'advanced',
  createdBy: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mutateAsync = vi.fn().mockResolvedValue(REAL_DRILL);
const pushToast = vi.fn();

// Mutable so the mocked hook can report "still loading" on first render and
// "loaded" after — mirrors a real query resolving after mount, which is
// exactly the sequence that breaks defaultValues captured only once.
let drillsQueryState: {
  data: Drill[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

vi.mock('../hooks/useDrills', () => ({
  useDrills: () => drillsQueryState,
  useUpdateDrill: () => ({ mutateAsync }),
}));

vi.mock('@/features/academies', () => ({
  useActiveAcademy: () => ({ academyId: ACADEMY_ID }),
}));

vi.mock('@/lib/rbac', () => ({
  useCan: () => true,
}));

vi.mock('@/stores', () => ({
  useUiStore: (selector: (state: { pushToast: typeof pushToast }) => unknown) =>
    selector({ pushToast }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/drills/${DRILL_ID}`]}>
      <Routes>
        <Route path="/drills/:drillId" element={<DrillDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DrillDetailPage — editing a drill whose data arrives after mount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    drillsQueryState = {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it('keeps every untouched field intact when only one field is edited and saved', async () => {
    const { rerender } = renderPage();

    // First render: query still pending, exactly like a fresh page load.
    expect(screen.getByText(/loading drill details/i)).toBeInTheDocument();

    // The query resolves; the component re-renders with real data.
    drillsQueryState = {
      data: [REAL_DRILL],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    rerender(
      <MemoryRouter initialEntries={[`/drills/${DRILL_ID}`]}>
        <Routes>
          <Route path="/drills/:drillId" element={<DrillDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Sanity: the screen shows the real values, robust to the effect that
    // seeds them running asynchronously after mount.
    expect(await screen.findByDisplayValue('Yorker practice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Six balls at the base of off stump.')).toBeInTheDocument();

    // Edit ONE field only — this is the real-world shape of the bug: a coach
    // doesn't retype every field, they change the one thing that needs
    // changing. Everything else must survive untouched.
    const durationInput = screen.getByDisplayValue('45');
    fireEvent.change(durationInput, { target: { value: '60' } });

    const saveButton = await screen.findByRole('button', { name: /save changes/i });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    // The bug: everything but durationMinutes would come back as the
    // async-empty snapshot from the very first render — { name: '',
    // category: 'batting', description: null, difficulty: 'beginner' } —
    // silently wiping the real drill the moment any single field was edited.
    expect(mutateAsync).toHaveBeenCalledWith({
      drillId: DRILL_ID,
      input: {
        academyId: ACADEMY_ID,
        name: 'Yorker practice',
        category: 'bowling',
        description: 'Six balls at the base of off stump.',
        durationMinutes: 60,
        difficulty: 'advanced',
      },
    });
  });
});
