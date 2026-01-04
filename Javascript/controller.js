import NewOrderView from "./Views/newOrderView.js";
import * as model from "./model.js";
import MenuListView from "./Views/menuListView.js";
import NewMenuItemView from "./Views/newMenuItemView.js";

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
const controlUploadItem = function (data) {
  MenuListView.renderSpinner();
  model.uploadNewMenuItem(data);
  MenuListView.render(model.state);
};

const controlNewOrder = async function () {
  try {
    NewOrderView.render(model.state.menuItems);
    NewOrderView._addToCart(NewOrderView._generateMenuItemModal);
  } catch (err) {
    alert(err);
  }
};

const controlNewOrderModals = async function () {
  NewOrderView._closeItemModal();
  NewOrderView._closeMenuModal();
};

const init = function () {
  MenuListView._addHandlerShowModal(controlMenuList);
  NewMenuItemView._uploadItem(controlUploadItem);
  controlNewMenuButtonToggle();
  NewOrderView._addHandlerShowMenuModal(controlNewOrder);
  controlNewOrderModals();
};

init();
