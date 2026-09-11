import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/**
 * The local Supabase Postgres container's name isn't a fixed string -- the
 * Supabase CLI derives it from the working directory (or `project_id` in
 * config.toml, which this repo doesn't set), so it's whatever folder the
 * repo happens to be checked out into. This file used to hardcode
 * `supabase_db_cricket` (the container name on one developer's machine,
 * where the repo folder was named "cricket"), which meant it could never
 * find a container in CI -- the checkout folder there is always "hemu-app".
 * Discovering the name from `docker ps` instead works regardless of the
 * checkout folder's name, on any machine.
 */
let cachedDbContainer: string | null = null;
function getDbContainer(): string {
  if (cachedDbContainer) return cachedDbContainer;
  const output = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  ).trim();
  const name = output.split('\n')[0]?.trim();
  if (!name) {
    throw new Error('No running supabase_db_* container found -- is `supabase start` running?');
  }
  cachedDbContainer = name;
  return cachedDbContainer;
}

/**
 * Real-RPC coverage for save_match_result and redeem_parent_linking_code —
 * per the repo's own CI comments, the exact two functions whose earlier
 * breakage caused real production incidents (a broken match wizard and
 * broken parent-linking codes). Until now, save_match_result was only
 * exercised by a test asserting a MOCKED supabase.rpc call was shaped
 * correctly (never against a real database), and redeem_parent_linking_code
 * had no test at all — see saveMatchResultTransaction.test.ts and the
 * production-readiness audit's Critical Issue #4.
 *
 * These tests seed real rows in the same local Supabase Postgres instance
 * CI already starts for e2e (`supabase start` + `supabase db reset`), call
 * the RPCs with a real request.jwt.claims sub set (so auth.uid() and every
 * RLS/is_staff() check inside the SECURITY DEFINER function runs for real,
 * not mocked), and assert the resulting database rows — following the exact
 * pattern pilot-manual-walkthrough.spec.ts already proved for
 * approve_join_request.
 */

/**
 * Runs SQL against the local Supabase Postgres instance. Uses execFileSync
 * (argv, no shell) rather than the execSync("...-c \"...\"") pattern the
 * rest of this repo's e2e specs use, specifically so a JSONB payload with
 * its own quotes never has to survive a round trip through shell escaping
 * — psql receives the SQL string exactly as built here, only SQL-level
 * quoting (doubled single quotes) applies.
 */
function runSql(sql: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      getDbContainer(),
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-t',
      '-A',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim();
}

/**
 * Runs SQL as a specific user, the same way approve_join_request is
 * exercised in pilot-manual-walkthrough.spec.ts: request.jwt.claims.sub is
 * what auth.uid() reads inside a SECURITY DEFINER function. Both statements
 * are joined into a single `-c` argument — Postgres runs a multi-statement
 * simple-query message as one implicit transaction, which is what makes the
 * SET LOCAL still be in effect for the RPC call right after it (confirmed
 * by the existing, passing approve_join_request test using this exact
 * one-argument-two-statements shape; a `SET LOCAL` sent as a separate `-c`
 * call, or over a multi-statement stdin script, would NOT reliably persist
 * to the next statement).
 */
function runSqlAsUser(userId: string, sql: string): string {
  return runSql(`SET LOCAL "request.jwt.claims" = '{"sub": "${userId}"}'; ${sql}`);
}

function createUser(fullName: string): { userId: string; email: string } {
  const userId = runSql('SELECT gen_random_uuid();');
  const email = `rpc-test-${userId}@cricket.org`;
  runSql(
    `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role)
     VALUES ('${userId}', '${email}', crypt('Password123!', gen_salt('bf')), now(),
             '${JSON.stringify({ full_name: fullName })}', 'authenticated', 'authenticated');`,
  );
  return { userId, email };
}

