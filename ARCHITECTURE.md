# Pointbunny POS — System Architecture

## What is Pointbunny?

Pointbunny is a **Point of Sale (POS) web application** built for businesses — coffee shops, cafés, restaurants, retail stores, service businesses and more. It runs entirely in the browser with no installation required. Each business gets their own isolated account with persistent data stored in the cloud.

---

## At a Glance

| Layer              | Technology                                      |
| ------------------ | ----------------------------------------------- |
| Frontend           | Vanilla JavaScript (ES6 modules), HTML, CSS     |
| Bundler            | Parcel 2 (dev server + production builds)       |
| Backend / Database | Supabase (PostgreSQL + Auth + Storage)          |
| Authentication     | Supabase Auth (email + password, JWT sessions)  |
| File Storage       | Supabase Storage (menu item images)             |
| Hosting            | Netlify (https://pointbunny.com) + Supabase cloud |

---

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                     │
│  ┌──────────┐    ┌────────────┐    ┌─────────────┐  │
│  │  Views   │◄──►│ Controller │◄──►│    Model    │  │
│  │ (UI/DOM) │    │ (logic)    │    │ (state/data)│  │
│  └──────────┘    └────────────┘    └──────┬──────┘  │
│                                           │         │
└───────────────────────────────────────────┼─────────┘
                                            │ HTTPS
                                            ▼
┌─────────────────────────────────────────────────────┐
│                     Supabase Cloud                   │
│                                                     │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Auth        │  │ PostgreSQL │  │  Storage    │  │
│  │  (sessions,  │  │ (all app   │  │  (item      │  │
│  │   sign-up,   │  │  data)     │  │   images)   │  │
│  │   sign-in)   │  │            │  │             │  │
│  └──────────────┘  └────────────┘  └─────────────┘  │
│                                                     │
│  Row Level Security (RLS): each user sees only      │
│  their own data — enforced at the database level    │
└─────────────────────────────────────────────────────┘
```

---

## Frontend Architecture (MVC)

The frontend follows a strict **Model → Controller → View** pattern. No framework — pure JavaScript ES6 modules.

### Model (`Javascript/model.js`)

- Single source of truth for all app state
- Owns all reads and writes to Supabase
- Exposes async functions that the controller calls
- State shape:
  ```
  state {
    userId          — logged-in user's Supabase ID
    username        — display name shown in the UI
    menuItems[]     — all menu items for this account
    menuCategories[]— category list
    employees[]     — staff records
    cart[]          — current in-progress order
    salesBasket[]   — completed sales (current session)
    settings {
      adjustments[] — fee/discount templates
    }
    currentReceiptAdjustments[] — adjustments on active receipt
  }
  ```

### Controller (`Javascript/controller.js`)

- The only file that imports both the model and views
- Wires DOM events (from views) to data operations (in the model)
- All async operations (`await model.loadMenuItems()`, etc.) live here
- `init()` entry point: checks auth session → loads all data → wires event handlers

### Views (`Javascript/Views/`)

Each view is a class that extends the base `View`. It owns one DOM element and follows a consistent pattern:

| File                   | What it renders                                                         |
| ---------------------- | ----------------------------------------------------------------------- |
| `authView.js`          | Login / sign-up overlay                                                 |
| `newOrderView.js`      | Active order / cart                                                     |
| `newOrderItemView.js`  | Item picker + variant selector modal                                    |
| `orderCheckoutView.js` | Payment screen, receipt, adjustments                                    |
| `menuListView.js`      | Browse all menu items                                                   |
| `newMenuItemView.js`   | Add new item form                                                       |
| `menuEditView.js`      | Edit existing item form (dynamically injected)                          |
| `settingsView.js`      | Settings panel: categories, adjustments, toggles, display config        |
| `cashflowView.js`      | Cashflow panel: summary cards, sales list, expenses, export             |
| `receiptView.js`       | Thermal receipt generator (80mm format) + popup print                  |
| `kdsView.js`           | Home page active queue inline list: rows, timers, status badges         |
| `discountView.js`      | Discount code management panel                                          |
| `staffView.js`         | Staff panel: members list, roles tab, payroll tab (timesheets, pay summary, export)  |
| `reportsView.js`       | Reports/Analytics dashboard: KPI strip, charts, compare mode           |
| `supportView.js`       | Help & Support panel: ticket list, thread view, reply, post-ticket rating |
| `view.js`              | Base class (render, spinner, success modal)                             |

**Rule:** Views never talk to the model directly. They only fire handler callbacks that the controller provided.

### Supabase Client (`Javascript/supabase.js`)

Initializes and exports the Supabase JS client using environment variables (`.env`). Imported by both `model.js` (data) and `controller.js` (auth).

---

## Backend — Supabase

Supabase provides three services used by Pointbunny:

### 1. Authentication

- Email + password sign-up and sign-in
- JWT tokens stored in `localStorage`, automatically refreshed
- `supabase.auth.getSession()` on app load — if a valid session exists, the user goes straight to the app; otherwise the login screen is shown
- Sign-out invalidates the session and reloads the page
- **Forgot password:** `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin })` sends a reset link; the app detects `#type=recovery` in the URL hash on return and shows the reset-password form
- **Password reset:** `supabase.auth.updateUser({ password })` after the user submits a new password on the reset form
- **Staff invite:** Owner invites a staff member from the Staff panel → `model.inviteStaff()` creates a pending staff row in the DB + calls the `invite-staff` Supabase Edge Function which sends an invite email via `supabase.auth.admin.inviteUserByEmail()` (sets `role: "staff"` in user metadata). Staff clicks the link → `#type=invite` detected → inviteForm shown (set password + mandatory 6-digit PIN) → on submit: `updatePassword()` then `initApp({ isInviteAcceptance: true })` → `loadBusinessContext` finds the pending row by email and claims it via RLS UPDATE policy `"Staff can claim their own pending invite"`. The Edge Function only sends the email — `user_id` claim is handled entirely on the client.
- **Role metadata:** `controlSignUp` sets `role: "owner"` in user metadata; `inviteUserByEmail` sets `role: "staff"`. `loadBusinessContext` uses this to gate `_initBusiness` — staff accounts with no staff row throw an error instead of accidentally creating a ghost business.
- **Email delivery:** Supabase SMTP configured with Resend (`smtp.resend.com:465`); `pointbunny.com` domain DNS-verified in Porkbun + Resend. Auth emails sent from `noreply@pointbunny.com`. Branded HTML templates live for Confirm Signup, Reset Password, and Invite User.

