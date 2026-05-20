# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start    # Dev server via Parcel (serves index.html with hot reload)
npm build    # Production build → dist/
```

No test or lint commands are configured.

## Architecture

**Pointy** is a POS (Point of Sale) SPA built with vanilla JavaScript (ES6 modules) and Parcel as the bundler. No framework (no React/Vue). State is backed by **Supabase** (auth + Postgres database).

The app follows a strict **MVC** pattern:

### Model (`Javascript/model.js`)
Single source of truth. Holds a `state` object and all Supabase query functions. All data mutations go through here — views never call Supabase directly.

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
- `_generateMarkUp()` — returns HTML string
- `render(data)` — injects markup into the DOM
- `_addHandler*(handler)` — wires controller callback to a DOM event

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
- `_yesterdayTotal` — cached yesterday's sales total (fetched once at login)
- `_todayTransactionCount` / `_yesterdayTransactionCount` — transaction counts for the stat card badge
- `_cmpRangeA` / `_cmpRangeB` — active compare period ranges `{ startISO, endISO, label }`
- `_compareModeActive` — boolean, true when the compare panel is open

`initApp()` stores `pointy_business_id` to `localStorage` after loading business context so the KDS popup can query Supabase directly without depending on the main window.

**Reports helpers in controller:**
- `_getRangeFromValue(type, value)` — converts a type (`"day"/"week"/"month"/"year"`) + raw input value into `{ startISO, endISO, label }`. Week snaps Mon–Sun.
- `_computeRevenueOverTime(period, startISO, endISO)` — hourly buckets for day, daily for week/month, monthly for year
- `_computeCategoryMix()` — revenue by category
- `_computeHourlyBreakdown()` — revenue by hour of day
- `_computeDayOfWeek(period)` — revenue Mon–Sun; returns `{ labels, data, isEmpty: true }` when period is too narrow (today/yesterday)
- `_computeServingTimeStats()` — avg serving minutes from `prepared_at - sale_date`; returns `{ avgMinutes, byHour: { labels, data }, byDay: { labels, data } }` or `null` if no KDS data; sanity filter: 0–120 min

### Entry point (`index.html`)
All modal HTML templates are defined directly in `index.html` as hidden elements. Views target specific `id`/`class` selectors to render into or toggle visibility. The edit menu modal is an exception — dynamically injected into `.edit-form-parent` by `menuEditView.js`.

### Styling (`pointy.css`)
Single unified stylesheet using CSS custom properties for theming. Theme switching (light/dark) handled in `Javascript/pointy.js`, persisted to `localStorage`. Key variables: `--radius-lg: 28px`, `--panel-strong`, `--shadow-lg`, `--brand-1` (green), `--text`, `--muted`.

**CSS cascade gotcha:** Several overlay classes (`.modal-overlay-form`, `.modal-backdrop`) have duplicate definitions later in the file that override earlier media queries. Mobile responsive overrides must be placed immediately after the duplicate definition, not in the central responsive block at line ~1071.

### Channel (`Javascript/channel.js`)
Supabase Realtime broadcast channel (`self: false`) used for cross-window sync between the main POS, KDS popup, and CFD popup. Also wraps a native `BroadcastChannel` for same-browser reliability. Exposes a `ready` Promise that resolves when the Supabase subscription is `SUBSCRIBED`.

**Important:** The KDS popup does NOT use the channel for its initial queue load — it queries Supabase directly (see KDS section below). The channel handles real-time deltas only (new orders pushed in, orders marked done).

### External displays
- `kds-display.js` / `kds-display.html` — Kitchen Display System popup
- `customer-display.js` / `customer-display.html` — Customer-Facing Display popup

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

**`sales.sale_date`**: Stored as UTC ISO string from `new Date(Date.now()).toISOString()`. All date range queries use local-time midnight boundaries converted with `.toISOString()` — this correctly handles timezone offsets.

Both `fetchReportsSales` and `fetchReportsSalesRaw` select `prepared_at` so serving time stats are available in reports.

### Supabase Data API Grant Policy (enforced Oct 30, 2026)

Pointy uses `supabase-js` (the Data API). From Oct 30, 2026 all existing projects require **explicit grants on every new table**. Existing tables are unaffected — new columns on existing tables inherit the table's grants.

**Every new table migration must include:**

```sql
grant select, insert, update, delete on public.your_table to authenticated;
alter table public.your_table enable row level security;
-- then add RLS policies scoped to auth.uid() / businessId
```

Without the grant, PostgREST returns a `42501` error and `supabase-js` queries silently fail.

## Home Page Stat Cards

Four stat cards on the home page, each with a small `.stat-icon` pill (green-tinted, Lucide SVG):
- **Today's Sales** — dollar sign icon; live total with animated count-up; trending arrow vs yesterday
- **Date & Time** — clock icon; single combined card updated every 15s
- **Transactions** — receipt icon; today's count with % badge vs yesterday; increments locally on each sale
- **Cashier** — person icon; shows active cashier's first name; clickable to switch

## Active Queue Section (Home Page)

Always-visible inline list below the stat cards. Powered by `kdsView.js` targeting `#openOrdersList`. Previously called "Open Orders".
- Shows up to 8 rows (`PREVIEW_COUNT`); "View All" button appears when there are more
- Rows show: order number, type badge (Dine In / Takeout — hidden when setting is off), item count, time, status badge, Done button
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

