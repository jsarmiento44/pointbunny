# Pointy Admin — Server-Side Updates

This is the master reference for all backend changes made in the main Pointy app
that the admin panel needs to know about. Add new entries at the top as features ship.

---

> ### Sync Process
> **Source of truth lives in the admin panel repo** (`pointy-admin`).
>
> When this file is updated, the admin panel team will send a copy renamed as:
> `pointy-admin-updates.YYYY-MM-DD.update.md`
>
> **Pointy app team:** replace your `pointy-admin-updates.md` with the contents of that file, then delete the `.update.md` file. If you've made local edits, diff and merge manually before deleting.

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
- Business owners can also reset/change a staff member's PIN via Staff management in the Pointy app.
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

When a business sends a reply from the Pointy app, `has_business_reply` is set to `true` on the ticket.

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
- The prompt only shows once — if `rating` is already set, it's hidden in the Pointy app
- `rating` is `null` if the business never rated

---

## [2026-05-22] RLS Policies — Admin Panel Read Access

The admin panel now reads the following Pointy app tables. These `SELECT` policies were added so the admin panel can display business data (menu counts, staff list, discount usage, employee count, adjustments) in the User Management view.

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
> The Pointy app's own write policies are unchanged.

---

## [2026-05-22] Staff Deactivation — Pointy App Must Enforce

The admin panel can now deactivate a staff member by setting `staff.is_active = false`. The **Pointy app must check this flag** on every login and session restore — if `is_active = false`, the staff member should be signed out and shown a clear message.

**What the admin panel does:**
```js
await supabase.from('staff').update({ is_active: false }).eq('id', member.id)
```

**What the Pointy app needs to add** (on login + session restore):
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

The admin panel can override a business's `subscription_status` (free ↔ paid). Without a realtime listener in the Pointy app, the change won't take effect until the business owner logs out and back in.

**What the Pointy app needs to add** (after login, while session is active):
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

> Only matters once feature gating (paid vs free) is implemented in the Pointy app. Wire it now so it's ready.

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
