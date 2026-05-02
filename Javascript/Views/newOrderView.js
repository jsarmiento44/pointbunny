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
      ${this._data.menuItems.length === 0
        ? `<p class="no-items-msg">No items yet. Go to menu list and add a new item.</p>`
        : this._data.menuCategories
            .map((category) => {
              const items = this._data.menuItems.filter(
                (item) => item.category === category && item.status !== "inactive",
              );
              if (items.length === 0) return "";
              return `
                <div class="menu-category-header">${category}</div>
                <div class="menu-category">
                  ${items
                    .map((item) => {
                      const unavailable = item.status === "unavailable";
                      return `
                        <div class="item-card${unavailable ? " item-card--unavailable" : ""}" data-id="${item._id}">
                          <div class="btn-main">
                            <img src="${item.imageURL}" alt="${item.itemName}" />
                            <div>
                              <div class="title">${item.itemName}</div>
                              <div class="hint">₱${item.price}</div>
                            </div>
                          </div>
                        </div>
                      `;
                    })
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
          .map((item, index) => {
            const allVariants = item.selectedVariants.map((v) => v.variantName);
            return `
            <div class="cart-item-row">
              <div style="display:flex; flex-direction:column;">
                <span>${item.itemName} x${item.quantity}</span>
                <span style="font-size:0.85rem; opacity:0.7;">${allVariants.join(", ")}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span>₱${item.totalPrice}</span>
                <button class="cart-item-delete-btn" data-cart-index="${index}" type="button">&times;</button>
              </div>
            </div>`;
          })
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

  _addHandlerDeleteCartItem(handler) {
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest(".cart-item-delete-btn");
      if (!btn) return;
      handler(Number(btn.dataset.cartIndex));
    });
  }

  _addHandlerShowMenuModal(handler) {
    this._openBtn.addEventListener("click", function (e) {
      e.preventDefault();
      handler();
    });
  }

  _addHandlerCloseModal(handler) {
    this._parentElement.addEventListener("click", function (e) {
      const btn = e.target.closest(".modal-close");
      if (!btn) return;
      handler();

      document.querySelector(".modal-overlay").classList.toggle("hidden");
    });
  }
}

export default new NewOrderView();
