import View from "./view.js";

class OrderCheckOutView extends View {
  _parentElement = document.querySelector(".modal-parent");
  _totalPrice;
  _generateMarkUp() {
    return `
<div class="modal-overlay" id="newOrderModal">
  <div class="modal-content pos-modal">
    <!-- Close Button -->
    <button class="modal-close">&times;</button>

    <h3 class="form-title">Cart Summary</h3>

    <!-- Scrollable Cart Items -->
    <div id="cartItems" class="cart-items">
      ${this._data.cart
        .map(
          (item) => `
          <div class="cart-item">
            <span>${item.itemName} x${item.quantity}</span>
            <span>₱${item.price * item.quantity}</span>
          </div>
        `
        )
        .join("")}
    </div>

    <!-- Payment Section (fixed at bottom) -->
    <div class="payment-section">
  <div class="cart-total">
    <span>Total:</span>
    <span id="cartTotal">₱${this._totalPrice}</span>
  </div>

  <!-- I Receive with Enter Button -->
  <div class="receive-container" style="display: flex; gap: 8px; align-items: center;">
    <label for="customerPayment" style="margin: 0;">
      I receive:
    </label>
    <input type="number" id="customerPayment" placeholder="Enter amount received" />
    <button id="enterPaymentBtn">Enter</button>
  </div>

  <label>
  Change:
  <div id="changeAmount" class="change-box">₱0.00</div>
</label>


  <button id="printReceiptBtn">Print Receipt</button>
</div>

  </div>
</div>
        `;
  }

  _addHandlerShowCheckout(handler) {
    this._parentElement.addEventListener("click", function (e) {
      const btn = e.target.closest(".btn-checkout");
      if (!btn) return;

      handler();
    });
  }

  _addHandlerSubtractChange(handler) {
    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest("#enterPaymentBtn");
      if (btn) {
        const changeBox = document.querySelector(".change-box");
        const payment =
          +this._parentElement.querySelector("#customerPayment").value;

        if (payment < this._totalPrice) {
          changeBox.textContent = `Payment must be higher or equal to order total`;
        } else if (payment >= this._totalPrice) {
          const change = payment - this._totalPrice;
          changeBox.classList.add("ok");
          changeBox.textContent = change;
        }
      }
    });
  }

  _printReceipt() {}
}

export default new OrderCheckOutView();
