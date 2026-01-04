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
          ${this._data.menuItems
            .map(
              (item) => `
            <div class="menu-category-header">${item.category}</div>
            <div class="menu-category">
              <div class="card">
                <div class="btn-main">
                  <img src="${
                    item.imageURL === ``
                      ? ``
                      : URL.createObjectURL(item.imageURL)
                  }" alt="" />
                  <div>
                    <div class="title">${item.itemName}</div>
                    <div class="hint">₱${item.price}</div>
                  </div>
                </div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
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
      if (!btn) return;

      if (btn) {
        const modal = this._parentElement.querySelector(".modal-overlay");
        modal.classList.add("hidden");
      }

      e.preventDefault();
    });
  }
}

export default new MenuListView();
