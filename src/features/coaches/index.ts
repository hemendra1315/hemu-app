export {
  useCoaches,
  useCoach,
  useMyCoachId,
  useBatchCoaches,
  useUpdateCoachProfile,
  useBatchCoachAssignments,
} from './hooks/useCoaches';

export type {
  Coach,
  CoachWithBatches,
  CoachBatchAssignment,
  BatchCoachRow,
  UpdateCoachProfileInput,
} from './api/coachesTypes';
