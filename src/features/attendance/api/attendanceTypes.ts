import type { UUID } from '@/types';
import type { AttendanceStatus } from '@/types/enums';
export type { AttendanceStatus };

export type AttendanceRecord = {
  id: UUID;
  academyId: UUID;
  sessionId: UUID;
  playerId: UUID;
  status: AttendanceStatus;
  markedBy: UUID | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionAttendanceRecord = AttendanceRecord;

export type PlayerAttendanceRecord = AttendanceRecord & {
  session: {
    id: UUID;
    title: string;
    sessionDate: string;
    startAt: string;
    endAt: string;
    status: string;
  };
};

export type BatchAttendanceSession = {
  sessionId: UUID;
  title: string;
  sessionDate: string;
  startAt: string;
  endAt: string;
  status: string;
  attendance: Array<{
    id: UUID;
    playerId: UUID;
    status: AttendanceStatus;
  }>;
};
