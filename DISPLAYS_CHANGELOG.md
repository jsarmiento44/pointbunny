# Displays Feature — Full Changelog & Workflow Guide

## What Was Built

Three major features added on top of the existing Pointbunny POS:

| Feature | Description |
|---|---|
| **KDS External Window** | A separate browser window for kitchen staff showing the live order queue. Cooks can mark orders done from their own screen. |
| **Customer Facing Display (CFD)** | A separate browser window facing the customer, showing live cart updates and a thank-you screen after each transaction. |
| **Click Analytics** | A passive, non-blocking system that records every button click and batches them to Supabase every 5 minutes. |

All three communicate using the browser's native **`BroadcastChannel` API** — a zero-latency pub/sub system between browser tabs/windows on the same origin. No WebSockets, no polling, no server required.

---

## Files Created

| File | Purpose |
|---|---|
| `Javascript/channel.js` | Shared BroadcastChannel instance + message type constants |
| `Javascript/kds-display.js` | Entry point for the kitchen display window |
| `Javascript/customer-display.js` | Entry point for the customer display window |
| `Javascript/display-theme.js` | Shared theme sync module for both display pages |
| `Javascript/analytics.js` | Click recorder, local buffer, and Supabase flush |
| `kds-display.html` | Kitchen display page (standalone, no login) |
| `kds-display.css` | Kitchen display styles + animations |
| `customer-display.html` | Customer display page (standalone, no login) |
| `customer-display.css` | Customer display styles + animations |

## Files Modified

| File | What changed |
|---|---|
| `Javascript/controller.js` | KDS/CFD window openers, cart broadcasts, channel listener, analytics init/destroy |
| `Javascript/model.js` | `kdsWindowSize`, `cfdWindowSize` added to settings; `uploadCFDAdImage`, `removeCFDAdImage` added |
| `Javascript/Views/settingsView.js` | Display size selectors, ad image upload/preview/remove methods |
| `index.html` | Kitchen + Customer nav buttons; Displays section in Settings modal |
| `pointbunny.css` | Nav display button styles + reveal animation; Display settings CSS |
| `package.json` | Parcel entry points expanded to include all three HTML files |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Main App (index.html)                  │
│                                                     │
│  controller.js  ←──────────────────────────────┐   │
│       │                                         │   │
│       │  writes to                              │   │
│       ▼                                         │   │
│  model.state                                    │   │
│   ├── orderQueue[]                              │   │
│   ├── cart[]                                    │   │
│   └── settings{}                               │   │
│                                                     │
│       │  broadcasts via                             │
│       ▼                                             │
│  channel.js (BroadcastChannel 'pointbunny-displays')    │
└───────────────────────┬─────────────────────────────┘
                        │
          ┌─────────────┴──────────────┐
          │                            │
          ▼                            ▼
┌──────────────────┐        ┌──────────────────────┐
│  kds-display.html│        │customer-display.html  │
│  (Kitchen Window)│        │  (Customer Window)    │
│                  │        │                       │
│  kds-display.js  │        │  customer-display.js  │
│   - renders cards│        │   - renders cart      │
│   - runs timers  │        │   - shows total       │
│   - Done button  │        │   - thank-you screen  │
│        │         │        │   - ad image          │
│        │ KDS_    │        └──────────────────────┘
│        │ ORDER_  │
│        │ DONE    │
│        └─────────┼──────────────────────────────►
│                  │    back to controller.js
└──────────────────┘    → controlMarkOrderDone()
```

---

## BroadcastChannel Infrastructure

### `Javascript/channel.js`

The single shared communication channel. Both the main app and display pages import this file to get the same `BroadcastChannel` instance.

```js
const channel = new BroadcastChannel('pointbunny-displays');
export default channel;
```

All windows on `localhost:1234` that import this file are connected. When one calls `channel.postMessage(...)`, all others receive it via `channel.onmessage`.

### Message Types (`MSG` constants)

| Constant | Direction | Payload | Meaning |
|---|---|---|---|
| `KDS_QUEUE_SYNC` | Main → Kitchen | `{ queue, thresholds }` | Full queue snapshot — sent on new order or order done |
| `KDS_REQUEST_SYNC` | Kitchen → Main | _(none)_ | Kitchen window just opened, needs current queue |
| `KDS_ORDER_DONE` | Kitchen → Main | `{ id }` | Cook marked an order done |
| `CFD_CART_UPDATE` | Main → CFD | `{ cart, total }` | Cart changed — add, remove, or quantity |
| `CFD_SALE_COMPLETE` | Main → CFD | _(none)_ | Transaction complete — show thank-you screen |
| `CFD_REQUEST_SYNC` | CFD → Main | _(none)_ | CFD just opened, needs current cart |

### Incoming message handler (in `controller.js`)

```
channel.onmessage receives:
  KDS_REQUEST_SYNC  → replies with KDS_QUEUE_SYNC (current queue + thresholds)
  KDS_ORDER_DONE    → calls controlMarkOrderDone(id) on the main app
  CFD_REQUEST_SYNC  → replies with CFD_CART_UPDATE (current cart + total)
