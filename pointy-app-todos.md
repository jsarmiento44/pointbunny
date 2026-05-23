# Things to Build in the Main Pointy App

This file tracks features and integrations that need to be added to the main Pointy app
to support the admin panel. Add to this list as we build more admin features.

---

> ### Sync Process
> **Source of truth lives in the admin panel repo** (`pointy-admin`).
>
> When this file is updated, the admin panel team will send a copy renamed as:
> `pointy-app-todos.YYYY-MM-DD.update.md`
>
> **Pointy app team:** replace your `pointy-app-todos.md` with the contents of that file, then delete the `.update.md` file. If you've made local edits, diff and merge manually before deleting.

> **Note:** Some items depend on external services (Stripe, PostHog) not yet set up. No company domain yet — skip domain-dependent items for now.

---

## Priority Checklist

### 🔴 Tier 1 — Ready to Build Now
- [x] ~~**Show admin replies inside a ticket** — businesses currently see no replies at all (see item A below)~~ ✅ shipped
- [x] ~~**Clear unread badge when business opens ticket** — set `has_unread_reply = false` on open (see item C below)~~ ✅ shipped
- [x] ~~**Business can reply to tickets** — add reply input + insert into `ticket_replies` with `sender_type: 'business'` (see item B below). Run the insert policy SQL in item B before building.~~ ✅ shipped (insert policy confirmed working)
- [x] ~~**Show ticket ID in the Pointy app** — display `#XXXXXXXX` on ticket detail screen (see item 9)~~ ✅ shipped
- [ ] **Enforce staff `is_active` on login** — admin panel can now deactivate staff members. The Pointy app must check `is_active = false` for the logged-in staff user and block access (show "Your account has been deactivated" or redirect to login). Without this, removed staff can still use the app. (see item 14)

### 🟡 Tier 2 — Next After Tier 1
- [x] ~~**Business reply badge for admin panel** — when a business sends a reply, signal the admin panel so they see a badge/indicator on that ticket. Mirrors `has_unread_reply` but in reverse. (see item 16)~~ ✅ shipped
- [x] ~~**Post-ticket rating** — prompt business to rate support after ticket is solved (see item 8). Run the ALTER TABLE SQL in item 8 before building.~~ ✅ shipped
- [ ] **Source ID tracking on registration** — read `?source=` param from URL, fire funnel events to `registration_events` table: `link_opened`, `form_viewed`, `form_started`, `form_abandoned`, `registered` (pass `source_id` + anonymous `session_id` on each event). SQL tables already created in admin panel setup.
- [ ] **Subscription status realtime sync** — when an admin overrides free ↔ paid from the admin panel, the Pointy app won't see the change until logout/login. Add a Supabase realtime subscription on the `businesses` row for the logged-in user so feature gating updates instantly. (see item 15)
- [ ] **PostHog: user identification** — `posthog.identify()` on login + key events (see item 2)
- [ ] **PostHog: registration funnel tracking** — fire events at each signup step (see item 5)

### 🔵 Tier 3 — Needs Stripe First
- [ ] **Free vs Paid feature differentiation** — gate certain features behind paid plan, show upgrade prompts for free users. Details TBD — awaiting spec.
- [ ] **Subscription status via Stripe webhook** — webhook updates `businesses.subscription_status` (see item 3)
- [ ] **Show subscription/billing info** in the Pointy app settings page

### ⬛ Tier 4 — Needs PostHog Wired Up First
- [ ] **Feature usage tracking** — capture button clicks for key features (see item 4)
- [ ] **Active session tracking** — `session_start` event on every app init (see item 4)
- [ ] **Feature adoption tracking** — first-use events per feature (see item 4)

### 🟣 Tier 5 — Needs Company Domain
- [ ] **Staff invitation emails** — when a staff member is invited, send an email with signup instructions so they don't have to be told manually. Currently staff must sign up at the POS using the email address they were invited with. Requires company domain + email provider (Resend/Brevo via Supabase Edge Function). See item 19 below.
- [ ] **Forgot Password (Pointy app)** — "Forgot password?" link on login screen → Supabase recovery email → password reset page. Technically works with Supabase's built-in email today, but the recovery link `redirectTo` URL needs a real domain. Move to Tier 1 once domain is live.
- [ ] **2FA** — opt-in TOTP for business owner accounts (see item 13)
- [ ] **Custom email sender domain** — for Supabase auth emails and future notifications

