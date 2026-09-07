import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import CoachesPage from '../pages/CoachesPage';
import type { Coach } from '../api/coachesTypes';

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111';

const COACHES: Coach[] = [
  {
    coachId: 'coach-1',
    academyMemberId: 'member-1',
    userId: 'user-1',
    fullName: 'Ravi Shastri',
    email: 'ravi@test.com',
    avatarUrl: null,
    bio: 'Former player, now coaching.',
    specialization: ['Batting', 'Captaincy'],
    certifications: ['Level 3'],
    experienceYears: 12,
    isActive: true,
  },
];

let coachesState: {
  data: Coach[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

vi.mock('@/features/academies', () => ({
  useActiveAcademy: () => ({ academyId: ACADEMY_ID }),
}));

vi.mock('../hooks/useCoaches', () => ({
  useCoaches: () => coachesState,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CoachesPage />
    </MemoryRouter>,
  );
}

describe('CoachesPage', () => {
  it('renders each coach with their specialties and a link to their profile', () => {
    coachesState = {
      data: COACHES,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByText('Ravi Shastri')).toBeInTheDocument();
    expect(screen.getByText('Batting')).toBeInTheDocument();
    expect(screen.getByText('12 years experience')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ravi Shastri/i })).toHaveAttribute(
      'href',
      '/coaches/coach-1',
    );
  });

  it('shows an empty state when the academy has no coaches', () => {
    coachesState = { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() };
    renderPage();

    expect(screen.getByText(/no coaches yet/i)).toBeInTheDocument();
  });
});
