# SYSTEM.md — Pointy POS: Architecture & Feature Workflows

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

---

## 1. Architecture Overview

**Pointy** is a frontend-only SPA (Single Page Application) following a strict **MVC** pattern:

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
- **No persistent local state.** All state lives in the `state` object (`model.js`) and resets on reload. Persistence is via Supabase (DB + Storage).
- **No direct View→Model calls.** Views only call handlers passed to them by the controller.
- **External displays** (KDS window, CFD window) communicate via `PointyChannel` — a thin wrapper around Supabase Realtime.

---

## 2. Module Map

| File | Class/Export | Owns |
|---|---|---|
| `model.js` | `state`, named functions | All data, all DB calls, state mutations |
| `controller.js` | `init()` entry point + all `control*` functions | Wires views to model; handles app logic |
| `channel.js` | `PointyChannel` (default export `channel`) | Realtime messaging between cashier app and KDS/CFD windows |
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
| `Views/kdsView.js` | `KDSView` | Kitchen display: order queue cards, timers, done button |
| `Views/discountView.js` | `DiscountView` | Discount code management panel |
| `Views/staffView.js` | `StaffView` | Staff management panel |

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
  cashflowSales,     // Sales fetched for the current cashflow date range
  expenses,          // Expense records fetched for current range

  // Discount codes
  discountCodes,     // [{ id, code, title, description, type, value, status, usageCount, usageLimit }]

  // KDS
  orderQueue,        // [{ id, orderId, items, createdAt, ... }]

  // Settings
  settings: {
    adjustments,              // [{ id, name, type, calculation, value, enabled }]
    showRemovedAdjustments,   // bool — whether struck-through removals appear on receipt
    printingEnabled,          // bool
    confirmPrint,             // bool — ask before printing
    kdsYellowThreshold,       // seconds before order card turns yellow
    kdsRedThreshold,          // seconds before order card turns red
    kdsAutoCompleteThreshold, // seconds before order auto-completes
    kdsWindowSize,            // { width, height }
    cfdWindowSize,            // { width, height }
  }
}
```

---

## 4. Cross-Cutting: BroadcastChannel Messages

`channel.js` exposes a `PointyChannel` instance backed by Supabase Realtime (channel name: `pointy-displays`). All external display windows use the same channel.

| Message type (`MSG.*`) | Direction | Payload | What triggers it |
|---|---|---|---|
| `CFD_CART_UPDATE` | Cashier → CFD | `{ cart, total }` | Any cart mutation (add, delete, clear) |
| `CFD_SALE_COMPLETE` | Cashier → CFD | `{}` | Transaction finalized |
| `CFD_REQUEST_SYNC` | CFD → Cashier | `{}` | CFD window opened / loaded |
| `KDS_QUEUE_SYNC` | Cashier → KDS | `{ queue, thresholds }` | New order placed, order done, KDS requests sync |
| `KDS_REQUEST_SYNC` | KDS → Cashier | `{}` | KDS window opened / loaded |
| `KDS_ORDER_DONE` | KDS → Cashier | `{ id }` | Cook taps Done button in KDS window |

**Controller message router** (`channel.onmessage`):
- `KDS_REQUEST_SYNC` → sends current `state.orderQueue` + thresholds back
- `KDS_ORDER_DONE` → calls `controlMarkOrderDone(id)`
- `CFD_REQUEST_SYNC` → calls `_broadcastCart()` with current cart

---

## 5. Feature Workflows

---

### 5.1 Authentication

#### Sign In

```
User submits login form
  → authView._addHandlerSignIn  [authView.js]
  → controlSignIn(email, password)  [controller.js]
    → supabase.auth.signInWithPassword()
    → authView.playSignInSuccess()  [animation]
    → initApp(user)
      → model.loadBusinessContext(user)
        → supabase.from('staff').select()
        → sets state.userId, businessId, role, currentStaff
        → _initBusiness(user)  [if first login — creates business + default roles]
      → model.loadMenuItems()       → state.menuItems
      → model.loadMenuCategories()  → state.menuCategories
      → model.loadAdjustments()     → state.settings.adjustments
      → model.loadDiscountCodes()   → state.discountCodes
      → model.loadTodaySalesTotal() → #totalStr display
      → model.loadOrderQueue()      → state.orderQueue
      → authView.hide()
      → _wireApp()  [wires all view handlers to controller functions]