---

---

## ✅ DONE — Skip These
- ~~**Item 1** (Support Ticket Submission) — shipped~~
- ~~**Item 6** (Business Contact Info — Email & Phone) — shipped, columns exist~~
- ~~**Realtime badge** (Ticket Replies Section B) — confirmed working, businesses receive admin replies in real time~~
- ~~**Item A** (Show admin replies inside a ticket) — shipped~~
- ~~**Item B** (Business can reply to tickets) — shipped, insert RLS policy confirmed working~~
- ~~**Item C** (Clear unread badge on open) — shipped~~
- ~~**Item 9** (Show ticket ID) — shipped~~

---

## ~~🆕 NEW — Ticket Replies: Still Needed~~ ✅ ALL DONE

### A) Show admin replies inside a ticket ← NOT DONE YET

When a business opens a ticket, fetch and display admin replies below the original message. **Businesses currently see no replies at all** — the thread is one-sided.

```js
const { data: replies } = await supabase
  .from('ticket_replies')
  .select('id, sender_type, message, created_at')
  .eq('ticket_id', ticketId)
  .order('created_at', { ascending: true })
```

Render each reply in order. `sender_type` will be `'admin'` for our replies. Style them clearly as "from support" — different color/alignment from the original message.

### B) Unread badge ~~✅ DONE — realtime is working~~

The `has_unread_reply` flag and realtime subscription are confirmed working. Badge lights up when admin replies. No changes needed here.

### C) Clear the badge when business opens that ticket ← CONFIRM THIS IS DONE

When the business taps into a ticket to read it, make sure `has_unread_reply` is being set to `false`:

```js
await supabase
  .from('tickets')
  .update({ has_unread_reply: false })
  .eq('id', ticketId)
```

---

## ⚠️ IMPORTANT — Businesses Cannot Reply to Tickets

Right now, **clients can only submit a ticket and read admin replies — they cannot send follow-up messages.** This is a known limitation of the current design.

If you want clients to be able to reply back (instead of just reading):

1. Add a reply input to the ticket detail screen in the Pointy app
2. Insert into `ticket_replies` with `sender_type: 'business'`:

```js
await supabase.from('ticket_replies').insert({
  ticket_id: ticketId,
  sender_type: 'business',
  message: replyText,
})
```

3. The RLS policy `"business read own replies"` already allows businesses to read replies on their tickets. You'll also need an **insert policy** for businesses — **use this exact version** which also blocks replies on solved tickets at the database level:

```sql
CREATE POLICY "business insert own replies" ON public.ticket_replies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND t.business_id = auth.uid()
        AND t.status = 'open'
    )
  );
```

> The `AND t.status = 'open'` check is important — it prevents businesses from replying to solved tickets at the DB level, not just in the UI.

> **Design decision:** Should a business reply re-open a solved ticket? If yes, also update `tickets.status` back to `'open'` when they insert a reply. If no, the policy above already blocks it.

---

## ~~1. Support Ticket Submission~~ ✅ DONE

~~Businesses need a way to submit tickets from within the app.~~

~~**Where to add it:** Settings page or a Help/Support section.~~

~~Shipped — businesses can submit tickets with category, subject, message, and optional image attachment.~~

---

## 2. PostHog — User Identification & Event Tracking

The admin panel will read analytics from PostHog. The main app needs to send the events.

**Install:**
```bash
npm install posthog-js
```

**Identify the user on app init (after login):**
```js
posthog.identify(currentUser.id, {
  email: currentUser.email,
  businessId: currentUser.id,
  businessName: business.name,
})
```

**Key events to track:**
```js
posthog.capture('sign_in')
posthog.capture('sign_up')
posthog.capture('order_placed', { total: saleTotal, itemCount: items.length })
posthog.capture('report_opened')
posthog.capture('settings_opened')
```

**Where:** Initialize PostHog in `initApp()`. Capture events at each relevant action.

---

## 3. Subscription Status (future — when Stripe is ready)

