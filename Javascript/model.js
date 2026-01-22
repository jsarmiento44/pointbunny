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
      category: `snacks`,
      _id: `#123123`,
      imageURL: ``,
      _stock: `0`,
      hasVariants: true,
      variants: [
        {
          optionLabel: `Size`,
          options: [
            { optionName: "Fries Medium", optionPrice: "35" },
            { optionName: "Fries Large", optionPrice: "45" },
            { optionName: "Bestie", optionPrice: "60" },
          ],
        },
        {
          optionLabel: `Flavor`,
          options: [
            { optionName: "Cheese", optionPrice: "0" },
            { optionName: "Sour Cream", optionPrice: "0" },
            { optionName: "BBQ", optionPrice: "0" },
            { optionName: "Salted", optionPrice: "0" },
          ],
        },
        {
          optionLabel: `Type`,
          options: [
            { optionName: "Toasted", optionPrice: "60" },
            { optionName: "Undercooked", optionPrice: "0" },
            { optionName: "Well Done", optionPrice: "0" },
            { optionName: "Not cooked", optionPrice: "0" },
          ],
        },
      ],
      description: `This is a sample description of the menu item. You can add more details here.`,
      isActive: true,
    },
    {
      itemName: "Ice Cream",
      price: `60`,
      category: `dessert`,
      _id: `#321321`,
      imageURL: ``,
      _stock: `0`,
      hasVariants: false,
      variants: [],
      description: `This is a sample description of the menu item. You can add more details here.`,
      isActive: true,
    },
    {
      itemName: "Milkshake",
      price: `79`,
      category: `drinks`,
      _id: `#01112`,
      imageURL: ``,
      _stock: `0`,
      hasVariants: true,
      variants: [
        {
          optionLabel: `Flavors`,
          options: [
            { optionName: "Red Velvet", optionPrice: "89" },
            { optionName: "Strawberry", optionPrice: "89" },
            { optionName: "Matcha", optionPrice: "99" },
          ],
        },
        ,
      ],
      description: `This is a sample description of the menu item. You can add more details here.`,
      isActive: true,
    },
    {
      itemName: "Frappe",
      price: "150",
      category: "drinks",
      _id: "#49531",
      imageURL: ``,
      _stock: `0`,
      hasVariants: false,
      variants: [],
      description: `This is a sample description of the menu item. You can add more details here.`,
      isActive: true,
    },
  ],
  menuCategories: [`snacks`, `drinks`, `dessert`],
  employees: [
    {
      _id: `1`,
      name: `Ben`,
      role: `Cashier`,
      systemRole: `admin`,
    },
  ],
  cart: [],
  salesBasket: [],
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
    imageURL: "",
    _stock: `0`,
    hasVariants: true,
    variants: newItem.variants,
    description: `This is a sample description of the menu item. You can add more details here.`,
    isActive: true,
  };
  this.state.menuItems.push(item);
  console.log(state.menuItems);
};
