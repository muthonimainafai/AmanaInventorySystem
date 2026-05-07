const state = {
  appInstance: (() => {
    const saved = (localStorage.getItem("amanaAppInstance") || "amana").trim().toLowerCase();
    return ["amana", "ufaray", "rose", "nahah", "terry", "cess", "shop"].includes(saved) ? saved : "amana";
  })(),
  token: (localStorage.getItem("amanaToken") || "").trim(),
  user: JSON.parse(localStorage.getItem("amanaUser") || "null"),
  vehicleToken: (localStorage.getItem("vehicleToken") || "").trim(),
  vehicleUser: JSON.parse(localStorage.getItem("vehicleUser") || "null"),
  vehicleKaxEntries: [],
  editVehicleKaxId: null,
  catalog: {},
  records: [],
  editId: null,
  salesBags: [],
  salesKg: [],
  /** Owner: chicks-in-shop inventory rows only. Employee: staff chick sales only. */
  chickenSales: [],
  /** Full rows for owner; employees get { breed, selling_price } only. */
  chickenBreeds: [],
  /** Owner: cumulative + today’s chick margin (from API). */
  chickenProfitSummary: { todayProfit: 0, cumulativeProfit: 0, today: "" },
  /** Owner: Retail Feed “Sales activity (by day)” — remaining kg, accumulated employee kg (sum of staff running totals), bags from kg. */
  retailFeedSummary: [],
  /** Owner: retail price/margin/weight; employees: price per kg + optional weight_kg (for Sales Per Kg). */
  retailFeedPricing: [],
  /** Sum of retail_feed_pricing.accumulated_profit (all-time, not shop-day). */
  cumulativeRetailKgProfit: 0,
  editRetailFeedId: null,
  editSalesBagId: null,
  editSalesKgId: null,
  editChickenId: null,
  currentPage: "inventory",
  /** Cumulative feed profit for the shop calendar day (from API). */
  cumulativeFeedBagProfit: 0,
  /** DD/MM/YYYY shop “today” (Africa/Nairobi on server; client mirrors for display). */
  shopToday: "",
  /** From GET /api/inventory/selling-prices (employees): lines ordered by id DESC, same as server stock lookup. */
  inventoryPricing: [],
  /** Owner: selected chick sale row id for the staff customer details panel. */
  ownerSelectedChickenRowId: null,
  feedersDrinkersCatalog: [],
  feedersDrinkersInventory: [],
  feedersDrinkersEmployeeItems: [],
  feedersDrinkersSales: [],
  medicamentsCatalog: [],
  medicamentsInventory: [],
  medicamentsEmployeeItems: [],
  medicamentsSales: [],
  gasInventory: [],
  gasEmployeeItems: [],
  gasSales: [],
  editFeedersDrinkersId: null,
  editMedicamentId: null,
  editGasId: null,
  expenditureEntries: [],
  editExpenditureId: null,
  roseEntries: [],
  editRoseId: null,
  calculatorValues: {},
};

const PAGE_HEADINGS = {
  inventory: "Feed Inventory",
  "retail-inventory": "Retail Feed Inventory",
  "chicken-inventory": "Chicken Sales Inventory",
  "sales-bags": "Sales Per Bags",
  "sales-kg": "Sales Per Kg",
  "feeders-drinkers": "Feeders and Drinkers inventory",
  medicaments: "Medicaments inventory",
  gas: "Gas Inventory",
  "rose-inventory": "Rose Inventory",
  calculator: "Calculator",
  expenditure: "Expenditure",
  balance: "Balance",
};

function isRecordsTenant() {
  return state.appInstance === "rose";
}

function isTerryCessOrShopTenant() {
  return state.appInstance === "terry" || state.appInstance === "cess" || state.appInstance === "shop";
}

function isTerryOrCessTenant() {
  return state.appInstance === "terry" || state.appInstance === "cess";
}

/** Feed & retail inventory setup tabs — employees never see these. Chicken sales uses a shared page (`chicken-inventory`). */
const OWNER_INVENTORY_PAGES = new Set(["inventory", "retail-inventory", "calculator", "balance"]);
const OWNER_ALLOWED_PAGES = new Set([
  "inventory",
  "retail-inventory",
  "chicken-inventory",
  "feeders-drinkers",
  "medicaments",
  "gas",
  "calculator",
  "expenditure",
  "balance",
]);
/** Owner pages that show the combined accumulated profit footer at the bottom. */
const OWNER_PAGES_WITH_COMBINED_PROFIT = new Set(["inventory", "retail-inventory", "chicken-inventory"]);

const DAILY_OPERATIONAL_COST = 540;
const BUSINESS_OPENED_DMY = "04/05/2026";

/** Must match `public/chickenBreeds.json` / server list — used when the API returns no breeds yet. */
const DEFAULT_CHICKEN_BREED_NAMES = [
  "Irvines",
  "Supreme",
  "Isinya",
  "Silverland",
  "Kenchick",
  "Jumbo",
  "Suguna",
];

function chickenBreedsRowsFromNames(names) {
  return names.map((breed) => ({
    breed,
    buying_price: 0,
    selling_price: 0,
    profit_margin_per_chick: 0,
    accumulated_profit: 0,
  }));
}

/** Rows for the breed dropdown: API data, else static fallback so the list is never empty. */
function getChickenBreedsRows() {
  if (Array.isArray(state.chickenBreeds) && state.chickenBreeds.length > 0) return state.chickenBreeds;
  return chickenBreedsRowsFromNames(DEFAULT_CHICKEN_BREED_NAMES);
}

const loginCard = document.getElementById("loginCard");
const landingCard = document.getElementById("landingCard");
const nahahDashboardCard = document.getElementById("nahahDashboardCard");
const appCard = document.getElementById("appCard");
const vehicleLoginCard = document.getElementById("vehicleLoginCard");
const vehicleAppCard = document.getElementById("vehicleAppCard");
const loginForm = document.getElementById("loginForm");
const vehicleLoginForm = document.getElementById("vehicleLoginForm");
const passwordInput = document.getElementById("password");
const showPasswordCheckbox = document.getElementById("showPassword");
const vehiclePasswordInput = document.getElementById("vehiclePassword");
const showVehiclePasswordCheckbox = document.getElementById("showVehiclePassword");
const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");
const vehicleUserInfo = document.getElementById("vehicleUserInfo");
const vehicleLogoutBtn = document.getElementById("vehicleLogoutBtn");
const vehicleKaxForm = document.getElementById("vehicle-kax-form");
const vehicleKaxBody = document.getElementById("vehicle-kax-body");
const vehicleKaxDateDisplay = document.getElementById("vehicleKaxDateDisplay");
const vehicleKaxDate = document.getElementById("vehicleKaxDate");
const vehicleKaxOpenCalendarBtn = document.getElementById("vehicleKaxOpenCalendarBtn");
const vehicleKaxClearBtn = document.getElementById("vehicleKaxClearBtn");
const refreshBtn = document.getElementById("refreshBtn");

const form = document.getElementById("inventory-form");
const brandSelect = document.getElementById("brand");
const feedTypeSelect = document.getElementById("feedType");
const bagSizeInput = document.getElementById("bagSize");
const quantityInput = document.getElementById("quantityInStock");
const clearBtn = document.getElementById("clearBtn");
const tableBody = document.getElementById("inventory-body");
const dateInput = document.getElementById("date");
const dateDisplayInput = document.getElementById("dateDisplay");
const openCalendarBtn = document.getElementById("openCalendarBtn");
const pageHeading = document.getElementById("pageHeading");

const sbBrand = document.getElementById("sbBrand");
const sbFeedType = document.getElementById("sbFeedType");
const sbBagSize = document.getElementById("sbBagSize");
const salesBagsForm = document.getElementById("sales-bags-form");
const salesBagsBody = document.getElementById("sales-bags-body");
const sbDateDisplay = document.getElementById("sbDateDisplay");
const sbDate = document.getElementById("sbDate");
const sbOpenCalendarBtn = document.getElementById("sbOpenCalendarBtn");

const skBrand = document.getElementById("skBrand");
const skFeedType = document.getElementById("skFeedType");
const salesKgForm = document.getElementById("sales-kg-form");
const salesKgBody = document.getElementById("sales-kg-body");
const skDateDisplay = document.getElementById("skDateDisplay");
const skDate = document.getElementById("skDate");
const skOpenCalendarBtn = document.getElementById("skOpenCalendarBtn");
const skSaleType = document.getElementById("skSaleType");
const retailInventoryBody = document.getElementById("retail-inventory-body");
const retailPricingBody = document.getElementById("retail-pricing-body");
const retailFeedForm = document.getElementById("retail-feed-form");
const rfBrand = document.getElementById("rfBrand");
const rfFeedType = document.getElementById("rfFeedType");

const chickenForm = document.getElementById("chicken-form");
const chickenInventoryBody = document.getElementById("chicken-inventory-body");
const chDateDisplay = document.getElementById("chDateDisplay");
const chDate = document.getElementById("chDate");
const chOpenCalendarBtn = document.getElementById("chOpenCalendarBtn");
const chSaleType = document.getElementById("chSaleType");
const fdForm = document.getElementById("fd-form");
const fdBody = document.getElementById("fd-body");
const fdItem = document.getElementById("fdItem");
const fdDateDisplay = document.getElementById("fdDateDisplay");
const fdDate = document.getElementById("fdDate");
const fdOpenCalendarBtn = document.getElementById("fdOpenCalendarBtn");
const fdSaleType = document.getElementById("fdSaleType");
const medForm = document.getElementById("med-form");
const medBody = document.getElementById("med-body");
const medItem = document.getElementById("medItem");
const medDateDisplay = document.getElementById("medDateDisplay");
const medDate = document.getElementById("medDate");
const medOpenCalendarBtn = document.getElementById("medOpenCalendarBtn");
const medSaleType = document.getElementById("medSaleType");
const gasForm = document.getElementById("gas-form");
const gasBody = document.getElementById("gas-body");
const gasSizeKg = document.getElementById("gasSizeKg");
const gasSize = document.getElementById("gasSize");
const gasDateDisplay = document.getElementById("gasDateDisplay");
const gasDate = document.getElementById("gasDate");
const gasOpenCalendarBtn = document.getElementById("gasOpenCalendarBtn");
const gasSaleType = document.getElementById("gasSaleType");
const expenditureForm = document.getElementById("expenditure-form");
const expBody = document.getElementById("exp-body");
const expDateDisplay = document.getElementById("expDateDisplay");
const expDate = document.getElementById("expDate");
const expOpenCalendarBtn = document.getElementById("expOpenCalendarBtn");
const roseForm = document.getElementById("rose-form");
const roseBody = document.getElementById("rose-body");
const roseDateDisplay = document.getElementById("roseDateDisplay");
const roseDate = document.getElementById("roseDate");
const roseOpenCalendarBtn = document.getElementById("roseOpenCalendarBtn");
const calcBody = document.getElementById("calc-body");

let refreshTimer = null;
let catalogInitialized = false;

function persistAppInstance() {
  const normalized = ["amana", "ufaray", "rose", "nahah", "terry", "cess", "shop"].includes(state.appInstance)
    ? state.appInstance
    : "amana";
  localStorage.setItem("amanaAppInstance", normalized);
}

function applyAppTheme() {
  const tenant = ["amana", "ufaray", "rose", "nahah", "terry", "cess", "shop"].includes(state.appInstance)
    ? state.appInstance
    : "amana";
  const isUfaray = tenant === "ufaray";
  const isRose = tenant === "rose";
  const isNahah = tenant === "nahah" || tenant === "terry" || tenant === "cess" || tenant === "shop";
  document.body.classList.toggle("ufaray-theme", isUfaray);
  document.body.classList.toggle("rose-theme", isRose);
  document.body.classList.toggle("nahah-theme", isNahah);
  document.title = isUfaray
    ? "Ufaray Feeds - Desktop Inventory"
    : isRose
      ? "Rose Inventory - Desktop Inventory"
      : isNahah
        ? "Nahah Feeds Inventory System - Desktop Inventory"
      : "Amana Kuku Feeds - Desktop Inventory";
  const portalSiteTitle = document.getElementById("portalSiteTitle");
  if (portalSiteTitle) {
    portalSiteTitle.textContent = isUfaray
      ? "UFARAY FEEDS"
      : isRose
        ? "ROSE INVENTORY"
        : isNahah
          ? "NAHAH FEEDS INVENTORY SYSTEM"
          : "AMANA KUKU FEEDS";
  }
  const loginTitle = document.getElementById("loginCardTitle");
  if (loginTitle) {
    loginTitle.textContent = tenant === "terry"
      ? "Terry Inventory Login"
      : tenant === "cess"
        ? "Cess Inventory Login"
        : tenant === "shop"
          ? "Shop Inventory Login"
        : isUfaray
      ? "Ufaray Feeds Login"
      : isRose
        ? "Rose Inventory Login"
        : "Amana Kuku Feeds Login";
  }
  const roseTab = document.getElementById("roseInventoryTabLabel");
  if (roseTab) {
    roseTab.textContent =
      state.appInstance === "rose" ? "Rose Inventory" : state.appInstance === "terry" || state.appInstance === "cess" ? "Records" : "Rose Inventory";
  }
  const rosePageTitle = document.getElementById("roseInventoryPageTitle");
  if (rosePageTitle) {
    rosePageTitle.textContent =
      state.appInstance === "rose" ? "Rose Inventory" : state.appInstance === "terry" || state.appInstance === "cess" ? "Records" : "Rose Inventory";
  }
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-App-Instance": ["amana", "ufaray", "rose", "terry", "cess", "shop"].includes(state.appInstance)
      ? state.appInstance
      : "amana",
    ...(options.headers || {}),
  };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(text.trim().slice(0, 200) || `Request failed (${response.status})`);
      }
      throw new Error("Server returned a non-JSON response.");
    }
  }
  if (!response.ok) {
    const isLogin = path === "/api/login";
    if (response.status === 401 && !isLogin) {
      const msg = body.error || "";
      if (msg === "Invalid token" || msg === "Unauthorized") {
        clearAuth();
        stopAutoRefresh();
        showLoggedOut();
        throw new Error("Session expired. Please sign in again.");
      }
    }
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

async function vehicleApi(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.vehicleToken) headers.Authorization = `Bearer ${state.vehicleToken}`;
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!response.ok) throw new Error(text.trim().slice(0, 200) || `Request failed (${response.status})`);
      throw new Error("Server returned a non-JSON response.");
    }
  }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function persistAuth() {
  localStorage.setItem("amanaToken", state.token);
  localStorage.setItem("amanaUser", JSON.stringify(state.user));
}

function persistVehicleAuth() {
  localStorage.setItem("vehicleToken", state.vehicleToken);
  localStorage.setItem("vehicleUser", JSON.stringify(state.vehicleUser));
}

function clearAuth() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("amanaToken");
  localStorage.removeItem("amanaUser");
}

function clearVehicleAuth() {
  state.vehicleToken = "";
  state.vehicleUser = null;
  localStorage.removeItem("vehicleToken");
  localStorage.removeItem("vehicleUser");
}

function currency(value) {
  return Number(value || 0).toLocaleString("en-KE", {
    style: "currency",
    currency: "KES",
  });
}

/** Match server default AMANA_TZ for date fields before the first API response. */
function clientShopTodayDMY() {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  }
}

