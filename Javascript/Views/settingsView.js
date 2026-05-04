class SettingsView {
  _modal = document.getElementById("settingsModal");
  _openBtn = document.getElementById("settingsBtn");
  _closeBtn = document.getElementById("settingsCloseBtn");
  _addBtn = document.getElementById("addAdjustmentBtn");
  _list = document.getElementById("adjustmentList");
  _showRemovedToggle = document.getElementById("showRemovedToggle");
  _printingToggle = document.getElementById("printingToggle");
  _confirmPrintToggle = document.getElementById("confirmPrintToggle");
  _categoryList = document.getElementById("categoryList");
  _categoryInput = document.getElementById("categoryInput");
  _addCategoryBtn = document.getElementById("addCategoryBtn");
  _pendingFlash = false;

  // ── Open / Close ─────────────────────────────────────────────────────────────

  _addHandlerOpen(handler) {
    this._openBtn.addEventListener("click", () => {
      this._modal.classList.remove("hidden");
      handler();
    });
  }

  _addHandlerClose() {
    this._closeBtn.addEventListener("click", () => this._close());
    this._modal.addEventListener("click", (e) => {
      if (e.target === this._modal) this._close();
    });
  }

  _close() {
    const inner = this._modal.querySelector(".modal-container");
    if (inner) inner.classList.add("modal-exiting");
    setTimeout(() => {
      if (inner) inner.classList.remove("modal-exiting");
      this._modal.classList.add("hidden");
      this._removeForm();
    }, 220);
  }

  // ── Category List ────────────────────────────────────────────────────────────

  renderCategories(categories) {
    if (categories.length === 0) {
      this._categoryList.innerHTML =
        '<li class="adjustment-empty">No categories yet.</li>';
      return;
    }
    this._categoryList.innerHTML = categories
      .map(
        (cat) => `
        <li class="category-item">
          <span class="category-item-name">${cat[0].toUpperCase() + cat.slice(1)}</span>
          <button class="category-delete-btn" data-category="${cat}" type="button">Delete</button>
        </li>`,
      )
      .join("");

    if (this._pendingFlash) {
      this._pendingFlash = false;
      const items = this._categoryList.querySelectorAll(".category-item");
      const last = items[items.length - 1];
      if (last) {
        requestAnimationFrame(() => last.classList.add("entering"));
        setTimeout(() => last.classList.remove("entering"), 800);
      }
    }
  }

  _addHandlerAddCategory(handler) {
    const submit = () => {
      if (!this._categoryInput.value.trim()) return;
      this._pendingFlash = true;
      handler(this._categoryInput.value);
      this._categoryInput.value = "";
    };
    this._addCategoryBtn.addEventListener("click", submit);
    this._categoryInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      submit();
    });
  }

  _addHandlerDeleteCategory(handler) {
    this._categoryList.addEventListener("click", (e) => {
      const btn = e.target.closest(".category-delete-btn");
      if (!btn) return;
      handler(btn.dataset.category);
    });
  }

  // ── Adjustment List ───────────────────────────────────────────────────────────

  renderAdjustments(adjustments) {
    if (adjustments.length === 0) {
      this._list.innerHTML =
        '<li class="adjustment-empty">No adjustments yet.</li>';
      return;
    }

    this._list.innerHTML = adjustments
      .map(
        (adj) => `
        <li class="adjustment-item" data-id="${adj.id}">
          <label class="switch">
            <input type="checkbox" class="adj-toggle" ${adj.enabled ? "checked" : ""} />
            <span class="slider round"></span>
          </label>
          <div class="adjustment-item-info">
            <div class="adjustment-item-name">${adj.name}</div>
            <div class="adjustment-item-meta">
              ${adj.type === "fee" ? "Fee" : "Discount"} &middot;
              ${adj.calculation === "fixed" ? "&#8369;" + adj.value.toFixed(2) : adj.value + "%"}
            </div>
          </div>
          <div class="adjustment-item-controls">
            <button class="adjustment-edit-btn" data-id="${adj.id}" type="button">Edit</button>
            <button class="adjustment-delete-btn" data-id="${adj.id}" type="button">Delete</button>
          </div>
        </li>
      `,
      )
      .join("");
  }

  // ── Add / Edit Form ───────────────────────────────────────────────────────────

  showForm(adjustment = null) {
    this._removeForm();
    const isEdit = adjustment !== null;

    const html = `
      <div class="adj-form" id="adjForm">
        <h4 class="adj-form-title">${isEdit ? "Edit Adjustment" : "New Adjustment"}</h4>

        <div class="edit-field">
          <label for="adjName">Name</label>
          <input type="text" id="adjName" placeholder="e.g. VAT, Service Charge"
            value="${isEdit ? adjustment.name : ""}" />
        </div>

        <p class="adj-form-sublabel">Type</p>
        <div class="adj-selector" id="adjTypeSelector">
          <button type="button" class="adj-selector-btn ${!isEdit || adjustment.type === "fee" ? "active" : ""}" data-value="fee">Fee</button>
          <button type="button" class="adj-selector-btn ${isEdit && adjustment.type === "discount" ? "active" : ""}" data-value="discount">Discount</button>
        </div>
        <input type="hidden" id="adjType" value="${isEdit ? adjustment.type : "fee"}" />

        <p class="adj-form-sublabel">Calculation</p>
        <div class="adj-selector" id="adjCalcSelector">
          <button type="button" class="adj-selector-btn ${!isEdit || adjustment.calculation === "fixed" ? "active" : ""}" data-value="fixed">Fixed (&#8369;)</button>
          <button type="button" class="adj-selector-btn ${isEdit && adjustment.calculation === "percentage" ? "active" : ""}" data-value="percentage">
            Percentage (%)
            <span class="adj-info-tip">i</span>
          </button>
        </div>
        <input type="hidden" id="adjCalc" value="${isEdit ? adjustment.calculation : "fixed"}" />

        <div class="edit-field">
          <label for="adjValue" id="adjValueLabel">
            ${isEdit && adjustment.calculation === "percentage" ? "Value (%)" : "Value (&#8369;)"}
          </label>
          <input type="number" id="adjValue" min="0" step="0.01" placeholder="0"
            value="${isEdit ? adjustment.value : ""}" />
        </div>

        <div class="adj-form-actions">
          <button type="button" class="btn" id="adjCancelBtn">Cancel</button>
          <button type="button" class="btn primary" id="adjSaveBtn"
            data-edit-id="${isEdit ? adjustment.id : ""}">
            ${isEdit ? "Update" : "Add"}
          </button>
        </div>
      </div>
    `;

    this._list.insertAdjacentHTML("beforebegin", html);

    // Wire selector groups
    document.querySelectorAll(".adj-selector").forEach((group) => {
      group.addEventListener("click", (e) => {
        const btn = e.target.closest(".adj-selector-btn");
        if (!btn) return;
        group
          .querySelectorAll(".adj-selector-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (group.id === "adjCalcSelector") {
          document.getElementById("adjCalc").value = btn.dataset.value;
          document.getElementById("adjValueLabel").textContent =
            btn.dataset.value === "percentage" ? "Value (%)" : "Value (₱)";
        } else {
          document.getElementById("adjType").value = btn.dataset.value;
        }
      });
    });

    document
      .getElementById("adjCancelBtn")
      .addEventListener("click", () => this._removeForm());

    this._wireInfoTip();
    document.getElementById("adjName").focus();
  }

  _wireInfoTip() {
    document.querySelectorAll(".adj-info-tip").forEach((tip) => {
      tip.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelector(".adj-tooltip")?.remove();

        const rect = tip.getBoundingClientRect();
        const el = document.createElement("div");
        el.className = "adj-tooltip";
        el.textContent =
          "% of the running subtotal at the time this adjustment is applied";
        document.body.appendChild(el);

        el.style.left = `${rect.left + rect.width / 2 - el.offsetWidth / 2}px`;
        el.style.top = `${rect.top - el.offsetHeight - 8}px`;

        setTimeout(() => {
          document.addEventListener("click", () => el.remove(), { once: true });
        }, 0);
      });
    });
  }

  _removeForm() {
    document.getElementById("adjForm")?.remove();
  }

  _getFormData() {
    return {
      id: document.getElementById("adjSaveBtn")?.dataset.editId || null,
      name: document.getElementById("adjName")?.value.trim(),
      type: document.getElementById("adjType")?.value,
      calculation: document.getElementById("adjCalc")?.value,
      value: parseFloat(document.getElementById("adjValue")?.value),
    };
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  _addHandlerAdd() {
    this._addBtn.addEventListener("click", () => this.showForm());
  }

  _addHandlerSave(handler) {
    this._modal.addEventListener("click", (e) => {
      if (!e.target.closest("#adjSaveBtn")) return;
      const data = this._getFormData();
      if (!data.name) {
        alert("Please enter a name.");
        return;
      }
      if (isNaN(data.value) || data.value < 0) {
        alert("Please enter a valid value.");
        return;
      }
      handler(data);
      this._removeForm();
    });
  }

  _addHandlerEdit(handler) {
    this._list.addEventListener("click", (e) => {
      const btn = e.target.closest(".adjustment-edit-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerDelete(handler) {
    this._list.addEventListener("click", (e) => {
      const btn = e.target.closest(".adjustment-delete-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerToggle(handler) {
    this._list.addEventListener("change", (e) => {
      const toggle = e.target.closest(".adj-toggle");
      if (!toggle) return;
      const id = toggle.closest(".adjustment-item").dataset.id;
      handler(id);
    });
  }

  _addHandlerShowRemoved(handler) {
    this._showRemovedToggle.addEventListener("change", () => {
      handler(this._showRemovedToggle.checked);
    });
  }

  syncShowRemovedToggle(value) {
    this._showRemovedToggle.checked = value;
  }

  _addHandlerTogglePrinting(handler) {
    this._printingToggle.addEventListener("change", () => {
      handler(this._printingToggle.checked);
    });
  }

  syncPrintingToggle(value) {
    this._printingToggle.checked = value;
  }

  _addHandlerToggleConfirmPrint(handler) {
    this._confirmPrintToggle.addEventListener("change", () => {
      handler(this._confirmPrintToggle.checked);
    });
  }

  syncConfirmPrintToggle(value) {
    this._confirmPrintToggle.checked = value;
  }
}

export default new SettingsView();
