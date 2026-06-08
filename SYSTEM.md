# SYSTEM.md — Pointbunny POS: Architecture & Feature Workflows

> Living reference for the full system. Every feature traces from user action → view handler → controller function → model mutation → re-render, plus a function-level quick reference for each feature so devs know exactly what to touch.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Map](#2-module-map)
3. [Full State Shape](#3-full-state-shape)
4. [Cross-Cutting: BroadcastChannel Messages](#4-cross-cutting-broadcastchannel-messages)
5. [Feature Workflows](#5-feature-workflows)
   - [5.1 Authentication](#51-authentication)
   - [5.2 New Order](#52-new-order)
   - [5.3 Checkout & Receipt](#53-checkout--receipt)
   - [5.4 Per-Receipt Adjustments](#54-per-receipt-adjustments)
   - [5.5 Promo / Discount Codes (at checkout)](#55-promo--discount-codes-at-checkout)
   - [5.6 Menu Management](#56-menu-management)
   - [5.7 Settings](#57-settings)
   - [5.8 Auto Adjustments (Settings)](#58-auto-adjustments-settings)
   - [5.9 Cashflow & Reporting](#59-cashflow--reporting)
   - [5.10 Discount Code Management](#510-discount-code-management)
   - [5.11 Staff Management](#511-staff-management)
   - [5.12 Cashier Switcher](#512-cashier-switcher)
   - [5.13 Kitchen Display System (KDS)](#513-kitchen-display-system-kds)
   - [5.14 Customer Facing Display (CFD)](#514-customer-facing-display-cfd)
   - [5.15 Reports / Analytics Dashboard](#515-reports--analytics-dashboard)
   - [5.16 Help & Support](#516-help--support)
   - [5.17 Shifts, Timesheets & Pay Summary](#517-shifts-timesheets--pay-summary)

---

## 1. Architecture Overview

**Pointbunny** is a SPA (Single Page Application) following a strict **MVC** pattern. Persistence is via **Supabase** (Postgres DB + Auth + Storage + Realtime).

**Production:** `https://pointbunny.com` — hosted on Netlify, deployed from the `wip` branch via `netlify.toml` (`npm run build` → `dist/`). Domain registered on Porkbun; DNS uses an ALIAS record pointing to `apex-loadbalancer.netlify.com`. Supabase Auth is configured with site URL and redirect URLs set to `https://pointbunny.com`. Environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) are set in the Netlify dashboard — not committed to the repo.

```
User Action
    ↓
View (event listener, _addHandler*)
    ↓
Controller (control* function)
    ↓
Model (mutates state.*)
    ↓
Controller re-renders the relevant View
```

- **No framework.** Vanilla JS (ES6 modules), bundled by Parcel.
- **No persistent local state.** All state lives in the `state` object (`model.js`) and resets on reload. Persistence is via Supabase.
- **No direct View→Model calls.** Views only call handlers passed to them by the controller.
- **External displays** (KDS window, CFD window) communicate via `PointbunnyChannel` — a thin wrapper around Supabase Realtime.

---

## 2. Module Map

| File | Class/Export | Owns |
|---|---|---|
| `model.js` | `state`, named functions | All data, all DB calls, state mutations |
| `controller.js` | `init()` entry point + all `control*` functions | Wires views to model; handles app logic |
| `channel.js` | `PointbunnyChannel` (default export `channel`) | Realtime messaging between cashier app and KDS/CFD windows |
| `Views/view.js` | `View` (base class) | `render()`, `renderSpinner()`, confirm modal, success overlay |
| `Views/authView.js` | `AuthView` | Login/signup forms, loading states, animations |
| `Views/newOrderView.js` | `NewOrderView` | Order modal: category tabs, item grid, cart sidebar |
| `Views/newOrderItemView.js` | `NewOrderItemView` | Item detail modal: variants, quantity, add-to-cart |
| `Views/orderCheckoutView.js` | `OrderCheckOutView` | Checkout: cart summary, adjustments, payment, receipt print |
| `Views/menuListView.js` | `MenuListView` | Read-only menu browsing modal |
| `Views/menuEditView.js` | `MenuEditView` | Edit existing menu item form (dynamically injected) |
| `Views/newMenuItemView.js` | `NewMenuItemView` | Add new menu item form with variant builder |
| `Views/settingsView.js` | `SettingsView` | Settings panel: categories, adjustments, toggles, display config |
| `Views/cashflowView.js` | `CashflowView` | Cashflow panel: summary cards, sales list, expenses, export |
| `Views/receiptView.js` | `ReceiptView` | Thermal receipt generator (80mm format) + popup print |
| `Views/kdsView.js` | `KDSView` | Home page Open Orders inline list: rows, timers, status badges, done button |
| `Views/discountView.js` | `DiscountView` | Discount code management panel |
| `Views/staffView.js` | `StaffView` | Staff management panel |
| `Views/reportsView.js` | `ReportsView` | Reports/Analytics dashboard: KPI strip, charts, compare mode |
| `Views/supportView.js` | `SupportView` | Help & Support panel: ticket list, thread view, reply composer, post-ticket rating |
| `timeclock.js` | module-level functions | Standalone time clock page: device activation, staff auth, PIN setup, clock in/out/break state machine, PIN/password confirmation on clock-out |

---

## 3. Full State Shape

```js
state = {
  // Auth & identity
  userId,            // Supabase auth user ID
  businessId,        // The owner's userId — scopes all DB queries
  username,          // Display name
  role,              // User's role name string
  currentStaff,      // { id, firstName, lastName, email, role } — logged-in staff record
  currentCashier,    // Active cashier for the shift (can differ from currentStaff)

  // Staff & roles
  staff,             // [{ id, firstName, lastName, email, role, status, isSelf }]
  roles,             // [{ id, name }]
  employees,         // legacy array (mapped separately from staff)

  // Menu
  menuItems,         // [{ itemName, price, category, _id, imageURL, _stock, hasVariants, variants, description, isActive }]
  menuCategories,    // ['drinks', 'food', ...]   — always lowercase

  // Active order
  cart,              // [{ itemName, price, imageURL, selectedVariants, id, date, quantity, totalPrice }]

  // Checkout (in-flight)
  currentReceiptAdjustments,  // [{ id, name, type, calculation, value, appliedValue, enabled, removed }]
  currentPromoCode,           // { discountCodeId, adjId, code, title, type, value } | null

  // Sales & reporting
  salesBasket,       // Temporary holder (foundation for offline/sync mode)
  cashflowSales,     // Non-voided sales fetched for the current cashflow date range
  voidedSales,       // Voided sales for current cashflow range (voided_at IS NOT NULL)
  expenses,          // Expense records fetched for current range
  reportsSales,      // Sales for the current reports period → state.reportsSales (set by model.fetchReportsSales)

  // Discount codes
  discountCodes,     // [{ id, code, title, description, type, value, status, usageCount, usageLimit }]

  // Help & Support tickets
  tickets,           // [{ id, category, subject, message, attachments, status, hasUnreadReply, hasBizReply, solvedAt, createdAt, rating, ratingComment, ratedAt, replies: [] }]

  // KDS / Open Orders
  orderQueue,        // [{ id, saleDate, items, startedAt, totalPrice, orderType, ticketNumber }] — sales where prepared_at IS NULL

  // Shifts / Timesheets (planned — not yet in use)
  currentShift,      // { id, staffId, clockedInAt } | null — active shift for the current cashier
  shifts,            // [{ id, staffId, clockedInAt, clockedOutAt, durationMinutes, note }] — fetched for timesheet view

  // Settings
  settings: {
    adjustments,              // [{ id, name, type, calculation, value, enabled }]
    showRemovedAdjustments,   // bool — whether struck-through removals appear on receipt
    printingEnabled,          // bool
    confirmPrint,             // bool — ask before printing
    printTwoCopies,           // bool — print customer copy + business copy on every sale
    kdsYellowThreshold,       // seconds before order card turns yellow
    kdsRedThreshold,          // seconds before order card turns red
    kdsAutoCompleteThreshold, // seconds before order auto-completes
    kdsWindowSize,            // { width, height }
    cfdWindowSize,            // { width, height }
    orderTypeEnabled,         // bool — show Dine In / Takeout selector on checkout
  }
}
```

---

## 4. Cross-Cutting: Channel Messages

`channel.js` exposes a `PointbunnyChannel` instance that sends and receives over **two parallel transports**:

| Transport | Mechanism | When it's used |
|---|---|---|
| **Native `BroadcastChannel`** (`pointbunny-local`) | Browser API, synchronous, zero-network | Same-browser windows (KDS popup, CFD popup on the same machine) |
| **Supabase Realtime** (`pointbunny-displays`, `self: false`) | WebSocket via Supabase | Cross-device scenarios; fallback if `BroadcastChannel` is unavailable |

Every `channel.postMessage(data)` call sends on **both** transports simultaneously. The receiving window's `onmessage` handler fires on whichever arrives first; all handlers are idempotent so a second delivery is harmless.

`channel.ready` resolves when the Supabase subscription hits `SUBSCRIBED` (BroadcastChannel is always immediately ready).

All external display windows use the same channel instance via the shared `channel.js` module.

| Message type (`MSG.*`) | Direction | Payload | What triggers it |
|---|---|---|---|
| `CFD_CART_UPDATE` | Cashier → CFD | `{ cart, total }` | Any cart mutation (add, delete, clear) |
| `CFD_SALE_COMPLETE` | Cashier → CFD | `{}` | Transaction finalized |
| `CFD_REQUEST_SYNC` | CFD → Cashier | `{}` | CFD window opened / loaded |
| `KDS_QUEUE_SYNC` | Cashier → KDS | `{ queue, thresholds }` | New order placed, order done, KDS requests sync |
| `KDS_REQUEST_SYNC` | KDS → Cashier | `{}` | KDS window opened / loaded |
| `KDS_ORDER_DONE` | KDS → Cashier | `{ id }` | Cook taps Done button in KDS window |
| `KDS_ORDER_VOIDED` | Cashier → KDS | `{ id }` | Transaction voided from cashflow panel — removes from KDS popup queue |

**Controller message router** (`channel.onmessage`):
- `KDS_REQUEST_SYNC` → sends current `state.orderQueue` + thresholds back
- `KDS_ORDER_DONE` → calls `controlMarkOrderDone(id)`
- `KDS_ORDER_VOIDED` → `kds-display.js` filters the order from its local queue
- `CFD_REQUEST_SYNC` → calls `_broadcastCart()` with current cart

---

## 5. Feature Workflows

> **Home Page Layout** — two-column layout (`.home-layout`):
> - **Left column** — New Order CTA (`.home-cta`), action row with Cashier card (`#cashierCard`) + Activity card, shortcuts grid (Catalogue, Adjustments, Inventory coming-soon, Staff, Reports, Help)
> - **Right column** — unified quick-dashboard card (`home-dash-card`) + Active Queue section (`home-queue-panel`)
>
> **Quick Dashboard Card** (`home-dash-card`) — three inline stats with emoji icons, each clickable to the matching Reports section:
> - **Today's Sales** (💰 `#totalStr`) — animated count-up via `_animateSalesTotal`; trending badge (`#salesVsYesterday`) vs yesterday, loaded once at login via `model.loadYesterdaySalesTotal()` and cached in `_yesterdayTotal`; click → `controlOpenReports('sales')`
> - **Transactions** (🧾 `#basketCountStr`) — today's count with badge (`#basketsVsYesterday`) vs yesterday; counts fetched once at login via `model.loadTransactionCounts()`, cached in `_todayTransactionCount` / `_yesterdayTransactionCount`; increments locally by 1 after each `_finaliseSale`; click → `controlOpenReports('traffic')`
> - **Avg. Serving** (⏱️ `#homeAvgServing`) — today's average KDS serving time (formatted as `Xm Ys`); vs-yesterday badge (`#homeServingVs`); loaded via `_loadServingComparison()` which calls `model.fetchPeriodTotals()` for today + yesterday; shows `—` if no KDS data; click → `controlOpenReports('kitchen')`
>
> **Cashier Card** (`#cashierCard`, `.home-cashier-card`) — `#shiftStr` shows active cashier first name; clickable to switch via `controlSwitchCashier()`

---

### 5.1 Authentication

#### Auth Form Panels

The `#authFormsWrapper` contains 4 sliding panels. Only one is visible at a time; transitions use `_slideTo(fromEl, toEl, direction, makeWide)`.

| Panel ID | Panel | Triggered by |
|---|---|---|
| `#loginForm` | Sign in | Default; back links from Forgot |
| `#signUpForm` | Sign up | "Create account" link |
| `#forgotForm` | Forgot password | "Forgot password?" link |
| `#resetForm` | Set new password | Detected `type=recovery` URL hash on load |

#### Sign In

```
User submits login form
  → authView._addHandlerSignIn  [authView.js]
  → controlSignIn(email, password)  [controller.js]
    → supabase.auth.signInWithPassword()
    → authView.playSignInSuccess()  [animation]
    → try { await initApp(user) }
      → model.loadBusinessContext(user)
          → supabase.from('staff').select()
          → sets state.userId, businessId, role, currentStaff
          → _initBusiness(user)  [if first owner login — creates business + default roles]
      → model.loadMenuItems()       → state.menuItems
      → model.loadMenuCategories()  → state.menuCategories
      → model.loadAdjustments()     → state.settings.adjustments
      → model.loadDiscountCodes()   → state.discountCodes
      → model.loadTodaySalesTotal() → #totalStr display
      → model.loadOrderQueue()      → state.orderQueue
      → localStorage.setItem('pointbunny_business_id', state.businessId)  [used by KDS popup for direct DB load]
      → authView.hide()
      → _wireApp()  [wires all view handlers to controller functions]
    → catch (err):
        hideLoadingScreen()
        supabase.auth.signOut()
        AuthView.show()
        AuthView.showError('Something went wrong. Please sign in again.')
```

#### Sign Up

```
User submits signup form
  → authView._addHandlerSignUp  [validates all fields]
  → controlSignUp({ firstName, lastName, email, password })
    → supabase.auth.signUp()
    → authView.showCheckEmail(email)  [replaces form with confirmation message]
```

#### Forgot Password

```
User clicks "Forgot password?" link
  → authView slides loginForm → forgotForm

User submits forgot form (email)
  → authView._addHandlerForgotPassword
  → controlForgotPassword(email)
    → model.sendPasswordResetEmail(email)
        → supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    → authView.showForgotSent(email)  [shows "Check your email" confirmation]

User clicks reset link in email (redirected back to app with #type=recovery in URL hash)
  → initAuth() detects window.location.hash.includes('type=recovery')
  → AuthView.show()
  → AuthView.showResetPassword()  [slides to #resetForm panel]
  → returns early — skips session check and initApp
```

#### Reset Password

```
User submits new password in #resetForm
  → authView._addHandlerResetPassword
  → controlResetPassword(password, confirmPassword)
    → validates password ≥ 6 chars
    → validates passwords match
    → model.updatePassword(password)
        → supabase.auth.updateUser({ password })
    → authView.showResetSuccess()  [shows "Password updated" with link to sign in]
```

#### Sign Out

```
User clicks sign out
  → controlSignOut()
    → [destroys analytics session]
    → supabase.auth.signOut()
    → window.location.reload()
```

#### `_initBusiness(user)` — First-Login Business Setup

Runs only for brand new owner accounts (no staff row found AND no pending invite found by email). Creates:
1. `businesses` row (upsert by `id = user.id`) — `name` from `user.user_metadata.business_name || "First Last".trim() || user.email || 'My Business'`
2. Three default roles: Admin, Manager, Cashier
3. Owner `staff` row (status: `active`)

Does NOT run for invited staff — they claim their pending row earlier in `loadBusinessContext`.

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerSignIn(handler)` | authView.js | Listens on `#loginForm` submit |
| `controlSignIn(email, password)` | controller.js | Orchestrates sign-in; try/catch around `initApp` signs out + shows error on failure |
| `authView.playSignInSuccess()` | authView.js | Card scale/fade animation before app loads |
| `initApp(user)` | controller.js | Loads all initial state, calls `_wireApp` |
| `model.loadBusinessContext(user)` | model.js | Sets `state.userId`, `businessId`, `role`, `currentStaff` |
| `model._initBusiness(user)` | model.js | Creates business + default roles on very first owner login |
| `model.loadMenuItems()` | model.js | Fetches items from DB → `state.menuItems` |
| `model.loadMenuCategories()` | model.js | Fetches categories → `state.menuCategories` |
| `model.loadAdjustments()` | model.js | Fetches auto-adjustments → `state.settings.adjustments` |
| `model.loadDiscountCodes()` | model.js | Fetches codes → `state.discountCodes` |
| `model.loadTodaySalesTotal()` | model.js | Returns today's total for `#totalStr` |
| `model.loadOrderQueue()` | model.js | Fetches unprepared sales → `state.orderQueue` |
| `authView.hide()` | authView.js | Hides `#authOverlay` |
| `_wireApp()` | controller.js | Master handler wiring — connects all views to controller |
| `_addHandlerSignUp(handler)` | authView.js | Listens on `#signUpForm` submit, validates all fields |
| `controlSignUp(data)` | controller.js | Calls `supabase.auth.signUp` |
| `authView.showCheckEmail(email)` | authView.js | Replaces form with check-email confirmation |
| `controlSignOut()` | controller.js | Signs out, reloads page |
| `_addHandlerForgotPassword(handler)` | authView.js | Listens on `#forgotForm` submit |
| `controlForgotPassword(email)` | controller.js | Calls `model.sendPasswordResetEmail`; shows sent confirmation |
| `model.sendPasswordResetEmail(email)` | model.js | `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin })` |
| `authView.showForgotSent(email)` | authView.js | Replaces forgot form with "check your email" message |
| `authView.showResetPassword()` | authView.js | Slides to `#resetForm` panel (called from `initAuth` on `type=recovery` URL) |
| `_addHandlerResetPassword(handler)` | authView.js | Listens on `#resetForm` submit |
| `controlResetPassword(password)` | controller.js | Validates, calls `model.updatePassword`, shows success |
| `model.updatePassword(newPassword)` | model.js | `supabase.auth.updateUser({ password: newPassword })` |
| `authView.showResetSuccess()` | authView.js | Shows "Password updated" confirmation with link back to login |
| `authView._slideTo(from, to, dir, wide)` | authView.js | General-purpose panel slide animation; `_slide(dir)` delegates to this |

---

### 5.2 New Order

#### Open Order Modal

```
User clicks "New Order"
  → newOrderView._addHandlerShowMenuModal
  → controlNewOrder()
    → newOrderView.render({ menuItems: state.menuItems, cart: state.cart, menuCategories })
```

#### Select an Item

```
User clicks item card
  → newOrderItemView._addHandlerShowItemModal  [listens on .item-card]
  → controlDisplayMenuItem(id)
    → finds item in state.menuItems by id
    → newOrderItemView._itemModalContentUpdate(item)
      → populates modal: name, price, image, variant groups
      → resets _basket, _qty = 1, _variants = []
```

#### Choose Variants & Quantity

```
User taps variant chip
  → newOrderItemView._selectSingleVariantListener  [one per group]
  → or _selectMultipleVariantListener  [many per group]
  → toggles .selected CSS class on chip

User taps +/− quantity buttons
  → newOrderItemView._adjustQuantity()
  → updates newOrderItemView._qty
```

#### Add to Cart

```
User clicks "Add to Cart"
  → newOrderItemView._pushToCart(handler)
    → _findSelectedVariants()  [builds _variants array from .selected chips]
    → passes _basket + _qty + _variants to handler
  → controlPushToModelCart()
    → validates _basket is set
    → calculates totalPrice = (basePrice + variant prices) × qty
    → pushes item to state.cart
    → _broadcastCart()  [sends CFD_CART_UPDATE]
    → newOrderView.render(updated state)
    → newOrderItemView closes modal
```

#### Delete Cart Item (from Order View)

```
User clicks trash on cart item
  → newOrderView._addHandlerDeleteCartItem
  → controlDeleteCartItemInOrder(index)
    → model.deleteCartItem(index)  [splices state.cart]
    → _broadcastCart()
    → newOrderView.render(updated state)
```

#### Close / Discard Order

```
User clicks close button
  → newOrderView._addHandlerCloseModal
  → controlCloseOrderModal(close)
    → if state.cart.length > 0:
        shows confirm dialog ("Discard order?")
        on confirm: clearCart() → state.cart = [] → _broadcastCart() → close modal
    → else: close immediately
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerShowMenuModal(handler)` | newOrderView.js | Listens on `#newOrderBtn` click |
| `controlNewOrder()` | controller.js | Entry point — renders order modal |
| `newOrderView.render(data)` | newOrderView.js | Injects full order modal HTML into `.modal-parent` |
| `_addHandlerShowItemModal(handler)` | newOrderItemView.js | Listens on `.item-card` clicks, shows item modal |
| `controlDisplayMenuItem(id)` | controller.js | Finds item in `state.menuItems`, populates detail modal |
| `_itemModalContentUpdate(item)` | newOrderItemView.js | Renders name, price, image, variant groups in modal |
| `_selectSingleVariantListener()` | newOrderItemView.js | Enforces one selection per variant group |
| `_selectMultipleVariantListener()` | newOrderItemView.js | Allows multiple selections per variant group |
| `_adjustQuantity()` | newOrderItemView.js | Handles `+`/`−` buttons, updates `_qty` |
| `_pushToCart(handler)` | newOrderItemView.js | Collects selections, calls handler with basket data |
| `_findSelectedVariants()` | newOrderItemView.js | Builds `_variants[]` from `.selected` chip DOM state |
| `controlPushToModelCart()` | controller.js | Calculates price with variants, pushes to `state.cart` |
| `_broadcastCart()` | controller.js | `channel.postMessage(CFD_CART_UPDATE, { cart, total })` |
| `_addHandlerDeleteCartItem(handler)` | newOrderView.js | Listens on `.cart-item-delete-btn` |
| `controlDeleteCartItemInOrder(index)` | controller.js | Deletes cart item from order view |
| `model.deleteCartItem(index)` | model.js | Splices `state.cart[index]` |
| `_addHandlerCloseModal(handler)` | newOrderView.js | Listens on modal close button |
| `controlCloseOrderModal(close)` | controller.js | Shows discard confirm if cart has items |
| `clearCart()` | controller.js | Resets `state.cart = []` |

---

### 5.3 Checkout & Receipt

#### Open Checkout

```
User clicks "Checkout"
  → orderCheckoutView._addHandlerShowCheckout
  → controlOrderCheckout()
    → validates state.cart is non-empty
    → model.initReceiptAdjustments()
        → copies enabled adjustments → state.currentReceiptAdjustments
        → resets state.currentPromoCode = null
    → calculates subtotal from state.cart
    → model.calculateAdjustments(subtotal, state.currentReceiptAdjustments)
        → returns { subtotal, lineItems, finalTotal }
        → discounts applied first, then fees, on running total
    → orderCheckoutView.render({ cart, adjResult, settings, ... })
```

#### Enter Payment

```
User enters amount and clicks "Calculate Change"
  → orderCheckoutView._subtractChange()
    → reads _customerPayment from input
    → calculates _customerChange = payment − finalTotal
    → shows change | reveals #printReceiptBtn
```

#### Delete Cart Item (from Checkout)

```
User clicks trash on cart item in checkout
  → orderCheckoutView._addHandlerDeleteCartItem
  → controlDeleteCartItemInCheckout(index)
    → model.deleteCartItem(index)
    → if state.cart is now empty:
        clearCart() → close checkout modal
    → else:
        _refreshCheckoutAdj()  [recalculates with new subtotal]
        _broadcastCart()
```

#### Go Back to Order

```
User clicks back arrow
  → orderCheckoutView._addHandlerBack
  → controlGoBackToOrder()
    → model.clearReceiptAdjustments()
    → controlNewOrder()  [re-renders new order modal with current cart]
```

#### Conclude Transaction (Print & Save)

```
User clicks "Print Receipt" / "Complete Sale"
  → orderCheckoutView._addHandlerPrintReceipt
  → controlConcludeTransaction()
    → validates customerPayment ≥ finalTotal
    → if settings.confirmPrint:
        shows confirm dialog first
    → if settings.printingEnabled:
        receiptView.print(sale)
          → opens popup window
          → writes thermal receipt HTML (80mm format)
          → calls window.print() after 300ms
          → returns Promise resolving on afterprint
    → _finaliseSale(sale, note)
        → _buildSale()  [assembles full sale object from cart + checkout state]
        → supabase.from('sales').insert(sale)  [persists to DB]
        → if state.currentPromoCode:
            model.redeemDiscountCode(id)  [increments usage_count in DB]
        → adds to state.orderQueue (for KDS)
        → channel.postMessage(KDS_QUEUE_SYNC)  [notifies kitchen]
        → channel.postMessage(CFD_SALE_COMPLETE)  [notifies CFD]
        → clearCart()  [state.cart = []]
        → model.clearReceiptAdjustments()
        → _broadcastCart()  [CFD shows empty cart]
        → refreshTodaySalesDisplay()  [animates #totalStr update]
        → view._showSuccess("Order complete!")
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerShowCheckout(handler)` | orderCheckoutView.js | Listens on `.btn-checkout` click |
| `controlOrderCheckout()` | controller.js | Initializes adjustments, calculates totals, renders checkout |
| `model.initReceiptAdjustments()` | model.js | Copies enabled adjustments → `state.currentReceiptAdjustments`, clears promo |
| `model.calculateAdjustments(subtotal, adjs)` | model.js | Returns `{ subtotal, lineItems, finalTotal }` — discounts first, then fees |
| `orderCheckoutView.render(data)` | orderCheckoutView.js | Full checkout layout: cart, adjustments, payment fields |
| `_subtractChange()` | orderCheckoutView.js | Reads payment input, calculates change, reveals print button |
| `_addHandlerDeleteCartItem(handler)` | orderCheckoutView.js | Listens on `.checkout-cart-delete-btn` |
| `controlDeleteCartItemInCheckout(index)` | controller.js | Deletes item; closes modal if cart empties, else refreshes |
| `_addHandlerBack(handler)` | orderCheckoutView.js | Listens on `.checkout-back-btn` |
| `controlGoBackToOrder()` | controller.js | Clears adjustments, re-renders order modal |
| `_addHandlerPrintReceipt(handler)` | orderCheckoutView.js | Listens on `#printReceiptBtn` |
| `controlConcludeTransaction()` | controller.js | Validates payment, prints, calls `_finaliseSale` |
| `receiptView.print(sale)` | receiptView.js | Opens popup window, writes HTML, calls `window.print()` |
| `receiptView._generateReceiptHTML(sale)` | receiptView.js | Generates 80mm thermal receipt HTML with all line items |
| `_finaliseSale(sale, note)` | controller.js | Inserts to DB, redeems promo, pushes to KDS queue |
| `_buildSale()` | controller.js | Assembles complete sale object from cart + checkout state |
| `model.redeemDiscountCode(id)` | model.js | Increments `usage_count` in DB |
| `clearCart()` | controller.js | Resets `state.cart = []` |
| `model.clearReceiptAdjustments()` | model.js | Clears `state.currentReceiptAdjustments` and `currentPromoCode` |
| `refreshTodaySalesDisplay()` | controller.js | Fetches new total, animates `#totalStr` |
| `_animateSalesTotal(el, from, to)` | controller.js | Number counting animation on sales total element |

---

### 5.4 Per-Receipt Adjustments

These are in-flight modifications to the auto-applied adjustments for a single checkout session.

#### Edit an Adjustment Value

```
User clicks edit (pencil) on adjustment row
  → orderCheckoutView._addHandlerReceiptEdit
  → controlReceiptEdit(id)
    → orderCheckoutView._showReceiptEditForm(adj)  [inline form appears]

User saves the override
  → orderCheckoutView._addHandlerReceiptSaveOverride
  → controlSaveReceiptOverride({ id, value })
    → model.overrideReceiptAdjustment(id, newValue)
        → mutates state.currentReceiptAdjustments[id].appliedValue
    → _refreshCheckoutAdj()
        → model.calculateAdjustments(subtotal, currentReceiptAdjustments)
        → orderCheckoutView._refreshAdjustments(...)  [in-place DOM update]
```

#### Remove an Adjustment

```
User clicks × on adjustment row
  → orderCheckoutView._addHandlerReceiptRemove
  → controlRemoveReceiptAdj(id)
    → model.removeReceiptAdjustment(id)  [sets removed: true on adjustment]
    → _refreshCheckoutAdj()
```

#### Add a One-Off Manual Adjustment

```
User clicks "+ Add Adjustment"
  → orderCheckoutView._addHandlerReceiptAddManual
  → controlShowReceiptAddManualForm()
    → orderCheckoutView._showReceiptAddManualForm()  [overlay form appears]

User fills out form and saves
  → orderCheckoutView._addHandlerReceiptSaveManual
  → controlSaveManualReceiptAdj({ name, type, calculation, value })
    → model.addManualReceiptAdjustment(data)
        → generates unique ID
        → pushes to state.currentReceiptAdjustments
        → returns adjustment object
    → _refreshCheckoutAdj()
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerReceiptEdit(handler)` | orderCheckoutView.js | Listens on `.receipt-adj-edit-btn` |
| `controlReceiptEdit(id)` | controller.js | Shows inline edit form for adjustment |
| `_showReceiptEditForm(adj)` | orderCheckoutView.js | Renders inline override form inside adjustment row |
| `_addHandlerReceiptSaveOverride(handler)` | orderCheckoutView.js | Listens on `#receiptEditSaveBtn` |
| `controlSaveReceiptOverride({ id, value })` | controller.js | Applies override, refreshes checkout totals |
| `model.overrideReceiptAdjustment(id, value)` | model.js | Mutates `state.currentReceiptAdjustments[id].appliedValue` |
| `_refreshCheckoutAdj()` | controller.js | Recalculates total, in-place updates adjustment section |
| `orderCheckoutView._refreshAdjustments(...)` | orderCheckoutView.js | In-place DOM update of adjustments (keeps payment input intact) |
| `_addHandlerReceiptRemove(handler)` | orderCheckoutView.js | Listens on `.receipt-adj-remove-btn` |
| `controlRemoveReceiptAdj(id)` | controller.js | Marks adjustment removed, refreshes |
| `model.removeReceiptAdjustment(id)` | model.js | Sets `removed: true` on `state.currentReceiptAdjustments[id]` |
| `_addHandlerReceiptAddManual(handler)` | orderCheckoutView.js | Listens on `.receipt-add-adj-btn` |
| `controlShowReceiptAddManualForm()` | controller.js | Shows manual adjustment overlay form |
| `_showReceiptAddManualForm()` | orderCheckoutView.js | Renders overlay form on top of checkout |
| `_addHandlerReceiptSaveManual(handler)` | orderCheckoutView.js | Listens on `#receiptManualSaveBtn` |
| `controlSaveManualReceiptAdj(data)` | controller.js | Adds manual adjustment to receipt, refreshes |
| `model.addManualReceiptAdjustment(data)` | model.js | Generates unique ID, pushes to `state.currentReceiptAdjustments` |

---

### 5.5 Promo / Discount Codes (at checkout)

#### Apply a Code

```
User types code and clicks "Apply"
  → orderCheckoutView._addHandlerApplyPromo
  → controlApplyPromoCode(code)
    → model.validateDiscountCode(code)
        → searches state.discountCodes (case-insensitive)
        → throws if: not found | status !== 'active' | usageCount ≥ usageLimit
    → model.applyPromoCodeToReceipt(dc)
        → creates a discount adjustment from the code
        → sets state.currentPromoCode = { discountCodeId, adjId, code, title, type, value }
        → pushes adjustment to state.currentReceiptAdjustments
        → returns adjustment
    → _refreshCheckoutAdj()
        → orderCheckoutView._generatePromoSection()  [shows applied promo chip]
```

#### Remove a Code

```
User clicks × on promo chip
  → orderCheckoutView._addHandlerRemovePromo
  → controlRemovePromoCode()
    → model.removePromoCodeFromReceipt()
        → removes promo adjustment from state.currentReceiptAdjustments
        → state.currentPromoCode = null
    → _refreshCheckoutAdj()
```

*(The code's `usage_count` in DB is only incremented on `_finaliseSale()`, not on apply.)*

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerApplyPromo(handler)` | orderCheckoutView.js | Listens on `#applyPromoBtn` |
| `controlApplyPromoCode(code)` | controller.js | Validates and applies promo code to receipt |
| `model.validateDiscountCode(code)` | model.js | Checks status and usage limit in `state.discountCodes`; throws if invalid |
| `model.applyPromoCodeToReceipt(dc)` | model.js | Creates adjustment, sets `state.currentPromoCode`, pushes to adjustments |
| `_refreshCheckoutAdj()` | controller.js | Recalculates total, updates promo section in view |
| `_generatePromoSection(promoCode, adjResult)` | orderCheckoutView.js | Renders applied promo chip or input field |
| `_addHandlerRemovePromo(handler)` | orderCheckoutView.js | Listens on `#removePromoBtn` |
| `controlRemovePromoCode()` | controller.js | Removes promo from receipt, refreshes totals |
| `model.removePromoCodeFromReceipt()` | model.js | Removes promo adjustment from adjustments array, nullifies `state.currentPromoCode` |
| `model.redeemDiscountCode(id)` | model.js | Increments `usage_count` in DB — called only on `_finaliseSale`, not on apply |

---

### 5.6 Menu Management

#### Browse Menu (Read-Only)

```
User clicks "Menu" nav button
  → menuListView._addHandlerShowModal
  → controlMenuList()
    → menuListView.render({ menuItems: state.menuItems, menuCategories })
```

#### Add New Item

```
User clicks "Add Item"
  → newMenuItemView._toggleModalOpen()  [opens #addMenuModal]

User fills form, picks category, optionally adds variants
  → newMenuItemView._addVariantSet()
      → parses variant form fields
      → pushes to _addedVariants[]
      → renders preview chips

User submits form
  → newMenuItemView._uploadItem(handler)
      → collects FormData
  → controlUploadItem(data)
    → validates category (creates new if "new-category" selected)
    → model.uploadNewMenuItem(newItem)
        → uploadImage(file)  [uploads to Supabase Storage, returns publicUrl]
        → supabase.from('menu_items').insert(...)
        → pushes to state.menuItems
    → controlMenuList()  [re-renders menu list]
    → newMenuItemView._formReset()  [clears form, closes modal]
```

#### Edit Existing Item

```
User clicks item card in Menu List
  → menuEditView._showEditMenuForm(handler)
  → controlShowEditMenu(id)
    → finds item in state.menuItems
    → menuEditView._insertEditMenuMarkup(item)
        → renders full edit form with all fields pre-populated
        → wires variant add/remove handlers
        → wires image preview handler
        → wires _addHandlerHasVariantsToggle

User edits fields, submits
  → menuEditView._updateItemData(handler)
      → reads FormData
  → model.updateMenuItem(id, rawData)
      → model.parseVariants(raw)  [rebuilds variant structure from FormData]
      → if new image: uploadImage(file)
      → supabase.from('menu_items').update(...)
      → mutates item in state.menuItems[]
    → controlMenuList()  [re-renders]
```

#### Delete Item

```
User clicks "Delete" in edit form
  → menuEditView._addHandlerDeleteItem
  → controlDeleteMenuItem(id)
    → shows confirm dialog
    → model.deleteMenuItem(id)
        → supabase.from('menu_items').delete().eq('id', id)
        → splices from state.menuItems
    → controlMenuList()  [re-renders]
```

#### Add / Delete Category

Category management lives in the **Menu List modal** (not Settings). The category bar shows chips for each category; a text input + "+ Add" button appends new ones.

```
User types new category name and clicks "+ Add" (in Menu List or Add Item form)
  → menuListView._addHandlerAddCategory / newMenuItemView inline handler
  → controlAddCategoryFromMenuList(name) / controlAddNewCategory(name)
    → model.addCategory(name)
        → validates uniqueness + non-empty
        → supabase.from('menu_categories').insert(...)
        → pushes lowercase name to state.menuCategories
    → menuListView.render(state)  [re-renders chip bar + item groups]

User clicks × on a category chip (Menu List)
  → menuListView._addHandlerDeleteCategory
  → controlDeleteCategory(name)
    → model.deleteCategory(name)
        → updates all items in that category to category = 'uncategorized'
            → supabase.from('menu_items').update({ category: 'uncategorized' }).eq('category', name)
            → mutates category on matching items in state.menuItems
        → supabase.from('menu_categories').delete()
        → removes from state.menuCategories
    → menuListView.render(state)  [re-renders; items appear in Uncategorized group]
```

**Uncategorized items:** Items with `category === 'uncategorized'`, no category, or a category that was deleted appear in a grey-labelled "Uncategorized" group at the bottom of both the Menu List modal and the New Order item picker. The `'uncategorized'` value is virtual — it never appears as a user-deletable chip.

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerShowModal(handler)` | menuListView.js | Listens on `#menu-list` click |
| `controlMenuList()` | controller.js | Renders menu browse modal |
| `menuListView.render(data)` | menuListView.js | Injects menu modal HTML into `.modal-parent` |
| `_toggleModalOpen()` | newMenuItemView.js | Opens `#addMenuModal` |
| `_addVariantSet()` | newMenuItemView.js | Parses variant form, pushes to `_addedVariants[]`, renders preview |
| `_addVariantOption()` | newMenuItemView.js | Adds an option row to the variant form |
| `_showVariantModal()` | newMenuItemView.js | Shows variant builder modal on `#showVariantField` click |
| `_variantModalHide()` | newMenuItemView.js | Closes variant builder modal |
| `_itemVariantsToggle()` | newMenuItemView.js | `#hasVariantsCheckbox` change — shows/hides variants section |
| `_uploadItem(handler)` | newMenuItemView.js | Collects FormData on form submit, calls handler |
| `controlUploadItem(data)` | controller.js | Validates category, calls model, re-renders menu |
| `model.uploadNewMenuItem(newItem)` | model.js | Uploads image, inserts to DB, pushes to `state.menuItems` |
| `model.uploadImage(file, existingUrl)` | model.js | Uploads to Supabase Storage, returns `publicUrl` |
| `_formReset()` | newMenuItemView.js | Clears all inputs + `_addedVariants`, closes modal |
| `_addFileUploadListener()` | newMenuItemView.js | Validates image type on file input change, shows filename |
| `_showEditMenuForm(handler)` | menuEditView.js | Listens on `.card` clicks in menu list |
| `controlShowEditMenu(id)` | controller.js | Finds item in state, renders edit form |
| `_insertEditMenuMarkup(item)` | menuEditView.js | Renders full pre-populated edit form into `.edit-form-parent` |
| `_mapMenuCategoriesMarkUp(categories, selected)` | menuEditView.js | Populates category `<select>` in edit form |
| `_addHandlerHasVariantsToggle()` | menuEditView.js | Listens on `[name="hasVariants"]` — shows/hides variants section |
| `_showVariantsToggleConfirm(onConfirm)` | menuEditView.js | Warns before deleting variants when toggling off |
| `_addVariantGroup()` | menuEditView.js | Adds a new variant group row to edit form |
| `_addOption()` | menuEditView.js | Adds an option row inside a variant group |
| `_deleteVariant()` | menuEditView.js | Removes a variant group from edit form |
| `_deleteOption()` | menuEditView.js | Removes an option row from a variant group |
| `_reindexVariants()` | menuEditView.js | Rebuilds form field `name` attributes to keep indices correct after add/remove |
| `_updateItemData(handler)` | menuEditView.js | Reads FormData on submit, calls handler |
| `model.updateMenuItem(id, rawData)` | model.js | Parses variants, re-uploads image if new, updates DB + `state.menuItems` |
| `model.parseVariants(raw)` | model.js | Converts FormData variant fields into variant array shape |
| `_addHandlerDeleteItem(handler)` | menuEditView.js | Listens on `.edit-delete-btn` |
| `controlDeleteMenuItem(id)` | controller.js | Confirms deletion, calls model, re-renders |
| `model.deleteMenuItem(id)` | model.js | Deletes from DB, splices `state.menuItems` |
| `controlAddNewCategory(name)` | controller.js | Creates category, updates all open dropdowns |
| `controlAddCategoryFromMenuList(name)` | controller.js | Adds category from Menu List chip bar, re-renders menu list |
| `model.addCategory(name)` | model.js | Validates uniqueness, inserts to DB, pushes to `state.menuCategories` |
| `menuListView._addHandlerAddCategory(handler)` | menuListView.js | Listens on `#menuAddCategoryBtn` click and Enter key on `#menuCategoryInput` |
| `menuListView._addHandlerDeleteCategory(handler)` | menuListView.js | Listens on `.menu-cat-delete` chip button clicks (event-delegated) |
| `controlDeleteCategory(name)` | controller.js | Calls model to reassign items then delete category, re-renders menu list |
| `model.deleteCategory(name)` | model.js | Reassigns items to 'uncategorized' in DB + state, then deletes category from DB |

---

### 5.7 Settings

#### Open Settings

```
User clicks settings gear icon
  → settingsView._addHandlerOpen
  → controlOpenSettings()
    → settingsView renders / syncs:
        - adjustment list (state.settings.adjustments)
        - printing toggle (state.settings.printingEnabled)
        - confirmPrint toggle (state.settings.confirmPrint)
        - printTwoCopies toggle (state.settings.printTwoCopies)
        - showRemovedAdjustments toggle
        - KDS thresholds (yellow, red, auto)
        - KDS & CFD window size selectors
        - CFD ad image section
```

Note: Category management was moved out of Settings and into the Menu List modal (§5.6).

#### Toggle: Dine In / Takeout

```
User flips order type toggle
  → settingsView._addHandlerToggleOrderType
  → controlToggleOrderType(value)
    → state.settings.orderTypeEnabled = value
    → localStorage.setItem('pointbunny_order_type_enabled', value)
```

When off: the Dine In / Takeout selector is hidden from checkout, `orderType` is stored as `null`, and no type label appears on receipts, the Active Queue rows, or KDS cards.

#### Toggle: Printing Enabled

```
User flips printing toggle
  → settingsView._addHandlerTogglePrinting
  → controlTogglePrinting(value)
    → state.settings.printingEnabled = value
    → localStorage.setItem('printingEnabled', value)
```

#### Toggle: Confirm Before Print

```
User flips confirmPrint toggle
  → controlToggleConfirmPrint(value)
    → state.settings.confirmPrint = value
    → localStorage.setItem('confirmPrint', value)
```

When the confirm dialog appears, it includes a hint: _"You can turn this prompt off in Settings → Printing."_

#### Toggle: Print 2 Copies

```
User flips "Print 2 Copies" toggle
  → settingsView._addHandlerToggleTwoCopies
  → controlTogglePrintTwoCopies(value)
    → state.settings.printTwoCopies = value
    → localStorage.setItem('pointbunny_print_two_copies', value)

On transaction conclude (if printTwoCopies is true):
  → controlConcludeTransaction() prints receipt once (customer copy)
  → then calls ReceiptView.print(sale) a second time (business copy)
```

#### KDS Thresholds

```
User changes yellow/red/auto threshold inputs
  → settingsView._addHandlerKDSThresholds
  → controlSaveKDSThresholds({ yellow, red, auto })
    → state.settings.kdsYellowThreshold = yellow
    → state.settings.kdsRedThreshold = red
    → state.settings.kdsAutoCompleteThreshold = auto
    → localStorage saves all three
```

#### Display Window Sizes

```
User changes KDS or CFD window size selector
  → settingsView._addHandlerDisplaySizes
  → controlSaveKDSWindowSize(size) or controlSaveCFDWindowSize(size)
    → state.settings.kdsWindowSize = { width, height }
    → localStorage saves
```

#### CFD Ad Image

```
User uploads image
  → settingsView._addHandlerCFDAdUpload
  → controlUploadCFDAd(file)
    → model.uploadCFDAdImage(file)
        → uploadImage(file)  [Supabase Storage]
        → localStorage.setItem('cfdAdUrl', publicUrl)
    → settingsView.showCFDAdPreview(url)

User clicks remove
  → controlRemoveCFDAd()
    → model.removeCFDAdImage()
        → localStorage.removeItem('cfdAdUrl')
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerOpen(handler)` | settingsView.js | Listens on `#settingsBtn` click |
| `controlOpenSettings()` | controller.js | Syncs all settings toggles and renders adjustment list |
| `settingsView.renderAdjustments(adjustments)` | settingsView.js | Lists all adjustments with toggle, edit, delete |
| `syncPrintingToggle(value)` | settingsView.js | Sets `#printingToggle` checkbox state from `state` |
| `_addHandlerTogglePrinting(handler)` | settingsView.js | Listens on `#printingToggle` change |
| `controlTogglePrinting(value)` | controller.js | Updates `state.settings.printingEnabled` + localStorage |
| `syncConfirmPrintToggle(value)` | settingsView.js | Sets `#confirmPrintToggle` checkbox state |
| `_addHandlerToggleConfirmPrint(handler)` | settingsView.js | Listens on `#confirmPrintToggle` change |
| `controlToggleConfirmPrint(value)` | controller.js | Updates `state.settings.confirmPrint` + localStorage |
| `syncTwoCopiesToggle(value)` | settingsView.js | Sets `#twoCopiesToggle` checkbox state |
| `_addHandlerToggleTwoCopies(handler)` | settingsView.js | Listens on `#twoCopiesToggle` change |
| `controlTogglePrintTwoCopies(value)` | controller.js | Updates `state.settings.printTwoCopies` + localStorage (`pointbunny_print_two_copies`) |
| `syncOrderTypeToggle(value)` | settingsView.js | Sets `#orderTypeToggle` checkbox state |
| `_addHandlerToggleOrderType(handler)` | settingsView.js | Listens on `#orderTypeToggle` change |
| `controlToggleOrderType(value)` | controller.js | Updates `state.settings.orderTypeEnabled` + localStorage (`pointbunny_order_type_enabled`) |
| `syncKDSThresholds(yellow, red, auto)` | settingsView.js | Populates threshold inputs from state |
| `_addHandlerKDSThresholds(handler)` | settingsView.js | Listens on threshold input changes |
| `controlSaveKDSThresholds({ yellow, red, auto })` | controller.js | Updates all three thresholds in state + localStorage |
| `syncDisplaySizes(kdsSize, cfdSize)` | settingsView.js | Populates size selectors from state |
| `_sizeToOption(size)` | settingsView.js | Maps `{ width, height }` to preset option value |
| `_addHandlerDisplaySizes(kdsHandler, cfdHandler)` | settingsView.js | Listens on size selector changes |
| `controlSaveKDSWindowSize(size)` | controller.js | Updates `state.settings.kdsWindowSize` + localStorage |
| `controlSaveCFDWindowSize(size)` | controller.js | Updates `state.settings.cfdWindowSize` + localStorage |
| `_addHandlerCFDAdUpload(handler)` | settingsView.js | Listens on `#cfdAdInput` change |
| `controlUploadCFDAd(file)` | controller.js | Uploads image, stores URL in localStorage |
| `model.uploadCFDAdImage(file)` | model.js | Calls `uploadImage`, stores URL in localStorage |
| `showCFDAdPreview(url)` | settingsView.js | Shows image preview in settings |
| `_addHandlerCFDAdRemove(handler)` | settingsView.js | Listens on `#cfdAdRemoveBtn` click |
| `controlRemoveCFDAd()` | controller.js | Calls `model.removeCFDAdImage` |
| `model.removeCFDAdImage()` | model.js | Removes `cfdAdUrl` from localStorage |
| `_addHandlerClose()` | settingsView.js | Listens on `#settingsCloseBtn` and backdrop click |

---

### 5.8 Auto Adjustments (Settings)

These auto-apply to every checkout until manually overridden on a per-receipt basis (see §5.4).

#### Add Adjustment

```
User clicks "+ Add Adjustment"
  → settingsView._addHandlerAdd → settingsView.showForm()  [renders blank form]

User fills form (name, type: fee|discount, calculation: flat|percent, value) and saves
  → settingsView._addHandlerSave
  → controlSaveAdjustment(data)
    → model.addAdjustment(data)
        → supabase.from('adjustments').insert(...)
        → pushes to state.settings.adjustments
    → settingsView.renderAdjustments(state.settings.adjustments)
```

#### Edit Adjustment

```
User clicks edit button
  → settingsView._addHandlerEdit
  → controlEditAdjustment(id)
    → settingsView.showForm(adjustment)  [pre-populates form]

User saves
  → controlSaveAdjustment(data)  [same path — detects existing id → update]
    → model.updateAdjustment(id, data)
        → supabase.from('adjustments').update(...)
        → mutates item in state.settings.adjustments
```

#### Toggle Adjustment On/Off

```
User flips toggle on adjustment row
  → settingsView._addHandlerToggle
  → controlToggleAdjustment(id)
    → model.toggleAdjustment(id)
        → supabase.from('adjustments').update({ enabled: !current })
        → flips enabled flag in state.settings.adjustments
    → settingsView.renderAdjustments(...)
```

#### Delete Adjustment

```
User clicks delete
  → controlDeleteAdjustment(id)
    → model.deleteAdjustment(id)
        → supabase.from('adjustments').delete()
        → splices from state.settings.adjustments
    → settingsView.renderAdjustments(...)
```

#### How Adjustment Calculation Works

`model.calculateAdjustments(subtotal, adjustments)`:
1. Filters out `removed: true` adjustments
2. Processes **discounts first**, then **fees**, each on the running total
3. For each: `flat` = raw value deducted/added | `percent` = (value/100) × running total
4. Returns `{ subtotal, lineItems: [{ name, appliedValue, type }], finalTotal }`

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerAdd()` | settingsView.js | Listens on `#addAdjustmentBtn` click |
| `settingsView.showForm(adjustment)` | settingsView.js | Renders add/edit adjustment form (pass `null` for blank) |
| `settingsView._removeForm()` | settingsView.js | Clears the adjustment form from DOM |
| `settingsView._getFormData()` | settingsView.js | Returns form values as `{ name, type, calculation, value }` |
| `_addHandlerSave(handler)` | settingsView.js | Listens on `#adjSaveBtn` click |
| `controlSaveAdjustment(data)` | controller.js | Routes to `addAdjustment` or `updateAdjustment` based on id |
| `model.addAdjustment(data)` | model.js | Inserts to DB, pushes to `state.settings.adjustments` |
| `model.updateAdjustment(id, data)` | model.js | Updates DB, mutates item in `state.settings.adjustments` |
| `_addHandlerEdit(handler)` | settingsView.js | Listens on `.adjustment-edit-btn` click |
| `controlEditAdjustment(id)` | controller.js | Pre-populates form with existing adjustment |
| `_addHandlerToggle(handler)` | settingsView.js | Listens on `.adj-toggle` checkbox change |
| `controlToggleAdjustment(id)` | controller.js | Calls `model.toggleAdjustment`, re-renders list |
| `model.toggleAdjustment(id)` | model.js | Flips `enabled` in DB + `state.settings.adjustments` |
| `_addHandlerDelete(handler)` | settingsView.js | Listens on `.adjustment-delete-btn` click |
| `controlDeleteAdjustment(id)` | controller.js | Calls `model.deleteAdjustment`, re-renders list |
| `model.deleteAdjustment(id)` | model.js | Deletes from DB, splices `state.settings.adjustments` |
| `_addHandlerShowRemoved(handler)` | settingsView.js | Listens on `#showRemovedToggle` change |
| `controlShowRemoved(value)` | controller.js | Updates `state.settings.showRemovedAdjustments` |
| `model.calculateAdjustments(subtotal, adjs)` | model.js | Core math: discounts → fees on running total → returns `{ subtotal, lineItems, finalTotal }` |

---

### 5.9 Cashflow & Reporting

#### Open Cashflow Panel

The cashflow panel has three tabs: **Sales**, **Expenses**, **Voided**. `canEdit` (Admin or Manager) controls whether the "+ Add Expense" button is visible. The Void button on each sale row is always shown; non-editors see the override modal instead of a direct confirm.

```
User clicks "Cash Flow" nav button
  → cashflowView._addHandlerOpen
  → controlOpenCashflow()
    → _cashflowCanEdit()  [true if role is Admin or Manager]
    → cashflowView.open(canEdit)  [shows panel, hides/shows addExpenseBtn, resets to Sales tab]
    → cashflowView.renderLoading()
    → _getCashflowRange('today')  [returns { startISO, endISO, label }]
    → model.fetchCashflowData(startISO, endISO)
        → 3 parallel Supabase queries:
            sales (voided_at IS NULL) → state.cashflowSales
            expenses → state.expenses
            sales (voided_at IS NOT NULL) → state.voidedSales
    → cashflowView.renderSummary(_cashflowSummary())
        → _cashflowSummary() returns { gross, expenses, net }  (gross excludes voided)
    → _renderCashflowLists()
        → cashflowView.renderSalesList(state.cashflowSales, canEdit)
        → cashflowView.renderExpensesList(state.expenses, canEdit)
        → cashflowView.renderVoidedList(state.voidedSales, canEdit)
    → cashflowView.setPeriodLabel(label)
```

#### Change Period

```
User clicks period button (Today / Yesterday / Week / Month / Custom)
  → cashflowView._addHandlerPeriodChange  (or _addHandlerCustomRange for date picker)
  → controlChangePeriod({ period, from, to })
    → cashflowView.setLoading(true)  [disables all buttons including tabs]
    → _getCashflowRange(period, from, to)
    → model.fetchCashflowData(startISO, endISO)
    → cashflowView.renderSummary(...) + _renderCashflowLists()
    → cashflowView.setActivePeriod(period)
    → cashflowView.setLoading(false)
```

#### Void Transaction

Any staff can initiate a void. Admin/Manager get a confirmation dialog; Cashiers must supply a manager's email + password via the override modal.

```
User clicks "Void" on a sale row
  → cashflowView._addHandlerVoid
  → controlVoidTransaction(id)
    → if _cashflowCanEdit():
        cashflowView.showConfirmModal(...)
          → on confirm: _executeVoid(id, staffName)
    → else:
        cashflowView.showOverrideModal(async (email, password) => {
          model.verifyOverrideCredentials(email, password)
            → creates temp Supabase client (persistSession: false)
            → signs in, checks staff.roles.permissions.cashflow
            → signs out (scope: 'local' — does NOT affect other sessions)
            → returns authorizer's display name
          cashflowView.hideOverrideModal()
          _executeVoid(id, authorizerName)
        })

_executeVoid(id, voidedBy)
  → model.voidSale(id, voidedBy)
      → supabase UPDATE sales SET voided_at=now, voided_by=name WHERE id AND user_id
      → removes from state.orderQueue + state.cashflowSales
      → prepends to state.voidedSales
  → KDSView.renderQueue(state.orderQueue)
  → channel.postMessage(KDS_ORDER_VOIDED, { id })  [removes from KDS popup]
  → cashflowView.renderSummary(...) + _renderCashflowLists()
  → if sale was today: refreshTodaySalesDisplay() + decrement transaction badge
```

#### Restore Transaction

Restores a voided sale. Same Admin/Manager vs override pattern as Void.

```
User clicks "Restore" on a voided row (Voided tab)
  → cashflowView._addHandlerRestore
  → controlRestoreTransaction(id)
    → confirm or override modal (same pattern as Void)
    → _executeRestore(id)
        → model.restoreSale(id)
            → supabase UPDATE sales SET voided_at=NULL, voided_by=NULL
            → removes from state.voidedSales
            → prepends to state.cashflowSales (sorted by sale_date desc)
            → returns restored sale row
        → if restored sale has prepared_at=NULL: re-inserts into state.orderQueue
            → KDSView.renderQueue() + channel.postMessage(KDS_QUEUE_SYNC)
        → cashflowView.renderSummary(...) + _renderCashflowLists()
        → if sale was today: refreshTodaySalesDisplay() + increment transaction badge
```

#### Add Expense

```
User clicks "+ Add Expense" → fills form
  → cashflowView._addHandlerSubmitExpense
  → controlAddExpense({ amount, description, category, expense_date })
    → cashflowView.setSubmitting(true)
    → model.addExpense(data)
        → supabase.from('expenses').insert(...)
        → pushes to state.expenses
        → returns expense object
    → cashflowView.renderSummary(_cashflowSummary())  [updates net]
    → cashflowView.renderExpensesList(state.expenses)
    → cashflowView.hideExpenseModal()
    → cashflowView.scrollExpensesToTop()
```

#### Delete Expense

```
User clicks delete on expense row (with inline confirm)
  → cashflowView._addHandlerDeleteExpense
  → controlDeleteExpense(id)
    → model.deleteExpense(id)
        → supabase.from('expenses').delete()
        → splices from state.expenses
    → cashflowView.renderSummary(...)
    → cashflowView.renderExpensesList(...)
```

#### View Sale Receipt & Reprint

```
User clicks a sale row
  → cashflowView._addHandlerOpenSaleReceipt
  → controlOpenSaleReceipt(id)
    → finds sale in state.cashflowSales
    → cashflowView.showSaleReceipt(sale, onReprint)
        → creates receipt detail modal with a "Reprint Receipt" button

User clicks "Reprint Receipt"
  → closes the detail modal
  → controlReprintSale(sale)
    → maps DB sale shape (snake_case) to receipt shape (camelCase):
        sale_date → date, total_price → totalPrice, customer_payment → customerPayment
    → ReceiptView.print(mappedSale)  [opens print popup, no new transaction]
```

Note: No sale record is created or modified. This is purely a re-print of the stored data.

#### Export CSV

```
User clicks "Export CSV"
  → cashflowView._addHandlerExport
  → controlExportCSV()
    → _generateAndDownloadCSV()
        → formats sales & expenses into CSV rows
        → creates Blob → object URL → triggers download
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerOpen(handler)` | cashflowView.js | Listens on `[data-action='cash-flow']` click |
| `controlOpenCashflow()` | controller.js | Fetches today's data, renders full cashflow panel |
| `cashflowView.open(canEdit)` | cashflowView.js | Shows `#cashflowPanel`, toggles addExpenseBtn, resets to Sales tab |
| `cashflowView.renderLoading()` | cashflowView.js | Shows spinner in all three tab lists |
| `_getCashflowRange(period, from, to)` | controller.js | Calculates ISO date range from period name or custom dates |
| `model.fetchCashflowData(startISO, endISO)` | model.js | 3 parallel queries → `state.cashflowSales`, `state.expenses`, `state.voidedSales` |
| `_cashflowSummary()` | controller.js | Computes `{ gross, expenses, net }` — gross excludes voided sales |
| `_renderCashflowLists()` | controller.js | Calls renderSalesList + renderExpensesList + renderVoidedList with canEdit |
| `cashflowView.renderSummary({ gross, expenses, net })` | cashflowView.js | Updates summary stat cards with count-up animation |
| `cashflowView.renderSalesList(sales, canEdit)` | cashflowView.js | Renders clickable sale rows with ticket badge + Void button |
| `cashflowView.renderExpensesList(expenses, canEdit)` | cashflowView.js | Renders expense rows; delete button only shown when canEdit |
| `cashflowView.renderVoidedList(voidedSales, canEdit)` | cashflowView.js | Renders voided sale rows with voided-by info + Restore button |
| `controlVoidTransaction(id)` | controller.js | Confirm or override modal → `_executeVoid(id, voidedBy)` |
| `controlRestoreTransaction(id)` | controller.js | Confirm or override modal → `_executeRestore(id)` |
| `model.voidSale(id, voidedBy)` | model.js | Sets `voided_at` + `voided_by`; mutates state arrays; returns `{ wasInQueue }` |
| `model.restoreSale(id)` | model.js | Clears `voided_at`/`voided_by`; moves between state arrays; returns restored row |
| `model.verifyOverrideCredentials(email, password)` | model.js | Temp Supabase client: verifies email+password, checks `cashflow` permission, returns name |
| `cashflowView.showOverrideModal(onSubmit)` | cashflowView.js | Shows `#cashflowOverrideModal`, wires form submit to callback |
| `cashflowView.hideOverrideModal()` | cashflowView.js | Hides modal, resets form and error |
| `cashflowView.setOverrideError(msg)` | cashflowView.js | Shows/hides error text inside override modal |
| `cashflowView.setPeriodLabel(label)` | cashflowView.js | Updates `#cashflowPeriodLabel` text |
| `cashflowView.setActivePeriod(period)` | cashflowView.js | Toggles active class on period buttons |
| `_addHandlerPeriodChange(handler)` | cashflowView.js | Listens on `.period-btn` click (non-custom) |
| `_addHandlerCustomRange(handler)` | cashflowView.js | Listens on `#applyRangeBtn`, validates that from ≤ to |
| `controlChangePeriod({ period, from, to })` | controller.js | Fetches new range data, re-renders all sections |
| `cashflowView.setLoading(on)` | cashflowView.js | Disables period buttons and export during fetch |
| `_addHandlerOpenAddExpense()` | cashflowView.js | Listens on `#addExpenseBtn` and form close button |
| `cashflowView.showExpenseModal()` | cashflowView.js | Shows `#addExpenseModal`, pre-fills current datetime |
| `cashflowView.hideExpenseModal()` | cashflowView.js | Hides and resets expense form |
| `_addHandlerSubmitExpense(handler)` | cashflowView.js | Listens on `#addExpenseForm` submit |
| `controlAddExpense(data)` | controller.js | Calls model, updates summary + list, closes modal |
| `model.addExpense(data)` | model.js | Inserts to DB, pushes to `state.expenses` |
| `cashflowView.setSubmitting(on)` | cashflowView.js | Disables submit button during DB insert |
| `cashflowView.scrollExpensesToTop()` | cashflowView.js | Scrolls expense list to top after add |
| `_addHandlerDeleteExpense(handler)` | cashflowView.js | Listens on `.cashflow-delete-btn` with inline confirm |
| `controlDeleteExpense(id)` | controller.js | Calls model, updates summary + list |
| `model.deleteExpense(id)` | model.js | Deletes from DB, splices `state.expenses` |
| `_addHandlerOpenSaleReceipt(handler)` | cashflowView.js | Listens on clickable sale rows |
| `controlOpenSaleReceipt(id)` | controller.js | Finds sale in `state.cashflowSales`, shows receipt modal with reprint callback |
| `cashflowView.showSaleReceipt(sale, onReprint)` | cashflowView.js | Creates receipt detail modal; renders "Reprint Receipt" button if `onReprint` provided |
| `controlReprintSale(sale)` | controller.js | Maps DB sale shape → receipt shape, calls `ReceiptView.print()` — no new transaction |
| `_addHandlerExport(handler)` | cashflowView.js | Listens on `#exportCsvBtn` |
| `controlExportCSV()` | controller.js | Calls `_generateAndDownloadCSV` |
| `_generateAndDownloadCSV()` | controller.js | Formats sales + expenses as CSV, creates Blob, triggers download |

---

### 5.10 Discount Code Management

*(This is the management panel — applying codes at checkout is covered in §5.5)*

#### Open Panel

```
User clicks "Discounts" nav button
  → discountView._addHandlerOpen
  → controlOpenDiscounts()
    → discountView.open()
    → discountView.render(state.discountCodes)
```

#### Create Code

```
User clicks "+ New Code"
  → discountView._addHandlerNewCode → controlNewDiscountCode()
    → discountView.showForm()  [blank form]
    → discountView._wireForm()  [auto-uppercase input, type/usage selectors]

User fills and saves
  → discountView._addHandlerSave
  → controlSaveDiscountCode(data)
    → model.createDiscountCode(data)
        → code auto-uppercased
        → supabase.from('discount_codes').insert(...)
        → pushes to state.discountCodes
    → discountView.render(state.discountCodes)
    → discountView.closeForm()
```

#### Edit / Delete / Toggle

```
Edit:
  → controlEditDiscountCode(id) → discountView.showForm(code)
  → controlSaveDiscountCode(data) → model.updateDiscountCode(id, data) → re-render

Delete:
  → controlDeleteDiscountCode(id) [with confirm]
    → model.deleteDiscountCode(id) → supabase delete → splices state.discountCodes
    → discountView.render(...)

Toggle active/paused:
  → controlToggleDiscountStatus(id)
    → model.toggleDiscountCodeStatus(id)
        → supabase.update({ status: toggled })
        → flips status in state.discountCodes
    → discountView.render(...)
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerOpen(handler)` | discountView.js | Listens on `[data-action='discounts']` click |
| `controlOpenDiscounts()` | controller.js | Opens panel, renders code list |
| `discountView.open()` | discountView.js | Shows `#discountPanel` |
| `discountView.render(codes)` | discountView.js | Renders full code list |
| `_generateListMarkup(codes)` | discountView.js | HTML for each code row: status, value, usage text |
| `_addHandlerNewCode(handler)` | discountView.js | Listens on `#newDiscountCodeBtn` click |
| `controlNewDiscountCode()` | controller.js | Shows blank form |
| `discountView.showForm(code)` | discountView.js | Renders add/edit form (pass `null` for blank) |
| `discountView._wireForm()` | discountView.js | Auto-uppercase code input, type/usage selector wiring |
| `discountView._getFormData()` | discountView.js | Extracts form values as object |
| `_addHandlerSave(handler)` | discountView.js | Listens on `#dcSaveBtn` click with validation |
| `controlSaveDiscountCode(data)` | controller.js | Routes to create or update based on id |
| `model.createDiscountCode(data)` | model.js | Auto-uppercases code, inserts to DB, pushes to `state.discountCodes` |
| `model.updateDiscountCode(id, data)` | model.js | Updates DB, mutates item in `state.discountCodes` |
| `discountView.closeForm()` | discountView.js | Hides form modal |
| `_addHandlerEdit(handler)` | discountView.js | Listens on `.discount-edit-btn` click |
| `controlEditDiscountCode(id)` | controller.js | Pre-populates form with existing code |
| `_addHandlerDelete(handler)` | discountView.js | Listens on `.discount-delete-btn` click |
| `controlDeleteDiscountCode(id)` | controller.js | Shows confirm, calls model, re-renders |
| `model.deleteDiscountCode(id)` | model.js | Deletes from DB, splices `state.discountCodes` |
| `_addHandlerToggleStatus(handler)` | discountView.js | Listens on `.discount-toggle-btn` click |
| `controlToggleDiscountStatus(id)` | controller.js | Calls `model.toggleDiscountCodeStatus`, re-renders |
| `model.toggleDiscountCodeStatus(id)` | model.js | Flips status between `active`/`paused` in DB + state |
| `_addHandlerClose(handler)` | discountView.js | Listens on `.discount-back` click and backdrop click |
| `controlCloseDiscounts()` | controller.js | Animates panel close |

---

### 5.11 Staff Management

#### Open Panel

```
User clicks "Staff" nav button
  → staffView._addHandlerOpen
  → controlOpenStaff()
    → model.loadStaff()
        → supabase.from('staff').select(*, roles(*))
        → maps via dbToStaff()  [adds isSelf flag]
        → state.staff = [...]
    → model.loadRoles()  → state.roles
    → staffView.open()
    → staffView.render(state.staff)
```

#### Invite Staff

```
User clicks "Invite"
  → staffView._addHandlerInvite → controlShowInviteForm()
    → staffView.showInviteForm(state.roles)  [form with role dropdown]

User fills form and saves
  → staffView._addHandlerSaveInvite  [validates email format]
  → controlInviteStaff({ firstName, lastName, email, roleId })
    → checks for duplicate email in state.staff
    → model.inviteStaff(data)
        → supabase.from('staff').insert({ ..., status: 'pending' })
        → pushes to state.staff
    → staffView.render(state.staff)
    → staffView.closeForm()
```

#### Remove Staff

```
User clicks "Remove" (hidden for own record via isSelf)
  → staffView._addHandlerRemove
  → controlRemoveStaff(id)
    → shows confirm dialog
    → model.removeStaff(id)
        → supabase.from('staff').delete()
        → splices from state.staff
    → staffView.render(state.staff)
```

#### Set / Change Staff PIN (owner-side)

Business owners can set or reset any staff member's 6-digit PIN from the Staff panel. Each staff row (except the owner's own row) shows a "Set PIN" or "Change PIN" button.

```
Owner clicks "Set PIN" / "Change PIN" on a staff row
  → staffView._addHandlerSetPin
    → shows inline modal with a 6-digit password input (maxlength 6, inputmode numeric)
    → validates /^\d{6}$/

Owner saves
  → controlSetStaffPin(staffId, pin)
    → model.setStaffPin(staffId, pin)
        → supabase.from('staff').update({ pin }).eq('id', staffId)
        → updates hasPin flag in state.staff entry
    → staffView.render(state.staff)  [button text flips to "Change PIN"]
    → showToast('PIN updated', 'success')
```

#### First-Login Mandatory PIN Setup (staff-side)

When a staff member logs in for the first time (or any time `currentStaff.hasPin === false`), a full-screen blocking overlay appears immediately after `_wireApp()`. They cannot dismiss it — the app is unusable until a PIN is set.

```
After sign-in or session restore:
  _wireApp()
  _maybeShowPinSetup()
    → if !model.state.currentStaff || model.state.currentStaff.hasPin: return  [skip owners + staff who already have a PIN]
    → renders full-screen overlay (z-index 99999) with PIN numpad

Step 1 — Create PIN:
  → staff enters 6 digits on numpad
  → renderConfirm(firstPin)

Step 2 — Confirm PIN:
  → staff enters 6 digits again
  → if match: model.setStaffPin(currentStaff.id, pin) → el.remove() → showToast('PIN set! You\'re all set.', 'success')
  → if mismatch: shake animation + error text → renderCreate() [back to step 1]
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerOpen(handler)` | staffView.js | Listens on `[data-action='staff']` click |
| `controlOpenStaff()` | controller.js | Loads staff + roles from DB, renders panel |
| `model.loadStaff()` | model.js | Fetches staff with joined roles → `state.staff` (includes `isSelf`, `hasPin` flags) |
| `model.loadRoles()` | model.js | Fetches roles for business → `state.roles` |
| `model.dbToStaff(row)` | model.js | Maps DB row to staff shape; sets `isSelf`, `hasPin: !!row.pin`, `pin: row.pin ?? null` |
| `staffView.open()` | staffView.js | Shows `#staffPanel` |
| `staffView.render(staff)` | staffView.js | Renders staff list |
| `_generateListMarkup(staff)` | staffView.js | HTML per row: name, role, status, "Set/Change PIN" + remove buttons (both hidden if `isSelf`) |
| `_addHandlerInvite(handler)` | staffView.js | Listens on `#inviteStaffBtn` click |
| `controlShowInviteForm()` | controller.js | Shows invite form with role dropdown |
| `staffView.showInviteForm(roles)` | staffView.js | Renders invite form with populated role selector (no PIN field — staff set their own) |
| `_addHandlerSaveInvite(handler)` | staffView.js | Listens on `#inviteSaveBtn`, validates email format |
| `staffView._getInviteData()` | staffView.js | Returns `{ firstName, lastName, email, roleId }` from form |
| `controlInviteStaff(data)` | controller.js | Checks duplicate email, calls model, re-renders |
| `model.inviteStaff(data)` | model.js | Inserts staff with `status: 'pending'` to DB (no PIN — staff set their own on first login) |
| `staffView.closeForm()` | staffView.js | Hides invite form modal |
| `_addHandlerRemove(handler)` | staffView.js | Listens on `.staff-remove-btn` click |
| `controlRemoveStaff(id)` | controller.js | Shows confirm dialog, calls model, re-renders |
| `model.removeStaff(id)` | model.js | Deletes from DB, splices `state.staff` |
| `_addHandlerSetPin(handler)` | staffView.js | Listens on `.staff-pin-btn`; shows inline 6-digit PIN modal, validates `^\d{6}$`, calls handler |
| `controlSetStaffPin(staffId, pin)` | controller.js | Calls `model.setStaffPin`, re-renders staff list, shows success toast |
| `model.setStaffPin(staffId, pin)` | model.js | Updates `staff.pin` in DB; updates `hasPin` on the matching `state.staff` entry |
| `_maybeShowPinSetup()` | controller.js | Full-screen mandatory PIN creation overlay for staff with no PIN; skips if owner or PIN already set |
| `_addHandlerClose(handler)` | staffView.js | Listens on `.staff-back` click and backdrop click |
| `controlCloseStaff()` | controller.js | Animates panel close |

---

### 5.12 Cashier Switcher

Allows any staff member to sub in at the register without logging out. The sub-in person's name appears on the receipt (`added_by`), but the DB also records which account was logged in (`logged_in_cashier`) for an audit trail.

#### Two-Step PIN Flow

```
User clicks cashier name in header (#shiftStr)
  → controlSwitchCashier()
    → if state.staff is empty: model.loadStaff()
    → Step 1 — staff list picker:
        renders .cashier-picker-overlay with all active staff
        staff without a PIN show "PIN not set" tag and are greyed-out / non-clickable (.cashier-picker-item--disabled)
        currently active cashier highlighted (.cashier-picker-item--active)
        avatar pill generated from name initials with color from AVATAR_COLORS[]

User selects a staff member (must have PIN)
    → Step 2 — PIN screen:
        shows 6 dot indicators + numpad (no keyboard input)
        back button returns to staff list
        user enters 6 digits
        if correct: state.currentCashier = chosen staff → _updateCashierDisplay() → showToast
        if wrong: dots shake (.cashier-pin-shake) → dots + entered PIN reset → stays on PIN screen
```

#### Audit Trail (Backend)

Every finalised sale records two fields:

| Field | What it stores |
|---|---|
| `added_by` (existing) | The sub-in cashier's name (appears on receipt) |
| `logged_in_cashier` (new) | The account logged into the app at the time |

`_buildSale()` sets `loggedInCashier: model.state.username || ''`. `_finaliseSale()` writes this to `sales.logged_in_cashier`. If `added_by ≠ logged_in_cashier`, a sub-in occurred.

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `controlSwitchCashier()` | controller.js | Two-step picker: staff list → PIN numpad; updates `state.currentCashier` on success |
| `model.loadStaff()` | model.js | Fetches staff with PIN data (only if `state.staff` is empty) |
| `_cashierDisplayName(c)` | controller.js | Formats staff object as `"First L."` string |
| `_updateCashierDisplay()` | controller.js | Updates `#shiftStr` with current cashier name |
| `_buildSale()` | controller.js | Assembles sale object; sets `loggedInCashier: state.username` |
| `_finaliseSale()` | controller.js | Writes `logged_in_cashier` column on sale insert |

---

### 5.13 Kitchen Display System (KDS)

#### Open Orders — Always-Visible Home Page Section

The old KDS toggle-panel was replaced with a permanent inline list below the stat cards. It renders automatically on `initApp` and stays visible at all times.

```
On initApp:
  → model.loadOrderQueue()  [fetches sales where prepared_at IS NULL for today]
  → state.orderQueue populated
  → KDSView.renderQueue(state.orderQueue)
  → _ensureKDSTick()  [starts 1-second interval]

Structure (index.html):
  <section class="open-orders-section">
    <h2 class="open-orders-title">Active Queue</h2>   ← always visible
    <ul id="openOrdersList">     ← KDSView renders rows here
    <button id="openOrdersViewAll">  ← appears when queue.length > PREVIEW_COUNT (8)
```

Each row shows: order #, type badge (Dine In / Takeout — hidden when setting is off), item count, time placed, status badge, Done button. Up to `PREVIEW_COUNT` (8) rows shown; "View All" button appears when there are more, and the expand icon (⤢) opens the All Orders Modal.

#### Status Badges (update every second via `_tickKDS`)

| Elapsed | Badge text | Row class |
|---|---|---|
| < yellowThreshold | `Preparing` | — |
| ≥ yellowThreshold | `⏰ Delayed` | `oq-row--warn` |
| ≥ redThreshold | `🔥 Urgent` | `oq-row--urgent` |

#### Open KDS in Popup Window

```
User clicks "Open KDS Window" (in Settings or nav)
  → controlOpenKDSWindow()
    → window.open('kds-display.html', 'kds', `width=...,height=...`)
    → KDS window loads
    → loadFromDB() queries Supabase directly:
        → reads pointbunny_business_id from localStorage
        → fetches today's sales where prepared_at IS NULL
        → populates queue, renders card grid
        → header flips from pulsing amber "Syncing…" dot → solid green "Live" dot
    → After initial load, real-time deltas arrive via channel (KDS_QUEUE_SYNC)
    → KDS popup timer emojis: plain time (fresh), ⏰ time (warn), 🔥 time (urgent)
```

**KDS popup status indicator:** Header shows a pulsing amber "Syncing…" dot until `loadFromDB()` resolves, then flips to a solid green "Live" dot. The dot stays green for subsequent `KDS_QUEUE_SYNC` channel messages (real-time updates only).

#### New Order Placed

```
_finaliseSale(sale)
  → supabase inserts sale (prepared_at = null)
  → state.orderQueue.push(newOrder)
  → KDSView.renderQueue(state.orderQueue)   [home page list updates]
  → KDSView.playNewOrderSound()
  → channel.postMessage(KDS_QUEUE_SYNC)     [KDS popup updates]
  → _ensureKDSTick()
```

#### KDS Timer Tick (every 1 second)

```
_tickKDS() called every 1000ms
  → KDSView.updateTimers(state.orderQueue, Date.now(), yellow, red)
      → updates badge text + row classes for each order row
  → checks kdsAutoCompleteThreshold (Infinity if setting is 0)
  → for each order where elapsed ≥ autoThreshold:
      → controlMarkOrderDone(id, timedOut: true)
  → if state.orderQueue is empty: _stopKDSTick()
```

#### Ticket Numbers

Every order gets a ticket number assigned at `controlConcludeTransaction` time via `_generateTicketNumber()`. It picks a random number 1–999 that is not already in the active queue. The number is stored as `ticket_number` in the DB and displayed as `#N` on:
- The Active Queue home page row (`oq-num`)
- The KDS popup card header
- The cashflow sale row badge
- The undo toast label
- The receipt (large bold section above the item list)

#### Mark Order Done (with Undo Window)

Marking done is **non-destructive for 30 seconds** — the order is removed from the visible queue immediately but the DB write is deferred. The staff member can undo within the window.

```
Cook taps "Done" button (home page list or KDS popup window)
  Home list: KDSView._addHandlerDone → controlMarkOrderDone(id, false)
  KDS popup: sends KDS_ORDER_DONE (both transports) → channel.onmessage → controlMarkOrderDone(id)
  Auto-complete: _tickKDS → controlMarkOrderDone(id, timedOut: true)

controlMarkOrderDone(id, timedOut)  [synchronous — no await]
  → splices order from state.orderQueue at idx
  → KDSView.renderQueue(state.orderQueue)  [queue updates immediately]
  → channel.postMessage(KDS_QUEUE_SYNC)  [KDS popup updates immediately]
  → if queue empty: _stopKDSTick()
  → KDSView.showUndoToast(order, onUndo, UNDO_WINDOW_MS=30000)
      → creates toast DOM, shows countdown, returns dismiss()
  → setTimeout(30s):
      → model.recordServeTime(id, timedOut)
          → supabase UPDATE sales SET prepared_at=now, timed_out=timedOut
      → dismissToast()
  → stores { timer, order, idx, timedOut, dismissToast } in _pendingDone Map

If staff taps "Undo" within 30s:
  → _undoMarkDone(id)
    → clearTimeout(timer)
    → dismissToast()
    → splices order back into state.orderQueue at original idx
    → KDSView.renderQueue + channel.postMessage(KDS_QUEUE_SYNC)
    → _ensureKDSTick()
```

`KDSView.showUndoToast(order, onUndo, durationMs)` — creates a toast with countdown and Undo button; returns a `dismiss()` function. Lives in `kdsView.js` (not the controller).

#### All Orders Modal

A maximize icon button in the Open Orders section header opens a modal that lists every active order (no 5-row cap). Used when an order that's off the visible list needs to be marked done.

```
User clicks the maximize icon (⤢) in the Open Orders header
  → KDSView._addHandlerOpenModal → KDSView.openModal(modelState.orderQueue)
    → sets _modalOpen = true
    → removes .hidden from #allOrdersBackdrop
    → _renderModalList(queue): renders all rows into #allOrdersModalList (no hidden rows)

While modal is open:
  → renderQueue(queue) re-renders both inline list and modal list
  → updateTimers() updates badge + row classes in both lists every second

User clicks Done on any row in the modal
  → KDSView._addHandlerModalDone → controlMarkOrderDone(id)
    → same path as inline Done (removes from queue, DB update, re-renders both lists, broadcasts)

User clicks × or clicks backdrop
  → KDSView.closeModal()  [sets _modalOpen = false, adds .hidden]
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `KDSView.renderQueue(queue)` | kdsView.js | Renders inline list + modal list (when open); shows/hides View All button |
| `KDSView._renderModalList(queue)` | kdsView.js | Renders all orders into `#allOrdersModalList` with count badge |
| `KDSView.openModal(queue)` | kdsView.js | Sets `_modalOpen`, unhides backdrop, calls `_renderModalList` |
| `KDSView.closeModal()` | kdsView.js | Clears `_modalOpen`, hides backdrop |
| `KDSView._addHandlerOpenModal(getQueue)` | kdsView.js | Listens on `#openOrdersExpandBtn`; calls `openModal(getQueue())` |
| `KDSView._addHandlerModalClose()` | kdsView.js | Listens on `#allOrdersCloseBtn` and backdrop click |
| `KDSView._addHandlerModalDone(handler)` | kdsView.js | Event-delegated Done listener on `#allOrdersModalList` |
| `KDSView._rowMarkup(order, num, hidden)` | kdsView.js | Generates `<li class="oq-row">` HTML for one order |
| `KDSView.updateTimers(queue, now, yellow, red)` | kdsView.js | Updates badge text + row classes in inline list and modal list (when open) |
| `KDSView._addHandlerViewAll()` | kdsView.js | Toggles `oq-row--hidden` on rows at or beyond `PREVIEW_COUNT` (8); updates button text between "View All" / "Show Less" |
| `KDSView._addHandlerDone(handler)` | kdsView.js | Event-delegated listener on `#openOrdersList` for `.oq-done-btn` clicks |
| `KDSView.playNewOrderSound()` | kdsView.js | Web Audio API: C5-E5-G5 chord on new order |
| `controlOpenKDSWindow()` | controller.js | `window.open('kds-display.html', ...)` with configured size |
| `controlOpenCFDWindow()` | controller.js | `window.open('cfd.html', ...)` with configured size |
| `_ensureKDSTick()` | controller.js | Starts 1-second interval if not already running |
| `_stopKDSTick()` | controller.js | Clears the interval when queue empties |
| `_tickKDS()` | controller.js | Updates timers, triggers auto-complete past threshold (Infinity guard for 0) |
| `controlMarkOrderDone(id, timedOut)` | controller.js | Removes from queue immediately; defers DB write 30s (undo window) |
| `_undoMarkDone(id)` | controller.js | Cancels pending done timer, reinserts order at original index, resyncs |
| `KDSView.showUndoToast(order, onUndo, durationMs)` | kdsView.js | Countdown toast with Undo button; returns `dismiss()` |
| `_generateTicketNumber()` | controller.js | Picks random 1–999 not already in active queue |
| `model.recordServeTime(id, timedOut)` | model.js | Sets `prepared_at` + `timed_out` in DB |
| `model.loadOrderQueue()` | model.js | Fetches today's sales where `prepared_at IS NULL AND voided_at IS NULL` → `state.orderQueue` |
| `channel.onmessage` handler | controller.js | Routes `KDS_ORDER_DONE` → `controlMarkOrderDone`, `KDS_REQUEST_SYNC` → queue sync |

---

### 5.14 Customer Facing Display (CFD)

The CFD runs in a separate popup window (`cfd.html`).

#### Open CFD Window

```
User clicks "Open CFD Window"
  → controlOpenCFDWindow()
    → window.open('cfd.html', 'cfd', `width=${cfdWindowSize.width},height=${cfdWindowSize.height}`)
    → CFD window loads, sends CFD_REQUEST_SYNC
    → controller._broadcastCart()
        → channel.postMessage(CFD_CART_UPDATE, { cart: state.cart, total })
    → CFD window renders current cart
```

#### Cart Updates Pushed to CFD

Every time the cart changes, `_broadcastCart()` is called:
- `controlPushToModelCart()` — item added
- `controlDeleteCartItemInOrder(index)` — item removed from order view
- `controlDeleteCartItemInCheckout(index)` — item removed from checkout
- `clearCart()` — after sale complete or discard

#### Sale Complete Signal

```
_finaliseSale() → channel.postMessage(CFD_SALE_COMPLETE)
  → CFD window shows thank-you / idle screen
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `controlOpenCFDWindow()` | controller.js | Opens CFD popup at configured size |
| `_broadcastCart()` | controller.js | Sends `CFD_CART_UPDATE` with current `state.cart` and total |
| `channel.onmessage` handler | controller.js | Routes `CFD_REQUEST_SYNC` → `_broadcastCart()` |
| `channel.postMessage(CFD_SALE_COMPLETE)` | controller.js | Signals CFD that transaction is complete (called inside `_finaliseSale`) |
| `model.uploadCFDAdImage(file)` | model.js | Uploads ad image to Supabase Storage, stores URL in localStorage |
| `model.removeCFDAdImage()` | model.js | Removes CFD ad URL from localStorage |

---

### 5.15 Reports / Analytics Dashboard

#### Open Reports

```
User clicks "Reports" nav button
  → ReportsView._addHandlerOpen
  → controlOpenReports()
    → ReportsView.open()
    → ReportsView.renderLoading()
    → _getCashflowRange('today')  [returns { startISO, endISO, label }]
    → _getPreviousPeriodRange('today', startISO, endISO)
        → returns { prevStart, prevEnd, vsLabel }  ['yesterday']
    → [model.fetchReportsSales(startISO, endISO), model.fetchPeriodTotals(prevStart, prevEnd)]
        → fetchReportsSales → state.reportsSales (includes prepared_at)
        → fetchPeriodTotals → { revenue, transactions, avgOrder }
    → _renderReportsData('today', startISO, endISO, label, prevTotals, vsLabel)
```

#### `_renderReportsData(period, startISO, endISO, label, prevTotals, vsLabel)`

The central render call. Called on every period change, including from the compare mode and reports view period buttons.

```
→ ReportsView.setPeriodLabel(label)
→ _computeReportsSummary()  [{ revenue, transactions, avgOrder, avgServingMinutes }]
→ ReportsView.renderSummary(summary)
    → populates #reportsRevenue, #reportsTransactions, #reportsAvgOrder
    → populates #reportsServingTime (formatted as "2m 34s"; "—" if no KDS data)
→ ReportsView.renderComparison(summary, prevTotals, vsLabel)
    → delta % badges: #reportsRevenueCmp, #reportsTransCmp, #reportsAvgCmp
→ ReportsView.renderTopItems(_computeTopItems())
→ ReportsView.renderStaff(_computeStaffPerformance())
→ ReportsView.renderCharts({
    revenueOverTime: _computeRevenueOverTime(period, startISO, endISO),
    categoryMix:     _computeCategoryMix(),
    hourlyBreakdown: _computeHourlyBreakdown(),
    dayOfWeek:       _computeDayOfWeek(period),
    servingTime:     _computeServingTimeStats(),
  })
```

#### Change Period

```
User clicks period chip (Today / Yesterday / This Week / This Month / This Year / Custom)
  → ReportsView._addHandlerPeriodChange
  → controlChangeReportsPeriod({ period, from, to })
    → ReportsView.renderLoading()
    → _getCashflowRange(period, from, to)
    → _getPreviousPeriodRange(period, startISO, endISO)
    → model.fetchReportsSales(startISO, endISO)
    → _renderReportsData(period, ...)
```

#### Compare Mode

```
User clicks "Compare" button
  → ReportsView._addHandlerToggleCompare
  → controlToggleCompare()
    → _compareModeActive = !_compareModeActive
    → ReportsView.enterCompareMode() or ReportsView.exitCompareMode()

User selects compare type (Day vs Day / Week vs Week / Month vs Month / Year vs Year / Custom)
  → type-specific A and B pickers shown/hidden via showWrappers(type)
  → VS label updates to "Day vs Day" etc.

User clicks "Run"
  → ReportsView._addHandlerRunComparison
  → controlRunComparison({ type, aValue, bValue }) or ({ type, fromA, toA, fromB, toB })
    → _getRangeFromValue(type, value)  [converts picker value to { startISO, endISO, label }]
        → day: local midnight → 23:59:59.999
        → week: snaps to Mon–Sun containing that date
        → month: Jan 1 – Dec 31 of the input month
        → year: full calendar year
    → model.fetchReportsSalesRaw(rangeA) + model.fetchReportsSalesRaw(rangeB)  [parallel]
    → _computeCompareRevenue(sales, type, startISO, endISO)
        → type 'day': hourly revenue array (24 slots)
        → type 'week': daily Mon–Sun array
        → type 'month': daily array (1–31)
        → type 'year': monthly array (Jan–Dec)
        → returns { labels, dataA/B, totalA/B }
    → ReportsView.renderCompareResults({ summaryA, summaryB, revA, revB })
        → KPI values colored: winner = green (.rp-cmp-kpi-val--up), loser = red (.rp-cmp-kpi-val--down)
        → delta % badge between each A/B pair
        → overlapping line chart with two datasets
```

#### KPI Strip (Summary Cards)

Four cards in a `repeat(4, 1fr)` grid (collapses to 2×2 at 640px, Revenue spans full width at 480px):
- **Revenue** (`#reportsRevenue`) — total sales for period; green primary card (`rp-kpi--primary`)
- **Transactions** (`#reportsTransactions`) — count of sales
- **Avg. Order** (`#reportsAvgOrder`) — revenue ÷ transactions
- **Avg. Serving** (`#reportsServingTime`) — average `prepared_at − sale_date` formatted as `2m 34s`; shows `—` (muted) if no orders have been marked done in KDS

All four show a delta badge vs the previous equivalent period via `renderComparison`. Badge color rules:
- Revenue / Transactions / Avg. Order: **up = green, down = red** (standard)
- Avg. Serving: **down = green (faster = better), up = red (slower = worse)** — achieved via `invert = true` flag in `renderComparison`

**Primary card badge CSS gotcha:** The Revenue card (green background) overrides badge colors. `rp-kpi-cmp--up` stays translucent white. `rp-kpi-cmp--down` uses `background: rgba(255,255,255,0.92); color: #ef4444` — a white pill with red text — so it reads clearly against the green without color-mixing issues. Dark red on green looks muddy; white pill avoids this.

#### Charts

| Chart | `_charts` key | Canvas ID | Color | Notes |
|---|---|---|---|---|
| Revenue Over Time | `revenue` | `rpRevenueCanvas` | Green `#22c55e` | Hourly for day; daily for week/month; monthly for year |
| Category Mix | `category` | `rpCategoryCanvas` | Green | Donut or bar by category; empty state if no data |
| Hourly Breakdown | `hourly` | `rpHourlyCanvas` | Green | Revenue by hour of day (0–23) |
| Day of Week | `dow` | `rpDowCanvas` | Green | Revenue Mon–Sun; `isEmpty: true` when period < 2 days |
| Serving Time by Hour | `servingHour` | `rpServingHourCanvas` | Orange `#f59e0b` | Avg minutes by hour; empty if no `prepared_at` data |
| Serving Time by Day | `servingDay` | `rpServingDayCanvas` | Orange | Avg minutes Mon–Sun; peak bar fully highlighted |

**Canvas destruction rule:** Never replace innerHTML of a container holding a `<canvas>`. Use `canvas.style.display` toggle + a lazily-created sibling `<p class="rp-empty">` for empty states. Destroying the canvas node causes `querySelector('#canvasId')` to return `null` on subsequent renders.

#### `_computeServingTimeStats()`

```js
// Input: state.reportsSales (must include prepared_at)
// Filter: prepared_at is set, 0 < minutes < 120 (sanity bounds)
// Returns: { avgMinutes, byHour: { labels, data }, byDay: { labels, data } } | null
```

Serving time = `(new Date(prepared_at) − new Date(sale_date)) / 60000` minutes. The `byHour` and `byDay` arrays hold the per-bucket average (0 for buckets with no data).

#### Export (CSV & PDF)

The Export button in the report header is a **dropdown** with two options: "Download CSV" and "Save as PDF". Clicking outside closes it. `_addHandlerExport(csvHandler, pdfHandler)` wires both.

**CSV export** (`controlExportReports`) — same as before: sales rows + staff summary block, downloads `reports-<period>.csv`.

**PDF export** (`controlExportReportsPDF`) — opens a styled print popup (`window.open`) then calls `popup.print()` after 700ms. The browser's print dialog offers "Save as PDF". Branches on `_compareModeActive`:

- **Regular mode PDF** — Pointbunny green header, 4 KPI cards (Revenue / Transactions / Avg. Order / Avg. Serving), chart images captured live via `canvas.toDataURL()` (Revenue full-width, Category + Hourly side-by-side, DOW + Serving Time if visible), Top Items table (up to 10), Staff Performance table, Transactions table (capped at 50). Charts are only included if their wrap element does not have the `hidden` class and the canvas `style.display !== 'none'`.

- **Compare mode PDF** (active when `_compareModeActive && _cmpSalesA && _cmpSalesB`) — "Comparison Report" header, **KPI card grid** (2×2) styled to match the UI: green dot + Period A value (green text) + delta badge pill (green/red) + blue dot + Period B value (colored green if B won, red if B lost); inverted logic for Avg. Serving. Below the cards: the live compare revenue chart image, then Top Items side-by-side for A and B.

**`captureChart(wrapId, canvasId)`** — checks the wrap is not hidden and the canvas is not `display:none`, then returns `canvas.toDataURL('image/png')` or `null`. All chart images use this.

**Pop-up blocker note:** If the browser blocks the popup, `controlExportReportsPDF` shows a toast: "Pop-up blocked. Allow pop-ups for this site to export PDF."

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `ReportsView._addHandlerOpen(handler)` | reportsView.js | Listens on `[data-action='reports']` click |
| `controlOpenReports(section='overview')` | controller.js | Fetches today data, renders dashboard; optional `section` arg jumps to that tab on open ('overview'\|'sales'\|'traffic'\|'kitchen') — used by home page stat cards |
| `_loadServingComparison()` | controller.js | Fetches today + yesterday avg serving via `model.fetchPeriodTotals`; updates `#homeAvgServing` + `#homeServingVs` (home page Avg. Serving stat) |
| `ReportsView.open()` | reportsView.js | Shows `#reportsPanel` |
| `ReportsView.renderLoading()` | reportsView.js | Shows loading skeleton placeholders |
| `ReportsView.setPeriodLabel(label)` | reportsView.js | Updates period label display |
| `_computeReportsSummary()` | controller.js | Returns `{ revenue, transactions, avgOrder, avgServingMinutes }` |
| `ReportsView.renderSummary(summary)` | reportsView.js | Populates all 4 KPI cards including Avg. Serving |
| `ReportsView.renderComparison(current, prev, vsLabel)` | reportsView.js | Delta % badges on all 4 KPIs; `invert=true` for Avg. Serving (down = green) |
| `_computeTopItems(limit, sortKey)` | controller.js | Aggregates item qty/revenue across all sales in period |
| `ReportsView.renderTopItems(items)` | reportsView.js | Renders ranked item list with bar tracks |
| `_computeStaffPerformance()` | controller.js | Groups sales by `cashier_name` → `{ name, revenue, transactions }[]` |
| `ReportsView.renderStaff(staff)` | reportsView.js | Renders staff performance list |
| `ReportsView.renderCharts(data)` | reportsView.js | Calls all 6 chart renderers |
| `_computeRevenueOverTime(period, startISO, endISO)` | controller.js | Buckets revenue by time granularity matching the period |
| `_computeCategoryMix()` | controller.js | Revenue totals per category |
| `_computeHourlyBreakdown()` | controller.js | Revenue by hour of day (0–23) |
| `_computeDayOfWeek(period)` | controller.js | Revenue Mon–Sun; returns `isEmpty: true` for day/yesterday |
| `_computeServingTimeStats()` | controller.js | Avg serving time overall + by hour + by day; returns null if no KDS data |
| `_getRangeFromValue(type, value)` | controller.js | Converts picker type + value to `{ startISO, endISO, label }` |
| `controlToggleCompare()` | controller.js | Toggles `_compareModeActive`, enters/exits compare mode |
| `controlRunComparison(params)` | controller.js | Fetches data for both periods, renders compare results |
| `ReportsView.renderCompareResults(data)` | reportsView.js | KPI A/B values with green/red coloring + delta badges + overlay chart |
| `model.fetchReportsSales(startISO, endISO)` | model.js | Fetches sales for period → `state.reportsSales` (includes `prepared_at`) |
| `model.fetchReportsSalesRaw(startISO, endISO)` | model.js | Same query but returns rows without storing to state (used in compare mode) |
| `model.fetchPeriodTotals(startISO, endISO)` | model.js | Returns `{ revenue, transactions, avgOrder, avgServingMinutes }` for a period (used for vs-yesterday badges; `avgServingMinutes` is null if no KDS data) |
| `ReportsView._addHandlerExport(csvFn, pdfFn)` | reportsView.js | Wires Export dropdown — toggle on button click, close on outside click, route to csv/pdf handlers |
| `controlExportReports()` | controller.js | CSV export: downloads `reports-<period>.csv` with sales rows + staff summary |
| `controlExportReportsPDF()` | controller.js | PDF export: branches on `_compareModeActive`; opens print popup with branded HTML; captures charts via `canvas.toDataURL()` |

---

### 5.16 Help & Support

Businesses can submit support tickets, view admin replies, send follow-up messages, and rate the conversation after it's resolved.

#### Open Support Panel

```
User clicks "Help & Support" nav button or card
  → SupportView._addHandlerOpen
  → controlOpenSupport()
    → SupportView.open()
    → model.loadTickets()
        → supabase.from('tickets').select(*, ticket_replies(*))
        → state.tickets = [...]
    → SupportView.renderList(state.tickets)
```

#### Submit New Ticket

```
User clicks "+ New Ticket"
  → SupportView shows new ticket form: category dropdown, subject, message, optional image

User submits
  → SupportView._addHandlerSubmitTicket
  → controlSubmitTicket(data)
    → if data.attachment: model.uploadTicketAttachment(file)
        → supabase.storage.from('ticket-attachments').upload(path, file)
        → returns public URL
    → model.submitTicket({ category, subject, message, attachments })
        → supabase.from('tickets').insert(...)
        → pushes to state.tickets
    → SupportView.renderList(state.tickets)
    → SupportView.closeForm()
```

#### View Ticket Thread

```
User clicks a ticket row
  → SupportView._addHandlerOpenTicket
  → controlOpenTicket(ticketId)
    → marks has_unread_reply = false if set:
        model.clearUnreadFlag(ticketId)
          → supabase.from('tickets').update({ has_unread_reply: false })
          → mutates state.tickets entry
    → SupportView.renderThread(ticket)
        → renders original message
        → renders each reply (business replies right-aligned, admin replies left-aligned)
        → if ticket.status === 'solved': renders .support-closure block at bottom
            shows "Ticket closed" + emoji + label if already rated
        → shows reply composer if status === 'open'
        → shows rating bar (#supportRatingBar) if status === 'solved' AND !ticket.rating
```

#### Send Reply (Business)

```
User types reply and clicks Send
  → SupportView._addHandlerSendReply
  → controlSendReply({ ticketId, message })
    → model.submitTicketReply(ticketId, message)
        → supabase.from('ticket_replies').insert({ sender_type: 'business', ... })
        → supabase.from('tickets').update({ has_business_reply: true })  [signals admin panel]
        → pushes reply to state.tickets[ticketId].replies
    → SupportView.renderThread(updated ticket)
```

#### Post-Ticket Rating

Shown automatically when a solved ticket is opened and has no rating yet (`ticket.rating === null`).

```
User hovers/clicks an emoji face in #supportRatingBar
  → SupportView._addHandlerStarInteraction()
    → hover: highlights hovered emoji at full opacity
    → click: selects it with green border ring; stores _selectedRating (1–5)

Emoji map: 😤=1 😕=2 😐=3 😊=4 🤩=5
Labels:    Bad   Poor  OK   Good  Great

User clicks "Submit Rating"
  → SupportView._addHandlerSubmitRating
  → controlSubmitRating({ ticketId, rating, comment })
    → model.submitTicketRating(ticketId, rating, comment)
        → supabase.from('tickets').update({ rating, rating_comment, rated_at })
        → mutates ticket in state.tickets
    → SupportView.renderThread(updated ticket)
        → #supportRatingBar hidden
        → closure block in thread now shows emoji + label
    → showToast('Thanks for your feedback!', 'success')
```

Re-opening a rated solved ticket skips the rating bar — `ticket.rating` is already set so the prompt is not shown.

#### Mark Ticket Solved (Business)

```
User clicks "Mark as Solved"
  → SupportView._addHandlerMarkSolved
  → controlMarkTicketSolved(ticketId)
    → warns: "Cannot be reopened — create a new ticket if the issue returns"
    → model.solveTicket(ticketId)
        → supabase.from('tickets').update({ status: 'solved', solved_at: now })
        → mutates ticket in state.tickets
    → SupportView.renderThread(updated ticket)  [reply composer hidden; closure block + rating bar shown]
```

#### Unread Badge

A red badge appears on the Help & Support home card when any ticket has `has_unread_reply = true`. Cleared when the business opens that ticket (`controlOpenTicket` → `model.clearUnreadFlag`).

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `SupportView._addHandlerOpen(handler)` | supportView.js | Listens on Help & Support card/nav click |
| `controlOpenSupport()` | controller.js | Loads tickets, renders list |
| `model.loadTickets()` | model.js | Fetches tickets with replies joined → `state.tickets` |
| `SupportView.renderList(tickets)` | supportView.js | Renders ticket list with unread badges and status chips |
| `SupportView._addHandlerOpenTicket(handler)` | supportView.js | Listens on ticket row clicks |
| `controlOpenTicket(ticketId)` | controller.js | Clears unread flag, renders thread |
| `model.clearUnreadFlag(ticketId)` | model.js | Sets `has_unread_reply = false`; mutates state |
| `SupportView.renderThread(ticket)` | supportView.js | Full thread view: message, replies, closure block, rating bar |
| `SupportView._addHandlerSendReply(handler)` | supportView.js | Listens on reply Send button |
| `controlSendReply(data)` | controller.js | Calls model, re-renders thread |
| `model.submitTicketReply(ticketId, message)` | model.js | Inserts reply with `sender_type: 'business'`; sets `has_business_reply: true` |
| `SupportView._addHandlerStarInteraction()` | supportView.js | Emoji hover/click — highlights and selects rating; stores `_selectedRating` |
| `SupportView._addHandlerSubmitRating(handler)` | supportView.js | Listens on Submit Rating button; reads `_selectedRating` and comment |
| `controlSubmitRating(data)` | controller.js | Calls model, re-renders thread, shows success toast |
| `model.submitTicketRating(ticketId, rating, comment)` | model.js | Updates `rating`, `rating_comment`, `rated_at` on ticket |
| `SupportView._addHandlerMarkSolved(handler)` | supportView.js | Listens on Mark as Solved button |
| `controlMarkTicketSolved(ticketId)` | controller.js | Confirms with user, calls model, re-renders thread |
| `model.solveTicket(ticketId)` | model.js | Sets `status: 'solved'`, `solved_at: now` in DB + state |
| `model.submitTicket(data)` | model.js | Inserts new ticket to DB, pushes to `state.tickets` |
| `model.uploadTicketAttachment(file)` | model.js | Uploads to `ticket-attachments` bucket, returns public URL |

---

### 5.17 Shifts, Timesheets & Pay Summary

> **Status:** Live. `timeclock.html` is a standalone clock-in/out page for a registered device. The Payroll tab in the main app (`staffView.js`) shows timesheets with week/month/year/custom navigation, per-shift edit controls (admin/owner only), and a pay summary card per staff member.

#### Overview

Four parts:
1. **`timeclock.html`** — dedicated standalone page for a single registered device (tablet at the store entrance); staff log in with their own Supabase accounts to clock in/out
2. **Break tracking** — shifts can be paused/resumed; breaks stored separately in `shift_breaks`
3. **Timesheets tab** (main POS Payroll tab) — weekly shift list; editable by owners/admins only
4. **Pay Summary** — total hours worked × hourly rate per staff member for a chosen period

#### Device Registration

`timeclock.html` is designed for a single fixed device per business. On first open, it shows an **activation screen** where the owner enters a code generated from the main POS Settings panel. The code is validated against `businesses.timeclock_token`, and on success the token is saved to `localStorage` on that device. Subsequent loads skip straight to the staff login.

- Owner generates token: Settings → "Register Time Clock Device" → copies 6-character code
- Tablet enters code once → stored in `localStorage` as `pointbunny_timeclock_token`
- If token is cleared (e.g. different browser/device), re-activation is required

#### New DB Surface

**`shifts` table:**
```sql
CREATE TABLE public.shifts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES businesses(id),
  staff_id       uuid NOT NULL REFERENCES staff(id),
  clocked_in_at  timestamptz NOT NULL,
  clocked_out_at timestamptz,
  note           text,
  created_at     timestamptz DEFAULT now()
);
grant select, insert, update, delete on public.shifts to authenticated;
alter table public.shifts enable row level security;
-- Owners/admins query by business_id; staff query their own rows
create policy "shifts_owner_access" on public.shifts
  for all using (business_id = auth.uid());
create policy "shifts_staff_own" on public.shifts
  for all using (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = shifts.staff_id
        AND staff.user_id = auth.uid()
    )
  );
```

**`shift_breaks` table:**
```sql
CREATE TABLE public.shift_breaks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id   uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at   timestamptz,
  created_at timestamptz DEFAULT now()
);
grant select, insert, update, delete on public.shift_breaks to authenticated;
alter table public.shift_breaks enable row level security;
-- Owner can access breaks for their business's shifts
create policy "shift_breaks_owner" on public.shift_breaks
  for all using (
    EXISTS (
      SELECT 1 FROM shifts WHERE shifts.id = shift_breaks.shift_id
        AND shifts.business_id = auth.uid()
    )
  );

-- Staff can access breaks for their own shifts
create policy "shift_breaks_staff_own" on public.shift_breaks
  for all using (
    EXISTS (
      SELECT 1 FROM shifts
      JOIN staff ON staff.id = shifts.staff_id
      WHERE shifts.id = shift_breaks.shift_id
        AND staff.user_id = auth.uid()
    )
  );
```

**`staff.hourly_rate` column:**
```sql
ALTER TABLE public.staff ADD COLUMN hourly_rate numeric(10,2);
```

**`businesses.timeclock_token` column:**
```sql
ALTER TABLE public.businesses ADD COLUMN timeclock_token text;
```

#### timeclock.html — UI States

```
On load:
  → check localStorage for pointbunny_timeclock_token
  → if missing: show Activation Screen
      Owner enters 6-char code → validate against businesses.timeclock_token
      → on match: store token, show Staff Login
  → if present (and existing Supabase session): reload staff record → show Shift Screen directly
  → if present (no session): show Staff Login

Staff Login:
  → email + password form → supabase.auth.signInWithPassword()
  → on success: look up staff record by user_id (eq('user_id', authData.user.id)) + business_id
  → if staff.pin is null: show PIN Setup flow (2-step create + confirm, 4-digit)
      → saves PIN to staff.pin before proceeding
  → show Shift Screen for that staff member

Shift Screen (states):
  ┌─────────────────────────────────────────┐
  │  Not clocked in  →  [Clock In]          │
  │  Clocked in      →  [Take Break] [Clock Out]  (running work timer) │
  │  On break        →  [Resume]            (running break timer) │
  │  Clocked out     →  Today's summary + [Sign Out] │
  └─────────────────────────────────────────┘
```

#### timeclock.html — Action Flows

```
Clock In:
  → supabase.from('shifts').insert({ business_id, staff_id, clocked_in_at: now() })
  → start running work timer

Take Break:
  → supabase.from('shift_breaks').insert({ shift_id, started_at: now() })
  → swap to break timer

Resume:
  → supabase.from('shift_breaks').update({ ended_at: now() }).eq('id', activeBreakId)
  → swap back to work timer

Clock Out:
  → PIN confirmation (showPinPad) if staff.pin is set; otherwise re-enter password (showPasswordConfirm)
  → if active break: close it first (ended_at = now())
  → supabase.from('shifts').update({ clocked_out_at: now() }).eq('id', shiftId)
  → show today's summary (clocked in/out times, break time, time worked)
  → session stays active — staff must tap "Sign out" manually (or the next person logs in over them)
```

#### Timesheets Tab (main POS — admin/owner only)

Permission check on open: only `Admin` role or the business owner can see the edit controls. The Payroll tab loads automatically when the user switches to it.

```
Owner/Admin opens Staff panel → Payroll tab
  → controlFetchTimesheets('week', todayISO)  [defaults to current week]
    → resolves ISO range from type + value (same logic as _getRangeFromValue)
    → model.fetchShifts(startISO, endISO)
        → supabase.from('shifts').select('id, clocked_in_at, clocked_out_at, note, staff_id,
            shift_breaks(id, started_at, ended_at), staff(first_name, last_name, hourly_rate)')
        → state.shifts = [...]
    → StaffView.renderTimesheets(state.shifts, state.staff, canEdit, { type, value, label })
        → shows period nav (Week/Month/Year/Custom tabs + prev/next arrows + "Open Time Clock" link card)
        → renders shifts grouped by staff member with break sub-rows
        → renders pay summary cards (name, total hours; + gross pay if hourly_rate is set)

Period navigation:
  → Week / Month / Year / Custom tabs → _addHandlerTimesheetPeriod(controlFetchTimesheets)
  → Prev / Next arrows call controlFetchTimesheets with adjusted value
  → "Today" chip jumps to the current period

Admin edits a shift row:
  → staffView._addHandlerEditShift → _showShiftModal(shift, staff)
  → modal: clocked_in_at, clocked_out_at, note; + break rows (add/remove)
  → controlSaveShift({ id?, staffId, clockedInAt, clockedOutAt, note })
    → id present: model.updateShift(data)  → DB update + state mutation
    → id absent: model.addShift(data)      → DB insert + state push
    → controlFetchTimesheets(_tsType, _tsValue)  [re-renders with fresh data]

Export (PDF / CSV / Excel):
  → Export dropdown in Payroll header → exportPdf() or exportCsv()
```

**Hours worked calculation** (excludes open/active shifts from totals):
```
workedMinutes = (clocked_out_at - clocked_in_at) in minutes
              − sum(ended_at - started_at for each completed break)
```

#### Pay Summary

Rendered below the timesheet. Purely computed — no extra DB call.

```
For each staff member with completed shifts in period:
  totalWorkedMinutes = sum of workedMinutes across shifts
  → summary card always shows: name, total hours worked
  → if hourlyRate is set: also shows gross pay = (totalWorkedMinutes / 60) × hourlyRate
  → if hourlyRate is not set: shows "—" with a hint to set rate in staff settings
  → [Mark as Paid] button → shows toast (v1); future: writes pay_periods record
```

Hourly rate is optional — set from the Edit Staff modal (admin/owner only). Staff without a rate still appear in the timesheet with their hours tracked.

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `model.fetchShifts(startISO, endISO)` | model.js | Fetches shifts + breaks + staff name/rate for period → `state.shifts` |
| `model.addShift(data)` | model.js | Admin: inserts a manual shift |
| `model.updateShift(data)` | model.js | Admin: updates shift clocked_in/out/note in DB + state |
| `model.updateStaffHourlyRate(staffId, rate)` | model.js | Updates `staff.hourly_rate` in DB |
| `model.generateTimeclockToken()` | model.js | Generates 6-char token, saves to `businesses.timeclock_token`, returns it |
| `controlFetchTimesheets(type, value)` | controller.js | Resolves ISO range from type + value, loads shifts, re-renders Payroll tab |
| `controlSaveShift(data)` | controller.js | Add or edit shift (id present = update, absent = insert); re-fetches after save |
| `controlGenerateTimeclockToken()` | controller.js | Calls `model.generateTimeclockToken`, calls `SettingsView.showTimeclockToken(token)` |
| `StaffView.renderTimesheets(shifts, staff, canEdit, periodMeta)` | staffView.js | Full Payroll tab: period nav, shift list grouped by staff, pay summary, export/add buttons |
| `StaffView._addHandlerPayrollTab(handler)` | staffView.js | Fires `handler` the first time the Payroll tab is activated |
| `StaffView._addHandlerTimesheetPeriod(handler)` | staffView.js | Wires period tabs + prev/next arrows + custom apply → `controlFetchTimesheets` |
| `StaffView._addHandlerSaveShift(handler)` | staffView.js | Listens on shift modal save; passes `{ id?, staffId, clockedInAt, clockedOutAt, note }` |
| `SettingsView._addHandlerGenerateTimeclockToken(handler)` | settingsView.js | Listens on `#tcGenerateTokenBtn` click |
| `SettingsView.showTimeclockToken(token)` | settingsView.js | Writes token to `#tcTokenDisplay` |
| `timeclock.js` (module-level) | timeclock.js | Standalone: device activation, staff Supabase auth, PIN setup, clock in/out/break state machine, PIN/password confirmation on clock-out |

---

## Adjustment Calculation Reference

`model.calculateAdjustments(subtotal, adjustments)` — called every time checkout totals need to refresh.

```
Input:  subtotal (number), adjustments (currentReceiptAdjustments array)
Output: { subtotal, lineItems: [{ name, appliedValue, type }], finalTotal }

Steps:
  1. Filter out removed adjustments
  2. Sort: discounts before fees
  3. For each adjustment:
     - flat discount:    running -= appliedValue
     - percent discount: running -= (appliedValue/100) × running
     - flat fee:         running += appliedValue
     - percent fee:      running += (appliedValue/100) × running
  4. Clamp finalTotal to minimum 0
```

---

*Last updated: 2026-06-07. §5.1 updated: 4-panel auth form (login / signup / forgot / reset); forgot password flow (Resend email via `resetPasswordForEmail`); reset password flow (`type=recovery` URL hash detection in `initAuth`); try/catch error boundary around `initApp` in `controlSignIn` and `initAuth`; `_initBusiness` businessName fallback chain documented. §5.17 updated from Planned → Live (timesheets/timeclock). Update this file when a new feature is added or a workflow changes.*
