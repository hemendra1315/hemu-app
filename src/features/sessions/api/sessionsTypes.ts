import type { UUID } from '@/types';

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export type TrainingSession = {
  id: UUID;
  academyId: UUID;
  batchId: UUID;
  title: string;
  focusArea: string | null;
  sessionDate: string;
  startAt: string;
  endAt: string;
  coachId: UUID;
  status: SessionStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  batch: {
    id: UUID;
    name: string;
  };
  coach: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type CreateTrainingSessionInput = {
  academyId: UUID;
  batchId: UUID;
  title: string;
  focusArea: string | null;
  sessionDate: string;
  startAt: string;
  endAt: string;
  coachId: UUID;
  status: SessionStatus;
  notes: string | null;
};

export type UpdateTrainingSessionInput = Omit<CreateTrainingSessionInput, 'academyId'>;