### 2. Database (PostgreSQL)

All data is scoped to a `business_id` (the owner's Supabase auth UID). Every table has RLS enabled.

**`businesses`**

```
id, name, email, phone, timezone, timeclock_token, created_at
```

**`staff`**

```
id, business_id, first_name, last_name, email, role_id (→ roles),
pin, status ('active'|'pending'), is_active, hourly_rate, created_at
```

`is_active = false` is a soft delete: set by in-app "Remove" (joined staff only - pending invites are hard-deleted) and by the admin panel's deactivate action. `loadStaff` filters them out, `loadBusinessContext` blocks their login with a "deactivated" error, and re-inviting the same email reactivates the row instead of inserting a new one. Active sessions are kicked out live via a realtime subscription on the user's own staff row (`watchStaffDeactivation`); the `staff` table is in the `supabase_realtime` publication for this.

**`roles`**

```
id, business_id, name, permissions (JSONB), created_at
```

**`menu_items`**

```
id, business_id, item_name, price, category, image_url,
stock, has_variants, variants (JSONB), description,
is_active, created_at
```

**`menu_categories`**

```
id, business_id, name, created_at
unique(business_id, name)
```

**`adjustments`** — fee/discount templates configured in Settings

```
id, business_id, name, type (fee|discount),
calculation (fixed|percentage), value, enabled, created_at
```

**`sales`** — completed transaction records

```
id, business_id, subtotal, total_price, customer_payment, customer_change,
items (JSONB), adjustments (JSONB), promo_code (JSONB),
sale_date, cashier_name, added_by, logged_in_cashier,
order_type ('dine_in'|'takeout'|null), ticket_number,
prepared_at (null = active in KDS), voided_at
```

**`expenses`**

```
id, business_id, description, amount, expense_date, created_at
```

**`discount_codes`**

```
id, business_id, code, title, description, type, value,
status, usage_count, usage_limit, created_at
```

**`shifts`**

```
id, business_id, staff_id (→ staff), clocked_in_at, clocked_out_at,
note, created_at
```

**`shift_breaks`**

```
id, shift_id (→ shifts), started_at, ended_at, created_at
```

**`support_tickets`**

```
id, business_id, category, subject, message, attachments (JSONB),
status, has_unread_reply, has_biz_reply, solved_at,
rating, rating_comment, rated_at, created_at
```

**`ticket_replies`**

```
id, ticket_id (→ support_tickets), sender_type ('business'|'support'),
message, created_at
```

> `items`, `adjustments`, and `promo_code` in the sales table are **JSONB snapshots** — a frozen copy of what was in the cart at the time of sale. Historical records are never affected by future menu edits.

### 3. Storage

- Bucket: `item-images` — menu item photos; public read, write restricted to owner via RLS
- Bucket: `ticket-attachments` — support ticket file uploads; public read, write restricted to owner via RLS

---

## Security — Row Level Security (RLS)

Every table has RLS enabled. The base pattern on every table:

```sql
-- Users can only select/insert/update/delete rows belonging to their business
using (business_id = auth.uid())
```

Tables that staff (non-owner) accounts touch carry additional membership policies. `sales` uses an inline subquery:

```sql
-- Active staff can insert/read their business's sales
exists (
  select 1 from public.staff
  where staff.business_id = sales.user_id
    and staff.user_id = auth.uid()
    and staff.is_active
)
```

All other staff-facing tables (`menu_categories`, `menu_items`, `adjustments`, `discount_codes`, `expenses`, `businesses` read-only, plus the pre-existing `staff`/`roles` read policies) use the `get_my_business_id()` helper - a `security definer` function returning the caller's `business_id` from `staff` where `is_active = true`:

```sql
using (user_id = get_my_business_id())
```

The `is_active` condition in both forms means deactivated staff lose data access at the DB level, not just in the UI. Staff write policies are membership-scoped, not role-scoped - the UI enforces role gating until the custom roles feature pushes `roles.permissions` checks into policies.

This means even if someone obtained another user's `business_id`, they could not read or modify that user's data — the database enforces it, not the application code. There is no way to bypass this from the client.

> **Grant policy (enforced Oct 30, 2026):** Every new table migration must include an explicit `GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;` or PostgREST returns a `42501` error. See `pointbunny-admin-updates.md` for all migration history.

---

## Data Flow — Typical Operation

Here's what happens when a cashier adds an item to the cart and checks out:

```
1. Cashier taps item card
      → NewOrderItemView fires handler
      → controller finds item in state.menuItems
      → NewOrderItemView displays item modal

2. Cashier selects variants, taps "Add to cart"
      → controller calculates price (base + variants × qty)
      → pushes to state.cart (in-memory only, no DB write)
      → NewOrderView re-renders with updated cart

3. Cashier taps "Checkout"
      → controller calls model.initReceiptAdjustments()
         (copies enabled adjustments from settings into receipt)
      → model.calculateAdjustments() computes final total
      → OrderCheckoutView renders payment screen

4. Cashier enters payment, taps "Print Receipt"
      → controller calls supabase.from('sales').insert(...)
         (writes the completed sale to the database)
      → state.cart is cleared
      → success animation plays
```

---

## Auth Flow

```
App loads
   │
   ├─ URL hash contains #type=recovery?
   │      YES → show auth overlay → show Reset Password form
   │             User sets new password → supabase.auth.updateUser({ password })
   │             → "Password updated" screen → link to sign in
   │
   ├─ URL hash contains #type=invite? (staff clicked invite email link)
   │      YES → session already set by Supabase invite token
   │             → show auth overlay → show Invite Accept form
   │             User sets password + mandatory 6-digit PIN
   │             → updatePassword() → initApp() claims pending staff row by email
   │
   ├─ supabase.auth.getSession()
   │      │
   │      ├─ Session exists → showLoadingScreen()
   │      │       → try { load all data → wire handlers → app ready }
   │      │       → catch: signOut() → show auth overlay → show error
   │      │
   │      └─ No session → show auth overlay
   │              │
   │              ├─ Sign In → signInWithPassword()
   │              │     → on success: try { load data → wire app }
   │              │     → catch: signOut() → show error
   │              │
   │              ├─ Sign Up (owners only) → signUp() with user metadata
   │              │     → "Check your email" screen
   │              │     → user clicks confirmation link
   │              │     → redirected back → now has session
   │              │     → initApp → _initBusiness creates business + default roles
   │              │
   │              └─ Forgot Password → resetPasswordForEmail()
   │                    → "Check your email" screen
   │                    → user clicks reset link → #type=recovery path above
   │
   └─ supabase.auth.onAuthStateChange()
          → SIGNED_OUT: window.location.reload()
```

---

## File Structure

```
Pointbunny Project/
├── index.html                  — App shell + all modal HTML templates
├── kds-display.html            — Kitchen Display System popup window
├── customer-display.html       — Customer-Facing Display popup window
├── timeclock.html              — Staff time clock page (device registration + staff clock in/out/break)
├── pointbunny.css                  — Single unified stylesheet
├── Pointbunny.png                  — App logo
├── .env                        — Supabase URL + anon key (not committed)
├── netlify.toml                — Netlify build config (build command, publish dir, Node version)
├── package.json                — npm scripts (start, build)
├── ARCHITECTURE.md             — This file
├── SYSTEM.md                   — Full feature workflow reference
├── CLAUDE.md                   — AI assistant instructions
├── pointbunny-admin-updates.md     — Backend migration log for admin panel team
├── pointbunny-app-todos.md         — Roadmap / in-progress work
│
└── Javascript/
    ├── controller.js           — App entry point, wires everything
    ├── model.js                — All state + Supabase operations
    ├── supabase.js             — Supabase client init
    ├── pointbunny.js               — Theme toggle (light/dark mode)
    ├── channel.js              — PointbunnyChannel (Supabase Realtime + BroadcastChannel)
    ├── kds-display.js          — KDS popup logic
    ├── customer-display.js     — CFD popup logic
    ├── timeclock.js            — Staff time clock standalone logic (device auth, clock in/out/break, PIN confirmation)
    │
    └── Views/
        ├── view.js             — Base view class
        ├── authView.js         — Login / sign-up
        ├── newOrderView.js     — Order / cart
        ├── newOrderItemView.js — Item picker + variant selector modal
        ├── orderCheckoutView.js— Payment screen, receipt, adjustments
        ├── menuListView.js     — Menu browser
        ├── newMenuItemView.js  — Add item form
        ├── menuEditView.js     — Edit item form (dynamically injected)
        ├── settingsView.js     — Settings panel
        ├── cashflowView.js     — Cashflow panel: sales, expenses, export
        ├── receiptView.js      — Thermal receipt generator (80mm)
        ├── kdsView.js          — Home page active queue inline list
        ├── discountView.js     — Discount code management
        ├── staffView.js        — Staff panel: members, roles, payroll
        ├── reportsView.js      — Reports/Analytics dashboard
        └── supportView.js      — Help & Support panel
```

---

## Key Design Decisions

**Why vanilla JS (no React/Vue)?**
Speed of development in the early prototype phase. The MVC structure is clean enough that a framework migration is straightforward when needed.

**Why Supabase over a custom backend?**
Supabase gives a production-grade PostgreSQL database, auth, storage, and real-time capabilities with zero backend code to write or maintain. RLS policies enforce security at the database level — more reliable than application-level checks.

**Why JSONB for cart items and adjustments in sales?**
Prices and item details change over time. Storing a snapshot of the exact cart at sale time means historical sales records are always accurate, regardless of future edits to the menu.

**Why in-memory cart (no DB writes mid-order)?**
Speed. Writing every cart change to the database would add latency to every tap. The cart only hits the database once — when the sale is completed.

---

## Built Features (summary)

| Feature                                | Status  |
| -------------------------------------- | ------- |
| Auth (sign in / sign up / sign out / forgot+reset password) | ✅ Live |
| Menu management (CRUD + variants)      | ✅ Live |
| New order + cart                       | ✅ Live |
| Checkout + receipt printing            | ✅ Live |
| Per-receipt adjustments (fees/discounts) | ✅ Live |
| Promo / discount codes                 | ✅ Live |
| Cashflow panel (sales + expenses)      | ✅ Live |
| Reports / Analytics dashboard          | ✅ Live |
| Multi-staff with roles + PIN login     | ✅ Live |
| Cashier switcher (sub-in at register)  | ✅ Live |
| Kitchen Display System (KDS popup)     | ✅ Live |
| Customer-Facing Display (CFD popup)    | ✅ Live |
| Active order queue (home page)         | ✅ Live |
| Order types (Dine In / Takeout)        | ✅ Live |
| Help & Support (ticket system)         | ✅ Live |
| Settings (Profile tab, Business details, POS, KDS, Displays — with email OTP verification on saves) | ✅ Live |
| Staff time clock & timesheets          | ✅ Live |

---

## What's Not Built Yet

| Feature                                     | Status                                                       |
| ------------------------------------------- | ------------------------------------------------------------ |
| Formal pay period records (Mark as Paid)    | Toast-only in v1; future: `pay_periods` table to track paid-out periods per staff |
| Refunds                                     | UI button exists, no implementation                          |
| Phone SMS verification (OTP)                | Hook point is `controlSaveBusinessInfo`; email OTP is already live for profile + business saves |
| Custom email (branded transactional emails) | ✅ Live — Resend SMTP wired to Supabase Auth; sends from `noreply@pointbunny.com` |
| Drawer operations                           | UI button exists, no implementation                          |
| Scan item (barcode)                         | UI button exists, no implementation                          |
| PostHog in-app analytics                    | Waiting on user's PostHog account setup                      |
