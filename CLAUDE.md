# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Writing Style

**Never use em dashes (--).** Use a regular hyphen (-), a colon (:), or rewrite the sentence. This applies to all code comments, UI strings, error messages, toasts, and documentation.

## Living Documentation - Always Read and Update

These files are the source of truth for the project. **Always consult them before starting any task, and always update them when a feature ships or the system changes.**

| File | Purpose |
|---|---|
| `SYSTEM.md` | **Most important.** Full feature workflows: every user action traced through view → controller → model → DB. Update whenever a workflow changes or a new feature is added. |
| `ARCHITECTURE.md` | Tech stack, module map, DB schema, auth flow, file structure. Update when tables, files, or major patterns change. |
| `pointbunny-app-todos.md` | Roadmap and feature checklist. Mark items done when shipped; add new items as they come up. |
| `pointbunny-admin-updates.md` | Backend migration log for the admin panel team. **Add an entry for every schema change** (new table, new column, new RLS policy). |

**Rule:** If you implement something and it's not reflected in these files, the docs are wrong - fix them before finishing the task.

## Commands

```bash
npm start    # Dev server via Parcel (serves index.html with hot reload)
npm build    # Production build → dist/
```

No test or lint commands are configured.

## Architecture

**Pointbunny** is a POS (Point of Sale) SPA built with vanilla JavaScript (ES6 modules) and Parcel as the bundler. No framework (no React/Vue). State is backed by **Supabase** (auth + Postgres database).

The app follows a strict **MVC** pattern:

### Model (`Javascript/model.js`)
Single source of truth. Holds a `state` object and all Supabase query functions. All data mutations go through here - views never call Supabase directly.

Key state fields:
```js
{
  userId, businessId, username, role,
  currentStaff, currentCashier,
  staff, roles,
  menuItems, menuCategories,
  cart, orderQueue, salesBasket,
  cashflowSales, expenses,
  discountCodes, currentPromoCode,
  settings, currentReceiptAdjustments
}
```

### Views (`Javascript/Views/`)
Each view owns one DOM element. Pattern:
- `_generateMarkUp()` - returns HTML string
- `render(data)` - injects markup into the DOM
- `_addHandler*(handler)` - wires controller callback to a DOM event

Views never call model functions directly.

| File | Responsibility |
|---|---|
| `newOrderView.js` | New order modal |
| `newOrderItemView.js` | Item picker & variant selector |
| `orderCheckoutView.js` | Payment screen & receipt |
| `menuListView.js` | Browse all menu items |
| `newMenuItemView.js` | Add new menu item form |
| `menuEditView.js` | Edit existing menu items |
| `kdsView.js` | Home page active queue list (inline, not a modal) |
| `cashflowView.js` | Cashflow panel |
| `staffView.js` | Staff management |
| `settingsView.js` | Settings panel |
| `receiptView.js` | Receipt printing |
| `discountView.js` | Discount/promo codes |
| `reportsView.js` | Reports/Analytics dashboard |

### Controller (`Javascript/controller.js`)
Wires model and views together. `initApp()` is the app entry point after auth. Key controller-level variables:
- `_yesterdayTotal` - cached yesterday's sales total (fetched once at login)
- `_todayTransactionCount` / `_yesterdayTransactionCount` - transaction counts for the stat card badge
- `_cmpRangeA` / `_cmpRangeB` - active compare period ranges `{ startISO, endISO, label }`
- `_compareModeActive` - boolean, true when the compare panel is open

`initApp()` stores `pointbunny_business_id` to `localStorage` after loading business context so the KDS popup can query Supabase directly without depending on the main window.

