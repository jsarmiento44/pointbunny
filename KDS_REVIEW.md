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
| `pointbunny.css` | Modified | KDS card grid, timer colors, threshold inputs |

---

## Data Flow

### 1. Transaction completes

**Controller** — `_finaliseSale` (`controller.js:297`)
- Calls `supabase.from('sales').insert(...)` to persist the sale to the database (`controller.js:299–311`)
- Pushes `{ id, items, startedAt, totalPrice }` into `state.orderQueue` (`controller.js:316–322`)
- Calls `_ensureKDSTick()` to start the 1s interval if it isn't already running (`controller.js:323`)
- Calls `KDSView.renderQueue()` and `KDSView.playNewOrderSound()` to update the screen (`controller.js:324–325`)

**Model** — `model.state.orderQueue` (`model.js:17`)
- Receives the new order entry. This is the single source of truth for what's currently on the KDS. Nothing else — not the `sales` table, not `salesBasket` — drives the live queue display.

**View** — `KDSView.renderQueue` (`kdsView.js:15`)
- Receives the full `orderQueue` array, slices the first 10, and builds card HTML for each order via `_cardMarkup()` (`kdsView.js:29`). Injects the result straight into `#kdsGrid`.

**View** — `KDSView.playNewOrderSound` (`kdsView.js:71`)
- Creates a fresh `AudioContext`, fires three sine oscillators (C5 → E5 → G5) staggered 70ms apart. No state involved — pure side effect.

---

### 2. Every second (tick loop)

**Controller** — `_tickKDS` (`controller.js:251`)
- Reads `state.orderQueue` and `state.settings` thresholds from the model
- Filters for expired orders (`elapsed >= kdsAutoCompleteThreshold`) (`controller.js:255–257`)
- If any expired: calls `controlMarkOrderDone(id, true)` for each (`controller.js:258`) — see step 3
- If none expired: calls `KDSView.updateTimers()` to patch the DOM in place (`controller.js:260`)

**Model** — `model.state.settings` (`model.js:28–30`)
- Passively provides `kdsYellowThreshold`, `kdsRedThreshold`, `kdsAutoCompleteThreshold`. The controller reads these on every tick — no model function is called, just direct state access.

**View** — `KDSView.updateTimers` (`kdsView.js:53`)
- Receives the queue + current timestamp + thresholds from the controller. For each order, it calculates elapsed time, formats the `m:ss` string, and toggles `.kds-timer--warn` / `.kds-timer--urgent` and `.kds-card--warn` / `.kds-card--urgent` CSS classes directly on existing DOM elements. No full re-render — just patches what's already there.

---

### 3. Done clicked or auto-complete fires

**Controller** — `controlMarkOrderDone` (`controller.js:264`)
- Splices the order out of `state.orderQueue` immediately (synchronous) (`controller.js:268`)
- Calls `KDSView.renderQueue()` to reflect the removal (`controller.js:269`)
- Stops the tick interval if the queue is now empty (`controller.js:270`)
- Calls `model.recordServeTime(order.saleDate, timedOut)` to write back to Supabase (`controller.js:272`)

**Model** — `model.recordServeTime` (`model.js:614`)
- Issues a Supabase `UPDATE` on the `sales` row matching `sale_date` and `user_id`, setting `prepared_at = now()` and `timed_out = true|false`. This is the only model function called in this step — the queue mutation itself happens directly in the controller.

