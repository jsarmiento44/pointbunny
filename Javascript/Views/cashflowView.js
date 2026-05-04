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

class CashflowView extends View {
  _parentElement = document.querySelector("#cashflowPanel");
  _expenseModal = document.querySelector("#addExpenseModal");
  _form = document.querySelector("#addExpenseForm");

  open() {
    this._parentElement.classList.remove("hidden", "cashflow-exiting");
    this._parentElement.querySelectorAll(".period-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.period === "today");
    });
    document.querySelector("#cashflowCustomRange").classList.add("hidden");
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
  }

  renderSummary({ gross, expenses, net }) {
    document.querySelector("#cashflowGross").textContent = fmt(gross);
    document.querySelector("#cashflowExpensesTotal").textContent = fmt(expenses);
    const netEl = document.querySelector("#cashflowNet");
    netEl.textContent = fmt(net);
    netEl.classList.toggle("summary-amount--positive", net >= 0);
    netEl.classList.toggle("summary-amount--negative", net < 0);
  }

  renderSalesList(sales) {
    const el = document.querySelector("#cashflowSalesList");
    if (!sales.length) {
      el.innerHTML = `<p class="cashflow-empty">No sales for this period.</p>`;
      return;
    }
    el.innerHTML = sales
      .map((sale) => {
        const items = sale.items ?? [];
        const first = items[0]?.itemName ?? "Sale";
        const label = items.length > 1 ? `${first} & ${items.length - 1} more` : first;
        return `
        <div class="cashflow-row cashflow-row--clickable" data-sale-id="${sale.id}">
          <div class="cashflow-row-main">
            <span class="cashflow-row-desc">
              ${label}
              ${sale.is_manual ? `<span class="cashflow-manual-badge">Manual</span>` : ""}
            </span>
            <span class="cashflow-row-date">${fmtDateTime(sale.sale_date)}${sale.is_manual && sale.added_by ? ` · Added by ${sale.added_by}` : ""}</span>
          </div>
          <div class="cashflow-row-right">
            <span class="cashflow-row-amount cashflow-row-amount--sale">${fmt(sale.total_price)}</span>
            <span class="cashflow-row-expand" aria-hidden="true">›</span>
          </div>
        </div>`;
      })
      .join("");
  }

  renderExpensesList(expenses) {
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
            <span class="cashflow-row-desc">${exp.description}</span>
            ${exp.category ? `<span class="cashflow-category-badge">${exp.category}</span>` : ""}
            <span class="cashflow-row-date">${fmtDateTime(exp.expenseDate)} · Added by ${exp.createdBy}</span>
          </div>
          <div class="cashflow-row-right">
            <span class="cashflow-row-amount cashflow-row-amount--expense">−${fmt(exp.amount)}</span>
            <button class="cashflow-delete-btn" data-id="${exp.id}" aria-label="Delete expense" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </button>
          </div>
        </div>`
      )
      .join("");
  }

  showExpenseModal() {
    const now = new Date();
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    document.querySelector("#expenseDate").value = local;
    this._expenseModal.classList.remove("hidden");
  }

  hideExpenseModal() {
    this._expenseModal.classList.add("hidden");
    this._form.reset();
  }

  setLoading(on) {
    this._parentElement
      .querySelectorAll(".period-btn, #applyRangeBtn, #addExpenseBtn, #exportCsvBtn")
      .forEach((el) => { el.disabled = on; });
    this._parentElement.querySelector(".cashflow-back").disabled = on;
  }

  setSubmitting(on) {
    const btn = document.querySelector("#expenseSubmitBtn");
    btn.disabled = on;
    btn.textContent = on ? "Adding…" : "Add Expense";
  }

  scrollExpensesToTop() {
    document.querySelector("#cashflowExpensesList").scrollTop = 0;
  }

  showSaleReceipt(sale) {
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
            return `<span class="sr-variant">${name}${price > 0 ? ` (+${fmt(price)})` : ""}</span>`;
          })
          .filter(Boolean)
          .join("");
        return `
          <div class="sr-item">
            <div class="sr-item-info">
              <span class="sr-item-name">${item.itemName}</span>
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

    const el = document.createElement("div");
    el.id = "saleReceiptModal";
    el.className = "sale-receipt-overlay";
    el.innerHTML = `
      <div class="sale-receipt-card">
        <div class="sale-receipt-header">
          <h3 class="sale-receipt-title">Order Receipt</h3>
          <button class="sale-receipt-close" aria-label="Close">&times;</button>
        </div>
        <p class="sale-receipt-date">
          ${fmtDateTime(sale.sale_date)}
          ${sale.is_manual ? `<span class="sr-manual-badge">Manually added${sale.added_by ? ` by ${sale.added_by}` : ""}</span>` : ""}
        </p>
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
      </div>`;

    this._parentElement.appendChild(el);
    el.querySelector(".sale-receipt-close").addEventListener("click", () => el.remove());
    el.addEventListener("click", (e) => { if (e.target === el) el.remove(); });
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

    // "To" date must be on or after "From" date
    fromEl.addEventListener("change", () => {
      if (toEl.value && toEl.value < fromEl.value) toEl.value = fromEl.value;
      toEl.min = fromEl.value;
    });

    document.querySelector("#applyRangeBtn").addEventListener("click", () => {
      const from = fromEl.value;
      const to = toEl.value;
      if (!from || !to) return;
      if (to < from) {
        toEl.value = from;
        return;
      }
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
        expense_date: new Date(document.querySelector("#expenseDate").value).toISOString(),
      };
      handler(data);
    });
  }

  _addHandlerOpenSaleReceipt(handler) {
    document.querySelector("#cashflowSalesList").addEventListener("click", (e) => {
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
}

export default new CashflowView();