**Reports helpers in controller:**
- `_getRangeFromValue(type, value)` - converts a type (`"day"/"week"/"month"/"year"`) + raw input value into `{ startISO, endISO, label }`. Week snaps Mon–Sun.
- `_computeAllTimeSeries(period, startISO, endISO)` - computes all 6 metric time series in one pass: `{ labels, series: { revenue, expenses, net, transactions, avgOrder, avgServing } }`. Used by the Overview multi-metric chart.
- `_buildOverviewDatasets()` - maps `_selectedOverviewMetrics` + `_overviewTimeSeries` into Chart.js dataset objects (color, fill, tension, `_metric` tag).
- `_renderOverviewChart()` - async; calls `ReportsView.renderOverviewChart(datasets)` then `ReportsView.setSelectedMetrics(set)`.
- `controlToggleMetric(metric)` - adds/removes a metric from `_selectedOverviewMetrics`; always keeps at least one selected; calls `_renderOverviewChart()`.
- `_computeTrafficPeaks(period)` - returns `{ peakHour, peakDay }` by transaction count. `peakDay` is `null` when `period === 'today'`.
- `_computeCategoryMix()` - revenue by category; returns `[{ label, value }]`
- `_computeTopItems(limit, sortKey)` - items sorted by quantity or revenue; returns `[{ name, quantity, revenue }]`
- `_computeStaffPerformance()` - returns `[{ name, transactions, revenue }]` sorted by revenue
- `_computeHourlyBreakdown()` - revenue by hour of day
- `_computeDayOfWeek(period)` - revenue Mon–Sun; returns `{ labels, data, isEmpty: true }` when period is too narrow (today/yesterday)
- `_computeServingTimeStats()` - avg serving minutes from `prepared_at - sale_date`; returns `{ avgMinutes, byHour: { labels, data }, byDay: { labels, data } }` or `null` if no KDS data; sanity filter: 0–120 min

**Overview metric state:**
- `_selectedOverviewMetrics` - `Set<string>` of active metrics; reset to `new Set(['revenue'])` on each period change
- `_overviewTimeSeries` - cached result of `_computeAllTimeSeries` for the current period; `null` before first load
- `METRIC_COLORS` - `{ revenue: '#22c55e', expenses: '#ef4444', net: '#3b82f6', transactions: '#8b5cf6', avgOrder: '#f59e0b' }`
- `METRIC_LABELS` - display names for each metric key

### Entry point (`index.html`)
All modal HTML templates are defined directly in `index.html` as hidden elements. Views target specific `id`/`class` selectors to render into or toggle visibility. The edit menu modal is an exception - dynamically injected into `.edit-form-parent` by `menuEditView.js`.

### Styling (`pointbunny.css`)
Single unified stylesheet using CSS custom properties for theming. Theme switching (light/dark) handled in `Javascript/pointbunny.js`, persisted to `localStorage`. Key variables: `--radius-lg: 28px`, `--panel-strong`, `--shadow-lg`, `--brand-1` (green), `--text`, `--muted`.

**CSS cascade gotcha:** Several overlay classes (`.modal-overlay-form`, `.modal-backdrop`) have duplicate definitions later in the file that override earlier media queries. Mobile responsive overrides must be placed immediately after the duplicate definition, not in the central responsive block at line ~1071.

### Channel (`Javascript/channel.js`)
Supabase Realtime broadcast channel (`self: false`) used for cross-window sync between the main POS, KDS popup, and CFD popup. Also wraps a native `BroadcastChannel` for same-browser reliability. Exposes a `ready` Promise that resolves when the Supabase subscription is `SUBSCRIBED`.

**Important:** The KDS popup does NOT use the channel for its initial queue load - it queries Supabase directly (see KDS section below). The channel handles real-time deltas only (new orders pushed in, orders marked done).

### External displays
- `kds-display.js` / `kds-display.html` - Kitchen Display System popup
- `customer-display.js` / `customer-display.html` - Customer-Facing Display popup

## Key Data Shapes

**Menu item** (in `state.menuItems`):
```js
{ itemName, price, category, _id, imageURL, _stock, hasVariants, variants, description, isActive }
```
Prices are stored as **numbers** throughout.

**Variant group** (in `item.variants`):
```js
{ optionLabel, options: [{ optionName, optionPrice }] }
```

**Cart item** (in `state.cart`):
```js
{ itemName, price, imageURL, selectedVariants, id, date, quantity, totalPrice }
```

