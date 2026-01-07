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

        ${this._data
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
            <div style="display:flex; justify-content:space-between;">
              <span>Espresso x1</span>
              <span>₱120</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Latte x2</span>
              <span>₱300</span>
            </div>
          </div>
          <div style="margin-top:auto; font-weight:900; font-size:1.1rem; display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid var(--line);">
            <span>Total:</span>
            <span>₱420</span>
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

  _closeItemModal() {
    this._parentElement.addEventListener("click", function (e) {
      const btn = e.target.closest(".item-modal-close");
      if (!btn) return;

      btn.closest(".item-modal-overlay").remove();
    });
  }
}

export default new NewOrderView();
