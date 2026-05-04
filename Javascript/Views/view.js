export default class View {
  _data;

  render(data) {
    this._data = data;
    const markup = this._generateMarkUp();
    this._clear();
    this._parentElement.innerHTML = markup;
  }

  renderSpinner() {
    const spinnerMarkUp = `<div class="spinner-overlay">
  <div class="spinner">
    <div></div>
    <div></div>
    <div></div>
    <div></div>
  </div>
</div>
`;
    this._clear();
    this._parentElement.insertAdjacentHTML("afterbegin", spinnerMarkUp);
  }

  _clear() {
    this._parentElement.innerHTML = "";
  }

  _showSuccess(note = null) {
    const markup = `
    <div class="modal-overlay success-overlay">
      <div class="modal-content success-modal">
        <button class="modal-close">&times;</button>
        <div class="success-body">
          <div class="success-icon">
            <svg class="success-svg" viewBox="0 0 52 52" aria-hidden="true">
              <path class="success-check" fill="none" stroke="#fff" stroke-width="5"
                stroke-linecap="round" stroke-linejoin="round" d="M14 27 l9 9 16-18"/>
            </svg>
          </div>
          <h2 class="success-title">Success</h2>
          ${note ? `<p class="success-note">${note}</p>` : ''}
        </div>
      </div>
    </div>
  `;

    this._parentElement.insertAdjacentHTML("beforeend", markup);

    // Close button functionality
    const overlay = this._parentElement.querySelector(".success-overlay");
    const closeBtn = overlay.querySelector(".modal-close");

    closeBtn.addEventListener("click", () => {
      overlay.remove(); // removes modal from DOM
    });
  }

  _hideSuccess() {
    const overlay = document.querySelector(".success-overlay");
    if (overlay) overlay.remove();
  }

  showConfirmModal({ message, confirmLabel = 'Discard & close', cancelLabel = 'Keep editing', onConfirm, onCancel }) {
    if (document.querySelector('.confirm-overlay')) return;
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    el.innerHTML = `
      <div class="confirm-card">
        <p class="confirm-msg">${message}</p>
        <div class="confirm-actions">
          <button class="btn confirm-cancel-btn" type="button">${cancelLabel}</button>
          <button class="btn primary confirm-ok-btn" type="button">${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('.confirm-ok-btn').addEventListener('click', () => { el.remove(); onConfirm?.(); });
    el.querySelector('.confirm-cancel-btn').addEventListener('click', () => { el.remove(); onCancel?.(); });
    el.addEventListener('click', (e) => { if (e.target === el) { el.remove(); onCancel?.(); } });
  }
}