**Sale record** (in `state.salesBasket` and `sales` table):
```js
{ items, subtotal, totalPrice, customerPayment, customerChange, adjustments, promoCode, date, cashierName, orderType }
```

**Order queue item** (in `state.orderQueue`, sourced from `sales` where `prepared_at IS NULL`):
```js
{ id, saleDate, items, startedAt, totalPrice, orderType }
```

## Supabase Tables

| Table | Purpose |
|---|---|
| `businesses` | One row per owner account |
| `staff` | All staff including the owner; links to `roles` |
| `roles` | Role definitions with a `permissions` JSON column |
| `menu_items` | Menu catalogue |
| `menu_categories` | Category list |
| `sales` | Every completed transaction; `prepared_at` = NULL means order is active in KDS |
| `expenses` | Manual expense entries |
| `adjustments` | Tax/fee/discount adjustment templates |
| `discount_codes` | Promo codes |

**`sales.prepared_at`**: NULL = order is active (shown in KDS/active queue). Set to a timestamp when the kitchen marks it done via `recordServeTime()`. Also used by Reports to compute average serving time.

**`sales.sale_date`**: Stored as UTC ISO string from `new Date(Date.now()).toISOString()`. All date range queries use local-time midnight boundaries converted with `.toISOString()` - this correctly handles timezone offsets.

Both `fetchReportsSales` and `fetchReportsSalesRaw` select `prepared_at` so serving time stats are available in reports.

### Supabase Data API Grant Policy (enforced Oct 30, 2026)

Pointbunny uses `supabase-js` (the Data API). From Oct 30, 2026 all existing projects require **explicit grants on every new table**. Existing tables are unaffected - new columns on existing tables inherit the table's grants.

**Every new table migration must include:**

```sql
grant select, insert, update, delete on public.your_table to authenticated;
alter table public.your_table enable row level security;
-- then add RLS policies scoped to auth.uid() / businessId
```

Without the grant, PostgREST returns a `42501` error and `supabase-js` queries silently fail.

## Home Page Hero

The hero section (`.hero`) uses a flex row layout with two halves:
- **Left** (`.hero-left`) - greeting h1 + subtitle
- **Right** (`.hero-datetime`) - live time (`#dateTimeStr`) and date (`#dateStr`), right-aligned, updated every 15s

Date & Time was removed from the stat card grid and lives here instead.

## Home Page Stat Cards

Three stat cards in `.home-stats-secondary`, each with a small `.stat-icon` pill (green-tinted, Lucide SVG):
- **Today's Sales** - dollar sign icon; live total with animated count-up; trending arrow vs yesterday
- **Transactions** - receipt icon; today's count with % badge vs yesterday; increments locally on each sale
- **Cashier** - person icon; shows active cashier's first name; clickable to switch

## Active Queue Section (Home Page)

Always-visible inline list below the stat cards. Powered by `kdsView.js` targeting `#openOrdersList`. Previously called "Open Orders".
- Shows up to 8 rows (`PREVIEW_COUNT`); "View All" button appears when there are more
- Rows show: order number, type badge (Dine In / Takeout - hidden when setting is off), item count, time, status badge, Done button
- Status badges update every second via `_tickKDS`:
  - Normal → "Preparing" (no emoji)
  - Warning (yellow threshold) → "⏰ Delayed"
  - Urgent (red threshold) → "🔥 Urgent"
- Real-time updates pushed from main window via `KDS_QUEUE_SYNC` channel message

## KDS Popup (`kds-display.html`)

Card-based kitchen display. Timer shows elapsed time; emojis added at thresholds:
- Normal → `1:23`
- Warning → `⏰ 3:45`
- Urgent → `🔥 6:12`

**Initial load**: On open, `kds-display.js` queries Supabase directly (using `pointbunny_business_id` from `localStorage`) for today's unprepared sales. This avoids all race conditions with the main window's load sequence. After initial load, real-time updates arrive via the broadcast channel (`KDS_QUEUE_SYNC`).

