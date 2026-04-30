let counter = 0;
let adjCounter = 0;

const generateId = function () {
  counter += 1;
  return `${Date.now()}-${counter}`;
};

const generateAdjustmentId = function () {
  adjCounter += 1;
  return `adj_${Date.now()}-${adjCounter}`;
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
      price: 100,
      category: `snacks`,
      _id: `#123123`,
      imageURL: `../Icons/default image.png`,
      _stock: `0`,
      hasVariants: true,
      variants: [
        {
          optionLabel: `Size`,
          options: [
            { optionName: "Fries Medium", optionPrice: 35 },
            { optionName: "Fries Large", optionPrice: 45 },
            { optionName: "Bestie", optionPrice: 60 },
          ],
        },
        {
          optionLabel: `Flavor`,
          options: [
            { optionName: "Cheese", optionPrice: 0 },
            { optionName: "Sour Cream", optionPrice: 0 },
            { optionName: "BBQ", optionPrice: 0 },
            { optionName: "Salted", optionPrice: 0 },
          ],
        },
        {
          optionLabel: `Type`,
          options: [
            { optionName: "Toasted", optionPrice: 60 },
            { optionName: "Undercooked", optionPrice: 0 },
            { optionName: "Well Done", optionPrice: 0 },
            { optionName: "Not cooked", optionPrice: 0 },
          ],
        },
      ],
      description: `This is a sample description of the menu item. You can add more details here.`,
      isActive: true,
    },
    {
      itemName: "Ice Cream",
      price: 60,
      category: `dessert`,
      _id: `#321321`,
      imageURL: `../Icons/default image.png`,
      _stock: `0`,
      hasVariants: false,
      variants: [],
      description: `This is a sample description of the menu item. You can add more details here.`,
      isActive: true,
    },
    {
      itemName: "Milkshake",
      price: 79,
      category: `drinks`,
      _id: `#01112`,
      imageURL: `../Icons/default image.png`,
      _stock: `0`,
      hasVariants: true,
      variants: [
        {
          optionLabel: `Flavors`,
          options: [
            { optionName: "Red Velvet", optionPrice: 89 },
            { optionName: "Strawberry", optionPrice: 89 },
            { optionName: "Matcha", optionPrice: 99 },
          ],
        },
      ],
      description: `This is a sample description of the menu item. You can add more details here.`,
      isActive: true,
    },
    {
      itemName: "Frappe",
      price: 150,
      category: "drinks",
      _id: "#49531",
      imageURL: `../Icons/default image.png`,
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
  settings: {
    adjustments: [],
    showRemovedAdjustments: true,
  },
  currentReceiptAdjustments: [],
};

const createNewAccount = function (username, password) {
  const newAccount = new Account(username, password);
  allAccounts.push(newAccount);
};

export const uploadNewMenuItem = async function (newItem) {
  //exrtract the data and convert into a new format object
  const item = {
    itemName: newItem.name,
    price: Number(newItem.price),
    category: newItem.category,
    _id: generateId(),
    imageURL:
      newItem.image && newItem.image.size > 0
        ? URL.createObjectURL(newItem.image)
        : "../Icons/default image.png",
    _stock: `0`,
    hasVariants: newItem.variants && newItem.variants.length > 0,
    variants: newItem.variants,
    description: `This is a sample description of the menu item. You can add more details here.`,
    isActive: true,
  };
  state.menuItems.push(item);
};

export const deleteMenuItem = function (id) {
  const index = state.menuItems.findIndex((item) => item._id === id);
  if (index === -1) throw new Error("Item not found");
  state.menuItems.splice(index, 1);
};

export const deleteCartItem = function (index) {
  state.cart.splice(index, 1);
};

export const updateMenuItem = function (id, rawData) {
  try {
    // 1️⃣ Find the existing item
    const item = state.menuItems.find((item) => item._id === id);
    if (!item) throw new Error("Item not found");

    // 2️⃣ Normalize boolean values
    const hasVariants = rawData.hasVariants === "on";
    const isActive = rawData.status === "Active";

    // 3️⃣ Update basic fields
    item.itemName = rawData.itemName || "";
    item.price = Number(rawData.price) || 0;
    item.category = rawData.category || "";
    item._stock = rawData.stock || "0";
    item.description = rawData.description || "";
    item.hasVariants = hasVariants;
    item.isActive = isActive;

    // 4️⃣ Update image ONLY if a new one was selected
    // rawData.image is now the actual File object
    if (rawData.image && rawData.image.size > 0) {
      // Use URL.createObjectURL for immediate preview
      item.imageURL = URL.createObjectURL(rawData.image);
      // Optionally, store the file itself if you need to upload to backend later
      item.imageFile = rawData.image;
    }

    // 5️⃣ Update variants safely
    if (hasVariants) {
      item.variants = parseVariants(rawData);
    } else {
      item.variants = [];
    }
  } catch (err) {
    alert(err.message);
  }
};

// ── Settings: adjustment CRUD ─────────────────────────────────────────────────

export const addAdjustment = function (data) {
  const adjustment = {
    id: generateAdjustmentId(),
    name: data.name,
    type: data.type,           // "fee" | "discount"
    calculation: data.calculation, // "fixed" | "percentage"
    value: Number(data.value) || 0,
    enabled: true,
  };
  state.settings.adjustments.push(adjustment);
  return adjustment;
};

