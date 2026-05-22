const state = {
  appInstance: (() => {
    const saved = (localStorage.getItem("amanaAppInstance") || "amana").trim().toLowerCase();
    return ["amana", "ufaray", "rose", "nahah", "terry", "cess", "terry-and-cess", "maina-faith-cess", "shop"].includes(saved)
      ? saved
      : "amana";
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
  cessAccountsEntries: [],
  editCessAccountsId: null,
  nahashonEntries: [],
  editNahashonId: null,
  pigsEntries: [],
  editPigsId: null,
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
  "nahashon-records": "Nahashon Records",
  "cess-accounts": "Cess Accounts",
  calculator: "Calculator",
  pigs: "Pigs Page",
  expenditure: "Expenditure",
  "monthly-report": "Monthly Report",
  balance: "Balance",
};

function updateCalculatorModeUi() {
  const calcSubheading = document.getElementById("calculatorSubheading");
  if (calcSubheading && !calcSubheading.classList.contains("hidden")) {
    calcSubheading.textContent = "Calculator";
  }
}

function isRecordsTenant() {
  return state.appInstance === "rose";
}

function isTerryCessOrShopTenant() {
  return (
    state.appInstance === "terry" ||
    state.appInstance === "cess" ||
    state.appInstance === "terry-and-cess" ||
    state.appInstance === "maina-faith-cess" ||
    state.appInstance === "shop"
  );
}

/** Calculator tab + page (with PDFs) allowed for staff on these tenants — same UI as owner. */
function staffMayAccessCalculatorTenant() {
  return (
    isTerryCessOrShopTenant() ||
    state.appInstance === "amana" ||
    state.appInstance === "ufaray"
  );
}

function isTerryOrCessTenant() {
  return (
    state.appInstance === "terry" ||
    state.appInstance === "cess" ||
    state.appInstance === "terry-and-cess" ||
    state.appInstance === "maina-faith-cess"
  );
}

/** Feed & retail inventory setup tabs — employees never see these. Chicken sales uses a shared page (`chicken-inventory`). */
const OWNER_INVENTORY_PAGES = new Set(["inventory", "retail-inventory", "calculator", "balance", "monthly-report"]);
const OWNER_ALLOWED_PAGES = new Set([
  "inventory",
  "retail-inventory",
  "sales-bags",
  "sales-kg",
  "chicken-inventory",
  "feeders-drinkers",
  "medicaments",
  "gas",
  "rose-inventory",
  "nahashon-records",
  "cess-accounts",
  "pigs",
  "calculator",
  "expenditure",
  "monthly-report",
  "balance",
]);
/** Owner pages that show the combined accumulated profit footer at the bottom. */
const OWNER_PAGES_WITH_COMBINED_PROFIT = new Set(["inventory", "retail-inventory", "chicken-inventory"]);

/** Balance page only: daily operational cost (KES) per shop — Amana vs Ufaray are independent. */
const BALANCE_PAGE_DAILY_OPERATIONAL_COST_KES_AMANA = 540;
const BALANCE_PAGE_DAILY_OPERATIONAL_COST_KES_UFARAY = 180;

function balanceDailyOperationalCostKes() {
  if (state.appInstance === "ufaray") return BALANCE_PAGE_DAILY_OPERATIONAL_COST_KES_UFARAY;
  return BALANCE_PAGE_DAILY_OPERATIONAL_COST_KES_AMANA;
}

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
const bagsBoughtInput = document.getElementById("bagsBought");
const buyingPriceInput = document.getElementById("buyingPrice");
const sellingPriceInput = document.getElementById("sellingPrice");
const profitMarginPerBagInput = document.getElementById("profitMarginPerBag");
const reorderLevelInput = document.getElementById("reorderLevel");
const editPricesBtn = document.getElementById("editPricesBtn");
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
const roseInventoryTabLabel = document.getElementById("roseInventoryTabLabel");

const chickenForm = document.getElementById("chicken-form");
const chickenInventoryBody = document.getElementById("chicken-inventory-body");
const chDateDisplay = document.getElementById("chDateDisplay");
const chDate = document.getElementById("chDate");
const chOpenCalendarBtn = document.getElementById("chOpenCalendarBtn");
const chSaleType = document.getElementById("chSaleType");
const chFeedBrand = document.getElementById("chFeedBrand");
const chFeedType = document.getElementById("chFeedType");
const chFeedBagQty = document.getElementById("chFeedBagQty");
const chFeedLineTotal = document.getElementById("chFeedLineTotal");
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
const cessAccountsForm = document.getElementById("cess-accounts-form");
const cessAccountsBody = document.getElementById("cess-accounts-body");
const cessAccDateDisplay = document.getElementById("cessAccDateDisplay");
const cessAccDate = document.getElementById("cessAccDate");
const cessAccOpenCalendarBtn = document.getElementById("cessAccOpenCalendarBtn");
const nahashonForm = document.getElementById("nahashon-form");
const nahashonBody = document.getElementById("nahashon-body");
const nahashonDateDisplay = document.getElementById("nahashonDateDisplay");
const nahashonDate = document.getElementById("nahashonDate");
const nahashonOpenCalendarBtn = document.getElementById("nahashonOpenCalendarBtn");
const pigsForm = document.getElementById("pigs-form");
const pigsBody = document.getElementById("pigs-body");
const pigsDateDisplay = document.getElementById("pigsDateDisplay");
const pigsDate = document.getElementById("pigsDate");
const pigsOpenCalendarBtn = document.getElementById("pigsOpenCalendarBtn");
const calcBody = document.getElementById("calc-body");
const calcDueDateDisplay = document.getElementById("calcDueDateDisplay");
const calcDueDate = document.getElementById("calcDueDate");
const calcDueOpenCalendarBtn = document.getElementById("calcDueOpenCalendarBtn");
const calcChDateDisplay = document.getElementById("calcChDateDisplay");
const calcChDate = document.getElementById("calcChDate");
const calcChOpenCalendarBtn = document.getElementById("calcChOpenCalendarBtn");
const calcChBreed = document.getElementById("calcChBreed");
const calcChQuantity = document.getElementById("calcChQuantity");
const calcChPricePerChick = document.getElementById("calcChPricePerChick");
const calcChTotal = document.getElementById("calcChTotal");

let refreshTimer = null;
let catalogInitialized = false;
/** Owner typed buying/selling on Feed Inventory — skip auto price fill until brand/feed changes. */
let inventoryPricesDirty = false;

function persistAppInstance() {
  const normalized = ["amana", "ufaray", "rose", "nahah", "terry", "cess", "terry-and-cess", "maina-faith-cess", "shop"].includes(
    state.appInstance
  )
    ? state.appInstance
    : "amana";
  localStorage.setItem("amanaAppInstance", normalized);
}

function applyAppTheme() {
  const tenant = ["amana", "ufaray", "rose", "nahah", "terry", "cess", "terry-and-cess", "maina-faith-cess", "shop"].includes(
    state.appInstance
  )
    ? state.appInstance
    : "amana";
  const isUfaray = tenant === "ufaray";
  const isRose = tenant === "rose";
  const isMainaFaithCess = tenant === "maina-faith-cess";
  const isTerryAndCess = tenant === "terry-and-cess";
  const isNahah =
    tenant === "nahah" ||
    tenant === "terry" ||
    tenant === "cess" ||
    tenant === "shop" ||
    isMainaFaithCess ||
    isTerryAndCess;
  document.body.classList.toggle("ufaray-theme", isUfaray);
  document.body.classList.toggle("rose-theme", isRose);
  document.body.classList.toggle("nahah-theme", isNahah);
  document.title = isMainaFaithCess
    ? "Maina+Faith+Cess - Desktop Inventory"
    : isTerryAndCess
      ? "Terry and Cess - Desktop Inventory"
      : isUfaray
      ? "Ufaray Feeds - Desktop Inventory"
      : isRose
        ? "Rose Inventory - Desktop Inventory"
        : isNahah
          ? "Nahah Feeds Inventory System - Desktop Inventory"
        : "Amana Kuku Feeds - Desktop Inventory";
  const portalSiteTitle = document.getElementById("portalSiteTitle");
  if (portalSiteTitle) {
    portalSiteTitle.textContent = isMainaFaithCess
      ? "Maina+Faith+Cess"
      : isTerryAndCess
        ? "Terry and Cess"
        : isUfaray
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
        : tenant === "terry-and-cess"
          ? "Terry and Cess Inventory Login"
        : tenant === "maina-faith-cess"
          ? "Maina+Faith+Cess Inventory Login"
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
      state.appInstance === "rose"
        ? "Rose Inventory"
        : state.appInstance === "terry"
          ? "Terry Records"
            : state.appInstance === "cess"
              ? "Records"
            : state.appInstance === "terry-and-cess"
              ? "Records"
            : state.appInstance === "maina-faith-cess"
              ? "Records"
            : "Rose Inventory";
  }
  const rosePageTitle = document.getElementById("roseInventoryPageTitle");
  if (rosePageTitle) {
    rosePageTitle.textContent =
      state.appInstance === "rose"
        ? "Rose Inventory"
        : state.appInstance === "terry"
          ? "Terry Records"
            : state.appInstance === "cess"
              ? "Records"
            : state.appInstance === "terry-and-cess"
              ? "Terry and Cess"
            : state.appInstance === "maina-faith-cess"
              ? "Maina+Faith+Cess"
            : "Rose Inventory";
  }
  const passThroughTitles = document.querySelectorAll(".js-via-pass-through-title");
  for (const el of passThroughTitles) {
    el.textContent = state.appInstance === "amana" ? "Via Ufaray Feeds" : "Via Amana kuku feeds";
  }
  for (const el of document.querySelectorAll(".js-via-ufaray-bags-hint")) {
    el.innerHTML =
      state.appInstance === "amana"
        ? "Each row is a staff-recorded <strong>Sales Per Bags</strong> entry with <strong>Sale recorded for</strong> set to <strong>By Ufaray</strong> (pass-through: no shop profit on these bags). <strong>Total</strong> is buying cost × bags; customer price per bag is shown for reference. Edit or delete under <strong>Sales Per Bags</strong>."
        : "Each row is a staff-recorded <strong>Sales Per Bags</strong> entry with <strong>Sale recorded for</strong> set to <strong>Via Amana</strong>. <strong>Total</strong> is buying cost × bags; customer price per bag is shown for reference. Edit or delete under <strong>Sales Per Bags</strong>.";
  }
  const calcSubheading = document.getElementById("calculatorSubheading");
  const calcTitle = document.getElementById("calculatorTitle");
  if (calcSubheading) calcSubheading.classList.toggle("hidden", state.appInstance === "ufaray");
  if (calcTitle) {
    calcTitle.textContent = state.appInstance === "ufaray" ? "Ufaray Feeds" : "Amana Kuku Feeds";
  }
  updateCalculatorModeUi();
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-App-Instance": [
      "amana",
      "ufaray",
      "rose",
      "terry",
      "cess",
      "terry-and-cess",
      "maina-faith-cess",
      "shop",
    ].includes(state.appInstance)
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

/** Plain numeric string with grouping (no currency symbol) for invoice-style PDF columns. */
function formatKshPlainNumber(value) {
  const n = roundMoney(value) || 0;
  return new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Round to 2 decimal places (half-up) — avoids float drift like 4299.999999 → 4299.99 in inputs. */
function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

/** Value for a money text input (from DB or calculation). */
function formatMoneyForInput(value) {
  const r = roundMoney(value);
  if (!Number.isFinite(r)) return "";
  return r.toFixed(2);
}

/** Parse money from a form field; empty string → NaN. */
function parseMoneyFromInput(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/,/g, "");
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? roundMoney(n) : NaN;
}

/** Optional blur: normalize display without changing the numeric value the user intended. */
function normalizeMoneyInputOnBlur(el) {
  if (!(el instanceof HTMLInputElement)) return;
  const parsed = parseMoneyFromInput(el.value);
  if (Number.isFinite(parsed)) el.value = formatMoneyForInput(parsed);
}

function wireMoneyInputBlur(el) {
  if (!(el instanceof HTMLInputElement)) return;
  el.addEventListener("blur", () => normalizeMoneyInputOnBlur(el));
}

/** Stop scroll-wheel from nudging focused number inputs by one step (e.g. 4300 → 4299.99). */
function preventWheelOnNumberInputs(root = document) {
  root.querySelectorAll("input[type='number']").forEach((el) => {
    if (el.dataset.wheelGuard === "1") return;
    el.dataset.wheelGuard = "1";
    el.addEventListener(
      "wheel",
      (e) => {
        if (document.activeElement === el) e.preventDefault();
      },
      { passive: false }
    );
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
    ? `Shop day ${shop}. Cumulative and today count staff chick sales with Delivery status = Delivered only (pending delivery shows KES 0). Your inventory lines do not add to these totals.`
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
  const rows = state.expenditureEntries || [];
  const sumMoneyOut = rows.reduce((s, r) => s + (Number(r.money_out) || 0), 0);
  const val = currency(sumMoneyOut);
  document.querySelectorAll(".js-exp-expenditure-total-value").forEach((el) => {
    el.textContent = val;
  });
  const meta =
    rows.length === 0
      ? "No records yet."
      : `${rows.length} record${rows.length === 1 ? "" : "s"} · Sum of money out: ${currency(sumMoneyOut)}`;
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

function calculatorInventoryRows() {
  const recs = state.records || [];
  return recs.length > 0 ? recs : state.inventoryPricing || [];
}

/** Latest buying price from Feed Inventory for this catalog line (newest row by id). */
function findInventoryBuyingPriceForCalculator(brand, feedType, bagSize) {
  const row = findLatestInventoryRowForCatalogLine(calculatorInventoryRows(), brand, feedType, bagSize);
  if (!row) return null;
  const bp = Number(row.buying_price);
  return Number.isFinite(bp) ? bp : null;
}

/** Selling price per chick from Chicken Sales Inventory (chicken_breeds). */
function findChickenSellingPriceForCalculator(breed) {
  const name = String(breed || "").trim();
  if (!name) return null;
  const row = getChickenBreedsRows().find((r) => r.breed === name);
  if (!row) return null;
  const sp = Number(row.selling_price);
  return Number.isFinite(sp) && sp >= 0 ? sp : null;
}

function populateCalcChickenBreedSelect() {
  if (!calcChBreed) return;
  const cur = calcChBreed.value;
  calcChBreed.innerHTML = '<option value="">Select breed</option>';
  for (const r of getChickenBreedsRows()) {
    if (!r.breed) continue;
    const opt = document.createElement("option");
    opt.value = r.breed;
    opt.textContent = r.breed;
    calcChBreed.appendChild(opt);
  }
  if (cur && [...calcChBreed.options].some((o) => o.value === cur)) calcChBreed.value = cur;
}

function applyCalcChickenPriceFromBreed() {
  if (!calcChBreed || !calcChPricePerChick) return;
  const sp = findChickenSellingPriceForCalculator(calcChBreed.value);
  calcChPricePerChick.value = sp != null ? currency(sp) : "";
}

function updateCalcChickenTotalDisplay() {
  if (!calcChQuantity || !calcChTotal) return;
  const qty = Number(String(calcChQuantity.value || "").trim());
  const unit = findChickenSellingPriceForCalculator(calcChBreed?.value);
  const safeQty = Math.max(0, Number.isFinite(qty) ? qty : 0);
  const safeUnit = unit != null && Number.isFinite(unit) ? unit : 0;
  if (safeQty > 0 && calcChBreed?.value && unit != null) {
    calcChTotal.value = currency(safeQty * safeUnit);
  } else {
    calcChTotal.value = "";
  }
  updateCalculatorInvoicePaymentSummary();
}

function initCalcChickenFormDefaults() {
  if (calcChDateDisplay && !calcChDateDisplay.value.trim()) {
    const todayStr = state.shopToday || clientShopTodayDMY();
    calcChDateDisplay.value = todayStr;
    if (calcChDate) calcChDate.value = toIsoDate(todayStr);
  }
}

function resetCalcChickenForm() {
  if (calcChDateDisplay) calcChDateDisplay.value = "";
  if (calcChDate) calcChDate.value = "";
  if (calcChBreed) calcChBreed.value = "";
  if (calcChQuantity) calcChQuantity.value = "";
  if (calcChPricePerChick) calcChPricePerChick.value = "";
  if (calcChTotal) calcChTotal.value = "";
  initCalcChickenFormDefaults();
  applyCalcChickenPriceFromBreed();
  updateCalcChickenTotalDisplay();
}

/** Latest selling price from Feed Inventory for this catalog line (newest row by id). */
function findInventorySellingPriceForCalculator(brand, feedType, bagSize) {
  const row = findLatestInventoryRowForCatalogLine(calculatorInventoryRows(), brand, feedType, bagSize);
  if (!row) return null;
  const sp = Number(row.selling_price);
  return Number.isFinite(sp) ? sp : null;
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
  const sellEl = tr.querySelector("input[data-kind='calc-selling']");
  if (!(bagsEl instanceof HTMLInputElement) || !(buyEl instanceof HTMLInputElement) || !(sellEl instanceof HTMLInputElement)) return;
  const key = calculatorRowKey(brand, feedType, bagSize);
  const bagsRaw = bagsEl.value;
  if (!bagsRaw.trim()) {
    delete state.calculatorValues[key];
    return;
  }
  state.calculatorValues[key] = {
    bags: bagsRaw,
  };
}

function updateCalculatorGrandTotalDisplay() {
  if (!calcBody) return;
  let grand = 0;
  let totalBags = 0;
  let linesWithValues = 0;
  calcBody.querySelectorAll("tr").forEach((tr) => {
    const bagsEl = tr.querySelector("input[data-kind='calc-bags']");
    const buyEl = tr.querySelector("input[data-kind='calc-buying']");
    const totalCell = tr.querySelector(".js-calc-row-total");
    if (!(bagsEl instanceof HTMLInputElement) || !(buyEl instanceof HTMLInputElement) || !(totalCell instanceof HTMLElement)) return;
    const bags = Number(String(bagsEl.value || "").trim());
    const buying = Number(String(buyEl.value || "").trim());
    const safeBags = Math.max(0, Number.isFinite(bags) ? bags : 0);
    const rowTotal = safeBags * Math.max(0, Number.isFinite(buying) ? buying : 0);
    totalCell.textContent = currency(rowTotal);
    if (rowTotal > 0) linesWithValues += 1;
    totalBags += safeBags;
    grand += rowTotal;
  });
  document.querySelectorAll(".js-calc-grand-total-value").forEach((el) => {
    el.textContent = currency(grand);
  });
  const meta = linesWithValues
    ? `${linesWithValues} line${linesWithValues === 1 ? "" : "s"} with values. Total bags: ${totalBags}. Grand total purchase cost: ${currency(grand)}.`
    : "Enter number of bags and buying price to calculate purchase cost (and total bags).";
  document.querySelectorAll(".js-calc-grand-total-meta").forEach((el) => {
    el.textContent = meta;
  });
  updateCalculatorInvoicePaymentSummary();
}

/** Sum of bags × buying price (calculator PDF and purchase-cost totals). */
function calculatorBuyingGrandTotal() {
  if (!calcBody) return 0;
  let total = 0;
  calcBody.querySelectorAll("tr").forEach((tr) => {
    const bagsEl = tr.querySelector("input[data-kind='calc-bags']");
    const buyEl = tr.querySelector("input[data-kind='calc-buying']");
    if (!(bagsEl instanceof HTMLInputElement) || !(buyEl instanceof HTMLInputElement)) return;
    const bags = Number(String(bagsEl.value || "").trim());
    const buying = Number(String(buyEl.value || "").trim());
    const safeBags = Math.max(0, Number.isFinite(bags) ? bags : 0);
    const safeBuy = Math.max(0, Number.isFinite(buying) ? buying : 0);
    if (safeBags > 0) total += safeBags * safeBuy;
  });
  return total;
}

/** Sum of bags × selling price (feed lines only). */
function calculatorFeedSellingGrandTotal() {
  if (!calcBody) return 0;
  let total = 0;
  calcBody.querySelectorAll("tr").forEach((tr) => {
    const bagsEl = tr.querySelector("input[data-kind='calc-bags']");
    const sellEl = tr.querySelector("input[data-kind='calc-selling']");
    if (!(bagsEl instanceof HTMLInputElement) || !(sellEl instanceof HTMLInputElement)) return;
    const bags = Number(String(bagsEl.value || "").trim());
    const selling = Number(String(sellEl.value || "").trim());
    const safeBags = Math.max(0, Number.isFinite(bags) ? bags : 0);
    const safeSell = Math.max(0, Number.isFinite(selling) ? selling : 0);
    if (safeBags > 0) total += safeBags * safeSell;
  });
  return total;
}

/** Chicken calculator selling total (invoice / proforma). */
function calcChickenSellingLineTotal() {
  const ch = collectCalcChickenRowForPdfExport();
  return ch ? ch.lineTotal : 0;
}

/** Feed selling + chicken calculator (invoice / proforma only). */
function calculatorSellingGrandTotal() {
  return calculatorFeedSellingGrandTotal() + calcChickenSellingLineTotal();
}

/** Add chicken line to invoice-style PDF table body when the form is complete. */
function appendChickenRowToPdfTableBody(tableBody) {
  const ch = collectCalcChickenRowForPdfExport();
  if (!ch) return;
  const desc = `${ch.breed} DAY-OLD CHICKS`.replace(/\s+/g, " ").trim().toUpperCase();
  tableBody.push([
    desc,
    String(ch.qtyNum),
    `Ksh${formatKshPlainNumber(ch.unitPrice)}`,
    `Ksh${formatKshPlainNumber(ch.lineTotal)}`,
  ]);
}

function updateCalculatorInvoicePaymentSummary() {
  const total = calculatorSellingGrandTotal();
  const paidEl = document.getElementById("calcPaidAmount");
  const paid = paidEl instanceof HTMLInputElement ? Number(paidEl.value || 0) : 0;
  const safePaid = Number.isFinite(paid) && paid >= 0 ? paid : 0;
  const balance = total - safePaid;
  const totalEl = document.getElementById("calcSellingTotal");
  const balanceEl = document.getElementById("calcUnpaidBalance");
  if (totalEl instanceof HTMLInputElement) totalEl.value = currency(total);
  if (balanceEl instanceof HTMLInputElement) balanceEl.value = currency(balance);
}

function getCalcPaidAmountForPdf() {
  const el = document.getElementById("calcPaidAmount");
  if (!(el instanceof HTMLInputElement)) return 0;
  const n = Number(String(el.value || "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
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

/** Latest expenditure entry tagged "Operational costs" (returns its DD/MM/YYYY date, or null). */
function findLastOperationalCostsPaymentDate() {
  const rows = state.expenditureEntries || [];
  let latestDmy = null;
  let latestKey = null;
  for (const row of rows) {
    if (normalizeExpenditureCategory(row.category) !== "Operational costs") continue;
    const dmy = formatDateDMY(row.date);
    const parts = parseDMYParts(dmy);
    if (!parts) continue;
    const key = Date.UTC(parts.y, parts.m - 1, parts.d);
    if (latestKey == null || key > latestKey) {
      latestKey = key;
      latestDmy = dmy;
    }
  }
  return latestDmy;
}

function updateBalanceBanner() {
  if (state.user?.role !== "owner") return;
  const combined = getOwnerCombinedProfitTotal();
  const today = state.shopToday || clientShopTodayDMY();
  const dailyOps = balanceDailyOperationalCostKes();
  const expRows = state.expenditureEntries || [];
  const totalExpenditure = expRows.reduce((s, r) => s + (Number(r.money_out) || 0), 0);

  const lastOpPaymentDmy = findLastOperationalCostsPaymentDate();
  const totalDays = inclusiveBusinessDaysFromOpen(BUSINESS_OPENED_DMY, today);
  let cycleStartDmy = BUSINESS_OPENED_DMY;
  let daysUncovered = totalDays;
  if (lastOpPaymentDmy) {
    const lastParts = parseDMYParts(lastOpPaymentDmy);
    if (lastParts) {
      const dayAfter = new Date(Date.UTC(lastParts.y, lastParts.m - 1, lastParts.d + 1));
      const dd = String(dayAfter.getUTCDate()).padStart(2, "0");
      const mm = String(dayAfter.getUTCMonth() + 1).padStart(2, "0");
      const yy = dayAfter.getUTCFullYear();
      cycleStartDmy = `${dd}/${mm}/${yy}`;
    }
    const todayParts = parseDMYParts(today);
    if (lastParts && todayParts) {
      const utcLast = Date.UTC(lastParts.y, lastParts.m - 1, lastParts.d);
      const utcToday = Date.UTC(todayParts.y, todayParts.m - 1, todayParts.d);
      const diff = Math.floor((utcToday - utcLast) / 86400000);
      daysUncovered = diff > 0 ? diff : 0;
    } else {
      daysUncovered = 0;
    }
  }
  const operational = daysUncovered * dailyOps;
  const remaining = combined - operational - totalExpenditure;

  document.querySelectorAll(".js-balance-remaining-value").forEach((el) => {
    const formatted = currency(Math.abs(remaining));
    const isNegative = remaining < 0;
    el.textContent = isNegative ? `- ${formatted}` : formatted;
  });
  const cycleNote = lastOpPaymentDmy
    ? `Current cycle since ${cycleStartDmy} (last Operational costs payment ${lastOpPaymentDmy})`
    : `Current cycle since ${BUSINESS_OPENED_DMY} (no Operational costs payment recorded yet)`;
  const meta = `${currency(combined)} - (${currency(dailyOps)} × ${daysUncovered} day${daysUncovered === 1 ? "" : "s"}) - ${currency(
    totalExpenditure
  )} (expenditure) = ${currency(remaining)} · ${cycleNote}`;
  document.querySelectorAll(".js-balance-remaining-meta").forEach((el) => {
    el.textContent = meta;
  });
  document.querySelectorAll(".js-balance-daily-op-rate").forEach((el) => {
    el.textContent = `Ksh ${Number(dailyOps).toLocaleString("en-KE")}`;
  });
}

/** Returns yyyy-mm for the month currently selected on the Monthly Report page (or current month). */
function monthlyReportSelectedYM() {
  const input = document.getElementById("mrMonth");
  if (input instanceof HTMLInputElement && /^\d{4}-\d{2}$/.test(input.value)) return input.value;
  const today = state.shopToday || clientShopTodayDMY();
  const parts = parseDMYParts(today);
  if (!parts) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${parts.y}-${String(parts.m).padStart(2, "0")}`;
}

/** Previous month string for a given yyyy-mm. */
function previousYM(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]) - 1;
  if (mo < 1) { mo = 12; y -= 1; }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

function rowMatchesYM(row, ym) {
  const parts = parseDMYParts(row?.date);
  if (!parts) return false;
  return `${parts.y}-${String(parts.m).padStart(2, "0")}` === ym;
}

function monthLabel(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  if (!m) return ym || "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[mo - 1] || ""} ${y}`;
}

/** Aggregate Sales Per Bags rows for the given yyyy-mm month. */
function aggregateBagSalesForMonth(ym) {
  const rows = (state.salesBags || []).filter((r) => rowMatchesYM(r, ym));
  const map = new Map();
  let totalBags = 0;
  let totalRevenue = 0;
  let passThroughBags = 0;
  for (const r of rows) {
    const brand = displayBrand(r.brand) || "—";
    const feed = displayFeedType(r.feed_type) || "—";
    const bs = Number(r.bag_size) || 0;
    const key = `${brand}|||${feed}|||${bs}`;
    const bagsSold = Number(r.bags_sold) || 0;
    const revenue = Number.isFinite(Number(r.total_amount))
      ? Number(r.total_amount)
      : bagsSold * (Number(r.price_per_bag) || 0);
    if (!map.has(key)) map.set(key, { brand, feed, bagSize: bs, bagsSold: 0, revenue: 0 });
    const entry = map.get(key);
    entry.bagsSold += bagsSold;
    entry.revenue += revenue;
    totalBags += bagsSold;
    totalRevenue += revenue;
    if (r.through_party && String(r.through_party).trim() !== "") passThroughBags += bagsSold;
  }
  return {
    rows: Array.from(map.values()).sort((a, b) => b.bagsSold - a.bagsSold || b.revenue - a.revenue),
    totalBags,
    totalRevenue,
    passThroughBags,
    rowCount: rows.length,
  };
}

/** Aggregate Sales Per Kg rows for the given yyyy-mm month. */
function aggregateKgSalesForMonth(ym) {
  const rows = (state.salesKg || []).filter((r) => rowMatchesYM(r, ym));
  const map = new Map();
  let totalKg = 0;
  let totalRevenue = 0;
  let passThroughKg = 0;
  for (const r of rows) {
    const brand = displayBrand(r.brand) || "—";
    const feed = displayFeedType(r.feed_type) || "—";
    const key = `${brand}|||${feed}`;
    const kg = Number(r.kg_sold) || 0;
    const revenue = Number.isFinite(Number(r.total_amount))
      ? Number(r.total_amount)
      : kg * (Number(r.price_per_kg) || 0);
    if (!map.has(key)) map.set(key, { brand, feed, kg: 0, revenue: 0 });
    const entry = map.get(key);
    entry.kg += kg;
    entry.revenue += revenue;
    totalKg += kg;
    totalRevenue += revenue;
    if (r.through_party && String(r.through_party).trim() !== "") passThroughKg += kg;
  }
  return {
    rows: Array.from(map.values()).sort((a, b) => b.kg - a.kg || b.revenue - a.revenue),
    totalKg,
    totalRevenue,
    passThroughKg,
    rowCount: rows.length,
  };
}

/** Catalog feed lines that had zero bag-sales in the month (used in advice). */
function catalogLinesWithNoBagSales(bagAgg) {
  const sold = new Set();
  for (const row of bagAgg.rows) {
    sold.add(`${row.brand}|||${row.feed}|||${row.bagSize}`);
  }
  const dormant = [];
  const catalog = state.catalog || {};
  for (const brandKey of Object.keys(catalog)) {
    const brand = displayBrand(brandKey);
    for (const item of catalog[brandKey] || []) {
      const feed = displayFeedType(item.type);
      const bs = Number(item.bagSize) || 0;
      const key = `${brand}|||${feed}|||${bs}`;
      if (!sold.has(key)) dormant.push({ brand, feed, bagSize: bs });
    }
  }
  return dormant;
}

function buildMonthlyAdvice(ym, bagAgg, kgAgg) {
  const advice = [];
  const monthName = monthLabel(ym);
  const prevYm = previousYM(ym);
  const prevBag = prevYm ? aggregateBagSalesForMonth(prevYm) : null;
  const prevKg = prevYm ? aggregateKgSalesForMonth(prevYm) : null;

  if (bagAgg.totalBags === 0 && kgAgg.totalKg === 0) {
    advice.push(`No sales recorded for ${monthName}. Make sure staff are recording sales on the Sales Per Bags and Sales Per Kg pages.`);
    return advice;
  }

  const topBag = bagAgg.rows[0];
  if (topBag) {
    advice.push(
      `<strong>Top bag seller:</strong> ${topBag.brand} — ${topBag.feed} (${topBag.bagSize} kg) at ${topBag.bagsSold} bag${topBag.bagsSold === 1 ? "" : "s"} (${currency(topBag.revenue)}). Keep this product well stocked and visible for next month.`
    );
  }

  const topKg = kgAgg.rows[0];
  if (topKg) {
    advice.push(
      `<strong>Top retail seller:</strong> ${topKg.brand} — ${topKg.feed} at ${Number(topKg.kg).toFixed(2)} kg (${currency(topKg.revenue)}). Open a fresh bag early in the day so retail customers always find it.`
    );
  }

  if (prevBag && prevBag.totalBags > 0) {
    const diff = bagAgg.totalBags - prevBag.totalBags;
    const pct = prevBag.totalBags ? Math.round((diff / prevBag.totalBags) * 100) : 0;
    if (diff > 0) {
      advice.push(`Bag sales are up ${pct}% versus ${monthLabel(prevYm)} (${prevBag.totalBags} → ${bagAgg.totalBags} bags). Keep the momentum — reorder before stock-outs.`);
    } else if (diff < 0) {
      advice.push(`Bag sales dropped ${Math.abs(pct)}% versus ${monthLabel(prevYm)} (${prevBag.totalBags} → ${bagAgg.totalBags} bags). Consider a small promotion on the slow lines or a customer call-back.`);
    } else if (bagAgg.totalBags > 0) {
      advice.push(`Bag sales matched ${monthLabel(prevYm)} (${bagAgg.totalBags} bags). Push for at least one extra bag a day to grow steadily.`);
    }
  }

  if (prevKg && prevKg.totalKg > 0) {
    const diff = kgAgg.totalKg - prevKg.totalKg;
    const pct = prevKg.totalKg ? Math.round((diff / prevKg.totalKg) * 100) : 0;
    if (diff > 0) {
      advice.push(`Retail kg sales are up ${pct}% versus ${monthLabel(prevYm)}. Maintain consistent retail weight per bag so customers come back.`);
    } else if (diff < 0) {
      advice.push(`Retail kg sales dropped ${Math.abs(pct)}% versus ${monthLabel(prevYm)}. Promote small-kg sales to walk-in customers (e.g. starter packs).`);
    }
  }

  if (bagAgg.passThroughBags > 0) {
    const total = bagAgg.totalBags || 1;
    const share = Math.round((bagAgg.passThroughBags / total) * 100);
    if (share >= 50) {
      advice.push(`<strong>${share}% of bag sales were pass-through (no profit).</strong> Promote direct shop sales — flyers, price boards, or a small bulk discount can shift this ratio.`);
    } else if (share >= 25) {
      advice.push(`${share}% of bag sales went through other shops. That's normal, but watch the ratio — direct shop sales make more profit per bag.`);
    }
  }

  const dormant = catalogLinesWithNoBagSales(bagAgg);
  if (dormant.length > 0 && dormant.length <= 6) {
    const items = dormant.slice(0, 4).map((d) => `${d.brand} — ${d.feed} (${d.bagSize} kg)`).join("; ");
    advice.push(`Feed lines with zero bag sales this month: ${items}${dormant.length > 4 ? ` and ${dormant.length - 4} more` : ""}. Consider a small promotion or asking customers what they need.`);
  } else if (dormant.length > 6) {
    advice.push(`${dormant.length} feed lines had zero bag sales this month. Trim slow-moving stock and put the cash into the top sellers.`);
  }

  const monthRows = (state.salesBags || []).filter((r) => rowMatchesYM(r, ym))
    .concat((state.salesKg || []).filter((r) => rowMatchesYM(r, ym)));
  const activeDays = new Set();
  for (const r of monthRows) {
    const p = parseDMYParts(r.date);
    if (p) activeDays.add(`${p.y}-${p.m}-${p.d}`);
  }
  if (activeDays.size > 0) {
    const totalRevenue = bagAgg.totalRevenue + kgAgg.totalRevenue;
    const avg = totalRevenue / activeDays.size;
    advice.push(`Average sales per active day this month: ${currency(avg)} across ${activeDays.size} day${activeDays.size === 1 ? "" : "s"}. Aim a bit higher next month — even 10% extra adds up.`);
  }

  return advice;
}

function renderMonthlyReport() {
  if (state.currentPage !== "monthly-report") return;
  if (state.user?.role !== "owner") return;
  if (state.appInstance !== "amana" && state.appInstance !== "ufaray") return;

  const monthInput = document.getElementById("mrMonth");
  if (monthInput instanceof HTMLInputElement && !monthInput.value) {
    monthInput.value = monthlyReportSelectedYM();
  }
  const ym = monthlyReportSelectedYM();

  const bagAgg = aggregateBagSalesForMonth(ym);
  const kgAgg = aggregateKgSalesForMonth(ym);
  const monthName = monthLabel(ym);
  const totalRevenue = bagAgg.totalRevenue + kgAgg.totalRevenue;

  const titleEl = document.getElementById("mrSummaryTitle");
  if (titleEl) titleEl.textContent = `${monthName} — total recorded revenue`;
  const subEl = document.getElementById("mrSummarySub");
  if (subEl) {
    subEl.textContent = `Combined revenue from every bag and kg sale recorded in ${monthName}.`;
  }
  const amtEl = document.getElementById("mrSummaryAmount");
  if (amtEl) amtEl.textContent = currency(totalRevenue);
  const metaEl = document.getElementById("mrSummaryMeta");
  if (metaEl) {
    const kgPretty = Number(kgAgg.totalKg).toFixed(2);
    metaEl.textContent = `${bagAgg.totalBags} bag${bagAgg.totalBags === 1 ? "" : "s"} sold (${currency(bagAgg.totalRevenue)}) · ${kgPretty} kg sold (${currency(kgAgg.totalRevenue)})`;
  }

  const bagsBody = document.getElementById("mr-bags-body");
  if (bagsBody) {
    if (bagAgg.rows.length === 0) {
      bagsBody.innerHTML = `<tr><td colspan="6" class="empty">No bag sales for ${monthName}.</td></tr>`;
    } else {
      bagsBody.innerHTML = bagAgg.rows
        .slice(0, 10)
        .map((row, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtmlCell(row.brand)}</td>
            <td>${escapeHtmlCell(row.feed)}</td>
            <td>${row.bagSize} kg</td>
            <td>${row.bagsSold}</td>
            <td>${currency(row.revenue)}</td>
          </tr>`)
        .join("");
    }
  }

  const kgBody = document.getElementById("mr-kg-body");
  if (kgBody) {
    if (kgAgg.rows.length === 0) {
      kgBody.innerHTML = `<tr><td colspan="5" class="empty">No kg sales for ${monthName}.</td></tr>`;
    } else {
      kgBody.innerHTML = kgAgg.rows
        .slice(0, 10)
        .map((row, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtmlCell(row.brand)}</td>
            <td>${escapeHtmlCell(row.feed)}</td>
            <td>${Number(row.kg).toFixed(2)}</td>
            <td>${currency(row.revenue)}</td>
          </tr>`)
        .join("");
    }
  }

  const adviceEl = document.getElementById("mrAdvice");
  if (adviceEl) {
    const items = buildMonthlyAdvice(ym, bagAgg, kgAgg);
    if (items.length === 0) {
      adviceEl.innerHTML = `<li class="empty">No advice available for ${monthName} yet.</li>`;
    } else {
      adviceEl.innerHTML = items.map((html) => `<li>${html}</li>`).join("");
    }
  }
}

/** Strip HTML tags from advice strings for PDF rendering. */
function stripHtmlForPdf(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Generates a PDF snapshot of the Monthly Report for the currently selected month. */
function downloadMonthlyReportPdf() {
  if (state.user?.role !== "owner") return;
  if (state.appInstance !== "amana" && state.appInstance !== "ufaray") return;
  const jsPdfNs = window.jspdf;
  const JsPdfCtor = jsPdfNs?.jsPDF;
  if (typeof JsPdfCtor !== "function") {
    alert("PDF generator is not loaded. Refresh and try again.");
    return;
  }

  const ym = monthlyReportSelectedYM();
  const bagAgg = aggregateBagSalesForMonth(ym);
  const kgAgg = aggregateKgSalesForMonth(ym);
  const monthName = monthLabel(ym);
  const totalRevenue = bagAgg.totalRevenue + kgAgg.totalRevenue;
  const businessTitle = state.appInstance === "ufaray" ? "Ufaray Feeds" : "Amana Kuku Feeds";
  const safeBusiness = businessTitle.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const safeMonth = (ym || "").replace(/-/g, "");

  const doc = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });
  const autoTableFn = doc.autoTable || jsPdfNs?.autoTable;
  if (typeof autoTableFn !== "function") {
    alert("PDF table helper is not loaded. Refresh and try again.");
    return;
  }

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const tableW = pageW - 2 * margin;
  const G = { dark: [14, 92, 58], accent: [39, 150, 99], mint: [234, 248, 240], edge: [186, 222, 198] };

  doc.setFillColor(...G.dark);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(businessTitle.toUpperCase(), margin, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("MONTHLY REPORT", margin, 50);
  doc.setFontSize(11);
  doc.text(monthName, pageW - margin, 50, { align: "right" });

  let y = 92;
  doc.setFillColor(...G.mint);
  doc.setDrawColor(...G.edge);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y - 8, tableW, 76, 6, 6, "FD");
  doc.setTextColor(...G.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${monthName} — total recorded revenue`, margin + 12, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...G.accent);
  doc.text(currency(totalRevenue), pageW - margin - 12, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(33, 33, 33);
  const kgPretty = Number(kgAgg.totalKg).toFixed(2);
  doc.text(
    `${bagAgg.totalBags} bag${bagAgg.totalBags === 1 ? "" : "s"} sold (${currency(bagAgg.totalRevenue)})   |   ${kgPretty} kg sold (${currency(kgAgg.totalRevenue)})`,
    margin + 12,
    y + 32,
  );
  doc.text("Combined revenue from every bag and kg sale recorded in the selected month.", margin + 12, y + 50);
  y += 88;

  doc.setTextColor(...G.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Top sellers — Feed Inventory (per bag)", margin, y);
  y += 6;

  const bagBody = bagAgg.rows.length === 0
    ? [["—", `No bag sales for ${monthName}.`, "", "", "", ""]]
    : bagAgg.rows.slice(0, 10).map((row, idx) => [
        String(idx + 1),
        row.brand,
        row.feed,
        `${row.bagSize} kg`,
        String(row.bagsSold),
        `Ksh${formatKshPlainNumber(row.revenue)}`,
      ]);

  autoTableFn.call(doc, {
    head: [["#", "BRAND", "FEED TYPE", "BAG SIZE", "BAGS SOLD", "REVENUE"]],
    body: bagBody,
    startY: y + 6,
    margin: { left: margin, right: margin },
    tableWidth: tableW,
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }, valign: "middle", lineColor: G.edge, lineWidth: 0.2, textColor: [33, 33, 33] },
    headStyles: { fillColor: G.dark, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle", fontSize: 9 },
    columnStyles: {
      0: { halign: "center", cellWidth: 28 },
      1: { halign: "left" },
      2: { halign: "left" },
      3: { halign: "center", cellWidth: 60 },
      4: { halign: "right", cellWidth: 70 },
      5: { halign: "right", cellWidth: 90 },
    },
    alternateRowStyles: { fillColor: [252, 255, 253] },
    theme: "plain",
  });
  y = (doc.lastAutoTable?.finalY || y) + 22;

  if (y > 720) { doc.addPage(); y = 60; }

  doc.setTextColor(...G.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Top sellers — Sales Per Kg", margin, y);
  y += 6;

  const kgBody = kgAgg.rows.length === 0
    ? [["—", `No kg sales for ${monthName}.`, "", "", ""]]
    : kgAgg.rows.slice(0, 10).map((row, idx) => [
        String(idx + 1),
        row.brand,
        row.feed,
        Number(row.kg).toFixed(2),
        `Ksh${formatKshPlainNumber(row.revenue)}`,
      ]);

  autoTableFn.call(doc, {
    head: [["#", "BRAND", "FEED TYPE", "KG SOLD", "REVENUE"]],
    body: kgBody,
    startY: y + 6,
    margin: { left: margin, right: margin },
    tableWidth: tableW,
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }, valign: "middle", lineColor: G.edge, lineWidth: 0.2, textColor: [33, 33, 33] },
    headStyles: { fillColor: G.dark, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle", fontSize: 9 },
    columnStyles: {
      0: { halign: "center", cellWidth: 28 },
      1: { halign: "left" },
      2: { halign: "left" },
      3: { halign: "right", cellWidth: 80 },
      4: { halign: "right", cellWidth: 100 },
    },
    alternateRowStyles: { fillColor: [252, 255, 253] },
    theme: "plain",
  });
  y = (doc.lastAutoTable?.finalY || y) + 22;

  if (y > 700) { doc.addPage(); y = 60; }

  doc.setTextColor(...G.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Advice for next month", margin, y);
  y += 16;

  const adviceLines = buildMonthlyAdvice(ym, bagAgg, kgAgg).map(stripHtmlForPdf);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(33, 33, 33);
  if (adviceLines.length === 0) {
    doc.text("No advice available for this month yet.", margin, y);
  } else {
    for (const line of adviceLines) {
      if (y > 780) { doc.addPage(); y = 60; }
      const wrapped = doc.splitTextToSize(`• ${line}`, tableW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 13 + 4;
    }
  }

  const pageCount = doc.internal.getNumberOfPages();
  const generatedAt = `${state.shopToday || clientShopTodayDMY()}`;
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated ${generatedAt} · ${businessTitle}`, margin, doc.internal.pageSize.getHeight() - 18);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, doc.internal.pageSize.getHeight() - 18, { align: "right" });
  }

  doc.save(`${safeBusiness}-monthly-report-${safeMonth || "month"}.pdf`);
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
    ["cessAccDateDisplay", "cessAccDate", "cessAccOpenCalendarBtn"],
    ["nahashonDateDisplay", "nahashonDate", "nahashonOpenCalendarBtn"],
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

/** Aligns inventory rows to the same catalog line as the UI (brand + feed + bag size). */
function inventoryLineMatchesCatalogProduct(row, catalogBrand, catalogFeedType, catalogBagSize) {
  const bk = resolveBrandKey(catalogBrand);
  if (resolveBrandKey(row.brand) !== bk) return false;
  const bs = Number(catalogBagSize);
  if (!Number.isFinite(bs) || bs <= 0) return false;
  if (Number(row.bag_size) !== bs) return false;
  const wantFt = feedTypeCatalogValue(bk, catalogFeedType);
  const rowFt = feedTypeCatalogValue(bk, row.feed_type);
  if (rowFt === wantFt) return true;
  return normalizeFeedTypeForMatch(row.feed_type) === normalizeFeedTypeForMatch(catalogFeedType);
}

/** Newest inventory row for this catalog line (max id), regardless of array order. */
function findLatestInventoryRowForCatalogLine(rows, catalogBrand, catalogFeedType, catalogBagSize) {
  const bs = Number(catalogBagSize);
  if (!Number.isFinite(bs) || bs <= 0) return null;
  let best = null;
  for (const row of rows || []) {
    if (!inventoryLineMatchesCatalogProduct(row, catalogBrand, catalogFeedType, bs)) continue;
    const id = Number(row.id || 0);
    if (!best || id > Number(best.id || 0)) best = row;
  }
  return best;
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

function sortRowsLatestFirst(rows) {
  return [...rows].sort((a, b) => {
    const ap = parseDMYParts(a?.date);
    const bp = parseDMYParts(b?.date);
    if (ap && bp) {
      const byDate = compareDMYParts(bp, ap);
      if (byDate !== 0) return byDate;
    } else if (ap) {
      return -1;
    } else if (bp) {
      return 1;
    }
    const at = new Date(a?.updated_at || a?.created_at || 0).getTime();
    const bt = new Date(b?.updated_at || b?.created_at || 0).getTime();
    const aTime = Number.isFinite(at) ? at : 0;
    const bTime = Number.isFinite(bt) ? bt : 0;
    if (aTime !== bTime) return bTime - aTime;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });
}

/** Inserts date separators and always renders latest dates first. */
function joinRowsWithDateSeparators(rows, colSpan, buildRowHtml) {
  if (!rows.length) return "";
  const sortedRows = sortRowsLatestFirst(rows);
  const parts = [];
  for (let i = 0; i < sortedRows.length; i++) {
    if (i > 0) {
      const cur = formatDateDMY(sortedRows[i].date).trim();
      const prev = formatDateDMY(sortedRows[i - 1].date).trim();
      if (cur !== prev) parts.push(tableDateSeparatorRow(colSpan));
    }
    parts.push(buildRowHtml(sortedRows[i], i));
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
  if (lower === "amana") return "Amana";
  if (lower === "terry") return "Terry";
  if (lower === "cess") return "Cess";
  if (lower === "rose") return "Rose";
  if (lower === "ufaray") return "Ufaray";
  if (lower === "pigs page") return "Pigs Page";
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
  if (state.appInstance === "ufaray") {
    return ["", "Amana"];
  }
  if (state.appInstance === "amana") {
    const opts = ["", "Ufaray", "Cess"];
    if (state.user?.role === "employee") opts.push("Pigs Page");
    return opts;
  }
  return [""];
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

function fillSimpleSaleTypeSelect(selectEl, selectedValue = "") {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const normalizedSelected = normalizeSaleVia(selectedValue);
  let options;
  let labels;
  if (state.appInstance === "ufaray") {
    options = ["", "Amana"];
    labels = {
      "": "Shop sale (normal)",
      Amana: "Via Amana",
    };
  } else if (state.appInstance === "amana") {
    options = ["", "Ufaray", "Cess"];
    labels = {
      "": "Shop sale (normal)",
      Ufaray: "By Ufaray",
      Cess: "By Cess",
      "Pigs Page": "Via Pigs Page",
    };
    if (state.user?.role === "employee") options.push("Pigs Page");
  } else {
    options = ["", "Ufaray"];
    labels = {
      "": "Shop sale (normal)",
      Ufaray: "By Ufaray",
    };
  }
  const frag = document.createDocumentFragment();
  for (const value of options) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = labels[value] || value;
    frag.appendChild(opt);
  }
  if (normalizedSelected && !options.includes(normalizedSelected)) {
    const opt = document.createElement("option");
    opt.value = normalizedSelected;
    opt.textContent = labels[normalizedSelected] || `By ${normalizedSelected}`;
    frag.appendChild(opt);
  }
  selectEl.innerHTML = "";
  selectEl.appendChild(frag);
  selectEl.value = options.includes(normalizedSelected) ? normalizedSelected : "";
}

function applySaleRecordedForOptions() {
  fillBagSaleViaSelect(document.getElementById("sbSaleType"), document.getElementById("sbSaleType")?.value || "");
  fillSimpleSaleTypeSelect(skSaleType, skSaleType?.value || "");
  fillSimpleSaleTypeSelect(chSaleType, chSaleType?.value || "");
  fillSimpleSaleTypeSelect(fdSaleType, fdSaleType?.value || "");
  fillSimpleSaleTypeSelect(medSaleType, medSaleType?.value || "");
  fillSimpleSaleTypeSelect(gasSaleType, gasSaleType?.value || "");
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
  if (s === "delivered" || s === "cleared") return "Cleared";
  return "Pending";
}

function chickenPaymentClearedValue() {
  return "cleared";
}

function chickenPaymentClearedLabel() {
  return "Cleared";
}

function chickenPaymentIsClearedValue(value) {
  const s = String(value || "").toLowerCase();
  return s === "delivered" || s === "cleared";
}

function configureChickenPaymentStatusOptions() {
  const sel = document.getElementById("chPaymentStatus");
  if (!(sel instanceof HTMLSelectElement)) return;
  const clearedValue = chickenPaymentClearedValue();
  const clearedLabel = chickenPaymentClearedLabel();
  const current = sel.value;
  sel.innerHTML = `
    <option value="pending">Pending</option>
    <option value="${clearedValue}">${clearedLabel}</option>
  `;
  sel.value = chickenPaymentIsClearedValue(current) ? clearedValue : "pending";
}

function chickenSaleDeliveryStatusLabel(row) {
  const ds = String(row.delivery_status || "").toLowerCase().trim();
  if (ds === "delivered") return "Delivered";
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
  const currentPayStatus =
    chickenPaymentIsClearedValue(row.payment_status)
      ? chickenPaymentClearedValue()
      : "pending";
  const currentDeliveryStatus = chickenSaleDeliveryStatusLabel(row) === "Delivered" ? "delivered" : "pending";
  const paymentCell = isOwnerStaffRow
    ? `<div class="row-actions">
         <select data-kind="chicken-pay-status" data-id="${row.id}">
           <option value="pending" ${currentPayStatus === "pending" ? "selected" : ""}>Pending</option>
           <option value="${chickenPaymentClearedValue()}" ${currentPayStatus === chickenPaymentClearedValue() ? "selected" : ""}>${chickenPaymentClearedLabel()}</option>
         </select>
       </div>`
    : escapeHtmlCell(chickenSalePaymentStatusLabel(row));
  const deliveryCell = isOwnerStaffRow
    ? `<div class="row-actions">
         <select data-kind="chicken-delivery-status" data-id="${row.id}">
           <option value="pending" ${currentDeliveryStatus === "pending" ? "selected" : ""}>Pending</option>
           <option value="delivered" ${currentDeliveryStatus === "delivered" ? "selected" : ""}>Delivered</option>
         </select>
         <button type="button" data-kind="chicken-pay-save" data-id="${row.id}">Save</button>
       </div>`
    : escapeHtmlCell(chickenSaleDeliveryStatusLabel(row));
  return `<td>${name}</td><td>${phone}</td><td>${paid}</td><td>${balStr}</td><td>${paymentCell}</td><td>${deliveryCell}</td>`;
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
  if (!sel || !chickenPaymentIsClearedValue(sel.value)) return;
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

/** Profit for this row: margin × chicks for staff only when Payments are Cleared; owner inventory lines stay KES 0. */
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
  applySaleRecordedForOptions();
  landingCard?.classList.add("hidden");
  nahahDashboardCard?.classList.add("hidden");
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  vehicleLoginCard?.classList.add("hidden");
  vehicleAppCard?.classList.add("hidden");
  if (state.appInstance === "shop" && state.user.role === "owner") {
    userInfo.textContent = "CessTerry(owner)";
  } else {
    userInfo.textContent = `${state.user.fullName} (${state.user.role})`;
  }
  const isOwner = state.user.role === "owner";
  document.querySelectorAll(".owner-only-tab").forEach((el) => {
    const isCalculatorTab = el instanceof HTMLElement && el.dataset?.page === "calculator";
    const allowCalculatorForStaff = isCalculatorTab && staffMayAccessCalculatorTenant();
    el.classList.toggle("hidden", !(isOwner || allowCalculatorForStaff));
  });
  document.querySelectorAll(".owner-only-highlight").forEach((el) => {
    el.classList.toggle("hidden", !isOwner);
  });
  document.querySelectorAll(".amana-only-bag-cess-block").forEach((el) => {
    el.classList.toggle("hidden", !isOwner || state.appInstance !== "amana");
  });
  document.querySelectorAll(".amana-only-bag-pigs-block").forEach((el) => {
    el.classList.toggle("hidden", !isOwner || state.appInstance !== "amana");
  });
  document.querySelectorAll(".employee-only-action").forEach((el) => {
    el.classList.toggle("hidden", state.user.role !== "employee");
  });
  if (roseInventoryTabLabel) {
    roseInventoryTabLabel.textContent =
      state.appInstance === "rose"
        ? "Rose Inventory"
        : state.appInstance === "terry"
          ? "Terry Records"
          : state.appInstance === "cess" || state.appInstance === "maina-faith-cess" || state.appInstance === "terry-and-cess"
            ? "Records"
            : "Rose Inventory";
  }
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    const page = btn.dataset.page;
    const isOwnerSalesPageHiddenForTenant =
      (state.appInstance === "ufaray" || state.appInstance === "amana") &&
      isOwner &&
      (page === "sales-bags" || page === "sales-kg");
    const recordsTenant = isRecordsTenant();
    const terryCessShopTenant = isTerryCessOrShopTenant();
    let shouldShow = isOwnerSalesPageHiddenForTenant
      ? false
      : state.appInstance === "terry"
      ? page === "rose-inventory" || page === "nahashon-records" || page === "calculator"
      : state.appInstance === "cess" ||
          state.appInstance === "maina-faith-cess" ||
          state.appInstance === "terry-and-cess"
      ? page === "rose-inventory" || page === "calculator"
      : state.appInstance === "shop"
      ? page === "inventory" || page === "sales-bags" || page === "calculator"
      : terryCessShopTenant
      ? page === "inventory"
      : recordsTenant
      ? page === "rose-inventory"
      : page === "rose-inventory"
        ? false
        : isOwner
          ? OWNER_ALLOWED_PAGES.has(page)
          : !OWNER_INVENTORY_PAGES.has(page);
    if (!isOwner && page === "calculator" && staffMayAccessCalculatorTenant()) {
      shouldShow = true;
    }
    if (page === "cess-accounts") {
      shouldShow = state.appInstance === "amana" && isOwner;
    }
    if (page === "nahashon-records") {
      shouldShow = state.appInstance === "terry";
    }
    if (page === "pigs") {
      shouldShow = state.appInstance === "amana" && isOwner;
    }
    if (page === "monthly-report") {
      shouldShow = isOwner && (state.appInstance === "amana" || state.appInstance === "ufaray");
    }
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
  const prev = selectEl instanceof HTMLSelectElement ? selectEl.value : "";
  selectEl.innerHTML = '<option value="">Select brand</option>';
  Object.keys(state.catalog).forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = displayBrand(brand);
    selectEl.appendChild(option);
  });
  if (prev && [...selectEl.options].some((o) => o.value === prev)) {
    selectEl.value = prev;
  }
}

function populateBrands() {
  populateBrandSelect(brandSelect);
}

function populateFeedTypes(brand, preferredFeedType = "") {
  const brandKey = resolveBrandKey(brand);
  const prevFeed = preferredFeedType || feedTypeSelect.value;
  feedTypeSelect.innerHTML = '<option value="">Select feed type</option>';
  if (!brandKey || !state.catalog[brandKey]) {
    feedTypeSelect.disabled = true;
    bagSizeInput.value = "";
    return;
  }

  state.catalog[brandKey].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.type;
    option.textContent = displayFeedType(item.type);
    feedTypeSelect.appendChild(option);
  });
  feedTypeSelect.disabled = false;
  const canonPrev = prevFeed ? feedTypeCatalogValue(brandKey, prevFeed) : "";
  if (canonPrev && [...feedTypeSelect.options].some((o) => o.value === canonPrev)) {
    feedTypeSelect.value = canonPrev;
    bagSizeInput.value = bagSizeFor(brandKey, canonPrev);
  } else {
    bagSizeInput.value = "";
  }
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

function populateSkFeedTypes(brand, preferredFeedType = "") {
  const brandKey = resolveBrandKey(brand);
  const prevFeed = preferredFeedType || skFeedType.value;
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
  const canonPrev = prevFeed ? feedTypeCatalogValue(brandKey, prevFeed) : "";
  if (canonPrev && [...skFeedType.options].some((o) => o.value === canonPrev)) {
    skFeedType.value = canonPrev;
  }
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

/** Rows used to resolve Feed Inventory selling price for staff chick sales (full inventory for owner, pricing snapshot for staff). */
function chickenFeedInventoryRowsForPriceLookup() {
  if (state.user?.role === "employee") return state.inventoryPricing || [];
  return state.records || [];
}

function populateChChickenFeedTypes(brand) {
  if (!chFeedType) return;
  const cur = chFeedType.value;
  const brandKey = resolveBrandKey(brand);
  chFeedType.innerHTML = '<option value="">Select feed type</option>';
  if (!brandKey || !state.catalog[brandKey]) {
    chFeedType.disabled = true;
    syncChEmployeeBundledFeedAmount();
    return;
  }
  state.catalog[brandKey].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.type;
    option.textContent = displayFeedType(item.type);
    chFeedType.appendChild(option);
  });
  chFeedType.disabled = false;
  if (cur && [...chFeedType.options].some((o) => o.value === cur)) chFeedType.value = cur;
  syncChEmployeeBundledFeedAmount();
}

function syncChEmployeeBundledFeedAmount() {
  if (!chFeedBrand || !chFeedType || !chFeedBagQty || !chFeedLineTotal) return;
  if (state.user?.role !== "employee") return;
  const brand = String(chFeedBrand.value || "").trim();
  const ft = String(chFeedType.value || "").trim();
  const bags = Math.floor(Number(chFeedBagQty.value || 0));
  if (!Number.isFinite(bags) || bags < 0) {
    chFeedLineTotal.value = "";
    return;
  }
  if (!brand || !ft) {
    chFeedLineTotal.value = "";
    return;
  }
  const bs = bagSizeFor(brand, ft);
  if (!Number.isFinite(bs) || bs <= 0) {
    chFeedLineTotal.value = "";
    return;
  }
  const inv = findLatestInventoryRowForCatalogLine(chickenFeedInventoryRowsForPriceLookup(), brand, ft, bs);
  if (!inv) {
    chFeedLineTotal.value = "";
    return;
  }
  const unit = Number(inv.selling_price);
  if (!Number.isFinite(unit)) {
    chFeedLineTotal.value = "";
    return;
  }
  chFeedLineTotal.value = (bags * unit).toFixed(2);
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
  const staffUser =
    state.editSalesKgId != null
      ? String(state.salesKg.find((r) => String(r.id) === String(state.editSalesKgId))?.created_by ?? "").trim()
      : String(state.user?.username ?? "").trim();
  const filtered = [];
  for (const r of state.salesKg || []) {
    if (feedTypeCatalogValue(resolveBrandKey(r.brand), r.feed_type) !== ftWant) continue;
    if (staffUser && String(r.created_by ?? "").trim() !== staffUser) continue;
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
    let bagOpenedStep = Math.max(0, Math.floor(Number(r.bag_opened || 0)));
    if (pool > 1e-6 && bagOpenedStep > 0) bagOpenedStep = 0;
    pool += bagOpenedStep * bagSize;
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

/** Sum kg_sold for this product on the selected date (excludes the row being edited). */
function sumKgSoldForSkLine(dateStr, brand, feedType) {
  if (!dateStr || !brand || !feedType) return 0;
  const bk = resolveBrandKey(brand);
  const ftWant = feedTypeCatalogValue(bk, feedType);
  let sum = 0;
  for (const r of state.salesKg || []) {
    if (String(r.date).trim() !== String(dateStr).trim()) continue;
    if (resolveBrandKey(r.brand) !== bk) continue;
    if (feedTypeCatalogValue(bk, r.feed_type) !== ftWant) continue;
    if (state.editSalesKgId && String(r.id) === String(state.editSalesKgId)) continue;
    sum += Number(r.kg_sold || 0);
  }
  return sum;
}

/** Default bag opened: 0 while remaining kg in the current open bag > 0; 1 once the bag is consumed.
 *  For employees the field is locked (readonly) — the system decides automatically. */
function applyDefaultSkBagOpened() {
  const el = document.getElementById("skBagOpened");
  if (!el) return;
  const isEmployee = state.user?.role === "employee";
  if (state.editSalesKgId) {
    el.readOnly = isEmployee;
    return;
  }
  const dateStr = skDateDisplay?.value?.trim();
  if (!dateStr || !isValidDMY(dateStr)) return;
  if (!skBrand?.value || !skFeedType?.value) return;
  const bagSize = skEffectiveKgPerOpenedBagForSkRow(skBrand.value, skFeedType.value);
  if (!bagSize || bagSize <= 0) { el.value = "1"; el.readOnly = isEmployee; return; }
  const carry = skCarryoverKgBeforeSelectedDate(dateStr, skBrand.value, skFeedType.value);
  const bagsOpenedToday = sumBagOpenedForSkLine(dateStr, skBrand.value, skFeedType.value);
  const kgSoldToday = sumKgSoldForSkLine(dateStr, skBrand.value, skFeedType.value);
  const remaining = carry + (bagsOpenedToday * bagSize) - kgSoldToday;
  el.value = remaining > 1e-6 ? "0" : "1";
  el.readOnly = isEmployee;
}

/** Employee sales: selling price for this catalog line (newest inventory row by id). */
function findInventorySellingPrice(brand, feedType, bagSize) {
  const row = findLatestInventoryRowForCatalogLine(state.inventoryPricing, brand, feedType, bagSize);
  if (!row) return null;
  const sp = Number(row.selling_price);
  return Number.isFinite(sp) ? sp : null;
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
    el.value = formatMoneyForInput(rp);
    updateSalesKgOwnerWeightHint();
    return;
  }
  const bagKg = bagSizeFor(skBrand.value, skFeedType.value);
  const sp = findInventorySellingPrice(skBrand.value, skFeedType.value, bagKg);
  if (sp != null && bagKg > 0) {
    const perKg = roundMoney(sp / bagKg);
    el.value = Number.isFinite(perKg) ? formatMoneyForInput(perKg) : "";
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
  syncOwnerLineProfitMargin("chBuyingPrice", "chSellingPrice", "chProfitMarginPerChick");
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
    syncChEmployeeBundledFeedAmount();
  }
}

function statusLabel(row) {
  return row.quantity_in_stock <= row.reorder_level
    ? '<span class="status-low">REORDER</span>'
    : '<span class="status-ok">OK</span>';
}

function updateInventoryStockFieldsMode() {
  const editing = state.editId != null && Number(state.editId) > 0;
  if (quantityInput) {
    quantityInput.readOnly = !editing;
    quantityInput.required = editing;
  }
  const accBagsEl = document.getElementById("accumulatedBags");
  if (accBagsEl instanceof HTMLInputElement) {
    accBagsEl.readOnly = !editing;
  }
  if (bagsBoughtInput) {
    bagsBoughtInput.readOnly = false;
    bagsBoughtInput.required = !editing;
  }
}

function resetForm() {
  form.reset();
  state.editId = null;
  inventoryPricesDirty = false;
  dateDisplayInput.value = "";
  feedTypeSelect.innerHTML = '<option value="">Select feed type</option>';
  feedTypeSelect.disabled = true;
  bagSizeInput.value = "";
  buyingPriceInput.value = "0.00";
  sellingPriceInput.value = "0.00";
  profitMarginPerBagInput.value = "0.00";
  if (reorderLevelInput) reorderLevelInput.value = "0";
  document.getElementById("accumulatedProfit").value = "0";
  document.getElementById("accumulatedBags").value = "";
  if (bagsBoughtInput) bagsBoughtInput.value = "";
  if (quantityInput) quantityInput.value = "";
  setInventoryPriceEditMode(true);
  document.getElementById("saveBtn").textContent = "Save Record";
  updateInventoryStockFieldsMode();
}

/** Keep Feed Inventory form values when background data refresh runs while the owner is typing. */
function captureInventoryFormDraft() {
  if (state.user?.role !== "owner" || state.currentPage !== "inventory" || !form) return null;
  const editing = state.editId != null && Number(state.editId) > 0;
  const brand = brandSelect?.value || "";
  const bagsRaw = bagsBoughtInput?.value != null ? String(bagsBoughtInput.value).trim() : "";
  const buyingRaw = buyingPriceInput?.value != null ? String(buyingPriceInput.value).trim() : "";
  const hasDraft =
    editing ||
    brand ||
    bagsRaw !== "" ||
    (buyingRaw !== "" && buyingRaw !== "0" && buyingRaw !== "0.00");
  if (!hasDraft) return null;
  const accEl = document.getElementById("accumulatedBags");
  return {
    editId: state.editId,
    dateDisplay: dateDisplayInput?.value ?? "",
    dateIso: dateInput?.value ?? "",
    brand,
    feedType: feedTypeSelect?.value ?? "",
    bagSize: bagSizeInput?.value ?? "",
    bagsBought: bagsBoughtInput?.value ?? "",
    quantity: quantityInput?.value ?? "",
    accumulatedBags: accEl instanceof HTMLInputElement ? accEl.value : "",
    buying: buyingPriceInput?.value ?? "",
    selling: sellingPriceInput?.value ?? "",
    reorder: reorderLevelInput?.value ?? "",
    accumulatedProfit: document.getElementById("accumulatedProfit")?.value ?? "",
    pricesDirty: inventoryPricesDirty,
    saveBtnText: document.getElementById("saveBtn")?.textContent || "Save Record",
  };
}

/** Keep Sales Per Kg form values when background data refresh runs while the user is typing. */
function captureSalesKgFormDraft() {
  if (state.currentPage !== "sales-kg" || !salesKgForm) return null;
  const priceEl = document.getElementById("skPricePerKg");
  const kgEl = document.getElementById("skKgSold");
  const brand = skBrand?.value || "";
  const kgRaw = kgEl instanceof HTMLInputElement ? String(kgEl.value).trim() : "";
  const priceRaw = priceEl instanceof HTMLInputElement ? String(priceEl.value).trim() : "";
  const editing = state.editSalesKgId != null;
  if (!editing && !brand && !kgRaw && !priceRaw) return null;
  const bagEl = document.getElementById("skBagOpened");
  return {
    editSalesKgId: state.editSalesKgId,
    dateDisplay: skDateDisplay?.value ?? "",
    dateIso: skDate?.value ?? "",
    brand,
    feedType: skFeedType?.value ?? "",
    bagOpened: bagEl instanceof HTMLInputElement ? bagEl.value : "",
    kgSold: kgRaw,
    pricePerKg: priceRaw,
    saleType: skSaleType?.value ?? "",
    saveBtnText: document.getElementById("skSaveBtn")?.textContent || "Save sale",
  };
}

function restoreSalesKgFormDraft(draft) {
  if (!draft) return;
  state.editSalesKgId = draft.editSalesKgId;
  if (skDateDisplay) skDateDisplay.value = draft.dateDisplay;
  if (skDate) skDate.value = draft.dateIso;
  if (skBrand && draft.brand) {
    skBrand.value = draft.brand;
    populateSkFeedTypes(draft.brand, draft.feedType);
  }
  const bagEl = document.getElementById("skBagOpened");
  if (bagEl instanceof HTMLInputElement) bagEl.value = draft.bagOpened;
  const kgEl = document.getElementById("skKgSold");
  if (kgEl instanceof HTMLInputElement) kgEl.value = draft.kgSold;
  const priceEl = document.getElementById("skPricePerKg");
  if (priceEl instanceof HTMLInputElement) priceEl.value = draft.pricePerKg;
  if (skSaleType) skSaleType.value = draft.saleType;
  const saveBtn = document.getElementById("skSaveBtn");
  if (saveBtn) saveBtn.textContent = draft.saveBtnText;
}

function restoreInventoryFormDraft(draft) {
  if (!draft) return;
  state.editId = draft.editId;
  inventoryPricesDirty = !!draft.pricesDirty;
  if (dateDisplayInput) dateDisplayInput.value = draft.dateDisplay;
  if (dateInput) dateInput.value = draft.dateIso;
  if (brandSelect && draft.brand) {
    brandSelect.value = draft.brand;
    populateFeedTypes(draft.brand, draft.feedType);
    if (feedTypeSelect && draft.feedType) {
      const brandKey = resolveBrandKey(draft.brand);
      const canon = feedTypeCatalogValue(brandKey, draft.feedType);
      if ([...feedTypeSelect.options].some((o) => o.value === canon)) feedTypeSelect.value = canon;
    }
  }
  if (bagSizeInput) {
    bagSizeInput.value =
      draft.bagSize ||
      (draft.brand && draft.feedType ? String(bagSizeFor(draft.brand, draft.feedType) || "") : "");
  }
  if (bagsBoughtInput) bagsBoughtInput.value = draft.bagsBought;
  if (quantityInput) quantityInput.value = draft.quantity;
  const accEl = document.getElementById("accumulatedBags");
  if (accEl instanceof HTMLInputElement) accEl.value = draft.accumulatedBags;
  if (buyingPriceInput) buyingPriceInput.value = draft.buying;
  if (sellingPriceInput) sellingPriceInput.value = draft.selling;
  if (reorderLevelInput) reorderLevelInput.value = draft.reorder;
  const accProfitEl = document.getElementById("accumulatedProfit");
  if (accProfitEl instanceof HTMLInputElement) accProfitEl.value = draft.accumulatedProfit;
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.textContent = draft.saveBtnText;
  updateInventoryStockFieldsMode();
  syncInventoryProfitMarginFromPrices();
}

/** Profit margin from buying vs selling (two decimal places). */
function computeMarginFromBuySell(buy, sell) {
  const b = Number(buy);
  const s = Number(sell);
  if (!Number.isFinite(b) || !Number.isFinite(s)) return null;
  return Math.round((s - b) * 100) / 100;
}

function syncOwnerLineProfitMargin(buyInputId, sellInputId, marginInputId) {
  const buyEl = document.getElementById(buyInputId);
  const sellEl = document.getElementById(sellInputId);
  const marginEl = document.getElementById(marginInputId);
  if (!(buyEl instanceof HTMLInputElement) || !(sellEl instanceof HTMLInputElement) || !(marginEl instanceof HTMLInputElement)) return;
  const m = computeMarginFromBuySell(buyEl.value, sellEl.value);
  marginEl.value = m != null ? formatMoneyForInput(m) : "0.00";
}

/** Retail margin per kg = retail price per kg − (Feed Inventory buying price per bag ÷ bag kg). */
function syncRetailFeedMarginFromPrices() {
  if (state.user?.role !== "owner") return;
  const brandEl = document.getElementById("rfBrand");
  const ftEl = document.getElementById("rfFeedType");
  const priceEl = document.getElementById("rfPricePerKg");
  const marginEl = document.getElementById("rfMarginPerKg");
  if (!(brandEl instanceof HTMLSelectElement) || !(ftEl instanceof HTMLSelectElement)) return;
  if (!(priceEl instanceof HTMLInputElement) || !(marginEl instanceof HTMLInputElement)) return;
  const brand = String(brandEl.value || "").trim();
  const ft = String(ftEl.value || "").trim();
  const retail = Number(priceEl.value);
  if (!brand || !ft) {
    marginEl.value = "";
    return;
  }
  const brandKey = resolveBrandKey(brand);
  const ftCanon = feedTypeCatalogValue(brandKey, ft);
  const bagKg = bagSizeFor(brandKey, ftCanon);
  const buyPerBag = findInventoryBuyingPriceForCalculator(brandKey, ftCanon, bagKg);
  if (!Number.isFinite(bagKg) || bagKg <= 0 || buyPerBag == null || !Number.isFinite(Number(buyPerBag))) {
    marginEl.value = Number.isFinite(retail) && String(priceEl.value || "").trim() !== "" ? "0.00" : "";
    return;
  }
  const costPerKg = roundMoney(Number(buyPerBag) / bagKg);
  const m = Number.isFinite(retail) ? roundMoney(retail - costPerKg) : NaN;
  marginEl.value = Number.isFinite(m) ? formatMoneyForInput(m) : "0.00";
}

function syncInventoryProfitMarginFromPrices() {
  const buying = parseMoneyFromInput(buyingPriceInput?.value);
  const selling = parseMoneyFromInput(sellingPriceInput?.value);
  const margin = computeMarginFromBuySell(buying, selling);
  if (!profitMarginPerBagInput) return;
  profitMarginPerBagInput.value = margin != null ? formatMoneyForInput(margin) : "0.00";
}

function setInventoryPriceEditMode(editable) {
  const canEdit = !!editable;
  if (buyingPriceInput) buyingPriceInput.readOnly = !canEdit;
  if (sellingPriceInput) sellingPriceInput.readOnly = !canEdit;
  if (editPricesBtn) editPricesBtn.textContent = canEdit ? "Lock prices" : "Edit prices";
}

function findLatestInventoryPriceLine(brand, feedType, bagSize) {
  const bKey = resolveBrandKey(brand);
  const wantCanon = feedTypeCatalogValue(bKey, feedType);
  const bs = Number(bagSize || 0);
  if (!bKey || !String(feedType || "").trim()) return null;
  let latestExactBag = null;
  let latestAnyBag = null;
  for (const row of state.records || []) {
    if (resolveBrandKey(row.brand) !== bKey) continue;
    const rowCanon = feedTypeCatalogValue(bKey, row.feed_type);
    if (
      rowCanon !== wantCanon &&
      normalizeFeedTypeForMatch(row.feed_type) !== normalizeFeedTypeForMatch(feedType)
    )
      continue;
    if (!latestAnyBag || Number(row.id || 0) > Number(latestAnyBag.id || 0)) latestAnyBag = row;
    if (Number.isFinite(bs) && bs > 0 && Number(row.bag_size || 0) === bs) {
      if (!latestExactBag || Number(row.id || 0) > Number(latestExactBag.id || 0)) {
        latestExactBag = row;
      }
    }
  }
  return latestExactBag || latestAnyBag;
}

function applyInventoryPriceDefaults(force = false) {
  if (state.user?.role !== "owner") return;
  if (!force && state.editId != null) return;
  if (!force && inventoryPricesDirty) return;
  const brand = brandSelect.value;
  const feedType = feedTypeSelect.value;
  const bagSize = Number(bagSizeInput.value || 0);
  if (!brand || !feedType || !Number.isFinite(bagSize) || bagSize <= 0) {
    if (state.editId == null) {
      buyingPriceInput.value = "0.00";
      sellingPriceInput.value = "0.00";
      if (reorderLevelInput) reorderLevelInput.value = "0";
      syncInventoryProfitMarginFromPrices();
      setInventoryPriceEditMode(true);
    }
    return;
  }
  const latest = findLatestInventoryPriceLine(brand, feedType, bagSize);
  if (latest) {
    buyingPriceInput.value = formatMoneyForInput(latest.buying_price || 0);
    sellingPriceInput.value = formatMoneyForInput(latest.selling_price || 0);
    if (reorderLevelInput) reorderLevelInput.value = String(Number(latest.reorder_level || 0));
  } else if (state.editId == null) {
    buyingPriceInput.value = "0.00";
    sellingPriceInput.value = "0.00";
    if (reorderLevelInput) reorderLevelInput.value = "0";
  }
  syncInventoryProfitMarginFromPrices();
  setInventoryPriceEditMode(true);
}

function renderOwnerPassThroughBagSalesTable(tbody, rows, kindPrefix, emptyHtml) {
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty">${emptyHtml}</td></tr>`;
    return;
  }
  tbody.innerHTML = joinRowsWithDateSeparators(rows, 11, (row) => {
    const viaRaw = normalizeSaleVia(row.through_party);
    const viaCell = viaRaw ? `By ${viaRaw}` : "—";
    const stRaw = String(row.pass_through_status || "pending").toLowerCase();
    const status = stRaw === "cleared" || stRaw === "solved" ? "cleared" : "pending";
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
          <select data-kind="${kindPrefix}-status" data-id="${row.id}">
            <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
            <option value="cleared" ${status === "cleared" ? "selected" : ""}>Cleared</option>
          </select>
        </td>
        <td>${row.created_by}</td>
        <td>
          <button type="button" data-kind="${kindPrefix}-edit" data-id="${row.id}">Edit</button>
          <button type="button" data-kind="${kindPrefix}-delete" data-id="${row.id}">Delete</button>
          <button type="button" data-kind="${kindPrefix}-status-save" data-id="${row.id}">Save</button>
        </td>
      </tr>`;
  });
}

function renderOwnerPassThroughBagSales() {
  const tbodyUfaray = document.getElementById("ufaray-bag-sales-body");
  const tbodyCess = document.getElementById("cess-bag-sales-body");
  if (!tbodyUfaray) return;
  if (state.user.role !== "owner" || state.currentPage !== "inventory") return;
  const bags = state.salesBags || [];
  const primaryRows = bags.filter((r) => {
    const tp = normalizeSaleVia(r.through_party);
    if (state.appInstance === "amana") return tp === "Ufaray";
    return tp === "Amana";
  });
  const primaryEmpty =
    state.appInstance === "amana"
      ? "No Via Ufaray Feeds bag sales yet. Staff record these under Sales Per Bags with Sale recorded for set to By Ufaray."
      : "No pass-through bag sales yet. Staff record these under Sales Per Bags using Sale recorded for (Via Amana).";
  renderOwnerPassThroughBagSalesTable(tbodyUfaray, primaryRows, "ufaray", primaryEmpty);
  if (tbodyCess && state.appInstance === "amana") {
    const cessRows = bags.filter((r) => normalizeSaleVia(r.through_party) === "Cess");
    renderOwnerPassThroughBagSalesTable(
      tbodyCess,
      cessRows,
      "cess",
      "No Via Cess Accounts bag sales yet. Staff record these under Sales Per Bags with Sale recorded for set to By Cess."
    );
  }
  const tbodyPigs = document.getElementById("pigs-bag-sales-body");
  if (tbodyPigs && state.appInstance === "amana") {
    const pigsRows = bags.filter((r) => normalizeSaleVia(r.through_party) === "Pigs Page");
    renderOwnerPassThroughBagSalesTable(
      tbodyPigs,
      pigsRows,
      "pigs-bag",
      "No Via Pigs Page bag sales yet. Staff record these under Sales Per Bags with Sale recorded for set to Via Pigs Page."
    );
  }
}

function renderOwnerUfarayChickenSales() {
  const tbody = document.getElementById("ufaray-chicken-sales-body");
  if (!tbody) return;
  if (state.user.role !== "owner" || state.currentPage !== "chicken-inventory") return;
  const rows = (state.chickenSales || []).filter((r) => String(r.through_party || "").trim() !== "");
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty">No Ufaray chicken sales yet.</td></tr>';
    return;
  }
  tbody.innerHTML = joinRowsWithDateSeparators(rows, 11, (row) => {
    const qty = Number(row.quantity_birds) || 0;
    const unit = Number(row.unit_price) || 0;
    const margin = Number(row.margin_snap) || 0;
    const buyingPerChick = Math.max(0, unit - margin);
    const totalAmount = qty * buyingPerChick;
    const feedCells = chickenSaleBundledFeedCellsHtml(row, false);
    const status =
      String(row.pass_through_status || "pending").toLowerCase() === "cleared" ||
      String(row.pass_through_status || "pending").toLowerCase() === "solved"
        ? "cleared"
        : "pending";
    return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${qty}</td>
        ${feedCells}
        <td>${currency(buyingPerChick)}</td>
        <td>${currency(totalAmount)}</td>
        <td>
          <select data-kind="ufaray-ch-status" data-id="${row.id}">
            <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
            <option value="cleared" ${status === "cleared" ? "selected" : ""}>Cleared</option>
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
    const status =
      String(row.pass_through_status || "pending").toLowerCase() === "cleared" ||
      String(row.pass_through_status || "pending").toLowerCase() === "solved"
        ? "cleared"
        : "pending";
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
          <option value="cleared" ${status === "cleared" ? "selected" : ""}>Cleared</option>
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
    const status =
      String(row.pass_through_status || "pending").toLowerCase() === "cleared" ||
      String(row.pass_through_status || "pending").toLowerCase() === "solved"
        ? "cleared"
        : "pending";
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
          <option value="cleared" ${status === "cleared" ? "selected" : ""}>Cleared</option>
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
    const status =
      String(row.pass_through_status || "pending").toLowerCase() === "cleared" ||
      String(row.pass_through_status || "pending").toLowerCase() === "solved"
        ? "cleared"
        : "pending";
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
          <option value="cleared" ${status === "cleared" ? "selected" : ""}>Cleared</option>
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
    tableBody.innerHTML = '<tr><td colspan="16" class="empty">No records.</td></tr>';
    return;
  }

  tableBody.innerHTML = joinRowsWithDateSeparators(state.records, 16, (row) => {
    const canDelete = state.user.role === "owner";
    const lineCumulative = currency(row.cumulative_bag_profit ?? 0);
    const ufarayBags = Number(row.bags_sold_pass_through ?? 0);
    const accBags = row.accumulated_bags != null ? row.accumulated_bags : row.quantity_in_stock;
    const bagsBought = row.bags_bought != null ? row.bags_bought : 0;
    return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td>${row.bag_size} kg</td>
        <td>${bagsBought}</td>
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
        <td title="Full bags completed through this line (increases by 1 only when accumulated kg in the current bag reaches the full bag size, e.g. 50 kg).">${bagsFromKg}</td>
        <td title="Kg on this row for this day (after merges): ${Number(row.kg_sold ?? 0)}. Kg sold from the current open bag (resets to 0 when a full bag of ${skEffectiveKgPerOpenedBagForSkRow(row.brand, row.feed_type) || "—"} kg is used): ${Number(row.accumulated_kg_sold ?? 0)}.">${row.accumulated_kg_sold != null ? row.accumulated_kg_sold : "—"}</td>
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
  syncOwnerLineProfitMargin("fdBuyingPrice", "fdSellingPrice", "fdProfitMargin");
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
  syncOwnerLineProfitMargin("medBuyingPrice", "medSellingPrice", "medProfitMargin");
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
  syncOwnerLineProfitMargin("gasBuyingPrice", "gasSellingPrice", "gasProfitMargin");
}

function normalizeExpenditureCategory(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s === "operational costs" || s === "operational" || s === "ops") return "Operational costs";
  return "Other";
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
        <td>${escapeHtmlCell(normalizeExpenditureCategory(row.category))}</td>
        <td>${currency(row.money_out)}</td>
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
    calcBody.innerHTML = '<tr><td colspan="7" class="empty">No feed catalog loaded.</td></tr>';
    updateCalculatorGrandTotalDisplay();
    return;
  }
  calcBody.innerHTML = rows
    .map(
      (row) => {
        const rowKey = calculatorRowKey(row.brand, row.feedType, row.bagSize);
        const remembered = state.calculatorValues[rowKey];
        const defaultBuying = findInventoryBuyingPriceForCalculator(row.brand, row.feedType, row.bagSize);
        const defaultSelling = findInventorySellingPriceForCalculator(row.brand, row.feedType, row.bagSize);
        // Calculator prices should always reflect Feed Inventory latest values for this product.
        const buyingValue = defaultBuying != null ? String(defaultBuying) : "";
        const sellingValue = defaultSelling != null ? String(defaultSelling) : "";
        return `
      <tr data-calc-brand="${escapeHtmlCell(row.brand)}" data-calc-feed-type="${escapeHtmlCell(row.feedType)}" data-calc-bag-size="${row.bagSize}">
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feedType)}</td>
        <td>${row.bagSize}</td>
        <td><input type="text" data-kind="calc-bags" inputmode="numeric" placeholder="Bags" value="${escapeHtmlCell(remembered?.bags || "")}" /></td>
        <td><input type="text" data-kind="calc-buying" inputmode="decimal" placeholder="Buying price" value="${escapeHtmlCell(buyingValue)}" /></td>
        <td><input type="text" data-kind="calc-selling" inputmode="decimal" placeholder="Selling price" value="${escapeHtmlCell(sellingValue)}" /></td>
        <td class="js-calc-row-total">${currency(0)}</td>
      </tr>`;
      }
    )
    .join("");
  updateCalculatorGrandTotalDisplay();
  if (activeKey && (activeKind === "calc-bags" || activeKind === "calc-buying" || activeKind === "calc-selling")) {
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
  const catEl = document.getElementById("expCategory");
  if (catEl instanceof HTMLSelectElement) catEl.value = "Other";
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
  const rows = sortRowsLatestFirst(state.roseEntries || []);
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

function resetCessAccountsForm() {
  if (!cessAccountsForm) return;
  cessAccountsForm.reset();
  state.editCessAccountsId = null;
  if (cessAccDate) cessAccDate.value = "";
  if (cessAccDateDisplay) cessAccDateDisplay.value = "";
  const via = document.getElementById("cessAccSaleVia");
  if (via) via.value = "Shop";
  const saveBtn = document.getElementById("cessAccSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
}

function renderCessAccountsTable() {
  if (!cessAccountsBody) return;
  const rows = sortRowsLatestFirst(state.cessAccountsEntries || []);
  if (!rows.length) {
    cessAccountsBody.innerHTML = '<tr><td colspan="9" class="empty">No records.</td></tr>';
    const inEl = document.getElementById("cessAccTotalMoneyIn");
    const outEl = document.getElementById("cessAccTotalMoneyOut");
    if (inEl) inEl.textContent = "0";
    if (outEl) outEl.textContent = "0";
    return;
  }
  let sumIn = 0;
  let sumOut = 0;
  cessAccountsBody.innerHTML = rows
    .map((row, idx) => {
      sumIn += Number(row.money_in || 0);
      sumOut += Number(row.money_out || 0);
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDMY(row.date)}</td>
        <td>${escapeHtmlCell(row.description)}</td>
        <td>${Number(row.quantity || 0)}</td>
        <td>${Number(row.unit_price || 0)}</td>
        <td>${Number(row.money_in || 0)}</td>
        <td>${Number(row.money_out || 0)}</td>
        <td>${escapeHtmlCell(row.sale_via || "Shop")}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="cess-acc" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="cess-acc" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  const inEl = document.getElementById("cessAccTotalMoneyIn");
  const outEl = document.getElementById("cessAccTotalMoneyOut");
  if (inEl) inEl.textContent = String(sumIn);
  if (outEl) outEl.textContent = String(sumOut);
}

function resetNahashonForm() {
  if (!nahashonForm) return;
  nahashonForm.reset();
  state.editNahashonId = null;
  if (nahashonDate) nahashonDate.value = "";
  if (nahashonDateDisplay) nahashonDateDisplay.value = "";
  const via = document.getElementById("nahashonSaleVia");
  if (via) via.value = "Shop";
  const saveBtn = document.getElementById("nahashonSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
}

function renderNahashonTable() {
  if (!nahashonBody) return;
  const rows = sortRowsLatestFirst(state.nahashonEntries || []);
  if (!rows.length) {
    nahashonBody.innerHTML = '<tr><td colspan="10" class="empty">No records.</td></tr>';
    const inEl = document.getElementById("nahashonTotalMoneyIn");
    const outEl = document.getElementById("nahashonTotalMoneyOut");
    const mortEl = document.getElementById("nahashonTotalMortality");
    if (inEl) inEl.textContent = "0";
    if (outEl) outEl.textContent = "0";
    if (mortEl) mortEl.textContent = "0";
    return;
  }
  let sumIn = 0;
  let sumOut = 0;
  let sumMort = 0;
  nahashonBody.innerHTML = rows
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
            <button type="button" data-kind="nahashon" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="nahashon" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  const inEl = document.getElementById("nahashonTotalMoneyIn");
  const outEl = document.getElementById("nahashonTotalMoneyOut");
  const mortEl = document.getElementById("nahashonTotalMortality");
  if (inEl) inEl.textContent = String(sumIn);
  if (outEl) outEl.textContent = String(sumOut);
  if (mortEl) mortEl.textContent = String(sumMort);
}

function resetPigsForm() {
  if (!pigsForm) return;
  pigsForm.reset();
  state.editPigsId = null;
  if (pigsDate) pigsDate.value = "";
  if (pigsDateDisplay) pigsDateDisplay.value = "";
  const saveBtn = document.getElementById("pigsSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
}

function renderPigsTable() {
  if (!pigsBody) return;
  const rows = sortRowsLatestFirst(state.pigsEntries || []);
  const inEl = document.getElementById("pigsTotalMoneyIn");
  const outEl = document.getElementById("pigsTotalMoneyOut");
  if (!rows.length) {
    pigsBody.innerHTML = '<tr><td colspan="8" class="empty">No records.</td></tr>';
    if (inEl) inEl.textContent = currency(0);
    if (outEl) outEl.textContent = currency(0);
    return;
  }
  let sumIn = 0;
  let sumOut = 0;
  pigsBody.innerHTML = rows
    .map((row, idx) => {
      sumIn += Number(row.money_in || 0);
      sumOut += Number(row.money_out || 0);
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDMY(row.date)}</td>
        <td>${escapeHtmlCell(row.lot_no || "")}</td>
        <td>${Number(row.num_pigs || 0)}</td>
        <td>${escapeHtmlCell(row.description || "")}</td>
        <td>${currency(row.money_in)}</td>
        <td>${currency(row.money_out)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="pigs" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="pigs" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  if (inEl) inEl.textContent = currency(sumIn);
  if (outEl) outEl.textContent = currency(sumOut);
}

function chickenSaleBundledFeedCellsHtml(row, isOwnerInventoryRow) {
  if (isOwnerInventoryRow) {
    return "<td>—</td><td>—</td><td>—</td><td>—</td>";
  }
  const fb = row.feed_brand && String(row.feed_brand).trim();
  const ft = row.feed_type && String(row.feed_type).trim();
  const qtyRaw = row.feed_bag_qty;
  const qty = qtyRaw === "" || qtyRaw == null ? NaN : Math.floor(Number(qtyRaw));
  const totalRaw = row.feed_line_total;
  const total = totalRaw === "" || totalRaw == null ? NaN : Number(totalRaw);
  const brandCell = fb ? escapeHtmlCell(displayBrand(fb)) : "—";
  const ftCell = ft ? escapeHtmlCell(displayFeedType(ft)) : "—";
  const qtyCell = Number.isFinite(qty) ? escapeHtmlCell(String(qty)) : "—";
  const amtCell = Number.isFinite(total) ? currency(total) : "—";
  return `<td>${brandCell}</td><td>${ftCell}</td><td>${qtyCell}</td><td>${amtCell}</td>`;
}

function chickenSalesTableRowsHtml() {
  const emptyMsg =
    state.user.role === "owner" ? "No chick records yet." : "No chick sales recorded yet.";
  const isEmployeeViewer = state.user.role === "employee";
  const colSpan = isEmployeeViewer ? 19 : 20;
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
    const feedCells = chickenSaleBundledFeedCellsHtml(row, isOwnerInventoryRow);
    return `
      <tr data-chicken-row-id="${row.id}">
        <td>${formatDateDMY(row.date)}</td>
        <td>${breedCell}</td>
        <td>${notesCell}</td>
        <td>${row.quantity_birds}</td>
        <td>${currency(row.unit_price)}</td>
        <td>${currency(saleLineTotalChicken(row))}</td>
        ${feedCells}
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
  summaryEl.textContent = `Your inventory: ${invBirds} chicks · ${currency(invRevenue)} at listed prices. Staff sales in this table: margin total ${currency(staffMarginSum)} (cleared payments only; matches Profit column). Highlight above uses the same basis.`;
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
  configureChickenPaymentStatusOptions();
  if (chSaleType) chSaleType.value = "";
  if (state.user?.role === "employee" && chFeedBrand) {
    populateBrandSelect(chFeedBrand);
    if (chFeedType) {
      chFeedType.innerHTML = '<option value="">Select feed type</option>';
      chFeedType.disabled = true;
    }
    if (chFeedBagQty) chFeedBagQty.value = "0";
    if (chFeedLineTotal) chFeedLineTotal.value = "";
  }
  const chSave = document.getElementById("chSaveBtn");
  if (chSave) chSave.textContent = state.user?.role === "owner" ? "Save inventory" : "Save sale";
  populateChickenBreedSelect();
  applyEmployeeSalesDateRules();
  applyEmployeeFeedSalePricingUi();
  if (state.user?.role === "owner") {
    applyOwnerChickenPricesFromBreed();
    syncOwnerChickenMarginFromBuySell();
  }
  const cn = document.getElementById("chCustomerName");
  const cp = document.getElementById("chCustomerPhone");
  const mp = document.getElementById("chMoneyPaid");
  const ps = document.getElementById("chPaymentStatus");
  const ds = document.getElementById("chDeliveryStatus");
  if (cn) cn.value = "";
  if (cp) cp.value = "";
  if (mp) mp.value = "0";
  if (ps) ps.value = "pending";
  if (ds) ds.value = "pending";
  updateChickenCustomerAmounts();
}

function showPage(page) {
  if (
    (state.appInstance === "ufaray" || state.appInstance === "amana") &&
    state.user?.role === "owner" &&
    (page === "sales-bags" || page === "sales-kg")
  ) {
    return showPage("inventory");
  }
  if (state.appInstance === "shop" && page !== "inventory" && page !== "sales-bags") {
    if (page === "calculator") {
      // Calculator is allowed for all Nahah users (Terry/Cess/Shop).
    } else {
      return showPage("inventory");
    }
  }
  if (page === "cess-accounts") {
    if (state.appInstance !== "amana") {
      return showPage(state.user?.role === "owner" ? "inventory" : "sales-bags");
    }
    if (state.user?.role !== "owner") {
      return showPage("sales-bags");
    }
  }
  if (page === "pigs" && (state.appInstance !== "amana" || state.user?.role !== "owner")) {
    return showPage(state.user?.role === "owner" ? "inventory" : "sales-bags");
  }
  if (page === "nahashon-records" && state.appInstance !== "terry") {
    return showPage(state.user?.role === "owner" ? "inventory" : "sales-bags");
  }
  if (state.appInstance === "terry" && page !== "rose-inventory" && page !== "nahashon-records" && page !== "calculator") {
    return showPage("rose-inventory");
  }
  if (
    (state.appInstance === "cess" ||
      state.appInstance === "maina-faith-cess" ||
      state.appInstance === "terry-and-cess") &&
    page !== "rose-inventory" &&
    page !== "calculator"
  ) {
    return showPage("rose-inventory");
  }
  if (staffMayAccessCalculatorTenant() && page === "calculator") {
    // Allow calculator for owner and staff on Amana, Ufaray, and Nahah shop tenants.
  } else if (page === "calculator" && state.user?.role !== "owner") {
    return showPage("inventory");
  }
  if (page === "balance" && state.user?.role !== "owner") {
    return showPage("sales-bags");
  }
  if (page === "monthly-report") {
    if (state.user?.role !== "owner") return showPage("sales-bags");
    if (state.appInstance !== "amana" && state.appInstance !== "ufaray") {
      return showPage("inventory");
    }
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
  if (
    page === "rose-inventory" &&
    (state.appInstance === "terry" ||
      state.appInstance === "cess" ||
      state.appInstance === "terry-and-cess" ||
      state.appInstance === "maina-faith-cess")
  ) {
    pageHeading.textContent =
      state.appInstance === "terry"
        ? "Terry Records"
        : state.appInstance === "maina-faith-cess"
          ? "Maina+Faith+Cess"
          : state.appInstance === "terry-and-cess"
            ? "Terry and Cess"
            : "Records";
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
  if (page === "calculator" && state.appInstance === "ufaray") {
    pageHeading.textContent = "Ufaray Feeds";
  }
  if (
    page === "sales-bags" ||
    page === "sales-kg" ||
    page === "chicken-inventory" ||
    page === "expenditure" ||
    page === "rose-inventory" ||
    page === "nahashon-records" ||
    page === "cess-accounts"
  ) {
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
    syncRetailFeedMarginFromPrices();
  }
  if (page === "feeders-drinkers") renderFeedersDrinkersTable();
  if (page === "medicaments") renderMedicamentsTable();
  if (page === "gas") renderGasTable();
  if (page === "rose-inventory") renderRoseTable();
  if (page === "nahashon-records") renderNahashonTable();
  if (page === "cess-accounts") renderCessAccountsTable();
  if (page === "pigs") renderPigsTable();
  if (page === "calculator") {
    populateCalcChickenBreedSelect();
    initCalcChickenFormDefaults();
    applyCalcChickenPriceFromBreed();
    updateCalcChickenTotalDisplay();
    renderCalculatorTable();
  }
  if (page === "expenditure") renderExpenditureTable();
  if (page === "balance") updateBalanceBanner();
  if (page === "monthly-report") renderMonthlyReport();
  updateOwnerCombinedProfitDockVisibility();
  updateOwnerCombinedProfitDisplay();
}

function populateForm(row) {
  const id = Number(row.id);
  state.editId = Number.isFinite(id) ? id : null;
  inventoryPricesDirty = false;
  dateInput.value = toIsoDate(row.date);
  dateDisplayInput.value = formatDateDMY(row.date);
  const brandKey = resolveBrandKey(row.brand);
  brandSelect.value = brandKey;
  populateFeedTypes(brandKey, row.feed_type);
  feedTypeSelect.value = feedTypeCatalogValue(brandKey, row.feed_type);
  bagSizeInput.value = row.bag_size;
  quantityInput.value = row.quantity_in_stock;
  if (bagsBoughtInput) bagsBoughtInput.value = row.bags_bought != null ? String(row.bags_bought) : "0";
  document.getElementById("accumulatedBags").value =
    row.accumulated_bags != null ? row.accumulated_bags : row.quantity_in_stock;
  buyingPriceInput.value = formatMoneyForInput(row.buying_price || 0);
  sellingPriceInput.value = formatMoneyForInput(row.selling_price || 0);
  syncInventoryProfitMarginFromPrices();
  if (!Number.isFinite(Number(row.profit_margin_per_bag))) {
    profitMarginPerBagInput.value = "0.00";
  }
  setInventoryPriceEditMode(true);
  document.getElementById("accumulatedProfit").value = row.cumulative_bag_profit ?? 0;
  document.getElementById("reorderLevel").value = row.reorder_level;
  document.getElementById("saveBtn").textContent = "Update Record";
  updateInventoryStockFieldsMode();
}

function formPayload() {
  const dateValue = dateDisplayInput.value.trim();
  if (!isValidDMY(dateValue)) {
    throw new Error("Date must be in DD/MM/YYYY format.");
  }
  const brandKey = resolveBrandKey(brandSelect.value);
  const dateCanon = formatDateDMY(dateValue).trim();

  const bagsBoughtRaw = bagsBoughtInput?.value != null ? String(bagsBoughtInput.value).trim() : "";
  const bagsBoughtNum = bagsBoughtRaw === "" ? NaN : Number(bagsBoughtRaw);
  const editing = state.editId != null && Number(state.editId) > 0;
  const accEl = document.getElementById("accumulatedBags");
  const accRaw = accEl instanceof HTMLInputElement ? String(accEl.value || "").trim() : "";
  const accNum = accRaw === "" ? NaN : Number(accRaw);
  const buyParsed = parseMoneyFromInput(buyingPriceInput.value);
  const sellParsed = parseMoneyFromInput(sellingPriceInput.value);
  const marginParsed = parseMoneyFromInput(profitMarginPerBagInput.value);

  return {
    date: dateCanon,
    brand: brandKey,
    feed_type: feedTypeCatalogValue(brandKey, feedTypeSelect.value),
    bag_size: Number(bagSizeInput.value || 0),
    quantity_in_stock: Number(quantityInput.value || 0),
    bags_bought: Number.isFinite(bagsBoughtNum) ? Math.max(0, Math.floor(bagsBoughtNum)) : null,
    accumulated_bags:
      editing && Number.isFinite(accNum) && accNum >= 0 ? Math.max(0, Math.floor(accNum)) : null,
    buying_price: Number.isFinite(buyParsed) ? buyParsed : 0,
    selling_price: Number.isFinite(sellParsed) ? sellParsed : 0,
    profit_margin_per_bag: Number.isFinite(marginParsed) ? marginParsed : 0,
    reorder_level: Number(document.getElementById("reorderLevel").value || 0),
  };
}

async function loadCatalogFromServer() {
  const restrictForTerryCess = (catalog) => {
    if (state.user?.role === "owner") return catalog;
    if (
      !(
        state.appInstance === "terry" ||
        state.appInstance === "cess" ||
        state.appInstance === "terry-and-cess" ||
        state.appInstance === "maina-faith-cess" ||
        state.appInstance === "shop"
      )
    )
      return catalog;
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
  const inventoryDraft = captureInventoryFormDraft();
  const salesKgDraft = captureSalesKgFormDraft();
  state.catalog = await loadCatalogFromServer();

  const mustFillBrandDropdowns =
    !catalogInitialized && Object.keys(state.catalog || {}).length > 0;
  if (mustFillBrandDropdowns) {
    populateBrands();
    populateBrandSelect(sbBrand);
    populateBrandSelect(skBrand);
    if (rfBrand) populateBrandSelect(rfBrand);
    if (chFeedBrand) populateBrandSelect(chFeedBrand);
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
    api("/api/nahashon-accounts"),
    api("/api/cess-accounts"),
    api("/api/pigs"),
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
  state.nahashonEntries = extras[13].status === "fulfilled" ? extras[13].value : [];
  state.cessAccountsEntries = extras[14].status === "fulfilled" ? extras[14].value : [];
  state.pigsEntries = extras[15].status === "fulfilled" ? extras[15].value : [];

  updateTodayProfitDisplay();
  updateRetailCumulativeProfitDisplay();
  updateChickenProfitDisplay();
  updateFeedersDrinkersProfitDisplay();
  updateMedicamentsProfitDisplay();
  updateGasProfitDisplay();
  updateOwnerCombinedProfitDisplay();
  updateBalanceBanner();
  populateChickenBreedSelect();
  populateCalcChickenBreedSelect();
  if (state.currentPage === "calculator") {
    initCalcChickenFormDefaults();
    applyCalcChickenPriceFromBreed();
    updateCalcChickenTotalDisplay();
  }
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
  renderCessAccountsTable();
  renderNahashonTable();
  renderPigsTable();
  if (state.currentPage === "monthly-report") renderMonthlyReport();
  applyEmployeeFeedSalePricingUi();
  if (state.currentPage === "sales-kg") applyDefaultSkBagOpened();
  restoreInventoryFormDraft(inventoryDraft);
  restoreSalesKgFormDraft(salesKgDraft);
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
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
document.getElementById("openTerryAndCessBtn")?.addEventListener("click", () => {
  state.appInstance = "terry-and-cess";
  persistAppInstance();
  showLoginCard();
});
document.getElementById("openMainaFaithCessBtn")?.addEventListener("click", () => {
  state.appInstance = "maina-faith-cess";
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
      state.appInstance === "terry"
        ? "rose-inventory"
        : state.appInstance === "cess" ||
            state.appInstance === "maina-faith-cess" ||
            state.appInstance === "terry-and-cess"
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
  inventoryPricesDirty = false;
  populateFeedTypes(brandSelect.value);
  applyInventoryPriceDefaults();
});

feedTypeSelect.addEventListener("change", () => {
  inventoryPricesDirty = false;
  bagSizeInput.value = bagSizeFor(brandSelect.value, feedTypeSelect.value);
  applyInventoryPriceDefaults();
});

wireMoneyInputBlur(buyingPriceInput);
wireMoneyInputBlur(sellingPriceInput);
buyingPriceInput?.addEventListener("input", () => {
  inventoryPricesDirty = true;
  syncInventoryProfitMarginFromPrices();
});
sellingPriceInput?.addEventListener("input", () => {
  inventoryPricesDirty = true;
  syncInventoryProfitMarginFromPrices();
});
editPricesBtn?.addEventListener("click", () => {
  if (state.user?.role !== "owner") return;
  const isLocked = buyingPriceInput?.readOnly && sellingPriceInput?.readOnly;
  setInventoryPriceEditMode(isLocked);
  if (!isLocked) syncInventoryProfitMarginFromPrices();
});
setInventoryPriceEditMode(true);
syncInventoryProfitMarginFromPrices();
updateInventoryStockFieldsMode();

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
    const editId = state.editId != null ? Number(state.editId) : null;
    if (!(editId != null && Number.isFinite(editId) && editId > 0)) {
      const bb = Number(bagsBoughtInput?.value || 0);
      if (!Number.isFinite(bb) || bb < 1) {
        alert("Enter Bags bought (at least 1) when adding stock.");
        return;
      }
    }
    const payload = formPayload();
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
      state.appInstance === "terry"
        ? "rose-inventory"
        : state.appInstance === "cess" ||
            state.appInstance === "maina-faith-cess" ||
            state.appInstance === "terry-and-cess"
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
    if (state.user.role !== "owner" && OWNER_INVENTORY_PAGES.has(page)) {
      const staffMayUseCalculator = page === "calculator" && staffMayAccessCalculatorTenant();
      if (!staffMayUseCalculator) return;
    }
    if (page === "cess-accounts" && (state.appInstance !== "amana" || state.user.role !== "owner")) return;
    if (page === "nahashon-records" && state.appInstance !== "terry") return;
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
wireMoneyInputBlur(document.getElementById("skKgSold"));
wireMoneyInputBlur(document.getElementById("skPricePerKg"));

wireDatePicker(chDateDisplay, chDate, chOpenCalendarBtn);
chFeedBrand?.addEventListener("change", () => {
  populateChChickenFeedTypes(chFeedBrand.value);
});
chFeedType?.addEventListener("change", () => syncChEmployeeBundledFeedAmount());
chFeedBagQty?.addEventListener("input", () => syncChEmployeeBundledFeedAmount());
if (fdDateDisplay && fdDate && fdOpenCalendarBtn) wireDatePicker(fdDateDisplay, fdDate, fdOpenCalendarBtn);
if (medDateDisplay && medDate && medOpenCalendarBtn) wireDatePicker(medDateDisplay, medDate, medOpenCalendarBtn);
if (gasDateDisplay && gasDate && gasOpenCalendarBtn) wireDatePicker(gasDateDisplay, gasDate, gasOpenCalendarBtn);
if (expDateDisplay && expDate && expOpenCalendarBtn) wireDatePicker(expDateDisplay, expDate, expOpenCalendarBtn);
if (roseDateDisplay && roseDate && roseOpenCalendarBtn) wireDatePicker(roseDateDisplay, roseDate, roseOpenCalendarBtn);
if (calcDueDateDisplay && calcDueDate && calcDueOpenCalendarBtn) {
  wireDatePicker(calcDueDateDisplay, calcDueDate, calcDueOpenCalendarBtn);
}
if (calcChDateDisplay && calcChDate && calcChOpenCalendarBtn) {
  wireDatePicker(calcChDateDisplay, calcChDate, calcChOpenCalendarBtn);
}
if (nahashonDateDisplay && nahashonDate && nahashonOpenCalendarBtn) {
  wireDatePicker(nahashonDateDisplay, nahashonDate, nahashonOpenCalendarBtn);
}
if (cessAccDateDisplay && cessAccDate && cessAccOpenCalendarBtn) {
  wireDatePicker(cessAccDateDisplay, cessAccDate, cessAccOpenCalendarBtn);
}
if (pigsDateDisplay && pigsDate && pigsOpenCalendarBtn) {
  wireDatePicker(pigsDateDisplay, pigsDate, pigsOpenCalendarBtn);
}
document.getElementById("pigsClearBtn")?.addEventListener("click", resetPigsForm);
wireMoneyInputBlur(document.getElementById("pigsMoneyIn"));
wireMoneyInputBlur(document.getElementById("pigsMoneyOut"));

document.getElementById("mrMonth")?.addEventListener("change", () => renderMonthlyReport());
document.getElementById("mrDownloadPdfBtn")?.addEventListener("click", () => {
  try {
    downloadMonthlyReportPdf();
  } catch (err) {
    console.error("Monthly report PDF failed", err);
    alert("Could not generate the Monthly Report PDF. Refresh and try again.");
  }
});
fdItem?.addEventListener("change", refreshEmployeeNewPageSellingPrices);
medItem?.addEventListener("change", refreshEmployeeNewPageSellingPrices);
gasSize?.addEventListener("change", refreshEmployeeNewPageSellingPrices);

calcBody?.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.kind !== "calc-bags" && target.dataset.kind !== "calc-buying" && target.dataset.kind !== "calc-selling") return;
  calculatorRememberRowFromInputs(target.closest("tr"));
  updateCalculatorGrandTotalDisplay();
});
document.getElementById("calcClearBtn")?.addEventListener("click", () => {
  if (!calcBody) return;
  state.calculatorValues = {};
  calcBody.querySelectorAll("input[data-kind='calc-bags'], input[data-kind='calc-buying'], input[data-kind='calc-selling']").forEach((el) => {
    if (el instanceof HTMLInputElement) el.value = "";
  });
  const nameEl = document.getElementById("calcCustomerName");
  const mobileEl = document.getElementById("calcCustomerMobile");
  if (nameEl instanceof HTMLInputElement) nameEl.value = "";
  if (mobileEl instanceof HTMLInputElement) mobileEl.value = "";
  if (calcDueDateDisplay instanceof HTMLInputElement) calcDueDateDisplay.value = "";
  if (calcDueDate instanceof HTMLInputElement) calcDueDate.value = "";
  const paidEl = document.getElementById("calcPaidAmount");
  if (paidEl instanceof HTMLInputElement) paidEl.value = "0";
  updateCalculatorGrandTotalDisplay();
});

document.getElementById("calcPaidAmount")?.addEventListener("input", updateCalculatorInvoicePaymentSummary);

document.getElementById("calcCustomerForm")?.addEventListener("submit", (e) => e.preventDefault());

document.getElementById("calcChickenForm")?.addEventListener("submit", (e) => e.preventDefault());
calcChBreed?.addEventListener("change", () => {
  applyCalcChickenPriceFromBreed();
  updateCalcChickenTotalDisplay();
});
calcChQuantity?.addEventListener("input", updateCalcChickenTotalDisplay);
document.getElementById("calcChClearBtn")?.addEventListener("click", resetCalcChickenForm);
document.getElementById("calcChDownloadProformaBtn")?.addEventListener("click", () => downloadCalcChickenProformaPdf());

const AMANA_LOGO_PATH = "/amana-kuku-logo.png";
const UFARAY_LOGO_PATH = "/ufaray-logo.jpeg";
/** @type {Map<string, Promise<{ dataUrl: string, width: number, height: number, format: string } | null>>} */
const pdfLogoCache = new Map();

function pdfImageFormatForPath(path, blobType = "") {
  if (/\.jpe?g$/i.test(path) || blobType === "image/jpeg") return "JPEG";
  return "PNG";
}

/** @returns {Promise<{ dataUrl: string, width: number, height: number, format: string } | null>} */
function loadLogoAssetForPdf(path) {
  if (!path) return Promise.resolve(null);
  if (!pdfLogoCache.has(path)) {
    const promise = fetch(path)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error("logo missing"))))
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const format = pdfImageFormatForPath(path, blob.type);
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result;
              const img = new Image();
              img.onload = () =>
                resolve({
                  dataUrl,
                  width: img.naturalWidth || 1,
                  height: img.naturalHeight || 1,
                  format,
                });
              img.onerror = () => resolve(null);
              img.src = dataUrl;
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => null);
    pdfLogoCache.set(path, promise);
  }
  return pdfLogoCache.get(path);
}

function loadAmanaLogoForPdf() {
  return loadLogoAssetForPdf(AMANA_LOGO_PATH);
}

function loadUfarayLogoForPdf() {
  return loadLogoAssetForPdf(UFARAY_LOGO_PATH);
}

/**
 * Calculator PDFs: Ufaray logo on invoice/proforma only; Amana logo on Amana (never Ufaray on Amana).
 * @param {"calculator"|"proforma"|"invoice"} mode
 */
async function loadCalculatorPdfLogo(mode) {
  if (mode === "proforma" || mode === "invoice") {
    if (state.appInstance === "ufaray") return loadUfarayLogoForPdf();
    return loadAmanaLogoForPdf();
  }
  if (mode === "calculator" && state.appInstance !== "ufaray") {
    return loadAmanaLogoForPdf();
  }
  return null;
}

/** Logo at top-right; preserves aspect ratio. Returns drawn height in pt. */
function addPdfLogoTopRight(doc, logoMeta, opts = {}) {
  if (!logoMeta?.dataUrl || !logoMeta.width || !logoMeta.height) return 0;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = opts.margin ?? 40;
  const maxW = opts.maxWidth ?? opts.size ?? 108;
  const maxH = opts.maxHeight ?? maxW;
  const aspect = logoMeta.width / logoMeta.height;
  let drawW = maxW;
  let drawH = drawW / aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * aspect;
  }
  const top = opts.top ?? 22;
  const x = pageW - margin - drawW;
  const format = logoMeta.format || "PNG";
  doc.addImage(logoMeta.dataUrl, format, x, top, drawW, drawH);
  return drawH;
}

/** Invoice / proforma header: logo above the divider line, title on the left. Returns Y for content below the line. */
function drawInvoicePdfHeaderBand(doc, { logoMeta, hdr, brandLine, margin, pageW, G }) {
  const rightX = pageW - margin;
  const logoTop = 14;
  const titleY = logoMeta ? 52 : 36;

  doc.setFillColor(...G.accent);
  doc.rect(0, 0, pageW, 12, "F");

  let logoDrawH = 0;
  if (logoMeta) {
    logoDrawH = addPdfLogoTopRight(doc, logoMeta, { top: logoTop, maxWidth: 118, maxHeight: 118, margin });
  }
  const lineY = logoMeta ? logoTop + logoDrawH + 14 : 58;

  if (!logoMeta && brandLine) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...G.dark);
    doc.text(brandLine, rightX, titleY, { align: "right" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...G.dark);
  doc.text(hdr, margin, titleY);
  doc.setTextColor(33, 33, 33);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(...G.accent);
  doc.setLineWidth(0.9);
  doc.line(margin, lineY, rightX, lineY);

  return lineY + 18;
}

function getCalcCustomerBillPdfText() {
  const nameEl = document.getElementById("calcCustomerName");
  const mobileEl = document.getElementById("calcCustomerMobile");
  const name = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : "";
  const mobile = mobileEl instanceof HTMLInputElement ? mobileEl.value.trim() : "";
  const parts = [];
  if (name) parts.push(name);
  if (mobile) parts.push(`Mobile: ${mobile}`);
  return parts.join("\n") || "—";
}

/** Due date for invoice PDFs: valid DD/MM/YYYY from field, else shop today. */
function getCalcDueDateForPdf() {
  const el = document.getElementById("calcDueDateDisplay");
  const t = el instanceof HTMLInputElement ? el.value.trim() : "";
  if (t && isValidDMY(t)) return t;
  return state.shopToday || clientShopTodayDMY();
}

/** Sale date from chicken calculator form, else shop today. */
function getCalcChickenDateForPdf() {
  const t = calcChDateDisplay instanceof HTMLInputElement ? calcChDateDisplay.value.trim() : "";
  if (t && isValidDMY(t)) return t;
  return state.shopToday || clientShopTodayDMY();
}

/** Current chicken calculator line for PDF export, or null if incomplete. */
function collectCalcChickenRowForPdfExport() {
  if (!calcChBreed || !calcChQuantity) return null;
  const breed = calcChBreed.value.trim();
  const qtyNum = Number(String(calcChQuantity.value || "").trim());
  if (!breed || !Number.isFinite(qtyNum) || qtyNum <= 0) return null;
  const unitPrice = findChickenSellingPriceForCalculator(breed);
  if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  return {
    breed,
    dateStr: getCalcChickenDateForPdf(),
    qtyNum,
    unitPrice,
    lineTotal: qtyNum * unitPrice,
  };
}

/** Proforma PDF for chicken calculator only (logo + customer form below feed table). */
async function downloadCalcChickenProformaPdf() {
  const row = collectCalcChickenRowForPdfExport();
  if (!row) {
    alert("Select a breed, enter the number of chicks, and ensure a selling price is set in Chicken Sales Inventory.");
    return;
  }

  const jsPdfNs = window.jspdf;
  const JsPdfCtor = jsPdfNs?.jsPDF;
  if (typeof JsPdfCtor !== "function") {
    alert("PDF generator is not loaded. Refresh and try again.");
    return;
  }
  const businessTitle = state.appInstance === "ufaray" ? "Ufaray Feeds" : "Amana Kuku Feeds";
  const fileDate = row.dateStr.replace(/\//g, "-");
  const safeBusiness = businessTitle.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const logoMeta = await loadCalculatorPdfLogo("proforma");

  const doc = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });
  const autoTableFn = doc.autoTable || jsPdfNs?.autoTable;
  if (typeof autoTableFn !== "function") {
    alert("PDF table helper is not loaded. Refresh and try again.");
    return;
  }
  const docSuffix = String(Math.floor(10000 + Math.random() * 90000));
  const docNo = `PF-${docSuffix}`;
  const invoiceTotal = row.lineTotal;
  const paidAmount = getCalcPaidAmountForPdf();
  const unpaidBalance = invoiceTotal - paidAmount;

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const rightX = pageW - margin;
  const tableW = pageW - 2 * margin;
  const colW = { desc: 250, qty: 65, rate: 100, amt: 100 };
  if (colW.desc + colW.qty + colW.rate + colW.amt !== tableW) colW.desc = tableW - colW.qty - colW.rate - colW.amt;

  const G = { dark: [14, 92, 58], accent: [39, 150, 99], mint: [234, 248, 240], edge: [186, 222, 198] };

  const hdr = "PRO-FORMA INVOICE";
  const brandLine = state.appInstance === "ufaray" ? "UFARAY FEEDS" : "AMANA KUKU FEEDS";
  const blockTop = drawInvoicePdfHeaderBand(doc, { logoMeta, hdr, brandLine, margin, pageW, G });
  const billRaw = getCalcCustomerBillPdfText();
  const billLines = doc.splitTextToSize(billRaw === "—" ? " " : billRaw, 250);
  const dueForPdf = getCalcDueDateForPdf();
  const leftBlockH = 14 + billLines.length * 12;
  const rightBlockH = 14 * 4;
  const headerBottom = blockTop + Math.max(leftBlockH, rightBlockH, 36) + 18;

  doc.setFillColor(...G.mint);
  doc.setDrawColor(...G.edge);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, blockTop - 8, tableW, headerBottom - blockTop + 6, 5, 5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...G.dark);
  doc.text("BILL TO", margin, blockTop);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(33, 33, 33);
  doc.text(billLines, margin, blockTop + 14);
  let ry = blockTop;
  doc.setFont("helvetica", "bold");
  doc.text(`PROFORMA NO. ${docNo}`, rightX, ry, { align: "right" });
  ry += 14;
  doc.text(`DATE: ${row.dateStr}`, rightX, ry, { align: "right" });
  ry += 14;
  doc.text(`VALID UNTIL: ${dueForPdf}`, rightX, ry, { align: "right" });
  ry += 14;
  doc.text("NOTE: Cost estimate — not a tax invoice", rightX, ry, { align: "right" });

  const desc = `${row.breed} DAY-OLD CHICKS`.replace(/\s+/g, " ").trim().toUpperCase();
  const tableBody = [[desc, String(row.qtyNum), `Ksh${formatKshPlainNumber(row.unitPrice)}`, `Ksh${formatKshPlainNumber(row.lineTotal)}`]];

  autoTableFn.call(doc, {
    head: [["DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"]],
    body: tableBody,
    startY: headerBottom,
    margin: { left: margin, right: margin },
    tableWidth: tableW,
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 9, bottom: 9, left: 10, right: 10 },
      valign: "middle",
      lineColor: G.edge,
      lineWidth: 0.2,
      textColor: [33, 33, 33],
    },
    headStyles: {
      fillColor: G.dark,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 9.5,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: colW.desc },
      1: { halign: "right", cellWidth: colW.qty },
      2: { halign: "right", cellWidth: colW.rate },
      3: { halign: "right", cellWidth: colW.amt },
    },
    alternateRowStyles: { fillColor: [252, 255, 253] },
    theme: "plain",
  });

  const finalY = doc.lastAutoTable?.finalY || headerBottom;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...G.dark);
  doc.text(`TOTAL CHICKS: ${row.qtyNum}`, rightX, finalY + 22, { align: "right" });
  const summaryRows = [
    { label: "TOTAL AMOUNT", value: invoiceTotal, emphasize: true },
    { label: "PAID AMOUNT", value: paidAmount, emphasize: false },
    { label: "UNPAID BALANCE", value: unpaidBalance, emphasize: true },
  ];
  let summaryY = finalY + 40;
  summaryRows.forEach((summaryRow) => {
    doc.setFontSize(summaryRow.emphasize ? 11 : 10);
    doc.setTextColor(...G.dark);
    doc.text(summaryRow.label, rightX - 110, summaryY, { align: "right" });
    if (summaryRow.emphasize) {
      doc.setFontSize(12);
      doc.setTextColor(...G.accent);
    }
    doc.text(`Ksh${formatKshPlainNumber(summaryRow.value)}`, rightX, summaryY, { align: "right" });
    summaryY += 18;
  });
  doc.setTextColor(0, 0, 0);

  doc.save(`${safeBusiness}-chicken-proforma-${fileDate}.pdf`);
}