```

---

## KDS External Window — Full Workflow

### Opening the window

```
User clicks "Kitchen" nav button
  → controlOpenKDSWindow() [controller.js]
  → window.open('kds-display.html', 'pointbunny-kds', 'width=X,height=Y')
  → if blocked: showToast with instructions
  → if opened: win.focus()
```

### Kitchen display initialises

```
kds-display.js loads
  → imports display-theme.js (applies saved theme)
  → channel.postMessage({ type: KDS_REQUEST_SYNC })
  → controller.js receives it
  → replies: { type: KDS_QUEUE_SYNC, queue: [...], thresholds: { yellow, red } }
  → kds-display.js receives KDS_QUEUE_SYNC
  → renderQueue() — builds card HTML for each order
  → startTick() — starts 1s setInterval for timers
```

### New order comes in (cashier side)

```
Transaction completes → _finaliseSale() [controller.js]
  → modelState.orderQueue.push({ id, items, startedAt, totalPrice })
  → _ensureKDSTick() — starts cashier-side tick if not running
  → KDSView.renderQueue() — updates the KDS panel inside the main app
  → channel.postMessage({ type: KDS_QUEUE_SYNC, queue, thresholds })
  → kds-display.js receives it → renderQueue() — new card appears in kitchen
  → KDSView.playNewOrderSound() — C-E-G chime
```

### Cook marks order done (kitchen side)

```
Cook clicks "Done" on a card in kds-display.html
  → kds-display.js click handler
  → removes order from local queue array
  → renderQueue() — card disappears from kitchen screen
  → channel.postMessage({ type: KDS_ORDER_DONE, id })

controller.js receives KDS_ORDER_DONE
  → calls controlMarkOrderDone(id)
  → finds order in modelState.orderQueue (guard: exits if not found)
  → splices it out
  → KDSView.renderQueue() — updates cashier's KDS panel
  → if queue empty: _stopKDSTick()
  → channel.postMessage({ type: KDS_QUEUE_SYNC, queue }) — syncs any other open windows
  → model.recordServeTime(order.saleDate, timedOut: false) → Supabase PATCH
```

### Cashier marks order done (main app side)

```
Cashier clicks "Done" in the KDS panel
  → KDSView._addHandlerDone fires → controlMarkOrderDone(id)
  → same flow as above, including KDS_QUEUE_SYNC broadcast
  → kitchen window receives KDS_QUEUE_SYNC → card disappears there too
```

### Timer tick (kitchen window)

```
Every 1 second (setInterval in kds-display.js):
  tick()
    → for each order in local queue:
        elapsed = (Date.now() - order.startedAt) / 1000
        updates timer text (m:ss)
        toggles .kds-timer--warn   if elapsed >= thresholds.yellow
        toggles .kds-timer--urgent if elapsed >= thresholds.red
        toggles .kds-card--warn / .kds-card--urgent for border pulse
```

### Functions in `kds-display.js`

| Function | What it does |
|---|---|
| `cardMarkup(order, num)` | Returns HTML string for one order card |
| `renderQueue()` | Slices queue to max 10, injects cards into `#kdsWinGrid`, updates count badge |
| `tick()` | Runs every second — patches timer text and CSS classes on existing cards |
| `startTick()` | Starts the 1s interval if not already running |
| `stopTick()` | Clears the interval |
| `channel.onmessage` | Handles `KDS_QUEUE_SYNC` — updates local queue, re-renders, starts/stops tick |
| _(click listener on grid)_ | Catches Done button clicks → removes from local queue → broadcasts `KDS_ORDER_DONE` |

