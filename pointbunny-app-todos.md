# Things to Build in the Main Pointbunny App

This file tracks features and integrations that need to be added to the main Pointbunny app
to support the admin panel. Add to this list as we build more admin features.

_Last updated: 2026-06-10_

---

> ### Sync Process
> **Source of truth lives in the admin panel repo** (`pointbunny-admin`).
>
> When this file is updated, the admin panel team will send a copy renamed as:
> `pointbunny-app-todos.YYYY-MM-DD.update.md`
>
> **Pointbunny app team:** replace your `pointbunny-app-todos.md` with the contents of that file, then delete the `.update.md` file. If you've made local edits, diff and merge manually before deleting.

> **Note:** Some items depend on external services (Stripe, PostHog) not yet set up. **Company domain is now live: `pointbunny.com`** — Tier 5 items that were blocked on the domain are now unblocked.

---

## Priority Checklist

### ✅ Bug Fixed — New User Registration (commit 245ae27)
`_initBusiness` was passing `name: null` (hardcoded literal) instead of the `businessName` variable when upserting the `businesses` row. Fixed. New owner sign-up now completes successfully on first login.

### 🔴 Tier 1 — Ready to Build Now
- [x] ~~**Staging environment**~~ ✅ shipped — `pointybunny-staging.netlify.app` live on `staging` branch. Branch protection on `main` (no force push, no deletion). Staging auto-deploys on push.
- [x] ~~**First-login onboarding**~~ ✅ shipped — collects business name (required), phone (required), and address (optional). Detected via `businesses.name IS NULL`. Reappears on every login until completed.
- [x] ~~**Social auth (Google)**~~ ✅ shipped — "Continue with Google" button on login form. In-app browser detection shows "Open in browser" fallback. First-time Google users hit onboarding automatically.
- [ ] **Publish Google OAuth app (removes Supabase URL from account picker)** — Right now Google's account picker shows `xrbuqwwgqwuelnqapdvj.supabase.co` instead of `pointbunny.com`. Fix by publishing the OAuth consent screen in Google Cloud Console:
  1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → OAuth consent screen**
  2. The app is currently in **Testing** mode — click **Publish App**
  3. Google will ask if your app needs verification. For a standard sign-in (no sensitive scopes beyond email/profile), you can publish without full verification — click **Confirm**
  4. Once published, Google's account picker will show **pointbunny.com** instead of the Supabase URL
  > Note: If you request sensitive scopes in the future (e.g. Google Drive, Calendar), Google will require a full verification review. Basic sign-in (email + profile) does not require it.
- [x] ~~**Show admin replies inside a ticket**~~ ✅ shipped
- [x] ~~**Clear unread badge when business opens ticket**~~ ✅ shipped
- [x] ~~**Business can reply to tickets** (insert policy confirmed working)~~ ✅ shipped
- [x] ~~**Show ticket ID in the Pointbunny app**~~ ✅ shipped
- [x] ~~**Enforce staff `is_active` on login**~~ ✅ shipped — `loadBusinessContext` now selects `is_active` and throws a `STAFF_DEACTIVATED` error when false; both login and session restore sign the user out with "Your account has been deactivated. Please contact your business owner." Bonus: in-app "Remove staff" is now a soft delete (`is_active = false`) for joined staff so it matches admin panel behavior and preserves shift/sales history; pending invites are still hard-deleted; re-inviting a removed email reactivates the existing row. Live kick-out also shipped: a realtime subscription on the user's staff row signs out already-open sessions the moment `is_active` flips to false (requires `staff` in the `supabase_realtime` publication - SQL in admin updates). (see item 14)
- [x] ~~**Forgot Password**~~ ✅ shipped — "Forgot password?" link on login form → slides to email input → Supabase recovery email via Resend → user lands on `#type=recovery` → reset form shown → `supabase.auth.updateUser({ password })`. Redirect URLs added to Supabase allowlist.

