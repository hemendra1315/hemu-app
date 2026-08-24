import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import {
  HomeRedirect,
  RequireAcademy,
  RequireAuth,
  RequireProfileOnboarding,
  RequireRole,
} from './guards';
import { AppShell, AuthLayout, OnboardingLayout, PrintLayout } from './layouts';

/** Route-level code splitting keeps the initial bundle small. */
const SignInPage = lazy(() => import('@/features/auth/pages/SignInPage'));
const AuthCallbackPage = lazy(() => import('@/features/auth/pages/AuthCallbackPage'));
const ProfilePage = lazy(() => import('@/features/auth/pages/ProfilePage'));
const ProfileOnboardingPage = lazy(
  () => import('@/features/onboarding/pages/ProfileOnboardingPage'),
);
const OwnerInvitationPage = lazy(() => import('@/features/onboarding/pages/OwnerInvitationPage'));
const OnboardingStartPage = lazy(() => import('@/features/onboarding/pages/OnboardingStartPage'));
const CreateAcademyPage = lazy(() => import('@/features/onboarding/pages/CreateAcademyPage'));
const JoinAcademyPage = lazy(() => import('@/features/onboarding/pages/JoinAcademyPage'));
const PendingApprovalPage = lazy(() => import('@/features/onboarding/pages/PendingApprovalPage'));
const SelectAcademyPage = lazy(() => import('@/features/onboarding/pages/SelectAcademyPage'));
const MembersPage = lazy(() => import('@/features/members/pages/MembersPage'));
const PlayerProfilePage = lazy(() => import('@/features/players/pages/PlayerProfilePage'));
const BatchesPage = lazy(() => import('@/features/batches/pages/BatchesPage'));
const BatchDetailPage = lazy(() => import('@/features/batches/pages/BatchDetailPage'));
const MatchesPage = lazy(() => import('@/features/matches/pages/MatchesPage'));
const AddMatchPage = lazy(() => import('@/features/matches/pages/AddMatchPage'));
const MatchDetailPage = lazy(() => import('@/features/matches/pages/MatchDetailPage'));
const MorePage = lazy(() => import('@/pages/MorePage').then((m) => ({ default: m.MorePage })));
const TrainingSessionsPage = lazy(() => import('@/features/sessions/pages/TrainingSessionsPage'));
const TrainingSessionDetailPage = lazy(
  () => import('@/features/sessions/pages/TrainingSessionDetailPage'),
);
const AttendanceSessionPage = lazy(
  () => import('@/features/attendance/pages/AttendanceSessionPage'),
);
const AttendanceOverviewPage = lazy(
  () => import('@/features/attendance/pages/AttendanceOverviewPage'),
);
const PlayerAttendancePage = lazy(() => import('@/features/attendance/pages/PlayerAttendancePage'));
const BatchAttendancePage = lazy(() => import('@/features/attendance/pages/BatchAttendancePage'));
const OwnerDashboardPage = lazy(() => import('@/features/dashboard/pages/OwnerDashboardPage'));
const CoachDashboardPage = lazy(() => import('@/features/dashboard/pages/CoachDashboardPage'));
const PlayerDashboardPage = lazy(() => import('@/features/dashboard/pages/PlayerDashboardPage'));
const ParentDashboardPage = lazy(() => import('@/features/parents/pages/ParentDashboardPage'));
const ParentLinkPlayerPage = lazy(() => import('@/features/parents/pages/ParentLinkPlayerPage'));
const PlatformDashboardPage = lazy(() => import('@/features/admin/pages/PlatformDashboardPage'));
const DrillsPage = lazy(() => import('@/features/drills/pages/DrillsPage'));
const DrillDetailPage = lazy(() => import('@/features/drills/pages/DrillDetailPage'));
const StatsPage = lazy(() => import('@/features/stats/pages/StatsPage'));
const AcademySettingsPage = lazy(() => import('@/features/academies/pages/AcademySettingsPage'));
const NotificationsPage = lazy(() =>
  import('@/features/notifications/pages/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const AnnouncementsPage = lazy(() =>
  import('@/features/notifications/pages/AnnouncementsPage').then((m) => ({
    default: m.AnnouncementsPage,
  })),
);
const CreateAnnouncementPage = lazy(() =>
  import('@/features/notifications/pages/CreateAnnouncementPage').then((m) => ({
    default: m.CreateAnnouncementPage,
  })),
);
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/**
 * Route tree. Guards compose as layout routes:
 * RequireAuth → RequireAcademy → RequireRole → page.
 *
 * Onboarding routes sit inside RequireAuth but outside RequireAcademy, since
 * that is exactly where users without a membership need to go.
 */
export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/signin', element: <Navigate to="/sign-in" replace /> },
      { path: '/login', element: <Navigate to="/sign-in" replace /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
    ],
  },
  {
    element: <OnboardingLayout />,
    children: [
      { path: '/academy/invite/:token', element: <OwnerInvitationPage /> },
      { path: '/invite/:token', element: <OwnerInvitationPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        element: <OnboardingLayout />,
        children: [
          { path: '/onboarding/profile', element: <ProfileOnboardingPage /> },
          {
            element: <RequireProfileOnboarding />,
            children: [
              { path: '/onboarding', element: <OnboardingStartPage /> },
              {
                element: <RequireRole allow={['super_admin']} />,
                children: [{ path: '/onboarding/create-academy', element: <CreateAcademyPage /> }],
              },
              { path: '/onboarding/join-academy', element: <JoinAcademyPage /> },
              { path: '/onboarding/pending', element: <PendingApprovalPage /> },
              { path: '/onboarding/select-academy', element: <SelectAcademyPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireProfileOnboarding />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/forbidden', element: <ForbiddenPage /> },
              { path: '/profile', element: <ProfilePage /> },
              {
                // Platform administration is not academy-scoped.
                element: <RequireRole allow={['super_admin']} />,
                children: [{ path: '/admin', element: <PlatformDashboardPage /> }],
              },
              {
                element: <RequireAcademy />,
                children: [
                  {
                    element: <RequireRole allow={['academy_owner', 'super_admin']} />,
                    children: [
                      { path: '/dashboard', element: <OwnerDashboardPage /> },
                      { path: '/owner', element: <OwnerDashboardPage /> },
                      { path: '/settings', element: <AcademySettingsPage /> },
                      { path: '/settings/academy', element: <AcademySettingsPage /> },
                    ],
                  },
                  {
                    element: <RequireRole allow={['coach', 'academy_owner', 'super_admin']} />,
                    children: [
                      { path: '/coach', element: <CoachDashboardPage /> },
                      { path: '/announcements/new', element: <CreateAnnouncementPage /> },
                    ],
                  },
                  {
                    element: <RequireRole allow={['player', 'super_admin']} />,
                    children: [
                      { path: '/me', element: <PlayerDashboardPage /> },
                      { path: '/player', element: <PlayerDashboardPage /> },
                    ],
                  },
                  {
                    element: <RequireRole allow={['parent', 'super_admin']} />,
                    children: [
                      { path: '/parent/dashboard', element: <ParentDashboardPage /> },
                      { path: '/parent/link-player', element: <ParentLinkPlayerPage /> },
                      { path: '/parent/child/:memberId', element: <PlayerProfilePage /> },
                      { path: '/parent/notifications', element: <NotificationsPage /> },
                      { path: '/parent/profile', element: <ProfilePage /> },
                    ],
                  },
                  {
                    element: (
                      <RequireRole
                        allow={['player', 'coach', 'academy_owner', 'super_admin', 'parent']}
                      />
                    ),
                    children: [
                      { path: '/notifications', element: <NotificationsPage /> },
                      { path: '/announcements', element: <AnnouncementsPage /> },
                      { path: '/more', element: <MorePage /> },
                      { path: '/stats', element: <StatsPage /> },
                      { path: '/drills', element: <DrillsPage /> },
                      { path: '/drills/:drillId', element: <DrillDetailPage /> },
                      { path: '/matches', element: <MatchesPage /> },
                      { path: '/matches/:matchId', element: <MatchDetailPage /> },
                      { path: '/sessions', element: <TrainingSessionsPage /> },
                      { path: '/sessions/:sessionId', element: <TrainingSessionDetailPage /> },
                    ],
                  },
                  {
                    element: <RequireRole allow={['coach', 'academy_owner', 'super_admin']} />,
                    children: [
                      { path: '/members', element: <MembersPage /> },
                      { path: '/members/:memberId', element: <PlayerProfilePage /> },
                      { path: '/members/:memberId/attendance', element: <PlayerAttendancePage /> },
                      { path: '/batches', element: <BatchesPage /> },
                      { path: '/batches/:batchId', element: <BatchDetailPage /> },
                      { path: '/batches/:batchId/attendance', element: <BatchAttendancePage /> },
                      { path: '/attendance', element: <AttendanceOverviewPage /> },
                      { path: '/matches/new', element: <AddMatchPage /> },
                      {
                        path: '/sessions/:sessionId/attendance',
                        element: <AttendanceSessionPage />,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <PrintLayout />,
        children: [{ path: '/print/placeholder', element: <div>Report preview</div> }],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
