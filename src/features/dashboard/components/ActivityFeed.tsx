import { Link } from 'react-router-dom';

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

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  player_joined: '👤',
  match_completed: '🏏',
  attendance_marked: '✅',
  coach_feedback: '📝',
  drill_assigned: '🎯',
  join_approved: '✓',
};

export function ActivityFeed({
  title,
  activities,
  emptyMessage = 'No recent activity',
}: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {activities.length === 0 ? (
          <p className="text-fg-muted text-sm">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="border-border-subtle flex items-start gap-3 rounded-xl border p-3"
              >
                <span className="text-xl">{ACTIVITY_ICONS[activity.type]}</span>
                <div className="flex-1">
                  <p className="text-fg text-sm">{activity.message}</p>
                  <p className="text-fg-muted text-xs">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
                {activity.href && (
                  <Link to={activity.href} className="text-fg-muted hover:text-fg text-xs">
                    View
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
