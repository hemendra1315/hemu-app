import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { createQueryClient } from '@/lib/query/queryClient';
import { supabase } from '@/lib/supabase/client';

import { fetchLinkedChildren } from '../api/parentsApi';
import ParentDashboardPage from '../pages/ParentDashboardPage';
import { useLinkedChildren } from '../hooks/useParents';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';

/**
 * Regression tests for round 12 bug #42.
 *
 * `fetchLinkedChildren` used to embed `academy_members` directly onto
 * `parent_player_links` in a single PostgREST select. There is no foreign key
 * between those two tables, so that select was invalid and the query failed on
 * every call, for every parent account. The dashboard only checked
 * `isLoading`, so the failure rendered as the ordinary "No children linked"
 * empty state — indistinguishable from a parent who genuinely has no children,
 * which is why it survived unnoticed.
 *
 * Two things are guarded here, because fixing only one would have left the bug
 * just as invisible:
 *   1. the query shape (two separate queries, no embed), and
 *   2. that a failure is actually surfaced rather than swallowed.
 *
 * Note: modules are imported statically and `vi.resetModules()` is never
 * called. Resetting would hand the code under test a *different* instance of
 * the Supabase client than the one spied on here, so the spy would be bypassed
 * and the real client would attempt a network call.
 */

vi.mock('@/features/players/api/playersApi', () => ({
  fetchPlayerProfile: vi.fn(),
}));
vi.mock('../hooks/useParents', () => ({
  useLinkedChildren: vi.fn(),
  parentKeys: { all: ['parents'] },
}));
vi.mock('@/features/academies/hooks/useAcademies', () => ({
  useActiveAcademy: vi.fn(),
}));

const ACADEMY_ID = '880e8400-e29b-41d4-a716-446655440000';
const PARENT_LINK_ID = '11111111-1111-4111-8111-111111111111';
const PLAYER_USER_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const PARENT_USER_ID = '44444444-4444-4444-8444-444444444444';

/**
 * Minimal stand-in for the PostgREST builder chain. Every filter method
 * returns the builder itself, and the builder is thenable so `await` resolves
 * it — including `.returns<T>()`, which the API layer calls on every query.
 */
function makeQueryStub(rows: unknown[]) {
  const selectCalls: string[] = [];
  const eqCalls: [string, unknown][] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = {};
  for (const method of ['in', 'order', 'limit', 'returns', 'neq', 'or']) {
    stub[method] = vi.fn(() => stub);
  }
  stub.eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push([column, value]);
    return stub;
  });
  stub.select = vi.fn((columns: string) => {
    selectCalls.push(columns);
    return stub;
  });
  stub.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return { stub, selectCalls, eqCalls };
}

describe('fetchLinkedChildren — query shape (bug #42)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // fetchLinkedChildren now resolves the caller's own id and filters by it
    // (round 24, dashboard/mobile-UX audit finding #5) instead of relying
    // solely on RLS, so every call needs a signed-in user to work with.
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { user: { id: PARENT_USER_ID } as any },
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('resolves links and members in two separate queries, never as an embed', async () => {
    const selectsByTable: Record<string, string[]> = {};
    let linksEqCalls: [string, unknown][] = [];

    vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      const rows =
        table === 'parent_player_links'
          ? [{ id: PARENT_LINK_ID, relationship_type: 'father', player_user_id: PLAYER_USER_ID }]
          : [{ id: MEMBER_ID, user_id: PLAYER_USER_ID }];
      const { stub, selectCalls, eqCalls } = makeQueryStub(rows);
      selectsByTable[table] = selectCalls;
      if (table === 'parent_player_links') linksEqCalls = eqCalls;
      return stub;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const { fetchPlayerProfile } = await import('@/features/players/api/playersApi');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fetchPlayerProfile).mockResolvedValue({ id: MEMBER_ID, fullName: 'Child' } as any);

    const children = await fetchLinkedChildren(ACADEMY_ID);

    // Both tables must be queried on their own...
    expect(Object.keys(selectsByTable).sort()).toEqual(['academy_members', 'parent_player_links']);

    // ...and neither select may embed the other. A PostgREST embed looks like
    // `academy_members(...)` inside the column list; no foreign key supports
    // it, so its presence means the original bug is back.
    for (const [table, selects] of Object.entries(selectsByTable)) {
      for (const columns of selects) {
        expect(columns, `${table} select must not embed a related table`).not.toMatch(
          /academy_members\s*\(|parent_player_links\s*\(|profiles\s*\(/,
        );
      }
    }

    expect(children).toHaveLength(1);
    const [child] = children;
    expect(child?.linkId).toBe(PARENT_LINK_ID);
    expect(child?.relationshipType).toBe('father');

    // Round 24 finding #5: this must filter by the caller's own id, not rely
    // solely on RLS -- otherwise staff previewing "Test App As Parent" (who
    // pass is_staff() too) see every real parent-child link in the academy.
    expect(linksEqCalls).toContainEqual(['parent_user_id', PARENT_USER_ID]);
  });

  it('returns an empty list without a second query when there are no links', async () => {
    const tablesQueried: string[] = [];
    vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      tablesQueried.push(table);
      return makeQueryStub([]).stub;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    await expect(fetchLinkedChildren(ACADEMY_ID)).resolves.toEqual([]);
    expect(tablesQueried).toEqual(['parent_player_links']);
  });

  it('returns an empty list without querying anything when there is no signed-in user', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const fromSpy = vi.spyOn(supabase, 'from');

    await expect(fetchLinkedChildren(ACADEMY_ID)).resolves.toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

describe('ParentDashboardPage — a failed query must not look like "no children"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useActiveAcademy).mockReturnValue({
      academyId: ACADEMY_ID,
      membership: { academyName: 'Test Academy' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('shows an error state, not the empty state, when loading children fails', async () => {
    vi.mocked(useLinkedChildren).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('could not find a relationship between the tables'),
      refetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(
      React.createElement(
        QueryClientProvider,
        { client: createQueryClient() },
        React.createElement(MemoryRouter, null, React.createElement(ParentDashboardPage)),
      ),
    );

    // The failure must be announced...
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // ...and must not be dressed up as the ordinary empty state, which is
    // exactly how this bug stayed invisible for so long.
    expect(screen.queryByText('No children linked')).not.toBeInTheDocument();
  });

  it('still shows the empty state when there genuinely are no children', async () => {
    vi.mocked(useLinkedChildren).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(
      React.createElement(
        QueryClientProvider,
        { client: createQueryClient() },
        React.createElement(MemoryRouter, null, React.createElement(ParentDashboardPage)),
      ),
    );

    await waitFor(() => expect(screen.getByText('No children linked')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
