import type { UUID } from '@/types';
import type { DrillCategory, DrillAssignmentStatus, DifficultyLevel } from '@/types/enums';

export type Drill = {
  id: UUID;
  academyId: UUID;
  name: string;
  category: DrillCategory;
  description: string | null;
  durationMinutes: number | null;
  difficulty: DifficultyLevel;
  createdBy: UUID | null;
  createdAt: string;
  updatedAt: string;
};

export type DrillAssignment = {
  id: UUID;
  academyId: UUID;
  drillId: UUID;
  drill: {
    id: UUID;
    name: string;
    category: DrillCategory;
    description: string | null;
    durationMinutes: number | null;
    difficulty: DifficultyLevel;
  };
  playerId: UUID | null;
  playerName: string | null;
  batchId: UUID | null;
  batchName: string | null;
  status: DrillAssignmentStatus;
  assignedBy: string | null;
  assignedAt: string;
  dueDate: string | null;
  createdBy: UUID | null;
  updatedAt: string;
};

export type CreateDrillInput = {
  academyId: UUID;
  name: string;
  category: DrillCategory;
  description: string | null;
  durationMinutes: number | null;
  difficulty: DifficultyLevel;
};

export type UpdateDrillInput = Omit<CreateDrillInput, 'academyId'>;

export type CreateDrillAssignmentInput = {
  academyId: UUID;
  drillId: UUID;
  playerId?: UUID | null;
  batchId?: UUID | null;
  dueDate?: string | null;
  status?: DrillAssignmentStatus;
};

export type UpdateDrillAssignmentInput = {
  status: DrillAssignmentStatus;
  dueDate?: string | null;
};
