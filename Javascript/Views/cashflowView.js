import View from "./view.js";

const fmt = (n) =>
  "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const pad = (n) => String(n).padStart(2, "0");

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Inline serving-time text for the cashflow row list
const fmtServing = (sale) => {
  if (sale.timed_out) {
    // Timed-out orders: show duration in red regardless of length, or just the label if no timestamp
    if (!sale.prepared_at) return ` · <span class="cf-timeout-tag">⏱️ Timed out</span>`;
    const mins = (new Date(sale.prepared_at) - new Date(sale.sale_date)) / 60000;
    if (mins < 0) return ` · <span class="cf-timeout-tag">⏱️ Timed out</span>`;
    const m = Math.floor(mins);
    const s = Math.round((mins - m) * 60);
    const dur = m > 0 ? `${m}m ${s}s` : `${s}s`;
    return ` · <span class="cf-timeout-tag">⏱️ ${dur} (timed out)</span>`;
  }
  // Normal orders: only show if prepared_at is set and within sanity range
  if (!sale.prepared_at) return "";
  const mins = (new Date(sale.prepared_at) - new Date(sale.sale_date)) / 60000;
  if (mins < 0 || mins > 120) return "";
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  return ` · 🍳 ${m > 0 ? `${m}m ${s}s` : `${s}s`}`;
};

// Block-level serving-time line for the receipt modal (never included in printing)
const _servingLine = (sale) => {
  if (sale.timed_out) {
    if (!sale.prepared_at) return `<p class="sr-serving sr-serving--timeout">⏱️ Timed out</p>`;
    const mins = (new Date(sale.prepared_at) - new Date(sale.sale_date)) / 60000;
    if (mins < 0) return `<p class="sr-serving sr-serving--timeout">⏱️ Timed out</p>`;
    const m = Math.floor(mins);
    const s = Math.round((mins - m) * 60);
    const dur = m > 0 ? `${m}m ${s}s` : `${s}s`;
    return `<p class="sr-serving sr-serving--timeout">⏱️ ${dur} (timed out)</p>`;
  }
  if (!sale.prepared_at) return '';
  const mins = (new Date(sale.prepared_at) - new Date(sale.sale_date)) / 60000;
  if (mins < 0 || mins > 120) return '';
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  return `<p class="sr-serving">🍳 Served in ${m > 0 ? `${m}m ${s}s` : `${s}s`}</p>`;
};

class CashflowView extends View {
  _parentElement = document.querySelector("#cashflowPanel");
  _expenseModal = document.querySelector("#addExpenseModal");
  _form = document.querySelector("#addExpenseForm");
  _overrideModal = document.querySelector("#cashflowOverrideModal");
  _overrideForm = document.querySelector("#cashflowOverrideForm");
  _activeTab = "sales";

  _setActiveTab(tab) {
    this._activeTab = tab;
    this._parentElement.querySelectorAll(".cashflow-tab").forEach(btn => {
      btn.classList.toggle("cashflow-tab--active", btn.dataset.tab === tab);
    });
    document.getElementById("cashflowSalesList").classList.toggle("hidden", tab !== "sales");
    document.getElementById("cashflowExpensesList").classList.toggle("hidden", tab !== "expenses");
    document.getElementById("cashflowVoidedList").classList.toggle("hidden", tab !== "voided");
  }

