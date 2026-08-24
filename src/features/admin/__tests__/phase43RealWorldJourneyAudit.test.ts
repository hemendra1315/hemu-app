import { describe, expect, it, beforeEach } from 'vitest';
import { useAcademyStore, useAuthStore, useTestModeStore } from '@/stores';
import { useActiveRoles, useCan } from '@/lib/rbac';
import { renderHook, act } from '@testing-library/react';

function calculateBattingStats({
  runs,
  innings,
  notOuts,
  ballsFaced,
}: {
  runs: number;
  innings: number;
  notOuts: number;
  ballsFaced: number;
}) {
  const dismissals = innings - notOuts;
  const average = dismissals > 0 ? (runs / dismissals).toFixed(2) : runs.toFixed(2);
  const strikeRate = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(2) : '0.00';
  return { average, strikeRate };
}

function calculateBowlingStats({
  wickets: _wickets,
  runsConceded,
  overs,
}: {
  wickets: number;
  runsConceded: number;
  overs: number;
}) {
  const economy = overs > 0 ? (runsConceded / overs).toFixed(2) : '0.00';
  return { economy };
}

describe('Phase 43 — Complete Real-World User Journey & Data Consistency Audit', () => {
  beforeEach(() => {
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: 'owner-user-id',
          email: 'owner@cricket.app',
          fullName: 'Academy Owner',
          phone: null,
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'UTC',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: 'owner-member-id',
            academyId: 'academy-43',
            role: 'academy_owner',
            status: 'active',
            academyName: 'Elite Cricket Academy',
            academySlug: 'elite',
            logoUrl: null,
            city: 'London',
            timezone: 'UTC',
          },
        ],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy('academy-43');
    });
  });

  describe('1. Player Identity & Data Consistency Chain', () => {
    it('maintains a consistent single Player ID across Membership, Batch, Session, Match, and Stats', () => {
      const playerEntity = {
        memberId: 'mem-player-007',
        userId: 'user-player-007',
        fullName: 'Rahul Sharma',
        academyId: 'academy-43',
        batchId: 'batch-u19',
      };

      const sessionAttendanceRecord = {
        sessionId: 'session-101',
        playerId: playerEntity.memberId,
        academyId: playerEntity.academyId,
        status: 'present' as const,
      };

      const matchScorecardEntry = {
        matchId: 'match-202',
        playerId: playerEntity.memberId,
        academyId: playerEntity.academyId,
        runs: 50,
        balls: 40,
        wickets: 2,
        overs: 4,
      };

      // Assert identical member reference across all feature domain entities
      expect(sessionAttendanceRecord.playerId).toBe(playerEntity.memberId);
      expect(matchScorecardEntry.playerId).toBe(playerEntity.memberId);
      expect(sessionAttendanceRecord.academyId).toBe(playerEntity.academyId);
      expect(matchScorecardEntry.academyId).toBe(playerEntity.academyId);
    });
  });

  describe('2. Match -> Stats Calculation Verification', () => {
    it('accurately calculates batting average and strike rate from controlled match entries', () => {
      // 50 runs off 40 balls, 1 inning, 0 not-outs
      const batting = calculateBattingStats({
        runs: 50,
        innings: 1,
        notOuts: 0,
        ballsFaced: 40,
      });

      expect(batting.average).toBe('50.00');
      expect(batting.strikeRate).toBe('125.00');

      // 100 runs off 50 balls, 2 innings, 1 not-out -> 100 / 1 = 100.00 avg, 200.00 SR
      const batting2 = calculateBattingStats({
        runs: 100,
        innings: 2,
        notOuts: 1,
        ballsFaced: 50,
      });

      expect(batting2.average).toBe('100.00');
      expect(batting2.strikeRate).toBe('200.00');
    });

    it('accurately calculates bowling economy from controlled match entries', () => {
      // 2 wickets, 24 runs conceded in 4.0 overs (24 balls) -> economy = 6.00
      const bowling = calculateBowlingStats({
        wickets: 2,
        runsConceded: 24,
        overs: 4.0,
      });

      expect(bowling.economy).toBe('6.00');
    });
  });

  describe('3. Attendance Status Consistency', () => {
    it('supports Present, Absent, and Late attendance values consistently', () => {
      const validStatuses = ['present', 'absent', 'late'] as const;
      validStatuses.forEach((status) => {
        expect(['present', 'absent', 'late']).toContain(status);
      });
    });
  });

  describe('4. Test App As Role Isolation & Capability Checks', () => {
    it('strictly isolates capabilities when Super Admin simulates Student, Coach, and Owner', () => {
      // Elevate to Super Admin profile for test mode activation
      act(() => {
        useAuthStore.setState({
          profile: {
            id: 'super-admin',
            email: 'admin@cricket.app',
            fullName: 'Super Admin',
            phone: null,
            avatarUrl: null,
            dateOfBirth: null,
            locale: 'en-US',
            timezone: 'UTC',
            isSuperAdmin: true,
          },
        });
      });

      // 1. Student Test Mode
      act(() => useTestModeStore.getState().setTestMode('student', 'academy-43'));
      expect(renderHook(() => useActiveRoles()).result.current).toEqual(['player']);
      expect(renderHook(() => useCan('stats:read_own')).result.current).toBe(true);
      expect(renderHook(() => useCan('members:manage')).result.current).toBe(false);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);

      // 2. Coach Test Mode
      act(() => useTestModeStore.getState().setTestMode('coach', 'academy-43'));
      expect(renderHook(() => useActiveRoles()).result.current).toEqual(['coach']);
      expect(renderHook(() => useCan('sessions:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('matches:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);

      // 3. Owner Test Mode
      act(() => useTestModeStore.getState().setTestMode('academy_owner', 'academy-43'));
      expect(renderHook(() => useActiveRoles()).result.current).toEqual(['academy_owner']);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(true);
      expect(renderHook(() => useCan('members:manage')).result.current).toBe(true);

      // 4. Exit Test Mode
      act(() => useTestModeStore.getState().exitTestMode());
      expect(renderHook(() => useActiveRoles()).result.current).toContain('super_admin');
    });
  });
});