When a business upgrades/downgrades, a Stripe webhook should update `businesses.subscription_status`.

**Stripe webhook payload → Supabase update:**
```js
await supabase
  .from('businesses')
  .update({ subscription_status: 'paid' }) // or 'free'
  .eq('id', businessId)
```

The admin panel already reads and displays `subscription_status` on the dashboard
and free tier views. No admin panel changes needed — just wire the webhook.

---

## 4. Platform Analytics — What the Admin Panel Needs from PostHog

The **Platform → Accounts** view has placeholder cards for these features.
All require PostHog to be wired up in the main Pointy app first.

### Active Sessions
Track who is currently logged in so the admin panel can show a live count.

```js
// On every initApp() / session restore
posthog.capture('session_start', { businessId: user.id, businessName: business.name })
```

### Feature Usage (Button Clicks)
Capture key UI interactions so admin can see which features are most used.

```js
posthog.capture('menu_item_created')
posthog.capture('discount_code_applied')
posthog.capture('report_opened', { report_type: 'sales' })
posthog.capture('employee_invited')
posthog.capture('adjustment_toggled', { type: 'tax' })
posthog.capture('kds_order_completed')
posthog.capture('void_order', { reason: reason })
```

### Feature Adoption
Track first-time use of key features per business.

```js
posthog.capture('feature_first_use', { feature: 'discount_codes' })
posthog.capture('feature_first_use', { feature: 'kds' })
posthog.capture('feature_first_use', { feature: 'expenses' })
```

---

## 5. Registration Funnel Tracking (PostHog)

Track each step of the signup flow so the admin panel can surface drop-off rates.

| Event | When to fire |
|---|---|
| `registration_form_opened` | User lands on / opens the registration form |
| `registration_form_started` | User types in any field for the first time |
| `registration_form_abandoned` | User closes/navigates away without finishing |
| `registration_submitted` | User hits the final submit button |
| `registration_email_verified` | User clicks the verification link |
| `registration_activated` | User completes onboarding / first login after verification |

```js
posthog.capture('registration_form_opened')
posthog.capture('registration_form_started')
posthog.capture('registration_submitted', { email: userEmail })
posthog.capture('registration_activated', { businessId: user.id })

window.addEventListener('beforeunload', () => {
  if (formStarted && !formSubmitted) posthog.capture('registration_form_abandoned')
})
```

---

## ~~6. Business Contact Info — Email & Phone~~ ✅ DONE

~~Collect email and phone during signup (or in the Settings page), then save to Supabase.~~

~~Shipped — `businesses.email` and `businesses.phone` columns exist. CSV exports now populate automatically.~~

---

## 7. Mass Emailing — Future Feature (direction not finalized)

The goal is to let admins send bulk emails to segmented lists from the admin panel — e.g. churned businesses, churn risks, inactive accounts, etc.

**Direction is still being figured out, but here's what we know so far:**

- Candidates: **Resend** (developer-friendly, clean API) or **Brevo** (handles unsubscribe/compliance automatically, better for marketing campaigns)
- The API call must go through a **Supabase Edge Function** — never call an email API directly from the browser or the key gets exposed
- Bulk/marketing emails legally require an unsubscribe link (CAN-SPAM / GDPR) — Brevo handles this automatically, Resend would need it added manually

**Rough flow when this gets built:**
1. Admin selects a segment in the panel (churned, churn risk, inactive, etc.)
2. Admin writes a message or picks a template
3. Admin hits Send → admin panel calls a Supabase Edge Function → Edge Function calls the email API
4. Email service delivers + tracks opens/clicks/bounces

**Open questions to decide before building:**
- Resend vs Brevo (or another provider)?
- Do we want a template editor inside the admin panel, or just a plain textarea?
- Should businesses be able to unsubscribe from admin emails, and if so how do we track that?
- Do we send from a custom domain (e.g. `hello@pointy.app`)? If yes, domain needs to be set up in the email provider first.

---

## 8. Rate This Conversation — Post-Ticket Rating

After a ticket is solved, prompt the business to rate their support experience.

**When to show it:** When the business opens a solved ticket (or immediately after they mark it solved), show a simple rating prompt.

