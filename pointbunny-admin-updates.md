# Pointbunny Admin — Server-Side Updates

This is the master reference for all backend changes made in the main Pointbunny app
that the admin panel needs to know about. Add new entries at the top as features ship.

---

> ### Sync Process
> **Source of truth lives in the admin panel repo** (`pointbunny-admin`).
>
> When this file is updated, the admin panel team will send a copy renamed as:
> `pointbunny-admin-updates.YYYY-MM-DD.update.md`
>
> **Pointbunny app team:** replace your `pointbunny-admin-updates.md` with the contents of that file, then delete the `.update.md` file. If you've made local edits, diff and merge manually before deleting.

---

## [2026-06-13] Single-Business Membership + Invite Claim Fix (SQL required)

Fixes a bug where a staff member invited by more than one business (or removed and re-invited) got permanently stuck on "Staff account setup incomplete" and could never accept. Root cause: the client-side invite-claim looked up the pending `staff` row by email with `.maybeSingle()`, which errors when more than one pending row matches the email, so no row was ever claimed. We also formalized the rule that **a person belongs to one business at a time**.

### What changed in the app

1. **Invite claim now handles multiple pending rows.** On invite acceptance the app fetches all pending rows (`user_id IS NULL`, `is_active = true`) for the email, claims the **earliest invited** one (`invited_at ASC`), and **deletes the rest**. This is the single-membership "first business wins" rule.
2. **Block at invite time.** The `invite-staff` Edge Function now rejects an invite when the email is already an active member (`user_id` set and `is_active = true`) of **any** business - returning a clear message ("already on your team" if same business, "must be removed from that team first" if another). This cross-business check runs with the service role because the owner cannot read other businesses' staff rows under RLS.
3. **Edge Function `sendInvite` flag.** Reactivating a previously-joined member (who already has an account) now skips the invite email and just re-links by `user_id`.
4. **Edge Function "already registered" message fixed.** The regex that detects an existing-auth-account error from `inviteUserByEmail` did not match Supabase's actual wording ("already been registered"), so owners saw the raw DB error. Regex broadened and the message corrected (it no longer falsely promises the person will auto-join on next login).

### SQL that must be run (Supabase SQL editor)

```sql
-- Lets a signed-in user discard their own leftover pending invites (auto-clean on claim).
-- Scoped to rows matching their own email that nobody has claimed yet (user_id IS NULL),
-- so it can never touch an active or claimed staff row.
create policy "staff discard duplicate pending invites"
on public.staff
for delete
to authenticated
using (lower(email) = lower(auth.email()) and user_id is null);
```

### Edge Function deploy required

The `invite-staff` function changed - redeploy it:

```bash
supabase functions deploy invite-staff
```

