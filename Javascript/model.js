let counter = 0;

const generateId = function () {
  counter += 1;
  return `${Date.now()}-${counter}`;
};

class Account {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }

  menuItems = [];
  menuCategories = [];
  employees = [];
}

export const state = {
  username: "Wowa",
  menuItems: [
    {
      itemName: "French Fries",
      price: `100`,
      category: `food`,
      _id: `#123123`,
      imageURL: ``,
    },
    {
      itemName: "Ice Cream",
      price: `60`,
      category: `dessert`,
      _id: `#321321`,
      imageURL: ``,
    },
    {
      itemName: "Milkshake",
      price: `79`,
      category: `drinks`,
      _id: `#01112`,
      imageURL: ``,
    },
    {
      itemName: "Frappe",
      price: "150",
      category: "drinks",
      _id: "#49531",
      imageURL: ``,
    },
    {
      itemName: "Habimbara",
      price: "150",
      category: "food",
      _id: "#4953174",
      imageURL: ``,
    },
  ],
  menuCategories: [`food`, `beverage`, `snack`, `dessert`],
  employees: [
    {
      _id: `1`,
      name: `Ben`,
      role: `Cashier`,
      systemRole: `admin`,
    },
  ],
  cart: [],
  sales: [],
};

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
    hasVariants: false,
    variants: {},
    description: `This is a sample description of the menu item. You can add more details here.`,
    isActive: true,
  };
  this.state.menuItems.push(item);
  console.log(state.menuItems);
};

export const allAccounts = [];

createNewAccount("Wowa123", "Abudabi");
createNewAccount("Kelly", "Sarmiento1234");
createNewAccount("Ben", "Manatadako@26");
