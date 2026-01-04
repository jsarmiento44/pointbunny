import View from "./view.js";

class NewMenuItemView extends View {
  _parentElement = document.querySelector("#addMenuModal");
  _closeBtn = this._parentElement.querySelector(".modal-close");
  _modalDiv = document.querySelector(".modal-parent");
  _formParent = this._parentElement.querySelector(".add-menu-form");

  _toggleModalClose() {
    this._closeBtn.addEventListener("click", (e) => {
      this._parentElement.classList.toggle("hidden");
    });
  }

  _toggleModalOpen() {
    this._modalDiv.addEventListener("click", function (e) {
      e.preventDefault();

      const btn = e.target.closest("#openAddModal");
      if (!btn) return;

      const div = document.querySelector(".modal-overlay-form");
      div.classList.toggle("hidden");
    });
  }

  _uploadItem(handler) {
    this._formParent.addEventListener("submit", function (e) {
      e.preventDefault();
      //1.) Extract the data from fields
      const dataArr = [...new FormData(this)];
      const data = Object.fromEntries(dataArr);
      if (!data) return;
      handler(data);
      //2.) Refactor data to become model object
      //3.) Send data to controller
      //4.) close form modal
      //5.) Show success
      document.querySelector("#addMenuModal").classList.toggle("hidden");
    });
  }
}

export default new NewMenuItemView();
