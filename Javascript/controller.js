import NewOrderView from "./Views/newOrderView.js";
import * as model from "./model.js";
import MenuListView from "./Views/menuListView.js";
import NewMenuItemView from "./Views/newMenuItemView.js";
import NewOrderItemView from "./Views/newOrderItemView.js";

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
  } catch (err) {
    alert(err);
  }
};

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
    const menuItems = model.state.menuItems;
    NewOrderView.render(menuItems);
  } catch (err) {
    alert(err);
  }
};

const controlDisplayMenuItem = function (id) {
  const items = model.state.menuItems.find((item) => item._id === id);
  if (!items) return;
  console.log(items);
  NewOrderItemView._generateMenuItemModal(items);
};

//listens to modal close button
const controlNewOrderModals = async function () {
  NewOrderView._closeItemModal();
  NewOrderView._closeMenuModal();
};

const init = function () {
  //MenuList
  MenuListView._addHandlerShowModal(controlMenuList);
  NewMenuItemView._uploadItem(controlUploadItem);
  controlNewMenuButtonToggle();

  //NewOrder
  NewOrderView._addHandlerShowMenuModal(controlNewOrder);
  NewOrderItemView._addHandlerShowItemModal(controlDisplayMenuItem);
  controlNewOrderModals();
};

init();
