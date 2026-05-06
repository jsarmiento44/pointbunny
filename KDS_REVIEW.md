# Order Queue (KDS) — Code Review

## What Was Built

A full-screen Kitchen Display System (KDS) accessible from the main screen via the **Order Queue** card. Every completed transaction pushes a live order card to the queue. Each card has a count-up timer that changes color based on configurable thresholds, and a **Done** button that records the serve time back to the database.

---

## Files Changed

| File | Type | What changed |
|---|---|---|
| `Javascript/model.js` | Modified | Added `orderQueue` to state, KDS settings, `recordServeTime()` |
| `Javascript/controller.js` | Modified | KDS tick loop, mark-done logic, wired handlers |
| `Javascript/Views/kdsView.js` | New | Full KDS view — render, timers, sound |
| `Javascript/Views/settingsView.js` | Modified | KDS threshold inputs |
| `index.html` | Modified | Order Queue card, KDS panel, Settings section |
| `pointy.css` | Modified | KDS card grid, timer colors, threshold inputs |

---

## Data Flow

```
Transaction completes (_finaliseSale)
  → sale.id (crypto.randomUUID()) inserted to Supabase with our own ID
  → { id, items, startedAt, totalPrice } pushed to state.orderQueue
  → _ensureKDSTick() starts a 1s setInterval if not already running
  → KDSView.renderQueue() re-renders all visible cards (max 10)
  → KDSView.playNewOrderSound() fires a C-E-G chime

Every second (_tickKDS)
  → Checks each order's elapsed time against kdsAutoCompleteThreshold
  → If expired → controlMarkOrderDone(id, timedOut: true)
  → Otherwise → KDSView.updateTimers() patches timer text + CSS class in place

Done clicked / auto-complete fires (controlMarkOrderDone)
  → Splices order from state.orderQueue immediately (sync)
  → Re-renders the queue
  → Stops the tick if queue is now empty
  → Calls model.recordServeTime(id, timedOut) → PATCH sales row:
      prepared_at = now()
      timed_out   = true | false
```

---

## State Shape

```js
// Added to model.state
orderQueue: [
  {
    id: string,        // crypto.randomUUID() — our own ID, matches sales.id
    items: CartItem[], // snapshot of cart at time of sale
    startedAt: number, // Date.now() ms timestamp — source of truth for timer
    totalPrice: number,
  }
]

// Added to model.state.settings
kdsYellowThreshold:      number  // default 180  (3 min) — localStorage: pointy_kds_yellow
kdsRedThreshold:         number  // default 300  (5 min) — localStorage: pointy_kds_red
kdsAutoCompleteThreshold: number // default 900  (15 min) — localStorage: pointy_kds_auto
```

---

## Known Limitations & Things to Watch

### 1. Queue resets on page reload
`state.orderQueue` is in-memory only. If the cashier refreshes, in-flight orders disappear from the queue (they still exist in Supabase, just not on screen).

**Future fix (revisit during backend wiring):** On login, fetch sales where `prepared_at IS NULL AND sale_date = today` and rebuild `state.orderQueue` from those rows. The `items` and `total_price` columns are already stored in the `sales` table so no schema changes are needed. Estimated ~15-20 lines in `initApp`.

### 2. Sound requires user interaction first
`AudioContext` is blocked by browsers until the user has interacted with the page. The first order pushed immediately after login may not produce sound. All subsequent orders will. The `try/catch` silently swallows this — no error is shown.

### 3. Queue shows max 10 cards
`queue.slice(0, 10)` — orders 11+ are in state but not rendered. This is intentional per spec. Orders still auto-complete correctly even when not visible, because the tick loop iterates the full `state.orderQueue`, not just the visible slice.

### 4. Auto-complete fires multiple orders per tick
If several orders expire in the same 1s tick, `expired.forEach(o => controlMarkOrderDone(...))` calls the async function for each without awaiting. The synchronous splice happens first for all of them (safe — JS is single-threaded), and the Supabase PATCHes fire concurrently. This is fine.

### 5. Timer update skipped when auto-completes fire
In `_tickKDS`, `KDSView.updateTimers` is only called when `expired.length === 0`. On a tick that auto-completes one or more orders, remaining order timers won't visually update until the next tick. Max 1-second delay — not noticeable.

### 6. `timed_out` column needs a default in Supabase
Make sure the migration sets `DEFAULT false` so manual sales that predate this feature don't have NULL values.

---

## Settings

Three inputs in the Settings modal under **Order Queue Timers**:

| Setting | ID | Default | Stored in |
|---|---|---|---|
| Yellow warning | `kdsYellowInput` | 180s | `localStorage` |
| Red urgent | `kdsRedInput` | 300s | `localStorage` |
| Auto-complete | `kdsAutoInput` | 900s | `localStorage` |

Changes take effect immediately on the next tick — no save button needed, fires on input `change` (blur after edit).

---

## Sound Design

Three sine oscillators staggered 70ms apart — C5 (523Hz), E5 (659Hz), G5 (784Hz). Each fades in over 20ms and decays over 350ms. Total sound duration ~0.5s. Wrapped in `try/catch` so a blocked `AudioContext` never surfaces as an error.

---

## CSS Classes Reference

| Class | Description |
|---|---|
| `.kds-grid` | Responsive auto-fill grid, max 10 cards |
| `.kds-card` | Individual order card with enter animation |
| `.kds-order-num` | Green `#N` label |
| `.kds-timer` | Count-up timer, muted by default |
| `.kds-timer--warn` | Amber — elapsed ≥ yellow threshold |
| `.kds-timer--urgent` | Red — elapsed ≥ red threshold |
| `.kds-done-btn` | Primary button, fires `controlMarkOrderDone` |
| `.kds-empty` | Centered placeholder when queue is empty |
| `.kds-threshold-input` | Number input in settings |
