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
        { variantName: "Fries Medium", variantPrice: "35" },
        { variantName: "Fries Large", variantPrice: "45" },
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
        { variantName: "Avocado", variantPrice: "99" },
        { variantName: "Red Velvet", variantPrice: "99" },
        { variantName: "Matcha", variantPrice: "89" },
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