/** Rows with bags > 0 plus parsed prices for PDF exports. */
function collectCalculatorRowsForPdfExport() {
  const rows = [];
  if (!calcBody) return rows;
  calcBody.querySelectorAll("tr").forEach((tr) => {
    if (!(tr instanceof HTMLTableRowElement)) return;
    const cells = tr.querySelectorAll("td");
    if (cells.length < 7) return;
    const bagsEl = tr.querySelector("input[data-kind='calc-bags']");
    const buyEl = tr.querySelector("input[data-kind='calc-buying']");
    const sellEl = tr.querySelector("input[data-kind='calc-selling']");
    const totalCell = tr.querySelector(".js-calc-row-total");
    if (!(bagsEl instanceof HTMLInputElement) || !(buyEl instanceof HTMLInputElement) || !(sellEl instanceof HTMLInputElement) || !(totalCell instanceof HTMLElement)) return;
    const bagsRaw = String(bagsEl.value || "").trim();
    const bagsNum = Number(bagsRaw);
    if (!bagsRaw || !Number.isFinite(bagsNum) || bagsNum <= 0) return;
    const buyingNum = Number(String(buyEl.value || "").trim());
    const sellingNum = Number(String(sellEl.value || "").trim());
    rows.push({
      brand: cells[0]?.textContent?.trim() || "—",
      feedType: cells[1]?.textContent?.trim() || "—",
      bagSize: cells[2]?.textContent?.trim() || "—",
      bagsStr: bagsRaw,
      bagsNum,
      buyingStr: String(buyEl.value || "").trim() || "—",
      sellingStr: String(sellEl.value || "").trim() || "—",
      buyingNum,
      sellingNum,
      totalCellText: totalCell.textContent?.trim() || "—",
    });
  });
  return rows;
}

