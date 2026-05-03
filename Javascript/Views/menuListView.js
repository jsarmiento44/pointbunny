import View from "./view.js";

class MenuListView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _openBtn = document.querySelector("#menu-list");
  _closeBtn = document.querySelector(".modal-close");

  _generateMarkUp() {
    return `
      <div class="modal-overlay" id="menuModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Menu</h2>
          <button class="btn primary" id="openAddModal">+ Add New Item</button>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-left">
  ${this._data.menuCategories
    .map((category) => {
      const items = this._data.menuItems.filter((i) => i.category === category);

      return `
        <div class="menu-category-header">${category}</div>
        <div class="menu-category">
          ${items
            .map(
              (item) => `
                <div class="card" data-id="${item._id}">
                  <div class="btn-main">
                    <img src="${item.imageURL}" alt="${item.itemName}" />
                    <div>
                      <div class="title">${item.itemName}</div>
                      <div class="hint">₱${item.price}</div>
                    </div>
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      `;
    })
    .join("")}
    </div>      
    </div>`;
  }

  _addHandlerShowModal(handler) {
    this._openBtn.addEventListener("click", function (e) {
      e.preventDefault();

      handler();
    });
  }

  _addHandlerCloseModal() {
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest(".modal-close");
      if (!btn || !btn.closest("#menuModal")) return;
      const modal = this._parentElement.querySelector(".modal-overlay");
      const inner = modal?.querySelector(".modal-content");
      if (inner) inner.classList.add("modal-exiting");
      setTimeout(() => {
        if (inner) inner.classList.remove("modal-exiting");
        if (modal) modal.classList.add("hidden");
      }, 220);
      e.preventDefault();
    });
  }
}

export default new MenuListView();
