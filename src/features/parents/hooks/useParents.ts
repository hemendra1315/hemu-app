import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { useAcademyStore, useAuthStore } from '@/stores';
import type { UUID } from '@/types';
import {
  fetchLinkedChildren,
  fetchPlayerParents,
  fetchPlayerLinkingCodes,
  generateLinkingCode,
  redeemLinkingCode,
  revokeLinkingCode,
  revokeParentLink,
} from '../api/parentsApi';
import type { ParentRelationshipType } from '../api/parentsTypes';

export const parentKeys = {
  all: ['parents'] as const,
  children: (academyId: string) => [...parentKeys.all, 'children', academyId] as const,
  playerParents: (academyId: string, playerUserId: string) =>
    [...parentKeys.all, 'playerParents', academyId, playerUserId] as const,
  playerCodes: (academyId: string, playerUserId: string) =>
    [...parentKeys.all, 'playerCodes', academyId, playerUserId] as const,
};

export function useLinkedChildren(academyId?: UUID) {
  return useQuery({
    queryKey: parentKeys.children(academyId!),
    queryFn: () => fetchLinkedChildren(academyId!),
    enabled: !!academyId,
  });
}

export function usePlayerParents(academyId?: UUID, playerUserId?: UUID | null) {
  return useQuery({
    queryKey: parentKeys.playerParents(academyId!, playerUserId!),
    queryFn: () => fetchPlayerParents(academyId!, playerUserId!),
    enabled: !!academyId && !!playerUserId,
  });
}

export function usePlayerLinkingCodes(academyId?: UUID, playerUserId?: UUID | null) {
  return useQuery({
    queryKey: parentKeys.playerCodes(academyId!, playerUserId!),
    queryFn: () => fetchPlayerLinkingCodes(academyId!, playerUserId!),
    enabled: !!academyId && !!playerUserId,
  });
}

export function useGenerateLinkingCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      academyId,
      playerUserId,
      relationshipType,
    }: {
      academyId: UUID;
      playerUserId: UUID;
      relationshipType: ParentRelationshipType;
    }) => generateLinkingCode(academyId, playerUserId, relationshipType),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: parentKeys.playerCodes(variables.academyId, variables.playerUserId),
      });
    },
  });
}

export function useRedeemLinkingCode() {
  const queryClient = useQueryClient();
  const setActiveAcademy = useAcademyStore((state) => state.setActiveAcademy);
  const setIdentityStatus = useAuthStore((state) => state.setIdentityStatus);

  return useMutation({
    mutationFn: (code: string) => redeemLinkingCode(code),
    // redeemLinkingCode() resolves with the academy the code belongs to
    // (redeem_parent_linking_code RPC RETURNS the academy id). When this is
    // the parent's first membership in that academy, the RPC creates their
    // academy_members row server-side, but the client's `memberships` (Zustand
    // authStore) and `activeAcademyId` (persisted academyStore) have no idea
    // it exists: `useIdentity()` is a one-shot query gated on
    // `identityStatus !== 'ready'`, so it will not refetch on its own once the
    // parent is already logged in - and `activeAcademyId` is persisted to
    // localStorage, so it stays null/stale even across an app reinstall.
    // Net effect: `useActiveAcademy().academyId` stays null or points at the
    // wrong academy, `useLinkedChildren()` is disabled or queries the wrong
    // tenant, and the dashboard shows "No children linked" even though the
    // link was created correctly. Force both to catch up immediately.
    onSuccess: (academyId) => {
      setActiveAcademy(academyId);
      setIdentityStatus('loading');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.identity(useAuthStore.getState().user?.id ?? 'anonymous'),
      });
      // Invalidate children for all academies since we don't know the academyId beforehand
      void queryClient.invalidateQueries({ queryKey: parentKeys.all });
    },
  });
}

export function useRevokeLinkingCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (codeId: string) => revokeLinkingCode(codeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parentKeys.all });
    },
  });
}

export function useRevokeParentLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => revokeParentLink(linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parentKeys.all });
    },
  });
}
