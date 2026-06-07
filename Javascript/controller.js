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
import ReportsView from "./Views/reportsView.js";
import SupportView from "./Views/supportView.js";
import { fetchReportsSalesRaw } from "./model.js";

const modelState = model.state;
let item;

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
    OrderCheckOutView._orderType = model.state.settings.orderTypeEnabled ? 'dine-in' : null;
    OrderCheckOutView.render(modelState);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const _buildSale = function () {
  const cashierName    = _cashierDisplayName(model.state.currentCashier) || model.state.username || '';
  const loggedInCashier = model.state.username || '';
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
    loggedInCashier,
    orderType: OrderCheckOutView._orderType ?? 'dine-in',
    date: Date.now(),
  };
};

// ── Order Queue (KDS) ─────────────────────────────────────────────────────────

const _generateTicketNumber = function () {
  const active = new Set(modelState.orderQueue.map(o => o.ticketNumber).filter(Boolean));
  let n;
  do { n = Math.floor(Math.random() * 999) + 1; } while (active.has(n));
  return n;
};

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

// ── Undo "done" window ────────────────────────────────────────────────────────
const UNDO_WINDOW_MS = 30_000;
const _pendingDone = new Map(); // id → { timer, order, idx, timedOut, dismissToast }


const _undoMarkDone = function (id) {
  const pending = _pendingDone.get(id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pending.dismissToast();
  _pendingDone.delete(id);
  const insertIdx = Math.min(pending.idx, modelState.orderQueue.length);
  modelState.orderQueue.splice(insertIdx, 0, pending.order);
  KDSView.renderQueue(modelState.orderQueue);
  _ensureKDSTick();
  channel.postMessage({
    type: MSG.KDS_QUEUE_SYNC,
    queue: modelState.orderQueue,
    thresholds: {
      yellow: model.state.settings.kdsYellowThreshold,
      red: model.state.settings.kdsRedThreshold,
    },
  });
};

const controlMarkOrderDone = function (id, timedOut = false) {
  const idx = modelState.orderQueue.findIndex(o => o.id === id);
  if (idx === -1 || _pendingDone.has(id)) return;
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

  const dismissToast = KDSView.showUndoToast(order, () => _undoMarkDone(id), UNDO_WINDOW_MS);
  const timer = setTimeout(async () => {
    _pendingDone.delete(id);
    dismissToast();
    try {
      await model.recordServeTime(id, timedOut);
      _loadServingComparison();
    } catch (_) {}
  }, UNDO_WINDOW_MS);

  _pendingDone.set(id, { timer, order, idx, timedOut, dismissToast });
};


const controlOpenKDSWindow = function () {
  const { width, height } = model.state.settings.kdsWindowSize;
  const win = window.open('kds-display.html', 'pointbunny-kds', `width=${width},height=${height},menubar=no,toolbar=no,location=no`);
  if (!win) showToast('Popup was blocked. Allow popups for this site to open the Queue Display.', 'error');
  else win.focus();
};

const controlOpenCFDWindow = function () {
  const { width, height } = model.state.settings.cfdWindowSize;
  const win = window.open('customer-display.html', 'pointbunny-cfd', `width=${width},height=${height},menubar=no,toolbar=no,location=no`);
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
  localStorage.setItem('pointbunny_kds_window_size', JSON.stringify(size));
};

const controlSaveCFDWindowSize = function (size) {
  model.state.settings.cfdWindowSize = size;
  localStorage.setItem('pointbunny_cfd_window_size', JSON.stringify(size));
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
  localStorage.setItem('pointbunny_kds_yellow', yellow);
  localStorage.setItem('pointbunny_kds_red', red);
  localStorage.setItem('pointbunny_kds_auto', auto);
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
    logged_in_cashier: sale.loggedInCashier || null,
    order_type: sale.orderType ?? 'dine-in',
    ticket_number: sale.ticketNumber ?? null,
  }).select('id').single();
  if (insertError) {
    if (insertError.code === '22003' || insertError.message?.includes('numeric field overflow')) {
      throw new Error("That number doesn't look right — check the payment amount and try again.");
    }
    throw insertError;
  }
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
    ticketNumber: sale.ticketNumber ?? null,
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
  _clearCashflowCache(); // new sale invalidates all cached periods
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
    sale.ticketNumber = _generateTicketNumber();

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

// ── Help & Support ────────────────────────────────────────────────────────────

const controlOpenSupport = async function () {
  SupportView.open();
  try {
    await model.loadTickets();
    SupportView.renderTicketList(model.state.tickets);
    SupportView.syncUnreadBadge(model.state.tickets);
  } catch (err) {
    showToast(err.message ?? 'Could not load tickets.');
  }
};

const controlOpenTicket = async function (ticketId) {
  const ticket = model.state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  SupportView.setCurrentTicket(ticketId);
  try {
    const replies = await model.loadTicketReplies(ticketId);
    SupportView.renderThread(ticket, replies);
    if (ticket.has_unread_reply) {
      await model.markRepliesRead(ticketId);
      SupportView.syncUnreadBadge(model.state.tickets);
    }
  } catch (err) {
    showToast(err.message ?? 'Could not load ticket.');
  }
};

const controlMarkTicketSolved = async function (ticketId) {
  if (!ticketId) return;
  const confirmed = confirm(
    'Mark this ticket as solved?\n\nOnce solved it cannot be reopened — if the issue comes back you\'ll need to submit a new ticket.'
  );
  if (!confirmed) return;
  try {
    await model.markTicketSolved(ticketId);
    const ticket = model.state.tickets.find(t => t.id === ticketId);
    const replies = await model.loadTicketReplies(ticketId);
    SupportView.renderThread(ticket, replies);
    SupportView.renderTicketList(model.state.tickets);
  } catch (err) {
    showToast(err.message ?? 'Could not update ticket.');
  }
};

const controlSubmitRating = async function () {
  const ticketId = SupportView._currentTicketId;
  const { rating, comment } = SupportView.getRatingData();
  if (!ticketId || !rating) return;
  SupportView.setRatingSubmitting(true);
  try {
    await model.submitTicketRating(ticketId, rating, comment);
    const ticket = model.state.tickets.find(t => t.id === ticketId);
    const replies = await model.loadTicketReplies(ticketId);
    SupportView.renderThread(ticket, replies);
    showToast('Thanks for your feedback!');
  } catch (err) {
    showToast(err.message ?? 'Could not submit rating.');
  } finally {
    SupportView.setRatingSubmitting(false);
  }
};

const controlSendReply = async function () {
  const ticketId = SupportView._currentTicketId;
  const message = SupportView._getReplyText();
  if (!ticketId || !message) return;
  SupportView.setReplySending(true);
  try {
    await model.submitTicketReply(ticketId, message);
    SupportView.clearReplyInput();
    const ticket = model.state.tickets.find(t => t.id === ticketId);
    const replies = await model.loadTicketReplies(ticketId);
    SupportView.renderThread(ticket, replies);
  } catch (err) {
    showToast(err.message ?? 'Could not send reply.');
  } finally {
    SupportView.setReplySending(false);
  }
};

const controlSubmitTicket = async function () {
  const { category, subject, message, files } = SupportView._getTicketFormData();
  if (!category) { SupportView.showTicketResult(false, 'Please select a category.'); return; }
  if (!subject)  { SupportView.showTicketResult(false, 'Please enter a subject.'); return; }
  if (!message)  { SupportView.showTicketResult(false, 'Please enter a message.'); return; }
  const file = files[0];
  if (file && file.size > 5 * 1024 * 1024) {
    SupportView.showTicketResult(false, `"${file.name}" is over 5 MB. Please choose a smaller image.`);
    return;
  }
  SupportView.setTicketSubmitting(true);
  try {
    await model.submitTicket({ category, subject, message, files });
    SupportView.resetTicketForm();
    await model.loadTickets();
    SupportView.renderTicketList(model.state.tickets);
    SupportView.syncUnreadBadge(model.state.tickets);
    SupportView.showSuccessPanel();
    setTimeout(() => SupportView.showListPanel(), 2500);
  } catch (err) {
    SupportView.showTicketResult(false, err.message ?? 'Something went wrong. Please try again.');
  } finally {
    SupportView.setTicketSubmitting(false);
  }
};

