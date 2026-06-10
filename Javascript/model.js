import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase.js";

let adjCounter = 0;

const safeParse = (str, fallback) => { if (str == null) return fallback; try { return JSON.parse(str); } catch { return fallback; } };

const generateAdjustmentId = function () {
  adjCounter += 1;
  return `adj_${Date.now()}-${adjCounter}`;
};

export const state = {
  userId: null,         // logged-in user's own auth ID
  businessId: null,     // business this session belongs to (owner's user ID)
  businessName: null,
  businessEmail: null,
  businessPhone: null,
  businessTimezone: null,  // IANA timezone string, e.g. "Asia/Manila"
  username: "Wowa",
  role: null,           // role name of the logged-in user
  currentStaff: null,   // logged-in user's staff record
  currentCashier: null, // staff member actively on the POS (switchable)
  staff: [],
  roles: [],
  menuItems: [],
  menuCategories: [],
  employees: [],
  cart: [],
  orderQueue: [],
  salesBasket: [],
  cashflowSales: [],
  voidedSales: [],
  tickets: [],
  reportsSales: [],
  expenses: [],
  discountCodes: [],
  currentPromoCode: null,
  shifts: [],
  currentShift: null,
  settings: {
    adjustments: [],
    showRemovedAdjustments: true,
    printingEnabled: localStorage.getItem('pointbunny_printing_enabled') !== 'false',
    confirmPrint: localStorage.getItem('pointbunny_confirm_print') !== 'false',
    printTwoCopies: localStorage.getItem('pointbunny_print_two_copies') === 'true',
    kdsYellowThreshold: parseInt(localStorage.getItem('pointbunny_kds_yellow') || '180'),
    kdsRedThreshold: parseInt(localStorage.getItem('pointbunny_kds_red') || '300'),
    kdsAutoCompleteThreshold: parseInt(localStorage.getItem('pointbunny_kds_auto') || '900'),
    kdsWindowSize: safeParse(localStorage.getItem('pointbunny_kds_window_size'), { width: 1920, height: 1080 }),
    cfdWindowSize: safeParse(localStorage.getItem('pointbunny_cfd_window_size'), { width: 1920, height: 1080 }),
    orderTypeEnabled: localStorage.getItem('pointbunny_order_type_enabled') !== 'false',
  },
  currentReceiptAdjustments: [],
  needsOnboarding: false,
  businessType:            null,
  businessIndustry:        null,
  businessAddressStreet:   null,
  businessAddressCity:     null,
  businessAddressProvince: null,
  businessAddressZip:      null,
  businessAddressCountry:  null,
};

// ── Business context (runs on every login) ────────────────────────────────────

const _initBusiness = async function (user) {
  const displayName  = user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? '';
  const firstName    = user.user_metadata?.first_name || displayName.split(' ')[0] || '';
  const lastName     = user.user_metadata?.last_name  || displayName.split(' ').slice(1).join(' ') || '';
  const businessName = user.user_metadata?.business_name
    || `${firstName} ${lastName}`.trim()
    || user.email
    || 'My Business';
  const phone        = user.user_metadata?.phone ?? null;

  const { error: bizError } = await supabase
    .from('businesses')
    .upsert({ id: user.id, name: businessName, email: user.email, phone: null }, { ignoreDuplicates: true });
  if (bizError) throw new Error(`businesses upsert failed: ${bizError.message}`);

  const { data: existingRole } = await supabase
    .from('roles')
    .select('id')
    .eq('business_id', user.id)
    .eq('name', 'Admin')
    .maybeSingle();

  let adminRoleId = existingRole?.id;
  if (!adminRoleId) {
    const { data: insertedRoles, error: roleError } = await supabase
      .from('roles')
      .insert([
        { business_id: user.id, name: 'Admin',   permissions: { menu: true,  cashflow: true,  settings: 'full',    staff: true,  discounts: true  } },
        { business_id: user.id, name: 'Manager', permissions: { menu: true,  cashflow: true,  settings: 'full',    staff: false, discounts: true  } },
        { business_id: user.id, name: 'Cashier', permissions: { menu: false, cashflow: false, settings: 'limited', staff: false, discounts: false } },
      ])
      .select('id, name');
    if (roleError) throw new Error(`roles insert failed: ${roleError.message}`);
    adminRoleId = insertedRoles.find(r => r.name === 'Admin')?.id;
  }

  const { data: existingStaff } = await supabase
    .from('staff')
    .select('id, first_name, last_name, email')
    .eq('user_id', user.id)
    .maybeSingle();

  let staffRow = existingStaff;
  if (!staffRow) {
    const { data: newStaff, error: staffError } = await supabase
      .from('staff')
      .insert({
        business_id: user.id,
        user_id: user.id,
        role_id: adminRoleId,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        joined_at: new Date().toISOString(),
      })
      .select('id, first_name, last_name, email')
      .single();
    if (staffError) throw new Error(`staff insert failed: ${staffError.message}`);
    staffRow = newStaff;
  }

  state.currentStaff = {
    id: staffRow.id,
    firstName: staffRow.first_name,
    lastName: staffRow.last_name,
    email: staffRow.email,
    role: 'Admin',
  };
};

