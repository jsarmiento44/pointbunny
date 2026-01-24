import View from "./view.js";

class NewMenuItemView extends View {
  _parentElement = document.querySelector("#addMenuModal");
  _closeBtn = this._parentElement.querySelector(".modal-close");
  _modalDiv = document.querySelector(".modal-parent");
  _formParent = this._parentElement.querySelector(".add-menu-form");
  _selectOptionsElement = document.querySelector(".select-options");

  //variants
  _variantSection = document.querySelector(".variant-btn-section");
  _variantModal = document.getElementById("addVariantModal");
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
    this._formParent.addEventListener("submit", (e) => {
      e.preventDefault();
      //1.) Extract the data from fields
      const dataArr = [...new FormData(this._formParent)];
      const data = Object.fromEntries(dataArr);
      if (!data) return;
      handler(data);
      //2.) Refactor data to become model object
      //3.) Send data to controller
      //4.) close form modal
      //5.) Show success
      document
        .querySelectorAll(".variant-options-container-text")
        .forEach((container) => container.remove());

      const inputs = document
        .getElementById("addMenuModal")
        .querySelectorAll("input, select, textarea");

      inputs.forEach((input) => {
        if (input.type === "checkbox" || input.type === "radio") {
          input.checked = false;
        } else {
          input.value = "";
        }
      });

      this._selectOptionsElement.value = "";
      document.getElementById("addMenuModal").classList.add("hidden");
      document.getElementById("newCategoryInput").classList.add("hidden");
      document.querySelector(".new-category-button").classList.add("hidden");
      this._showVariantBtn.classList.add("hidden");
      this._addedVariants = [];
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
    this._selectOptionsElement.innerHTML = ``;

    this._selectOptionsElement.innerHTML = `
      <option class="hidden" value="Select category" disabled selected>Select category</option>
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
    this._variantCheckBoxElement.addEventListener("change", () => {
      if (this._variantCheckBoxElement.checked) {
        document.querySelector(".variants-section").classList.remove("hidden");
        this._showVariantBtn.classList.remove("hidden"); // ensure button is visible
      } else {
        document.querySelector(".variants-section").classList.add("hidden");
      }
    });
  }

  _showVariantModal() {
    this._showVariantBtn.addEventListener("click", (e) => {
      this._addVariantElement.classList.remove("hidden");
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
        <div class="variant-options-field added-fields">  <!-- gamitin yung tamang class -->
          <label>
            <input type="text" name="option-name" placeholder="e.g. Small, Medium, Large"/>
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

      if (optionLabel) {
        let allVariantRows = [];

        const optionRows = document.querySelectorAll(
          'input[name="option-name"]',
        );

        const options = Array.from(optionRows).map((optionInput) => {
          const optionRow = optionInput.closest(".variant-options-field");
          allVariantRows.push(optionRow);
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

        // Remove previously rendered variant HTML
        document
          .querySelectorAll(".variant-options-container-text")
          .forEach((el) => el.remove());

        const variantMarkup = this._addedVariants
          .map((variant) => {
            const optionsHTML = variant.options
              .map(
                (opt) =>
                  `<div class="option-pair">
               <span class="option-name">${opt.optionName}</span>
               <span class="option-price">${opt.optionPrice}</span>
             </div>`,
              )
              .join("");

            return `<div class="variant-options-container-text">
                <div class="option-label">${variant.optionLabel}</div>
                <div class="option-pairs">${optionsHTML}</div>
              </div>`;
          })
          .join("");

        this._variantSection.insertAdjacentHTML("afterend", variantMarkup);

        document
          .querySelectorAll(".added-fields")
          .forEach((field) => field.remove());
        this._variantModal
          .querySelectorAll("input")
          .forEach((input) => (input.value = ""));

        document.querySelector(".variant-modal").classList.add("hidden");
      } else {
        alert("Please insert an option name or label");
      }
    });
  }
}

export default new NewMenuItemView();
