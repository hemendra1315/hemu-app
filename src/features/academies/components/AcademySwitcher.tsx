import { Check, ChevronDown, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Avatar, Button } from '@/components/ui';
import { usePlatformAcademies } from '@/features/admin/hooks/useAdmin';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores';
import { ROLE_LABELS } from '@/types/enums';

import { useActiveAcademy, useMemberships } from '../hooks/useAcademies';

/** Tenant switcher for users who belong to more than one academy or Super Admins. */
export function AcademySwitcher({ className }: { className?: string }) {
  const { active } = useMemberships();
  const { membership, academyId: activeAcademyId, switchAcademy } = useActiveAcademy();
  const isSuperAdmin = useAuthStore((state) => state.profile?.isSuperAdmin === true);
  const platformAcademiesQuery = usePlatformAcademies({ enabled: isSuperAdmin });

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const currentName = membership?.academyName ?? 'Select Academy';

  // Regular user with only one academy needs no dropdown.
  if (!isSuperAdmin && active.length < 2 && membership) {
    return (
      <div className={cn('flex min-w-0 items-center gap-2', className)}>
        <Avatar
          name={membership.academyName}
          src={membership.logoUrl}
          size="sm"
          className="shrink-0"
        />
        <span className="text-fg min-w-0 flex-1 truncate text-sm font-medium">
          {membership.academyName}
        </span>
      </div>
    );
  }

  const platformAcademies = platformAcademiesQuery.data ?? [];

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        variant="secondary"
        size="sm"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn('min-h-[38px] max-w-[140px] min-w-0 sm:max-w-none', className)}
      >
        <Avatar name={currentName} src={membership?.logoUrl} size="xs" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left sm:max-w-44">{currentName}</span>
        {isSuperAdmin && !active.some((m) => m.academyId === activeAcademyId) ? (
          <span className="hidden rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 sm:inline-block dark:text-amber-400">
            Super Admin
          </span>
        ) : null}
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
      </Button>

      {open ? (
        <div
          role="listbox"
          aria-label="Switch academy"
          className="bg-surface border-border-subtle absolute left-0 z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border shadow-xl"
        >
          {/* Member Academies */}
          {active.length > 0 ? (
            <div className="p-1">
              <p className="text-fg-muted px-2 py-1 text-[11px] font-bold tracking-wider uppercase">
                My Academies
              </p>
              {active.map((option) => {
                const selected = option.academyId === activeAcademyId;
                return (
                  <button
                    key={option.academyId}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="hover:bg-surface-muted flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm"
                    onClick={() => {
                      switchAcademy(option.academyId);
                      setOpen(false);
                    }}
                  >
                    <Avatar name={option.academyName} src={option.logoUrl} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="text-fg block truncate text-xs font-semibold">
                        {option.academyName}
                      </span>
                      <span className="text-fg-muted block text-[11px]">
                        {ROLE_LABELS[option.role]}
                      </span>
                    </span>
                    {selected ? <Check className="text-primary h-4 w-4" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Super Admin Platform-Wide Academies */}
          {isSuperAdmin && platformAcademies.length > 0 ? (
            <div className="border-border-subtle border-t p-1">
              <p className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold tracking-wider text-amber-500 uppercase">
                <ShieldCheck className="h-3.5 w-3.5" /> All Platform Academies
              </p>
              {platformAcademies.map((acad) => {
                const selected = acad.id === activeAcademyId;
                const isMember = active.some((m) => m.academyId === acad.id);
                return (
                  <button
                    key={acad.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-amber-500/10"
                    onClick={() => {
                      switchAcademy(acad.id);
                      setOpen(false);
                    }}
                  >
                    <Avatar name={acad.name} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="text-fg block truncate text-xs font-medium">
                        {acad.name}
                      </span>
                      <span className="text-fg-muted block text-[11px]">
                        {acad.city ? `${acad.city} · ` : ''}Owner: {acad.ownerName}
                        {isMember ? ' (Joined)' : ''}
                      </span>
                    </span>
                    {selected ? <Check className="h-4 w-4 text-amber-500" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