export const loadBusinessContext = async function (user, { isInviteAcceptance = false } = {}) {
  state.userId = user.id;

  let { data: staffRow } = await supabase
    .from('staff')
    .select('id, business_id, first_name, last_name, email, pin, is_active, roles(name)')
    .eq('user_id', user.id)
    .maybeSingle();

  // Honors removal from the Staff panel (soft delete) and deactivation from the
  // admin panel - both set is_active = false. Checked on login and session restore.
  if (staffRow && staffRow.is_active === false) {
    const err = new Error('Your account has been deactivated. Please contact your business owner.');
    err.code = 'STAFF_DEACTIVATED';
    throw err;
  }

  // Only claim a pending invite row when the user explicitly came through the invite link.
  // Skipping this for normal sign-in/sign-up prevents a person who owns their own business
  // from being silently enrolled as staff at another business that invited their email.
  if (!staffRow && isInviteAcceptance) {
    const { data: pendingRow } = await supabase
      .from('staff')
      .select('id, business_id, first_name, last_name, email, pin, roles(name)')
      .eq('email', user.email)
      .is('user_id', null)
      .eq('is_active', true)
      .maybeSingle();

    if (pendingRow) {
      await supabase
        .from('staff')
        .update({ user_id: user.id, joined_at: new Date().toISOString() })
        .eq('id', pendingRow.id);
      staffRow = pendingRow;
    }
  }

  if (staffRow) {
    state.businessId   = staffRow.business_id;
    state.role         = staffRow.roles?.name ?? 'Admin';
    state.currentStaff = {
      id:        staffRow.id,
      firstName: staffRow.first_name,
      lastName:  staffRow.last_name,
      email:     staffRow.email,
      role:      state.role,
      hasPin:    !!staffRow.pin,
    };
  } else {
    if (user.user_metadata?.role === 'staff') {
      throw new Error('Staff account setup incomplete. Please contact your manager or try accepting your invite link again.');
    }
    state.businessId   = user.id;
    state.role         = 'Admin';
    state.currentStaff = null;
    await _initBusiness(user);
  }

  state.currentCashier = state.currentStaff;

  const { data: bizData } = await supabase
    .from('businesses')
    .select('name, timezone, phone, address_street, address_city, address_province, address_zip, address_country, business_type, business_industry')
    .eq('id', state.businessId)
    .single();
  if (bizData) {
    state.businessName            = bizData.name              ?? null;
    state.businessTimezone        = bizData.timezone          ?? null;
    state.businessPhone           = bizData.phone             ?? null;
    state.businessAddressStreet   = bizData.address_street    ?? null;
    state.businessAddressCity     = bizData.address_city      ?? null;
    state.businessAddressProvince = bizData.address_province  ?? null;
    state.businessAddressZip      = bizData.address_zip       ?? null;
    state.businessAddressCountry  = bizData.address_country   ?? null;
    state.businessType            = bizData.business_type     ?? null;
    state.businessIndustry        = bizData.business_industry ?? null;
  }

  if (user.user_metadata?.role === 'owner' || (!user.user_metadata?.role && state.userId === state.businessId)) {
    const onboardingComplete =
      state.businessName         &&
      state.businessType         &&
      state.businessIndustry     &&
      state.businessPhone        &&
      state.businessAddressStreet  &&
      state.businessAddressCity    &&
      state.businessAddressProvince &&
      state.businessAddressZip     &&
      state.businessAddressCountry;
    if (!onboardingComplete) state.needsOnboarding = true;
  }

  // Auto-detect timezone on first login if the owner hasn't set one yet.
  // Only the owner writes this — staff logins leave it untouched.
  if (!state.businessTimezone && state.userId === state.businessId) {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) {
      state.businessTimezone = detected;
      supabase
        .from('businesses')
        .update({ timezone: detected })
        .eq('id', state.businessId)
        .then(() => {}); // fire-and-forget, non-blocking
    }
  }
};

export const loadBusinessProfile = async function () {
  const { data } = await supabase
    .from('businesses')
    .select('name, email, phone, timezone, address_street, address_city, address_province, address_zip')
    .eq('id', state.businessId)
    .single();
  if (data) {
    state.businessName            = data.name             ?? null;
    state.businessEmail           = data.email            ?? null;
    state.businessPhone           = data.phone            ?? null;
    state.businessTimezone        = data.timezone         ?? null;
    state.businessAddressStreet   = data.address_street   ?? null;
    state.businessAddressCity     = data.address_city     ?? null;
    state.businessAddressProvince = data.address_province ?? null;
    state.businessAddressZip      = data.address_zip      ?? null;
  }
};

