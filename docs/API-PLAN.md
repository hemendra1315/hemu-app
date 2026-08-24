# API Plan

Three access paths, chosen deliberately:

1. **PostgREST (supabase-js)** — simple CRUD/reads, secured entirely by RLS.
2. **Postgres RPC (`SECURITY DEFINER`)** — multi-table transactional operations that must be atomic and permission-checked in one place.
3. **Edge Functions (Deno)** — anything needing secrets, third parties, file generation, cron, or webhooks.

All requests carry the Supabase JWT. `academy_id` is always an explicit filter in queries **and** enforced by RLS. Errors use a uniform shape: `{ error: { code, message, details? } }`. Every mutation Edge Function requires an `Idempotency-Key` header where retries are possible.

---

## 1. PostgREST (direct table/view access)

| Domain | Read | Write |
|---|---|---|
| profiles | self, staff of shared academy | self update |
| academies | members | owner update |
| academy_members | self / staff | owner |
| players | staff, self | owner (self: limited fields) |
| coaches | members | owner (self: profile) |
| venues, batches, batch_schedules, batch_coaches, batch_players | members | owner |
| sessions | owner, batch coach, batch player | owner + batch coach |
| attendance | owner, batch coach, self | owner + batch coach (prefer RPC for bulk) |
| drills, session_drills, player_drill_results | members | staff |
| feedback / `feedback_player_view` | staff full; player via view | staff |
| matches, match_performances | members / self | owner (sync via service role) |
| subscriptions, invoices, payments, payment_allocations | owner; player own | owner (online via Edge Fn) |
| notifications, notification_preferences, push_subscriptions | self | self |
| report_jobs | requester, owner | insert by member |
| views: `v_player_attendance`, `v_player_batting_stats`, `v_player_bowling_stats`, `mv_academy_dashboard` | per RLS of base tables | — |

Example: `GET /rest/v1/sessions?academy_id=eq.{id}&session_date=gte.{from}&select=*,batches(name),venues(name),attendance(count)`

---

## 2. RPC (transactional business logic)

| Function | Args | Returns | Auth | Notes |
|---|---|---|---|---|
| `request_join_by_code` | `code`, `profile jsonb` | `join_requests` | authenticated | validates active/unexpired/uncapped code, rate-limited, increments `use_count`, notifies owner |
| `approve_join_request` | `request_id`, `batch_ids uuid[]` | `players` | owner | creates member + player + batch links + subscription + first invoice, atomically; audited |
| `reject_join_request` | `request_id`, `reason` | void | owner | notifies player |
| `regenerate_join_code` | `academy_id`, `expires_at`, `max_uses` | `text` | owner | deactivates previous codes |
| `invite_member` | `academy_id`, `email`, `role` | `academy_invites` | owner | token hashed; email sent by Edge Fn |
| `assign_player_to_batches` | `player_id`, `batch_ids[]` | int | owner | capacity + duplicate checks |
| `generate_sessions_for_batch` | `batch_id`, `until date` | int | owner/coach | idempotent on `(batch_id, start_at)` |
| `update_session_recurrence` | `schedule_id`, `patch`, `scope('this'\|'future')` | int | owner/coach | |
| `cancel_session` | `session_id`, `reason` | void | owner/coach | queues notifications |
| `bulk_mark_attendance` | `session_id`, `rows jsonb` | int | owner/batch coach | upsert; respects `attendance_edit_window_hours`; audits changes; triggers absence-streak alerts |
| `attendance_summary` | `academy_id`, `from`, `to`, `batch_id?` | table | member | powers dashboards + reports |
| `create_feedback` | `payload jsonb` | `feedback` | coach/owner | notifies player when visible |
| `link_cricheroes_player` | `academy_id`, `player_id`, `external_id`, `url` | row | owner | |
| `generate_monthly_invoices` | `academy_id`, `period date` | int | owner/cron | pro-rata for mid-month starts; skips paused |
| `record_offline_payment` | `player_id`, `amount_paise`, `months`, `method`, `received_at` | `payments` | owner | inserts payment → `allocate_payment` |
| `allocate_payment` | `payment_id` | void | internal | FIFO across open invoices; updates invoice status + `subscription.paid_until` |
| `extend_subscription` | `subscription_id`, `months` | `subscriptions` | owner/internal | flexible 1/3/6/12-month renewal |
| `pause_subscription` / `resume_subscription` | `subscription_id`, `from`, `to`, `reason` | row | owner | |
| `set_fee_mode` | `academy_id`, `mode` | void | owner | re-snapshots `payer_type` on active subs from next cycle |
| `mark_overdue_invoices` | — | int | cron | applies grace period |
| `player_stats_summary` | `player_id`, `from?`, `to?` | jsonb | staff/self | batting+bowling+attendance+feedback in one call |

---

## 3. Edge Functions

| Function | Method / trigger | Auth | Purpose |
|---|---|---|---|
| `join-academy` | POST | user JWT | thin wrapper + captcha/rate-limit before `request_join_by_code` |
| `approve-player` | POST | owner | calls RPC, then sends email/push |
| `payments-create-order` | POST | player (own) or owner | creates Razorpay order for N months, returns checkout params; stores `payments(status=created)` |
| `payments-webhook` | POST (provider) | HMAC signature | verify → idempotent upsert by `provider_payment_id` → `allocate_payment` → receipt + notification |
| `receipt-generate` | POST | owner/player(own) | PDF receipt → `receipts` bucket → signed URL |
| `invoices-generate` | cron daily 00:30 IST | service role | loops academies → `generate_monthly_invoices` |
| `payment-reminders` | cron daily 09:00 IST | service role | T-3 / due / overdue notifications |
| `sessions-materialize` | cron daily 01:00 IST | service role | rolling 8-week session horizon |
| `session-reminders` | cron every 15 min | service role | T-2h push to batch players + coach |
| `notifications-dispatch` | POST / cron | service role | web-push fan-out with prefs + quiet hours; prunes dead endpoints (410) |
| `report-generate` | POST → job | member | validates params, writes `report_jobs`, renders PDF (`pdf-lib`) / XLSX (`exceljs`), uploads, notifies; 24h signed URL |
| `cricheroes-sync` | cron nightly + POST manual | owner/service | fetch academy's linked team/match pages → `cricheroes_raw_imports` (checksum-dedup) → normalize into `matches`/`match_performances`; per-academy only; logs to `cricheroes_sync_runs` |
| `cricheroes-import-csv` | POST multipart | owner | guaranteed fallback path; column mapping + validation report |
| `admin-metrics` | GET | super admin | platform MRR, academies, churn, failed jobs |
| `impersonate` | POST | super admin | short-lived scoped token; fully audited |

### Realtime channels
- `academy:{id}:sessions` — session create/update/cancel
- `session:{id}:attendance` — live roster marking (multi-coach)
- `user:{id}:notifications` — bell badge
- `academy:{id}:approvals` — pending-request counter

### Cross-cutting API rules
- Zod validation at every Edge Function boundary; typed error codes (`E_JOIN_CODE_INVALID`, `E_ATTENDANCE_LOCKED`, `E_INVOICE_ALREADY_PAID`, `E_CAPACITY_EXCEEDED`, `E_FORBIDDEN`).
- Rate limits: join-code 5/10min/user; report-generate 10/hour/academy; payment order 10/hour/user.
- Pagination: keyset (`order=created_at.desc&limit=50`) for lists; `count=exact` only where needed.
- Every privileged mutation writes `audit_logs`.
- Webhooks: signature verified, replay-safe, 200-on-duplicate.
