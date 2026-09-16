import type {
  MonthlyAttendanceReportData,
  PlayerPerformanceReportData,
  BatchScheduleReportData,
} from '../types';
import { generateCsvString } from './csvExporter';

/**
 * Formats paise into ₹ INR representation for exports (e.g. 50000 -> ₹500.00)
 */
export function formatPaiseForExport(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

/**
 * Builds CSV string for Monthly Attendance Register.
 * Columns: Player Name, 1, 2, ..., 31, Present, Total Sessions, Attendance %
 */
export function generateMonthlyAttendanceCsv(data: MonthlyAttendanceReportData): string {
  const rows: (string | number | boolean | null | undefined)[][] = [];

  // Report Header Metadata
  rows.push(['ACADEMY MONTHLY ATTENDANCE REGISTER']);
  rows.push(['Academy:', data.academyName]);
  rows.push(['Batch:', data.batchName]);
  rows.push(['Period:', `${data.year}-${String(data.month).padStart(2, '0')}`]);
  rows.push(['Batch Attendance Rate:', `${data.batchSummary.averageAttendanceRate.toFixed(1)}%`]);
  rows.push(['Total Sessions Conducted:', data.batchSummary.totalSessions]);
  rows.push(['At-Risk Players (<75%):', data.batchSummary.atRiskCount]);
  rows.push([]); // blank separator

  // Table Column Headers
  const dayHeaders: string[] = [];
  for (let d = 1; d <= data.daysInMonth; d++) {
    dayHeaders.push(String(d));
  }
  rows.push(['Player Name', ...dayHeaders, 'Present', 'Total Sessions', 'Attendance %']);

  // Table Body Rows
  for (const playerRow of data.rows) {
    const dayCells: string[] = [];
    for (let d = 1; d <= data.daysInMonth; d++) {
      const status = playerRow.attendanceByDay[d];
      if (status === 'present') dayCells.push('P');
      else if (status === 'absent') dayCells.push('A');
      else if (status === 'late') dayCells.push('L');
      else if (status === 'excused') dayCells.push('E');
      else dayCells.push('-');
    }

    rows.push([
      playerRow.playerName,
      ...dayCells,
      playerRow.presentCount,
      playerRow.totalSessions,
      `${playerRow.percentage.toFixed(1)}%`,
    ]);
  }

  return generateCsvString(rows);
}

/**
 * Builds CSV string for Player Performance Report Card.
 */
export function generatePlayerPerformanceCsv(data: PlayerPerformanceReportData): string {
  const rows: (string | number | boolean | null | undefined)[][] = [];

  // Athlete Info Header
  rows.push(['PLAYER PERFORMANCE REPORT CARD']);
  rows.push(['Academy:', data.academyName]);
  rows.push(['Player Name:', data.playerName]);
  rows.push(['Role:', data.playerRole || 'Athlete']);
  rows.push(['Batch:', data.batchName]);
  rows.push(['Date Range:', `${data.dateRange.start} to ${data.dateRange.end}`]);
  rows.push(['Matches Played:', data.matchesPlayed]);
  rows.push(['MVP Points:', data.mvp.totalPoints, 'Rank:', `#${data.mvp.rank}`]);
  rows.push([]);

  // Batting Stats Section
  rows.push(['--- BATTING STATISTICS ---']);
  rows.push(['Innings', 'Runs', 'Highest', 'Average', 'Strike Rate', '50s', '100s', '4s', '6s']);
  rows.push([
    data.batting.innings,
    data.batting.runs,
    data.batting.highestScore,
    (data.batting.average ?? 0).toFixed(2),
    (data.batting.strikeRate ?? 0).toFixed(2),
    data.batting.fifties,
    data.batting.hundreds,
    data.batting.fours,
    data.batting.sixes,
  ]);
  rows.push([]);

  // Bowling Stats Section
  rows.push(['--- BOWLING STATISTICS ---']);
  rows.push([
    'Overs',
    'Wickets',
    'Runs Conceded',
    'Maidens',
    'Best Bowling',
    'Economy',
    'Average',
    'Strike Rate',
    '3-Wicket Hauls',
    '5-Wicket Hauls',
  ]);
  rows.push([
    data.bowling.overs,
    data.bowling.wickets,
    data.bowling.runsConceded,
    data.bowling.maidens,
    data.bowling.bestBowling,
    (data.bowling.economy ?? 0).toFixed(2),
    (data.bowling.average ?? 0).toFixed(2),
    (data.bowling.strikeRate ?? 0).toFixed(2),
    data.bowling.threeWickets,
    data.bowling.fiveWickets,
  ]);
  rows.push([]);

  // Fielding Stats Section
  rows.push(['--- FIELDING STATISTICS ---']);
  rows.push(['Catches', 'Stumpings', 'Run Outs']);
  rows.push([data.fielding.catches, data.fielding.stumpings, data.fielding.runOuts]);
  rows.push([]);

  // Drill Assessments
  if (data.drills.length > 0) {
    rows.push(['--- TECHNICAL DRILL ASSESSMENTS ---']);
    rows.push(['Date', 'Drill Name', 'Category', 'Score', 'Max Score', 'Rating (1-5)']);
    for (const d of data.drills) {
      rows.push([d.date, d.drillName, d.category, d.score, d.maxScore, d.rating]);
    }
    rows.push([]);
  }

  // Awards & Recognition
  if (data.mvp.awards.length > 0) {
    rows.push(['--- MATCH AWARDS & HONORS ---']);
    rows.push(['Date', 'Award Title', 'Match']);
    for (const a of data.mvp.awards) {
      rows.push([a.matchDate, a.title, a.matchName]);
    }
    rows.push([]);
  }

  // Coach Feedback Notes
  if (data.coachNotes.length > 0) {
    rows.push(['--- COACH EVALUATION NOTES ---']);
    for (const note of data.coachNotes) {
      rows.push([note]);
    }
  }

  return generateCsvString(rows);
}

/**
 * Builds CSV string for Batch Schedule & Venue Allocation.
 */
export function generateBatchScheduleCsv(data: BatchScheduleReportData): string {
  const rows: (string | number | boolean | null | undefined)[][] = [];

  rows.push(['BATCH SCHEDULE & VENUE ALLOCATION SHEET']);
  rows.push(['Academy:', data.academyName]);
  rows.push(['Generated At:', data.generatedAt]);
  rows.push([]);

  rows.push([
    'Batch Name',
    'Age Group',
    'Venue / Ground',
    'Assigned Coaches',
    'Capacity',
    'Enrolled',
    'Utilization %',
    'Day of Week',
    'Start Time',
    'End Time',
  ]);

  for (const b of data.batches) {
    if (b.schedules.length === 0) {
      rows.push([
        b.batchName,
        b.ageGroup || '-',
        b.venueName,
        b.coachNames.join(', ') || 'Unassigned',
        b.capacity,
        b.enrolledCount,
        `${b.utilizationPercent.toFixed(0)}%`,
        'No schedule configured',
        '-',
        '-',
      ]);
    } else {
      for (const s of b.schedules) {
        rows.push([
          b.batchName,
          b.ageGroup || '-',
          b.venueName,
          b.coachNames.join(', ') || 'Unassigned',
          b.capacity,
          b.enrolledCount,
          `${b.utilizationPercent.toFixed(0)}%`,
          s.dayOfWeek,
          s.startTime,
          s.endTime,
        ]);
      }
    }
  }

  return generateCsvString(rows);
}