**Suggested UI:** A row of stars or emoji (😞 😐 😊) with an optional short comment field.

**What to store:** Add columns to the `tickets` table:

```sql
ALTER TABLE public.tickets ADD COLUMN rating smallint; -- 1–5
ALTER TABLE public.tickets ADD COLUMN rating_comment text;
ALTER TABLE public.tickets ADD COLUMN rated_at timestamptz;
```

**Business side — submit rating:**
```js
await supabase
  .from('tickets')
  .update({ rating: selectedRating, rating_comment: comment, rated_at: new Date().toISOString() })
  .eq('id', ticketId)
```

**Admin panel side:** Show the rating on the solved ticket detail view. Useful for spotting poor support interactions.

**Notes:**
- Only show the prompt once — if `rating` is already set, skip it
- Optional: surface average rating per admin or per time period in the admin panel later

---

## 9. Show Ticket ID in the Pointy App

The admin panel now displays a short ticket ID (e.g. `#523D4AB6`) on every ticket card and in the thread view. Businesses should see the same ID so they can reference it when following up with support.

**Where to show it:** On the ticket detail screen in the Pointy app, below the ticket subject — same position as in the admin panel.

**How to generate it** (no DB change needed — derived from the existing `tickets.id` UUID):
```js
const ticketId = (id) => '#' + id.replace(/-/g, '').slice(0, 8).toUpperCase()
// e.g. "550e8400-e29b-41d4-a716-446655440000" → "#550E8400"
```

---

## 10. @Mention Email Notifications (Admin Panel)

> **Note:** Admin panel feature. Currently, @mentions create in-app notifications (bell icon). This item adds email delivery on top.

When an admin is @mentioned in a CRM note, they should also receive an email so they don't miss it if they're not actively in the panel.

**Flow:**
1. Admin saves a note with `@handle`
2. In-app notification is inserted (already working)
3. Also call a Supabase Edge Function → Edge Function calls email API (Resend or Brevo) to send a notification email to the mentioned admin

**Email content (suggested):**
- Subject: `[Pointy] @yourusername mentioned you in a note`
- Body: who mentioned them, which business, a preview of the note, a link to Contacts

**Notes:**
- Only send to admins who have CRM access (already enforced in the in-app notification logic)
- Requires the email provider (Resend/Brevo) to be set up — coordinate with the mass email decision from item #7
- Requires company domain for the `from` address
- The Edge Function can be shared with or modeled after the admin invite email (item #11 below)

**Blocked by:** Company domain + email provider not yet set up.

---

## 11. Team Invites — Activation Email & Status (Admin Panel)

> **Note:** This is an admin panel feature, not a Pointy app change. Listed here for visibility.

When a new team member is added in **Settings → Team**, they should receive an activation email with a one-time link so they can set their password and access the panel. The team list should also show whether each invite has been activated.

### What needs to be built

**A) Invite email via Edge Function**
The invite email must be sent server-side — never from the browser. Route: admin hits "Add" in TeamView → admin panel calls a Supabase Edge Function → Edge Function calls Supabase Admin Auth API to create the user + send invite.

```js
// Inside the Edge Function (server-side only):
const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  redirectTo: 'https://admin.yourapp.com/set-password',
})
```

Supabase's `inviteUserByEmail` creates an Auth user, sends an activation email with a magic link, and marks the user as `invited` until they click through and set a password.

**B) Activation status in the `admins` table**
Add a column to track whether the invite has been accepted:

```sql
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS invited_at timestamptz;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS activated_at timestamptz;
```

When the Edge Function sends the invite, set `invited_at = now()`. When the admin logs in for the first time (confirmed via Supabase Auth `confirmed_at`), set `activated_at = now()` — either via a webhook or by checking `auth.users.confirmed_at` in the TeamView query.

**C) Show status in TeamView**
In the admin panel team list, show a status badge next to each member:
- **Active** — `activated_at IS NOT NULL` (or `auth.users.confirmed_at IS NOT NULL`)
- **Invite Sent** — `invited_at IS NOT NULL` and not yet activated
- **Pending** — recently added but invite not sent yet

