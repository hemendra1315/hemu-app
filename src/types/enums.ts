/** Mirrors the Postgres enums defined in docs/DB-SCHEMA.sql. */
export const APP_ROLES = ['super_admin', 'academy_owner', 'coach', 'player', 'parent'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const MEMBER_STATUSES = ['pending', 'active', 'suspended', 'rejected', 'left'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const JOIN_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type JoinStatus = (typeof JOIN_STATUSES)[number];

/**
 * Mirrors the `attendance_status` Postgres enum (migration 0009), which has
 * exactly these two values. Do not add members here without a matching
 * `ALTER TYPE attendance_status ADD VALUE` migration — the insert would be
 * rejected by the database at runtime.
 */
export const ATTENDANCE_STATUSES = ['present', 'absent'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const DRILL_CATEGORIES = ['batting', 'bowling', 'fielding', 'fitness'] as const;
export type DrillCategory = (typeof DRILL_CATEGORIES)[number];

export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced', 'elite'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const DRILL_ASSIGNMENT_STATUSES = ['assigned', 'completed'] as const;
export type DrillAssignmentStatus = (typeof DRILL_ASSIGNMENT_STATUSES)[number];

export const FEE_MODES = ['academy_pays', 'player_pays'] as const;
export type FeeMode = (typeof FEE_MODES)[number];

export const FEE_MODE_LABELS: Record<FeeMode, string> = {
  academy_pays: 'Academy pays the platform fee',
  player_pays: 'Players pay their own monthly fee',
};

/** Roles a join code may grant; owners are created with the academy itself. */
export const JOINABLE_ROLES = ['player', 'coach'] as const;
export type JoinableRole = (typeof JOINABLE_ROLES)[number];

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  academy_owner: 'Academy Owner',
  coach: 'Coach',
  player: 'Player',
  parent: 'Parent',
};

/** Landing route per role, used by the post-login redirect. */
export const ROLE_HOME: Record<AppRole, string> = {
  super_admin: '/admin',
  academy_owner: '/dashboard',
  coach: '/coach',
  player: '/player',
  parent: '/parent/dashboard',
};

/** === MATCH MODULE ENUMS === */

export const MATCH_FORMATS = ['t20', 'odi', 'test', 't10', 'custom'] as const;
export type MatchFormat = (typeof MATCH_FORMATS)[number];

export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  t20: 'T20',
  odi: 'ODI',
  test: 'Test',
  t10: 'T10',
  custom: 'Custom',
};

export const MATCH_TYPES = ['practice', 'friendly', 'league', 'tournament'] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  practice: 'Practice',
  friendly: 'Friendly',
  league: 'League',
  tournament: 'Tournament',
};

export const MATCH_RESULTS = ['won', 'lost', 'draw', 'tie', 'no_result'] as const;
export type MatchResult = (typeof MATCH_RESULTS)[number];

export const MATCH_RESULT_LABELS: Record<MatchResult, string> = {
  won: 'Won',
  lost: 'Lost',
  draw: 'Draw',
  tie: 'Tie',
  no_result: 'No Result',
};

export const MATCH_STATUSES = ['created', 'in_progress', 'completed', 'cancelled'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  created: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const MILESTONE_TYPES = [
  'debut_match',
  'first_fifty',
  'first_century',
  'first_five_wicket_haul',
  'runs_100',
  'runs_500',
  'runs_1000',
  'wickets_50',
  'wickets_100',
  'catches_25',
] as const;
export type MilestoneType = (typeof MILESTONE_TYPES)[number];

export const MILESTONE_LABELS: Record<MilestoneType, string> = {
  debut_match: 'Debut Match',
  first_fifty: 'First Fifty',
  first_century: 'First Century',
  first_five_wicket_haul: 'First Five-Wicket Haul',
  runs_100: '100 Career Runs',
  runs_500: '500 Career Runs',
  runs_1000: '1000 Career Runs',
  wickets_50: '50 Career Wickets',
  wickets_100: '100 Career Wickets',
  catches_25: '25 Career Catches',
};

export const RECORD_TYPES = [
  'highest_team_score',
  'lowest_team_score',
  'biggest_victory',
  'highest_successful_chase',
  'highest_partnership',
  'most_runs_one_match',
  'most_wickets_one_match',
  'most_sixes',
  'most_fours',
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const RECORD_LABELS: Record<RecordType, string> = {
  highest_team_score: 'Highest Team Score',
  lowest_team_score: 'Lowest Team Score',
  biggest_victory: 'Biggest Victory',
  highest_successful_chase: 'Highest Successful Chase',
  highest_partnership: 'Highest Partnership',
  most_runs_one_match: 'Most Runs in One Match',
  most_wickets_one_match: 'Most Wickets in One Match',
  most_sixes: 'Most Sixes',
  most_fours: 'Most Fours',
};

export const AWARD_TYPES = [
  'player_of_match',
  'best_batter',
  'best_bowler',
  'best_fielder',
] as const;
export type AwardType = (typeof AWARD_TYPES)[number];

export const AWARD_LABELS: Record<AwardType, string> = {
  player_of_match: 'Player of the Match',
  best_batter: 'Best Batter',
  best_bowler: 'Best Bowler',
  best_fielder: 'Best Fielder',
};
