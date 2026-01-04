import View from "./view.js";

class NewOrderView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _openBtn = document.getElementById("#newOrderBtn");
  _itemCard = document.querySelector(".modal-parent").closest(".card");

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
            <div class="item-card" id="${menu.id}">
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

  _addToCart(handler) {
    this._parentElement.addEventListener("click", function (e) {
      const item = e.target.closest(".item-card");
      if (!item) return;
      console.log(item);

      handler();
    });
  }

  _generateMenuItemModal(item) {
    const markup = `<!-- ================= Item Modal ================= -->
<div class="item-modal-overlay" id="itemModal">
  <div class="modal-content">
    <!-- Close Button -->
    <button class="item-modal-close">&times;</button>

    <!-- Left Panel: Item Info / Preview -->
    <div class="modal-left">
      <h2 class="menu-category-header">Item Details</h2>
      
      <div class="item-card">
        <div class="btn-main">
          <img src="" alt="Item Image" />
          <div>
            <div class="title">Sample Item</div>
            <div class="hint">Category: Drinks</div>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <div class="chip">Small</div>
        <div class="chip">Medium</div>
        <div class="chip">Large</div>
      </div>

      <p class="hint" style="margin-top: 12px;">This is a sample description of the menu item. You can add more details here.</p>
    </div>

    <!-- Right Panel: Form / Actions -->
    <div class="modal-right">
      <form class="add-menu-form">
        <div class="form-title">Edit Item</div>

        <label>
          Name
          <input type="text" placeholder="Item Name" />
        </label>

        <label>
          Price
          <input type="number" placeholder="0.00" />
        </label>

        <label class="category-wrapper">
          Category
          <select>
            <option>Drinks</option>
            <option>Food</option>
            <option>Dessert</option>
          </select>
        </label>

        <label class="file-upload-label">
          Upload Image
          <input type="file" />
          <span class="file-upload-btn">Choose File</span>
          <span class="file-upload-name">No file chosen</span>
        </label>

        <button type="submit">Save Changes</button>
      </form>
    </div>
  </div>
</div>
`;
    document
      .querySelector(".modal-parent")
      .insertAdjacentHTML("beforeend", markup);
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

      const allItemModals = document.querySelectorAll(".item-modal-overlay");
      allItemModals.forEach((modal) => {
        modal.classList.remove();
      });

      btn.closest(".item-modal-overlay").remove();
    });
  }
}

export default new NewOrderView();