```

#### Sign Up

```
User submits signup form
  → authView._addHandlerSignUp  [validates all fields]
  → controlSignUp({ firstName, lastName, email, password })
    → supabase.auth.signUp()
    → authView.showCheckEmail(email)  [replaces form with confirmation message]
```

#### Sign Out

```
User clicks sign out
  → controlSignOut()
    → [destroys analytics session]
    → supabase.auth.signOut()
    → window.location.reload()
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerSignIn(handler)` | authView.js | Listens on `#loginForm` submit |
| `controlSignIn(email, password)` | controller.js | Orchestrates sign-in flow, calls `initApp` |
| `authView.playSignInSuccess()` | authView.js | Card scale/fade animation before app loads |
| `initApp(user)` | controller.js | Loads all initial state, calls `_wireApp` |
| `model.loadBusinessContext(user)` | model.js | Sets `state.userId`, `businessId`, `role`, `currentStaff` |
| `model._initBusiness(user)` | model.js | Creates business + default roles on very first login |
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

```
User types new category and submits (in Add Item form or Settings)
  → controlAddNewCategory(name) / controlAddCategoryFromSettings(name)
    → model.addCategory(name)
        → validates uniqueness
        → supabase.from('menu_categories').insert(...)
        → pushes lowercase name to state.menuCategories
    → updates all category dropdowns in open forms

User clicks delete on a category (Settings)
  → controlDeleteCategory(name)
    → if items exist in that category: shows warning toast, aborts
    → model.deleteCategory(name)
        → supabase.from('menu_categories').delete()
        → removes from state.menuCategories
    → re-renders settings category list
```

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
| `controlAddCategoryFromSettings(name)` | controller.js | Same as above but triggered from settings panel |
| `model.addCategory(name)` | model.js | Validates uniqueness, inserts to DB, pushes to `state.menuCategories` |
| `controlDeleteCategory(name)` | controller.js | Blocks if items exist in category, else calls model |
| `model.deleteCategory(name)` | model.js | Deletes from DB, removes from `state.menuCategories` |

---

### 5.7 Settings

#### Open Settings

```
User clicks settings gear icon
  → settingsView._addHandlerOpen
  → controlOpenSettings()
    → settingsView renders:
        - category list (state.menuCategories)
        - adjustment list (state.settings.adjustments)
        - printing toggle (state.settings.printingEnabled)
        - confirmPrint toggle (state.settings.confirmPrint)
        - showRemovedAdjustments toggle
        - KDS thresholds (yellow, red, auto)
        - KDS & CFD window size selectors
        - CFD ad image section
```

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
| `controlOpenSettings()` | controller.js | Renders the full settings panel |
| `settingsView.renderCategories(categories)` | settingsView.js | Lists all categories with delete buttons |
| `settingsView.renderAdjustments(adjustments)` | settingsView.js | Lists all adjustments with toggle, edit, delete |
| `syncPrintingToggle(value)` | settingsView.js | Sets `#printingToggle` checkbox state from `state` |
| `_addHandlerTogglePrinting(handler)` | settingsView.js | Listens on `#printingToggle` change |
| `controlTogglePrinting(value)` | controller.js | Updates `state.settings.printingEnabled` + localStorage |
| `syncConfirmPrintToggle(value)` | settingsView.js | Sets `#confirmPrintToggle` checkbox state |
| `_addHandlerToggleConfirmPrint(handler)` | settingsView.js | Listens on `#confirmPrintToggle` change |
| `controlToggleConfirmPrint(value)` | controller.js | Updates `state.settings.confirmPrint` + localStorage |
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

```
User clicks "Cash Flow" nav button
  → cashflowView._addHandlerOpen
  → controlOpenCashflow()
    → cashflowView.open()  [shows panel]
    → cashflowView.renderLoading()
    → _getCashflowRange('today')  [returns { startISO, endISO, label }]
    → model.fetchCashflowData(startISO, endISO)
        → supabase.from('sales').select() for range → state.cashflowSales
        → supabase.from('expenses').select() for range → state.expenses
    → cashflowView.renderSummary(_cashflowSummary())
        → _cashflowSummary() returns { gross, expenses, net }
    → cashflowView.renderSalesList(state.cashflowSales)
    → cashflowView.renderExpensesList(state.expenses)
    → cashflowView.setPeriodLabel(label)
```

#### Change Period

