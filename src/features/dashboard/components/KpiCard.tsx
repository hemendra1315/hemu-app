import { Card, CardBody } from '@/components/ui';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  href?: string;
}

export function KpiCard({ title, value, icon, trend, href }: KpiCardProps) {
  const content = (
    <Card className="hover:border-primary/40 h-full transition-all duration-200 hover:shadow-xs">
      <CardBody className="flex h-full flex-col justify-between space-y-3 p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase md:text-xs">
            {title}
          </p>
          {icon && <div className="text-primary/70 shrink-0">{icon}</div>}
        </div>
        <div className="space-y-1">
          <p className="text-fg text-2xl font-bold tracking-tight md:text-3xl">{value}</p>
          {trend && (
            <p
              className={`text-xs font-medium ${trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            >
              {trend.positive ? '↑ ' : '↓ '}
              {trend.value} {trend.label}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block transition-opacity hover:opacity-80">
        {content}
      </a>
    );
  }

  return content;
}