### 🟡 Tier 2 — Next After Tier 1
- [x] ~~**Business reply badge for admin panel** — `has_business_reply` flag~~ ✅ shipped
- [x] ~~**Post-ticket rating** — prompt after ticket solved~~ ✅ shipped
- [ ] **Source ID tracking on registration** — read `?source=` param from URL, fire funnel events to `registration_events` table: `link_opened`, `form_viewed`, `form_started`, `form_abandoned`, `registered` (pass `source_id` + anonymous `session_id` on each event). SQL tables already created in admin panel setup.
- [ ] **Subscription status realtime sync** — when an admin overrides free ↔ paid from the admin panel, the Pointbunny app won't see the change until logout/login. Add a Supabase realtime subscription on the `businesses` row for the logged-in user so feature gating updates instantly. (see item 15)
- [ ] **PostHog: user identification** — `posthog.identify()` on login + key events (see item 2)
- [ ] **PostHog: registration funnel tracking** — fire events at each signup step (see item 5)

### 🟡 Tier 2 (continued)
- [ ] **Invoice/receipt number** — assign a sequential invoice number to every sale and display it on the receipt and across the app (order queue, sales history, reports). Requires a `receipt_number` column on the `sales` table (auto-incrementing per business, not global). Format TBD — e.g. `#0001` or `INV-2026-0001`. Useful for accounting, customer reference, and refunds.
- [ ] **Auto tax rate by province/state** — after onboarding collects the business address, look up the standard VAT/sales tax rate for that province or country and auto-create a tax adjustment in `adjustments`. The owner can still edit or remove it. Implementation: maintain a tax rate lookup table (could be a static JS map or a `tax_rates` Supabase table keyed by country + province code). On first login after onboarding, if no tax adjustment exists yet, create one via `model.addAdjustment`. PH default: 12% VAT. Should also handle the case where the business later changes their address in Settings.

### 🔵 Tier 3 — Needs Stripe First
- [ ] **Free vs Paid feature differentiation** — gate certain features behind paid plan, show upgrade prompts for free users. Details TBD — awaiting spec.
- [ ] **Subscription status via Stripe webhook** — webhook updates `businesses.subscription_status` (see item 3)
- [ ] **Show subscription/billing info** in the Pointbunny app settings page
- [ ] **Staff seat cap by tier** — limit the number of active staff members a business can have based on their subscription tier (e.g. free = 2 active staff, paid = unlimited). `staff.is_active = true` rows count against the cap. Block the invite flow if the limit is reached and show an upgrade prompt. Requires: `businesses.subscription_status` to be live (Stripe), a tier-to-seat-cap lookup, and the cap check in `controlInviteStaff` before the DB insert.

### 🟡 Tier 2 (continued) — Multi-terminal CFD pairing
- [ ] **Pair Customer-Facing Display to its own terminal** — currently all CFD windows for a business receive every cart update, so two simultaneous POS devices show the wrong cart on each CFD. Fix: add a terminal number selector (e.g. Terminal 1 / 2 / 3) on both the main POS home page and the CFD screen. Staff set both to the same number to pair them. Every `CFD_CART_UPDATE` broadcast includes the selected `terminalNumber`; the CFD ignores messages where `data.terminalNumber !== myTerminalNumber`. Terminal number stored in component state (no localStorage or URL params needed). No schema changes — all client-side.

### 🟡 Tier 2 (continued) — Roles & Permissions
- [ ] **Custom roles and granular permissions** — owner can view, edit, and create roles from the Settings panel. Each role has a checklist of permissions (e.g. can void sales, can manage menu, can view reports, can invite staff). Currently roles are fixed (Admin/Manager/Cashier) with hardcoded permission checks. Implementation: add a `permissions` JSONB column to the `roles` table (may already exist — check schema), build a permissions editor UI in Settings, and replace hardcoded role-name checks throughout the app with `hasPermission(key)` helper reads. Schema change needed if `permissions` column doesn't exist.

### ⬛ Tier 4 — Needs PostHog Wired Up First
- [ ] **Feature usage tracking** — capture button clicks for key features (see item 4)
- [ ] **Active session tracking** — `session_start` event on every app init (see item 4)
- [ ] **Feature adoption tracking** — first-use events per feature (see item 4)

