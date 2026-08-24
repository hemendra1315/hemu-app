import { useState } from 'react';
import {
  usePlayerLinkingCodes,
  usePlayerParents,
  useGenerateLinkingCode,
  useRevokeLinkingCode,
  useRevokeParentLink,
} from '@/features/parents/hooks/useParents';
import { useCan } from '@/lib/rbac';
import { Card, CardBody, CardHeader, Button, Badge } from '@/components/ui';
import { QrCode, Trash2, Copy, Check } from 'lucide-react';
import type { UUID } from '@/types';
import type { ParentRelationshipType } from '@/features/parents/api/parentsTypes';
import { useUiStore } from '@/stores';

export function FamilyTab({
  academyId,
  playerUserId,
}: {
  academyId: UUID;
  playerUserId?: string | null;
}) {
  const { data: parents, isLoading: isLoadingParents } = usePlayerParents(academyId, playerUserId);
  const { data: codes, isLoading: isLoadingCodes } = usePlayerLinkingCodes(academyId, playerUserId);
  const generateCode = useGenerateLinkingCode();
  const revokeCode = useRevokeLinkingCode();
  const revokeLink = useRevokeParentLink();
  const canManageMembers = useCan('members:manage');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const pushToast = useUiStore((s) => s.pushToast);

  const [selectedRel, setSelectedRel] = useState<ParentRelationshipType>('father');

  const handleGenerateCode = async () => {
    if (!playerUserId) return;
    try {
      await generateCode.mutateAsync({
        academyId,
        playerUserId,
        relationshipType: selectedRel,
      });
      pushToast({ title: 'Linking code generated', variant: 'success' });
    } catch {
      pushToast({ title: 'Failed to generate code', variant: 'error' });
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    pushToast({ title: 'Code copied to clipboard', variant: 'success' });
  };

  if (!playerUserId) {
    return <p className="text-fg-muted">Player account not linked to a user yet.</p>;
  }

  if (isLoadingParents || isLoadingCodes) {
    return <p className="text-fg-muted">Loading family links...</p>;
  }

  const activeCodes = codes?.filter((c) => c.isActive && new Date(c.expiresAt) > new Date()) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Linked Parents"
          description="Family members with access to this profile"
        />
        <CardBody>
          {parents?.length === 0 ? (
            <p className="text-fg-muted">No parents linked yet.</p>
          ) : (
            <div className="space-y-3">
              {parents?.map((parent) => (
                <div
                  key={parent.id}
                  className="border-border-subtle flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <p className="text-fg font-medium capitalize">{parent.relationshipType}</p>
                    <p className="text-fg-muted text-sm">
                      Linked: {new Date(parent.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {canManageMembers && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger hover:bg-danger/10"
                      onClick={() => revokeLink.mutate(parent.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {canManageMembers && (
        <Card>
          <CardHeader
            title="Linking Codes"
            description="Generate secure codes for parents to link their accounts"
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className="text-fg mb-1.5 block text-sm font-medium">Relationship</label>
                <select
                  className="bg-surface border-border-subtle text-fg focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm shadow-2xs transition-all outline-none focus:ring-4"
                  value={selectedRel}
                  onChange={(e) => setSelectedRel(e.target.value as ParentRelationshipType)}
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <Button onClick={handleGenerateCode} disabled={generateCode.isPending}>
                <QrCode className="mr-2 h-4 w-4" />
                Generate Code
              </Button>
            </div>

            {activeCodes.length > 0 && (
              <div className="border-border-subtle mt-4 space-y-3 border-t pt-4">
                <h4 className="text-sm font-semibold">Active Codes</h4>
                {activeCodes.map((code) => (
                  <div
                    key={code.id}
                    className="border-border-subtle bg-surface-muted flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-fg font-mono text-lg font-bold tracking-widest">
                          {code.code}
                        </p>
                        <Badge tone="brand" className="capitalize">
                          {code.relationshipType}
                        </Badge>
                      </div>
                      <p className="text-fg-muted mt-1 text-xs">
                        Expires: {new Date(code.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(code.code)}>
                        {copiedCode === code.code ? (
                          <Check className="text-success h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger"
                        onClick={() => revokeCode.mutate(code.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