> Until redeployed, the cross-business invite block (#2) is inactive, but the claim fix (#1, client-side) already unblocks stuck staff with no deploy.

### Cleaning up an already-stuck staff member

If a staff member is already stuck with multiple pending rows, pick the business they should join, link their auth id, and remove the rest:

```sql
update public.staff
set user_id = '<their auth user id>', joined_at = now()
where id = '<the chosen pending staff row id>';

delete from public.staff
where lower(email) = lower('<their email>') and user_id is null;
```

### Admin panel impact

None - the panel uses the service role key and bypasses RLS. Note for data interpretation: the app now enforces at most one active (`user_id` set, `is_active = true`) staff row per email across all businesses. Leftover pending invites for an email are auto-deleted once that person joins a business.

---

## [2026-06-10] Staff SELECT Policy Tightened — Cross-Business Read Closed (SQL required)

The `authenticated can read all staff` SELECT policy on `staff` had `qual = true`, letting any logged-in user from any business read every staff row (emails, PINs, hourly rates). It existed so the invite-claim flow could find a pending staff row by email before `user_id` is set. Replaced with an email-scoped policy.

### SQL that was run (Supabase SQL editor, 2026-06-10)

```sql
drop policy "authenticated can read all staff" on public.staff;

create policy "read own staff row by email"
on public.staff
for select
to authenticated
using (lower(email) = lower(auth.email()));
```

`lower()` on both sides guards against any older staff row stored with mixed-case email. All other staff access paths are covered by the policies that remain: `owner manage staff` (owner), `staff read staff` (active staff of the same business via `get_my_business_id()`), and `self read own row` (`user_id = auth.uid()` - also what lets a deactivated staff member read their own row for the deactivation message and the realtime kick-out event).

This closes follow-up #1 from the staff sales policy review entry below. Follow-up #2 (add `is_active` to the serve-time UPDATE policy on `sales`) is still open.

### Admin panel impact

None - the panel uses the service role key, which bypasses RLS. Listed for migration history.

---

## [2026-06-10] Staff Data Access — RLS Policies for All Staff-Facing Tables (SQL required)

Follow-up to the staff sales fix below. A full `pg_policies` review showed most app tables were owner-only: staff saw zero `menu_categories` (every menu item rendered as "Uncategorized"), could not read their `businesses` row (blank receipt header), could not redeem discount codes (usage-count UPDATE), and managers could not write menu items, categories, adjustments, discounts, or expenses.

### SQL that was run (Supabase SQL editor, 2026-06-10)

One migration, two parts:

1. **`get_my_business_id()` redefined** as `security definer`, returning the caller's `business_id` from `staff` only where `is_active = true`. This also tightens the pre-existing `staff read staff` and `staff read roles` policies (deactivated staff now get nothing from them).
2. **Scoped staff policies added** on: `menu_categories` (select/insert/delete), `menu_items` (select/insert/update/delete), `adjustments` (select/insert/update/delete), `discount_codes` (select/insert/update/delete), `expenses` (select/insert/update/delete), `businesses` (select own row). All use `user_id = get_my_business_id()` (`id = ...` for businesses), so they only apply to active staff of that business.

```sql
create or replace function public.get_my_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.staff
  where user_id = auth.uid()
    and is_active
  limit 1;
$$;

-- Pattern repeated per table (see app repo SYSTEM.md for the full list):
create policy "staff read menu_categories" on public.menu_categories
  for select to authenticated using (user_id = get_my_business_id());
-- ... insert/update/delete variants with the same predicate
```

### Design notes

- Writes are **membership-scoped, not role-scoped**: any active staff member of a business passes, and the app UI enforces role gating. DB-level per-role enforcement arrives with the custom roles/permissions feature (`roles.permissions` JSONB).
- The new scoped SELECT policies make the legacy `authenticated can read all <table>` policies (qual `true` on `menu_items`, `adjustments`, `discount_codes`, `employees`, `staff`) redundant. Dropping them is queued in the app todos - currently any authenticated user can read any business's menu, codes, and staff (incl. PINs).

### Admin panel impact

None - service role bypasses RLS. Listed for migration history.

---

## [2026-06-10] Staff Sales Access — New RLS Policies on `sales` (SQL required)

Discovered while testing staff deactivation: the `sales` table only had owner-scoped INSERT/SELECT policies (`auth.uid() = user_id`), so staff accounts (cashiers, managers) could never record a sale - they got a row-level security violation on checkout - and saw an empty order queue and $0 daily totals. This had gone unnoticed because all prior testing was done as the owner.

### SQL that was run (Supabase SQL editor, 2026-06-10)

```sql
create policy "active staff can insert sales"
on public.sales
for insert
to authenticated
with check (
  exists (
    select 1 from public.staff
    where staff.business_id = sales.user_id
      and staff.user_id = auth.uid()
      and staff.is_active
  )
);

create policy "active staff can read sales"
on public.sales
for select
to authenticated
using (
  exists (
    select 1 from public.staff
    where staff.business_id = sales.user_id
      and staff.user_id = auth.uid()
      and staff.is_active
  )
);
```

Both policies require `staff.is_active = true`, so deactivated staff lose sales access at the DB level, consistent with the deactivation enforcement shipped today.

### Admin panel impact

None - the panel reads sales via the service role key (and the `admins` SELECT policy), which is unaffected. Listed for migration history completeness.

### Known follow-ups spotted in the same policy review (not yet fixed)

1. ✅ **Fixed 2026-06-10** (see "Staff SELECT Policy Tightened" entry above) - **`staff` SELECT policy "authenticated can read all staff" has `qual = true`** - any authenticated user from ANY business can read every staff row, including emails and PINs. It likely exists so the invite-claim flow can find the pending row by email before `user_id` is set. Recommended replacement (test invite acceptance + timeclock + staff list after applying):
   ```sql
   drop policy "authenticated can read all staff" on public.staff;
   create policy "read own staff row by email"
   on public.staff for select to authenticated
   using (email = auth.email());
   ```
   Legitimate access is still covered by the other policies: `owner manage staff` (owner), `staff read staff` (same business via `get_my_business_id()`), `self read own row`.
2. **"App can record serve time on sales" UPDATE policy has no `is_active` check** - a deactivated staff session could still mark orders done or void sales until kicked. Low severity now that live kick-out exists; tighten by adding `AND staff.is_active` to its subquery when convenient.

---

## [2026-06-10] Live Staff Deactivation Kick-Out — Realtime Publication Change (SQL required)

The Pointbunny app now subscribes to Supabase Realtime (postgres_changes) on the logged-in user's `staff` row. The moment `is_active` flips to false, the app signs the user out and returns them to the login screen with a "deactivated" message - no page refresh needed. This closes the last gap from item 14: previously an already-open session kept access until the next page load.

### SQL

```sql
alter publication supabase_realtime add table public.staff;
```

**Already applied** - running it on 2026-06-10 returned `42710: relation "staff" is already member of publication "supabase_realtime"`, so the table was added at some earlier point. No action needed; listed here only so the requirement is documented.

### Notes

- Realtime postgres_changes respects RLS: each subscriber only receives events for rows their SELECT policy allows. Staff can read their own row, so they receive their own deactivation event. No staff member can spy on other rows through this publication as long as the staff SELECT policy stays business-scoped.
- This means admin panel deactivations now take effect on live sessions within a second or two.

### Admin panel impact

None in code. Just run the SQL above once.

---

## [2026-06-10] Staff Removal Is Now a Soft Delete + `is_active` Login Enforcement (no schema changes)

No new tables, columns, or policies. Behavior changes in the Pointbunny app that affect what the admin panel sees in the `staff` table:

### What changed

1. **In-app staff removal no longer hard-deletes joined staff.** When an owner removes a staff member who has already accepted their invite (`user_id` set), the app now runs `UPDATE staff SET is_active = false` instead of `DELETE`. Pending invites (`user_id IS NULL`) are still hard-deleted.
2. **`is_active` is now enforced at login.** On every login and session restore, the app checks the staff row's `is_active`; if false, the user is signed out with "Your account has been deactivated. Please contact your business owner." This applies to rows deactivated by the admin panel too - item 14 from the todos is now live. The same check covers the staff time clock page and manager override authorization.
3. **Re-inviting a removed email reactivates the row.** If an owner invites an email that matches a soft-deleted row in their business, the app sets `is_active = true` (and updates name + role) on the existing row instead of inserting a duplicate. No invite email is sent in this case - the staff member signs in with their existing account.

### Admin panel impact

- Staff removed in-app now remain visible in the `staff` table with `is_active = false`, same as staff deactivated from the admin panel. If the panel lists staff for a business, filter or badge on `is_active` as appropriate.
- Deactivation from the admin panel now actually locks the user out of the Pointbunny app (on their next login or page load - existing in-app sessions persist until refresh).
- Reactivation can now happen from the app side (owner re-invites the email), so don't assume `is_active = false` is permanent.

### Note on RLS

No new policy was needed: the existing owner-scoped UPDATE policy on `staff` (already used for role and PIN changes) covers the `is_active` writes.

---

## [2026-06-10] Staff Invite Claim — New RLS UPDATE Policy (no schema changes)

No new tables or columns. One new RLS policy on the existing `staff` table.

### SQL that was run

```sql
create policy "Staff can claim their own pending invite"
on public.staff
for update
using (email = auth.email() and user_id is null)
with check (user_id = auth.uid());
```

### What this does

When an invited staff member accepts their invite link, `loadBusinessContext` (client-side) now claims the pending `staff` row itself. Previously the Edge Function tried to claim it server-side using the returned user ID, which was unreliable. The new policy allows a logged-in user to UPDATE a staff row where the email matches their auth email and `user_id` is still null — and they can only set `user_id` to their own UUID.

The `invite-staff` Edge Function was simplified: it now only calls `inviteUserByEmail`. All claim logic was removed.

### Admin panel impact

None — admin panel uses the service role key and bypasses RLS. No queries change.

---

## [2026-06-07] Forgot Password + Email Domain (no schema changes)

No new tables or columns. Notes for admin panel awareness:

- **Forgot Password** is now live in the Pointbunny app. Users can reset via email link. Recovery emails go through Resend (`pointbunny.com` domain, DNS verified).
- **Custom email domain** is live: all Supabase auth emails (confirm signup, reset password, invite) now send from `@pointbunny.com` via Resend SMTP.
- **`initApp` error handling** added — if `_initBusiness` fails for a new user, the app now shows an error and returns to login instead of hanging on a blank screen. New user registration is currently broken (open bug); the admin panel may see businesses with `name = 'My Business'` if a partial `_initBusiness` run succeeded before the real fix lands.
- **`timezone` column on `businesses`** — was documented in `[2026-05-25]` but the `ALTER TABLE` migration was NOT run until 2026-06-07. If your admin panel queries businesses and includes `timezone`, it is now safe (column exists). Pre-migration, any SELECT of `timezone` from businesses returned a 42703 error.

---

## [2026-06-07] Business Address Fields + First-Login Onboarding

New columns on `businesses` for storing a structured business address. Collected on first login via the onboarding modal; editable from Settings afterwards.

### Migration

```sql
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_type     TEXT,
  ADD COLUMN IF NOT EXISTS business_industry TEXT,
  ADD COLUMN IF NOT EXISTS address_street    TEXT,
  ADD COLUMN IF NOT EXISTS address_city      TEXT,
  ADD COLUMN IF NOT EXISTS address_province  TEXT,
  ADD COLUMN IF NOT EXISTS address_zip       TEXT,
  ADD COLUMN IF NOT EXISTS address_country   TEXT;
```

> No new grants needed — new columns on an existing table inherit the table's existing RLS grants.

**`business_type` values:** `food_beverage` | `service` | `retail` | `other`

**`business_industry` values:** `food_beverage` | `beauty_wellness` | `health_medical` | `retail_fashion` | `retail_electronics` | `retail_grocery` | `retail_home` | `professional_services` | `automotive` | `education` | `entertainment` | `technology` | `other`

### What the admin panel needs

- **Display** `business_type` and `business_industry` on each business record — useful for segmentation and support
- **Display** all four address fields on each business record
- **Edit** form for businesses should include all six new fields (optional, free-text for address; select for type/industry)
- Address fields used for official receipt formatting

---

## [2026-05-27] Shifts, Timesheets & Time Clock

Adds shift tracking for staff via a dedicated `timeclock.html` page. Staff clock in/out on a registered tablet; breaks are tracked separately. Owners/admins can view and edit timesheets from the Staff panel's Payroll tab.

### Migrations

```sql
-- 1. Shifts table
CREATE TABLE public.shifts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id       uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  clocked_in_at  timestamptz NOT NULL,
  clocked_out_at timestamptz,
  note           text,
  created_at     timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Owner can access all shifts for their business
CREATE POLICY "shifts_owner_access" ON public.shifts
  FOR ALL USING (business_id = auth.uid());

-- Staff can access their own shifts (via user_id link)
CREATE POLICY "shifts_staff_own" ON public.shifts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = shifts.staff_id
        AND staff.user_id = auth.uid()
    )
  );

-- 2. Shift breaks table
CREATE TABLE public.shift_breaks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id   uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at   timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_breaks TO authenticated;
ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;

-- Owner can access breaks for their business's shifts
CREATE POLICY "shift_breaks_owner" ON public.shift_breaks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shifts WHERE shifts.id = shift_breaks.shift_id
        AND shifts.business_id = auth.uid()
    )
  );

-- Staff can access breaks for their own shifts
CREATE POLICY "shift_breaks_staff_own" ON public.shift_breaks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shifts
      JOIN staff ON staff.id = shifts.staff_id
      WHERE shifts.id = shift_breaks.shift_id
        AND staff.user_id = auth.uid()
    )
  );

-- 3. New columns on existing tables (inherit existing grants)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS timeclock_token text;
```

### How it works

- Staff clock in on a dedicated tablet running `timeclock.html`. The tablet is registered to the business once via a 6-character code from Settings.
- Each clock-in creates a `shifts` row. Taking a break creates a `shift_breaks` row with `ended_at = NULL`; resuming sets `ended_at`. Clocking out sets `clocked_out_at` on the shift.
- **Hours worked** for a shift = `(clocked_out_at − clocked_in_at)` minus the sum of all completed break durations (`ended_at − started_at`). Ignore shifts or breaks where the end time is `NULL` (still active).
- `staff.hourly_rate` is optional. If set, the app shows gross pay = hours worked × rate. If `NULL`, hours are shown but no dollar amount.
- A staff member can clock in and out multiple times in a day — multiple `shifts` rows per `staff_id` per day is normal.
- The timeclock uses standard Supabase auth (staff log in with their own email + password). **The admin panel uses the service role key and bypasses RLS**, so all queries below work without restriction.

### Queries the admin panel can use

**All shifts for a business (with staff name, break details, and hours):**
```sql
SELECT
  sh.id,
  sh.business_id,
  sh.staff_id,
  s.first_name,
  s.last_name,
  s.hourly_rate,
  sh.clocked_in_at,
  sh.clocked_out_at,
  sh.note,
  sh.created_at,
  EXTRACT(EPOCH FROM (sh.clocked_out_at - sh.clocked_in_at)) / 3600 AS gross_hours,
  COALESCE((
    SELECT SUM(EXTRACT(EPOCH FROM (b.ended_at - b.started_at)))
    FROM shift_breaks b
    WHERE b.shift_id = sh.id AND b.ended_at IS NOT NULL
  ), 0) / 3600 AS break_hours
FROM public.shifts sh
JOIN public.staff s ON s.id = sh.staff_id
WHERE sh.business_id = $businessId
ORDER BY sh.clocked_in_at DESC;
-- net hours worked = gross_hours - break_hours
-- only sum closed shifts (clocked_out_at IS NOT NULL) for payroll totals
```

**Currently active (open) shifts across all businesses:**
```sql
SELECT sh.id, sh.business_id, sh.staff_id, sh.clocked_in_at,
       s.first_name, s.last_name
FROM public.shifts sh
JOIN public.staff s ON s.id = sh.staff_id
WHERE sh.clocked_out_at IS NULL
ORDER BY sh.clocked_in_at ASC;
```

**Total hours per staff member for a date range (for payroll summary):**
```sql
SELECT
  sh.staff_id,
  s.first_name,
  s.last_name,
  s.hourly_rate,
  SUM(
    EXTRACT(EPOCH FROM (sh.clocked_out_at - sh.clocked_in_at)) / 3600
    - COALESCE((
        SELECT SUM(EXTRACT(EPOCH FROM (b.ended_at - b.started_at)))
        FROM shift_breaks b
        WHERE b.shift_id = sh.id AND b.ended_at IS NOT NULL
      ), 0) / 3600
  ) AS net_hours_worked
FROM public.shifts sh
JOIN public.staff s ON s.id = sh.staff_id
WHERE sh.business_id = $businessId
  AND sh.clocked_out_at IS NOT NULL          -- exclude open shifts
  AND sh.clocked_in_at >= $rangeStart
  AND sh.clocked_in_at <  $rangeEnd
GROUP BY sh.staff_id, s.first_name, s.last_name, s.hourly_rate
ORDER BY s.first_name;
-- gross_pay = net_hours_worked * hourly_rate  (only if hourly_rate IS NOT NULL)
```

### What to show in the admin panel

**On the business detail page:**
- `businesses.timeclock_token`: show as a read-only code field labelled "Time Clock Activation Code". This is the code the business enters on a new tablet to register it.
- A "Timesheets" tab or section showing the queries above (filterable by date range + staff member).

**On a timesheet row:**
- Staff name, date, clocked in/out times, break time, net hours worked.
- If `clocked_out_at IS NULL`: show an "Active" badge — the staff member is still clocked in.
- If `hourly_rate` is set: show gross pay for that shift.

**On a per-staff summary row:**
- Total hours for the period, hourly rate (if set), gross pay (if rate is set).
- Staff without a rate still appear — just no dollar amount.

**Admin panel should NOT:**
- Edit or delete `shift_breaks` rows directly — the Pointbunny app manages breaks. Admins can edit the shift's `clocked_in_at` / `clocked_out_at` and `note` if needed.
- Change `businesses.timeclock_token` — it's set by the Pointbunny app via the "Generate Code" button in Settings. Showing it read-only is fine.

---

## [2026-05-25] Business Timezone Setting

Adds a `timezone` column to the `businesses` table so the owner can set the business's IANA timezone from Settings. All date/time calculations in the app (today's totals, cashflow periods, reports) use this timezone.

