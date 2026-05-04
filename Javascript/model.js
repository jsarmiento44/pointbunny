import { supabase } from "./supabase.js";

let adjCounter = 0;

const generateAdjustmentId = function () {
  adjCounter += 1;
  return `adj_${Date.now()}-${adjCounter}`;
};

export const state = {
  userId: null,
  username: "Wowa",
  menuItems: [],
  menuCategories: [],
  employees: [],
  cart: [],
  salesBasket: [],
  cashflowSales: [],
  expenses: [],
  settings: {
    adjustments: [],
    showRemovedAdjustments: true,
    printingEnabled: localStorage.getItem('pointy_printing_enabled') !== 'false',
    confirmPrint: localStorage.getItem('pointy_confirm_print') !== 'false',
  },
  currentReceiptAdjustments: [],
};

// ── DB ↔ app shape mapping ────────────────────────────────────────────────────

const dbToItem = (row) => ({
  _id: row.id,
  itemName: row.item_name,
  price: Number(row.price),
  category: row.category,
  imageURL: row.image_url ?? "../Icons/default image.png",
  _stock: row.stock ?? "0",
  hasVariants: row.has_variants,
  variants: row.variants ?? [],
  description: row.description ?? "",
  status: row.status ?? "active",
});

// ── DB ↔ app shape mapping (employees) ───────────────────────────────────────

const dbToEmployee = (row) => ({
  id: row.id,
  name: row.name,
  role: row.role ?? "",
  systemRole: row.system_role ?? "",
});

// ── DB ↔ app shape mapping (expenses) ────────────────────────────────────────

const dbToExpense = (row) => ({
  id: row.id,
  amount: Number(row.amount),
  description: row.description,
  category: row.category ?? "",
  expenseDate: row.expense_date,
  createdAt: row.created_at,
  createdBy: row.created_by,
});

// ── Loaders (called once at app init) ────────────────────────────────────────

export const loadEmployees = async function () {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", state.userId)
    .order("created_at");
  if (error) throw error;
  state.employees = data.map(dbToEmployee);
};

export const loadMenuItems = async function () {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("user_id", state.userId)
    .order("created_at");
  if (error) throw error;
  state.menuItems = data.map(dbToItem);
};

export const loadMenuCategories = async function () {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("name")
    .eq("user_id", state.userId)
    .order("created_at");
  if (error) throw error;
  state.menuCategories = data.map((r) => r.name);
};

// ── Menu item CRUD ────────────────────────────────────────────────────────────