test.describe('save_match_result — real RPC against a real database', () => {
  test('creates a match with lineups/batting/bowling for real members and guests, refreshes their stats, then updates it in place', async () => {
    test.setTimeout(60000);

    const { userId: ownerId } = createUser('RPC Test Owner');
    const academyId = runSql(
      `INSERT INTO academies (name, slug, city, state, country, owner_user_id)
       VALUES ('RPC Test Academy', 'rpc-test-academy-' || floor(random() * 900000 + 100000)::text, 'Pune', 'Maharashtra', 'IN', '${ownerId}')
       RETURNING id;`,
    );
    runSql(
      `INSERT INTO academy_members (academy_id, user_id, role, status) VALUES ('${academyId}', '${ownerId}', 'academy_owner', 'active');`,
    );

    const { userId: playerUserId } = createUser('RPC Test Player');
    const playerMemberId = runSql(
      `INSERT INTO academy_members (academy_id, user_id, role, status) VALUES ('${academyId}', '${playerUserId}', 'player', 'active') RETURNING id;`,
    );

    const payload = {
      academy_id: academyId,
      match: {
        match_name: 'RPC Test Final',
        match_date: '2026-09-11',
        venue: 'Test Ground',
        opponent_name: 'Rival XI',
        tournament: 'Test Cup',
        match_type: 'friendly',
        format: 't20',
        overs: '20',
        team_score: '150/4',
        wickets_lost: '4',
        overs_played: '20',
        result: 'won',
        winning_margin: '10 runs',
      },
      lineups: [
        {
          academy_member_id: playerMemberId,
          batting_order: 1,
          is_captain: true,
          is_vice_captain: false,
          is_wicketkeeper: false,
          is_guest: false,
          guest_name: null,
        },
        {
          academy_member_id: null,
          batting_order: 2,
          is_captain: false,
          is_vice_captain: false,
          is_wicketkeeper: false,
          is_guest: true,
          guest_name: 'RPC Guest Batter',
        },
      ],
      batting: [
        {
          academy_member_id: playerMemberId,
          runs: 55,
          balls: 40,
          fours: 6,
          sixes: 1,
          is_out: false,
          dismissal_type: null,
          batting_order: 1,
          is_guest: false,
          guest_name: null,
        },
      ],
      bowling: [],
      fielding: [],
    };

    // --- CREATE ---
    const matchId = runSqlAsUser(
      ownerId,
      `SELECT save_match_result('${JSON.stringify(payload).replace(/'/g, "''")}'::jsonb)->>'match_id';`,
    );
    expect(matchId).toMatch(/^[0-9a-f-]{36}$/);

    const created = runSql(
      `SELECT team_score || '|' || wickets_lost || '|' || result FROM matches WHERE id = '${matchId}';`,
    );
    expect(created).toBe('150/4|4|won');

    const battingRow = runSql(
      `SELECT runs || '|' || is_out FROM match_batting WHERE match_id = '${matchId}' AND academy_member_id = '${playerMemberId}';`,
    );
    expect(battingRow).toBe('55|f');

    const guestLineup = runSql(
      `SELECT guest_name FROM match_lineups WHERE match_id = '${matchId}' AND is_guest = true;`,
    );
    expect(guestLineup).toBe('RPC Guest Batter');

    // save_match_result refreshes stats for every player who appears in the
    // saved rows — confirm the real member's player_statistics row exists
    // and reflects this match (this is the exact refresh loop the
    // CricHeroes-import-review round had to replicate manually for a fix
    // that moves a player OUT of a match; here it's the normal in-match path).
    const statsRuns = runSql(
      `SELECT batting_runs FROM player_statistics WHERE academy_id = '${academyId}' AND player_id = '${playerMemberId}';`,
    );
    expect(Number(statsRuns)).toBeGreaterThanOrEqual(55);

    // --- UPDATE (same match id, changed score) ---
    const updatePayload = {
      ...payload,
      match: { ...payload.match, id: matchId, team_score: '162/5', wickets_lost: '5' },
    };
    const updatedId = runSqlAsUser(
      ownerId,
      `SELECT save_match_result('${JSON.stringify(updatePayload).replace(/'/g, "''")}'::jsonb)->>'match_id';`,
    );
    expect(updatedId).toBe(matchId);

    const updated = runSql(
      `SELECT team_score || '|' || wickets_lost FROM matches WHERE id = '${matchId}';`,
    );
    expect(updated).toBe('162/5|5');

    // --- NEGATIVE: a non-staff member cannot save a result for this academy ---
    const { userId: outsiderUserId } = createUser('RPC Test Outsider');
    runSql(
      `INSERT INTO academy_members (academy_id, user_id, role, status) VALUES ('${academyId}', '${outsiderUserId}', 'player', 'active');`,
    );

    let forbidden = false;
    try {
      runSqlAsUser(
        outsiderUserId,
        `SELECT save_match_result('${JSON.stringify(payload).replace(/'/g, "''")}'::jsonb);`,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('E_FORBIDDEN')) {
        forbidden = true;
      }
    }
    expect(forbidden).toBe(true);
  });
});

