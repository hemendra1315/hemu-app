import type { AppRole } from '@/types/enums';

/**
 * Capability map mirroring the PRD permission matrix. This is UI gating only —
 * the authoritative check is the RLS policy in Postgres.
 */
export const CAPABILITIES = [
  'academy:create',
  'academy:update',
  'academy:regenerate_join_code',
  'members:manage',
  'players:read',
  'players:manage',
  'players:approve',
  'coaches:read',
  'coaches:manage',
  'batches:read',
  'batches:manage',
  'matches:read',
  'matches:manage',
  'sessions:read',
  'sessions:manage',
  'attendance:read',
  'attendance:mark',
  'drills:read',
  'drills:manage',
  'feedback:read_own',
  'feedback:write',
  'cricheroes:manage',
  'stats:read_own',
  'stats:read_all',
  'billing:read_own',
  'billing:manage',
  'reports:export',
  'notifications:read',
  'announcements:read',
  'announcements:manage',
  'platform:manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const PLAYER: Capability[] = [
  'players:read',
  'sessions:read',
  'attendance:read',
  'drills:read',
  'matches:read',
  'feedback:read_own',
  'stats:read_own',
  'billing:read_own',
  'reports:export',
  'notifications:read',
  'announcements:read',
];

const COACH: Capability[] = [
  'players:read',
  'coaches:read',
  'batches:read',
  'matches:read',
  'matches:manage',
  'sessions:read',
  'sessions:manage',
  'attendance:read',
  'attendance:mark',
  'drills:read',
  'drills:manage',
  'feedback:read_own',
  'feedback:write',
  'stats:read_all',
  'reports:export',
  'notifications:read',
  'announcements:read',
  'announcements:manage',
];

const OWNER: Capability[] = [
  'academy:create',
  'academy:update',
  'academy:regenerate_join_code',
  'members:manage',
  'players:read',
  'players:manage',
  'players:approve',
  'coaches:read',
  'coaches:manage',
  'batches:read',
  'batches:manage',
  'matches:read',
  'matches:manage',
  'sessions:read',
  'sessions:manage',
  'attendance:read',
  'attendance:mark',
  'drills:read',
  'drills:manage',
  'feedback:read_own',
  'feedback:write',
  'cricheroes:manage',
  'stats:read_all',
  'billing:read_own',
  'billing:manage',
  'reports:export',
  'notifications:read',
  'announcements:read',
  'announcements:manage',
];

const PARENT: Capability[] = [
  'players:read',
  'sessions:read',
  'attendance:read',
  'matches:read',
  'stats:read_own',
  'notifications:read',
  'announcements:read',
];

export const ROLE_CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  player: PLAYER,
  coach: COACH,
  academy_owner: OWNER,
  super_admin: CAPABILITIES,
  parent: PARENT,
};

export function roleHasCapability(role: AppRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function hasCapability(roles: readonly AppRole[], capability: Capability): boolean {
  return roles.some((role) => roleHasCapability(role, capability));
}