**Status indicator**: Header shows a pulsing amber "Syncing…" dot until the DB query returns, then flips to a solid green "Live" dot.

**Order type badges**: Cards show a colored pill (Dine In = green, Takeout = purple) when the Dine In / Takeout setting is enabled.

## Settings

### Settings Tabs

| Tab | ID | Visible to |
|---|---|---|
| My Profile | `profile` | All roles |
| Business | `business` | Admin only |
| POS | `pos` | All roles |
| Order Queue Timers | `kds` | All roles |
| Displays | `displays` | All roles |

Non-admins default to the **Profile** tab on open. Admins default to **Business**.

**Profile tab** - lets any user update their first and last name (writes to `staff.first_name` / `staff.last_name`). After save the cashier stat card re-renders via `_updateCashierDisplay()`.

**Email OTP verification** - both Profile saves and Business Details saves require email verification before the write goes through:
1. User fills form, clicks "Save Changes"
2. `model.sendSettingsVerification()` calls `supabase.auth.signInWithOtp({ email, shouldCreateUser: false })` - sends a 6-digit code
3. Save row hides; `.settings-otp-step` reveals (inline, not a modal)
4. User enters code → `model.confirmSettingsVerification(email, token)` calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`
5. On success: actual DB write runs; save row restores

**Phone pre-fill fix** - `controlOpenSettings` calls `SettingsView.openWithRole()` first (which initialises `_phoneIti`) before `syncBusinessInfo()` so the phone field is populated on first open.

**Address fields bug fix** - `controlSaveBusinessInfo` now maps `address/city/state/zip` → `addressStreet/addressCity/addressProvince/addressZip` when calling `model.saveBusinessInfo`.

Settings are persisted to `localStorage` and loaded into `model.state.settings` at startup.

| Key | Default | Description |
|---|---|---|
| `pointbunny_printing_enabled` | `true` | Receipt printing on/off |
| `pointbunny_confirm_print` | `true` | Ask "did it print?" before recording sale |
| `pointbunny_print_two_copies` | `false` | Print customer + business copy |
| `pointbunny_order_type_enabled` | `true` | Show Dine In / Takeout selector on checkout |
| `pointbunny_kds_yellow` | `180` | Seconds before order turns yellow |
| `pointbunny_kds_red` | `300` | Seconds before order turns red |
| `pointbunny_kds_auto` | `900` | Seconds before order auto-completes |
| `pointbunny_business_id` | - | Set at login; used by KDS popup to query Supabase directly |

**`orderTypeEnabled`**: When off, the Dine In / Takeout toggle is hidden from checkout, `orderType` is stored as `null`, and no type label appears on receipts, the active queue, or KDS cards.

## Reports / Analytics Dashboard

Full analytics panel in `reportsView.js`, opened via `controlOpenReports`. Data is fetched with `model.fetchReportsSales` + `model.fetchCashflowData` (for expenses) in parallel and processed entirely in controller helpers before being passed to the view.

### Layout
`rp-layout` (flex row) → `rp-sidebar` (310px, `rp-nav-tab` buttons) + `rp-body` (scrollable content). Four sidebar sections, each a `<div class="rp-section" data-section="...">` toggled by `_switchSection()`:

| Section | `data-section` | Contents |
|---|---|---|
| Overview | `overview` | 5 KPI toggle cards + multi-metric line/area chart |
| Sales | `sales` | 3 peak cards (Best Seller, Top Category, Top Staff) + Top Items + Category Mix + Item Mix + Staff Performance |
| Traffic | `traffic` | 2 peak cards (Most Active Hour, Most Active Day) + Hourly Breakdown + Day of Week |
| Kitchen | `kitchen` | Avg Serving Time KPI + Serving Time by Hour + Serving Time by Day |

### Overview KPI Cards (toggleable)
The 5 cards in `.rp-kpi-strip` (Revenue, Expenses, Net Income, Transactions, Avg Order) each have `data-metric` + `style="--metric-color: #hex"`. Clicking a card calls `controlToggleMetric(metric)` which adds/removes it from `_selectedOverviewMetrics` and redraws the chart. The active card gets `.rp-kpi--selected` (colored bottom bar + border ring).

### Charts (all Chart.js, code-split via dynamic import)
Chart instances are stored in `reportsView._charts = {}` and destroyed before redraw. **Never replace the innerHTML of a container holding a `<canvas>`** - this destroys the DOM node. Use `canvas.style.display` toggle + a lazily-created sibling `<p>` for empty states.

| Chart | Key | Canvas ID | Notes |
|---|---|---|---|
| Overview (multi-metric) | `revenue` | `rpRevenueCanvas` | Smooth line/area; multi-dataset; dual Y-axes (currency left, transactions right); rendered by `renderOverviewChart()` not `renderCharts()` |
| Category Mix | `category` | `rpCategoryCanvas` | Donut, revenue by category |
| Item Mix | `itemMix` | `rpItemMixCanvas` | Donut, units sold per item (top 8); tooltip shows count + % |
| Hourly Breakdown | `hourly` | `rpHourlyCanvas` | Green bars, 24h labels |
| Day of Week | `dow` | `rpDowCanvas` | Green bars, Mon–Sun; `isEmpty` flag when period < 2 days |
| Serving Time by Hour | `servingHour` | `rpServingHourCanvas` | Orange (`#f59e0b`) bars; Y-axis in minutes; null data = empty state |
| Serving Time by Day | `servingDay` | `rpServingDayCanvas` | Orange bars, Mon–Sun; peak bar fully highlighted |

