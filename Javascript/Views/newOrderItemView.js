import View from "./view.js";

class NewOrderItemView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _itemModal = document.querySelector(".item-modal-overlay");
  _itemModalCloseBtn = document.querySelector(".item-modal-close");
  _quantityBtn = document.querySelector(".quantity-buttons");
  _basket;
  _qty = 1;

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
    this._itemModal.querySelector(".item-price").textContent = `₱${item.price}`;

    this._basket = {
      itemName: item.itemName,
      price: item.price,
      category: item.category,
      id: item._id,
      date: Date.now(),
      quantity: "",
      totalPrice: "",
    };
  }

  _closeItemModal() {
    this._itemModalCloseBtn.addEventListener("click", function (e) {
      document.querySelector(".item-modal-overlay").classList.toggle("hidden");
    });
  }

  _pushToCart(handler) {
    this._itemModal.addEventListener("click", (e) => {
      e.preventDefault();
      const btn = e.target.closest("#btn-add-to-cart");
      if (btn) {
        handler();
        document
          .querySelector(".item-modal-overlay")
          .classList.toggle("hidden");

        this._qty = 1;
        document.getElementById("item-qty").textContent = this._qty;
      } else if (!btn) {
        return;
      }
    });
  }

  _adjustQuantity() {
    this._quantityBtn.addEventListener("click", (e) => {
      const btn = e.target.closest(".qty-btn");
      if (!btn) return;
      if (btn.dataset.action === "increase") {
        this._qty++;
        document.getElementById("item-qty").textContent = this._qty;
      }
      if (btn.dataset.action === "decrease") {
        this._qty >= 2 ? this._qty-- : (this._qty = 1);
        document.getElementById("item-qty").textContent = this._qty;
      }
      console.log(this._qty);
    });
  }
}

export default new NewOrderItemView();
