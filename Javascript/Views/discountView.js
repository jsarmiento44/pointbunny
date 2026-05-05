class DiscountView {
  _panel = document.querySelector("#discountPanel");
  _formModal = document.querySelector("#discountCodeModal");
  _list = document.querySelector("#discountCodeList");

  open() {
    this._panel.classList.remove("hidden", "cashflow-exiting");
  }

  close() {
    this._panel.classList.add("cashflow-exiting");
    setTimeout(() => {
      this._panel.classList.add("hidden");
      this._panel.classList.remove("cashflow-exiting");
    }, 220);
  }

  render(codes) {
    this._list.innerHTML = this._generateListMarkup(codes);
  }

  _generateListMarkup(codes) {
    if (!codes.length)
      return `<li class="discount-empty">No codes yet. Hit "+ New Code" to create your first promo.</li>`;

    return codes
      .map((dc) => {
        const isPaused = dc.status === "paused";
        const valueText =
          dc.type === "percentage"
            ? `${dc.value}% off`
            : `$${dc.value.toFixed(2)} off`;
        const usageText =
          dc.usageLimit === null
            ? "Unlimited uses"
            : `${dc.usageCount} / ${dc.usageLimit} use${dc.usageLimit === 1 ? "" : "s"}`;

        return `
          <li class="discount-code-item${isPaused ? " discount-code-item--paused" : ""}" data-id="${dc.id}">
            <div class="discount-code-top">
              <div class="discount-code-left">
                <span class="discount-code-badge">${dc.code}</span>
                <span class="discount-status-badge discount-status-badge--${dc.status}">
                  ${isPaused ? "Paused" : "Active"}
                </span>
              </div>
              <div class="discount-code-actions">
                <button class="btn discount-toggle-btn" data-id="${dc.id}" type="button">
                  ${isPaused ? "Activate" : "Pause"}
                </button>
                <button class="btn discount-edit-btn" data-id="${dc.id}" type="button">Edit</button>
                <button class="btn discount-delete-btn" data-id="${dc.id}" type="button">Delete</button>
              </div>
            </div>
            <div class="discount-code-details">
              <span class="discount-code-title">${dc.title}</span>
              <span class="discount-value-tag">${valueText}</span>
              <span class="discount-usage-text">${usageText}</span>
              ${dc.description ? `<span class="discount-code-desc">${dc.description}</span>` : ""}
            </div>
          </li>
        `;
      })
      .join("");
  }

  showForm(code = null) {
    const isEdit = code !== null;

    let usageType = "unlimited";
    let usageCustom = "";
    if (code) {
      if (code.usageLimit === null) usageType = "unlimited";
      else if (code.usageLimit === 1) usageType = "one-time";
      else {
        usageType = "custom";
        usageCustom = code.usageLimit;
      }
    }

    const formEl = this._formModal.querySelector("#discountCodeForm");
    formEl.innerHTML = `
      <button class="modal-close-btn" id="dcFormCloseBtn" type="button">&times;</button>
      <h2 class="edit-form-title">${isEdit ? "Edit Code" : "New Promo Code"}</h2>

      <div class="edit-field">
        <label for="dcTitle">Title</label>
        <input type="text" id="dcTitle" placeholder="e.g. Summer Sale" value="${isEdit ? code.title : ""}" />
      </div>

      <div class="edit-field">
        <label for="dcCode">Code</label>
        <input type="text" id="dcCode" placeholder="e.g. SUMMER20"
          value="${isEdit ? code.code : ""}" autocomplete="off" spellcheck="false" />
      </div>

      <div class="edit-field">
        <label for="dcDesc">
          Description
          <span class="field-optional">(optional)</span>
        </label>
        <input type="text" id="dcDesc" placeholder="e.g. Valid for dine-in orders"
          value="${isEdit ? code.description : ""}" />
      </div>

      <p class="adj-form-sublabel">Discount Type</p>
      <div class="adj-selector" id="dcTypeSelector">
        <button type="button" class="adj-selector-btn ${!isEdit || code.type === "percentage" ? "active" : ""}"
          data-value="percentage">Percentage (%)</button>
        <button type="button" class="adj-selector-btn ${isEdit && code.type === "fixed" ? "active" : ""}"
          data-value="fixed">Fixed ($)</button>
      </div>
      <input type="hidden" id="dcType" value="${isEdit ? code.type : "percentage"}" />

      <div class="edit-field">
        <label for="dcValue" id="dcValueLabel">
          ${isEdit && code.type === "fixed" ? "Amount ($)" : "Amount (%)"}
        </label>
        <input type="number" id="dcValue" min="0"
          step="${isEdit && code.type === "fixed" ? "0.01" : "1"}"
          placeholder="0" value="${isEdit ? code.value : ""}" />
      </div>

      <p class="adj-form-sublabel">Usage Limit</p>
      <div class="adj-selector" id="dcUsageSelector">
        <button type="button" class="adj-selector-btn ${usageType === "unlimited" ? "active" : ""}"
          data-value="unlimited">Unlimited</button>
        <button type="button" class="adj-selector-btn ${usageType === "one-time" ? "active" : ""}"
          data-value="one-time">One-time</button>
        <button type="button" class="adj-selector-btn ${usageType === "custom" ? "active" : ""}"
          data-value="custom">Custom</button>
      </div>
      <input type="hidden" id="dcUsageType" value="${usageType}" />

      <div class="edit-field" id="dcCustomUsageField" style="${usageType === "custom" ? "" : "display:none;"}">
        <label for="dcUsageLimit">Max uses</label>
        <input type="number" id="dcUsageLimit" min="2" step="1" placeholder="e.g. 100"
          value="${usageCustom}" />
      </div>

      <div class="adj-form-actions">
        <button type="button" class="btn" id="dcCancelBtn">Cancel</button>
        <button type="button" class="btn primary" id="dcSaveBtn"
          data-edit-id="${isEdit ? code.id : ""}">
          ${isEdit ? "Update" : "Create"}
        </button>
      </div>
    `;

    this._wireForm();
    this._formModal.classList.remove("hidden");
    document.getElementById("dcTitle").focus();
  }

  _wireForm() {
    // Type selector
    const typeSelector = document.getElementById("dcTypeSelector");
    typeSelector?.addEventListener("click", (e) => {
      const btn = e.target.closest(".adj-selector-btn");
      if (!btn) return;
      typeSelector
        .querySelectorAll(".adj-selector-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("dcType").value = btn.dataset.value;
      const label = document.getElementById("dcValueLabel");
      const input = document.getElementById("dcValue");
      if (btn.dataset.value === "fixed") {
        label.innerHTML = "Amount ($)";
        input.step = "0.01";
      } else {
        label.textContent = "Amount (%)";
        input.step = "1";
      }
    });

    // Usage selector
    const usageSelector = document.getElementById("dcUsageSelector");
    usageSelector?.addEventListener("click", (e) => {
      const btn = e.target.closest(".adj-selector-btn");
      if (!btn) return;
      usageSelector
        .querySelectorAll(".adj-selector-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("dcUsageType").value = btn.dataset.value;
      document.getElementById("dcCustomUsageField").style.display =
        btn.dataset.value === "custom" ? "" : "none";
    });

    // Auto-uppercase, no spaces
    document.getElementById("dcCode")?.addEventListener("input", (e) => {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.toUpperCase().replace(/\s/g, "");
      e.target.setSelectionRange(pos, pos);
    });

    document
      .getElementById("dcFormCloseBtn")
      ?.addEventListener("click", () => this.closeForm());
    document
      .getElementById("dcCancelBtn")
      ?.addEventListener("click", () => this.closeForm());
  }

  closeForm() {
    this._formModal.classList.add("hidden");
    this._formModal.querySelector("#discountCodeForm").innerHTML = "";
  }

  _getFormData() {
    const usageType = document.getElementById("dcUsageType")?.value;
    let usageLimit = null;
    if (usageType === "one-time") usageLimit = 1;
    else if (usageType === "custom")
      usageLimit = parseInt(document.getElementById("dcUsageLimit")?.value) || null;

    return {
      id: document.getElementById("dcSaveBtn")?.dataset.editId || null,
      title: document.getElementById("dcTitle")?.value.trim(),
      code: document.getElementById("dcCode")?.value.toUpperCase().trim(),
      description: document.getElementById("dcDesc")?.value.trim(),
      type: document.getElementById("dcType")?.value,
      value: parseFloat(document.getElementById("dcValue")?.value),
      usageLimit,
    };
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  _addHandlerOpen(handler) {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='discounts']");
      if (!btn) return;
      handler();
    });
  }

  _addHandlerClose(handler) {
    this._panel
      .querySelector(".discount-back")
      .addEventListener("click", () => handler());

    this._formModal.addEventListener("click", (e) => {
      if (e.target === this._formModal) this.closeForm();
    });
  }

  _addHandlerNewCode(handler) {
    this._panel
      .querySelector("#newDiscountCodeBtn")
      .addEventListener("click", () => handler());
  }

  _addHandlerSave(handler) {
    this._formModal.addEventListener("click", (e) => {
      if (!e.target.closest("#dcSaveBtn")) return;
      const data = this._getFormData();
      if (!data.title) {
        alert("Please enter a title.");
        return;
      }
      if (!data.code) {
        alert("Please enter a code.");
        return;
      }
      if (isNaN(data.value) || data.value < 0) {
        alert("Please enter a valid amount.");
        return;
      }
      if (
        document.getElementById("dcUsageType")?.value === "custom" &&
        !data.usageLimit
      ) {
        alert("Please enter the max number of uses.");
        return;
      }
      handler(data);
    });
  }

  _addHandlerEdit(handler) {
    this._list.addEventListener("click", (e) => {
      const btn = e.target.closest(".discount-edit-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerDelete(handler) {
    this._list.addEventListener("click", (e) => {
      const btn = e.target.closest(".discount-delete-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerToggleStatus(handler) {
    this._list.addEventListener("click", (e) => {
      const btn = e.target.closest(".discount-toggle-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }
}

export default new DiscountView();