### Migration

```sql
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS timezone text;
```

No RLS change needed — the column is on the existing `businesses` table which already has RLS enabled. The existing policies cover `SELECT`/`UPDATE` for the authenticated owner.

### Admin panel notes
- Display the `timezone` field on the business detail page (read-only).
- Valid values are IANA timezone strings (e.g. `"Asia/Manila"`, `"America/New_York"`). `NULL` = not set (app falls back to browser timezone).
- This column is `NULL` for all existing businesses until the owner sets it.

---

## [2026-05-25] Sales Table — Undocumented Columns (Void/Restore, Ticket Numbers, KDS Flags)

These four columns exist on the `sales` table and are actively written by the app but were never documented here. **The void columns are critical for accurate revenue reporting** — any admin panel query that sums revenue or counts transactions must filter them out.

> No migrations needed — these columns already exist in production.

---

### `voided_at` + `voided_by` — Void & Restore System

| Column | Type | Meaning |
|---|---|---|
| `voided_at` | `timestamptz` | When the sale was voided; `NULL` = active sale |
| `voided_by` | `text` | Name of the person who authorized the void; `NULL` on active sales |

A sale can be voided (soft-deleted) by an authorized user. It can also be restored, which sets both columns back to `NULL`.

- `voided_by` holds the full name of whoever *authorized* the void — either the cashier (if they have cashflow permission) or the manager who entered their override credentials.
- **All revenue and transaction queries in the Pointbunny app filter `voided_at IS NULL`.** The admin panel must do the same.

