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
import StaffView from "./Views/staffView.js";
import KDSView from "./Views/kdsView.js";
import channel, { MSG } from "./channel.js";
import { init as initAnalytics, destroy as destroyAnalytics } from "./analytics.js";

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
      data.category = "uncategorized";
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
  _broadcastCart();
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
    OrderCheckOutView._orderType = 'dine-in';
    OrderCheckOutView.render(modelState);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const _buildSale = function () {
  const cashierName =
    _cashierDisplayName(model.state.currentCashier) || model.state.username || '';
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
    cashierName,
    orderType: OrderCheckOutView._orderType ?? 'dine-in',
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
  const autoThreshold = kdsAutoCompleteThreshold > 0 ? kdsAutoCompleteThreshold : Infinity;
  const expired = modelState.orderQueue.filter(
    o => Math.floor((now - o.startedAt) / 1000) >= autoThreshold
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
  channel.postMessage({
    type: MSG.KDS_QUEUE_SYNC,
    queue: modelState.orderQueue,
    thresholds: {
      yellow: model.state.settings.kdsYellowThreshold,
      red: model.state.settings.kdsRedThreshold,
    },
  });
  try {
    await model.recordServeTime(order.id, timedOut);
  } catch (_) {
    // recordServeTime requires prepared_at + timed_out columns and an UPDATE RLS policy on sales
  }
};


const controlOpenKDSWindow = function () {
  const { width, height } = model.state.settings.kdsWindowSize;
  const win = window.open('kds-display.html', 'pointy-kds', `width=${width},height=${height},menubar=no,toolbar=no,location=no`);
  if (!win) showToast('Popup was blocked. Allow popups for this site to open the Kitchen Display.', 'error');
  else win.focus();
};

const controlOpenCFDWindow = function () {
  const { width, height } = model.state.settings.cfdWindowSize;
  const win = window.open('customer-display.html', 'pointy-cfd', `width=${width},height=${height},menubar=no,toolbar=no,location=no`);
  if (!win) showToast('Popup was blocked. Allow popups for this site to open the Customer Display.', 'error');
  else win.focus();
};

const _broadcastCart = function () {
  const cart = modelState.cart;
  channel.postMessage({
    type: MSG.CFD_CART_UPDATE,
    cart,
    total: cart.reduce((s, i) => s + i.totalPrice, 0),
  });
};

const controlSaveKDSWindowSize = function (size) {
  model.state.settings.kdsWindowSize = size;
  localStorage.setItem('pointy_kds_window_size', JSON.stringify(size));
};

const controlSaveCFDWindowSize = function (size) {
  model.state.settings.cfdWindowSize = size;
  localStorage.setItem('pointy_cfd_window_size', JSON.stringify(size));
};

const controlUploadCFDAd = async function (file) {
  try {
    const url = await model.uploadCFDAdImage(file);
    SettingsView.showCFDAdPreview(url);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlRemoveCFDAd = function () {
  model.removeCFDAdImage();
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
  const { data: newSale, error: insertError } = await supabase.from('sales').insert({
    user_id: model.state.businessId,
    subtotal: sale.subtotal,
    total_price: sale.totalPrice,
    customer_payment: sale.customerPayment,
    customer_change: sale.customerChange,
    items: sale.items,
    adjustments: sale.adjustments,
    promo_code: sale.promoCode?.code ?? null,
    sale_date: new Date(sale.date).toISOString(),
    is_manual: false,
    added_by: sale.cashierName || null,
    order_type: sale.orderType ?? 'dine-in',
  }).select('id').single();
  if (insertError) throw insertError;
  if (sale.promoCode) {
    await model.redeemDiscountCode(sale.promoCode.discountCodeId);
  }
  modelState.orderQueue.push({
    id: newSale.id,
    saleDate: new Date(sale.date).toISOString(),
    items: sale.items,
    startedAt: sale.date,
    totalPrice: sale.totalPrice,
    orderType: sale.orderType ?? 'dine-in',
  });
  _ensureKDSTick();
  KDSView.renderQueue(modelState.orderQueue);
  KDSView.playNewOrderSound();
  channel.postMessage({
    type: MSG.KDS_QUEUE_SYNC,
    queue: modelState.orderQueue,
    thresholds: {
      yellow: model.state.settings.kdsYellowThreshold,
      red: model.state.settings.kdsRedThreshold,
    },
  });
  clearCart();
  channel.postMessage({ type: MSG.CFD_SALE_COMPLETE });
  model.clearReceiptAdjustments();
  refreshTodaySalesDisplay();
  if (_todayTransactionCount !== null) { _todayTransactionCount++; _updateTransactionBadge(); }
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

    if (model.state.settings.printTwoCopies) ReceiptView.print(sale);

    await printPromise;

    if (model.state.settings.confirmPrint) {
      OrderCheckOutView.showConfirmModal({
        message: 'Did the receipt print successfully?',
        note: 'You can turn this prompt off in Settings → Printing.',
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
  SettingsView.renderAdjustments(model.state.settings.adjustments);
  SettingsView.syncShowRemovedToggle(model.state.settings.showRemovedAdjustments);
  SettingsView.syncPrintingToggle(model.state.settings.printingEnabled);
  SettingsView.syncConfirmPrintToggle(model.state.settings.confirmPrint);
  SettingsView.syncTwoCopiesToggle(model.state.settings.printTwoCopies);
  SettingsView.syncKDSThresholds(
    model.state.settings.kdsYellowThreshold,
    model.state.settings.kdsRedThreshold,
    model.state.settings.kdsAutoCompleteThreshold,
  );
  SettingsView.syncDisplaySizes(
    model.state.settings.kdsWindowSize,
    model.state.settings.cfdWindowSize,
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

const controlTogglePrintTwoCopies = function (value) {
  model.state.settings.printTwoCopies = value;
  localStorage.setItem('pointy_print_two_copies', value);
};

const _refreshCategoryDropdowns = function () {
  NewMenuItemView._mapMenuCategoriesMarkUp(model.state.menuCategories);
  if (document.querySelector(".edit-field-select"))
    MenuEditView._mapMenuCategoriesMarkUp(model.state.menuCategories, "");
};

const controlAddCategoryFromSettings = async function (name) {
  try {
    await model.addCategory(name);
    MenuListView.render(model.state);
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
    MenuListView.render(model.state);
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
  _broadcastCart();
  NewOrderView.render(modelState);
};

const controlDeleteCartItemInCheckout = function (index) {
  model.deleteCartItem(index);
  _broadcastCart();

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

const _cashierDisplayName = (c) => {
  if (!c) return null;
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || null;
};

const _updateCashierDisplay = function () {
  const el = document.getElementById('shiftStr');
  if (!el) return;
  const name = _cashierDisplayName(model.state.currentCashier) || model.state.username || '—';
  el.textContent = name.split(' ')[0];
};

const controlSwitchCashier = async function () {
  if (!model.state.staff.length) {
    try { await model.loadStaff(); } catch (_) {}
  }
  const activeStaff = model.state.staff.filter(s => !s.isPending);

  const existing = document.getElementById('cashierPickerOverlay');
  if (existing) { existing.remove(); return; }

  const el = document.createElement('div');
  el.id = 'cashierPickerOverlay';
  el.className = 'cashier-picker-overlay';
  el.innerHTML = `
    <div class="cashier-picker-card">
      <div class="cashier-picker-header">
        <h3 class="cashier-picker-title">Switch Cashier</h3>
        <button class="modal-close-btn" id="cashierPickerCloseBtn" type="button">&times;</button>
      </div>
      <ul class="cashier-picker-list">
        ${activeStaff.length ? activeStaff.map(s => {
          const name = _cashierDisplayName(s) || s.email || '?';
          return `
          <li class="cashier-picker-item${model.state.currentCashier?.id === s.id ? ' cashier-picker-item--active' : ''}"
              data-id="${s.id}" role="button" tabindex="0">
            <div class="cashier-picker-info">
              <span class="cashier-picker-name">${name}</span>
              <span class="cashier-picker-role">${s.role}</span>
            </div>
            ${model.state.currentCashier?.id === s.id ? '<span class="cashier-picker-check">✓</span>' : ''}
          </li>`;
        }).join('') : '<li class="cashier-picker-empty">No active staff members yet.</li>'}
      </ul>
    </div>
  `;
  document.body.appendChild(el);
  document.getElementById('cashierPickerCloseBtn').addEventListener('click', () => el.remove());
  el.addEventListener('click', (e) => {
    if (e.target === el) { el.remove(); return; }
    const item = e.target.closest('.cashier-picker-item');
    if (!item?.dataset.id) return;
    const chosen = activeStaff.find(s => s.id === item.dataset.id);
    if (chosen) {
      model.state.currentCashier = chosen;
      _updateCashierDisplay();
      showToast(`Cashier: ${_cashierDisplayName(chosen) || chosen.email}`, 'success');
      el.remove();
    }
  });
};

const refreshTodaySalesDisplay = async function () {
  try {
    const el = document.getElementById("totalStr");
    if (!el) return;

    const currentVal = parseFloat(el.textContent.replace(/[$,]/g, "")) || 0;
    const newVal = await model.loadTodaySalesTotal();

    if (newVal === currentVal) return;

    _updateYesterdayBadge(newVal);

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
  await model.loadBusinessContext(user);
  const s = model.state.currentStaff;
  model.state.username =
    (s ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() : null) ||
    user.user_metadata?.display_name ||
    user.email;
  document.querySelector('.company-name').textContent = model.state.username;
  localStorage.setItem('pointy_store_name', model.state.username);
  document.body.classList.remove('role-admin', 'role-manager', 'role-cashier');
  document.body.classList.add(`role-${model.state.role.toLowerCase()}`);
  _updateCashierDisplay();
  await model.loadMenuItems();
  await model.loadMenuCategories();
  await model.loadAdjustments();
  await model.loadDiscountCodes();
  await model.loadEmployees();
  await refreshTodaySalesDisplay();
  await model.loadOrderQueue();
  if (modelState.orderQueue.length > 0) {
    KDSView.renderQueue(modelState.orderQueue);
    _ensureKDSTick();
  }
  initAnalytics(user.id);
  _loadYesterdayComparison();
  _loadTransactionCounts();
};

let _yesterdayTotal = null;
let _todayTransactionCount = null;
let _yesterdayTransactionCount = null;

const _updateYesterdayBadge = function (todayTotal) {
  const el = document.getElementById('salesVsYesterday');
  if (!el || _yesterdayTotal === null || _yesterdayTotal === 0) return;
  const pct   = Math.round(((todayTotal - _yesterdayTotal) / _yesterdayTotal) * 100);
  const isUp  = pct >= 0;
  const arrow = isUp
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`;
  el.className = `sales-vs-yesterday ${isUp ? 'svs--up' : 'svs--down'}`;
  el.innerHTML = `${arrow}<span>${Math.abs(pct)}% vs yesterday</span>`;
};

const _updateTransactionBadge = function () {
  const countEl = document.getElementById('basketCountStr');
  const badgeEl = document.getElementById('basketsVsYesterday');
  if (!countEl || _todayTransactionCount === null) return;

  countEl.textContent = _todayTransactionCount;

  if (!badgeEl || _yesterdayTransactionCount === null || _yesterdayTransactionCount === 0) return;
  const pct   = Math.round(((_todayTransactionCount - _yesterdayTransactionCount) / _yesterdayTransactionCount) * 100);
  const isUp  = pct >= 0;
  const arrow = isUp
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`;
  badgeEl.className = `sales-vs-yesterday ${isUp ? 'svs--up' : 'svs--down'}`;
  badgeEl.innerHTML = `${arrow}<span>${Math.abs(pct)}% vs yesterday</span>`;
};

const _loadTransactionCounts = async function () {
  const badgeEl = document.getElementById('basketsVsYesterday');
  try {
    const { today, yesterday } = await model.loadTransactionCounts();
    _todayTransactionCount    = today;
    _yesterdayTransactionCount = yesterday;
    _updateTransactionBadge();
  } catch (_) {
    if (badgeEl) badgeEl.innerHTML = '';
  }
};

const _loadYesterdayComparison = async function () {
  const el = document.getElementById('salesVsYesterday');
  if (!el) return;
  try {
    const [yesterdayTotal, todayTotal] = await Promise.all([
      model.loadYesterdaySalesTotal(),
      model.loadTodaySalesTotal(),
    ]);
    _yesterdayTotal = yesterdayTotal;
    if (_yesterdayTotal === 0) { el.innerHTML = ''; return; }
    _updateYesterdayBadge(todayTotal);
  } catch (_) {
    if (el) el.innerHTML = '';
  }
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
  await destroyAnalytics();
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

  if (period === "yesterday") {
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const start = new Date(yesterday); start.setHours(0, 0, 0, 0);
    const end   = new Date(yesterday); end.setHours(23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: `Yesterday · ${fmt(yesterday)}` };
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

const controlReprintSale = async function (sale) {
  const mapped = {
    date: sale.sale_date,
    items: sale.items ?? [],
    adjustments: (sale.adjustments ?? [])
      .filter((a) => !a.removed)
      .map((a) => ({ ...a, computedAmount: a.computedAmount ?? a.computed_amount })),
    totalPrice: sale.total_price,
    customerPayment: sale.customer_payment,
    customerChange: sale.customer_change,
    subtotal: sale.subtotal,
    storeName: modelState.username,
    cashierName: sale.added_by,
    showRemovedAdjustments: false,
    removedAdjustments: [],
  };
  const promise = ReceiptView.print(mapped);
  if (!promise) showToast('Popup was blocked. Allow popups for this site and try again.', 'error');
};

const controlOpenSaleReceipt = function (id) {
  const sale = modelState.cashflowSales.find((s) => s.id === id);
  if (sale) CashflowView.showSaleReceipt(sale, () => controlReprintSale(sale));
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

// ── Staff ─────────────────────────────────────────────────────────────────────

const controlOpenStaff = async function () {
  try {
    await Promise.all([model.loadStaff(), model.loadRoles()]);
    StaffView.open();
    StaffView.render(model.state.staff);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlCloseStaff = function () {
  StaffView.close();
};

const controlShowInviteForm = function () {
  StaffView.showInviteForm(model.state.roles);
};

const controlInviteStaff = async function (data) {
  const email = data.email.toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }
  if (email === model.state.currentStaff?.email?.toLowerCase()) {
    showToast("You can't invite yourself.", 'error');
    return;
  }
  const alreadyOnTeam = model.state.staff.some(s => s.email.toLowerCase() === email);
  if (alreadyOnTeam) {
    showToast('This email is already on your staff list.', 'error');
    return;
  }

  try {
    await model.inviteStaff(data);
    StaffView.closeForm();
    StaffView.render(model.state.staff);
    showToast('Staff member added.', 'success');
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlRemoveStaff = async function (id) {
  if (!confirm('Remove this staff member? They will lose access to the system.')) return;
  try {
    await model.removeStaff(id);
    StaffView.render(model.state.staff);
    showToast('Staff member removed.', 'success');
  } catch (err) {
    showToast(err.message ?? err);
  }
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
  MenuListView._addHandlerAddCategory(controlAddCategoryFromSettings);
  MenuListView._addHandlerDeleteCategory(controlDeleteCategory);
  SettingsView._addHandlerAdd();
  SettingsView._addHandlerSave(controlSaveAdjustment);
  SettingsView._addHandlerEdit(controlEditAdjustment);
  SettingsView._addHandlerDelete(controlDeleteAdjustment);
  SettingsView._addHandlerToggle(controlToggleAdjustment);
  SettingsView._addHandlerShowRemoved(controlShowRemoved);
  SettingsView._addHandlerTogglePrinting(controlTogglePrinting);
  SettingsView._addHandlerToggleConfirmPrint(controlToggleConfirmPrint);
  SettingsView._addHandlerToggleTwoCopies(controlTogglePrintTwoCopies);

  //NewOrder
  NewOrderView._addHandlerShowMenuModal(controlNewOrder);
  NewOrderView._addHandlerCategoryTabs();
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
  OrderCheckOutView._wireOrderType();
  OrderCheckOutView._addHandlerPrintReceipt(controlConcludeTransaction);
  OrderCheckOutView._addHandlerReceiptEdit(controlReceiptEdit);
  OrderCheckOutView._addHandlerReceiptRemove(controlRemoveReceiptAdj);
  OrderCheckOutView._addHandlerReceiptAddManual(controlShowReceiptAddManualForm);
  OrderCheckOutView._addHandlerReceiptSaveOverride(controlSaveReceiptOverride);
  OrderCheckOutView._addHandlerReceiptSaveManual(controlSaveManualReceiptAdj);
  OrderCheckOutView._addHandlerApplyPromo(controlApplyPromoCode);
  OrderCheckOutView._addHandlerRemovePromo(controlRemovePromoCode);

  // Order Queue (KDS)
  KDSView._addHandlerViewAll();
  KDSView._addHandlerDone(controlMarkOrderDone);
  SettingsView._addHandlerKDSThresholds(controlSaveKDSThresholds);
  SettingsView._addHandlerDisplaySizes(controlSaveKDSWindowSize, controlSaveCFDWindowSize);
  SettingsView._addHandlerCFDAdUpload(controlUploadCFDAd);
  SettingsView._addHandlerCFDAdRemove(controlRemoveCFDAd);
  const kdsWindowBtn = document.getElementById('kdsWindowBtn');
  const cfdWindowBtn = document.getElementById('cfdWindowBtn');
  kdsWindowBtn?.classList.remove('hidden');
  cfdWindowBtn?.classList.remove('hidden');
  kdsWindowBtn?.addEventListener('click', controlOpenKDSWindow);
  cfdWindowBtn?.addEventListener('click', controlOpenCFDWindow);

  // Discounts
  DiscountView._addHandlerOpen(controlOpenDiscounts);
  DiscountView._addHandlerClose(controlCloseDiscounts);
  DiscountView._addHandlerNewCode(controlNewDiscountCode);
  DiscountView._addHandlerSave(controlSaveDiscountCode);
  DiscountView._addHandlerEdit(controlEditDiscountCode);
  DiscountView._addHandlerDelete(controlDeleteDiscountCode);
  DiscountView._addHandlerToggleStatus(controlToggleDiscountStatus);

  // Cashier switcher
  document.getElementById('cashierCard')?.addEventListener('click', controlSwitchCashier);

  // Staff
  StaffView._addHandlerOpen(controlOpenStaff);
  StaffView._addHandlerClose(controlCloseStaff);
  StaffView._addHandlerInvite(controlShowInviteForm);
  StaffView._addHandlerSaveInvite(controlInviteStaff);
  StaffView._addHandlerRemove(controlRemoveStaff);
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

// ── BroadcastChannel incoming messages ────────────────────────────────────────

channel.onmessage = function ({ data }) {
  switch (data.type) {
    case MSG.KDS_REQUEST_SYNC:
      channel.postMessage({
        type: MSG.KDS_QUEUE_SYNC,
        queue: modelState.orderQueue,
        thresholds: {
          yellow: model.state.settings.kdsYellowThreshold,
          red: model.state.settings.kdsRedThreshold,
        },
      });
      break;
    case MSG.KDS_ORDER_DONE:
      controlMarkOrderDone(data.id);
      break;
    case MSG.CFD_REQUEST_SYNC:
      channel.postMessage({
        type: MSG.CFD_CART_UPDATE,
        cart: modelState.cart,
        total: modelState.cart.reduce((s, i) => s + i.totalPrice, 0),
      });
      break;
  }
};

initAuth();
