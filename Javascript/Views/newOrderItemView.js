import View from "./view.js";

class NewOrderItemView extends View {
  _parentElement = document.querySelector(".modal-parent");

  _addHandlerShowItemModal(handler) {
    this._parentElement.addEventListener("click", (e) => {
      e.preventDefault();
      const item = e.target.closest(".item-card");
      if (!item) return;
      handler(item.dataset.id);
    });
  }

  _generateMenuItemModal(item) {
    const markup = `<div class="item-modal-overlay" id=${item._id}>
  <div class="modal-content">
    <!-- Close Button -->
    <button class="item-modal-close">&times;</button>

    <!-- Single Panel Item Info -->
    <div class="modal-left">
      <h2 class="menu-category-header">Item Details</h2>

      <div class="item-card">
        <div class="btn-main">
          <img src="${item.imageURL}" alt="Item Image" />
          <div>
            <div class="title">${item.itemName}</div>
            <div class="hint">Category: ${item.category}s</div>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <div class="chip">Small</div>
        <div class="chip">Medium</div>
        <div class="chip">Large</div>
      </div>

      <p class="hint" style="margin-top: 12px;">
        This is a sample description of the menu item. You can add more details here.
      </p>

      <div class="item-price" style="font-weight: 900; margin-top: 12px;">
        ₱${item.price}
      </div>

      <button class="btn primary" style="width: 100%; margin-top: 16px;">
        Add to Cart
      </button>
    </div>
  </div>
</div>
`;
    document
      .querySelector(".modal-parent")
      .insertAdjacentHTML("beforeend", markup);
  }
}

export default new NewOrderItemView();
