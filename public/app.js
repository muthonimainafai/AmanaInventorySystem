const state = {
  token: localStorage.getItem("amanaToken") || "",
  user: JSON.parse(localStorage.getItem("amanaUser") || "null"),
  catalog: {},
  records: [],
  editId: null,
  salesBags: [],
  salesKg: [],
  chickenSales: [],
  editSalesBagId: null,
  editSalesKgId: null,
  editChickenId: null,
  currentPage: "inventory",
  /** Cumulative feed profit for the shop calendar day (from API). */
  todayFeedProfit: 0,
  /** DD/MM/YYYY shop “today” (Africa/Nairobi on server; client mirrors for display). */
  shopToday: "",
  /** From GET /api/inventory/selling-prices (employees): lines ordered by id DESC, same as server stock lookup. */
  inventoryPricing: [],
};

const PAGE_HEADINGS = {
  inventory: "Feed Inventory",
  "sales-bags": "Sales Per Bags",
  "sales-kg": "Sales Per Kg",
  chicken: "Chicken Sales",
};

const loginCard = document.getElementById("loginCard");
const appCard = document.getElementById("appCard");
const loginForm = document.getElementById("loginForm");
const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");
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

const chickenForm = document.getElementById("chicken-form");
const chickenBody = document.getElementById("chicken-body");
const chDateDisplay = document.getElementById("chDateDisplay");
const chDate = document.getElementById("chDate");
const chOpenCalendarBtn = document.getElementById("chOpenCalendarBtn");

const clearMySalesBtn = document.getElementById("clearMySalesBtn");

let refreshTimer = null;
let catalogInitialized = false;

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
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
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

function persistAuth() {
  localStorage.setItem("amanaToken", state.token);
  localStorage.setItem("amanaUser", JSON.stringify(state.user));
}

function clearAuth() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("amanaToken");
  localStorage.removeItem("amanaUser");
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
  const val = currency(state.todayFeedProfit);
  document.querySelectorAll(".js-today-profit-value").forEach((el) => {
    el.textContent = val;
  });
  const meta = state.shopToday
    ? `Shop day ${state.shopToday}. Example: if the margin on a line is KES 150 and you sell 1 bag, this shows 150; after two more bags on the same line it shows 450. Mixed products use each line’s margin. Refreshes when you save a sale (and every few seconds).`
    : "";
  document.querySelectorAll(".js-today-profit-meta").forEach((el) => {
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

const EMPLOYEE_SALE_EDIT_MS = 60 * 60 * 1000;

/** Employees may only edit a sale within 1 hour of when it was recorded (`created_at` / fallback `updated_at`). */
function saleWithinEmployeeEditWindow(row) {
  const iso = row.created_at || row.updated_at;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= EMPLOYEE_SALE_EDIT_MS;
}

function showLoggedOut() {
  loginCard.classList.remove("hidden");
  appCard.classList.add("hidden");
}

function showLoggedIn() {
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
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
    const shouldShow = isOwner ? page === "inventory" : page !== "inventory";
    btn.classList.toggle("hidden", !shouldShow);
  });
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
  const bagKg = bagSizeFor(skBrand.value, skFeedType.value);
  const sp = findInventorySellingPrice(skBrand.value, skFeedType.value, bagKg);
  const el = document.getElementById("skPricePerKg");
  if (sp != null && bagKg > 0) {
    const perKg = sp / bagKg;
    el.value = Number.isFinite(perKg) ? perKg.toFixed(2) : "";
  } else el.value = "";
}