const controlGenerateTimeclockToken = async function () {
  const btn = document.getElementById('tcGenerateTokenBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  try {
    const token = await model.generateTimeclockToken();
    SettingsView.showTimeclockToken(token);
  } catch (err) {
    showToast('Failed to generate code', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

const controlSaveBusinessInfo = async function ({ name, email, phone, timezone }) {
  const btn = document.getElementById('saveBusinessInfoBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    await model.saveBusinessInfo({ name, email, phone, timezone });
    SettingsView.showBusinessSaveStatus(true, 'Changes saved');
  } catch (err) {
    SettingsView.showBusinessSaveStatus(false, err.message ?? 'Failed to save');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  }
};

const controlOpenSettings = function () {
  if (model.state.role === 'Admin') {
    const isOwner = model.state.userId === model.state.businessId;
    SettingsView.syncBusinessInfo({
      name:     model.state.businessName     ?? '',
      email:    model.state.businessEmail    ?? model.state.currentStaff?.email ?? '',
      phone:    model.state.businessPhone    ?? '',
      timezone: model.state.businessTimezone ?? null,
      isOwner,
    });
  }
  SettingsView.renderAdjustments(model.state.settings.adjustments);
  SettingsView.syncShowRemovedToggle(model.state.settings.showRemovedAdjustments);
  SettingsView.syncPrintingToggle(model.state.settings.printingEnabled);
  SettingsView.syncConfirmPrintToggle(model.state.settings.confirmPrint);
  SettingsView.syncTwoCopiesToggle(model.state.settings.printTwoCopies);
  SettingsView.syncOrderTypeToggle(model.state.settings.orderTypeEnabled);
  SettingsView.syncKDSThresholds(
    model.state.settings.kdsYellowThreshold,
    model.state.settings.kdsRedThreshold,
    model.state.settings.kdsAutoCompleteThreshold,
  );
  SettingsView.syncDisplaySizes(
    model.state.settings.kdsWindowSize,
    model.state.settings.cfdWindowSize,
  );
  SettingsView.openWithRole(model.state.role);
};

const controlTogglePrinting = function (value) {
  model.state.settings.printingEnabled = value;
  localStorage.setItem('pointbunny_printing_enabled', value);
};

const controlToggleConfirmPrint = function (value) {
  model.state.settings.confirmPrint = value;
  localStorage.setItem('pointbunny_confirm_print', value);
};

const controlTogglePrintTwoCopies = function (value) {
  model.state.settings.printTwoCopies = value;
  localStorage.setItem('pointbunny_print_two_copies', value);
};

const controlToggleOrderType = function (value) {
  model.state.settings.orderTypeEnabled = value;
  localStorage.setItem('pointbunny_order_type_enabled', value);
};

const _refreshCategoryDropdowns = function () {
  NewMenuItemView._mapMenuCategoriesMarkUp(model.state.menuCategories);
  if (document.querySelector(".edit-field-select"))
    MenuEditView._mapMenuCategoriesMarkUp(model.state.menuCategories, "");
};

const controlAddCategoryFromSettings = async function (name) {
  try {
    await model.addCategory(name);
    // Only update the chips strip — no full re-render, no flash
    MenuListView._updateChips(model.state.menuCategories, name);
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
    // Update chips immediately, then full render to update item groups
    MenuListView._updateChips(model.state.menuCategories);
    MenuListView.render(model.state);
    _refreshCategoryDropdowns();
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const _renderAllAdjustments = function () {
  SettingsView.renderAdjustments(model.state.settings.adjustments);
  DiscountView.renderAdjustments(model.state.settings.adjustments);
};

const controlSaveAdjustment = async function (data) {
  try {
    if (data.id) {
      await model.updateAdjustment(data.id, data);
    } else {
      await model.addAdjustment(data);
    }
    _renderAllAdjustments();
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlEditAdjustment = function (id) {
  const adj = model.state.settings.adjustments.find((a) => a.id === id);
  if (!adj) return;
  SettingsView.showForm(adj);
};

// Edit triggered from the Receipt Adjustments panel
const controlEditAdjFromPanel = function (id) {
  const adj = model.state.settings.adjustments.find((a) => a.id === id);
  if (!adj) return;
  DiscountView.showAdjustmentForm(adj);
};

const controlDeleteAdjustment = async function (id) {
  try {
    await model.deleteAdjustment(id);
    _renderAllAdjustments();
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlToggleAdjustment = async function (id) {
  try {
    await model.toggleAdjustment(id);
    _renderAllAdjustments();
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
  try { await model.loadStaff(); } catch (_) {}
  const activeStaff = model.state.staff.filter(s => s.isActive);
  const AVATAR_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];

  const existing = document.getElementById('cashierPickerOverlay');
  if (existing) { existing.remove(); return; }

  const el = document.createElement('div');
  el.id = 'cashierPickerOverlay';
  el.className = 'cashier-picker-overlay';
  const card = document.createElement('div');
  card.className = 'cashier-picker-card';
  el.appendChild(card);
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });

  const staffMeta = (s, i) => {
    const fullName    = _cashierDisplayName(s);
    const displayName = fullName || (s.email ? s.email.split('@')[0] : '?');
    const initials    = fullName
      ? fullName.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
      : displayName.slice(0,2).toUpperCase();
    return { displayName, initials, color: AVATAR_COLORS[i % AVATAR_COLORS.length] };
  };

  const renderStaffList = () => {
    card.innerHTML = `
      <div class="cashier-picker-header">
        <div>
          <h3 class="cashier-picker-title">Switch Cashier</h3>
          <p class="cashier-picker-subtitle">Who's at the register right now?</p>
        </div>
        <button class="modal-close-btn" id="cashierPickerCloseBtn" type="button">&times;</button>
      </div>
      <ul class="cashier-picker-list">
        ${activeStaff.length ? activeStaff.map((s, i) => {
          const { displayName, initials, color } = staffMeta(s, i);
          const isActive = model.state.currentCashier?.id === s.id;
          return `
            <li class="cashier-picker-item${isActive ? ' cashier-picker-item--active' : ''}${!s.hasPin ? ' cashier-picker-item--disabled' : ''}"
                data-id="${s.id}" data-idx="${i}" role="button" tabindex="0">
              <div class="cashier-picker-avatar" style="background:${color}">${esc(initials)}</div>
              <div class="cashier-picker-info">
                <span class="cashier-picker-name">${esc(displayName)}</span>
                <span class="cashier-picker-role">${esc(s.role)}${s.hasPin ? '' : ' &middot; <em class="cashier-no-pin">PIN not set</em>'}</span>
              </div>
              ${isActive ? `<div class="cashier-picker-check"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
            </li>`;
        }).join('') : '<li class="cashier-picker-empty">No active staff members yet.</li>'}
      </ul>
    `;
    card.querySelector('#cashierPickerCloseBtn')?.addEventListener('click', () => el.remove());
    card.querySelector('.cashier-picker-list')?.addEventListener('click', e => {
      const item = e.target.closest('.cashier-picker-item[data-id]');
      if (!item || item.classList.contains('cashier-picker-item--disabled')) return;
      const chosen = activeStaff.find(s => s.id === item.dataset.id);
      if (chosen) renderPinScreen(chosen, parseInt(item.dataset.idx));
    });
  };

  const renderPinScreen = (chosen, idx) => {
    const { displayName, initials, color } = staffMeta(chosen, idx);

    if (!chosen.hasPin) {
      model.state.currentCashier = chosen;
      _updateCashierDisplay();
      showToast(`Switched to ${displayName} — set a PIN in Staff settings`, 'success');
      el.remove();
      return;
    }

    card.innerHTML = `
      <div class="cashier-picker-header">
        <div>
          <h3 class="cashier-picker-title">Enter PIN</h3>
          <p class="cashier-picker-subtitle">Switching to ${esc(displayName)}</p>
        </div>
        <button class="modal-close-btn" id="cashierPinCloseBtn" type="button">&times;</button>
      </div>
      <div class="cashier-pin-screen">
        <div class="cashier-picker-avatar cashier-pin-avatar" style="background:${color}">${esc(initials)}</div>
        <p class="cashier-pin-name">${esc(displayName)}</p>
        <p class="cashier-pin-role">${esc(chosen.role)}</p>
        <div class="cashier-pin-dots" id="cashierPinDots">
          <span class="cashier-pin-dot"></span>
          <span class="cashier-pin-dot"></span>
          <span class="cashier-pin-dot"></span>
          <span class="cashier-pin-dot"></span>
          <span class="cashier-pin-dot"></span>
          <span class="cashier-pin-dot"></span>
        </div>
        <p class="cashier-pin-error hidden" id="cashierPinError">Incorrect PIN. Try again.</p>
        <div class="cashier-numpad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="cashier-numpad-btn" data-key="${n}">${n}</button>`).join('')}
          <button class="cashier-numpad-btn cashier-numpad-nav" data-key="back">← Back</button>
          <button class="cashier-numpad-btn" data-key="0">0</button>
          <button class="cashier-numpad-btn cashier-numpad-del" data-key="del">⌫</button>
        </div>
      </div>
    `;

    let enteredPin = '';

    const updateDots = () => {
      card.querySelectorAll('.cashier-pin-dot').forEach((d, i) => {
        d.classList.toggle('cashier-pin-dot--filled', i < enteredPin.length);
      });
    };

    const shakeAndClear = () => {
      const dotsEl = card.querySelector('#cashierPinDots');
      const errEl  = card.querySelector('#cashierPinError');
      dotsEl?.classList.add('cashier-pin-shake');
      errEl?.classList.remove('hidden');
      setTimeout(() => {
        dotsEl?.classList.remove('cashier-pin-shake');
        enteredPin = '';
        updateDots();
      }, 600);
    };

    card.querySelector('#cashierPinCloseBtn')?.addEventListener('click', () => el.remove());
    card.querySelector('.cashier-numpad')?.addEventListener('click', e => {
      const key = e.target.closest('.cashier-numpad-btn')?.dataset.key;
      if (!key) return;
      if (key === 'back') { renderStaffList(); return; }
      if (key === 'del')  { enteredPin = enteredPin.slice(0, -1); updateDots(); return; }
      if (enteredPin.length >= 6) return;
      enteredPin += key;
      updateDots();
      if (enteredPin.length === 6) {
        if (enteredPin === chosen.pin) {
          model.state.currentCashier = chosen;
          _updateCashierDisplay();
          showToast(`Switched to ${displayName}`, 'success');
          el.remove();
        } else {
          shakeAndClear();
        }
      }
    });
  };

  renderStaffList();
};

const refreshTodaySalesDisplay = async function () {
  try {
    const el = document.getElementById("totalStr");
    if (!el) return;

    const currentVal = parseFloat(el.textContent.replace(/[$,]/g, "")) || 0;
    const newVal = await model.loadTodaySalesTotal();

    if (newVal === currentVal) return;

    _updateYesterdayBadge(newVal);

    const overlay = document.querySelector(".success-overlay");
    if (overlay) {
      let done = false;
      const animate = () => {
        if (done) return;
        done = true;
        observer.disconnect();
        _animateSalesTotal(el, currentVal, newVal);
      };
      const observer = new MutationObserver(() => {
        if (!document.querySelector(".success-overlay")) animate();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(animate, 10_000);
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
  const companyNameEl = document.querySelector('.company-name');
  if (companyNameEl) companyNameEl.textContent = model.state.username;
  localStorage.setItem('pointbunny_store_name', model.state.username);
  localStorage.setItem('pointbunny_business_id', model.state.businessId);
  document.body.classList.remove('role-admin', 'role-manager', 'role-cashier');
  document.body.classList.add(`role-${model.state.role.toLowerCase()}`);
  if (model.state.currentStaff) model.state.currentCashier = model.state.currentStaff;
  _updateCashierDisplay();
  if (model.state.role === 'Admin') model.loadBusinessProfile().catch(() => {});

  // All queries are independent after businessId is set — run in parallel
  // instead of 7 sequential round trips (was ~1.4s, now takes as long as the slowest one)
  await Promise.all([
    model.loadMenuItems(),
    model.loadMenuCategories(),
    model.loadAdjustments(),
    model.loadDiscountCodes(),
    model.loadEmployees(),
    refreshTodaySalesDisplay(),
    model.loadOrderQueue(),
  ]);
  if (modelState.orderQueue.length > 0) {
    KDSView.renderQueue(modelState.orderQueue);
    _ensureKDSTick();
  }
  // Push queue to any KDS/CFD windows already open when the main app finishes loading
  channel.postMessage({
    type: MSG.KDS_QUEUE_SYNC,
    queue: modelState.orderQueue,
    thresholds: {
      yellow: model.state.settings.kdsYellowThreshold,
      red: model.state.settings.kdsRedThreshold,
    },
  });
  initAnalytics(user.id);
  _loadYesterdayComparison();
  _loadTransactionCounts();
  _loadServingComparison();
  model.loadTickets().then(() => SupportView.syncUnreadBadge(model.state.tickets)).catch(() => {});
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
  el.innerHTML = `${arrow}<span>${Math.abs(pct)}%<span class="svs-sub"> vs yesterday</span></span>`;
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
  badgeEl.innerHTML = `${arrow}<span>${Math.abs(pct)}%<span class="svs-sub"> vs yesterday</span></span>`;
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

const _loadServingComparison = async function () {
  const valEl = document.getElementById('homeAvgServing');
  const vsEl  = document.getElementById('homeServingVs');
  if (!valEl) return;
  try {
    const { start: todayStart, end: todayEnd } = _getBizDayBounds();
    const { start: yesterdayStart, end: yesterdayEnd } = _getBizDayBounds(new Date(Date.now() - 86400000));

    const [today, yesterday] = await Promise.all([
      model.fetchPeriodTotals(todayStart.toISOString(), todayEnd.toISOString()),
      model.fetchPeriodTotals(yesterdayStart.toISOString(), yesterdayEnd.toISOString()),
    ]);

    const todayMins = today.avgServingMinutes;
    if (todayMins === null) { valEl.textContent = '—'; if (vsEl) vsEl.textContent = ''; return; }

    // Format as "Xm Ys"
    const totalSecs = Math.round(todayMins * 60);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    valEl.textContent = m > 0 ? `${m}m ${s}s` : `${s}s`;

    // Compare vs yesterday
    if (!vsEl) return;
    const yestMins = yesterday.avgServingMinutes;
    if (yestMins === null || yestMins === 0) { vsEl.textContent = ''; return; }

    const diffSecs = Math.round((yestMins - todayMins) * 60); // positive = faster today
    const absSecs  = Math.abs(diffSecs);
    const absFmt   = absSecs >= 60
      ? `${Math.floor(absSecs / 60)}m ${absSecs % 60}s`
      : `${absSecs}s`;

    if (diffSecs > 0) {
      vsEl.className = 'home-dash-serving-vs svs--up';
      vsEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> ${absFmt} faster`;
    } else if (diffSecs < 0) {
      vsEl.className = 'home-dash-serving-vs svs--down';
      vsEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg> ${absFmt} slower`;
    } else {
      vsEl.className = 'home-dash-serving-vs';
      vsEl.textContent = 'Same as yesterday';
    }
  } catch (_) {
    if (valEl) valEl.textContent = '—';
    if (vsEl)  vsEl.textContent  = '';
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
  _maybeShowPinSetup();
};

const controlSignUp = async function ({ firstName, lastName, email, businessName, phone, password }) {
  AuthView.setSignUpLoading(true);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: `${firstName} ${lastName}`,
        business_name: businessName,
        phone: phone || null,
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
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (period === "today") {
    const { start, end } = _getBizDayBounds(now);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: fmt(now) };
  }

  if (period === "yesterday") {
    const { start, end } = _getBizDayBounds(new Date(Date.now() - 86400000));
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: `Yesterday · ${fmt(start)}` };
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

  // custom — append T00:00:00 (no Z) so the string is parsed as LOCAL midnight,
  // not UTC midnight (which lands on the previous calendar day in UTC- timezones).
  const start = new Date(from + 'T00:00:00');
  const end   = new Date(to   + 'T00:00:00'); end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString(), label: `${fmtShort(start)} – ${fmtShort(end)}` };
};

const _cashflowSummary = () => {
  const gross    = modelState.cashflowSales.reduce((s, r) => s + Number(r.total_price), 0);
  const expenses = modelState.expenses.reduce((s, e) => s + e.amount, 0);
  return { gross, expenses, net: gross - expenses };
};

const _cashflowCanEdit = () => modelState.role === 'Admin' || modelState.role === 'Manager';

// ── Cashflow period cache ─────────────────────────────────────────────────────
// Stores fetched results per period key so switching periods doesn't re-fetch.
// 'today' is intentionally never cached — it changes throughout the day.
// The entire cache is cleared on any data mutation (new sale, void, expense).
const _cashflowCache = new Map();
const _cfCacheKey = (period, from, to) =>
  period === 'custom' ? `custom:${from}:${to}` : period;
const _clearCashflowCache = () => _cashflowCache.clear();
const _staffCanManage  = () => modelState.role === 'Admin';

let _currentReportsPeriod = { period: 'today' };
let _currentPrevTotals = null;
let _selectedOverviewMetrics = new Set();
let _overviewTimeSeries = null;
const METRIC_COLORS = { revenue: '#22c55e', expenses: '#ef4444', net: '#3b82f6', avgOrder: '#f59e0b' };
const METRIC_LABELS = { revenue: 'Gross Income', expenses: 'Expenses', net: 'Net Income', avgOrder: 'Avg. Order' };
const _reportsExpenseSummary = () => {
  const gross    = (modelState.cashflowSales ?? []).reduce((s, r) => s + Number(r.total_price), 0);
  const expenses = (modelState.expenses      ?? []).reduce((s, e) => s + e.amount, 0);
  return { gross, expenses, net: gross - expenses };
};

let _currentCashflowPeriod = { period: "today" };

const _renderCashflowLists = () => {
  const canEdit = _cashflowCanEdit();
  CashflowView.renderSalesList(modelState.cashflowSales, canEdit);
  CashflowView.renderExpensesList(modelState.expenses, canEdit);
  CashflowView.renderVoidedList(modelState.voidedSales, canEdit);
};

const controlOpenCashflow = async function () {
  CashflowView.open(_cashflowCanEdit());
  CashflowView.renderLoading();
  CashflowView.setLoading(true);
  try {
    _currentCashflowPeriod = { period: "today" };
    const { startISO, endISO, label } = _getCashflowRange("today");
    await model.fetchCashflowData(startISO, endISO);
    CashflowView.setPeriodLabel(label);
    CashflowView.renderSummary(_cashflowSummary());
    _renderCashflowLists();
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
  _currentCashflowPeriod = { period, from, to };
  const { startISO, endISO, label } = _getCashflowRange(period, from, to);

  // Cache hit — restore instantly from memory, no network round-trip
  // 'today' is always re-fetched (live data changes throughout the day)
  const key = _cfCacheKey(period, from, to);
  const cached = period !== 'today' ? _cashflowCache.get(key) : null;
  if (cached) {
    modelState.cashflowSales = cached.sales;
    modelState.expenses      = cached.expenses;
    modelState.voidedSales   = cached.voidedSales;
    CashflowView.setPeriodLabel(label);
    CashflowView.renderSummary(_cashflowSummary());
    _renderCashflowLists();
    return;
  }

  // Cache miss — fetch from Supabase
  const isHeavy = period === 'year';
  CashflowView.renderLoading();
  CashflowView.setLoading(true);
  if (isHeavy) CashflowView.setHeavyLoadNotice(true);
  try {
    await model.fetchCashflowData(startISO, endISO);
    // Store in cache (never cache 'today' — it changes with every new sale)
    if (period !== 'today') {
      _cashflowCache.set(key, {
        sales:       modelState.cashflowSales,
        expenses:    modelState.expenses,
        voidedSales: modelState.voidedSales,
      });
    }
    CashflowView.setPeriodLabel(label);
    CashflowView.renderSummary(_cashflowSummary());
    _renderCashflowLists();
  } catch (err) {
    showToast(err.message ?? err);
  } finally {
    CashflowView.setLoading(false);
    if (isHeavy) CashflowView.setHeavyLoadNotice(false);
  }
};

const _refreshReportsExpenses = () => {
  if (document.getElementById("reportsPanel")?.classList.contains("hidden")) return;
  ReportsView.renderExpenseKpis(_reportsExpenseSummary());
};

const controlAddExpense = async function (data) {
  try {
    CashflowView.setSubmitting(true);
    await model.addExpense(data);
    _clearCashflowCache();
    CashflowView.hideExpenseModal();
    CashflowView.renderSummary(_cashflowSummary());
    CashflowView.renderExpensesList(modelState.expenses, _cashflowCanEdit());
    CashflowView.scrollExpensesToTop();
    _refreshReportsExpenses();
    showToast("Expense added.", "success");
  } catch (err) {
    showToast(err.message ?? err);
  } finally {
    CashflowView.setSubmitting(false);
  }
};

// ── Timezone-aware date helpers ───────────────────────────────────────────────
// Returns { start: Date, end: Date } for the calendar day that contains `date`
// in the business's configured IANA timezone (falls back to browser timezone).
const _dayBoundsInTz = function (date, tz) {
  // Format the date as "YYYY-MM-DD HH:mm:ss" in the target timezone (sv-SE gives ISO-style output)
  const dtStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date).replace(' ', 'T');
  // Compute UTC offset by comparing tz-local time (treated as UTC) vs actual UTC ms
  const offsetMs = date.getTime() - new Date(dtStr + 'Z').getTime();
  const dayStr = dtStr.slice(0, 10); // "YYYY-MM-DD"
  const startMs = new Date(dayStr + 'T00:00:00Z').getTime() + offsetMs;
  return { start: new Date(startMs), end: new Date(startMs + 86400000 - 1) };
};

const _getBizDayBounds = function (date = new Date()) {
  const tz = model.state.businessTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return _dayBoundsInTz(date, tz);
};

const _isToday = (isoStr) => {
  const d = new Date(isoStr);
  const { start, end } = _getBizDayBounds();
  return d >= start && d <= end;
};

const _executeVoid = async function (id, voidedBy) {
  const { wasInQueue } = await model.voidSale(id, voidedBy);
  _clearCashflowCache();
  KDSView.renderQueue(modelState.orderQueue);
  channel.postMessage({ type: MSG.KDS_ORDER_VOIDED, id });
  CashflowView.renderSummary(_cashflowSummary());
  _renderCashflowLists();
  const voided = modelState.voidedSales.find(s => s.id === id);
  if (voided && _isToday(voided.sale_date)) {
    refreshTodaySalesDisplay();
    if (wasInQueue && _todayTransactionCount !== null) { _todayTransactionCount = Math.max(0, _todayTransactionCount - 1); _updateTransactionBadge(); }
  }
  showToast('Transaction voided.', 'success');
};

const controlVoidTransaction = function (id) {
  const doVoid = async (voidedBy) => {
    try { await _executeVoid(id, voidedBy); }
    catch (err) { showToast(err.message ?? err); }
  };

  if (_cashflowCanEdit()) {
    CashflowView.showConfirmModal({
      message: 'Void this transaction? It will be removed from reports and the active queue. This cannot be undone.',
      confirmLabel: 'Void',
      cancelLabel: 'Cancel',
      onConfirm: () => doVoid([modelState.currentStaff?.firstName, modelState.currentStaff?.lastName].filter(Boolean).join(' ') || 'Admin'),
    });
  } else {
    CashflowView.showOverrideModal(async (email, password) => {
      try {
        const staffName = await model.verifyOverrideCredentials(email, password);
        CashflowView.hideOverrideModal();
        await _executeVoid(id, staffName);
      } catch (err) {
        CashflowView.setOverrideError(err.message ?? 'Authorization failed.');
      }
    });
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
  const sale = modelState.cashflowSales.find((s) => s.id === id)
    ?? modelState.voidedSales.find((s) => s.id === id);
  if (sale) CashflowView.showSaleReceipt(sale, () => controlReprintSale(sale));
};

const controlDeleteExpense = async function (id) {
  try {
    await model.deleteExpense(id);
    _clearCashflowCache();
    CashflowView.renderSummary(_cashflowSummary());
    CashflowView.renderExpensesList(modelState.expenses, _cashflowCanEdit());
    _refreshReportsExpenses();
    showToast("Expense deleted.", "success");
  } catch (err) {
    showToast(err.message ?? err);
  }
};

// ── Discounts ─────────────────────────────────────────────────────────────────

const controlOpenDiscounts = function () {
  DiscountView.open();
  DiscountView.render(model.state.discountCodes);
  DiscountView.renderAdjustments(model.state.settings.adjustments);
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
    StaffView.open(_staffCanManage());
    await Promise.all([model.loadStaff(), model.loadRoles()]);
    StaffView.render(model.state.staff, _staffCanManage());
    StaffView.renderRoles(model.state.roles);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlCloseStaff = function () {
  StaffView.close();
};

const _maybeShowPinSetup = function () {
  if (!model.state.currentStaff || model.state.currentStaff.hasPin) return;

  const name = model.state.currentStaff.firstName || 'there';
  const el = document.createElement('div');
  el.className = 'cashier-picker-overlay';
  el.style.zIndex = '99999';
  const card = document.createElement('div');
  card.className = 'cashier-picker-card';
  card.style.maxWidth = '340px';
  el.appendChild(card);
  document.body.appendChild(el);

  const renderCreate = () => {
    card.innerHTML = `
      <div class="cashier-picker-header" style="border-bottom:none;padding-bottom:0">
        <div>
          <h3 class="cashier-picker-title">Set Your PIN</h3>
          <p class="cashier-picker-subtitle">Hi ${esc(name)}! Create a 6-digit PIN to use at the register.</p>
        </div>
      </div>
      <div class="cashier-pin-screen">
        <div class="cashier-pin-dots" id="pinSetupDots">
          ${'<span class="cashier-pin-dot"></span>'.repeat(6)}
        </div>
        <p class="cashier-pin-error hidden" id="pinSetupError">PINs don't match. Try again.</p>
        <div class="cashier-numpad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="cashier-numpad-btn" data-key="${n}">${n}</button>`).join('')}
          <div></div>
          <button class="cashier-numpad-btn" data-key="0">0</button>
          <button class="cashier-numpad-btn cashier-numpad-del" data-key="del">⌫</button>
        </div>
      </div>
    `;
    let entered = '';
    const updateDots = () => card.querySelectorAll('.cashier-pin-dot').forEach((d, i) => d.classList.toggle('cashier-pin-dot--filled', i < entered.length));
    card.querySelector('.cashier-numpad')?.addEventListener('click', e => {
      const key = e.target.closest('.cashier-numpad-btn')?.dataset.key;
      if (!key) return;
      if (key === 'del') { entered = entered.slice(0, -1); updateDots(); return; }
      if (entered.length >= 6) return;
      entered += key;
      updateDots();
      if (entered.length === 6) renderConfirm(entered);
    });
  };

  const renderConfirm = (firstPin) => {
    card.innerHTML = `
      <div class="cashier-picker-header" style="border-bottom:none;padding-bottom:0">
        <div>
          <h3 class="cashier-picker-title">Confirm PIN</h3>
          <p class="cashier-picker-subtitle">Enter your PIN one more time.</p>
        </div>
      </div>
      <div class="cashier-pin-screen">
        <div class="cashier-pin-dots" id="pinSetupDots">
          ${'<span class="cashier-pin-dot"></span>'.repeat(6)}
        </div>
        <p class="cashier-pin-error hidden" id="pinSetupError">PINs don't match. Try again.</p>
        <div class="cashier-numpad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="cashier-numpad-btn" data-key="${n}">${n}</button>`).join('')}
          <button class="cashier-numpad-btn cashier-numpad-nav" data-key="back">← Back</button>
          <button class="cashier-numpad-btn" data-key="0">0</button>
          <button class="cashier-numpad-btn cashier-numpad-del" data-key="del">⌫</button>
        </div>
      </div>
    `;
    let entered = '';
    const updateDots = () => card.querySelectorAll('.cashier-pin-dot').forEach((d, i) => d.classList.toggle('cashier-pin-dot--filled', i < entered.length));
    const shakeAndRetry = () => {
      const dotsEl = card.querySelector('#pinSetupDots');
      const errEl  = card.querySelector('#pinSetupError');
      dotsEl?.classList.add('cashier-pin-shake');
      errEl?.classList.remove('hidden');
      setTimeout(() => { dotsEl?.classList.remove('cashier-pin-shake'); renderCreate(); }, 800);
    };
    card.querySelector('.cashier-numpad')?.addEventListener('click', async e => {
      const key = e.target.closest('.cashier-numpad-btn')?.dataset.key;
      if (!key) return;
      if (key === 'back') { renderCreate(); return; }
      if (key === 'del')  { entered = entered.slice(0, -1); updateDots(); return; }
      if (entered.length >= 6) return;
      entered += key;
      updateDots();
      if (entered.length === 6) {
        if (entered === firstPin) {
          try {
            await model.setStaffPin(model.state.currentStaff.id, entered);
            model.state.currentCashier = model.state.currentStaff;
            el.remove();
            showToast('PIN set! You\'re all set.', 'success');
          } catch (err) {
            showToast(err.message ?? 'Could not save PIN. Try again.');
            el.remove();
          }
        } else {
          shakeAndRetry();
        }
      }
    });
  };

  renderCreate();
};

const controlEditStaffRole = function (staffId) {
  const staff = model.state.staff.find(s => s.id === staffId);
  if (!staff) return;
  const { onSave } = StaffView.showEditRoleModal(staff, model.state.roles);
  onSave(async (roleId, hourlyRate) => {
    try {
      await model.updateStaffRole(staffId, roleId);
      if (hourlyRate !== undefined) await model.updateStaffHourlyRate(staffId, hourlyRate);
      StaffView.render(model.state.staff, _staffCanManage());
      showToast('Staff updated.', 'success');
    } catch (err) {
      showToast(err.message ?? 'Could not update staff.');
    }
  });
};

const controlSetStaffPin = async function (staffId, pin) {
  try {
    await model.setStaffPin(staffId, pin);
    StaffView.render(model.state.staff, _staffCanManage());
    showToast('PIN updated.', 'success');
  } catch (err) {
    showToast(err.message ?? 'Could not update PIN.');
  }
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
    StaffView.render(model.state.staff, _staffCanManage());
    showToast('Staff member added.', 'success');
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlRemoveStaff = async function (id) {
  if (!confirm('Remove this staff member? They will lose access to the system.')) return;
  try {
    await model.removeStaff(id);
    StaffView.render(model.state.staff, _staffCanManage());
    showToast('Staff member removed.', 'success');
  } catch (err) {
    showToast(err.message ?? err);
  }
};

// ── Payroll / Timesheets ──────────────────────────────────────────────────────

let _tsType  = 'week';
let _tsValue = null;

const controlFetchTimesheets = async function (type, value) {
  try {
    let startISO, endISO, label, resolvedValue;
    if (type === 'custom') {
      const start = new Date(value.from + 'T00:00:00'); start.setHours(0, 0, 0, 0);
      const end   = new Date(value.to   + 'T00:00:00'); end.setHours(23, 59, 59, 999);
      startISO = start.toISOString();
      endISO   = end.toISOString();
      const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      label = `${fmt(start)} – ${fmt(end)}`;
      resolvedValue = value;
    } else {
      const range = _getRangeFromValue(type, value);
      ({ startISO, endISO, label } = range);
      if (type === 'week') {
        const monday = new Date(startISO);
        resolvedValue = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
      } else {
        resolvedValue = value;
      }
    }
    _tsType  = type;
    _tsValue = resolvedValue;
    await model.fetchShifts(startISO, endISO);
    const canEdit = model.state.role === 'Admin' || model.state.userId === model.state.businessId;
    StaffView.renderTimesheets(model.state.shifts, model.state.staff, canEdit, { type, value: resolvedValue, label });
  } catch (err) {
    showToast(err.message ?? 'Failed to load timesheets');
  }
};

const controlSaveShift = async function (data) {
  const canEdit = model.state.role === 'Admin' || model.state.userId === model.state.businessId;
  if (!canEdit) { showToast('Only admins can edit shifts.', 'error'); return; }
  try {
    if (data.id) {
      await model.updateShift(data);
    } else {
      await model.addShift(data);
    }
    showToast('Shift saved.', 'success');
    await controlFetchTimesheets(_tsType, _tsValue);
  } catch (err) {
    showToast(err.message ?? 'Failed to save shift');
  }
};

const controlSaveHourlyRate = async function (staffId, rate) {
  const canEdit = model.state.role === 'Admin' || model.state.userId === model.state.businessId;
  if (!canEdit) { showToast('Only admins can edit pay rates.', 'error'); return; }
  try {
    const parsed = rate === '' ? null : parseFloat(rate);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) { showToast('Enter a valid hourly rate.', 'error'); return; }
    await model.updateStaffHourlyRate(staffId, parsed);
    showToast('Hourly rate saved.', 'success');
    if (_tsValue) await controlFetchTimesheets(_tsType, _tsValue);
  } catch (err) {
    showToast(err.message ?? 'Failed to save rate');
  }
};

// ── Reports ───────────────────────────────────────────────────────────────────

const _computeReportsSummary = function () {
  const sales = modelState.reportsSales;
  const revenue = sales.reduce((s, r) => s + Number(r.total_price), 0);
  const transactions = sales.length;
  const avgOrder = transactions > 0 ? revenue / transactions : 0;
  const avgServingMinutes = _computeServingTimeStats()?.avgMinutes ?? null;
  return { revenue, transactions, avgOrder, avgServingMinutes };
};

let _topItemsSortKey = "quantity";

const _computeTopItems = function (limit = 10, sortKey = _topItemsSortKey) {
  const map = new Map();
  for (const sale of modelState.reportsSales) {
    for (const item of (sale.items ?? [])) {
      const key = item.itemName;
      const existing = map.get(key) ?? { name: key, quantity: 0, revenue: 0 };
      existing.quantity += Number(item.quantity ?? 1);
      existing.revenue  += Number(item.totalPrice ?? 0);
      map.set(key, existing);
    }
  }
  return [...map.values()]
    .sort((a, b) => b[sortKey] - a[sortKey])
    .slice(0, limit);
};

const controlSortTopItems = function (key) {
  _topItemsSortKey = key;
  ReportsView.setTopItemsSort(key);
  ReportsView.renderTopItems(_computeTopItems(), key);
};

const _computeCategoryMix = function () {
  const itemCatMap = new Map(model.state.menuItems.map(i => [i.itemName, i.category]));
  const map = new Map();
  for (const sale of modelState.reportsSales) {
    for (const item of (sale.items ?? [])) {
      const cat = itemCatMap.get(item.itemName) ?? "Other";
      map.set(cat, (map.get(cat) ?? 0) + Number(item.totalPrice ?? 0));
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
};

const _computeRevenueOverTime = function (period, startISO, endISO) {
  const sales = modelState.reportsSales;
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const fmtHour = (i) => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;

  if (period === "today") {
    const hours = Array(24).fill(0);
    for (const s of sales) hours[new Date(s.sale_date).getHours()] += Number(s.total_price);
    return { labels: Array.from({ length: 24 }, (_, i) => fmtHour(i)), data: hours };
  }

  if (period === "year") {
    const year = new Date(startISO).getFullYear();
    const mmap = new Map();
    for (const s of sales) {
      const m = s.sale_date.slice(0, 7);
      mmap.set(m, (mmap.get(m) ?? 0) + Number(s.total_price));
    }
    return {
      labels: MONTHS,
      data: MONTHS.map((_, i) => mmap.get(`${year}-${String(i + 1).padStart(2, "0")}`) ?? 0),
    };
  }

  // week / month / custom → daily
  const localYMD = d =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dmap = new Map();
  for (const s of sales) {
    const d = localYMD(new Date(s.sale_date));   // local date of sale
    dmap.set(d, (dmap.get(d) ?? 0) + Number(s.total_price));
  }
  const start = new Date(startISO);
  const end   = new Date(endISO);
  const labels = [], data = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    labels.push(period === "week" ? DAYS[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`);
    data.push(dmap.get(localYMD(d)) ?? 0);       // local date key, not UTC
  }
  return { labels, data };
};

const _computeAllTimeSeries = function(period, startISO, endISO) {
  const sales    = modelState.reportsSales;
  const expenses = modelState.expenses ?? [];
  const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS     = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const fmtHour  = i => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;

  let labels, n, saleKeyFn, expKeyFn;

  if (period === "today") {
    labels = Array.from({ length: 24 }, (_, i) => fmtHour(i));
    n = 24;
    saleKeyFn = s => new Date(s.sale_date).getHours();
    expKeyFn  = e => e.expenseDate ? new Date(e.expenseDate).getHours() : -1;
  } else if (period === "year") {
    const year = new Date(startISO).getFullYear();
    labels = MONTHS;
    n = 12;
    const mKey = str => {
      const yr = parseInt(str.slice(0, 4));
      const mo = parseInt(str.slice(5, 7)) - 1;
      return yr === year ? mo : -1;
    };
    saleKeyFn = s => mKey(s.sale_date);
    expKeyFn  = e => e.expenseDate ? mKey(e.expenseDate) : -1;
  } else {
    const start = new Date(startISO);
    const end   = new Date(endISO);
    labels = [];
    const dateStrs = [];
    // Use LOCAL calendar date so keys match regardless of timezone.
    // d.toISOString() gives the UTC date which can be a day behind local midnight
    // in UTC+ timezones, causing sales to map to the wrong bucket.
    const localYMD = d =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      labels.push(period === "week"
        ? [DAYS[d.getDay()], `${mm}/${dd}`]          // two-line: "Mon" + "05/12"
        : `${d.getMonth() + 1}/${d.getDate()}`);
      dateStrs.push(localYMD(d));                    // LOCAL date key, not UTC
    }
    n = labels.length;
    const dmap = new Map(dateStrs.map((s, i) => [s, i]));
    // Map each sale to its LOCAL calendar date so it lands in the right bucket
    saleKeyFn = s => dmap.get(localYMD(new Date(s.sale_date))) ?? -1;
    expKeyFn  = e => e.expenseDate ? (dmap.get(e.expenseDate.slice(0, 10)) ?? -1) : -1;
  }

  const revArr = Array(n).fill(0);
  const expArr = Array(n).fill(0);
  const txArr  = Array(n).fill(0);
  const svcSum = Array(n).fill(0);
  const svcCnt = Array(n).fill(0);

  for (const s of sales) {
    const i = saleKeyFn(s);
    if (i < 0 || i >= n) continue;
    revArr[i] += Number(s.total_price);
    txArr[i]++;
    if (s.prepared_at) {
      const mins = (new Date(s.prepared_at) - new Date(s.sale_date)) / 60000;
      if (mins >= 0 && mins <= 120) { svcSum[i] += mins; svcCnt[i]++; }
    }
  }
  for (const e of expenses) {
    const i = expKeyFn(e);
    if (i < 0 || i >= n) continue;
    expArr[i] += e.amount;
  }

  return {
    labels,
    series: {
      revenue:      revArr,
      expenses:     expArr,
      net:          revArr.map((r, i) => r - expArr[i]),
      transactions: txArr,
      avgOrder:     revArr.map((r, i) => txArr[i] > 0 ? r / txArr[i] : 0),
      avgServing:   svcSum.map((s, i) => svcCnt[i] > 0 ? +(s / svcCnt[i]).toFixed(1) : 0),
    },
  };
};

const _buildOverviewDatasets = function() {
  if (!_overviewTimeSeries) return { labels: [], datasets: [] };
  const { labels, series } = _overviewTimeSeries;
  const datasets = [..._selectedOverviewMetrics].map(metric => {
    const color = METRIC_COLORS[metric];
    return {
      label: METRIC_LABELS[metric],
      data: series[metric] ?? [],
      borderColor: color,
      backgroundColor: color + '22',
      fill: 'origin',
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 7,
      borderWidth: 2.5,
      _metric: metric,
    };
  });
  return { labels, datasets };
};

const _renderOverviewChart = async function() {
  const { labels, datasets } = _buildOverviewDatasets();
  await ReportsView.renderOverviewChart({ labels, datasets });
  ReportsView.setSelectedMetrics(_selectedOverviewMetrics);
};

const controlToggleMetric = function(metric) {
  if (!METRIC_COLORS[metric]) return;
  if (_selectedOverviewMetrics.has(metric)) {
    _selectedOverviewMetrics.delete(metric);
  } else {
    _selectedOverviewMetrics.add(metric);
  }
  _renderOverviewChart();
};

const _computeTrafficPeaks = function(period, startISO, endISO) {
  const sales = modelState.reportsSales;
  const fmtHour = i => i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`;
  const FULLDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const hourCounts = Array(24).fill(0);
  for (const s of sales) hourCounts[new Date(s.sale_date).getHours()]++;
  const maxHour = Math.max(...hourCounts);
  const peakHourIdx = maxHour > 0 ? hourCounts.indexOf(maxHour) : -1;

  const dayCounts = Array(7).fill(0);
  for (const s of sales) {
    const d = new Date(s.sale_date).getDay();
    dayCounts[d === 0 ? 6 : d - 1]++;
  }
  const maxDay = Math.max(...dayCounts);
  const peakDayIdx = maxDay > 0 ? dayCounts.indexOf(maxDay) : -1;

  const days = Math.max(1, Math.round((new Date(endISO) - new Date(startISO)) / 86400000));
  const avgDaily = sales.length > 0 ? sales.length / days : 0;

  return {
    peakHour:  peakHourIdx >= 0 ? { label: fmtHour(peakHourIdx), count: maxHour } : null,
    peakDay:   period !== 'today' && peakDayIdx >= 0 ? { label: FULLDAY[peakDayIdx], count: maxDay } : null,
    total:     sales.length,
    avgDaily,
  };
};

const _computeHourlyBreakdown = function () {
  const hours = Array(24).fill(0);
  for (const s of modelState.reportsSales)
    hours[new Date(s.sale_date).getHours()]++;
  const fmtHour = (i) => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;
  return { labels: Array.from({ length: 24 }, (_, i) => fmtHour(i)), data: hours };
};

const _computeDayOfWeek = function (period) {
  if (period === "today") return { labels: [], data: [], isEmpty: true };
  const MON = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const totals = Array(7).fill(0);
  for (const s of modelState.reportsSales) {
    const d = new Date(s.sale_date).getDay(); // 0=Sun
    const idx = d === 0 ? 6 : d - 1;         // shift to Mon=0
    totals[idx]++;
  }
  return { labels: MON, data: totals, isEmpty: false };
};

const _computeServingTimeStats = function () {
  const fmtHour = (i) => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;
  const MON = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const sales = modelState.reportsSales.filter(s => s.prepared_at);
  if (!sales.length) return null;
  const toMins = (s) => (new Date(s.prepared_at) - new Date(s.sale_date)) / 60000;
  const hourCounts = Array(24).fill(0), hourTotals = Array(24).fill(0);
  const dayCounts  = Array(7).fill(0),  dayTotals  = Array(7).fill(0);
  let totalMins = 0, totalCount = 0;
  for (const s of sales) {
    const mins = toMins(s);
    if (mins < 0 || mins > 120) continue;
    const h = new Date(s.sale_date).getHours();
    hourCounts[h]++; hourTotals[h] += mins;
    const d = new Date(s.sale_date).getDay();
    const idx = d === 0 ? 6 : d - 1;
    dayCounts[idx]++; dayTotals[idx] += mins;
    totalMins += mins; totalCount++;
  }
  if (!totalCount) return null;
  return {
    avgMinutes: totalMins / totalCount,
    byHour: { labels: Array.from({ length: 24 }, (_, i) => fmtHour(i)), data: hourCounts.map((c, i) => c > 0 ? hourTotals[i] / c : 0) },
    byDay:  { labels: MON, data: dayCounts.map((c, i) => c > 0 ? dayTotals[i] / c : 0) },
  };
};

const _getPreviousPeriodRange = function (period, startISO, endISO, from, to) {
  const start = new Date(startISO);
  const end   = new Date(endISO);

  if (period === "today") {
    const s = new Date(start); s.setDate(s.getDate() - 1); s.setHours(0,0,0,0);
    const e = new Date(s); e.setHours(23,59,59,999);
    return { prevStart: s.toISOString(), prevEnd: e.toISOString(), vsLabel: "yesterday" };
  }
  if (period === "week") {
    const s = new Date(start); s.setDate(s.getDate() - 7);
    const e = new Date(end);   e.setDate(e.getDate() - 7);
    return { prevStart: s.toISOString(), prevEnd: e.toISOString(), vsLabel: "last week" };
  }
  if (period === "month") {
    const s = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const e = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
    return { prevStart: s.toISOString(), prevEnd: e.toISOString(), vsLabel: "last month" };
  }
  if (period === "year") {
    const s = new Date(start.getFullYear() - 1, 0, 1);
    const e = new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { prevStart: s.toISOString(), prevEnd: e.toISOString(), vsLabel: "last year" };
  }
  // custom — same duration shifted back
  const ms = end - start;
  const e  = new Date(start.getTime() - 1);
  const s  = new Date(e.getTime() - ms);
  return { prevStart: s.toISOString(), prevEnd: e.toISOString(), vsLabel: "previous period" };
};

// ── Compare helpers ───────────────────────────────────────────────────────────

const _computeSummaryFromSales = function (sales) {
  const revenue = sales.reduce((s, r) => s + Number(r.total_price), 0);
  const transactions = sales.length;
  const avgOrder = transactions > 0 ? revenue / transactions : 0;
  let servTotal = 0, servCount = 0;
  for (const s of sales) {
    if (!s.prepared_at) continue;
    const mins = (new Date(s.prepared_at) - new Date(s.sale_date)) / 60000;
    if (mins < 0 || mins > 120) continue;
    servTotal += mins; servCount++;
  }
  return { revenue, transactions, avgOrder, avgServingMinutes: servCount > 0 ? servTotal / servCount : null };
};

const _computeTopItemsFromSales = function (sales, limit = 5, sortKey = "quantity") {
  const map = new Map();
  for (const sale of sales) {
    for (const item of (sale.items ?? [])) {
      const key = item.itemName;
      const existing = map.get(key) ?? { name: key, quantity: 0, revenue: 0 };
      existing.quantity += Number(item.quantity ?? 1);
      existing.revenue  += Number(item.totalPrice ?? 0);
      map.set(key, existing);
    }
  }
  return [...map.values()].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, limit);
};

const _computeCompareRevenue = function (sales, type, startISO, endISO) {
  const MONTHS  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const fmtHour = (i) => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;

  if (type === "today" || type === "yesterday" || type === "day") {
    const hours = Array(24).fill(0);
    for (const s of sales) hours[new Date(s.sale_date).getHours()] += Number(s.total_price);
    return { labels: Array.from({ length: 24 }, (_, i) => fmtHour(i)), data: hours };
  }
  if (type === "year") {
    const year = new Date(startISO).getFullYear();
    const mmap = new Map();
    for (const s of sales) { const m = s.sale_date.slice(0, 7); mmap.set(m, (mmap.get(m) ?? 0) + Number(s.total_price)); }
    return { labels: MONTHS, data: MONTHS.map((_, i) => mmap.get(`${year}-${String(i + 1).padStart(2, "0")}`) ?? 0) };
  }
  // week / month / custom → daily
  const localYMD = d =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dmap = new Map();
  for (const s of sales) {
    const d = localYMD(new Date(s.sale_date));   // local date of sale
    dmap.set(d, (dmap.get(d) ?? 0) + Number(s.total_price));
  }
  const start = new Date(startISO);
  const end   = new Date(endISO);
  const labels = [], data = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    labels.push(type === "week" ? DAYS[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`);
    data.push(dmap.get(localYMD(d)) ?? 0);       // local date key, not UTC
  }
  return { labels, data };
};

// ── Per-sales-array helpers (used by compare mode for both periods) ────────────

const _computeCategoryMixFromSales = function (sales) {
  const itemCatMap = new Map(model.state.menuItems.map(i => [i.itemName, i.category]));
  const map = new Map();
  for (const sale of sales)
    for (const item of (sale.items ?? [])) {
      const cat = itemCatMap.get(item.itemName) ?? "Other";
      map.set(cat, (map.get(cat) ?? 0) + Number(item.totalPrice ?? 0));
    }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
};

const _computeStaffFromSales = function (sales) {
  const map = new Map();
  for (const sale of sales) {
    const name = sale.added_by || "Unknown";
    const e = map.get(name) ?? { name, transactions: 0, revenue: 0 };
    e.transactions++; e.revenue += Number(sale.total_price);
    map.set(name, e);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
};

const _computeHourlyFromSales = function (sales) {
  const fmtHour = (i) => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;
  const hours = Array(24).fill(0);
  for (const s of sales) hours[new Date(s.sale_date).getHours()]++;
  return { labels: Array.from({ length: 24 }, (_, i) => fmtHour(i)), data: hours };
};

const _computeDowFromSales = function (sales) {
  const MON = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const totals = Array(7).fill(0);
  for (const s of sales) {
    const d = new Date(s.sale_date).getDay();
    totals[d === 0 ? 6 : d - 1]++;
  }
  return { labels: MON, data: totals };
};

const _computeServingFromSales = function (sales) {
  const fmtHour = (i) => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;
  const MON = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const filtered = sales.filter(s => s.prepared_at);
  if (!filtered.length) return null;
  const hourC = Array(24).fill(0), hourT = Array(24).fill(0);
  const dayC  = Array(7).fill(0),  dayT  = Array(7).fill(0);
  let totalMins = 0, totalCount = 0;
  for (const s of filtered) {
    const mins = (new Date(s.prepared_at) - new Date(s.sale_date)) / 60000;
    if (mins < 0 || mins > 120) continue;
    const h = new Date(s.sale_date).getHours();
    hourC[h]++; hourT[h] += mins;
    const d = new Date(s.sale_date).getDay();
    const idx = d === 0 ? 6 : d - 1;
    dayC[idx]++; dayT[idx] += mins;
    totalMins += mins; totalCount++;
  }
  if (!totalCount) return null;
  return {
    avgMinutes: totalMins / totalCount,
    byHour: { labels: Array.from({ length: 24 }, (_, i) => fmtHour(i)), data: hourC.map((c, i) => c > 0 ? hourT[i] / c : 0) },
    byDay:  { labels: MON, data: dayC.map((c, i) => c > 0 ? dayT[i] / c : 0) },
  };
};

const _computeTrafficPeaksFromSales = function (sales) {
  const fmtHour = i => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;
  const FULLDAY = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const hourC = Array(24).fill(0);
  for (const s of sales) hourC[new Date(s.sale_date).getHours()]++;
  const maxH = Math.max(...hourC);
  const dayC = Array(7).fill(0);
  for (const s of sales) { const d = new Date(s.sale_date).getDay(); dayC[d === 0 ? 6 : d - 1]++; }
  const maxD = Math.max(...dayC);
  return {
    peakHour:      maxH > 0 ? fmtHour(hourC.indexOf(maxH))  : "—",
    peakHourCount: maxH,
    peakDay:       maxD > 0 ? FULLDAY[dayC.indexOf(maxD)]   : "—",
    peakDayCount:  maxD,
  };
};

// ─────────────────────────────────────────────────────────────────────────────

let _compareModeActive = false;
let _cmpSalesA = null, _cmpSalesB = null, _cmpRangeA = null, _cmpRangeB = null;
let _cmpTopItemsSortKey = "quantity";

const _getRangeFromValue = function (type, value) {
  const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (type === "day") {
    const start = new Date(value + "T00:00:00"); start.setHours(0, 0, 0, 0);
    const end   = new Date(value + "T00:00:00"); end.setHours(23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(),
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) };
  }
  if (type === "week") {
    const d = new Date(value + "T00:00:00");
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(d); monday.setDate(d.getDate() + diffToMon); monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
    return { startISO: monday.toISOString(), endISO: sunday.toISOString(),
      label: `${fmtShort(monday)} – ${fmtShort(sunday)}` };
  }
  if (type === "month") {
    const [year, month] = value.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(),
      label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }
  if (type === "year") {
    const year = parseInt(value);
    const start = new Date(year, 0, 1);
    const end   = new Date(year, 11, 31, 23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: String(year) };
  }
  return null;
};

const controlToggleCompare = function () {
  _compareModeActive = !_compareModeActive;
  if (_compareModeActive) ReportsView.enterCompareMode();
  else ReportsView.exitCompareMode();
};

const controlCmpSortTopItems = function (key) {
  _cmpTopItemsSortKey = key;
  ReportsView.setCmpTopItemsSort(key);
  if (_cmpSalesA && _cmpSalesB) {
    ReportsView.renderCmpTopItems(
      _computeTopItemsFromSales(_cmpSalesA, 5, key),
      _computeTopItemsFromSales(_cmpSalesB, 5, key),
    );
  }
};

const controlRunComparison = async function ({ type, aValue, bValue, fromA, toA, fromB, toB }) {
  try {
    _cmpRangeA = type === "custom" ? _getCashflowRange("custom", fromA, toA) : _getRangeFromValue(type, aValue);
    _cmpRangeB = type === "custom" ? _getCashflowRange("custom", fromB, toB) : _getRangeFromValue(type, bValue);
    _cmpTopItemsSortKey = "quantity";
    ReportsView.setCmpTopItemsSort("quantity");

    const [salesA, salesB] = await Promise.all([
      fetchReportsSalesRaw(_cmpRangeA.startISO, _cmpRangeA.endISO),
      fetchReportsSalesRaw(_cmpRangeB.startISO, _cmpRangeB.endISO),
    ]);
    _cmpSalesA = salesA;
    _cmpSalesB = salesB;

    const labelA = _cmpRangeA.label;
    const labelB = _cmpRangeB.label;

    // Revenue over time (existing)
    const revA = _computeCompareRevenue(salesA, type, _cmpRangeA.startISO, _cmpRangeA.endISO);
    const revB = _computeCompareRevenue(salesB, type, _cmpRangeB.startISO, _cmpRangeB.endISO);
    const maxLen = Math.max(revA.labels.length, revB.labels.length);
    const revLabels = revA.labels.length >= revB.labels.length ? revA.labels : revB.labels;
    const dataA = revA.data.concat(Array(maxLen - revA.data.length).fill(0));
    const dataB = revB.data.concat(Array(maxLen - revB.data.length).fill(0));

    // All additional metrics
    const categoryA  = _computeCategoryMixFromSales(salesA);
    const categoryB  = _computeCategoryMixFromSales(salesB);
    const itemMixA   = _computeTopItemsFromSales(salesA, 8, "quantity");
    const itemMixB   = _computeTopItemsFromSales(salesB, 8, "quantity");
    const staffA     = _computeStaffFromSales(salesA);
    const staffB     = _computeStaffFromSales(salesB);
    const hourlyA    = _computeHourlyFromSales(salesA);
    const hourlyB    = _computeHourlyFromSales(salesB);
    const dowA       = _computeDowFromSales(salesA);
    const dowB       = _computeDowFromSales(salesB);
    const servingA   = _computeServingFromSales(salesA);
    const servingB   = _computeServingFromSales(salesB);
    const tPeaksA    = _computeTrafficPeaksFromSales(salesA);
    const tPeaksB    = _computeTrafficPeaksFromSales(salesB);
    const topItemsA1 = _computeTopItemsFromSales(salesA, 1, "quantity")[0];
    const topItemsB1 = _computeTopItemsFromSales(salesB, 1, "quantity")[0];

    const fmt = (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const salesPeaksA = {
      bestSeller: topItemsA1?.name ?? "—",
      bestSellerSub: topItemsA1 ? `${topItemsA1.quantity} sold` : "",
      topCategory: categoryA[0]?.label ?? "—",
      topCategorySub: categoryA[0] ? fmt(categoryA[0].value) : "",
      topStaff: staffA[0]?.name ?? "—",
      topStaffSub: staffA[0] ? fmt(staffA[0].revenue) : "",
    };
    const salesPeaksB = {
      bestSeller: topItemsB1?.name ?? "—",
      bestSellerSub: topItemsB1 ? `${topItemsB1.quantity} sold` : "",
      topCategory: categoryB[0]?.label ?? "—",
      topCategorySub: categoryB[0] ? fmt(categoryB[0].value) : "",
      topStaff: staffB[0]?.name ?? "—",
      topStaffSub: staffB[0] ? fmt(staffB[0].revenue) : "",
    };

    // Render all
    ReportsView.renderCompareResults({
      labelA, labelB,
      summaryA: _computeSummaryFromSales(salesA),
      summaryB: _computeSummaryFromSales(salesB),
      topItemsA: _computeTopItemsFromSales(salesA, 5, "quantity"),
      topItemsB: _computeTopItemsFromSales(salesB, 5, "quantity"),
    });

    ReportsView.renderCmpPeakStats({ salesPeaksA, salesPeaksB, tPeaksA, tPeaksB });

    await Promise.all([
      ReportsView.renderCompareChart({ labelA, labelB, labels: revLabels, dataA, dataB }),
      ReportsView.renderCmpSalesCharts({ categoryA, categoryB, itemMixA, itemMixB, labelA, labelB }),
      ReportsView.renderCmpStaff({ staffA, staffB }),
      ReportsView.renderCmpTrafficCharts({ hourlyA, hourlyB, dowA, dowB, labelA, labelB }),
      ReportsView.renderCmpKitchenCharts({ servingA, servingB, labelA, labelB }),
    ]);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const _getAvgDivisor = function (period, startISO, endISO) {
  const now = new Date();
  const end = new Date(endISO);
  const isCurrentPeriod = end >= now;

  if (period === 'today') {
    if (isCurrentPeriod) return Math.max(1, now.getHours() + now.getMinutes() / 60);
    return 24;
  }
  if (period === 'week') {
    if (isCurrentPeriod) {
      const start = new Date(startISO);
      return Math.max(1, Math.min(7, Math.ceil((now - start) / 86400000)));
    }
    return 7;
  }
  if (period === 'month') {
    if (isCurrentPeriod) return Math.max(1, now.getDate() / 7);
    const start = new Date(startISO);
    return new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() / 7;
  }
  if (period === 'year') {
    if (isCurrentPeriod) return Math.max(1, now.getMonth() + 1);
    return 12;
  }
  // custom: days in range
  const start = new Date(startISO);
  return Math.max(1, Math.round((end - start) / 86400000));
};

const _getAvgUnitSuffix = function (period) {
  if (period === 'today')  return '/ Hr';
  if (period === 'week')   return '/ Day';
  if (period === 'month')  return '/ Wk';
  if (period === 'year')   return '/ Mo';
  return '/ Day';
};

const _getAvgTooltip = function (period, divisor) {
  const d = parseFloat(divisor.toFixed(1));
  if (period === 'today')  return `Divided by hours elapsed today — not always 24 (currently ${d} hrs)`;
  if (period === 'week')   return `Divided by days elapsed this week — not always 7 (currently ${d} days)`;
  if (period === 'month')  return `Divided by weeks elapsed this month (currently ${d} wks)`;
  if (period === 'year')   return `Divided by months elapsed this year (currently ${d} months)`;
  return `Divided by days in this range (${d} days)`;
};

let _staffSortKey = "revenue";

const _computeStaffPerformance = function (sortKey = _staffSortKey) {
  const map = new Map();
  for (const sale of modelState.reportsSales) {
    const name = sale.added_by || "Unknown";
    const existing = map.get(name) ?? { name, transactions: 0, revenue: 0 };
    existing.transactions++;
    existing.revenue += Number(sale.total_price);
    map.set(name, existing);
  }
  const sorter = sortKey === "quantity"
    ? (a, b) => b.transactions - a.transactions
    : (a, b) => b.revenue - a.revenue;
  return [...map.values()].sort(sorter);
};

const controlSortStaff = function (key) {
  _staffSortKey = key;
  ReportsView.setStaffSort(key);
  const staff = _computeStaffPerformance(key);
  ReportsView.renderStaff(staff, key);
};

let _reportSnapshot = null;

const controlExportReports = function () {
  if (!_reportSnapshot) {
    showToast("No data to export for this period.", "info");
    return;
  }
  const { sales, staff, periodLabel } = _reportSnapshot;
  if (!sales.length) {
    showToast("No data to export for this period.", "info");
    return;
  }

  const safeLabel = periodLabel.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const escape = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

  const salesRows = sales.map((s) => [
    fmtDate(s.sale_date),
    fmtTime(s.sale_date),
    (s.items ?? []).map((i) => `${i.itemName} x${i.quantity}`).join("; "),
    `+${Number(s.total_price).toFixed(2)}`,
    s.order_type ?? "",
    s.added_by ?? "",
  ]);

  const staffRows = staff.map((p) => [
    "", "", `[Staff] ${p.name}`,
    p.revenue.toFixed(2),
    "",
    `${p.transactions} transaction${p.transactions !== 1 ? "s" : ""}`,
  ]);

  const header = ["Date", "Time", "Description", "Amount", "Order Type", "Staff / Notes"];
  const sep = [[""], ["--- Staff Summary ---"], ...staffRows.map((r) => r)];
  const csv = [header, ...salesRows, [], ...sep]
    .map((row) => (Array.isArray(row) ? row.map(escape).join(",") : ""))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reports-${safeLabel}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV downloaded.", "success");
};

const controlExportReportsPDF = function () {
  if (!_reportSnapshot) { showToast("No data to export for this period.", "info"); return; }
  const { sales, staff, periodLabel } = _reportSnapshot;
  if (!sales.length) { showToast("No data to export for this period.", "info"); return; }

  const summary = _computeReportsSummary();
  const topItems = _computeTopItems(10);

  const fmt = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtServ = (v) => {
    if (v == null) return "—";
    const m = Math.floor(v), s = Math.round((v - m) * 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const esc = (v) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const captureChart = (wrapId, canvasId) => {
    const wrap = document.querySelector(`#${wrapId}`);
    if (!wrap || wrap.classList.contains("hidden")) return null;
    const canvas = document.querySelector(`#${canvasId}`);
    if (!canvas || canvas.style.display === "none") return null;
    try { return canvas.toDataURL("image/png"); } catch { return null; }
  };

  const charts = {
    revenue:     captureChart("rpRevenueWrap",      "rpRevenueCanvas"),
    category:    captureChart("rpCategoryWrap",     "rpCategoryCanvas"),
    hourly:      captureChart("rpHourlyWrap",       "rpHourlyCanvas"),
    dow:         captureChart("rpDowWrap",          "rpDowCanvas"),
    servHour:    captureChart("rpServingHourWrap",  "rpServingHourCanvas"),
    servDay:     captureChart("rpServingDayWrap",   "rpServingDayCanvas"),
  };

  // ── Compare mode PDF ──────────────────────────────────────────────────
  if (_compareModeActive && _cmpSalesA && _cmpSalesB) {
    const sA = _computeSummaryFromSales(_cmpSalesA);
    const sB = _computeSummaryFromSales(_cmpSalesB);
    const labelA = _cmpRangeA?.label ?? "Period A";
    const labelB = _cmpRangeB?.label ?? "Period B";
    const topA = _computeTopItemsFromSales(_cmpSalesA, 8, "revenue");
    const topB = _computeTopItemsFromSales(_cmpSalesB, 8, "revenue");
    const cmpChart = captureChart("rpCompareResults", "rpCmpRevenueCanvas");
    const now2 = new Date();
    const eDate = now2.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const eTime = now2.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const deltaCell = (a, b, invert = false) => {
      if (a == null || b == null || b === 0) return `<td class="td-num td-muted">—</td>`;
      const pct = Math.round(((a - b) / b) * 100);
      const good = invert ? pct <= 0 : pct >= 0;
      const arrow = pct >= 0 ? "↑" : "↓";
      const col = good ? "#16a34a" : "#dc2626";
      return `<td class="td-num" style="color:${col};font-weight:600">${arrow} ${Math.abs(pct)}%</td>`;
    };

    const kpiCard = (label, rawA, rawB, fmtA, fmtB, invert = false) => {
      let aWins = false, bWins = false;
      if (rawA != null && rawB != null) {
        aWins = invert ? rawA < rawB : rawA > rawB;
        bWins = invert ? rawB < rawA : rawB > rawA;
      }
      let badge = "";
      if (rawA != null && rawB != null && rawB !== 0) {
        const pct = Math.round(((rawA - rawB) / rawB) * 100);
        const good = invert ? pct <= 0 : pct >= 0;
        const arrow = pct >= 0 ? "↑" : "↓";
        badge = `<span class="delta-pill ${good ? "delta-up" : "delta-dn"}">${arrow} ${Math.abs(pct)}%</span>`;
      }
      const bCls = bWins ? "kv-b kv-b--win" : (rawA != null && rawB != null && rawA !== rawB ? "kv-b kv-b--lose" : "kv-b kv-b--tie");
      return `<div class="kpi-card">
        <div class="kpi-lbl">${label}</div>
        <div class="kpi-row"><span class="dot-a"></span><span class="kv-a">${fmtA}</span>${badge}</div>
        <div class="kpi-row" style="margin-top:5px"><span class="dot-b"></span><span class="${bCls}">${fmtB}</span></div>
      </div>`;
    };

    const cmpHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<title>Pointbunny Comparison — ${esc(labelA)} vs ${esc(labelB)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111827;font-size:10.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:13mm 16mm}
.pdf-header{background:#22c55e;border-radius:14px;padding:20px 24px;color:#fff;display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pdf-logo{font-size:20pt;font-weight:800;letter-spacing:-0.02em}
.pdf-period{font-size:10pt;opacity:.85;margin-top:3px}
.pdf-meta{text-align:right;font-size:8.5pt;opacity:.8;line-height:1.7}
.section-heading{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#22c55e;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #dcfce7}
.table-wrap{border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:18px;break-inside:avoid}
table{width:100%;border-collapse:collapse;font-size:8.5pt}
th{background:#f9fafb;padding:8px 10px;text-align:left;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1.5px solid #e5e7eb}
td{padding:8px 10px;border-bottom:1px solid #f3f4f6;color:#374151}
tr:last-child td{border-bottom:none}
.td-num{text-align:right;font-variant-numeric:tabular-nums}
.td-muted{color:#9ca3af}
.td-metric{font-weight:600;color:#111827;width:110px}
.dot-a{display:inline-block;width:9px;height:9px;border-radius:50%;background:#22c55e;flex-shrink:0}
.dot-b{display:inline-block;width:9px;height:9px;border-radius:50%;background:#3b82f6;flex-shrink:0}
.kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:18px}
.kpi-card{border:1.5px solid #e5e7eb;border-radius:12px;padding:14px 16px;break-inside:avoid}
.kpi-lbl{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;margin-bottom:10px}
.kpi-row{display:flex;align-items:center;gap:8px}
.kv-a{font-size:14pt;font-weight:700;line-height:1;color:#16a34a;font-variant-numeric:tabular-nums}
.kv-b{font-size:13pt;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
.kv-b--win{color:#16a34a}.kv-b--lose{color:#dc2626}.kv-b--tie{color:#6b7280}
.delta-pill{display:inline-flex;align-items:center;gap:2px;font-size:7.5pt;font-weight:700;padding:2px 7px;border-radius:6px;line-height:1.5}
.delta-up{background:#dcfce7;color:#16a34a}
.delta-dn{background:#fee2e2;color:#dc2626}
.chart-wrap{border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:18px}
.chart-label{padding:9px 13px;border-bottom:1px solid #f3f4f6;font-size:8pt;font-weight:600;color:#374151;background:#f9fafb}
.chart-wrap img{width:100%;display:block}
.top-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
.top-card{border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden}
.top-card th,.top-card td{padding:7px 10px}
.pdf-footer{margin-top:14px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:7.5pt;color:#9ca3af;text-align:center}
.period-legend{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:9px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:8.5pt;color:#374151;background:#f9fafb}
.period-lbl{font-weight:600;color:#374151}
.period-sep{color:#9ca3af;margin:0 4px}
.period-tag{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border-radius:4px;line-height:1.6}
.period-tag-a{background:#dcfce7;color:#16a34a}
.period-tag-b{background:#dbeafe;color:#2563eb}
</style></head><body>

<div class="pdf-header">
  <div>
    <div class="pdf-logo">Pointbunny</div>
    <div class="pdf-period">Comparison Report</div>
  </div>
  <div class="pdf-meta"><div>${eDate}</div><div>${eTime}</div></div>
</div>

<div class="period-legend">
  <span class="dot-a"></span><span class="period-tag period-tag-a">A</span><span class="period-lbl">${esc(labelA)}</span>
  <span class="period-sep">vs</span>
  <span class="dot-b"></span><span class="period-tag period-tag-b">B</span><span class="period-lbl">${esc(labelB)}</span>
</div>

<div class="section-heading">KPI Summary</div>
<div class="kpi-grid">
  ${kpiCard("Gross Income",  sA.revenue,           sB.revenue,           fmt(sA.revenue),               fmt(sB.revenue))}
  ${kpiCard("Transactions",  sA.transactions,      sB.transactions,      String(sA.transactions),       String(sB.transactions))}
  ${kpiCard("Avg. Order",    sA.avgOrder,          sB.avgOrder,          fmt(sA.avgOrder),              fmt(sB.avgOrder))}
  ${kpiCard("Avg. Serving",  sA.avgServingMinutes, sB.avgServingMinutes, fmtServ(sA.avgServingMinutes), fmtServ(sB.avgServingMinutes), true)}
</div>

${cmpChart ? `<div class="section-heading">Gross Income Over Time</div>
<div class="chart-wrap"><div class="chart-label">${esc(labelA)} vs ${esc(labelB)}</div><img src="${cmpChart}" alt="Compare chart"/></div>` : ""}

<div class="section-heading">Top Items by Gross Income</div>
<div class="top-grid">
  <div class="top-card"><table>
    <thead><tr><th><span class="dot-a"></span>${esc(labelA)}</th><th class="td-num">Gross Income</th></tr></thead>
    <tbody>${topA.map(i => `<tr><td>${esc(i.name)}</td><td class="td-num">${fmt(i.revenue)}</td></tr>`).join("") || '<tr><td colspan="2" class="td-muted" style="text-align:center;padding:14px">No data</td></tr>'}</tbody>
  </table></div>
  <div class="top-card"><table>
    <thead><tr><th><span class="dot-b"></span>${esc(labelB)}</th><th class="td-num">Gross Income</th></tr></thead>
    <tbody>${topB.map(i => `<tr><td>${esc(i.name)}</td><td class="td-num">${fmt(i.revenue)}</td></tr>`).join("") || '<tr><td colspan="2" class="td-muted" style="text-align:center;padding:14px">No data</td></tr>'}</tbody>
  </table></div>
</div>

<div class="pdf-footer">Pointbunny POS &nbsp;·&nbsp; ${esc(labelA)} vs ${esc(labelB)} &nbsp;·&nbsp; Exported ${eDate} at ${eTime}</div>
</body></html>`;

    const pop = window.open("", "pointbunny-pdf-report", "width=960,height=720");
    if (!pop) { showToast("Pop-up blocked. Allow pop-ups for this site to export PDF.", "error"); return; }
    pop.document.write(cmpHtml);
    pop.document.close();
    pop.focus();
    setTimeout(() => pop.print(), 700);
    return;
  }

  // ── Regular mode PDF ──────────────────────────────────────────────────
  const chartBlock = (img, label, full = false) => !img ? "" : `
    <div class="chart-block${full ? " chart-block--full" : ""}">
      <div class="chart-label">${label}</div>
      <img src="${img}" alt="${label}"/>
    </div>`;

  const topItemsRows = topItems.map((item, i) => `
    <tr>
      <td class="td-rank">${i + 1}</td>
      <td>${esc(item.name)}</td>
      <td class="td-num">${item.quantity}</td>
      <td class="td-num">${fmt(item.revenue)}</td>
    </tr>`).join("");

  const staffRows = staff.map(p => `
    <tr>
      <td>${esc(p.name)}</td>
      <td class="td-num">${p.transactions}</td>
      <td class="td-num">${fmt(p.revenue)}</td>
      <td class="td-num">${fmt(p.transactions > 0 ? p.revenue / p.transactions : 0)}</td>
    </tr>`).join("");

  const salesRows = sales.slice(0, 50).map(s => `
    <tr>
      <td>${esc(fmtDate(s.sale_date))}</td>
      <td>${esc(fmtTime(s.sale_date))}</td>
      <td>${esc((s.items ?? []).map(i => `${i.itemName} ×${i.quantity}`).join(", "))}</td>
      <td class="td-num">${fmt(s.total_price)}</td>
      <td>${esc(s.order_type ?? "—")}</td>
      <td>${esc(s.added_by ?? "—")}</td>
    </tr>`).join("");

  const now = new Date();
  const exportDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const exportTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Pointbunny Report — ${esc(periodLabel)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111827;font-size:10.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:13mm 16mm}
.pdf-header{background:#22c55e;border-radius:14px;padding:20px 24px;color:#fff;display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pdf-logo{font-size:20pt;font-weight:800;letter-spacing:-0.02em}
.pdf-period{font-size:10pt;opacity:.85;margin-top:3px}
.pdf-meta{text-align:right;font-size:8.5pt;opacity:.8;line-height:1.7}
.kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.kpi-card{border:1.5px solid #e5e7eb;border-radius:12px;padding:13px 15px}
.kpi-label{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;margin-bottom:6px}
.kpi-val{font-size:15pt;font-weight:700;color:#111827;line-height:1;font-variant-numeric:tabular-nums}
.section-heading{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#22c55e;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #dcfce7}
.charts-area{margin-bottom:18px}
.charts-row{display:grid;gap:10px;margin-bottom:10px}
.charts-row--2{grid-template-columns:1fr 1fr}
.charts-row--1{grid-template-columns:1fr}
.chart-block{border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;break-inside:avoid}
.chart-label{padding:8px 13px;border-bottom:1px solid #f3f4f6;font-size:8pt;font-weight:600;color:#374151;background:#f9fafb}
.chart-block img{width:100%;display:block}
.table-wrap{border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:18px;break-inside:avoid}
table{width:100%;border-collapse:collapse;font-size:8.5pt}
th{background:#f9fafb;padding:8px 10px;text-align:left;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1.5px solid #e5e7eb}
td{padding:7px 10px;border-bottom:1px solid #f3f4f6;color:#374151}
tr:last-child td{border-bottom:none}
.td-num{text-align:right;font-variant-numeric:tabular-nums}
.td-rank{color:#9ca3af;font-weight:600;width:28px}
.pdf-footer{margin-top:14px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:7.5pt;color:#9ca3af;text-align:center}
</style>
</head>
<body>

<div class="pdf-header">
  <div>
    <div class="pdf-logo">Pointbunny</div>
    <div class="pdf-period">${esc(periodLabel)}</div>
  </div>
  <div class="pdf-meta">
    <div>${exportDate}</div>
    <div>${exportTime}</div>
  </div>
</div>

<div class="kpi-strip">
  <div class="kpi-card"><div class="kpi-label">Gross Income</div><div class="kpi-val">${fmt(summary.revenue)}</div></div>
  <div class="kpi-card"><div class="kpi-label">Transactions</div><div class="kpi-val">${summary.transactions}</div></div>
  <div class="kpi-card"><div class="kpi-label">Avg. Order</div><div class="kpi-val">${fmt(summary.avgOrder)}</div></div>
  <div class="kpi-card"><div class="kpi-label">Avg. Serving</div><div class="kpi-val">${fmtServ(summary.avgServingMinutes)}</div></div>
</div>

${charts.revenue ? `<div class="section-heading">Charts</div><div class="charts-area">
  <div class="charts-row charts-row--1">${chartBlock(charts.revenue, "Gross Income Over Time")}</div>
  <div class="charts-row charts-row--2">${chartBlock(charts.category, "Category Mix")}${chartBlock(charts.hourly, "Hourly Breakdown")}</div>
  ${(charts.dow || charts.servHour || charts.servDay) ? `<div class="charts-row charts-row--2">${chartBlock(charts.dow, "Day of Week")}${chartBlock(charts.servHour, "Avg. Serving by Hour")}</div>` : ""}
  ${charts.servDay ? `<div class="charts-row charts-row--1">${chartBlock(charts.servDay, "Avg. Serving by Day")}</div>` : ""}
</div>` : ""}

<div class="section-heading">Top Items</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>#</th><th>Item</th><th class="td-num">Qty Sold</th><th class="td-num">Gross Income</th></tr></thead>
    <tbody>${topItemsRows || '<tr><td colspan="4" style="color:#9ca3af;text-align:center;padding:16px">No item data</td></tr>'}</tbody>
  </table>
</div>

${staff.length ? `<div class="section-heading">Staff Performance</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>Cashier</th><th class="td-num">Transactions</th><th class="td-num">Gross Income</th><th class="td-num">Avg. Order</th></tr></thead>
    <tbody>${staffRows}</tbody>
  </table>
</div>` : ""}

<div class="section-heading">Transactions ${sales.length > 50 ? "(showing first 50)" : ""}</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>Date</th><th>Time</th><th>Items</th><th class="td-num">Total</th><th>Type</th><th>Cashier</th></tr></thead>
    <tbody>${salesRows}</tbody>
  </table>
</div>

<div class="pdf-footer">Pointbunny POS &nbsp;·&nbsp; ${esc(periodLabel)} &nbsp;·&nbsp; Exported ${exportDate} at ${exportTime}</div>

</body>
</html>`;

  const popup = window.open("", "pointbunny-pdf-report", "width=960,height=720");
  if (!popup) { showToast("Pop-up blocked. Allow pop-ups for this site to export PDF.", "error"); return; }
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 700);
};

const _renderReportsData = async function (period, startISO, endISO, label, prevTotals, vsLabel) {
  ReportsView.setPeriodLabel(label);
  const summary = _computeReportsSummary();
  ReportsView.renderSummary(summary);
  if (prevTotals) ReportsView.renderComparison(summary, prevTotals, vsLabel);
  const topItems   = _computeTopItems();
  const categoryMix = _computeCategoryMix();
  const staff      = _computeStaffPerformance();
  ReportsView.renderTopItems(topItems, _topItemsSortKey);
  ReportsView.renderStaff(staff, _staffSortKey);
  ReportsView.renderSalesKpis({
    bestSeller:  topItems[0]   ?? null,
    topCategory: categoryMix[0] ?? null,
    topStaff:    staff[0]      ?? null,
  });
  const expSummary = _reportsExpenseSummary();
  const avgDivisor = _getAvgDivisor(period, startISO, endISO);
  const avgSuffix  = _getAvgUnitSuffix(period);
  const avgTooltip = _getAvgTooltip(period, avgDivisor);
  ReportsView.renderExpenseKpis({
    ...expSummary,
    avgGross: expSummary.gross / avgDivisor,
    avgNet:   expSummary.net   / avgDivisor,
    avgSuffix,
    avgTooltip,
  });
  _reportSnapshot = { sales: modelState.reportsSales, staff, periodLabel: label };
  _selectedOverviewMetrics = new Set();
  _overviewTimeSeries = _computeAllTimeSeries(period, startISO, endISO);
  ReportsView.renderTrafficKpis(_computeTrafficPeaks(period, startISO, endISO));
  await ReportsView.renderCharts({
    categoryMix,
    itemMix:         topItems,
    hourlyBreakdown: _computeHourlyBreakdown(),
    dayOfWeek:       _computeDayOfWeek(period),
    servingTime:     _computeServingTimeStats(),
  });
  await _renderOverviewChart();
};

const controlOpenReports = async function (section = "overview") {
  ReportsView.open();
  ReportsView.preloadChart(); // eagerly start compiling the chart.js chunk while data fetches
  ReportsView.renderLoading();
  _currentReportsPeriod = { period: "today" };
  try {
    const { startISO, endISO, label } = _getCashflowRange("today");
    const { prevStart, prevEnd, vsLabel } = _getPreviousPeriodRange("today", startISO, endISO);
    await Promise.all([
      model.fetchReportsSales(startISO, endISO),
      model.fetchPeriodTotals(prevStart, prevEnd).then(pt => { _currentPrevTotals = pt; }),
      model.fetchCashflowData(startISO, endISO),
    ]);
    await _renderReportsData("today", startISO, endISO, label, _currentPrevTotals, vsLabel);
    if (section !== "overview") ReportsView._switchSection(section);
  } catch (err) {
    showToast(err.message ?? err);
  }
};

const controlCloseReports = function () {
  if (_compareModeActive) { _compareModeActive = false; ReportsView.exitCompareMode(); }
  ReportsView.close();
};

const controlReportsPeriodChange = async function ({ period, from, to }) {
  ReportsView.renderLoading();
  _currentReportsPeriod = { period, from, to };
  try {
    const { startISO, endISO, label } = _getCashflowRange(period, from, to);
    const { prevStart, prevEnd, vsLabel } = _getPreviousPeriodRange(period, startISO, endISO, from, to);
    await Promise.all([
      model.fetchReportsSales(startISO, endISO),
      model.fetchPeriodTotals(prevStart, prevEnd).then(pt => { _currentPrevTotals = pt; }),
      model.fetchCashflowData(startISO, endISO),
    ]);
    await _renderReportsData(period, startISO, endISO, label, _currentPrevTotals, vsLabel);
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
  SettingsView._addHandlerNavTabs();
  SettingsView._addHandlerSaveBusinessInfo(controlSaveBusinessInfo);
  SettingsView._addHandlerGenerateTimeclockToken(controlGenerateTimeclockToken);
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
  SettingsView._addHandlerToggleOrderType(controlToggleOrderType);

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
  CashflowView._addHandlerVoid(controlVoidTransaction);
  CashflowView._addHandlerTabChange();
  CashflowView._addHandlerOverrideModal();

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
  KDSView._addHandlerOpenModal(() => modelState.orderQueue);
  KDSView._addHandlerModalClose();
  KDSView._addHandlerModalDone(controlMarkOrderDone);
  SettingsView._addHandlerKDSThresholds(controlSaveKDSThresholds);
  SettingsView._addHandlerDisplaySizes(controlSaveKDSWindowSize, controlSaveCFDWindowSize);
  SettingsView._addHandlerCFDAdUpload(controlUploadCFDAd);
  SettingsView._addHandlerCFDAdRemove(controlRemoveCFDAd);
  // Support
  SupportView._addHandlerOpen(controlOpenSupport);
  SupportView._addHandlerClose();
  SupportView._addHandlerNewTicket(() => SupportView.showNewTicketPanel());
  SupportView._addHandlerCloseNewTicket(() => { SupportView.closeNewTicketModal(); SupportView.resetTicketForm(); });
  SupportView._addHandlerBackToList(() => SupportView.showListPanel());
  SupportView._addHandlerTicketClick(controlOpenTicket);
  SupportView._addHandlerMarkSolved(controlMarkTicketSolved);
  SupportView._addHandlerSubmitTicket(controlSubmitTicket);
  SupportView._addHandlerSendReply(controlSendReply);
  SupportView._addHandlerSubmitRating(controlSubmitRating);
  SupportView._addHandlerStarInteraction();
  SupportView._addHandlerTicketFiles();
  const kdsWindowBtn = document.getElementById('kdsWindowBtn');
  const cfdWindowBtn = document.getElementById('cfdWindowBtn');
  kdsWindowBtn?.classList.remove('hidden');
  cfdWindowBtn?.classList.remove('hidden');
  kdsWindowBtn?.addEventListener('click', controlOpenKDSWindow);
  cfdWindowBtn?.addEventListener('click', controlOpenCFDWindow);

  // Receipt Adjustments Panel
  DiscountView._addHandlerOpen(controlOpenDiscounts);
  DiscountView._addHandlerClose(controlCloseDiscounts);
  DiscountView._addHandlerNavTabs();
  // Promo codes
  DiscountView._addHandlerNewCode(controlNewDiscountCode);
  DiscountView._addHandlerSave(controlSaveDiscountCode);
  DiscountView._addHandlerEdit(controlEditDiscountCode);
  DiscountView._addHandlerDelete(controlDeleteDiscountCode);
  DiscountView._addHandlerToggleStatus(controlToggleDiscountStatus);
  // Auto adjustments (panel)
  DiscountView._addHandlerAdjAdd();
  DiscountView._addHandlerAdjSave(controlSaveAdjustment);
  DiscountView._addHandlerAdjEdit(controlEditAdjFromPanel);
  DiscountView._addHandlerAdjDelete(controlDeleteAdjustment);
  DiscountView._addHandlerAdjToggle(controlToggleAdjustment);

  // Today's Sales stat card → open Reports on Sales section
  const salesStatCard = document.querySelector(".home-sales-stat");
  if (salesStatCard) {
    salesStatCard.addEventListener("click", () => controlOpenReports("sales"));
    salesStatCard.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); controlOpenReports("sales"); } });
  }

  // Transactions stat card → open Reports on Traffic section
  const transactionsCard = document.querySelector("#transactionsCard");
  if (transactionsCard) {
    transactionsCard.addEventListener("click", () => controlOpenReports("traffic"));
    transactionsCard.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); controlOpenReports("traffic"); } });
  }

  // Avg. Serving stat → open Reports on Kitchen section
  const servingStatEl = document.querySelector(".home-dash-stat--serving");
  if (servingStatEl) {
    servingStatEl.addEventListener("click", () => controlOpenReports("kitchen"));
    servingStatEl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); controlOpenReports("kitchen"); } });
  }

  // Reports
  ReportsView._addHandlerOpen(controlOpenReports);
  ReportsView._addHandlerClose(controlCloseReports);
  ReportsView._addHandlerPeriodChange(controlReportsPeriodChange);
  ReportsView._addHandlerCustomRange(controlReportsPeriodChange);
  ReportsView._addHandlerExport(controlExportReports, controlExportReportsPDF);
  ReportsView._addHandlerCompareToggle(controlToggleCompare);
  ReportsView._addHandlerRunComparison(controlRunComparison);
  ReportsView._addHandlerCmpTopItemsSort(controlCmpSortTopItems);
  ReportsView._addHandlerTopItemsSort(controlSortTopItems);
  ReportsView._addHandlerStaffSort(controlSortStaff);
  ReportsView._addHandlerInfoTooltips();
  ReportsView._addHandlerSections();
  ReportsView._addHandlerKpiToggle(controlToggleMetric);

  // Cashier switcher
  document.getElementById('cashierCard')?.addEventListener('click', controlSwitchCashier);

  // Staff
  StaffView._addHandlerOpen(controlOpenStaff);
  StaffView._addHandlerClose(controlCloseStaff);
  StaffView._addHandlerInvite(controlShowInviteForm);
  StaffView._addHandlerSaveInvite(controlInviteStaff);
  StaffView._addHandlerRemove(controlRemoveStaff);
  StaffView._addHandlerEditRole(controlEditStaffRole);
  StaffView._addHandlerSetPin(controlSetStaffPin);
  StaffView._addHandlerPayrollTab(() => {
    const d = new Date();
    controlFetchTimesheets('week', `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  });
  StaffView._addHandlerTimesheetPeriod(controlFetchTimesheets);
  StaffView._addHandlerSaveShift(controlSaveShift);
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
    _maybeShowPinSetup();
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
