import View from "./view.js";

class NewOrderItemView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _itemModal = document.querySelector(".item-modal-overlay");
  _itemModalCloseBtn = document.querySelector(".item-modal-close");
  _quantityBtn = document.querySelector(".quantity-buttons");
  _basket;
  _qty = 1;
  _variants;

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
    const variantsSection = this._itemModal.querySelector(".variant-section");
    this._itemModal.querySelector(".title").textContent = item.itemName;
    this._itemModal.querySelector(".hint").textContent = item.category;
    this._itemModal.querySelector(".item-price").textContent = `₱${item.price}`;
    const itemVariants = item.hasVariants
      ? item.variants
          .map((variant) => {
            const [...optionsArr] = variant.options;

            return `
          <div class="variant-set">
            <div class="menu-category-header">${variant.optionLabel}</div>
            <div class="variant-options">
              ${optionsArr
                .map(
                  (option) => `
                      <div class="variant-chip" data-value="${option.optionName.trim()}" data-price="${option.optionPrice}">
                      ${option.optionName}
                      <span>${
                        option.optionPrice === "0"
                          ? ""
                          : `₱${option.optionPrice}`
                      }</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>
        `;
          })
          .join("")
      : ``;

    variantsSection.innerHTML = "";
    variantsSection.insertAdjacentHTML("afterbegin", itemVariants);

    this._selectSingleVariantListener();

    this._basket = {
      itemName: item.itemName,
      price: item.price,
      selectedVariants: "",
      category: item.category,
      id: item._id,
      date: Date.now(),
      quantity: "",
      totalPrice: "",
      customerPayment: "",
      customerChange: "",
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
        this._findSelectedVariants();
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

  _selectMultipleVariantListener() {
    //1.) Listen for a click event when user clicks a variant
    document
      .querySelector(".variant-section")
      .addEventListener("click", (e) => {
        e.preventDefault();
        const chip = e.target.closest(".variant-chip");
        if (!chip) return;

        chip.classList.toggle("selected");
        e.stopImmediatePropagation();
      });

    //3.) Push all selected variants to basket
  }

  _selectSingleVariantListener() {
    document.querySelectorAll(".variant-set").forEach((set) => {
      set.addEventListener("click", function (e) {
        const chip = e.target.closest(".variant-chip");
        if (!chip) return;

        const currentlySelected = set.querySelector(".variant-chip.selected");
        if (currentlySelected && currentlySelected !== chip) {
          currentlySelected.classList.remove("selected");
        }

        chip.classList.toggle("selected");
      });
    });
  }

  _findSelectedVariants() {
    this._variants = Array.from(
      document
        .querySelector(".variant-section")
        .querySelectorAll(".variant-chip.selected"),
    ).map((el) => el.dataset.value + el.dataset.price);
    console.log(this._variants);
  }
}

export default new NewOrderItemView();