**View** — `KDSView.renderQueue` (`kdsView.js:15`)
- Same as step 1 — re-renders the full grid from the now-smaller queue. The removed card simply disappears because it's no longer in the array.

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
kdsYellowThreshold:      number  // default 180  (3 min) — localStorage: pointbunny_kds_yellow
kdsRedThreshold:         number  // default 300  (5 min) — localStorage: pointbunny_kds_red
kdsAutoCompleteThreshold: number // default 900  (15 min) — localStorage: pointbunny_kds_auto
```

**Where these are declared:**

- `state.orderQueue` — `Javascript/model.js:17`
- `kdsYellowThreshold`, `kdsRedThreshold`, `kdsAutoCompleteThreshold` — `Javascript/model.js:28–30`

---

## Known Limitations & Things to Watch

### 1. Queue resets on page reload
`state.orderQueue` is in-memory only. If the cashier refreshes, in-flight orders disappear from the queue (they still exist in Supabase, just not on screen).

> `state.orderQueue` declared at `Javascript/model.js:17` — never persisted to localStorage or Supabase on write.

**Future fix (revisit during backend wiring):** On login, fetch sales where `prepared_at IS NULL AND sale_date = today` and rebuild `state.orderQueue` from those rows. The `items` and `total_price` columns are already stored in the `sales` table so no schema changes are needed. Estimated ~15-20 lines in `initApp` (`Javascript/controller.js:633`).

### 2. Sound requires user interaction first
`AudioContext` is blocked by browsers until the user has interacted with the page. The first order pushed immediately after login may not produce sound. All subsequent orders will. The `try/catch` silently swallows this — no error is shown.

> `KDSView.playNewOrderSound` — `Javascript/Views/kdsView.js:71`
> Silent `catch (_) {}` — `Javascript/Views/kdsView.js:88`

### 3. Queue shows max 10 cards
`queue.slice(0, 10)` — orders 11+ are in state but not rendered. This is intentional per spec. Orders still auto-complete correctly even when not visible, because the tick loop iterates the full `state.orderQueue`, not just the visible slice.

> `queue.slice(0, 10)` — `Javascript/Views/kdsView.js:16` (inside `renderQueue`)
> Full queue iteration — `Javascript/controller.js:255` (inside `_tickKDS`)

### 4. Auto-complete fires multiple orders per tick
If several orders expire in the same 1s tick, `expired.forEach(o => controlMarkOrderDone(...))` calls the async function for each without awaiting. The synchronous splice happens first for all of them (safe — JS is single-threaded), and the Supabase PATCHes fire concurrently. This is fine.

> `expired.forEach(o => controlMarkOrderDone(o.id, true))` — `Javascript/controller.js:258`
> `controlMarkOrderDone` (async, not awaited in forEach) — `Javascript/controller.js:264`

### 5. Timer update skipped when auto-completes fire
In `_tickKDS`, `KDSView.updateTimers` is only called when `expired.length === 0`. On a tick that auto-completes one or more orders, remaining order timers won't visually update until the next tick. Max 1-second delay — not noticeable.

> `if (expired.length === 0)` guard — `Javascript/controller.js:259–261` (inside `_tickKDS`)

### 6. `timed_out` column needs a default in Supabase
Make sure the migration sets `DEFAULT false` so manual sales that predate this feature don't have NULL values.

> `timed_out` field written by `model.recordServeTime` — `Javascript/model.js:619`

---

## Settings

Three inputs in the Settings modal under **Order Queue Timers**:

| Setting | ID | Default | Stored in |
|---|---|---|---|
| Yellow warning | `kdsYellowInput` | 180s | `localStorage` |
| Red urgent | `kdsRedInput` | 300s | `localStorage` |
| Auto-complete | `kdsAutoInput` | 900s | `localStorage` |

Changes take effect immediately on the next tick — no save button needed, fires on input `change` (blur after edit).

**Where the wiring lives:**

- `controlSaveKDSThresholds` (writes to `model.state.settings` + `localStorage`) — `Javascript/controller.js:286`
- Handler wired in `_wireApp` via `SettingsView._addHandlerKDSThresholds` — `Javascript/controller.js:1028`
- Settings panel syncs displayed values on open via `controlOpenSettings` — `Javascript/controller.js:407`, specifically `SettingsView.syncKDSThresholds(...)` call at `Javascript/controller.js:413–417`

---

## Sound Design

Three sine oscillators staggered 70ms apart — C5 (523Hz), E5 (659Hz), G5 (784Hz). Each fades in over 20ms and decays over 350ms. Total sound duration ~0.5s. Wrapped in `try/catch` so a blocked `AudioContext` never surfaces as an error.

> `KDSView.playNewOrderSound` — `Javascript/Views/kdsView.js:71–89`
> Frequencies array — `Javascript/Views/kdsView.js:74`

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

> Timer classes toggled in `KDSView.updateTimers` — `Javascript/Views/kdsView.js:64–67`
> Card classes also toggled there — `Javascript/Views/kdsView.js:66–67`
> Done button handler wired in `KDSView._addHandlerDone` — `Javascript/Views/kdsView.js:99`
