import { describe, it, expect } from 'vitest';
import {
  generateMonthlyAttendanceCsv,
  generatePlayerPerformanceCsv,
  generateFeeDuesCsv,
  generateBatchScheduleCsv,
  formatPaiseForExport,
} from '../utils/reportGenerators';
import type {
  MonthlyAttendanceReportData,
  PlayerPerformanceReportData,
  FeeDuesReportData,
  BatchScheduleReportData,
} from '../types';
import type { UUID } from '@/types';

describe('Report CSV Generators', () => {
  describe('formatPaiseForExport', () => {
    it('converts paise to formatted INR string', () => {
      expect(formatPaiseForExport(50000)).toBe('₹500.00');
      expect(formatPaiseForExport(600000)).toBe('₹6000.00');
      expect(formatPaiseForExport(0)).toBe('₹0.00');
    });
  });

  describe('generateMonthlyAttendanceCsv', () => {
    it('builds full 31-day presence register CSV with summary metadata', () => {
      const mockData: MonthlyAttendanceReportData = {
        academyName: 'Apex Cricket Academy',
        batchId: 'b1' as UUID,
        batchName: 'Elite Junior Squad',
        year: 2026,
        month: 8,
        daysInMonth: 31,
        sessions: [
          { sessionId: 's1' as UUID, date: '2026-08-01', day: 1, title: 'Morning Drills' },
          { sessionId: 's2' as UUID, date: '2026-08-03', day: 3, title: 'Match Practice' },
        ],
        rows: [
          {
            playerId: 'p1' as UUID,
            playerName: 'Rohit Sharma',
            attendanceByDay: { 1: 'present', 3: 'present' },
            presentCount: 2,
            totalSessions: 2,
            percentage: 100,
          },
          {
            playerId: 'p2' as UUID,
            playerName: 'Shubman Gill',
            attendanceByDay: { 1: 'late', 3: 'absent' },
            presentCount: 1,
            totalSessions: 2,
            percentage: 50,
          },
        ],
        batchSummary: {
          totalSessions: 2,
          averageAttendanceRate: 75.0,
          atRiskCount: 1,
        },
      };

      const csv = generateMonthlyAttendanceCsv(mockData);

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('ACADEMY MONTHLY ATTENDANCE REGISTER');
      expect(csv).toContain('Apex Cricket Academy');
      expect(csv).toContain('Elite Junior Squad');
      expect(csv).toContain('Rohit Sharma');
      expect(csv).toContain('Shubman Gill');
      expect(csv).toContain('100.0%');
      expect(csv).toContain('50.0%');
    });
  });

  describe('generatePlayerPerformanceCsv', () => {
    it('builds structured player report card CSV with batting, bowling, drills and awards', () => {
      const mockData: PlayerPerformanceReportData = {
        academyName: 'Apex Cricket Academy',
        playerId: 'p1' as UUID,
        playerName: 'Virat Kohli',
        playerRole: 'Top-order Batter',
        avatarUrl: null,
        batchName: 'Senior Squad',
        dateRange: { start: '2026-01-01', end: '2026-08-31' },
        matchesPlayed: 10,
        batting: {
          innings: 10,
          runs: 540,
          highestScore: '112*',
          average: 67.5,
          strikeRate: 142.1,
          fifties: 3,
          hundreds: 1,
          fours: 48,
          sixes: 16,
        },
        bowling: {
          overs: '8.0',
          wickets: 4,
          runsConceded: 56,
          maidens: 0,
          bestBowling: '2/18',
          economy: 7.0,
          average: 14.0,
          strikeRate: 12.0,
          threeWickets: 0,
          fiveWickets: 0,
        },
        fielding: {
          catches: 8,
          stumpings: 0,
          runOuts: 2,
        },
        mvp: {
          totalPoints: 850,
          rank: 1,
          awards: [
            {
              title: 'Player of the Match',
              matchName: 'Championship Final',
              matchDate: '2026-08-15',
            },
          ],
        },
        drills: [
          {
            drillName: 'Cover Drive Masterclass',
            category: 'Batting',
            score: 95,
            maxScore: 100,
            rating: 5,
            date: '2026-08-10',
          },
        ],
        coachNotes: ['Superb fitness and match temperament.'],
      };

      const csv = generatePlayerPerformanceCsv(mockData);

      expect(csv).toContain('PLAYER PERFORMANCE REPORT CARD');
      expect(csv).toContain('Virat Kohli');
      expect(csv).toContain('Top-order Batter');
      expect(csv).toContain('540');
      expect(csv).toContain('112*');
      expect(csv).toContain('Player of the Match');
      expect(csv).toContain('Cover Drive Masterclass');
      expect(csv).toContain('Superb fitness and match temperament.');
    });
  });

  describe('generateFeeDuesCsv', () => {
    it('builds fee summary and student dues ledger CSV', () => {
      const mockData: FeeDuesReportData = {
        academyName: 'Apex Cricket Academy',
        generatedAt: '2026-08-20 10:00:00',
        totalReceivablePaise: 1200000,
        totalCollectedPaise: 800000,
        totalOverduePaise: 400000,
        collectionRatePercent: 66.7,
        records: [
          {
            playerId: 'p1' as UUID,
            playerName: 'Rahul Dravid',
            batchName: 'Junior A',
            planName: 'Quarterly',
            amountDuePaise: 600000,
            amountPaidPaise: 600000,
            balanceDuePaise: 0,
            status: 'paid',
            dueDate: '2026-08-01',
            lastPaymentDate: '2026-07-28',
          },
          {
            playerId: 'p2' as UUID,
            playerName: 'VVS Laxman',
            batchName: 'Junior A',
            planName: 'Quarterly',
            amountDuePaise: 600000,
            amountPaidPaise: 200000,
            balanceDuePaise: 400000,
            status: 'overdue',
            dueDate: '2026-08-01',
          },
        ],
      };

      const csv = generateFeeDuesCsv(mockData);

      expect(csv).toContain('FEE COLLECTION & DUES SUMMARY');
      expect(csv).toContain('₹12000.00');
      expect(csv).toContain('₹8000.00');
      expect(csv).toContain('₹4000.00');
      expect(csv).toContain('Rahul Dravid');
      expect(csv).toContain('PAID');
      expect(csv).toContain('OVERDUE');
    });
  });

  describe('generateBatchScheduleCsv', () => {
    it('builds batch schedule and venue allocation sheets CSV', () => {
      const mockData: BatchScheduleReportData = {
        academyName: 'Apex Cricket Academy',
        generatedAt: '2026-08-20 10:00:00',
        batches: [
          {
            batchId: 'b1' as UUID,
            batchName: 'Morning Elite Cohort',
            ageGroup: 'U-19',
            venueName: 'Main Turf Oval',
            coachNames: ['Gautam Gambhir'],
            capacity: 25,
            enrolledCount: 22,
            utilizationPercent: 88,
            schedules: [
              { dayOfWeek: 'Mon', startTime: '06:00', endTime: '08:30' },
              { dayOfWeek: 'Wed', startTime: '06:00', endTime: '08:30' },
            ],
          },
        ],
      };

      const csv = generateBatchScheduleCsv(mockData);

      expect(csv).toContain('BATCH SCHEDULE & VENUE ALLOCATION SHEET');
      expect(csv).toContain('Morning Elite Cohort');
      expect(csv).toContain('Main Turf Oval');
      expect(csv).toContain('Gautam Gambhir');
      expect(csv).toContain('88%');
      expect(csv).toContain('06:00');
    });
  });
});