  open(canEdit) {
    this._parentElement.classList.remove("hidden", "cashflow-exiting");
    this._parentElement.querySelectorAll(".period-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.period === "today");
    });
    document.querySelector("#cashflowCustomRange").classList.add("hidden");
    document.getElementById("addExpenseBtn").classList.toggle("hidden", !canEdit);
    this._setActiveTab("sales");
  }

  close() {
    this._parentElement.classList.add("cashflow-exiting");
    setTimeout(() => {
      this._parentElement.classList.add("hidden");
      this._parentElement.classList.remove("cashflow-exiting");
    }, 220);
  }

  setPeriodLabel(label) {
    document.querySelector("#cashflowPeriodLabel").textContent = label;
  }

  setActivePeriod(period) {
    this._parentElement.querySelectorAll(".period-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.period === period);
    });
    document
      .querySelector("#cashflowCustomRange")
      .classList.toggle("hidden", period !== "custom");
  }

  renderLoading() {
    const spinner = `
      <div class="cashflow-spinner">
        <div class="spinner"><div></div><div></div><div></div><div></div></div>
      </div>`;
    document.querySelector("#cashflowSalesList").innerHTML = spinner;
    document.querySelector("#cashflowExpensesList").innerHTML = spinner;
    document.querySelector("#cashflowVoidedList").innerHTML = spinner;
  }

  _animateAmount(el, fromVal, toVal) {
    const duration = 700;
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      el.textContent = fmt(fromVal + (toVal - fromVal) * easeOut(t));
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = fmt(toVal);
    };
    requestAnimationFrame(step);
  }

  renderSummary({ gross, expenses, net }) {
    const grossEl = document.querySelector("#cashflowGross");
    const netEl   = document.querySelector("#cashflowNet");
    const fromGross = parseFloat(grossEl.textContent.replace(/[$,]/g, "")) || 0;
    const fromNet   = parseFloat(netEl.textContent.replace(/[$,]/g, "")) || 0;

    if (fromGross !== gross) this._animateAmount(grossEl, fromGross, gross);
    else grossEl.textContent = fmt(gross);

    document.querySelector("#cashflowExpensesTotal").textContent = fmt(expenses);

    if (fromNet !== net) this._animateAmount(netEl, fromNet, net);
    else netEl.textContent = fmt(net);

    netEl.classList.toggle("summary-amount--positive", net >= 0);
    netEl.classList.toggle("summary-amount--negative", net < 0);
  }

  renderSalesList(sales, canEdit) {
    const el = document.querySelector("#cashflowSalesList");
    if (!sales.length) {
      el.innerHTML = `<p class="cashflow-empty">No sales for this period.</p>`;
      return;
    }
    el.innerHTML = sales
      .map((sale) => {
        const items = sale.items ?? [];
        const first = esc(items[0]?.itemName ?? "Sale");
        const label = items.length > 1 ? `${first} & ${items.length - 1} more` : first;
        const ticketStr = sale.ticket_number != null ? `<span class="cashflow-ticket-badge">#${sale.ticket_number}</span>` : "";
        return `
        <div class="cashflow-row cashflow-row--clickable" data-sale-id="${sale.id}">
          <div class="cashflow-row-main">
            <span class="cashflow-row-desc">
              ${ticketStr}${label}
              ${sale.is_manual ? `<span class="cashflow-manual-badge">Manual</span>` : ""}
            </span>
            <span class="cashflow-row-date">${fmtDateTime(sale.sale_date)}${sale.order_type ? ` · ${sale.order_type === 'takeout' ? 'Takeout' : 'Dine In'}` : ''}${sale.added_by ? ` · ${sale.is_manual ? 'Added by' : 'Cashier:'} ${esc(sale.added_by)}` : ""}${fmtServing(sale)}</span>
          </div>
          <div class="cashflow-row-right">
            <span class="cashflow-row-amount cashflow-row-amount--sale">${fmt(sale.total_price)}</span>
            <button class="cashflow-void-btn" data-sale-id="${sale.id}" type="button" title="Void transaction">Void</button>
            <span class="cashflow-row-expand" aria-hidden="true">›</span>
          </div>
        </div>`;
      })
      .join("");
  }

  renderExpensesList(expenses, canEdit) {
    const el = document.querySelector("#cashflowExpensesList");
    if (!expenses.length) {
      el.innerHTML = `<p class="cashflow-empty">No expenses for this period.</p>`;
      return;
    }
    el.innerHTML = expenses
      .map(
        (exp) => `
        <div class="cashflow-row" data-expense-id="${exp.id}">
          <div class="cashflow-row-main">
            <span class="cashflow-row-desc">${esc(exp.description)}</span>
            ${exp.category ? `<span class="cashflow-category-badge">${esc(exp.category)}</span>` : ""}
            <span class="cashflow-row-date">${fmtDateTime(exp.expenseDate)} · Added by ${esc(exp.createdBy)}</span>
          </div>
          <div class="cashflow-row-right">
            <span class="cashflow-row-amount cashflow-row-amount--expense">−${fmt(exp.amount)}</span>
            ${canEdit ? `<button class="cashflow-delete-btn" data-id="${exp.id}" aria-label="Delete expense" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </button>` : ""}
          </div>
        </div>`
      )
      .join("");
  }

  renderVoidedList(voidedSales, canEdit) {
    const el = document.querySelector("#cashflowVoidedList");
    if (!voidedSales.length) {
      el.innerHTML = `<p class="cashflow-empty">No voided transactions for this period.</p>`;
      return;
    }
    el.innerHTML = voidedSales
      .map((sale) => {
        const items = sale.items ?? [];
        const first = esc(items[0]?.itemName ?? "Sale");
        const label = items.length > 1 ? `${first} & ${items.length - 1} more` : first;
        const ticketStr = sale.ticket_number != null ? `<span class="cashflow-ticket-badge">#${sale.ticket_number}</span>` : "";
        const voidedStr = sale.voided_by
          ? `Voided by ${esc(sale.voided_by)} · ${fmtDateTime(sale.voided_at)}`
          : `Voided · ${fmtDateTime(sale.voided_at)}`;
        return `
        <div class="cashflow-row cashflow-row--voided" data-sale-id="${sale.id}" role="button" tabindex="0" title="View receipt">
          <div class="cashflow-row-main">
            <span class="cashflow-row-desc">${ticketStr}${label}</span>
            <span class="cashflow-row-date">${fmtDateTime(sale.sale_date)}${sale.order_type ? ` · ${sale.order_type === 'takeout' ? 'Takeout' : 'Dine In'}` : ''}${sale.added_by ? ` · Cashier: ${esc(sale.added_by)}` : ""}</span>
            <span class="cashflow-voided-by">${voidedStr}</span>
          </div>
          <div class="cashflow-row-right">
            <span class="cashflow-row-amount cashflow-row-amount--voided">${fmt(sale.total_price)}</span>
          </div>
        </div>`;
      })
      .join("");
  }

  showExpenseModal() {
    this._expenseModal.classList.remove("hidden");
  }

  hideExpenseModal() {
    this._expenseModal.classList.add("hidden");
    this._form.reset();
  }

  showOverrideModal(onSubmit) {
    this._overrideModal.classList.remove("hidden");
    document.getElementById("overrideEmail").value = "";
    document.getElementById("overridePassword").value = "";
    this.setOverrideError("");
    document.getElementById("overrideEmail").focus();
    this._overrideSubmitHandler = onSubmit;
  }

  hideOverrideModal() {
    this._overrideModal.classList.add("hidden");
    this._overrideForm?.reset();
    this.setOverrideError("");
    this._overrideSubmitHandler = null;
  }

  setOverrideError(msg) {
    const el = document.getElementById("overrideError");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("hidden", !msg);
  }

  setLoading(on) {
    this._parentElement
      .querySelectorAll(".period-btn, #applyRangeBtn, #addExpenseBtn, #exportCsvBtn")
      .forEach((el) => { el.disabled = on; });
    this._parentElement.querySelector(".cashflow-back").disabled = on;
    this._parentElement.querySelectorAll(".cashflow-tab").forEach(btn => { btn.disabled = on; });
  }

  setHeavyLoadNotice(on) {
    const existing = this._parentElement.querySelector('.cf-heavy-notice');
    if (on && !existing) {
      const el = document.createElement('p');
      el.className = 'cf-heavy-notice';
      el.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Loading a full year of data. This may take a few seconds…`;
      this._parentElement.querySelector('.cashflow-period-bar')
        ?.insertAdjacentElement('afterend', el);
    } else if (!on && existing) {
      existing.remove();
    }
  }

  setSubmitting(on) {
    const btn = document.querySelector("#expenseSubmitBtn");
    btn.disabled = on;
    btn.textContent = on ? "Adding…" : "Add Expense";
  }

  setOverrideSubmitting(on) {
    const btn = document.getElementById("overrideSubmitBtn");
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? "Verifying…" : "Authorize";
  }

  scrollExpensesToTop() {
    document.querySelector("#cashflowExpensesList").scrollTop = 0;
  }

  showSaleReceipt(sale, onReprint) {
    document.querySelector("#saleReceiptModal")?.remove();

    const items = sale.items ?? [];
    const adjs = (sale.adjustments ?? []).filter((a) => !a.removed);

    const itemsMarkup = items
      .map((item) => {
        const variants = (item.selectedVariants ?? [])
          .map((v) => {
            const name = v.variantName ?? v.optionName ?? v.name ?? "";
            const price = Number(v.variantPrice ?? v.optionPrice ?? 0);
            if (!name) return "";
            return `<span class="sr-variant">${esc(name)}${price > 0 ? ` (+${fmt(price)})` : ""}</span>`;
          })
          .filter(Boolean)
          .join("");
        return `
          <div class="sr-item">
            <div class="sr-item-info">
              <span class="sr-item-name">${esc(item.itemName)}</span>
              ${variants ? `<div class="sr-item-variants">${variants}</div>` : ""}
            </div>
            <span class="sr-item-qty">×${item.quantity}</span>
            <span class="sr-item-price">${fmt(item.totalPrice)}</span>
          </div>`;
      })
      .join("");

    const adjMarkup = adjs
      .map((a) => {
        const raw = a.computedAmount ?? a.computed_amount;
        const amount = typeof raw === "number" && !isNaN(raw) ? raw : 0;
        return `
        <div class="sr-line sr-adj ${a.type}">
          <span>${a.name}</span>
          <span>${amount < 0 ? "−" : "+"}${fmt(Math.abs(amount))}</span>
        </div>`;
      })
      .join("");

    const isVoided = !!sale.voided_at;
    const voidedBanner = isVoided ? `
      <div class="sr-voided-banner">
        <span class="sr-voided-label">VOIDED</span>
        <span class="sr-voided-meta">
          ${sale.voided_by ? `by ${esc(sale.voided_by)} · ` : ''}${fmtDateTime(sale.voided_at)}
        </span>
      </div>` : '';

    const el = document.createElement("div");
    el.id = "saleReceiptModal";
    el.className = "sale-receipt-overlay";
    el.innerHTML = `
      <div class="sale-receipt-card${isVoided ? ' sale-receipt-card--voided' : ''}">
        <div class="sale-receipt-header">
          <h3 class="sale-receipt-title">Order Receipt</h3>
          <button class="sale-receipt-close" aria-label="Close">&times;</button>
        </div>
        ${voidedBanner}
        <p class="sale-receipt-date">
          ${fmtDateTime(sale.sale_date)}
          ${sale.is_manual ? `<span class="sr-manual-badge">Manually added${sale.added_by ? ` by ${esc(sale.added_by)}` : ""}</span>` : ""}
        </p>
        ${!sale.is_manual && sale.added_by ? `<p class="sale-receipt-cashier">Cashier: ${esc(sale.added_by)}</p>` : ""}
        ${_servingLine(sale)}
        <div class="sr-items">${itemsMarkup}</div>
        <div class="sr-divider"></div>
        <div class="sr-summary">
          ${sale.subtotal != null && sale.subtotal !== sale.total_price ? `
          <div class="sr-line">
            <span>Subtotal</span><span>${fmt(sale.subtotal)}</span>
          </div>` : ""}
          ${adjMarkup}
          <div class="sr-line sr-total">
            <span>Total</span><span>${fmt(sale.total_price)}</span>
          </div>
        </div>
        <div class="sr-divider"></div>
        <div class="sr-payment">
          <div class="sr-line">
            <span>Payment</span><span>${fmt(sale.customer_payment)}</span>
          </div>
          <div class="sr-line">
            <span>Change</span><span>${fmt(sale.customer_change)}</span>
          </div>
        </div>
        ${onReprint && !isVoided ? `<div class="sr-reprint"><button class="btn sr-reprint-btn">Reprint Receipt</button></div>` : ''}
      </div>`;

    this._parentElement.appendChild(el);
    el.querySelector(".sale-receipt-close").addEventListener("click", () => el.remove());
    el.addEventListener("click", (e) => { if (e.target === el) el.remove(); });
    el.querySelector(".sr-reprint-btn")?.addEventListener("click", () => { el.remove(); onReprint?.(); });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  _addHandlerOpen(handler) {
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-action='cash-flow']")) handler();
    });
  }

  _addHandlerClose(handler) {
    this._parentElement.addEventListener("click", (e) => {
      if (e.target.closest(".cashflow-back")) handler();
    });
  }

  _addHandlerPeriodChange(handler) {
    this._parentElement
      .querySelector(".cashflow-period-bar")
      .addEventListener("click", (e) => {
        const btn = e.target.closest(".period-btn");
        if (!btn) return;
        const period = btn.dataset.period;
        this.setActivePeriod(period);
        if (period !== "custom") handler({ period });
      });
  }

  _addHandlerCustomRange(handler) {
    const fromEl = document.querySelector("#cashflowFrom");
    const toEl = document.querySelector("#cashflowTo");

    fromEl.addEventListener("change", () => {
      if (toEl.value && toEl.value < fromEl.value) toEl.value = fromEl.value;
      toEl.min = fromEl.value;
    });

    document.querySelector("#applyRangeBtn").addEventListener("click", () => {
      const from = fromEl.value;
      const to = toEl.value;
      if (!from || !to) return;
      if (to < from) { toEl.value = from; return; }
      handler({ period: "custom", from, to });
    });
  }

  _addHandlerExport(handler) {
    document.querySelector("#exportCsvBtn").addEventListener("click", handler);
  }

  _addHandlerOpenAddExpense() {
    document.querySelector("#addExpenseBtn").addEventListener("click", () => this.showExpenseModal());
    document.querySelector("#expenseModalCloseBtn").addEventListener("click", () => this.hideExpenseModal());
    this._expenseModal.addEventListener("click", (e) => {
      if (e.target === this._expenseModal) this.hideExpenseModal();
    });
  }

  _addHandlerSubmitExpense(handler) {
    this._form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        amount: document.querySelector("#expenseAmount").value,
        description: document.querySelector("#expenseDescription").value.trim(),
        category: document.querySelector("#expenseCategory").value.trim(),
        expense_date: new Date().toISOString(),
      };
      handler(data);
    });
  }

  _addHandlerOpenSaleReceipt(handler) {
    // Sales list
    document.querySelector("#cashflowSalesList").addEventListener("click", (e) => {
      if (e.target.closest(".cashflow-void-btn")) return;
      const row = e.target.closest(".cashflow-row[data-sale-id]");
      if (!row) return;
      handler(row.dataset.saleId);
    });
    // Voided list — click row to view receipt
    document.querySelector("#cashflowVoidedList").addEventListener("click", (e) => {
      const row = e.target.closest(".cashflow-row[data-sale-id]");
      if (!row) return;
      handler(row.dataset.saleId);
    });
  }

  _addHandlerDeleteExpense(handler) {
    document.querySelector("#cashflowExpensesList").addEventListener("click", (e) => {
      const btn = e.target.closest(".cashflow-delete-btn");
      if (!btn) return;
      this.showConfirmModal({
        message: "Delete this expense? This cannot be undone.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        onConfirm: () => handler(btn.dataset.id),
      });
    });
  }

  _addHandlerVoid(handler) {
    document.querySelector("#cashflowSalesList").addEventListener("click", (e) => {
      const btn = e.target.closest(".cashflow-void-btn");
      if (!btn) return;
      e.stopPropagation();
      handler(btn.dataset.saleId);
    });
  }


  _addHandlerTabChange() {
    this._parentElement.querySelector(".cashflow-tabs").addEventListener("click", (e) => {
      const btn = e.target.closest(".cashflow-tab");
      if (!btn) return;
      this._setActiveTab(btn.dataset.tab);
    });
  }

  _addHandlerOverrideModal() {
    document.getElementById("overrideCancelBtn").addEventListener("click", () => this.hideOverrideModal());
    this._overrideModal.addEventListener("click", (e) => {
      if (e.target === this._overrideModal) this.hideOverrideModal();
    });
    this._overrideForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!this._overrideSubmitHandler) return;
      const email = document.getElementById("overrideEmail").value.trim();
      const password = document.getElementById("overridePassword").value;
      this.setOverrideSubmitting(true);
      this.setOverrideError("");
      await this._overrideSubmitHandler(email, password);
      this.setOverrideSubmitting(false);
    });
  }
}

export default new CashflowView();
