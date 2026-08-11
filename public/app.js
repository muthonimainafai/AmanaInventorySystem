const state = {
  appInstance: (() => {
    const saved = (localStorage.getItem("amanaAppInstance") || "amana").trim().toLowerCase();
    return [
      "amana",
      "ufaray",
      "rose",
      "home-chickens",
      "nahah",
      "terry",
      "cess",
      "terry-and-cess",
      "maina-faith-cess",
      "shop",
      "water-bills",
      "electricity-bills",
    ].includes(saved)
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
  expenditureMonthFilter: "",
  /** Tracks shop calendar month for auto-resetting expenditure view on month change. */
  expStatementLastShopMonth: null,
  editExpenditureId: null,
  roseEntries: [],
  editRoseId: null,
  cessAccountsEntries: [],
  editCessAccountsId: null,
  hadifalAccountsEntries: [],
  editHadifaAccountsId: null,
  creditAccounts: [],
  creditEntries: [],
  activeCreditAccountId: null,
  monthlyRecordsPayload: {
    records: [],
    currentMonthKey: null,
    currentMonthLabel: null,
    currentClosed: false,
    preview: null,
  },
  loanRepayments: [],
  editLoanRepaymentId: null,
  loanRepaymentPreview: null,
  nahashonEntries: [],
  editNahashonId: null,
  faithExpensesEntries: [],
  editFaithExpensesId: null,
  faithSalesEntries: [],
  editFaithSalesId: null,
  inventoryLots: [],
  activeLotId: null,
  pigsEntries: [],
  editPigsId: null,
  weighBridgeEntries: [],
  editWeighBridgeId: null,
  waterBillsEntries: [],
  editWaterBillsId: null,
  electricityBillsEntries: [],
  editElectricityBillsId: null,
  meterBillRecipients: [],
  activeMeterBillRecipientId: null,
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
  "faith-expenses": "Expenses",
  "faith-sales": "Sales",
  "cess-accounts": "Cess Accounts",
  "water-bills": "Water Bills",
  "electricity-bills": "Electricity Bills",
  credit: "Credit",
  calculator: "Calculator",
  pigs: "Pigs Page",
  "weigh-bridge": "Ufaray/Amana Weigh Bridge",
  expenditure: "Expenditure",
  "monthly-report": "Monthly Report",
  "monthly-records": "Monthly Records",
  "loan-repayment": "Loan Repayment",
  balance: "Balance",
};

function updateCalculatorModeUi() {
  const calcSubheading = document.getElementById("calculatorSubheading");
  if (calcSubheading && !calcSubheading.classList.contains("hidden")) {
    calcSubheading.textContent = "Calculator";
  }
}

function isRecordsTenant() {
  return state.appInstance === "rose" || state.appInstance === "home-chickens";
}

function isWaterBillsTenant() {
  return state.appInstance === "water-bills";
}

function isElectricityBillsTenant() {
  return state.appInstance === "electricity-bills";
}

function isBillsTenant() {
  return isWaterBillsTenant() || isElectricityBillsTenant();
}

function meterBillsOwnerOnlyTenant() {
  return isBillsTenant();
}

function meterBillRecipientsTenantEnabled() {
  return isBillsTenant();
}

const DEFAULT_METER_BILL_RECIPIENT_NAMES = ["Nahashon", "Nzuki"];

async function ensureDefaultMeterBillRecipientsPresent() {
  const existing = new Set(
    (state.meterBillRecipients || []).map((r) => String(r.name || "").trim().toLowerCase())
  );
  let created = false;
  for (const name of DEFAULT_METER_BILL_RECIPIENT_NAMES) {
    if (existing.has(name.toLowerCase())) continue;
    try {
      await api("/api/meter-bill-recipients", { method: "POST", body: JSON.stringify({ name }) });
      created = true;
    } catch (_error) {
      /* keep loading other defaults */
    }
  }
  return created;
}

function activeMeterBillRecipientStorageKey() {
  return `amanaMeterBillRecipientId:${state.appInstance}`;
}

function persistActiveMeterBillRecipientId(recipientId) {
  if (!meterBillRecipientsTenantEnabled() || !recipientId) return;
  sessionStorage.setItem(activeMeterBillRecipientStorageKey(), String(recipientId));
}

function readPersistedActiveMeterBillRecipientId() {
  const raw = sessionStorage.getItem(activeMeterBillRecipientStorageKey());
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function activeMeterBillRecipientName() {
  const recipient = (state.meterBillRecipients || []).find(
    (r) => Number(r.id) === Number(state.activeMeterBillRecipientId)
  );
  return recipient?.name || (state.activeMeterBillRecipientId ? `Recipient ${state.activeMeterBillRecipientId}` : "");
}

function meterBillRecipientApiQuery() {
  if (!meterBillRecipientsTenantEnabled() || !state.activeMeterBillRecipientId) return "";
  return `?recipient_id=${encodeURIComponent(state.activeMeterBillRecipientId)}`;
}

function withActiveMeterBillRecipientId(payload) {
  if (!meterBillRecipientsTenantEnabled() || !state.activeMeterBillRecipientId) return payload;
  const name = activeMeterBillRecipientName();
  return {
    ...payload,
    recipient_id: state.activeMeterBillRecipientId,
    bill_to: payload.bill_to || name,
  };
}

function syncMeterBillsBillToFromRecipient(prefix) {
  const billToEl = document.getElementById(`${prefix}BillTo`);
  if (!(billToEl instanceof HTMLInputElement)) return;
  const name = activeMeterBillRecipientName();
  if (name) billToEl.value = name;
}

function isElectricityBillsKind(kind) {
  return kind === "electricity-bills" || kind === "electricityBills" || kind === "Electricity";
}

function meterBillsUnitConfig(kind) {
  const isElectricity =
    isElectricityBillsKind(kind) || isElectricityBillsTenant() || state.currentPage === "electricity-bills";
  if (isElectricity) {
    return {
      unit: "kWh",
      priceLabel: "Price per kWh",
      priceError: "price per kWh",
      currentReadingLabel: "Current meter reading (kWh)",
      previousReadingLabel: "Previous meter reading (kWh)",
      unitsUsedLabel: "Units used (kWh)",
      pdfStatementSub: "Electricity & token billing statement",
      pdfSectionTitle: "Meter readings & units (kWh)",
      pdfPrevHeader: "Prev reading (kWh)",
      pdfCurrHeader: "Curr reading (kWh)",
      pdfConsumptionHeader: "Consumption (kWh)",
      pdfRateSuffix: "/kWh",
    };
  }
  return {
    unit: "m³",
    priceLabel: "Price per m³",
    priceError: "price per m³",
    currentReadingLabel: "Current meter reading (m³)",
    previousReadingLabel: "Previous meter reading (m³)",
    unitsUsedLabel: "Units used (m³)",
    pdfStatementSub: "Meter billing statement",
    pdfSectionTitle: "Meter readings & charges",
    pdfPrevHeader: "Prev reading (m³)",
    pdfCurrHeader: "Curr reading (m³)",
    pdfConsumptionHeader: "Consumption (m³)",
    pdfRateSuffix: "/m³",
  };
}

function meterBillsPrefixKind(prefix) {
  return prefix === "electricityBills" ? "electricity-bills" : "water-bills";
}

const METER_BILL_ELECTRICITY_METERS = {
  nahashon: "2025-08070736",
};

function electricityMeterNumberForActiveRecipient() {
  const name = activeMeterBillRecipientName().trim().toLowerCase();
  return METER_BILL_ELECTRICITY_METERS[name] || "";
}

function updateElectricityBillsMeterInfoUi() {
  const el = document.getElementById("electricityBillsMeterNumberHint");
  if (!el) return;
  const meterNo = electricityMeterNumberForActiveRecipient();
  const show =
    (state.currentPage === "electricity-bills" || isElectricityBillsTenant()) && Boolean(meterNo);
  if (show) {
    el.textContent = `Electricity meter number: ${meterNo}`;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function defaultPageForLoggedInUser() {
  if (isWaterBillsTenant()) return "water-bills";
  if (isElectricityBillsTenant()) return "electricity-bills";
  if (state.appInstance === "terry") return "rose-inventory";
  if (
    state.appInstance === "cess" ||
    state.appInstance === "maina-faith-cess" ||
    state.appInstance === "terry-and-cess"
  ) {
    return "rose-inventory";
  }
  if (state.appInstance === "shop") return "inventory";
  if (state.appInstance === "home-chickens") return "rose-inventory";
  if (isRecordsTenant()) return "rose-inventory";
  return state.user?.role === "owner" ? "inventory" : "sales-bags";
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

function isFaithInventoryTenant() {
  return (
    state.appInstance === "nahah" ||
    state.appInstance === "terry" ||
    state.appInstance === "cess" ||
    state.appInstance === "terry-and-cess" ||
    state.appInstance === "maina-faith-cess" ||
    state.appInstance === "shop"
  );
}

function expensesPageTenantEnabled() {
  return isFaithInventoryTenant() || isRecordsTenant();
}

function faithSalesPageTenantEnabled() {
  return isFaithInventoryTenant() || isRecordsTenant();
}

function inventoryLotsTenantEnabled() {
  return expensesPageTenantEnabled();
}

function faithRoseBalancePageEnabled() {
  return expensesPageTenantEnabled();
}

function faithRoseSalesTotalAmount() {
  return (state.faithSalesEntries || []).reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
}

function faithRoseExpensesTotalMoneyOut() {
  return (state.faithExpensesEntries || []).reduce((s, r) => s + (Number(r.money_out) || 0), 0);
}

function faithRoseBalanceProfit() {
  return roundMoney(faithRoseSalesTotalAmount() - faithRoseExpensesTotalMoneyOut());
}

function applyFaithRoseBalancePanelVisibility() {
  const amanaPanel = document.getElementById("amanaBalancePanel");
  const faithPanel = document.getElementById("faithRoseBalancePanel");
  const useFaithRose = faithRoseBalancePageEnabled();
  amanaPanel?.classList.toggle("hidden", useFaithRose);
  faithPanel?.classList.toggle("hidden", !useFaithRose);
}

function renderFaithRoseBalancePage() {
  if (!faithRoseBalancePageEnabled()) return;
  applyFaithRoseBalancePanelVisibility();
  const moneyIn = faithRoseSalesTotalAmount();
  const moneyOut = faithRoseExpensesTotalMoneyOut();
  const profit = faithRoseBalanceProfit();
  const inEl = document.getElementById("faithRoseBalanceMoneyIn");
  const outEl = document.getElementById("faithRoseBalanceMoneyOut");
  const profitEl = document.getElementById("faithRoseBalanceProfit");
  const hintEl = document.getElementById("faithRoseBalanceLotHint");
  if (inEl) inEl.textContent = currency(moneyIn);
  if (outEl) outEl.textContent = currency(moneyOut);
  if (profitEl) {
    profitEl.innerHTML = `<strong>${currency(profit)}</strong>`;
    profitEl.style.color = profit < 0 ? "var(--danger,#d32f2f)" : "";
  }
  if (hintEl) {
    const lotPart =
      inventoryLotsTenantEnabled() && activeLotName() ? ` for ${activeLotName()}` : "";
    hintEl.textContent = `Money in is the Sales page total. Money out is the Expenses page total. Profit is money in minus money out${lotPart}.`;
  }
}

function activeLotStorageKey() {
  return `amanaActiveLotId:${state.appInstance}`;
}

function persistActiveLotId(lotId) {
  if (!inventoryLotsTenantEnabled() || !lotId) return;
  sessionStorage.setItem(activeLotStorageKey(), String(lotId));
}

function readPersistedActiveLotId() {
  const raw = sessionStorage.getItem(activeLotStorageKey());
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function activeLotName() {
  const lot = (state.inventoryLots || []).find((l) => Number(l.id) === Number(state.activeLotId));
  return lot?.name || (state.activeLotId ? `Lot ${state.activeLotId}` : "");
}

function lotScopedApiQuery() {
  if (!inventoryLotsTenantEnabled() || !state.activeLotId) return "";
  return `?lot_id=${encodeURIComponent(state.activeLotId)}`;
}

function withActiveLotId(payload) {
  if (!inventoryLotsTenantEnabled() || !state.activeLotId) return payload;
  return { ...payload, lot_id: state.activeLotId };
}

const FAITH_SALES_DEFAULT_PRICE_PER_CHICKEN = 450;

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
const OWNER_INVENTORY_PAGES = new Set([
  "inventory",
  "retail-inventory",
  "calculator",
  "balance",
  "monthly-report",
  "monthly-records",
  "loan-repayment",
]);
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
  "faith-expenses",
  "faith-sales",
  "cess-accounts",
  "credit",
  "pigs",
  "weigh-bridge",
  "calculator",
  "expenditure",
  "monthly-report",
  "monthly-records",
  "loan-repayment",
  "balance",
]);
/** Owner pages that show the combined accumulated profit footer (Amana & Ufaray). */
const OWNER_PAGES_WITH_COMBINED_PROFIT = new Set([
  "inventory",
  "retail-inventory",
  "sales-bags",
  "sales-kg",
  "chicken-inventory",
  "feeders-drinkers",
  "medicaments",
  "gas",
  "balance",
  "pigs",
]);

/** Balance page only: daily operational cost (KES) per shop — Amana vs Ufaray are independent. */
const BALANCE_PAGE_DAILY_OPERATIONAL_COST_KES_AMANA = 540;
const BALANCE_PAGE_DAILY_OPERATIONAL_COST_KES_UFARAY = 180;

function balanceDailyOperationalCostKes() {
  if (state.appInstance === "ufaray") return BALANCE_PAGE_DAILY_OPERATIONAL_COST_KES_UFARAY;
  return BALANCE_PAGE_DAILY_OPERATIONAL_COST_KES_AMANA;
}

function creditTenantEnabled() {
  return state.appInstance === "amana" || state.appInstance === "ufaray";
}

function monthlyRecordsTenantEnabled() {
  return state.user?.role === "owner" && creditTenantEnabled();
}

function loanRepaymentTenantEnabled() {
  return monthlyRecordsTenantEnabled();
}

function loanRepaymentsForMonth(monthKey) {
  const mk = String(monthKey || "").trim();
  if (!mk) return 0;
  return (state.loanRepayments || [])
    .filter((r) => String(r.month_key || "").trim() === mk)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

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
const chFeedBrand2 = document.getElementById("chFeedBrand2");
const chFeedType2 = document.getElementById("chFeedType2");
const chFeedBagQty2 = document.getElementById("chFeedBagQty2");
const chFeedLineTotal2 = document.getElementById("chFeedLineTotal2");
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
const hadifaAccountsForm = document.getElementById("hadifa-accounts-form");
const hadifaAccountsBody = document.getElementById("hadifa-accounts-body");
const hadifaAccDateDisplay = document.getElementById("hadifaAccDateDisplay");
const hadifaAccDate = document.getElementById("hadifaAccDate");
const hadifaAccOpenCalendarBtn = document.getElementById("hadifaAccOpenCalendarBtn");
const nahashonForm = document.getElementById("nahashon-form");
const nahashonBody = document.getElementById("nahashon-body");
const nahashonDateDisplay = document.getElementById("nahashonDateDisplay");
const nahashonDate = document.getElementById("nahashonDate");
const nahashonOpenCalendarBtn = document.getElementById("nahashonOpenCalendarBtn");
const faithExpensesForm = document.getElementById("faith-expenses-form");
const faithExpensesBody = document.getElementById("faith-expenses-body");
const faithExpDateDisplay = document.getElementById("faithExpDateDisplay");
const faithExpDate = document.getElementById("faithExpDate");
const faithExpOpenCalendarBtn = document.getElementById("faithExpOpenCalendarBtn");
const faithSalesForm = document.getElementById("faith-sales-form");
const faithSalesBody = document.getElementById("faith-sales-body");
const faithSalesDateDisplay = document.getElementById("faithSalesDateDisplay");
const faithSalesDate = document.getElementById("faithSalesDate");
const faithSalesOpenCalendarBtn = document.getElementById("faithSalesOpenCalendarBtn");
const pigsForm = document.getElementById("pigs-form");
const pigsBody = document.getElementById("pigs-body");
const pigsDateDisplay = document.getElementById("pigsDateDisplay");
const pigsDate = document.getElementById("pigsDate");
const pigsOpenCalendarBtn = document.getElementById("pigsOpenCalendarBtn");
const weighBridgeForm = document.getElementById("weigh-bridge-form");
const weighBridgeBody = document.getElementById("weigh-bridge-body");
const weighBridgeDateDisplay = document.getElementById("weighBridgeDateDisplay");
const weighBridgeDate = document.getElementById("weighBridgeDate");
const weighBridgeOpenCalendarBtn = document.getElementById("weighBridgeOpenCalendarBtn");
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
  const normalized = [
    "amana",
    "ufaray",
    "rose",
    "home-chickens",
    "nahah",
    "terry",
    "cess",
    "terry-and-cess",
    "maina-faith-cess",
    "shop",
    "water-bills",
    "electricity-bills",
  ].includes(state.appInstance)
    ? state.appInstance
    : "amana";
  localStorage.setItem("amanaAppInstance", normalized);
}

function applyAppTheme() {
  const tenant = [
    "amana",
    "ufaray",
    "rose",
    "home-chickens",
    "nahah",
    "terry",
    "cess",
    "terry-and-cess",
    "maina-faith-cess",
    "shop",
    "water-bills",
    "electricity-bills",
  ].includes(state.appInstance)
    ? state.appInstance
    : "amana";
  const isUfaray = tenant === "ufaray";
  const isRose = tenant === "rose" || tenant === "home-chickens";
  const isWaterBills = tenant === "water-bills";
  const isElectricityBills = tenant === "electricity-bills";
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
  document.body.classList.toggle("water-bills-theme", isWaterBills);
  document.body.classList.toggle("electricity-bills-theme", isElectricityBills);
  document.title = isWaterBills
    ? "Water Bills - Desktop Inventory"
    : isElectricityBills
      ? "Electricity Bills - Desktop Inventory"
      : isMainaFaithCess
    ? "Maina+Faith+Cess - Desktop Inventory"
    : isTerryAndCess
      ? "Terry and Cess - Desktop Inventory"
      : isUfaray
      ? "Ufaray Feeds - Desktop Inventory"
      : tenant === "home-chickens"
        ? "Home Chickens - Desktop Inventory"
      : isRose
        ? "Rose Inventory - Desktop Inventory"
        : isNahah
          ? "Faith Inventory - Desktop Inventory"
        : "Amana Kuku Feeds - Desktop Inventory";
  const portalSiteTitle = document.getElementById("portalSiteTitle");
  if (portalSiteTitle) {
    portalSiteTitle.textContent = isMainaFaithCess
      ? "Maina+Faith+Cess"
      : isTerryAndCess
        ? "Terry and Cess"
        : isWaterBills
          ? "WATER BILLS"
          : isElectricityBills
            ? "ELECTRICITY BILLS"
        : isUfaray
        ? "UFARAY FEEDS"
        : tenant === "home-chickens"
          ? "HOME CHICKENS"
        : tenant === "rose"
          ? "ROSE INVENTORY"
          : isNahah
            ? "FAITH INVENTORY"
            : "AMANA KUKU FEEDS";
  }
  const loginTitle = document.getElementById("loginCardTitle");
  if (loginTitle) {
    loginTitle.textContent = isWaterBills
      ? "Water Bills Login"
      : isElectricityBills
        ? "Electricity Bills Login"
        : tenant === "terry"
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
      state.appInstance === "home-chickens"
        ? "Home Chickens"
        : state.appInstance === "rose"
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
      state.appInstance === "home-chickens"
        ? "Home Chickens"
        : state.appInstance === "rose"
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
  updateCalcMpesaPaymentCardUi();
  updateCalcBrandHeaderUi();
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-App-Instance": [
      "amana",
      "ufaray",
      "rose",
      "home-chickens",
      "nahah",
      "terry",
      "cess",
      "terry-and-cess",
      "maina-faith-cess",
      "shop",
      "water-bills",
      "electricity-bills",
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

/**
 * Draw invoice payment summary rows with matching font, size, and aligned columns.
 * @returns {number} Y position below the last row
 */
function drawInvoicePaymentSummaryPdf(doc, { rightX, startY, rows, darkColor = [14, 92, 58], labelGap = 130 }) {
  const fontSize = 10;
  const lineHeight = 16;
  const labelX = rightX - labelGap;
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(...darkColor);
  for (const row of rows) {
    doc.text(row.label, labelX, y, { align: "right" });
    doc.text(`Ksh${formatKshPlainNumber(row.value)}`, rightX, y, { align: "right" });
    y += lineHeight;
  }
  doc.setTextColor(0, 0, 0);
  return y;
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
    ? `Shop day ${state.shopToday}. Total is cumulative profit from Sales Per Bags this calendar month only. Resets at the start of each new month.`
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
    ? `Shop day ${state.shopToday}. Sum of accumulated retail kg profit for this calendar month. Resets at the start of each new month.`
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
    ? `Shop day ${shop}. Cumulative profit is for this calendar month only (Delivered sales). Resets at the start of each new month. Today counts staff chick sales with Delivery status = Delivered only.`
    : "";
  document.querySelectorAll(".js-chicken-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateFeedersDrinkersProfitDisplay() {
  const total = feedersDrinkersAccumulatedProfitTotal();
  const val = currency(total);
  document.querySelectorAll(".js-fd-accumulated-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. Cumulative profit from employee sales this calendar month. Resets at the start of each new month.`
    : "Cumulative profit from employee sales this calendar month.";
  document.querySelectorAll(".js-fd-accumulated-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateMedicamentsProfitDisplay() {
  const total = medicamentsAccumulatedProfitTotal();
  const val = currency(total);
  document.querySelectorAll(".js-med-accumulated-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. Cumulative profit from employee sales this calendar month. Resets at the start of each new month.`
    : "Cumulative profit from employee sales this calendar month.";
  document.querySelectorAll(".js-med-accumulated-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function updateExpenditureAccumulatedDisplay() {
  const rows = expenditureRowsForDisplay();
  const sumMoneyOut = rows.reduce((s, r) => s + (Number(r.money_out) || 0), 0);
  const val = currency(sumMoneyOut);
  document.querySelectorAll(".js-exp-expenditure-total-value").forEach((el) => {
    el.textContent = val;
  });
  const filter = getExpStatementMonthFilter();
  const current = currentExpenditureMonthKey();
  const isCurrent = filter === current;
  const scopeLabel = monthLabelFromKeyClient(filter);
  const meta =
    rows.length === 0
      ? isCurrent
        ? `No expenditure recorded for ${scopeLabel} yet — starts at KES 0 each new month.`
        : `No expenditure records for ${scopeLabel}.`
      : `${rows.length} record${rows.length === 1 ? "" : "s"} · ${scopeLabel}${isCurrent ? " (current month)" : ""} · Sum: ${currency(sumMoneyOut)}`;
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
  const total = gasAccumulatedProfitTotal();
  const val = currency(total);
  document.querySelectorAll(".js-gas-accumulated-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. Cumulative profit from employee sales this calendar month. Resets at the start of each new month.`
    : "Cumulative profit from employee sales this calendar month.";
  document.querySelectorAll(".js-gas-accumulated-profit-meta").forEach((el) => {
    el.textContent = meta;
  });
}

function aggregateOwnerFeedersDrinkersRows(rows) {
  const byItem = new Map();
  for (const row of rows || []) {
    const name = String(row.item_name || "");
    if (!name) continue;
    const existing = byItem.get(name);
    if (!existing) {
      byItem.set(name, {
        ...row,
        quantity_in_stock: Number(row.quantity_in_stock || 0),
        accumulated_stock: Number(row.accumulated_stock ?? row.quantity_in_stock ?? 0),
        accumulated_profit: Number(row.accumulated_profit || 0),
      });
      continue;
    }
    existing.quantity_in_stock += Number(row.quantity_in_stock || 0);
    existing.accumulated_profit += Number(row.accumulated_profit || 0);
    existing.accumulated_stock = Math.max(
      Number(existing.accumulated_stock || 0),
      Number(row.accumulated_stock ?? row.quantity_in_stock ?? 0)
    );
    if (Number(row.id) > Number(existing.id)) {
      existing.id = row.id;
      existing.date = row.date;
      existing.buying_price = row.buying_price;
      existing.selling_price = row.selling_price;
      existing.profit_margin = row.profit_margin;
      existing.reorder_level = row.reorder_level;
      existing.created_by = row.created_by;
    }
  }
  return [...byItem.values()].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

function feedersDrinkersInventoryForCalculations() {
  return aggregateOwnerFeedersDrinkersRows(state.feedersDrinkersInventory || []);
}

function feedersDrinkersAccumulatedProfitTotal() {
  const ym = currentExpenditureMonthKey();
  if (ym) {
    return computeItemSalesProfitForMonth(
      state.feedersDrinkersSales,
      feedersDrinkersInventoryForCalculations(),
      ym,
      "item_name"
    );
  }
  return feedersDrinkersInventoryForCalculations().reduce((s, r) => s + (Number(r.accumulated_profit) || 0), 0);
}

function medicamentsAccumulatedProfitTotal() {
  return (state.medicamentsInventory || []).reduce((s, r) => s + (Number(r.accumulated_profit) || 0), 0);
}

function gasAccumulatedProfitTotal() {
  return (state.gasInventory || []).reduce((s, r) => s + (Number(r.accumulated_profit) || 0), 0);
}

function updateOwnerCombinedProfitDockVisibility() {
  const dock = document.getElementById("ownerCombinedProfitDock");
  if (!dock) return;
  const show =
    state.user?.role === "owner" &&
    (state.appInstance === "amana" || state.appInstance === "ufaray") &&
    OWNER_PAGES_WITH_COMBINED_PROFIT.has(state.currentPage);
  dock.classList.toggle("hidden", !show);
}

/** Owner: combined profit across every inventory module for the current calendar month. */
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
  const fd = feedersDrinkersAccumulatedProfitTotal();
  const med = medicamentsAccumulatedProfitTotal();
  const gas = gasAccumulatedProfitTotal();
  return feed + retail + chicken + fd + med + gas;
}

function calendarMonthOperationalDays(dmy) {
  const parts = parseDMYParts(dmy);
  if (!parts) return 0;
  return parts.d;
}

function calendarMonthCycleLabel(dmy) {
  const parts = parseDMYParts(dmy);
  if (!parts) return "";
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const lastDay = new Date(Date.UTC(parts.y, parts.m, 0)).getUTCDate();
  return `${names[parts.m - 1] || ""} (day ${parts.d} of ${lastDay})`;
}

function monthKeyFromDMYClient(dmy) {
  const parts = parseDMYParts(dmy);
  if (!parts) return null;
  return `${parts.y}-${String(parts.m).padStart(2, "0")}`;
}

function monthLabelFromKeyClient(monthKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey || "");
  if (!m) return monthKey || "";
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[Number(m[2]) - 1] || ""} ${m[1]}`;
}

function currentExpenditureMonthKey() {
  return monthKeyFromDMYClient(state.shopToday || clientShopTodayDMY()) || "";
}

function getExpStatementMonthFilter() {
  const sel = document.getElementById("expStatementMonth");
  if (sel instanceof HTMLSelectElement) {
    state.expenditureMonthFilter = sel.value;
  }
  const current = currentExpenditureMonthKey();
  return state.expenditureMonthFilter || current || "";
}

function expenditureRowsForDisplay() {
  const all = state.expenditureEntries || [];
  const filter = getExpStatementMonthFilter();
  if (!filter) return [];
  return all.filter((r) => monthKeyFromDMYClient(formatDateDMY(r.date)) === filter);
}

function expenditureEntriesForCurrentMonth() {
  const mk = monthKeyFromDMYClient(state.shopToday || clientShopTodayDMY());
  if (!mk) return [];
  return (state.expenditureEntries || []).filter(
    (r) => monthKeyFromDMYClient(formatDateDMY(r.date)) === mk
  );
}

function populateExpenditureMonthFilter() {
  const sel = document.getElementById("expStatementMonth");
  if (!(sel instanceof HTMLSelectElement)) return;
  const current = currentExpenditureMonthKey();
  const prev = state.expenditureMonthFilter || sel.value || current;
  const keys = new Set();
  if (current) keys.add(current);
  for (const r of state.expenditureEntries || []) {
    const mk = monthKeyFromDMYClient(formatDateDMY(r.date));
    if (mk) keys.add(mk);
  }
  const sorted = [...keys].sort((a, b) => b.localeCompare(a));
  sel.innerHTML = sorted
    .map((k) => {
      const label = monthLabelFromKeyClient(k);
      const suffix = k === current ? " (current)" : "";
      return `<option value="${k}">${label}${suffix}</option>`;
    })
    .join("");
  const pick = sorted.includes(prev) ? prev : current;
  if (pick) sel.value = pick;
  state.expenditureMonthFilter = sel.value || pick || "";
}

function ensureExpenditureStatementMonth() {
  const current = currentExpenditureMonthKey();
  if (!current) return;
  const prevTracked = state.expStatementLastShopMonth;
  if (prevTracked && prevTracked !== current) {
    state.expenditureMonthFilter = current;
  } else if (!state.expenditureMonthFilter) {
    state.expenditureMonthFilter = current;
  }
  state.expStatementLastShopMonth = current;
  populateExpenditureMonthFilter();
}

function updateBalanceBanner() {
  if (faithRoseBalancePageEnabled()) {
    renderFaithRoseBalancePage();
    return;
  }
  if (state.user?.role !== "owner") return;
  const combined = getOwnerCombinedProfitTotal();
  const today = state.shopToday || clientShopTodayDMY();
  const dailyOps = balanceDailyOperationalCostKes();
  const expRows = expenditureEntriesForCurrentMonth();
  const totalExpenditure = expRows.reduce((s, r) => s + (Number(r.money_out) || 0), 0);
  const daysInMonth = calendarMonthOperationalDays(today);
  const operational = daysInMonth * dailyOps;
  const monthKey = currentExpenditureMonthKey();
  const loanTotal = loanRepaymentsForMonth(monthKey);
  const remaining = combined - operational - totalExpenditure + loanTotal;

  document.querySelectorAll(".js-balance-remaining-value").forEach((el) => {
    const formatted = currency(Math.abs(remaining));
    const isNegative = remaining < 0;
    el.textContent = isNegative ? `- ${formatted}` : formatted;
    const banner = el.closest(".profit-highlight-above-table");
    if (banner) {
      banner.classList.toggle("balance-negative", isNegative);
      banner.classList.toggle("balance-positive", !isNegative);
    }
  });
  const cycleNote = `Calendar month: ${calendarMonthCycleLabel(today)}`;
  const loanPart =
    loanTotal > 0 ? ` + ${currency(loanTotal)} (loan repayment) = ${currency(remaining)}` : ` = ${currency(remaining)}`;
  const meta = `${currency(combined)} - (${currency(dailyOps)} × ${daysInMonth} day${daysInMonth === 1 ? "" : "s"}) - ${currency(
    totalExpenditure
  )} (expenditure)${loanPart} · ${cycleNote}. Accumulated profits reset at the start of each new month; expenditure history is kept on the Expenditure page.`;
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

function computeFeedBagProfitForMonth(ym) {
  const marginMap = new Map();
  for (const inv of state.records || []) {
    const key = `${displayBrand(inv.brand)}|||${displayFeedType(inv.feed_type)}|||${Number(inv.bag_size)}`;
    marginMap.set(key, Number(inv.profit_margin_per_bag) || 0);
  }
  let profit = 0;
  for (const r of state.salesBags || []) {
    if (!rowMatchesYM(r, ym)) continue;
    if (String(r.through_party || "").trim()) continue;
    const key = `${displayBrand(r.brand)}|||${displayFeedType(r.feed_type)}|||${Number(r.bag_size)}`;
    profit += (Number(r.bags_sold) || 0) * (marginMap.get(key) || 0);
  }
  return profit;
}

function computeRetailKgProfitForMonth(ym) {
  let profit = 0;
  for (const r of state.salesKg || []) {
    if (!rowMatchesYM(r, ym)) continue;
    if (String(r.through_party || "").trim()) continue;
    const m = Number(r.retail_margin_per_kg);
    if (Number.isFinite(m)) profit += (Number(r.kg_sold) || 0) * m;
  }
  return profit;
}

function computeItemSalesProfitForMonth(salesRows, inventoryRows, ym, nameField) {
  const marginMap = new Map();
  for (const inv of inventoryRows || []) {
    marginMap.set(String(inv[nameField] || ""), Number(inv.profit_margin) || 0);
  }
  let profit = 0;
  for (const r of salesRows || []) {
    if (!rowMatchesYM(r, ym)) continue;
    if (String(r.through_party || "").trim()) continue;
    profit += (Number(r.quantity_sold) || 0) * (marginMap.get(String(r.item_name || "")) || 0);
  }
  return profit;
}

function computeGasSalesProfitForMonth(ym) {
  const marginMap = new Map();
  for (const inv of state.gasInventory || []) {
    marginMap.set(Number(inv.size_kg), Number(inv.profit_margin) || 0);
  }
  let profit = 0;
  for (const r of state.gasSales || []) {
    if (!rowMatchesYM(r, ym)) continue;
    if (String(r.through_party || "").trim()) continue;
    profit += (Number(r.quantity_sold) || 0) * (marginMap.get(Number(r.size_kg)) || 0);
  }
  return profit;
}

function aggregateChickenSalesForMonth(ym) {
  const rows = (state.chickenSales || []).filter((r) => rowMatchesYM(r, ym) && !isChickenRowOwnerInventory(r));
  const map = new Map();
  let totalBirds = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  for (const r of rows) {
    const breed = r.breed || "—";
    const chicks = Number(r.quantity_birds) || 0;
    const rev = chickenSaleLineCombinedTotal(r);
    const prof = chickenSaleLineProfit(r);
    if (!map.has(breed)) map.set(breed, { breed, birds: 0, revenue: 0, profit: 0 });
    const entry = map.get(breed);
    entry.birds += chicks;
    entry.revenue += rev;
    entry.profit += prof;
    totalBirds += chicks;
    totalRevenue += rev;
    totalProfit += prof;
  }
  return {
    rows: Array.from(map.values()).sort((a, b) => b.profit - a.profit || b.revenue - a.revenue),
    totalBirds,
    totalRevenue,
    totalProfit,
    rowCount: rows.length,
  };
}

function aggregateEmployeeItemSalesForMonth(salesRows, ym, groupLabelFn) {
  const rows = (salesRows || []).filter((r) => rowMatchesYM(r, ym));
  const map = new Map();
  let totalQty = 0;
  let totalRevenue = 0;
  for (const r of rows) {
    const label = groupLabelFn(r);
    const qty = Number(r.quantity_sold) || 0;
    const rev = Number.isFinite(Number(r.total_amount))
      ? Number(r.total_amount)
      : qty * (Number(r.price_per_item) || 0);
    if (!map.has(label)) map.set(label, { label, qty: 0, revenue: 0 });
    const entry = map.get(label);
    entry.qty += qty;
    entry.revenue += rev;
    totalQty += qty;
    totalRevenue += rev;
  }
  return {
    rows: Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.qty - a.qty),
    totalQty,
    totalRevenue,
    rowCount: rows.length,
  };
}

function aggregateExpenditureForMonth(ym) {
  const rows = (state.expenditureEntries || []).filter(
    (r) => monthKeyFromDMYClient(formatDateDMY(r.date)) === ym
  );
  let total = 0;
  const byCat = new Map();
  for (const r of rows) {
    const cat = normalizeExpenditureCategory(r.category);
    const amt = Number(r.money_out) || 0;
    total += amt;
    byCat.set(cat, (byCat.get(cat) || 0) + amt);
  }
  return {
    total,
    rowCount: rows.length,
    byCategory: Array.from(byCat.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

function aggregatePigsForMonth(ym) {
  const rows = (state.pigsEntries || []).filter((r) => rowMatchesYM(r, ym));
  let moneyIn = 0;
  let moneyOut = 0;
  let numPigs = 0;
  for (const r of rows) {
    moneyIn += Number(r.money_in) || 0;
    moneyOut += Number(r.money_out) || 0;
    numPigs += Number(r.num_pigs) || 0;
  }
  return { rowCount: rows.length, moneyIn, moneyOut, numPigs };
}

function aggregateCreditForMonth(ym) {
  const rows = (state.creditEntries || []).filter((r) => rowMatchesYM(r, ym));
  const map = new Map();
  let moneyIn = 0;
  let moneyOut = 0;
  for (const r of rows) {
    const acc = (state.creditAccounts || []).find((a) => a.id === Number(r.account_id));
    const name = acc?.name || `Account #${r.account_id}`;
    const mi = Number(r.money_in) || 0;
    const mo = Number(r.money_out) || 0;
    moneyIn += mi;
    moneyOut += mo;
    if (!map.has(name)) map.set(name, { name, moneyIn: 0, moneyOut: 0, entries: 0 });
    const entry = map.get(name);
    entry.moneyIn += mi;
    entry.moneyOut += mo;
    entry.entries += 1;
  }
  return {
    rowCount: rows.length,
    moneyIn,
    moneyOut,
    accounts: Array.from(map.values()).sort((a, b) => b.moneyIn + b.moneyOut - (a.moneyIn + a.moneyOut)),
  };
}

function buildMonthlyReportSnapshot(ym) {
  const bagAgg = aggregateBagSalesForMonth(ym);
  const kgAgg = aggregateKgSalesForMonth(ym);
  const chickenAgg = aggregateChickenSalesForMonth(ym);
  const fdAgg = aggregateEmployeeItemSalesForMonth(
    state.feedersDrinkersSales,
    ym,
    (r) => r.item_name || "—"
  );
  const medAgg = aggregateEmployeeItemSalesForMonth(state.medicamentsSales, ym, (r) => r.item_name || "—");
  const gasAgg = aggregateEmployeeItemSalesForMonth(
    state.gasSales,
    ym,
    (r) => `${Number(r.size_kg) || 0} kg cylinder`
  );
  const expAgg = aggregateExpenditureForMonth(ym);
  const pigsAgg = aggregatePigsForMonth(ym);
  const creditAgg = aggregateCreditForMonth(ym);
  const profits = {
    feedBags: computeFeedBagProfitForMonth(ym),
    retailKg: computeRetailKgProfitForMonth(ym),
    chicken: chickenAgg.totalProfit,
    feedersDrinkers: computeItemSalesProfitForMonth(
      state.feedersDrinkersSales,
      state.feedersDrinkersInventory,
      ym,
      "item_name"
    ),
    medicaments: computeItemSalesProfitForMonth(
      state.medicamentsSales,
      state.medicamentsInventory,
      ym,
      "item_name"
    ),
    gas: computeGasSalesProfitForMonth(ym),
  };
  const totalRevenue =
    bagAgg.totalRevenue +
    kgAgg.totalRevenue +
    chickenAgg.totalRevenue +
    fdAgg.totalRevenue +
    medAgg.totalRevenue +
    gasAgg.totalRevenue;
  const totalProfit =
    profits.feedBags +
    profits.retailKg +
    profits.chicken +
    profits.feedersDrinkers +
    profits.medicaments +
    profits.gas;
  const moduleOverview = [
    {
      module: "Sales Per Bags",
      sales: bagAgg.totalBags,
      unit: "bags",
      revenue: bagAgg.totalRevenue,
      profit: profits.feedBags,
    },
    {
      module: "Sales Per Kg (Retail)",
      sales: kgAgg.totalKg,
      unit: "kg",
      revenue: kgAgg.totalRevenue,
      profit: profits.retailKg,
    },
    {
      module: "Chicken Sales",
      sales: chickenAgg.totalBirds,
      unit: "chicks",
      revenue: chickenAgg.totalRevenue,
      profit: profits.chicken,
    },
    {
      module: "Feeders & Drinkers",
      sales: fdAgg.totalQty,
      unit: "items",
      revenue: fdAgg.totalRevenue,
      profit: profits.feedersDrinkers,
    },
    {
      module: "Medicaments",
      sales: medAgg.totalQty,
      unit: "items",
      revenue: medAgg.totalRevenue,
      profit: profits.medicaments,
    },
    {
      module: "Gas",
      sales: gasAgg.totalQty,
      unit: "cylinders",
      revenue: gasAgg.totalRevenue,
      profit: profits.gas,
    },
    {
      module: "Expenditure",
      sales: expAgg.rowCount,
      unit: "entries",
      revenue: 0,
      profit: -expAgg.total,
      isExpense: true,
    },
  ];
  if (pigsAgg.rowCount > 0) {
    moduleOverview.push({
      module: "Pigs Page",
      sales: pigsAgg.numPigs,
      unit: "pigs",
      revenue: pigsAgg.moneyIn,
      profit: pigsAgg.moneyIn - pigsAgg.moneyOut,
      extra: `${currency(pigsAgg.moneyOut)} out`,
    });
  }
  if (creditAgg.rowCount > 0) {
    moduleOverview.push({
      module: "Credit",
      sales: creditAgg.rowCount,
      unit: "entries",
      revenue: creditAgg.moneyIn,
      profit: creditAgg.moneyIn - creditAgg.moneyOut,
      extra: `${currency(creditAgg.moneyOut)} out`,
    });
  }
  return {
    ym,
    bagAgg,
    kgAgg,
    chickenAgg,
    fdAgg,
    medAgg,
    gasAgg,
    expAgg,
    pigsAgg,
    creditAgg,
    profits,
    totalRevenue,
    totalProfit,
    moduleOverview,
  };
}

function fillMonthlyReportTable(bodyId, colSpan, emptyText, rows, rowHtmlFn) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${colSpan}" class="empty">${emptyText}</td></tr>`;
    return;
  }
  body.innerHTML = rows.slice(0, 10).map(rowHtmlFn).join("");
}

function buildMonthlyAdvice(ym, snap) {
  const bagAgg = snap.bagAgg;
  const kgAgg = snap.kgAgg;
  const chickenAgg = snap.chickenAgg;
  const fdAgg = snap.fdAgg;
  const medAgg = snap.medAgg;
  const gasAgg = snap.gasAgg;
  const expAgg = snap.expAgg;
  const { totalRevenue, totalProfit } = snap;
  const advice = [];
  const monthName = monthLabel(ym);
  const prevYm = previousYM(ym);
  const prevBag = prevYm ? aggregateBagSalesForMonth(prevYm) : null;
  const prevKg = prevYm ? aggregateKgSalesForMonth(prevYm) : null;
  const prevSnap = prevYm ? buildMonthlyReportSnapshot(prevYm) : null;

  const anyActivity =
    bagAgg.totalBags > 0 ||
    kgAgg.totalKg > 0 ||
    chickenAgg.totalBirds > 0 ||
    fdAgg.totalQty > 0 ||
    medAgg.totalQty > 0 ||
    gasAgg.totalQty > 0 ||
    expAgg.rowCount > 0;

  if (!anyActivity) {
    advice.push(
      `No activity recorded for ${monthName} across feed, chicken, feeders & drinkers, medicaments, gas, or expenditure. Make sure staff are recording sales on every page.`
    );
    return advice;
  }

  advice.push(
    `<strong>All-module summary:</strong> ${currency(totalRevenue)} recorded revenue and ${currency(totalProfit)} estimated profit across every sales page${expAgg.total > 0 ? `; expenditure ${currency(expAgg.total)}` : ""}.`
  );

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

  const topChicken = chickenAgg.rows[0];
  if (topChicken && topChicken.birds > 0) {
    advice.push(
      `<strong>Chicken sales:</strong> ${chickenAgg.totalBirds} chick${chickenAgg.totalBirds === 1 ? "" : "s"} (${currency(chickenAgg.totalProfit)} profit). Top breed: ${topChicken.breed} (${topChicken.birds} chicks).`
    );
  } else if (chickenAgg.rowCount === 0 && (bagAgg.totalBags > 0 || kgAgg.totalKg > 0)) {
    advice.push("No staff chicken sales this month — consider promoting chick orders alongside feed sales.");
  }

  const topFd = fdAgg.rows[0];
  if (topFd && topFd.qty > 0) {
    advice.push(`<strong>Feeders & drinkers:</strong> ${topFd.label} led with ${topFd.qty} sold (${currency(topFd.revenue)}).`);
  }
  const topMed = medAgg.rows[0];
  if (topMed && topMed.qty > 0) {
    advice.push(`<strong>Medicaments:</strong> ${topMed.label} led with ${topMed.qty} sold (${currency(topMed.revenue)}).`);
  }
  const topGas = gasAgg.rows[0];
  if (topGas && topGas.qty > 0) {
    advice.push(`<strong>Gas:</strong> ${topGas.label} led with ${topGas.qty} sold (${currency(topGas.revenue)}).`);
  }

  if (expAgg.total > 0 && totalRevenue > 0) {
    const share = Math.round((expAgg.total / totalRevenue) * 100);
    advice.push(
      `Expenditure was ${currency(expAgg.total)} (${share}% of recorded revenue). ${share >= 50 ? "Review costs — spending is high relative to sales." : "Keep tracking money out on the Expenditure page."}`
    );
  }

  if (prevSnap && prevSnap.totalProfit > 0) {
    const diff = totalProfit - prevSnap.totalProfit;
    const pct = Math.round((diff / prevSnap.totalProfit) * 100);
    if (diff > 0) {
      advice.push(`Estimated profit across all modules is up ${pct}% versus ${monthLabel(prevYm)}.`);
    } else if (diff < 0) {
      advice.push(`Estimated profit across all modules dropped ${Math.abs(pct)}% versus ${monthLabel(prevYm)}. Check slow lines and expenditure.`);
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

  const monthRows = (state.salesBags || [])
    .filter((r) => rowMatchesYM(r, ym))
    .concat((state.salesKg || []).filter((r) => rowMatchesYM(r, ym)))
    .concat((state.chickenSales || []).filter((r) => rowMatchesYM(r, ym)))
    .concat((state.feedersDrinkersSales || []).filter((r) => rowMatchesYM(r, ym)))
    .concat((state.medicamentsSales || []).filter((r) => rowMatchesYM(r, ym)))
    .concat((state.gasSales || []).filter((r) => rowMatchesYM(r, ym)));
  const activeDays = new Set();
  for (const r of monthRows) {
    const p = parseDMYParts(r.date);
    if (p) activeDays.add(`${p.y}-${p.m}-${p.d}`);
  }
  if (activeDays.size > 0) {
    const avg = totalRevenue / activeDays.size;
    advice.push(`Average recorded revenue per active day: ${currency(avg)} across ${activeDays.size} day${activeDays.size === 1 ? "" : "s"} (all modules).`);
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
  const snap = buildMonthlyReportSnapshot(ym);
  const { bagAgg, kgAgg, chickenAgg, fdAgg, medAgg, gasAgg, expAgg, moduleOverview, totalRevenue, totalProfit } =
    snap;
  const monthName = monthLabel(ym);

  const titleEl = document.getElementById("mrSummaryTitle");
  if (titleEl) titleEl.textContent = `${monthName} — all-module summary`;
  const subEl = document.getElementById("mrSummarySub");
  if (subEl) {
    subEl.textContent = `Combined revenue and estimated profit from every page: feed, retail, chicken, feeders & drinkers, medicaments, gas, and expenditure.`;
  }
  const amtEl = document.getElementById("mrSummaryAmount");
  if (amtEl) amtEl.textContent = currency(totalRevenue);
  const metaEl = document.getElementById("mrSummaryMeta");
  if (metaEl) {
    const kgPretty = Number(kgAgg.totalKg).toFixed(2);
    metaEl.textContent = `${currency(totalRevenue)} revenue · ${currency(totalProfit)} est. profit · ${bagAgg.totalBags} bags · ${kgPretty} kg · ${chickenAgg.totalBirds} chicks · expenditure ${currency(expAgg.total)}`;
  }

  fillMonthlyReportTable(
    "mr-modules-body",
    5,
    `No module activity for ${monthName}.`,
    moduleOverview.filter((m) => (m.isExpense ? m.sales > 0 || m.profit !== 0 : m.sales > 0)),
    (row, idx) => {
      const salesLabel =
        row.unit === "kg"
          ? Number(row.sales).toFixed(2)
          : row.isExpense
            ? String(row.sales)
            : String(row.sales);
      const profitCell = row.isExpense
        ? currency(-Math.abs(row.profit))
        : currency(row.profit);
      const extra = row.extra ? ` · ${row.extra}` : "";
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtmlCell(row.module)}</td>
        <td>${salesLabel} ${escapeHtmlCell(row.unit)}</td>
        <td>${row.isExpense ? "—" : currency(row.revenue)}${extra}</td>
        <td>${profitCell}</td>
      </tr>`;
    }
  );

  fillMonthlyReportTable(
    "mr-bags-body",
    6,
    `No bag sales for ${monthName}.`,
    bagAgg.rows,
    (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtmlCell(row.brand)}</td>
        <td>${escapeHtmlCell(row.feed)}</td>
        <td>${row.bagSize} kg</td>
        <td>${row.bagsSold}</td>
        <td>${currency(row.revenue)}</td>
      </tr>`
  );

  fillMonthlyReportTable(
    "mr-kg-body",
    5,
    `No kg sales for ${monthName}.`,
    kgAgg.rows,
    (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtmlCell(row.brand)}</td>
        <td>${escapeHtmlCell(row.feed)}</td>
        <td>${Number(row.kg).toFixed(2)}</td>
        <td>${currency(row.revenue)}</td>
      </tr>`
  );

  fillMonthlyReportTable(
    "mr-chicken-body",
    5,
    `No staff chicken sales for ${monthName}.`,
    chickenAgg.rows,
    (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtmlCell(row.breed)}</td>
        <td>${row.birds}</td>
        <td>${currency(row.revenue)}</td>
        <td>${currency(row.profit)}</td>
      </tr>`
  );

  fillMonthlyReportTable(
    "mr-fd-body",
    4,
    `No feeders & drinkers sales for ${monthName}.`,
    fdAgg.rows,
    (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtmlCell(row.label)}</td>
        <td>${row.qty}</td>
        <td>${currency(row.revenue)}</td>
      </tr>`
  );

  fillMonthlyReportTable(
    "mr-med-body",
    4,
    `No medicaments sales for ${monthName}.`,
    medAgg.rows,
    (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtmlCell(row.label)}</td>
        <td>${row.qty}</td>
        <td>${currency(row.revenue)}</td>
      </tr>`
  );

  fillMonthlyReportTable(
    "mr-gas-body",
    4,
    `No gas sales for ${monthName}.`,
    gasAgg.rows,
    (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtmlCell(row.label)}</td>
        <td>${row.qty}</td>
        <td>${currency(row.revenue)}</td>
      </tr>`
  );

  fillMonthlyReportTable(
    "mr-exp-body",
    2,
    `No expenditure for ${monthName}.`,
    expAgg.byCategory,
    (row) => `<tr>
        <td>${escapeHtmlCell(row.category)}</td>
        <td>${currency(row.amount)}</td>
      </tr>`
  );

  const adviceEl = document.getElementById("mrAdvice");
  if (adviceEl) {
    const items = buildMonthlyAdvice(ym, snap);
    if (items.length === 0) {
      adviceEl.innerHTML = `<li class="empty">No advice available for ${monthName} yet.</li>`;
    } else {
      adviceEl.innerHTML = items.map((html) => `<li>${html}</li>`).join("");
    }
  }
}

async function loadMonthlyRecordsData() {
  if (!monthlyRecordsTenantEnabled()) {
    state.monthlyRecordsPayload = {
      records: [],
      currentMonthKey: null,
      currentMonthLabel: null,
      currentClosed: false,
      preview: null,
    };
    return;
  }
  try {
    state.monthlyRecordsPayload = await api("/api/monthly-records");
  } catch {
    state.monthlyRecordsPayload = {
      records: [],
      currentMonthKey: null,
      currentMonthLabel: null,
      currentClosed: false,
      preview: null,
    };
  }
}

async function loadLoanRepaymentsData() {
  if (!loanRepaymentTenantEnabled()) {
    state.loanRepayments = [];
    state.loanRepaymentPreview = null;
    return;
  }
  try {
    state.loanRepayments = await api("/api/loan-repayments");
  } catch {
    state.loanRepayments = [];
  }
}

function defaultLoanRepaymentMonthValue() {
  const today = state.shopToday || clientShopTodayDMY();
  const parts = parseDMYParts(today);
  if (!parts) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${parts.y}-${String(parts.m).padStart(2, "0")}`;
}

function resetLoanRepaymentForm() {
  state.editLoanRepaymentId = null;
  const monthEl = document.getElementById("loanRepaymentMonth");
  const amountEl = document.getElementById("loanRepaymentAmount");
  const noteEl = document.getElementById("loanRepaymentNote");
  const saveBtn = document.getElementById("loanRepaymentSaveBtn");
  if (monthEl instanceof HTMLInputElement) monthEl.value = defaultLoanRepaymentMonthValue();
  if (amountEl instanceof HTMLInputElement) amountEl.value = "";
  if (noteEl instanceof HTMLInputElement) noteEl.value = "";
  if (saveBtn) saveBtn.textContent = "Save repayment";
  refreshLoanRepaymentPreview();
}

function populateLoanRepaymentForm(row) {
  const id = Number(row.id);
  state.editLoanRepaymentId = Number.isFinite(id) ? id : null;
  const monthEl = document.getElementById("loanRepaymentMonth");
  const amountEl = document.getElementById("loanRepaymentAmount");
  const noteEl = document.getElementById("loanRepaymentNote");
  const saveBtn = document.getElementById("loanRepaymentSaveBtn");
  if (monthEl instanceof HTMLInputElement) monthEl.value = String(row.month_key || "").trim();
  if (amountEl instanceof HTMLInputElement) amountEl.value = String(Number(row.amount) || "");
  if (noteEl instanceof HTMLInputElement) noteEl.value = String(row.note || "");
  if (saveBtn) saveBtn.textContent = "Update repayment";
  refreshLoanRepaymentPreview();
}

async function refreshLoanRepaymentPreview() {
  if (!loanRepaymentTenantEnabled()) return;
  const monthEl = document.getElementById("loanRepaymentMonth");
  const amountEl = document.getElementById("loanRepaymentAmount");
  const monthKey =
    monthEl instanceof HTMLInputElement && /^\d{4}-\d{2}$/.test(monthEl.value)
      ? monthEl.value
      : defaultLoanRepaymentMonthValue();
  const draftAmount = Number(amountEl instanceof HTMLInputElement ? amountEl.value : 0) || 0;
  const editId = state.editLoanRepaymentId;
  const existingForMonth = loanRepaymentsForMonth(monthKey);
  const editingRow = editId
    ? (state.loanRepayments || []).find((r) => Number(r.id) === Number(editId))
    : null;
  const editingAmount = editingRow ? Number(editingRow.amount) || 0 : 0;
  const editingMonth = editingRow ? String(editingRow.month_key || "").trim() : "";
  let preview = state.loanRepaymentPreview;
  if (!preview || preview.monthKey !== monthKey) {
    try {
      preview = await api(`/api/loan-repayments/balance-preview?month_key=${encodeURIComponent(monthKey)}`);
      state.loanRepaymentPreview = preview;
    } catch {
      preview = null;
      state.loanRepaymentPreview = null;
    }
  }
  const titleEl = document.getElementById("loanRepaymentPreviewTitle");
  const subEl = document.getElementById("loanRepaymentPreviewSub");
  const balEl = document.getElementById("loanRepaymentPreviewBalance");
  const metaEl = document.getElementById("loanRepaymentPreviewMeta");
  const panel = document.getElementById("loanRepaymentPreviewPanel");
  if (!preview) {
    if (titleEl) titleEl.textContent = "Balance preview";
    if (subEl) subEl.textContent = "Could not load balance for the selected month.";
    if (balEl) balEl.textContent = "KES 0";
    if (metaEl) metaEl.textContent = "";
    return;
  }
  let projectedLoanTotal = Number(preview.loanRepaymentTotal ?? existingForMonth);
  if (draftAmount > 0) {
    if (editId && editingRow) {
      if (editingMonth === monthKey) {
        projectedLoanTotal = projectedLoanTotal - editingAmount + draftAmount;
      } else {
        projectedLoanTotal = projectedLoanTotal + draftAmount;
      }
    } else if (!editId) {
      projectedLoanTotal = projectedLoanTotal + draftAmount;
    }
  }
  const projectedBalance = Number(preview.rawBalance ?? 0) + projectedLoanTotal;
  const monthLabel = preview.monthLabel || monthLabelFromKey(monthKey);
  if (titleEl) {
    titleEl.textContent = preview.monthClosed ? `${monthLabel} — closed books` : `${monthLabel} — open month`;
  }
  if (subEl) {
    subEl.textContent = preview.monthClosed
      ? "This month is already closed. New repayments update the displayed balance for that month."
      : "Repayments for this month also appear on the Balance page while the month is open.";
  }
  if (balEl) {
    const formatted = currency(Math.abs(projectedBalance));
    balEl.textContent = projectedBalance < 0 ? `- ${formatted}` : formatted;
    if (panel) {
      panel.classList.toggle("balance-negative", projectedBalance < 0);
      panel.classList.toggle("balance-positive", projectedBalance >= 0);
    }
  }
  if (metaEl) {
    const parts = [
      `Raw balance: ${currency(preview.rawBalance ?? 0)}`,
      `Loan repayments: ${currency(preview.loanRepaymentTotal ?? 0)}`,
      `Current effective balance: ${currency(preview.effectiveBalance ?? 0)}`,
    ];
    if (draftAmount > 0 && Math.abs(projectedBalance - Number(preview.effectiveBalance ?? 0)) > 0.005) {
      parts.push(`After this entry: ${currency(projectedBalance)}`);
    }
    metaEl.textContent = parts.join(" · ");
  }
}

function monthLabelFromKey(monthKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey || "");
  if (!m) return monthKey || "";
  const mo = Number(m[2]);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[mo - 1] || monthKey} ${m[1]}`;
}

function renderLoanRepaymentTable() {
  const body = document.getElementById("loan-repayment-body");
  if (!body) return;
  const rows = [...(state.loanRepayments || [])].sort((a, b) => {
    const mk = String(b.month_key || "").localeCompare(String(a.month_key || ""));
    if (mk !== 0) return mk;
    return Number(b.id) - Number(a.id);
  });
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No loan repayments yet.</td></tr>';
    return;
  }
  body.innerHTML = rows
    .map((row) => {
      const label = monthLabelFromKey(row.month_key);
      return `<tr>
        <td>${escapeHtmlCell(label)}</td>
        <td>${currency(row.amount ?? 0)}</td>
        <td>${escapeHtmlCell(row.note || "—")}</td>
        <td>${escapeHtmlCell(row.created_by || "—")}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="loan" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="loan" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function renderLoanRepaymentPage() {
  if (state.currentPage !== "loan-repayment") return;
  if (!loanRepaymentTenantEnabled()) return;
  renderLoanRepaymentTable();
  const monthEl = document.getElementById("loanRepaymentMonth");
  if (monthEl instanceof HTMLInputElement && !monthEl.value) {
    monthEl.value = defaultLoanRepaymentMonthValue();
  }
  refreshLoanRepaymentPreview();
}

function renderMonthlyRecords() {
  if (state.currentPage !== "monthly-records") return;
  if (!monthlyRecordsTenantEnabled()) return;
  const payload = state.monthlyRecordsPayload || {};
  const records = payload.records || [];
  const preview = payload.preview || {};
  const titleEl = document.getElementById("monthlyRecordsCurrentTitle");
  const subEl = document.getElementById("monthlyRecordsCurrentSub");
  const balEl = document.getElementById("monthlyRecordsCurrentBalance");
  const metaEl = document.getElementById("monthlyRecordsCurrentMeta");
  const closeBtn = document.getElementById("monthlyRecordsCloseBtn");
  const panel = document.getElementById("monthlyRecordsCurrentPanel");
  const monthLabel = payload.currentMonthLabel || "This month";
  if (titleEl) {
    titleEl.textContent = payload.currentClosed
      ? `${monthLabel} — closed`
      : `Current month — ${monthLabel}`;
  }
  if (subEl) {
    subEl.textContent = payload.currentClosed
      ? "This month has already been saved. Totals below show live figures for reference only."
      : "These are the totals that will be saved when you close the books for this month.";
  }
  const balanceVal = Number(preview.balance ?? 0);
  if (balEl) {
    const formatted = currency(Math.abs(balanceVal));
    balEl.textContent = balanceVal < 0 ? `- ${formatted}` : formatted;
    if (panel) {
      panel.classList.toggle("balance-negative", balanceVal < 0);
      panel.classList.toggle("balance-positive", balanceVal >= 0);
    }
  }
  if (metaEl) {
    const loanPart =
      Number(preview.loanRepayment ?? 0) > 0
        ? ` · Loan repayment: ${currency(preview.loanRepayment ?? 0)}`
        : "";
    metaEl.textContent = `Combined profits: ${currency(preview.combinedProfit ?? 0)} · Expenditure: ${currency(
      preview.expenditure ?? 0
    )}${loanPart} · Balance: ${currency(balanceVal)}`;
  }
  if (closeBtn) {
    closeBtn.disabled = !!payload.currentClosed;
    closeBtn.textContent = payload.currentClosed
      ? `${monthLabel} already closed`
      : `Close books for ${monthLabel}`;
  }
  const body = document.getElementById("monthly-records-body");
  if (!body) return;
  if (!records.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">No closed months yet.</td></tr>';
    return;
  }
  body.innerHTML = records
    .map((row) => {
      const loanAdd = loanRepaymentsForMonth(row.month_key);
      const bal = Number(row.balance ?? 0) + loanAdd;
      const balClass = bal < 0 ? ' style="color:var(--danger,#d32f2f)"' : "";
      const balText = bal < 0 ? `- ${currency(Math.abs(bal))}` : currency(bal);
      return `<tr>
        <td>${escapeHtmlCell(row.month_label || row.month_key || "—")}</td>
        <td>${currency(row.combined_profit ?? 0)}</td>
        <td>${currency(row.expenditure ?? 0)}</td>
        <td${balClass}>${balText}</td>
      </tr>`;
    })
    .join("");
}

const PDF_PAGE_THEME = {
  dark: [14, 92, 58],
  accent: [39, 150, 99],
  mint: [234, 248, 240],
  edge: [186, 222, 198],
};

function ensureJsPdfReady() {
  const jsPdfNs = window.jspdf;
  const JsPdfCtor = jsPdfNs?.jsPDF;
  if (typeof JsPdfCtor !== "function") {
    alert("PDF generator is not loaded. Refresh and try again.");
    return null;
  }
  const probe = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });
  if (typeof probe.autoTable !== "function" && typeof jsPdfNs?.autoTable !== "function") {
    alert("PDF table helper is not loaded. Refresh and try again.");
    return null;
  }
  return { jsPdfNs, JsPdfCtor };
}

/** jspdf-autotable: use doc.autoTable(options) or jsPDF.autoTable(doc, options). */
function runPdfAutoTable(doc, jsPdfNs, options) {
  if (typeof doc.autoTable === "function") {
    doc.autoTable(options);
    return;
  }
  if (typeof jsPdfNs?.autoTable === "function") {
    jsPdfNs.autoTable(doc, options);
    return;
  }
  throw new Error("PDF table helper is not available.");
}

function pdfBusinessTitle() {
  if (state.appInstance === "water-bills") return "Water Bills";
  if (state.appInstance === "electricity-bills") return "Electricity Bills";
  if (state.appInstance === "ufaray") return "Ufaray Feeds";
  if (state.appInstance === "maina-faith-cess") return "Faith Inventory";
  if (state.appInstance === "terry") return "Terry Records";
  if (state.appInstance === "cess" || state.appInstance === "terry-and-cess") return "Rose Inventory";
  return "Amana Kuku Feeds";
}

function pdfSafeSlug(text) {
  return String(text || "page")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function drawStandardPagePdfHeader(doc, { pageTitle, subtitle }) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  doc.setFillColor(...PDF_PAGE_THEME.dark);
  doc.rect(0, 0, pageW, 58, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(pdfBusinessTitle().toUpperCase(), margin, 24);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(String(pageTitle || "PAGE").toUpperCase(), margin, 42);
  if (subtitle) {
    doc.setFontSize(9);
    doc.text(String(subtitle), pageW - margin, 42, { align: "right" });
  }
  return 74;
}

function pdfRowFromTableCells(cells, headerCount) {
  const row = [];
  for (const cell of cells) {
    if (cell.querySelector(".row-actions")) continue;
    const text = cell.textContent.trim().replace(/\s+/g, " ");
    const span = Number(cell.colSpan) || 1;
    for (let i = 0; i < span; i++) row.push(i === 0 ? text : "");
  }
  while (row.length < headerCount) row.push("");
  if (row.length > headerCount) row.length = headerCount;
  return row.map((c) => ({ content: c || "—", styles: { fontStyle: "bold" } }));
}

function tableElementToPdfData(table) {
  if (!(table instanceof HTMLTableElement)) return null;
  const ths = [...table.querySelectorAll("thead th")];
  if (!ths.length) return null;
  let headers = ths.map((th) => th.textContent.trim().replace(/\s+/g, " "));
  const actionIdx = headers.findIndex((h) => /^actions?$/i.test(h));
  if (actionIdx >= 0) headers = headers.filter((_, i) => i !== actionIdx);
  const body = [];
  for (const tr of table.querySelectorAll("tbody tr")) {
    if (tr.querySelector("td.empty")) continue;
    const cells = [...tr.querySelectorAll("td")].filter((td) => !td.querySelector(".row-actions"));
    if (!cells.length) continue;
    let row = cells.map((td) => td.textContent.trim().replace(/\s+/g, " "));
    while (row.length > headers.length) row.pop();
    while (row.length < headers.length) row.push("");
    body.push(row);
  }
  for (const tr of table.querySelectorAll("tfoot tr")) {
    const cells = [...tr.querySelectorAll("th, td")];
    if (!cells.length) continue;
    const footerRow = pdfRowFromTableCells(cells, headers.length);
    if (footerRow.some((c) => c.content && c.content !== "—")) body.push(footerRow);
  }
  if (!body.length) return null;
  return { headers, body };
}

function downloadStandardPageTablePdf({ pageTitle, subtitle, filename, sections, landscape = false, billToText = "" }) {
  const ctx = ensureJsPdfReady();
  if (!ctx) return;
  const { jsPdfNs, JsPdfCtor } = ctx;
  const doc = new JsPdfCtor({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  let y = drawStandardPagePdfHeader(doc, { pageTitle, subtitle });
  const billTo = String(billToText || "").trim();
  if (billTo) {
    doc.setTextColor(...PDF_PAGE_THEME.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("BILL TO", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(33, 33, 33);
    const billLines = doc.splitTextToSize(billTo, pageW - margin * 2);
    doc.text(billLines, margin, y);
    y += billLines.length * 12 + 10;
  }
  const allSections = (Array.isArray(sections) ? sections : [sections]).filter(Boolean);
  let wroteRows = false;

  for (const sec of allSections) {
    if (!sec?.headers?.length || !sec?.body?.length) continue;
    wroteRows = true;
    if (sec.title) {
      doc.setTextColor(...PDF_PAGE_THEME.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(sec.title, margin, y);
      y += 14;
    }
    runPdfAutoTable(doc, jsPdfNs, {
      startY: y,
      head: [sec.headers],
      body: sec.body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: PDF_PAGE_THEME.dark, textColor: 255 },
      alternateRowStyles: { fillColor: PDF_PAGE_THEME.mint },
      theme: "grid",
    });
    y = (doc.lastAutoTable?.finalY || y) + 22;
  }

  if (!wroteRows) {
    doc.setTextColor(...PDF_PAGE_THEME.dark);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("No records to export on this page.", margin, y + 10);
  }
  doc.save(filename);
}

function pdfSectionsFromPageElement(pageEl) {
  const sections = [];
  pageEl.querySelectorAll(".table-wrap table").forEach((table) => {
    const data = tableElementToPdfData(table);
    if (!data || !data.body.length) return;
    const card = table.closest(".card");
    const title =
      card?.querySelector(".card-title")?.textContent?.trim() ||
      card?.querySelector("h3")?.textContent?.trim() ||
      "";
    sections.push({ title, ...data });
  });
  return sections;
}

function meterBillsPdfBillToText(entries) {
  const names = [
    ...new Set((entries || []).map((r) => String(r.bill_to || "").trim()).filter(Boolean)),
  ];
  return names.join("\n");
}

const METER_BILLS_PDF_WATER_PAYMENT_LINES = ["Till No. 5757375", "Amana Kuku Feeds"];

function drawMeterBillsPaymentDetails(doc, { margin, pageW, startY, serviceItem, totalDue }) {
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_PAGE_THEME.dark);
  doc.text("Payment details", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(33, 33, 33);
  const maxW = pageW - margin * 2;
  const amountDue = formatKshPlainNumber(totalDue);
  if (isElectricityBillsKind(serviceItem)) {
    const paymentLines = [
      `For Payment, kindly buy token directly using Paybill 888880 Account Number 37195247590. Amount Due: Ksh ${amountDue}.`,
      "Then share the KPLC token message to WhatsApp number: 0740259645.",
    ];
    for (const line of paymentLines) {
      const wrapped = doc.splitTextToSize(line, maxW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 14;
    }
    y += 8;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const noteWrapped = doc.splitTextToSize("Note: Pay before 10th of every month.", maxW);
    doc.text(noteWrapped, margin, y);
    y += noteWrapped.length * 12;
  } else {
    for (const line of METER_BILLS_PDF_WATER_PAYMENT_LINES) {
      doc.text(line, margin, y);
      y += 14;
    }
  }
  return y;
}

function formatBillDateShort(dmy) {
  const parts = parseDMYParts(dmy);
  if (!parts) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(parts.d).padStart(2, "0")}-${months[parts.m - 1]}-${parts.y}`;
}

/** Two-column label/value grid (invoice header block). */
function drawMeterBillsInvoiceInfoGrid(doc, { margin, pageW, startY, rows }) {
  const colGap = 24;
  const colW = (pageW - margin * 2 - colGap) / 2;
  const leftX = margin;
  const rightX = margin + colW + colGap;
  const labelW = 92;
  const lineH = 12;
  let y = startY;
  doc.setFontSize(9);
  for (const pair of rows) {
    const blocks = [];
    let maxLines = 1;
    for (let c = 0; c < 2; c += 1) {
      const item = pair[c];
      if (!item) continue;
      const valueLines = doc.splitTextToSize(String(item.value || "—"), colW - labelW - 4);
      maxLines = Math.max(maxLines, valueLines.length);
      blocks.push({ x: c === 0 ? leftX : rightX, label: item.label, valueLines });
    }
    for (const block of blocks) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_PAGE_THEME.dark);
      doc.text(block.label, block.x, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      doc.text(block.valueLines, block.x + labelW, y);
    }
    y += maxLines * lineH + 4;
  }
  return y + 4;
}

function drawMeterBillsInvoicePage(doc, jsPdfNs, row, { pageTitle, serviceItem, pageIndex, pageCount }) {
  const units = meterBillsUnitConfig(serviceItem);
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const rightX = pageW - margin;
  const isElectricity = isElectricityBillsKind(serviceItem);
  let y = 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_PAGE_THEME.dark);
  if (isElectricity) {
    doc.text("Electricity Bill", pageW / 2, y, { align: "center" });
    y += 28;
  } else {
    doc.text(pageTitle, margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(units.pdfStatementSub, margin, y);
    y += 22;
  }

  const billTo = String(row.bill_to || "").trim() || "—";
  const billDate = formatBillDateShort(state.shopToday || clientShopTodayDMY());
  y = drawMeterBillsInvoiceInfoGrid(doc, {
    margin,
    pageW,
    startY: y,
    rows: [
      [
        { label: "Bill To", value: billTo },
        { label: "Bill date", value: billDate },
      ],
      [
        { label: "Billing month from", value: formatBillingMonthDisplay(row.date_from) },
        { label: "Billing month to", value: formatBillingMonthDisplay(row.date_to) },
      ],
    ],
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_PAGE_THEME.dark);
  doc.text(units.pdfSectionTitle, margin, y);
  y += 12;

  const balanceBf = Number(row.balance || 0);
  const prevReading = Number(row.previous_meter_reading || 0);
  const currReading = Number(row.current_meter_reading || 0);
  const unitsUsed = Number(row.units_used || 0);
  const directWaterPumping = Number(row.direct_water_pumping || 0);
  const currentBilling = Number(row.current_billing || 0);
  const pricePerM3 = Number(row.price_per_m3 || 0);
  const moneyPaid = Number(row.money_paid || 0);
  const overpaymentBalance = electricityBillsOverpaymentBalance(row);
  const overpaymentCf = Number(row.overpayment_cf || 0);
  const amountDue = isElectricity ? electricityBillsAmountDue(row) : waterBillsAmountDue(row);
  const totalUnitsUsed = roundMoney(unitsUsed + (isElectricity ? 0 : directWaterPumping));
  const pdfBody = [
    ["", "", "", "Previous balance", formatKshPlainNumber(balanceBf)],
    [
      String(prevReading),
      String(currReading),
      String(isElectricity ? unitsUsed : totalUnitsUsed),
      `${serviceItem} @ ${formatKshPlainNumber(pricePerM3)}${units.pdfRateSuffix}`,
      formatKshPlainNumber(currentBilling),
    ],
  ];
  if (!isElectricity && directWaterPumping > 0) {
    pdfBody.splice(1, 0, [
      "",
      "",
      `${unitsUsed} (meter) + ${directWaterPumping} (pumping)`,
      "Direct water pumping breakdown",
      "",
    ]);
  }
  if (!isElectricity) {
    if (overpaymentCf > 0) {
      pdfBody.push(["", "", "", "Overpayment balance C/F", formatKshPlainNumber(overpaymentCf)]);
    }
    if (moneyPaid > 0) {
      pdfBody.push(["", "", "", "Money paid", formatKshPlainNumber(moneyPaid)]);
    }
  }
  if (isElectricity) {
    if (overpaymentCf > 0) {
      pdfBody.push(["", "", "", "Overpayment balance C/F", formatKshPlainNumber(overpaymentCf)]);
    }
    pdfBody.push(["", "", "", "Money paid", formatKshPlainNumber(moneyPaid)]);
    pdfBody.push(["", "", "", "Overpayment balance", formatKshPlainNumber(overpaymentBalance)]);
  }
  pdfBody.push(["", "", "", "Total amount due", formatKshPlainNumber(amountDue)]);

  runPdfAutoTable(doc, jsPdfNs, {
    startY: y,
    head: [[units.pdfPrevHeader, units.pdfCurrHeader, units.pdfConsumptionHeader, "Item", "Amount (Ksh)"]],
    body: pdfBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: PDF_PAGE_THEME.dark, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      4: { halign: "right" },
    },
    alternateRowStyles: { fillColor: PDF_PAGE_THEME.mint },
    theme: "grid",
  });

  y = (doc.lastAutoTable?.finalY || y) + 24;
  doc.setDrawColor(...PDF_PAGE_THEME.edge);
  doc.setLineWidth(0.5);
  doc.line(margin, y, rightX, y);
  y += 18;

  drawMeterBillsPaymentDetails(doc, { margin, pageW, startY: y, serviceItem, totalDue: amountDue });

  if (pageCount > 1) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${pageIndex} / ${pageCount}`, rightX, doc.internal.pageSize.getHeight() - 24, { align: "right" });
  }
}

function meterBillsPdfSectionsFromEntries(entries, sectionTitle, billKind = "water-bills") {
  const rows = sortRowsLatestFirst(entries || []);
  const units = meterBillsUnitConfig(billKind);
  const isElectricity = isElectricityBillsKind(billKind);
  const headers = [
    "No",
    "Billing month from",
    "Billing month to",
    "Bill to",
    `Current meter (${units.unit})`,
    `Previous meter (${units.unit})`,
    `Units used (${units.unit})`,
    units.priceLabel,
    "Current billing (Ksh)",
  ];
  if (isElectricity) {
    headers.push("Money paid", "Previous balance", "Overpayment balance C/F", "Overpayment balance", "Amount due");
  } else {
    headers.push("Money paid", "Previous balance", "Overpayment balance C/F", "Amount due");
  }
  const body = rows.map((row, idx) => {
    const base = [
      String(idx + 1),
      formatBillingMonthDisplay(row.date_from),
      formatBillingMonthDisplay(row.date_to),
      String(row.bill_to || "").trim() || "—",
      String(Number(row.current_meter_reading || 0)),
      String(Number(row.previous_meter_reading || 0)),
      String(Number(row.units_used || 0)),
      String(Number(row.price_per_m3 || 0)),
      currency(Number(row.current_billing || 0)),
    ];
    if (isElectricity) {
      base.push(
        currency(Number(row.money_paid || 0)),
        currency(Number(row.balance || 0)),
        currency(Number(row.overpayment_cf || 0)),
        currency(electricityBillsOverpaymentBalance(row)),
        currency(electricityBillsAmountDue(row))
      );
    } else {
      base.push(
        currency(Number(row.money_paid || 0)),
        currency(Number(row.balance || 0)),
        currency(Number(row.overpayment_cf || 0)),
        currency(waterBillsAmountDue(row))
      );
    }
    return base;
  });
  if (rows.length) {
    let sumCurrentBilling = 0;
    let sumMoneyPaid = 0;
    let sumOverpayment = 0;
    let sumOverpaymentCf = 0;
    let lastBalance = 0;
    let lastAmountDue = 0;
    const chronological = [...rows].sort((a, b) => {
      const ak = billingMonthKey(parseBillingMonthValue(a?.date_to || a?.date_from || a?.date));
      const bk = billingMonthKey(parseBillingMonthValue(b?.date_to || b?.date_from || b?.date));
      if (ak !== bk) return ak - bk;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
    for (const row of chronological) {
      sumCurrentBilling += Number(row.current_billing || 0);
      sumMoneyPaid += Number(row.money_paid || 0);
      sumOverpayment += electricityBillsOverpaymentBalance(row);
      sumOverpaymentCf += Number(row.overpayment_cf || 0);
      lastBalance = Number(row.balance || 0);
      lastAmountDue = isElectricity ? electricityBillsAmountDue(row) : waterBillsAmountDue(row);
    }
    if (isElectricity) {
      body.push([
        { content: "Total", colSpan: 8, styles: { fontStyle: "bold", halign: "right" } },
        { content: currency(sumCurrentBilling), styles: { fontStyle: "bold" } },
        { content: currency(sumMoneyPaid), styles: { fontStyle: "bold" } },
        { content: currency(lastBalance), styles: { fontStyle: "bold" } },
        { content: currency(sumOverpaymentCf), styles: { fontStyle: "bold" } },
        { content: currency(sumOverpayment), styles: { fontStyle: "bold" } },
        { content: currency(lastAmountDue), styles: { fontStyle: "bold" } },
      ]);
    } else {
      body.push([
        { content: "Total", colSpan: 8, styles: { fontStyle: "bold", halign: "right" } },
        { content: currency(sumCurrentBilling), styles: { fontStyle: "bold" } },
        { content: currency(sumMoneyPaid), styles: { fontStyle: "bold" } },
        { content: currency(lastBalance), styles: { fontStyle: "bold" } },
        { content: currency(sumOverpaymentCf), styles: { fontStyle: "bold" } },
        { content: currency(lastAmountDue), styles: { fontStyle: "bold" } },
      ]);
    }
  }
  return [{ title: sectionTitle, headers, body }];
}

function downloadMeterBillsPagePdf(filteredEntries) {
  const ctx = ensureJsPdfReady();
  if (!ctx) return;
  const page = state.currentPage;
  const recipientSuffix = activeMeterBillRecipientName() ? ` — ${activeMeterBillRecipientName()}` : "";
  const pageTitle = (PAGE_HEADINGS[page] || "Bills") + recipientSuffix;
  const serviceItem = page === "electricity-bills" ? "Electricity" : "Water";
  const allEntries = page === "water-bills" ? state.waterBillsEntries : state.electricityBillsEntries;
  const rows = sortRowsLatestFirst(filteredEntries ?? allEntries ?? []);
  const today = (state.shopToday || clientShopTodayDMY()).replace(/\//g, "");
  const filename = `${pdfSafeSlug(pdfBusinessTitle())}-${pdfSafeSlug(pageTitle)}-${today || "export"}.pdf`;
  const exportSubtitle = activeMeterBillRecipientName()
    ? `Billings for ${activeMeterBillRecipientName()} · ${state.shopToday || clientShopTodayDMY()}`
    : `Exported ${state.shopToday || clientShopTodayDMY()}`;
  const { jsPdfNs, JsPdfCtor } = ctx;
  const doc = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });

  if (!rows.length) {
    const margin = 36;
    let y = drawStandardPagePdfHeader(doc, {
      pageTitle,
      subtitle: exportSubtitle,
    });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_PAGE_THEME.dark);
    doc.text("No records to export on this page.", margin, y + 10);
    doc.save(filename);
    return;
  }

  const pageCount = rows.length;
  rows.forEach((row, idx) => {
    if (idx > 0) doc.addPage();
    drawMeterBillsInvoicePage(doc, jsPdfNs, row, {
      pageTitle,
      serviceItem,
      pageIndex: idx + 1,
      pageCount,
    });
  });
  doc.save(filename);
}

function showMeterBillsPdfModal() {
  const modal = document.getElementById("meterBillsPdfModal");
  if (!modal) { downloadMeterBillsPagePdf(); return; }
  const fromEl = document.getElementById("pdfFilterMonthFrom");
  const toEl = document.getElementById("pdfFilterMonthTo");
  if (fromEl) fromEl.value = "";
  if (toEl) toEl.value = "";
  modal.classList.remove("hidden");
}

function hideMeterBillsPdfModal() {
  document.getElementById("meterBillsPdfModal")?.classList.add("hidden");
}

function executeMeterBillsPdfDownload() {
  const page = state.currentPage;
  const allEntries = page === "water-bills" ? state.waterBillsEntries : state.electricityBillsEntries;
  const fromIso = String(document.getElementById("pdfFilterMonthFrom")?.value || "").trim();
  const toIso = String(document.getElementById("pdfFilterMonthTo")?.value || "").trim();
  const fromParts = fromIso ? parseBillingMonthValue(fromIso) : null;
  const toParts = toIso ? parseBillingMonthValue(toIso) : null;
  const fromKey = fromParts ? billingMonthKey(fromParts) : 0;
  const toKey = toParts ? billingMonthKey(toParts) : Infinity;
  if (fromParts && toParts && fromKey > toKey) {
    alert("Billing period from must be on or before billing period to.");
    return;
  }
  const filtered = (allEntries || []).filter((row) => {
    const rowDateStr = row.date_to || row.date_from || row.date || "";
    const rowParts = parseBillingMonthValue(rowDateStr);
    if (!rowParts) return !fromParts && !toParts;
    const rowKey = billingMonthKey(rowParts);
    return rowKey >= fromKey && rowKey <= toKey;
  });
  hideMeterBillsPdfModal();
  downloadMeterBillsPagePdf(filtered);
}

document.getElementById("pdfFilterDownloadBtn")?.addEventListener("click", executeMeterBillsPdfDownload);
document.getElementById("pdfFilterCancelBtn")?.addEventListener("click", hideMeterBillsPdfModal);
document.getElementById("meterBillsPdfModal")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("meterBillsPdfModal")) hideMeterBillsPdfModal();
});
wireBillingMonthPicker(
  document.getElementById("pdfFilterMonthFrom"),
  document.getElementById("pdfFilterMonthFromOpenBtn")
);
wireBillingMonthPicker(
  document.getElementById("pdfFilterMonthTo"),
  document.getElementById("pdfFilterMonthToOpenBtn")
);

function downloadGenericCurrentPagePdf() {
  const page = state.currentPage;
  const lotPdfPages = new Set(["rose-inventory", "nahashon-records", "faith-expenses", "faith-sales"]);
  const lotSuffix =
    lotPdfPages.has(page) && inventoryLotsTenantEnabled() && activeLotName() ? ` — ${activeLotName()}` : "";
  const pageTitle = (PAGE_HEADINGS[page] || pageHeading?.textContent || "Page") + lotSuffix;
  const pageEl = document.getElementById(`page-${page}`);
  if (!pageEl) {
    alert("Nothing to export on this page.");
    return;
  }
  const sections = pdfSectionsFromPageElement(pageEl);
  const today = (state.shopToday || clientShopTodayDMY()).replace(/\//g, "");
  const widePages = new Set([
    "inventory",
    "sales-bags",
    "sales-kg",
    "chicken-inventory",
    "retail-inventory",
    "feeders-drinkers",
    "medicaments",
    "gas",
    "rose-inventory",
    "nahashon-records",
    "faith-expenses",
    "faith-sales",
    "cess-accounts",
    "credit",
    "pigs",
    "water-bills",
    "electricity-bills",
  ]);
  const lotLabel =
    inventoryLotsTenantEnabled() && activeLotName() ? ` · ${activeLotName()}` : "";
  downloadStandardPageTablePdf({
    pageTitle,
    subtitle: `Exported ${state.shopToday || clientShopTodayDMY()}${lotLabel}`,
    filename: `${pdfSafeSlug(pdfBusinessTitle())}-${pdfSafeSlug(pageTitle)}-${today || "export"}.pdf`,
    sections,
    landscape: widePages.has(page),
  });
}

function downloadExpenditurePagePdf() {
  const filter = getExpStatementMonthFilter();
  const rows = sortRowsLatestFirst(expenditureRowsForDisplay());
  const statementLabel = monthLabelFromKeyClient(filter) || "Current month";
  const body = rows.map((r) => [
    formatDateDMY(r.date),
    r.description || "",
    normalizeExpenditureCategory(r.category),
    currency(r.money_out),
  ]);
  const total = rows.reduce((s, r) => s + (Number(r.money_out) || 0), 0);
  if (body.length) {
    body.push([
      { content: "TOTAL", colSpan: 3, styles: { fontStyle: "bold", halign: "right" } },
      { content: currency(total), styles: { fontStyle: "bold", halign: "right" } },
    ]);
  }
  const today = (state.shopToday || clientShopTodayDMY()).replace(/\//g, "");
  downloadStandardPageTablePdf({
    pageTitle: "Expenditure Statement",
    subtitle: `Statement month: ${statementLabel}`,
    filename: `${pdfSafeSlug(pdfBusinessTitle())}-expenditure-${filter || "current"}-${today || "export"}.pdf`,
    sections: { title: statementLabel, headers: ["Date", "Description", "Category", "Money out"], body },
  });
}

function downloadFaithRoseBalancePagePdf() {
  const moneyIn = faithRoseSalesTotalAmount();
  const moneyOut = faithRoseExpensesTotalMoneyOut();
  const profit = faithRoseBalanceProfit();
  const lotLabel = inventoryLotsTenantEnabled() && activeLotName() ? ` · ${activeLotName()}` : "";
  const today = (state.shopToday || clientShopTodayDMY()).replace(/\//g, "");
  downloadStandardPageTablePdf({
    pageTitle: "Balance",
    subtitle: `Sales and Expenses${lotLabel}`,
    filename: `${pdfSafeSlug(pdfBusinessTitle())}-balance-${today || "export"}.pdf`,
    sections: {
      headers: ["Item", "Amount"],
      body: [
        ["Money in (Sales total)", currency(moneyIn)],
        ["Money out (Expenses total)", currency(moneyOut)],
        [
          { content: "Profit", styles: { fontStyle: "bold" } },
          { content: currency(profit), styles: { fontStyle: "bold" } },
        ],
      ],
    },
  });
}

function downloadBalancePagePdf() {
  if (faithRoseBalancePageEnabled()) {
    downloadFaithRoseBalancePagePdf();
    return;
  }
  const ctx = ensureJsPdfReady();
  if (!ctx) return;
  const combined = getOwnerCombinedProfitTotal();
  const today = state.shopToday || clientShopTodayDMY();
  const dailyOps = balanceDailyOperationalCostKes();
  const totalExpenditure = expenditureEntriesForCurrentMonth().reduce(
    (s, r) => s + (Number(r.money_out) || 0),
    0
  );
  const daysInMonth = calendarMonthOperationalDays(today);
  const operational = daysInMonth * dailyOps;
  const loanTotal = loanRepaymentsForMonth(currentExpenditureMonthKey());
  const remaining = combined - operational - totalExpenditure + loanTotal;
  const { jsPdfNs, JsPdfCtor } = ctx;
  const doc = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 36;
  let y = drawStandardPagePdfHeader(doc, { pageTitle: "Balance", subtitle: calendarMonthCycleLabel(today) });
  const pdfRows = [
    ["Combined accumulated profits", currency(combined)],
    [`Operational costs (${currency(dailyOps)} × ${daysInMonth} days)`, currency(operational)],
    ["Expenditure (current month)", currency(totalExpenditure)],
  ];
  if (loanTotal > 0) pdfRows.push(["Loan repayment (current month)", currency(loanTotal)]);
  pdfRows.push(["Remaining balance", currency(remaining)]);
  runPdfAutoTable(doc, jsPdfNs, {
    startY: y,
    head: [["Item", "Amount"]],
    body: pdfRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: PDF_PAGE_THEME.dark, textColor: 255 },
    alternateRowStyles: { fillColor: PDF_PAGE_THEME.mint },
    theme: "grid",
  });
  doc.save(`${pdfSafeSlug(pdfBusinessTitle())}-balance-${today.replace(/\//g, "")}.pdf`);
}

function downloadLoanRepaymentPagePdf() {
  const rows = [...(state.loanRepayments || [])].sort((a, b) => {
    const mk = String(b.month_key || "").localeCompare(String(a.month_key || ""));
    if (mk !== 0) return mk;
    return Number(b.id) - Number(a.id);
  });
  const preview = state.loanRepaymentPreview || {};
  const sections = [];
  if (preview.monthKey) {
    sections.push({
      title: `${preview.monthLabel || preview.monthKey} preview`,
      headers: ["Metric", "Amount"],
      body: [
        ["Raw balance", currency(preview.rawBalance ?? 0)],
        ["Loan repayments", currency(preview.loanRepaymentTotal ?? 0)],
        ["Effective balance", currency(preview.effectiveBalance ?? 0)],
      ],
    });
  }
  sections.push({
    title: "Repayment history",
    headers: ["Month", "Amount", "Note", "Recorded by"],
    body: rows.map((r) => [
      monthLabelFromKey(r.month_key),
      currency(r.amount ?? 0),
      r.note || "—",
      r.created_by || "—",
    ]),
  });
  const today = (state.shopToday || clientShopTodayDMY()).replace(/\//g, "");
  downloadStandardPageTablePdf({
    pageTitle: "Loan Repayment",
    subtitle: `Exported ${state.shopToday || clientShopTodayDMY()}`,
    filename: `${pdfSafeSlug(pdfBusinessTitle())}-loan-repayment-${today || "export"}.pdf`,
    sections,
  });
}

function downloadMonthlyRecordsPagePdf() {
  const payload = state.monthlyRecordsPayload || {};
  const preview = payload.preview || {};
  const records = payload.records || [];
  const sections = [];
  if (payload.currentMonthLabel) {
    sections.push({
      title: payload.currentClosed
        ? `${payload.currentMonthLabel} — closed`
        : `Current month — ${payload.currentMonthLabel}`,
      headers: ["Metric", "Amount"],
      body: [
        ["Combined accumulated profits", currency(preview.combinedProfit ?? 0)],
        ["Expenditure", currency(preview.expenditure ?? 0)],
        ...(Number(preview.loanRepayment ?? 0) > 0
          ? [["Loan repayment", currency(preview.loanRepayment ?? 0)]]
          : []),
        ["Balance", currency(preview.balance ?? 0)],
      ],
    });
  }
  sections.push({
    title: "Closed months",
    headers: ["Month", "Combined profits", "Expenditure", "Balance"],
    body: records.map((r) => {
      const loanAdd = loanRepaymentsForMonth(r.month_key);
      const bal = Number(r.balance ?? 0) + loanAdd;
      return [
        r.month_label || r.month_key || "—",
        currency(r.combined_profit ?? 0),
        currency(r.expenditure ?? 0),
        currency(bal),
      ];
    }),
  });
  const today = (state.shopToday || clientShopTodayDMY()).replace(/\//g, "");
  downloadStandardPageTablePdf({
    pageTitle: "Monthly Records",
    subtitle: `Exported ${state.shopToday || clientShopTodayDMY()}`,
    filename: `${pdfSafeSlug(pdfBusinessTitle())}-monthly-records-${today || "export"}.pdf`,
    sections,
  });
}

function downloadCreditPagePdf() {
  const accountOpen = !document.getElementById("hadifa-account-section")?.classList.contains("hidden");
  if (accountOpen && state.activeCreditAccountId) {
    const acc = (state.creditAccounts || []).find((a) => a.id === Number(state.activeCreditAccountId));
    const table = document.querySelector("#hadifa-account-section .table-wrap table");
    const data = tableElementToPdfData(table);
    const today = (state.shopToday || clientShopTodayDMY()).replace(/\//g, "");
    downloadStandardPageTablePdf({
      pageTitle: "Credit",
      subtitle: acc?.name || "Account",
      filename: `${pdfSafeSlug(pdfBusinessTitle())}-credit-${pdfSafeSlug(acc?.name || "account")}-${today || "export"}.pdf`,
      sections: data ? { title: acc?.name || "Account entries", ...data } : [],
    });
    return;
  }
  const accounts = state.creditAccounts || [];
  const body = accounts.map((acc) => {
    const count = (state.creditEntries || []).filter((e) => Number(e.account_id) === acc.id).length;
    return [acc.name || "—", String(count)];
  });
  const today = (state.shopToday || clientShopTodayDMY()).replace(/\//g, "");
  downloadStandardPageTablePdf({
    pageTitle: "Credit",
    subtitle: "All accounts",
    filename: `${pdfSafeSlug(pdfBusinessTitle())}-credit-accounts-${today || "export"}.pdf`,
    sections: { headers: ["Account", "Entries"], body },
  });
}

function downloadCurrentPagePdf() {
  const page = state.currentPage;
  if (page === "calculator") {
    downloadCalculatorPdf("calculator");
    return;
  }
  if (page === "chicken-inventory" && state.user?.role === "owner") {
    downloadChickenSalesPdf();
    return;
  }
  if (page === "monthly-report") {
    downloadMonthlyReportPdf();
    return;
  }
  if (page === "expenditure") {
    downloadExpenditurePagePdf();
    return;
  }
  if (page === "balance") {
    downloadBalancePagePdf();
    return;
  }
  if (page === "monthly-records") {
    downloadMonthlyRecordsPagePdf();
    return;
  }
  if (page === "loan-repayment") {
    downloadLoanRepaymentPagePdf();
    return;
  }
  if (page === "credit") {
    downloadCreditPagePdf();
    return;
  }
  if (page === "water-bills" || page === "electricity-bills") {
    showMeterBillsPdfModal();
    return;
  }
  downloadGenericCurrentPagePdf();
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
function appendMonthlyReportPdfTable(doc, jsPdfNs, { margin, tableW, G, title, head, body, startY, columnStyles }) {
  let y = startY;
  if (y > 700) {
    doc.addPage();
    y = 60;
  }
  doc.setTextColor(...G.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, margin, y);
  y += 6;
  runPdfAutoTable(doc, jsPdfNs, {
    head: [head],
    body,
    startY: y + 6,
    margin: { left: margin, right: margin },
    tableWidth: tableW,
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
      valign: "middle",
      lineColor: G.edge,
      lineWidth: 0.2,
      textColor: [33, 33, 33],
    },
    headStyles: { fillColor: G.dark, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle", fontSize: 9 },
    columnStyles: columnStyles || {},
    alternateRowStyles: { fillColor: [252, 255, 253] },
    theme: "plain",
  });
  return (doc.lastAutoTable?.finalY || y) + 22;
}

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
  const snap = buildMonthlyReportSnapshot(ym);
  const { bagAgg, kgAgg, chickenAgg, fdAgg, medAgg, gasAgg, expAgg, moduleOverview, totalRevenue, totalProfit } =
    snap;
  const monthName = monthLabel(ym);
  const businessTitle = state.appInstance === "ufaray" ? "Ufaray Feeds" : "Amana Kuku Feeds";
  const safeBusiness = businessTitle.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const safeMonth = (ym || "").replace(/-/g, "");

  const doc = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });

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
  doc.text("MONTHLY REPORT — ALL MODULES", margin, 50);
  doc.setFontSize(11);
  doc.text(monthName, pageW - margin, 50, { align: "right" });

  let y = 92;
  doc.setFillColor(...G.mint);
  doc.setDrawColor(...G.edge);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y - 8, tableW, 88, 6, 6, "FD");
  doc.setTextColor(...G.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${monthName} — all-module summary`, margin + 12, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...G.accent);
  doc.text(currency(totalRevenue), pageW - margin - 12, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(33, 33, 33);
  const kgPretty = Number(kgAgg.totalKg).toFixed(2);
  doc.text(
    `${currency(totalRevenue)} revenue · ${currency(totalProfit)} est. profit · ${bagAgg.totalBags} bags · ${kgPretty} kg · ${chickenAgg.totalBirds} chicks`,
    margin + 12,
    y + 32
  );
  doc.text(`Expenditure: ${currency(expAgg.total)} · Feed, retail, chicken, FD, medicaments & gas included.`, margin + 12, y + 50);
  y += 100;

  const activeModules = moduleOverview.filter((m) => (m.isExpense ? m.sales > 0 || m.profit !== 0 : m.sales > 0));
  const moduleBody =
    activeModules.length === 0
      ? [["—", "No module activity this month.", "", "", ""]]
      : activeModules.map((row, idx) => {
          const vol =
            row.unit === "kg"
              ? `${Number(row.sales).toFixed(2)} kg`
              : `${row.sales} ${row.unit}`;
          return [
            String(idx + 1),
            row.module,
            vol,
            row.isExpense ? "—" : `Ksh${formatKshPlainNumber(row.revenue)}`,
            row.isExpense
              ? `-Ksh${formatKshPlainNumber(Math.abs(row.profit))}`
              : `Ksh${formatKshPlainNumber(row.profit)}`,
          ];
        });

  y = appendMonthlyReportPdfTable(doc, jsPdfNs, {
    margin,
    tableW,
    G,
    title: "Overview — all modules",
    head: ["#", "MODULE", "VOLUME", "REVENUE", "PROFIT / IMPACT"],
    body: moduleBody,
    startY: y,
    columnStyles: {
      0: { halign: "center", cellWidth: 28 },
      4: { halign: "right", cellWidth: 90 },
    },
  });

  const bagBody =
    bagAgg.rows.length === 0
      ? [["—", `No bag sales for ${monthName}.`, "", "", "", ""]]
      : bagAgg.rows.slice(0, 10).map((row, idx) => [
          String(idx + 1),
          row.brand,
          row.feed,
          `${row.bagSize} kg`,
          String(row.bagsSold),
          `Ksh${formatKshPlainNumber(row.revenue)}`,
        ]);

  y = appendMonthlyReportPdfTable(doc, jsPdfNs, {
    margin,
    tableW,
    G,
    title: "Top sellers — Sales Per Bags",
    head: ["#", "BRAND", "FEED TYPE", "BAG SIZE", "BAGS SOLD", "REVENUE"],
    body: bagBody,
    startY: y,
    columnStyles: {
      0: { halign: "center", cellWidth: 28 },
      5: { halign: "right", cellWidth: 90 },
    },
  });

  const kgBody =
    kgAgg.rows.length === 0
      ? [["—", `No kg sales for ${monthName}.`, "", "", ""]]
      : kgAgg.rows.slice(0, 10).map((row, idx) => [
          String(idx + 1),
          row.brand,
          row.feed,
          Number(row.kg).toFixed(2),
          `Ksh${formatKshPlainNumber(row.revenue)}`,
        ]);

  y = appendMonthlyReportPdfTable(doc, jsPdfNs, {
    margin,
    tableW,
    G,
    title: "Top sellers — Sales Per Kg",
    head: ["#", "BRAND", "FEED TYPE", "KG SOLD", "REVENUE"],
    body: kgBody,
    startY: y,
    columnStyles: { 0: { halign: "center", cellWidth: 28 }, 4: { halign: "right", cellWidth: 100 } },
  });

  const chBody =
    chickenAgg.rows.length === 0
      ? [["—", `No chicken sales for ${monthName}.`, "", "", ""]]
      : chickenAgg.rows.slice(0, 10).map((row, idx) => [
          String(idx + 1),
          row.breed,
          String(row.birds),
          `Ksh${formatKshPlainNumber(row.revenue)}`,
          `Ksh${formatKshPlainNumber(row.profit)}`,
        ]);

  y = appendMonthlyReportPdfTable(doc, jsPdfNs, {
    margin,
    tableW,
    G,
    title: "Top sellers — Chicken Sales",
    head: ["#", "BREED", "CHICKS", "REVENUE", "PROFIT"],
    body: chBody,
    startY: y,
    columnStyles: { 0: { halign: "center", cellWidth: 28 }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  const fdBody =
    fdAgg.rows.length === 0
      ? [["—", `No sales for ${monthName}.`, "", ""]]
      : fdAgg.rows.slice(0, 8).map((row, idx) => [
          String(idx + 1),
          row.label,
          String(row.qty),
          `Ksh${formatKshPlainNumber(row.revenue)}`,
        ]);

  y = appendMonthlyReportPdfTable(doc, jsPdfNs, {
    margin,
    tableW,
    G,
    title: "Top sellers — Feeders & Drinkers",
    head: ["#", "ITEM", "QTY", "REVENUE"],
    body: fdBody,
    startY: y,
    columnStyles: { 0: { halign: "center", cellWidth: 28 }, 3: { halign: "right" } },
  });

  const medBody =
    medAgg.rows.length === 0
      ? [["—", `No sales for ${monthName}.`, "", ""]]
      : medAgg.rows.slice(0, 8).map((row, idx) => [
          String(idx + 1),
          row.label,
          String(row.qty),
          `Ksh${formatKshPlainNumber(row.revenue)}`,
        ]);

  y = appendMonthlyReportPdfTable(doc, jsPdfNs, {
    margin,
    tableW,
    G,
    title: "Top sellers — Medicaments",
    head: ["#", "ITEM", "QTY", "REVENUE"],
    body: medBody,
    startY: y,
    columnStyles: { 0: { halign: "center", cellWidth: 28 }, 3: { halign: "right" } },
  });

  const gasBody =
    gasAgg.rows.length === 0
      ? [["—", `No sales for ${monthName}.`, "", ""]]
      : gasAgg.rows.slice(0, 8).map((row, idx) => [
          String(idx + 1),
          row.label,
          String(row.qty),
          `Ksh${formatKshPlainNumber(row.revenue)}`,
        ]);

  y = appendMonthlyReportPdfTable(doc, jsPdfNs, {
    margin,
    tableW,
    G,
    title: "Top sellers — Gas",
    head: ["#", "SIZE", "QTY", "REVENUE"],
    body: gasBody,
    startY: y,
    columnStyles: { 0: { halign: "center", cellWidth: 28 }, 3: { halign: "right" } },
  });

  const expBody =
    expAgg.byCategory.length === 0
      ? [["—", `No expenditure for ${monthName}.`]]
      : expAgg.byCategory.map((row) => [row.category, `Ksh${formatKshPlainNumber(row.amount)}`]);

  y = appendMonthlyReportPdfTable(doc, jsPdfNs, {
    margin,
    tableW,
    G,
    title: "Expenditure — by category",
    head: ["CATEGORY", "MONEY OUT"],
    body: expBody,
    startY: y,
    columnStyles: { 1: { halign: "right", cellWidth: 120 } },
  });

  if (y > 700) {
    doc.addPage();
    y = 60;
  }

  doc.setTextColor(...G.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Advice for next month", margin, y);
  y += 16;

  const adviceLines = buildMonthlyAdvice(ym, snap).map(stripHtmlForPdf);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(33, 33, 33);
  if (adviceLines.length === 0) {
    doc.text("No advice available for this month yet.", margin, y);
  } else {
    for (const line of adviceLines) {
      if (y > 780) {
        doc.addPage();
        y = 60;
      }
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
    ["faithExpDateDisplay", "faithExpDate", "faithExpOpenCalendarBtn"],
    ["faithSalesDateDisplay", "faithSalesDate", "faithSalesOpenCalendarBtn"],
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

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Returns weekday name for a DD/MM/YYYY string. */
function weekdayNameFromDMY(dmy) {
  const parts = parseDMYParts(dmy);
  if (!parts) return "";
  const dt = new Date(parts.y, parts.m - 1, parts.d);
  if (Number.isNaN(dt.getTime())) return "";
  return WEEKDAY_NAMES[dt.getDay()];
}

/** e.g. Saturday 23/05/2026 for calculator proforma / invoice PDFs. */
function formatDateWithDayName(dateValue) {
  const dmy = formatDateDMY(dateValue);
  const parts = parseDMYParts(dmy);
  if (!parts) return dmy || "";
  const dt = new Date(parts.y, parts.m - 1, parts.d);
  if (Number.isNaN(dt.getTime())) return dmy;
  return `${WEEKDAY_NAMES[dt.getDay()]} ${dmy}`;
}

/** Returns the DD/MM/YYYY of the coming Saturday (or today if today is Saturday). */
function nextSaturdayDMY(fromDMY) {
  const parts = parseDMYParts(fromDMY);
  if (!parts) return fromDMY;
  const dt = new Date(parts.y, parts.m - 1, parts.d);
  const dayOfWeek = dt.getDay(); // 0 = Sun, 6 = Sat
  const daysUntilSat = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7;
  dt.setDate(dt.getDate() + daysUntilSat);
  const d = String(dt.getDate()).padStart(2, "0");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${dt.getFullYear()}`;
}

function initCalcValidUntilDefaults() {
  const todayStr = state.shopToday || clientShopTodayDMY();
  const defaultSat = nextSaturdayDMY(todayStr);
  const daySel = document.getElementById("calcValidUntilDay");
  const timeEl = document.getElementById("calcValidUntilTime");
  if (calcDueDateDisplay instanceof HTMLInputElement && !calcDueDateDisplay.value.trim()) {
    calcDueDateDisplay.value = defaultSat;
    if (calcDueDate instanceof HTMLInputElement) calcDueDate.value = toIsoDate(defaultSat);
  }
  const dateForDay =
    calcDueDateDisplay instanceof HTMLInputElement && calcDueDateDisplay.value.trim()
      ? calcDueDateDisplay.value.trim()
      : defaultSat;
  if (daySel instanceof HTMLSelectElement) {
    daySel.dataset.userSet = "";
    daySel.value = weekdayNameFromDMY(dateForDay) || "Saturday";
  }
  if (timeEl instanceof HTMLInputElement && !timeEl.value.trim()) {
    timeEl.value = "12.00pm";
  }
}

function syncCalcValidUntilDayFromDate() {
  const daySel = document.getElementById("calcValidUntilDay");
  if (!(daySel instanceof HTMLSelectElement)) return;
  if (daySel.dataset.userSet === "1") return;
  const dmy = calcDueDateDisplay instanceof HTMLInputElement ? calcDueDateDisplay.value.trim() : "";
  const day = weekdayNameFromDMY(dmy);
  if (day) daySel.value = day;
}

function getCalcValidUntilDateForPdf(fallbackDMY) {
  const t = calcDueDateDisplay instanceof HTMLInputElement ? calcDueDateDisplay.value.trim() : "";
  if (t && isValidDMY(t)) return t;
  const base = fallbackDMY || state.shopToday || clientShopTodayDMY();
  return nextSaturdayDMY(base);
}

function getCalcValidUntilDayForPdf(fallbackDMY) {
  const daySel = document.getElementById("calcValidUntilDay");
  if (daySel instanceof HTMLSelectElement && daySel.value) return daySel.value;
  return weekdayNameFromDMY(getCalcValidUntilDateForPdf(fallbackDMY)) || "Saturday";
}

function getCalcValidUntilTimeForPdf() {
  const el = document.getElementById("calcValidUntilTime");
  const t = el instanceof HTMLInputElement ? el.value.trim() : "";
  return t || "12.00pm";
}

/** Valid-until line for proforma/invoice PDFs — uses calculator form day, date, and time. */
function calcValidUntilText(invoiceDateDMY) {
  const validDate = getCalcValidUntilDateForPdf(invoiceDateDMY);
  const day = getCalcValidUntilDayForPdf(invoiceDateDMY);
  const time = getCalcValidUntilTimeForPdf();
  return `${day} ${validDate} ${time}`;
}

function compareDMYParts(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

function chickenRowDateIso(row) {
  const dmy = formatDateDMY(row?.date);
  return dmy ? toIsoDate(dmy) : "";
}

function rowInDateRangeInclusive(row, fromDMY, toDMY) {
  const rowParts = parseDMYParts(formatDateDMY(row?.date));
  const fromParts = parseDMYParts(fromDMY);
  const toParts = parseDMYParts(toDMY);
  if (!rowParts || !fromParts || !toParts) return false;
  return compareDMYParts(rowParts, fromParts) >= 0 && compareDMYParts(rowParts, toParts) <= 0;
}

function initChickenPdfDateDefaults() {
  const fromDisplay = document.getElementById("chPdfDateFromDisplay");
  const fromInput = document.getElementById("chPdfDateFrom");
  const toDisplay = document.getElementById("chPdfDateToDisplay");
  const toInput = document.getElementById("chPdfDateTo");
  if (!fromDisplay || !fromInput || !toDisplay || !toInput) return;

  const todayDMY = formatDateDMY(state.shopToday || clientShopTodayDMY());
  const todayParts = parseDMYParts(todayDMY);
  const firstDMY = todayParts
    ? `01/${String(todayParts.m).padStart(2, "0")}/${todayParts.y}`
    : "";

  if (!fromDisplay.value.trim()) {
    fromDisplay.value = firstDMY;
    fromInput.value = toIsoDate(firstDMY);
  }
  if (!toDisplay.value.trim()) {
    toDisplay.value = todayDMY;
    toInput.value = toIsoDate(todayDMY);
  }
}

function chickenPdfSelectedDateRange() {
  const fromDisplay = document.getElementById("chPdfDateFromDisplay");
  const fromInput = document.getElementById("chPdfDateFrom");
  const toDisplay = document.getElementById("chPdfDateToDisplay");
  const toInput = document.getElementById("chPdfDateTo");

  let fromDMY = (fromDisplay?.value || "").trim();
  if (!fromDMY && fromInput?.value) fromDMY = formatDateDMY(fromInput.value);

  let toDMY = (toDisplay?.value || "").trim();
  if (!toDMY && toInput?.value) toDMY = formatDateDMY(toInput.value);

  return { fromDMY, toDMY };
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

/** Feed line total for a staff sale row (0 for owner inventory rows). */
function chickenSaleLineFeedTotal(row) {
  if (isChickenRowOwnerInventory(row)) return 0;
  const raw = row.feed_line_total;
  const t1 = raw === "" || raw == null ? 0 : (Number.isFinite(Number(raw)) ? Number(raw) : 0);
  const raw2 = row.feed_line_total2;
  const t2 = raw2 === "" || raw2 == null ? 0 : (Number.isFinite(Number(raw2)) ? Number(raw2) : 0);
  return t1 + t2;
}

/** Chicks amount + feed amount for this sale. */
function chickenSaleLineCombinedTotal(row) {
  return saleLineTotalChicken(row) + chickenSaleLineFeedTotal(row);
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
  const total = chickenSaleLineCombinedTotal(row);
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
    const isFaithRoseBalanceTab =
      el instanceof HTMLElement && el.dataset?.page === "balance" && faithRoseBalancePageEnabled();
    const allowCalculatorForStaff = isCalculatorTab && staffMayAccessCalculatorTenant();
    el.classList.toggle("hidden", !(isOwner || allowCalculatorForStaff || isFaithRoseBalanceTab));
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
  updateCalcMpesaPaymentCardUi();
  document.querySelectorAll(".employee-only-action").forEach((el) => {
    el.classList.toggle("hidden", state.user.role !== "employee");
  });
  if (roseInventoryTabLabel) {
    roseInventoryTabLabel.textContent =
      state.appInstance === "home-chickens"
        ? "Home Chickens"
        : state.appInstance === "rose"
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
      ? page === "rose-inventory" || page === "nahashon-records" || page === "calculator" || page === "faith-expenses" || page === "faith-sales" || page === "balance"
      : state.appInstance === "cess" ||
          state.appInstance === "maina-faith-cess" ||
          state.appInstance === "terry-and-cess"
      ? page === "rose-inventory" || page === "calculator" || page === "faith-expenses" || page === "faith-sales" || page === "balance"
      : state.appInstance === "shop"
      ? page === "inventory" || page === "sales-bags" || page === "calculator" || page === "faith-expenses" || page === "faith-sales" || page === "balance"
      : terryCessShopTenant
      ? page === "inventory"
      : recordsTenant
      ? page === "rose-inventory" || page === "faith-expenses" || page === "faith-sales" || page === "balance"
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
    if (page === "credit") {
      shouldShow = creditTenantEnabled();
    }
    if (page === "nahashon-records") {
      shouldShow = state.appInstance === "terry";
    }
    if (page === "faith-expenses") {
      shouldShow = expensesPageTenantEnabled();
    }
    if (page === "faith-sales") {
      shouldShow = faithSalesPageTenantEnabled();
    }
    if (page === "balance" && faithRoseBalancePageEnabled()) {
      shouldShow = true;
    } else if (page === "balance") {
      shouldShow = isOwner && (state.appInstance === "amana" || state.appInstance === "ufaray");
    }
    if (page === "expenditure") {
      shouldShow = !expensesPageTenantEnabled() && shouldShow;
    }
    if (page === "pigs") {
      shouldShow = state.appInstance === "amana" && isOwner;
    }
    if (page === "monthly-report") {
      shouldShow = isOwner && (state.appInstance === "amana" || state.appInstance === "ufaray");
    }
    if (page === "monthly-records") {
      shouldShow = monthlyRecordsTenantEnabled();
    }
    if (page === "loan-repayment") {
      shouldShow = loanRepaymentTenantEnabled();
    }
    if (page === "water-bills" || page === "electricity-bills") {
      shouldShow =
        isOwner &&
        ((isWaterBillsTenant() && page === "water-bills") ||
          (isElectricityBillsTenant() && page === "electricity-bills"));
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
  applyMeterBillsOwnerBalanceUi();
  updateInventoryLotBarUi();
  updateMeterBillRecipientBarUi();
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

function populateChChickenFeedTypes2(brand) {
  if (!chFeedType2) return;
  const cur = chFeedType2.value;
  const brandKey = resolveBrandKey(brand);
  chFeedType2.innerHTML = '<option value="">Select feed type</option>';
  if (!brandKey || !state.catalog[brandKey]) {
    chFeedType2.disabled = true;
    syncChEmployeeBundledFeedAmount2();
    return;
  }
  state.catalog[brandKey].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.type;
    option.textContent = displayFeedType(item.type);
    chFeedType2.appendChild(option);
  });
  chFeedType2.disabled = false;
  if (cur && [...chFeedType2.options].some((o) => o.value === cur)) chFeedType2.value = cur;
  syncChEmployeeBundledFeedAmount2();
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

function syncChEmployeeBundledFeedAmount2() {
  if (!chFeedBrand2 || !chFeedType2 || !chFeedBagQty2 || !chFeedLineTotal2) return;
  if (state.user?.role !== "employee") return;
  const brand = String(chFeedBrand2.value || "").trim();
  const ft = String(chFeedType2.value || "").trim();
  const bags = Math.floor(Number(chFeedBagQty2.value || 0));
  if (!Number.isFinite(bags) || bags < 0) {
    chFeedLineTotal2.value = "";
    return;
  }
  if (!brand || !ft) {
    chFeedLineTotal2.value = "";
    return;
  }
  const bs = bagSizeFor(brand, ft);
  if (!Number.isFinite(bs) || bs <= 0) {
    chFeedLineTotal2.value = "";
    return;
  }
  const inv = findLatestInventoryRowForCatalogLine(chickenFeedInventoryRowsForPriceLookup(), brand, ft, bs);
  if (!inv) {
    chFeedLineTotal2.value = "";
    return;
  }
  const unit = Number(inv.selling_price);
  if (!Number.isFinite(unit)) {
    chFeedLineTotal2.value = "";
    return;
  }
  chFeedLineTotal2.value = (bags * unit).toFixed(2);
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

const BILLING_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseBillingMonthValue(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const mmYyyy = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmYyyy) {
    const month = Number(mmYyyy[1]);
    const year = Number(mmYyyy[2]);
    if (month >= 1 && month <= 12 && year >= 1900) return { month, year };
  }
  const parts = parseDMYParts(s);
  if (parts) {
    const month = Number(parts.m);
    const year = Number(parts.y);
    if (month >= 1 && month <= 12 && year >= 1900) return { month, year };
  }
  const isoMonth = s.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) {
    const year = Number(isoMonth[1]);
    const month = Number(isoMonth[2]);
    if (month >= 1 && month <= 12 && year >= 1900) return { month, year };
  }
  return null;
}

function billingMonthStorageValue(parts) {
  if (!parts) return "";
  const mm = String(parts.month).padStart(2, "0");
  return `01/${mm}/${parts.year}`;
}

function billingMonthIsoValue(parts) {
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function billingMonthKey(parts) {
  if (!parts) return 0;
  return parts.year * 12 + parts.month;
}

function formatBillingMonthDisplay(value) {
  const parts = parseBillingMonthValue(value);
  const month = Number(parts?.month);
  const year = Number(parts?.year);
  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) return "—";
  return `${BILLING_MONTH_NAMES[month - 1]} ${year}`;
}

function wireBillingMonthPicker(monthInput, openBtn) {
  if (!monthInput || !openBtn) return;
  openBtn.addEventListener("click", () => {
    if (typeof monthInput.showPicker === "function") {
      monthInput.showPicker();
      return;
    }
    monthInput.focus();
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
  if (state.user?.role === "owner") {
    const addOpt = document.createElement("option");
    addOpt.value = "__add_item__";
    addOpt.textContent = "＋ Add new item…";
    fdItem.appendChild(addOpt);
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
  if (state.user?.role === "owner") {
    const addOpt = document.createElement("option");
    addOpt.value = "__add_item__";
    addOpt.textContent = "＋ Add new item…";
    medItem.appendChild(addOpt);
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
  const rows = isOwner
    ? aggregateOwnerFeedersDrinkersRows(state.feedersDrinkersInventory)
    : state.feedersDrinkersSales;
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
  const ym = currentExpenditureMonthKey();
  fdBody.innerHTML = joinRowsWithDateSeparators(rows, colSpan, (row) => {
    const rowProfit =
      ym && isOwner
        ? computeItemSalesProfitForMonth(
            (state.feedersDrinkersSales || []).filter((s) => String(s.item_name) === String(row.item_name)),
            feedersDrinkersInventoryForCalculations(),
            ym,
            "item_name"
          )
        : Number(row.accumulated_profit ?? 0);
    return `
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
        <td>${currency(rowProfit)}</td>
        <td>${row.reorder_level}</td>
        <td>${statusLabel(row)}</td>
        <td>${row.created_by}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="fd" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="fd" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
  });
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
  const rows = sortRowsLatestFirst(expenditureRowsForDisplay());
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

function formatCessAccountBalanceCell(value) {
  const n = Number(value) || 0;
  const text = currency(n);
  if (n < 0) return `<span class="cess-acc-balance-negative">${text}</span>`;
  return text;
}

function computeMeterBillsDerived(currentMeter, previousMeter, pricePerM3, directWaterPumping = 0) {
  const current = Number(currentMeter);
  const previous = Number(previousMeter);
  const price = Number(pricePerM3);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || !Number.isFinite(price)) {
    return { unitsUsed: NaN, currentBilling: NaN };
  }
  if (current < previous) return { unitsUsed: NaN, currentBilling: NaN };
  const unitsUsed = roundMoney(current - previous);
  const extra = Math.max(0, Number(directWaterPumping) || 0);
  const currentBilling = roundMoney((unitsUsed + extra) * price);
  return { unitsUsed, currentBilling };
}

function meterBillsBalanceFromForm(prefix) {
  if (state.user?.role !== "owner") return 0;
  const balanceEl = document.getElementById(`${prefix}Balance`);
  const raw = balanceEl instanceof HTMLInputElement ? balanceEl.value.trim() : "";
  if (raw === "") return 0;
  const balance = Number(raw);
  return Number.isFinite(balance) && balance >= 0 ? balance : 0;
}

function electricityBillsMoneyPaidFromForm() {
  if (state.user?.role !== "owner") return 0;
  const moneyPaidEl = document.getElementById("electricityBillsMoneyPaid");
  const raw = moneyPaidEl instanceof HTMLInputElement ? moneyPaidEl.value.trim() : "";
  if (raw === "") return 0;
  const moneyPaid = Number(raw);
  return Number.isFinite(moneyPaid) && moneyPaid >= 0 ? moneyPaid : 0;
}

function electricityBillsOverpaymentBalance(row) {
  const moneyPaid = Number(row?.money_paid ?? 0);
  const currentBilling = Number(row?.current_billing ?? 0);
  const previousBalance = Number(row?.balance ?? 0);
  const overpaymentCf = Number(row?.overpayment_cf ?? 0);
  const dueBeforePay = currentBilling + previousBalance - overpaymentCf;
  return roundMoney(Math.max(0, moneyPaid - dueBeforePay));
}

function electricityBillsAmountDue(row) {
  const currentBilling = Number(row?.current_billing ?? 0);
  const previousBalance = Number(row?.balance ?? 0);
  const overpaymentCf = Number(row?.overpayment_cf ?? 0);
  const moneyPaid = Number(row?.money_paid ?? 0);
  return roundMoney(Math.max(0, currentBilling + previousBalance - overpaymentCf - moneyPaid));
}

/** Overpayment generated by this water bill row (carries forward to the next period). */
function waterBillsOverpaymentBalance(row) {
  const moneyPaid = Number(row?.money_paid ?? 0);
  const currentBilling = Number(row?.current_billing ?? 0);
  const previousBalance = Number(row?.balance ?? 0);
  const overpaymentCf = Number(row?.overpayment_cf ?? 0);
  const dueBeforePay = currentBilling + previousBalance - overpaymentCf;
  return roundMoney(Math.max(0, moneyPaid - dueBeforePay));
}

function waterBillsAmountDue(row) {
  const currentBilling = Number(row?.current_billing ?? 0);
  const previousBalance = Number(row?.balance ?? 0);
  const overpaymentCf = Number(row?.overpayment_cf ?? 0);
  const moneyPaid = Number(row?.money_paid ?? 0);
  return roundMoney(Math.max(0, currentBilling + previousBalance - overpaymentCf - moneyPaid));
}

/** Previous period's overpayment for this recipient (newest entry before editingId). */
function previousOverpaymentCfFromEntries(entries, editingId = null) {
  const chronological = [...(entries || [])].sort((a, b) => {
    const ak = billingMonthKey(parseBillingMonthValue(a?.date_to || a?.date_from || a?.date));
    const bk = billingMonthKey(parseBillingMonthValue(b?.date_to || b?.date_from || b?.date));
    if (ak !== bk) return ak - bk;
    return Number(a?.id || 0) - Number(b?.id || 0);
  });
  const filtered =
    editingId == null
      ? chronological
      : chronological.filter((r) => String(r.id) !== String(editingId));
  if (!filtered.length) return 0;
  const prev = filtered[filtered.length - 1];
  // Prefer electricity formula when money_paid/overpayment_cf shape matches; both formulas are now identical.
  return electricityBillsOverpaymentBalance(prev);
}

function previousWaterOverpaymentCfFromEntries(entries, editingId = null) {
  return previousOverpaymentCfFromEntries(entries, editingId);
}

function waterBillsMoneyPaidFromForm() {
  if (state.user?.role !== "owner") return 0;
  const moneyPaidEl = document.getElementById("waterBillsMoneyPaid");
  const raw = moneyPaidEl instanceof HTMLInputElement ? moneyPaidEl.value.trim() : "";
  if (raw === "") return 0;
  const moneyPaid = Number(raw);
  return Number.isFinite(moneyPaid) && moneyPaid >= 0 ? moneyPaid : 0;
}

function waterBillsOverpaymentCfFromForm() {
  const el = document.getElementById("waterBillsOverpaymentCf");
  if (!(el instanceof HTMLInputElement)) return 0;
  const raw = String(el.dataset.rawValue ?? el.value ?? "").replace(/[^\d.-]/g, "").trim();
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function electricityBillsOverpaymentCfFromForm() {
  const el = document.getElementById("electricityBillsOverpaymentCf");
  if (!(el instanceof HTMLInputElement)) return 0;
  const raw = String(el.dataset.rawValue ?? el.value ?? "").replace(/[^\d.-]/g, "").trim();
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function syncWaterBillsOverpaymentCfField(editingId = state.editWaterBillsId) {
  const el = document.getElementById("waterBillsOverpaymentCf");
  if (!(el instanceof HTMLInputElement)) return 0;
  let cf = 0;
  if (editingId != null) {
    const row = (state.waterBillsEntries || []).find((r) => String(r.id) === String(editingId));
    cf = row ? Number(row.overpayment_cf || 0) : previousWaterOverpaymentCfFromEntries(state.waterBillsEntries, editingId);
  } else {
    cf = previousWaterOverpaymentCfFromEntries(state.waterBillsEntries, null);
  }
  el.dataset.rawValue = String(cf);
  el.value = currency(cf);
  return cf;
}

function syncElectricityBillsOverpaymentCfField(editingId = state.editElectricityBillsId) {
  const el = document.getElementById("electricityBillsOverpaymentCf");
  if (!(el instanceof HTMLInputElement)) return 0;
  let cf = 0;
  if (editingId != null) {
    const row = (state.electricityBillsEntries || []).find((r) => String(r.id) === String(editingId));
    cf = row
      ? Number(row.overpayment_cf || 0)
      : previousOverpaymentCfFromEntries(state.electricityBillsEntries, editingId);
  } else {
    cf = previousOverpaymentCfFromEntries(state.electricityBillsEntries, null);
  }
  el.dataset.rawValue = String(cf);
  el.value = currency(cf);
  return cf;
}

function updateMeterBillsFormCalc(prefix) {
  const currentEl = document.getElementById(`${prefix}CurrentMeter`);
  const previousEl = document.getElementById(`${prefix}PreviousMeter`);
  const priceEl = document.getElementById(`${prefix}PricePerM3`);
  const unitsEl = document.getElementById(`${prefix}UnitsUsed`);
  const billingEl = document.getElementById(`${prefix}CurrentBilling`);
  const totalEl = document.getElementById(`${prefix}TotalBilling`);
  if (!currentEl || !previousEl || !priceEl || !unitsEl || !billingEl) return;
  const directWaterPumping =
    prefix === "waterBills"
      ? Number(document.getElementById("waterBillsDirectWaterPumping")?.value || 0)
      : 0;
  const { unitsUsed, currentBilling } = computeMeterBillsDerived(
    currentEl.value,
    previousEl.value,
    priceEl.value,
    directWaterPumping
  );
  const balance = meterBillsBalanceFromForm(prefix);
  if (Number.isFinite(unitsUsed)) {
    const displayedUnits = prefix === "waterBills"
      ? roundMoney(unitsUsed + Math.max(0, directWaterPumping))
      : unitsUsed;
    unitsEl.value = String(displayedUnits);
    billingEl.value = currency(currentBilling);
    if (totalEl) {
      if (prefix === "electricityBills") {
        const overpaymentCf = electricityBillsOverpaymentCfFromForm();
        const amountDue = electricityBillsAmountDue({
          current_billing: currentBilling,
          balance,
          overpayment_cf: overpaymentCf,
          money_paid: electricityBillsMoneyPaidFromForm(),
        });
        totalEl.value = currency(amountDue);
      } else if (prefix === "waterBills") {
        const overpaymentCf = waterBillsOverpaymentCfFromForm();
        const amountDue = waterBillsAmountDue({
          current_billing: currentBilling,
          balance,
          overpayment_cf: overpaymentCf,
          money_paid: waterBillsMoneyPaidFromForm(),
        });
        totalEl.value = currency(amountDue);
      } else {
        totalEl.value = currency(roundMoney(currentBilling + balance));
      }
    }
  } else {
    unitsEl.value = "";
    billingEl.value = "";
    if (totalEl) totalEl.value = "";
  }
}

function wireMeterBillsFormCalc(prefix) {
  const ids = [`${prefix}CurrentMeter`, `${prefix}PreviousMeter`, `${prefix}PricePerM3`, `${prefix}Balance`];
  if (prefix === "electricityBills") ids.push("electricityBillsMoneyPaid");
  if (prefix === "waterBills") {
    ids.push("waterBillsDirectWaterPumping");
    ids.push("waterBillsMoneyPaid");
  }
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el || el.dataset.meterCalcWired === "1") continue;
    el.dataset.meterCalcWired = "1";
    el.addEventListener("input", () => updateMeterBillsFormCalc(prefix));
  }
}

function applyMeterBillsOwnerFieldUi(selector, placeholder) {
  const isOwner = state.user?.role === "owner";
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.toggle("hidden", !isOwner);
    const input = el.querySelector("input[type='number']");
    if (input instanceof HTMLInputElement) {
      input.disabled = !isOwner;
      input.readOnly = !isOwner;
      input.placeholder = placeholder;
      if (!isOwner) input.value = "";
    }
  });
}

function applyMeterBillsOwnerBalanceUi() {
  applyMeterBillsOwnerFieldUi(".owner-only-meter-balance-field", "Enter amount, if any");
  applyMeterBillsOwnerFieldUi(".owner-only-electricity-paid-field", "Enter amount paid, if any");
  updateMeterBillsFormCalc("waterBills");
  updateMeterBillsFormCalc("electricityBills");
}

function latestMeterReadingFromEntries(entries) {
  const rows = sortRowsLatestFirst(entries || []);
  if (!rows.length) return null;
  const chronological = sortRowsLatestFirst(rows).reverse();
  const latest = chronological[chronological.length - 1];
  const reading = Number(latest?.current_meter_reading);
  return Number.isFinite(reading) ? reading : null;
}

function renderBillsEntriesTable({
  bodyEl,
  entries,
  totalCurrentBillingId,
  totalBalId,
  totalBillingId,
  rowKind,
  showMoneyPaid = false,
  totalMoneyPaidId = "",
  showOverpaymentBalance = false,
  totalOverpaymentId = "",
  showDirectWaterPumping = false,
  showOverpaymentCf = false,
  totalOverpaymentCfId = "",
  useWaterAmountDue = false,
}) {
  if (!bodyEl) return;
  const extraCols = (showDirectWaterPumping ? 1 : 0) + (showOverpaymentCf ? 1 : 0) + (showMoneyPaid && !showOverpaymentBalance ? 1 : 0);
  // Base water without extras was 12; electricity with money+overpayment is 14.
  let colCount = 12;
  if (showDirectWaterPumping) colCount += 1;
  if (showMoneyPaid) colCount += 1;
  if (showOverpaymentBalance) colCount += 1;
  if (showOverpaymentCf) colCount += 1;
  const rows = sortRowsLatestFirst(entries || []);
  if (!rows.length) {
    bodyEl.innerHTML = `<tr><td colspan="${colCount}" class="empty">No records.</td></tr>`;
    const curEl = document.getElementById(totalCurrentBillingId);
    const moneyPaidEl = totalMoneyPaidId ? document.getElementById(totalMoneyPaidId) : null;
    const overpaymentEl = totalOverpaymentId ? document.getElementById(totalOverpaymentId) : null;
    const overpaymentCfEl = totalOverpaymentCfId ? document.getElementById(totalOverpaymentCfId) : null;
    const balEl = document.getElementById(totalBalId);
    const totEl = document.getElementById(totalBillingId);
    if (curEl) curEl.textContent = currency(0);
    if (moneyPaidEl) moneyPaidEl.textContent = currency(0);
    if (overpaymentEl) {
      overpaymentEl.textContent = currency(0);
      overpaymentEl.classList.remove("cess-acc-balance-negative");
    }
    if (overpaymentCfEl) {
      overpaymentCfEl.textContent = currency(0);
      overpaymentCfEl.classList.remove("cess-acc-balance-negative");
    }
    if (balEl) {
      balEl.textContent = currency(0);
      balEl.classList.remove("cess-acc-balance-negative");
    }
    if (totEl) {
      totEl.textContent = currency(0);
      totEl.classList.remove("cess-acc-balance-negative");
    }
    return;
  }
  let sumCurrentBilling = 0;
  let sumMoneyPaid = 0;
  let sumOverpayment = 0;
  let sumOverpaymentCf = 0;
  let sumBalance = 0;
  let sumAmountDue = 0;
  for (const row of rows) {
    sumCurrentBilling += Number(row.current_billing || 0);
    sumMoneyPaid += Number(row.money_paid || 0);
    if (showOverpaymentBalance) sumOverpayment += electricityBillsOverpaymentBalance(row);
    if (showOverpaymentCf) sumOverpaymentCf += Number(row.overpayment_cf || 0);
    sumBalance += Number(row.balance || 0);
    sumAmountDue += useWaterAmountDue
      ? waterBillsAmountDue(row)
      : showOverpaymentBalance
        ? electricityBillsAmountDue(row)
        : Number(row.total_billing || 0);
  }
  bodyEl.innerHTML = rows
    .map((row, idx) => {
      const balance = Number(row.balance || 0);
      const moneyPaid = Number(row.money_paid || 0);
      const overpayment = electricityBillsOverpaymentBalance(row);
      const overpaymentCf = Number(row.overpayment_cf || 0);
      const amountDue = useWaterAmountDue
        ? waterBillsAmountDue(row)
        : showOverpaymentBalance
          ? electricityBillsAmountDue(row)
          : Number(row.total_billing || 0);
      const moneyPaidCell = showMoneyPaid ? `<td>${currency(moneyPaid)}</td>` : "";
      const overpaymentCell = showOverpaymentBalance
        ? `<td>${formatCessAccountBalanceCell(overpayment)}</td>`
        : "";
      const overpaymentCfCell = showOverpaymentCf
        ? `<td>${formatCessAccountBalanceCell(overpaymentCf)}</td>`
        : "";
      const directWaterPumpingVal = Number(row.direct_water_pumping || 0);
      const directWaterPumpingCell = showDirectWaterPumping
        ? `<td>${directWaterPumpingVal}</td>`
        : "";
      const displayedUnitsUsed = showDirectWaterPumping
        ? roundMoney(Number(row.units_used || 0) + directWaterPumpingVal)
        : Number(row.units_used || 0);
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatBillingMonthDisplay(row.date_from)}</td>
        <td>${formatBillingMonthDisplay(row.date_to)}</td>
        <td>${escapeHtmlCell(row.bill_to || "")}</td>
        <td>${Number(row.current_meter_reading || 0)}</td>
        <td>${Number(row.previous_meter_reading || 0)}</td>
        <td>${displayedUnitsUsed}</td>
        ${directWaterPumpingCell}
        <td>${Number(row.price_per_m3 || 0)}</td>
        <td>${currency(Number(row.current_billing || 0))}</td>
        ${moneyPaidCell}
        <td>${formatCessAccountBalanceCell(balance)}</td>
        ${overpaymentCfCell}
        ${overpaymentCell}
        <td>${formatCessAccountBalanceCell(amountDue)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="${rowKind}" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="${rowKind}" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  const curEl = document.getElementById(totalCurrentBillingId);
  const moneyPaidEl = totalMoneyPaidId ? document.getElementById(totalMoneyPaidId) : null;
  const overpaymentEl = totalOverpaymentId ? document.getElementById(totalOverpaymentId) : null;
  const overpaymentCfEl = totalOverpaymentCfId ? document.getElementById(totalOverpaymentCfId) : null;
  const balEl = document.getElementById(totalBalId);
  const totEl = document.getElementById(totalBillingId);
  if (curEl) curEl.textContent = currency(sumCurrentBilling);
  if (moneyPaidEl) moneyPaidEl.textContent = currency(sumMoneyPaid);
  if (overpaymentEl) {
    overpaymentEl.textContent = currency(sumOverpayment);
    overpaymentEl.classList.toggle("cess-acc-balance-negative", sumOverpayment < 0);
  }
  if (overpaymentCfEl) {
    overpaymentCfEl.textContent = currency(sumOverpaymentCf);
    overpaymentCfEl.classList.toggle("cess-acc-balance-negative", sumOverpaymentCf < 0);
  }
  if (balEl) {
    balEl.textContent = currency(sumBalance);
    balEl.classList.toggle("cess-acc-balance-negative", sumBalance < 0);
  }
  if (totEl) {
    totEl.textContent = currency(sumAmountDue);
    totEl.classList.toggle("cess-acc-balance-negative", sumAmountDue < 0);
  }
}

function renderWaterBillsTable() {
  renderBillsEntriesTable({
    bodyEl: document.getElementById("water-bills-body"),
    entries: state.waterBillsEntries,
    totalCurrentBillingId: "waterBillsTotalCurrentBilling",
    totalMoneyPaidId: "waterBillsTotalMoneyPaid",
    totalBalId: "waterBillsTotalBalance",
    totalOverpaymentCfId: "waterBillsTotalOverpaymentCf",
    totalBillingId: "waterBillsTotalBilling",
    rowKind: "water-bills",
    showDirectWaterPumping: true,
    showMoneyPaid: true,
    showOverpaymentCf: true,
    useWaterAmountDue: true,
  });
}

function renderElectricityBillsTable() {
  renderBillsEntriesTable({
    bodyEl: document.getElementById("electricity-bills-body"),
    entries: state.electricityBillsEntries,
    totalCurrentBillingId: "electricityBillsTotalCurrentBilling",
    totalMoneyPaidId: "electricityBillsTotalMoneyPaid",
    totalBalId: "electricityBillsTotalBalance",
    totalBillingId: "electricityBillsTotalBilling",
    totalOverpaymentId: "electricityBillsTotalOverpayment",
    totalOverpaymentCfId: "electricityBillsTotalOverpaymentCf",
    rowKind: "electricity-bills",
    showMoneyPaid: true,
    showOverpaymentBalance: true,
    showOverpaymentCf: true,
  });
}

function clearMeterBillsBillingMonths(prefix) {
  for (const role of ["From", "To"]) {
    const el = document.getElementById(`${prefix}BillingMonth${role}`);
    if (el) el.value = "";
  }
}

function setMeterBillsBillingMonth(prefix, role, value) {
  const el = document.getElementById(`${prefix}BillingMonth${role}`);
  if (!el) return;
  const parts = parseBillingMonthValue(value);
  el.value = parts ? billingMonthIsoValue(parts) : "";
}

function resetWaterBillsForm() {
  const form = document.getElementById("water-bills-form");
  if (!form) return;
  form.reset();
  state.editWaterBillsId = null;
  clearMeterBillsBillingMonths("waterBills");
  const unitsEl = document.getElementById("waterBillsUnitsUsed");
  const billingEl = document.getElementById("waterBillsCurrentBilling");
  const balanceEl = document.getElementById("waterBillsBalance");
  const moneyPaidEl = document.getElementById("waterBillsMoneyPaid");
  const totalEl = document.getElementById("waterBillsTotalBilling");
  if (unitsEl) unitsEl.value = "";
  if (billingEl) billingEl.value = "";
  if (balanceEl instanceof HTMLInputElement) balanceEl.value = "";
  if (moneyPaidEl instanceof HTMLInputElement) moneyPaidEl.value = "";
  if (totalEl) totalEl.value = "";
  const saveBtn = document.getElementById("waterBillsSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
  syncWaterBillsOverpaymentCfField(null);
  updateMeterBillsFormCalc("waterBills");
}

function resetElectricityBillsForm() {
  const form = document.getElementById("electricity-bills-form");
  if (!form) return;
  form.reset();
  state.editElectricityBillsId = null;
  clearMeterBillsBillingMonths("electricityBills");
  const unitsEl = document.getElementById("electricityBillsUnitsUsed");
  const billingEl = document.getElementById("electricityBillsCurrentBilling");
  const balanceEl = document.getElementById("electricityBillsBalance");
  const moneyPaidEl = document.getElementById("electricityBillsMoneyPaid");
  const totalEl = document.getElementById("electricityBillsTotalBilling");
  if (unitsEl) unitsEl.value = "";
  if (billingEl) billingEl.value = "";
  if (balanceEl instanceof HTMLInputElement) balanceEl.value = "";
  if (moneyPaidEl instanceof HTMLInputElement) moneyPaidEl.value = "";
  if (totalEl) totalEl.value = "";
  const saveBtn = document.getElementById("electricityBillsSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
  syncElectricityBillsOverpaymentCfField(null);
  updateMeterBillsFormCalc("electricityBills");
}

function fillMeterBillsFormFromRow(prefix, row) {
  setMeterBillsBillingMonth(prefix, "From", row.date_from);
  setMeterBillsBillingMonth(prefix, "To", row.date_to);
  const billTo = document.getElementById(`${prefix}BillTo`);
  const current = document.getElementById(`${prefix}CurrentMeter`);
  const previous = document.getElementById(`${prefix}PreviousMeter`);
  const price = document.getElementById(`${prefix}PricePerM3`);
  if (billTo) billTo.value = row.bill_to || "";
  if (current) current.value = row.current_meter_reading ?? 0;
  if (previous) previous.value = row.previous_meter_reading ?? 0;
  if (price) price.value = row.price_per_m3 ?? 0;
  const balanceEl = document.getElementById(`${prefix}Balance`);
  if (balanceEl instanceof HTMLInputElement && state.user?.role === "owner") {
    const bal = Number(row.balance) || 0;
    balanceEl.value = bal > 0 ? String(bal) : "";
  }
  if (prefix === "electricityBills") {
    const moneyPaidEl = document.getElementById("electricityBillsMoneyPaid");
    if (moneyPaidEl instanceof HTMLInputElement && state.user?.role === "owner") {
      const paid = Number(row.money_paid) || 0;
      moneyPaidEl.value = paid > 0 ? String(paid) : "";
    }
    const cfEl = document.getElementById("electricityBillsOverpaymentCf");
    if (cfEl instanceof HTMLInputElement) {
      const cf = Number(row.overpayment_cf) || 0;
      cfEl.dataset.rawValue = String(cf);
      cfEl.value = currency(cf);
    }
  }
  if (prefix === "waterBills") {
    const dwpEl = document.getElementById("waterBillsDirectWaterPumping");
    if (dwpEl instanceof HTMLInputElement) {
      dwpEl.value = row.direct_water_pumping ?? 0;
    }
    const moneyPaidEl = document.getElementById("waterBillsMoneyPaid");
    if (moneyPaidEl instanceof HTMLInputElement && state.user?.role === "owner") {
      const paid = Number(row.money_paid) || 0;
      moneyPaidEl.value = paid > 0 ? String(paid) : "";
    }
    const cfEl = document.getElementById("waterBillsOverpaymentCf");
    if (cfEl instanceof HTMLInputElement) {
      const cf = Number(row.overpayment_cf) || 0;
      cfEl.dataset.rawValue = String(cf);
      cfEl.value = currency(cf);
    }
  }
  updateMeterBillsFormCalc(prefix);
}

function meterBillsPeriodDatesFromForm(prefix) {
  const fromIso = document.getElementById(`${prefix}BillingMonthFrom`)?.value?.trim() || "";
  const toIso = document.getElementById(`${prefix}BillingMonthTo`)?.value?.trim() || "";
  const fromParts = fromIso ? parseBillingMonthValue(fromIso) : null;
  const toParts = toIso ? parseBillingMonthValue(toIso) : null;
  if (fromIso && !fromParts) throw new Error("Billing Month From is invalid.");
  if (toIso && !toParts) throw new Error("Billing Month To is invalid.");
  if (fromParts && toParts && billingMonthKey(fromParts) > billingMonthKey(toParts)) {
    throw new Error("Billing Month From must be on or before Billing Month To.");
  }
  const dateFrom = billingMonthStorageValue(fromParts);
  const dateTo = billingMonthStorageValue(toParts);
  const date = dateTo || dateFrom || state.shopToday || clientShopTodayDMY();
  return { date_from: dateFrom, date_to: dateTo, date };
}

function meterBillsPayloadFromForm(prefix) {
  const current = Number(document.getElementById(`${prefix}CurrentMeter`)?.value || 0);
  const previous = Number(document.getElementById(`${prefix}PreviousMeter`)?.value || 0);
  const price = Number(document.getElementById(`${prefix}PricePerM3`)?.value || 0);
  if (!Number.isFinite(current) || current < 0) throw new Error("Enter a valid current meter reading.");
  if (!Number.isFinite(previous) || previous < 0) throw new Error("Enter a valid previous meter reading.");
  if (current < previous) throw new Error("Current meter reading must be at least the previous reading.");
  const units = meterBillsUnitConfig(meterBillsPrefixKind(prefix));
  if (!Number.isFinite(price) || price < 0) throw new Error(`Enter a valid ${units.priceError}.`);
  const body = {
    ...meterBillsPeriodDatesFromForm(prefix),
    bill_to: String(document.getElementById(`${prefix}BillTo`)?.value || activeMeterBillRecipientName() || "").trim(),
    description: "",
    current_meter_reading: current,
    previous_meter_reading: previous,
    price_per_m3: price,
  };
  if (prefix === "waterBills") {
    body.direct_water_pumping = Math.max(0, Number(document.getElementById("waterBillsDirectWaterPumping")?.value || 0));
    body.overpayment_cf = waterBillsOverpaymentCfFromForm();
  }
  if (prefix === "electricityBills") {
    body.overpayment_cf = electricityBillsOverpaymentCfFromForm();
  }
  if (state.user?.role === "owner") {
    body.balance = meterBillsBalanceFromForm(prefix);
    if (prefix === "electricityBills") {
      body.money_paid = electricityBillsMoneyPaidFromForm();
    }
    if (prefix === "waterBills") {
      body.money_paid = waterBillsMoneyPaidFromForm();
    }
  }
  return withActiveMeterBillRecipientId(body);
}

function suggestPreviousMeterForNewEntry(prefix, entries, editingId) {
  if (editingId != null) return;
  const previousEl = document.getElementById(`${prefix}PreviousMeter`);
  if (!previousEl || String(previousEl.value || "").trim() !== "") {
    if (prefix === "waterBills") {
      syncWaterBillsOverpaymentCfField(null);
      updateMeterBillsFormCalc(prefix);
    }
    if (prefix === "electricityBills") {
      syncElectricityBillsOverpaymentCfField(null);
      updateMeterBillsFormCalc(prefix);
    }
    return;
  }
  const rows = (entries || []).filter((r) => editingId == null || String(r.id) !== String(editingId));
  const lastReading = latestMeterReadingFromEntries(rows);
  if (lastReading != null) previousEl.value = String(lastReading);
  if (prefix === "waterBills") syncWaterBillsOverpaymentCfField(null);
  if (prefix === "electricityBills") syncElectricityBillsOverpaymentCfField(null);
  updateMeterBillsFormCalc(prefix);
}

function renderCessAccountsTable() {
  if (!cessAccountsBody) return;
  const rows = sortRowsLatestFirst(state.cessAccountsEntries || []);
  if (!rows.length) {
    cessAccountsBody.innerHTML = '<tr><td colspan="10" class="empty">No records.</td></tr>';
    const inEl = document.getElementById("cessAccTotalMoneyIn");
    const outEl = document.getElementById("cessAccTotalMoneyOut");
    const balEl = document.getElementById("cessAccTotalBalance");
    if (inEl) inEl.textContent = "0";
    if (outEl) outEl.textContent = "0";
    if (balEl) {
      balEl.textContent = currency(0);
      balEl.classList.remove("cess-acc-balance-negative");
    }
    return;
  }
  let sumIn = 0;
  let sumOut = 0;
  cessAccountsBody.innerHTML = rows
    .map((row, idx) => {
      const moneyIn = Number(row.money_in || 0);
      const moneyOut = Number(row.money_out || 0);
      sumIn += moneyIn;
      sumOut += moneyOut;
      const balance = moneyIn - moneyOut;
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDMY(row.date)}</td>
        <td>${escapeHtmlCell(row.description)}</td>
        <td>${Number(row.quantity || 0)}</td>
        <td>${Number(row.unit_price || 0)}</td>
        <td>${moneyIn}</td>
        <td>${moneyOut}</td>
        <td>${formatCessAccountBalanceCell(balance)}</td>
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
  const balEl = document.getElementById("cessAccTotalBalance");
  if (inEl) inEl.textContent = String(sumIn);
  if (outEl) outEl.textContent = String(sumOut);
  if (balEl) {
    const totalBal = sumIn - sumOut;
    balEl.textContent = currency(totalBal);
    balEl.classList.toggle("cess-acc-balance-negative", totalBal < 0);
  }
}

function renderCreditDashboard() {
  const grid = document.getElementById("credit-accounts-grid");
  if (!grid) return;
  const accounts = state.creditAccounts || [];
  if (!accounts.length) {
    grid.innerHTML = '<p class="field-hint" style="margin:0;">No credit accounts yet. Click <strong>+</strong> to add one.</p>';
    return;
  }
  const isOwner = state.user?.role === "owner";
  grid.innerHTML = accounts
    .map((acc) => {
      const entryCount = (state.creditEntries || []).filter((e) => Number(e.account_id) === acc.id).length;
      const deleteBtn = isOwner
        ? `<button type="button" class="danger" data-kind="credit-acc-delete" data-account-id="${acc.id}" style="margin-top:6px;font-size:0.78em;padding:2px 10px;" title="Delete ${escapeHtmlCell(acc.name)} account">Delete</button>`
        : "";
      return `<div style="display:flex;flex-direction:column;align-items:stretch;min-width:160px;max-width:220px;">
        <button type="button" class="portal-option" data-kind="credit-acc-open" data-account-id="${acc.id}" style="flex:1;">
          <span class="portal-option-title">${escapeHtmlCell(acc.name)}</span>
          <span class="portal-option-sub">${entryCount} entr${entryCount === 1 ? "y" : "ies"}</span>
        </button>
        ${deleteBtn}
      </div>`;
    })
    .join("");
}

function openCreditAccount(accountId) {
  const acc = (state.creditAccounts || []).find((a) => a.id === Number(accountId));
  if (!acc) return;
  state.activeCreditAccountId = acc.id;
  document.getElementById("credit-dashboard")?.classList.add("hidden");
  document.getElementById("hadifa-account-section")?.classList.remove("hidden");
  const titleEl = document.getElementById("creditAccountSectionTitle");
  const cardTitleEl = document.getElementById("creditAccountCardTitle");
  if (titleEl) titleEl.textContent = acc.name;
  if (cardTitleEl) cardTitleEl.textContent = `${acc.name} Account`;
  renderHadifaAccountsTable();
}

function resetHadifaAccountsForm() {
  if (!hadifaAccountsForm) return;
  hadifaAccountsForm.reset();
  state.editHadifaAccountsId = null;
  if (hadifaAccDate) hadifaAccDate.value = "";
  if (hadifaAccDateDisplay) hadifaAccDateDisplay.value = "";
  const saveBtn = document.getElementById("hadifaAccSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
}

function renderHadifaAccountsTable() {
  if (!hadifaAccountsBody) return;
  const allEntries = state.creditEntries || state.hadifalAccountsEntries || [];
  const filtered = state.activeCreditAccountId
    ? allEntries.filter((e) => Number(e.account_id) === state.activeCreditAccountId)
    : allEntries;
  const rows = sortRowsLatestFirst(filtered);
  if (!rows.length) {
    hadifaAccountsBody.innerHTML = '<tr><td colspan="10" class="empty">No records.</td></tr>';
    const inEl = document.getElementById("hadifaAccTotalMoneyIn");
    const outEl = document.getElementById("hadifaAccTotalMoneyOut");
    const balEl = document.getElementById("hadifaAccTotalBalance");
    if (inEl) inEl.textContent = "0";
    if (outEl) outEl.textContent = "0";
    if (balEl) balEl.textContent = "0";
    return;
  }
  let sumIn = 0;
  let sumOut = 0;
  hadifaAccountsBody.innerHTML = rows
    .map((row, idx) => {
      const moneyIn = Number(row.money_in || 0);
      const moneyOut = Number(row.money_out || 0);
      const balance = moneyIn - moneyOut;
      sumIn += moneyIn;
      sumOut += moneyOut;
      const balClass = balance < 0 ? ' style="color:var(--danger,#d32f2f)"' : '';
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDMY(row.date)}</td>
        <td>${escapeHtmlCell(row.description)}</td>
        <td>${Number(row.quantity || 0)}</td>
        <td>${Number(row.unit_price || 0)}</td>
        <td>${currency(moneyIn)}</td>
        <td>${currency(moneyOut)}</td>
        <td${balClass}>${currency(balance)}</td>
        <td>${escapeHtmlCell(row.sale_via || "Shop")}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="hadifa-acc" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="hadifa-acc" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  const totalBal = sumIn - sumOut;
  const inEl = document.getElementById("hadifaAccTotalMoneyIn");
  const outEl = document.getElementById("hadifaAccTotalMoneyOut");
  const balEl = document.getElementById("hadifaAccTotalBalance");
  if (inEl) inEl.textContent = currency(sumIn);
  if (outEl) outEl.textContent = currency(sumOut);
  if (balEl) {
    balEl.textContent = currency(totalBal);
    balEl.style.color = totalBal < 0 ? "var(--danger,#d32f2f)" : "";
  }
}

function updateFaithSalesFormCalc() {
  const numEl = document.getElementById("faithSalesNumChickens");
  const priceEl = document.getElementById("faithSalesPricePerChicken");
  const paidEl = document.getElementById("faithSalesAmountPaid");
  const totalEl = document.getElementById("faithSalesTotalAmount");
  const balanceEl = document.getElementById("faithSalesAmountBalance");
  if (!numEl || !priceEl || !paidEl || !totalEl || !balanceEl) return;
  const num = Number(numEl.value);
  const priceRaw = priceEl.value.trim();
  const price = priceRaw === "" ? FAITH_SALES_DEFAULT_PRICE_PER_CHICKEN : Number(priceRaw);
  const paid = Number(paidEl.value);
  if (!Number.isFinite(num) || num <= 0 || !Number.isFinite(price) || price < 0) {
    totalEl.value = "";
    balanceEl.value = "";
    return;
  }
  const total = roundMoney(num * price);
  const paidSafe = Number.isFinite(paid) && paid >= 0 ? paid : 0;
  totalEl.value = currency(total);
  balanceEl.value = currency(roundMoney(total - paidSafe));
}

function wireFaithSalesFormCalc() {
  const ids = ["faithSalesNumChickens", "faithSalesPricePerChicken", "faithSalesAmountPaid"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el || el.dataset.faithSalesCalcWired === "1") continue;
    el.dataset.faithSalesCalcWired = "1";
    el.addEventListener("input", updateFaithSalesFormCalc);
  }
}

function resetFaithSalesForm() {
  if (!faithSalesForm) return;
  faithSalesForm.reset();
  state.editFaithSalesId = null;
  if (faithSalesDate) faithSalesDate.value = "";
  if (faithSalesDateDisplay) faithSalesDateDisplay.value = "";
  const priceEl = document.getElementById("faithSalesPricePerChicken");
  const paidEl = document.getElementById("faithSalesAmountPaid");
  const totalEl = document.getElementById("faithSalesTotalAmount");
  const balanceEl = document.getElementById("faithSalesAmountBalance");
  if (priceEl) priceEl.value = String(FAITH_SALES_DEFAULT_PRICE_PER_CHICKEN);
  if (paidEl) paidEl.value = "0";
  if (totalEl) totalEl.value = "";
  if (balanceEl) balanceEl.value = "";
  const saveBtn = document.getElementById("faithSalesSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
  updateFaithSalesFormCalc();
}

function renderFaithSalesTable() {
  if (!faithSalesBody) return;
  const rows = sortRowsLatestFirst(state.faithSalesEntries || []);
  if (!rows.length) {
    faithSalesBody.innerHTML = '<tr><td colspan="8" class="empty">No records.</td></tr>';
    const chicksEl = document.getElementById("faithSalesNumChickensSum");
    const totEl = document.getElementById("faithSalesTotalAmountSum");
    const paidEl = document.getElementById("faithSalesAmountPaidSum");
    const balEl = document.getElementById("faithSalesAmountBalanceSum");
    if (chicksEl) chicksEl.textContent = "0";
    if (totEl) totEl.textContent = currency(0);
    if (paidEl) paidEl.textContent = currency(0);
    if (balEl) balEl.textContent = currency(0);
    return;
  }
  let sumChickens = 0;
  let sumTotal = 0;
  let sumPaid = 0;
  let sumBalance = 0;
  faithSalesBody.innerHTML = rows
    .map((row) => {
      const total = Number(row.total_amount || 0);
      const paid = Number(row.amount_paid || 0);
      const balance = Number(row.amount_balance || 0);
      sumChickens += Number(row.num_chickens || 0);
      sumTotal += total;
      sumPaid += paid;
      sumBalance += balance;
      return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${Number(row.num_chickens || 0)}</td>
        <td>${currency(Number(row.price_per_chicken || 0))}</td>
        <td>${escapeHtmlCell(row.description || "")}</td>
        <td>${currency(total)}</td>
        <td>${currency(paid)}</td>
        <td>${currency(balance)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="faith-sale" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="faith-sale" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  const chicksEl = document.getElementById("faithSalesNumChickensSum");
  const totEl = document.getElementById("faithSalesTotalAmountSum");
  const paidEl = document.getElementById("faithSalesAmountPaidSum");
  const balEl = document.getElementById("faithSalesAmountBalanceSum");
  if (chicksEl) chicksEl.textContent = String(sumChickens);
  if (totEl) totEl.textContent = currency(sumTotal);
  if (paidEl) paidEl.textContent = currency(sumPaid);
  if (balEl) balEl.textContent = currency(sumBalance);
}

function resetFaithExpensesForm() {
  if (!faithExpensesForm) return;
  faithExpensesForm.reset();
  state.editFaithExpensesId = null;
  if (faithExpDate) faithExpDate.value = "";
  if (faithExpDateDisplay) faithExpDateDisplay.value = "";
  const saveBtn = document.getElementById("faithExpSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
  applyEmployeeSalesDateRules();
}

function renderFaithExpensesTable() {
  if (!faithExpensesBody) return;
  const rows = sortRowsLatestFirst(state.faithExpensesEntries || []);
  if (!rows.length) {
    faithExpensesBody.innerHTML = '<tr><td colspan="4" class="empty">No records.</td></tr>';
    const totEl = document.getElementById("faithExpensesTotalMoneyOut");
    if (totEl) totEl.textContent = currency(0);
    return;
  }
  let sumOut = 0;
  faithExpensesBody.innerHTML = rows
    .map((row) => {
      sumOut += Number(row.money_out || 0);
      return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${escapeHtmlCell(row.description)}</td>
        <td>${currency(row.money_out)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="faith-exp" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="faith-exp" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  const totEl = document.getElementById("faithExpensesTotalMoneyOut");
  if (totEl) totEl.textContent = currency(sumOut);
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

function resetWeighBridgeForm() {
  if (!weighBridgeForm) return;
  weighBridgeForm.reset();
  state.editWeighBridgeId = null;
  if (weighBridgeDate) weighBridgeDate.value = "";
  if (weighBridgeDateDisplay) weighBridgeDateDisplay.value = "";
  const saveBtn = document.getElementById("weighBridgeSaveBtn");
  if (saveBtn) saveBtn.textContent = "Save entry";
}

function renderWeighBridgeTable() {
  if (!weighBridgeBody) return;
  const rows = sortRowsLatestFirst(state.weighBridgeEntries || []);
  const totalAmountEl = document.getElementById("wbTotalAmount");
  const totalUfarayKshEl = document.getElementById("wbTotalUfarayKsh");
  const totalAmanaKshEl = document.getElementById("wbTotalAmanaKsh");
  const totalBalanceEl = document.getElementById("wbTotalBalance");
  if (!rows.length) {
    weighBridgeBody.innerHTML = '<tr><td colspan="9" class="empty">No records.</td></tr>';
    if (totalAmountEl) totalAmountEl.textContent = currency(0);
    if (totalUfarayKshEl) totalUfarayKshEl.textContent = currency(0);
    if (totalAmanaKshEl) totalAmanaKshEl.textContent = currency(0);
    const emptyBalance = 2000;
    if (totalBalanceEl) {
      totalBalanceEl.textContent = currency(emptyBalance);
      totalBalanceEl.style.color = "";
      totalBalanceEl.style.fontWeight = "";
    }
    return;
  }
  let sumAmount = 0, sumUfarayKsh = 0, sumAmanaKsh = 0;
  weighBridgeBody.innerHTML = rows
    .map((row, idx) => {
      const ufarayKsh = Number(row.ufaray_ksh || 0);
      const amanaKsh = Number(row.amana_ksh || 0);
      const balance = roundMoney(ufarayKsh - amanaKsh);
      sumAmount += Number(row.amount || 0);
      sumUfarayKsh += ufarayKsh;
      sumAmanaKsh += amanaKsh;
      const balStyle = balance < 0 ? ' style="color:red;font-weight:600"' : '';
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateDMY(row.date)}</td>
        <td>${escapeHtmlCell(row.description || "")}</td>
        <td>${Number(row.qty || 0)}</td>
        <td>${currency(row.amount)}</td>
        <td>${currency(ufarayKsh)}</td>
        <td>${currency(amanaKsh)}</td>
        <td${balStyle}>${currency(balance)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-kind="weigh-bridge" data-action="edit" data-id="${row.id}">Edit</button>
            <button type="button" class="danger" data-kind="weigh-bridge" data-action="delete" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  if (totalAmountEl) totalAmountEl.textContent = currency(sumAmount);
  if (totalUfarayKshEl) totalUfarayKshEl.textContent = currency(sumUfarayKsh);
  if (totalAmanaKshEl) totalAmanaKshEl.textContent = currency(sumAmanaKsh);
  // Grand Total Balance only: Ufaray − Amana + fixed Amana credit of 2,000.
  const WEIGH_BRIDGE_AMANA_CREDIT_KES = 2000;
  const totalBalance = roundMoney(sumUfarayKsh - sumAmanaKsh + WEIGH_BRIDGE_AMANA_CREDIT_KES);
  if (totalBalanceEl) {
    totalBalanceEl.textContent = currency(totalBalance);
    totalBalanceEl.style.color = totalBalance < 0 ? "red" : "";
    totalBalanceEl.style.fontWeight = totalBalance < 0 ? "600" : "";
  }
}

function chickenSaleBundledFeedCellsHtml(row, isOwnerInventoryRow) {
  if (isOwnerInventoryRow) {
    return "<td>—</td><td>—</td><td>—</td><td>—</td>";
  }
  function feedLineText(brandRaw, typeRaw, qtyRaw, totalRaw) {
    const fb = brandRaw && String(brandRaw).trim();
    const ft = typeRaw && String(typeRaw).trim();
    const qty = qtyRaw === "" || qtyRaw == null ? NaN : Math.floor(Number(qtyRaw));
    const total = totalRaw === "" || totalRaw == null ? NaN : Number(totalRaw);
    return {
      brand: fb ? escapeHtmlCell(displayBrand(fb)) : null,
      type: ft ? escapeHtmlCell(displayFeedType(ft)) : null,
      qty: Number.isFinite(qty) ? escapeHtmlCell(String(qty)) : null,
      amt: Number.isFinite(total) ? currency(total) : null,
    };
  }
  const f1 = feedLineText(row.feed_brand, row.feed_type, row.feed_bag_qty, row.feed_line_total);
  const f2 = feedLineText(row.feed_brand2, row.feed_type2, row.feed_bag_qty2, row.feed_line_total2);
  const hasFeed2 = f2.brand || f2.type;
  const brandCell = hasFeed2
    ? `${f1.brand || "—"}<br><span style="color:var(--text-muted,#888);font-size:0.85em">${f2.brand || "—"}</span>`
    : (f1.brand || "—");
  const ftCell = hasFeed2
    ? `${f1.type || "—"}<br><span style="color:var(--text-muted,#888);font-size:0.85em">${f2.type || "—"}</span>`
    : (f1.type || "—");
  const qtyCell = hasFeed2
    ? `${f1.qty || "—"}<br><span style="color:var(--text-muted,#888);font-size:0.85em">${f2.qty || "—"}</span>`
    : (f1.qty || "—");
  const amtCell = hasFeed2
    ? `${f1.amt || "—"}<br><span style="color:var(--text-muted,#888);font-size:0.85em">${f2.amt || "—"}</span>`
    : (f1.amt || "—");
  return `<td>${brandCell}</td><td>${ftCell}</td><td>${qtyCell}</td><td>${amtCell}</td>`;
}

function chickenSalesTableRowsHtml() {
  const emptyMsg =
    state.user.role === "owner" ? "No chick records yet." : "No chick sales recorded yet.";
  const isEmployeeViewer = state.user.role === "employee";
  const colSpan = isEmployeeViewer ? 20 : 21;
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
    const combinedTotal = chickenSaleLineCombinedTotal(row);
    return `
      <tr data-chicken-row-id="${row.id}">
        <td>${formatDateDMY(row.date)}</td>
        <td>${breedCell}</td>
        <td>${notesCell}</td>
        <td>${row.quantity_birds}</td>
        <td>${currency(row.unit_price)}</td>
        <td>${currency(saleLineTotalChicken(row))}</td>
        ${feedCells}
        <td>${currency(combinedTotal)}</td>
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

function downloadChickenSalesPdf() {
  if (state.user?.role !== "owner") return;
  const jsPdfNs = window.jspdf;
  const JsPdfCtor = jsPdfNs?.jsPDF;
  if (typeof JsPdfCtor !== "function") {
    alert("PDF generator is not loaded. Refresh and try again.");
    return;
  }
  const autoTableCheck = new JsPdfCtor({ orientation: "portrait", unit: "pt", format: "a4" });
  if (typeof autoTableCheck.autoTable !== "function" && typeof jsPdfNs?.autoTable !== "function") {
    alert("PDF table helper is not loaded. Refresh and try again.");
    return;
  }

  const { fromDMY, toDMY } = chickenPdfSelectedDateRange();

  if (!fromDMY || !toDMY) {
    alert("Please set both Date From and Date To before downloading the PDF.");
    return;
  }
  if (!isValidDMY(fromDMY) || !isValidDMY(toDMY)) {
    alert("Please enter valid dates in DD/MM/YYYY format.");
    return;
  }
  const fromParts = parseDMYParts(fromDMY);
  const toParts = parseDMYParts(toDMY);
  if (compareDMYParts(fromParts, toParts) > 0) {
    alert("Date From must be on or before Date To.");
    return;
  }

  const filtered = sortRowsLatestFirst(
    state.chickenSales.filter((r) => rowInDateRangeInclusive(r, fromDMY, toDMY)),
  );

  const businessTitle = state.appInstance === "ufaray" ? "Ufaray Feeds" : "Amana Kuku Feeds";
  const safeBusiness = businessTitle.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const safeFrom = toIsoDate(fromDMY).replace(/-/g, "");
  const safeTo = toIsoDate(toDMY).replace(/-/g, "");
  const fromLabel = fromDMY;
  const toLabel = toDMY;

  const doc = new JsPdfCtor({ orientation: "landscape", unit: "pt", format: "a4" });
  const autoFn = doc.autoTable || jsPdfNs?.autoTable;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const G = { dark: [14, 92, 58], accent: [39, 150, 99], mint: [234, 248, 240], edge: [186, 222, 198] };

  doc.setFillColor(...G.dark);
  doc.rect(0, 0, pageW, 58, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(businessTitle.toUpperCase(), margin, 26);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("CHICKEN SALES INVENTORY", margin, 44);
  doc.setFontSize(9);
  doc.text(`Period: ${fromLabel} – ${toLabel}`, pageW - margin, 44, { align: "right" });

  let y = 74;
  if (!filtered.length) {
    doc.setTextColor(...G.dark);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text(`No chicken sales records found between ${fromLabel} and ${toLabel}.`, margin, y + 14);
    doc.save(`${safeBusiness}-chicken-sales-${safeFrom}-${safeTo}.pdf`);
    return;
  }

  let totalChicks = 0;
  let totalRevenue = 0;
  let totalCombined = 0;
  const body = filtered.map((r) => {
    const qty = Number(r.quantity_birds) || 0;
    const lineTotal = saleLineTotalChicken(r);
    const feedTotal = chickenSaleLineFeedTotal(r);
    const combined = lineTotal + feedTotal;
    totalChicks += qty;
    totalRevenue += lineTotal;
    totalCombined += combined;
    const paid = Number(r.money_paid) || 0;
    const balance = combined - paid;
    return [
      formatDateDMY(r.date),
      r.breed || "—",
      r.description || "—",
      String(qty),
      currency(r.unit_price),
      currency(lineTotal),
      currency(combined),
      r.customer_name || "—",
      r.customer_phone || "—",
      currency(paid),
      currency(balance),
      chickenSalePaymentStatusLabel(r),
    ];
  });

  body.push([
    { content: "TOTALS", colSpan: 3, styles: { fontStyle: "bold", halign: "right" } },
    { content: String(totalChicks), styles: { fontStyle: "bold", halign: "right" } },
    "",
    { content: currency(totalRevenue), styles: { fontStyle: "bold", halign: "right" } },
    { content: currency(totalCombined), styles: { fontStyle: "bold", halign: "right" } },
    "",
    "",
    "",
    "",
  ]);

  autoFn.call(doc, {
    head: [["Date", "Breed", "Notes", "Chicks", "Price/chick", "Chicks Amount", "Combined Total", "Customer", "Phone", "Paid", "Balance", "Payment"]],
    body,
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, valign: "middle", lineColor: G.edge, lineWidth: 0.2, textColor: [33, 33, 33], overflow: "linebreak" },
    headStyles: { fillColor: G.dark, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 50 },
      2: { cellWidth: 50 },
      3: { halign: "right", cellWidth: 36 },
      4: { halign: "right", cellWidth: 52 },
      5: { halign: "right", cellWidth: 58 },
      6: { halign: "right", cellWidth: 60 },
      7: { cellWidth: 55 },
      8: { cellWidth: 52 },
      9: { halign: "right", cellWidth: 52 },
      10: { halign: "right", cellWidth: 52 },
      11: { halign: "center", cellWidth: 50 },
    },
    alternateRowStyles: { fillColor: [252, 255, 253] },
    theme: "plain",
  });

  y = (doc.lastAutoTable?.finalY || y) + 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated ${new Date().toLocaleString()} · ${filtered.length} record(s) · Period: ${fromLabel} – ${toLabel}`, margin, y);

  doc.save(`${safeBusiness}-chicken-sales-${safeFrom}-${safeTo}.pdf`);
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
    if (chFeedBrand2) populateBrandSelect(chFeedBrand2);
    if (chFeedType2) {
      chFeedType2.innerHTML = '<option value="">Select feed type</option>';
      chFeedType2.disabled = true;
    }
    if (chFeedBagQty2) chFeedBagQty2.value = "0";
    if (chFeedLineTotal2) chFeedLineTotal2.value = "";
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
  if (meterBillsOwnerOnlyTenant() && state.user?.role !== "owner") {
    clearAuth();
    stopAutoRefresh();
    showLoggedOut();
    return;
  }
  if (isWaterBillsTenant() && page !== "water-bills") {
    return showPage("water-bills");
  }
  if (isElectricityBillsTenant() && page !== "electricity-bills") {
    return showPage("electricity-bills");
  }
  if ((page === "water-bills" || page === "electricity-bills") && state.user?.role !== "owner") {
    return showPage(defaultPageForLoggedInUser());
  }
  if (
    (state.appInstance === "ufaray" || state.appInstance === "amana") &&
    state.user?.role === "owner" &&
    (page === "sales-bags" || page === "sales-kg")
  ) {
    return showPage("inventory");
  }
  if (state.appInstance === "shop" && page !== "inventory" && page !== "sales-bags") {
    if (page === "calculator" || page === "faith-expenses" || page === "faith-sales" || page === "balance") {
      // Calculator, Expenses, Sales, and Balance are allowed for Faith Inventory shop users.
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
  if (page === "credit" && !creditTenantEnabled()) {
    return showPage(state.user?.role === "owner" ? "inventory" : "sales-bags");
  }
  if (page === "pigs" && (state.appInstance !== "amana" || state.user?.role !== "owner")) {
    return showPage(state.user?.role === "owner" ? "inventory" : "sales-bags");
  }
  if (page === "weigh-bridge" && state.appInstance !== "amana") {
    return showPage(state.user?.role === "owner" ? "inventory" : "sales-bags");
  }
  if (page === "nahashon-records" && state.appInstance !== "terry") {
    return showPage(state.user?.role === "owner" ? "inventory" : "sales-bags");
  }
  if (
    state.appInstance === "terry" &&
    page !== "rose-inventory" &&
    page !== "nahashon-records" &&
    page !== "calculator" &&
    page !== "faith-expenses" &&
    page !== "faith-sales" &&
    page !== "balance"
  ) {
    return showPage("rose-inventory");
  }
  if (
    (state.appInstance === "cess" ||
      state.appInstance === "maina-faith-cess" ||
      state.appInstance === "terry-and-cess") &&
    page !== "rose-inventory" &&
    page !== "calculator" &&
    page !== "faith-expenses" &&
    page !== "faith-sales" &&
    page !== "balance"
  ) {
    return showPage("rose-inventory");
  }
  if (
    isRecordsTenant() &&
    page !== "rose-inventory" &&
    page !== "faith-expenses" &&
    page !== "faith-sales" &&
    page !== "balance"
  ) {
    return showPage("rose-inventory");
  }
  if (page === "faith-expenses" && !expensesPageTenantEnabled()) {
    return showPage(defaultPageForLoggedInUser());
  }
  if (page === "faith-sales" && !faithSalesPageTenantEnabled()) {
    return showPage(defaultPageForLoggedInUser());
  }
  if (staffMayAccessCalculatorTenant() && page === "calculator") {
    // Allow calculator for owner and staff on Amana, Ufaray, and Nahah shop tenants.
  } else if (page === "calculator" && state.user?.role !== "owner") {
    return showPage("inventory");
  }
  if (page === "balance" && !faithRoseBalancePageEnabled() && state.user?.role !== "owner") {
    return showPage("sales-bags");
  }
  if (page === "monthly-report") {
    if (state.user?.role !== "owner") return showPage("sales-bags");
    if (state.appInstance !== "amana" && state.appInstance !== "ufaray") {
      return showPage("inventory");
    }
  }
  if (page === "monthly-records") {
    if (state.user?.role !== "owner") return showPage("sales-bags");
    if (!creditTenantEnabled()) return showPage("inventory");
  }
  if (page === "loan-repayment") {
    if (state.user?.role !== "owner") return showPage("sales-bags");
    if (!loanRepaymentTenantEnabled()) return showPage("inventory");
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
    (state.appInstance === "home-chickens" ||
      state.appInstance === "terry" ||
      state.appInstance === "cess" ||
      state.appInstance === "terry-and-cess" ||
      state.appInstance === "maina-faith-cess")
  ) {
    pageHeading.textContent =
      state.appInstance === "home-chickens"
        ? "Home Chickens"
        : state.appInstance === "terry"
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
  if ((page === "water-bills" || page === "electricity-bills") && activeMeterBillRecipientName()) {
    const baseTitle = PAGE_HEADINGS[page] || pageHeading.textContent || page;
    pageHeading.textContent = `${baseTitle} — ${activeMeterBillRecipientName()}`;
  }
  updateElectricityBillsMeterInfoUi();
  const lotScopedPages = new Set(["rose-inventory", "nahashon-records", "faith-expenses", "faith-sales", "balance"]);
  if (lotScopedPages.has(page) && inventoryLotsTenantEnabled() && activeLotName()) {
    const baseTitle = pageHeading.textContent || PAGE_HEADINGS[page] || page;
    pageHeading.textContent = `${baseTitle} — ${activeLotName()}`;
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
    initChickenPdfDateDefaults();
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
  if (page === "feeders-drinkers") {
    renderFeedersDrinkersTable();
    updateFeedersDrinkersProfitDisplay();
  }
  if (page === "medicaments") renderMedicamentsTable();
  if (page === "gas") renderGasTable();
  if (page === "rose-inventory") renderRoseTable();
  if (page === "nahashon-records") renderNahashonTable();
  if (page === "faith-expenses") renderFaithExpensesTable();
  if (page === "faith-sales") renderFaithSalesTable();
  if (page === "cess-accounts") renderCessAccountsTable();
  if (page === "water-bills") {
    applyMeterBillsOwnerBalanceUi();
    syncMeterBillsBillToFromRecipient("waterBills");
    renderWaterBillsTable();
    if (state.editWaterBillsId == null) syncWaterBillsOverpaymentCfField(null);
    suggestPreviousMeterForNewEntry("waterBills", state.waterBillsEntries, state.editWaterBillsId);
  }
  if (page === "electricity-bills") {
    applyMeterBillsOwnerBalanceUi();
    syncMeterBillsBillToFromRecipient("electricityBills");
    renderElectricityBillsTable();
    if (state.editElectricityBillsId == null) syncElectricityBillsOverpaymentCfField(null);
    suggestPreviousMeterForNewEntry("electricityBills", state.electricityBillsEntries, state.editElectricityBillsId);
  }
  if (page === "credit") {
    state.activeCreditAccountId = null;
    document.getElementById("credit-dashboard")?.classList.remove("hidden");
    document.getElementById("hadifa-account-section")?.classList.add("hidden");
    document.getElementById("credit-new-account-form")?.classList.add("hidden");
    renderCreditDashboard();
  }
  if (page === "pigs") renderPigsTable();
  if (page === "weigh-bridge") renderWeighBridgeTable();
  if (page === "calculator") {
    populateCalcChickenBreedSelect();
    initCalcChickenFormDefaults();
    initCalcValidUntilDefaults();
    applyCalcChickenPriceFromBreed();
    updateCalcChickenTotalDisplay();
    renderCalculatorTable();
  }
  if (page === "expenditure") {
    ensureExpenditureStatementMonth();
    renderExpenditureTable();
  }
  if (page === "balance") {
    updateBalanceBanner();
    renderFaithRoseBalancePage();
  }
  if (page === "monthly-report") renderMonthlyReport();
  if (page === "monthly-records") renderMonthlyRecords();
  if (page === "loan-repayment") renderLoanRepaymentPage();
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

async function loadMeterBillRecipients() {
  if (!meterBillRecipientsTenantEnabled()) {
    state.meterBillRecipients = [];
    state.activeMeterBillRecipientId = null;
    updateMeterBillRecipientBarUi();
    return;
  }
  try {
    let recipients = await api("/api/meter-bill-recipients");
    state.meterBillRecipients = Array.isArray(recipients) ? recipients : [];
    if (await ensureDefaultMeterBillRecipientsPresent()) {
      recipients = await api("/api/meter-bill-recipients");
      state.meterBillRecipients = Array.isArray(recipients) ? recipients : [];
    }
    let recipientId = readPersistedActiveMeterBillRecipientId();
    if (!state.meterBillRecipients.some((r) => Number(r.id) === Number(recipientId))) {
      recipientId = state.meterBillRecipients[0]?.id ?? 1;
    }
    state.activeMeterBillRecipientId = recipientId;
    persistActiveMeterBillRecipientId(recipientId);
  } catch (_error) {
    state.meterBillRecipients = [];
    state.activeMeterBillRecipientId = 1;
  }
  updateMeterBillRecipientBarUi();
  syncMeterBillsBillToFromRecipient("waterBills");
  syncMeterBillsBillToFromRecipient("electricityBills");
}

function updateMeterBillRecipientBarUi() {
  const bar = document.getElementById("meterBillRecipientBar");
  const select = document.getElementById("meterBillRecipientSelect");
  if (!bar || !select) return;
  const enabled = meterBillRecipientsTenantEnabled();
  bar.classList.toggle("hidden", !enabled);
  if (!enabled) return;
  const current = String(state.activeMeterBillRecipientId || "");
  select.innerHTML = "";
  const recipients =
    (state.meterBillRecipients || []).length > 0
      ? state.meterBillRecipients
      : DEFAULT_METER_BILL_RECIPIENT_NAMES.map((name, idx) => ({ id: idx + 1, name }));
  for (const recipient of recipients) {
    const opt = document.createElement("option");
    opt.value = String(recipient.id);
    opt.textContent = recipient.name || `Recipient ${recipient.id}`;
    select.appendChild(opt);
  }
  if (current && [...select.options].some((o) => o.value === current)) {
    select.value = current;
  } else if (select.options.length) {
    select.value = select.options[0].value;
    state.activeMeterBillRecipientId = Number(select.value);
    persistActiveMeterBillRecipientId(state.activeMeterBillRecipientId);
  }
  const hintEl = document.getElementById("meterBillRecipientHint");
  if (hintEl && activeMeterBillRecipientName()) {
    hintEl.textContent = `Showing billings for ${activeMeterBillRecipientName()}. Switch person to view or add entries for someone else.`;
  }
  updateElectricityBillsMeterInfoUi();
}

async function onActiveMeterBillRecipientChange(recipientId) {
  const nextId = Number(recipientId);
  if (!Number.isFinite(nextId) || nextId <= 0) return;
  state.activeMeterBillRecipientId = nextId;
  persistActiveMeterBillRecipientId(nextId);
  resetWaterBillsForm();
  resetElectricityBillsForm();
  updateMeterBillRecipientBarUi();
  syncMeterBillsBillToFromRecipient("waterBills");
  syncMeterBillsBillToFromRecipient("electricityBills");
  await loadBillsTenantData();
  if (state.currentPage) showPage(state.currentPage);
}

async function loadBillsTenantData() {
  if (meterBillRecipientsTenantEnabled()) {
    await loadMeterBillRecipients();
  }
  const q = meterBillRecipientApiQuery();
  const apiPath = isWaterBillsTenant() ? `/api/water-bills${q}` : `/api/electricity-bills${q}`;
  try {
    const rows = await api(apiPath);
    if (isWaterBillsTenant()) {
      state.waterBillsEntries = Array.isArray(rows) ? rows : [];
      renderWaterBillsTable();
      suggestPreviousMeterForNewEntry("waterBills", state.waterBillsEntries, state.editWaterBillsId);
    } else {
      state.electricityBillsEntries = Array.isArray(rows) ? rows : [];
      renderElectricityBillsTable();
      suggestPreviousMeterForNewEntry("electricityBills", state.electricityBillsEntries, state.editElectricityBillsId);
    }
  } catch {
    if (isWaterBillsTenant()) {
      state.waterBillsEntries = [];
      renderWaterBillsTable();
    } else {
      state.electricityBillsEntries = [];
      renderElectricityBillsTable();
    }
  }
  applyMeterBillsOwnerBalanceUi();
}

async function loadInventoryLots() {
  if (!inventoryLotsTenantEnabled()) {
    state.inventoryLots = [];
    state.activeLotId = null;
    updateInventoryLotBarUi();
    return;
  }
  try {
    const lots = await api("/api/inventory-lots");
    state.inventoryLots = Array.isArray(lots) ? lots : [];
    let lotId = readPersistedActiveLotId();
    if (!state.inventoryLots.some((l) => Number(l.id) === Number(lotId))) {
      lotId = state.inventoryLots[0]?.id ?? 1;
    }
    state.activeLotId = lotId;
    persistActiveLotId(lotId);
  } catch (_error) {
    state.inventoryLots = [];
    state.activeLotId = 1;
  }
  updateInventoryLotBarUi();
}

async function loadLotScopedEntries() {
  if (!inventoryLotsTenantEnabled() || !state.activeLotId) return;
  const q = lotScopedApiQuery();
  const requests = [
    api(`/api/rose/inventory${q}`),
    state.appInstance === "terry" ? api(`/api/nahashon-accounts${q}`) : Promise.resolve(null),
    api(`/api/faith-expenses${q}`),
    api(`/api/faith-sales${q}`),
  ];
  const [rose, nahashon, faithExp, faithSales] = await Promise.allSettled(requests);
  state.roseEntries = rose.status === "fulfilled" ? rose.value : [];
  if (state.appInstance === "terry" && nahashon.status === "fulfilled") {
    state.nahashonEntries = nahashon.value || [];
  }
  state.faithExpensesEntries = faithExp.status === "fulfilled" ? faithExp.value : [];
  state.faithSalesEntries = faithSales.status === "fulfilled" ? faithSales.value : [];
}

function refreshLotScopedPageTables() {
  if (state.currentPage === "rose-inventory") renderRoseTable();
  if (state.currentPage === "nahashon-records") renderNahashonTable();
  if (state.currentPage === "faith-expenses") renderFaithExpensesTable();
  if (state.currentPage === "faith-sales") renderFaithSalesTable();
  if (state.currentPage === "balance") renderFaithRoseBalancePage();
}

function updateInventoryLotBarUi() {
  const bar = document.getElementById("inventoryLotBar");
  const select = document.getElementById("inventoryLotSelect");
  if (!bar || !select) return;
  const enabled = inventoryLotsTenantEnabled();
  bar.classList.toggle("hidden", !enabled);
  if (!enabled) return;
  const current = String(state.activeLotId || "");
  select.innerHTML = "";
  for (const lot of state.inventoryLots || []) {
    const opt = document.createElement("option");
    opt.value = String(lot.id);
    opt.textContent = lot.name || `Lot ${lot.id}`;
    select.appendChild(opt);
  }
  if (current && [...select.options].some((o) => o.value === current)) {
    select.value = current;
  } else if (select.options.length) {
    select.value = select.options[0].value;
    state.activeLotId = Number(select.value);
    persistActiveLotId(state.activeLotId);
  }
}

async function onActiveLotChange(lotId) {
  const nextId = Number(lotId);
  if (!Number.isFinite(nextId) || nextId <= 0) return;
  state.activeLotId = nextId;
  persistActiveLotId(nextId);
  resetRoseForm();
  resetNahashonForm();
  resetFaithExpensesForm();
  resetFaithSalesForm();
  updateInventoryLotBarUi();
  await loadLotScopedEntries();
  refreshLotScopedPageTables();
  if (state.currentPage) showPage(state.currentPage);
}

async function loadAllData() {
  if (isBillsTenant()) {
    await loadBillsTenantData();
    return;
  }
  await loadInventoryLots();
  const lotQ = lotScopedApiQuery();
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
    if (chFeedBrand2) populateBrandSelect(chFeedBrand2);
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
    api(`/api/rose/inventory${lotQ}`),
    api(`/api/nahashon-accounts${lotQ}`),
    api(`/api/faith-expenses${lotQ}`),
    api(`/api/faith-sales${lotQ}`),
    api("/api/cess-accounts"),
    api("/api/pigs"),
    api("/api/credit-accounts"),
    api("/api/credit-entries"),
    api("/api/weigh-bridge"),
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
  ensureExpenditureStatementMonth();
  state.roseEntries = extras[12].status === "fulfilled" ? extras[12].value : [];
  state.nahashonEntries = extras[13].status === "fulfilled" ? extras[13].value : [];
  state.faithExpensesEntries = extras[14].status === "fulfilled" ? extras[14].value : [];
  state.faithSalesEntries = extras[15].status === "fulfilled" ? extras[15].value : [];
  state.cessAccountsEntries = extras[16].status === "fulfilled" ? extras[16].value : [];
  state.pigsEntries = extras[17].status === "fulfilled" ? extras[17].value : [];
  state.creditAccounts = extras[18].status === "fulfilled" ? extras[18].value : [];
  state.creditEntries = extras[19].status === "fulfilled" ? extras[19].value : [];
  state.weighBridgeEntries = extras[20].status === "fulfilled" ? extras[20].value : [];

  await loadMonthlyRecordsData();
  await loadLoanRepaymentsData();

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
    initCalcValidUntilDefaults();
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
  renderCreditDashboard();
  renderHadifaAccountsTable();
  renderNahashonTable();
  renderFaithExpensesTable();
  renderFaithSalesTable();
  renderPigsTable();
  renderWeighBridgeTable();
  if (state.currentPage === "monthly-report") renderMonthlyReport();
  if (state.currentPage === "monthly-records") renderMonthlyRecords();
  if (state.currentPage === "loan-repayment") renderLoanRepaymentPage();
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

document.getElementById("openWaterBillsBtn")?.addEventListener("click", () => {
  state.appInstance = "water-bills";
  persistAppInstance();
  showLoginCard();
});

document.getElementById("openElectricityBillsBtn")?.addEventListener("click", () => {
  state.appInstance = "electricity-bills";
  persistAppInstance();
  showLoginCard();
});

document.getElementById("openRoseBtn")?.addEventListener("click", () => {
  state.appInstance = "rose";
  persistAppInstance();
  showLoginCard();
});

document.getElementById("openHomeChickensBtn")?.addEventListener("click", () => {
  state.appInstance = "home-chickens";
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
    if (meterBillsOwnerOnlyTenant() && state.user?.role !== "owner") {
      clearAuth();
      throw new Error(
        isWaterBillsTenant() ? "Water Bills is owner-only." : "Electricity Bills is owner-only."
      );
    }
    persistAuth();
    showLoggedIn();
    showPage(defaultPageForLoggedInUser());
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
    showPage(defaultPageForLoggedInUser());
    await loadAllData();
    applyEmployeeSalesDateRules();
    applyEmployeeFeedSalePricingUi();
    applyMeterBillsOwnerBalanceUi();
    startAutoRefresh();
  } catch (_error) {
    stopAutoRefresh();
    clearAuth();
    showLoggedOut();
  }
}

function userMayNavigateToPage(page) {
  if (!page || !state.user) return false;
  if (page === "balance" && faithRoseBalancePageEnabled()) return true;
  if (page === "cess-accounts" && (state.appInstance !== "amana" || state.user.role !== "owner")) return false;
  if (page === "credit" && !creditTenantEnabled()) return false;
  if (page === "nahashon-records" && state.appInstance !== "terry") return false;
  if ((page === "water-bills" || page === "electricity-bills") && state.user.role !== "owner") return false;
  if (page === "faith-expenses" && !expensesPageTenantEnabled()) return false;
  if (page === "faith-sales" && !faithSalesPageTenantEnabled()) return false;
  if (state.user.role === "owner") {
    return OWNER_ALLOWED_PAGES.has(page);
  }
  if (OWNER_INVENTORY_PAGES.has(page)) {
    return page === "calculator" && staffMayAccessCalculatorTenant();
  }
  return true;
}

document.querySelectorAll(".nav-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (!userMayNavigateToPage(page)) return;
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
const chPdfDateFromDisplay = document.getElementById("chPdfDateFromDisplay");
const chPdfDateFrom = document.getElementById("chPdfDateFrom");
const chPdfOpenCalendarFromBtn = document.getElementById("chPdfOpenCalendarFromBtn");
const chPdfDateToDisplay = document.getElementById("chPdfDateToDisplay");
const chPdfDateTo = document.getElementById("chPdfDateTo");
const chPdfOpenCalendarToBtn = document.getElementById("chPdfOpenCalendarToBtn");
if (chPdfDateFromDisplay && chPdfDateFrom && chPdfOpenCalendarFromBtn) {
  wireDatePicker(chPdfDateFromDisplay, chPdfDateFrom, chPdfOpenCalendarFromBtn);
}
if (chPdfDateToDisplay && chPdfDateTo && chPdfOpenCalendarToBtn) {
  wireDatePicker(chPdfDateToDisplay, chPdfDateTo, chPdfOpenCalendarToBtn);
}
document.getElementById("pageDownloadPdfBtn")?.addEventListener("click", () => {
  try {
    downloadCurrentPagePdf();
  } catch (err) {
    console.error(err);
    alert(err?.message || "Could not generate PDF. Please try again.");
  }
});

document.getElementById("expStatementMonth")?.addEventListener("change", (event) => {
  const sel = event.target;
  if (!(sel instanceof HTMLSelectElement)) return;
  state.expenditureMonthFilter = sel.value;
  renderExpenditureTable();
});

document.getElementById("expDownloadPdfBtn")?.addEventListener("click", () => {
  try {
    downloadExpenditurePagePdf();
  } catch (err) {
    console.error(err);
    alert(err?.message || "Could not generate PDF. Please try again.");
  }
});

document.getElementById("chDownloadPdfBtn")?.addEventListener("click", () => {
  try {
    downloadChickenSalesPdf();
  } catch (err) {
    console.error(err);
    alert(err?.message || "Could not generate PDF. Please try again.");
  }
});
chFeedBrand?.addEventListener("change", () => {
  populateChChickenFeedTypes(chFeedBrand.value);
});
chFeedType?.addEventListener("change", () => syncChEmployeeBundledFeedAmount());
chFeedBagQty?.addEventListener("input", () => syncChEmployeeBundledFeedAmount());
chFeedBrand2?.addEventListener("change", () => {
  populateChChickenFeedTypes2(chFeedBrand2.value);
});
chFeedType2?.addEventListener("change", () => syncChEmployeeBundledFeedAmount2());
chFeedBagQty2?.addEventListener("input", () => syncChEmployeeBundledFeedAmount2());
if (fdDateDisplay && fdDate && fdOpenCalendarBtn) wireDatePicker(fdDateDisplay, fdDate, fdOpenCalendarBtn);
if (medDateDisplay && medDate && medOpenCalendarBtn) wireDatePicker(medDateDisplay, medDate, medOpenCalendarBtn);
if (gasDateDisplay && gasDate && gasOpenCalendarBtn) wireDatePicker(gasDateDisplay, gasDate, gasOpenCalendarBtn);
if (expDateDisplay && expDate && expOpenCalendarBtn) wireDatePicker(expDateDisplay, expDate, expOpenCalendarBtn);
if (roseDateDisplay && roseDate && roseOpenCalendarBtn) wireDatePicker(roseDateDisplay, roseDate, roseOpenCalendarBtn);
if (calcDueDateDisplay && calcDueDate && calcDueOpenCalendarBtn) {
  wireDatePicker(calcDueDateDisplay, calcDueDate, calcDueOpenCalendarBtn);
  const syncValidUntilDay = () => syncCalcValidUntilDayFromDate();
  calcDueDateDisplay.addEventListener("input", syncValidUntilDay);
  calcDueDate.addEventListener("change", syncValidUntilDay);
}
document.getElementById("calcValidUntilDay")?.addEventListener("change", (event) => {
  const sel = event.target;
  if (sel instanceof HTMLSelectElement) sel.dataset.userSet = "1";
});
if (calcChDateDisplay && calcChDate && calcChOpenCalendarBtn) {
  wireDatePicker(calcChDateDisplay, calcChDate, calcChOpenCalendarBtn);
}
if (nahashonDateDisplay && nahashonDate && nahashonOpenCalendarBtn) {
  wireDatePicker(nahashonDateDisplay, nahashonDate, nahashonOpenCalendarBtn);
}
if (faithExpDateDisplay && faithExpDate && faithExpOpenCalendarBtn) {
  wireDatePicker(faithExpDateDisplay, faithExpDate, faithExpOpenCalendarBtn);
}
if (faithSalesDateDisplay && faithSalesDate && faithSalesOpenCalendarBtn) {
  wireDatePicker(faithSalesDateDisplay, faithSalesDate, faithSalesOpenCalendarBtn);
}
wireFaithSalesFormCalc();
if (cessAccDateDisplay && cessAccDate && cessAccOpenCalendarBtn) {
  wireDatePicker(cessAccDateDisplay, cessAccDate, cessAccOpenCalendarBtn);
}
wireBillingMonthPicker(
  document.getElementById("waterBillsBillingMonthFrom"),
  document.getElementById("waterBillsBillingMonthFromOpenBtn")
);
wireBillingMonthPicker(
  document.getElementById("waterBillsBillingMonthTo"),
  document.getElementById("waterBillsBillingMonthToOpenBtn")
);
wireBillingMonthPicker(
  document.getElementById("electricityBillsBillingMonthFrom"),
  document.getElementById("electricityBillsBillingMonthFromOpenBtn")
);
wireBillingMonthPicker(
  document.getElementById("electricityBillsBillingMonthTo"),
  document.getElementById("electricityBillsBillingMonthToOpenBtn")
);
wireMeterBillsFormCalc("waterBills");
wireMeterBillsFormCalc("electricityBills");
if (hadifaAccDateDisplay && hadifaAccDate && hadifaAccOpenCalendarBtn) {
  wireDatePicker(hadifaAccDateDisplay, hadifaAccDate, hadifaAccOpenCalendarBtn);
}
if (pigsDateDisplay && pigsDate && pigsOpenCalendarBtn) {
  wireDatePicker(pigsDateDisplay, pigsDate, pigsOpenCalendarBtn);
}
document.getElementById("pigsClearBtn")?.addEventListener("click", resetPigsForm);
if (weighBridgeDateDisplay && weighBridgeDate && weighBridgeOpenCalendarBtn) {
  wireDatePicker(weighBridgeDateDisplay, weighBridgeDate, weighBridgeOpenCalendarBtn);
}
document.getElementById("weighBridgeClearBtn")?.addEventListener("click", resetWeighBridgeForm);
wireMoneyInputBlur(document.getElementById("weighBridgeAmount"));
wireMoneyInputBlur(document.getElementById("weighBridgeUfarayKsh"));
wireMoneyInputBlur(document.getElementById("weighBridgeAmanaKsh"));
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
document.getElementById("loanRepaymentMonth")?.addEventListener("change", () => {
  state.loanRepaymentPreview = null;
  refreshLoanRepaymentPreview();
});
document.getElementById("loanRepaymentAmount")?.addEventListener("input", () => refreshLoanRepaymentPreview());
document.getElementById("loanRepaymentClearBtn")?.addEventListener("click", () => resetLoanRepaymentForm());
document.getElementById("loan-repayment-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loanRepaymentTenantEnabled()) return;
  const monthKey = String(document.getElementById("loanRepaymentMonth")?.value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return alert("Choose a valid month.");
  const amount = Number(document.getElementById("loanRepaymentAmount")?.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return alert("Amount must be greater than zero.");
  const payload = {
    month_key: monthKey,
    amount,
    note: String(document.getElementById("loanRepaymentNote")?.value || "").trim(),
  };
  try {
    if (state.editLoanRepaymentId) {
      await api(`/api/loan-repayments/${state.editLoanRepaymentId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/loan-repayments", { method: "POST", body: JSON.stringify(payload) });
    }
    state.loanRepaymentPreview = null;
    resetLoanRepaymentForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("monthlyRecordsCloseBtn")?.addEventListener("click", async () => {
  const payload = state.monthlyRecordsPayload || {};
  const label = payload.currentMonthLabel || "this month";
  if (payload.currentClosed) return;
  if (
    !window.confirm(
      `Close books for ${label}? This permanently saves combined accumulated profits, expenditure, and balance for ${label}.`
    )
  ) {
    return;
  }
  try {
    await api("/api/monthly-records/close", {
      method: "POST",
      body: JSON.stringify({ month_key: payload.currentMonthKey || null }),
    });
    await loadAllData();
  } catch (err) {
    alert(err.message);
  }
});
fdItem?.addEventListener("change", (event) => {
  if (event.target instanceof HTMLSelectElement && event.target.value === "__add_item__") {
    event.target.value = "";
    showAddCatalogItemUi("feeders-drinkers");
    return;
  }
  refreshEmployeeNewPageSellingPrices();
});
medItem?.addEventListener("change", (event) => {
  if (event.target instanceof HTMLSelectElement && event.target.value === "__add_item__") {
    event.target.value = "";
    showAddCatalogItemUi("medicaments");
    return;
  }
  refreshEmployeeNewPageSellingPrices();
});
gasSize?.addEventListener("change", refreshEmployeeNewPageSellingPrices);

function showAddCatalogItemUi(category) {
  const wrapId = category === "feeders-drinkers" ? "fdAddItemWrap" : "medAddItemWrap";
  const inputId = category === "feeders-drinkers" ? "fdAddItemName" : "medAddItemName";
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.classList.remove("hidden");
  const input = document.getElementById(inputId);
  if (input instanceof HTMLInputElement) { input.value = ""; input.focus(); }
}

function hideAddCatalogItemUi(category) {
  const wrapId = category === "feeders-drinkers" ? "fdAddItemWrap" : "medAddItemWrap";
  document.getElementById(wrapId)?.classList.add("hidden");
}

async function saveNewCatalogItem(category) {
  const inputId = category === "feeders-drinkers" ? "fdAddItemName" : "medAddItemName";
  const input = document.getElementById(inputId);
  const name = input instanceof HTMLInputElement ? input.value.trim() : "";
  if (!name) { alert("Please enter an item name."); return; }
  const endpoint = category === "feeders-drinkers" ? "/api/feeders-drinkers/catalog" : "/api/medicaments/catalog";
  const wrapId = category === "feeders-drinkers" ? "fdAddItemWrap" : "medAddItemWrap";
  const wrap = document.getElementById(wrapId);
  const saveBtn = wrap?.querySelector("button[data-action='save']");
  if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = true;
  try {
    await api(endpoint, { method: "POST", body: JSON.stringify({ name }) });
    hideAddCatalogItemUi(category);
    const catalogs = await Promise.allSettled([
      api("/api/feeders-drinkers/catalog"),
      api("/api/medicaments/catalog"),
    ]);
    if (catalogs[0].status === "fulfilled") state.feedersDrinkersCatalog = catalogs[0].value;
    if (catalogs[1].status === "fulfilled") state.medicamentsCatalog = catalogs[1].value;
    populateFeedersDrinkersItems();
    populateMedicamentsItems();
    if (category === "feeders-drinkers" && fdItem) fdItem.value = name;
    if (category === "medicaments" && medItem) medItem.value = name;
  } catch (err) {
    alert(err.message);
  } finally {
    if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = false;
  }
}

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
  const daySel = document.getElementById("calcValidUntilDay");
  if (daySel instanceof HTMLSelectElement) {
    daySel.value = "Saturday";
    daySel.dataset.userSet = "";
  }
  const timeEl = document.getElementById("calcValidUntilTime");
  if (timeEl instanceof HTMLInputElement) timeEl.value = "12.00pm";
  initCalcValidUntilDefaults();
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
const AMANA_CALC_BUSINESS_MOBILE_LINE = "Mobile number : 0141 388 444";
const UFARAY_CALC_BUSINESS_MOBILE_LINE = "Mobile number : 0116 322 881";
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

function getCalcBusinessMobileLineForPdf(mode) {
  if (state.appInstance === "amana") return AMANA_CALC_BUSINESS_MOBILE_LINE;
  if (state.appInstance === "ufaray" && (mode === "proforma" || mode === "invoice")) {
    return UFARAY_CALC_BUSINESS_MOBILE_LINE;
  }
  return "";
}

function updateCalcBrandHeaderUi() {
  const header = document.getElementById("calcBrandHeader");
  if (!header) return;
  header.classList.toggle("hidden", state.appInstance !== "amana");
}

/** Logo at top-right; preserves aspect ratio. Returns placement or null. */
function addPdfLogoTopRight(doc, logoMeta, opts = {}) {
  if (!logoMeta?.dataUrl || !logoMeta.width || !logoMeta.height) return null;
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
  return { drawH, drawW, x, top };
}

function drawBusinessMobileBelowPdfLogo(doc, placement, mobileLine) {
  if (!mobileLine || !placement) return 0;
  const textY = placement.top + placement.drawH + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(mobileLine, placement.x + placement.drawW / 2, textY, { align: "center" });
  return 14;
}

function pdfLogoBlockHeight(placement, extraBelow = 0) {
  if (!placement) return 0;
  return placement.drawH + extraBelow;
}

/** M-Pesa Buy Goods payment details on Calculator (Amana / Ufaray) and calculator PDFs. */
function getCalcMpesaPaymentConfig() {
  const base = {
    brand: "M-PESA",
    headerSuffix: "PAYMENTS",
    type: "Buy Goods and Services",
    tillLabel: "Till Number",
  };
  if (state.appInstance === "ufaray") {
    return { ...base, till: "4963272", payee: "Ufaray Feeds" };
  }
  if (state.appInstance === "amana") {
    return { ...base, till: "5757375", payee: "Amana Kuku Feeds" };
  }
  return null;
}

function updateCalcMpesaPaymentCardUi() {
  const payment = getCalcMpesaPaymentConfig();
  const card = document.getElementById("calcMpesaPaymentCard");
  if (card) card.classList.toggle("hidden", !payment);
  if (!payment) return;
  const tillEl = document.getElementById("calcMpesaTill");
  const payeeEl = document.getElementById("calcMpesaPayee");
  if (tillEl) tillEl.textContent = payment.till;
  if (payeeEl) payeeEl.textContent = payment.payee;
}

function shouldIncludeCalcMpesaPaymentInPdf() {
  return getCalcMpesaPaymentConfig() != null;
}

/**
 * Draws an M-Pesa-style green payment block on a jsPDF document.
 * @returns {number} Y position below the block
 */
function drawMpesaPaymentBlockPdf(doc, startY, { margin = 40, tableW } = {}) {
  const payment = getCalcMpesaPaymentConfig();
  if (!payment) return startY;
  const pageW = doc.internal.pageSize.getWidth();
  const w = tableW ?? pageW - 2 * margin;
  const blockH = 84;
  const green = [0, 166, 81];
  const greenDark = [0, 120, 58];
  const white = [255, 255, 255];
  const headerTextY = startY + 14;

  doc.setFillColor(...green);
  doc.roundedRect(margin, startY, w, blockH, 8, 8, "F");
  doc.setFillColor(...greenDark);
  doc.rect(margin, startY, w, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...white);
  const brandX = margin + 12;
  doc.text(payment.brand, brandX, headerTextY);
  const paymentsX = brandX + doc.getTextWidth(payment.brand) + 6;
  doc.text(payment.headerSuffix, paymentsX, headerTextY);

  let y = startY + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...white);
  doc.text(payment.type, margin + 12, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(payment.tillLabel, margin + 12, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(payment.till, margin + 12, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(payment.payee, margin + 12, y);
  doc.setTextColor(0, 0, 0);

  return startY + blockH + 16;
}

/** Invoice / proforma header: logo above the divider line, title on the left. Returns Y for content below the line. */
function drawInvoicePdfHeaderBand(doc, { logoMeta, hdr, brandLine, margin, pageW, G, pdfMode = "proforma" }) {
  const rightX = pageW - margin;
  const logoTop = 14;
  const titleY = logoMeta ? 52 : 36;

  doc.setFillColor(...G.accent);
  doc.rect(0, 0, pageW, 12, "F");

  let logoPlacement = null;
  let mobileBelowH = 0;
  if (logoMeta) {
    logoPlacement = addPdfLogoTopRight(doc, logoMeta, { top: logoTop, maxWidth: 118, maxHeight: 118, margin });
    mobileBelowH = drawBusinessMobileBelowPdfLogo(doc, logoPlacement, getCalcBusinessMobileLineForPdf(pdfMode));
  }
  const logoBlockH = pdfLogoBlockHeight(logoPlacement, mobileBelowH);
  const lineY = logoMeta ? logoTop + logoBlockH + 14 : 58;

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

/** Valid-until date for invoice PDFs: DD/MM/YYYY from field, else next Saturday from invoice date. */
function getCalcDueDateForPdf() {
  return getCalcValidUntilDateForPdf(state.shopToday || clientShopTodayDMY());
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
  if (typeof doc.autoTable !== "function" && typeof jsPdfNs?.autoTable !== "function") {
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
  const blockTop = drawInvoicePdfHeaderBand(doc, { logoMeta, hdr, brandLine, margin, pageW, G, pdfMode: "proforma" });
  const billRaw = getCalcCustomerBillPdfText();
  const billLines = doc.splitTextToSize(billRaw === "—" ? " " : billRaw, 250);
  const leftBlockH = 14 + billLines.length * 12;
  const rightBlockH = 14 * 3;
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
  doc.text(`DATE: ${formatDateWithDayName(row.dateStr)}`, rightX, ry, { align: "right" });
  ry += 14;
  doc.text(`VALID UNTIL: ${calcValidUntilText(row.dateStr)}`, rightX, ry, { align: "right" });

  const desc = `${row.breed} DAY-OLD CHICKS`.replace(/\s+/g, " ").trim().toUpperCase();
  const tableBody = [[desc, String(row.qtyNum), `Ksh${formatKshPlainNumber(row.unitPrice)}`, `Ksh${formatKshPlainNumber(row.lineTotal)}`]];

  runPdfAutoTable(doc, jsPdfNs, {
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
  const summaryY = drawInvoicePaymentSummaryPdf(doc, {
    rightX,
    startY: finalY + 40,
    darkColor: G.dark,
    rows: [
      { label: "TOTAL AMOUNT", value: invoiceTotal },
      { label: "PAID AMOUNT", value: paidAmount },
      { label: "UNPAID BALANCE", value: unpaidBalance },
    ],
  });

  if (shouldIncludeCalcMpesaPaymentInPdf()) {
    let payY = summaryY + 20;
    const pageH = doc.internal.pageSize.getHeight();
    if (payY > pageH - 120) {
      doc.addPage();
      payY = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(14, 92, 58);
    doc.text("PAY WITH M-PESA", margin, payY);
    payY += 12;
    drawMpesaPaymentBlockPdf(doc, payY, { margin, tableW });
  }

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
  if (typeof doc.autoTable !== "function" && typeof jsPdfNs?.autoTable !== "function") {
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
    const logoPlacement = logoMeta
      ? addPdfLogoTopRight(doc, logoMeta, { top: calcLogoTop, maxWidth: 96, maxHeight: 96 })
      : null;
    const mobileBelowH = drawBusinessMobileBelowPdfLogo(
      doc,
      logoPlacement,
      getCalcBusinessMobileLineForPdf("calculator")
    );
    const calcLogoH = pdfLogoBlockHeight(logoPlacement, mobileBelowH);
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
    const duePdf = getCalcValidUntilDateForPdf(today);
    if (cname) {
      doc.text(`Customer: ${cname}`, 40, metaY);
      metaY += 14;
    }
    if (cmob) {
      doc.text(`Mobile: ${cmob}`, 40, metaY);
      metaY += 14;
    }
    doc.text(`Valid until: ${calcValidUntilText(today)}`, 40, metaY);
    metaY += 14;

    let tableStartY = metaY + 10;
    if (filledRows.length) {
      const head = [["Brand", "Feed Type", "Bag Size (kg)", "Number of bags", "Buying price (per bag)", "Total (purchase cost)"]];
      const body = filledRows.map((r) => [r.brand, r.feedType, r.bagSize, r.bags, r.buying, r.total]);
      runPdfAutoTable(doc, jsPdfNs, {
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
      runPdfAutoTable(doc, jsPdfNs, {
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
    footY += 22;
    if (shouldIncludeCalcMpesaPaymentInPdf()) {
      const pageH = doc.internal.pageSize.getHeight();
      if (footY > pageH - 120) {
        doc.addPage();
        footY = 50;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(14, 92, 58);
      doc.text("Payment details", 40, footY);
      footY += 14;
      drawMpesaPaymentBlockPdf(doc, footY, { margin: 40, tableW: doc.internal.pageSize.getWidth() - 80 });
    }
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
  const blockTop = drawInvoicePdfHeaderBand(doc, {
    logoMeta,
    hdr,
    brandLine,
    margin,
    pageW,
    G,
    pdfMode: isProforma ? "proforma" : "invoice",
  });
  const billRaw = getCalcCustomerBillPdfText();
  const billLines = doc.splitTextToSize(billRaw === "—" ? " " : billRaw, 250);
  const noLabel = isProforma ? "PROFORMA NO." : "INVOICE NO.";
  const leftBlockH = 14 + billLines.length * 12;
  const rightBlockH = 14 * 3;
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
  doc.text(`DATE: ${formatDateWithDayName(today)}`, rightX, ry, { align: "right" });
  ry += 14;
  doc.text(`VALID UNTIL: ${calcValidUntilText(today)}`, rightX, ry, { align: "right" });

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

  runPdfAutoTable(doc, jsPdfNs, {
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
  const summaryY = drawInvoicePaymentSummaryPdf(doc, {
    rightX,
    startY: totalsY + 14,
    darkColor: G.dark,
    rows: [
      { label: "TOTAL AMOUNT", value: invoiceTotal },
      { label: "PAID AMOUNT", value: paidAmount },
      { label: "UNPAID BALANCE", value: unpaidBalance },
    ],
  });

  if (shouldIncludeCalcMpesaPaymentInPdf()) {
    let payY = summaryY + 20;
    const pageH = doc.internal.pageSize.getHeight();
    if (payY > pageH - 120) {
      doc.addPage();
      payY = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...G.dark);
    doc.text("PAY WITH M-PESA", margin, payY);
    payY += 12;
    drawMpesaPaymentBlockPdf(doc, payY, { margin, tableW });
  }

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
document.getElementById("waterBillsClearBtn")?.addEventListener("click", resetWaterBillsForm);
document.getElementById("electricityBillsClearBtn")?.addEventListener("click", resetElectricityBillsForm);
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
  const payload = withActiveLotId({
    date: dateValue,
    description: String(document.getElementById("roseDescription")?.value || "").trim(),
    quantity: Number(document.getElementById("roseQuantity")?.value || 0),
    unit_price: Number(document.getElementById("roseUnitPrice")?.value || 0),
    money_in: Number(document.getElementById("roseMoneyIn")?.value || 0),
    money_out: Number(document.getElementById("roseMoneyOut")?.value || 0),
    mortality: Number(document.getElementById("roseMortality")?.value || 0),
    sale_via: String(document.getElementById("roseSaleVia")?.value || "Shop").trim(),
  });
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

document.getElementById("water-bills-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  let payload;
  try {
    payload = meterBillsPayloadFromForm("waterBills");
  } catch (err) {
    return alert(err.message);
  }
  try {
    if (state.editWaterBillsId) {
      await api(`/api/water-bills/${state.editWaterBillsId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/water-bills", { method: "POST", body: JSON.stringify(payload) });
    }
    resetWaterBillsForm();
    await loadAllData();
    suggestPreviousMeterForNewEntry("waterBills", state.waterBillsEntries, null);
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("electricity-bills-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  let payload;
  try {
    payload = meterBillsPayloadFromForm("electricityBills");
  } catch (err) {
    return alert(err.message);
  }
  try {
    if (state.editElectricityBillsId) {
      await api(`/api/electricity-bills/${state.editElectricityBillsId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/electricity-bills", { method: "POST", body: JSON.stringify(payload) });
    }
    resetElectricityBillsForm();
    await loadAllData();
    suggestPreviousMeterForNewEntry("electricityBills", state.electricityBillsEntries, null);
  } catch (error) {
    alert(error.message);
  }
});

hadifaAccountsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = hadifaAccDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  if (!state.activeCreditAccountId) return alert("No credit account selected.");
  const payload = {
    account_id: state.activeCreditAccountId,
    date: dateValue,
    description: String(document.getElementById("hadifaAccDescription")?.value || "").trim(),
    quantity: Number(document.getElementById("hadifaAccQuantity")?.value || 0),
    unit_price: Number(document.getElementById("hadifaAccUnitPrice")?.value || 0),
    money_in: Number(document.getElementById("hadifaAccMoneyIn")?.value || 0),
    money_out: Number(document.getElementById("hadifaAccMoneyOut")?.value || 0),
  };
  try {
    if (state.editHadifaAccountsId) {
      await api(`/api/credit-entries/${state.editHadifaAccountsId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/credit-entries", { method: "POST", body: JSON.stringify(payload) });
    }
    resetHadifaAccountsForm();
    await loadAllData();
    renderHadifaAccountsTable();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("hadifaAccClearBtn")?.addEventListener("click", () => resetHadifaAccountsForm());

/* Credit dashboard — show add-account form */
document.getElementById("showAddCreditAccountBtn")?.addEventListener("click", () => {
  document.getElementById("credit-new-account-form")?.classList.remove("hidden");
  document.getElementById("newCreditAccountName")?.focus();
});
document.getElementById("cancelAddCreditAccountBtn")?.addEventListener("click", () => {
  document.getElementById("credit-new-account-form")?.classList.add("hidden");
  const nameInput = document.getElementById("newCreditAccountName");
  if (nameInput) nameInput.value = "";
});
document.getElementById("credit-new-account-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = String(document.getElementById("newCreditAccountName")?.value || "").trim();
  if (!name) return;
  try {
    const result = await api("/api/credit-accounts", { method: "POST", body: JSON.stringify({ name }) });
    document.getElementById("credit-new-account-form")?.classList.add("hidden");
    const nameInput = document.getElementById("newCreditAccountName");
    if (nameInput) nameInput.value = "";
    await loadAllData();
    renderCreditDashboard();
    if (result?.id) openCreditAccount(result.id);
  } catch (err) {
    alert(err.message);
  }
});

/* Credit dashboard — open or delete account */
document.getElementById("credit-accounts-grid")?.addEventListener("click", async (event) => {
  const openBtn = event.target.closest("[data-kind='credit-acc-open']");
  if (openBtn) {
    openCreditAccount(openBtn.dataset.accountId);
    return;
  }
  const delBtn = event.target.closest("[data-kind='credit-acc-delete']");
  if (delBtn) {
    const accId = delBtn.dataset.accountId;
    const acc = (state.creditAccounts || []).find((a) => String(a.id) === String(accId));
    const name = acc?.name || "this account";
    if (!window.confirm(`Delete "${name}" and all its entries? This cannot be undone.`)) return;
    try {
      await api(`/api/credit-accounts/${accId}`, { method: "DELETE" });
      await loadAllData();
      renderCreditDashboard();
    } catch (err) {
      alert(err.message);
    }
  }
});

document.getElementById("creditBackBtn")?.addEventListener("click", () => {
  state.activeCreditAccountId = null;
  document.getElementById("hadifa-account-section")?.classList.add("hidden");
  document.getElementById("credit-dashboard")?.classList.remove("hidden");
  renderCreditDashboard();
});

faithSalesForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = faithSalesDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const numChickens = Number(document.getElementById("faithSalesNumChickens")?.value || 0);
  const pricePerChicken = Number(document.getElementById("faithSalesPricePerChicken")?.value || FAITH_SALES_DEFAULT_PRICE_PER_CHICKEN);
  const amountPaid = Number(document.getElementById("faithSalesAmountPaid")?.value || 0);
  if (!Number.isFinite(numChickens) || numChickens <= 0) return alert("Enter a valid number of chickens.");
  if (!Number.isFinite(pricePerChicken) || pricePerChicken < 0) return alert("Enter a valid price per chicken.");
  if (!Number.isFinite(amountPaid) || amountPaid < 0) return alert("Enter a valid amount paid.");
  const payload = withActiveLotId({
    date: dateValue,
    num_chickens: numChickens,
    price_per_chicken: pricePerChicken,
    description: String(document.getElementById("faithSalesDescription")?.value || "").trim(),
    amount_paid: amountPaid,
  });
  try {
    if (state.editFaithSalesId) {
      await api(`/api/faith-sales/${state.editFaithSalesId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/faith-sales", { method: "POST", body: JSON.stringify(payload) });
    }
    resetFaithSalesForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("faithSalesClearBtn")?.addEventListener("click", () => resetFaithSalesForm());

faithExpensesForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = faithExpDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = withActiveLotId({
    date: dateValue,
    description: String(document.getElementById("faithExpDescription")?.value || "").trim(),
    money_out: Number(document.getElementById("faithExpMoneyOut")?.value || 0),
  });
  if (!payload.description) return alert("Description is required.");
  try {
    if (state.editFaithExpensesId) {
      await api(`/api/faith-expenses/${state.editFaithExpensesId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/faith-expenses", { method: "POST", body: JSON.stringify(payload) });
    }
    resetFaithExpensesForm();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("faithExpClearBtn")?.addEventListener("click", () => resetFaithExpensesForm());

nahashonForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = nahashonDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = withActiveLotId({
    date: dateValue,
    description: String(document.getElementById("nahashonDescription")?.value || "").trim(),
    quantity: Number(document.getElementById("nahashonQuantity")?.value || 0),
    unit_price: Number(document.getElementById("nahashonUnitPrice")?.value || 0),
    money_in: Number(document.getElementById("nahashonMoneyIn")?.value || 0),
    money_out: Number(document.getElementById("nahashonMoneyOut")?.value || 0),
    mortality: Number(document.getElementById("nahashonMortality")?.value || 0),
    sale_via: String(document.getElementById("nahashonSaleVia")?.value || "Shop").trim(),
  });
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

weighBridgeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = weighBridgeDateDisplay?.value?.trim() || "";
  if (!isValidDMY(dateValue)) return alert("Date must be in DD/MM/YYYY format.");
  const payload = {
    date: dateValue,
    description: String(document.getElementById("weighBridgeDescription")?.value || "").trim(),
    qty: parseMoneyFromInput(document.getElementById("weighBridgeQty")?.value) || 0,
    amount: parseMoneyFromInput(document.getElementById("weighBridgeAmount")?.value) || 0,
    ufaray_ksh: parseMoneyFromInput(document.getElementById("weighBridgeUfarayKsh")?.value) || 0,
    amana_ksh: parseMoneyFromInput(document.getElementById("weighBridgeAmanaKsh")?.value) || 0,
  };
  try {
    if (state.editWeighBridgeId) {
      await api(`/api/weigh-bridge/${state.editWeighBridgeId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/weigh-bridge", { method: "POST", body: JSON.stringify(payload) });
    }
    resetWeighBridgeForm();
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
    const fb2 = String(chFeedBrand2?.value || "").trim();
    const ft2 = String(chFeedType2?.value || "").trim();
    const fbags2 = Math.floor(Number(chFeedBagQty2?.value ?? 0));
    if (Number.isFinite(fbags2) && fbags2 < 0) {
      alert("Feed 2 quantity (bags) must be a whole number zero or greater.");
      return;
    }
    payload.feed_brand2 = fb2 || "";
    payload.feed_type2 = ft2 || "";
    payload.feed_bag_qty2 = Number.isFinite(fbags2) && fbags2 > 0 ? fbags2 : 0;
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
      feed_brand2: String(row.feed_brand2 || "").trim(),
      feed_type2: String(row.feed_type2 || "").trim(),
      feed_bag_qty2:
        row.feed_bag_qty2 != null && row.feed_bag_qty2 !== ""
          ? Math.floor(Number(row.feed_bag_qty2))
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
          if (chFeedBrand2) {
            populateBrandSelect(chFeedBrand2);
            const bk2 = row.feed_brand2 ? resolveBrandKey(String(row.feed_brand2)) : "";
            if (bk2 && [...chFeedBrand2.options].some((o) => o.value === bk2)) chFeedBrand2.value = bk2;
            else if (row.feed_brand2) chFeedBrand2.value = String(row.feed_brand2);
            populateChChickenFeedTypes2(chFeedBrand2.value);
            if (chFeedType2 && row.feed_type2) {
              const want2 = feedTypeCatalogValue(resolveBrandKey(chFeedBrand2.value), String(row.feed_type2));
              if ([...chFeedType2.options].some((o) => o.value === want2)) chFeedType2.value = want2;
              else if ([...chFeedType2.options].some((o) => o.value === row.feed_type2)) chFeedType2.value = String(row.feed_type2);
            }
            if (chFeedBagQty2) {
              chFeedBagQty2.value =
                row.feed_bag_qty2 != null && row.feed_bag_qty2 !== "" ? String(Math.floor(Number(row.feed_bag_qty2))) : "0";
            }
            syncChEmployeeBundledFeedAmount2();
          }
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

document.getElementById("loan-repayment-body")?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "loan") return;
  if (!loanRepaymentTenantEnabled()) return;
  const row = (state.loanRepayments || []).find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.loanRepaymentPreview = null;
    populateLoanRepaymentForm(row);
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this loan repayment? The balance for that month will be updated.")) return;
    try {
      await api(`/api/loan-repayments/${id}`, { method: "DELETE" });
      state.loanRepaymentPreview = null;
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

document.getElementById("water-bills-body")?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "water-bills") return;
  const row = state.waterBillsEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editWaterBillsId = row.id;
    fillMeterBillsFormFromRow("waterBills", row);
    const saveBtn = document.getElementById("waterBillsSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/water-bills/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

document.getElementById("electricity-bills-body")?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "electricity-bills") return;
  const row = state.electricityBillsEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editElectricityBillsId = row.id;
    fillMeterBillsFormFromRow("electricityBills", row);
    const saveBtn = document.getElementById("electricityBillsSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/electricity-bills/${id}`, { method: "DELETE" });
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

hadifaAccountsBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "hadifa-acc") return;
  const allEntries = state.creditEntries || state.hadifalAccountsEntries || [];
  const row = allEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editHadifaAccountsId = row.id;
    if (hadifaAccDate) hadifaAccDate.value = toIsoDate(row.date);
    if (hadifaAccDateDisplay) hadifaAccDateDisplay.value = formatDateDMY(row.date);
    const desc = document.getElementById("hadifaAccDescription");
    const qty = document.getElementById("hadifaAccQuantity");
    const unit = document.getElementById("hadifaAccUnitPrice");
    const min = document.getElementById("hadifaAccMoneyIn");
    const mout = document.getElementById("hadifaAccMoneyOut");
    if (desc) desc.value = row.description || "";
    if (qty) qty.value = row.quantity ?? 0;
    if (unit) unit.value = row.unit_price ?? 0;
    if (min) min.value = row.money_in ?? 0;
    if (mout) mout.value = row.money_out ?? 0;
    const saveBtn = document.getElementById("hadifaAccSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/credit-entries/${id}`, { method: "DELETE" });
      await loadAllData();
      renderHadifaAccountsTable();
    } catch (error) {
      alert(error.message);
    }
  }
});

faithSalesBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "faith-sale") return;
  const row = (state.faithSalesEntries || []).find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editFaithSalesId = row.id;
    if (faithSalesDate) faithSalesDate.value = toIsoDate(row.date);
    if (faithSalesDateDisplay) faithSalesDateDisplay.value = formatDateDMY(row.date);
    const numEl = document.getElementById("faithSalesNumChickens");
    const priceEl = document.getElementById("faithSalesPricePerChicken");
    const descEl = document.getElementById("faithSalesDescription");
    const paidEl = document.getElementById("faithSalesAmountPaid");
    if (numEl) numEl.value = row.num_chickens ?? 0;
    if (priceEl) priceEl.value = row.price_per_chicken ?? FAITH_SALES_DEFAULT_PRICE_PER_CHICKEN;
    if (descEl) descEl.value = row.description || "";
    if (paidEl) paidEl.value = row.amount_paid ?? 0;
    updateFaithSalesFormCalc();
    const saveBtn = document.getElementById("faithSalesSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this sale?")) return;
    try {
      await api(`/api/faith-sales/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

faithExpensesBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "faith-exp") return;
  const row = (state.faithExpensesEntries || []).find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editFaithExpensesId = row.id;
    if (faithExpDate) faithExpDate.value = toIsoDate(row.date);
    if (faithExpDateDisplay) faithExpDateDisplay.value = formatDateDMY(row.date);
    const desc = document.getElementById("faithExpDescription");
    const out = document.getElementById("faithExpMoneyOut");
    if (desc) desc.value = row.description || "";
    if (out) out.value = row.money_out ?? 0;
    const saveBtn = document.getElementById("faithExpSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/faith-expenses/${id}`, { method: "DELETE" });
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

weighBridgeBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const kind = target.dataset.kind;
  if (!id || !action || kind !== "weigh-bridge") return;
  const row = state.weighBridgeEntries.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editWeighBridgeId = row.id;
    if (weighBridgeDate) weighBridgeDate.value = toIsoDate(row.date);
    if (weighBridgeDateDisplay) weighBridgeDateDisplay.value = formatDateDMY(row.date);
    const descEl = document.getElementById("weighBridgeDescription");
    const qtyEl = document.getElementById("weighBridgeQty");
    const amountEl = document.getElementById("weighBridgeAmount");
    const ufarayKshEl = document.getElementById("weighBridgeUfarayKsh");
    const amanaKshEl = document.getElementById("weighBridgeAmanaKsh");
    if (descEl) descEl.value = row.description || "";
    if (qtyEl) qtyEl.value = formatMoneyForInput(row.qty ?? 0);
    if (amountEl) amountEl.value = formatMoneyForInput(row.amount ?? 0);
    if (ufarayKshEl) ufarayKshEl.value = formatMoneyForInput(row.ufaray_ksh ?? 0);
    if (amanaKshEl) amanaKshEl.value = formatMoneyForInput(row.amana_ksh ?? 0);
    const saveBtn = document.getElementById("weighBridgeSaveBtn");
    if (saveBtn) saveBtn.textContent = "Update entry";
    document.getElementById("page-weigh-bridge")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api(`/api/weigh-bridge/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

document.getElementById("inventoryLotSelect")?.addEventListener("change", (event) => {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : "";
  if (value) onActiveLotChange(value);
});

document.getElementById("inventoryLotAddBtn")?.addEventListener("click", () => {
  document.getElementById("inventoryLotNewWrap")?.classList.remove("hidden");
  document.getElementById("inventoryLotNewName")?.focus();
});

document.getElementById("inventoryLotCancelNewBtn")?.addEventListener("click", () => {
  document.getElementById("inventoryLotNewWrap")?.classList.add("hidden");
  const nameInput = document.getElementById("inventoryLotNewName");
  if (nameInput) nameInput.value = "";
});

document.getElementById("meterBillRecipientSelect")?.addEventListener("change", (event) => {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : "";
  if (value) onActiveMeterBillRecipientChange(value);
});

document.getElementById("meterBillRecipientAddBtn")?.addEventListener("click", () => {
  document.getElementById("meterBillRecipientNewWrap")?.classList.remove("hidden");
  document.getElementById("meterBillRecipientNewName")?.focus();
});

document.getElementById("meterBillRecipientCancelNewBtn")?.addEventListener("click", () => {
  document.getElementById("meterBillRecipientNewWrap")?.classList.add("hidden");
  const nameInput = document.getElementById("meterBillRecipientNewName");
  if (nameInput) nameInput.value = "";
});

document.getElementById("meterBillRecipientSaveNewBtn")?.addEventListener("click", async () => {
  const name = String(document.getElementById("meterBillRecipientNewName")?.value || "").trim();
  if (!name) return alert("Enter a name.");
  try {
    const result = await api("/api/meter-bill-recipients", { method: "POST", body: JSON.stringify({ name }) });
    document.getElementById("meterBillRecipientNewWrap")?.classList.add("hidden");
    const nameInput = document.getElementById("meterBillRecipientNewName");
    if (nameInput) nameInput.value = "";
    await loadMeterBillRecipients();
    if (result?.id) await onActiveMeterBillRecipientChange(result.id);
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("inventoryLotSaveNewBtn")?.addEventListener("click", async () => {
  const name = String(document.getElementById("inventoryLotNewName")?.value || "").trim();
  if (!name) return alert("Enter a lot name.");
  try {
    const result = await api("/api/inventory-lots", { method: "POST", body: JSON.stringify({ name }) });
    document.getElementById("inventoryLotNewWrap")?.classList.add("hidden");
    const nameInput = document.getElementById("inventoryLotNewName");
    if (nameInput) nameInput.value = "";
    await loadInventoryLots();
    if (result?.id) await onActiveLotChange(result.id);
  } catch (error) {
    alert(error.message);
  }
});

preventWheelOnNumberInputs();
boot();