export const saveBusinessInfo = async function ({ name, email, phone, timezone, addressStreet, addressCity, addressProvince, addressZip }) {
  const { error } = await supabase
    .from('businesses')
    .update({
      name,
      email:            email            || null,
      phone:            phone            || null,
      timezone:         timezone         || null,
      address_street:   addressStreet    || null,
      address_city:     addressCity      || null,
      address_province: addressProvince  || null,
      address_zip:      addressZip       || null,
    })
    .eq('id', state.businessId);
  if (error) throw error;
  state.businessName            = name;
  state.businessEmail           = email            || null;
  state.businessPhone           = phone            || null;
  state.businessTimezone        = timezone         || null;
  state.businessAddressStreet   = addressStreet    || null;
  state.businessAddressCity     = addressCity      || null;
  state.businessAddressProvince = addressProvince  || null;
  state.businessAddressZip      = addressZip       || null;
};

export const saveOnboardingInfo = async function ({ businessName, businessType, industry, phone, street, city, province, zip, country }) {
  const { data: updated, error } = await supabase
    .from('businesses')
    .update({
      name:              businessName,
      business_type:     businessType     || null,
      business_industry: industry         || null,
      phone:             phone            || null,
      address_street:    street           || null,
      address_city:      city             || null,
      address_province:  province         || null,
      address_zip:       zip              || null,
      address_country:   country          || null,
    })
    .eq('id', state.businessId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated?.length) throw new Error(`Business record not found (id: ${state.businessId}). Please refresh and try again.`);
  state.businessName            = businessName;
  state.businessType            = businessType     || null;
  state.businessIndustry        = industry         || null;
  state.businessPhone           = phone            || null;
  state.businessAddressStreet   = street           || null;
  state.businessAddressCity     = city             || null;
  state.businessAddressProvince = province         || null;
  state.businessAddressZip      = zip              || null;
  state.businessAddressCountry  = country          || null;
  state.needsOnboarding         = false;
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
    .eq("user_id", state.businessId)
    .order("created_at");
  if (error) throw error;
  state.employees = data.map(dbToEmployee);
};

export const loadMenuItems = async function () {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("user_id", state.businessId)
    .order("created_at");
  if (error) throw error;
  state.menuItems = data.map(dbToItem);
};

export const loadMenuCategories = async function () {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("name")
    .eq("user_id", state.businessId)
    .order("created_at");
  if (error) throw error;
  state.menuCategories = data.map((r) => r.name);
};

// ── Menu item CRUD ────────────────────────────────────────────────────────────

const uploadImage = async function (file, existingUrl = null) {
  if (!file || file.size === 0) return existingUrl ?? "../Icons/default image.png";
  const ext = file.name.split(".").pop();
  const path = `${state.businessId}/${Date.now()}.${ext}`;
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
      user_id: state.businessId,
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
    .eq("user_id", state.businessId);
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
    .eq("user_id", state.businessId);
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
    .insert({ user_id: state.businessId, name: normalized });
  if (error) throw error;
  state.menuCategories.push(normalized);
};

export const deleteCategory = async function (name) {
  const affected = state.menuItems.filter((i) => i.category === name);
  if (affected.length) {
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({ category: "uncategorized" })
      .eq("user_id", state.businessId)
      .eq("category", name);
    if (updateError) throw updateError;
    affected.forEach((i) => { i.category = "uncategorized"; });
  }

  const { error } = await supabase
    .from("menu_categories")
    .delete()
    .eq("user_id", state.businessId)
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
    .eq("user_id", state.businessId)
    .order("created_at");
  if (error) throw error;
  state.settings.adjustments = data.map(dbToAdjustment);
};