```
User clicks period button (Today / Week / Month / Custom)
  → cashflowView._addHandlerPeriodChange  (or _addHandlerCustomRange for date picker)
  → controlChangePeriod({ period, from, to })
    → cashflowView.setLoading(true)  [disables buttons]
    → _getCashflowRange(period, from, to)
    → model.fetchCashflowData(startISO, endISO)
    → cashflowView.renderSummary(...) + renderSalesList(...) + renderExpensesList(...)
    → cashflowView.setActivePeriod(period)
    → cashflowView.setLoading(false)
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

#### View Sale Receipt

```
User clicks a sale row
  → cashflowView._addHandlerOpenSaleReceipt
  → controlOpenSaleReceipt(id)
    → finds sale in state.cashflowSales
    → cashflowView.showSaleReceipt(sale)  [creates receipt detail modal]
```

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
| `cashflowView.open()` | cashflowView.js | Shows `#cashflowPanel`, resets period buttons |
| `cashflowView.renderLoading()` | cashflowView.js | Shows spinner while data loads |
| `_getCashflowRange(period, from, to)` | controller.js | Calculates ISO date range from period name or custom dates |
| `model.fetchCashflowData(startISO, endISO)` | model.js | Fetches sales + expenses for range → `state.cashflowSales`, `state.expenses` |
| `_cashflowSummary()` | controller.js | Computes `{ gross, expenses, net }` from current state arrays |
| `cashflowView.renderSummary({ gross, expenses, net })` | cashflowView.js | Updates summary stat cards |
| `cashflowView.renderSalesList(sales)` | cashflowView.js | Renders clickable sale rows list |
| `cashflowView.renderExpensesList(expenses)` | cashflowView.js | Renders expense rows with delete buttons |
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
| `controlOpenSaleReceipt(id)` | controller.js | Finds sale in `state.cashflowSales`, shows receipt modal |
| `cashflowView.showSaleReceipt(sale)` | cashflowView.js | Creates receipt detail modal overlay |
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

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerOpen(handler)` | staffView.js | Listens on `[data-action='staff']` click |
| `controlOpenStaff()` | controller.js | Loads staff + roles from DB, renders panel |
| `model.loadStaff()` | model.js | Fetches staff with joined roles → `state.staff` (includes `isSelf` flag) |
| `model.loadRoles()` | model.js | Fetches roles for business → `state.roles` |
| `model.dbToStaff(row)` | model.js | Maps DB row to staff shape, sets `isSelf` based on `state.userId` |
| `staffView.open()` | staffView.js | Shows `#staffPanel` |
| `staffView.render(staff)` | staffView.js | Renders staff list |
| `_generateListMarkup(staff)` | staffView.js | HTML per row: name, role, status, remove button (hidden if `isSelf`) |
| `_addHandlerInvite(handler)` | staffView.js | Listens on `#inviteStaffBtn` click |
| `controlShowInviteForm()` | controller.js | Shows invite form with role dropdown |
| `staffView.showInviteForm(roles)` | staffView.js | Renders invite form with populated role selector |
| `_addHandlerSaveInvite(handler)` | staffView.js | Listens on `#inviteSaveBtn`, validates email format |
| `staffView._getInviteData()` | staffView.js | Returns `{ firstName, lastName, email, roleId }` from form |
| `controlInviteStaff(data)` | controller.js | Checks duplicate email, calls model, re-renders |
| `model.inviteStaff(data)` | model.js | Inserts staff with `status: 'pending'` to DB, pushes to `state.staff` |
| `staffView.closeForm()` | staffView.js | Hides invite form modal |
| `_addHandlerRemove(handler)` | staffView.js | Listens on `.staff-remove-btn` click |
| `controlRemoveStaff(id)` | controller.js | Shows confirm dialog, calls model, re-renders |
| `model.removeStaff(id)` | model.js | Deletes from DB, splices `state.staff` |
| `_addHandlerClose(handler)` | staffView.js | Listens on `.staff-back` click and backdrop click |
| `controlCloseStaff()` | controller.js | Animates panel close |

---

### 5.12 Cashier Switcher

#### Switch Active Cashier

```
User clicks cashier name in header (#shiftStr)
  → controlSwitchCashier()
    → if state.staff is empty: model.loadStaff()
    → creates picker overlay listing all active staff
    → user selects a staff member
    → state.currentCashier = { id, firstName, lastName, role }
    → _updateCashierDisplay()
        → _cashierDisplayName(currentCashier)  [formats "First L."]
        → #shiftStr.textContent = formatted name
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `controlSwitchCashier()` | controller.js | Loads staff if needed, creates picker overlay |
| `model.loadStaff()` | model.js | Fetches staff (only if `state.staff` is empty) |
| `_cashierDisplayName(c)` | controller.js | Formats staff object as `"First L."` string |
| `_updateCashierDisplay()` | controller.js | Updates `#shiftStr` with current cashier name |

