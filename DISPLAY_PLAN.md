# Display Features Plan — CFD & KDS External Window

## Overview

Two new external displays, both opening as separate browser windows so they can be moved to dedicated screens:

| Display | Audience | Can mark orders done? |
|---|---|---|
| **CFD** (Customer Facing Display) | Customer | No — read only |
| **KDS Window** (Kitchen Display) | Cooks | Yes |

The existing KDS panel inside `index.html` stays as-is — cashiers can still mark orders done from there. The new KDS window gives the kitchen the same ability on their own screen.

Both displays sync via the **`BroadcastChannel` API** — a native browser feature that lets separate tabs/windows on the same origin pass messages instantly, no server needed.

---

## Chunk 1 — BroadcastChannel Infrastructure

Shared communication layer used by both features. Build this first — everything else depends on it.

- [x] Create `Javascript/channel.js` — exports a single `BroadcastChannel` instance named `'pointbunny-displays'`
- [x] Define and document the message types the channel will carry:
  - `KDS_QUEUE_SYNC` — full queue snapshot (sent when a new KDS window opens so it gets current state immediately)
  - `KDS_ORDER_DONE` — an order was marked done from the kitchen window (cashier side must receive this and update `state.orderQueue`)
  - `CFD_CART_UPDATE` — cart changed (item added, item removed, quantity changed)
  - `CFD_SALE_COMPLETE` — transaction finished, customer display should clear the cart and show a thank-you screen
- [x] Import `channel.js` into `controller.js` and `kdsView.js`

---

## Chunk 2 — KDS External Window

### 2a — The kitchen display page

- [x] Create `kds-display.html` — standalone page, no login, no nav
- [x] Create `Javascript/kds-display.js` — handles channel, render, timers, done clicks
- [x] Create `kds-display.css`

### 2b — Cashier side wiring

- [x] Broadcast `KDS_QUEUE_SYNC` (with thresholds) in `_finaliseSale` and `controlMarkOrderDone`
- [x] Listen for `KDS_ORDER_DONE` → calls `controlMarkOrderDone(id)` (guard already exists in that function)
- [x] Listen for `KDS_REQUEST_SYNC` → responds with current queue + thresholds

### 2c — Open button & settings

- [x] `controlOpenKDSWindow` added to `controller.js`
- [x] `kdsWindowSize` added to `model.state.settings` (localStorage persisted)
- [x] **Kitchen** button added to nav bar in `index.html`
- [ ] Screen size selector in Settings UI (Chunk 5)

---

## Chunk 3 — CFD (Customer Facing Display)

### 3a — The customer display page

- [x] Create `customer-display.html`
- [x] Create `Javascript/customer-display.js` — channel listener, render, thank-you screen, ad image
- [x] Create `customer-display.css`

### 3b — Cashier side wiring

- [x] `_broadcastCart()` added — called in `controlPushToModelCart`, `controlDeleteCartItemInOrder`, `controlDeleteCartItemInCheckout`
- [x] `CFD_SALE_COMPLETE` broadcast in `_finaliseSale` after `clearCart()`
- [x] `CFD_REQUEST_SYNC` listener responds with current cart

### 3c — Advertisement image

- [x] `customer-display.js` reads `pointbunny_cfd_ad` from localStorage on load
- [ ] Ad image upload in Settings UI (Chunk 5)
- [ ] `uploadCFDAdImage()` in `model.js` (Chunk 5)

### 3d — Open button & settings

- [x] `controlOpenCFDWindow` added to `controller.js`
- [x] `cfdWindowSize` added to `model.state.settings` (localStorage persisted)
- [x] **Customer** button added to nav bar in `index.html`
- [x] Store name persisted to `localStorage` so CFD can display it without login
- [ ] Screen size selector in Settings UI (Chunk 5)

---

## Chunk 4 — Navigation Bar Buttons

The open buttons for both displays live in the **navigation bar**, not alongside other action buttons or inside Settings. Settings only handles configuration (size, ad image). Launching the window is a one-click action from the nav.

- [x] Add **Kitchen Display** nav button to `index.html` nav bar
- [x] Add **Customer Display** nav button to `index.html` nav bar
- [x] Style both buttons in `pointbunny.css` (`.nav-display-btn`)
- [ ] Both buttons should be visible only when logged in (same as current nav behavior) — deferred to Chunk 6

---

## Chunk 5 — Settings UI

All configuration (not launching) lives in the Settings modal under a new **Displays** section.

- [x] Add **Displays** section to the Settings modal in `index.html`
- [x] KDS Window sub-section — screen size selector with presets + custom inputs
- [x] Customer Display sub-section — screen size selector, ad image upload, preview, remove button
- [x] `settingsView.js` — `syncDisplaySizes`, `_addHandlerDisplaySizes`, `_addHandlerCFDAdUpload`, `showCFDAdPreview`, `_addHandlerCFDAdRemove`
- [x] `controller.js` — `controlSaveKDSWindowSize`, `controlSaveCFDWindowSize`, `controlUploadCFDAd`, `controlRemoveCFDAd`
- [x] `model.js` — `uploadCFDAdImage`, `removeCFDAdImage`

---

## Chunk 6 — CSS & Polish

- [x] `kds-display.html` — dark theme, card grid, urgent pulse animation, warn glow, done button lift
- [x] `customer-display.html` — large readable text, row slide-in with stagger, total pop animation, brand glow
- [x] Idle state — "Waiting for order…" breathes gently
- [x] Thank-you screen — icon draws in, text rises, sub-text delayed
- [x] Nav display buttons slide in after login, hidden before
- [x] Ad preview reveal animation in settings
- [x] Custom size inputs slide open smoothly
- [x] All polish appended to end of respective CSS files

---

## Chunk 7 — Click Analytics (Low Priority)

A passive click counter for every button in the app. No UI needed initially — just data collection for future analysis (most-used features, dead buttons, workflow patterns).

### Strategy
- Intercept clicks at the document level with a single delegated listener — no need to touch every individual button
- Every click on a `<button>` or `[data-action]` element records: button id/label, timestamp, and user id
- Store locally in `localStorage` as a rolling array, flush to Supabase periodically or on logout

### Tasks
- [x] Create `Javascript/analytics.js` — delegated click listener, local buffer (max 500), flush on interval + sign out
- [x] Button identified by: `id` → `data-action` → `aria-label` → `textContent` (capped 40 chars)
- [x] Flush to Supabase every 5 minutes and on `controlSignOut` via `destroyAnalytics()`
- [x] `initAnalytics(userId)` called at end of `initApp`
- [x] Analytics errors are silently swallowed — never surfaces to the user

**Supabase table to create (run in SQL editor):**
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

**Note on display pages:** KDS display "Done" clicks are tracked on the main window side when `controlMarkOrderDone` fires via `KDS_ORDER_DONE`. CFD has no customer-facing buttons. Display page analytics not needed.

---

## Notes & Decisions to Revisit

- **Ad image storage**: currently planned as Supabase storage (same pattern as menu images). Could be localStorage base64 if we want to avoid the upload complexity for now.
- **KDS window auto-reconnect**: if the kitchen display is refreshed, it sends `KDS_REQUEST_SYNC` and the cashier side responds. This only works if the cashier tab is still open. Edge case to handle later.
- **Multiple kitchen displays**: `BroadcastChannel` is broadcast by nature — if two KDS windows are open, both receive all messages and both can mark orders done. The guard in `controlMarkOrderDone` (check if order still exists before acting) handles duplicate fires safely.
- **CFD idle screen**: when no active cart, the CFD should show something. Options: just the ad image full-screen, or store name + ad. Decide during Chunk 5.