function applyEmployeeFeedSalePricingUi() {
  const isEmployee = state.user?.role === "employee";
  const sb = document.getElementById("sbPricePerBag");
  const sk = document.getElementById("skPricePerKg");
  if (sb) {
    sb.readOnly = !!isEmployee;
    sb.title = isEmployee
      ? "Matches the selling price per bag from Feed Inventory for this product."
      : "";
  }
  if (sk) {
    sk.readOnly = !!isEmployee;
    sk.title = isEmployee
      ? "Per kg = selling price per bag ÷ bag size (kg), from Feed Inventory."
      : "";
  }
  if (isEmployee) {
    applyEmployeeSalesBagPriceFromInventory();
    applyEmployeeSalesKgPriceFromInventory();
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

function renderTable() {
  if (!state.records.length) {
    tableBody.innerHTML = '<tr><td colspan="14" class="empty">No records.</td></tr>';
    return;
  }

  tableBody.innerHTML = state.records
    .map((row) => {
      const canDelete = state.user.role === "owner";
      const lineToday = currency(row.today_profit ?? 0);
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
        <td>${lineToday}</td>
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
    })
    .join("");
}

function renderSalesBagsTable() {
  if (!state.salesBags.length) {
    salesBagsBody.innerHTML = '<tr><td colspan="9" class="empty">No sales.</td></tr>';
    return;
  }
  const canDelete = state.user.role === "owner";
  const shopDay = state.shopToday || clientShopTodayDMY();
  salesBagsBody.innerHTML = state.salesBags
    .map((row) => {
      const canEdit =
        state.user.role === "owner" ||
        (saleDateOnOrAfterShopDay(row.date, shopDay) && saleWithinEmployeeEditWindow(row));
      return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td>${row.bag_size} kg</td>
        <td>${row.bags_sold}</td>
        <td>${currency(row.price_per_bag)}</td>
        <td>${currency(saleLineTotalBags(row))}</td>
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
    })
    .join("");
}

function renderSalesKgTable() {
  if (!state.salesKg.length) {
    salesKgBody.innerHTML = '<tr><td colspan="9" class="empty">No sales.</td></tr>';
    return;
  }
  const canDelete = state.user.role === "owner";
  const shopDay = state.shopToday || clientShopTodayDMY();
  salesKgBody.innerHTML = state.salesKg
    .map((row) => {
      const canEdit =
        state.user.role === "owner" ||
        (saleDateOnOrAfterShopDay(row.date, shopDay) && saleWithinEmployeeEditWindow(row));
      return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${displayBrand(row.brand)}</td>
        <td>${displayFeedType(row.feed_type)}</td>
        <td>${row.bags_sold || 0}</td>
        <td>${row.kg_sold}</td>
        <td>${currency(row.price_per_kg)}</td>
        <td>${currency(saleLineTotalKg(row))}</td>
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
    })
    .join("");
}

function renderChickenTable() {
  if (!state.chickenSales.length) {
    chickenBody.innerHTML = '<tr><td colspan="8" class="empty">No sales.</td></tr>';
    return;
  }
  const canDelete = state.user.role === "owner";
  const shopDay = state.shopToday || clientShopTodayDMY();
  chickenBody.innerHTML = state.chickenSales
    .map((row) => {
      const canEdit =
        state.user.role === "owner" ||
        (saleDateOnOrAfterShopDay(row.date, shopDay) && saleWithinEmployeeEditWindow(row));
      return `
      <tr>
        <td>${formatDateDMY(row.date)}</td>
        <td>${row.description}</td>
        <td>${row.quantity_birds}</td>
        <td>${row.weight_kg != null ? row.weight_kg : "—"}</td>
        <td>${currency(row.unit_price)}</td>
        <td>${currency(saleLineTotalChicken(row))}</td>
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
    })
    .join("");
}

function resetSalesBagForm() {
  salesBagsForm.reset();
  state.editSalesBagId = null;
  sbDateDisplay.value = "";
  sbFeedType.innerHTML = '<option value="">Select feed type</option>';
  sbFeedType.disabled = true;
  sbBagSize.value = "";
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
  document.getElementById("skSaveBtn").textContent = "Save sale";
  applyEmployeeSalesDateRules();
  applyEmployeeFeedSalePricingUi();
}

function resetChickenForm() {
  chickenForm.reset();
  state.editChickenId = null;
  chDateDisplay.value = "";
  document.getElementById("chSaveBtn").textContent = "Save sale";
  applyEmployeeSalesDateRules();
}

function showPage(page) {
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
  if (page === "sales-bags" || page === "sales-kg" || page === "chicken") {
    applyEmployeeSalesDateRules();
    applyEmployeeFeedSalePricingUi();
  }
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
  document.getElementById("accumulatedProfit").value = row.today_profit ?? 0;
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
  try {
    return await api("/api/catalog");
  } catch {
    const res = await fetch("/feedCatalog.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load feed catalog. Check that the server is running.");
    return res.json();
  }
}

async function loadAllData() {
  state.catalog = await loadCatalogFromServer();

  const mustFillBrandDropdowns =
    !catalogInitialized ||
    brandSelect.options.length <= 1 ||
    sbBrand.options.length <= 1 ||
    skBrand.options.length <= 1;
  if (mustFillBrandDropdowns && Object.keys(state.catalog || {}).length > 0) {
    populateBrands();
    populateBrandSelect(sbBrand);
    populateBrandSelect(skBrand);
    catalogInitialized = true;
  }

  const secondary =
    state.user.role === "owner"
      ? [
          api("/api/inventory"),
          api("/api/sales/bags"),
          api("/api/sales/kg"),
          api("/api/chicken-sales"),
          api("/api/sales/today-profit"),
        ]
      : [
          api("/api/inventory/selling-prices"),
          api("/api/sales/bags"),
          api("/api/sales/kg"),
          api("/api/chicken-sales"),
          api("/api/sales/today-profit"),
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
  const profitPayload =
    outcomes[o].status === "fulfilled" ? outcomes[o].value : { totalProfit: 0, today: "" };
  state.todayFeedProfit = Number(profitPayload.totalProfit ?? 0);
  state.shopToday = profitPayload.today || "";
  updateTodayProfitDisplay();
  renderTable();
  renderSalesBagsTable();
  renderSalesKgTable();
  renderChickenTable();
  applyEmployeeFeedSalePricingUi();
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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    state.token = result.token;
    state.user = result.user;
    persistAuth();
    showLoggedIn();
    showPage(state.user.role === "owner" ? "inventory" : "sales-bags");
    await loadAllData();
    applyEmployeeSalesDateRules();
    applyEmployeeFeedSalePricingUi();
    startAutoRefresh();
    loginForm.reset();
  } catch (error) {
    alert(error.message);
  }
});

logoutBtn.addEventListener("click", () => {
  clearAuth();
  stopAutoRefresh();
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
  if (!state.token || !state.user) {
    stopAutoRefresh();
    showLoggedOut();
    return;
  }
  try {
    showLoggedIn();
    showPage(state.user.role === "owner" ? "inventory" : "sales-bags");
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
    if (state.user.role === "owner" && btn.dataset.page !== "inventory") return;
    if (state.user.role !== "owner" && btn.dataset.page === "inventory") return;
    showPage(btn.dataset.page);
  });
});

sbBrand.addEventListener("change", () => {
  populateSbFeedTypes(sbBrand.value);
  document.getElementById("sbPricePerBag").value = "";
  applyEmployeeSalesBagPriceFromInventory();
});
sbFeedType.addEventListener("change", () => {
  sbBagSize.value = bagSizeFor(sbBrand.value, sbFeedType.value);
  applyEmployeeSalesBagPriceFromInventory();
});
wireDatePicker(sbDateDisplay, sbDate, sbOpenCalendarBtn);

skBrand.addEventListener("change", () => {
  populateSkFeedTypes(skBrand.value);
  document.getElementById("skPricePerKg").value = "";
  applyEmployeeSalesKgPriceFromInventory();
});
skFeedType.addEventListener("change", () => {
  applyEmployeeSalesKgPriceFromInventory();
});
wireDatePicker(skDateDisplay, skDate, skOpenCalendarBtn);

wireDatePicker(chDateDisplay, chDate, chOpenCalendarBtn);

document.getElementById("sbClearBtn").addEventListener("click", resetSalesBagForm);
document.getElementById("skClearBtn").addEventListener("click", resetSalesKgForm);
document.getElementById("chClearBtn").addEventListener("click", resetChickenForm);

clearMySalesBtn?.addEventListener("click", async () => {
  if (!state.user || !state.token) return;
  if (state.user.role !== "employee") return;
  if (!window.confirm("Clear sales created by this employee? This will also reverse the stock changes.")) return;
  const btn = clearMySalesBtn;
  btn.disabled = true;
  try {
    await api("/api/testing/clear-my-sales", { method: "POST" });
    await loadAllData();
    applyEmployeeSalesDateRules();
  } catch (error) {
    alert(error.message);
  } finally {
    btn.disabled = false;
  }
});

salesBagsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateValue = sbDateDisplay.value.trim();
  if (!isValidDMY(dateValue)) {
    alert("Date must be in DD/MM/YYYY format.");
    return;
  }
  const payload = {
    date: dateValue,
    brand: sbBrand.value,
    feed_type: sbFeedType.value,
    bag_size: Number(sbBagSize.value || 0),
    bags_sold: Number(document.getElementById("sbBagsSold").value || 0),
    price_per_bag: Number(document.getElementById("sbPricePerBag").value || 0),
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
    bags_sold: Number(document.getElementById("skBagsSold").value || 0),
    kg_sold: Number(document.getElementById("skKgSold").value || 0),
    price_per_kg: Number(document.getElementById("skPricePerKg").value || 0),
  };
  const saveBtn = document.getElementById("skSaveBtn");
  saveBtn.disabled = true;
  try {
    if (state.editSalesKgId) {
      await api(`/api/sales/kg/${state.editSalesKgId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/sales/kg", { method: "POST", body: JSON.stringify(payload) });
    }
    resetSalesKgForm();
    await loadAllData();
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
  const w = document.getElementById("chWeightKg").value;
  const payload = {
    date: dateValue,
    description: document.getElementById("chDescription").value.trim(),
    quantity_birds: Number(document.getElementById("chQuantity").value || 0),
    weight_kg: w === "" ? null : Number(w),
    unit_price: Number(document.getElementById("chUnitPrice").value || 0),
  };
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
  if (action === "edit") {
    state.editSalesBagId = row.id;
    sbDate.value = toIsoDate(row.date);
    sbDateDisplay.value = formatDateDMY(row.date);
    sbBrand.value = row.brand;
    populateSbFeedTypes(row.brand);
    sbFeedType.value = row.feed_type;
    sbBagSize.value = row.bag_size;
    document.getElementById("sbBagsSold").value = row.bags_sold;
    if (state.user.role === "employee") applyEmployeeSalesBagPriceFromInventory();
    else document.getElementById("sbPricePerBag").value = row.price_per_bag;
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
    document.getElementById("skBagsSold").value = row.bags_sold || 0;
    document.getElementById("skKgSold").value = row.kg_sold;
    if (state.user.role === "employee") applyEmployeeSalesKgPriceFromInventory();
    else document.getElementById("skPricePerKg").value = row.price_per_kg;
    document.getElementById("skSaveBtn").textContent = "Update sale";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this sale?")) return;
    try {
      await api(`/api/sales/kg/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

chickenBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (!id || !action || target.dataset.kind !== "chicken") return;
  const row = state.chickenSales.find((r) => String(r.id) === String(id));
  if (!row) return;
  if (action === "edit") {
    state.editChickenId = row.id;
    chDate.value = toIsoDate(row.date);
    chDateDisplay.value = formatDateDMY(row.date);
    document.getElementById("chDescription").value = row.description;
    document.getElementById("chQuantity").value = row.quantity_birds;
    document.getElementById("chWeightKg").value = row.weight_kg != null ? row.weight_kg : "";
    document.getElementById("chUnitPrice").value = row.unit_price;
    document.getElementById("chSaveBtn").textContent = "Update sale";
    return;
  }
  if (action === "delete") {
    if (!window.confirm("Delete this sale?")) return;
    try {
      await api(`/api/chicken-sales/${id}`, { method: "DELETE" });
      await loadAllData();
    } catch (error) {
      alert(error.message);
    }
  }
});

boot();