**⚠️ Important for the admin panel:**
Any query that counts transactions or sums revenue **must exclude voided sales:**
```sql
-- Always add this filter
WHERE voided_at IS NULL
```

To show voided sales separately (e.g. a "Voided Transactions" view):
```sql
SELECT id, total_price, sale_date, items, added_by, voided_at, voided_by
FROM public.sales
WHERE user_id = $businessId
  AND voided_at IS NOT NULL
ORDER BY voided_at DESC;
```

---

### `ticket_number` — Short Order Display Number

| Column | Type | Meaning |
|---|---|---|
| `ticket_number` | `integer` | Short order number (1–999) shown on KDS and receipts; `NULL` on older sales |

Generated client-side at sale creation as a random number 1–999 that isn't currently active in the queue. Resets naturally as orders complete — it's a display number, not a globally unique ID. The real unique ID is always `sales.id` (UUID).

**What the admin panel can do with it:**
- Show it on transaction detail views as the order reference (e.g. `Order #42`)
- Useful for customer-facing receipts or staff references in the transaction list

---

### `timed_out` — KDS Auto-Complete Flag

| Column | Type | Meaning |
|---|---|---|
| `timed_out` | `boolean` | `true` = KDS auto-completed this order after the auto-complete timer expired; `false`/`NULL` = staff manually marked it done |

