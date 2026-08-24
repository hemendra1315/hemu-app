import { Check, Search, User, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button, Input, Modal } from '@/components/ui';
import type { AcademyMember } from '@/types';

type AddBatchPlayersModalProps = {
  open: boolean;
  onClose: () => void;
  batchName: string;
  availablePlayers: AcademyMember[];
  onAddPlayers: (academyMemberIds: string[]) => Promise<void>;
  isLoading?: boolean;
};

export function AddBatchPlayersModal({
  open,
  onClose,
  batchName,
  availablePlayers,
  onAddPlayers,
  isLoading = false,
}: AddBatchPlayersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availablePlayers;
    return availablePlayers.filter((player) => {
      const name = (player.fullName ?? '').toLowerCase();
      const email = (player.email ?? '').toLowerCase();
      const phone = (player.phone ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [availablePlayers, searchQuery]);

  const visibleIds = useMemo(() => filteredPlayers.map((player) => player.id), [filteredPlayers]);

  const isAllVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    await onAddPlayers(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign Players to ${batchName}`}
      size="lg"
      footer={
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-fg-muted flex items-center justify-between text-xs sm:text-sm">
            <span>
              <strong className="text-fg font-bold">{selectedIds.size}</strong> player
              {selectedIds.size === 1 ? '' : 's'} selected
            </span>
            {selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-primary font-medium hover:underline sm:hidden"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="secondary"
              onClick={onClose}
              className="hidden h-12 flex-1 sm:inline-flex sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={selectedIds.size === 0 || isLoading}
              isLoading={isLoading}
              className="h-12 min-h-[48px] w-full flex-1 text-base font-semibold sm:w-auto sm:flex-initial"
            >
              {selectedIds.size === 0
                ? 'Select Players'
                : `Add ${selectedIds.size} Player${selectedIds.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search & Actions Bar */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="text-fg-muted absolute top-3.5 left-3.5 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by name, email, or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 min-h-[44px] pl-10"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="text-fg-muted hover:text-fg absolute top-3.5 right-3.5"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between px-1 text-xs">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={visibleIds.length === 0}
              className="text-primary min-h-[44px] px-1 font-medium hover:underline disabled:opacity-50"
            >
              {isAllVisibleSelected ? 'Deselect All Visible' : 'Select All Visible'}
            </button>
            {selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-fg-muted hover:text-fg hidden font-medium sm:inline-block"
              >
                Clear selection ({selectedIds.size})
              </button>
            ) : null}
          </div>
        </div>

        {/* Players List */}
        {filteredPlayers.length === 0 ? (
          <div className="border-border-subtle flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
            <User className="text-fg-muted mb-2 h-8 w-8 opacity-40" />
            <p className="text-fg font-medium">No available players found</p>
            <p className="text-fg-muted mt-1 text-xs">
              {searchQuery
                ? 'Try adjusting your search criteria.'
                : 'All active players are already assigned to this batch.'}
            </p>
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {filteredPlayers.map((player) => {
              const isSelected = selectedIds.has(player.id);
              const displayName = player.fullName || player.email || 'Unnamed Player';

              return (
                <div
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      togglePlayer(player.id);
                    }
                  }}
                  className={`border-border-subtle flex min-h-[56px] cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all select-none ${
                    isSelected
                      ? 'border-primary/40 bg-primary-pale shadow-xs'
                      : 'hover:border-border hover:bg-surface-muted/30'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="bg-surface-elevated text-fg flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-fg truncate text-sm font-semibold">{displayName}</p>
                      <div className="text-fg-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="truncate">{player.email}</span>
                        {player.phone ? (
                          <>
                            <span>•</span>
                            <span>{player.phone}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-fg'
                        : 'border-border-subtle bg-surface'
                    }`}
                  >
                    {isSelected ? <Check className="h-4 w-4 stroke-[3]" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