export const addAdjustment = async function (data) {
  const { data: row, error } = await supabase
    .from("adjustments")
    .insert({
      user_id: state.businessId,
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
    .eq("user_id", state.businessId);
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
    .eq("user_id", state.businessId);
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
    .eq("user_id", state.businessId);
  if (error) throw error;
  adj.enabled = newEnabled;
};

// ── Per-receipt adjustments ───────────────────────────────────────────────────

export const initReceiptAdjustments = function () {
  state.currentPromoCode = null;
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
  state.currentPromoCode = null;
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
    .eq("user_id", state.businessId)
    .gte("sale_date", start.toISOString())
    .lte("sale_date", end.toISOString())
    .is("voided_at", null);
  if (error) throw error;
  return data.reduce((sum, r) => sum + Number(r.total_price), 0);
};

export const loadTransactionCounts = async function () {
  const now = new Date();
  const todayStart     = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd       = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const yesterday      = new Date(now); yesterday.setDate(now.getDate() - 1);
  const yesterdayStart = new Date(yesterday); yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd   = new Date(yesterday); yesterdayEnd.setHours(23, 59, 59, 999);

  const [todayRes, yestRes] = await Promise.all([
    supabase.from('sales').select('id', { count: 'exact', head: true })
      .eq('user_id', state.businessId)
      .gte('sale_date', todayStart.toISOString())
      .lte('sale_date', todayEnd.toISOString())
      .is('voided_at', null),
    supabase.from('sales').select('id', { count: 'exact', head: true })
      .eq('user_id', state.businessId)
      .gte('sale_date', yesterdayStart.toISOString())
      .lte('sale_date', yesterdayEnd.toISOString())
      .is('voided_at', null),
  ]);

  return { today: todayRes.count ?? 0, yesterday: yestRes.count ?? 0 };
};

export const loadYesterdaySalesTotal = async function () {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const start = new Date(yesterday); start.setHours(0, 0, 0, 0);
  const end   = new Date(yesterday); end.setHours(23, 59, 59, 999);
  const { data, error } = await supabase
    .from("sales")
    .select("total_price")
    .eq("user_id", state.businessId)
    .gte("sale_date", start.toISOString())
    .lte("sale_date", end.toISOString())
    .is("voided_at", null);
  if (error) throw error;
  return data.reduce((sum, r) => sum + Number(r.total_price), 0);
};

// ── Cashflow ──────────────────────────────────────────────────────────────────

export const fetchCashflowData = async function (startISO, endISO) {
  const [salesResult, expensesResult, voidedResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, total_price, subtotal, customer_payment, customer_change, adjustments, sale_date, items, is_manual, added_by, order_type, ticket_number, prepared_at, timed_out")
      .eq("user_id", state.businessId)
      .gte("sale_date", startISO)
      .lte("sale_date", endISO)
      .is("voided_at", null)
      .order("sale_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", state.businessId)
      .gte("expense_date", startISO)
      .lte("expense_date", endISO)
      .order("expense_date", { ascending: false }),
    supabase
      .from("sales")
      .select("id, total_price, subtotal, customer_payment, customer_change, adjustments, sale_date, items, added_by, order_type, ticket_number, voided_at, voided_by")
      .eq("user_id", state.businessId)
      .gte("sale_date", startISO)
      .lte("sale_date", endISO)
      .not("voided_at", "is", null)
      .order("voided_at", { ascending: false }),
  ]);
  if (salesResult.error) throw salesResult.error;
  if (expensesResult.error) throw expensesResult.error;
  if (voidedResult.error) throw voidedResult.error;
  state.cashflowSales = salesResult.data;
  state.expenses = expensesResult.data.map(dbToExpense);
  state.voidedSales = voidedResult.data;
};

export const voidSale = async function (id, voidedBy) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('sales')
    .update({ voided_at: now, voided_by: voidedBy })
    .eq('id', id)
    .eq('user_id', state.businessId);
  if (error) throw error;
  const wasInQueue = state.orderQueue.some(o => o.id === id);
  state.orderQueue = state.orderQueue.filter(o => o.id !== id);
  const voidedSale = state.cashflowSales.find(s => s.id === id);
  state.cashflowSales = state.cashflowSales.filter(s => s.id !== id);
  if (voidedSale) {
    state.voidedSales = [{ ...voidedSale, voided_at: now, voided_by: voidedBy }, ...state.voidedSales];
  }
  return { wasInQueue };
};



export const verifyOverrideCredentials = async function (email, password) {
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await tempClient.auth.signInWithPassword({ email, password });
  if (authError) throw new Error('Invalid email or password.');

  const { data: staffData } = await tempClient
    .from('staff')
    .select('first_name, last_name, roles(permissions)')
    .eq('user_id', authData.user.id)
    .eq('business_id', state.businessId)
    .eq('is_active', true)
    .maybeSingle();

  await tempClient.auth.signOut({ scope: 'local' });

  if (!staffData) throw new Error('This account is not a staff member at this location.');
  if (!staffData.roles?.permissions?.cashflow) throw new Error('This account does not have permission to authorize this action.');

  return [staffData.first_name, staffData.last_name].filter(Boolean).join(' ') || email;
};

