# Your database and your migrations are different codebases

_Established 2026-08-25 by reading the live schema of `jslilwvtribrszzzqcez` (project "hemu")._

## The finding

`supabase_migrations` on the live database records different files from the repo
for versions **0004–0010** and **0026**:

| Version | Live database | Repo `supabase/migrations/` |
|---|---|---|
| 0004 | `people` | `join_request_approvals` |
| 0005 | `rls_people` | `batches` |
| 0006 | `people_rpcs` | `batches_rls` |
| 0007 | `batches` | `training_sessions` |
| 0008 | `rls_batches` | `training_sessions_rls` |
| 0009 | `batch_rpcs` | `attendance` |
| 0010 | `batches_fixes` | `attendance_rls` |
| 0026 | `secure_super_admin_helper` | `phone_verification_onboarding` |

Those repo files were **never applied and never will be**. Supabase records the
version numbers as done, so `supabase db push` skips them permanently.

This is not drift from hand-edits. The database was built from an earlier
"people-era" lineage; the current repo's migrations were layered on from 0011.

`0034_repair_profiles_phone_verified` exists because of exactly this — repo 0026
was skipped, so `profiles.phone_verified` had to be added by a later file.
`0045_stats_student_rls_authorization` is the same story for a missing EXECUTE
grant. Both are symptoms that were treated without diagnosing the cause.

## What it actually broke

`batches` still has the old shape. It carries `skill_level`, `venue_id`,
`capacity`, `monthly_fee_paise`, `start_date`, `end_date`, `is_active`,
`deleted_at`, `start_time`, `end_time` — none of which exist in the repo schema —
and **`training_days` is `text[]`, not `text`**.

That is the cause of `batch.trainingDays.split is not a function`, which took down
the Batch detail page. Fixed client-side by `normalizeTrainingDays`.

Five tables exist live that the repo never creates and the app never queries:
`players`, `coaches`, `venues`, `batch_players`, `batch_coaches` — leftovers of
the old lineage.

## What is fine

Every other table the app queries matches production exactly, including the whole
coach path: `attendance`, `training_sessions`, `batch_members`, all `match_*`,
`drills`, `drill_assignments`, `notifications`, `announcements`, `parent_*`,
`player_statistics`, `activity_log`. Column names the app selects all resolve.

The app was written against the live database, so **production is the truth and
the migrations folder is the fiction.**

## The consequence worth acting on

`supabase db reset` locally produces a schema production does not have. CI runs
Playwright against that reset database. So the end-to-end suite validates the app
against a schema that exists nowhere real, and could never have caught the
batches crash.

## Recommended fix

Baseline the migrations against reality rather than trying to replay history.
This needs the Supabase CLI running with your own login, which nothing that
edits files on your behalf can do for you — run it yourself, once, from a
terminal in this project folder:

```powershell
supabase login                                  # opens a browser to authenticate
supabase link --project-ref jslilwvtribrszzzqcez
supabase db pull                                 # writes a migration matching the live schema
```

`db pull` will print the name of a new file under `supabase/migrations/` (something
like `<timestamp>_remote_schema.sql`). Open it before committing — `db pull` diffs
against the CLI's default local stack, so it can include a line or two you didn't
expect (a stray `DROP EXTENSION` is the classic one). Once it looks right:

```powershell
git add supabase/migrations
git commit -m "Baseline migrations against the live schema"
git push
```

Then treat that as the new starting point. Do not attempt to "re-apply" repo
0004–0010; they describe a schema the app was never written for, and applying
them would break it.

Two more settings worth checking while you're in the Supabase dashboard, since
neither is reachable through the SQL-level tools used for everything else in
this document:

- **Leaked password protection** is off. Dashboard → **Authentication →
  Sign In / Providers → Email**, near the bottom of the password settings —
  turn on "Leaked password protection" (checks new passwords against the
  HaveIBeenPwned breach list; needs the Pro plan or above).
- Confirm the re-baseline actually matches production by running
  `supabase db reset` locally afterward and making sure it succeeds —
  that's also what a fresh contributor's clone, and CI's Playwright run,
  will be building from.

## Applied since

- `0046_announcement_targeting` — targeting + three fan-out bugs (applied live)
- `0047_harden_rpc_execute_grants` — RPC lockdown (applied live)

Both were applied directly to production and are captured in `supabase/migrations/`.
