import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import type {
  AcademyRecord,
  CreateMatchInput,
  Match,
  MatchAwards,
  MatchBatting,
  MatchBowling,
  MatchCoachNote,
  MatchFielding,
  MatchLineup,
  MatchPartnership,
  PlayerMilestone,
  PlayerStatistics,
  SaveMatchResultPayload,
  UpdateMatchInput,
} from '../api/matchesTypes';
import {
  createMatch,
  deleteMatch,
  fetchAcademyMatches,
  fetchMatch,
  fetchMatchAwards,
  fetchMatchBatting,
  fetchMatchBowling,
  fetchMatchCoachNotes,
  fetchMatchFielding,
  fetchMatchLineups,
  fetchMatchPartnerships,
  fetchAcademyRecords,
  fetchPlayerMilestones,
  fetchPlayerStatistics,
  fetchPlayerStatisticsById,
  refreshAcademyRecords,
  saveMatchCoachNote,
  saveMatchResult,
  updateMatch,
} from '../api/matchesApi';

// ============================================================
// MATCH CRUD
// ============================================================

export function useAcademyMatches(academyId: UUID | null) {
  return useQuery<Match[]>({
    queryKey: queryKeys.academy.matches(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchAcademyMatches(academyId as UUID),
  });
}

export function useMatch(matchId: UUID | null, academyId: UUID | null) {
  return useQuery<Match>({
    queryKey: queryKeys.academy.match(academyId ?? 'none', matchId ?? 'none'),
    enabled:
      Boolean(matchId) && Boolean(academyId) && isUUID(matchId ?? '') && isUUID(academyId ?? ''),
    queryFn: () => fetchMatch(matchId as UUID),
  });
}

export function useCreateMatch(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMatchInput) => createMatch(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.matches(academyId) }),
  });
}

export function useUpdateMatch(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, input }: { matchId: UUID; input: UpdateMatchInput }) =>
      updateMatch(matchId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.matches(academyId) }),
  });
}

export function useDeleteMatch(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId }: { matchId: UUID }) => deleteMatch(matchId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.matches(academyId) }),
  });
}

// ============================================================
// MATCH DETAIL DATA
// ============================================================

export function useMatchLineups(matchId: UUID | null) {
  return useQuery<MatchLineup[]>({
    queryKey: queryKeys.academy.matchLineups(matchId ?? 'none'),
    enabled: Boolean(matchId) && isUUID(matchId ?? ''),
    queryFn: () => fetchMatchLineups(matchId as UUID),
  });
}

export function useMatchBatting(matchId: UUID | null) {
  return useQuery<MatchBatting[]>({
    queryKey: queryKeys.academy.matchBatting(matchId ?? 'none'),
    enabled: Boolean(matchId) && isUUID(matchId ?? ''),
    queryFn: () => fetchMatchBatting(matchId as UUID),
  });
}

export function useMatchBowling(matchId: UUID | null) {
  return useQuery<MatchBowling[]>({
    queryKey: queryKeys.academy.matchBowling(matchId ?? 'none'),
    enabled: Boolean(matchId) && isUUID(matchId ?? ''),
    queryFn: () => fetchMatchBowling(matchId as UUID),
  });
}

export function useMatchFielding(matchId: UUID | null) {
  return useQuery<MatchFielding[]>({
    queryKey: queryKeys.academy.matchFielding(matchId ?? 'none'),
    enabled: Boolean(matchId) && isUUID(matchId ?? ''),
    queryFn: () => fetchMatchFielding(matchId as UUID),
  });
}

export function useMatchPartnerships(matchId: UUID | null) {
  return useQuery<MatchPartnership[]>({
    queryKey: queryKeys.academy.matchPartnerships(matchId ?? 'none'),
    enabled: Boolean(matchId) && isUUID(matchId ?? ''),
    queryFn: () => fetchMatchPartnerships(matchId as UUID),
  });
}

export function useMatchAwards(matchId: UUID | null) {
  return useQuery<MatchAwards | null>({
    queryKey: queryKeys.academy.matchAwards(matchId ?? 'none'),
    enabled: Boolean(matchId) && isUUID(matchId ?? ''),
    queryFn: () => fetchMatchAwards(matchId as UUID),
  });
}

export function useMatchCoachNotes(matchId: UUID | null) {
  return useQuery<MatchCoachNote[]>({
    queryKey: queryKeys.academy.matchCoachNotes(matchId ?? 'none'),
    enabled: Boolean(matchId) && isUUID(matchId ?? ''),
    queryFn: () => fetchMatchCoachNotes(matchId as UUID),
  });
}

/** Upserts (or, on a blank note, deletes) one player's coach note for a match. */
export function useSaveMatchCoachNote(matchId: UUID, academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ academyMemberId, notes }: { academyMemberId: UUID; notes: string }) =>
      saveMatchCoachNote(matchId, academyId, academyMemberId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.matchCoachNotes(matchId) });
    },
  });
}

export function useSaveMatchResult(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveMatchResultPayload) => saveMatchResult(academyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.all });
    },
  });
}

// ============================================================
// STATISTICS
// ============================================================

export function usePlayerStatistics(academyId: UUID | null) {
  return useQuery<PlayerStatistics[]>({
    queryKey: queryKeys.academy.playerStatistics(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchPlayerStatistics(academyId as UUID),
  });
}

export function usePlayerStatisticsById(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerStatistics | null>({
    queryKey: queryKeys.academy.playerStatisticsById(academyId ?? 'none', playerId ?? 'none'),
    enabled: Boolean(academyId) && Boolean(playerId),
    queryFn: () => fetchPlayerStatisticsById(academyId as UUID, playerId as UUID),
  });
}

export function usePlayerMilestones(academyId: UUID | null) {
  return useQuery<PlayerMilestone[]>({
    queryKey: queryKeys.academy.playerMilestones(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchPlayerMilestones(academyId as UUID),
  });
}

export function useAcademyRecords(academyId: UUID | null) {
  return useQuery<AcademyRecord[]>({
    queryKey: queryKeys.academy.academyRecords(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchAcademyRecords(academyId as UUID),
  });
}

export function useRefreshAcademyRecords(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => refreshAcademyRecords(academyId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.academyRecords(academyId) }),
  });
}
