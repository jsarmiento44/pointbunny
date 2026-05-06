import NewOrderView from "./Views/newOrderView.js";
import * as model from "./model.js";
import { supabase } from "./supabase.js";
import AuthView from "./Views/authView.js";
import MenuListView from "./Views/menuListView.js";
import NewMenuItemView from "./Views/newMenuItemView.js";
import NewOrderItemView from "./Views/newOrderItemView.js";
import OrderCheckOutView from "./Views/orderCheckoutView.js";
import newMenuItemView from "./Views/newMenuItemView.js";
import MenuEditView from "./Views/menuEditView.js";
import SettingsView from "./Views/settingsView.js";
import ReceiptView from "./Views/receiptView.js";
import CashflowView from "./Views/cashflowView.js";
import DiscountView from "./Views/discountView.js";
import KDSView from "./Views/kdsView.js";

const modelState = model.state;
let item;

// ── Toast notifications ───────────────────────────────────────────────────────

const showToast = function (message, type = 'error') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3500);
};

// ── App loading overlay ───────────────────────────────────────────────────────

const _appLoadingEl = document.getElementById('appLoadingOverlay');

const showLoadingScreen = function () {
  _appLoadingEl?.classList.remove('hidden');
};

const hideLoadingScreen = function () {
  _appLoadingEl?.classList.add('hidden');
};
//adding/displaying menu list

