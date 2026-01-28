import View from "./view.js";

class MenuEditView extends View {
  _parentElement = document.querySelector(".modal-parent");

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
    <button class="modal-close-btn" aria-label="Close modal">✕</button>

    <form class="edit-item-form">
      <h2 class="edit-form-title">Edit Menu Item</h2>

      <div class="edit-form-grid">
        <!-- LEFT COLUMN -->
        <div class="edit-form-column">

          <!-- IMAGE PREVIEW -->
          <div class="file-upload-preview-wrapper">
            <img src="${item.imageURL || "default-image.png"}" alt="Item Image" class="edit-image-preview"/>
          </div>

          <!-- IMAGE UPLOAD BUTTON -->
          <label class="edit-field edit-file-upload">
            Image
            <input type="file" class="edit-image-input" />
            <button type="button" class="edit-upload-btn">Update Image</button>
          </label>

          <label class="edit-field">
            Item Name
            <input type="text" value="${item.itemName}"/>
          </label>

          <label class="edit-field">
            Price
            <input type="number" value="${item.price}"/>
          </label>

          <label class="edit-field">
            Category
            <select class="edit-field-select">
            </select>
          </label>

          <label class="edit-field">
            Description
            <textarea rows="4">${item.description}</textarea>
          </label>

          <label class="edit-field">
            Stock
            <input type="number" value="${item._stock}" />
          </label>

        </div>

        <!-- RIGHT COLUMN -->
        <div class="edit-form-column">

          <label class="edit-field">
            Status
            <select>
              <option ${item.isActive ? "selected" : ""}>Active</option>
              <option ${!item.isActive ? "selected" : ""}>Inactive</option>
            </select>
          </label>

          <div class="edit-toggle-row">
            <span class="edit-toggle-label">Has Variants</span>
            <label class="edit-switch">
              <input type="checkbox" ${item.hasVariants ? "checked" : ""} />
              <span class="edit-slider"></span>
            </label>
          </div>

          <!-- Variants Section -->
          <div class="edit-variants-section">
            <h3 class="edit-variants-title">Variants</h3>
            ${
              item.hasVariants
                ? item.variants
                    .map((variant) => {
                      return `
            <div class="edit-variant-group">
              <div class="edit-variant-header">
                <label class="edit-field">
                  ${variant.optionLabel}
                  <input type="text" placeholder="e.g. Size" value="${variant.optionLabel}" />
                </label>
                <button type="button" class="edit-delete-variant-btn">✕</button>
              </div>

              ${variant.options
                .map((option) => {
                  return `
                  <div class="edit-variant-options">
                    <div class="edit-variant-row">
                      <input type="text" placeholder="Option name" value="${option.optionName}" />
                      <input type="number" placeholder="Price" value="${option.optionPrice}" />
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
    this._parentElement.insertAdjacentHTML("afterbegin", markUp);
  }

  _mapMenuCategoriesMarkUp(data) {
    const selectEl = document.querySelector(".edit-field-select");
    selectEl.innerHTML = ``;

    selectEl.innerHTML = `
      <option class="hidden" value="Select category" disabled selected>Select category</option>
      <option value="new-category">Add new category</option>
    `;

    const markup = data.map(
      (i) => `<option value="${i}">${i[0].toUpperCase() + i.slice(1)}</option>
`,
    );
    selectEl.insertAdjacentHTML("afterbegin", markup);
  }
}

export default new MenuEditView();
