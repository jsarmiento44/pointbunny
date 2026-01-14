import NewOrderView from "./Views/newOrderView.js";
import * as model from "./model.js";
import MenuListView from "./Views/menuListView.js";
import NewMenuItemView from "./Views/newMenuItemView.js";
import NewOrderItemView from "./Views/newOrderItemView.js";
import OrderCheckOutView from "./Views/orderCheckoutView.js";

const modelState = model.state;

//adding/displaying menu list

//to add edit/delete option
const controlMenuList = async function () {
  try {
    //1.)load menu list from backend/current account's menu list
    const state = model.state;
    if (state.menuItems.length < 1 || state.menuItems.length === 0)
      throw `no menu!`;
    //2.)Render menu list in UI
    MenuListView.render(state);
    //3.) Listen for close event to hide modal
    MenuListView._addHandlerCloseModal();
    NewMenuItemView._mapMenuCategoriesMarkUp(state.menuCategories);
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
  MenuListView.renderSpinner();
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
  if (!NewOrderItemView._basket) {
    console.warn("No item selected yet");
    return;
  }
  NewOrderItemView._basket.quantity = NewOrderItemView._qty;
  NewOrderItemView._basket.totalPrice =
    Number(NewOrderItemView._basket.price) *
    Number(NewOrderItemView._basket.quantity);
  model.state.cart.push(NewOrderItemView._basket);
  NewOrderView.render(modelState);
};

//Listents to "checkout event" and wraps up transaction
const controlOrderCheckout = function () {
  try {
    if (model.state.cart.length === 0) throw `You must add an item to the cart`;
    OrderCheckOutView._totalPrice = modelState.cart.reduce(
      (acc, item) => acc + item.totalPrice,
      0
    );
    OrderCheckOutView.render(modelState);
  } catch (err) {
    alert(err);
  }
};

const controlCheckoutSubtractChange = function () {};

//listens to modal close button
const controlNewOrderModals = async function () {
  NewOrderItemView._closeItemModal();
  NewOrderView._closeMenuModal();
};

const init = function () {
  //MenuList
  MenuListView._addHandlerShowModal(controlMenuList);
  NewMenuItemView._uploadItem(controlUploadItem);
  NewMenuItemView._newMenuCategory();
  NewMenuItemView._addHandlerAddMenuCategory(controlAddNewCategory);
  controlNewMenuButtonToggle();

  //NewOrder
  NewOrderView._addHandlerShowMenuModal(controlNewOrder);
  NewOrderItemView._addHandlerShowItemModal(controlDisplayMenuItem);
  controlNewOrderModals();
  NewOrderItemView._pushToCart(controlPushToModelCart);
  NewOrderItemView._adjustQuantity();
  //New Order Check Out
  OrderCheckOutView._addHandlerShowCheckout(controlOrderCheckout);
  OrderCheckOutView._printReceipt();
  OrderCheckOutView._addHandlerSubtractChange();
};

init();