test.describe('redeem_parent_linking_code — real RPC against a real database', () => {
  test('links a parent to their child, deactivates the code, and rejects reuse or an invalid code', async () => {
    test.setTimeout(60000);

    const { userId: ownerId } = createUser('Linking Test Owner');
    const academyId = runSql(
      `INSERT INTO academies (name, slug, city, state, country, owner_user_id)
       VALUES ('Linking Test Academy', 'linking-test-academy-' || floor(random() * 900000 + 100000)::text, 'Chennai', 'Tamil Nadu', 'IN', '${ownerId}')
       RETURNING id;`,
    );
    runSql(
      `INSERT INTO academy_members (academy_id, user_id, role, status) VALUES ('${academyId}', '${ownerId}', 'academy_owner', 'active');`,
    );

    const { userId: playerUserId } = createUser('Linking Test Player');
    runSql(
      `INSERT INTO academy_members (academy_id, user_id, role, status) VALUES ('${academyId}', '${playerUserId}', 'player', 'active');`,
    );

    // Seed the code directly (generate_parent_linking_code is a separate
    // RPC with its own coverage need — this test's job is redeem, so we
    // only need a valid, unexpired code to redeem against). code has a
    // repo-wide unique index (20260906180054_unique_parent_linking_codes.sql)
    // and an 8-char-uppercase-alnum CHECK constraint, so it's generated
    // the same way rather than a fixed literal, to stay collision-free
    // across repeated local runs that don't reset the database.
    const code = runSql(
      `INSERT INTO parent_linking_codes (academy_id, player_user_id, code, relationship_type, expires_at, created_by)
       VALUES ('${academyId}', '${playerUserId}', upper(substring(md5(random()::text), 1, 8)), 'mother', now() + interval '7 days', '${ownerId}')
       RETURNING code;`,
    );

    const { userId: parentUserId } = createUser('Linking Test Parent');

    // --- REDEEM ---
    const redeemedAcademyId = runSqlAsUser(
      parentUserId,
      `SELECT redeem_parent_linking_code('${code}');`,
    );
    expect(redeemedAcademyId).toBe(academyId);

    const link = runSql(
      `SELECT relationship_type || '|' || status FROM parent_player_links
       WHERE parent_user_id = '${parentUserId}' AND player_user_id = '${playerUserId}' AND academy_id = '${academyId}';`,
    );
    expect(link).toBe('mother|active');

    const parentMembership = runSql(
      `SELECT role || '|' || status FROM academy_members WHERE academy_id = '${academyId}' AND user_id = '${parentUserId}';`,
    );
    expect(parentMembership).toBe('parent|active');

    const codeStillActive = runSql(
      `SELECT is_active FROM parent_linking_codes WHERE code = '${code}';`,
    );
    expect(codeStillActive).toBe('f');

    // --- NEGATIVE: the same code cannot be redeemed twice ---
    const { userId: secondParentUserId } = createUser('Linking Test Second Parent');
    let reuseRejected = false;
    try {
      runSqlAsUser(secondParentUserId, `SELECT redeem_parent_linking_code('${code}');`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('E_INVALID_CODE')) {
        reuseRejected = true;
      }
    }
    expect(reuseRejected).toBe(true);

    // --- NEGATIVE: a code that was never issued is rejected the same way ---
    let bogusRejected = false;
    try {
      runSqlAsUser(secondParentUserId, `SELECT redeem_parent_linking_code('NOSUCHCODE');`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('E_INVALID_CODE')) {
        bogusRejected = true;
      }
    }
    expect(bogusRejected).toBe(true);
  });
});