const uploadImage = async function (file, existingUrl = null) {
  if (!file || file.size === 0) return existingUrl ?? "../Icons/default image.png";
  const ext = file.name.split(".").pop();
  const path = `${state.userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("item-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("item-images").getPublicUrl(path);
  return data.publicUrl;
};

export const uploadNewMenuItem = async function (newItem) {
  const variants = newItem.variants ?? [];
  const imageURL = await uploadImage(newItem.image);

  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      user_id: state.userId,
      item_name: newItem.name,
      price: Number(newItem.price),
      category: newItem.category,
      image_url: imageURL,
      stock: "0",
      has_variants: variants.length > 0,
      variants,
      description:
        "This is a sample description of the menu item. You can add more details here.",
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;

  state.menuItems.push(dbToItem(data));
};

export const deleteMenuItem = async function (id) {
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("user_id", state.userId);
  if (error) throw error;
  const index = state.menuItems.findIndex((item) => item._id === id);
  if (index !== -1) state.menuItems.splice(index, 1);
};

export const deleteCartItem = function (index) {
  state.cart.splice(index, 1);
};

export const updateMenuItem = async function (id, rawData) {
  const item = state.menuItems.find((item) => item._id === id);
  if (!item) throw new Error("Item not found");

  const hasVariants = rawData.hasVariants === "on";
  const variants = hasVariants ? parseVariants(rawData) : [];

  const newImageURL = await uploadImage(rawData.image, item.imageURL);

  const { error } = await supabase
    .from("menu_items")
    .update({
      item_name: rawData.itemName || "",
      price: Number(rawData.price) || 0,
      category: rawData.category || "",
      stock: rawData.stock || "0",
      description: rawData.description || "",
      has_variants: hasVariants,
      variants,
      status: rawData.status?.toLowerCase() || "active",
      image_url: newImageURL,
    })
    .eq("id", id)
    .eq("user_id", state.userId);
  if (error) throw error;

  item.itemName = rawData.itemName || "";
  item.price = Number(rawData.price) || 0;
  item.category = rawData.category || "";
  item._stock = rawData.stock || "0";
  item.description = rawData.description || "";
  item.hasVariants = hasVariants;
  item.variants = variants;
  item.status = rawData.status?.toLowerCase() || "active";
  item.imageURL = newImageURL;
};

// ── Category CRUD ─────────────────────────────────────────────────────────────

export const addCategory = async function (name) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) throw new Error("Category name cannot be empty");
  if (state.menuCategories.includes(normalized))
    throw new Error("Category already exists");

  const { error } = await supabase
    .from("menu_categories")
    .insert({ user_id: state.userId, name: normalized });
  if (error) throw error;
  state.menuCategories.push(normalized);
};

export const deleteCategory = async function (name) {
  const { error } = await supabase
    .from("menu_categories")
    .delete()
    .eq("user_id", state.userId)
    .eq("name", name);
  if (error) throw error;
  const index = state.menuCategories.indexOf(name);
  if (index !== -1) state.menuCategories.splice(index, 1);
};

// ── Settings: adjustment CRUD ─────────────────────────────────────────────────

const dbToAdjustment = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  calculation: row.calculation,
  value: Number(row.value),
  enabled: row.enabled,
});

export const loadAdjustments = async function () {
  const { data, error } = await supabase
    .from("adjustments")
    .select("*")
    .eq("user_id", state.userId)
    .order("created_at");
  if (error) throw error;
  state.settings.adjustments = data.map(dbToAdjustment);
};

export const addAdjustment = async function (data) {
  const { data: row, error } = await supabase
    .from("adjustments")
    .insert({
      user_id: state.userId,
      name: data.name,
      type: data.type,
      calculation: data.calculation,
      value: Number(data.value) || 0,
      enabled: true,
    })
    .select()
    .single();
  if (error) throw error;
  const adjustment = dbToAdjustment(row);
  state.settings.adjustments.push(adjustment);
  return adjustment;
};

export const updateAdjustment = async function (id, data) {
  const { error } = await supabase
    .from("adjustments")
    .update({
      name: data.name,
      type: data.type,
      calculation: data.calculation,
      value: Number(data.value) || 0,
    })
    .eq("id", id)
    .eq("user_id", state.userId);
  if (error) throw error;
  const adj = state.settings.adjustments.find((a) => a.id === id);
  if (adj) {
    adj.name = data.name;
    adj.type = data.type;
    adj.calculation = data.calculation;
    adj.value = Number(data.value) || 0;
  }
};

export const deleteAdjustment = async function (id) {
  const { error } = await supabase
    .from("adjustments")
    .delete()
    .eq("id", id)
    .eq("user_id", state.userId);
  if (error) throw error;
  const index = state.settings.adjustments.findIndex((a) => a.id === id);
  if (index !== -1) state.settings.adjustments.splice(index, 1);
};

export const toggleAdjustment = async function (id) {
  const adj = state.settings.adjustments.find((a) => a.id === id);
  if (!adj) throw new Error("Adjustment not found");
  const newEnabled = !adj.enabled;
  const { error } = await supabase
    .from("adjustments")
    .update({ enabled: newEnabled })
    .eq("id", id)
    .eq("user_id", state.userId);
  if (error) throw error;
  adj.enabled = newEnabled;
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

// ── Today's sales total ───────────────────────────────────────────────────────

export const loadTodaySalesTotal = async function () {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);
  const { data, error } = await supabase
    .from("sales")
    .select("total_price")
    .eq("user_id", state.userId)
    .gte("sale_date", start.toISOString())
    .lte("sale_date", end.toISOString());
  if (error) throw error;
  return data.reduce((sum, r) => sum + Number(r.total_price), 0);
};

// ── Cashflow ──────────────────────────────────────────────────────────────────

export const fetchCashflowData = async function (startISO, endISO) {
  const [salesResult, expensesResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, total_price, subtotal, customer_payment, customer_change, adjustments, sale_date, items, is_manual, added_by")
      .eq("user_id", state.userId)
      .gte("sale_date", startISO)
      .lte("sale_date", endISO)
      .order("sale_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", state.userId)
      .gte("expense_date", startISO)
      .lte("expense_date", endISO)
      .order("expense_date", { ascending: false }),
  ]);
  if (salesResult.error) throw salesResult.error;
  if (expensesResult.error) throw expensesResult.error;
  state.cashflowSales = salesResult.data;
  state.expenses = expensesResult.data.map(dbToExpense);
};

export const addExpense = async function ({ amount, description, category, expense_date }) {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: state.userId,
      store_name: state.username,
      amount: Number(amount),
      description,
      category: category || null,
      expense_date,
      created_by: state.username,
    })
    .select()
    .single();
  if (error) throw error;
  const expense = dbToExpense(data);
  state.expenses.unshift(expense);
  return expense;
};

export const deleteExpense = async function (id) {
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", state.userId);
  if (error) throw error;
  const index = state.expenses.findIndex((e) => e.id === id);
  if (index !== -1) state.expenses.splice(index, 1);
};

function parseVariants(raw) {
  const variantMap = {};

  Object.keys(raw).forEach((key) => {
    const match = key.match(
      /variants\[(\d+)\]\[(optionLabel|options)\](?:\[(\d+)\]\[(optionName|optionPrice)\])?/,
    );
    if (!match) return;

    const variantIndex = match[1];
    const field = match[2];
    const optionIndex = match[3];
    const optionField = match[4];

    if (!variantMap[variantIndex]) {
      variantMap[variantIndex] = { optionLabel: "", options: [] };
    }

    if (field === "optionLabel") {
      variantMap[variantIndex].optionLabel = raw[key];
    }

    if (field === "options") {
      if (!variantMap[variantIndex].options[optionIndex]) {
        variantMap[variantIndex].options[optionIndex] = {
          optionName: "",
          optionPrice: "0",
        };
      }
      variantMap[variantIndex].options[optionIndex][optionField] =
        optionField === "optionPrice" ? Number(raw[key]) || 0 : raw[key];
    }
  });

  return Object.values(variantMap).map((variant) => ({
    ...variant,
    options: variant.options.filter(
      (option) => option.optionName.trim() !== "",
    ),
  }));
}