//to add edit/delete option
const controlMenuList = async function () {
  try {
    const state = model.state;
    MenuListView.render(state);
    MenuListView._addHandlerCloseModal();
    NewMenuItemView._mapMenuCategoriesMarkUp(state.menuCategories);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlDeleteMenuItem = async function (id) {
  try {
    await model.deleteMenuItem(id);
    MenuListView.render(model.state);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlShowEditMenu = async function (id) {
  try {
    item = model.state.menuItems.find((item) => item._id === id);
    const categories = model.state.menuCategories;

    MenuEditView._clear();
    MenuEditView._insertEditMenuMarkup(item);
    MenuEditView._mapMenuCategoriesMarkUp(categories, item.category);
    MenuEditView._newEditCategoryToggle(async (name) => {
      try {
        await model.addCategory(name);
        NewMenuItemView._mapMenuCategoriesMarkUp(model.state.menuCategories);
        MenuEditView._mapMenuCategoriesMarkUp(model.state.menuCategories, name);
      } catch (err) {
        showToast(err.message ?? err);
      }
    });

    MenuEditView._updateItemData(async (data) => {
      if (data.category === "new-category") data.category = item.category;
      try {
        await model.updateMenuItem(item._id, data);
      } catch (err) {
        showToast(err.message ?? err);
        return;
      }

      const modal = document.querySelector(".item-modal-overlay");
      if (
        !modal.classList.contains("hidden") &&
        NewOrderItemView._basket?.id === item._id
      ) {
        const imgEl = modal.querySelector(".item-image");
        const updatedItem = model.state.menuItems.find(
          (i) => i._id === item._id,
        );
        if (imgEl) {
          imgEl.style.transition = "opacity 0.3s ease";
          imgEl.style.opacity = 0;
          setTimeout(() => {
            imgEl.src = updatedItem.imageURL;
            imgEl.style.opacity = 1;
          }, 100);
        }
      }
    });
  } catch (err) {
    showToast(err.message ?? err);
  }
};

//adding new menu category
const controlAddNewCategory = async function (data) {
  try {
    await model.addCategory(data);
    NewMenuItemView._mapMenuCategoriesMarkUp(model.state.menuCategories);
    const newCategory = model.state.menuCategories[model.state.menuCategories.length - 1];
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) categorySelect.value = newCategory;
  } catch (err) {
    showToast(err.message ?? err);
  }
};

//listening for buttons to close/open new menu item
const controlNewMenuButtonToggle = function () {
  NewMenuItemView._toggleModalClose();
  NewMenuItemView._toggleModalOpen();
};

//listens to uploadItem form button
const controlUploadItem = async function (data) {
  const invalidCategories = ["Select category", "new-category"];
  const categoryMissing = !data.category || invalidCategories.includes(data.category);
  if (categoryMissing) {
    if (data.newCategory?.trim()) {
      data.category = data.newCategory.trim();
    } else {
      alert("Please select a category for this item before saving.");
      return;
    }
  }

  try {
    data.variants = newMenuItemView._addedVariants;
    await model.uploadNewMenuItem(data);
    MenuListView.render(model.state);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

//listens to new order button and renders the markup
const controlNewOrder = async function () {
  try {
    NewOrderView.render(modelState);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

//finds tbe item ID & fills in data according to the ID found
const controlDisplayMenuItem = function (id) {
  const item = model.state.menuItems.find((item) => item._id === id);
  if (!item) return;
  NewOrderItemView._itemModalContentUpdate(item);
};

const controlPushToModelCart = function () {
  if (NewOrderItemView._basket.length <= 0) {
    throw "No item selected yet";
  }
  NewOrderItemView._basket.quantity = NewOrderItemView._qty;
  NewOrderItemView._basket.selectedVariants = NewOrderItemView._variants;

  const basePrice = Number(NewOrderItemView._basket.price);
  const variantsTotal = NewOrderItemView._basket.selectedVariants.reduce(
    (acc, variant) => acc + Number(variant.variantPrice),
    0,
  );
  const quantity = Number(NewOrderItemView._basket.quantity);
  NewOrderItemView._basket.totalPrice = (basePrice + variantsTotal) * quantity;

  model.state.cart.push(NewOrderItemView._basket);
  NewOrderView.render(modelState);
  const cartItemsEl = document.getElementById('cartItems');
  if (cartItemsEl) cartItemsEl.scrollTop = cartItemsEl.scrollHeight;
  const lastRow = document.querySelector('#cartItems .cart-item-row:last-child');
  if (lastRow) lastRow.classList.add('cart-item--added');
};

//Listents to "checkout event" and wraps up transaction
const controlOrderCheckout = function () {
  try {
    if (model.state.cart.length === 0) throw `You must add an item to the cart`;

    const subtotal = modelState.cart.reduce((acc, item) => acc + item.totalPrice, 0);
    model.initReceiptAdjustments();
    const adjResult = model.calculateAdjustments(
      subtotal,
      model.state.currentReceiptAdjustments,
    );

    OrderCheckOutView._subtotal = subtotal;
    OrderCheckOutView._adjResult = adjResult;
    OrderCheckOutView._totalPrice = adjResult.finalTotal;
    OrderCheckOutView.render(modelState);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const _buildSale = function () {
  return {
    id: crypto.randomUUID(),
    items: [...modelState.cart],
    subtotal: OrderCheckOutView._subtotal ?? OrderCheckOutView._totalPrice,
    adjustments: OrderCheckOutView._adjResult?.lineItems ?? [],
    removedAdjustments: model.state.currentReceiptAdjustments.filter((a) => a.removed),
    showRemovedAdjustments: model.state.settings.showRemovedAdjustments,
    totalPrice: OrderCheckOutView._totalPrice,
    customerPayment: OrderCheckOutView._customerPayment,
    customerChange: OrderCheckOutView._customerChange,
    promoCode: model.state.currentPromoCode ?? null,
    storeName: model.state.username,
    date: Date.now(),
  };
};

// ── Order Queue (KDS) ─────────────────────────────────────────────────────────

let _kdsInterval = null;

const _ensureKDSTick = function () {
  if (_kdsInterval) return;
  _kdsInterval = setInterval(_tickKDS, 1000);
};

const _stopKDSTick = function () {
  clearInterval(_kdsInterval);
  _kdsInterval = null;
};

const _tickKDS = function () {
  if (modelState.orderQueue.length === 0) { _stopKDSTick(); return; }
  const now = Date.now();
  const { kdsYellowThreshold, kdsRedThreshold, kdsAutoCompleteThreshold } = model.state.settings;
  const expired = modelState.orderQueue.filter(
    o => Math.floor((now - o.startedAt) / 1000) >= kdsAutoCompleteThreshold
  );
  expired.forEach(o => controlMarkOrderDone(o.id, true));
  if (expired.length === 0) {
    KDSView.updateTimers(modelState.orderQueue, now, kdsYellowThreshold, kdsRedThreshold);
  }
};

const controlMarkOrderDone = async function (id, timedOut = false) {
  const idx = modelState.orderQueue.findIndex(o => o.id === id);
  if (idx === -1) return;
  const order = modelState.orderQueue[idx];
  modelState.orderQueue.splice(idx, 1);
  KDSView.renderQueue(modelState.orderQueue);
  if (modelState.orderQueue.length === 0) _stopKDSTick();
  try {
    await model.recordServeTime(order.saleDate, timedOut);
  } catch (_) {
    // recordServeTime requires prepared_at + timed_out columns and an UPDATE RLS policy on sales
  }
};

const controlOpenKDS = function () {
  KDSView.open(modelState.orderQueue);
};

const controlCloseKDS = function () {
  KDSView.close();
};

const controlSaveKDSThresholds = function ({ yellow, red, auto }) {
  model.state.settings.kdsYellowThreshold = yellow;
  model.state.settings.kdsRedThreshold = red;
  model.state.settings.kdsAutoCompleteThreshold = auto;
  localStorage.setItem('pointy_kds_yellow', yellow);
  localStorage.setItem('pointy_kds_red', red);
  localStorage.setItem('pointy_kds_auto', auto);
};

// ── Sale finalisation ─────────────────────────────────────────────────────────

const _finaliseSale = async function (sale, note = null) {
  modelState.salesBasket.push(sale);
  const { error: insertError } = await supabase.from('sales').insert({
    user_id: model.state.userId,
    subtotal: sale.subtotal,
    total_price: sale.totalPrice,
    customer_payment: sale.customerPayment,
    customer_change: sale.customerChange,
    items: sale.items,
    adjustments: sale.adjustments,
    promo_code: sale.promoCode?.code ?? null,
    sale_date: new Date(sale.date).toISOString(),
    is_manual: false,
    added_by: null,
  });
  if (insertError) throw insertError;
  if (sale.promoCode) {
    await model.redeemDiscountCode(sale.promoCode.discountCodeId);
  }
  modelState.orderQueue.push({
    id: sale.id,
    saleDate: new Date(sale.date).toISOString(),
    items: sale.items,
    startedAt: sale.date,
    totalPrice: sale.totalPrice,
  });
  _ensureKDSTick();
  KDSView.renderQueue(modelState.orderQueue);
  KDSView.playNewOrderSound();
  clearCart();
  model.clearReceiptAdjustments();
  refreshTodaySalesDisplay();
  OrderCheckOutView._showSuccess(note);
  const successOverlay = document.querySelector('.success-overlay');
  const autoCloseTimer = setTimeout(() => {
    OrderCheckOutView._hideModal();
    successOverlay?.remove();
  }, 3500);
  const successCloseBtn = successOverlay?.querySelector('.modal-close');
  if (successCloseBtn) {
    successCloseBtn.addEventListener('click', () => {
      clearTimeout(autoCloseTimer);
      OrderCheckOutView._hideModal();
      successOverlay.remove();
    });
  }
};

const controlConcludeTransaction = async function () {
  const printBtn = document.getElementById('printReceiptBtn');
  if (printBtn) printBtn.disabled = true;
  try {
    if (modelState.cart.length <= 0) throw 'Cart is empty!';
    const sale = _buildSale();

    if (!model.state.settings.printingEnabled) {
      await _finaliseSale(sale, 'Transaction saved — no receipt was printed. You can enable printing in Settings.');
      return;
    }

    const printPromise = ReceiptView.print(sale);
    if (!printPromise) {
      showToast('Popup was blocked. Allow popups for this site and try again.', 'error');
      if (printBtn) printBtn.disabled = false;
      return;
    }

    await printPromise;

    if (model.state.settings.confirmPrint) {
      OrderCheckOutView.showConfirmModal({
        message: 'Did the receipt print successfully?',
        confirmLabel: 'Yes, Record Sale',
        cancelLabel: 'No, Go Back',
        onConfirm: async () => {
          try {
            await _finaliseSale(sale);
          } catch (err) {
            showToast(err.message ?? err);
            if (printBtn) printBtn.disabled = false;
          }
        },
        onCancel: () => {
          if (printBtn) printBtn.disabled = false;
        },
      });
    } else {
      await _finaliseSale(sale);
    }
  } catch (err) {
    showToast(err.message ?? err);
    if (printBtn) printBtn.disabled = false;
  }
};

const clearCart = function () {
  model.state.cart = [];
  document.querySelector('.confirm-overlay')?.remove();
};

const controlCloseOrderModal = function (close) {
  if (model.state.cart.length === 0) { close(); return; }
  NewOrderView.showConfirmModal({
    message: 'You have items in your cart. Close and discard them?',
    onConfirm: () => { clearCart(); close(); },
  });
};

// ── Settings ──────────────────────────────────────────────────────────────────

const controlOpenSettings = function () {
  SettingsView.renderCategories(model.state.menuCategories);
  SettingsView.renderAdjustments(model.state.settings.adjustments);
  SettingsView.syncShowRemovedToggle(model.state.settings.showRemovedAdjustments);
  SettingsView.syncPrintingToggle(model.state.settings.printingEnabled);
  SettingsView.syncConfirmPrintToggle(model.state.settings.confirmPrint);
  SettingsView.syncKDSThresholds(
    model.state.settings.kdsYellowThreshold,
    model.state.settings.kdsRedThreshold,
    model.state.settings.kdsAutoCompleteThreshold,
  );
};

const controlTogglePrinting = function (value) {
  model.state.settings.printingEnabled = value;
  localStorage.setItem('pointy_printing_enabled', value);
};

const controlToggleConfirmPrint = function (value) {
  model.state.settings.confirmPrint = value;
  localStorage.setItem('pointy_confirm_print', value);
};

const _refreshCategoryDropdowns = function () {
  NewMenuItemView._mapMenuCategoriesMarkUp(model.state.menuCategories);
  if (document.querySelector(".edit-field-select"))
    MenuEditView._mapMenuCategoriesMarkUp(model.state.menuCategories, "");
};

const controlAddCategoryFromSettings = async function (name) {
  try {
    await model.addCategory(name);
    SettingsView.renderCategories(model.state.menuCategories);
    _refreshCategoryDropdowns();
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlDeleteCategory = async function (name) {
  const itemsInCategory = model.state.menuItems.filter(
    (item) => item.category === name,
  );
  if (
    itemsInCategory.length > 0 &&
    !confirm(
      `"${name}" has ${itemsInCategory.length} menu item(s). Delete it anyway?`,
    )
  )
    return;
  try {
    await model.deleteCategory(name);
    SettingsView.renderCategories(model.state.menuCategories);
    _refreshCategoryDropdowns();
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlSaveAdjustment = async function (data) {
  try {
    if (data.id) {
      await model.updateAdjustment(data.id, data);
    } else {
      await model.addAdjustment(data);
    }
    SettingsView.renderAdjustments(model.state.settings.adjustments);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlEditAdjustment = function (id) {
  const adj = model.state.settings.adjustments.find((a) => a.id === id);
  if (!adj) return;
  SettingsView.showForm(adj);
};

const controlDeleteAdjustment = async function (id) {
  try {
    await model.deleteAdjustment(id);
    SettingsView.renderAdjustments(model.state.settings.adjustments);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlToggleAdjustment = async function (id) {
  try {
    await model.toggleAdjustment(id);
    SettingsView.renderAdjustments(model.state.settings.adjustments);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlShowRemoved = function (value) {
  model.state.settings.showRemovedAdjustments = value;
};

// ── Per-receipt adjustment controls ───────────────────────────────────────────

const _refreshCheckoutAdj = function () {
  const adjResult = model.calculateAdjustments(
    OrderCheckOutView._subtotal,
    model.state.currentReceiptAdjustments,
  );
  OrderCheckOutView._refreshAdjustments(
    OrderCheckOutView._subtotal,
    model.state.currentReceiptAdjustments,
    adjResult,
    model.state.settings.showRemovedAdjustments,
    model.state.currentPromoCode,
  );
};

const controlReceiptEdit = function (id) {
  const adj = model.state.currentReceiptAdjustments.find((a) => a.id === id);
  if (!adj) return;
  OrderCheckOutView._showReceiptEditForm(adj);
};

const controlSaveReceiptOverride = function ({ id, value }) {
  model.overrideReceiptAdjustment(id, value);
  _refreshCheckoutAdj();
};

const controlRemoveReceiptAdj = function (id) {
  model.removeReceiptAdjustment(id);
  _refreshCheckoutAdj();
};

const controlShowReceiptAddManualForm = function () {
  OrderCheckOutView._showReceiptAddManualForm();
};

const controlSaveManualReceiptAdj = function (data) {
  model.addManualReceiptAdjustment(data);
  _refreshCheckoutAdj();
};
// ── Cart item deletion ────────────────────────────────────────────────────────

const controlGoBackToOrder = function () {
  NewOrderView.render(modelState);
};

const controlDeleteCartItemInOrder = function (index) {
  model.deleteCartItem(index);
  NewOrderView.render(modelState);
};

const controlDeleteCartItemInCheckout = function (index) {
  model.deleteCartItem(index);

  if (model.state.cart.length === 0) {
    NewOrderView.render(modelState);
    return;
  }

  const subtotal = model.state.cart.reduce((acc, item) => acc + item.totalPrice, 0);
  OrderCheckOutView._subtotal = subtotal;
  const adjResult = model.calculateAdjustments(subtotal, model.state.currentReceiptAdjustments);
  OrderCheckOutView._refreshCartItems(model.state.cart);
  OrderCheckOutView._refreshAdjustments(
    subtotal,
    model.state.currentReceiptAdjustments,
    adjResult,
    model.state.settings.showRemovedAdjustments,
  );
};

//listens to modal close button
const controlNewOrderModals = async function () {
  NewOrderItemView._closeItemModal();
  NewOrderView._addHandlerCloseModal(controlCloseOrderModal);
};

const _animateSalesTotal = function (el, fromVal, toVal) {
  const fmt = (n) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const card = el.closest(".stat-card");
  if (card) {
    card.classList.remove("stat-card--updating");
    void card.offsetWidth;
    card.classList.add("stat-card--updating");
    card.addEventListener("animationend", () => card.classList.remove("stat-card--updating"), { once: true });
  }

  const duration = 900;
  const start = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = fmt(fromVal + (toVal - fromVal) * easeOut(progress));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const refreshTodaySalesDisplay = async function () {
  try {
    const el = document.getElementById("totalStr");
    if (!el) return;

    const currentVal = parseFloat(el.textContent.replace(/[$,]/g, "")) || 0;
    const newVal = await model.loadTodaySalesTotal();

    if (newVal === currentVal) return;

    // If a success overlay is on screen, wait for it to be removed first
    const overlay = document.querySelector(".success-overlay");
    if (overlay) {
      const observer = new MutationObserver(() => {
        if (!document.querySelector(".success-overlay")) {
          observer.disconnect();
          _animateSalesTotal(el, currentVal, newVal);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      _animateSalesTotal(el, currentVal, newVal);
    }
  } catch (_) {}
};

const initApp = async function (user) {
  model.state.userId = user.id;
  model.state.username = user.user_metadata?.display_name ?? user.user_metadata?.business_name ?? user.email;
  document.querySelector('.company-name').textContent = model.state.username;
  await model.loadMenuItems();
  await model.loadMenuCategories();
  await model.loadAdjustments();
  await model.loadDiscountCodes();
  await model.loadEmployees();
  await refreshTodaySalesDisplay();
};

const controlSignIn = async function (email, password) {
  AuthView.setLoading(true);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    AuthView.setLoading(false);
    AuthView.showError(error.message);
    return;
  }
  await AuthView.playSignInSuccess();
  showLoadingScreen();
  await initApp(data.user);
  hideLoadingScreen();
  _wireApp();
};

const controlSignUp = async function ({ firstName, lastName, email, password }) {
  AuthView.setSignUpLoading(true);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: `${firstName} ${lastName}`,
      },
    },
  });
  AuthView.setSignUpLoading(false);
  if (error) {
    AuthView.showSignUpError(error.message);
    return;
  }
  AuthView.showCheckEmail(email);
};

const controlSignOut = async function () {
  const sweepEl = document.createElement('div');
  sweepEl.className = 'app-exit-sweep';
  sweepEl.innerHTML = '<span class="app-exit-label">Signing out…</span>';
  document.body.appendChild(sweepEl);
  await supabase.auth.signOut();
  setTimeout(() => window.location.reload(), 500);
};

// ── Cashflow ──────────────────────────────────────────────────────────────────

const _getCashflowRange = function (period, from, to) {
  const now = new Date();
  const ymd = (d) => d.toISOString().slice(0, 10);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtShort = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (period === "today") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: fmt(now) };
  }

  if (period === "week") {
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
    return { startISO: monday.toISOString(), endISO: sunday.toISOString(), label: `${fmtShort(monday)} – ${fmtShort(sunday)}` };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }

  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end   = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: String(now.getFullYear()) };
  }

  // custom
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  const end   = new Date(to);   end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString(), label: `${fmtShort(start)} – ${fmtShort(end)}` };
};

const _cashflowSummary = () => {
  const gross    = modelState.cashflowSales.reduce((s, r) => s + Number(r.total_price), 0);
  const expenses = modelState.expenses.reduce((s, e) => s + e.amount, 0);
  return { gross, expenses, net: gross - expenses };
};

let _currentCashflowPeriod = { period: "today" };

const controlOpenCashflow = async function () {
  CashflowView.open();
  CashflowView.renderLoading();
  CashflowView.setLoading(true);
  try {
    _currentCashflowPeriod = { period: "today" };
    const { startISO, endISO, label } = _getCashflowRange("today");
    await model.fetchCashflowData(startISO, endISO);
    CashflowView.setPeriodLabel(label);
    CashflowView.renderSummary(_cashflowSummary());
    CashflowView.renderSalesList(modelState.cashflowSales);
    CashflowView.renderExpensesList(modelState.expenses);
  } catch (err) {
    showToast(err.message ?? err);
  } finally {
    CashflowView.setLoading(false);
  }
};

const controlCloseCashflow = function () {
  CashflowView.close();
};

const controlChangePeriod = async function ({ period, from, to }) {
  CashflowView.renderLoading();
  CashflowView.setLoading(true);
  try {
    _currentCashflowPeriod = { period, from, to };
    const { startISO, endISO, label } = _getCashflowRange(period, from, to);
    await model.fetchCashflowData(startISO, endISO);
    CashflowView.setPeriodLabel(label);
    CashflowView.renderSummary(_cashflowSummary());
    CashflowView.renderSalesList(modelState.cashflowSales);
    CashflowView.renderExpensesList(modelState.expenses);
  } catch (err) {
    showToast(err.message ?? err);
  } finally {
    CashflowView.setLoading(false);
  }
};

const controlAddExpense = async function (data) {
  try {
    CashflowView.setSubmitting(true);
    await model.addExpense(data);
    CashflowView.hideExpenseModal();
    CashflowView.renderSummary(_cashflowSummary());
    CashflowView.renderExpensesList(modelState.expenses);
    CashflowView.scrollExpensesToTop();
    showToast("Expense added.", "success");
  } catch (err) {
    showToast(err.message ?? err);
  } finally {
    CashflowView.setSubmitting(false);
  }
};

const _generateAndDownloadCSV = function () {
  const periodLabel = document.querySelector("#cashflowPeriodLabel")?.textContent ?? "cashflow";
  const safeLabel = periodLabel.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const escape = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

  const salesRows = (modelState.cashflowSales ?? []).map((s) => ({
    date: s.sale_date,
    row: [
      fmtDate(s.sale_date), fmtTime(s.sale_date), "Sale",
      (s.items ?? []).map((i) => `${i.itemName} x${i.quantity}`).join("; "),
      "", `+${Number(s.total_price).toFixed(2)}`,
      s.is_manual ? "Yes" : "No",
      s.added_by ?? "",
    ],
  }));

  const expenseRows = (modelState.expenses ?? []).map((e) => ({
    date: e.expenseDate,
    row: [fmtDate(e.expenseDate), fmtTime(e.expenseDate), "Expense", e.description, e.category ?? "", `-${e.amount.toFixed(2)}`, "No", e.createdBy],
  }));

  const allRows = [...salesRows, ...expenseRows]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((r) => r.row);

  const header = ["Date", "Time", "Type", "Description", "Category", "Amount", "Manual Entry", "Added By"];
  const csv = [header, ...allRows].map((row) => row.map(escape).join(",")).join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cashflow-${safeLabel}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const controlExportCSV = function () {
  const sales = modelState.cashflowSales ?? [];
  const expenses = modelState.expenses ?? [];
  const periodLabel = document.querySelector("#cashflowPeriodLabel")?.textContent ?? "this period";

  if (!sales.length && !expenses.length) {
    showToast("No data to export for this period.", "info");
    return;
  }

  const salesLine = sales.length ? `${sales.length} sale${sales.length !== 1 ? "s" : ""}` : "";
  const expenseLine = expenses.length ? `${expenses.length} expense${expenses.length !== 1 ? "s" : ""}` : "";
  const summary = [salesLine, expenseLine].filter(Boolean).join(" and ");

  CashflowView.showConfirmModal({
    message: `Export ${summary} for "${periodLabel}" as a CSV file?`,
    confirmLabel: "Download CSV",
    cancelLabel: "Cancel",
    onConfirm: _generateAndDownloadCSV,
  });
};

const controlOpenSaleReceipt = function (id) {
  const sale = modelState.cashflowSales.find((s) => s.id === id);
  if (sale) CashflowView.showSaleReceipt(sale);
};

const controlDeleteExpense = async function (id) {
  try {
    await model.deleteExpense(id);
    CashflowView.renderSummary(_cashflowSummary());
    CashflowView.renderExpensesList(modelState.expenses);
    showToast("Expense deleted.", "success");
  } catch (err) {
    showToast(err.message ?? err);
  }
};

// ── Discounts ─────────────────────────────────────────────────────────────────

const controlOpenDiscounts = function () {
  DiscountView.open();
  DiscountView.render(model.state.discountCodes);
};

const controlCloseDiscounts = function () {
  DiscountView.close();
};

const controlNewDiscountCode = function () {
  DiscountView.showForm();
};

const controlSaveDiscountCode = async function (data) {
  try {
    if (data.id) {
      await model.updateDiscountCode(data.id, data);
    } else {
      await model.createDiscountCode(data);
    }
    DiscountView.closeForm();
    DiscountView.render(model.state.discountCodes);
    showToast(data.id ? "Code updated." : "Code created.", "success");
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlEditDiscountCode = function (id) {
  const dc = model.state.discountCodes.find((d) => d.id === id);
  if (!dc) return;
  DiscountView.showForm(dc);
};

const controlDeleteDiscountCode = async function (id) {
  if (!confirm("Delete this promo code? This cannot be undone.")) return;
  try {
    await model.deleteDiscountCode(id);
    DiscountView.render(model.state.discountCodes);
    showToast("Code deleted.", "success");
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlToggleDiscountStatus = async function (id) {
  try {
    await model.toggleDiscountCodeStatus(id);
    DiscountView.render(model.state.discountCodes);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

// ── Promo code at checkout ────────────────────────────────────────────────────

const controlApplyPromoCode = function (code) {
  try {
    if (model.state.currentPromoCode) model.removePromoCodeFromReceipt();
    const dc = model.validateDiscountCode(code);
    model.applyPromoCodeToReceipt(dc);
    _refreshCheckoutAdj();
  } catch (err) {
    showToast(err.message ?? err, "error");
  }
};

const controlRemovePromoCode = function () {
  model.removePromoCodeFromReceipt();
  _refreshCheckoutAdj();
};

const _wireApp = function () {
  //MenuList
  MenuListView._addHandlerShowModal(controlMenuList);
  MenuEditView._showEditMenuForm(controlShowEditMenu);
  MenuEditView._deleteVariant();
  MenuEditView._closeModal();
  MenuEditView._deleteOption();
  MenuEditView._addVariantGroup();
  MenuEditView._addOption();
  MenuEditView._updateImagePreview();
  MenuEditView._addHandlerHasVariantsToggle();
  MenuEditView._addHandlerDeleteItem(controlDeleteMenuItem);

  //Adding New Menu
  NewMenuItemView._uploadItem(controlUploadItem);
  NewMenuItemView._newMenuCategory();
  NewMenuItemView._addHandlerAddMenuCategory(controlAddNewCategory);
  NewMenuItemView._itemVariantsToggle();
  NewMenuItemView._addVariantOption();

  controlNewMenuButtonToggle();

  // Settings
  SettingsView._addHandlerOpen(controlOpenSettings);
  SettingsView._addHandlerClose();
  SettingsView._addHandlerAddCategory(controlAddCategoryFromSettings);
  SettingsView._addHandlerDeleteCategory(controlDeleteCategory);
  SettingsView._addHandlerAdd();
  SettingsView._addHandlerSave(controlSaveAdjustment);
  SettingsView._addHandlerEdit(controlEditAdjustment);
  SettingsView._addHandlerDelete(controlDeleteAdjustment);
  SettingsView._addHandlerToggle(controlToggleAdjustment);
  SettingsView._addHandlerShowRemoved(controlShowRemoved);
  SettingsView._addHandlerTogglePrinting(controlTogglePrinting);
  SettingsView._addHandlerToggleConfirmPrint(controlToggleConfirmPrint);

  //NewOrder
  NewOrderView._addHandlerShowMenuModal(controlNewOrder);
  NewOrderItemView._addHandlerShowItemModal(controlDisplayMenuItem);
  controlNewOrderModals();
  NewOrderItemView._pushToCart(controlPushToModelCart);
  NewOrderItemView._adjustQuantity();
  NewOrderView._addHandlerDeleteCartItem(controlDeleteCartItemInOrder);

  // Cashflow
  CashflowView._addHandlerOpen(controlOpenCashflow);
  CashflowView._addHandlerClose(controlCloseCashflow);
  CashflowView._addHandlerPeriodChange(controlChangePeriod);
  CashflowView._addHandlerCustomRange(controlChangePeriod);
  CashflowView._addHandlerOpenAddExpense();
  CashflowView._addHandlerSubmitExpense(controlAddExpense);
  CashflowView._addHandlerDeleteExpense(controlDeleteExpense);
  CashflowView._addHandlerOpenSaleReceipt(controlOpenSaleReceipt);
  CashflowView._addHandlerExport(controlExportCSV);

  //New Order Check Out
  OrderCheckOutView._addHandlerShowCheckout(controlOrderCheckout);
  OrderCheckOutView._addHandlerDeleteCartItem(controlDeleteCartItemInCheckout);
  OrderCheckOutView._addHandlerBack(controlGoBackToOrder);
  OrderCheckOutView._subtractChange();
  OrderCheckOutView._addHandlerPrintReceipt(controlConcludeTransaction);
  OrderCheckOutView._addHandlerReceiptEdit(controlReceiptEdit);
  OrderCheckOutView._addHandlerReceiptRemove(controlRemoveReceiptAdj);
  OrderCheckOutView._addHandlerReceiptAddManual(controlShowReceiptAddManualForm);
  OrderCheckOutView._addHandlerReceiptSaveOverride(controlSaveReceiptOverride);
  OrderCheckOutView._addHandlerReceiptSaveManual(controlSaveManualReceiptAdj);
  OrderCheckOutView._addHandlerApplyPromo(controlApplyPromoCode);
  OrderCheckOutView._addHandlerRemovePromo(controlRemovePromoCode);

  // Order Queue (KDS)
  KDSView._addHandlerOpen(controlOpenKDS);
  KDSView._addHandlerClose(controlCloseKDS);
  KDSView._addHandlerDone(controlMarkOrderDone);
  SettingsView._addHandlerKDSThresholds(controlSaveKDSThresholds);

  // Discounts
  DiscountView._addHandlerOpen(controlOpenDiscounts);
  DiscountView._addHandlerClose(controlCloseDiscounts);
  DiscountView._addHandlerNewCode(controlNewDiscountCode);
  DiscountView._addHandlerSave(controlSaveDiscountCode);
  DiscountView._addHandlerEdit(controlEditDiscountCode);
  DiscountView._addHandlerDelete(controlDeleteDiscountCode);
  DiscountView._addHandlerToggleStatus(controlToggleDiscountStatus);
};

const initAuth = async function () {
  AuthView._addHandlerSignIn(controlSignIn);
  AuthView._addHandlerSignUp(controlSignUp);
  document.getElementById('logoutBtn').addEventListener('click', controlSignOut);

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showLoadingScreen();
    await initApp(session.user);
    hideLoadingScreen();
    _wireApp();
  } else {
    AuthView.show();
  }
};

initAuth();
