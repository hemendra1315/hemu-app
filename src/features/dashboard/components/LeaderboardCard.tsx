import { Link } from 'react-router-dom';

import { Card, CardBody, CardHeader } from '@/components/ui';
import type { UUID } from '@/types';

interface LeaderboardEntry {
  id: UUID;
  name: string;
  value: string | number;
  secondaryValue?: string | number;
  href: string;
}

interface LeaderboardCardProps {
  title: string;
  entries: LeaderboardEntry[];
  secondaryLabel?: string;
  emptyMessage?: string;
}

export function LeaderboardCard({
  title,
  entries,
  secondaryLabel,
  emptyMessage = 'No data available',
}: LeaderboardCardProps) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {entries.length === 0 ? (
          <p className="text-fg-muted text-sm">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <Link
                key={entry.id}
                to={entry.href}
                className="border-border-subtle hover:border-primary/40 flex items-center justify-between rounded-xl border p-3 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-fg-muted bg-surface-muted flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-fg font-medium">{entry.name}</p>
                    {secondaryLabel && entry.secondaryValue && (
                      <p className="text-fg-muted text-xs">
                        {secondaryLabel}: {entry.secondaryValue}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-fg text-lg font-semibold">{entry.value}</span>
              </Link>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
