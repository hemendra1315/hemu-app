import { ArrowLeft, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useCan } from '@/lib/rbac';

type MobilePageHeaderProps = {
  title: string;
  subtitle?: string;
  count?: string | number;
  primaryAction?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
  showBack?: boolean;
  showSettingsAction?: boolean;
  onBack?: () => void;
  className?: string;
};

export function MobilePageHeader({
  title,
  subtitle,
  count,
  primaryAction,
  showBack = false,
  showSettingsAction = true,
  onBack,
  className = '',
}: MobilePageHeaderProps) {
  const navigate = useNavigate();
  const canUpdateAcademy = useCan('academy:update');
  const targetSettingsRoute = canUpdateAcademy ? '/settings/academy' : '/profile';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div
      className={`from-primary via-primary/95 to-brand-800 mb-5 rounded-b-3xl bg-gradient-to-br p-5 pt-6 text-white shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-white">{title}</h1>
              {count !== undefined && (
                <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {count}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs font-medium text-white/80">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              variant="secondary"
              className="text-primary min-h-[44px] shrink-0 border-0 bg-white px-3.5 font-semibold shadow-2xs hover:bg-white/90"
            >
              {primaryAction.icon && <span className="mr-1.5">{primaryAction.icon}</span>}
              {primaryAction.label}
            </Button>
          )}
          {showSettingsAction && (
            <button
              onClick={() => navigate(targetSettingsRoute)}
              aria-label="Settings"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
