import View from "./view.js";

class OrderCheckOutView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _subtotal;
  _adjResult;
  _totalPrice;
  _customerPayment;
  _customerChange;
  _orderType = 'dine-in';

  // ── Cart items markup ─────────────────────────────────────────────────────────

  _generateCartItemsMarkup(cart) {
    return cart
      .map(
        (item, index) => {
          const allVariants = item.selectedVariants.map((v) => v.variantName);
          return `
          <div class="pos-cart-item cart-item-row">
            <div class="pos-cart-item-info">
              <span class="pos-cart-item-name">${item.itemName} ×${item.quantity}</span>
              ${allVariants.length ? `<span class="pos-cart-item-variants">${allVariants.join(", ")}</span>` : ""}
            </div>
            <div class="pos-cart-item-right">
              <span class="pos-cart-item-price">$${item.totalPrice}</span>
              <button class="checkout-cart-delete-btn pos-cart-delete" data-cart-index="${index}" type="button">×</button>
            </div>
          </div>`;
        },
      )
      .join("");
  }

  _refreshCartItems(cart) {
    const el = this._parentElement.querySelector("#cartItems");
    if (el) el.innerHTML = this._generateCartItemsMarkup(cart);
  }

  // ── Promo code section ────────────────────────────────────────────────────────

  _generatePromoSection(promoCode, adjResult) {
    if (promoCode) {
      const promoLine = adjResult.lineItems.find((li) => li.source === "promo-code");
      const amtText = promoLine
        ? `−$${Math.abs(promoLine.computedAmount).toFixed(2)}`
        : promoCode.type === "percentage"
        ? `${promoCode.value}% off`
        : `$${promoCode.value.toFixed(2)} off`;

      return `
        <div class="promo-code-section promo-code-section--applied">
          <div class="promo-applied-info">
            <span class="promo-code-badge-sm">${promoCode.code}</span>
            <span class="promo-applied-name">${promoCode.title}</span>
            <span class="promo-applied-amount">${amtText}</span>
          </div>
          <button type="button" class="promo-remove-btn" id="removePromoBtn">Remove</button>
        </div>
      `;
    }

    return `
      <div class="promo-code-section">
        <div class="promo-input-row">
          <input type="text" id="promoCodeInput" placeholder="Promo code"
            autocomplete="off" spellcheck="false" style="text-transform:uppercase;" />
          <button type="button" id="applyPromoBtn">Apply</button>
        </div>
      </div>
    `;
  }

  // ── Adj section markup (reused by both initial render and in-place refresh) ──

  _generateAdjSectionMarkup(subtotal, allAdj, adjResult, showRemoved, promoCode = null) {
    const activeLines = adjResult.lineItems;
    const removedLines = allAdj.filter((a) => a.removed);

    const nonPromoLines = activeLines.filter((li) => li.source !== "promo-code");
    const hasVisible =
      nonPromoLines.length > 0 ||
      promoCode ||
      (showRemoved && removedLines.length > 0);

    const activeHtml = nonPromoLines
      .map(
        (adj) => `
        <div class="receipt-adj-item" data-adj-id="${adj.id}">
          <div class="receipt-adj-info">
            <span>${adj.name}${adj.calculation === "percentage" ? ` (${adj.appliedValue}%)` : ""}</span>
            <span class="receipt-adj-amount ${adj.type}">
              ${adj.computedAmount >= 0 ? "+" : ""}$${adj.computedAmount.toFixed(2)}
            </span>
          </div>
          <div class="receipt-adj-controls">
            ${adj.source === 'manual' ? `<button class="receipt-adj-edit-btn" data-adj-id="${adj.id}" type="button">Edit</button>` : ''}
            <button class="receipt-adj-remove-btn" data-adj-id="${adj.id}" type="button">&times;</button>
          </div>
        </div>
      `,
      )
      .join("");

    const removedHtml = showRemoved
      ? removedLines
          .map(
            (adj) => `
          <div class="receipt-adj-item receipt-adj-item--removed">
            <div class="receipt-adj-info">
              <span>${adj.name}${adj.calculation === "percentage" ? ` (${adj.appliedValue}%)` : ""} <em>(removed)</em></span>
              <span>$0.00</span>
            </div>
          </div>
        `,
          )
          .join("")
      : "";

    return `
      ${this._generatePromoSection(promoCode, adjResult)}
      ${
        hasVisible
          ? `
        <div class="cart-subtotal">
          <span>Subtotal</span>
          <span>$${subtotal.toFixed(2)}</span>
        </div>
        ${
          activeHtml || removedHtml
            ? `<div class="receipt-adj-list">${activeHtml}${removedHtml}</div>`
            : ""
        }
        <div class="adj-line-divider"></div>
      `
          : ""
      }
      <button class="receipt-add-adj-btn" type="button">+ Add adjustment</button>
    `;
  }

  // ── Main markup ───────────────────────────────────────────────────────────────

  _generateMarkUp() {
    const allAdj = this._data.currentReceiptAdjustments ?? [];
    const adjResult = this._adjResult ?? {
      lineItems: [],
      finalTotal: this._totalPrice,
    };
    const showRemoved = this._data.settings?.showRemovedAdjustments ?? true;
    const subtotal = this._subtotal ?? this._totalPrice;
    const printingOn = this._data.settings?.printingEnabled ?? true;

    return `
<div class="pos-screen" id="newOrderModal">
  <div class="pos-header">
    <button class="checkout-back-btn pos-back-btn" type="button" title="Back to order">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Back
    </button>
    <h2 class="pos-title">Checkout</h2>
    <button class="modal-close pos-close-btn" aria-label="Close">&times;</button>
  </div>

  <div class="pos-checkout-body">
    <div class="pos-checkout-cart">
      <h3 class="pos-checkout-section-title">Order Summary</h3>
      <div id="cartItems" class="pos-checkout-cart-list">
        ${this._generateCartItemsMarkup(this._data.cart)}
      </div>
    </div>

    <div class="pos-checkout-payment">
      ${this._data.settings.orderTypeEnabled ? `<div class="order-type-toggle">
        <button class="order-type-btn${this._orderType === 'dine-in' ? ' order-type-btn--active' : ''}" data-order-type="dine-in" type="button">Dine In</button>
        <button class="order-type-btn${this._orderType === 'takeout' ? ' order-type-btn--active' : ''}" data-order-type="takeout" type="button">Takeout</button>
      </div>` : ''}
      <div id="receiptAdjSection">
        ${this._generateAdjSectionMarkup(subtotal, allAdj, adjResult, showRemoved)}
      </div>

      <div class="cart-total pos-checkout-total">
        <span>Total</span>
        <span id="cartTotal">$${this._totalPrice.toFixed(2)}</span>
      </div>

      <div class="receive-container">
        <label for="customerPayment">Payment</label>
        <div class="pos-payment-row">
          <input type="number" id="customerPayment" placeholder="Enter amount received" min="0" step="0.01" style="flex:1;min-width:0;" />
          <button id="enterPaymentBtn">Enter</button>
        </div>
      </div>

      <label class="pos-change-label">
        Change
        <div id="changeAmount" class="change-box">$0.00</div>
      </label>

      <button class="print-receipt-btn${printingOn ? '' : ' print-receipt-btn--off'} hidden" id="printReceiptBtn">
        ${printingOn ? 'Print Receipt' : 'Record Sale<span class="print-off-note">Printing is off · Enable in Settings</span>'}
      </button>
    </div>
  </div>
</div>
    `;
  }

  // ── In-place refresh (does not reset the payment input) ───────────────────────

  _refreshAdjustments(subtotal, allAdj, adjResult, showRemoved, promoCode = null) {
    this._subtotal = subtotal;
    this._adjResult = adjResult;
    this._totalPrice = adjResult.finalTotal;

    const section = this._parentElement.querySelector("#receiptAdjSection");
    if (section) {
      section.innerHTML = this._generateAdjSectionMarkup(
        subtotal,
        allAdj,
        adjResult,
        showRemoved,
        promoCode,
      );
    }

    const totalEl = this._parentElement.querySelector("#cartTotal");
    if (totalEl) totalEl.textContent = `$${adjResult.finalTotal.toFixed(2)}`;

    // Total changed — reset payment validation state
    const changeBox = this._parentElement.querySelector("#changeAmount");
    if (changeBox) {
      changeBox.textContent = "$0.00";
      changeBox.classList.remove("ok");
    }
    this._parentElement
      .querySelector(".print-receipt-btn")
      ?.classList.add("hidden");
  }

  // ── Inline forms ──────────────────────────────────────────────────────────────

  _showReceiptEditForm(adj) {
    this._removeReceiptForms();
    const item = this._parentElement.querySelector(
      `.receipt-adj-item[data-adj-id="${adj.id}"]`,
    );
    if (!item) return;

    const html = `
      <div class="receipt-edit-form" id="receiptEditForm">
        <label class="adj-form-sublabel">
          New value (${adj.calculation === "percentage" ? "%" : "$"})
        </label>
        <input type="number" id="receiptEditValue" value="${adj.appliedValue}" min="0" step="0.01" />
        <div class="adj-form-actions" style="margin-top:6px;">
          <button class="btn" id="receiptEditCancelBtn" type="button">Cancel</button>
          <button class="btn primary" id="receiptEditSaveBtn" data-adj-id="${adj.id}" type="button">Save</button>
        </div>
      </div>
    `;
    item.insertAdjacentHTML("afterend", html);
    document
      .getElementById("receiptEditCancelBtn")
      .addEventListener("click", () => this._removeReceiptForms());
    document.getElementById("receiptEditValue").focus();
  }

  _showReceiptAddManualForm() {
    this._removeReceiptForms();
    const modal = this._parentElement.querySelector(".pos-screen");
    if (!modal) return;

    const html = `
      <div class="receipt-manual-overlay" id="receiptManualForm">
      <div class="adj-form receipt-manual-card">
        <h4 class="adj-form-title">Add One-off Adjustment</h4>

        <div class="edit-field">
          <label for="receiptManualName">Name</label>
          <input type="text" id="receiptManualName" placeholder="e.g. Discount, Tip" />
        </div>

        <p class="adj-form-sublabel">Type</p>
        <div class="adj-selector" id="receiptManualTypeSelector">
          <button type="button" class="adj-selector-btn active" data-value="fee">Fee</button>
          <button type="button" class="adj-selector-btn" data-value="discount">Discount</button>
        </div>
        <input type="hidden" id="receiptManualType" value="fee" />

        <p class="adj-form-sublabel">Calculation</p>
        <div class="adj-selector" id="receiptManualCalcSelector">
          <button type="button" class="adj-selector-btn active" data-value="fixed">Fixed ($)</button>
          <button type="button" class="adj-selector-btn" data-value="percentage">
            Percentage (%)
            <span class="adj-info-tip">i</span>
          </button>
        </div>
        <input type="hidden" id="receiptManualCalc" value="fixed" />

        <div class="edit-field">
          <label id="receiptManualValueLabel">Value ($)</label>
          <input type="number" id="receiptManualValue" min="0" step="0.01" placeholder="0" />
        </div>

        <div class="adj-form-actions">
          <button type="button" class="btn" id="receiptManualCancelBtn">Cancel</button>
          <button type="button" class="btn primary" id="receiptManualSaveBtn">Add</button>
        </div>
      </div>
      </div>
    `;
    modal.insertAdjacentHTML("beforeend", html);

    document
      .querySelectorAll("#receiptManualTypeSelector, #receiptManualCalcSelector")
      .forEach((group) => {
        group.addEventListener("click", (e) => {
          const btn = e.target.closest(".adj-selector-btn");
          if (!btn) return;
          group
            .querySelectorAll(".adj-selector-btn")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          if (group.id === "receiptManualCalcSelector") {
            document.getElementById("receiptManualCalc").value = btn.dataset.value;
            document.getElementById("receiptManualValueLabel").textContent =
              btn.dataset.value === "percentage" ? "Value (%)" : "Value ($)";
          } else {
            document.getElementById("receiptManualType").value = btn.dataset.value;
          }
        });
      });

    document
      .getElementById("receiptManualCancelBtn")
      .addEventListener("click", () => this._removeReceiptForms());
    this._wireInfoTip();
    document.getElementById("receiptManualName").focus();
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

  _removeReceiptForms() {
    document.getElementById("receiptEditForm")?.remove();
    document.getElementById("receiptManualForm")?.remove();
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  _wireOrderType() {
    this._parentElement.addEventListener('click', (e) => {
      const btn = e.target.closest('.order-type-btn');
      if (!btn) return;
      this._orderType = btn.dataset.orderType;
      this._parentElement.querySelectorAll('.order-type-btn').forEach(b =>
        b.classList.toggle('order-type-btn--active', b === btn)
      );
    });
  }

  _addHandlerShowCheckout(handler) {
    this._parentElement.addEventListener("click", function (e) {
      const btn = e.target.closest(".btn-checkout");
      if (!btn) return;
      handler();
    });
  }

  _subtractChange() {
    // Block -, +, e, E from being typed into the payment field
    this._parentElement.addEventListener("keydown", (e) => {
      if (e.target.id !== "customerPayment") return;
      if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
    });

    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest("#enterPaymentBtn");
      if (!btn) return;

      const changeBox = document.querySelector(".change-box");
      const raw = this._parentElement.querySelector("#customerPayment").value;
      const payment = parseFloat(raw);

      if (!raw || isNaN(payment) || payment <= 0) {
        changeBox.classList.remove("ok");
        changeBox.textContent = "Enter a valid payment amount";
        return;
      }

      this._customerPayment = payment;

      if (payment < this._totalPrice) {
        changeBox.textContent = `Payment must be higher or equal to order total`;
      } else {
        const change = payment - this._totalPrice;
        changeBox.classList.add("ok");
        changeBox.textContent = change;
        this._customerChange = change;
        document.querySelector(".print-receipt-btn").classList.toggle("hidden");
      }
    });
  }

  _addHandlerPrintReceipt(handler) {
    this._parentElement.addEventListener("click", function (e) {
      const btn = e.target.closest("#printReceiptBtn");
      if (!btn) return;
      handler();
    });
  }

  _addHandlerReceiptEdit(handler) {
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest(".receipt-adj-edit-btn");
      if (!btn) return;
      handler(btn.dataset.adjId);
    });
  }

  _addHandlerReceiptRemove(handler) {
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest(".receipt-adj-remove-btn");
      if (!btn) return;
      handler(btn.dataset.adjId);
    });
  }

  _addHandlerReceiptAddManual(handler) {
    this._parentElement.addEventListener("click", (e) => {
      if (!e.target.closest(".receipt-add-adj-btn")) return;
      handler();
    });
  }

  _addHandlerReceiptSaveOverride(handler) {
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest("#receiptEditSaveBtn");
      if (!btn) return;
      const value = parseFloat(
        document.getElementById("receiptEditValue").value,
      );
      if (isNaN(value) || value < 0) {
        alert("Please enter a valid value.");
        return;
      }
      handler({ id: btn.dataset.adjId, value });
    });
  }

  _addHandlerReceiptSaveManual(handler) {
    this._parentElement.addEventListener("click", (e) => {
      if (!e.target.closest("#receiptManualSaveBtn")) return;
      const name = document.getElementById("receiptManualName")?.value.trim();
      const type = document.getElementById("receiptManualType")?.value;
      const calculation = document.getElementById("receiptManualCalc")?.value;
      const value = parseFloat(
        document.getElementById("receiptManualValue")?.value,
      );
      if (!name) {
        alert("Please enter a name.");
        return;
      }
      if (isNaN(value) || value < 0) {
        alert("Please enter a valid value.");
        return;
      }
      handler({ name, type, calculation, value });
      this._removeReceiptForms();
    });
  }

  _addHandlerApplyPromo(handler) {
    this._parentElement.addEventListener("click", (e) => {
      if (!e.target.closest("#applyPromoBtn")) return;
      const input = this._parentElement.querySelector("#promoCodeInput");
      const code = input?.value.trim();
      if (!code) return;
      handler(code);
    });
  }

  _addHandlerRemovePromo(handler) {
    this._parentElement.addEventListener("click", (e) => {
      if (!e.target.closest("#removePromoBtn")) return;
      handler();
    });
  }

  _addHandlerBack(handler) {
    this._parentElement.addEventListener("click", (e) => {
      if (!e.target.closest(".checkout-back-btn")) return;
      handler();
    });
  }

  _addHandlerDeleteCartItem(handler) {
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest(".checkout-cart-delete-btn");
      if (!btn) return;
      handler(Number(btn.dataset.cartIndex));
    });
  }

  _hideModal() {
    this._parentElement.innerHTML = "";
  }
}

export default new OrderCheckOutView();
