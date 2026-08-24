import type { UUID } from '@/types';
import type { PlayerProfile } from '@/features/players/api/playersTypes';

export type ParentRelationshipType = 'father' | 'mother' | 'guardian' | 'other';

export type ParentPlayerLink = {
  id: UUID;
  parentUserId: UUID;
  playerUserId: UUID;
  academyId: UUID;
  relationshipType: ParentRelationshipType;
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
};

export type ParentLinkingCode = {
  id: UUID;
  academyId: UUID;
  playerUserId: UUID;
  code: string;
  relationshipType: ParentRelationshipType;
  expiresAt: string;
  isActive: boolean;
  createdBy: UUID | null;
  createdAt: string;
};

// Represents a linked child as seen by the parent dashboard
export type LinkedChild = {
  linkId: UUID;
  relationshipType: ParentRelationshipType;
  player: PlayerProfile;
};
