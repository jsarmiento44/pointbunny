import View from "./view.js";

class MenuEditView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _formDiv = document.querySelector(".edit-form-parent");

  _showEditMenuForm(handler) {
    this._parentElement.addEventListener("click", (e) => {
      e.preventDefault();
      const card = e.target.closest(".card");
      if (!card) return;

      handler(card.dataset.id);
    });
  }

  _insertEditMenuMarkup(item) {
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

          <!-- IMAGE PREVIEW -->
          <div class="file-upload-preview-wrapper">
            <img src="${item.imageURL || "default-image.png"}" alt="Item Image" class="edit-image-preview" />
          </div>

          <!-- IMAGE UPLOAD -->
          <div class="edit-field edit-file-upload">
            <label>
              Image
              <input type="file" class="edit-image-input" name="image" />
            </label>
            <button type="button" class="edit-upload-btn">Update Image</button>
          </div>

          <label class="edit-field">
            Item Name
            <input type="text" name="itemName" value="${item.itemName}" />
          </label>

          <label class="edit-field">
            Price
            <input type="number" name="price" value="${item.price}" />
          </label>

          <label class="edit-field">
            Category
            <select class="edit-field-select" name="category"></select>
          </label>

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
              <option value="Active" ${item.isActive ? "selected" : ""}>Active</option>
              <option value="Inactive" ${!item.isActive ? "selected" : ""}>Inactive</option>
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
            <h3 class="edit-variants-title">Variants</h3>
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

              ${variant.options
                .map((option, oIndex) => {
                  return `
                  <div class="edit-variant-options">
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
                  </div>
                  `;
                })
                .join("")}

              <button type="button" class="edit-add-option-btn">+ Add Option</button>   
            </div>
          `;
                    })
                    .join("")
                : ""
            }
          </div>

          <button type="button" class="edit-add-variant-btn">+ Add Variant Group</button>

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
    this._formDiv.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target.closest(".edit-item-form");
      if (!form) return;
      const dataArr = [...new FormData(form)];
      const data = Object.fromEntries(dataArr);
      handler(data);
    });
  }

  _deleteVariant() {
    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".edit-delete-variant-btn");
      if (!btn) return;

      const group = btn.closest(".edit-variant-group");
      if (!group) return;

      group.remove();

      this._reindexVariants();
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

  _closeModal() {
    this._formDiv.addEventListener("click", (e) => {
      const btn = e.target.closest(".modal-close-btn");
      if (!btn) return;

      const backdrop = btn.closest(".modal-backdrop");
      if (backdrop) backdrop.remove();
    });
  }
}

export default new MenuEditView();
