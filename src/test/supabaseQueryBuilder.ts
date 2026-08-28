/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';

/**
 * Shared stand-in for a PostgREST query builder.
 *
 * Seven test files each grew their own copy of this, listing only the chain
 * methods that file happened to need. When the API layer adopted typed
 * `.returns<T>()` on every query (the round 10 type-safety cleanup), none of
 * those copies had it — so roughly fifty tests began failing with
 * "`.returns` is not a function" and stayed broken, unnoticed, because CI was
 * watching a branch name that doesn't exist in this repository.
 *
 * One builder, one place to add a method, so the next chain method the API
 * layer adopts can't quietly break the suite again.
 *
 * Every filter/modifier returns the builder itself, and the builder is
 * thenable, so `await` on any point in the chain resolves to `response`. That
 * includes `single()` / `maybeSingle()` — returning the builder rather than a
 * resolved promise is what lets `.single().returns<T>()` work, and `await`
 * still yields `response` exactly as before.
 */
export function createMockQueryBuilder(response: { data: any; error: any }): any {
  const builder: any = {
    then: (onfulfilled?: (val: any) => any, onrejected?: (reason: any) => any) =>
      Promise.resolve(response).then(onfulfilled, onrejected),
  };

  const chainable = [
    // row selection / mutation
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    // filters
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'contains',
    'or',
    'not',
    'filter',
    'match',
    // modifiers
    'order',
    'limit',
    'range',
    'abortSignal',
    // result shaping
    'single',
    'maybeSingle',
    'csv',
    'returns',
    'overrideTypes',
  ];

  for (const method of chainable) {
    builder[method] = vi.fn(() => builder);
  }

  return builder;
}
