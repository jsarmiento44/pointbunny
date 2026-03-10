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

  _showSuccess() {
    const markup = `
    <div class="modal-overlay success-overlay">
      <div class="modal-content success-modal">
        <button class="modal-close">&times;</button>
        <div class="success-body">
          <div class="success-icon">✓</div>
          <h2 class="success-title">Success</h2>
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
    document.querySelector(".success-overlay").classList.toggle("hidden");
  }
}
