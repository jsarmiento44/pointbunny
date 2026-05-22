# Things to Build in the Main Pointy App

This file tracks features and integrations that need to be added to the main Pointy app
to support the admin panel. Add to this list as we build more admin features.

> **Note:** Some items on this list depend on external services (e.g. Stripe, PostHog) that aren't fully set up yet — keep that in mind before starting. We also don't have a company domain yet, so anything that requires one can be skipped for now. Cross out each item as it gets done today.

---

## ~~1. Support Ticket Submission~~

Businesses need a way to submit tickets from within the app.

**Where to add it:** Settings page or a Help/Support section.

**UI needed:**
- Category dropdown: Billing, Bug Report, Feature Request, Account, Others
- Subject field (short text)
- Message field (textarea)
- Submit button

**Supabase insert to run on submit:**
```js
const { error } = await supabase.from('tickets').insert({
  business_id: currentUser.id,  // the logged-in owner's auth uid
  category: selectedCategory,
  subject: subjectValue,
  message: messageValue,
})
```

**RLS is already set up** — businesses can only insert and read their own tickets.
Admins see all tickets in the admin panel.

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
// Examples — add these to the relevant handlers in the main app
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

**Steps to track:**

| Event | When to fire |
|---|---|
| `registration_form_opened` | User lands on / opens the registration form |
| `registration_form_started` | User types in any field for the first time |
| `registration_form_abandoned` | User closes/navigates away without finishing (use `beforeunload` or visibility change) |
| `registration_submitted` | User hits the final submit button |
| `registration_email_verified` | User clicks the verification link (fire on the confirmation page) |
| `registration_activated` | User completes onboarding / first login after verification |

**Example PostHog calls:**
```js
// On form open
posthog.capture('registration_form_opened')

// On first keystroke in any field
posthog.capture('registration_form_started')

// On submit
posthog.capture('registration_submitted', { email: userEmail })

// On verified/activated (fire after Supabase auth confirms the session)
posthog.capture('registration_activated', { businessId: user.id })
```

**For abandonment detection:**
```js
window.addEventListener('beforeunload', () => {
  if (formStarted && !formSubmitted) {
    posthog.capture('registration_form_abandoned')
  }
})
```

**What this unlocks in the admin panel:**
- How many opened the form
- How many started filling it in
- How many submitted but didn't verify email
- How many verified but never activated (logged in)
- Conversion rate at each step

---

## 6. Business Contact Info — Email & Phone

The admin panel's churn CSV export includes Email and Phone columns, but they are
currently empty because the `businesses` table doesn't store this info yet.

**What to add to the Pointy app:**
Collect email and phone during signup (or in the Settings page), then save to Supabase.

**Supabase migration:**
```sql
ALTER TABLE businesses ADD COLUMN email text;
ALTER TABLE businesses ADD COLUMN phone text;
```

**In the Pointy app (signup or settings save):**
```js
await supabase
  .from('businesses')
  .update({ email: emailValue, phone: phoneValue })
  .eq('id', currentUser.id)
```

Once the columns exist, the admin panel CSV exports (Churn Risk and Churned) will
automatically include them — no admin panel changes needed.

---

_Add new items here as the admin panel grows._