### 🟣 Tier 5 — Domain-Dependent (domain is now live: pointbunny.com — these are unblocked)
- [x] ~~**Staff invitation emails**~~ ✅ shipped — owner invites staff via Staff panel → `inviteStaff()` creates a pending `staff` row (no `user_id`) + calls `invite-staff` Edge Function which sends invite email via Supabase Admin `inviteUserByEmail` (sets `role: "staff"` metadata). Staff clicks link → `#type=invite` hash detected → `inviteForm` shown (set password + 6-digit PIN). On submit: `updatePassword()` then `initApp({ isInviteAcceptance: true })` → `loadBusinessContext` finds pending row by email and claims it via RLS UPDATE policy. Edge Function only sends email — claim is fully client-side.
- [x] ~~**Forgot Password (Pointbunny app)**~~ ✅ shipped — see Tier 1 entry above.
- [ ] **2FA (TOTP, not SMS)** — opt-in two-factor authentication for business owner accounts via authenticator app (Google Authenticator, Authy). Use Supabase's built-in MFA: `supabase.auth.mfa.enroll({ factorType: 'totp' })` returns a QR code URI → render it in Settings so the owner scans it once. On login, after password succeeds, call `supabase.auth.mfa.challenge()` + `supabase.auth.mfa.verify()` for the 6-digit code. No SMS/Twilio needed — free and more secure than SMS 2FA (no SIM-swap risk).
- [x] ~~**Custom email sender domain**~~ ✅ shipped — Resend configured with `pointbunny.com` domain (DNS verified in Porkbun). Supabase SMTP set to `smtp.resend.com:465`. Branded HTML templates live for: Confirm Signup, Reset Password, Invite User (generic).
- [x] ~~**Time Clock PIN during invite acceptance**~~ ✅ shipped — PIN collection is built into the `inviteForm` panel (mandatory 6-digit field). Staff sets their PIN during invite acceptance before ever reaching the app. See item 19.

---

