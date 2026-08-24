import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  return useMutation({
    mutationFn: (code: string) => redeemLinkingCode(code),
    onSuccess: () => {
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