`renderCharts()` renders category, itemMix, hourly, dow, servingHour, servingDay. The overview chart is rendered separately via `_renderOverviewChart()` after `renderCharts()` completes.

### Compare Mode
Toggle via `_compareModeActive`. Type options: Day vs Day / Week vs Week / Month vs Month / Year vs Year / Custom Range. Both Period A and Period B are user-selectable with matching granularity pickers. `_getRangeFromValue(type, value)` converts picker values to ISO ranges. KPI values colored green (winner) / red (loser) via `.rp-cmp-kpi-val--up` / `.rp-cmp-kpi-val--down` CSS classes.

### `_activateCard(cardId, phId, wrapId, badgeId)`
Removes the `rp-card--ph` skeleton class, hides the placeholder, shows the chart wrap, and hides the badge. Call this at the top of every chart renderer.

## Project Direction

This is being built into a **full commercial POS product**. Keep in mind:

- Backend is Supabase (Postgres + Auth + Storage + Realtime)
- Multi-staff, multi-role support is live
- `model.js` now contains real production queries - treat it as production code
- Data shapes should be maintained with an API contract in mind
- Offline mode / sync is a future consideration (`salesBasket` kept as foundation)

## Admin Panel Changelog (Required)

Any time a backend change is made - new table, new column, new storage bucket, new RLS policy, schema change of any kind - **always add an entry to `pointbunny-admin-updates.md`** before finishing the task.

This file is the admin panel team's source of truth for what migrations to run and what new data to handle. Every entry must include:
- The SQL migration (full `CREATE TABLE` or `ALTER TABLE` statement)
- Any required grants and RLS policies
- What the admin panel needs to do with the new data (read, write, display)

If a task has no backend changes, no entry is needed.

Reports/Analytics is **implemented** (multi-metric overview chart with KPI toggles, category mix, item mix, hourly, day-of-week, serving time charts + compare mode + sales/traffic/kitchen peak stat cards).

## Auth Flow

The auth overlay (`#authOverlay`) contains a card with five panels inside `#authFormsWrapper`:

| Panel ID | Shown when |
|---|---|
| `loginForm` | Default (visible on load) |
| `signUpForm` | User clicks "Create one" (business owners only) |
| `forgotForm` | User clicks "Forgot password?" |
| `inviteForm` | URL hash contains `type=invite` (staff accepted invite email) |
| `resetForm` | URL hash contains `type=recovery` (user clicked reset email link) |

