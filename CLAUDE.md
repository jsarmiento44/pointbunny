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
| `kdsView.js` | Home page open orders list (inline, not a modal) |
| `cashflowView.js` | Cashflow panel |
| `staffView.js` | Staff management |
| `settingsView.js` | Settings panel |
| `receiptView.js` | Receipt printing |
| `discountView.js` | Discount/promo codes |

### Controller (`Javascript/controller.js`)
Wires model and views together. `initApp()` is the app entry point after auth. Key controller-level variables:
- `_yesterdayTotal` — cached yesterday's sales total (fetched once at login)
- `_todayTransactionCount` / `_yesterdayTransactionCount` — transaction counts for the stat card badge

### Entry point (`index.html`)
All modal HTML templates are defined directly in `index.html` as hidden elements. Views target specific `id`/`class` selectors to render into or toggle visibility. The edit menu modal is an exception — dynamically injected into `.edit-form-parent` by `menuEditView.js`.

### Styling (`pointy.css`)
Single unified stylesheet using CSS custom properties for theming. Theme switching (light/dark) handled in `Javascript/pointy.js`, persisted to `localStorage`. Key variables: `--radius-lg: 28px`, `--panel-strong`, `--shadow-lg`, `--brand-1` (green), `--text`, `--muted`.

**CSS cascade gotcha:** Several overlay classes (`.modal-overlay-form`, `.modal-backdrop`) have duplicate definitions later in the file that override earlier media queries. Mobile responsive overrides must be placed immediately after the duplicate definition, not in the central responsive block at line ~1071.

### Channel (`Javascript/channel.js`)
Supabase Realtime broadcast channel (`self: false`) used for cross-window sync between the main POS, KDS popup, and CFD popup. Exposes a `ready` Promise that resolves when the subscription is `SUBSCRIBED` — display windows must `await channel.ready` before sending sync requests to avoid race conditions.

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

**`sales.prepared_at`**: NULL = order is active (shown in KDS/open orders). Set to a timestamp when the kitchen marks it done via `recordServeTime()`.

**`sales.sale_date`**: Stored as UTC ISO string from `new Date(Date.now()).toISOString()`. All date range queries use local-time midnight boundaries converted with `.toISOString()` — this correctly handles timezone offsets.

## Home Page Stat Cards

Four stat cards on the home page, each with a small `.stat-icon` pill (green-tinted, Lucide SVG):
- **Today's Sales** — dollar sign icon; live total with animated count-up; trending arrow vs yesterday
- **Date & Time** — clock icon; single combined card updated every 15s
- **Transactions** — receipt icon; today's count with % badge vs yesterday; increments locally on each sale
- **Cashier** — person icon; shows active cashier's first name; clickable to switch

## Open Orders Section (Home Page)

Always-visible inline list below the stat cards. Powered by `kdsView.js` targeting `#openOrdersList`.
- Shows up to 5 rows; "View All" button appears when there are more
- Rows show: order number, type (Dine In / Takeout), item count, time, status badge, Done button
- Status badges update every second via `_tickKDS`:
  - Normal → "Preparing" (no emoji)
  - Warning (yellow threshold) → "⏰ Delayed"
  - Urgent (red threshold) → "🔥 Urgent"
- Synced with KDS popup via broadcast channel

## KDS Popup (`kds-display.html`)

Card-based kitchen display. Timer shows elapsed time; emojis added at thresholds:
- Normal → `1:23`
- Warning → `⏰ 3:45`
- Urgent → `🔥 6:12`

## Project Direction

This is being built into a **full commercial POS product**. Keep in mind:

- Backend is Supabase (Postgres + Auth + Storage + Realtime)
- Multi-staff, multi-role support is live
- `model.js` now contains real production queries — treat it as production code
- Data shapes should be maintained with an API contract in mind
- Offline mode / sync is a future consideration (`salesBasket` kept as foundation)

## Known Incomplete Features

These have UI buttons but no implementation: Summary/Reports, Scan Item, Drawer operations, Refund, Z Report.