function updateTodayProfitDisplay() {
  const val = currency(state.cumulativeFeedBagProfit);
  document.querySelectorAll(".js-today-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. Total is cumulative profit from all Sales Per Bags (all dates), using each line’s current margin × total bags sold. Resets only if bag sales are deleted.`
    : "";
  document.querySelectorAll(".js-today-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateRetailCumulativeProfitDisplay() {
  const val = currency(state.cumulativeRetailKgProfit);
  document.querySelectorAll(".js-retail-today-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. This total is not reset daily: it is the sum of every line’s accumulated retail kg profit (all past sales plus new sales).`
    : "";
  document.querySelectorAll(".js-retail-today-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateChickenProfitDisplay() {
  const cum = currency(Number(state.chickenProfitSummary?.cumulativeProfit ?? 0));
  const today = currency(Number(state.chickenProfitSummary?.todayProfit ?? 0));
  document.querySelectorAll(".js-chicken-cumulative-profit").forEach((el) => {
    el.textContent = cum;
  });
  document.querySelectorAll(".js-chicken-today-profit").forEach((el) => {
    el.textContent = today;
  });
  const shop = state.chickenProfitSummary?.today || state.shopToday || "";
  const meta = shop
    ? `Shop day ${shop}. Cumulative and today count delivered staff chick sales only (Pending shows KES 0 in the table until delivered). Your inventory lines do not add to these totals.`
    : "";
  document.querySelectorAll(".js-chicken-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateFeedersDrinkersProfitDisplay() {
  const total = (state.feedersDrinkersInventory || []).reduce((s, r) => s + (Number(r.accumulated_profit) || 0), 0);
  const val = currency(total);
  document.querySelectorAll(".js-fd-accumulated-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. This is cumulative profit from employee sales only (sum of item accumulated profits).`
    : "Cumulative profit from employee sales only (sum of item accumulated profits).";
  document.querySelectorAll(".js-fd-accumulated-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateMedicamentsProfitDisplay() {
  const total = (state.medicamentsInventory || []).reduce((s, r) => s + (Number(r.accumulated_profit) || 0), 0);
  const val = currency(total);
  document.querySelectorAll(".js-med-accumulated-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. This is cumulative profit from employee sales only (sum of item accumulated profits).`
    : "Cumulative profit from employee sales only (sum of item accumulated profits).";
  document.querySelectorAll(".js-med-accumulated-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateExpenditureAccumulatedDisplay() {
  if (state.user?.role !== "employee") return;
  const rows = state.expenditureEntries || [];
  const sumTotal = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const sumMoneyOut = rows.reduce((s, r) => s + (Number(r.money_out) || 0), 0);
  const val = currency(sumTotal);
  document.querySelectorAll(".js-exp-expenditure-total-value").forEach((el) => {
    el.textContent = val;
  });
  const meta =
    rows.length === 0
      ? "No records yet."
      : `${rows.length} record${rows.length === 1 ? "" : "s"} · Sum of Total: ${currency(sumTotal)} · Sum of Money out: ${currency(sumMoneyOut)}`;
  document.querySelectorAll(".js-exp-expenditure-total-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function calculatorRowsFromCatalog() {
  const rows = [];
  const brands = Object.keys(state.catalog || {}).sort((a, b) => a.localeCompare(b));
  for (const brand of brands) {
    const items = Array.isArray(state.catalog[brand]) ? state.catalog[brand] : [];
    for (const item of items) {
      const feedType = String(item?.type || "").trim();
      const bagSize = Number(item?.bagSize || 0);
      if (!feedType || !Number.isFinite(bagSize) || bagSize <= 0) continue;
      rows.push({ brand, feedType, bagSize });
    }
  }
  return rows;
}

/** Latest owner buying price from Feed Inventory for this exact line (records are id DESC). */
function findInventoryBuyingPriceForCalculator(brand, feedType, bagSize) {
  const bs = Number(bagSize);
  if (!Number.isFinite(bs) || bs <= 0) return null;
  const bKey = normalizeBrandName(brand);
  const fKey = normalizeFeedTypeForMatch(feedType);
  for (const row of state.records || []) {
    if (Number(row.bag_size) !== bs) continue;
    if (normalizeBrandName(row.brand) !== bKey) continue;
    if (normalizeFeedTypeForMatch(row.feed_type) !== fKey) continue;
    const bp = Number(row.buying_price);
    return Number.isFinite(bp) ? bp : null;
  }
  return null;
}

function calculatorRowKey(brand, feedType, bagSize) {
  return `${resolveBrandKey(brand)}|${String(feedType || "").trim()}|${Number(bagSize) || 0}`;
}

function calculatorRememberRowFromInputs(tr) {
  if (!(tr instanceof HTMLTableRowElement)) return;
  const brand = tr.dataset.calcBrand || "";
  const feedType = tr.dataset.calcFeedType || "";
  const bagSize = Number(tr.dataset.calcBagSize || 0);
  if (!brand || !feedType || !Number.isFinite(bagSize) || bagSize <= 0) return;
  const bagsEl = tr.querySelector("input[data-kind='calc-bags']");
  const buyEl = tr.querySelector("input[data-kind='calc-buying']");
  if (!(bagsEl instanceof HTMLInputElement) || !(buyEl instanceof HTMLInputElement)) return;
  const key = calculatorRowKey(brand, feedType, bagSize);
  const bagsRaw = bagsEl.value;
  const buyingRaw = buyEl.value;
  if (!bagsRaw.trim() && !buyingRaw.trim()) {
    delete state.calculatorValues[key];
    return;
  }
  state.calculatorValues[key] = {
    bags: bagsRaw,
    buying: buyingRaw,
  };
}

function updateCalculatorGrandTotalDisplay() {
  if (!calcBody) return;
  let grand = 0;
  let linesWithValues = 0;
  calcBody.querySelectorAll("tr").forEach((tr) => {
    const bagsEl = tr.querySelector("input[data-kind='calc-bags']");
    const buyEl = tr.querySelector("input[data-kind='calc-buying']");
    const totalCell = tr.querySelector(".js-calc-row-total");
    if (!(bagsEl instanceof HTMLInputElement) || !(buyEl instanceof HTMLInputElement) || !(totalCell instanceof HTMLElement)) return;
    const bags = Number(String(bagsEl.value || "").trim());
    const buying = Number(String(buyEl.value || "").trim());
    const rowTotal = Math.max(0, Number.isFinite(bags) ? bags : 0) * Math.max(0, Number.isFinite(buying) ? buying : 0);
    totalCell.textContent = currency(rowTotal);
    if (rowTotal > 0) linesWithValues += 1;
    grand += rowTotal;
  });
  document.querySelectorAll(".js-calc-grand-total-value").forEach((el) => {
    el.textContent = currency(grand);
  });
  const meta = linesWithValues
    ? `${linesWithValues} line${linesWithValues === 1 ? "" : "s"} with values. Grand total purchase cost: ${currency(grand)}.`
    : "Enter number of bags and buying price to calculate purchase cost.";
  document.querySelectorAll(".js-calc-grand-total-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateGasProfitDisplay() {
  const total = (state.gasInventory || []).reduce((s, r) => s + (Number(r.accumulated_profit) || 0), 0);
  const val = currency(total);
  document.querySelectorAll(".js-gas-accumulated-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. This is cumulative profit from employee sales only (sum of size accumulated profits).`
    : "Cumulative profit from employee sales only (sum of size accumulated profits).";
  document.querySelectorAll(".js-gas-accumulated-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateOwnerCombinedProfitDockVisibility() {
  const dock = document.getElementById("ownerCombinedProfitDock");
  if (!dock) return;
  const show =
    state.user?.role === "owner" && OWNER_PAGES_WITH_COMBINED_PROFIT.has(state.currentPage);
  dock.classList.toggle("hidden", !show);
}

/** Owner: Feed bag cumulative + retail kg cumulative + staff chicken margin cumulative. */
function updateOwnerCombinedProfitDisplay() {
  if (state.user?.role !== "owner") return;
  const sum = getOwnerCombinedProfitTotal();
  document.querySelectorAll(".js-owner-combined-profit-total").forEach((el) => {
    el.textContent = currency(sum);
  });
}

function getOwnerCombinedProfitTotal() {
  const feed = Number(state.cumulativeFeedBagProfit) || 0;
  const retail = Number(state.cumulativeRetailKgProfit) || 0;
  const chicken = Number(state.chickenProfitSummary?.cumulativeProfit) || 0;
  return feed + retail + chicken;
}

function inclusiveBusinessDaysFromOpen(openedDmy, todayDmy) {
  const from = parseDMYParts(openedDmy);
  const to = parseDMYParts(todayDmy);
  if (!from || !to) return 0;
  const utcFrom = Date.UTC(from.y, from.m - 1, from.d);
  const utcTo = Date.UTC(to.y, to.m - 1, to.d);
  const diff = Math.floor((utcTo - utcFrom) / 86400000);
  return diff >= 0 ? diff + 1 : 0;
}

function updateBalanceBanner() {
  if (state.user?.role !== "owner") return;
  const combined = getOwnerCombinedProfitTotal();
  const today = state.shopToday || clientShopTodayDMY();
  const days = inclusiveBusinessDaysFromOpen(BUSINESS_OPENED_DMY, today);
  const operational = days * DAILY_OPERATIONAL_COST;
  const expRows = state.expenditureEntries || [];
  const totalExpenditure = expRows.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const remaining = combined - operational - totalExpenditure;
  document.querySelectorAll(".js-balance-remaining-value").forEach((el) => {
    const formatted = currency(Math.abs(remaining));
    const isNegative = remaining < 0;
    el.textContent = isNegative ? `- ${formatted}` : formatted;
  });
  const meta = `${currency(combined)} - (${currency(
    DAILY_OPERATIONAL_COST
  )} × ${days} day${days === 1 ? "" : "s"}) - ${currency(totalExpenditure)} (expenditure) = ${currency(
    remaining
  )} · Opened ${BUSINESS_OPENED_DMY}`;
  document.querySelectorAll(".js-balance-remaining-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function applyEmployeeSalesDateRules() {
  const isEmployee = state.user && state.user.role === "employee";
  const todayStr = state.shopToday || clientShopTodayDMY();
  const minIso = isValidDMY(todayStr) ? toIsoDate(todayStr) : "";
  const triples = [
    ["sbDateDisplay", "sbDate", "sbOpenCalendarBtn"],
    ["skDateDisplay", "skDate", "skOpenCalendarBtn"],
    ["chDateDisplay", "chDate", "chOpenCalendarBtn"],
    ["expDateDisplay", "expDate", "expOpenCalendarBtn"],
    ["roseDateDisplay", "roseDate", "roseOpenCalendarBtn"],
  ];
  for (const [dispId, nativeId, btnId] of triples) {
    const disp = document.getElementById(dispId);
    const native = document.getElementById(nativeId);
    const btn = document.getElementById(btnId);
    if (!disp || !native || !btn) continue;
    const wrap = disp.closest(".date-field");
    if (isEmployee) {
      if (minIso) native.min = minIso;
      else native.removeAttribute("min");
      if (!disp.value.trim()) {
        disp.value = todayStr;
        if (isValidDMY(todayStr)) native.value = toIsoDate(todayStr);
      }
      disp.readOnly = false;
      btn.removeAttribute("disabled");
      wrap?.classList.remove("employee-date-locked");
    } else {
      native.removeAttribute("min");
      disp.readOnly = false;
      btn.removeAttribute("disabled");
      wrap?.classList.remove("employee-date-locked");
    }
  }
}

function displayBrand(brand) {
  return String(brand || "").replace(/\s+feeds$/i, "").trim();
}

function displayFeedType(feedType) {
  return String(feedType || "").replace(/\s+bags?$/i, "").trim();
}

function normalizeBrandName(brand) {
  return String(brand || "").toLowerCase().replace(/\s+feeds$/i, "").trim();
}

function resolveBrandKey(brand) {
  const target = normalizeBrandName(brand);
  return Object.keys(state.catalog).find((b) => normalizeBrandName(b) === target) || brand;
}

/** Matches server normalizeFeedType for catalog / validation alignment. */
function normalizeFeedTypeForMatch(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+bags?$/i, "")
    .trim();
}

function feedTypeCatalogValue(brandKey, feedType) {
  const items = state.catalog[brandKey] || [];
  const target = normalizeFeedTypeForMatch(feedType);
  const found = items.find((i) => normalizeFeedTypeForMatch(i.type) === target);
  return found ? found.type : feedType;
}

/** Maize Germ (Wishwa), Broken Wheat, Wheat Bran/Pollard — owner can set retail weight (kg) per opened bag. */
function isOwnerWeightRetailLine(brandKey, feedType) {
  const b = resolveBrandKey(brandKey);
  const f = normalizeFeedTypeForMatch(feedType);
  const pairs = [
    ["Maize", "Germ (Wishwa)"],
    ["Broken", "Wheat"],
    ["Wheat", "Bran"],
    ["Wheat", "Pollard"],
  ];
  return pairs.some(([bb, ff]) => resolveBrandKey(bb) === b && normalizeFeedTypeForMatch(ff) === f);
}

function updateRfWeightFieldVisibility() {
  const wrap = document.getElementById("rfWeightKgWrap");
  if (!wrap) return;
  const show = isOwnerWeightRetailLine(rfBrand?.value, rfFeedType?.value);
  wrap.classList.toggle("hidden", !show);
}

function formatDateDMY(dateValue) {
  if (!dateValue) return "";
  const s = String(dateValue).trim();
  if (s.includes("/")) {
    const parts = s.split("/").map((p) => p.trim());
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (d && m && y) return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    }
    return s;
  }
  const [year, month, day] = s.split("-");
  if (!year || !month || !day) return s;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function toIsoDate(dateValue) {
  if (!dateValue) return "";
  if (String(dateValue).includes("-")) return dateValue;
  const parts = String(dateValue).split("/").map((p) => p.trim());
  if (parts.length !== 3) return "";
  const [day, month, year] = parts;
  if (!day || !month || !year) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidDMY(dateValue) {
  return /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(String(dateValue || "").trim());
}

function parseDMYParts(dateValue) {
  const formatted = formatDateDMY(dateValue);
  const s = String(formatted || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return { d: Number(m[1]), m: Number(m[2]), y: Number(m[3]) };
}

function compareDMYParts(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

function tableDateSeparatorRow(colSpan) {
  return `<tr class="table-date-separator" aria-hidden="true"><td colspan="${colSpan}"></td></tr>`;
}

/** Inserts an orange separator row when `date` changes between consecutive rows (same order as API). */
function joinRowsWithDateSeparators(rows, colSpan, buildRowHtml) {
  if (!rows.length) return "";
  const parts = [];
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) {
      const cur = formatDateDMY(rows[i].date).trim();
      const prev = formatDateDMY(rows[i - 1].date).trim();
      if (cur !== prev) parts.push(tableDateSeparatorRow(colSpan));
    }
    parts.push(buildRowHtml(rows[i], i));
  }
  return parts.join("");
}

/** Sale row date is on or after the shop calendar day (both interpreted as DD/MM/YYYY). */
function saleDateOnOrAfterShopDay(rowDate, shopDayDMY) {
  const row = parseDMYParts(rowDate);
  const shop = parseDMYParts(shopDayDMY);
  if (!row || !shop) return false;
  return compareDMYParts(row, shop) >= 0;
}

function saleLineTotalBags(row) {
  const t = Number(row.total_amount);
  if (Number.isFinite(t)) return t;
  return Number(row.bags_sold || 0) * Number(row.price_per_bag || 0);
}

function normalizeSaleVia(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower === "shop") return "Shop";
  if (lower === "terry") return "Terry";
  if (lower === "cess") return "Cess";
  if (lower === "rose") return "Rose";
  if (lower === "ufaray") return "Ufaray";
  return raw;
}

function isNonProfitSaleVia(value) {
  const normalized = normalizeSaleVia(value);
  return normalized !== "" && normalized !== "Shop";
}

function bagSaleViaOptions() {
  if (state.appInstance === "shop") {
    return ["Shop", "Terry", "Cess", "Rose"];
  }
  return ["", "Ufaray"];
}

function labelForBagSaleVia(value) {
  const normalized = normalizeSaleVia(value);
  if (!normalized) return "Shop sale (normal)";
  return normalized === "Shop" ? "Shop" : `By ${normalized}`;
}

function fillBagSaleViaSelect(selectEl, selectedValue = "") {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const normalizedSelected = normalizeSaleVia(selectedValue);
  const options = bagSaleViaOptions();
  const frag = document.createDocumentFragment();
  for (const value of options) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = labelForBagSaleVia(value);
    frag.appendChild(opt);
  }
  if (normalizedSelected && !options.includes(normalizedSelected)) {
    const opt = document.createElement("option");
    opt.value = normalizedSelected;
    opt.textContent = labelForBagSaleVia(normalizedSelected);
    frag.appendChild(opt);
  }
  selectEl.innerHTML = "";
  selectEl.appendChild(frag);
  if (normalizedSelected && Array.from(selectEl.options).some((o) => o.value === normalizedSelected)) {
    selectEl.value = normalizedSelected;
  } else {
    selectEl.value = options[0] || "";
  }
}

function saleLineTotalKg(row) {
  const t = Number(row.total_amount);
  if (Number.isFinite(t)) return t;
  return Number(row.kg_sold || 0) * Number(row.price_per_kg || 0);
}

function saleLineTotalChicken(row) {
  const t = Number(row.total_amount);
  if (Number.isFinite(t)) return t;
  return Number(row.quantity_birds || 0) * Number(row.unit_price || 0);
}

function escapeHtmlCell(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function chickenSalePaymentStatusLabel(row) {
  const s = String(row.payment_status || "pending").toLowerCase();
  if (s === "delivered" || s === "cleared") return "Delivered";
  return "Pending";
}

function chickenSaleCustomerCellsHtml(row) {
  const name = row.customer_name ? escapeHtmlCell(row.customer_name) : "—";
  const phone = row.customer_phone ? escapeHtmlCell(row.customer_phone) : "—";
  const paid = currency(Number(row.money_paid) || 0);
  const total = saleLineTotalChicken(row);
  const bal = total - (Number(row.money_paid) || 0);
  const balStr = currency(bal);
  const isOwnerStaffRow = state.user?.role === "owner" && !isChickenRowOwnerInventory(row);
  const currentStatus =
    String(row.payment_status || "pending").toLowerCase() === "delivered" ? "delivered" : "pending";
  const st = isOwnerStaffRow
    ? `<div class="row-actions">
         <select data-kind="chicken-pay-status" data-id="${row.id}">
           <option value="pending" ${currentStatus === "pending" ? "selected" : ""}>Pending</option>
           <option value="delivered" ${currentStatus === "delivered" ? "selected" : ""}>Delivered</option>
         </select>
         <button type="button" data-kind="chicken-pay-save" data-id="${row.id}">Save</button>
       </div>`
    : escapeHtmlCell(chickenSalePaymentStatusLabel(row));
  return `<td>${name}</td><td>${phone}</td><td>${paid}</td><td>${balStr}</td><td>${st}</td>`;
}

function updateChickenCustomerAmounts() {
  if (state.user?.role !== "employee") return;
  const qty = Number(document.getElementById("chQuantity")?.value || 0);
  const unit = Number(document.getElementById("chUnitPrice")?.value || 0);
  const total = Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : NaN;
  const totalEl = document.getElementById("chCustomerTotal");
  const balEl = document.getElementById("chCustomerBalance");
  if (totalEl) totalEl.value = Number.isFinite(total) ? total.toFixed(2) : "";
  const paid = Number(document.getElementById("chMoneyPaid")?.value || 0);
  const balance = Number.isFinite(total) && Number.isFinite(paid) ? total - paid : NaN;
  if (balEl) balEl.value = Number.isFinite(balance) ? balance.toFixed(2) : "";
}

function onChickenPaymentStatusChange() {
  if (state.user?.role !== "employee") return;
  const sel = document.getElementById("chPaymentStatus");
  if (!sel || sel.value !== "delivered") return;
  const qty = Number(document.getElementById("chQuantity")?.value || 0);
  const unit = Number(document.getElementById("chUnitPrice")?.value || 0);
  const total = Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : NaN;
  const mp = document.getElementById("chMoneyPaid");
  if (mp && Number.isFinite(total) && total > 0) mp.value = String(Math.round(total * 100) / 100);
  updateChickenCustomerAmounts();
}

function clearOwnerCustomerViewPanel() {
  state.ownerSelectedChickenRowId = null;
  const ids = [
    "chOwnerViewCustomerName",
    "chOwnerViewCustomerPhone",
    "chOwnerViewCustomerTotal",
    "chOwnerViewMoneyPaid",
    "chOwnerViewBalance",
    "chOwnerViewStatus",
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.value = "";
  }
  const hint = document.getElementById("chickenOwnerCustomerHint");
  if (hint) {
    hint.innerHTML =
      'Staff-entered customer and payment info appears in the table columns and below. Click a <strong>staff sale</strong> row (see <strong>By</strong> column) to load details here.';
  }
}

function highlightChickenRowForOwner(id) {
  if (!chickenInventoryBody) return;
  chickenInventoryBody.querySelectorAll("tr[data-chicken-row-id]").forEach((tr) => {
    tr.classList.toggle("chicken-row-selected", id != null && String(tr.dataset.chickenRowId) === String(id));
  });
}

/** Owner: show staff-entered customer/payment fields (table + read-only panel). */
function fillOwnerCustomerViewPanel(row) {
  state.ownerSelectedChickenRowId = row.id;
  const name = document.getElementById("chOwnerViewCustomerName");
  const phone = document.getElementById("chOwnerViewCustomerPhone");
  const totalEl = document.getElementById("chOwnerViewCustomerTotal");
  const paidEl = document.getElementById("chOwnerViewMoneyPaid");
  const balEl = document.getElementById("chOwnerViewBalance");
  const stEl = document.getElementById("chOwnerViewStatus");
  const hint = document.getElementById("chickenOwnerCustomerHint");
  if (isChickenRowOwnerInventory(row)) {
    if (name) name.value = "";
    if (phone) phone.value = "";
    if (totalEl) totalEl.value = "";
    if (paidEl) paidEl.value = "";
    if (balEl) balEl.value = "";
    if (stEl) stEl.value = "";
    if (hint) {
      hint.textContent =
        "This row is your own inventory record — staff customer fields do not apply.";
    }
    return;
  }
  if (hint) hint.textContent = "Recorded by staff for this sale.";
  if (name) name.value = row.customer_name || "";
  if (phone) phone.value = row.customer_phone || "";
  const lineTotal = saleLineTotalChicken(row);
  if (totalEl) totalEl.value = Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : "";
  const mp = Number(row.money_paid) || 0;
  if (paidEl) paidEl.value = Number.isFinite(mp) ? mp.toFixed(2) : "";
  const balance = lineTotal - mp;
  if (balEl) balEl.value = Number.isFinite(balance) ? balance.toFixed(2) : "";
  if (stEl) stEl.value = chickenSalePaymentStatusLabel(row);
}

function chickenStaffPaymentIsCleared(row) {
  const s = String(row?.payment_status ?? "pending").trim().toLowerCase();
  return s === "delivered" || s === "cleared";
}

/** Profit for this row: margin × chicks for staff only when Payments is Delivered; owner inventory lines stay KES 0. */
function chickenSaleLineProfit(row) {
  const cr = String(row.creator_role || "").toLowerCase();
  if (cr === "owner") return 0;
  const q = Number(row.quantity_birds) || 0;
  if (row.margin_snap == null || row.margin_snap === "") return 0;
  const m = Number(row.margin_snap);
  if (!Number.isFinite(m)) return 0;
  if (!chickenStaffPaymentIsCleared(row)) return 0;
  return q * m;
}

function formatChickenSaleProfitCell(row) {
  return currency(chickenSaleLineProfit(row));
}

/** Rows you recorded as shop inventory (not staff chick sales). */
function isChickenRowOwnerInventory(row) {
  const cr = String(row?.creator_role || "").toLowerCase();
  const createdBy = String(row?.created_by || "");
  const ownerUsername = String(state.user?.username || "");
  return cr === "owner" || (cr !== "employee" && ownerUsername !== "" && createdBy === ownerUsername);
}

const EMPLOYEE_SALE_EDIT_MS = 60 * 60 * 1000;
/** Sales Per Bags (employee): edit/delete allowed within this window after the sale was recorded. */
const EMPLOYEE_BAG_SALE_EDIT_MS = 4 * 60 * 60 * 1000;
/** Sales Per Kg (employee): Delete only within this window after the sale was recorded. */
const EMPLOYEE_KG_SALE_DELETE_MS = 4 * 60 * 60 * 1000;

/** Sales Per Kg and similar: 1 hour after `created_at` / `updated_at`. */
function saleWithinEmployeeEditWindow(row) {
  const iso = row.created_at || row.updated_at;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= EMPLOYEE_SALE_EDIT_MS;
}

function saleWithinEmployeeBagEditWindow(row) {
  const iso = row.created_at || row.updated_at;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= EMPLOYEE_BAG_SALE_EDIT_MS;
}

function saleWithinEmployeeKgDeleteWindow(row) {
  const iso = row.created_at || row.updated_at;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= EMPLOYEE_KG_SALE_DELETE_MS;
}

/** Own kg sale row and within 4 hours of record time (matches server DELETE). */
function employeeKgSaleDeleteAllowed(row) {
  if (state.user?.role !== "employee") return false;
  if (String(row?.created_by || "") !== String(state.user?.username || "")) return false;
  return saleWithinEmployeeKgDeleteWindow(row);
}

/** Own bag sale row — staff may delete anytime (corrects mistakes; server reverses stock and margin). */
function employeeBagSaleDeleteAllowed(row) {
  if (state.user?.role !== "employee") return false;
  return String(row?.created_by || "") === String(state.user?.username || "");
}

/** Own row and within 4 hours of when it was recorded (matches server PUT). */
function employeeBagSaleEditAllowed(row) {
  if (!employeeBagSaleDeleteAllowed(row)) return false;
  return saleWithinEmployeeBagEditWindow(row);
}

function showLoggedOut() {
  applyAppTheme();
  landingCard?.classList.remove("hidden");
  nahahDashboardCard?.classList.add("hidden");
  loginCard.classList.add("hidden");
  vehicleLoginCard?.classList.add("hidden");
  appCard.classList.add("hidden");
  vehicleAppCard?.classList.add("hidden");
}

function showLoginCard() {
  applyAppTheme();
  landingCard?.classList.add("hidden");
  nahahDashboardCard?.classList.add("hidden");
  loginCard.classList.remove("hidden");
  vehicleLoginCard?.classList.add("hidden");
  appCard.classList.add("hidden");
  vehicleAppCard?.classList.add("hidden");
}

function showNahahDashboardCard() {
  applyAppTheme();
  landingCard?.classList.add("hidden");
  nahahDashboardCard?.classList.remove("hidden");
  loginCard.classList.add("hidden");
  vehicleLoginCard?.classList.add("hidden");
  appCard.classList.add("hidden");
  vehicleAppCard?.classList.add("hidden");
}

function showVehicleLoginCard() {
  landingCard?.classList.add("hidden");
  nahahDashboardCard?.classList.add("hidden");
  loginCard.classList.add("hidden");
  vehicleLoginCard?.classList.remove("hidden");
  appCard.classList.add("hidden");
  vehicleAppCard?.classList.add("hidden");
}

function showLoggedIn() {
  applyAppTheme();
  landingCard?.classList.add("hidden");
  nahahDashboardCard?.classList.add("hidden");
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  vehicleLoginCard?.classList.add("hidden");
  vehicleAppCard?.classList.add("hidden");
  userInfo.textContent = `${state.user.fullName} (${state.user.role})`;
  const isOwner = state.user.role === "owner";
  document.querySelectorAll(".owner-only-tab").forEach((el) => {
    el.classList.toggle("hidden", !isOwner);
  });
  document.querySelectorAll(".owner-only-highlight").forEach((el) => {
    el.classList.toggle("hidden", !isOwner);
  });
  document.querySelectorAll(".employee-only-action").forEach((el) => {
    el.classList.toggle("hidden", state.user.role !== "employee");
  });
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    const page = btn.dataset.page;
    const recordsTenant = isRecordsTenant();
    const terryCessShopTenant = isTerryCessOrShopTenant();
    const shouldShow = isTerryOrCessTenant()
      ? page === "rose-inventory"
      : state.appInstance === "shop"
      ? page === "inventory" || page === "sales-bags"
      : terryCessShopTenant
      ? page === "inventory"
      : recordsTenant
      ? page === "rose-inventory"
      : page === "rose-inventory"
        ? false
        : isOwner
          ? OWNER_ALLOWED_PAGES.has(page)
          : !OWNER_INVENTORY_PAGES.has(page);
    btn.classList.toggle("hidden", !shouldShow);
  });
  [fdForm, medForm, gasForm].forEach((frm) => {
    if (!frm) return;
    frm.querySelectorAll("input, select, button").forEach((el) => {
      if (el.classList?.contains("secondary")) return;
      if (el.id === "fdOpenCalendarBtn" || el.id === "medOpenCalendarBtn" || el.id === "gasOpenCalendarBtn") return;
      if (el.id === "fdDateDisplay" || el.id === "medDateDisplay" || el.id === "gasDateDisplay") return;
      if (!isOwner && el.closest(".actions")) return;
      if (!isOwner && frm === medForm && (el.tagName === "INPUT" || el.tagName === "SELECT")) el.disabled = true;
      if (!isOwner && frm === gasForm && (el.tagName === "INPUT" || el.tagName === "SELECT")) el.disabled = true;
      if (isOwner) el.disabled = false;
    });
  });
  if (fdForm && !isOwner) {
    fdForm.querySelectorAll("input, select").forEach((el) => {
      const editable =
        el.id === "fdDateDisplay" ||
        el.id === "fdItem" ||
        el.id === "fdQuantity" ||
        el.id === "fdSaleType" ||
        el.id === "fdEmployeeSellingPrice";
      el.disabled = !editable;
    });
    if (fdDate) fdDate.disabled = false;
  }
  if (medForm && !isOwner) {
    medForm.querySelectorAll("input, select").forEach((el) => {
      const editable =
        el.id === "medDateDisplay" ||
        el.id === "medItem" ||
        el.id === "medQuantity" ||
        el.id === "medSaleType" ||
        el.id === "medEmployeeSellingPrice";
      el.disabled = !editable;
    });
    if (medDate) medDate.disabled = false;
  }
  if (gasForm && !isOwner) {
    gasForm.querySelectorAll("input, select").forEach((el) => {
      const editable =
        el.id === "gasDateDisplay" ||
        el.id === "gasSize" ||
        el.id === "gasQuantity" ||
        el.id === "gasSaleType" ||
        el.id === "gasEmployeeSellingPrice";
      el.disabled = !editable;
    });
    if (gasDate) gasDate.disabled = false;
  }
  const fdSaveBtn = document.getElementById("fdSaveBtn");
  if (fdSaveBtn) fdSaveBtn.textContent = isOwner ? "Save record" : "Save sale";
  const medSaveBtn = document.getElementById("medSaveBtn");
  if (medSaveBtn) medSaveBtn.textContent = isOwner ? "Save record" : "Save sale";
  const gasSaveBtn = document.getElementById("gasSaveBtn");
  if (gasSaveBtn) gasSaveBtn.textContent = isOwner ? "Save record" : "Save sale";
  // Re-apply tenant-specific visibility after role-based show/hide rules.
  applyAppTheme();
}

function showVehicleLoggedIn() {
  landingCard?.classList.add("hidden");
  nahahDashboardCard?.classList.add("hidden");
  loginCard.classList.add("hidden");
  vehicleLoginCard?.classList.add("hidden");
  appCard.classList.add("hidden");
  vehicleAppCard?.classList.remove("hidden");
  if (vehicleUserInfo) vehicleUserInfo.textContent = `${state.vehicleUser.fullName} (${state.vehicleUser.role})`;
}

function renderVehicleKaxTable() {
  if (!vehicleKaxBody) return;
  if (!state.vehicleKaxEntries.length) {
    vehicleKaxBody.innerHTML = '<tr><td colspan="6" class="empty">No KAX entries.</td></tr>';
    return;
  }
  const chronological = [...state.vehicleKaxEntries]
    .sort((a, b) => Number(a.id) - Number(b.id));
  let running = 0;
  const byId = new Map();
  for (const row of chronological) {
    running += (Number(row.money_in) || 0) - (Number(row.money_out) || 0);
    byId.set(Number(row.id), running);
  }
  vehicleKaxBody.innerHTML = state.vehicleKaxEntries
    .map(
      (row) => `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${row.description}</td>
        <td>${currency(row.money_in)}</td>
        <td>${currency(row.money_out)}</td>
        <td>${currency(byId.get(Number(row.id)) || 0)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="vehicle-kax" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="vehicle-kax" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

async function loadVehicleKaxData() {
  if (!state.vehicleToken) return;
  state.vehicleKaxEntries = await vehicleApi("/api/vehicle/kax");
  renderVehicleKaxTable();
}

function populateBrandSelect(selectEl) {
  selectEl.innerHTML = '<option value="">Select brand</option>';
  Object.keys(state.catalog).forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = displayBrand(brand);
    selectEl.appendChild(option);
  });
}

function populateBrands() {
  populateBrandSelect(brandSelect);
}

function populateFeedTypes(brand) {
  const brandKey = resolveBrandKey(brand);
  feedTypeSelect.innerHTML = '<option value="">Select feed type</option>';
  bagSizeInput.value = "";
  if (!brandKey || !state.catalog[brandKey]) {
    feedTypeSelect.disabled = true;
    return;
  }

  state.catalog[brandKey].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.type;
    option.textContent = displayFeedType(item.type);
    feedTypeSelect.appendChild(option);
  });
  feedTypeSelect.disabled = false;
}

function populateSbFeedTypes(brand) {
  const brandKey = resolveBrandKey(brand);
  sbFeedType.innerHTML = '<option value="">Select feed type</option>';
  sbBagSize.value = "";
  if (!brandKey || !state.catalog[brandKey]) {
    sbFeedType.disabled = true;
    return;
  }
  state.catalog[brandKey].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.type;
    option.textContent = displayFeedType(item.type);
    sbFeedType.appendChild(option);
  });
  sbFeedType.disabled = false;
}

function populateSkFeedTypes(brand) {
  const brandKey = resolveBrandKey(brand);
  skFeedType.innerHTML = '<option value="">Select feed type</option>';
  if (!brandKey || !state.catalog[brandKey]) {
    skFeedType.disabled = true;
    return;
  }
  state.catalog[brandKey].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.type;
    option.textContent = displayFeedType(item.type);
    skFeedType.appendChild(option);
  });
  skFeedType.disabled = false;
}

function populateRfFeedTypes(brand) {
  if (!rfFeedType) return;
  const brandKey = resolveBrandKey(brand);
  rfFeedType.innerHTML = '<option value="">Select feed type</option>';
  if (!brandKey || !state.catalog[brandKey]) {
    rfFeedType.disabled = true;
    return;
  }
  state.catalog[brandKey].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.type;
    option.textContent = displayFeedType(item.type);
    rfFeedType.appendChild(option);
  });
  rfFeedType.disabled = false;
}

function wireDatePicker(dateDisplay, dateInput, openBtn) {
  openBtn.addEventListener("click", () => {
    if (dateDisplay.value.trim()) {
      dateInput.value = toIsoDate(dateDisplay.value.trim());
    }
    if (typeof dateInput.showPicker === "function") {
      dateInput.showPicker();
      return;
    }
    dateInput.focus();
  });
  dateInput.addEventListener("change", () => {
    dateDisplay.value = formatDateDMY(dateInput.value);
  });
  dateDisplay.addEventListener("input", () => {
    const text = dateDisplay.value.trim();
    if (isValidDMY(text)) {
      dateInput.value = toIsoDate(text);
    }
  });
}

function bagSizeFor(brand, feedType) {
  const key = resolveBrandKey(brand);
  const items = state.catalog[key] || [];
  const exact = items.find((i) => i.type === feedType);
  if (exact) return exact.bagSize;
  const t = normalizeFeedTypeForMatch(feedType);
  const loose = items.find((i) => normalizeFeedTypeForMatch(i.type) === t);
  return loose ? loose.bagSize : 0;
}

/** Kg per opened bag for SK form (owner retail weight override or catalog). */
function skEffectiveKgPerOpenedBagForSkRow(brand, feedType) {
  const rw = findRetailWeightKg(brand, feedType);
  if (rw != null && Number(rw) > 0) return Number(rw);
  return bagSizeFor(brand, feedType);
}

/** Kg remaining after all sales strictly before selDateDMY — matches server cumulative pool logic. */
function skCarryoverKgBeforeSelectedDate(selDateDMY, brand, feedType) {
  const sel = parseDMYParts(selDateDMY);
  if (!sel) return 0;
  const bk = resolveBrandKey(brand);
  const ftWant = feedTypeCatalogValue(bk, feedType);
  const bagSize = skEffectiveKgPerOpenedBagForSkRow(brand, feedType);
  if (!bagSize || bagSize <= 0) return 0;
  const filtered = [];
  for (const r of state.salesKg || []) {
    if (resolveBrandKey(r.brand) !== bk) continue;
    if (feedTypeCatalogValue(bk, r.feed_type) !== ftWant) continue;
    const rd = parseDMYParts(r.date);
    if (!rd) continue;
    if (compareDMYParts(rd, sel) >= 0) continue;
    filtered.push(r);
  }
  filtered.sort((a, b) => {
    const da = parseDMYParts(a.date);
    const db = parseDMYParts(b.date);
    const c = compareDMYParts(da, db);
    if (c !== 0) return c;
    return Number(a.id) - Number(b.id);
  });
  let pool = 0;
  for (const r of filtered) {
    const sold = Number(r.kg_sold || 0);
    if (sold > pool) {
      const autoOpen = Math.ceil((sold - pool) / bagSize);
      pool += autoOpen * bagSize;
    }
    pool -= sold;
    if (pool < 0) pool = 0;
  }
  return pool;
}

/** Sum of bag_opened for the same calendar line (for defaulting the form). Excludes the row being edited. */
function sumBagOpenedForSkLine(dateStr, brand, feedType) {
  if (!dateStr || !brand || !feedType) return 0;
  const bk = resolveBrandKey(brand);
  const ftWant = feedTypeCatalogValue(bk, feedType);
  let sum = 0;
  for (const r of state.salesKg) {
    if (String(r.date).trim() !== String(dateStr).trim()) continue;
    if (resolveBrandKey(r.brand) !== bk) continue;
    if (feedTypeCatalogValue(bk, r.feed_type) !== ftWant) continue;
    if (state.editSalesKgId && String(r.id) === String(state.editSalesKgId)) continue;
    sum += Number(r.bag_opened || 0);
  }
  return sum;
}

/** Default bag opened: 0 if a bag is already open from a prior day or earlier today; otherwise 1 for the first open. */
function applyDefaultSkBagOpened() {
  if (state.editSalesKgId) return;
  const dateStr = skDateDisplay?.value?.trim();
  if (!dateStr || !isValidDMY(dateStr)) return;
  if (!skBrand?.value || !skFeedType?.value) return;
  const el = document.getElementById("skBagOpened");
  if (!el) return;
  const sum = sumBagOpenedForSkLine(dateStr, skBrand.value, skFeedType.value);
  if (sum >= 1) {
    el.value = "0";
    return;
  }
  const carry = skCarryoverKgBeforeSelectedDate(dateStr, skBrand.value, skFeedType.value);
  el.value = carry > 1e-6 ? "0" : "1";
}

/** Matches server getInventoryItem: same bag_size, normalized brand + feed; first row wins (list is id DESC). */
function findInventorySellingPrice(brand, feedType, bagSize) {
  const bs = Number(bagSize);
  if (!Number.isFinite(bs) || bs <= 0) return null;
  const bKey = normalizeBrandName(brand);
  const fKey = normalizeFeedTypeForMatch(feedType);
  for (const row of state.inventoryPricing) {
    if (Number(row.bag_size) !== bs) continue;
    if (normalizeBrandName(row.brand) !== bKey) continue;
    if (normalizeFeedTypeForMatch(row.feed_type) !== fKey) continue;
    const sp = Number(row.selling_price);
    return Number.isFinite(sp) ? sp : null;
  }
  return null;
}

/** Retail price per kg from owner (GET /api/retail-feed-pricing), if configured for this product. */
function findRetailPricePerKg(brand, feedType) {
  const bKey = resolveBrandKey(brand);
  const fKey = normalizeFeedTypeForMatch(feedType);
  for (const row of state.retailFeedPricing || []) {
    if (resolveBrandKey(row.brand) !== bKey) continue;
    if (normalizeFeedTypeForMatch(row.feed_type) !== fKey) continue;
    const p = Number(row.price_per_kg);
    return Number.isFinite(p) ? p : null;
  }
  return null;
}

/** Owner-set kg per opened bag for Total Kgs on Sales Per Kg, when present on the retail line. */
function findRetailWeightKg(brand, feedType) {
  const bKey = resolveBrandKey(brand);
  const fKey = normalizeFeedTypeForMatch(feedType);
  for (const row of state.retailFeedPricing || []) {
    if (resolveBrandKey(row.brand) !== bKey) continue;
    if (normalizeFeedTypeForMatch(row.feed_type) !== fKey) continue;
    const w = row.weight_kg == null || row.weight_kg === "" ? null : Number(row.weight_kg);
    return Number.isFinite(w) && w > 0 ? w : null;
  }
  return null;
}

function updateSalesKgOwnerWeightHint() {
  const el = document.getElementById("skOwnerWeightHint");
  if (!el) return;
  if (state.user?.role !== "employee") {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  const w = findRetailWeightKg(skBrand.value, skFeedType.value);
  if (w != null) {
    el.textContent = `Owner-set weight for this product: ${w} kg per opened bag (used for Total Kgs in the table below).`;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
    el.textContent = "";
  }
}

function applyEmployeeSalesBagPriceFromInventory() {
  if (state.user?.role !== "employee") return;
  const bagSize = Number(sbBagSize.value || 0);
  const sp = findInventorySellingPrice(sbBrand.value, sbFeedType.value, bagSize);
  const el = document.getElementById("sbPricePerBag");
  if (sp != null && sp > 0) el.value = String(sp);
  else el.value = "";
}

function applyEmployeeSalesKgPriceFromInventory() {
  if (state.user?.role !== "employee") return;
  const el = document.getElementById("skPricePerKg");
  const rp = findRetailPricePerKg(skBrand.value, skFeedType.value);
  if (rp != null) {
    el.value = rp.toFixed(2);
    updateSalesKgOwnerWeightHint();
    return;
  }
  const bagKg = bagSizeFor(skBrand.value, skFeedType.value);
  const sp = findInventorySellingPrice(skBrand.value, skFeedType.value, bagKg);
  if (sp != null && bagKg > 0) {
    const perKg = sp / bagKg;
    el.value = Number.isFinite(perKg) ? perKg.toFixed(2) : "";
  } else el.value = "";
  updateSalesKgOwnerWeightHint();
}

function applyEmployeeChickenPriceFromBreeds() {
  if (state.user?.role !== "employee") return;
  const sel = document.getElementById("chBreed");
  const el = document.getElementById("chUnitPrice");
  if (!sel || !el) return;
  const row = getChickenBreedsRows().find((r) => r.breed === sel.value);
  const sp = row != null ? Number(row.selling_price) : NaN;
  if (Number.isFinite(sp) && sp >= 0) el.value = String(sp);
  else el.value = "";
}

/** Owner sale form: buying / selling / profit margin from breed defaults when breed changes. */
function applyOwnerChickenPricesFromBreed() {
  if (state.user?.role !== "owner") return;
  const sel = document.getElementById("chBreed");
  const buyEl = document.getElementById("chBuyingPrice");
  const sellEl = document.getElementById("chSellingPrice");
  const marginEl = document.getElementById("chProfitMarginPerChick");
  if (!sel || !buyEl || !sellEl || !marginEl) return;
  const row = getChickenBreedsRows().find((r) => r.breed === sel.value);
  if (row) {
    buyEl.value = row.buying_price != null ? String(row.buying_price) : "";
    sellEl.value = row.selling_price != null ? String(row.selling_price) : "";
    marginEl.value = row.profit_margin_per_chick != null ? String(row.profit_margin_per_chick) : "";
  } else {
    buyEl.value = "";
    sellEl.value = "";
    marginEl.value = "";
  }
}

function syncOwnerChickenMarginFromBuySell() {
  if (state.user?.role !== "owner") return;
  const buy = Number(document.getElementById("chBuyingPrice")?.value);
  const sell = Number(document.getElementById("chSellingPrice")?.value);
  const mEl = document.getElementById("chProfitMarginPerChick");
  if (!mEl || !Number.isFinite(buy) || !Number.isFinite(sell)) return;
  mEl.value = String(Math.round((sell - buy) * 100) / 100);
}

function syncOwnerChickenSellFromBuyMargin() {
  if (state.user?.role !== "owner") return;
  const buy = Number(document.getElementById("chBuyingPrice")?.value);
  const m = Number(document.getElementById("chProfitMarginPerChick")?.value);
  const sellEl = document.getElementById("chSellingPrice");
  if (!sellEl || !Number.isFinite(buy) || !Number.isFinite(m)) return;
  sellEl.value = String(Math.round((buy + m) * 100) / 100);
}

function applyEmployeeFeedSalePricingUi() {
  const isEmployee = state.user?.role === "employee";
  const sb = document.getElementById("sbPricePerBag");
  const sk = document.getElementById("skPricePerKg");
  const ch = document.getElementById("chUnitPrice");
  const saleTypeEl = document.getElementById("sbSaleType");
  const isPassThrough = !!(saleTypeEl && isNonProfitSaleVia(saleTypeEl.value));
  if (sb) {
    const lockBagPrice = !!isEmployee && !isPassThrough;
    sb.readOnly = lockBagPrice;
    sb.title = isEmployee
      ? isPassThrough
        ? "Enter the price the customer pays per bag. Total in the list is buying cost × bags; feed profit ignores this sale."
        : "Matches the selling price per bag from Feed Inventory for this product."
      : "";
  }
  if (sk) {
    sk.readOnly = !!isEmployee;
    sk.title = isEmployee
      ? "Uses retail price per kg from Retail Feed Inventory when set; otherwise selling price per bag ÷ bag size from Feed Inventory. Owner weight (kg) for Maize Germ, Broken Wheat, Wheat Bran/Pollard appears above when set."
      : "";
  }
  if (ch) {
    ch.readOnly = !!isEmployee;
    ch.title = isEmployee
      ? "Filled from the selling price for this breed (set under Chicken Sales Inventory by the owner)."
      : "";
  }
  if (isEmployee) {
    if (!isPassThrough) applyEmployeeSalesBagPriceFromInventory();
    applyEmployeeSalesKgPriceFromInventory();
    applyEmployeeChickenPriceFromBreeds();
    updateChickenCustomerAmounts();
  }
}

function statusLabel(row) {
  return row.quantity_in_stock <= row.reorder_level
    ? '<span class="status-low">REORDER</span>'
    : '<span class="status-ok">OK</span>';
}

function resetForm() {
  form.reset();
  state.editId = null;
  dateDisplayInput.value = "";
  feedTypeSelect.innerHTML = '<option value="">Select feed type</option>';
  feedTypeSelect.disabled = true;
  bagSizeInput.value = "";
  document.getElementById("profitMarginPerBag").value = "";
  document.getElementById("accumulatedProfit").value = "0";
  document.getElementById("accumulatedBags").value = "";
  document.getElementById("saveBtn").textContent = "Save Record";
}

function renderOwnerPassThroughBagSales() {
  const tbody = document.getElementById("ufaray-bag-sales-body");
  if (!tbody) return;
  if (state.user.role !== "owner" || state.currentPage !== "inventory") return;
  const rows = (state.salesBags || []).filter((r) => String(r.through_party || "").trim() !== "");
  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="11" class="empty">No pass-through bag sales yet. Staff record these under Sales Per Bags using Sale recorded for (Terry/Cess/Rose/Ufaray).</td></tr>';
    return;
  }
  tbody.innerHTML = joinRowsWithDateSeparators(rows, 11, (row) => {
    const viaRaw = normalizeSaleVia(row.through_party);
    const viaCell = viaRaw ? `By ${viaRaw}` : "—";
    const stRaw = String(row.pass_through_status || "pending").toLowerCase();
    const status = stRaw === "solved" ? "solved" : "pending";
    return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td>${row.bag_size} kg</td>
        <td>${row.bags_sold}</td>
        <td>${currency(row.price_per_bag)}</td>
        <td>${currency(saleLineTotalBags(row))}</td>
        <td>${viaCell}</td>
        <td>
          <select data-kind="ufaray-status" data-id="${row.id}">
            <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
            <option value="solved" ${status === "solved" ? "selected" : ""}>Solved</option>
          </select>
        </td>
        <td>${row.created_by}</td>
        <td>
          <select data-kind="ufaray-via" data-id="${row.id}">
            <option value="Terry" ${viaRaw === "Terry" ? "selected" : ""}>By Terry</option>
            <option value="Cess" ${viaRaw === "Cess" ? "selected" : ""}>By Cess</option>
            <option value="Rose" ${viaRaw === "Rose" ? "selected" : ""}>By Rose</option>
            <option value="Ufaray" ${viaRaw === "Ufaray" ? "selected" : ""}>By Ufaray</option>
            <option value="Shop" ${viaRaw === "Shop" ? "selected" : ""}>Shop</option>
          </select>
          <button type="button" data-kind="ufaray-via-save" data-id="${row.id}">Save via</button>
          <button type="button" data-kind="ufaray-status-save" data-id="${row.id}">Save status</button>
        </td>
      </tr>`;
  });
}

function renderOwnerUfarayChickenSales() {
  const tbody = document.getElementById("ufaray-chicken-sales-body");
  if (!tbody) return;
  if (state.user.role !== "owner" || state.currentPage !== "chicken-inventory") return;
  const rows = (state.chickenSales || []).filter((r) => String(r.through_party || "").trim() !== "");
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No Ufaray chicken sales yet.</td></tr>';
    return;
  }
  tbody.innerHTML = joinRowsWithDateSeparators(rows, 7, (row) => {
    const qty = Number(row.quantity_birds) || 0;
    const unit = Number(row.unit_price) || 0;
    const margin = Number(row.margin_snap) || 0;
    const buyingPerChick = Math.max(0, unit - margin);
    const totalAmount = qty * buyingPerChick;
    const status = String(row.pass_through_status || "pending").toLowerCase() === "solved" ? "solved" : "pending";
    return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${qty}</td>
        <td>${currency(buyingPerChick)}</td>
        <td>${currency(totalAmount)}</td>
        <td>
          <select data-kind="ufaray-ch-status" data-id="${row.id}">
            <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
            <option value="solved" ${status === "solved" ? "selected" : ""}>Solved</option>
          </select>
        </td>
        <td>${row.created_by}</td>
        <td><div class="row-actions">
          <button type="button" data-kind="ufaray-ch-status-save" data-id="${row.id}">Save</button>
          <button type="button" data-kind="ufaray-ch-sale" data-action="edit" data-id="${row.id}">Edit</button>
          <button type="button" class="danger" data-kind="ufaray-ch-sale" data-action="delete" data-id="${row.id}">Delete</button>
        </div></td>
      </tr>`;
  });
}

function renderOwnerUfarayNewPageSales() {
  if (state.user.role !== "owner") return;
  const render = (tbodyId, rows, rowHtml) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">No pass-through sales yet.</td></tr>';
      return;
    }
    tbody.innerHTML = joinRowsWithDateSeparators(rows, 9, rowHtml);
  };

  const fdRows = (state.feedersDrinkersSales || []).filter((r) => String(r.through_party || "").trim() !== "");
  render("ufaray-fd-sales-body", fdRows, (row) => {
    const status = String(row.pass_through_status || "pending").toLowerCase() === "solved" ? "solved" : "pending";
    const via = String(row.through_party || "").trim();
    return `<tr>
      <td>${formatDateDMY(row.date)}</td>
      <td>${row.item_name}</td>
      <td>${row.quantity_sold}</td>
      <td>${currency(row.price_per_item)}</td>
      <td>${currency(row.total_amount)}</td>
      <td>${via ? `By ${via}` : "—"}</td>
      <td>
        <select data-kind="ufaray-fd-status" data-id="${row.id}">
          <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
          <option value="solved" ${status === "solved" ? "selected" : ""}>Solved</option>
        </select>
      </td>
      <td>${row.created_by}</td>
      <td><div class="row-actions">
        <button type="button" data-kind="ufaray-fd-status-save" data-id="${row.id}">Save</button>
        <button type="button" data-kind="ufaray-fd-sale" data-action="edit" data-id="${row.id}">Edit</button>
        <button type="button" class="danger" data-kind="ufaray-fd-sale" data-action="delete" data-id="${row.id}">Delete</button>
      </div></td>
    </tr>`;
  });

  const medRows = (state.medicamentsSales || []).filter((r) => String(r.through_party || "").trim() !== "");
  render("ufaray-med-sales-body", medRows, (row) => {
    const status = String(row.pass_through_status || "pending").toLowerCase() === "solved" ? "solved" : "pending";
    const via = String(row.through_party || "").trim();
    return `<tr>
      <td>${formatDateDMY(row.date)}</td>
      <td>${row.item_name}</td>
      <td>${row.quantity_sold}</td>
      <td>${currency(row.price_per_item)}</td>
      <td>${currency(row.total_amount)}</td>
      <td>${via ? `By ${via}` : "—"}</td>
      <td>
        <select data-kind="ufaray-med-status" data-id="${row.id}">
          <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
          <option value="solved" ${status === "solved" ? "selected" : ""}>Solved</option>
        </select>
      </td>
      <td>${row.created_by}</td>
      <td><div class="row-actions">
        <button type="button" data-kind="ufaray-med-status-save" data-id="${row.id}">Save</button>
        <button type="button" data-kind="ufaray-med-sale" data-action="edit" data-id="${row.id}">Edit</button>
        <button type="button" class="danger" data-kind="ufaray-med-sale" data-action="delete" data-id="${row.id}">Delete</button>
      </div></td>
    </tr>`;
  });

  const gasRows = (state.gasSales || []).filter((r) => String(r.through_party || "").trim() !== "");
  render("ufaray-gas-sales-body", gasRows, (row) => {
    const status = String(row.pass_through_status || "pending").toLowerCase() === "solved" ? "solved" : "pending";
    const via = String(row.through_party || "").trim();
    return `<tr>
      <td>${formatDateDMY(row.date)}</td>
      <td>${row.size_kg} kg</td>
      <td>${row.quantity_sold}</td>
      <td>${currency(row.price_per_item)}</td>
      <td>${currency(row.total_amount)}</td>
      <td>${via ? `By ${via}` : "—"}</td>
      <td>
        <select data-kind="ufaray-gas-status" data-id="${row.id}">
          <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
          <option value="solved" ${status === "solved" ? "selected" : ""}>Solved</option>
        </select>
      </td>
      <td>${row.created_by}</td>
      <td><div class="row-actions">
        <button type="button" data-kind="ufaray-gas-status-save" data-id="${row.id}">Save</button>
        <button type="button" data-kind="ufaray-gas-sale" data-action="edit" data-id="${row.id}">Edit</button>
        <button type="button" class="danger" data-kind="ufaray-gas-sale" data-action="delete" data-id="${row.id}">Delete</button>
      </div></td>
    </tr>`;
  });
}

function renderTable() {
  if (!state.records.length) {
    tableBody.innerHTML = '<tr><td colspan="15" class="empty">No records.</td></tr>';
    return;
  }

  tableBody.innerHTML = joinRowsWithDateSeparators(state.records, 15, (row) => {
    const canDelete = state.user.role === "owner";
    const lineCumulative = currency(row.cumulative_bag_profit ?? 0);
    const ufarayBags = Number(row.bags_sold_pass_through ?? 0);
    const accBags = row.accumulated_bags != null ? row.accumulated_bags : row.quantity_in_stock;
    return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td>${row.bag_size} kg</td>
        <td>${row.quantity_in_stock}</td>
        <td>${accBags}</td>
        <td>${currency(row.buying_price)}</td>
        <td>${currency(row.selling_price)}</td>
        <td>${currency(row.profit_margin_per_bag ?? 0)}</td>
        <td>${lineCumulative}</td>
        <td>${ufarayBags}</td>
        <td>${row.reorder_level}</td>
        <td>${statusLabel(row)}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit" data-id="${row.id}">Edit</button>
            ${
              canDelete
                ? `<button type="button" class="danger" data-action="delete" data-id="${row.id}">Delete</button>`
                : ""
            }
          </div>
        </td>
      </tr>`;
  });
}

function renderSalesBagsTable() {
  if (!state.salesBags.length) {
    salesBagsBody.innerHTML = '<tr><td colspan="10" class="empty">No sales.</td></tr>';
    return;
  }
  salesBagsBody.innerHTML = joinRowsWithDateSeparators(state.salesBags, 10, (row) => {
    const canEdit =
      state.user.role === "owner" ||
      (state.user.role === "employee" && employeeBagSaleEditAllowed(row));
    const canDelete =
      state.user.role === "owner" || (state.user.role === "employee" && employeeBagSaleDeleteAllowed(row));
    const viaRaw = String(row.through_party || "").trim();
    const viaCell = viaRaw ? `By ${viaRaw}` : "—";
    return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td>${row.bag_size} kg</td>
        <td>${row.bags_sold}</td>
        <td>${currency(row.price_per_bag)}</td>
        <td>${currency(saleLineTotalBags(row))}</td>
        <td>${viaCell}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            ${
              canEdit
                ? `<button type="button" data-kind="bags" data-action="edit" data-id="${row.id}">Edit</button>`
                : ""
            }
            ${canDelete ? `<button type="button" class="danger" data-kind="bags" data-action="delete" data-id="${row.id}">Delete</button>` : ""}
          </div>
        </td>
      </tr>`;
  });
}

function renderSalesKgTable() {
  if (!state.salesKg.length) {
    salesKgBody.innerHTML = '<tr><td colspan="12" class="empty">No sales.</td></tr>';
    return;
  }
  const shopDay = state.shopToday || clientShopTodayDMY();
  salesKgBody.innerHTML = joinRowsWithDateSeparators(state.salesKg, 12, (row) => {
    const canEdit =
      state.user.role === "owner" ||
      (saleDateOnOrAfterShopDay(row.date, shopDay) && saleWithinEmployeeEditWindow(row));
    const canDelete =
      state.user.role === "owner" || (state.user.role === "employee" && employeeKgSaleDeleteAllowed(row));
    const bagsFromKg =
      row.bags_sold_cumulative != null ? row.bags_sold_cumulative : Number(row.bags_sold || 0);
    const bagOpenedCell =
      row.bag_opened_display != null ? row.bag_opened_display : Number(row.bag_opened || 0) > 0 ? 1 : 0;
    const rem =
      row.total_kgs_remaining != null
        ? Number(row.total_kgs_remaining).toFixed(2)
        : "—";
    const viaRaw = String(row.through_party || "").trim();
    const viaCell = viaRaw ? `By ${viaRaw}` : "—";
    return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td title="1 once at least one bag is opened for this product on this date.">${bagOpenedCell}</td>
        <td title="Kg left after this sale: running pool across calendar days (bag opens add kg per bag; kg sold subtracts per row).">${rem}</td>
        <td title="Full bags represented by total kg sold this day for this product (bag size from catalog).">${bagsFromKg}</td>
        <td title="Kg on this row for this day (after merges): ${Number(row.kg_sold ?? 0)}. Running total through this date for you and this product: ${Number(row.accumulated_kg_sold ?? row.kg_sold ?? 0)}.">${row.accumulated_kg_sold != null ? row.accumulated_kg_sold : row.kg_sold}</td>
        <td>${currency(row.price_per_kg)}</td>
        <td>${currency(saleLineTotalKg(row))}</td>
        <td>${viaCell}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            ${
              canEdit
                ? `<button type="button" data-kind="kg" data-action="edit" data-id="${row.id}">Edit</button>`
                : ""
            }
            ${canDelete ? `<button type="button" class="danger" data-kind="kg" data-action="delete" data-id="${row.id}">Delete</button>` : ""}
          </div>
        </td>
      </tr>`;
  });
}

function renderRetailPricingTable() {
  if (!retailPricingBody) return;
  if (!state.retailFeedPricing.length) {
    retailPricingBody.innerHTML =
      '<tr><td colspan="9" class="empty">No retail prices yet. Add a product using the form above.</td></tr>';
    return;
  }
  retailPricingBody.innerHTML = state.retailFeedPricing
    .map(
      (row) => `
      <tr>
        <td>${row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td>${row.bag_size} kg</td>
        <td>${
          row.weight_kg != null && row.weight_kg !== "" && Number(row.weight_kg) > 0
            ? `${Number(row.weight_kg)} kg`
            : "—"
        }</td>
        <td>${currency(row.price_per_kg)}</td>
        <td>${currency(row.profit_margin_per_kg)}</td>
        <td>${currency(row.accumulated_profit ?? 0)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit-retail" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-action="delete-retail" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}

function renderRetailInventoryTable() {
  if (!retailInventoryBody) return;
  if (!state.retailFeedSummary.length) {
    retailInventoryBody.innerHTML =
      '<tr><td colspan="8" class="empty">No Sales Per Kg data yet. Employees record sales under Sales Per Kg.</td></tr>';
    return;
  }
  retailInventoryBody.innerHTML = joinRowsWithDateSeparators(state.retailFeedSummary, 8, (row) => {
    return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td>${row.bag_size} kg</td>
        <td>${Number(row.bags_opened || 0)}</td>
        <td>${Number(row.remaining_kg ?? 0)}</td>
        <td>${Number(row.employee_kg_sold ?? 0)}</td>
        <td>${Number(row.bags_sold_from_kg || 0)}</td>
      </tr>`;
  });
}

function populateFeedersDrinkersItems() {
  if (!fdItem) return;
  const current = fdItem.value;
  fdItem.innerHTML = '<option value="">Select item</option>';
  const items =
    state.user?.role === "employee"
      ? state.feedersDrinkersEmployeeItems || []
      : state.feedersDrinkersCatalog || [];
  for (const item of items) {
    const name = typeof item === "string" ? item : item.name || item.item_name;
    if (!name) continue;
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    fdItem.appendChild(opt);
  }
  if (current && [...fdItem.options].some((o) => o.value === current)) fdItem.value = current;
}

function populateMedicamentsItems() {
  if (!medItem) return;
  const current = medItem.value;
  medItem.innerHTML = '<option value="">Select item</option>';
  const items =
    state.user?.role === "employee"
      ? state.medicamentsEmployeeItems || []
      : state.medicamentsCatalog || [];
  for (const item of items) {
    const name = typeof item === "string" ? item : item.name || item.item_name;
    if (!name) continue;
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    medItem.appendChild(opt);
  }
  if (current && [...medItem.options].some((o) => o.value === current)) medItem.value = current;
}

function populateGasSizes() {
  if (!gasSize) return;
  const current = gasSize.value;
  gasSize.innerHTML = '<option value="">Select size</option>';
  const items = state.gasEmployeeItems || [];
  for (const row of items) {
    const sk = row.size_kg;
    if (sk == null || sk === "") continue;
    const opt = document.createElement("option");
    opt.value = String(sk);
    const qty = Number(row.quantity_in_stock) || 0;
    opt.textContent = `${sk} kg (in stock: ${qty})`;
    gasSize.appendChild(opt);
  }
  if (current && [...gasSize.options].some((o) => o.value === current)) gasSize.value = current;
}

function currentFdSellingPrice(itemName) {
  const rows = (state.feedersDrinkersInventory || []).filter((r) => String(r.item_name || "") === String(itemName || ""));
  if (!rows.length) return null;
  const row = rows[0];
  const p = Number(row.selling_price);
  return Number.isFinite(p) ? p : null;
}

function currentMedSellingPrice(itemName) {
  const rows = (state.medicamentsInventory || []).filter((r) => String(r.item_name || "") === String(itemName || ""));
  if (!rows.length) return null;
  const row = rows[0];
  const p = Number(row.selling_price);
  return Number.isFinite(p) ? p : null;
}

function currentGasSellingPrice(sizeKgKey) {
  const key = Number(sizeKgKey);
  if (!Number.isFinite(key) || key <= 0) return null;
  const rows = (state.gasInventory || []).filter((r) => Number(r.size_kg) === key);
  if (!rows.length) return null;
  const row = rows[0];
  const p = Number(row.selling_price);
  return Number.isFinite(p) ? p : null;
}

function refreshEmployeeNewPageSellingPrices() {
  if (state.user?.role !== "employee") return;
  const fdSell = document.getElementById("fdEmployeeSellingPrice");
  const medSell = document.getElementById("medEmployeeSellingPrice");
  const gasSell = document.getElementById("gasEmployeeSellingPrice");
  if (fdSell) {
    const p = currentFdSellingPrice(fdItem?.value);
    fdSell.value = p == null ? "" : String(p);
  }
  if (medSell) {
    const p = currentMedSellingPrice(medItem?.value);
    medSell.value = p == null ? "" : String(p);
  }
  if (gasSell) {
    const p = currentGasSellingPrice(gasSize?.value);
    gasSell.value = p == null ? "" : String(p);
  }
}

function renderFeedersDrinkersTable() {
  if (!fdBody) return;
  const isOwner = state.user.role === "owner";
  const rows = isOwner ? state.feedersDrinkersInventory : state.feedersDrinkersSales;
  const colSpan = isOwner ? 14 : 8;
  if (!rows.length) {
    fdBody.innerHTML = `<tr><td colspan="${colSpan}" class="empty">No records.</td></tr>`;
    return;
  }
  if (!isOwner) {
    fdBody.innerHTML = joinRowsWithDateSeparators(rows, colSpan, (row) => `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${row.item_name}</td>
        <td>${row.quantity_sold}</td>
        <td>${currency(row.total_amount)}</td>
        <td><span class="status-ok">SOLD</span></td>
        <td>${String(row.through_party || "").trim() ? `By ${String(row.through_party || "").trim()}` : "—"}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="fd-sale" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="fd-sale" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`);
    return;
  }
  fdBody.innerHTML = joinRowsWithDateSeparators(rows, colSpan, (row) => `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${row.item_name}</td>
        <td>${row.quantity_in_stock}</td>
        <td>${currency((Number(row.accumulated_stock ?? row.quantity_in_stock) || 0) * (Number(row.buying_price) || 0))}</td>
        <td>${currency(row.buying_price)}</td>
        <td>${currency(row.selling_price)}</td>
        <td>${row.quantity_in_stock}</td>
        <td>${row.accumulated_stock != null ? row.accumulated_stock : row.quantity_in_stock}</td>
        <td>${currency(row.profit_margin ?? 0)}</td>
        <td>${currency(row.accumulated_profit ?? 0)}</td>
        <td>${row.reorder_level}</td>
        <td>${statusLabel(row)}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="fd" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="fd" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`);
}

function renderMedicamentsTable() {
  if (!medBody) return;
  const isOwner = state.user.role === "owner";
  const rows = isOwner ? state.medicamentsInventory : state.medicamentsSales;
  const colSpan = isOwner ? 14 : 8;
  if (!rows.length) {
    medBody.innerHTML = `<tr><td colspan="${colSpan}" class="empty">No records.</td></tr>`;
    return;
  }
  if (!isOwner) {
    medBody.innerHTML = joinRowsWithDateSeparators(rows, colSpan, (row) => `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${row.item_name}</td>
        <td>${row.quantity_sold}</td>
        <td>${currency(row.total_amount)}</td>
        <td><span class="status-ok">SOLD</span></td>
        <td>${String(row.through_party || "").trim() ? `By ${String(row.through_party || "").trim()}` : "—"}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="med-sale" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="med-sale" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`);
    return;
  }
  medBody.innerHTML = joinRowsWithDateSeparators(rows, colSpan, (row) => `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${row.item_name}</td>
        <td>${row.quantity_in_stock}</td>
        <td>${currency((Number(row.accumulated_stock ?? row.quantity_in_stock) || 0) * (Number(row.buying_price) || 0))}</td>
        <td>${currency(row.buying_price)}</td>
        <td>${currency(row.selling_price)}</td>
        <td>${row.quantity_in_stock}</td>
        <td>${row.accumulated_stock != null ? row.accumulated_stock : row.quantity_in_stock}</td>
        <td>${currency(row.profit_margin ?? 0)}</td>
        <td>${currency(row.accumulated_profit ?? 0)}</td>
        <td>${row.reorder_level}</td>
        <td>${statusLabel(row)}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="med" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="med" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`);
}

function renderGasTable() {
  if (!gasBody) return;
  const isOwner = state.user.role === "owner";
  const rows = isOwner ? state.gasInventory : state.gasSales;
  const colSpan = isOwner ? 13 : 7;
  if (!rows.length) {
    gasBody.innerHTML = `<tr><td colspan="${colSpan}" class="empty">No records.</td></tr>`;
    return;
  }
  if (!isOwner) {
    gasBody.innerHTML = joinRowsWithDateSeparators(rows, colSpan, (row) => `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${row.size_kg}</td>
        <td>${row.quantity_sold}</td>
        <td><span class="status-ok">SOLD</span></td>
        <td>${String(row.through_party || "").trim() ? `By ${String(row.through_party || "").trim()}` : "—"}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="gas-sale" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="gas-sale" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`);
    return;
  }
  gasBody.innerHTML = joinRowsWithDateSeparators(rows, colSpan, (row) => `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${row.size_kg}</td>
        <td>${row.quantity_in_stock}</td>
        <td>${currency(row.buying_price)}</td>
        <td>${currency(row.selling_price)}</td>
        <td>${row.quantity_in_stock}</td>
        <td>${row.accumulated_stock != null ? row.accumulated_stock : row.quantity_in_stock}</td>
        <td>${currency(row.profit_margin ?? 0)}</td>
        <td>${currency(row.accumulated_profit ?? 0)}</td>
        <td>${row.reorder_level}</td>
        <td>${statusLabel(row)}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="gas" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="gas" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`);
}

function resetFeedersDrinkersForm() {
  if (!fdForm) return;
  fdForm.reset();
  state.editFeedersDrinkersId = null;
  if (fdSaleType) fdSaleType.value = "";
  if (fdDateDisplay) fdDateDisplay.value = "";
  if (document.getElementById("fdSaveBtn")) {
    document.getElementById("fdSaveBtn").textContent = state.user?.role === "employee" ? "Save sale" : "Save record";
  }
}

function resetMedicamentsForm() {
  if (!medForm) return;
  medForm.reset();
  state.editMedicamentId = null;
  if (medSaleType) medSaleType.value = "";
  if (medDateDisplay) medDateDisplay.value = "";
  if (document.getElementById("medSaveBtn")) {
    document.getElementById("medSaveBtn").textContent = state.user?.role === "employee" ? "Save sale" : "Save record";
  }
}

function resetGasForm() {
  if (!gasForm) return;
  gasForm.reset();
  state.editGasId = null;
  if (gasSaleType) gasSaleType.value = "";
  if (gasSizeKg) gasSizeKg.disabled = false;
  if (gasDateDisplay) gasDateDisplay.value = "";
  if (document.getElementById("gasSaveBtn")) {
    document.getElementById("gasSaveBtn").textContent = state.user?.role === "employee" ? "Save sale" : "Save record";
  }
}

function renderExpenditureTable() {
  if (!expBody) return;
  const rows = state.expenditureEntries || [];
  const colSpan = 5;
  if (!rows.length) {
    expBody.innerHTML = `<tr><td colspan="${colSpan}" class="empty">No records.</td></tr>`;
    updateExpenditureAccumulatedDisplay();
    return;
  }
  expBody.innerHTML = joinRowsWithDateSeparators(rows, colSpan, (row) => `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${escapeHtmlCell(row.description)}</td>
        <td>${currency(row.money_out)}</td>
        <td>${currency(row.total)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="exp" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="exp" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`);
  updateExpenditureAccumulatedDisplay();
}

function renderCalculatorTable() {
  if (!calcBody) return;
  const activeEl = document.activeElement;
  let activeKey = "";
  let activeKind = "";
  let selStart = null;
  let selEnd = null;
  let activeBrand = "";
  let activeFeedType = "";
  let activeBagSize = 0;
  if (activeEl instanceof HTMLInputElement && calcBody.contains(activeEl)) {
    const tr = activeEl.closest("tr");
    if (tr instanceof HTMLTableRowElement) {
      activeBrand = tr.dataset.calcBrand || "";
      activeFeedType = tr.dataset.calcFeedType || "";
      activeBagSize = Number(tr.dataset.calcBagSize || 0);
      activeKey = calculatorRowKey(activeBrand, activeFeedType, activeBagSize);
      activeKind = activeEl.dataset.kind || "";
      selStart = activeEl.selectionStart;
      selEnd = activeEl.selectionEnd;
    }
  }
  const rows = calculatorRowsFromCatalog();
  if (!rows.length) {
    calcBody.innerHTML = '<tr><td colspan="6" class="empty">No feed catalog loaded.</td></tr>';
    updateCalculatorGrandTotalDisplay();
    return;
  }
  calcBody.innerHTML = rows
    .map(
      (row) => {
        const rowKey = calculatorRowKey(row.brand, row.feedType, row.bagSize);
        const remembered = state.calculatorValues[rowKey];
        const defaultBuying = findInventoryBuyingPriceForCalculator(row.brand, row.feedType, row.bagSize);
        const buyingValue =
          remembered?.buying != null && String(remembered.buying).trim() !== ""
            ? remembered.buying
            : defaultBuying != null
              ? String(defaultBuying)
              : "";
        return `
      <tr data-calc-brand="${escapeHtmlCell(row.brand)}" data-calc-feed-type="${escapeHtmlCell(row.feedType)}" data-calc-bag-size="${row.bagSize}">
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feedType)}</td>
        <td>${row.bagSize}</td>
        <td><input type="text" data-kind="calc-bags" inputmode="numeric" placeholder="Bags" value="${escapeHtmlCell(remembered?.bags || "")}" /></td>
        <td><input type="text" data-kind="calc-buying" inputmode="decimal" placeholder="Buying price" value="${escapeHtmlCell(buyingValue)}" /></td>
        <td class="js-calc-row-total">${currency(0)}</td>
      </tr>`;
      }
    )
    .join("");
  updateCalculatorGrandTotalDisplay();
  if (activeKey && (activeKind === "calc-bags" || activeKind === "calc-buying")) {
    const tr = [...calcBody.querySelectorAll("tr")].find(
      (row) =>
        row instanceof HTMLTableRowElement &&
        calculatorRowKey(row.dataset.calcBrand || "", row.dataset.calcFeedType || "", Number(row.dataset.calcBagSize || 0)) ===
          calculatorRowKey(activeBrand, activeFeedType, activeBagSize)
    );
    if (tr instanceof HTMLTableRowElement) {
      const input = tr.querySelector(`input[data-kind='${activeKind}']`);
      if (input instanceof HTMLInputElement) {
        input.focus();
        if (selStart != null && selEnd != null) {
          try {
            input.setSelectionRange(selStart, selEnd);
          } catch (_e) {
            // ignore unsupported range types
          }
        }
      }
    }
  }
}

function resetExpenditureForm() {
  if (!expenditureForm) return;
  expenditureForm.reset();
  state.editExpenditureId = null;
  if (expDateDisplay) expDateDisplay.value = "";
  const saveBtn = document.getElementById("expSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
}

function resetRoseForm() {
  if (!roseForm) return;
  roseForm.reset();
  state.editRoseId = null;
  if (roseDate) roseDate.value = "";
  if (roseDateDisplay) roseDateDisplay.value = "";
  const via = document.getElementById("roseSaleVia");
  if (via) via.value = "Shop";
  const saveBtn = document.getElementById("roseSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
}

function renderRoseTable() {
  if (!roseBody) return;
  const rows = state.roseEntries || [];
  if (!rows.length) {
    roseBody.innerHTML = '<tr><td colspan="10" class="empty">No records.</td></tr>';
    const inEl = document.getElementById("roseTotalMoneyIn");
    const outEl = document.getElementById("roseTotalMoneyOut");
    const mortEl = document.getElementById("roseTotalMortality");
    if (inEl) inEl.textContent = "0";
    if (outEl) outEl.textContent = "0";
    if (mortEl) mortEl.textContent = "0";
    return;
  }
  let sumIn = 0;
  let sumOut = 0;
  let sumMort = 0;
  roseBody.innerHTML = rows
    .map((row, idx) => {
      sumIn += Number(row.money_in || 0);
      sumOut += Number(row.money_out || 0);
      sumMort += Number(row.mortality || 0);
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDMY(row.date)}</td>
        <td>${escapeHtmlCell(row.description)}</td>
        <td>${Number(row.quantity || 0)}</td>
        <td>${Number(row.unit_price || 0)}</td>
        <td>${Number(row.money_in || 0)}</td>
        <td>${Number(row.money_out || 0)}</td>
        <td>${Number(row.mortality || 0)}</td>
        <td>${escapeHtmlCell(row.sale_via || "Shop")}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="rose" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="rose" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  const inEl = document.getElementById("roseTotalMoneyIn");
  const outEl = document.getElementById("roseTotalMoneyOut");
  const mortEl = document.getElementById("roseTotalMortality");
  if (inEl) inEl.textContent = String(sumIn);
  if (outEl) outEl.textContent = String(sumOut);
  if (mortEl) mortEl.textContent = String(sumMort);
}

function chickenSalesTableRowsHtml() {
  const emptyMsg =
    state.user.role === "owner" ? "No chick records yet." : "No chick sales recorded yet.";
  const isEmployeeViewer = state.user.role === "employee";
  const colSpan = isEmployeeViewer ? 14 : 15;
  if (!state.chickenSales.length) {
    return `<tr><td colspan="${colSpan}" class="empty">${emptyMsg}</td></tr>`;
  }
  return joinRowsWithDateSeparators(state.chickenSales, colSpan, (row) => {
    const isOwnerInventoryRow = isChickenRowOwnerInventory(row);
    let canEdit = false;
    let canDelete = false;
    if (isEmployeeViewer) {
      canEdit = true;
      canDelete = true;
    } else if (state.user.role === "owner") {
      canEdit = true;
      canDelete = true;
    }
    const breedCell = row.breed ? row.breed : "—";
    const notesCell = row.description ? row.description : "—";
    const customerCells = chickenSaleCustomerCellsHtml(row);
    const profitCell = isEmployeeViewer ? "" : `<td>${formatChickenSaleProfitCell(row)}</td>`;
    const viaRaw = String(row.through_party || "").trim();
    const viaCell = viaRaw ? `By ${viaRaw}` : "—";
    return `
      <tr data-chicken-row-id="${row.id}">
        <td>${formatDateDMY(row.date)}</td>
        <td>${breedCell}</td>
        <td>${notesCell}</td>
        <td>${row.quantity_birds}</td>
        <td>${currency(row.unit_price)}</td>
        <td>${currency(saleLineTotalChicken(row))}</td>
        ${customerCells}
        ${profitCell}
        <td>${viaCell}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            ${
              canEdit
                ? `<button type="button" data-kind="chicken" data-action="edit" data-id="${row.id}">Edit</button>`
                : ""
            }
            ${canDelete ? `<button type="button" class="danger" data-kind="chicken" data-action="delete" data-id="${row.id}">Delete</button>` : ""}
          </div>
        </td>
      </tr>`;
  });
}

function renderChickenSalesHistoryTable() {
  if (!chickenInventoryBody) return;
  const prevOwnerSel = state.ownerSelectedChickenRowId;
  chickenInventoryBody.innerHTML = chickenSalesTableRowsHtml();
  if (state.user.role === "owner" && prevOwnerSel != null) {
    const selRow = state.chickenSales.find((r) => String(r.id) === String(prevOwnerSel));
    if (selRow) {
      fillOwnerCustomerViewPanel(selRow);
      highlightChickenRowForOwner(selRow.id);
    } else {
      state.ownerSelectedChickenRowId = null;
      clearOwnerCustomerViewPanel();
      highlightChickenRowForOwner(null);
    }
  } else {
    highlightChickenRowForOwner(null);
  }
  const summaryEl = document.getElementById("chickenInventorySummary");
  if (!summaryEl) return;
  if (state.user.role !== "owner") {
    summaryEl.textContent = "";
    return;
  }
  if (!state.chickenSales.length) {
    summaryEl.textContent = "";
    return;
  }
  let invBirds = 0;
  let invRevenue = 0;
  let staffMarginSum = 0;
  for (const r of state.chickenSales) {
    const isInv = isChickenRowOwnerInventory(r);
    if (isInv) {
      invBirds += Number(r.quantity_birds) || 0;
      invRevenue += saleLineTotalChicken(r);
    }
    staffMarginSum += chickenSaleLineProfit(r);
  }
  summaryEl.textContent = `Your inventory: ${invBirds} chicks · ${currency(invRevenue)} at listed prices. Staff sales in this table: margin total ${currency(staffMarginSum)} (delivered payments only; matches Profit column). Highlight above uses the same basis.`;
}

function populateChickenBreedSelect() {
  const sel = document.getElementById("chBreed");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select breed</option>';
  for (const r of getChickenBreedsRows()) {
    if (!r.breed) continue;
    const opt = document.createElement("option");
    opt.value = r.breed;
    opt.textContent = r.breed;
    sel.appendChild(opt);
  }
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function resetSalesBagForm() {
  salesBagsForm.reset();
  state.editSalesBagId = null;
  sbDateDisplay.value = "";
  sbFeedType.innerHTML = '<option value="">Select feed type</option>';
  sbFeedType.disabled = true;
  sbBagSize.value = "";
  const st = document.getElementById("sbSaleType");
  fillBagSaleViaSelect(st, state.appInstance === "shop" ? "Shop" : "");
  document.getElementById("sbSaveBtn").textContent = "Save sale";
  applyEmployeeSalesDateRules();
  applyEmployeeFeedSalePricingUi();
}

function resetSalesKgForm() {
  salesKgForm.reset();
  state.editSalesKgId = null;
  skDateDisplay.value = "";
  skFeedType.innerHTML = '<option value="">Select feed type</option>';
  skFeedType.disabled = true;
  if (skSaleType) skSaleType.value = "";
  document.getElementById("skSaveBtn").textContent = "Save sale";
  applyEmployeeSalesDateRules();
  applyEmployeeFeedSalePricingUi();
  applyDefaultSkBagOpened();
}

function resetChickenForm() {
  chickenForm.reset();
  state.editChickenId = null;
  chDateDisplay.value = "";
  if (chSaleType) chSaleType.value = "";
  const chSave = document.getElementById("chSaveBtn");
  if (chSave) chSave.textContent = state.user?.role === "owner" ? "Save inventory" : "Save sale";
  populateChickenBreedSelect();
  applyEmployeeSalesDateRules();
  applyEmployeeFeedSalePricingUi();
  if (state.user?.role === "owner") applyOwnerChickenPricesFromBreed();
  const cn = document.getElementById("chCustomerName");
  const cp = document.getElementById("chCustomerPhone");
  const mp = document.getElementById("chMoneyPaid");
  const ps = document.getElementById("chPaymentStatus");
  if (cn) cn.value = "";
  if (cp) cp.value = "";
  if (mp) mp.value = "0";
  if (ps) ps.value = "pending";
  updateChickenCustomerAmounts();
}

function showPage(page) {
  if (isTerryOrCessTenant() && page !== "rose-inventory") {
    return showPage("rose-inventory");
  }
  if (state.appInstance === "shop" && page !== "inventory" && page !== "sales-bags") {
    return showPage("inventory");
  }
  if (page === "calculator" && state.user?.role !== "owner") {
    return showPage("sales-bags");
  }
  if (page === "balance" && state.user?.role !== "owner") {
    return showPage("sales-bags");
  }
  state.currentPage = page;
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
  document.querySelectorAll(".app-page").forEach((sec) => {
    sec.classList.add("hidden");
  });
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.remove("hidden");
  pageHeading.textContent = PAGE_HEADINGS[page] || "Amana Kuku Feeds";
  if (page === "rose-inventory" && (state.appInstance === "terry" || state.appInstance === "cess")) {
    pageHeading.textContent = "Records";
  }
  if (page === "chicken-inventory" && state.user?.role === "employee") {
    pageHeading.textContent = "Chicken Sales";
  }
  if (page === "feeders-drinkers" && state.user?.role === "employee") {
    pageHeading.textContent = "Feeders and Drinkers";
  }
  if (page === "medicaments" && state.user?.role === "employee") {
    pageHeading.textContent = "Medicaments";
  }
  if (page === "gas" && state.user?.role === "employee") {
    pageHeading.textContent = "Gas Sales";
  }
  if (page === "sales-bags" || page === "sales-kg" || page === "chicken-inventory" || page === "expenditure" || page === "rose-inventory") {
    applyEmployeeSalesDateRules();
    applyEmployeeFeedSalePricingUi();
  }
  if (page === "chicken-inventory") {
    renderChickenSalesHistoryTable();
    updateChickenProfitDisplay();
  }
  if (page === "sales-kg") applyDefaultSkBagOpened();
  if (page === "inventory") {
    renderOwnerPassThroughBagSales();
  }
  if (page === "chicken-inventory") {
    renderOwnerUfarayChickenSales();
  }
  if (page === "feeders-drinkers" || page === "medicaments" || page === "gas") {
    renderOwnerUfarayNewPageSales();
  }
  if (page === "retail-inventory") {
    renderRetailPricingTable();
    renderRetailInventoryTable();
    updateRetailCumulativeProfitDisplay();
  }
  if (page === "feeders-drinkers") renderFeedersDrinkersTable();
  if (page === "medicaments") renderMedicamentsTable();
  if (page === "gas") renderGasTable();
  if (page === "rose-inventory") renderRoseTable();
  if (page === "calculator") renderCalculatorTable();
  if (page === "expenditure") renderExpenditureTable();
  if (page === "balance") updateBalanceBanner();
  updateOwnerCombinedProfitDockVisibility();
  updateOwnerCombinedProfitDisplay();
}

function populateForm(row) {
  const id = Number(row.id);
  state.editId = Number.isFinite(id) ? id : null;
  dateInput.value = toIsoDate(row.date);
  dateDisplayInput.value = formatDateDMY(row.date);
  const brandKey = resolveBrandKey(row.brand);
  brandSelect.value = brandKey;
  populateFeedTypes(brandKey);
  feedTypeSelect.value = feedTypeCatalogValue(brandKey, row.feed_type);
  bagSizeInput.value = row.bag_size;
  quantityInput.value = row.quantity_in_stock;
  document.getElementById("accumulatedBags").value =
    row.accumulated_bags != null ? row.accumulated_bags : row.quantity_in_stock;
  document.getElementById("buyingPrice").value = row.buying_price;
  document.getElementById("sellingPrice").value = row.selling_price;
  document.getElementById("profitMarginPerBag").value = row.profit_margin_per_bag ?? 0;
  document.getElementById("accumulatedProfit").value = row.cumulative_bag_profit ?? 0;
  document.getElementById("reorderLevel").value = row.reorder_level;
  document.getElementById("saveBtn").textContent = "Update Record";
}

function formPayload() {
  const dateValue = dateDisplayInput.value.trim();
  if (!isValidDMY(dateValue)) {
    throw new Error("Date must be in DD/MM/YYYY format.");
  }
  const brandKey = resolveBrandKey(brandSelect.value);
  const dateCanon = formatDateDMY(dateValue).trim();

  return {
    date: dateCanon,
    brand: brandKey,
    feed_type: feedTypeCatalogValue(brandKey, feedTypeSelect.value),
    bag_size: Number(bagSizeInput.value || 0),
    quantity_in_stock: Number(quantityInput.value || 0),
    buying_price: Number(document.getElementById("buyingPrice").value || 0),
    selling_price: Number(document.getElementById("sellingPrice").value || 0),
    profit_margin_per_bag: Number(document.getElementById("profitMarginPerBag").value || 0),
    reorder_level: Number(document.getElementById("reorderLevel").value || 0),
  };
}

async function loadCatalogFromServer() {
  const restrictForTerryCess = (catalog) => {
    if (!(state.appInstance === "terry" || state.appInstance === "cess" || state.appInstance === "shop")) return catalog;
    const sigmaKey = Object.keys(catalog || {}).find((b) => normalizeBrandName(b) === normalizeBrandName("Sigma"));
    if (!sigmaKey) return {};
    const items = (catalog[sigmaKey] || []).filter((i) => {
      const ft = normalizeFeedTypeForMatch(i?.type || "");
      return ft === normalizeFeedTypeForMatch("Starter") || ft === normalizeFeedTypeForMatch("Finisher");
    });
    return { [sigmaKey]: items };
  };
  try {
    const c = await api("/api/catalog");
    return restrictForTerryCess(c);
  } catch {
    const res = await fetch("/feedCatalog.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load feed catalog. Check that the server is running.");
    const c = await res.json();
    return restrictForTerryCess(c);
  }
}

async function loadAllData() {
  state.catalog = await loadCatalogFromServer();

  const mustFillBrandDropdowns =
    !catalogInitialized ||
    brandSelect.options.length <= 1 ||
    sbBrand.options.length <= 1 ||
    skBrand.options.length <= 1 ||
    (rfBrand && rfBrand.options.length <= 1);
  if (mustFillBrandDropdowns && Object.keys(state.catalog || {}).length > 0) {
    populateBrands();
    populateBrandSelect(sbBrand);
    populateBrandSelect(skBrand);
    if (rfBrand) populateBrandSelect(rfBrand);
    catalogInitialized = true;
  }

  const secondary =
    state.user.role === "owner"
      ? [
          api("/api/inventory"),
          api("/api/sales/bags"),
          api("/api/sales/kg"),
          api("/api/chicken-sales"),
          api("/api/chicken-breeds"),
          api("/api/chicken-sales/profit-summary"),
          api("/api/sales/today-profit"),
          api("/api/retail-feed-summary"),
          api("/api/retail-feed-pricing"),
          api("/api/retail/cumulative-kg-profit"),
        ]
      : [
          api("/api/inventory/selling-prices"),
          api("/api/sales/bags"),
          api("/api/sales/kg"),
          api("/api/chicken-sales"),
          api("/api/chicken-breeds"),
          api("/api/sales/today-profit"),
          api("/api/retail-feed-pricing"),
        ];

  const outcomes = await Promise.allSettled(secondary);
  let o = 0;
  if (state.user.role === "owner") {
    state.records = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
    o += 1;
  } else {
    state.records = [];
    state.inventoryPricing = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
    o += 1;
  }
  state.salesBags = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
  o += 1;
  state.salesKg = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
  o += 1;
  state.chickenSales = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
  o += 1;
  state.chickenBreeds = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
  o += 1;
  if (!Array.isArray(state.chickenBreeds) || state.chickenBreeds.length === 0) {
    try {
      const res = await fetch("/chickenBreeds.json", { cache: "no-store" });
      if (res.ok) {
        const names = await res.json();
        if (Array.isArray(names) && names.length) {
          const cleaned = names.map((x) => String(x || "").trim()).filter(Boolean);
          if (cleaned.length) state.chickenBreeds = chickenBreedsRowsFromNames(cleaned);
        }
      }
    } catch (_e) {
      /* keep empty; getChickenBreedsRows() uses DEFAULT_CHICKEN_BREED_NAMES */
    }
  }
  if (state.user.role === "owner") {
    const chProf = outcomes[o].status === "fulfilled" ? outcomes[o].value : {};
    state.chickenProfitSummary = {
      todayProfit: Number(chProf.todayProfit ?? 0),
      cumulativeProfit: Number(chProf.cumulativeProfit ?? 0),
      today: chProf.today || "",
    };
    o += 1;
  } else {
    state.chickenProfitSummary = { todayProfit: 0, cumulativeProfit: 0, today: "" };
  }
  const profitPayload =
    outcomes[o].status === "fulfilled" ? outcomes[o].value : { totalProfit: 0, today: "" };
  state.cumulativeFeedBagProfit = Number(profitPayload.totalProfit ?? 0);
  state.shopToday = profitPayload.today || "";
  o += 1;
  if (state.user.role === "owner") {
    state.retailFeedSummary = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
    o += 1;
    state.retailFeedPricing = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
    o += 1;
    const retailProfitPayload =
      outcomes[o].status === "fulfilled" ? outcomes[o].value : { totalProfit: 0 };
    state.cumulativeRetailKgProfit = Number(retailProfitPayload.totalProfit ?? 0);
  } else {
    state.retailFeedSummary = [];
    state.retailFeedPricing = outcomes[o].status === "fulfilled" ? outcomes[o].value : [];
    state.cumulativeRetailKgProfit = 0;
  }

  const extras = await Promise.allSettled([
    api("/api/feeders-drinkers/catalog"),
    api("/api/feeders-drinkers"),
    api("/api/medicaments/catalog"),
    api("/api/medicaments"),
    api("/api/feeders-drinkers/employee-items"),
    api("/api/feeders-drinkers/sales"),
    api("/api/medicaments/employee-items"),
    api("/api/medicaments/sales"),
    api("/api/gas"),
    api("/api/gas/employee-items"),
    api("/api/gas/sales"),
    api("/api/expenditure"),
    api("/api/rose/inventory"),
  ]);
  state.feedersDrinkersCatalog = extras[0].status === "fulfilled" ? extras[0].value : [];
  state.feedersDrinkersInventory = extras[1].status === "fulfilled" ? extras[1].value : [];
  state.medicamentsCatalog = extras[2].status === "fulfilled" ? extras[2].value : [];
  state.medicamentsInventory = extras[3].status === "fulfilled" ? extras[3].value : [];
  state.feedersDrinkersEmployeeItems = extras[4].status === "fulfilled" ? extras[4].value : [];
  state.feedersDrinkersSales = extras[5].status === "fulfilled" ? extras[5].value : [];
  state.medicamentsEmployeeItems = extras[6].status === "fulfilled" ? extras[6].value : [];
  state.medicamentsSales = extras[7].status === "fulfilled" ? extras[7].value : [];
  state.gasInventory = extras[8].status === "fulfilled" ? extras[8].value : [];
  state.gasEmployeeItems = extras[9].status === "fulfilled" ? extras[9].value : [];
  state.gasSales = extras[10].status === "fulfilled" ? extras[10].value : [];
  state.expenditureEntries = extras[11].status === "fulfilled" ? extras[11].value : [];
  state.roseEntries = extras[12].status === "fulfilled" ? extras[12].value : [];

  updateTodayProfitDisplay();
  updateRetailCumulativeProfitDisplay();
  updateChickenProfitDisplay();
  updateFeedersDrinkersProfitDisplay();
  updateMedicamentsProfitDisplay();
  updateGasProfitDisplay();
  updateOwnerCombinedProfitDisplay();
  updateBalanceBanner();
  populateChickenBreedSelect();
  populateFeedersDrinkersItems();
  populateMedicamentsItems();
  populateGasSizes();
  refreshEmployeeNewPageSellingPrices();
  renderTable();
  renderOwnerPassThroughBagSales();
  renderOwnerUfarayChickenSales();
  renderOwnerUfarayNewPageSales();
  renderSalesBagsTable();
  renderSalesKgTable();
  renderChickenSalesHistoryTable();
  renderRetailPricingTable();
  renderRetailInventoryTable();
  renderFeedersDrinkersTable();
  renderMedicamentsTable();
  renderGasTable();
  renderCalculatorTable();
  renderExpenditureTable();
  renderRoseTable();
  applyEmployeeFeedSalePricingUi();
  if (state.currentPage === "sales-kg") applyDefaultSkBagOpened();
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    if (!state.token) return;
    try {
      await loadAllData();
    } catch (_error) {
      // Ignore transient network errors during background refresh.
    }
  }, 5000);
}

function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

showPasswordCheckbox?.addEventListener("change", () => {
  if (passwordInput) passwordInput.type = showPasswordCheckbox.checked ? "text" : "password";
});
showVehiclePasswordCheckbox?.addEventListener("change", () => {
  if (vehiclePasswordInput) vehiclePasswordInput.type = showVehiclePasswordCheckbox.checked ? "text" : "password";
});

loginForm?.addEventListener("reset", () => {
  if (passwordInput) passwordInput.type = "password";
});
vehicleLoginForm?.addEventListener("reset", () => {
  if (vehiclePasswordInput) vehiclePasswordInput.type = "password";
});

document.getElementById("openAmanaBtn")?.addEventListener("click", () => {
  state.appInstance = "amana";
  persistAppInstance();
  showLoginCard();
});

document.getElementById("openUfarayBtn")?.addEventListener("click", () => {
  state.appInstance = "ufaray";
  persistAppInstance();
  showLoginCard();
});

document.getElementById("openRoseBtn")?.addEventListener("click", () => {
  state.appInstance = "rose";
  persistAppInstance();
  showLoginCard();
});

document.getElementById("openNahahBtn")?.addEventListener("click", () => {
  state.appInstance = "nahah";
  persistAppInstance();
  showNahahDashboardCard();
});
document.getElementById("openTerryBtn")?.addEventListener("click", () => {
  state.appInstance = "terry";
  persistAppInstance();
  showLoginCard();
});
document.getElementById("openCessBtn")?.addEventListener("click", () => {
  state.appInstance = "cess";
  persistAppInstance();
  showLoginCard();
});
document.getElementById("openShopBtn")?.addEventListener("click", () => {
  state.appInstance = "shop";
  persistAppInstance();
  showLoginCard();
});
document.getElementById("backToDashboardFromNahahBtn")?.addEventListener("click", () => {
  showLoggedOut();
});

document.getElementById("openVehicleBtn")?.addEventListener("click", () => {
  showVehicleLoginCard();
});

document.getElementById("backToDashboardBtn")?.addEventListener("click", () => {
  loginForm.reset();
  showLoggedOut();
});
document.getElementById("backToDashboardFromVehicleBtn")?.addEventListener("click", () => {
  vehicleLoginForm?.reset();
  showLoggedOut();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = passwordInput?.value ?? "";
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    state.token = String(result.token || "").trim();
    state.user = result.user;
    persistAuth();
    showLoggedIn();
    showPage(
      isTerryOrCessTenant()
        ? "rose-inventory"
        : state.appInstance === "shop"
          ? "inventory"
        : isRecordsTenant()
          ? "rose-inventory"
          : state.user.role === "owner"
            ? "inventory"
            : "sales-bags"
    );
    await loadAllData();
    applyEmployeeSalesDateRules();
    applyEmployeeFeedSalePricingUi();
    startAutoRefresh();
    loginForm.reset();
  } catch (error) {
    alert(error.message);
  }
});

vehicleLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("vehicleUsername").value.trim();
  const password = vehiclePasswordInput?.value ?? "";
  try {
    const response = await fetch("/api/vehicle/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not login to vehicle inventory.");
    state.vehicleToken = String(body.token || "").trim();
    state.vehicleUser = body.user;
    persistVehicleAuth();
    showVehicleLoggedIn();
    await loadVehicleKaxData();
    vehicleLoginForm.reset();
  } catch (error) {
    alert(error.message);
  }
});

if (vehicleKaxDateDisplay && vehicleKaxDate && vehicleKaxOpenCalendarBtn) {
  wireDatePicker(vehicleKaxDateDisplay, vehicleKaxDate, vehicleKaxOpenCalendarBtn);
}

vehicleKaxForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = vehicleKaxDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = {
    date: dateValue,
    description: document.getElementById("vehicleKaxDescription")?.value.trim(),
    money_in: Number(document.getElementById("vehicleKaxMoneyIn")?.value || 0),
    money_out: Number(document.getElementById("vehicleKaxMoneyOut")?.value || 0),
  };
  try {
    if (state.editVehicleKaxId) {
      await vehicleApi(`/api/vehicle/kax/${state.editVehicleKaxId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await vehicleApi("/api/vehicle/kax", { method: "POST", body: JSON.stringify(payload) });
    }
    resetVehicleKaxForm();
    await loadVehicleKaxData();
  } catch (error) {
    alert(error.message);
  }
});

function resetVehicleKaxForm() {
  if (!vehicleKaxForm) return;
  vehicleKaxForm.reset();
  state.editVehicleKaxId = null;
  if (vehicleKaxDateDisplay) vehicleKaxDateDisplay.value = "";
  const inEl = document.getElementById("vehicleKaxMoneyIn");
  const outEl = document.getElementById("vehicleKaxMoneyOut");
  if (inEl) inEl.value = "0";
  if (outEl) outEl.value = "0";
  const saveBtn = vehicleKaxForm.querySelector('button[type="submit"]');
  if (saveBtn) saveBtn.textContent = "Save entry";
}

vehicleKaxClearBtn?.addEventListener("click", () => {
  resetVehicleKaxForm();
});

vehicleKaxBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (!id || !action || target.dataset.kind !== "vehicle-kax") return;
  const row = state.vehicleKaxEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editVehicleKaxId = row.id;
    if (vehicleKaxDateDisplay) vehicleKaxDateDisplay.value = formatDateDMY(row.date);
    if (vehicleKaxDate) vehicleKaxDate.value = toIsoDate(row.date);
    const d = document.getElementById("vehicleKaxDescription");
    const i = document.getElementById("vehicleKaxMoneyIn");
    const o = document.getElementById("vehicleKaxMoneyOut");
    if (d) d.value = row.description || "";
    if (i) i.value = row.money_in ?? 0;
    if (o) o.value = row.money_out ?? 0;
    const saveBtn = vehicleKaxForm?.querySelector('button[type="submit"]');
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this KAX entry?")) return;
    try {
      await vehicleApi(`/api/vehicle/kax/${id}`, { method: "DELETE" });
      await loadVehicleKaxData();
      if (state.editVehicleKaxId && String(state.editVehicleKaxId) === String(id)) {
        resetVehicleKaxForm();
      }
    } catch (error) {
      alert(error.message);
    }
  }
});

logoutBtn.addEventListener("click", () => {
  clearAuth();
  stopAutoRefresh();
  showLoggedOut();
});
vehicleLogoutBtn?.addEventListener("click", () => {
  clearVehicleAuth();
  showLoggedOut();
});

brandSelect.addEventListener("change", () => {
  populateFeedTypes(brandSelect.value);
});

feedTypeSelect.addEventListener("change", () => {
  bagSizeInput.value = bagSizeFor(brandSelect.value, feedTypeSelect.value);
});

openCalendarBtn.addEventListener("click", () => {
  if (dateDisplayInput.value.trim()) {
    dateInput.value = toIsoDate(dateDisplayInput.value.trim());
  }
  if (typeof dateInput.showPicker === "function") {
    dateInput.showPicker();
    return;
  }
  dateInput.focus();
});
dateInput.addEventListener("change", () => {
  dateDisplayInput.value = formatDateDMY(dateInput.value);
});
dateDisplayInput.addEventListener("input", () => {
  const text = dateDisplayInput.value.trim();
  if (isValidDMY(text)) {
    dateInput.value = toIsoDate(text);
  }
});

clearBtn.addEventListener("click", resetForm);
refreshBtn.addEventListener("click", async () => {
  await loadAllData();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = formPayload();
    const editId = state.editId != null ? Number(state.editId) : null;
    if (editId != null && Number.isFinite(editId) && editId > 0) {
      await api(`/api/inventory/${editId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/inventory", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

tableBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (!id || !action) return;

  const row = state.records.find((r) => String(r.id) === String(id));
  if (!row) return;

  if (action === "edit") {
    populateForm(row);
    return;
  }

  if (action === "delete") {
    if (!window.confirm("Delete this record?")) return;
    try {
      await api(`/api/inventory/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

async function boot() {
  if (state.vehicleToken && state.vehicleUser) {
    showVehicleLoggedIn();
    await loadVehicleKaxData();
    return;
  }
  if (!state.token || !state.user) {
    stopAutoRefresh();
    showLoggedOut();
    return;
  }
  try {
    showLoggedIn();
    showPage(
      isTerryOrCessTenant()
        ? "rose-inventory"
        : state.appInstance === "shop"
          ? "inventory"
        : isRecordsTenant()
          ? "rose-inventory"
          : state.user.role === "owner"
            ? "inventory"
            : "sales-bags"
    );
    await loadAllData();
    applyEmployeeSalesDateRules();
    applyEmployeeFeedSalePricingUi();
    startAutoRefresh();
  } catch (_error) {
    stopAutoRefresh();
    clearAuth();
    showLoggedOut();
  }
}

document.querySelectorAll(".nav-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (state.user.role === "owner" && !OWNER_ALLOWED_PAGES.has(page)) return;
    if (state.user.role !== "owner" && OWNER_INVENTORY_PAGES.has(page)) return;
    showPage(page);
  });
});

sbBrand.addEventListener("change", () => {
  populateSbFeedTypes(sbBrand.value);
  document.getElementById("sbPricePerBag").value = "";
  applyEmployeeFeedSalePricingUi();
});
sbFeedType.addEventListener("change", () => {
  sbBagSize.value = bagSizeFor(sbBrand.value, sbFeedType.value);
  applyEmployeeFeedSalePricingUi();
});
document.getElementById("sbSaleType")?.addEventListener("change", () => {
  applyEmployeeFeedSalePricingUi();
});
wireDatePicker(sbDateDisplay, sbDate, sbOpenCalendarBtn);

skBrand.addEventListener("change", () => {
  populateSkFeedTypes(skBrand.value);
  document.getElementById("skPricePerKg").value = "";
  applyEmployeeSalesKgPriceFromInventory();
  applyDefaultSkBagOpened();
});
skFeedType.addEventListener("change", () => {
  applyEmployeeSalesKgPriceFromInventory();
  applyDefaultSkBagOpened();
});
skDateDisplay.addEventListener("input", () => {
  const t = skDateDisplay.value.trim();
  if (isValidDMY(t)) applyDefaultSkBagOpened();
});
skDate.addEventListener("change", () => applyDefaultSkBagOpened());
wireDatePicker(skDateDisplay, skDate, skOpenCalendarBtn);

wireDatePicker(chDateDisplay, chDate, chOpenCalendarBtn);
if (fdDateDisplay && fdDate && fdOpenCalendarBtn) wireDatePicker(fdDateDisplay, fdDate, fdOpenCalendarBtn);
if (medDateDisplay && medDate && medOpenCalendarBtn) wireDatePicker(medDateDisplay, medDate, medOpenCalendarBtn);
if (gasDateDisplay && gasDate && gasOpenCalendarBtn) wireDatePicker(gasDateDisplay, gasDate, gasOpenCalendarBtn);
if (expDateDisplay && expDate && expOpenCalendarBtn) wireDatePicker(expDateDisplay, expDate, expOpenCalendarBtn);
if (roseDateDisplay && roseDate && roseOpenCalendarBtn) wireDatePicker(roseDateDisplay, roseDate, roseOpenCalendarBtn);
fdItem?.addEventListener("change", refreshEmployeeNewPageSellingPrices);
medItem?.addEventListener("change", refreshEmployeeNewPageSellingPrices);
gasSize?.addEventListener("change", refreshEmployeeNewPageSellingPrices);

document.getElementById("expMoneyOut")?.addEventListener("input", () => {
  const totalEl = document.getElementById("expTotal");
  const outEl = document.getElementById("expMoneyOut");
  if (!totalEl || !outEl) return;
  if (state.editExpenditureId) return;
  const t = totalEl.value.trim();
  if (t === "" || Number(t) === 0) totalEl.value = outEl.value;
});
calcBody?.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.kind !== "calc-bags" && target.dataset.kind !== "calc-buying") return;
  calculatorRememberRowFromInputs(target.closest("tr"));
  updateCalculatorGrandTotalDisplay();
});
document.getElementById("calcClearBtn")?.addEventListener("click", () => {
  if (!calcBody) return;
  state.calculatorValues = {};
  calcBody.querySelectorAll("input[data-kind='calc-bags'], input[data-kind='calc-buying']").forEach((el) => {
    if (el instanceof HTMLInputElement) el.value = "";
  });
  updateCalculatorGrandTotalDisplay();
});

function downloadCalculatorPdf() {
  if (!calcBody) return;
  const jsPdfNs = window.jspdf;
  const JsPdfCtor = jsPdfNs?.jsPDF;
  if (typeof JsPdfCtor !== "function") {
    alert("PDF generator is not loaded. Refresh and try again.");
    return;
  }
  const filledRows = [];
  calcBody.querySelectorAll("tr").forEach((tr) => {
    if (!(tr instanceof HTMLTableRowElement)) return;
    const cells = tr.querySelectorAll("td");
    if (cells.length < 6) return;
    const bagsEl = tr.querySelector("input[data-kind='calc-bags']");
    const buyEl = tr.querySelector("input[data-kind='calc-buying']");
    const totalCell = tr.querySelector(".js-calc-row-total");
    if (!(bagsEl instanceof HTMLInputElement) || !(buyEl instanceof HTMLInputElement) || !(totalCell instanceof HTMLElement)) return;
    const bagsRaw = String(bagsEl.value || "").trim();
    const bagsNum = Number(bagsRaw);
    if (!bagsRaw || !Number.isFinite(bagsNum) || bagsNum <= 0) return;
    filledRows.push({
      brand: cells[0]?.textContent?.trim() || "—",
      feedType: cells[1]?.textContent?.trim() || "—",
      bagSize: cells[2]?.textContent?.trim() || "—",
      bags: bagsRaw,
      buying: String(buyEl.value || "").trim() || "—",
      total: totalCell.textContent?.trim() || "—",
    });
  });
  if (!filledRows.length) {
    alert("Enter at least one calculator row with number of bags before downloading.");
    return;
  }
  const today = state.shopToday || clientShopTodayDMY();
  const grand = filledRows.reduce((s, r) => s + (Number(String(r.total).replace(/[^0-9.-]/g, "")) || 0), 0);

  const doc = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Amana kuku feeds", 40, 42);
  doc.setFontSize(13);
  doc.text("Calculator", 40, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Date: ${today}`, 40, 84);

  const head = [["Brand", "Feed Type", "Bag Size (kg)", "Number of bags", "Buying price (per bag)", "Total"]];
  const body = filledRows.map((r) => [r.brand, r.feedType, r.bagSize, r.bags, r.buying, r.total]);

  const autoTableFn = doc.autoTable || jsPdfNs?.autoTable;
  if (typeof autoTableFn !== "function") {
    alert("PDF table helper is not loaded. Refresh and try again.");
    return;
  }
  autoTableFn.call(doc, {
    head,
    body,
    startY: 98,
    styles: { font: "helvetica", fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [240, 240, 240], textColor: [20, 20, 20] },
  });

  const finalY = doc.lastAutoTable?.finalY || 98;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Grand total: ${currency(grand)}`, 40, finalY + 24);

  const fileDate = today.replace(/\//g, "-");
  doc.save(`amana-kuku-feeds-calculator-${fileDate}.pdf`);
}

document.getElementById("calcDownloadBtn")?.addEventListener("click", downloadCalculatorPdf);

document.getElementById("chBreed")?.addEventListener("change", () => {
  if (state.user?.role === "employee") {
    applyEmployeeChickenPriceFromBreeds();
    updateChickenCustomerAmounts();
  } else applyOwnerChickenPricesFromBreed();
});

document.getElementById("chQuantity")?.addEventListener("input", updateChickenCustomerAmounts);
document.getElementById("chMoneyPaid")?.addEventListener("input", updateChickenCustomerAmounts);
document.getElementById("chPaymentStatus")?.addEventListener("change", onChickenPaymentStatusChange);

document.getElementById("chBuyingPrice")?.addEventListener("input", () => {
  syncOwnerChickenMarginFromBuySell();
});

document.getElementById("chSellingPrice")?.addEventListener("input", () => {
  syncOwnerChickenMarginFromBuySell();
});

document.getElementById("chProfitMarginPerChick")?.addEventListener("input", () => {
  syncOwnerChickenSellFromBuyMargin();
});

document.getElementById("sbClearBtn").addEventListener("click", resetSalesBagForm);
document.getElementById("skClearBtn").addEventListener("click", resetSalesKgForm);
document.getElementById("chClearBtn").addEventListener("click", resetChickenForm);
document.getElementById("fdClearBtn")?.addEventListener("click", resetFeedersDrinkersForm);
document.getElementById("medClearBtn")?.addEventListener("click", resetMedicamentsForm);
document.getElementById("gasClearBtn")?.addEventListener("click", resetGasForm);
document.getElementById("expClearBtn")?.addEventListener("click", resetExpenditureForm);
document.getElementById("roseClearBtn")?.addEventListener("click", resetRoseForm);

fdForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = fdDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  if (state.user?.role === "employee") {
    const payloadSale = {
      date: dateValue,
      item_name: fdItem.value,
      quantity_sold: Number(document.getElementById("fdQuantity")?.value || 0),
      through_party: String(fdSaleType?.value || "").trim() || null,
    };
    try {
      if (state.editFeedersDrinkersId) {
        await api(`/api/feeders-drinkers/sales/${state.editFeedersDrinkersId}`, { method: "PUT", body: JSON.stringify(payloadSale) });
      } else {
        await api("/api/feeders-drinkers/sales", { method: "POST", body: JSON.stringify(payloadSale) });
      }
      resetFeedersDrinkersForm();
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
    return;
  }
  const payload = {
    date: dateValue,
    item_name: fdItem.value,
    quantity_in_stock: Number(document.getElementById("fdQuantity")?.value || 0),
    buying_price: Number(document.getElementById("fdBuyingPrice")?.value || 0),
    selling_price: Number(document.getElementById("fdSellingPrice")?.value || 0),
    profit_margin: Number(document.getElementById("fdProfitMargin")?.value || 0),
    reorder_level: Number(document.getElementById("fdReorderLevel")?.value || 0),
  };
  try {
    if (state.editFeedersDrinkersId) {
      await api(`/api/feeders-drinkers/${state.editFeedersDrinkersId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/feeders-drinkers", { method: "POST", body: JSON.stringify(payload) });
    }
    resetFeedersDrinkersForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

medForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = medDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  if (state.user?.role === "employee") {
    const payloadSale = {
      date: dateValue,
      item_name: medItem.value,
      quantity_sold: Number(document.getElementById("medQuantity")?.value || 0),
      through_party: String(medSaleType?.value || "").trim() || null,
    };
    try {
      if (state.editMedicamentId) {
        await api(`/api/medicaments/sales/${state.editMedicamentId}`, { method: "PUT", body: JSON.stringify(payloadSale) });
      } else {
        await api("/api/medicaments/sales", { method: "POST", body: JSON.stringify(payloadSale) });
      }
      resetMedicamentsForm();
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
    return;
  }
  const payload = {
    date: dateValue,
    item_name: medItem.value,
    quantity_in_stock: Number(document.getElementById("medQuantity")?.value || 0),
    buying_price: Number(document.getElementById("medBuyingPrice")?.value || 0),
    selling_price: Number(document.getElementById("medSellingPrice")?.value || 0),
    profit_margin: Number(document.getElementById("medProfitMargin")?.value || 0),
    reorder_level: Number(document.getElementById("medReorderLevel")?.value || 0),
  };
  try {
    if (state.editMedicamentId) {
      await api(`/api/medicaments/${state.editMedicamentId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/medicaments", { method: "POST", body: JSON.stringify(payload) });
    }
    resetMedicamentsForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

gasForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = gasDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  if (state.user?.role === "employee") {
    if (!gasSize?.value) return alert("Select a cylinder size.");
    const payloadSale = {
      date: dateValue,
      size_kg: Number(gasSize.value),
      quantity_sold: Number(document.getElementById("gasQuantity")?.value || 0),
      through_party: String(gasSaleType?.value || "").trim() || null,
    };
    try {
      if (state.editGasId) {
        await api(`/api/gas/sales/${state.editGasId}`, { method: "PUT", body: JSON.stringify(payloadSale) });
      } else {
        await api("/api/gas/sales", { method: "POST", body: JSON.stringify(payloadSale) });
      }
      resetGasForm();
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
    return;
  }
  const sizeKg = Number(gasSizeKg?.value || 0);
  if (!Number.isFinite(sizeKg) || sizeKg <= 0) return alert("Select cylinder size: 6 kg or 12 kg.");
  const payload = {
    date: dateValue,
    size_kg: sizeKg,
    quantity_in_stock: Number(document.getElementById("gasQuantity")?.value || 0),
    buying_price: Number(document.getElementById("gasBuyingPrice")?.value || 0),
    selling_price: Number(document.getElementById("gasSellingPrice")?.value || 0),
    profit_margin: Number(document.getElementById("gasProfitMargin")?.value || 0),
    reorder_level: Number(document.getElementById("gasReorderLevel")?.value || 0),
  };
  try {
    if (state.editGasId) {
      await api(`/api/gas/${state.editGasId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/gas", { method: "POST", body: JSON.stringify(payload) });
    }
    resetGasForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

expenditureForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = expDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = {
    date: dateValue,
    description: String(document.getElementById("expDescription")?.value || "").trim(),
    money_out: Number(document.getElementById("expMoneyOut")?.value || 0),
    total: Number(document.getElementById("expTotal")?.value || 0),
  };
  try {
    if (state.editExpenditureId) {
      await api(`/api/expenditure/${state.editExpenditureId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/expenditure", { method: "POST", body: JSON.stringify(payload) });
    }
    resetExpenditureForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

roseForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = roseDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = {
    date: dateValue,
    description: String(document.getElementById("roseDescription")?.value || "").trim(),
    quantity: Number(document.getElementById("roseQuantity")?.value || 0),
    unit_price: Number(document.getElementById("roseUnitPrice")?.value || 0),
    money_in: Number(document.getElementById("roseMoneyIn")?.value || 0),
    money_out: Number(document.getElementById("roseMoneyOut")?.value || 0),
    mortality: Number(document.getElementById("roseMortality")?.value || 0),
    sale_via: String(document.getElementById("roseSaleVia")?.value || "Shop").trim(),
  };
  try {
    if (state.editRoseId) {
      await api(`/api/rose/inventory/${state.editRoseId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/rose/inventory", { method: "POST", body: JSON.stringify(payload) });
    }
    resetRoseForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

salesBagsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = sbDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) {
    alert("Date must be in DD/MM/YYYY format.");
    return;
  }
  const saleTypeVal = normalizeSaleVia(document.getElementById("sbSaleType")?.value || "");
  const payload = {
    date: dateValue,
    brand: sbBrand.value,
    feed_type: sbFeedType.value,
    bag_size: Number(sbBagSize.value || 0),
    bags_sold: Number(document.getElementById("sbBagsSold").value || 0),
    price_per_bag: Number(document.getElementById("sbPricePerBag").value || 0),
    through_party: saleTypeVal || null,
  };
  const saveBtn = document.getElementById("sbSaveBtn");
  saveBtn.disabled = true;
  try {
    if (state.editSalesBagId) {
      await api(`/api/sales/bags/${state.editSalesBagId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/sales/bags", { method: "POST", body: JSON.stringify(payload) });
    }
    resetSalesBagForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  } finally {
    saveBtn.disabled = false;
  }
});

salesKgForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = skDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) {
    alert("Date must be in DD/MM/YYYY format.");
    return;
  }
  const payload = {
    date: dateValue,
    brand: resolveBrandKey(skBrand.value),
    feed_type: skFeedType.value,
    bag_opened: Number(document.getElementById("skBagOpened").value || 0),
    kg_sold: Number(document.getElementById("skKgSold").value || 0),
    price_per_kg: Number(document.getElementById("skPricePerKg").value || 0),
    through_party: String(skSaleType?.value || "").trim() || null,
  };
  const saveBtn = document.getElementById("skSaveBtn");
  saveBtn.disabled = true;
  let result = null;
  const wasEdit = Boolean(state.editSalesKgId);
  try {
    if (wasEdit) {
      await api(`/api/sales/kg/${state.editSalesKgId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      result = await api("/api/sales/kg", { method: "POST", body: JSON.stringify(payload) });
    }
    // Save already succeeded; from this point forward show refresh-specific errors only.
    try {
      await loadAllData();
    } catch (_error) {
      alert("Sale saved, but refreshing the page data failed. Please click Refresh.");
    }

    if (wasEdit) {
      resetSalesKgForm();
    } else if (state.user.role === "employee" && result?.merged) {
      skDateDisplay.value = dateValue;
      skDate.value = toIsoDate(dateValue);
      document.getElementById("skKgSold").value = "";
      applyDefaultSkBagOpened();
      applyEmployeeFeedSalePricingUi();
      state.editSalesKgId = null;
      document.getElementById("skSaveBtn").textContent = "Save sale";
    } else {
      resetSalesKgForm();
    }
  } catch (error) {
    alert(error.message);
  } finally {
    saveBtn.disabled = false;
  }
});

chickenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = chDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) {
    alert("Date must be in DD/MM/YYYY format.");
    return;
  }
  const qty = Number(document.getElementById("chQuantity").value || 0);
  if (!Number.isFinite(qty) || qty < 50) {
    alert("Quantity must be at least 50 chicks.");
    return;
  }
  const breed = document.getElementById("chBreed").value.trim();
  if (!breed) {
    alert("Select a breed.");
    return;
  }
  const payload = {
    date: dateValue,
    breed,
    description: document.getElementById("chDescription").value.trim(),
    quantity_birds: qty,
    weight_kg: null,
    through_party: String(chSaleType?.value || "").trim() || null,
  };
  const PRICE_MATCH_CH = 0.015;
  if (state.user.role === "owner") {
    const buy = Number(document.getElementById("chBuyingPrice")?.value);
    const sell = Number(document.getElementById("chSellingPrice")?.value);
    const pm = Number(document.getElementById("chProfitMarginPerChick")?.value);
    if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy < 0 || sell < 0) {
      alert("Enter buying and selling price per chick.");
      return;
    }
    if (!Number.isFinite(pm) || pm < 0) {
      alert("Enter profit margin per chick.");
      return;
    }
    if (Math.abs(pm - (sell - buy)) > PRICE_MATCH_CH) {
      alert("Profit margin must equal selling price minus buying price.");
      return;
    }
    payload.buying_price = buy;
    payload.selling_price = sell;
    payload.profit_margin_per_chick = pm;
    payload.unit_price = sell;
  } else {
    const unitPriceNum = Number(document.getElementById("chUnitPrice")?.value || 0);
    if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) {
      alert("Price per chick is required.");
      return;
    }
    payload.unit_price = unitPriceNum;
  }
  if (state.user.role === "employee") {
    const unitForLine = Number(payload.unit_price);
    const lineTotal = qty * unitForLine;
    const moneyPaid = Number(document.getElementById("chMoneyPaid")?.value || 0);
    const payStatus = document.getElementById("chPaymentStatus")?.value === "delivered" ? "delivered" : "pending";
    if (payStatus === "delivered" && moneyPaid + 0.005 < lineTotal) {
      alert("When Payments is Delivered, money paid must cover the sale total.");
      return;
    }
    payload.customer_name = document.getElementById("chCustomerName")?.value.trim() ?? "";
    payload.customer_phone = document.getElementById("chCustomerPhone")?.value.trim() ?? "";
    payload.money_paid = Number.isFinite(moneyPaid) && moneyPaid >= 0 ? moneyPaid : 0;
    payload.payment_status = payStatus;
  }
  const saveBtn = document.getElementById("chSaveBtn");
  saveBtn.disabled = true;
  try {
    if (state.editChickenId) {
      await api(`/api/chicken-sales/${state.editChickenId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/chicken-sales", { method: "POST", body: JSON.stringify(payload) });
    }
    resetChickenForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  } finally {
    saveBtn.disabled = false;
  }
});

salesBagsBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (!id || !action || target.dataset.kind !== "bags") return;
  const row = state.salesBags.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (state.user.role === "employee" && action === "edit" && !employeeBagSaleEditAllowed(row)) {
    alert("You can only edit your own bag sales within 4 hours of when they were recorded.");
    return;
  }
  if (state.user.role === "employee" && action === "delete" && !employeeBagSaleDeleteAllowed(row)) {
    alert("You can only delete your own bag sales.");
    return;
  }
  if (action === "edit") {
    state.editSalesBagId = row.id;
    sbDate.value = toIsoDate(row.date);
    sbDateDisplay.value = formatDateDMY(row.date);
    sbBrand.value = row.brand;
    populateSbFeedTypes(row.brand);
    sbFeedType.value = row.feed_type;
    sbBagSize.value = row.bag_size;
    document.getElementById("sbBagsSold").value = row.bags_sold;
    const st = document.getElementById("sbSaleType");
    const tp = normalizeSaleVia(row.through_party);
    if (st) {
      fillBagSaleViaSelect(st, tp || (state.appInstance === "shop" ? "Shop" : ""));
    }
    applyEmployeeFeedSalePricingUi();
    document.getElementById("sbPricePerBag").value = row.price_per_bag;
    document.getElementById("sbSaveBtn").textContent = "Update sale";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this sale?")) return;
    try {
      await api(`/api/sales/bags/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

document.getElementById("ufaray-bag-sales-body")?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.kind === "ufaray-via-save") {
    const id = Number(target.dataset.id);
    if (!Number.isFinite(id) || id < 1) return;
    const tr = target.closest("tr");
    if (!(tr instanceof HTMLTableRowElement)) return;
    const viaSel = tr.querySelector("select[data-kind='ufaray-via']");
    if (!(viaSel instanceof HTMLSelectElement)) return;
    target.setAttribute("disabled", "disabled");
    try {
      await api(`/api/sales/bags/${id}/through-party`, {
        method: "PUT",
        body: JSON.stringify({ through_party: normalizeSaleVia(viaSel.value) }),
      });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    } finally {
      target.removeAttribute("disabled");
    }
    return;
  }
  if (target.dataset.kind !== "ufaray-status-save") return;
  const id = Number(target.dataset.id);
  if (!Number.isFinite(id) || id < 1) return;
  const row = state.salesBags.find((r) => Number(r.id) === id);
  if (!row) return;
  const tr = target.closest("tr");
  if (!(tr instanceof HTMLTableRowElement)) return;
  const sel = tr.querySelector("select[data-kind='ufaray-status']");
  if (!(sel instanceof HTMLSelectElement)) return;
  const status = sel.value === "solved" ? "solved" : "pending";
  target.setAttribute("disabled", "disabled");
  try {
    await api(`/api/sales/bags/${id}/pass-through-status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    await loadAllData();
  } catch (error) {
    alert(error.message);
  } finally {
    target.removeAttribute("disabled");
  }
});

function wireOwnerUfarayExtraTable(tableId, statusKind, statusSaveKind, saleKind, statusEndpointBase, saleEndpointBase) {
  document.getElementById(tableId)?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = Number(target.dataset.id);
    if (!Number.isFinite(id) || id < 1) return;
    if (target.dataset.kind === statusSaveKind) {
      const tr = target.closest("tr");
      if (!(tr instanceof HTMLTableRowElement)) return;
      const sel = tr.querySelector(`select[data-kind='${statusKind}']`);
      if (!(sel instanceof HTMLSelectElement)) return;
      const status = sel.value === "solved" ? "solved" : "pending";
      target.setAttribute("disabled", "disabled");
      try {
        await api(`${statusEndpointBase}/${id}/pass-through-status`, {
          method: "PUT",
          body: JSON.stringify({ status }),
        });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      } finally {
        target.removeAttribute("disabled");
      }
      return;
    }
    if (target.dataset.kind !== saleKind) return;
    const action = target.dataset.action;
    if (action === "delete") {
      if (!window.confirm("Delete this pass-through sale?")) return;
      try {
        await api(`${saleEndpointBase}/${id}`, { method: "DELETE" });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      }
      return;
    }
    if (action === "edit") {
      const qtyInput = window.prompt("Enter updated quantity sold", "");
      if (qtyInput == null) return;
      const qty = Math.floor(Number(qtyInput));
      if (!Number.isFinite(qty) || qty < 1) {
        alert("Quantity must be at least 1.");
        return;
      }
      let row = null;
      if (saleKind === "ufaray-fd-sale") row = state.feedersDrinkersSales.find((r) => Number(r.id) === id);
      if (saleKind === "ufaray-med-sale") row = state.medicamentsSales.find((r) => Number(r.id) === id);
      if (saleKind === "ufaray-gas-sale") row = state.gasSales.find((r) => Number(r.id) === id);
      if (!row) return;
      const payload = {
        date: row.date,
        through_party: row.through_party,
        pass_through_status: row.pass_through_status || "pending",
      };
      if (saleKind === "ufaray-fd-sale") {
        payload.item_name = row.item_name;
        payload.quantity_sold = qty;
      } else if (saleKind === "ufaray-med-sale") {
        payload.item_name = row.item_name;
        payload.quantity_sold = qty;
      } else {
        payload.size_kg = row.size_kg;
        payload.quantity_sold = qty;
      }
      try {
        await api(`${saleEndpointBase}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      }
    }
  });
}

wireOwnerUfarayExtraTable(
  "ufaray-fd-sales-body",
  "ufaray-fd-status",
  "ufaray-fd-status-save",
  "ufaray-fd-sale",
  "/api/feeders-drinkers/sales",
  "/api/feeders-drinkers/sales"
);
wireOwnerUfarayExtraTable(
  "ufaray-med-sales-body",
  "ufaray-med-status",
  "ufaray-med-status-save",
  "ufaray-med-sale",
  "/api/medicaments/sales",
  "/api/medicaments/sales"
);
wireOwnerUfarayExtraTable(
  "ufaray-gas-sales-body",
  "ufaray-gas-status",
  "ufaray-gas-status-save",
  "ufaray-gas-sale",
  "/api/gas/sales",
  "/api/gas/sales"
);

document.getElementById("ufaray-chicken-sales-body")?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = Number(target.dataset.id);
  if (!Number.isFinite(id) || id < 1) return;
  if (target.dataset.kind === "ufaray-ch-status-save") {
    const tr = target.closest("tr");
    if (!(tr instanceof HTMLTableRowElement)) return;
    const sel = tr.querySelector("select[data-kind='ufaray-ch-status']");
    if (!(sel instanceof HTMLSelectElement)) return;
    const status = sel.value === "solved" ? "solved" : "pending";
    target.setAttribute("disabled", "disabled");
    try {
      await api(`/api/chicken-sales/${id}/pass-through-status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    } finally {
      target.removeAttribute("disabled");
    }
    return;
  }
  if (target.dataset.kind !== "ufaray-ch-sale") return;
  const row = state.chickenSales.find((r) => Number(r.id) === id);
  if (!row) return;
  const action = target.dataset.action;
  if (action === "delete") {
    if (!window.confirm("Delete this Ufaray chicken sale?")) return;
    try {
      await api(`/api/chicken-sales/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
    return;
  }
  if (action === "edit") {
    const qtyInput = window.prompt("Enter updated number of chicks", String(Number(row.quantity_birds) || 0));
    if (qtyInput == null) return;
    const qty = Math.floor(Number(qtyInput));
    if (!Number.isFinite(qty) || qty < 50) {
      alert("Number of chicks must be at least 50.");
      return;
    }
    const payload = {
      date: row.date,
      breed: row.breed,
      description: row.description || "",
      quantity_birds: qty,
      weight_kg: row.weight_kg ?? null,
      unit_price: Number(row.unit_price) || 0,
      through_party: row.through_party,
      customer_name: row.customer_name || "",
      customer_phone: row.customer_phone || "",
      money_paid: Number(row.money_paid) || 0,
      payment_status:
        String(row.payment_status || "").toLowerCase() === "delivered" ? "delivered" : "pending",
      pass_through_status: String(row.pass_through_status || "pending").toLowerCase() === "solved" ? "solved" : "pending",
    };
    try {
      await api(`/api/chicken-sales/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

salesKgBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (!id || !action || target.dataset.kind !== "kg") return;
  const row = state.salesKg.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editSalesKgId = row.id;
    skDate.value = toIsoDate(row.date);
    skDateDisplay.value = formatDateDMY(row.date);
    skBrand.value = row.brand;
    populateSkFeedTypes(row.brand);
    skFeedType.value = row.feed_type;
    document.getElementById("skBagOpened").value = row.bag_opened != null ? row.bag_opened : 0;
    document.getElementById("skKgSold").value = row.kg_sold;
    if (skSaleType) skSaleType.value = String(row.through_party || "").trim();
    if (state.user.role === "employee") applyEmployeeSalesKgPriceFromInventory();
    else document.getElementById("skPricePerKg").value = row.price_per_kg;
    document.getElementById("skSaveBtn").textContent = "Update sale";
    return;
  }
  if (action === "delete") {
    if (state.user.role === "employee" && !employeeKgSaleDeleteAllowed(row)) {
      alert("You can only delete your own kg sales within 4 hours of when they were recorded.");
      return;
    }
    if (!window.confirm("Delete this sale?")) return;
    try {
      await api(`/api/sales/kg/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

function wireChickenTableClicks(tbody) {
  if (!tbody) return;
  tbody.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.kind === "chicken-pay-save" && state.user.role === "owner") {
      const idNum = Number(target.dataset.id);
      if (!Number.isFinite(idNum) || idNum < 1) return;
      const row = state.chickenSales.find((r) => Number(r.id) === idNum);
      if (!row || isChickenRowOwnerInventory(row)) return;
      const tr = target.closest("tr");
      if (!(tr instanceof HTMLTableRowElement)) return;
      const sel = tr.querySelector(`select[data-kind="chicken-pay-status"][data-id="${idNum}"]`);
      if (!(sel instanceof HTMLSelectElement)) return;
      const nextStatus = sel.value === "delivered" ? "delivered" : "pending";
      target.setAttribute("disabled", "disabled");
      try {
        await api(`/api/chicken-sales/${idNum}/payment-status`, {
          method: "PUT",
          body: JSON.stringify({ payment_status: nextStatus }),
        });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      } finally {
        target.removeAttribute("disabled");
      }
      return;
    }
    if (state.user.role === "owner" && !target.closest("button")) {
      const tr = target.closest("tr[data-chicken-row-id]");
      if (tr) {
        const rid = tr.dataset.chickenRowId;
        const row = state.chickenSales.find((r) => String(r.id) === String(rid));
        if (row) {
          fillOwnerCustomerViewPanel(row);
          highlightChickenRowForOwner(row.id);
        }
      }
    }
    const id = target.dataset.id;
    const action = target.dataset.action;
    if (!id || !action || target.dataset.kind !== "chicken") return;
    const row = state.chickenSales.find((r) => String(r.id) === String(id));
    if (!row) return;
    if (action === "edit") {
      if (state.user.role === "owner") {
        clearOwnerCustomerViewPanel();
        highlightChickenRowForOwner(null);
        if (!isChickenRowOwnerInventory(row)) {
          const tr = target.closest("tr");
          const sel = tr?.querySelector(`select[data-kind="chicken-pay-status"][data-id="${row.id}"]`);
          if (sel instanceof HTMLSelectElement) sel.focus();
          return;
        }
      }
      showPage("chicken-inventory");
      state.editChickenId = row.id;
      chDate.value = toIsoDate(row.date);
      chDateDisplay.value = formatDateDMY(row.date);
      populateChickenBreedSelect();
      const br = document.getElementById("chBreed");
      if (br && row.breed) br.value = row.breed;
      document.getElementById("chDescription").value = row.description || "";
      document.getElementById("chQuantity").value = row.quantity_birds;
      if (chSaleType) chSaleType.value = String(row.through_party || "").trim();
      if (state.user.role === "owner") {
        const sell = Number(row.unit_price);
        const m =
          row.margin_snap != null && row.margin_snap !== "" ? Number(row.margin_snap) : null;
        const chBuy = document.getElementById("chBuyingPrice");
        const chSell = document.getElementById("chSellingPrice");
        const chPm = document.getElementById("chProfitMarginPerChick");
        if (chBuy && chSell && chPm && Number.isFinite(sell) && m != null && Number.isFinite(m) && m > 0) {
          chSell.value = String(sell);
          chBuy.value = String(sell - m);
          chPm.value = String(m);
        } else {
          applyOwnerChickenPricesFromBreed();
        }
      } else {
        const unitEl = document.getElementById("chUnitPrice");
        if (unitEl) unitEl.value = row.unit_price;
        const cn = document.getElementById("chCustomerName");
        const cp = document.getElementById("chCustomerPhone");
        const mp = document.getElementById("chMoneyPaid");
        const ps = document.getElementById("chPaymentStatus");
        if (cn) cn.value = row.customer_name || "";
        if (cp) cp.value = row.customer_phone || "";
        if (mp) mp.value = row.money_paid != null && row.money_paid !== "" ? String(row.money_paid) : "0";
        if (ps) {
          const st = String(row.payment_status || "pending").toLowerCase();
          ps.value = st === "delivered" || st === "cleared" ? "delivered" : "pending";
        }
        updateChickenCustomerAmounts();
      }
      document.getElementById("chSaveBtn").textContent =
        state.user.role === "owner" ? "Update inventory" : "Update sale";
      applyEmployeeSalesDateRules();
      applyEmployeeFeedSalePricingUi();
      return;
    }
    if (action === "delete") {
      if (state.user.role === "employee") {
        if (!window.confirm("Delete this sale?")) return;
        try {
          await api(`/api/chicken-sales/${id}`, { method: "DELETE" });
          await loadAllData();
        } catch (error) {
          alert(error.message);
        }
        return;
      }
      if (state.user.role !== "owner") return;
      const deleteMsg = isChickenRowOwnerInventory(row)
        ? "Delete this inventory record?"
        : "Delete this staff chicken sale?";
      if (!window.confirm(deleteMsg)) return;
      try {
        await api(`/api/chicken-sales/${id}`, { method: "DELETE" });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      }
    }
  });
}

wireChickenTableClicks(chickenInventoryBody);

function resetRetailFeedForm() {
  if (!retailFeedForm) return;
  state.editRetailFeedId = null;
  retailFeedForm.reset();
  if (rfFeedType) {
    rfFeedType.innerHTML = '<option value="">Select feed type</option>';
    rfFeedType.disabled = true;
  }
  const acc = document.getElementById("rfAccumulatedProfit");
  if (acc) acc.value = "0";
  const wEl = document.getElementById("rfWeightKg");
  if (wEl) wEl.value = "";
  updateRfWeightFieldVisibility();
  const saveBtn = document.getElementById("rfSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save retail line";
}

function populateRetailFeedForm(row) {
  state.editRetailFeedId = row.id;
  const brandKey = resolveBrandKey(row.brand);
  if (rfBrand) rfBrand.value = brandKey;
  populateRfFeedTypes(brandKey);
  if (rfFeedType) rfFeedType.value = feedTypeCatalogValue(brandKey, row.feed_type);
  document.getElementById("rfPricePerKg").value = row.price_per_kg;
  document.getElementById("rfMarginPerKg").value = row.profit_margin_per_kg;
  document.getElementById("rfAccumulatedProfit").value = row.accumulated_profit ?? 0;
  const wEl = document.getElementById("rfWeightKg");
  if (wEl) {
    const w = row.weight_kg;
    wEl.value = w != null && w !== "" && Number(w) > 0 ? String(w) : "";
  }
  updateRfWeightFieldVisibility();
  document.getElementById("rfSaveBtn").textContent = "Update retail line";
}

rfBrand?.addEventListener("change", () => {
  populateRfFeedTypes(rfBrand.value);
  updateRfWeightFieldVisibility();
});

rfFeedType?.addEventListener("change", () => {
  updateRfWeightFieldVisibility();
});

retailFeedForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!rfBrand || !rfFeedType) return;
  const payload = {
    brand: resolveBrandKey(rfBrand.value),
    feed_type: rfFeedType.value,
    price_per_kg: Number(document.getElementById("rfPricePerKg").value || 0),
    profit_margin_per_kg: Number(document.getElementById("rfMarginPerKg").value || 0),
  };
  const wRaw = document.getElementById("rfWeightKg")?.value?.trim() ?? "";
  if (isOwnerWeightRetailLine(rfBrand.value, rfFeedType.value)) {
    payload.weight_kg = wRaw === "" ? null : Number(wRaw);
  } else {
    const prev = state.editRetailFeedId
      ? state.retailFeedPricing.find((r) => Number(r.id) === Number(state.editRetailFeedId))
      : null;
    const pw = prev?.weight_kg;
    payload.weight_kg = pw != null && pw !== "" && Number(pw) > 0 ? Number(pw) : null;
  }
  const saveBtn = document.getElementById("rfSaveBtn");
  saveBtn.disabled = true;
  try {
    if (state.editRetailFeedId) {
      await api(`/api/retail-feed-pricing/${state.editRetailFeedId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/retail-feed-pricing", { method: "POST", body: JSON.stringify(payload) });
    }
    resetRetailFeedForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  } finally {
    saveBtn.disabled = false;
  }
});

document.getElementById("rfClearBtn")?.addEventListener("click", () => resetRetailFeedForm());

retailPricingBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (!id || !action) return;
  const row = state.retailFeedPricing.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit-retail") {
    populateRetailFeedForm(row);
    return;
  }
  if (action === "delete-retail") {
    if (!window.confirm("Delete this retail price line? Employees will use Feed Inventory per-kg pricing for this product.")) return;
    try {
      await api(`/api/retail-feed-pricing/${id}`, { method: "DELETE" });
      resetRetailFeedForm();
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

fdBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || (kind !== "fd" && kind !== "fd-sale")) return;
  const row =
    kind === "fd"
      ? state.feedersDrinkersInventory.find((r) => String(r.id) === String(id))
      : state.feedersDrinkersSales.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (kind === "fd-sale") {
    if (action === "edit") {
      state.editFeedersDrinkersId = row.id;
      fdDate.value = toIsoDate(row.date);
      fdDateDisplay.value = formatDateDMY(row.date);
      fdItem.value = row.item_name;
      document.getElementById("fdQuantity").value = row.quantity_sold;
      if (fdSaleType) fdSaleType.value = String(row.through_party || "").trim();
      refreshEmployeeNewPageSellingPrices();
      document.getElementById("fdSaveBtn").textContent = "Update sale";
      return;
    }
    if (action === "delete") {
      if (!window.confirm("Delete this sale?")) return;
      try {
        await api(`/api/feeders-drinkers/sales/${id}`, { method: "DELETE" });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      }
      return;
    }
  }
  if (action === "edit") {
    state.editFeedersDrinkersId = row.id;
    fdDate.value = toIsoDate(row.date);
    fdDateDisplay.value = formatDateDMY(row.date);
    fdItem.value = row.item_name;
    document.getElementById("fdQuantity").value = row.quantity_in_stock;
    document.getElementById("fdBuyingPrice").value = row.buying_price;
    document.getElementById("fdSellingPrice").value = row.selling_price;
    document.getElementById("fdProfitMargin").value = row.profit_margin ?? 0;
    document.getElementById("fdReorderLevel").value = row.reorder_level;
    document.getElementById("fdSaveBtn").textContent = "Update record";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this record?")) return;
    try {
      await api(`/api/feeders-drinkers/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

medBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || (kind !== "med" && kind !== "med-sale")) return;
  const row =
    kind === "med"
      ? state.medicamentsInventory.find((r) => String(r.id) === String(id))
      : state.medicamentsSales.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (kind === "med-sale") {
    if (action === "edit") {
      state.editMedicamentId = row.id;
      medDate.value = toIsoDate(row.date);
      medDateDisplay.value = formatDateDMY(row.date);
      medItem.value = row.item_name;
      document.getElementById("medQuantity").value = row.quantity_sold;
      if (medSaleType) medSaleType.value = String(row.through_party || "").trim();
      refreshEmployeeNewPageSellingPrices();
      document.getElementById("medSaveBtn").textContent = "Update sale";
      return;
    }
    if (action === "delete") {
      if (!window.confirm("Delete this sale?")) return;
      try {
        await api(`/api/medicaments/sales/${id}`, { method: "DELETE" });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      }
      return;
    }
  }
  if (action === "edit") {
    state.editMedicamentId = row.id;
    medDate.value = toIsoDate(row.date);
    medDateDisplay.value = formatDateDMY(row.date);
    medItem.value = row.item_name;
    document.getElementById("medQuantity").value = row.quantity_in_stock;
    document.getElementById("medBuyingPrice").value = row.buying_price;
    document.getElementById("medSellingPrice").value = row.selling_price;
    document.getElementById("medProfitMargin").value = row.profit_margin ?? 0;
    document.getElementById("medReorderLevel").value = row.reorder_level;
    document.getElementById("medSaveBtn").textContent = "Update record";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this record?")) return;
    try {
      await api(`/api/medicaments/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

gasBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || (kind !== "gas" && kind !== "gas-sale")) return;
  const row =
    kind === "gas"
      ? state.gasInventory.find((r) => String(r.id) === String(id))
      : state.gasSales.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (kind === "gas-sale") {
    if (action === "edit") {
      state.editGasId = row.id;
      gasDate.value = toIsoDate(row.date);
      gasDateDisplay.value = formatDateDMY(row.date);
      if (gasSize) {
        const sk = String(row.size_kg);
        if (![...gasSize.options].some((o) => o.value === sk)) {
          const opt = document.createElement("option");
          opt.value = sk;
          opt.textContent = `${row.size_kg} kg (not in current stock list)`;
          gasSize.appendChild(opt);
        }
        gasSize.value = sk;
      }
      document.getElementById("gasQuantity").value = row.quantity_sold;
      if (gasSaleType) gasSaleType.value = String(row.through_party || "").trim();
      refreshEmployeeNewPageSellingPrices();
      document.getElementById("gasSaveBtn").textContent = "Update sale";
      return;
    }
    if (action === "delete") {
      if (!window.confirm("Delete this sale?")) return;
      try {
        await api(`/api/gas/sales/${id}`, { method: "DELETE" });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      }
      return;
    }
  }
  if (action === "edit") {
    state.editGasId = row.id;
    gasDate.value = toIsoDate(row.date);
    gasDateDisplay.value = formatDateDMY(row.date);
    if (gasSizeKg) {
      const sk = String(row.size_kg);
      if (![...gasSizeKg.options].some((o) => o.value === sk)) {
        const opt = document.createElement("option");
        opt.value = sk;
        opt.textContent = `${row.size_kg} kg (legacy size)`;
        gasSizeKg.appendChild(opt);
      }
      gasSizeKg.value = sk;
      gasSizeKg.disabled = true;
    }
    document.getElementById("gasQuantity").value = row.quantity_in_stock;
    document.getElementById("gasBuyingPrice").value = row.buying_price;
    document.getElementById("gasSellingPrice").value = row.selling_price;
    document.getElementById("gasProfitMargin").value = row.profit_margin ?? 0;
    document.getElementById("gasReorderLevel").value = row.reorder_level;
    document.getElementById("gasSaveBtn").textContent = "Update record";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this record?")) return;
    try {
      await api(`/api/gas/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

expBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "exp") return;
  if (!state.user || !["owner", "employee"].includes(state.user.role)) return;
  const row = state.expenditureEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editExpenditureId = row.id;
    if (expDate) expDate.value = toIsoDate(row.date);
    if (expDateDisplay) expDateDisplay.value = formatDateDMY(row.date);
    const desc = document.getElementById("expDescription");
    const out = document.getElementById("expMoneyOut");
    const tot = document.getElementById("expTotal");
    if (desc) desc.value = row.description || "";
    if (out) out.value = row.money_out ?? 0;
    if (tot) tot.value = row.total ?? 0;
    const saveBtn = document.getElementById("expSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/expenditure/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

roseBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "rose") return;
  const row = state.roseEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editRoseId = row.id;
    if (roseDate) roseDate.value = toIsoDate(row.date);
    if (roseDateDisplay) roseDateDisplay.value = formatDateDMY(row.date);
    const desc = document.getElementById("roseDescription");
    const qty = document.getElementById("roseQuantity");
    const unit = document.getElementById("roseUnitPrice");
    const min = document.getElementById("roseMoneyIn");
    const mout = document.getElementById("roseMoneyOut");
    const mort = document.getElementById("roseMortality");
    const via = document.getElementById("roseSaleVia");
    if (desc) desc.value = row.description || "";
    if (qty) qty.value = row.quantity ?? 0;
    if (unit) unit.value = row.unit_price ?? 0;
    if (min) min.value = row.money_in ?? 0;
    if (mout) mout.value = row.money_out ?? 0;
    if (mort) mort.value = row.mortality ?? 0;
    if (via) via.value = row.sale_via || "Shop";
    const saveBtn = document.getElementById("roseSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/rose/inventory/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

boot();