---

## Customer Facing Display — Full Workflow

### Opening the window

```
User clicks "Customer" nav button
  → controlOpenCFDWindow() [controller.js]
  → window.open('customer-display.html', 'pointbunny-cfd', 'width=X,height=Y')
  → if blocked: showToast with instructions
  → if opened: win.focus()
```

### CFD initialises

```
customer-display.js loads
  → imports display-theme.js (applies saved theme)
  → reads localStorage('pointbunny_cfd_ad') — shows ad image if set
  → reads localStorage('pointbunny_store_name') — sets store name in header
  → channel.postMessage({ type: CFD_REQUEST_SYNC })
  → controller.js receives it
  → replies: { type: CFD_CART_UPDATE, cart: [...], total: X }
  → customer-display.js receives it → renderCart()
```

### Item added to cart

```
Cashier adds item → controlPushToModelCart() [controller.js]
  → model.state.cart.push(item)
  → _broadcastCart()
      → channel.postMessage({ type: CFD_CART_UPDATE, cart, total })
  → CFD receives it → renderCart(cart, total)
      → builds .cfd-cart-row HTML for each item (with stagger animation)
      → updates total bar
      → pulses total amount (.updated class → CSS animation)
```

### Item removed from cart

```
Cashier removes item → controlDeleteCartItemInOrder() or controlDeleteCartItemInCheckout()
  → model.deleteCartItem(index)
  → _broadcastCart() → same flow as above
  → CFD re-renders with updated cart
```

### Transaction completes

```
_finaliseSale() [controller.js]
  → clearCart() — empties model.state.cart
  → channel.postMessage({ type: CFD_SALE_COMPLETE })
  → CFD receives it → showThankyou()
      → clears cart HTML
      → hides total bar
      → .cfd-thankyou becomes visible (icon draws in, text rises)
      → after 3.5s: thankyou hides, shows "Waiting for order…"
```

### Functions in `customer-display.js`

| Function | What it does |
|---|---|
| `renderCart(cart, total)` | Clears thank-you, builds cart row HTML with stagger animation, shows/hides total bar, pulses total |
| `showThankyou()` | Hides cart + total, shows animated thank-you panel, auto-reverts after 3.5s |
| `channel.onmessage` | Routes `CFD_CART_UPDATE` → `renderCart()` and `CFD_SALE_COMPLETE` → `showThankyou()` |

### `_broadcastCart()` in `controller.js`

Called by: `controlPushToModelCart`, `controlDeleteCartItemInOrder`, `controlDeleteCartItemInCheckout`

```js
_broadcastCart()
  → reads modelState.cart
  → computes total (sum of item.totalPrice)
  → channel.postMessage({ type: CFD_CART_UPDATE, cart, total })
```

---

## Theme Sync — Full Workflow

### `Javascript/display-theme.js`

Shared module imported by both display pages. Runs immediately on import.

```
display-theme.js loads
  → reads localStorage('pointbunny-theme') — defaults to 'dark' if not set
  → apply(theme) → document.body.setAttribute('data-theme', theme)
  → updates toggle button icon: dark = '☀︎', light = '✦'

window 'storage' event listener:
  → fires when any other tab/window writes to localStorage
  → if key === 'pointbunny-theme' → apply(newValue)
  → display page updates without any refresh

Toggle button click:
  → reads current body data-theme
  → flips to opposite theme
  → apply(next)
  → writes to localStorage (triggers storage event in other windows)
```

This means:
- If the cashier switches theme on the main app → both display windows update immediately
- Each display page can also be toggled independently
- Theme persists across page refreshes and new window opens

---

## Analytics — Full Workflow

### `Javascript/analytics.js`

Passive, non-blocking. Never affects app performance.

```
init(userId) called from initApp() [controller.js]
  → stores userId
  → adds delegated click listener to document (capture phase)
  → starts 5-minute flush interval
```

### Recording a click

