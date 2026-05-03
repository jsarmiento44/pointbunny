# Supabase Migration Plan

Track progress here. Each chunk is designed to be a complete, shippable session.
Mark tasks `[x]` as completed so future sessions know where to resume.

---

## Chunk 1 — Foundation: Install, Schema, Connection
**Goal:** Supabase client installed, all tables created, connection verified. Nothing in the app changes yet.

- [x] `npm install @supabase/supabase-js`
- [x] Create `.env` at project root with `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- [x] Update `package.json` / Parcel config to expose env vars
- [x] Create `Javascript/supabase.js` — initializes and exports the Supabase client
- [x] Create all tables in Supabase SQL editor (schema below)
- [x] Enable Row Level Security (RLS) on all tables
- [x] Write and run RLS policies (owner-only access via `auth.uid()`)
- [x] Smoke test: import client in browser console, run a simple select

### Database Schema

```sql
-- Menu items (variants stored as JSONB to preserve complex nesting)
create table menu_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  item_name    text not null,
  price        numeric(10,2) not null,
  category     text not null,
  image_url    text,
  stock        text default 'in-stock',
  has_variants boolean default false,
  variants     jsonb default '[]',
  description  text,
  status       text default 'active',
  created_at   timestamptz default now()
);

-- Categories (independent list; not derived from menu_items)
create table menu_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  name       text not null,
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- Adjustment templates (the global list in Settings)
create table adjustments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  type        text not null,       -- 'fee' | 'discount'
  calculation text not null,       -- 'fixed' | 'percentage'
  value       numeric(10,2) not null,
  enabled     boolean default true,
  created_at  timestamptz default now()
);

-- Completed sales records
create table sales (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users not null,
  subtotal          numeric(10,2) not null,
  total_price       numeric(10,2) not null,
  customer_payment  numeric(10,2),
  customer_change   numeric(10,2),
  items             jsonb not null,        -- snapshot of cart items
  adjustments       jsonb default '[]',    -- snapshot of applied adjustments
  sale_date         timestamptz default now()
);

-- Employees
create table employees (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  role        text,
  system_role text,
  created_at  timestamptz default now()
);
```

### RLS Policies (run for each table)
```sql
-- Example for menu_items; repeat pattern for all tables
alter table menu_items enable row level security;

create policy "owner select" on menu_items for select using (auth.uid() = user_id);
create policy "owner insert" on menu_items for insert with check (auth.uid() = user_id);
create policy "owner update" on menu_items for update using (auth.uid() = user_id);
create policy "owner delete" on menu_items for delete using (auth.uid() = user_id);
```

---

## Chunk 2 — Authentication
**Goal:** User can log in and log out. App only loads after a valid session. Auth state persists on refresh.

- [x] Create `Javascript/Views/authView.js` — renders login form over the app
- [x] Create `Javascript/authController.js` (or add to controller.js) — handles sign-in, sign-out, session restore
- [x] On app load (`init()`): check `supabase.auth.getSession()` — if no session, show auth view
- [x] Wire sign-in form to `supabase.auth.signInWithPassword()`
- [x] Wire sign-out button (in settings or nav) to `supabase.auth.signOut()`
- [x] Subscribe to `supabase.auth.onAuthStateChange` — redirect on SIGNED_OUT
- [x] Store `user.id` on `state.userId` for use in all subsequent DB calls
- [x] Test: login → app loads; logout → login screen; refresh with valid session → stays in app

**Notes:**
- Use email/password auth for now (Supabase default)
- The username shown in the UI (`state.username`) can come from `user.email` or `user.user_metadata.name`
- Do NOT gate individual views — just guard the whole app at init

---

## Chunk 3 — Menu Items & Categories
**Goal:** All menu item and category CRUD reads/writes go through Supabase. In-memory seed data is removed.

### Async Conversion Pattern
All model functions become async. Controller functions that call them must `await`. Views that trigger controllers stay the same — the controller handles async internally.

```js
// Before (model.js)
export const uploadNewMenuItem = (newItem) => { state.menuItems.push(newItem); };