**Initial load**: On open, `kds-display.js` queries Supabase directly (using `pointy_business_id` from `localStorage`) for today's unprepared sales. This avoids all race conditions with the main window's load sequence. After initial load, real-time updates arrive via the broadcast channel (`KDS_QUEUE_SYNC`).

**Status indicator**: Header shows a pulsing amber "Syncing…" dot until the DB query returns, then flips to a solid green "Live" dot.

**Order type badges**: Cards show a colored pill (Dine In = green, Takeout = purple) when the Dine In / Takeout setting is enabled.

## Settings

Settings are persisted to `localStorage` and loaded into `model.state.settings` at startup.

| Key | Default | Description |
|---|---|---|
| `pointy_printing_enabled` | `true` | Receipt printing on/off |
| `pointy_confirm_print` | `true` | Ask "did it print?" before recording sale |
| `pointy_print_two_copies` | `false` | Print customer + business copy |
| `pointy_order_type_enabled` | `true` | Show Dine In / Takeout selector on checkout |
| `pointy_kds_yellow` | `180` | Seconds before order turns yellow |
| `pointy_kds_red` | `300` | Seconds before order turns red |
| `pointy_kds_auto` | `900` | Seconds before order auto-completes |
| `pointy_business_id` | — | Set at login; used by KDS popup to query Supabase directly |

**`orderTypeEnabled`**: When off, the Dine In / Takeout toggle is hidden from checkout, `orderType` is stored as `null`, and no type label appears on receipts, the active queue, or KDS cards.

## Reports / Analytics Dashboard

Full analytics panel in `reportsView.js`, opened via `controlOpenReports`. Data is fetched with `model.fetchReportsSales` and processed entirely in controller helpers before being passed to the view.

### Charts (all Chart.js, code-split via dynamic import)
Chart instances are stored in `reportsView._charts = {}` and destroyed before redraw. **Never replace the innerHTML of a container holding a `<canvas>`** — this destroys the DOM node. Use `canvas.style.display` toggle + a lazily-created sibling `<p>` for empty states.

| Chart | Key | Canvas ID | Notes |
|---|---|---|---|
| Revenue Over Time | `revenue` | `rpRevenueCanvas` | Green bars; hourly/daily/monthly axis depending on period |
| Category Mix | `category` | `rpCategoryCanvas` | Green bars by category |
| Hourly Breakdown | `hourly` | `rpHourlyCanvas` | Green bars, 24h labels |
| Day of Week | `dow` | `rpDowCanvas` | Green bars, Mon–Sun; `isEmpty` flag when period < 2 days |
| Serving Time by Hour | `servingHour` | `rpServingHourCanvas` | Orange (`#f59e0b`) bars; Y-axis in minutes; null data = empty state |
| Serving Time by Day | `servingDay` | `rpServingDayCanvas` | Orange bars, Mon–Sun; peak bar fully highlighted |

### Compare Mode
Toggle via `_compareModeActive`. Type options: Day vs Day / Week vs Week / Month vs Month / Year vs Year / Custom Range. Both Period A and Period B are user-selectable with matching granularity pickers. `_getRangeFromValue(type, value)` converts picker values to ISO ranges. KPI values colored green (winner) / red (loser) via `.rp-cmp-kpi-val--up` / `.rp-cmp-kpi-val--down` CSS classes.

### `_activateCard(cardId, phId, wrapId, badgeId)`
Removes the `rp-card--ph` skeleton class, hides the placeholder, shows the chart wrap, and hides the badge. Call this at the top of every chart renderer.

## Project Direction

This is being built into a **full commercial POS product**. Keep in mind:

- Backend is Supabase (Postgres + Auth + Storage + Realtime)
- Multi-staff, multi-role support is live
- `model.js` now contains real production queries — treat it as production code
- Data shapes should be maintained with an API contract in mind
- Offline mode / sync is a future consideration (`salesBasket` kept as foundation)

## Known Incomplete Features

These have UI buttons but no implementation: Inventory, Scan Item, Drawer operations, Refund, Z Report.

Reports/Analytics is **implemented** (revenue, category, hourly, day-of-week, serving time charts + compare mode).
