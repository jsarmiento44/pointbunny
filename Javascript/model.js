let counter = 0;

const generateId = function () {
  counter += 1;
  return `${Date.now()}-${counter}`;
};

export const state = {
  username: "Wowa",
  menuItems: [
    {
      itemName: "French Fries",
      price: `100`,
      category: `food`,
      id: `#123123`,
      imageURL: ``,
    },
    {
      itemName: "Ice Cream",
      price: `60`,
      category: `dessert`,
      id: `#321321`,
      imageURL: ``,
    },
    {
      itemName: "Milkshake",
      price: `79`,
      category: `drinks`,
      id: `#01112`,
      imageURL: ``,
    },
    {
      itemName: "Frappe",
      price: "150",
      category: "drinks",
      id: "#49531",
      imageURL: ``,
    },
    {
      itemName: "Habimbara",
      price: "150",
      category: "food",
      id: "#49531",
      imageURL: ``,
    },
  ],
  menuCategories: [`food`, `beverage`, `snack`, `dessert`],
  employees: [
    {
      id: `1`,
      name: `Ben`,
      role: `Cashier`,
      systemRole: `admin`,
    },
  ],
};

class MenuItem {
  constructor(itemName, price) {
    this.itemName = itemName;
    this.price = price;
  }
  _id;
  _inventory = 0;
  category;
  isActive = true;
}

class Account {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }

  menuItems = [];
  menuCategories = [];
  employees = [];
}

class Employee {
  constructor(name, role) {
    this.name = name;
    this.role = role;
  }

  shift;
}

const createNewAccount = function (username, password) {
  const newAccount = new Account(username, password);
  allAccounts.push(newAccount);
};

export const uploadNewMenuItem = async function (newItem) {
  //exrtract the data and convert into a new format object
  const item = {
    itemName: newItem.name,
    price: newItem.price,
    category: newItem.category,
    _id: generateId(),
    imageURL: newItem.image,
    _stock: `0`,
    hasVariants: ``,
    variants: {},
  };
  console.log(item);
  this.state.menuItems.push(item);
  console.log(state);
};

export const allAccounts = [];

createNewAccount("Wowa123", "Abudabi");
createNewAccount("Kelly", "Sarmiento1234");
createNewAccount("Ben", "Manatadako@26");
