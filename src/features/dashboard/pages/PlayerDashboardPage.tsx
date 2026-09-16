import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Flame,
  Award,
  TrendingUp,
  Target,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

import { Card, CardBody, CardHeader, Badge, Avatar, Button } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { SuperAdminAcademyActions } from '@/features/admin';
import { usePlayerDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { useUpdateDrillAssignment } from '@/features/drills/hooks/useDrills';
import { SimpleBarChart, SimpleLineChart } from '@/components/charts/SimpleBarChart';
import { SessionRow } from '../components/SessionRow';
import { useAuth } from '@/features/auth';
import { StudentMonthlyFeeBanner } from '@/features/billing';
import { useTestModeStore } from '@/stores';
import { supabase } from '@/lib/supabase/client';
import { isUUID } from '@/lib/validators';
import { useCan } from '@/lib/rbac';
import type { UUID } from '@/types';

export default function PlayerDashboardPage() {
  const { academyId, membership } = useActiveAcademy();
  const { profile } = useAuth();
  const testModeRole = useTestModeStore((s) => s.activeRole);
  const queryClient = useQueryClient();
  const canReadOwnBilling = useCan('billing:read_own');

  const isPlayer = membership?.role === 'player' || testModeRole === 'student';

  // Query an active player ID if in Test Mode as student and membership is not a player
  const activePlayerQuery = useQuery({
    queryKey: ['active-academy-player', academyId],
    enabled: Boolean(academyId) && testModeRole === 'student' && membership?.role !== 'player',
    queryFn: async () => {
      const { data } = await supabase
        .from('academy_members')
        .select('id')
        .eq('academy_id', academyId as string)
        .eq('role', 'player')
        .eq('status', 'active')
        .limit(1);
      return data?.[0]?.id ?? null;
    },
  });

  const resolvedPlayerId =
    (membership?.role === 'player' ? membership?.id : null) ??
    (activePlayerQuery.data && isUUID(activePlayerQuery.data) ? activePlayerQuery.data : null) ??
    (membership?.id && isUUID(membership.id) ? membership.id : null);

  const playerId = resolvedPlayerId && isUUID(resolvedPlayerId) ? resolvedPlayerId : null;

  const analyticsQuery = usePlayerDashboardAnalytics(academyId, isPlayer ? playerId : null);
  const updateDrillAssignment = useUpdateDrillAssignment(academyId as UUID);

  if (!isPlayer) {
    return (
      <div className="space-y-4 pb-20 md:pb-6">
        <div>
          <h1 className="text-fg text-xl font-extrabold tracking-tight md:text-2xl">
            My Cricket Dashboard
          </h1>
          <p className="text-fg-muted text-xs font-semibold">
            {membership?.academyName ?? 'Academy'}
          </p>
        </div>
        <EmptyState
          title="Player Dashboard Reserved for Players"
          description="You are currently signed in as an Academy Owner or Coach. Switch to a registered player account to access player statistics and personal training performance."
        />
      </div>
    );
  }

  if (activePlayerQuery.isPending && !membership?.role) {
    return (
      <div className="flex min-h-[300px] items-center justify-center p-6 text-center">
        <p className="text-fg-muted text-sm font-medium">Loading player dashboard...</p>
      </div>
    );
  }

  if (analyticsQuery.isPending && playerId && !analyticsQuery.data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center p-6 text-center">
        <p className="text-fg-muted text-sm font-medium">Loading player dashboard...</p>
      </div>
    );
  }

  if (analyticsQuery.isError) {
    return (
      <ErrorState error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
    );
  }

  const analytics = analyticsQuery.data ?? {
    stats: {
      matchesPlayed: 0,
      battingRuns: 0,
      bowlingWickets: 0,
      battingAverage: '0.00',
      strikeRate: '0.00',
      economy: '0.00',
      attendancePercentage: 0,
    },
    recentMatches: [],
    upcomingSessions: [],
    pendingAssignments: [],
    completedAssignments: [],
    recentAwards: [],
    careerHighlights: [],
    runsTrend: [],
  };

  const stats = analytics.stats;

  const handleMarkDrillComplete = (assignmentId: UUID) => {
    if (!academyId) return;
    updateDrillAssignment.mutate(
      { assignmentId, input: { status: 'completed' } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: ['dashboard-player', academyId, playerId],
          });
        },
      },
    );
  };

  const studentEffectiveId = (playerId || profile?.id || 'demo_student') as string;
  const studentName = profile?.fullName || 'Student Player';
  const studentEmail = profile?.email || 'player@cam.app';
  const academyName = membership?.academyName || 'Cricket Academy';

  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden pb-20 md:pb-6">
      {/* 1. Header with Academy Branding */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <Avatar
            name={membership?.academyName}
            src={membership?.logoUrl}
            shape="rounded"
            className="border-border-subtle/80 h-12 w-12 shrink-0 border text-base shadow-xs sm:h-14 sm:w-14 sm:text-lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-fg truncate text-xl font-extrabold tracking-tight md:text-2xl">
              Player Dashboard
            </h1>
            <p className="text-fg-muted truncate text-xs font-semibold tracking-wide">
              {membership?.academyName ?? 'Academy'} · Stats & Training
            </p>
          </div>
        </div>
      </div>

      <SuperAdminAcademyActions />

      {/* Student Monthly App Fee (₹200 FamPay / UPI) Banner */}
      {canReadOwnBilling && (
        <StudentMonthlyFeeBanner
          studentId={studentEffectiveId}
          studentName={studentName}
          studentEmail={studentEmail}
          academyId={(academyId || 'academy_1') as string}
          academyName={academyName}
        />
      )}

      {/* 2. Stat Tiles (7 Core Cricket Metrics) */}
      {stats && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
          <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
            <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
              Matches
            </span>
            <p className="text-fg mt-1 font-mono text-2xl font-extrabold tracking-tight">
              {stats.matchesPlayed}
            </p>
          </div>
          <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
            <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
              Runs
            </span>
            <p className="text-fg mt-1 font-mono text-2xl font-extrabold tracking-tight">
              {stats.battingRuns}
            </p>
          </div>
          <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
            <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
              Wickets
            </span>
            <p className="text-fg mt-1 font-mono text-2xl font-extrabold tracking-tight">
              {stats.bowlingWickets}
            </p>
          </div>
          <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
            <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
              Batting Avg
            </span>
            <p className="text-fg mt-1 font-mono text-2xl font-extrabold tracking-tight">
              {stats.battingAverage}
            </p>
          </div>
          <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
            <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
              Strike Rate
            </span>
            <p className="text-fg mt-1 font-mono text-2xl font-extrabold tracking-tight">
              {stats.strikeRate}
            </p>
          </div>
          <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
            <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
              Economy
            </span>
            <p className="text-fg mt-1 font-mono text-2xl font-extrabold tracking-tight">
              {stats.economy}
            </p>
          </div>
          <div className="border-border-subtle bg-surface col-span-2 flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs sm:col-span-2 lg:col-span-1">
            <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
              Attendance
            </span>
            <p className="text-primary mt-1 font-mono text-2xl font-extrabold tracking-tight">
              {stats?.attendancePercentage ?? 0}%
            </p>
          </div>
        </div>
      )}

      {/* 3. Upcoming Training */}
      <Card className="border-border-subtle bg-surface shadow-2xs">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <CalendarDays className="text-primary h-4 w-4 shrink-0" />
              <span>Upcoming Training</span>
            </div>
          }
          description="Scheduled sessions"
        />
        <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
          {analytics.upcomingSessions?.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-fg-muted text-xs font-medium">No upcoming sessions.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {analytics.upcomingSessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 4. Recent Form (Last 5 matches) */}
      <Card className="border-border-subtle bg-surface shadow-2xs">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 shrink-0 text-amber-500" />
              <span>Recent Form</span>
            </div>
          }
          description="Recent matches"
        />
        <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
          {analytics.recentMatches?.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-fg-muted text-xs font-medium">No matches played yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {analytics.recentMatches.map((match) => (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className="border-border-subtle hover:border-primary/40 bg-surface flex min-h-[52px] flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-sm font-bold">{match.matchName}</p>
                    <div className="text-fg-muted flex items-center gap-1.5 text-xs font-medium">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(match.matchDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {match.opponentName && <span>· vs {match.opponentName}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {match.batting && (
                      <span className="border-border-subtle/80 bg-surface-muted/60 text-fg inline-flex items-center rounded-lg border px-2.5 py-1 font-mono text-xs font-bold">
                        {match.batting.runs}{' '}
                        <span className="text-fg-muted ml-0.5 font-normal">
                          ({match.batting.balls}b)
                        </span>
                      </span>
                    )}
                    {match.bowling && (
                      <span className="border-border-subtle/80 bg-surface-muted/60 text-fg inline-flex items-center rounded-lg border px-2.5 py-1 font-mono text-xs font-bold">
                        {match.bowling.wickets}/{match.bowling.runsConceded}
                      </span>
                    )}
                    {match.awards?.playerOfMatch && (
                      <Badge tone="success" className="shrink-0 text-[10px] font-bold uppercase">
                        POM
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 5. Assigned Drills & Awards Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Assigned Drills */}
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Target className="text-primary h-4 w-4 shrink-0" />
                <span>Assigned Drills</span>
              </div>
            }
            description="Pending and completed training drills"
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            {analytics.pendingAssignments?.length === 0 &&
            analytics.completedAssignments?.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-fg-muted text-xs font-medium">No drills assigned yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.pendingAssignments?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                      Pending
                    </p>
                    {analytics.pendingAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="border-border-subtle bg-surface flex min-h-[50px] items-center justify-between gap-3 rounded-xl border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-fg truncate text-sm font-bold">
                            {assignment.drill.name}
                          </p>
                          <div className="text-fg-muted mt-0.5 flex items-center gap-2 text-xs">
                            <span className="capitalize">{assignment.drill.category}</span>
                            {assignment.dueDate && (
                              <span>
                                · Due:{' '}
                                {new Date(assignment.dueDate).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 min-h-[32px] shrink-0 text-xs font-bold"
                          isLoading={updateDrillAssignment.isPending}
                          onClick={() => handleMarkDrillComplete(assignment.id as UUID)}
                        >
                          Mark Done
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {analytics.completedAssignments?.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                      Completed
                    </p>
                    {analytics.completedAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="border-border-subtle/60 bg-surface-muted/30 flex min-h-[46px] items-center justify-between gap-3 rounded-xl border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-fg truncate text-sm font-medium">
                            {assignment.drill.name}
                          </p>
                          <p className="text-fg-muted text-xs capitalize">
                            {assignment.drill.category}
                          </p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Awards */}
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 shrink-0 text-amber-500" />
                <span>Awards</span>
              </div>
            }
            description="Recent match achievements"
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            {analytics.recentAwards?.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-fg-muted text-xs font-medium">No awards yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {analytics.recentAwards.map((award) => (
                  <Link
                    key={award.id}
                    to={`/matches/${award.matchId}`}
                    className="border-border-subtle hover:border-primary/40 bg-surface flex min-h-[50px] items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-fg truncate text-sm font-bold">{award.matchName}</p>
                      <p className="text-fg-muted text-xs">
                        {award.matchDate
                          ? new Date(award.matchDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : ''}
                      </p>
                    </div>
                    <Badge tone="success" className="shrink-0 text-[10px] font-bold uppercase">
                      Award
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 6. Career Highlights */}
      {analytics.careerHighlights?.length > 0 && (
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Award className="text-primary h-4 w-4 shrink-0" />
                <span>Career Highlights</span>
              </div>
            }
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="flex flex-wrap gap-2">
              {analytics.careerHighlights.map((highlight, index: number) => (
                <span
                  key={index}
                  className="border-primary/30 bg-primary/10 text-primary inline-flex items-center rounded-lg border px-3 py-1 text-xs font-bold"
                >
                  {highlight.label}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* 7. Performance Trends */}
      {analytics.runsTrend?.length > 0 && (
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <TrendingUp className="text-primary h-4 w-4 shrink-0" />
                <span>Performance Trends</span>
              </div>
            }
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="text-fg-muted mb-2 text-xs font-bold tracking-wider uppercase">
                  Runs Trend
                </h4>
                <SimpleBarChart
                  data={analytics.runsTrend.map((m) => ({
                    label: m.matchDate
                      ? new Date(m.matchDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '',
                    value: m.runs,
                  }))}
                  height={200}
                />
              </div>
              <div>
                <h4 className="text-fg-muted mb-2 text-xs font-bold tracking-wider uppercase">
                  Attendance Trend
                </h4>
                <SimpleLineChart
                  data={[
                    { label: 'Month 1', value: 85 },
                    { label: 'Month 2', value: 78 },
                    { label: 'Month 3', value: 92 },
                    { label: 'Month 4', value: 88 },
                    { label: 'Month 5', value: 95 },
                  ]}
                  height={200}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
