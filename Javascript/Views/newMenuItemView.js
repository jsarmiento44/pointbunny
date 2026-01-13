import View from "./view.js";

class NewMenuItemView extends View {
  _parentElement = document.querySelector("#addMenuModal");
  _closeBtn = this._parentElement.querySelector(".modal-close");
  _modalDiv = document.querySelector(".modal-parent");
  _formParent = this._parentElement.querySelector(".add-menu-form");
  _selectOptionsElement = document.querySelector(".select-options");

  _toggleModalClose() {
    this._closeBtn.addEventListener("click", (e) => {
      this._parentElement.classList.toggle("hidden");
      document.getElementById("newCategoryInput").classList.add("hidden");
      document.querySelector(".new-category-button").classList.add("hidden");
    });
  }

  _toggleModalOpen() {
    this._modalDiv.addEventListener("click", function (e) {
      e.preventDefault();

      const btn = e.target.closest("#openAddModal");
      if (!btn) return;

      document.querySelector(".modal-overlay-form").classList.toggle("hidden");
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
      document.getElementById("newCategoryInput").classList.add("hidden");
    });
  }

  _newMenuCategory() {
    document
      .querySelector(".select-options")
      .addEventListener("change", function (e) {
        const value = this.value;

        console.log(value);
        if (value === `new-category`) {
          document
            .getElementById("newCategoryInput")
            .classList.remove("hidden");

          document
            .querySelector(".new-category-button")
            .classList.remove("hidden");
        }
      });
  }

  _addHandlerAddMenuCategory(handler) {
    document
      .querySelector(".new-category-button")
      .addEventListener("click", function () {
        const field = document.getElementById("newCategoryInput");
        const newCateg = field.value.trim();

        if (newCateg !== "") {
          handler(newCateg);
          document.getElementById("newCategoryInput").classList.add("hidden");

          document
            .querySelector(".new-category-button")
            .classList.add("hidden");
        } else {
          alert("Please insert an input");
        }
      });
  }

  _mapMenuCategoriesMarkUp(data) {
    this._selectOptionsElement.innerHTML = `
    <option value="" disabled selected>Select category</option>
    <option value="new-category">Add new category</option>
  `;

    const markup = data.map(
      (i) => `<option value="${i}">${i[0].toUpperCase() + i.slice(1)}</option>
`
    );
    console.log(markup);
    this._selectOptionsElement.insertAdjacentHTML("beforeend", markup);
  }
}

export default new NewMenuItemView();
