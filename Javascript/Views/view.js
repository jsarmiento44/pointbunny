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
}
