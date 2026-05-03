import View from "./view.js";

class MenuEditView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _formDiv = document.querySelector(".edit-form-parent");
  _submitHandler = null;
  _currentItemId = null;

  _showEditMenuForm(handler) {
    this._parentElement.addEventListener("click", (e) => {
      e.preventDefault();
      const card = e.target.closest(".card");
      if (!card) return;
      card.classList.remove("pulse");
      void card.offsetWidth;
      card.classList.add("pulse");
      handler(card.dataset.id);
    });
  }

  _insertEditMenuMarkup(item) {
    this._currentItemId = item._id;
    const markUp = `<!-- BACKDROP -->
<div class="modal-backdrop">
  <!-- MODAL CONTAINER -->
  <div class="modal-container">
    <button class="modal-close-btn" aria-label="Close modal">x</button>

    <form class="edit-item-form">
      <h2 class="edit-form-title">Edit Menu Item</h2>

      <div class="edit-form-grid">
        <!-- LEFT COLUMN -->
        <div class="edit-form-column">

          <!-- IMAGE PREVIEW + UPLOAD -->
            <div class="file-upload-preview-wrapper">
              <img
                src="${item.imageURL || "default-image.png"}"
                alt="Item Image"
                class="edit-image-preview"
              />
              <input type="file" class="edit-image-input" name="image" style="display:none;" />
              <span class="edit-image-overlay">Click to change image</span>
            </div>


          <label class="edit-field">
            Item Name
            <input type="text" name="itemName" value="${item.itemName}" />
          </label>

          <label class="edit-field">
            Price
            <input type="number" name="price" value="${item.price}" />
          </label>

          <div class="edit-field">
            <span class="edit-field-label">Category</span>
            <div class="category-wrapper">
              <select class="edit-field-select" name="category"></select>
              <div class="new-category-row hidden">
                <input type="text" class="new-category-field edit-new-category-input" placeholder="New category name" />
                <button class="new-category-button" type="button">+ Add</button>
              </div>
            </div>
          </div>

          <label class="edit-field">
            Description
            <textarea name="description" rows="4">${item.description}</textarea>
          </label>

          <label class="edit-field">
            Stock
            <input type="number" name="stock" value="${item._stock}" />
          </label>

        </div>

        <!-- RIGHT COLUMN -->
        <div class="edit-form-column">

          <label class="edit-field">
            Status
            <select name="status">
              <option value="Active" ${item.status === "active" ? "selected" : ""}>Active</option>
              <option value="Inactive" ${item.status === "inactive" ? "selected" : ""}>Inactive</option>
              <option value="Unavailable" ${item.status === "unavailable" ? "selected" : ""}>Unavailable</option>
            </select>
          </label>

          <div class="edit-toggle-row">
            <span class="edit-toggle-label">Has Variants</span>
            <label class="edit-switch">
              <input type="checkbox" name="hasVariants" ${item.hasVariants ? "checked" : ""} />
              <span class="edit-slider"></span>
            </label>
          </div>

          <!-- Variants Section -->
          <div class="edit-variants-section">

            <!-- Header: Variants title + Add button -->
            <div class="edit-variants-header">
              <h3 class="edit-variants-title">Variants</h3>
              <button type="button" class="edit-add-variant-btn">+ Add Variant Group</button>
            </div>

            ${
              item.hasVariants
                ? item.variants
                    .map((variant, vIndex) => {
                      return `
            <div class="edit-variant-group">
              <div class="edit-variant-header">
                <label class="edit-field">
                  Variant Group
                  <input type="text" name="variants[${vIndex}][optionLabel]" value="${variant.optionLabel}" />
                </label>
                <button type="button" class="edit-delete-variant-btn">✕</button>
              </div>

              <div class="edit-variant-options">
                ${variant.options
                  .map((option, oIndex) => {
                    return `
                    <div class="edit-variant-row">
                      <input
                        type="text"
                        name="variants[${vIndex}][options][${oIndex}][optionName]"
                        placeholder="Option name"
                        value="${option.optionName}"
                      />
                      <input
                        type="number"
                        name="variants[${vIndex}][options][${oIndex}][optionPrice]"
                        placeholder="Price"
                        value="${option.optionPrice}"
                      />
                      <button type="button" class="edit-delete-option-btn">✕</button>
                    </div>
                    `;
                  })
                  .join("")}
              </div>

              <button type="button" class="edit-add-option-btn">+ Add Option</button>   
            </div>
          `;
                    })
                    .join("")
                : ""
            }
          </div>

          <!-- ACTION BUTTONS -->
          <div class="edit-form-actions">
            <button type="submit" class="edit-update-btn">Update</button>
            <button type="button" class="edit-delete-btn">Delete Item</button>
          </div>

        </div>
      </div>
    </form>
  </div>
</div>
`;
    this._formDiv.innerHTML = "";
    this._formDiv.insertAdjacentHTML("beforeend", markUp);
  }

  _mapMenuCategoriesMarkUp(categories, selectedCategory) {
    const selectEl = document.querySelector(".edit-field-select");

    // Start fresh
    selectEl.innerHTML = "";

    // Default option (only selected if no category exists)
    selectEl.insertAdjacentHTML(
      "beforeend",
      `<option value="" disabled ${!selectedCategory ? "selected" : ""}>
       Select category
     </option>`,
    );

    // Add actual categories
    const markup = categories
      .map(
        (cat) => `
        <option value="${cat}" ${cat === selectedCategory ? "selected" : ""}>
          ${cat[0].toUpperCase() + cat.slice(1)}
        </option>
      `,
      )
      .join("");

    selectEl.insertAdjacentHTML("beforeend", markup);

    // Add "new category" option
    selectEl.insertAdjacentHTML(
      "beforeend",
      `<option value="new-category">Add new category</option>`,
    );
  }

  _updateItemData(handler) {
    if (this._submitHandler) {
      this._formDiv.removeEventListener("submit", this._submitHandler);
    }

    this._submitHandler = (e) => {
      e.preventDefault();
      const form = e.target.closest(".edit-item-form");
      if (!form) return;

      const formData = new FormData(form);
      const data = {};
      for (let [key, value] of formData.entries()) {
        data[key] = value;
      }

      this._formDiv.removeEventListener("submit", this._submitHandler);
      this._submitHandler = null;

      handler(data);
      const backdrop = form.closest(".modal-backdrop");
      if (backdrop) backdrop.remove();
      this._showSuccess();
      setTimeout(() => this._hideSuccess(), 1000);
    };

    this._formDiv.addEventListener("submit", this._submitHandler);
  }

  _updateImagePreview() {
    // Click image to open file dialog
    this._formDiv.addEventListener("click", (e) => {
      const wrapper = e.target.closest(".file-upload-preview-wrapper");
      if (!wrapper) return;

      const input = wrapper.querySelector(".edit-image-input");
      if (!input) return;

      input.click();
    });

    // Update preview when file selected
    this._formDiv.addEventListener("change", (e) => {
      const input = e.target.closest(".edit-image-input");
      if (!input) return;

      const file = input.files[0];
      if (!file) return;

      const preview = input
        .closest(".file-upload-preview-wrapper")
        .querySelector(".edit-image-preview");

      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  _addVariantGroup() {
    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".edit-add-variant-btn");
      if (!btn) return;

      const variantsSection = btn.closest(".edit-variants-section");
      if (!variantsSection) return;

      // Determine next index
      const currentGroups = variantsSection.querySelectorAll(
        ".edit-variant-group",
      );
      const vIndex = currentGroups.length;

      // Build markup for a new empty variant group
      const markup = `
      <div class="edit-variant-group">
        <div class="edit-variant-header">
          <label class="edit-field">
            Variant Group
            <input type="text" name="variants[${vIndex}][optionLabel]" value="" placeholder="Variant Label" />
          </label>
          <button type="button" class="edit-delete-variant-btn">✕</button>
        </div>

        <div class="edit-variant-options">
          <div class="edit-variant-row">
            <input
              type="text"
              name="variants[${vIndex}][options][0][optionName]"
              placeholder="Option name"
            />
            <input
              type="number"
              name="variants[${vIndex}][options][0][optionPrice]"
              placeholder="Price"
            />
            <button type="button" class="edit-delete-option-btn">✕</button>
          </div>
        </div>

        <button type="button" class="edit-add-option-btn">+ Add Option</button>
      </div>
    `;

      // Insert new group at the bottom of variants section
      variantsSection.insertAdjacentHTML("beforeend", markup);

      // Get the newly added group
      const newGroup = variantsSection.querySelector(
        ".edit-variant-group:last-child",
      );

      // Scroll smoothly to the new group
      newGroup.scrollIntoView({ behavior: "smooth", block: "center" });

      // Focus on the group name input
      const input = newGroup.querySelector(
        "input[name^='variants'][name$='[optionLabel]']",
      );
      if (input) input.focus();

      this._reindexVariants(); // make sure indices stay correct

      // Auto-enable the hasVariants toggle when a group is added
      const checkbox = this._formDiv.querySelector('[name="hasVariants"]');
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        const variantsSection = this._formDiv.querySelector(
          ".edit-variants-section",
        );
        if (variantsSection) variantsSection.style.display = "";
      }
    });
  }

  _addOption() {
    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".edit-add-option-btn");
      if (!btn) return;

      const variantGroup = btn.closest(".edit-variant-group");
      if (!variantGroup) return;

      const optionsContainer = variantGroup.querySelector(
        ".edit-variant-options",
      );
      if (!optionsContainer) return;

      // Determine next option index
      const currentOptions =
        optionsContainer.querySelectorAll(".edit-variant-row");
      const oIndex = currentOptions.length;

      // Determine vIndex for this variant group
      const groupInput = variantGroup.querySelector(
        "input[name^='variants'][name$='[optionLabel]']",
      );
      const vIndexMatch = groupInput.name.match(/variants\[(\d+)\]/);
      const vIndex = vIndexMatch ? vIndexMatch[1] : 0;

      // Build new option row
      const markup = `
      <div class="edit-variant-row">
        <input
          type="text"
          name="variants[${vIndex}][options][${oIndex}][optionName]"
          placeholder="Option name"
        />
        <input
          type="number"
          name="variants[${vIndex}][options][${oIndex}][optionPrice]"
          placeholder="Price"
        />
        <button type="button" class="edit-delete-option-btn">✕</button>
      </div>
    `;

      optionsContainer.insertAdjacentHTML("beforeend", markup);

      // Scroll to the new option
      const newOption = optionsContainer.querySelector(
        ".edit-variant-row:last-child",
      );
      newOption.scrollIntoView({ behavior: "smooth", block: "center" });

      // Focus on the new option name input
      const input = newOption.querySelector("input[name$='[optionName]']");
      if (input) input.focus();

      this._reindexVariants(); // make sure names stay correct
    });
  }

  _deleteVariant() {
    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".edit-delete-variant-btn");
      if (!btn) return;

      const confirmDelete = window.confirm("Delete this variant group?");

      if (!confirmDelete) return;

      const group = btn.closest(".edit-variant-group");
      if (group) group.remove();

      this._reindexVariants();

      const remaining = this._formDiv.querySelectorAll(".edit-variant-group");
      if (remaining.length === 0) {
        const checkbox = this._formDiv.querySelector('[name="hasVariants"]');
        if (checkbox) checkbox.checked = false;
      }
    });
  }

  _reindexVariants() {
    const groups = this._formDiv.querySelectorAll(".edit-variant-group");

    groups.forEach((group, vIndex) => {
      // Update variant label input
      const labelInput = group.querySelector('input[name*="[optionLabel]"]');

      labelInput.name = `variants[${vIndex}][optionLabel]`;

      // Update option inputs
      const optionRows = group.querySelectorAll(".edit-variant-row");

      optionRows.forEach((row, oIndex) => {
        const nameInput = row.querySelector('input[name*="[optionName]"]');
        const priceInput = row.querySelector('input[name*="[optionPrice]"]');

        nameInput.name = `variants[${vIndex}][options][${oIndex}][optionName]`;
        priceInput.name = `variants[${vIndex}][options][${oIndex}][optionPrice]`;
      });
    });
  }

  _deleteOption() {
    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".edit-delete-option-btn");
      if (!btn) return;

      const row = btn.closest(".edit-variant-row");
      if (row) row.remove();

      this._reindexVariants();
    });
  }

  _addHandlerHasVariantsToggle() {
    this._formDiv.addEventListener("change", (e) => {
      const checkbox = e.target.closest('[name="hasVariants"]');
      if (!checkbox) return;

      const variantsSection = this._formDiv.querySelector(
        ".edit-variants-section",
      );

      if (checkbox.checked) {
        if (variantsSection) variantsSection.style.display = "";
        return;
      }

      const existingGroups = this._formDiv.querySelectorAll(
        ".edit-variant-group",
      );

      if (existingGroups.length === 0) {
        if (variantsSection) variantsSection.style.display = "none";
        return;
      }

      // Revert toggle until user confirms
      checkbox.checked = true;

      this._showVariantsToggleConfirm(() => {
        checkbox.checked = false;
        existingGroups.forEach((g) => g.remove());
        if (variantsSection) variantsSection.style.display = "none";
      });
    });
  }

  _showVariantsToggleConfirm(onConfirm) {
    const markup = `
      <div class="edit-confirm-overlay">
        <div class="edit-confirm-dialog">
          <p class="edit-confirm-msg">Toggling this off will remove all existing variants. Do you want to continue?</p>
          <div class="edit-confirm-actions">
            <button type="button" class="edit-confirm-cancel-btn">Cancel</button>
            <button type="button" class="edit-confirm-yes-btn">Continue</button>
          </div>
        </div>
      </div>
    `;

    const container = this._formDiv.querySelector(".modal-container");
    container.insertAdjacentHTML("beforeend", markup);

    const overlay = container.querySelector(".edit-confirm-overlay");

    overlay
      .querySelector(".edit-confirm-yes-btn")
      .addEventListener("click", () => {
        overlay.remove();
        onConfirm();
      });

    overlay
      .querySelector(".edit-confirm-cancel-btn")
      .addEventListener("click", () => {
        overlay.remove();
      });
  }

  _addHandlerDeleteItem(handler) {
    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".edit-delete-btn");
      if (!btn) return;

      const confirmed = window.confirm(
        "Delete this item? This cannot be undone.",
      );
      if (!confirmed) return;

      const backdrop = btn.closest(".modal-backdrop");
      if (backdrop) backdrop.remove();

      handler(this._currentItemId);
    });
  }

  _closeModal() {
    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".modal-close-btn");
      if (!btn) return;
      const backdrop = btn.closest(".modal-backdrop");
      if (!backdrop) return;
      const inner = backdrop.querySelector(".modal-container");
      if (inner) inner.classList.add("modal-exiting");
      setTimeout(() => backdrop.remove(), 220);
    });
  }

  _newEditCategoryToggle(handler) {
    this._formDiv.addEventListener("change", (e) => {
      const select = e.target.closest(".edit-field-select");
      if (!select) return;
      const row = select
        .closest(".category-wrapper")
        ?.querySelector(".new-category-row");
      if (!row) return;
      if (select.value === "new-category") {
        row.classList.remove("hidden");
        row.querySelector(".new-category-field").focus();
      } else {
        row.classList.add("hidden");
      }
    });

    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".edit-field .new-category-button");
      if (!btn) return;
      const row = btn.closest(".new-category-row");
      const input = row.querySelector(".new-category-field");
      const name = input.value.trim();
      if (!name) {
        alert("Please enter a category name");
        return;
      }
      handler(name);
      input.value = "";
      row.classList.add("hidden");
    });

    this._formDiv.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const input = e.target.closest(".edit-new-category-input");
      if (!input) return;
      e.preventDefault();
      const row = input.closest(".new-category-row");
      const name = input.value.trim();
      if (!name) {
        alert("Please enter a category name");
        return;
      }
      handler(name);
      input.value = "";
      row.classList.add("hidden");
    });
  }
}

export default new MenuEditView();
