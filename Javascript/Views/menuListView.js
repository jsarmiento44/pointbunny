import View from "./view.js";

class MenuListView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _openBtn = document.querySelector("#menu-list");

  _generateMarkUp() {
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    const { menuCategories: categories, menuItems } = this._data;

    const userCategories = categories.filter((c) => c !== 'uncategorized');

    const chips = userCategories.map((cat) => `
      <span class="menu-cat-chip">
        <span class="menu-cat-chip-name">${cap(cat)}</span>
        <button class="menu-cat-delete" data-category="${cat}" type="button">×</button>
      </span>`).join('');

    const renderCard = (item) => {
      const imgMarkup = item.imageURL
        ? `<img src="${item.imageURL}" alt="${item.itemName}" loading="lazy" onerror="this.className='pos-item-img--ph';this.removeAttribute('src')">`
        : `<div class="pos-item-img--ph" aria-hidden="true"></div>`;
      return `
      <div class="card" data-id="${item._id}">
        <div class="btn-main">
          ${imgMarkup}
          <div class="btn-main-text">
            <div class="title">${item.itemName}</div>
            <div class="hint">$${item.price}</div>
          </div>
        </div>
      </div>`;
    };

    const groups = userCategories.map((cat) => {
      const items = menuItems.filter((i) => i.category === cat);
      if (!items.length) return `
        <div class="menu-cat-group">
          <p class="menu-cat-label">${cap(cat)}</p>
          <p class="menu-cat-empty">No items in this category yet.</p>
        </div>`;
      return `
        <div class="menu-cat-group">
          <p class="menu-cat-label">${cap(cat)}</p>
          <div class="menu-items-grid">${items.map(renderCard).join('')}</div>
        </div>`;
    }).join('');

    const uncategorizedItems = menuItems.filter(
      (i) => !i.category || i.category === 'uncategorized' || !categories.includes(i.category)
    );
    const uncategorizedGroup = uncategorizedItems.length ? `
      <div class="menu-cat-group">
        <p class="menu-cat-label menu-cat-label--muted">Uncategorized</p>
        <div class="menu-items-grid">${uncategorizedItems.map(renderCard).join('')}</div>
      </div>` : '';

    const hasAnyContent = userCategories.length > 0 || uncategorizedItems.length > 0;

    return `
      <div class="modal-overlay" id="menuModal">
        <div class="menu-modal">
          <div class="menu-modal-header">
            <h2 class="menu-modal-title">Catalogue</h2>
            <button class="btn primary" id="openAddModal">+ Add Item</button>
            <button class="modal-close" aria-label="Close">&times;</button>
          </div>
          <div class="menu-cat-manage">
            <p class="menu-cat-section-label">Categories</p>
            <div class="menu-cat-chips">${chips || '<span class="menu-cat-hint">No categories yet.</span>'}</div>
            <div class="menu-cat-add-row">
              <input type="text" id="menuCategoryInput" placeholder="New category name…" class="category-input" />
              <button class="btn primary" id="menuAddCategoryBtn" type="button">+ Add Category</button>
            </div>
          </div>
          <div class="menu-items-area">
            ${!hasAnyContent ? '<p class="menu-empty">No items yet. Add a category and your first item above.</p>' : ''}
            ${groups}
            ${uncategorizedGroup}
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

  _addHandlerAddCategory(handler) {
    const submit = (input) => {
      if (!input?.value.trim()) return;
      handler(input.value.trim());
      input.value = '';
    };
    this._parentElement.addEventListener('click', (e) => {
      if (!e.target.closest('#menuAddCategoryBtn')) return;
      submit(this._parentElement.querySelector('#menuCategoryInput'));
    });
    this._parentElement.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.matches('#menuCategoryInput')) return;
      submit(e.target);
    });
  }

  // Surgically update only the chips strip — no full modal re-render flash
  _updateChips(categories, newCategoryName = null) {
    const container = this._parentElement.querySelector('.menu-cat-chips');
    if (!container) return;

    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    const userCategories = categories.filter((c) => c !== 'uncategorized');

    container.innerHTML = userCategories.map((cat) => `
      <span class="menu-cat-chip">
        <span class="menu-cat-chip-name">${cap(cat)}</span>
        <button class="menu-cat-delete" data-category="${cat}" type="button">×</button>
      </span>`).join('') || '<span class="menu-cat-hint">No categories yet.</span>';

    // Animate only the newly added chip
    if (newCategoryName) {
      const newChip = [...container.querySelectorAll('.menu-cat-chip')].find(
        el => el.querySelector('.menu-cat-chip-name')?.textContent.trim().toLowerCase()
              === newCategoryName.trim().toLowerCase()
      );
      if (newChip) newChip.classList.add('menu-cat-chip--entering');
    }
  }

  _addHandlerDeleteCategory(handler) {
    this._parentElement.addEventListener('click', (e) => {
      const btn = e.target.closest('.menu-cat-delete');
      if (!btn || !btn.closest('#menuModal')) return;
      handler(btn.dataset.category);
    });
  }

  _addHandlerCloseModal() {
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest(".modal-close");
      if (!btn || !btn.closest("#menuModal")) return;
      const inner = this._parentElement.querySelector(".menu-modal");
      if (inner) inner.classList.add("modal-exiting");
      setTimeout(() => {
        if (inner) inner.classList.remove("modal-exiting");
        const overlay = this._parentElement.querySelector("#menuModal");
        if (overlay) overlay.classList.add("hidden");
      }, 220);
      e.preventDefault();
    });
  }
}

export default new MenuListView();
