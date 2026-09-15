import { Link } from 'react-router-dom';
import {
  UserPlus,
  Trophy,
  CheckCircle2,
  FileText,
  Target,
  ShieldCheck,
  Activity,
} from 'lucide-react';

import { Card, CardBody, CardHeader } from '@/components/ui';
import type { UUID } from '@/types';

export type ActivityType =
  | 'player_joined'
  | 'match_completed'
  | 'attendance_marked'
  | 'coach_feedback'
  | 'drill_assigned'
  | 'join_approved';

export interface ActivityItem {
  id: UUID;
  type: ActivityType;
  message: string;
  timestamp: string;
  href?: string;
}

interface ActivityFeedProps {
  title: string;
  activities: ActivityItem[];
  emptyMessage?: string;
}

const ACTIVITY_ICON_COMPONENTS: Record<
  ActivityType,
  { icon: React.ComponentType<{ className?: string }>; colorClass: string; bgClass: string }
> = {
  player_joined: {
    icon: UserPlus,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
  match_completed: {
    icon: Trophy,
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
  },
  attendance_marked: {
    icon: CheckCircle2,
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
  },
  coach_feedback: {
    icon: FileText,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
  },
  drill_assigned: {
    icon: Target,
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-500/10',
  },
  join_approved: {
    icon: ShieldCheck,
    colorClass: 'text-teal-500',
    bgClass: 'bg-teal-500/10',
  },
};

export function ActivityFeed({
  title,
  activities,
  emptyMessage = 'No recent activity',
}: ActivityFeedProps) {
  return (
    <Card className="border-border-subtle bg-surface shadow-2xs">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <Activity className="text-primary h-4 w-4 shrink-0" />
            <span>{title}</span>
          </div>
        }
      />
      <CardBody className="pt-0">
        {activities.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-fg-muted text-xs font-medium">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-border-subtle/50 divide-y">
            {activities.map((activity) => {
              const meta = ACTIVITY_ICON_COMPONENTS[activity.type] ?? {
                icon: Activity,
                colorClass: 'text-fg-muted',
                bgClass: 'bg-surface-muted',
              };
              const IconComponent = meta.icon;

              return (
                <div
                  key={activity.id}
                  className="hover:bg-surface-muted/30 flex items-start gap-3 py-3 transition-colors first:pt-0 last:pb-0"
                >
                  <div className={`mt-0.5 shrink-0 rounded-lg p-2 ${meta.bgClass}`}>
                    <IconComponent className={`h-4 w-4 ${meta.colorClass}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg text-sm leading-snug font-medium">{activity.message}</p>
                    <p className="text-fg-muted mt-0.5 text-xs">
                      {new Date(activity.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {activity.href && (
                    <Link
                      to={activity.href}
                      className="text-primary shrink-0 self-center text-xs font-bold hover:underline"
                    >
                      View
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
