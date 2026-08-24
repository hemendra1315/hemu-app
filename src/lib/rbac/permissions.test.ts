import { describe, expect, it } from 'vitest';

import { CAPABILITIES, hasCapability, roleHasCapability } from './permissions';

describe('rbac capabilities', () => {
  it('gives super admins every capability', () => {
    for (const capability of CAPABILITIES) {
      expect(roleHasCapability('super_admin', capability)).toBe(true);
    }
  });

  it('does not let players manage academy data', () => {
    expect(roleHasCapability('player', 'players:manage')).toBe(false);
    expect(roleHasCapability('player', 'billing:manage')).toBe(false);
    expect(roleHasCapability('player', 'stats:read_own')).toBe(true);
  });

  it('lets coaches mark attendance but not approve players', () => {
    expect(roleHasCapability('coach', 'attendance:mark')).toBe(true);
    expect(roleHasCapability('coach', 'players:approve')).toBe(false);
  });

  it('unions capabilities across multiple roles', () => {
    expect(hasCapability(['player', 'coach'], 'attendance:mark')).toBe(true);
    expect(hasCapability(['player'], 'attendance:mark')).toBe(false);
    expect(hasCapability([], 'sessions:read')).toBe(false);
  });
});
