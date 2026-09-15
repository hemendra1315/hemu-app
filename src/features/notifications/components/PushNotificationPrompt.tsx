import { useState } from 'react';
import { Bell, BellRing, X, CheckCircle2, Send } from 'lucide-react';
import { Button, Card, CardBody } from '@/components/ui';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function PushNotificationPrompt() {
  const [dismissed, setDismissed] = useState<boolean>(false);
  const { permission, isSubscribed, isLoading, subscribe, sendTestNotification } =
    usePushNotifications();

  if (dismissed || permission === 'unsupported') {
    return null;
  }

  const isGranted = permission === 'granted' || isSubscribed;

  return (
    <Card className="border-primary/30 bg-primary/5 relative overflow-hidden rounded-2xl border shadow-xs">
      <CardBody className="p-4">
        <button
          onClick={() => setDismissed(true)}
          className="text-fg-muted hover:text-fg absolute top-3 right-3 p-1 transition-colors"
          aria-label="Dismiss notification prompt"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 pr-6 sm:pr-0">
            <div className="bg-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-black shadow-xs">
              {isGranted ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-fg text-sm font-bold">
                  {isGranted ? 'Academy Push Alerts Active' : 'Enable Real-Time Push Alerts'}
                </h3>
                {isGranted && (
                  <span className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500 uppercase">
                    <CheckCircle2 className="h-3 w-3" /> Enabled
                  </span>
                )}
              </div>
              <p className="text-fg-muted mt-0.5 text-xs">
                {isGranted
                  ? 'You are receiving real-time session reminders, match call-ups, and fee updates.'
                  : 'Get instant alerts for training schedules, squad announcements, match day line-ups, and fee dues.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {isGranted ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void sendTestNotification()}
                className="flex items-center gap-1.5 text-xs font-bold"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send Test Alert</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => void subscribe()}
                isLoading={isLoading}
                className="flex items-center gap-1.5 text-xs font-bold"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Enable Alerts</span>
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
