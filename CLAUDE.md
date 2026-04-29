# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start    # Dev server via Parcel (serves index.html with hot reload)
npm build    # Production build → dist/
```

No test or lint commands are configured.

## Architecture

**Pointy** is a frontend-only POS (Point of Sale) SPA built with vanilla JavaScript (ES6 modules) and Parcel as the bundler. No framework (no React/Vue), no backend — all state is in-memory and resets on page reload.

The app follows a strict **MVC** pattern:

### Model (`Javascript/model.js`)
Single source of truth. Holds a `state` object containing `menuItems`, `menuCategories`, `cart`, `salesBasket`, `employees`, and `username`. All data mutations happen here. This file is **dev-stage scaffolding** — the seed data and `createNewAccount` function will be replaced when a backend is added. Do not invest in fixing or expanding `createNewAccount`.

### Views (`Javascript/Views/`)
Each view extends the base `View` class (`view.js`) and owns one DOM element via `_parentElement`. Pattern each view follows:
- `_generateMarkUp()` — returns an HTML string
- `render(data)` — injects markup into the DOM
- `_addHandler*(handler)` — wires a controller callback to a DOM event

Views never call model functions directly.

| File | Responsibility |
|---|---|
| `newOrderView.js` | New order modal |
| `newOrderItemView.js` | Item picker & variant selector |
| `orderCheckoutView.js` | Payment screen & receipt |
| `menuListView.js` | Browse all menu items |
| `newMenuItemView.js` | Add new menu item form |
| `menuEditView.js` | Edit existing menu items |

### Controller (`Javascript/controller.js`)
Wires model and views together. The `init()` function is the app entry point — it calls all `_addHandler*` methods on views, passing the appropriate `control*` functions as callbacks.

### Entry point (`index.html`)
All modal HTML templates are defined directly in `index.html` as hidden elements. Views target specific `id`/`class` selectors to render into or toggle visibility of these pre-existing elements. The edit menu modal is an exception — it is dynamically injected into `.edit-form-parent` by `menuEditView.js`.

### Styling (`pointy.css`)
Single unified stylesheet using CSS custom properties for theming. Theme switching (light/dark) is handled in `Javascript/pointy.js` and persisted to `localStorage`. Key variables: `--radius-lg: 28px`, `--panel-strong`, `--shadow-lg`.

**CSS cascade gotcha:** Several overlay classes (`.modal-overlay-form`, `.modal-backdrop`) have duplicate definitions later in the file that override earlier media queries. Mobile responsive overrides must be placed immediately after the duplicate definition, not in the central responsive block at line ~1071.

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

**Sale record** (in `state.salesBasket`):
```js
{ items, totalPrice, customerPayment, customerChange, date }
```

## Project Direction

This is being built into a **full commercial POS product** — backend, auth, persistent storage, and everything needed to ship and sell it. The current frontend-only state is a prototype. When making architectural decisions, keep this in mind:

- Prefer patterns that will survive a backend migration (e.g. don't hardcode data logic into views)
- `model.js` is throwaway scaffolding — do not invest in expanding it beyond dev convenience
- Data shapes should be designed with an API contract in mind
- Auth, multi-user, and multi-device support are eventual requirements

## Known Incomplete Features

These have UI buttons but no implementation: Discounts, Summary/Reports, Scan Item, Drawer operations, Refund, Z Report. Backend integration (persistent storage, auth) has not been started — `model.js` is entirely dev-stage placeholder data.
