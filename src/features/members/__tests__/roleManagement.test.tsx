import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MembersPage from '../pages/MembersPage';
import { ChangeRoleModal } from '../components/ChangeRoleModal';
import { useAuthStore, useTestModeStore, useAcademyStore } from '@/stores';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';
import { act } from '@testing-library/react';

const mockChangeRole = vi.fn();

vi.mock('../hooks/useMembers', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useMembers')>('../hooks/useMembers');
  return {
    ...actual,
    useAcademyMembers: () => ({
      data: [
        {
          id: 'mem-p1',
          academyId: 'academy-uuid-50',
          userId: 'u-1',
          role: 'player',
          status: 'active',
          fullName: 'Rahul Kumar',
          email: 'rahul@cricket.app',
          avatarUrl: null,
          joinedAt: '2026-01-01',
        },
      ],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    usePendingJoinRequests: () => ({ data: [], isPending: false }),
    useUpdateMember: () => ({
      changeRole: {
        mutate: mockChangeRole,
        isPending: false,
      },
      changeStatus: { mutate: vi.fn(), isPending: false },
      removeMember: { mutate: vi.fn(), isPending: false },
      approveRequest: { mutate: vi.fn(), isPending: false },
      rejectRequest: { mutate: vi.fn(), isPending: false },
    }),
  };
});

describe('Member Role Management (Coach, Player, Parent switching)', () => {
  const queryWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  beforeEach(() => {
    mockChangeRole.mockReset();
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: 'owner-uuid-50',
          email: 'owner@cricket.app',
          fullName: 'Academy Owner',
          phone: '+91 98765 43210',
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'Asia/Kolkata',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: 'mem-owner-50',
            academyId: 'academy-uuid-50',
            role: 'academy_owner',
            status: 'active',
            academyName: 'Phase 50 Cricket Academy',
            academySlug: 'phase-50-academy',
            logoUrl: null,
            city: 'Mumbai',
            timezone: 'Asia/Kolkata',
          },
        ],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy('academy-uuid-50');
    });
  });

  it('renders Role button for members on MembersPage when logged in as Owner', () => {
    render(
      <BrowserRouter>
        <MembersPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    const roleBtn = screen.getByRole('button', { name: /change role for rahul kumar/i });
    expect(roleBtn).toBeInTheDocument();

    fireEvent.click(roleBtn);
    expect(screen.getByText('Change Member Role')).toBeInTheDocument();
    expect(screen.getByText('Select New Role')).toBeInTheDocument();
  });

  it('allows owner to select Coach or Parent role and submit change', () => {
    const handleClose = vi.fn();
    render(
      <ChangeRoleModal
        open={true}
        onClose={handleClose}
        member={{
          id: 'mem-p1',
          fullName: 'Rahul Kumar',
          email: 'rahul@cricket.app',
          role: 'player',
        }}
        academyId="academy-uuid-50"
      />,
      { wrapper: queryWrapper },
    );

    expect(screen.getByText('Change Member Role')).toBeInTheDocument();
    expect(screen.getByText('Rahul Kumar')).toBeInTheDocument();

    // Select Coach option
    const coachOption = screen.getByText('Coach');
    fireEvent.click(coachOption);

    const submitBtn = screen.getByRole('button', { name: /make coach/i });
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);

    expect(mockChangeRole).toHaveBeenCalledWith(
      {
        membershipId: 'mem-p1',
        role: 'coach',
      },
      expect.any(Object),
    );
  });

  it('allows owner to select Parent role and submit change', () => {
    const handleClose = vi.fn();
    render(
      <ChangeRoleModal
        open={true}
        onClose={handleClose}
        member={{
          id: 'mem-p1',
          fullName: 'Rahul Kumar',
          email: 'rahul@cricket.app',
          role: 'player',
        }}
        academyId="academy-uuid-50"
      />,
      { wrapper: queryWrapper },
    );

    // Select Parent option
    const parentOption = screen.getByText('Parent');
    fireEvent.click(parentOption);

    const submitBtn = screen.getByRole('button', { name: /make parent/i });
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);

    expect(mockChangeRole).toHaveBeenCalledWith(
      {
        membershipId: 'mem-p1',
        role: 'parent',
      },
      expect.any(Object),
    );
  });
});