**Blocked by:** Company domain not purchased yet (needed for the `redirectTo` URL and the Edge Function deploy). Pick this up once the domain is live.

---

## 12. Forgot Password — Both Apps

> **Applies to:** Admin panel + Pointy app

Neither app currently has a "Forgot password?" flow. Users who forget their password have no self-service recovery option.

### Admin panel (`LoginView.vue`)
Add a "Forgot password?" link below the login form. On click, show an email input and call:

```js
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://admin.yourapp.com/reset-password',
})
```

Supabase sends a recovery email with a one-time link. Add a `/reset-password` route that detects the recovery token from the URL and calls:

```js
await supabase.auth.updateUser({ password: newPassword })
```

### Pointy app
Same flow — "Forgot password?" on the login screen → recovery email → password reset page.

**Notes:**
- Supabase handles the email sending automatically (uses its built-in email for now; swap to custom domain email later)
- The reset email template can be customized in **Supabase → Authentication → Email Templates**
- Requires the recovery redirect URL to be whitelisted in **Supabase → Authentication → URL Configuration**

**Blocked by:** Nothing — this can be built any time. No domain or email provider needed (Supabase sends the recovery email for free).

---

## 13. Two-Factor Authentication (2FA) — Both Apps

> **Applies to:** Admin panel (higher priority) + Pointy app (optional, for business owner accounts)

Supabase supports TOTP-based 2FA (Google Authenticator, Authy, etc.) via `supabase.auth.mfa.*`.

### Enable in Supabase
Go to **Supabase → Authentication → Sign In / MFA** and enable TOTP MFA.

### Admin panel — enforce 2FA
Since admins have access to all business data, 2FA should be required (not optional).

**Enrollment flow** (first login after 2FA is enabled):
```js
// 1. Generate QR code for authenticator app
const { data } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
// data.totp.qr_code — show this as a QR code image

// 2. Verify the code they enter from their app
await supabase.auth.mfa.challengeAndVerify({ factorId: data.id, code: userEnteredCode })
```

**Login flow** (every subsequent login):
```js
const { data } = await supabase.auth.mfa.challenge({ factorId })
await supabase.auth.mfa.verify({ factorId, challengeId: data.id, code: userEnteredCode })
```

**Where to add it:** After successful password login in `LoginView.vue`, check if MFA is required (`supabase.auth.mfa.getAuthenticatorAssuranceLevel()`). If yes, show a 6-digit code input before granting access.

### Pointy app — optional 2FA
For business owners, 2FA can be opt-in rather than required. Add a toggle in their Settings page to enroll/unenroll.

**Notes:**
- Recovery codes should be shown once at enrollment so users can recover if they lose their phone
- If an admin loses their 2FA device, a super admin can unenroll them via Supabase Dashboard → Authentication → Users