Set when `recordServeTime()` is called by the KDS auto-complete timer rather than a staff tap.

**What the admin panel can do with it:**
- Flag timed-out orders in a kitchen performance view
- Count/percentage of orders that weren't manually completed (a proxy for KDS engagement)

---

### `is_manual` — Manual Sale Entry Flag

| Column | Type | Meaning |
|---|---|---|
| `is_manual` | `boolean` | `true` = sale was entered manually (not through the normal order flow); always `false` currently |

Always written as `false` at insert right now. Reserved for a future "manual sale entry" feature (e.g. recording a cash sale after the fact). The column exists so the schema doesn't need to change when that feature ships.

**What the admin panel can do with it:** No action needed now. When manual sales are introduced, flag them differently in the transaction list.

---

## [2026-05-24] Post-Ticket Rating — Full Data Reference

> **Context:** This expands on the brief schema note in the `[2026-05-22] Business Reply Badge + Post-Ticket Rating` entry below. The columns are already live — this section documents the full value mapping and how to use the data in the admin panel.

### How it works (business side)

After a ticket is marked **solved**, the business sees a rating prompt the next time they open that ticket. It will not show again once a rating is submitted.

The prompt uses 5 emoji buttons:

| `rating` value | Emoji | Label |
|---|---|---|
| `1` | 😤 | Bad |
| `2` | 😕 | Poor |
| `3` | 😐 | OK |
| `4` | 😊 | Good |
| `5` | 🤩 | Great |

