import NewOrderView from "./Views/newOrderView.js";
import * as model from "./model.js";
import MenuListView from "./Views/menuListView.js";
import NewMenuItemView from "./Views/newMenuItemView.js";
import NewOrderItemView from "./Views/newOrderItemView.js";
import OrderCheckOutView from "./Views/orderCheckoutView.js";
import newMenuItemView from "./Views/newMenuItemView.js";
import MenuEditView from "./Views/menuEditView.js";
import SettingsView from "./Views/settingsView.js";
const modelState = model.state;
let item;
//adding/displaying menu list

//to add edit/delete option
const controlMenuList = async function () {
  try {
    const state = model.state;
    MenuListView.render(state);
    //3.) Listen for close event to hide modal
    MenuListView._addHandlerCloseModal();
    NewMenuItemView._mapMenuCategoriesMarkUp(state.menuCategories);
  } catch (err) {
    alert(err);
  }
};

const controlDeleteMenuItem = function (id) {
  try {
    model.deleteMenuItem(id);
    MenuListView.render(model.state);
  } catch (err) {
    alert(err.message);
  }
};

const controlShowEditMenu = async function (id) {
  try {
    item = model.state.menuItems.find((item) => item._id === id);
    const categories = model.state.menuCategories;

    MenuEditView._clear();
    MenuEditView._insertEditMenuMarkup(item);
    MenuEditView._mapMenuCategoriesMarkUp(categories, item.category);

    MenuEditView._updateItemData((data) => {
      model.updateMenuItem(item._id, data);

      const modal = document.querySelector(".item-modal-overlay");
      if (
        !modal.classList.contains("hidden") &&
        NewOrderItemView._basket?.id === item._id
      ) {
        // Only update the image smoothly
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
    alert(err);
  }
};

//adding new menu category
const controlAddNewCategory = function (data) {
  modelState.menuCategories.push(data);
  NewMenuItemView._mapMenuCategoriesMarkUp(modelState.menuCategories);
};

//listening for buttons to close/open new menu item
const controlNewMenuButtonToggle = function () {
  NewMenuItemView._toggleModalClose();
  NewMenuItemView._toggleModalOpen();
};

//listens to uploadItem form button
const controlUploadItem = function (data) {
  const invalidCategories = ["Select category", "new-category"];
  if (invalidCategories.includes(data.category)) {
    if (data.newCategory?.trim()) {
      data.category = data.newCategory.trim();
    } else {
      alert("Please select a valid category or enter a new one.");
      return;
    }
  }

  data.variants = newMenuItemView._addedVariants;
  model.uploadNewMenuItem(data);
  MenuListView.render(model.state);
};

//listens to new order button and renders the markup
const controlNewOrder = async function () {
  try {
    NewOrderView.render(modelState);
  } catch (err) {
    alert(err);
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
    alert(err);
  }
};

const controlConcludeTransaction = function () {
  try {
    if (modelState.cart.length <= 0) throw `Cart is empty!`;

    const sale = {
      items: [...modelState.cart],
      subtotal: OrderCheckOutView._subtotal ?? OrderCheckOutView._totalPrice,
      adjustments: [...model.state.currentReceiptAdjustments],
      totalPrice: OrderCheckOutView._totalPrice,
      customerPayment: OrderCheckOutView._customerPayment,
      customerChange: OrderCheckOutView._customerChange,
      date: Date.now(),
    };

    modelState.salesBasket.push(sale);

    clearCart();
    model.clearReceiptAdjustments();

    OrderCheckOutView._showSuccess();
    setTimeout(() => {
      OrderCheckOutView._hideModal();
      OrderCheckOutView._hideSuccess();
    }, 2000);
  } catch (err) {
    alert(err);
  }
};

const clearCart = function () {
  model.state.cart = [];
};

// ── Settings ──────────────────────────────────────────────────────────────────

const controlOpenSettings = function () {
  SettingsView.renderAdjustments(model.state.settings.adjustments);
  SettingsView.syncShowRemovedToggle(model.state.settings.showRemovedAdjustments);
};

const controlSaveAdjustment = function (data) {
  if (data.id) {
    model.updateAdjustment(data.id, data);
  } else {
    model.addAdjustment(data);
  }
  SettingsView.renderAdjustments(model.state.settings.adjustments);
};

const controlEditAdjustment = function (id) {
  const adj = model.state.settings.adjustments.find((a) => a.id === id);
  if (!adj) return;
  SettingsView.showForm(adj);
};

const controlDeleteAdjustment = function (id) {
  model.deleteAdjustment(id);
  SettingsView.renderAdjustments(model.state.settings.adjustments);
};

const controlToggleAdjustment = function (id) {
  model.toggleAdjustment(id);
  SettingsView.renderAdjustments(model.state.settings.adjustments);
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
  NewOrderView._addHandlerCloseModal(clearCart);
};

const init = function () {
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
  SettingsView._addHandlerAdd();
  SettingsView._addHandlerSave(controlSaveAdjustment);
  SettingsView._addHandlerEdit(controlEditAdjustment);
  SettingsView._addHandlerDelete(controlDeleteAdjustment);
  SettingsView._addHandlerToggle(controlToggleAdjustment);
  SettingsView._addHandlerShowRemoved(controlShowRemoved);

  //NewOrder
  NewOrderView._addHandlerShowMenuModal(controlNewOrder);
  NewOrderItemView._addHandlerShowItemModal(controlDisplayMenuItem);
  controlNewOrderModals();
  NewOrderItemView._pushToCart(controlPushToModelCart);
  NewOrderItemView._adjustQuantity();
  NewOrderView._addHandlerDeleteCartItem(controlDeleteCartItemInOrder);

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
};

init();