**Blocked by:** Nothing technically — but coordinate with the forgot password flow (item #12) first so recovery is in place before enforcing 2FA.

---

---

## 14. Staff Deactivation Enforcement

When an admin removes a staff member from the admin panel, that staff member's `is_active` flag is set to `false` in the `staff` table. The Pointy app needs to enforce this on every session restore or login.

**Where to add it:** Wherever the app checks the current user's role/permissions after login (likely in `initApp()` or an auth guard).

```js
// After the staff member logs in, fetch their staff record
const { data: staffRecord } = await supabase
  .from('staff')
  .select('is_active')
  .eq('user_id', currentUser.id)
  .single()

if (staffRecord && !staffRecord.is_active) {
  await supabase.auth.signOut()
  // Show message: "Your account has been deactivated. Contact your business owner."
  router.push('/login?reason=deactivated')
}
```

**Notes:**
- Business owners (who are not in the `staff` table) are unaffected
- Show a clear reason on the login screen so the staff member knows why they were logged out
- The check should also run on session restore, not just on fresh login

---

## 15. Subscription Status Realtime Sync

When an admin overrides a business's subscription plan (free ↔ paid) from the admin panel, the change is written to `businesses.subscription_status`. Without a realtime listener, the Pointy app won't reflect this until the business owner logs out and back in.

**Where to add it:** In the main app init, after the user is identified.

```js
const channel = supabase
  .channel('business-subscription-' + currentUser.id)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'businesses',
    filter: `id=eq.${currentUser.id}`,
  }, ({ new: updated }) => {
    // Update local subscription state
    businessStore.subscriptionStatus = updated.subscription_status
    // Re-evaluate any feature gates that depend on plan
  })
  .subscribe()
```

**Notes:**
- Only matters once feature gating (Tier 3) is built — but wire it now so it's ready
- Clean up the channel on logout (`supabase.removeChannel(channel)`)
- Works for both admin overrides and future Stripe webhooks since both write to the same column

## 16. Business Reply Badge — Admin Panel Notification

When a business sends a follow-up reply on a ticket, the admin panel currently has no way to know a response came in unless they manually refresh. This mirrors the existing `has_unread_reply` flag (admin → business) but in reverse.

### Schema change (run before building)

```sql
ALTER TABLE public.tickets ADD COLUMN has_business_reply boolean NOT NULL DEFAULT false;
```

### Pointy app change

When a business inserts a reply, set the flag on the ticket:

```js
// In controlSendReply, after model.submitTicketReply succeeds:
await supabase
  .from('tickets')
  .update({ has_business_reply: true })
  .eq('id', ticketId);
```

Or handle it entirely in `model.submitTicketReply` so the flag is always kept in sync.

### Admin panel change

- Show a badge or indicator on any ticket row where `has_business_reply = true`
- When the admin opens that ticket thread, clear the flag:

```js
await supabase
  .from('tickets')
  .update({ has_business_reply: false })
  .eq('id', ticketId)
```

- Optionally add a realtime subscription so the admin panel updates live when a business replies

## 18. Free Tier vs Premium Tier

> **Status:** Brainstorming — no spec yet. Design the feature split before building anything.

This is a major initiative. Before any code is written, the key decisions to nail down are:

**Open questions to answer first:**
- What features are free vs paid? (e.g. is KDS free? Reports? Staff limits? Discount codes?)
- Is there a staff seat limit on free tier?
- Do free users see upgrade prompts inline, or a separate upgrade page?
- What happens when a paid user's subscription lapses — do features lock immediately or is there a grace period?
- Is downgrade/locking handled client-side (hide UI) or enforced server-side (RLS/Edge Function)?

**What needs to be built (once spec is decided):**
- `businesses.subscription_status` column already exists (`free` / `paid`) — written by Stripe webhook
- Feature gate checks throughout the app based on `subscription_status`
- Upgrade prompts / paywalls for locked features
- Subscription status realtime sync (see item 15) so gating updates instantly when admin overrides
- Settings page billing section showing current plan + upgrade CTA

**Blocked by:** Stripe setup + spec decisions above.

---

## 17. Invoice Maker

Allow businesses to generate and send invoices to customers directly from the POS.

> **Status:** Future feature — no spec yet. Add details here as the design takes shape.

**Rough scope (to be defined):**
- Create an invoice from an existing order or from scratch (manual line items)
- Set customer name, contact info, due date
- Generate a printable / shareable PDF or link
- Track invoice status: Draft → Sent → Paid
- Optional: send via email or WhatsApp link

**Open questions before building:**
- Do invoices live as a new Supabase table, or are they derived from `sales`?
- Is PDF generation done client-side (e.g. `jsPDF`) or via a Supabase Edge Function?
- Should unpaid invoices feed into cashflow / reports?
- Do we need a customer contacts table to attach invoices to?

## 19. Staff Invitation Emails

When a business owner adds a staff member in the Pointy app, the invited person currently has to be told verbally to sign up at the POS using their email. There's no automated onboarding email.

**What to build once domain is live:**
1. After `inviteStaff()` succeeds, call a Supabase Edge Function that sends an email to the invited address
2. Email content: their name, business name, and instructions — "Sign up at your store's POS with this email address and set your 6-digit PIN to start working"
3. Optional: include a web-based signup link if a hosted version of the app exists

**Why it matters:**
- Without it, owners must manually tell every new staff member how to get started
- Staff must already know their email matches the invited address before signing up

**Blocked by:** Company domain not yet purchased. The `from` address needs a real domain, and `redirectTo` on any links requires a hosted URL.

---

_Add new items here as the admin panel grows._