There is an optional free-text comment field. Both are stored together on the `tickets` row.

### Columns on `tickets`

| Column | Type | Meaning |
|---|---|---|
| `rating` | `smallint` | 1–5 per table above; `NULL` = business never rated |
| `rating_comment` | `text` | Optional comment; `NULL` if left blank |
| `rated_at` | `timestamptz` | When the rating was submitted; `NULL` if not rated |

### Querying ratings

**All rated tickets, newest first:**
```sql
SELECT id, business_id, subject, rating, rating_comment, rated_at, solved_at
FROM public.tickets
WHERE rating IS NOT NULL
ORDER BY rated_at DESC;
```

**Average rating across all time:**
```sql
SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS total_rated
FROM public.tickets
WHERE rating IS NOT NULL;
```

**Rating distribution (how many 1s, 2s, 3s, etc.):**
```sql
SELECT rating, COUNT(*) AS count
FROM public.tickets
WHERE rating IS NOT NULL
GROUP BY rating
ORDER BY rating;
```

**Average rating per month:**
```sql
SELECT DATE_TRUNC('month', rated_at) AS month,
       ROUND(AVG(rating)::numeric, 2) AS avg_rating,
       COUNT(*) AS total
FROM public.tickets
WHERE rating IS NOT NULL
GROUP BY 1
ORDER BY 1;
```

### What to show in the admin panel

**On the ticket detail view (already partially documented):**
- Show the rating as its emoji + label (e.g. `😊 Good`) and the `rating_comment` below it
- Show `rated_at` formatted as a relative date
- If `rating IS NULL`, show "Not yet rated" (greyed out)

**On the ticket list view:**
- Add a small rating badge/pill to each solved ticket row that has a rating
- Unrated solved tickets can show a dash or nothing

**On a support analytics/dashboard section (future):**
- Average CSAT score across all time (or filterable by date range)
- Rating distribution bar chart (1–5 counts)
- Recent low ratings (1 or 2) surfaced as an alert so the team can follow up

---

## [2026-05-22] Cashier Sub-In System — PIN + Audit Trail

### Schema changes

```sql
ALTER TABLE public.staff ADD COLUMN pin text;
ALTER TABLE public.sales ADD COLUMN logged_in_cashier text;
```

> No new grants or RLS needed — new columns on existing tables inherit the table's grants.

### How it works

Businesses can now switch the active cashier at the register without logging out. The person physically at the register enters their 6-digit PIN to sub in. The sale record captures both:

| Column | What it stores |
|---|---|
| `added_by` (existing) | The cashier who actually rang the sale (the sub-in person) |
| `logged_in_cashier` (new) | The account that was logged into the app at the time |

If `added_by` ≠ `logged_in_cashier`, the sale was rung under a sub-in.

### What the admin panel can do with this

- Show both fields on the transaction detail view for full accountability
- Filter/group sales by `logged_in_cashier` to see activity per account
- Flag transactions where a sub-in occurred (`added_by != logged_in_cashier`)

