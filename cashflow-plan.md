# Cashflow Feature — Implementation Plan

**Goal:** Full-screen cashflow dashboard. Gross revenue (from sales), manual expenses, net income. Filterable by period. Expenses stored in Supabase with full audit trail.

**Currency:** USD (`$`)  
**Expense category:** Free-text with suggestions (HTML `<datalist>` — user can type anything or pick a hint)  
**Audit trail:** Each expense stores `created_by` + `created_at` — sets up future admin/role filtering

---

## Phase 1 — Supabase

- [x] **1.1** Run this SQL in Supabase SQL editor to create the `expenses` table:

```sql
create table expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  store_name text not null,
  amount numeric(10, 2) not null check (amount > 0),
  description text not null,
  category text,
  expense_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by text not null
);

-- RLS
alter table expenses enable row level security;

create policy "Users can read their own expenses"
  on expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own expenses"
  on expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own expenses"
  on expenses for delete
  using (auth.uid() = user_id);
```

---

## Phase 2 — Model (`Javascript/model.js`)

- [x] **2.1** Add `expenses: []` and `cashflowSales: []` to the `state` object
- [x] **2.2** Add `fetchCashflowData(startISO, endISO)` — queries `sales` and `expenses` tables filtered by date range, stores results in `state.cashflowSales` and `state.expenses`
- [x] **2.3** Add `addExpense({ amount, description, category, expense_date })` — inserts row into Supabase `expenses` (auto-fills `user_id`, `store_name`, `created_by` from state), unshifts result to `state.expenses`
- [x] **2.4** Add `deleteExpense(id)` — deletes from Supabase, removes from `state.expenses`

---

## Phase 3 — HTML (`index.html`)

- [x] **3.1** Unlock the cash-flow nav card — removed `card--locked`, `aria-disabled="true"`, `tabindex="-1"`, and `<span class="coming-soon-badge">Soon</span>`
- [x] **3.2** Added `#cashflowPanel` full-screen panel (before auth overlay in body)
- [x] **3.3** Added `#addExpenseModal` with Amount, Description, Category (datalist), Date & Time fields

---

## Phase 4 — View (`Javascript/Views/cashflowView.js`)

- [x] **4.1** Scaffold `CashflowView` extending `View` — `_parentElement = #cashflowPanel`
- [x] **4.2** `open()` — removes `hidden` from panel, resets to "today" active
- [x] **4.3** `close()` — adds `hidden` back with exit animation (220ms)
- [x] **4.4** `renderSummary({ gross, expenses, net })` — updates summary spans, color-codes net
- [x] **4.5** `renderSalesList(sales)` — renders sales rows with empty state
- [x] **4.6** `renderExpensesList(expenses)` — renders expense rows with category badge, added-by, delete button
- [x] **4.7** `_addHandlerOpen(handler)`
- [x] **4.8** `_addHandlerClose(handler)`
- [x] **4.9** `_addHandlerPeriodChange(handler)`
- [x] **4.10** `_addHandlerCustomRange(handler)`
- [x] **4.11** `_addHandlerOpenAddExpense()` — also wires close btn and backdrop click
- [x] **4.12** `_addHandlerSubmitExpense(handler)`
- [x] **4.13** `_addHandlerDeleteExpense(handler)` — uses `showConfirmModal` from base View

---

## Phase 5 — Controller (`Javascript/controller.js`)

- [x] **5.1** `controlOpenCashflow()` — fetches today's data, opens panel, renders all
- [x] **5.2** `controlCloseCashflow()`
- [x] **5.3** `controlChangePeriod({ period, from, to })` — `_getCashflowRange` helper handles all periods incl. Mon–Sun week + custom
- [x] **5.4** `controlAddExpense(formData)` — inserts, re-renders expenses + summary, shows success toast
- [x] **5.5** `controlDeleteExpense(id)` — deletes, re-renders, shows success toast
- [x] **5.6** All handlers wired in `_wireApp()`

---

## Phase 6 — CSS (`pointy.css`)

- [x] **6.1** Full-screen panel base (z-index 8500, fade-in/out animation)
- [x] **6.2** Header bar
- [x] **6.3** Period strip (scrollable, pill buttons, active = brand green)
- [x] **6.4** Custom date range row
- [x] **6.5** Summary cards (Gross = green gradient, Expenses = amber, Net = green/red)
- [x] **6.6** Two-column scrollable body
- [x] **6.7** Row styles (delete button appears on hover)
- [x] **6.8** Add Expense modal styles
- [x] **6.9** Empty state
- [x] **6.10** Loading spinner
- [x] **6.11** Mobile responsive (stacked 1-column)

---

## Phase 7 — Polish

- [x] **7.1** Show toast on Supabase error (fetch or insert failure)
- [x] **7.2** Disable "Add Expense" submit button while inserting (prevent double-submit)
- [x] **7.3** After adding expense, scroll the expenses list to top
- [x] **7.4** Confirm before delete (uses base `showConfirmModal`)
- [x] **7.5** Period label in header updates (e.g. "Apr 28 – May 4")
- [x] **7.6** `created_by` uses `state.username`; `user_id` stored for future admin/roles

---

## Notes for future phases

- **Admin/roles:** `user_id` + `created_by` are stored on every expense. When admin roles ship, admins will query expenses across all `user_id`s under their store rather than filtering by a single `user_id`.
- **Sales fetch:** `fetchCashflowData` will query the `sales` table by `created_at` range using `.gte()` / `.lte()` Supabase filters — same pattern as existing queries.
- **Category suggestions** are non-exhaustive hints via `<datalist>`. Users can type anything; no validation enforces the list.
