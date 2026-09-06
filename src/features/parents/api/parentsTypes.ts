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
  /** Who this link actually belongs to — needed so staff revoking access
   *  can tell two same-relationship-type parents apart. */
  parentName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
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