`authView.js` manages all five panels. `_slideTo(fromEl, toEl, direction, makeWide)` handles the animated transition between any two panels. The wide card style (`auth-card--wide`) is only applied when sliding to the signup form.

**Two registration paths - strictly separated:**
- **Owner path:** Uses `signUpForm` → `supabase.auth.signUp()` → email confirmation → `_initBusiness` creates businesses row + 3 default roles + owner staff row on first `initApp`.
- **Staff path:** Owner invites via Staff panel → `inviteStaff` creates a pending staff row in DB (no `user_id`) + calls `invite-staff` Edge Function which sends invite email via `admin.inviteUserByEmail()`. Staff clicks link → `type=invite` hash → `inviteForm` shown (set password + optional PIN) → on submit: `updatePassword()` then `initApp` → `loadBusinessContext` finds pending row by email, claims it by writing `user_id`.

**Recovery flow:** `initAuth()` checks `window.location.hash.includes('type=recovery')` before calling `getSession()`. If true, it shows the auth overlay + reset form immediately and returns early (skips `initApp`).

**Invite flow:** `initAuth()` checks `window.location.hash.includes('type=invite')` next. If true and a session exists (Supabase sets one automatically from the invite token), shows `inviteForm`. `controlAcceptInvite` handles password + PIN submission.

**Error handling:** Both `controlSignIn` and `initAuth` wrap `initApp` in try/catch. On failure, the loading screen is hidden, the session is cleared, and the user is returned to the login form with an error message.

**`_initBusiness` (model.js):** Runs only for brand new business owners (no staff row found, no pending invite by email). Creates: businesses row (with computed name), 3 default roles (Admin/Manager/Cashier), owner staff row. Invited staff always skip this - `loadBusinessContext` finds their pending row by email first.

**Edge Function:** `supabase/functions/invite-staff/index.ts` - Deno/TypeScript. Uses service role key to call `admin.inviteUserByEmail`. Must be deployed via Supabase CLI (`supabase functions deploy invite-staff`). Set `SITE_URL` env var in Supabase Dashboard → Edge Functions → invite-staff → Secrets.

## Email (Resend)

Custom SMTP configured in Supabase Auth: `smtp.resend.com:465`, username `resend`, API key as password. Sending domain: `pointbunny.com` (DNS verified in Porkbun). Branded HTML templates are live in Supabase → Authentication → Email Templates for:
- **Confirm signup** - uses `{{ .ConfirmationURL }}`
- **Reset password** - uses `{{ .ConfirmationURL }}`
- **Invite user** - uses `{{ .ConfirmationURL }}`

Redirect URLs allowlisted in Supabase → Authentication → URL Configuration: `https://pointbunny.com`, `https://www.pointbunny.com`, `https://pointybunny-staging.netlify.app`, `http://localhost:1234`.

## Queued Work (not started, do when user asks)

### CSS Technical Debt Cleanup
`pointbunny.css` has accumulated significant debt:
- No z-index scale - values like 1060, 9999, 99999 scattered with no system. Plan: define a CSS custom property z-index ladder (`--z-modal`, `--z-dropdown`, `--z-toast`, etc.)
- Duplicate rule blocks - `.modal-backdrop` and `.modal-overlay-form` each defined twice; second definition silently wins. The CLAUDE.md note "CSS cascade gotcha" documents this.
- Excessive `!important` usage fighting specificity wars instead of a clean cascade
- Orphaned/dead selectors from removed features

**Do not mix this into feature work.** Dedicate a standalone pass when the user is ready.

### Phone SMS Verification (settings)
The Business tab phone field previously had a "SMS verification coming soon" note (now removed). When building OTP verification:
- The hook point is `controlSaveBusinessInfo` in `controller.js` - add an OTP step there before calling `model.saveBusinessInfo`
- No schema changes needed; the `businesses.phone` column already exists

### PostHog Analytics (items 2, 4, 5 from todos)
Waiting on the user's PostHog account setup before wiring in event tracking.
