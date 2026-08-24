import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { formatDate, formatTime } from '@/lib/utils/date';

export type DashboardSession = {
  id: string;
  title: string;
  sessionDate: string;
  startAt: string;
  endAt: string;
  status?: string;
  batchName?: string | null;
  batch?: { name: string } | null;
  coach?: {
    id?: string;
    fullName?: string | null;
    email?: string;
    avatarUrl?: string | null;
  } | null;
};

type SessionRowProps = {
  session: DashboardSession;
  action?: ReactNode;
};

export function SessionRow({ session, action }: SessionRowProps) {
  const batchName = session.batch?.name ?? session.batchName ?? 'Training Session';

  const coachName = session.coach?.fullName ?? session.coach?.email ?? 'Coach not assigned';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        to={`/sessions/${session.id}`}
        className="border-border-subtle hover:border-primary/40 block min-w-0 flex-1 rounded-2xl border p-4 transition"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-fg truncate text-lg font-semibold">{session.title}</p>
            <p className="text-fg-muted text-sm">
              {batchName} · {coachName}
            </p>
          </div>

          <span className="text-fg-muted text-sm capitalize">{session.status}</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div>
            <p className="text-fg-muted text-xs tracking-wide uppercase">Date</p>
            <p className="text-fg text-sm">{formatDate(session.sessionDate)}</p>
          </div>

          <div>
            <p className="text-fg-muted text-xs tracking-wide uppercase">Time</p>
            <p className="text-fg text-sm">
              {formatTime(session.startAt)} - {formatTime(session.endAt)}
            </p>
          </div>

          <div>
            <p className="text-fg-muted text-xs tracking-wide uppercase">Coach</p>
            <p className="text-fg text-sm">{coachName}</p>
          </div>
        </div>
      </Link>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
