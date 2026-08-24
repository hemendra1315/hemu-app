import type { AppRole, MemberStatus, UUID } from '@/types';

export type Batch = {
  id: UUID;
  academyId: UUID;
  name: string;
  ageGroup: string;
  description: string | null;
  trainingDays: string | null;
  trainingTime: string | null;
  coachId: UUID | null;
  coach: {
    id: UUID | null;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  playerCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BatchPlayer = {
  id: UUID;
  batchId: UUID;
  academyMemberId: UUID;
  joinedAt: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: AppRole | null;
  status: MemberStatus | null;
};

export type CreateBatchInput = {
  academyId: UUID;
  name: string;
  ageGroup: string;
  description?: string | null;
  trainingDays?: string | null;
  trainingTime?: string | null;
  coachId?: UUID | null;
  startTime?: string;
  endTime?: string;
};

export type UpdateBatchInput = Omit<CreateBatchInput, 'academyId'>;