/**
 * @param {"calculator"|"proforma"|"invoice"} mode
 */
async function downloadCalculatorPdf(mode = "calculator") {
  if (!calcBody) return;
  const jsPdfNs = window.jspdf;
  const JsPdfCtor = jsPdfNs?.jsPDF;
  if (typeof JsPdfCtor !== "function") {
    alert("PDF generator is not loaded. Refresh and try again.");
    return;
  }
  const exportRows = collectCalculatorRowsForPdfExport();
  const chickenRow = collectCalcChickenRowForPdfExport();
  if (!exportRows.length && !chickenRow) {
    alert("Enter at least one calculator row with number of bags and/or complete the chicken calculator before downloading.");
    return;
  }
  if (mode === "calculator" && exportRows.length) {
    const badBuy = exportRows.find((r) => !Number.isFinite(r.buyingNum) || r.buyingNum < 0);
    if (badBuy) {
      alert("For the calculator PDF, enter a valid buying price on every line that has bags.");
      return;
    }
  }
  if (mode === "proforma" || mode === "invoice") {
    if (exportRows.length) {
      const bad = exportRows.find((r) => !Number.isFinite(r.sellingNum) || r.sellingNum < 0);
      if (bad) {
        alert(`For ${mode === "proforma" ? "a proforma invoice" : "an invoice"}, enter a valid selling price on every line that has bags.`);
        return;
      }
    }
    if (chickenRow && (!Number.isFinite(chickenRow.unitPrice) || chickenRow.unitPrice < 0)) {
      alert("For this PDF, ensure the chicken breed has a valid selling price in Chicken Sales Inventory.");
      return;
    }
  }

  const today = state.shopToday || clientShopTodayDMY();
  const businessTitle = state.appInstance === "ufaray" ? "Ufaray Feeds" : "Amana Kuku Feeds";
  const fileDate = today.replace(/\//g, "-");
  const safeBusiness = businessTitle.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const logoMeta = await loadCalculatorPdfLogo(mode);

  const doc = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });
  const autoTableFn = doc.autoTable || jsPdfNs?.autoTable;
  if (typeof autoTableFn !== "function") {
    alert("PDF table helper is not loaded. Refresh and try again.");
    return;
  }

  if (mode === "calculator") {
    const filledRows = exportRows.map((r) => {
      const lineTotal = r.bagsNum * Math.max(0, Number.isFinite(r.buyingNum) ? r.buyingNum : 0);
      return {
        brand: r.brand,
        feedType: r.feedType,
        bagSize: r.bagSize,
        bags: r.bagsStr,
        buying: r.buyingStr,
        total: currency(lineTotal),
      };
    });
    const totalBags = filledRows.reduce((s, r) => s + (Number(r.bags) || 0), 0);
    let grand = exportRows.reduce(
      (s, r) => s + r.bagsNum * Math.max(0, Number.isFinite(r.buyingNum) ? r.buyingNum : 0),
      0
    );
    if (chickenRow) grand += chickenRow.lineTotal;

    const calcLogoTop = 18;
    const calcLogoH = logoMeta
      ? addPdfLogoTopRight(doc, logoMeta, { top: calcLogoTop, maxWidth: 96, maxHeight: 96 })
      : 0;
    const calcTextTop = logoMeta ? calcLogoTop + calcLogoH + 16 : 42;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(businessTitle, 40, calcTextTop);
    doc.setFontSize(13);
    doc.text("Calculator", 40, calcTextTop + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    let metaY = calcTextTop + 44;
    doc.text(`Date: ${today}`, 40, metaY);
    metaY += 14;
    const cn = document.getElementById("calcCustomerName");
    const cm = document.getElementById("calcCustomerMobile");
    const cname = cn instanceof HTMLInputElement ? cn.value.trim() : "";
    const cmob = cm instanceof HTMLInputElement ? cm.value.trim() : "";
    const dueDisp = document.getElementById("calcDueDateDisplay");
    const dueStr = dueDisp instanceof HTMLInputElement ? dueDisp.value.trim() : "";
    const duePdf = dueStr && isValidDMY(dueStr) ? dueStr : null;
    if (cname) {
      doc.text(`Customer: ${cname}`, 40, metaY);
      metaY += 14;
    }
    if (cmob) {
      doc.text(`Mobile: ${cmob}`, 40, metaY);
      metaY += 14;
    }
    if (duePdf) {
      doc.text(`Due date: ${duePdf}`, 40, metaY);
      metaY += 14;
    }

    let tableStartY = metaY + 10;
    if (filledRows.length) {
      const head = [["Brand", "Feed Type", "Bag Size (kg)", "Number of bags", "Buying price (per bag)", "Total (purchase cost)"]];
      const body = filledRows.map((r) => [r.brand, r.feedType, r.bagSize, r.bags, r.buying, r.total]);
      autoTableFn.call(doc, {
        head,
        body,
        startY: tableStartY,
        styles: { font: "helvetica", fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [240, 240, 240], textColor: [20, 20, 20] },
      });
      tableStartY = (doc.lastAutoTable?.finalY || tableStartY) + 20;
    }

    if (chickenRow) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Chicken", 40, tableStartY);
      const chHead = [["Breed", "Date", "Number of chicks", "Price per chick", "Total"]];
      const chBody = [[
        chickenRow.breed,
        chickenRow.dateStr,
        String(chickenRow.qtyNum),
        currency(chickenRow.unitPrice),
        currency(chickenRow.lineTotal),
      ]];
      autoTableFn.call(doc, {
        head: chHead,
        body: chBody,
        startY: tableStartY + 8,
        styles: { font: "helvetica", fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [240, 240, 240], textColor: [20, 20, 20] },
      });
    }

    const finalY = doc.lastAutoTable?.finalY || 98;
    let footY = finalY + 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    if (totalBags > 0) {
      doc.text(`Total bags: ${totalBags}`, 40, footY);
      footY += 18;
    }
    if (chickenRow) {
      doc.text(`Total chicks: ${chickenRow.qtyNum}`, 40, footY);
      footY += 18;
    }
    doc.text(`Grand total: ${currency(grand)}`, 40, footY);
    doc.save(`${safeBusiness}-calculator-${fileDate}.pdf`);
    return;
  }

  const isProforma = mode === "proforma";
  const docSuffix = String(Math.floor(10000 + Math.random() * 90000));
  const docNo = isProforma ? `PF-${docSuffix}` : `INV-${docSuffix}`;
  const totalBags = exportRows.reduce((s, r) => s + r.bagsNum, 0);
  const feedInvoiceTotal = exportRows.reduce((s, r) => s + r.bagsNum * r.sellingNum, 0);
  const invoiceTotal = feedInvoiceTotal + (chickenRow ? chickenRow.lineTotal : 0);
  const paidAmount = getCalcPaidAmountForPdf();
  const unpaidBalance = invoiceTotal - paidAmount;

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const rightX = pageW - margin;
  const tableW = pageW - 2 * margin;
  const colW = { desc: 250, qty: 65, rate: 100, amt: 100 };
  if (colW.desc + colW.qty + colW.rate + colW.amt !== tableW) colW.desc = tableW - colW.qty - colW.rate - colW.amt;

  const G = { dark: [14, 92, 58], accent: [39, 150, 99], mint: [234, 248, 240], edge: [186, 222, 198] };

  const hdr = isProforma ? "PRO-FORMA INVOICE" : "INVOICE";
  const brandLine = state.appInstance === "ufaray" ? "UFARAY FEEDS" : "AMANA KUKU FEEDS";
  const blockTop = drawInvoicePdfHeaderBand(doc, { logoMeta, hdr, brandLine, margin, pageW, G });
  const billRaw = getCalcCustomerBillPdfText();
  const billLines = doc.splitTextToSize(billRaw === "—" ? " " : billRaw, 250);
  const dueForPdf = getCalcDueDateForPdf();
  const noLabel = isProforma ? "PROFORMA NO." : "INVOICE NO.";
  const terms = isProforma ? "Cost estimate — not a tax invoice" : "Due on receipt";
  const leftBlockH = 14 + billLines.length * 12;
  const rightBlockH = 14 * 4;
  const headerBottom = blockTop + Math.max(leftBlockH, rightBlockH, 36) + 18;

  doc.setFillColor(...G.mint);
  doc.setDrawColor(...G.edge);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, blockTop - 8, tableW, headerBottom - blockTop + 6, 5, 5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...G.dark);
  doc.text("BILL TO", margin, blockTop);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(33, 33, 33);
  doc.text(billLines, margin, blockTop + 14);
  let ry = blockTop;
  doc.setFont("helvetica", "bold");
  doc.text(`${noLabel} ${docNo}`, rightX, ry, { align: "right" });
  ry += 14;
  doc.text(`DATE: ${today}`, rightX, ry, { align: "right" });
  ry += 14;
  doc.text(`${isProforma ? "VALID UNTIL" : "DUE DATE"}: ${dueForPdf}`, rightX, ry, { align: "right" });
  ry += 14;
  doc.text(`${isProforma ? "NOTE" : "TERMS"}: ${terms}`, rightX, ry, { align: "right" });

  const tableBody = exportRows.map((r) => {
    const rate = r.sellingNum;
    const amount = r.bagsNum * rate;
    const desc = `${r.brand} ${r.feedType} ${r.bagSize}kg`
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    return [desc, String(r.bagsNum), `Ksh${formatKshPlainNumber(rate)}`, `Ksh${formatKshPlainNumber(amount)}`];
  });
  appendChickenRowToPdfTableBody(tableBody);

  autoTableFn.call(doc, {
    head: [[
      "DESCRIPTION",
      "QTY",
      "UNIT PRICE",
      "AMOUNT",
    ]],
    body: tableBody,
    startY: headerBottom,
    margin: { left: margin, right: margin },
    tableWidth: tableW,
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 9, bottom: 9, left: 10, right: 10 },
      valign: "middle",
      lineColor: G.edge,
      lineWidth: 0.2,
      textColor: [33, 33, 33],
    },
    headStyles: {
      fillColor: G.dark,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 9.5,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: colW.desc },
      1: { halign: "right", cellWidth: colW.qty },
      2: { halign: "right", cellWidth: colW.rate },
      3: { halign: "right", cellWidth: colW.amt },
    },
    alternateRowStyles: { fillColor: [252, 255, 253] },
    theme: "plain",
  });

  const finalY = doc.lastAutoTable?.finalY || headerBottom;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...G.dark);
  let totalsY = finalY + 22;
  if (totalBags > 0) {
    doc.text(`TOTAL BAGS: ${totalBags}`, rightX, totalsY, { align: "right" });
    totalsY += 16;
  }
  if (chickenRow) {
    doc.text(`TOTAL CHICKS: ${chickenRow.qtyNum}`, rightX, totalsY, { align: "right" });
    totalsY += 16;
  }
  const summaryRows = [
    { label: "TOTAL AMOUNT", value: invoiceTotal, emphasize: true },
    { label: "PAID AMOUNT", value: paidAmount, emphasize: false },
    { label: "UNPAID BALANCE", value: unpaidBalance, emphasize: true },
  ];
  let summaryY = totalsY + 14;
  summaryRows.forEach((row) => {
    doc.setFontSize(row.emphasize ? 11 : 10);
    doc.setTextColor(...G.dark);
    doc.text(row.label, rightX - 110, summaryY, { align: "right" });
    if (row.emphasize) {
      doc.setFontSize(12);
      doc.setTextColor(...G.accent);
    }
    doc.text(`Ksh${formatKshPlainNumber(row.value)}`, rightX, summaryY, { align: "right" });
    summaryY += 18;
  });
  doc.setTextColor(0, 0, 0);

  const safeMode = isProforma ? "proforma" : "invoice";
  doc.save(`${safeBusiness}-${safeMode}-${fileDate}.pdf`);
}