```
User clicks anything
  → _record(event) fires (capture phase, before app handlers)
  → _identify(target):
      → walks up DOM to nearest button / [role="button"] / [data-action]
      → identifies by: el.id → data-action → aria-label → textContent (40 char max)
      → returns { buttonId, label }
  → pushes { user_id, button_id, label, clicked_at } to _buffer[]
  → if buffer >= 500: stops recording (prevents memory growth in very long sessions)
```

### Flushing to Supabase

```
Every 5 minutes OR on sign out:
  flush()
    → if buffer empty or no userId: exits immediately
    → splices all events out of _buffer (clears it atomically)
    → supabase.from('analytics').insert(events)
    → if error: silently swallowed — analytics never crashes the app
```

### Sign out flow

```
controlSignOut() [controller.js]
  → shows exit sweep animation
  → await destroyAnalytics()
      → removes click listener
      → clears flush interval
      → await flush() — sends any remaining events
  → await supabase.auth.signOut()
  → setTimeout: window.location.reload() after 500ms
```

### Supabase table required

```sql
create table analytics (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users on delete set null,
  button_id  text        not null,
  label      text,
  clicked_at timestamptz not null default now()
);
alter table analytics enable row level security;
create policy "insert own" on analytics for insert
  with check (auth.uid() = user_id);
```

---

## Settings UI — Display Windows Section

A new **Displays** section was added to the Settings modal with two sub-sections.

### KDS Window sub-section

- **Screen size selector** — presets: Tablet (1024×768), HD (1280×720), Full HD (1920×1080), Custom
- Custom inputs appear when "Custom…" is selected
- Changes are saved immediately to `model.state.settings.kdsWindowSize` and `localStorage('pointbunny_kds_window_size')`

```
User changes KDS size select
  → SettingsView._addHandlerDisplaySizes fires
  → reads selected preset or custom width/height
  → controlSaveKDSWindowSize({ width, height }) [controller.js]
  → model.state.settings.kdsWindowSize = size
  → localStorage.setItem('pointbunny_kds_window_size', JSON.stringify(size))
  → next window.open() uses the new size
```

### Customer Display sub-section

- **Screen size selector** — same presets as KDS
- **Ad image upload** — uploads to Supabase storage (same bucket as menu images), saves URL to `localStorage('pointbunny_cfd_ad')`
- **Thumbnail preview** — shown immediately after upload
- **Remove button** — clears localStorage and hides preview

```
User uploads ad image
  → SettingsView._addHandlerCFDAdUpload fires with File
  → controlUploadCFDAd(file) [controller.js]
  → model.uploadCFDAdImage(file)
      → uploadImage(file) [model.js] → Supabase storage upload
      → returns public URL
      → localStorage.setItem('pointbunny_cfd_ad', url)
  → SettingsView.showCFDAdPreview(url) — shows thumbnail

User removes ad image
  → controlRemoveCFDAd() [controller.js]
  → model.removeCFDAdImage()
      → localStorage.removeItem('pointbunny_cfd_ad')
  → settingsView hides preview and remove button

CFD window reads ad on load:
  → localStorage.getItem('pointbunny_cfd_ad')
  → if exists: sets img src, shows .cfd-ad container
```

---

## Nav Bar Changes

Two buttons added to the navigation bar, hidden before login:

```
index.html — nav bar:
  [Kitchen button] [Customer button] [theme toggle] [settings] [logout]

On page load: both buttons have class 'hidden'

_wireApp() [controller.js]:
  → kdsWindowBtn.classList.remove('hidden')  ← slides in with CSS animation
  → cfdWindowBtn.classList.remove('hidden')  ← slides in 60ms after Kitchen
  → wires click → controlOpenKDSWindow / controlOpenCFDWindow
```

---

## package.json Change

Parcel must know about all HTML entry points to serve them correctly. Without this, navigating to `kds-display.html` falls back to `index.html`.

```json
Before:
  "start": "parcel index.html"
  "build": "parcel build index.html"

After:
  "start": "parcel index.html kds-display.html customer-display.html"
  "build": "parcel build index.html kds-display.html customer-display.html"
```

---

## model.js Additions

| Addition | Type | What it does |
|---|---|---|
| `state.orderQueue` | Existing (was already there) | In-memory queue — the source of truth for KDS |
| `state.settings.kdsWindowSize` | New setting | `{ width, height }` — persisted to localStorage |
| `state.settings.cfdWindowSize` | New setting | `{ width, height }` — persisted to localStorage |
| `uploadCFDAdImage(file)` | New function | Uploads to Supabase storage, saves URL to localStorage |
| `removeCFDAdImage()` | New function | Removes URL from localStorage |

