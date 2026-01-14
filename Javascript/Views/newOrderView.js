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
      ${this._data.menuCategories
        .map((category) => {
          const items = this._data.menuItems.filter(
            (item) => item.category === category
          );
          return `
            <div class="menu-category-header">${category}</div>
            <div class="menu-category">
              ${items
                .map(
                  (item) => `
                    <div class="item-card" data-id="${item._id}">
                      <div class="btn-main">
                        <img src="${item.imageURL}" alt="${item.itemName}" />
                        <div>
                          <div class="title">${item.itemName}</div>
                          <div class="hint">${item.price}</div>
                        </div>
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          `;
        })
        .join("")}
    </div>

    <!-- Right Panel: Cart Summary -->
    <div class="modal-right">
      <h3 class="form-title">Cart Summary</h3>

      <div
        id="cartItems"
        style="display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow-y:auto;"
      >
        ${this._data.cart
          .map(
            (item) => `
              <div style="display:flex; justify-content:space-between;">
                <span>${item.itemName} x${item.quantity}</span>
                <span>₱${item.price * item.quantity}</span>
              </div>
            `
          )
          .join("")}
      </div>

      <div
        style="margin-top:auto; font-weight:900; font-size:1.1rem;
               display:flex; justify-content:space-between;
               padding-top:8px; border-top:1px solid var(--line);"
      >
        <span>Total:</span>
        <span>
          ₱${this._data.cart.reduce((acc, item) => acc + item.totalPrice, 0)}
        </span>
      </div>

      <button class="btn-checkout">Checkout</button>
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