---

### 5.13 Kitchen Display System (KDS)

#### Open KDS Panel (Inline)

```
User clicks KDS button
  → kdsView._addHandlerOpen
  → controlOpenKDS()
    → kdsView.open(state.orderQueue)
    → kdsView.renderQueue(state.orderQueue)
    → _ensureKDSTick()  [starts 1-second interval if not running]
```

#### Open KDS in Popup Window

```
User clicks "Open KDS Window"
  → controlOpenKDSWindow()
    → window.open('kds.html', 'kds', `width=${kdsWindowSize.width},height=${kdsWindowSize.height}`)
    → KDS window loads, sends KDS_REQUEST_SYNC
    → controller responds with KDS_QUEUE_SYNC (full queue + thresholds)
    → KDS window renders queue
```

#### KDS Timer Tick (every 1 second)

```
_tickKDS() called every 1000ms
  → kdsView.updateTimers(state.orderQueue, Date.now(), yellow, red)
      → for each order card: calculates elapsed seconds
      → adds .warn class if elapsed > yellowThreshold
      → adds .urgent class if elapsed > redThreshold
  → for each order where elapsed > kdsAutoCompleteThreshold:
      → controlMarkOrderDone(id, timedOut: true)
  → if state.orderQueue is empty: _stopKDSTick()
```

#### Mark Order Done

```
Cook taps "Done" button (either inline KDS or KDS popup window)
  Inline:  kdsView._addHandlerDone → controlMarkOrderDone(id, false)
  Popup:   KDS window sends KDS_ORDER_DONE → channel.onmessage → controlMarkOrderDone(id)

controlMarkOrderDone(id, timedOut)
  → removes order from state.orderQueue
  → model.recordServeTime(id, timedOut)
      → supabase.from('sales').update({ prepared_at: now, timed_out: timedOut })
  → kdsView.renderQueue(state.orderQueue)  [if inline panel open]
  → channel.postMessage(KDS_QUEUE_SYNC)  [syncs KDS popup window]
  → if state.orderQueue is empty: _stopKDSTick()
```

#### Function Reference

| Function | File | Purpose |
|---|---|---|
| `_addHandlerOpen(handler)` | kdsView.js | Listens on `#kdsOpenBtn` click |
| `controlOpenKDS()` | controller.js | Shows inline KDS panel, renders queue, starts tick |
| `kdsView.open(queue)` | kdsView.js | Shows `#kdsPanel`, renders initial queue |
| `kdsView.renderQueue(queue)` | kdsView.js | Renders up to 10 order cards in `#kdsGrid` |
| `kdsView._cardMarkup(order, num)` | kdsView.js | Generates HTML for a single order card with items + timer |
| `_addHandlerClose(handler)` | kdsView.js | Listens on `#kdsCloseBtn` click |
| `controlCloseKDS()` | controller.js | Hides inline KDS panel |
| `controlOpenKDSWindow()` | controller.js | `window.open('kds.html', ...)` with configured size |
| `controlOpenCFDWindow()` | controller.js | `window.open('cfd.html', ...)` with configured size |
| `_ensureKDSTick()` | controller.js | Starts 1-second interval if not already running |
| `_stopKDSTick()` | controller.js | Clears the interval when queue empties |
| `_tickKDS()` | controller.js | Updates timers every second, auto-completes past threshold |
| `kdsView.updateTimers(queue, now, yellow, red)` | kdsView.js | Updates elapsed time text + `.warn`/`.urgent` classes on cards |
| `kdsView.playNewOrderSound()` | kdsView.js | Web Audio API: plays brief C5-E5-G5 chord on new order |
| `_addHandlerDone(handler)` | kdsView.js | Listens on `.kds-done-btn` click |
| `controlMarkOrderDone(id, timedOut)` | controller.js | Removes from queue, records serve time, syncs windows |
| `model.recordServeTime(id, timedOut)` | model.js | Sets `prepared_at` timestamp and `timed_out` flag in DB |
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

*Last updated: 2026-05-09. Update this file when a new feature is added or a workflow changes.*
