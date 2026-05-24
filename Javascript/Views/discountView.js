class DiscountView {
  _panel      = document.querySelector("#discountPanel");
  _formModal  = document.querySelector("#discountCodeModal");
  _list       = document.querySelector("#discountCodeList");
  _adjList    = document.querySelector("#adjPanelList");
  _adjSection = document.querySelector("#adjPanelSection");
  _adjModal   = document.querySelector("#adjPanelModal");
  _adjForm    = document.querySelector("#adjPanelForm");
  _currentSection = "adjustments";

  // ── Open / Close ─────────────────────────────────────────────────────────────

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

  // ── Section switching ────────────────────────────────────────────────────────

  _switchSection(section) {
    this._currentSection = section;
    // Toggle nav tabs
    this._panel.querySelectorAll(".adj-nav-tab").forEach((btn) => {
      btn.classList.toggle("adj-nav-tab--active", btn.dataset.section === section);
    });
    // Toggle sections
    this._panel.querySelectorAll(".adj-panel-section").forEach((sec) => {
      sec.classList.toggle("hidden", sec.dataset.section !== section);
    });
  }

  _addHandlerNavTabs() {
    this._panel.querySelector(".adj-panel-sidebar")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".adj-nav-tab");
      if (!btn) return;
      this._switchSection(btn.dataset.section);
    });
  }

  // ── Promo Codes ──────────────────────────────────────────────────────────────

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
            : `${dc.usageCount} / ${dc.usageLimit} use${dc.usageLimit === 1 ? "" : "s"}`;

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

  // ── Auto Adjustments ─────────────────────────────────────────────────────────

  renderAdjustments(adjustments) {
    if (!this._adjList) return;
    if (!adjustments || adjustments.length === 0) {
      this._adjList.innerHTML = '<li class="adjustment-empty">No adjustments yet. Hit "+ Add" to create one.</li>';
      return;
    }
    this._adjList.innerHTML = adjustments
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
              ${adj.calculation === "fixed" ? "$" + adj.value.toFixed(2) : adj.value + "%"}
            </div>
          </div>
          <div class="adjustment-item-controls">
            <button class="adjustment-edit-btn adj-panel-edit-btn" data-id="${adj.id}" type="button">Edit</button>
            <button class="adjustment-delete-btn adj-panel-delete-btn" data-id="${adj.id}" type="button">Delete</button>
          </div>
        </li>
      `
      )
      .join("");
  }

  showAdjustmentForm(adjustment = null) {
    const isEdit = adjustment !== null;
    this._adjForm.innerHTML = `
      <button class="modal-close-btn" id="adjPanelCloseBtn" type="button">&times;</button>
      <h2 class="edit-form-title">${isEdit ? "Edit Adjustment" : "New Adjustment"}</h2>

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
        <button type="button" class="adj-selector-btn ${!isEdit || adjustment.calculation === "fixed" ? "active" : ""}" data-value="fixed">Fixed ($)</button>
        <button type="button" class="adj-selector-btn ${isEdit && adjustment.calculation === "percentage" ? "active" : ""}
          " data-value="percentage">
          Percentage (%)
          <span class="adj-info-tip">i</span>
        </button>
      </div>
      <input type="hidden" id="adjCalc" value="${isEdit ? adjustment.calculation : "fixed"}" />

      <div class="edit-field">
        <label for="adjValue" id="adjValueLabel">
          ${isEdit && adjustment.calculation === "percentage" ? "Value (%)" : "Value ($)"}
        </label>
        <input type="number" id="adjValue" min="0" step="0.01" placeholder="0"
          value="${isEdit ? adjustment.value : ""}" />
      </div>

      <div class="adj-form-actions">
        <button type="button" class="btn" id="adjPanelCancelBtn">Cancel</button>
        <button type="button" class="btn primary" id="adjSaveBtn"
          data-edit-id="${isEdit ? adjustment.id : ""}">
          ${isEdit ? "Update" : "Add"}
        </button>
      </div>
    `;

    this._wireAdjForm();
    this._adjModal.classList.remove("hidden");
    document.getElementById("adjName")?.focus();
  }

  _wireAdjForm() {
    // Type selector
    const typeSelector = document.getElementById("adjTypeSelector");
    typeSelector?.addEventListener("click", (e) => {
      const btn = e.target.closest(".adj-selector-btn");
      if (!btn) return;
      typeSelector.querySelectorAll(".adj-selector-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("adjType").value = btn.dataset.value;
    });

    // Calc selector
    const calcSelector = document.getElementById("adjCalcSelector");
    calcSelector?.addEventListener("click", (e) => {
      const btn = e.target.closest(".adj-selector-btn");
      if (!btn) return;
      calcSelector.querySelectorAll(".adj-selector-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("adjCalc").value = btn.dataset.value;
      const lbl = document.getElementById("adjValueLabel");
      if (lbl) lbl.textContent = btn.dataset.value === "percentage" ? "Value (%)" : "Value ($)";
    });

    // % info tip
    document.querySelector(".adj-info-tip")?.addEventListener("mouseenter", (e) => {
      const rect = e.target.getBoundingClientRect();
      const el = document.createElement("div");
      el.className = "adj-tooltip";
      el.textContent = "% of the running subtotal at the time this adjustment is applied";
      document.body.appendChild(el);
      el.style.left = `${rect.left + rect.width / 2 - el.offsetWidth / 2}px`;
      el.style.top = `${rect.bottom + 8}px`;
      e.target._tooltip = el;
    });
    document.querySelector(".adj-info-tip")?.addEventListener("mouseleave", (e) => {
      e.target._tooltip?.remove();
    });

    document.getElementById("adjPanelCloseBtn")?.addEventListener("click", () => this.closeAdjForm());
    document.getElementById("adjPanelCancelBtn")?.addEventListener("click", () => this.closeAdjForm());
  }

  closeAdjForm() {
    this._adjModal.classList.add("hidden");
    this._adjForm.innerHTML = "";
  }

  _getAdjFormData() {
    return {
      id: document.getElementById("adjSaveBtn")?.dataset.editId || null,
      name: document.getElementById("adjName")?.value.trim(),
      type: document.getElementById("adjType")?.value,
      calculation: document.getElementById("adjCalc")?.value,
      value: parseFloat(document.getElementById("adjValue")?.value),
    };
  }

  // ── Handlers — open / close ───────────────────────────────────────────────────

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

    // Close promo form on backdrop click
    this._formModal.addEventListener("click", (e) => {
      if (e.target === this._formModal) this.closeForm();
    });
    // Close adj form on backdrop click
    this._adjModal.addEventListener("click", (e) => {
      if (e.target === this._adjModal) this.closeAdjForm();
    });
  }

  // ── Handlers — promo codes ────────────────────────────────────────────────────

  _addHandlerNewCode(handler) {
    this._panel
      .querySelector("#newDiscountCodeBtn")
      .addEventListener("click", () => handler());
  }

  _addHandlerSave(handler) {
    this._formModal.addEventListener("click", (e) => {
      if (!e.target.closest("#dcSaveBtn")) return;
      const data = this._getFormData();
      if (!data.title) { alert("Please enter a title."); return; }
      if (!data.code) { alert("Please enter a code."); return; }
      if (isNaN(data.value) || data.value < 0) { alert("Please enter a valid amount."); return; }
      if (document.getElementById("dcUsageType")?.value === "custom" && !data.usageLimit) {
        alert("Please enter the max number of uses."); return;
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

  // ── Handlers — auto adjustments ───────────────────────────────────────────────

  _addHandlerAdjAdd() {
    this._panel
      .querySelector("#adjPanelAddBtn")
      ?.addEventListener("click", () => this.showAdjustmentForm());
  }

  _addHandlerAdjSave(handler) {
    this._adjModal.addEventListener("click", (e) => {
      if (!e.target.closest("#adjSaveBtn")) return;
      const data = this._getAdjFormData();
      if (!data.name) { alert("Please enter a name."); return; }
      if (isNaN(data.value) || data.value < 0) { alert("Please enter a valid value."); return; }
      handler(data);
      this.closeAdjForm();
    });
  }

  _addHandlerAdjEdit(handler) {
    this._adjList.addEventListener("click", (e) => {
      const btn = e.target.closest(".adj-panel-edit-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerAdjDelete(handler) {
    this._adjList.addEventListener("click", (e) => {
      const btn = e.target.closest(".adj-panel-delete-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerAdjToggle(handler) {
    this._adjList.addEventListener("change", (e) => {
      const toggle = e.target.closest(".adj-toggle");
      if (!toggle) return;
      const id = toggle.closest(".adjustment-item").dataset.id;
      handler(id);
    });
  }
}

export default new DiscountView();