export const fetchReportsSalesRaw = async function (startISO, endISO) {
  const { data, error } = await supabase
    .from("sales")
    .select("id, total_price, sale_date, items, added_by, order_type, prepared_at")
    .eq("user_id", state.businessId)
    .gte("sale_date", startISO)
    .lte("sale_date", endISO)
    .is("voided_at", null)
    .order("sale_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const fetchReportsSales = async function (startISO, endISO) {
  state.reportsSales = await fetchReportsSalesRaw(startISO, endISO);
};

export const fetchPeriodTotals = async function (startISO, endISO) {
  const { data, error } = await supabase
    .from("sales")
    .select("total_price, sale_date, prepared_at")
    .eq("user_id", state.businessId)
    .gte("sale_date", startISO)
    .lte("sale_date", endISO)
    .is("voided_at", null);
  if (error) throw error;
  const revenue = data.reduce((s, r) => s + Number(r.total_price), 0);
  const transactions = data.length;
  let servTotal = 0, servCount = 0;
  for (const r of data) {
    if (!r.prepared_at) continue;
    const mins = (new Date(r.prepared_at) - new Date(r.sale_date)) / 60000;
    if (mins < 0 || mins > 120) continue;
    servTotal += mins; servCount++;
  }
  return {
    revenue,
    transactions,
    avgOrder: transactions > 0 ? revenue / transactions : 0,
    avgServingMinutes: servCount > 0 ? servTotal / servCount : null,
  };
};

export const addExpense = async function ({ amount, description, category, expense_date }) {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: state.businessId,
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
    .eq("user_id", state.businessId);
  if (error) throw error;
  const index = state.expenses.findIndex((e) => e.id === id);
  if (index !== -1) state.expenses.splice(index, 1);
};

// ── Discount Codes ────────────────────────────────────────────────────────────

const dbToDiscountCode = (row) => ({
  id: row.id,
  title: row.title,
  code: row.code,
  description: row.description ?? "",
  type: row.type,
  value: Number(row.value),
  usageLimit: row.usage_limit,
  usageCount: row.usage_count,
  status: row.status,
  createdAt: row.created_at,
});

export const loadDiscountCodes = async function () {
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("user_id", state.businessId)
    .order("created_at");
  if (error) {
    state.discountCodes = [];
    return;
  }
  state.discountCodes = data.map(dbToDiscountCode);
};

export const createDiscountCode = async function (data) {
  const code = data.code.toUpperCase().trim();
  const { data: row, error } = await supabase
    .from("discount_codes")
    .insert({
      user_id: state.businessId,
      title: data.title,
      code,
      description: data.description || null,
      type: data.type,
      value: Number(data.value),
      usage_limit: data.usageLimit ?? null,
      usage_count: 0,
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  const dc = dbToDiscountCode(row);
  state.discountCodes.push(dc);
  return dc;
};

export const updateDiscountCode = async function (id, data) {
  const code = data.code.toUpperCase().trim();
  const { error } = await supabase
    .from("discount_codes")
    .update({
      title: data.title,
      code,
      description: data.description || null,
      type: data.type,
      value: Number(data.value),
      usage_limit: data.usageLimit ?? null,
    })
    .eq("id", id)
    .eq("user_id", state.businessId);
  if (error) throw error;
  const dc = state.discountCodes.find((d) => d.id === id);
  if (dc) {
    dc.title = data.title;
    dc.code = code;
    dc.description = data.description || "";
    dc.type = data.type;
    dc.value = Number(data.value);
    dc.usageLimit = data.usageLimit ?? null;
  }
};

export const deleteDiscountCode = async function (id) {
  const { error } = await supabase
    .from("discount_codes")
    .delete()
    .eq("id", id)
    .eq("user_id", state.businessId);
  if (error) throw error;
  const index = state.discountCodes.findIndex((d) => d.id === id);
  if (index !== -1) state.discountCodes.splice(index, 1);
};

export const toggleDiscountCodeStatus = async function (id) {
  const dc = state.discountCodes.find((d) => d.id === id);
  if (!dc) throw new Error("Code not found");
  const newStatus = dc.status === "active" ? "paused" : "active";
  const { error } = await supabase
    .from("discount_codes")
    .update({ status: newStatus })
    .eq("id", id)
    .eq("user_id", state.businessId);
  if (error) throw error;
  dc.status = newStatus;
};

export const validateDiscountCode = function (code) {
  const normalized = code.toUpperCase().trim();
  const dc = state.discountCodes.find((d) => d.code === normalized);
  if (!dc) throw new Error("Invalid promo code");
  if (dc.status !== "active") throw new Error("This code is currently inactive");
  if (dc.usageLimit !== null && dc.usageCount >= dc.usageLimit)
    throw new Error("This code has reached its usage limit");
  return dc;
};

export const applyPromoCodeToReceipt = function (dc) {
  const adj = {
    id: generateAdjustmentId(),
    name: `${dc.title} (${dc.code})`,
    type: "discount",
    calculation: dc.type === "percentage" ? "percentage" : "fixed",
    value: dc.value,
    appliedValue: dc.value,
    removed: false,
    source: "promo-code",
  };
  state.currentReceiptAdjustments.push(adj);
  state.currentPromoCode = {
    discountCodeId: dc.id,
    adjId: adj.id,
    code: dc.code,
    title: dc.title,
    type: dc.type,
    value: dc.value,
  };
  return adj;
};

export const removePromoCodeFromReceipt = function () {
  if (!state.currentPromoCode) return;
  const { adjId } = state.currentPromoCode;
  const index = state.currentReceiptAdjustments.findIndex((a) => a.id === adjId);
  if (index !== -1) state.currentReceiptAdjustments.splice(index, 1);
  state.currentPromoCode = null;
};

export const redeemDiscountCode = async function (id) {
  const dc = state.discountCodes.find((d) => d.id === id);
  if (!dc) return;
  const { error } = await supabase
    .from("discount_codes")
    .update({ usage_count: dc.usageCount + 1 })
    .eq("id", id)
    .eq("user_id", state.businessId);
  if (!error) dc.usageCount += 1;
};

export const uploadCFDAdImage = async function (file) {
  const url = await uploadImage(file);
  localStorage.setItem('pointbunny_cfd_ad', url);
  return url;
};

export const removeCFDAdImage = function () {
  localStorage.removeItem('pointbunny_cfd_ad');
};

export const loadOrderQueue = async function () {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);
  const { data, error } = await supabase
    .from('sales')
    .select('id, sale_date, items, total_price, order_type, ticket_number')
    .eq('user_id', state.businessId)
    .gte('sale_date', start.toISOString())
    .lte('sale_date', end.toISOString())
    .is('prepared_at', null)
    .is('voided_at', null)
    .order('sale_date', { ascending: true });
  if (error) throw error;
  state.orderQueue = data.map(row => ({
    id: row.id,
    saleDate: row.sale_date,
    items: row.items,
    startedAt: new Date(row.sale_date).getTime(),
    totalPrice: Number(row.total_price),
    orderType: row.order_type ?? 'dine-in',
    ticketNumber: row.ticket_number ?? null,
  }));
};

export const recordServeTime = async function (id, timedOut) {
  const { error } = await supabase
    .from('sales')
    .update({
      prepared_at: new Date().toISOString(),
      timed_out: timedOut,
    })
    .eq('id', id)
    .eq('user_id', state.businessId);
  if (error) throw error;
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

// ── Staff management ──────────────────────────────────────────────────────────

// Live deactivation kick-out: fires the callback the moment this user's staff row
// gets is_active = false (in-app removal or admin panel deactivation). Requires the
// staff table to be in the supabase_realtime publication.
let _staffWatchChannel = null;

export const watchStaffDeactivation = function (onDeactivated) {
  if (!state.currentStaff?.id || _staffWatchChannel) return;
  _staffWatchChannel = supabase
    .channel(`staff-active-${state.currentStaff.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'staff',
      filter: `id=eq.${state.currentStaff.id}`,
    }, (payload) => {
      if (payload.new?.is_active === false) onDeactivated();
    })
    .subscribe();
};

const dbToStaff = (row) => ({
  id:         row.id,
  firstName:  row.first_name,
  lastName:   row.last_name,
  email:      row.email,
  hourlyRate: row.hourly_rate ?? null,
  isActive:  row.is_active,
  joinedAt:  row.joined_at,
  isPending: !row.user_id,
  role:      row.roles?.name ?? 'Staff',
  roleId:    row.roles?.id ?? null,
  isSelf:    row.user_id === state.userId,
  hasPin:    !!row.pin,
  pin:       row.pin ?? null,
});

export const loadStaff = async function () {
  const { data, error } = await supabase
    .from('staff')
    .select('id, first_name, last_name, email, is_active, joined_at, user_id, pin, hourly_rate, roles(id, name)')
    .eq('business_id', state.businessId)
    .eq('is_active', true)
    .order('invited_at', { ascending: true });
  if (error) throw error;
  state.staff = data.map(dbToStaff);
};

export const loadRoles = async function () {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name')
    .eq('business_id', state.businessId)
    .order('created_at');
  if (error) throw error;
  state.roles = data;
};

export const inviteStaff = async function ({ firstName, lastName, email, roleId }) {
  const normalizedEmail = email.toLowerCase().trim();

  // A previously removed (soft-deleted) staff member is reactivated instead of
  // inserted again - their auth account and history still exist.
  const { data: inactiveRow } = await supabase
    .from('staff')
    .select('id, user_id')
    .eq('business_id', state.businessId)
    .eq('email', normalizedEmail)
    .eq('is_active', false)
    .maybeSingle();

  if (inactiveRow) {
    const { data: reactivated, error: reError } = await supabase
      .from('staff')
      .update({ is_active: true, first_name: firstName, last_name: lastName, role_id: roleId })
      .eq('id', inactiveRow.id)
      .select('id, first_name, last_name, email, is_active, joined_at, user_id, pin, hourly_rate, roles(id, name)')
      .single();
    if (reError) throw reError;
    state.staff.push(dbToStaff(reactivated));
    return { reactivated: true };
  }

  const { data, error } = await supabase
    .from('staff')
    .insert({
      business_id: state.businessId,
      first_name:  firstName,
      last_name:   lastName,
      email:       normalizedEmail,
      role_id:     roleId,
      invited_at:  new Date().toISOString(),
    })
    .select('id, first_name, last_name, email, is_active, joined_at, user_id, pin, roles(id, name)')
    .single();
  if (error) throw error;

  const { error: fnError } = await supabase.functions.invoke('invite-staff', {
    body: { email: normalizedEmail, firstName, lastName, businessId: state.businessId },
  });

  if (fnError) {
    await supabase.from('staff').delete().eq('id', data.id);
    let detail = fnError.message;
    try {
      if (fnError.context instanceof Response) {
        const body = await fnError.context.json();
        if (body?.error) detail = body.error;
      }
    } catch {}
    throw new Error(`Invite failed: ${detail}`);
  }

  state.staff.push(dbToStaff(data));
  return { reactivated: false };
};

export const updateStaffRole = async function (staffId, roleId) {
  const { error, count } = await supabase
    .from('staff')
    .update({ role_id: roleId }, { count: 'exact' })
    .eq('id', staffId)
    .eq('business_id', state.businessId);
  if (error) throw error;
  if (count === 0) throw new Error('Permission denied. Check staff RLS update policy.');
  const role = state.roles.find(r => r.id === roleId);
  const s = state.staff.find(s => s.id === staffId);
  if (s && role) { s.roleId = roleId; s.role = role.name; }
};

export const setStaffPin = async function (staffId, pin) {
  const { error, count } = await supabase
    .from('staff')
    .update({ pin: pin || null }, { count: 'exact' })
    .eq('id', staffId)
    .eq('business_id', state.businessId);
  if (error) throw error;
  if (count === 0) throw new Error('Permission denied. Check staff RLS update policy.');
  const s = state.staff.find(s => s.id === staffId);
  if (s) { s.pin = pin || null; s.hasPin = !!pin; }
};

export const removeStaff = async function (id) {
  const member = state.staff.find((s) => s.id === id);

  if (member?.isPending) {
    // Pending invites have no history - hard delete so the email can be re-invited cleanly.
    const { error, count } = await supabase
      .from('staff')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('business_id', state.businessId);
    if (error) throw error;
    if (count === 0) throw new Error('Could not delete staff member. Please try again.');
  } else {
    // Joined staff are soft-deleted so shifts, sales attribution, and payroll history survive.
    const { error, count } = await supabase
      .from('staff')
      .update({ is_active: false }, { count: 'exact' })
      .eq('id', id)
      .eq('business_id', state.businessId);
    if (error) throw error;
    if (count === 0) throw new Error('Could not remove staff member. Please try again.');
  }

  const idx = state.staff.findIndex((s) => s.id === id);
  if (idx !== -1) state.staff.splice(idx, 1);
};

export const addRole = async function (name) {
  const { data, error } = await supabase
    .from('roles')
    .insert({
      business_id: state.businessId,
      name: name.trim(),
      permissions: {},
    })
    .select('id, name')
    .single();
  if (error) throw error;
  state.roles.push(data);
  return data;
};

export const loadTickets = async function () {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const { data, error } = await supabase
    .from('tickets')
    .select('id, category, subject, message, status, has_unread_reply, created_at, solved_at, attachments, rating')
    .eq('business_id', state.businessId)
    .or(`status.eq.open,and(status.eq.solved,solved_at.gte.${cutoff.toISOString()})`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  state.tickets = data;
};

export const loadTicketReplies = async function (ticketId) {
  const { data, error } = await supabase
    .from('ticket_replies')
    .select('id, sender_type, message, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const markTicketSolved = async function (ticketId) {
  const solvedAt = new Date().toISOString();
  const { error } = await supabase
    .from('tickets')
    .update({ status: 'solved', solved_at: solvedAt })
    .eq('id', ticketId)
    .eq('business_id', state.businessId);
  if (error) throw error;
  const t = state.tickets.find(t => t.id === ticketId);
  if (t) { t.status = 'solved'; t.solved_at = solvedAt; }
};

export const markRepliesRead = async function (ticketId) {
  const { error } = await supabase
    .from('tickets')
    .update({ has_unread_reply: false })
    .eq('id', ticketId)
    .eq('business_id', state.businessId);
  if (error) throw error;
  const t = state.tickets.find(t => t.id === ticketId);
  if (t) t.has_unread_reply = false;
};

// ── Shifts & timeclock ────────────────────────────────────────────────────────

export const generateTimeclockToken = async function () {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { error } = await supabase
    .from('businesses')
    .update({ timeclock_token: token })
    .eq('id', state.businessId);
  if (error) throw error;
  return token;
};

export const fetchShifts = async function (startISO, endISO) {
  const { data, error } = await supabase
    .from('shifts')
    .select('id, clocked_in_at, clocked_out_at, note, staff_id, shift_breaks(id, started_at, ended_at), staff(first_name, last_name, hourly_rate)')
    .eq('business_id', state.businessId)
    .gte('clocked_in_at', startISO)
    .lte('clocked_in_at', endISO)
    .order('clocked_in_at', { ascending: true });
  if (error) throw error;
  state.shifts = data.map(r => ({
    id:           r.id,
    staffId:      r.staff_id,
    staffName:    `${r.staff?.first_name ?? ''} ${r.staff?.last_name ?? ''}`.trim(),
    hourlyRate:   r.staff?.hourly_rate ?? null,
    clockedInAt:  r.clocked_in_at,
    clockedOutAt: r.clocked_out_at ?? null,
    note:         r.note ?? '',
    breaks:       (r.shift_breaks ?? []).map(b => ({
      id:        b.id,
      startedAt: b.started_at,
      endedAt:   b.ended_at ?? null,
    })),
  }));
};

export const addShift = async function ({ staffId, clockedInAt, clockedOutAt, note }) {
  const { data, error } = await supabase
    .from('shifts')
    .insert({ business_id: state.businessId, staff_id: staffId, clocked_in_at: clockedInAt, clocked_out_at: clockedOutAt || null, note: note || null })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const updateShift = async function ({ id, clockedInAt, clockedOutAt, note }) {
  const { error } = await supabase
    .from('shifts')
    .update({ clocked_in_at: clockedInAt, clocked_out_at: clockedOutAt || null, note: note || null })
    .eq('id', id)
    .eq('business_id', state.businessId);
  if (error) throw error;
};

export const updateStaffHourlyRate = async function (staffId, rate) {
  const { error } = await supabase
    .from('staff')
    .update({ hourly_rate: rate ?? null })
    .eq('id', staffId)
    .eq('business_id', state.businessId);
  if (error) throw error;
  const s = state.staff.find(s => s.id === staffId);
  if (s) s.hourlyRate = rate ?? null;
};

export const submitTicket = async function ({ category, subject, message, files }) {
  const attachments = [];
  for (const file of files) {
    const ext = file.name.split('.').pop();
    const path = `${state.businessId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(path, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('ticket-attachments').getPublicUrl(path);
    attachments.push(data.publicUrl);
  }

  const { error } = await supabase.from('tickets').insert({
    business_id: state.businessId,
    category,
    subject,
    message,
    attachments,
  });
  if (error) throw error;
};

export const submitTicketReply = async function (ticketId, message) {
  const { error } = await supabase.from('ticket_replies').insert({
    ticket_id: ticketId,
    sender_type: 'business',
    message,
  });
  if (error) throw error;
  const { error: flagError } = await supabase
    .from('tickets')
    .update({ has_business_reply: true })
    .eq('id', ticketId)
    .eq('business_id', state.businessId);
  if (flagError) throw flagError;
};

export const submitTicketRating = async function (ticketId, rating, comment) {
  const { error } = await supabase
    .from('tickets')
    .update({ rating, rating_comment: comment || null, rated_at: new Date().toISOString() })
    .eq('id', ticketId)
    .eq('business_id', state.businessId);
  if (error) throw error;
  const t = state.tickets.find(t => t.id === ticketId);
  if (t) { t.rating = rating; t.rating_comment = comment || null; }
};

export const sendPasswordResetEmail = async function (email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
};

export const updatePassword = async function (newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const sendSettingsVerification = async function () {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
  return user.email;
};

export const confirmSettingsVerification = async function (email, token) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
};

export const saveProfileInfo = async function ({ firstName, lastName }) {
  const { error } = await supabase
    .from('staff')
    .update({ first_name: firstName, last_name: lastName })
    .eq('id', state.currentStaff.id);
  if (error) throw error;
  state.currentStaff.firstName = firstName;
  state.currentStaff.lastName  = lastName;
  if (state.currentCashier?.id === state.currentStaff.id) {
    state.currentCashier.firstName = firstName;
    state.currentCashier.lastName  = lastName;
  }
  state.username = `${firstName} ${lastName}`.trim() || state.username;
};
