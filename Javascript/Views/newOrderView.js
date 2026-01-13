import View from "./view.js";

class NewOrderView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _openBtn = document.getElementById("#newOrderBtn");
  _modalParent = document.querySelector(".new-order-parent");

  _generateMarkUp() {
    return `
    <div class="modal-overlay" id="newOrderModal">
      <div class="modal-content">
        <!-- Close Button -->
        <button class="modal-close">&times;</button>
         <!-- Left Panel: Menu Items -->
        <div class="modal-left">

        ${this._data.menuItems
          .map(
            (menu) =>
              `<div class="menu-category-header">${menu.category}</div>
          <div class="menu-category">
            <div class="item-card" data-id="${menu._id}">
              <div class="btn-main">
                <img src="${menu.imageURL}" alt="Espresso" />
                <div>
                  <div class="title">${menu.itemName}</div>
                  <div class="hint">${menu.price}</div>
                </div>
              </div>
            </div>`
          )
          .join("")}
            <!-- end of left side div-->
          </div>
        </div>

        <!-- Right Panel: Cart Summary -->
        <div class="modal-right">
          <h3 class="form-title">Cart Summary</h3>
          <div id="cartItems" style="display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow-y:auto;">
            ${this._data.cart
              .map(
                (
                  item
                ) => `<div style="display:flex; justify-content:space-between;">
              <span>${item.itemName} x1</span>
              <span>${item.price}</span>
            </div>`
              )
              .join("")}
          </div>
          <div style="margin-top:auto; font-weight:900; font-size:1.1rem; display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid var(--line);">
            <span>Total:</span>
            <span>₱${
              this._data.cart.length <= 0
                ? ""
                : this._data.cart
                    .map((item) => Number(item.price))
                    .reduce((acc, cur) => {
                      acc + cur, 0;
                    })
            }</span>
          </div>
          <button>Checkout</button>
        </div>
      </div>
    </div>
  `;
  }

  _addHandlerShowMenuModal(handler) {
    this._openBtn.addEventListener("click", function (e) {
      e.preventDefault();
      handler();
    });
  }

  _closeMenuModal() {
    this._parentElement.addEventListener("click", function (e) {
      const btn = e.target.closest(".modal-close");
      if (!btn) return;

      document.querySelector(".modal-overlay").classList.toggle("hidden");
    });
  }
}

export default new NewOrderView();
