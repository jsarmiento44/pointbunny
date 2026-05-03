# Pointy POS — System Architecture

## What is Pointy?

Pointy is a **Point of Sale (POS) web application** built for small businesses — coffee shops, cafés, restaurants, retail stores, and more. It runs entirely in the browser with no installation required. Each business gets their own isolated account with persistent data stored in the cloud.

---

## At a Glance

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES6 modules), HTML, CSS |
| Bundler | Parcel 2 (dev server + production builds) |
| Backend / Database | Supabase (PostgreSQL + Auth + Storage) |
| Authentication | Supabase Auth (email + password, JWT sessions) |
| File Storage | Supabase Storage (menu item images) |
| Hosting (planned) | Static host (Netlify / Vercel) + Supabase cloud |

---

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                     │
│  ┌──────────┐    ┌────────────┐    ┌─────────────┐  │
│  │  Views   │◄──►│ Controller │◄──►│    Model    │  │
│  │ (UI/DOM) │    │ (logic)    │    │ (state/data)│  │
│  └──────────┘    └────────────┘    └──────┬──────┘  │
│                                           │         │
└───────────────────────────────────────────┼─────────┘
                                            │ HTTPS
                                            ▼
┌─────────────────────────────────────────────────────┐
│                     Supabase Cloud                   │
│                                                     │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Auth        │  │ PostgreSQL │  │  Storage    │  │
│  │  (sessions,  │  │ (all app   │  │  (item      │  │
│  │   sign-up,   │  │  data)     │  │   images)   │  │
│  │   sign-in)   │  │            │  │             │  │
│  └──────────────┘  └────────────┘  └─────────────┘  │
│                                                     │
│  Row Level Security (RLS): each user sees only      │
│  their own data — enforced at the database level    │
└─────────────────────────────────────────────────────┘
```

---

## Frontend Architecture (MVC)

The frontend follows a strict **Model → Controller → View** pattern. No framework — pure JavaScript ES6 modules.

### Model (`Javascript/model.js`)
- Single source of truth for all app state
- Owns all reads and writes to Supabase
- Exposes async functions that the controller calls
- State shape:
  ```
  state {
    userId          — logged-in user's Supabase ID
    username        — display name shown in the UI
    menuItems[]     — all menu items for this account
    menuCategories[]— category list
    employees[]     — staff records
    cart[]          — current in-progress order
    salesBasket[]   — completed sales (current session)
    settings {
      adjustments[] — fee/discount templates
    }
    currentReceiptAdjustments[] — adjustments on active receipt
  }
  ```

### Controller (`Javascript/controller.js`)
- The only file that imports both the model and views
- Wires DOM events (from views) to data operations (in the model)
- All async operations (`await model.loadMenuItems()`, etc.) live here
- `init()` entry point: checks auth session → loads all data → wires event handlers

### Views (`Javascript/Views/`)
Each view is a class that extends the base `View`. It owns one DOM element and follows a consistent pattern:

| File | What it renders |
|---|---|
| `authView.js` | Login / sign-up overlay |
| `newOrderView.js` | Active order / cart |
| `newOrderItemView.js` | Item picker + variant selector modal |
| `orderCheckoutView.js` | Payment screen, receipt, adjustments |
| `menuListView.js` | Browse all menu items |
| `newMenuItemView.js` | Add new item form |
| `menuEditView.js` | Edit existing item form |
| `settingsView.js` | Categories + adjustment templates |
| `view.js` | Base class (render, spinner, success modal) |

**Rule:** Views never talk to the model directly. They only fire handler callbacks that the controller provided.

### Supabase Client (`Javascript/supabase.js`)
Initializes and exports the Supabase JS client using environment variables (`.env`). Imported by both `model.js` (data) and `controller.js` (auth).

---

## Backend — Supabase

Supabase provides three services used by Pointy:

### 1. Authentication
- Email + password sign-up and sign-in
- JWT tokens stored in `localStorage`, automatically refreshed
- `supabase.auth.getSession()` on app load — if a valid session exists, the user goes straight to the app; otherwise the login screen is shown
- Sign-out invalidates the session and reloads the page

### 2. Database (PostgreSQL)

Five tables, all scoped to a `user_id` so data is fully isolated per account:

**`menu_items`**
```
id, user_id, item_name, price, category, image_url,
stock, has_variants, variants (JSONB), description,
status, created_at
```

**`menu_categories`**
```
id, user_id, name, created_at
unique(user_id, name)
```

**`adjustments`** — fee/discount templates configured in Settings
```
id, user_id, name, type (fee|discount),
calculation (fixed|percentage), value, enabled, created_at
```

**`sales`** — completed transaction records
```
id, user_id, subtotal, total_price, customer_payment,
customer_change, items (JSONB), adjustments (JSONB),
sale_date
```

**`employees`**
```
id, user_id, name, role, system_role, created_at
```

> `items` and `adjustments` in the sales table are **JSONB snapshots** — a frozen copy of exactly what was in the cart at the time of sale. This means historical records are never affected by future edits to menu items.

### 3. Storage
- Bucket: `item-images`
- Images are uploaded per-user under a folder named after their `user_id`
- Bucket is public (images are viewable without auth)
- Write/delete restricted to the owning user via storage RLS policies

---

## Security — Row Level Security (RLS)

Every table has RLS enabled. The policy on every table follows the same pattern:

```sql
-- Users can only select/insert/update/delete their own rows
using (auth.uid() = user_id)
```

This means even if someone obtained another user's `user_id`, they could not read or modify that user's data — the database enforces it, not the application code. There is no way to bypass this from the client.

---

## Data Flow — Typical Operation

Here's what happens when a cashier adds an item to the cart and checks out:

```
1. Cashier taps item card
      → NewOrderItemView fires handler
      → controller finds item in state.menuItems
      → NewOrderItemView displays item modal