document.getElementById("calcDownloadPdfBtn")?.addEventListener("click", () => downloadCalculatorPdf("calculator"));
document.getElementById("calcDownloadProformaBtn")?.addEventListener("click", () => downloadCalculatorPdf("proforma"));
document.getElementById("calcDownloadInvoiceBtn")?.addEventListener("click", () => downloadCalculatorPdf("invoice"));

document.getElementById("chBreed")?.addEventListener("change", () => {
  if (state.user?.role === "employee") {
    applyEmployeeChickenPriceFromBreeds();
    updateChickenCustomerAmounts();
  } else {
    applyOwnerChickenPricesFromBreed();
    syncOwnerChickenMarginFromBuySell();
  }
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

document.getElementById("sbClearBtn").addEventListener("click", resetSalesBagForm);
document.getElementById("skClearBtn").addEventListener("click", resetSalesKgForm);
document.getElementById("chClearBtn").addEventListener("click", resetChickenForm);
document.getElementById("fdClearBtn")?.addEventListener("click", resetFeedersDrinkersForm);
document.getElementById("medClearBtn")?.addEventListener("click", resetMedicamentsForm);
document.getElementById("gasClearBtn")?.addEventListener("click", resetGasForm);
document.getElementById("expClearBtn")?.addEventListener("click", resetExpenditureForm);
document.getElementById("roseClearBtn")?.addEventListener("click", resetRoseForm);
document.getElementById("cessAccClearBtn")?.addEventListener("click", resetCessAccountsForm);
document.getElementById("nahashonClearBtn")?.addEventListener("click", resetNahashonForm);

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
  syncOwnerLineProfitMargin("fdBuyingPrice", "fdSellingPrice", "fdProfitMargin");
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
  syncOwnerLineProfitMargin("medBuyingPrice", "medSellingPrice", "medProfitMargin");
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
  syncOwnerLineProfitMargin("gasBuyingPrice", "gasSellingPrice", "gasProfitMargin");
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

for (const id of ["fdBuyingPrice", "fdSellingPrice"]) {
  document.getElementById(id)?.addEventListener("input", () =>
    syncOwnerLineProfitMargin("fdBuyingPrice", "fdSellingPrice", "fdProfitMargin")
  );
}
for (const id of ["medBuyingPrice", "medSellingPrice"]) {
  document.getElementById(id)?.addEventListener("input", () =>
    syncOwnerLineProfitMargin("medBuyingPrice", "medSellingPrice", "medProfitMargin")
  );
}
for (const id of ["gasBuyingPrice", "gasSellingPrice"]) {
  document.getElementById(id)?.addEventListener("input", () =>
    syncOwnerLineProfitMargin("gasBuyingPrice", "gasSellingPrice", "gasProfitMargin")
  );
}

expenditureForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = expDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const moneyOut = Number(document.getElementById("expMoneyOut")?.value || 0);
  const payload = {
    date: dateValue,
    description: String(document.getElementById("expDescription")?.value || "").trim(),
    money_out: moneyOut,
    total: moneyOut,
    category: normalizeExpenditureCategory(document.getElementById("expCategory")?.value),
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

cessAccountsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = cessAccDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = {
    date: dateValue,
    description: String(document.getElementById("cessAccDescription")?.value || "").trim(),
    quantity: Number(document.getElementById("cessAccQuantity")?.value || 0),
    unit_price: Number(document.getElementById("cessAccUnitPrice")?.value || 0),
    money_in: Number(document.getElementById("cessAccMoneyIn")?.value || 0),
    money_out: Number(document.getElementById("cessAccMoneyOut")?.value || 0),
    sale_via: String(document.getElementById("cessAccSaleVia")?.value || "Shop").trim(),
  };
  try {
    if (state.editCessAccountsId) {
      await api(`/api/cess-accounts/${state.editCessAccountsId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/cess-accounts", { method: "POST", body: JSON.stringify(payload) });
    }
    resetCessAccountsForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

nahashonForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = nahashonDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = {
    date: dateValue,
    description: String(document.getElementById("nahashonDescription")?.value || "").trim(),
    quantity: Number(document.getElementById("nahashonQuantity")?.value || 0),
    unit_price: Number(document.getElementById("nahashonUnitPrice")?.value || 0),
    money_in: Number(document.getElementById("nahashonMoneyIn")?.value || 0),
    money_out: Number(document.getElementById("nahashonMoneyOut")?.value || 0),
    mortality: Number(document.getElementById("nahashonMortality")?.value || 0),
    sale_via: String(document.getElementById("nahashonSaleVia")?.value || "Shop").trim(),
  };
  try {
    if (state.editNahashonId) {
      await api(`/api/nahashon-accounts/${state.editNahashonId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/nahashon-accounts", { method: "POST", body: JSON.stringify(payload) });
    }
    resetNahashonForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

pigsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = pigsDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = {
    date: dateValue,
    lot_no: String(document.getElementById("pigsLotNo")?.value || "").trim(),
    num_pigs: Math.max(0, Math.floor(Number(document.getElementById("pigsNumPigs")?.value || 0))),
    description: String(document.getElementById("pigsDescription")?.value || "").trim(),
    money_in: parseMoneyFromInput(document.getElementById("pigsMoneyIn")?.value) || 0,
    money_out: parseMoneyFromInput(document.getElementById("pigsMoneyOut")?.value) || 0,
  };
  try {
    if (state.editPigsId) {
      await api(`/api/pigs/${state.editPigsId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/pigs", { method: "POST", body: JSON.stringify(payload) });
    }
    resetPigsForm();
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
  const kgVal = parseMoneyFromInput(document.getElementById("skKgSold")?.value);
  const priceVal = parseMoneyFromInput(document.getElementById("skPricePerKg")?.value);
  if (!Number.isFinite(kgVal) || kgVal <= 0) {
    alert("Kg sold must be greater than zero.");
    return;
  }
  if (!Number.isFinite(priceVal) || priceVal < 0) {
    alert("Enter a valid price per kg.");
    return;
  }
  const payload = {
    date: dateValue,
    brand: resolveBrandKey(skBrand.value),
    feed_type: skFeedType.value,
    bag_opened: Number(document.getElementById("skBagOpened").value || 0),
    kg_sold: kgVal,
    price_per_kg: priceVal,
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
  if (state.user.role === "owner") {
    const buy = Number(document.getElementById("chBuyingPrice")?.value);
    const sell = Number(document.getElementById("chSellingPrice")?.value);
    if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy < 0 || sell < 0) {
      alert("Enter buying and selling price per chick.");
      return;
    }
    const pm = computeMarginFromBuySell(buy, sell);
    if (pm == null) {
      alert("Could not calculate profit margin from buying and selling prices.");
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
    const fb = String(chFeedBrand?.value || "").trim();
    const ft = String(chFeedType?.value || "").trim();
    const fbags = Math.floor(Number(chFeedBagQty?.value ?? 0));
    if (Number.isFinite(fbags) && fbags < 0) {
      alert("Feed quantity (bags) must be a whole number zero or greater.");
      return;
    }
    payload.feed_brand = fb || "";
    payload.feed_type = ft || "";
    payload.feed_bag_qty = Number.isFinite(fbags) && fbags > 0 ? fbags : 0;
    const unitForLine = Number(payload.unit_price);
    const lineTotal = qty * unitForLine;
    const moneyPaid = Number(document.getElementById("chMoneyPaid")?.value || 0);
    const payStatus = chickenPaymentIsClearedValue(document.getElementById("chPaymentStatus")?.value)
      ? chickenPaymentClearedValue()
      : "pending";
    const deliveryStatus = document.getElementById("chDeliveryStatus")?.value === "delivered" ? "delivered" : "pending";
    if (chickenPaymentIsClearedValue(payStatus) && moneyPaid + 0.005 < lineTotal) {
      alert(`When payment status is ${chickenPaymentClearedLabel()}, money paid must cover the sale total.`);
      return;
    }
    payload.customer_name = document.getElementById("chCustomerName")?.value.trim() ?? "";
    payload.customer_phone = document.getElementById("chCustomerPhone")?.value.trim() ?? "";
    payload.money_paid = Number.isFinite(moneyPaid) && moneyPaid >= 0 ? moneyPaid : 0;
    payload.payment_status = payStatus;
    payload.delivery_status = deliveryStatus;
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

function wireOwnerPassThroughBagSalesBodyListener(bodyId, kindPrefix) {
  document.getElementById(bodyId)?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.kind === `${kindPrefix}-edit`) {
      const id = Number(target.dataset.id);
      if (!Number.isFinite(id) || id < 1) return;
      const row = state.salesBags.find((r) => Number(r.id) === id);
      if (!row) return;
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
      showPage("sales-bags");
      return;
    }
    if (target.dataset.kind === `${kindPrefix}-delete`) {
      const id = Number(target.dataset.id);
      if (!Number.isFinite(id) || id < 1) return;
      if (!window.confirm("Delete this sale?")) return;
      target.setAttribute("disabled", "disabled");
      try {
        await api(`/api/sales/bags/${id}`, { method: "DELETE" });
        await loadAllData();
      } catch (error) {
        alert(error.message);
      } finally {
        target.removeAttribute("disabled");
      }
      return;
    }
    if (target.dataset.kind !== `${kindPrefix}-status-save`) return;
    const id = Number(target.dataset.id);
    if (!Number.isFinite(id) || id < 1) return;
    const row = state.salesBags.find((r) => Number(r.id) === id);
    if (!row) return;
    const tr = target.closest("tr");
    if (!(tr instanceof HTMLTableRowElement)) return;
    const sel = tr.querySelector(`select[data-kind='${kindPrefix}-status']`);
    if (!(sel instanceof HTMLSelectElement)) return;
    const status = sel.value === "cleared" ? "cleared" : "pending";
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
}

wireOwnerPassThroughBagSalesBodyListener("ufaray-bag-sales-body", "ufaray");
wireOwnerPassThroughBagSalesBodyListener("cess-bag-sales-body", "cess");
wireOwnerPassThroughBagSalesBodyListener("pigs-bag-sales-body", "pigs-bag");

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
      const status = sel.value === "cleared" ? "cleared" : "pending";
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
    const status = sel.value === "cleared" ? "cleared" : "pending";
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
      feed_brand: String(row.feed_brand || "").trim(),
      feed_type: String(row.feed_type || "").trim(),
      feed_bag_qty:
        row.feed_bag_qty != null && row.feed_bag_qty !== ""
          ? Math.floor(Number(row.feed_bag_qty))
          : 0,
      customer_name: row.customer_name || "",
      customer_phone: row.customer_phone || "",
      money_paid: Number(row.money_paid) || 0,
      payment_status:
        chickenPaymentIsClearedValue(row.payment_status) ? chickenPaymentClearedValue() : "pending",
      delivery_status: chickenSaleDeliveryStatusLabel(row) === "Delivered" ? "delivered" : "pending",
      pass_through_status:
        String(row.pass_through_status || "pending").toLowerCase() === "cleared" ||
        String(row.pass_through_status || "pending").toLowerCase() === "solved"
          ? "cleared"
          : "pending",
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
    const skFtCanon = feedTypeCatalogValue(resolveBrandKey(row.brand), row.feed_type);
    if ([...skFeedType.options].some((o) => o.value === skFtCanon)) skFeedType.value = skFtCanon;
    else if ([...skFeedType.options].some((o) => o.value === row.feed_type)) skFeedType.value = row.feed_type;
    const skBagEl = document.getElementById("skBagOpened");
    skBagEl.value = row.bag_opened != null ? row.bag_opened : 0;
    skBagEl.readOnly = state.user?.role === "employee";
    document.getElementById("skKgSold").value = formatMoneyForInput(row.kg_sold);
    if (skSaleType) skSaleType.value = String(row.through_party || "").trim();
    if (state.user.role === "employee") applyEmployeeSalesKgPriceFromInventory();
    else document.getElementById("skPricePerKg").value = formatMoneyForInput(row.price_per_kg);
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
      const nextStatus = chickenPaymentIsClearedValue(sel.value) ? chickenPaymentClearedValue() : "pending";
      const deliverySel = tr.querySelector(`select[data-kind="chicken-delivery-status"][data-id="${idNum}"]`);
      if (!(deliverySel instanceof HTMLSelectElement)) return;
      const nextDelivery = deliverySel.value === "delivered" ? "delivered" : "pending";
      target.setAttribute("disabled", "disabled");
      try {
        await api(`/api/chicken-sales/${idNum}/payment-status`, {
          method: "PUT",
          body: JSON.stringify({ payment_status: nextStatus, delivery_status: nextDelivery }),
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
        syncOwnerChickenMarginFromBuySell();
      } else {
        const unitEl = document.getElementById("chUnitPrice");
        if (unitEl) unitEl.value = row.unit_price;
        const cn = document.getElementById("chCustomerName");
        const cp = document.getElementById("chCustomerPhone");
        const mp = document.getElementById("chMoneyPaid");
        const ps = document.getElementById("chPaymentStatus");
        const ds = document.getElementById("chDeliveryStatus");
        if (cn) cn.value = row.customer_name || "";
        if (cp) cp.value = row.customer_phone || "";
        if (mp) mp.value = row.money_paid != null && row.money_paid !== "" ? String(row.money_paid) : "0";
        if (ps) {
          const st = String(row.payment_status || "pending").toLowerCase();
          ps.value = chickenPaymentIsClearedValue(st) ? chickenPaymentClearedValue() : "pending";
        }
        if (ds) {
          ds.value = chickenSaleDeliveryStatusLabel(row) === "Delivered" ? "delivered" : "pending";
        }
        if (chFeedBrand) {
          populateBrandSelect(chFeedBrand);
          const bk = row.feed_brand ? resolveBrandKey(String(row.feed_brand)) : "";
          if (bk && [...chFeedBrand.options].some((o) => o.value === bk)) chFeedBrand.value = bk;
          else if (row.feed_brand) chFeedBrand.value = String(row.feed_brand);
          populateChChickenFeedTypes(chFeedBrand.value);
          if (chFeedType && row.feed_type) {
            const want = feedTypeCatalogValue(resolveBrandKey(chFeedBrand.value), String(row.feed_type));
            if ([...chFeedType.options].some((o) => o.value === want)) chFeedType.value = want;
            else if ([...chFeedType.options].some((o) => o.value === row.feed_type)) chFeedType.value = String(row.feed_type);
          }
          if (chFeedBagQty) {
            chFeedBagQty.value =
              row.feed_bag_qty != null && row.feed_bag_qty !== "" ? String(Math.floor(Number(row.feed_bag_qty))) : "0";
          }
          syncChEmployeeBundledFeedAmount();
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
  syncRetailFeedMarginFromPrices();
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
  document.getElementById("rfAccumulatedProfit").value = row.accumulated_profit ?? 0;
  const wEl = document.getElementById("rfWeightKg");
  if (wEl) {
    const w = row.weight_kg;
    wEl.value = w != null && w !== "" && Number(w) > 0 ? String(w) : "";
  }
  updateRfWeightFieldVisibility();
  syncRetailFeedMarginFromPrices();
  document.getElementById("rfSaveBtn").textContent = "Update retail line";
}

rfBrand?.addEventListener("change", () => {
  populateRfFeedTypes(rfBrand.value);
  updateRfWeightFieldVisibility();
  syncRetailFeedMarginFromPrices();
});

rfFeedType?.addEventListener("change", () => {
  updateRfWeightFieldVisibility();
  syncRetailFeedMarginFromPrices();
});

document.getElementById("rfPricePerKg")?.addEventListener("input", syncRetailFeedMarginFromPrices);

retailFeedForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!rfBrand || !rfFeedType) return;
  syncRetailFeedMarginFromPrices();
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
    document.getElementById("fdReorderLevel").value = row.reorder_level;
    syncOwnerLineProfitMargin("fdBuyingPrice", "fdSellingPrice", "fdProfitMargin");
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
    document.getElementById("medReorderLevel").value = row.reorder_level;
    syncOwnerLineProfitMargin("medBuyingPrice", "medSellingPrice", "medProfitMargin");
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
    document.getElementById("gasReorderLevel").value = row.reorder_level;
    syncOwnerLineProfitMargin("gasBuyingPrice", "gasSellingPrice", "gasProfitMargin");
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
    const cat = document.getElementById("expCategory");
    if (desc) desc.value = row.description || "";
    if (out) out.value = row.money_out ?? 0;
    if (cat instanceof HTMLSelectElement) cat.value = normalizeExpenditureCategory(row.category);
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

cessAccountsBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "cess-acc") return;
  const row = state.cessAccountsEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editCessAccountsId = row.id;
    if (cessAccDate) cessAccDate.value = toIsoDate(row.date);
    if (cessAccDateDisplay) cessAccDateDisplay.value = formatDateDMY(row.date);
    const desc = document.getElementById("cessAccDescription");
    const qty = document.getElementById("cessAccQuantity");
    const unit = document.getElementById("cessAccUnitPrice");
    const min = document.getElementById("cessAccMoneyIn");
    const mout = document.getElementById("cessAccMoneyOut");
    const via = document.getElementById("cessAccSaleVia");
    if (desc) desc.value = row.description || "";
    if (qty) qty.value = row.quantity ?? 0;
    if (unit) unit.value = row.unit_price ?? 0;
    if (min) min.value = row.money_in ?? 0;
    if (mout) mout.value = row.money_out ?? 0;
    if (via) via.value = row.sale_via || "Shop";
    const saveBtn = document.getElementById("cessAccSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/cess-accounts/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

nahashonBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "nahashon") return;
  const row = state.nahashonEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editNahashonId = row.id;
    if (nahashonDate) nahashonDate.value = toIsoDate(row.date);
    if (nahashonDateDisplay) nahashonDateDisplay.value = formatDateDMY(row.date);
    const desc = document.getElementById("nahashonDescription");
    const qty = document.getElementById("nahashonQuantity");
    const unit = document.getElementById("nahashonUnitPrice");
    const min = document.getElementById("nahashonMoneyIn");
    const mout = document.getElementById("nahashonMoneyOut");
    const mort = document.getElementById("nahashonMortality");
    const via = document.getElementById("nahashonSaleVia");
    if (desc) desc.value = row.description || "";
    if (qty) qty.value = row.quantity ?? 0;
    if (unit) unit.value = row.unit_price ?? 0;
    if (min) min.value = row.money_in ?? 0;
    if (mout) mout.value = row.money_out ?? 0;
    if (mort) mort.value = row.mortality ?? 0;
    if (via) via.value = row.sale_via || "Shop";
    const saveBtn = document.getElementById("nahashonSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/nahashon-accounts/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

pigsBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "pigs") return;
  const row = state.pigsEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editPigsId = row.id;
    if (pigsDate) pigsDate.value = toIsoDate(row.date);
    if (pigsDateDisplay) pigsDateDisplay.value = formatDateDMY(row.date);
    const lotEl = document.getElementById("pigsLotNo");
    const numEl = document.getElementById("pigsNumPigs");
    const descEl = document.getElementById("pigsDescription");
    const minEl = document.getElementById("pigsMoneyIn");
    const moutEl = document.getElementById("pigsMoneyOut");
    if (lotEl) lotEl.value = row.lot_no || "";
    if (numEl) numEl.value = row.num_pigs ?? 0;
    if (descEl) descEl.value = row.description || "";
    if (minEl) minEl.value = formatMoneyForInput(row.money_in ?? 0);
    if (moutEl) moutEl.value = formatMoneyForInput(row.money_out ?? 0);
    const saveBtn = document.getElementById("pigsSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/pigs/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

preventWheelOnNumberInputs();
boot();