export const updateAdjustment = function (id, data) {
  const adj = state.settings.adjustments.find((a) => a.id === id);
  if (!adj) throw new Error("Adjustment not found");
  adj.name = data.name;
  adj.type = data.type;
  adj.calculation = data.calculation;
  adj.value = Number(data.value) || 0;
};

export const deleteAdjustment = function (id) {
  const index = state.settings.adjustments.findIndex((a) => a.id === id);
  if (index === -1) throw new Error("Adjustment not found");
  state.settings.adjustments.splice(index, 1);
};

export const toggleAdjustment = function (id) {
  const adj = state.settings.adjustments.find((a) => a.id === id);
  if (!adj) throw new Error("Adjustment not found");
  adj.enabled = !adj.enabled;
};

// ── Per-receipt adjustments ───────────────────────────────────────────────────

export const initReceiptAdjustments = function () {
  state.currentReceiptAdjustments = state.settings.adjustments
    .filter((a) => a.enabled)
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      calculation: a.calculation,
      value: a.value,
      appliedValue: a.value,
      removed: false,
      source: "auto",
    }));
};

export const overrideReceiptAdjustment = function (id, newValue) {
  const adj = state.currentReceiptAdjustments.find((a) => a.id === id);
  if (!adj) throw new Error("Receipt adjustment not found");
  adj.appliedValue = Number(newValue) || 0;
};

export const removeReceiptAdjustment = function (id) {
  const adj = state.currentReceiptAdjustments.find((a) => a.id === id);
  if (!adj) throw new Error("Receipt adjustment not found");
  adj.removed = true;
};

export const addManualReceiptAdjustment = function (data) {
  const adjustment = {
    id: generateAdjustmentId(),
    name: data.name,
    type: data.type,
    calculation: data.calculation,
    value: Number(data.value) || 0,
    appliedValue: Number(data.value) || 0,
    removed: false,
    source: "manual",
  };
  state.currentReceiptAdjustments.push(adjustment);
  return adjustment;
};

export const clearReceiptAdjustments = function () {
  state.currentReceiptAdjustments = [];
};

// ── Calculation ───────────────────────────────────────────────────────────────
// Expects receipt-level adjustments (with appliedValue + removed).
// Order: subtotal → discounts (% of subtotal) → fees (% of post-discount total)

export const calculateAdjustments = function (subtotal, adjustments) {
  const active = adjustments.filter((a) => !a.removed);
  const discounts = active.filter((a) => a.type === "discount");
  const fees = active.filter((a) => a.type === "fee");

  let runningTotal = subtotal;
  const lineItems = [];

  discounts.forEach((adj) => {
    const amount =
      adj.calculation === "percentage"
        ? subtotal * (adj.appliedValue / 100)
        : adj.appliedValue;
    lineItems.push({ ...adj, computedAmount: -amount });
    runningTotal -= amount;
  });

  fees.forEach((adj) => {
    const amount =
      adj.calculation === "percentage"
        ? runningTotal * (adj.appliedValue / 100)
        : adj.appliedValue;
    lineItems.push({ ...adj, computedAmount: amount });
    runningTotal += amount;
  });

  return {
    subtotal,
    lineItems,
    finalTotal: Math.max(0, runningTotal),
  };
};

function parseVariants(raw) {
  // This will temporarily store variants grouped by their index
  // Example:
  // {
  //   0: { optionLabel: "Size", options: [...] },
  //   1: { optionLabel: "Flavor", options: [...] }
  // }
  const variantMap = {};

  // Loop through every key in the flat form object
  Object.keys(raw).forEach((key) => {
    // We use regex to detect keys that follow this pattern:
    // variants[0][optionLabel]
    // variants[0][options][1][optionName]
    // variants[1][options][2][optionPrice]
    const match = key.match(
      /variants\[(\d+)\]\[(optionLabel|options)\](?:\[(\d+)\]\[(optionName|optionPrice)\])?/,
    );

    // If the key doesn't match that pattern, ignore it
    if (!match) return;

    // Extract matched values
    const variantIndex = match[1]; // e.g. "0"
    const field = match[2]; // "optionLabel" or "options"
    const optionIndex = match[3]; // e.g. "1" (if inside options)
    const optionField = match[4]; // "optionName" or "optionPrice"

    // If this variant doesn't exist yet in our map, create it
    if (!variantMap[variantIndex]) {
      variantMap[variantIndex] = {
        optionLabel: "",
        options: [],
      };
    }

    // If we're dealing with the variant label
    // Example: variants[0][optionLabel]
    if (field === "optionLabel") {
      variantMap[variantIndex].optionLabel = raw[key];
    }

    // If we're inside options
    // Example: variants[0][options][1][optionName]
    if (field === "options") {
      // If this specific option doesn't exist yet, create it
      if (!variantMap[variantIndex].options[optionIndex]) {
        variantMap[variantIndex].options[optionIndex] = {
          optionName: "",
          optionPrice: "0",
        };
      }

      // Assign either optionName or optionPrice
      variantMap[variantIndex].options[optionIndex][optionField] =
        optionField === "optionPrice" ? Number(raw[key]) || 0 : raw[key];
    }
  });

  // Convert the variantMap object into an array
  // Also remove empty options (where user left blank rows)
  return Object.values(variantMap).map((variant) => ({
    ...variant,
    options: variant.options.filter(
      (option) => option.optionName.trim() !== "",
    ),
  }));
}