// After (model.js)
export const uploadNewMenuItem = async (newItem) => {
  const { data, error } = await supabase.from('menu_items').insert({ ...newItem, user_id: state.userId }).select().single();
  if (error) throw error;
  state.menuItems.push(data);
};
```

### Tasks
- [x] Add `loadMenuItems()` to model — fetches all `menu_items` for `user_id`, populates `state.menuItems`
- [x] Add `loadMenuCategories()` to model — fetches all `menu_categories` for `user_id`, populates `state.menuCategories`
- [x] Call both in `init()` before rendering any views (await both)
- [x] Replace `uploadNewMenuItem` with async Supabase insert
- [x] Replace `deleteMenuItem` with async Supabase delete
- [x] Replace `updateMenuItem` with async Supabase update
- [x] Replace `addCategory` with async Supabase insert
- [x] Replace `deleteCategory` with async Supabase delete
- [x] Update all controller functions that call the above to be async + await
- [ ] Add `renderSpinner()` / clear spinner pattern to views that trigger mutations (new item form, edit form, settings)
- [x] Remove seed data from `state.menuItems` and `state.menuCategories`
- [x] Test full CRUD: add item → persists after reload; edit → reflects after reload; delete → gone after reload

---

## Chunk 4 — Settings & Adjustments
**Goal:** Global adjustment templates (the Settings screen) read/write to Supabase.

- [x] Add `loadAdjustments()` to model — fetches `adjustments` for `user_id`, populates `state.settings.adjustments`
- [x] Call in `init()` (await)
- [x] Replace `addAdjustment` with async Supabase insert
- [x] Replace `updateAdjustment` with async Supabase update
- [x] Replace `deleteAdjustment` with async Supabase delete
- [x] Replace `toggleAdjustment` with async Supabase update (`enabled` field)
- [x] Update controller functions (`controlSaveAdjustment`, `controlDeleteAdjustment`, `controlToggleAdjustment`) to await
- [x] Remove seed adjustments from `state.settings.adjustments`
- [x] Test: add adjustment → persists; toggle → persists; delete → gone

**Note:** `currentReceiptAdjustments` is per-session (instantiated from templates at checkout time) — it does NOT need to be persisted.

---

## Chunk 5 — Sales Records
**Goal:** Every completed transaction is saved to Supabase. Foundation for future Reports screen.

- [x] Update `controlConcludeTransaction()` in controller to be async
- [x] Replace `state.salesBasket.push(sale)` with async Supabase insert into `sales`
- [x] Keep `state.salesBasket` in memory for the current session (no need to load historical sales yet)
- [x] Map the sale object to the `sales` table shape (items + adjustments as JSONB snapshots)
- [x] Test: complete a transaction → row appears in Supabase dashboard

**Future (not in scope now):** Loading past sales for Reports/Z-Report screen.

---

## Chunk 6 — Employees
**Goal:** Employee records live in Supabase instead of in-memory seed data.

- [x] Add `loadEmployees()` to model — fetches `employees` for `user_id`
- [x] Call in `init()` (await)
- [x] Remove seed employee data (state.employees was already [])
- [ ] If an employee management UI exists/is added: wire CRUD to Supabase
- [ ] Test: employees load from DB

---

## Chunk 7 — Cleanup & Hardening
**Goal:** Remove all remaining in-memory scaffolding and make the app production-ready.

- [x] Delete all seed/hardcoded data from `model.js`
- [x] Replace `createNewAccount` stub with real Supabase sign-up flow (email+password, confirmation email)
- [x] Add error boundaries: wrap all async controller calls in try/catch, show user-facing error toasts
- [x] Add loading states to initial app load (spinner while `loadMenuItems` etc. resolve)
- [x] Audit: make sure no view directly mutates state (all mutations go through model → Supabase)
- [x] Set up Supabase Storage bucket for item images — code done; bucket must be created in Supabase dashboard (see setup note below)
- [ ] Review RLS policies for any gaps
- [ ] Test the full happy path end-to-end with a fresh account

### Storage bucket setup (one-time, in Supabase dashboard)
1. Go to Storage → New bucket → name it `item-images` → set **Public** ON
2. Run this policy in SQL editor so users can only write their own files:
```sql
create policy "owner upload" on storage.objects for insert
  with check (bucket_id = 'item-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner delete" on storage.objects for delete
  using (bucket_id = 'item-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "public read" on storage.objects for select
  using (bucket_id = 'item-images');
```

---

## Session Resume Guide
> Read this at the start of any new session to orient quickly.

1. Check which chunks have all tasks `[x]` — those are done.
2. Find the first chunk with open `[ ]` tasks — that's where to continue.
3. Read that chunk's tasks and notes carefully before touching code.
4. When a task is done, mark it `[x]` in this file before moving on.
