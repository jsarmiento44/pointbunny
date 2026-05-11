import View from "./view.js";

class NewOrderView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _openBtn = document.getElementById("#newOrderBtn");

  _generateMarkUp() {
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    const { menuItems, menuCategories, cart } = this._data;

    const cartCount = cart.length;
    const cartTotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);
    const userCategories = menuCategories.filter((c) => c !== "uncategorized");

    const renderCard = (item) => {
      const unavailable = item.status === "unavailable";
      return `
        <div class="pos-item-card${unavailable ? " pos-item-card--unavailable" : ""}" data-id="${item._id}">
          <img src="${item.imageURL}" alt="${item.itemName}" class="pos-item-img" />
          <div class="pos-item-info">
            <div class="pos-item-name">${item.itemName}</div>
            <div class="pos-item-price">$${item.price}</div>
          </div>
        </div>`;
    };

    const activeCategories = userCategories.filter((cat) =>
      menuItems.some((i) => i.category === cat && i.status !== "inactive"),
    );

    const uncategorizedItems = menuItems.filter(
      (i) =>
        i.status !== "inactive" &&
        (!i.category ||
          i.category === "uncategorized" ||
          !menuCategories.includes(i.category)),
    );

    const tabs = [
      `<button class="pos-cat-tab pos-cat-tab--active" data-cat="all">All Items</button>`,
      ...activeCategories.map(
        (cat) =>
          `<button class="pos-cat-tab" data-cat="${cat}">${cap(cat)}</button>`,
      ),
      uncategorizedItems.length
        ? `<button class="pos-cat-tab" data-cat="uncategorized">Uncategorized</button>`
        : "",
    ].join("");

    const categoryGroups = activeCategories
      .map((cat) => {
        const items = menuItems.filter(
          (i) => i.category === cat && i.status !== "inactive",
        );
        if (!items.length) return "";
        return `
          <div class="pos-cat-section" data-section="${cat}">
            <p class="pos-cat-label">${cap(cat)}</p>
            <div class="pos-items-grid">${items.map(renderCard).join("")}</div>
          </div>`;
      })
      .join("");

    const uncatGroup = uncategorizedItems.length
      ? `
        <div class="pos-cat-section" data-section="uncategorized">
          <p class="pos-cat-label pos-cat-label--muted">Uncategorized</p>
          <div class="pos-items-grid">${uncategorizedItems.map(renderCard).join("")}</div>
        </div>`
      : "";

    const cartMarkup = cart
      .map((item, i) => {
        const variants = item.selectedVariants.map((v) => v.variantName).join(", ");
        return `
          <div class="pos-cart-item cart-item-row">
            <div class="pos-cart-item-info">
              <span class="pos-cart-item-name">${item.itemName} ×${item.quantity}</span>
              ${variants ? `<span class="pos-cart-item-variants">${variants}</span>` : ""}
            </div>
            <div class="pos-cart-item-right">
              <span class="pos-cart-item-price">$${item.totalPrice}</span>
              <button class="cart-item-delete-btn pos-cart-delete" data-cart-index="${i}" type="button">×</button>
            </div>
          </div>`;
      })
      .join("");

    return `
      <div class="pos-screen" id="newOrderModal">
        <div class="pos-header">
          <button class="modal-close pos-close-btn" aria-label="Close">×</button>
          <h2 class="pos-title">New Order</h2>
          <button class="btn-checkout pos-cart-fab">
            Cart${cartCount > 0 ? ` <span class="pos-cart-count">${cartCount}</span>` : ""} · $${cartTotal.toFixed(2)}
          </button>
        </div>
        <div class="pos-body">
          ${menuItems.length > 0 ? `<div class="pos-cat-sidebar">${tabs}</div>` : ""}
          <div class="pos-menu">
            ${
              menuItems.length === 0
                ? `<p class="pos-empty">No items yet. Go to Menu List to add items.</p>`
                : `<div class="pos-items-area" id="posItemsArea">
                  ${categoryGroups}${uncatGroup}
                </div>`
            }
          </div>
          <div class="pos-cart-sidebar">
            <h3 class="pos-cart-title">Cart</h3>
            <div class="pos-cart-list" id="cartItems">
              ${cartMarkup || '<p class="pos-cart-empty">No items yet.</p>'}
            </div>
            <div class="pos-cart-footer">
              <div class="pos-cart-total">
                <span>Total</span>
                <span>$${cartTotal.toFixed(2)}</span>
              </div>
              <button class="btn-checkout pos-checkout-btn">Checkout</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  _addHandlerCategoryTabs() {
    this._parentElement.addEventListener("click", (e) => {
      const tab = e.target.closest(".pos-cat-tab");
      if (!tab) return;

      this._parentElement
        .querySelectorAll(".pos-cat-tab")
        .forEach((t) => t.classList.remove("pos-cat-tab--active"));
      tab.classList.add("pos-cat-tab--active");

      const cat = tab.dataset.cat;
      this._parentElement.querySelectorAll(".pos-cat-section").forEach((s) => {
        if (cat === "all" || s.dataset.section === cat) {
          s.classList.remove("hidden");
        } else {
          s.classList.add("hidden");
        }
      });

      const itemsArea = this._parentElement.querySelector(".pos-items-area");
      if (itemsArea) itemsArea.scrollTop = 0;
    });
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
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest(".modal-close");
      if (!btn || !btn.closest("#newOrderModal")) return;
      const screen = this._parentElement.querySelector(".pos-screen");
      handler(() => {
        if (screen) screen.classList.add("modal-exiting");
        setTimeout(() => {
          this._parentElement.innerHTML = "";
        }, 220);
      });
    });
  }
}

export default new NewOrderView();