### Staff PIN

- `staff.pin` stores the 6-digit PIN (plaintext). **Each staff member sets their own PIN** on first login — the PIN setup screen is mandatory and cannot be dismissed.
- Business owners can also reset/change a staff member's PIN via Staff management in the Pointbunny app.
- Staff without a PIN appear greyed-out and are not selectable in the cashier switcher.
- The PIN is only used for the register switch — not for login.

> **Note:** Staff invitation emails are not yet implemented (pending company domain setup). Until then, staff members must sign up at the POS using the email address they were invited with. The mandatory PIN setup fires immediately after their first login.

---

## [2026-05-22] Business Reply Badge + Post-Ticket Rating

### Schema changes

```sql
-- Signal admin panel when a business has sent a reply
ALTER TABLE public.tickets ADD COLUMN has_business_reply boolean NOT NULL DEFAULT false;

-- Post-ticket satisfaction rating (filled in by the business after ticket is solved)
ALTER TABLE public.tickets ADD COLUMN rating smallint;
ALTER TABLE public.tickets ADD COLUMN rating_comment text;
ALTER TABLE public.tickets ADD COLUMN rated_at timestamptz;
```

> No new grants or RLS policies needed — new columns on existing tables inherit the table's grants.

### Business reply badge (`has_business_reply`)

When a business sends a reply from the Pointbunny app, `has_business_reply` is set to `true` on the ticket.

**What the admin panel should do:**
- Show a badge/indicator on ticket rows where `has_business_reply = true` (mirrors the existing `has_unread_reply` flag but in reverse)
- When the admin opens the ticket thread, clear the flag:

```js
await supabase.from('tickets').update({ has_business_reply: false }).eq('id', ticketId)
```

### Post-ticket rating

After a ticket is marked solved, the business is shown a 1–5 star rating prompt with an optional comment. Once submitted, `rating`, `rating_comment`, and `rated_at` are written to the ticket row.

**What the admin panel should do:**
- Display the rating and comment on the solved ticket detail view
- The prompt only shows once — if `rating` is already set, it's hidden in the Pointbunny app
- `rating` is `null` if the business never rated

---

## [2026-05-22] RLS Policies — Admin Panel Read Access

The admin panel now reads the following Pointbunny app tables. These `SELECT` policies were added so the admin panel can display business data (menu counts, staff list, discount usage, employee count, adjustments) in the User Management view.

**SQL that was run:**
```sql
-- staff
CREATE POLICY "admin panel can read staff"
  ON public.staff FOR SELECT TO authenticated
  USING (true);

-- menu_items
CREATE POLICY "admin panel can read menu_items"
  ON public.menu_items FOR SELECT TO authenticated
  USING (true);

-- discount_codes
CREATE POLICY "admin panel can read discount_codes"
  ON public.discount_codes FOR SELECT TO authenticated
  USING (true);

-- employees
CREATE POLICY "admin panel can read employees"
  ON public.employees FOR SELECT TO authenticated
  USING (true);

-- adjustments
CREATE POLICY "admin panel can read adjustments"
  ON public.adjustments FOR SELECT TO authenticated
  USING (true);
```

> These are read-only — the admin panel never writes to these tables directly.
> The Pointbunny app's own write policies are unchanged.

---

## [2026-05-22] Staff Deactivation — Pointbunny App Must Enforce

The admin panel can now deactivate a staff member by setting `staff.is_active = false`. The **Pointbunny app must check this flag** on every login and session restore — if `is_active = false`, the staff member should be signed out and shown a clear message.

**What the admin panel does:**
```js
await supabase.from('staff').update({ is_active: false }).eq('id', member.id)
```

**What the Pointbunny app needs to add** (on login + session restore):
```js
const { data: staffRecord } = await supabase
  .from('staff')
  .select('is_active')
  .eq('user_id', currentUser.id)
  .single()

if (staffRecord && !staffRecord.is_active) {
  await supabase.auth.signOut()
  router.push('/login?reason=deactivated')
  // Show: "Your account has been deactivated. Contact your business owner."
}
```

> Business owners (not in the `staff` table) are unaffected.
> Without this check, a deactivated staff member can still use the app until they manually log out.

---

## [2026-05-22] Subscription Status — Realtime Sync Needed

The admin panel can override a business's `subscription_status` (free ↔ paid). Without a realtime listener in the Pointbunny app, the change won't take effect until the business owner logs out and back in.

**What the Pointbunny app needs to add** (after login, while session is active):
```js
const channel = supabase
  .channel('business-subscription-' + currentUser.id)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'businesses',
    filter: `id=eq.${currentUser.id}`,
  }, ({ new: updated }) => {
    businessStore.subscriptionStatus = updated.subscription_status
    // re-evaluate any feature gates that depend on plan
  })
  .subscribe()
```