2. Cashier selects variants, taps "Add to cart"
      → controller calculates price (base + variants × qty)
      → pushes to state.cart (in-memory only, no DB write)
      → NewOrderView re-renders with updated cart

3. Cashier taps "Checkout"
      → controller calls model.initReceiptAdjustments()
         (copies enabled adjustments from settings into receipt)
      → model.calculateAdjustments() computes final total
      → OrderCheckoutView renders payment screen

4. Cashier enters payment, taps "Print Receipt"
      → controller calls supabase.from('sales').insert(...)
         (writes the completed sale to the database)
      → state.cart is cleared
      → success animation plays
```

---

## Auth Flow

```
App loads
   │
   ├─ supabase.auth.getSession()
   │      │
   │      ├─ Session exists → showLoadingScreen()
   │      │       → load all data (4 parallel-ish DB calls)
   │      │       → hideLoadingScreen()
   │      │       → wire all event handlers
   │      │       → app is ready
   │      │
   │      └─ No session → show auth overlay
   │              │
   │              ├─ Sign In → signInWithPassword()
   │              │     → on success: load data → wire app
   │              │
   │              └─ Sign Up → signUp() with user metadata
   │                    → "Check your email" screen
   │                    → user clicks confirmation link
   │                    → redirected back → now has session
   │
   └─ supabase.auth.onAuthStateChange()
          → SIGNED_OUT: window.location.reload()
```

---

## File Structure

```
Pointy Project/
├── index.html              — App shell + all modal HTML templates
├── pointy.css              — Single unified stylesheet
├── Pointy.png              — App logo
├── .env                    — Supabase URL + anon key (not committed)
├── package.json            — npm scripts (start, build)
├── ARCHITECTURE.md         — This file
├── MIGRATION_PLAN.md       — Supabase migration tracker (all done)
│
└── Javascript/
    ├── controller.js       — App entry point, wires everything
    ├── model.js            — All state + Supabase operations
    ├── supabase.js         — Supabase client init
    ├── pointy.js           — Theme toggle (light/dark mode)
    │
    └── Views/
        ├── view.js         — Base view class
        ├── authView.js     — Login / sign-up
        ├── newOrderView.js — Order / cart
        ├── newOrderItemView.js  — Item picker modal
        ├── orderCheckoutView.js — Payment + receipt
        ├── menuListView.js      — Menu browser
        ├── newMenuItemView.js   — Add item form
        ├── menuEditView.js      — Edit item form
        └── settingsView.js      — Settings panel
```

---

## Key Design Decisions

**Why vanilla JS (no React/Vue)?**
Speed of development in the early prototype phase. The MVC structure is clean enough that a framework migration is straightforward when needed.

**Why Supabase over a custom backend?**
Supabase gives a production-grade PostgreSQL database, auth, storage, and real-time capabilities with zero backend code to write or maintain. RLS policies enforce security at the database level — more reliable than application-level checks.

**Why JSONB for cart items and adjustments in sales?**
Prices and item details change over time. Storing a snapshot of the exact cart at sale time means historical sales records are always accurate, regardless of future edits to the menu.

**Why in-memory cart (no DB writes mid-order)?**
Speed. Writing every cart change to the database would add latency to every tap. The cart only hits the database once — when the sale is completed.

---

## What's Not Built Yet

| Feature | Status |
|---|---|
| Reports / Z-Report screen | UI button exists, no implementation |
| Refunds | UI button exists, no implementation |
| Employee management UI | Data model exists in DB, no UI |
| Multi-user (cashier accounts under one business) | Planned |
| Custom email (branded confirmation emails) | Needs custom SMTP at launch |
| Onboarding flow (business info after sign-up) | Planned post-launch |
| Drawer operations | UI button exists, no implementation |
| Scan item (barcode) | UI button exists, no implementation |