---

## controller.js Additions Summary

| Function | Called from | What it does |
|---|---|---|
| `controlOpenKDSWindow()` | Kitchen nav button | Opens `kds-display.html` popup, shows toast if blocked |
| `controlOpenCFDWindow()` | Customer nav button | Opens `customer-display.html` popup, shows toast if blocked |
| `_broadcastCart()` | Cart mutation points | Broadcasts current cart to CFD via channel |
| `controlSaveKDSWindowSize(size)` | Settings size selector | Saves KDS window size to state + localStorage |
| `controlSaveCFDWindowSize(size)` | Settings size selector | Saves CFD window size to state + localStorage |
| `controlUploadCFDAd(file)` | Settings ad upload | Uploads ad image, shows preview in settings |
| `controlRemoveCFDAd()` | Settings remove button | Removes ad from localStorage |
| `channel.onmessage` | BroadcastChannel | Routes incoming messages from display windows |

### Existing functions modified

| Function | What was added |
|---|---|
| `_finaliseSale()` | `KDS_QUEUE_SYNC` broadcast after push; `CFD_SALE_COMPLETE` broadcast after `clearCart()` |
| `controlMarkOrderDone()` | `KDS_QUEUE_SYNC` broadcast after splice |
| `controlPushToModelCart()` | `_broadcastCart()` call after cart push |
| `controlDeleteCartItemInOrder()` | `_broadcastCart()` call after delete |
| `controlDeleteCartItemInCheckout()` | `_broadcastCart()` call after delete |
| `controlOpenSettings()` | `SettingsView.syncDisplaySizes()` call |
| `initApp()` | Stores store name to localStorage; calls `initAnalytics(userId)` |
| `controlSignOut()` | `await destroyAnalytics()` before sign out |
| `_wireApp()` | Reveals nav display buttons; wires all new settings handlers |

---

## Complete Data Flow — One Full Transaction

```
1. Cashier opens New Order
   → controlNewOrder() → NewOrderView.render()

2. Cashier adds item to cart
   → controlPushToModelCart()
   → model.state.cart.push(item)
   → _broadcastCart()
   → CFD receives CFD_CART_UPDATE → shows item in customer display

3. Cashier removes item
   → controlDeleteCartItemInOrder()
   → model.deleteCartItem()
   → _broadcastCart()
   → CFD updates immediately

4. Cashier hits checkout → confirms transaction
   → controlConcludeTransaction()
   → _buildSale() → snapshot of cart
   → _finaliseSale(sale)
       → supabase INSERT into sales table
       → modelState.orderQueue.push(order)
       → _ensureKDSTick() — starts cashier-side timer
       → KDSView.renderQueue() — updates cashier's KDS panel
       → KDSView.playNewOrderSound() — chime
       → channel.postMessage(KDS_QUEUE_SYNC) → kitchen window shows new card
       → clearCart()
       → channel.postMessage(CFD_SALE_COMPLETE) → CFD shows thank-you screen
       → model.clearReceiptAdjustments()
       → refreshTodaySalesDisplay()

5. Kitchen display receives new order
   → card appears with slide-up animation
   → count badge pops
   → timer starts counting up
   → at yellow threshold: card border turns amber + glows
   → at red threshold: card border turns red + pulses

6a. Cook marks Done (from kitchen window)
    → kds-display.js removes card locally
    → broadcasts KDS_ORDER_DONE { id }
    → controller.js receives it
    → controlMarkOrderDone(id)
        → splices from modelState.orderQueue
        → KDSView.renderQueue() — updates cashier panel
        → broadcasts KDS_QUEUE_SYNC — other open kitchen windows sync
        → model.recordServeTime() → Supabase PATCH (prepared_at, timed_out: false)

6b. Cashier marks Done (from main app KDS panel)
    → controlMarkOrderDone(id)
    → same as above including KDS_QUEUE_SYNC broadcast
    → kitchen window receives sync → card disappears there too

7. Analytics throughout
   → every button click → _record() → local buffer
   → every 5 min or on sign out → flush() → supabase INSERT analytics rows
```
