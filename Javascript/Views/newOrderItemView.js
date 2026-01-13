import View from "./view.js";

class NewOrderItemView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _itemModal = document.querySelector(".item-modal-overlay");
  _itemModalCloseBtn = document.querySelector(".item-modal-close");
  _basket;

  _addHandlerShowItemModal(handler) {
    this._parentElement.addEventListener("click", (e) => {
      e.preventDefault();
      const item = e.target.closest(".item-card");
      if (!item) return;
      handler(item.dataset.id);
      this._itemModal.classList.toggle("hidden");
    });
  }

  _itemModalContentUpdate(item) {
    this._itemModal.querySelector(".title").textContent = item.itemName;
    this._itemModal.querySelector(".hint").textContent = item.category;
    this._itemModal.querySelector(".item-price").textContent = item.price;

    if (this._basket === null || this._basket === "")
      console.warn("no item in basket");

    this._basket = {
      itemName: item.itemName,
      price: item.price,
      category: item.category,
      id: item._id,
      date: Date.now(),
    };
  }

  _closeItemModal() {
    this._itemModalCloseBtn.addEventListener("click", function (e) {
      document.querySelector(".item-modal-overlay").classList.toggle("hidden");
    });
  }

  _pushToCart(handler) {
    this._itemModal.addEventListener("click", function (e) {
      e.preventDefault();
      const btn = e.target.closest("#btn-add-to-cart");
      if (btn) {
        handler();
        document
          .querySelector(".item-modal-overlay")
          .classList.toggle("hidden");
      } else if (!btn) {
        return;
      }
    });
  }
}

export default new NewOrderItemView();
