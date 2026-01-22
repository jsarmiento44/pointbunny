import View from "./view.js";

class NewMenuItemView extends View {
  _parentElement = document.querySelector("#addMenuModal");
  _closeBtn = this._parentElement.querySelector(".modal-close");
  _modalDiv = document.querySelector(".modal-parent");
  _formParent = this._parentElement.querySelector(".add-menu-form");
  _selectOptionsElement = document.querySelector(".select-options");
  _variantCheckBoxElement = document.getElementById("hasVariantsCheckbox");
  _showVariantBtn = document.getElementById("showVariantField");
  _addVariantElement = document.querySelector(".variant-modal");
  _addVariantOptionBtn = document.querySelector(".add-variant-option");
  _variantContainer = document.querySelector(".variant-options-field");
  _addVariantBtn = document.getElementById("addVariantSet");

  _addedVariants = [];

  constructor() {
    super();

    this._addVariantSet();
    this._showVariantModal();
    this._variantModalHide();
  }

  _toggleModalClose() {
    this._closeBtn.addEventListener("click", (e) => {
      this._parentElement.classList.toggle("hidden");
      document.getElementById("newCategoryInput").classList.add("hidden");
      document.querySelector(".new-category-button").classList.add("hidden");
    });
  }

  _toggleModalOpen() {
    this._modalDiv.addEventListener("click", function (e) {
      e.preventDefault();

      const btn = e.target.closest("#openAddModal");
      if (!btn) return;

      document.querySelector(".modal-overlay-form").classList.toggle("hidden");
    });
  }

  _uploadItem(handler) {
    this._formParent.addEventListener("submit", function (e) {
      e.preventDefault();
      //1.) Extract the data from fields
      const dataArr = [...new FormData(this)];
      const data = Object.fromEntries(dataArr);
      if (!data) return;
      handler(data);
      //2.) Refactor data to become model object
      //3.) Send data to controller
      //4.) close form modal
      //5.) Show success
      document.querySelector("#addMenuModal").classList.toggle("hidden");
      document.getElementById("newCategoryInput").classList.add("hidden");
    });
  }

  _newMenuCategory() {
    document
      .querySelector(".select-options")
      .addEventListener("change", function (e) {
        const value = this.value;

        console.log(value);
        if (value === `new-category`) {
          document
            .getElementById("newCategoryInput")
            .classList.remove("hidden");

          document
            .querySelector(".new-category-button")
            .classList.remove("hidden");
        } else {
          document.getElementById("newCategoryInput").classList.add("hidden");

          document
            .querySelector(".new-category-button")
            .classList.add("hidden");
        }
      });
  }

  _addHandlerAddMenuCategory(handler) {
    document
      .querySelector(".new-category-button")
      .addEventListener("click", function () {
        const field = document.getElementById("newCategoryInput");
        const newCateg = field.value.trim();

        if (newCateg !== "") {
          handler(newCateg);
          document.getElementById("newCategoryInput").classList.add("hidden");

          document
            .querySelector(".new-category-button")
            .classList.add("hidden");
        } else {
          alert("Please insert an input");
        }
      });
  }

  _mapMenuCategoriesMarkUp(data) {
    this._selectOptionsElement.innerHTML = `
    <option class="hidden" value="" disabled selected>Select category</option>
    <option value="new-category">Add new category</option>
  `;

    const markup = data.map(
      (i) => `<option value="${i}">${i[0].toUpperCase() + i.slice(1)}</option>
`,
    );
    console.log(markup);
    this._selectOptionsElement.insertAdjacentHTML("afterbegin", markup);
  }

  _itemVariantsToggle() {
    this._variantCheckBoxElement.addEventListener("change", function () {
      if (this.checked) {
        document.querySelector(".variants-section").classList.remove("hidden");
      } else {
        document.querySelector(".variants-section").classList.add("hidden");
      }
    });
  }

  _showVariantModal() {
    this._showVariantBtn.addEventListener("click", (e) => {
      this._addVariantElement.classList.toggle("hidden");
    });
  }

  _variantModalHide() {
    this._parentElement.addEventListener("click", function (e) {
      const btn = e.target.closest(".variant-close");
      if (!btn) return;
      document.querySelector(".variant-modal").classList.add("hidden");
    });
  }

  _addVariantOption() {
    this._addVariantOptionBtn.addEventListener("click", () => {
      const markup = `
      <div class="variant-options-field">  <!-- gamitin yung tamang class -->
        <label>
          <input type="text" name="option-name" placeholder="e.g. Small, Medium, Large" />
        </label>
        <label class="price-label">
          <input
            type="number"
            name="option-price"
            placeholder="₱0.00"
            step="1"
            min="0"
          />
        </label>
      </div>
    `;

      this._variantContainer.insertAdjacentHTML("beforeend", markup);
    });
  }

  _addVariantSet() {
    this._addVariantBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      const optionLabel = document.querySelector(
        'input[name="variant-name"]',
      ).value;

      const optionRows = document.querySelectorAll('input[name="option-name"]');

      const options = Array.from(optionRows).map((optionInput) => {
        const optionRow = optionInput.closest(".variant-options-field");
        const priceInput = optionRow.querySelector(
          'input[name="option-price"]',
        );

        return {
          optionName: optionInput.value.trim(),
          optionPrice: priceInput.value !== "" ? priceInput.value : "0",
        };
      });

      this._addedVariants.push({
        optionLabel: optionLabel,
        options: options,
      });
      console.log(typeof this._addedVariants);
      console.log(this._addedVariants);
    });
  }
}

export default new NewMenuItemView();