## ⚙️ GitHub / Repo Hygiene (non-code)
- [ ] **Require PR reviews before merging to `main`** — enable once a second developer joins. Go to GitHub → Settings → Branches → edit the `Protect main` ruleset → check "Require a pull request before merging" → set required approvals to 1. Currently skipped because the team is solo and it would block self-merges.
- [ ] **Delete merged feature branches** — after merging a PR, delete the source branch from GitHub (there's a "Delete branch" button right after merge). Keeps the branch list clean. Consider enabling "Automatically delete head branches" in GitHub → Settings → General.

---

## ✅ DONE — Skip These
- ~~**Item 1** (Support Ticket Submission) — shipped~~
- ~~**Item 6** (Business Contact Info — Email & Phone) — shipped, columns exist~~
- ~~**Realtime badge** (Ticket Replies Section B) — confirmed working~~
- ~~**Item A** (Show admin replies inside a ticket) — shipped~~
- ~~**Item B** (Business can reply to tickets) — shipped, insert RLS policy confirmed working~~
- ~~**Item C** (Clear unread badge on open) — shipped~~
- ~~**Item 9** (Show ticket ID) — shipped~~
- ~~**Item 16** (Business reply badge — `has_business_reply`) — shipped~~
- ~~**Item 8** (Post-ticket rating) — shipped~~

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
All require PostHog to be wired up in the main Pointbunny app first.

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
- Do we send from a custom domain (e.g. `hello@pointbunny.app`)? If yes, domain needs to be set up in the email provider first.

---

## 10. @Mention Email Notifications (Admin Panel)

> **Note:** Admin panel feature. Currently, @mentions create in-app notifications (bell icon). This item adds email delivery on top.

When an admin is @mentioned in a CRM note, they should also receive an email so they don't miss it if they're not actively in the panel.

**Flow:**
1. Admin saves a note with `@handle`
2. In-app notification is inserted (already working)
3. Also call a Supabase Edge Function → Edge Function calls email API (Resend or Brevo) to send a notification email to the mentioned admin

**Email content (suggested):**
- Subject: `[Pointbunny] @yourusername mentioned you in a note`
- Body: who mentioned them, which business, a preview of the note, a link to Contacts

**Notes:**
- Only send to admins who have CRM access (already enforced in the in-app notification logic)
- Requires the email provider (Resend/Brevo) to be set up — coordinate with the mass email decision from item #7
- Requires company domain for the `from` address
- The Edge Function can be shared with or modeled after the admin invite email (item #11 below)

**Blocked by:** Company domain + email provider not yet set up.

---

## 11. Team Invites — Activation Email & Status (Admin Panel)

> **Note:** This is an admin panel feature, not a Pointbunny app change. Listed here for visibility.

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

> **Applies to:** Admin panel + Pointbunny app

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

### Pointbunny app
Same flow — "Forgot password?" on the login screen → recovery email → password reset page.

**Notes:**
- Supabase handles the email sending automatically (uses its built-in email for now; swap to custom domain email later)
- The reset email template can be customized in **Supabase → Authentication → Email Templates**
- Requires the recovery redirect URL to be whitelisted in **Supabase → Authentication → URL Configuration**

**Blocked by:** Nothing — this can be built any time. No domain or email provider needed (Supabase sends the recovery email for free).

---

## 13. Two-Factor Authentication (2FA) — Both Apps

> **Applies to:** Admin panel (higher priority) + Pointbunny app (optional, for business owner accounts)

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

### Pointbunny app — optional 2FA
For business owners, 2FA can be opt-in rather than required. Add a toggle in their Settings page to enroll/unenroll.

**Notes:**
- Recovery codes should be shown once at enrollment so users can recover if they lose their phone
- If an admin loses their 2FA device, a super admin can unenroll them via Supabase Dashboard → Authentication → Users

**Blocked by:** Nothing technically — but coordinate with the forgot password flow (item #12) first so recovery is in place before enforcing 2FA.

---

## 14. Staff Deactivation Enforcement ✅ SHIPPED

Implemented in the Pointbunny app: `loadBusinessContext` checks `is_active` on every login and session restore and signs out deactivated staff with a clear message. In-app staff removal is now a soft delete (`is_active = false`) for joined staff, consistent with the admin panel. Original spec below for reference.

---

When an admin removes a staff member from the admin panel, that staff member's `is_active` flag is set to `false` in the `staff` table. The Pointbunny app needs to enforce this on every session restore or login.

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

When an admin overrides a business's subscription plan (free ↔ paid) from the admin panel, the change is written to `businesses.subscription_status`. Without a realtime listener, the Pointbunny app won't reflect this until the business owner logs out and back in.

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

---

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

---

## 19. Staff Invitation Emails ✅ SHIPPED

When a business owner invites a staff member via the Staff panel:
1. `inviteStaff()` creates a pending `staff` row in DB (no `user_id` yet, `status = 'pending'`)
2. Calls the `invite-staff` Supabase Edge Function (Deno/TypeScript, deployed via Supabase CLI)
3. Edge Function calls Supabase Admin `admin.inviteUserByEmail()` → Supabase sends the invite email via the custom Resend SMTP domain (`pointbunny.com`)
4. Staff clicks the invite link → lands on `#type=invite` hash → `inviteForm` panel shown
5. Staff sets a new password + mandatory 6-digit PIN → submits → `updatePassword()` then `initApp()`
6. `loadBusinessContext` finds the pending staff row by email, claims it by writing `user_id` + sets `status = 'active'`
7. App launches normally

PIN is collected during invite acceptance — staff have their PIN set before ever reaching the time clock.

---

---

## Staging Environment — Setup & Usage

### What it is
A second live site that's identical to production but invisible to real users. You test bug fixes and new features here before pushing to `pointbunny.com`.

### One-time setup (takes ~5 minutes)

**1. Create the staging branch:**
```
git checkout wip
git checkout -b staging
git push origin staging
```

**2. Create a second Netlify site:**
- Netlify dashboard → **Add new site → Import an existing project**
- Same GitHub repo, but set branch to `staging`
- It will auto-detect `netlify.toml` (same build settings)
- Add the same environment variables: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Netlify will give it a random URL like `pointbunny-staging.netlify.app` — that's fine, leave it as-is (no custom domain needed)

### Daily workflow with staging

**Testing a bug fix or feature:**
```
git checkout -b fix/your-bug-name
# do your work and test locally with npm start
git push origin fix/your-bug-name

# merge into staging to test on the live staging site
git checkout staging
git merge fix/your-bug-name
git push
# wait ~2 min → test on pointbunny-staging.netlify.app

# looks good → merge into wip to go live
git checkout wip
git merge fix/your-bug-name
git push
# wait ~2 min → live on pointbunny.com

# clean up
git branch -d fix/your-bug-name
```

### Rules
- **`staging` is for testing only** — never give the staging URL to real customers
- **`wip` is always production** — only merge into it when the feature/fix is confirmed working on staging
- Both staging and production point to the **same Supabase project**, so any DB changes (new tables, migrations) affect both immediately — be careful when testing schema changes

_Add new items here as the admin panel grows._