Clean up on logout: `supabase.removeChannel(channel)`

> Only matters once feature gating (paid vs free) is implemented in the Pointbunny app. Wire it now so it's ready.

---

## [2026-05-22] Business Contact Info — Email & Phone

### Migration

```sql
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone text;
```

> No new grants or RLS needed — `businesses` table grants and policies already cover these columns. New columns on existing tables inherit the table's grants.

---

### What changed in the main app

- **Signup**: business name, email (auth email), and phone are now collected at registration and written to `businesses.email` and `businesses.phone`.
- **Settings → Business tab**: Admins can update their business name, contact email, and phone at any time. Saved directly to `businesses` via the service/anon key (RLS: `auth.uid() = id`).
- The `name` column already existed. `email` and `phone` are new.

---

### What the admin panel benefits from

The **Churn Risk** and **Churned** CSV exports previously had empty Email and Phone columns. These now populate automatically — no admin panel code changes needed, the columns just need to exist in the table.

---

## [2026-05-22] Help & Support — Tickets, Replies & Attachments

### New tables

#### `tickets`
```sql
CREATE TABLE public.tickets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category          text        NOT NULL,  -- billing | bug_report | feature_request | account | other
  subject           text        NOT NULL,
  message           text        NOT NULL,
  attachments       text[]      NOT NULL DEFAULT '{}',
  status            text        NOT NULL DEFAULT 'open',  -- open | solved
  has_unread_reply  boolean     NOT NULL DEFAULT false,
  solved_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business insert own tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = business_id);

CREATE POLICY "business read own tickets" ON public.tickets
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "business update own tickets" ON public.tickets
  FOR UPDATE USING (auth.uid() = business_id);
```

#### `ticket_replies`
```sql
CREATE TABLE public.ticket_replies (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid        NOT NULL REFERENCES public.tickets ON DELETE CASCADE,
  sender_type  text        NOT NULL,  -- 'admin' | 'business'
  message      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_replies TO authenticated;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- Businesses can only read replies on their own tickets
CREATE POLICY "business read own replies" ON public.ticket_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.business_id = auth.uid()
    )
  );
```

> Admins use the service role key and bypass RLS — no additional policies needed on the admin side.

---

### Storage bucket: `ticket-attachments`

Create in Supabase dashboard — Storage → New bucket:

- **Name:** `ticket-attachments`
- **Public:** yes (files served via public URL, no signed URLs needed)

Files are stored at path `{businessId}/{timestamp}-{random}.{ext}`.
The `attachments` column on `tickets` holds an array of public image URLs. The main app enforces a max of 1 image per ticket.

**Required storage RLS policy** (without this, uploads fail with an RLS error):
```sql
CREATE POLICY "authenticated users can upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### How the business-side works (important for admin UX)

| Behaviour | Detail |
|---|---|
| Ticket creation | Business fills out category, subject, message, optional image. One ticket per submission. |
| Unread badge | A red badge appears on the Help & Support card on the home page when `has_unread_reply = true` on any ticket. Cleared when the business opens that ticket. |
| Solved tickets | Business can mark a ticket solved. They are warned it **cannot be reopened** — they must create a new ticket if the issue returns. |
| 7-day auto-hide | Solved tickets disappear from the business view 7 days after `solved_at`. Rows stay in the DB — admin panel should show all tickets regardless of age. |
| Categories | `billing`, `bug_report`, `feature_request`, `account`, `other` |

---

### What the admin panel needs to implement

#### Viewing tickets
Query `tickets` with `ticket_replies` joined or fetched separately. Order by `created_at DESC`.
Show a badge or indicator when `has_unread_reply = true` — this means the business hasn't seen your latest reply yet.

#### Reading a ticket thread
Fetch the original message from `tickets.message` (this is the first message in the thread),
then fetch all rows from `ticket_replies` for that ticket ordered by `created_at ASC`.
Render them as a conversation: `sender_type = 'business'` on the right, `sender_type = 'admin'` on the left.

#### Sending a reply
Use the **service role key**. Insert the reply, then flip `has_unread_reply` so the business sees the notification badge:

```js
await supabase.from('ticket_replies').insert({
  ticket_id: ticketId,
  sender_type: 'admin',
  message: replyText,
})

await supabase
  .from('tickets')
  .update({ has_unread_reply: true })
  .eq('id', ticketId)
```

When the business opens the ticket in their app, the app automatically sets `has_unread_reply = false`.

#### Marking a ticket solved (admin-side)
```js
await supabase
  .from('tickets')
  .update({ status: 'solved', solved_at: new Date().toISOString() })
  .eq('id', ticketId)
```

#### Displaying attachments
`ticket.attachments` is a `text[]` of public image URLs. Render each as `<img src={url} />`.
Max 1 image per ticket in the current implementation.

---

_Add new sections above this line as more features ship._
