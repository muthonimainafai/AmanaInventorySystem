const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { AsyncLocalStorage } = require("async_hooks");

/** Load `/.env` into process.env (no extra npm package). */
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  let text = fs.readFileSync(envPath, "utf8");
  text = text.replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!key) continue;
    const fromFile = key.startsWith("AMANA_") || key.startsWith("VEHICLE_") || key === "JWT_SECRET";
    if (fromFile || process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "amana-inventory-secret-change-me";

/** First-time login accounts (only created when the users table is empty). Override via .env — see env.example */
const AMANA_OWNER_USERNAME = String(process.env.AMANA_OWNER_USERNAME || "owner").trim() || "owner";
const AMANA_OWNER_PASSWORD = String(process.env.AMANA_OWNER_PASSWORD || "Owner@123");
const AMANA_OWNER_FULL_NAME = String(process.env.AMANA_OWNER_FULL_NAME || "Shop Owner").trim() || "Shop Owner";
const AMANA_EMPLOYEE_USERNAME = String(process.env.AMANA_EMPLOYEE_USERNAME || "employee").trim() || "employee";
const AMANA_EMPLOYEE_PASSWORD = String(process.env.AMANA_EMPLOYEE_PASSWORD || "Employee@123");
const AMANA_EMPLOYEE_FULL_NAME = String(process.env.AMANA_EMPLOYEE_FULL_NAME || "Shop Employee").trim() || "Shop Employee";
const VEHICLE_ADMIN_USERNAME = String(process.env.VEHICLE_ADMIN_USERNAME || "vehicleadmin").trim() || "vehicleadmin";
const VEHICLE_ADMIN_PASSWORD = String(process.env.VEHICLE_ADMIN_PASSWORD || "VehicleAdmin@123");
const VEHICLE_ADMIN_FULL_NAME = String(process.env.VEHICLE_ADMIN_FULL_NAME || "Vehicle Admin").trim() || "Vehicle Admin";

const tenantContext = new AsyncLocalStorage();
const dbByTenant = new Map();
const dbInitDone = new Set();
const dbInitInFlight = new Map();

function normalizeAppTenant(value) {
  return String(value || "amana").trim().toLowerCase() === "ufaray" ? "ufaray" : "amana";
}

function activeTenant() {
  return normalizeAppTenant(tenantContext.getStore()?.tenant);
}

function dbFileNameForTenant(tenant) {
  const t = normalizeAppTenant(tenant);
  return t === "ufaray" ? "inventory-ufaray.db" : "inventory.db";
}

function ensureDb(tenantOverride) {
  const tenant = normalizeAppTenant(tenantOverride || activeTenant());
  const cached = dbByTenant.get(tenant);
  if (cached) return cached;
  const dataDir = process.env.AMANA_DATA_DIR || path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, dbFileNameForTenant(tenant));
  const db = new sqlite3.Database(dbPath);
  dbByTenant.set(tenant, db);
  return db;
}

function runInTenantContext(tenant, fn) {
  const normalized = normalizeAppTenant(tenant);
  return new Promise((resolve, reject) => {
    tenantContext.run({ tenant: normalized }, () => {
      Promise.resolve()
        .then(fn)
        .then(resolve, reject);
    });
  });
}

async function ensureTenantInitialized(tenant) {
  const normalized = normalizeAppTenant(tenant);
  if (dbInitDone.has(normalized)) return;
  if (dbInitInFlight.has(normalized)) {
    await dbInitInFlight.get(normalized);
    return;
  }
  const initPromise = runInTenantContext(normalized, async () => {
    ensureDb(normalized);
    await initDb();
    dbInitDone.add(normalized);
  });
  dbInitInFlight.set(normalized, initPromise);
  try {
    await initPromise;
  } finally {
    dbInitInFlight.delete(normalized);
  }
}

/** Brand / feed types / bag sizes — single source (original Amana Kuku Feeds specification). */
const feedCatalog = require("./feedCatalog.json");

const FEEDERS_DRINKERS_CATALOG = [
  { name: "Drinker 10L", item_type: "drinker", capacity_liters: 10 },
  { name: "Drinker 5L", item_type: "drinker", capacity_liters: 5 },
  { name: "Drinker 3L", item_type: "drinker", capacity_liters: 3 },
  { name: "Drinker 1L", item_type: "drinker", capacity_liters: 1 },
  { name: "Drinker 0.75L", item_type: "drinker", capacity_liters: 0.75 },
  { name: "Feeder trough (Metal)", item_type: "feeder", capacity_liters: null },
  { name: "Feeder round big (Metal)", item_type: "feeder", capacity_liters: null },
  { name: "Feeder round small (Metal)", item_type: "feeder", capacity_liters: null },
  { name: "Feeder round big (Plastic)", item_type: "feeder", capacity_liters: null },
  { name: "Feeding trough (Plastic)", item_type: "feeder", capacity_liters: null },
  { name: "Jiko Big", item_type: "feeder", capacity_liters: null },
];

const MEDICAMENTS_CATALOG = [
  "Chick start 100g",
  "Chick start 500g",
  "Chick start 1kg",
  "Booster 100g",
  "Booster 500g",
  "Booster 1kg",
  "Paraffin 100ml",
  "Paraffin 250ml",
  "Jiko small",
];

function normalizeInventoryItemName(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveFeederDrinkerItem(name) {
  const n = normalizeInventoryItemName(name);
  return FEEDERS_DRINKERS_CATALOG.find((i) => normalizeInventoryItemName(i.name) === n) || null;
}

function resolveMedicamentItem(name) {
  const n = normalizeInventoryItemName(name);
  return MEDICAMENTS_CATALOG.find((i) => normalizeInventoryItemName(i) === n) || null;
}

/** Day-old chick brands — buying/selling per chick and margins are tracked in `chicken_breeds`. Override via `public/chickenBreeds.json` (array of strings). */
function loadChickenBreedsList() {
  const defaultBreeds = ["Irvines", "Supreme", "Isinya", "Silverland", "Kenchick", "Jumbo", "Suguna"];
  try {
    const p = path.join(__dirname, "public", "chickenBreeds.json");
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Array.isArray(raw) && raw.length) {
        return raw.map((x) => String(x || "").trim()).filter(Boolean);
      }
    }
  } catch (_e) {
    // eslint-disable-next-line no-console
    console.warn("Could not read public/chickenBreeds.json; using default breed list.");
  }
  return defaultBreeds;
}

function normalizeChickenBreed(name) {
  const s = String(name || "").trim();
  if (!s) return null;
  return loadChickenBreedsList().includes(s) ? s : null;
}

/** Absolute paths for static + SPA (avoids sendFile NotFoundError on Windows / packaged apps). */
const PUBLIC_DIR = path.resolve(__dirname, "public");
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  return next();
});
/** Static files are registered after all API routes (see bottom of file) so /api/* always hits JSON routes first. */

app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api") || req.path.startsWith("/api/vehicle/")) return next();
  const tenant = normalizeAppTenant(req.headers["x-app-instance"]);
  req.appTenant = tenant;
  try {
    await ensureTenantInitialized(tenant);
  } catch (error) {
    return next(error);
  }
  return tenantContext.run({ tenant }, () => next());
});

function run(sql, params = []) {
  const database = ensureDb();
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  const database = ensureDb();
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  const database = ensureDb();
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

/** Inserts any missing rows for configured breeds (idempotent). Call after migrations and before reads. */
async function ensureChickenBreedsSeeded() {
  const breedSeedNow = new Date().toISOString();
  for (const b of loadChickenBreedsList()) {
    await run(
      `INSERT OR IGNORE INTO chicken_breeds (breed, buying_price, selling_price, profit_margin_per_chick, accumulated_profit, updated_at)
       VALUES (?, 0, 0, 0, 0, ?)`,
      [b, breedSeedNow]
    );
  }
}

/** One-time: accumulated_profit = total profit from bags recorded as sold (historical sales × current margin). */
async function migrateAccumulatedProfitFromSalesIfNeeded() {
  const row = await get("SELECT value FROM app_meta WHERE key = ?", ["accumulated_profit_v2"]);
  if (row?.value === "1") return;
  const invRows = await all("SELECT * FROM inventory");
  for (const inv of invRows) {
    const margin = Number(inv.profit_margin_per_bag) || 0;
    const sb = await get(
      `SELECT COALESCE(SUM(bags_sold), 0) AS t FROM sales_bags
       WHERE brand = ? AND feed_type = ? AND bag_size = ?
       AND (through_party IS NULL OR TRIM(COALESCE(through_party, '')) = '')`,
      [inv.brand, inv.feed_type, inv.bag_size]
    );
    const sk = await get(
      `SELECT COALESCE(SUM(bags_sold), 0) AS t FROM sales_kg
       WHERE brand = ? AND feed_type = ?`,
      [inv.brand, inv.feed_type]
    );
    const totalBagsSold = Number(sb.t) + Number(sk.t);
    const acc = totalBagsSold * margin;
    await run(`UPDATE inventory SET accumulated_profit = ? WHERE id = ?`, [acc, inv.id]);
  }
  await run(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, ["accumulated_profit_v2", "1"]);
}

/** Owner inventory lines must not carry margin_snap; profit is attributed only on staff sales. Idempotent. */
async function zeroOwnerChickenSaleMarginSnaps() {
  await run(
    `UPDATE chicken_sales SET margin_snap = 0
     WHERE created_by IN (SELECT username FROM users WHERE role = 'owner')`
  );
}

async function syncVehicleUsersFromEnv() {
  const admin = await get("SELECT id FROM vehicle_users WHERE role = ? ORDER BY id LIMIT 1", ["admin"]);
  if (admin) {
    const hash = await bcrypt.hash(VEHICLE_ADMIN_PASSWORD, 10);
    await run("UPDATE vehicle_users SET username = ?, full_name = ?, password_hash = ? WHERE id = ?", [
      VEHICLE_ADMIN_USERNAME,
      VEHICLE_ADMIN_FULL_NAME,
      hash,
      admin.id,
    ]);
  }
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','employee')),
      full_name TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS vehicle_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','staff')),
      full_name TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS vehicle_kax_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      money_in REAL NOT NULL DEFAULT 0,
      money_out REAL NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      brand TEXT NOT NULL,
      feed_type TEXT NOT NULL,
      bag_size INTEGER NOT NULL,
      quantity_in_stock INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      buying_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      total_stock INTEGER NOT NULL,
      reorder_level INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sales_bags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      brand TEXT NOT NULL,
      feed_type TEXT NOT NULL,
      bag_size INTEGER NOT NULL,
      bags_sold INTEGER NOT NULL,
      price_per_bag REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sales_kg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      brand TEXT NOT NULL,
      feed_type TEXT NOT NULL,
      bags_sold INTEGER NOT NULL DEFAULT 0,
      kg_sold REAL NOT NULL,
      price_per_kg REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run("ALTER TABLE sales_kg ADD COLUMN bags_sold INTEGER NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE sales_bags ADD COLUMN through_party TEXT").catch(() => {});
  await run("ALTER TABLE sales_bags ADD COLUMN pass_through_status TEXT").catch(() => {});
  await run("ALTER TABLE sales_bags ADD COLUMN created_at TEXT").catch(() => {});
  await run("ALTER TABLE sales_kg ADD COLUMN created_at TEXT").catch(() => {});
  await run(`UPDATE sales_bags SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''`).catch(() => {});
  await run(`UPDATE sales_kg SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''`).catch(() => {});
  await run("ALTER TABLE sales_kg ADD COLUMN bag_opened INTEGER NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE sales_kg ADD COLUMN retail_margin_per_kg REAL").catch(() => {});
  await run("ALTER TABLE sales_kg ADD COLUMN through_party TEXT").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS retail_feed_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      feed_type TEXT NOT NULL,
      bag_size INTEGER NOT NULL,
      price_per_kg REAL NOT NULL,
      profit_margin_per_kg REAL NOT NULL DEFAULT 0,
      accumulated_profit REAL NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(brand, feed_type)
    )
  `);
  await run("ALTER TABLE retail_feed_pricing ADD COLUMN weight_kg REAL").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS chicken_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity_birds INTEGER NOT NULL,
      weight_kg REAL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run("ALTER TABLE chicken_sales ADD COLUMN created_at TEXT").catch(() => {});
  await run(`UPDATE chicken_sales SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''`).catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS chicken_breeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      breed TEXT NOT NULL UNIQUE,
      buying_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      profit_margin_per_chick REAL NOT NULL DEFAULT 0,
      accumulated_profit REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `);
  await ensureChickenBreedsSeeded();
  await run("ALTER TABLE chicken_sales ADD COLUMN breed TEXT").catch(() => {});
  await run("ALTER TABLE chicken_sales ADD COLUMN margin_snap REAL").catch(() => {});
  await run("ALTER TABLE chicken_sales ADD COLUMN customer_name TEXT").catch(() => {});
  await run("ALTER TABLE chicken_sales ADD COLUMN customer_phone TEXT").catch(() => {});
  await run("ALTER TABLE chicken_sales ADD COLUMN money_paid REAL").catch(() => {});
  await run("ALTER TABLE chicken_sales ADD COLUMN payment_status TEXT").catch(() => {});
  await run("ALTER TABLE chicken_sales ADD COLUMN through_party TEXT").catch(() => {});

  await run("ALTER TABLE inventory ADD COLUMN profit_margin_per_bag REAL NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE inventory ADD COLUMN accumulated_profit REAL NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE inventory ADD COLUMN accumulated_bags INTEGER NOT NULL DEFAULT 0").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feeders_drinkers_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('feeder','drinker')),
      capacity_liters REAL,
      quantity_in_stock INTEGER NOT NULL,
      accumulated_stock INTEGER NOT NULL DEFAULT 0,
      buying_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      profit_margin REAL NOT NULL DEFAULT 0,
      accumulated_profit REAL NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS medicaments_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity_in_stock INTEGER NOT NULL,
      accumulated_stock INTEGER NOT NULL DEFAULT 0,
      buying_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      profit_margin REAL NOT NULL DEFAULT 0,
      accumulated_profit REAL NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run("ALTER TABLE feeders_drinkers_inventory ADD COLUMN profit_margin REAL NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE feeders_drinkers_inventory ADD COLUMN accumulated_stock INTEGER NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE feeders_drinkers_inventory ADD COLUMN accumulated_profit REAL NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE medicaments_inventory ADD COLUMN profit_margin REAL NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE medicaments_inventory ADD COLUMN accumulated_stock INTEGER NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE medicaments_inventory ADD COLUMN accumulated_profit REAL NOT NULL DEFAULT 0").catch(() => {});
  await run(
    "UPDATE feeders_drinkers_inventory SET accumulated_stock = quantity_in_stock WHERE COALESCE(accumulated_stock, 0) = 0"
  ).catch(() => {});
  await run("ALTER TABLE feeders_drinkers_sales ADD COLUMN through_party TEXT").catch(() => {});
  await run(
    "UPDATE medicaments_inventory SET accumulated_stock = quantity_in_stock WHERE COALESCE(accumulated_stock, 0) = 0"
  ).catch(() => {});
  await run("ALTER TABLE medicaments_sales ADD COLUMN through_party TEXT").catch(() => {});
  await run(`
    CREATE TABLE IF NOT EXISTS feeders_drinkers_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity_sold INTEGER NOT NULL,
      price_per_item REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS medicaments_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity_sold INTEGER NOT NULL,
      price_per_item REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS gas_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      size_kg REAL NOT NULL,
      quantity_in_stock INTEGER NOT NULL,
      accumulated_stock INTEGER NOT NULL DEFAULT 0,
      buying_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      profit_margin REAL NOT NULL DEFAULT 0,
      accumulated_profit REAL NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS gas_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      size_kg REAL NOT NULL,
      quantity_sold INTEGER NOT NULL,
      price_per_item REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run(
    "UPDATE gas_inventory SET accumulated_stock = quantity_in_stock WHERE COALESCE(accumulated_stock, 0) = 0"
  ).catch(() => {});
  await run("ALTER TABLE gas_sales ADD COLUMN through_party TEXT").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS employee_expenditure (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      money_out REAL NOT NULL,
      total REAL NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const accBagsMigrated = await get("SELECT value FROM app_meta WHERE key = ?", ["accumulated_bags_v1"]);
  if (!accBagsMigrated || accBagsMigrated.value !== "1") {
    await run(`UPDATE inventory SET accumulated_bags = quantity_in_stock`);
    await run(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, ["accumulated_bags_v1", "1"]);
  }

  const ufarayStockFixV1 = await get("SELECT value FROM app_meta WHERE key = ?", ["ufaray_stock_fix_v1"]);
  if (!ufarayStockFixV1 || ufarayStockFixV1.value !== "1") {
    const passRows = await all(
      `SELECT brand, feed_type, bag_size, COALESCE(SUM(bags_sold), 0) AS t
       FROM sales_bags
       WHERE through_party IS NOT NULL AND TRIM(COALESCE(through_party, '')) <> ''
       GROUP BY brand, feed_type, bag_size`
    );
    const passMap = new Map();
    for (const r of passRows) {
      passMap.set(inventoryProfitKey(r.brand, r.feed_type, r.bag_size), Number(r.t) || 0);
    }
    const invRows = await all("SELECT id, brand, feed_type, bag_size, quantity_in_stock, COALESCE(accumulated_bags, 0) AS accumulated_bags FROM inventory");
    for (const row of invRows) {
      const key = inventoryProfitKey(row.brand, row.feed_type, row.bag_size);
      const pass = Number(passMap.get(key) || 0);
      const qty = Math.max(0, Number(row.quantity_in_stock || 0));
      let acc = Math.max(0, Number(row.accumulated_bags || 0), qty);
      const soldAccounted = Math.max(0, acc - qty);
      const missingPassDeduction = Math.max(0, pass - soldAccounted);
      const nextQty = Math.max(0, qty - missingPassDeduction);
      acc = Math.max(acc, nextQty);
      if (nextQty !== qty || acc !== Number(row.accumulated_bags || 0)) {
        await run(
          "UPDATE inventory SET quantity_in_stock = ?, total_stock = ?, accumulated_bags = ?, updated_at = ? WHERE id = ?",
          [nextQty, nextQty * Number(row.bag_size || 0), acc, new Date().toISOString(), row.id]
        );
      }
    }
    await run(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, ["ufaray_stock_fix_v1", "1"]);
  }

  const dolaLayersRenamed = await get("SELECT value FROM app_meta WHERE key = ?", ["dola_layers_feed_types_v1"]);
  if (!dolaLayersRenamed || dolaLayersRenamed.value !== "1") {
    const dolaBrand = "Dola Feeds";
    const tables = ["inventory", "sales_bags", "sales_kg", "retail_feed_pricing"];
    for (const t of tables) {
      await run(
        `UPDATE ${t} SET feed_type = ? WHERE brand = ? AND bag_size = 10 AND LOWER(TRIM(feed_type)) = 'layers'`,
        ["Layers 10kg", dolaBrand]
      ).catch(() => {});
      await run(
        `UPDATE ${t} SET feed_type = ? WHERE brand = ? AND bag_size = 20 AND LOWER(TRIM(feed_type)) = 'layers bag'`,
        ["Layers 20kg", dolaBrand]
      ).catch(() => {});
    }
    await run(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, ["dola_layers_feed_types_v1", "1"]);
  }

  await migrateAccumulatedProfitFromSalesIfNeeded();

  const anyUser = await get("SELECT id FROM users LIMIT 1");
  if (!anyUser) {
    if (AMANA_OWNER_USERNAME.toLowerCase() === AMANA_EMPLOYEE_USERNAME.toLowerCase()) {
      throw new Error(
        "AMANA_OWNER_USERNAME and AMANA_EMPLOYEE_USERNAME must differ. Fix your .env and restart."
      );
    }
    if (AMANA_OWNER_PASSWORD.length < 8 || AMANA_EMPLOYEE_PASSWORD.length < 8) {
      // eslint-disable-next-line no-console
      console.warn(
        "[amana] AMANA_OWNER_PASSWORD and AMANA_EMPLOYEE_PASSWORD should be at least 8 characters. Using configured values anyway."
      );
    }
    const ownerHash = await bcrypt.hash(AMANA_OWNER_PASSWORD, 10);
    const employeeHash = await bcrypt.hash(AMANA_EMPLOYEE_PASSWORD, 10);
    await run(
      "INSERT INTO users (username, password_hash, role, full_name) VALUES (?,?,?,?)",
      [AMANA_OWNER_USERNAME, ownerHash, "owner", AMANA_OWNER_FULL_NAME]
    );
    await run(
      "INSERT INTO users (username, password_hash, role, full_name) VALUES (?,?,?,?)",
      [AMANA_EMPLOYEE_USERNAME, employeeHash, "employee", AMANA_EMPLOYEE_FULL_NAME]
    );
    // eslint-disable-next-line no-console
    console.log(
      `[amana] Created default users: owner “${AMANA_OWNER_USERNAME}”, staff “${AMANA_EMPLOYEE_USERNAME}”. Set AMANA_* in .env for your own credentials (new databases only).`
    );
  } else {
    await syncLoginUsersFromEnv();
  }
  const anyVehicleUser = await get("SELECT id FROM vehicle_users LIMIT 1");
  if (!anyVehicleUser) {
    const adminHash = await bcrypt.hash(VEHICLE_ADMIN_PASSWORD, 10);
    await run(
      "INSERT INTO vehicle_users (username, password_hash, role, full_name) VALUES (?,?,?,?)",
      [VEHICLE_ADMIN_USERNAME, adminHash, "admin", VEHICLE_ADMIN_FULL_NAME]
    );
  } else {
    await syncVehicleUsersFromEnv();
  }
  await run("DELETE FROM vehicle_users WHERE role = 'staff'");
  await zeroOwnerChickenSaleMarginSnaps();
  await migrateChickenBreedAccumulatedProfitClearedOnlyV1();
}

/** One-time: align per-breed accumulated_profit with delivered/cleared staff sales only (pending no longer counts). */
async function migrateChickenBreedAccumulatedProfitClearedOnlyV1() {
  await run(
    `CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY)`
  ).catch(() => {});
  const done = await get("SELECT id FROM app_migrations WHERE id = ?", ["chicken_profit_cleared_only_v1"]);
  if (done) return;
  const clearedCond = `LOWER(TRIM(COALESCE(cs.payment_status, 'pending'))) IN ('delivered','cleared')`;
  const breeds = await all("SELECT breed FROM chicken_breeds");
  const nowIso = new Date().toISOString();
  for (const { breed } of breeds) {
    const sumRow = await get(
      `SELECT COALESCE(SUM(cs.quantity_birds * COALESCE(cs.margin_snap, 0)), 0) AS s
       FROM chicken_sales cs
       INNER JOIN users u ON u.username = cs.created_by AND u.role = 'employee'
       WHERE cs.breed = ? AND ${clearedCond}`,
      [breed]
    );
    const sum = Number(sumRow?.s) || 0;
    await run(`UPDATE chicken_breeds SET accumulated_profit = ?, updated_at = ? WHERE breed = ?`, [
      sum,
      nowIso,
      breed,
    ]);
  }
  await run("INSERT INTO app_migrations (id) VALUES (?)", ["chicken_profit_cleared_only_v1"]);
}

const CREATED_BY_TABLES = [
  "inventory",
  "sales_bags",
  "sales_kg",
  "retail_feed_pricing",
  "chicken_sales",
  "gas_inventory",
  "gas_sales",
  "employee_expenditure",
];

async function renameCreatedByEverywhere(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  for (const t of CREATED_BY_TABLES) {
    await run(`UPDATE ${t} SET created_by = ? WHERE created_by = ?`, [newName, oldName]);
  }
}

/** Sync .env into existing DB rows by role (owner / employee), including username renames from legacy defaults. */
async function syncLoginUsersFromEnv() {
  const owner = await get("SELECT id, username FROM users WHERE role = ? ORDER BY id LIMIT 1", ["owner"]);
  if (owner) {
    await renameCreatedByEverywhere(owner.username, AMANA_OWNER_USERNAME);
    const hash = await bcrypt.hash(AMANA_OWNER_PASSWORD, 10);
    await run("UPDATE users SET username = ?, full_name = ?, password_hash = ? WHERE id = ?", [
      AMANA_OWNER_USERNAME,
      AMANA_OWNER_FULL_NAME,
      hash,
      owner.id,
    ]);
  }
  const employee = await get("SELECT id, username FROM users WHERE role = ? ORDER BY id LIMIT 1", ["employee"]);
  if (employee) {
    await renameCreatedByEverywhere(employee.username, AMANA_EMPLOYEE_USERNAME);
    const hash = await bcrypt.hash(AMANA_EMPLOYEE_PASSWORD, 10);
    await run("UPDATE users SET username = ?, full_name = ?, password_hash = ? WHERE id = ?", [
      AMANA_EMPLOYEE_USERNAME,
      AMANA_EMPLOYEE_FULL_NAME,
      hash,
      employee.id,
    ]);
  }
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function vehicleAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.vehicleUser = jwt.verify(token, JWT_SECRET);
    if (req.vehicleUser?.module !== "vehicle") {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

function validateFeed(brand, feedType, bagSize) {
  const items = feedCatalog[resolveBrandKey(brand)];
  if (!items) return false;
  return items.some((i) => normalizeFeedType(i.type) === normalizeFeedType(feedType) && i.bagSize === Number(bagSize));
}

function normalizeBrand(name) {
  return String(name || "").toLowerCase().replace(/\s+feeds$/, "").trim();
}

function normalizeFeedType(name) {
  return String(name || "").toLowerCase().replace(/\s+bags?$/, "").trim();
}

function resolveBrandKey(brand) {
  const target = normalizeBrand(brand);
  return Object.keys(feedCatalog).find((b) => normalizeBrand(b) === target) || brand;
}

/** Shop calendar day for sales-date checks and reporting (Kenya default). Override with AMANA_TZ. */
const AMANA_TZ = process.env.AMANA_TZ || "Africa/Nairobi";

function todayDMY() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: AMANA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

/** Parses DD/MM/YYYY; returns { y, m, d } or null. */
function parseSaleDateDMY(dateStr) {
  const s = String(dateStr || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function compareCalendarDates(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

/** Canonical DD/MM/YYYY for inventory date storage and same-day merge lookup (avoids duplicate rows when padding differs). */
function normalizeInventoryDate(dateStr) {
  const p = parseSaleDateDMY(String(dateStr || "").trim());
  if (!p) return null;
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

function inventoryProfitKey(brand, feedType, bagSize) {
  return `${normalizeBrand(brand)}|${normalizeFeedType(feedType)}|${Number(bagSize)}`;
}

/** Pass-through / agent bag sales (e.g. By Ufaray): stock reduces, total at cost, no margin in inventory profit. */
function normalizeThroughParty(val) {
  const s = String(val ?? "").trim();
  return s === "" ? null : s;
}

function normalizePassThroughStatus(val) {
  const s = String(val || "").trim().toLowerCase();
  return s === "solved" ? "solved" : "pending";
}

function isThroughPartyBagSaleRow(row) {
  return normalizeThroughParty(row?.through_party) != null;
}

/** Bag size (kg) for a feed line from the catalog — used for kg sales and “bags sold from kg”. */
function catalogBagSizeForFeed(brandKey, feedType) {
  const items = feedCatalog[resolveBrandKey(brandKey)];
  if (!items) return 50;
  const found = items.find((i) => normalizeFeedType(i.type) === normalizeFeedType(feedType));
  return Number(found?.bagSize) || 50;
}

/** Whole bags represented by a running total of kg sold (e.g. 50 kg → 1 when bag size is 50). */
function bagsFromTotalKg(totalKg, bagSize) {
  const bs = Number(bagSize) || 50;
  if (bs <= 0) return 0;
  return Math.floor(Number(totalKg) / bs);
}

/** Map key: resolved brand + normalized feed type → optional owner kg per opened bag (retail_feed_pricing.weight_kg). */
async function getRetailWeightKgByKeyMap() {
  const rfRows = await all("SELECT brand, feed_type, weight_kg FROM retail_feed_pricing");
  const m = new Map();
  for (const r of rfRows) {
    const bk = resolveBrandKey(r.brand);
    const key = `${bk}|${normalizeFeedType(r.feed_type)}`;
    const w = r.weight_kg == null || r.weight_kg === "" ? null : Number(r.weight_kg);
    if (Number.isFinite(w) && w > 0) m.set(key, w);
  }
  return m;
}

function effectiveKgPerOpenedBagForDisplay(weightMap, brandKey, feedType) {
  const key = `${resolveBrandKey(brandKey)}|${normalizeFeedType(feedType)}`;
  const w = weightMap.get(key);
  const catalog = catalogBagSizeForFeed(brandKey, feedType);
  if (w != null && w > 0) return w;
  return catalog;
}

/** Sum of kg_sold for the same calendar line (date + brand + feed), optionally excluding one row. */
async function sumKgSoldForSalesKgLine(dateStr, brandKey, feedType, excludeId) {
  let sql =
    "SELECT COALESCE(SUM(kg_sold), 0) AS t FROM sales_kg WHERE date = ? AND brand = ? AND feed_type = ?";
  const params = [String(dateStr).trim(), brandKey, feedType];
  if (excludeId != null && Number.isFinite(Number(excludeId))) {
    sql += " AND id != ?";
    params.push(Number(excludeId));
  }
  const row = await get(sql, params);
  return Number(row?.t) || 0;
}

/** One accumulating kg line per employee per calendar day per product (brand + feed). */
async function getEmployeeConsolidatedSalesKgRow(dateStr, brandKey, feedType, createdBy) {
  return await get(
    `SELECT * FROM sales_kg WHERE date = ? AND brand = ? AND feed_type = ? AND created_by = ? ORDER BY id ASC LIMIT 1`,
    [String(dateStr).trim(), brandKey, feedType, createdBy]
  );
}

/** Kg still available from opened bags after all sales strictly before `dateCanon` (same brand + feed). */
function remainingKgCarryoverBeforeSaleDateWithMap(dateCanonNorm, brandKey, rawFeedType, allBrandRows, wm) {
  const targetP = parseSaleDateDMY(String(dateCanonNorm || "").trim());
  if (!targetP) return 0;
  const ftN = normalizeFeedType(rawFeedType);
  const bagSize = effectiveKgPerOpenedBagForDisplay(wm, brandKey, rawFeedType);
  if (!Number.isFinite(bagSize) || bagSize <= 0) return 0;
  const filtered = [];
  for (const r of allBrandRows) {
    if (resolveBrandKey(r.brand) !== brandKey) continue;
    if (normalizeFeedType(r.feed_type) !== ftN) continue;
    const rd = parseSaleDateDMY(String(r.date || "").trim());
    if (!rd) continue;
    if (compareCalendarDates(rd, targetP) >= 0) continue;
    filtered.push(r);
  }
  filtered.sort((a, b) => {
    const da = parseSaleDateDMY(String(a.date || "").trim());
    const db = parseSaleDateDMY(String(b.date || "").trim());
    if (da && db) {
      const c = compareCalendarDates(da, db);
      if (c !== 0) return c;
    } else if (da && !db) return -1;
    else if (!da && db) return 1;
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

/** Sum bag_opened for this product on the same calendar day (all users), optional exclude row id. */
async function sumBagOpenedTodayForProduct(brandKey, rawFeedType, dateCanonNorm, excludeId) {
  const rows = await all("SELECT id, date, feed_type, bag_opened FROM sales_kg WHERE brand = ?", [brandKey]);
  const ftN = normalizeFeedType(rawFeedType);
  let sum = 0;
  for (const r of rows) {
    if (normalizeInventoryDate(r.date) !== dateCanonNorm) continue;
    if (normalizeFeedType(r.feed_type) !== ftN) continue;
    if (excludeId != null && Number(r.id) === Number(excludeId)) continue;
    sum += Number(r.bag_opened || 0);
  }
  return sum;
}

function enrichSalesKgRowsWithCumulative(rows, weightMap) {
  const wm = weightMap || new Map();
  const byProduct = new Map();
  for (const r of rows) {
    const bk = resolveBrandKey(r.brand);
    const key = `${bk}|${normalizeFeedType(r.feed_type)}`;
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(r);
  }

  const idToExtra = new Map();

  for (const [, productRows] of byProduct) {
    const sortedChrono = [...productRows].sort((a, b) => {
      const da = parseSaleDateDMY(String(a.date || "").trim());
      const db = parseSaleDateDMY(String(b.date || "").trim());
      if (da && db) {
        const c = compareCalendarDates(da, db);
        if (c !== 0) return c;
      } else if (da && !db) return -1;
      else if (!da && db) return 1;
      return Number(a.id) - Number(b.id);
    });

    const bk0 = resolveBrandKey(sortedChrono[0].brand);
    const bagSize = effectiveKgPerOpenedBagForDisplay(wm, bk0, sortedChrono[0].feed_type);

    const byDay = new Map();
    for (const r of productRows) {
      const d = normalizeInventoryDate(r.date) || String(r.date || "").trim();
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(r);
    }

    let pool = 0;
    for (const r of sortedChrono) {
      const sold = Number(r.kg_sold || 0);
      if (sold > pool) {
        const autoOpen = Math.ceil((sold - pool) / bagSize);
        pool += autoOpen * bagSize;
      }
      pool -= sold;
      if (pool < 0) pool = 0;

      const d = normalizeInventoryDate(r.date) || String(r.date || "").trim();
      const dayRows = [...(byDay.get(d) || [])].sort((a, b) => Number(a.id) - Number(b.id));
      const totalKgForDay = dayRows.reduce((s, row) => s + Number(row.kg_sold || 0), 0);
      const bagsSoldCumGroup = bagsFromTotalKg(totalKgForDay, bagSize);
      const totalBagsOpenedSumDay = dayRows.reduce((s, row) => s + Number(row.bag_opened || 0), 0);
      const bagOpenedDisplay = totalBagsOpenedSumDay >= 1 ? 1 : 0;

      idToExtra.set(Number(r.id), {
        bags_sold_cumulative: bagsSoldCumGroup,
        bag_opened_display: bagOpenedDisplay,
        total_kgs_remaining: pool,
      });
    }
  }

  return rows.map((r) => {
    const extra = idToExtra.get(Number(r.id)) || {
      bags_sold_cumulative: 0,
      bag_opened_display: 0,
      total_kgs_remaining: 0,
    };
    return { ...r, ...extra };
  });
}

/** Adds delta (can be negative) to retail_feed_pricing.accumulated_profit for this product line. */
async function adjustRetailAccumulatedProfitDelta(brandKey, feedType, profitDelta) {
  const rf = await getRetailFeedLine(brandKey, feedType);
  if (!rf) return;
  const now = new Date().toISOString();
  await run(
    `UPDATE retail_feed_pricing SET accumulated_profit = accumulated_profit + ?, updated_at = ? WHERE id = ?`,
    [Number(profitDelta) || 0, now, rf.id]
  );
}

const EMPLOYEE_SALE_EDIT_WINDOW_MS = 60 * 60 * 1000;
/** Sales Per Bags only: staff may edit or delete their own rows within this window after `created_at`. */
const EMPLOYEE_BAG_SALE_EDIT_WINDOW_MS = 4 * 60 * 60 * 1000;
/** Sales Per Kg: staff may DELETE their own rows within this window after `created_at` (PUT still uses 1h). */
const EMPLOYEE_KG_SALE_DELETE_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * Employees may only change a sale within the allowed window after first record (`created_at`).
 * Bag PUT: `EMPLOYEE_BAG_SALE_EDIT_WINDOW_MS` (4h). Kg PUT: default 1h. Kg DELETE: `EMPLOYEE_KG_SALE_DELETE_WINDOW_MS` (4h). Chicken exempt.
 */
function assertEmployeeSaleEditAllowed(req, res, saleRow, editWindowMs) {
  if (req.user.role !== "employee") return true;
  const windowMs =
    Number.isFinite(editWindowMs) && editWindowMs > 0 ? editWindowMs : EMPLOYEE_SALE_EDIT_WINDOW_MS;
  const hours = windowMs / (60 * 60 * 1000);
  const hoursLabel = Number.isInteger(hours) ? `${hours} hour${hours === 1 ? "" : "s"}` : `${hours.toFixed(1)} hours`;
  const createdIso = saleRow.created_at || saleRow.updated_at;
  if (!createdIso) {
    res.status(403).json({
      error: `Employees can only change a sale within ${hoursLabel} of when it was recorded (record time is missing). Ask the owner.`,
    });
    return false;
  }
  const createdMs = new Date(createdIso).getTime();
  if (!Number.isFinite(createdMs)) {
    res.status(403).json({
      error: `Employees can only change a sale within ${hoursLabel} of when it was recorded. Ask the owner.`,
    });
    return false;
  }
  if (Date.now() - createdMs > windowMs) {
    res.status(403).json({
      error: `This sale can no longer be edited or deleted (${hoursLabel} after it was recorded). Ask the owner if a change is needed.`,
    });
    return false;
  }
  return true;
}

/** Inventory rows (owner) vs staff sales (employee) are separate; only the matching role may edit. */
async function assertChickenSaleRowMatchesActor(req, res, saleRow) {
  const u = await get("SELECT role FROM users WHERE username = ?", [saleRow.created_by]);
  const creatorRole = u?.role;
  if (creatorRole !== "owner" && creatorRole !== "employee") {
    res.status(403).json({ error: "Cannot access this record." });
    return false;
  }
  if (req.user.role === "owner" && creatorRole !== "owner") {
    res.status(403).json({ error: "You can only edit your own chicks-in-shop inventory records." });
    return false;
  }
  if (req.user.role === "employee" && creatorRole !== "employee") {
    res.status(403).json({ error: "You can only edit staff chick sales." });
    return false;
  }
  return true;
}

/** Employees may set the sale date, but not to a calendar day before the current shop day (real time). */
function employeeSaleDateAllowed(req, res, dateStr) {
  if (req.user.role !== "employee") return true;
  const sale = parseSaleDateDMY(dateStr);
  if (!sale) {
    res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
    return false;
  }
  const today = parseSaleDateDMY(todayDMY());
  if (!today) return true;
  if (compareCalendarDates(sale, today) < 0) {
    res.status(400).json({
      error: "Sales cannot be recorded for a day that has already passed. Use today's date or a later day.",
    });
    return false;
  }
  return true;
}

/**
 * Per inventory line (brand + feed + bag size): cumulative profit from shop Sales Per Bags only
 * (SUM(bags_sold) × current margin). Rows with through_party set (e.g. By Ufaray) are excluded. Kg sales excluded.
 */
async function cumulativeBagSalesProfitByInventoryLines() {
  const invRows = await all("SELECT brand, feed_type, bag_size, profit_margin_per_bag FROM inventory");
  const marginMap = new Map();
  for (const inv of invRows) {
    marginMap.set(inventoryProfitKey(inv.brand, inv.feed_type, inv.bag_size), Number(inv.profit_margin_per_bag) || 0);
  }
  const sbRows = await all(
    `SELECT brand, feed_type, bag_size, bags_sold FROM sales_bags
     WHERE through_party IS NULL OR TRIM(COALESCE(through_party, '')) = ''`
  );
  const bagTotalsByKey = new Map();
  for (const row of sbRows) {
    const key = inventoryProfitKey(row.brand, row.feed_type, row.bag_size);
    const add = Number(row.bags_sold) || 0;
    bagTotalsByKey.set(key, (bagTotalsByKey.get(key) || 0) + add);
  }
  const profits = new Map();
  for (const [key, totalBags] of bagTotalsByKey) {
    const m = marginMap.get(key);
    if (m != null) {
      profits.set(key, (Number(totalBags) || 0) * m);
    }
  }
  return profits;
}

/** All-time bags sold as pass-through / agent sales (e.g. By Ufaray) per inventory line key. */
async function passThroughBagTotalsByInventoryLines() {
  const sbRows = await all("SELECT brand, feed_type, bag_size, bags_sold, through_party FROM sales_bags");
  const totals = new Map();
  for (const row of sbRows) {
    if (!isThroughPartyBagSaleRow(row)) continue;
    const key = inventoryProfitKey(row.brand, row.feed_type, row.bag_size);
    const add = Number(row.bags_sold) || 0;
    totals.set(key, (totals.get(key) || 0) + add);
  }
  return totals;
}

/** Sum of cumulative bag-sales profit across all inventory lines (for Feed Inventory highlight). */
async function computeCumulativeFeedBagSalesProfit() {
  const lineMap = await cumulativeBagSalesProfitByInventoryLines();
  let total = 0;
  for (const v of lineMap.values()) total += v;
  const today = todayDMY();
  return { totalProfit: total, today, timeZone: AMANA_TZ };
}

/** Cumulative retail kg profit (sum of per-line accumulated_profit; grows with each staff sale, not reset by day). */
async function computeCumulativeRetailKgProfit() {
  const row = await get(`SELECT COALESCE(SUM(accumulated_profit), 0) AS total FROM retail_feed_pricing`);
  const totalProfit = Number(row?.total) || 0;
  const today = todayDMY();
  return { totalProfit, today, timeZone: AMANA_TZ };
}

/** All inventory rows for this product (same brand, feed, bag size), oldest first — used to aggregate stock and sell FIFO. */
async function getInventoryRowsForProduct(brand, feedType, bagSize) {
  const rows = await all(
    `SELECT * FROM inventory
     WHERE bag_size = ?
     ORDER BY id ASC`,
    [Number(bagSize)]
  );
  return rows.filter(
    (r) =>
      normalizeBrand(r.brand) === normalizeBrand(brand) &&
      normalizeFeedType(r.feed_type) === normalizeFeedType(feedType)
  );
}

/** Newest row for this product (pricing / primary metadata). */
async function getInventoryItem(brand, feedType, bagSize) {
  const rows = await getInventoryRowsForProduct(brand, feedType, bagSize);
  return rows.length ? rows[rows.length - 1] : null;
}

/** Inventory lines saved on this same calendar date with matching brand, feed type, and bag size (for owner merge on new save). Dates are compared in canonical form. */
async function findInventoryRowsSameDayProduct(dateStr, brand, feedType, bagSize) {
  const targetDay = normalizeInventoryDate(dateStr);
  if (!targetDay) return [];
  const bs = Number(bagSize);
  const rows = await all(
    `SELECT * FROM inventory WHERE bag_size = ? ORDER BY id ASC`,
    [bs]
  );
  return rows.filter(
    (r) =>
      normalizeInventoryDate(r.date) === targetDay &&
      normalizeBrand(r.brand) === normalizeBrand(brand) &&
      normalizeFeedType(r.feed_type) === normalizeFeedType(feedType)
  );
}

const PRICE_MATCH_EPS = 0.015;

function salePriceMatchesInventory(expected, submitted) {
  const e = Number(expected);
  const s = Number(submitted);
  if (!Number.isFinite(e) || !Number.isFinite(s)) return false;
  return Math.abs(e - s) <= PRICE_MATCH_EPS;
}

/** Owner-defined retail kg price/margin for a catalog line (one row per brand + feed). */
async function getRetailFeedLine(brandKey, feedType) {
  const canonFeed =
    (feedCatalog[resolveBrandKey(brandKey)] || []).find(
      (i) => normalizeFeedType(i.type) === normalizeFeedType(feedType)
    )?.type || feedType;
  return await get("SELECT * FROM retail_feed_pricing WHERE brand = ? AND feed_type = ?", [
    resolveBrandKey(brandKey),
    canonFeed,
  ]);
}

async function adjustRetailAccumulatedProfit(brandKey, feedType, deltaProfit) {
  const rf = await getRetailFeedLine(brandKey, feedType);
  if (!rf) return;
  const now = new Date().toISOString();
  await run(
    `UPDATE retail_feed_pricing SET accumulated_profit = COALESCE(accumulated_profit, 0) + ?, updated_at = ? WHERE id = ?`,
    [Number(deltaProfit) || 0, now, rf.id]
  );
}

/** Employees must use the owner’s selling price from inventory (bags: per bag; kg: retail price if set, else per kg from Feed Inventory). */
async function assertEmployeeFeedSalePrices(req, res, mode, p) {
  if (req.user.role !== "employee") return true;
  if (normalizeThroughParty(p.through_party) != null) return true;
  const brandKey = resolveBrandKey(p.brand);
  const items = feedCatalog[brandKey];
  const defaultBagSize =
    items?.find((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))?.bagSize || 50;
  const item =
    mode === "bags"
      ? await getInventoryItem(brandKey, p.feed_type, Number(p.bag_size))
      : await getInventoryItem(brandKey, p.feed_type, defaultBagSize);
  if (!item) {
    res.status(400).json({
      error: "No inventory record for this product. The owner must add it under Feed Inventory first.",
    });
    return false;
  }
  const selling = Number(item.selling_price);
  const bagKg = Number(item.bag_size) || Number(defaultBagSize);
  if (mode === "bags") {
    if (!salePriceMatchesInventory(selling, p.price_per_bag)) {
      res.status(400).json({
        error: "Price per bag must match the selling price set by the owner in Feed Inventory for this product.",
      });
      return false;
    }
    return true;
  }
  if (mode === "kg") {
    if (bagKg <= 0) {
      res.status(400).json({ error: "Invalid bag size for this product in inventory." });
      return false;
    }
    const rf = await getRetailFeedLine(brandKey, p.feed_type);
    if (rf) {
      if (!salePriceMatchesInventory(Number(rf.price_per_kg), p.price_per_kg)) {
        res.status(400).json({
          error:
            "Price per kg must match the owner’s retail price set under Retail Feed Inventory for this product.",
        });
        return false;
      }
      return true;
    }
    const expectedPerKg = selling / bagKg;
    if (!salePriceMatchesInventory(expectedPerKg, p.price_per_kg)) {
      res.status(400).json({
        error:
          "Price per kg must match the owner’s selling price divided by bag size (kg) for this product in Feed Inventory.",
      });
      return false;
    }
    return true;
  }
  return true;
}

async function adjustChickenBreedAccumulatedProfit(breed, deltaProfit) {
  if (!breed) return;
  await run(
    `UPDATE chicken_breeds SET accumulated_profit = COALESCE(accumulated_profit, 0) + ?, updated_at = ? WHERE breed = ?`,
    [Number(deltaProfit) || 0, new Date().toISOString(), breed]
  );
}

/** Staff chick sales: margin counts toward breed totals/UI only when payment is Delivered. */
function chickenStaffSalePaymentIsCleared(row) {
  const s = String(row?.payment_status ?? "pending").trim().toLowerCase();
  return s === "delivered" || s === "cleared";
}

async function assertEmployeeChickenSalePrice(req, res, breed, unitPrice) {
  if (req.user.role !== "employee") return true;
  const row = await get("SELECT selling_price FROM chicken_breeds WHERE breed = ?", [breed]);
  if (!row) {
    res.status(400).json({ error: "Unknown breed." });
    return false;
  }
  if (!salePriceMatchesInventory(Number(row.selling_price), unitPrice)) {
    res.status(400).json({
      error: "Price per chick must match the selling price set by the owner in Chicken Sales Inventory.",
    });
    return false;
  }
  return true;
}

/** Staff chick sales: optional customer ledger fields. Owner inventory lines store empty / zero. */
function normalizeChickenCustomerPayment(p, totalAmount, role) {
  if (role !== "employee") {
    return { customer_name: "", customer_phone: "", money_paid: 0, payment_status: "pending" };
  }
  const customer_name = String(p.customer_name || "").trim();
  const customer_phone = String(p.customer_phone || "").trim();
  let money_paid = p.money_paid === "" || p.money_paid == null ? 0 : Number(p.money_paid);
  if (!Number.isFinite(money_paid) || money_paid < 0) money_paid = 0;
  let payment_status = String(p.payment_status || "pending").toLowerCase();
  if (payment_status === "cleared") payment_status = "delivered";
  if (payment_status !== "delivered" && payment_status !== "pending") payment_status = "pending";
  if (payment_status === "delivered" && money_paid < totalAmount - 1e-9) {
    money_paid = totalAmount;
  }
  return { customer_name, customer_phone, money_paid, payment_status };
}

/**
 * Owner sends buying_price, selling_price, profit_margin_per chick; margin_snap uses profit_margin_per_chick
 * (must match selling − buying within tolerance). Otherwise margin comes from chicken_breeds.
 */
async function resolveChickenSaleMarginSnap(req, res, breed, unitPrice, body) {
  const p = body || {};
  const hasOwnerPrices =
    req.user.role === "owner" &&
    p.buying_price != null &&
    p.selling_price != null &&
    String(p.buying_price).trim() !== "" &&
    String(p.selling_price).trim() !== "";
  if (hasOwnerPrices) {
    const buy = Number(p.buying_price);
    const sell = Number(p.selling_price);
    if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy < 0 || sell < 0) {
      res.status(400).json({ error: "Buying and selling prices must be valid non-negative numbers." });
      return null;
    }
    if (!salePriceMatchesInventory(sell, unitPrice)) {
      res.status(400).json({ error: "Recorded price per chick must match the selling price." });
      return null;
    }
    const pmRaw =
      p.profit_margin_per_chick != null && String(p.profit_margin_per_chick).trim() !== ""
        ? Number(p.profit_margin_per_chick)
        : NaN;
    if (!Number.isFinite(pmRaw) || pmRaw < 0) {
      res.status(400).json({ error: "Profit margin per chick is required and must be a non-negative number." });
      return null;
    }
    const implied = sell - buy;
    if (Math.abs(pmRaw - implied) > PRICE_MATCH_EPS) {
      res.status(400).json({ error: "Profit margin must equal selling price minus buying price." });
      return null;
    }
    return pmRaw;
  }
  const breedRow = await get("SELECT profit_margin_per_chick FROM chicken_breeds WHERE breed = ?", [breed]);
  if (!breedRow) {
    res.status(400).json({ error: "Breed not found." });
    return null;
  }
  return Number(breedRow.profit_margin_per_chick) || 0;
}

/** When the owner saves a sale with buying/selling prices, keep `chicken_breeds` in sync so staff defaults stay current. */
async function syncChickenBreedPricesFromOwnerSale(req, breed, p, marginSnap) {
  if (req.user.role !== "owner") return;
  if (
    p.buying_price == null ||
    p.selling_price == null ||
    String(p.buying_price).trim() === "" ||
    String(p.selling_price).trim() === ""
  ) {
    return;
  }
  const b = Number(p.buying_price);
  const s = Number(p.selling_price);
  if (!Number.isFinite(b) || !Number.isFinite(s) || b < 0 || s < 0) return;
  const m = Number(marginSnap);
  const nowIso = new Date().toISOString();
  await run(
    `UPDATE chicken_breeds SET buying_price = ?, selling_price = ?, profit_margin_per_chick = ?, updated_at = ? WHERE breed = ?`,
    [b, s, Number.isFinite(m) ? m : 0, nowIso, breed]
  );
}

async function reverseChickenSaleProfitEffect(row) {
  if (!row || !row.breed) return;
  const u = await get("SELECT role FROM users WHERE username = ?", [row.created_by]);
  if (u?.role !== "employee") return;
  if (!chickenStaffSalePaymentIsCleared(row)) return;
  if (row.margin_snap == null) return;
  const m = Number(row.margin_snap);
  if (!Number.isFinite(m) || m === 0) return;
  const q = Number(row.quantity_birds) || 0;
  await adjustChickenBreedAccumulatedProfit(row.breed, -q * m);
}

/**
 * Staff margin totals: only rows with Payments = Delivered (pending counts as 0).
 * @param {string|null} employeeUsernameOnly — if set, restrict to that staff member’s sales.
 */
async function computeChickenProfitSummary(employeeUsernameOnly) {
  const today = todayDMY();
  const clearedCond = `(LOWER(TRIM(COALESCE(cs.payment_status, 'pending'))) IN ('delivered','cleared'))`;
  const baseJoin = `FROM chicken_sales cs
     INNER JOIN users u ON u.username = cs.created_by AND u.role = 'employee'`;
  const paramsToday = [today];
  let whereToday = `WHERE cs.date = ? AND ${clearedCond}`;
  if (employeeUsernameOnly) {
    whereToday += " AND cs.created_by = ?";
    paramsToday.push(employeeUsernameOnly);
  }
  const row = await get(
    `SELECT COALESCE(SUM(cs.quantity_birds * COALESCE(cs.margin_snap, 0)), 0) AS t ${baseJoin} ${whereToday}`,
    paramsToday
  );
  const paramsCum = [];
  let whereCum = `WHERE ${clearedCond}`;
  if (employeeUsernameOnly) {
    whereCum += " AND cs.created_by = ?";
    paramsCum.push(employeeUsernameOnly);
  }
  const cumRow = await get(
    `SELECT COALESCE(SUM(cs.quantity_birds * COALESCE(cs.margin_snap, 0)), 0) AS c ${baseJoin} ${whereCum}`,
    paramsCum
  );
  const todayProfit = Number(row?.t) || 0;
  const cumulativeProfit = Number(cumRow?.c) || 0;
  return { todayProfit, cumulativeProfit, today, timeZone: AMANA_TZ };
}

async function reverseAndDeleteChickenSalesForCreator(creator) {
  const rows = await all("SELECT * FROM chicken_sales WHERE created_by = ?", [creator]);
  for (const row of rows) {
    await reverseChickenSaleProfitEffect(row);
  }
  const r = await run("DELETE FROM chicken_sales WHERE created_by = ?", [creator]);
  return r.changes || 0;
}

/**
 * Profit from bags sold: each bag adds profit_margin_per_bag to accumulated_profit when recordProfit is true
 * (pass-through / agent sales set recordProfit false). Returning stock reverses profit only when recordProfit is true.
 */
async function adjustInventoryBags({ brand, feedType, bagSize, deltaBags, recordProfit = true }) {
  const rows = await getInventoryRowsForProduct(brand, feedType, bagSize);
  if (!rows.length) {
    throw new Error("No matching feed inventory item found for this sale.");
  }
  const delta = Number(deltaBags);
  const now = new Date().toISOString();
  const available = rows.reduce((s, r) => s + Number(r.quantity_in_stock || 0), 0);

  if (delta >= 0) {
    const target = rows[rows.length - 1];
    const nextQty = Number(target.quantity_in_stock) + delta;
    const margin = Number(target.profit_margin_per_bag) || 0;
    const profitDelta = recordProfit ? -delta * margin : 0;
    const nextAccumulated = Number(target.accumulated_profit || 0) + profitDelta;
    const nextTotalStock = nextQty * Number(target.bag_size);
    await run(
      `UPDATE inventory
       SET quantity_in_stock = ?, total_stock = ?, accumulated_profit = ?, updated_at = ?
       WHERE id = ?`,
      [nextQty, nextTotalStock, nextAccumulated, now, target.id]
    );
    return;
  }

  const toSell = -delta;
  if (available < toSell) {
    throw new Error("Not enough bags in stock for this sale.");
  }
  let remaining = toSell;
  for (const row of rows) {
    if (remaining <= 0) break;
    const q = Number(row.quantity_in_stock || 0);
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    const nextQty = q - take;
    const margin = Number(row.profit_margin_per_bag) || 0;
    const profitDelta = recordProfit ? take * margin : 0;
    const nextAccumulated = Number(row.accumulated_profit || 0) + profitDelta;
    const nextTotalStock = nextQty * Number(row.bag_size);
    await run(
      `UPDATE inventory
       SET quantity_in_stock = ?, total_stock = ?, accumulated_profit = ?, updated_at = ?
       WHERE id = ?`,
      [nextQty, nextTotalStock, nextAccumulated, now, row.id]
    );
    remaining -= take;
  }
}

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = await get("SELECT * FROM users WHERE username = ?", [username]);
  if (!user) return res.status(401).json({ error: "Invalid credentials." });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials." });

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  return res.json({ token, user: { username: user.username, role: user.role, fullName: user.full_name } });
});

app.post("/api/vehicle/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const user = await get("SELECT * FROM vehicle_users WHERE username = ?", [username]);
  if (!user) return res.status(401).json({ error: "Invalid credentials." });
  if (user.role !== "admin") return res.status(403).json({ error: "Vehicle inventory is admin-only." });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials." });
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, fullName: user.full_name, module: "vehicle" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  return res.json({ token, user: { username: user.username, role: user.role, fullName: user.full_name } });
});

app.get("/api/vehicle/kax", vehicleAuth, async (_req, res) => {
  const rows = await all("SELECT * FROM vehicle_kax_entries ORDER BY id DESC");
  res.json(rows);
});

app.post("/api/vehicle/kax", vehicleAuth, async (req, res) => {
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const description = String(p.description || "").trim();
  if (!description) return res.status(400).json({ error: "Description is required." });
  const moneyIn = Number(p.money_in);
  const moneyOut = Number(p.money_out);
  if (!Number.isFinite(moneyIn) || moneyIn < 0 || !Number.isFinite(moneyOut) || moneyOut < 0) {
    return res.status(400).json({ error: "Money In and Money Out must be valid non-negative numbers." });
  }
  await run(
    `INSERT INTO vehicle_kax_entries (date, description, money_in, money_out, created_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [dateCanon, description, moneyIn, moneyOut, req.vehicleUser.username, new Date().toISOString()]
  );
  res.json({ ok: true });
});

app.put("/api/vehicle/kax/:id", vehicleAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid row id." });
  const current = await get("SELECT id FROM vehicle_kax_entries WHERE id = ?", [id]);
  if (!current) return res.status(404).json({ error: "Entry not found." });
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const description = String(p.description || "").trim();
  if (!description) return res.status(400).json({ error: "Description is required." });
  const moneyIn = Number(p.money_in);
  const moneyOut = Number(p.money_out);
  if (!Number.isFinite(moneyIn) || moneyIn < 0 || !Number.isFinite(moneyOut) || moneyOut < 0) {
    return res.status(400).json({ error: "Money In and Money Out must be valid non-negative numbers." });
  }
  await run(
    `UPDATE vehicle_kax_entries
     SET date = ?, description = ?, money_in = ?, money_out = ?, updated_at = ?
     WHERE id = ?`,
    [dateCanon, description, moneyIn, moneyOut, new Date().toISOString(), id]
  );
  res.json({ ok: true });
});

app.delete("/api/vehicle/kax/:id", vehicleAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid row id." });
  const result = await run("DELETE FROM vehicle_kax_entries WHERE id = ?", [id]);
  if (result.changes === 0) return res.status(404).json({ error: "Entry not found." });
  res.json({ ok: true });
});

/** Public product list (brands / feed types / bag sizes) — no auth so the UI can always populate dropdowns. */
app.get("/api/catalog", (_req, res) => {
  res.json(feedCatalog);
});

/** Cumulative profit from all Sales Per Bags (per-line: all-time bags sold × current margin). `today` is shop day for UI only. */
app.get("/api/sales/today-profit", auth, async (_req, res) => {
  try {
    const data = await computeCumulativeFeedBagSalesProfit();
    res.json(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not compute today's profit." });
  }
});

app.get("/api/inventory", auth, allowRoles("owner"), async (_req, res) => {
  const lineProfits = await cumulativeBagSalesProfitByInventoryLines();
  const passThroughBags = await passThroughBagTotalsByInventoryLines();
  const rows = await all("SELECT * FROM inventory ORDER BY id DESC");
  const keyOf = (r) => inventoryProfitKey(r.brand, r.feed_type, r.bag_size);
  const enriched = rows.map((r) => ({
    ...r,
    cumulative_bag_profit: lineProfits.get(keyOf(r)) || 0,
    bags_sold_pass_through: passThroughBags.get(keyOf(r)) || 0,
  }));
  res.json(enriched);
});

/** Selling prices per inventory line (for employees to record sales at the owner’s prices). Ordered by id DESC to match stock lookup. */
app.get("/api/inventory/selling-prices", auth, allowRoles("owner", "employee"), async (_req, res) => {
  const rows = await all(
    "SELECT id, brand, feed_type, bag_size, selling_price FROM inventory ORDER BY id DESC"
  );
  res.json(rows);
});

app.post("/api/inventory", auth, allowRoles("owner"), async (req, res) => {
  try {
    const payload = req.body;
    const bagSize = Number(payload.bag_size);
    const addQty = Number(payload.quantity_in_stock);
    const dateCanon = normalizeInventoryDate(payload.date);
    if (!dateCanon) {
      return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
    }

    if (!validateFeed(payload.brand, payload.feed_type, bagSize)) {
      return res.status(400).json({ error: "Invalid brand/feed type/bag size combination." });
    }

    const margin = Number(payload.profit_margin_per_bag);
    const brandCanon = resolveBrandKey(payload.brand);
    const feedCanon =
      (feedCatalog[brandCanon] || []).find(
        (i) => normalizeFeedType(i.type) === normalizeFeedType(payload.feed_type)
      )?.type || payload.feed_type;

    const matches = await findInventoryRowsSameDayProduct(dateCanon, brandCanon, feedCanon, bagSize);

    if (matches.length > 0) {
      const keeper = matches[0];
      const otherIds = matches.slice(1).map((r) => r.id);
      const combinedQty = matches.reduce((s, r) => s + Number(r.quantity_in_stock || 0), 0) + addQty;
      const maxAccAmong = Math.max(0, ...matches.map((r) => Number(r.accumulated_bags ?? 0)));
      const combinedAccBags = maxAccAmong + addQty;
      const combinedProfit = matches.reduce((s, r) => s + Number(r.accumulated_profit || 0), 0);
      const totalStock = bagSize * combinedQty;
      const now = new Date().toISOString();

      await run(
        `UPDATE inventory SET
         date = ?, brand = ?, feed_type = ?, bag_size = ?,
         quantity_in_stock = ?, cost_price = 0, buying_price = ?, selling_price = ?, total_stock = ?, reorder_level = ?,
         profit_margin_per_bag = ?, accumulated_profit = ?, accumulated_bags = ?, updated_at = ?
         WHERE id = ?`,
        [
          dateCanon,
          brandCanon,
          feedCanon,
          bagSize,
          combinedQty,
          Number(payload.buying_price),
          Number(payload.selling_price),
          totalStock,
          Number(payload.reorder_level),
          margin,
          combinedProfit,
          Math.max(0, combinedAccBags),
          now,
          keeper.id,
        ]
      );

      for (const oid of otherIds) {
        await run(`DELETE FROM inventory WHERE id = ?`, [oid]);
      }

      return res.json({ ok: true, merged: true });
    }

    /** New calendar day (or first save): roll prior stock into this line — qty = stock on hand + new bags; accumulated = prior running max + new bags. Employee sales only reduce quantity, never accumulated. */
    const allProduct = await getInventoryRowsForProduct(brandCanon, feedCanon, bagSize);
    const carryQty = allProduct.reduce((s, r) => s + Number(r.quantity_in_stock || 0), 0);
    const carryAcc =
      allProduct.length > 0 ? Math.max(...allProduct.map((r) => Number(r.accumulated_bags ?? 0))) : 0;
    const carryProfit = allProduct.reduce((s, r) => s + Number(r.accumulated_profit || 0), 0);
    const newQty = carryQty + addQty;
    const newAcc = carryAcc + addQty;
    const totalStock = bagSize * newQty;
    const now = new Date().toISOString();

    await run("BEGIN TRANSACTION");
    try {
      for (const r of allProduct) {
        await run(`DELETE FROM inventory WHERE id = ?`, [r.id]);
      }
      await run(
        `INSERT INTO inventory
    (date, brand, feed_type, bag_size, quantity_in_stock, cost_price, buying_price, selling_price, total_stock, reorder_level,
     profit_margin_per_bag, accumulated_profit, accumulated_bags, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dateCanon,
          brandCanon,
          feedCanon,
          bagSize,
          newQty,
          Number(payload.buying_price),
          Number(payload.selling_price),
          totalStock,
          Number(payload.reorder_level),
          margin,
          carryProfit,
          newAcc,
          req.user.username,
          now,
        ]
      );
      await run("COMMIT");
    } catch (txErr) {
      try {
        await run("ROLLBACK");
      } catch (_rollbackErr) {
        // ignore
      }
      throw txErr;
    }

    res.json({ ok: true, merged: false, consolidated: allProduct.length > 0 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not save inventory." });
  }
});

app.put("/api/inventory/:id", auth, allowRoles("owner"), async (req, res) => {
  try {
    const payload = req.body;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ error: "Invalid inventory id." });
    }

    const bagSize = Number(payload.bag_size);
    const quantity = Number(payload.quantity_in_stock);
    const totalStock = bagSize * quantity;

    if (!validateFeed(payload.brand, payload.feed_type, bagSize)) {
      return res.status(400).json({ error: "Invalid brand/feed type/bag size combination." });
    }

    const existing = await get(
      "SELECT accumulated_profit, quantity_in_stock, COALESCE(accumulated_bags, 0) AS accumulated_bags FROM inventory WHERE id = ?",
      [id]
    );
    if (!existing) {
      return res.status(404).json({ error: "Inventory record not found." });
    }

    const margin = Number(payload.profit_margin_per_bag);
    // On owner edit, accumulated_bags should mirror the edited current quantity for that record.
    const nextAccumulatedBags = Math.max(0, quantity);

    const dateCanon = normalizeInventoryDate(payload.date);
    if (!dateCanon) {
      return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
    }
    const brandCanon = resolveBrandKey(payload.brand);
    const feedCanon =
      (feedCatalog[brandCanon] || []).find(
        (i) => normalizeFeedType(i.type) === normalizeFeedType(payload.feed_type)
      )?.type || payload.feed_type;

    const result = await run(
      `UPDATE inventory SET
      date = ?, brand = ?, feed_type = ?, bag_size = ?, quantity_in_stock = ?,
      cost_price = 0, buying_price = ?, selling_price = ?, total_stock = ?, reorder_level = ?,
      profit_margin_per_bag = ?, accumulated_profit = ?, accumulated_bags = ?, updated_at = ?
    WHERE id = ?`,
      [
        dateCanon,
        brandCanon,
        feedCanon,
        bagSize,
        quantity,
        Number(payload.buying_price),
        Number(payload.selling_price),
        totalStock,
        Number(payload.reorder_level),
        margin,
        Number(existing.accumulated_profit || 0),
        nextAccumulatedBags,
        new Date().toISOString(),
        id,
      ]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "Inventory record not found." });
    }
    res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not update inventory." });
  }
});

app.delete("/api/inventory/:id", auth, allowRoles("owner"), async (req, res) => {
  await run("DELETE FROM inventory WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
});

app.get("/api/feeders-drinkers/catalog", auth, allowRoles("owner", "employee"), (_req, res) => {
  res.json(FEEDERS_DRINKERS_CATALOG);
});

app.get("/api/feeders-drinkers", auth, allowRoles("owner", "employee"), async (_req, res) => {
  const rows = await all("SELECT * FROM feeders_drinkers_inventory ORDER BY id DESC");
  res.json(rows);
});

async function getFeedersDrinkersRowsForItem(itemName) {
  return await all("SELECT * FROM feeders_drinkers_inventory WHERE item_name = ? ORDER BY id ASC", [itemName]);
}

async function getFeedersDrinkersCurrentLine(itemName) {
  const rows = await all("SELECT * FROM feeders_drinkers_inventory WHERE item_name = ? ORDER BY id DESC", [itemName]);
  return rows.length ? rows[0] : null;
}

async function adjustFeedersDrinkersStock(itemName, deltaQty, recordProfit = true) {
  const rows = await getFeedersDrinkersRowsForItem(itemName);
  if (!rows.length) throw new Error("No stock record found for this item.");
  const delta = Number(deltaQty);
  if (!Number.isFinite(delta)) throw new Error("Invalid quantity.");
  const nowIso = new Date().toISOString();
  if (delta >= 0) {
    const target = rows[rows.length - 1];
    const nextQty = Number(target.quantity_in_stock || 0) + delta;
    const margin = Number(target.profit_margin || 0);
    const profitDelta = recordProfit ? -delta * margin : 0;
    const nextAccumulatedProfit = Number(target.accumulated_profit || 0) + profitDelta;
    await run("UPDATE feeders_drinkers_inventory SET quantity_in_stock = ?, accumulated_profit = ?, updated_at = ? WHERE id = ?", [
      nextQty,
      nextAccumulatedProfit,
      nowIso,
      target.id,
    ]);
    return;
  }
  let remaining = -delta;
  const available = rows.reduce((s, r) => s + Number(r.quantity_in_stock || 0), 0);
  if (available < remaining) throw new Error("Not enough stock for this sale.");
  for (const row of rows) {
    if (remaining <= 0) break;
    const q = Number(row.quantity_in_stock || 0);
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    const margin = Number(row.profit_margin || 0);
    const profitDelta = recordProfit ? take * margin : 0;
    const nextAccumulatedProfit = Number(row.accumulated_profit || 0) + profitDelta;
    await run("UPDATE feeders_drinkers_inventory SET quantity_in_stock = ?, accumulated_profit = ?, updated_at = ? WHERE id = ?", [
      q - take,
      nextAccumulatedProfit,
      nowIso,
      row.id,
    ]);
    remaining -= take;
  }
}

app.get("/api/feeders-drinkers/employee-items", auth, allowRoles("employee"), async (_req, res) => {
  const rows = await all(
    `SELECT item_name, item_type, capacity_liters, COALESCE(SUM(quantity_in_stock), 0) AS quantity_in_stock
     FROM feeders_drinkers_inventory
     GROUP BY item_name, item_type, capacity_liters
     HAVING COALESCE(SUM(quantity_in_stock), 0) > 0
     ORDER BY item_name ASC`
  );
  res.json(rows);
});

app.get("/api/feeders-drinkers/sales", auth, allowRoles("owner", "employee"), async (req, res) => {
  if (req.user.role === "owner") {
    const rows = await all("SELECT * FROM feeders_drinkers_sales ORDER BY id DESC");
    return res.json(rows);
  }
  const rows = await all("SELECT * FROM feeders_drinkers_sales WHERE created_by = ? ORDER BY id DESC", [req.user.username]);
  return res.json(rows);
});

app.post("/api/feeders-drinkers/sales", auth, allowRoles("employee"), async (req, res) => {
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const item = resolveFeederDrinkerItem(p.item_name);
  if (!item) return res.status(400).json({ error: "Invalid feeder/drinker item." });
  const qty = Number(p.quantity_sold);
  if (!Number.isFinite(qty) || qty < 1) {
    return res.status(400).json({ error: "Quantity sold must be at least 1." });
  }
  const line = await getFeedersDrinkersCurrentLine(item.name);
  if (!line) {
    return res.status(400).json({ error: "No inventory record found for this item." });
  }
  const price = Number(line.selling_price);
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "Selling price is not set for this item." });
  }
  try {
    await adjustFeedersDrinkersStock(item.name, -Math.floor(qty));
  } catch (err) {
    return res.status(400).json({ error: err.message || "Could not process sale." });
  }
  const nowIso = new Date().toISOString();
  const quantitySold = Math.floor(qty);
  const total = quantitySold * price;
  await run(
    `INSERT INTO feeders_drinkers_sales
    (date, item_name, quantity_sold, price_per_item, total_amount, through_party, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [dateCanon, item.name, quantitySold, price, total, throughParty, req.user.username, nowIso, nowIso]
  );
  res.json({ ok: true });
});

app.put("/api/feeders-drinkers/sales/:id", auth, allowRoles("employee"), async (req, res) => {
  const id = Number(req.params.id);
  const current = await get("SELECT * FROM feeders_drinkers_sales WHERE id = ? AND created_by = ?", [id, req.user.username]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const item = resolveFeederDrinkerItem(p.item_name);
  if (!item) return res.status(400).json({ error: "Invalid feeder/drinker item." });
  const qty = Math.floor(Number(p.quantity_sold));
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).json({ error: "Quantity sold must be at least 1." });
  const invLine = await getFeedersDrinkersCurrentLine(item.name);
  if (!invLine) return res.status(400).json({ error: "No inventory record found for this item." });
  const price = Number(invLine.selling_price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Selling price is not set for this item." });
  try {
    await run("BEGIN TRANSACTION");
    await adjustFeedersDrinkersStock(current.item_name, Number(current.quantity_sold));
    await adjustFeedersDrinkersStock(item.name, -qty);
    await run(
      `UPDATE feeders_drinkers_sales
       SET date = ?, item_name = ?, quantity_sold = ?, price_per_item = ?, total_amount = ?, through_party = ?, updated_at = ?
       WHERE id = ?`,
      [dateCanon, item.name, qty, price, qty * price, throughParty, new Date().toISOString(), id]
    );
    await run("COMMIT");
  } catch (err) {
    try { await run("ROLLBACK"); } catch (_e) {}
    return res.status(400).json({ error: err.message || "Could not update sale." });
  }
  res.json({ ok: true });
});

app.delete("/api/feeders-drinkers/sales/:id", auth, allowRoles("employee"), async (req, res) => {
  const id = Number(req.params.id);
  const current = await get("SELECT * FROM feeders_drinkers_sales WHERE id = ? AND created_by = ?", [id, req.user.username]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  try {
    await adjustFeedersDrinkersStock(current.item_name, Number(current.quantity_sold));
  } catch (err) {
    return res.status(400).json({ error: err.message || "Could not delete sale." });
  }
  await run("DELETE FROM feeders_drinkers_sales WHERE id = ?", [id]);
  res.json({ ok: true });
});

app.post("/api/feeders-drinkers", auth, allowRoles("owner"), async (req, res) => {
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const item = resolveFeederDrinkerItem(p.item_name);
  if (!item) return res.status(400).json({ error: "Invalid feeder/drinker item." });
  const quantity = Number(p.quantity_in_stock);
  const buying = Number(p.buying_price);
  const selling = Number(p.selling_price);
  const margin = Number(p.profit_margin);
  const reorder = Number(p.reorder_level);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: "Quantity in stock must be zero or greater." });
  }
  if (!Number.isFinite(buying) || buying < 0 || !Number.isFinite(selling) || selling < 0) {
    return res.status(400).json({ error: "Buying and selling price must be valid non-negative numbers." });
  }
  if (!Number.isFinite(reorder) || reorder < 0) {
    return res.status(400).json({ error: "Reorder level must be zero or greater." });
  }
  if (!Number.isFinite(margin) || margin < 0) {
    return res.status(400).json({ error: "Profit margin must be zero or greater." });
  }
  const qtyAdd = Math.floor(quantity);
  const existing = await get("SELECT * FROM feeders_drinkers_inventory WHERE item_name = ? ORDER BY id DESC LIMIT 1", [item.name]);
  if (existing) {
    await run(
      `UPDATE feeders_drinkers_inventory SET
       date = ?, item_type = ?, capacity_liters = ?, quantity_in_stock = ?, accumulated_stock = ?, buying_price = ?, selling_price = ?, profit_margin = ?, reorder_level = ?, updated_at = ?
       WHERE id = ?`,
      [
        dateCanon,
        item.item_type,
        item.capacity_liters,
        Number(existing.quantity_in_stock || 0) + qtyAdd,
        Number(existing.accumulated_stock || 0) + qtyAdd,
        buying,
        selling,
        margin,
        Math.floor(reorder),
        new Date().toISOString(),
        existing.id,
      ]
    );
  } else {
    await run(
      `INSERT INTO feeders_drinkers_inventory
      (date, item_name, item_type, capacity_liters, quantity_in_stock, accumulated_stock, buying_price, selling_price, profit_margin, accumulated_profit, reorder_level, created_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        dateCanon,
        item.name,
        item.item_type,
        item.capacity_liters,
        qtyAdd,
        qtyAdd,
        buying,
        selling,
        margin,
        Math.floor(reorder),
        req.user.username,
        new Date().toISOString(),
      ]
    );
  }
  res.json({ ok: true });
});

app.put("/api/feeders-drinkers/:id", auth, allowRoles("owner"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid inventory id." });
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const item = resolveFeederDrinkerItem(p.item_name);
  if (!item) return res.status(400).json({ error: "Invalid feeder/drinker item." });
  const quantity = Number(p.quantity_in_stock);
  const buying = Number(p.buying_price);
  const selling = Number(p.selling_price);
  const margin = Number(p.profit_margin);
  const reorder = Number(p.reorder_level);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: "Quantity in stock must be zero or greater." });
  }
  if (!Number.isFinite(buying) || buying < 0 || !Number.isFinite(selling) || selling < 0) {
    return res.status(400).json({ error: "Buying and selling price must be valid non-negative numbers." });
  }
  if (!Number.isFinite(reorder) || reorder < 0) {
    return res.status(400).json({ error: "Reorder level must be zero or greater." });
  }
  if (!Number.isFinite(margin) || margin < 0) {
    return res.status(400).json({ error: "Profit margin must be zero or greater." });
  }
  const existing = await get(
    "SELECT quantity_in_stock, COALESCE(accumulated_stock, 0) AS accumulated_stock FROM feeders_drinkers_inventory WHERE id = ?",
    [id]
  );
  if (!existing) return res.status(404).json({ error: "Inventory record not found." });
  const nextQty = Math.floor(quantity);
  const oldQty = Number(existing.quantity_in_stock || 0);
  const addOnly = Math.max(0, nextQty - oldQty);
  const nextAccumulated = Number(existing.accumulated_stock || 0) + addOnly;
  const result = await run(
    `UPDATE feeders_drinkers_inventory SET
      date = ?, item_name = ?, item_type = ?, capacity_liters = ?, quantity_in_stock = ?, accumulated_stock = ?, buying_price = ?, selling_price = ?, profit_margin = ?, reorder_level = ?, updated_at = ?
     WHERE id = ?`,
    [
      dateCanon,
      item.name,
      item.item_type,
      item.capacity_liters,
      nextQty,
      nextAccumulated,
      buying,
      selling,
      margin,
      Math.floor(reorder),
      new Date().toISOString(),
      id,
    ]
  );
  if (result.changes === 0) return res.status(404).json({ error: "Inventory record not found." });
  res.json({ ok: true });
});

app.delete("/api/feeders-drinkers/:id", auth, allowRoles("owner"), async (req, res) => {
  const result = await run("DELETE FROM feeders_drinkers_inventory WHERE id = ?", [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: "Inventory record not found." });
  res.json({ ok: true });
});

app.get("/api/medicaments/catalog", auth, allowRoles("owner", "employee"), (_req, res) => {
  res.json(MEDICAMENTS_CATALOG);
});

app.get("/api/medicaments", auth, allowRoles("owner", "employee"), async (_req, res) => {
  const rows = await all("SELECT * FROM medicaments_inventory ORDER BY id DESC");
  res.json(rows);
});

async function getMedicamentsRowsForItem(itemName) {
  return await all("SELECT * FROM medicaments_inventory WHERE item_name = ? ORDER BY id ASC", [itemName]);
}

async function getMedicamentsCurrentLine(itemName) {
  const rows = await all("SELECT * FROM medicaments_inventory WHERE item_name = ? ORDER BY id DESC", [itemName]);
  return rows.length ? rows[0] : null;
}

async function adjustMedicamentsStock(itemName, deltaQty, recordProfit = true) {
  const rows = await getMedicamentsRowsForItem(itemName);
  if (!rows.length) throw new Error("No stock record found for this item.");
  const delta = Number(deltaQty);
  if (!Number.isFinite(delta)) throw new Error("Invalid quantity.");
  const nowIso = new Date().toISOString();
  if (delta >= 0) {
    const target = rows[rows.length - 1];
    const nextQty = Number(target.quantity_in_stock || 0) + delta;
    const margin = Number(target.profit_margin || 0);
    const profitDelta = recordProfit ? -delta * margin : 0;
    const nextAccumulatedProfit = Number(target.accumulated_profit || 0) + profitDelta;
    await run("UPDATE medicaments_inventory SET quantity_in_stock = ?, accumulated_profit = ?, updated_at = ? WHERE id = ?", [
      nextQty,
      nextAccumulatedProfit,
      nowIso,
      target.id,
    ]);
    return;
  }
  let remaining = -delta;
  const available = rows.reduce((s, r) => s + Number(r.quantity_in_stock || 0), 0);
  if (available < remaining) throw new Error("Not enough stock for this sale.");
  for (const row of rows) {
    if (remaining <= 0) break;
    const q = Number(row.quantity_in_stock || 0);
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    const margin = Number(row.profit_margin || 0);
    const profitDelta = recordProfit ? take * margin : 0;
    const nextAccumulatedProfit = Number(row.accumulated_profit || 0) + profitDelta;
    await run("UPDATE medicaments_inventory SET quantity_in_stock = ?, accumulated_profit = ?, updated_at = ? WHERE id = ?", [
      q - take,
      nextAccumulatedProfit,
      nowIso,
      row.id,
    ]);
    remaining -= take;
  }
}

app.get("/api/medicaments/employee-items", auth, allowRoles("employee"), async (_req, res) => {
  const rows = await all(
    `SELECT item_name, COALESCE(SUM(quantity_in_stock), 0) AS quantity_in_stock
     FROM medicaments_inventory
     GROUP BY item_name
     HAVING COALESCE(SUM(quantity_in_stock), 0) > 0
     ORDER BY item_name ASC`
  );
  res.json(rows);
});

app.get("/api/medicaments/sales", auth, allowRoles("owner", "employee"), async (req, res) => {
  if (req.user.role === "owner") {
    const rows = await all("SELECT * FROM medicaments_sales ORDER BY id DESC");
    return res.json(rows);
  }
  const rows = await all("SELECT * FROM medicaments_sales WHERE created_by = ? ORDER BY id DESC", [req.user.username]);
  return res.json(rows);
});

app.post("/api/medicaments/sales", auth, allowRoles("employee"), async (req, res) => {
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const item = resolveMedicamentItem(p.item_name);
  if (!item) return res.status(400).json({ error: "Invalid medicament item." });
  const qty = Math.floor(Number(p.quantity_sold));
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).json({ error: "Quantity sold must be at least 1." });
  const invLine = await getMedicamentsCurrentLine(item);
  if (!invLine) return res.status(400).json({ error: "No inventory record found for this item." });
  const price = Number(invLine.selling_price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Selling price is not set for this item." });
  try {
    await adjustMedicamentsStock(item, -qty);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Could not process sale." });
  }
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO medicaments_sales
    (date, item_name, quantity_sold, price_per_item, total_amount, through_party, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [dateCanon, item, qty, price, qty * price, throughParty, req.user.username, nowIso, nowIso]
  );
  res.json({ ok: true });
});

app.put("/api/medicaments/sales/:id", auth, allowRoles("employee"), async (req, res) => {
  const id = Number(req.params.id);
  const current = await get("SELECT * FROM medicaments_sales WHERE id = ? AND created_by = ?", [id, req.user.username]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const item = resolveMedicamentItem(p.item_name);
  if (!item) return res.status(400).json({ error: "Invalid medicament item." });
  const qty = Math.floor(Number(p.quantity_sold));
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).json({ error: "Quantity sold must be at least 1." });
  const invLine = await getMedicamentsCurrentLine(item);
  if (!invLine) return res.status(400).json({ error: "No inventory record found for this item." });
  const price = Number(invLine.selling_price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Selling price is not set for this item." });
  try {
    await run("BEGIN TRANSACTION");
    await adjustMedicamentsStock(current.item_name, Number(current.quantity_sold));
    await adjustMedicamentsStock(item, -qty);
    await run(
      `UPDATE medicaments_sales
       SET date = ?, item_name = ?, quantity_sold = ?, price_per_item = ?, total_amount = ?, through_party = ?, updated_at = ?
       WHERE id = ?`,
      [dateCanon, item, qty, price, qty * price, throughParty, new Date().toISOString(), id]
    );
    await run("COMMIT");
  } catch (err) {
    try { await run("ROLLBACK"); } catch (_e) {}
    return res.status(400).json({ error: err.message || "Could not update sale." });
  }
  res.json({ ok: true });
});

app.delete("/api/medicaments/sales/:id", auth, allowRoles("employee"), async (req, res) => {
  const id = Number(req.params.id);
  const current = await get("SELECT * FROM medicaments_sales WHERE id = ? AND created_by = ?", [id, req.user.username]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  try {
    await adjustMedicamentsStock(current.item_name, Number(current.quantity_sold));
  } catch (err) {
    return res.status(400).json({ error: err.message || "Could not delete sale." });
  }
  await run("DELETE FROM medicaments_sales WHERE id = ?", [id]);
  res.json({ ok: true });
});

app.post("/api/medicaments", auth, allowRoles("owner"), async (req, res) => {
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const item = resolveMedicamentItem(p.item_name);
  if (!item) return res.status(400).json({ error: "Invalid medicament item." });
  const quantity = Number(p.quantity_in_stock);
  const buying = Number(p.buying_price);
  const selling = Number(p.selling_price);
  const margin = Number(p.profit_margin);
  const reorder = Number(p.reorder_level);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: "Quantity in stock must be zero or greater." });
  }
  if (!Number.isFinite(buying) || buying < 0 || !Number.isFinite(selling) || selling < 0) {
    return res.status(400).json({ error: "Buying and selling price must be valid non-negative numbers." });
  }
  if (!Number.isFinite(reorder) || reorder < 0) {
    return res.status(400).json({ error: "Reorder level must be zero or greater." });
  }
  if (!Number.isFinite(margin) || margin < 0) {
    return res.status(400).json({ error: "Profit margin must be zero or greater." });
  }
  const qtyAdd = Math.floor(quantity);
  const existing = await get("SELECT * FROM medicaments_inventory WHERE item_name = ? ORDER BY id DESC LIMIT 1", [item]);
  if (existing) {
    await run(
      `UPDATE medicaments_inventory SET
       date = ?, quantity_in_stock = ?, accumulated_stock = ?, buying_price = ?, selling_price = ?, profit_margin = ?, reorder_level = ?, updated_at = ?
       WHERE id = ?`,
      [
        dateCanon,
        Number(existing.quantity_in_stock || 0) + qtyAdd,
        Number(existing.accumulated_stock || 0) + qtyAdd,
        buying,
        selling,
        margin,
        Math.floor(reorder),
        new Date().toISOString(),
        existing.id,
      ]
    );
  } else {
    await run(
      `INSERT INTO medicaments_inventory
      (date, item_name, quantity_in_stock, accumulated_stock, buying_price, selling_price, profit_margin, accumulated_profit, reorder_level, created_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        dateCanon,
        item,
        qtyAdd,
        qtyAdd,
        buying,
        selling,
        margin,
        Math.floor(reorder),
        req.user.username,
        new Date().toISOString(),
      ]
    );
  }
  res.json({ ok: true });
});

app.put("/api/medicaments/:id", auth, allowRoles("owner"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid inventory id." });
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const item = resolveMedicamentItem(p.item_name);
  if (!item) return res.status(400).json({ error: "Invalid medicament item." });
  const quantity = Number(p.quantity_in_stock);
  const buying = Number(p.buying_price);
  const selling = Number(p.selling_price);
  const margin = Number(p.profit_margin);
  const reorder = Number(p.reorder_level);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: "Quantity in stock must be zero or greater." });
  }
  if (!Number.isFinite(buying) || buying < 0 || !Number.isFinite(selling) || selling < 0) {
    return res.status(400).json({ error: "Buying and selling price must be valid non-negative numbers." });
  }
  if (!Number.isFinite(reorder) || reorder < 0) {
    return res.status(400).json({ error: "Reorder level must be zero or greater." });
  }
  if (!Number.isFinite(margin) || margin < 0) {
    return res.status(400).json({ error: "Profit margin must be zero or greater." });
  }
  const existing = await get(
    "SELECT quantity_in_stock, COALESCE(accumulated_stock, 0) AS accumulated_stock FROM medicaments_inventory WHERE id = ?",
    [id]
  );
  if (!existing) return res.status(404).json({ error: "Inventory record not found." });
  const nextQty = Math.floor(quantity);
  const oldQty = Number(existing.quantity_in_stock || 0);
  const addOnly = Math.max(0, nextQty - oldQty);
  const nextAccumulated = Number(existing.accumulated_stock || 0) + addOnly;
  const result = await run(
    `UPDATE medicaments_inventory SET
      date = ?, item_name = ?, quantity_in_stock = ?, accumulated_stock = ?, buying_price = ?, selling_price = ?, profit_margin = ?, reorder_level = ?, updated_at = ?
     WHERE id = ?`,
    [
      dateCanon,
      item,
      nextQty,
      nextAccumulated,
      buying,
      selling,
      margin,
      Math.floor(reorder),
      new Date().toISOString(),
      id,
    ]
  );
  if (result.changes === 0) return res.status(404).json({ error: "Inventory record not found." });
  res.json({ ok: true });
});

app.delete("/api/medicaments/:id", auth, allowRoles("owner"), async (req, res) => {
  const result = await run("DELETE FROM medicaments_inventory WHERE id = ?", [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: "Inventory record not found." });
  res.json({ ok: true });
});

function normalizeGasSizeKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}

async function getGasRowsForSize(sizeKg) {
  const sk = normalizeGasSizeKg(sizeKg);
  if (sk == null) return [];
  return await all("SELECT * FROM gas_inventory WHERE size_kg = ? ORDER BY id ASC", [sk]);
}

async function getGasCurrentLine(sizeKg) {
  const sk = normalizeGasSizeKg(sizeKg);
  if (sk == null) return null;
  const rows = await all("SELECT * FROM gas_inventory WHERE size_kg = ? ORDER BY id DESC", [sk]);
  return rows.length ? rows[0] : null;
}

async function adjustGasStock(sizeKg, deltaQty, recordProfit = true) {
  const rows = await getGasRowsForSize(sizeKg);
  if (!rows.length) throw new Error("No stock record found for this cylinder size.");
  const delta = Number(deltaQty);
  if (!Number.isFinite(delta)) throw new Error("Invalid quantity.");
  const nowIso = new Date().toISOString();
  if (delta >= 0) {
    const target = rows[rows.length - 1];
    const nextQty = Number(target.quantity_in_stock || 0) + delta;
    const margin = Number(target.profit_margin || 0);
    const profitDelta = recordProfit ? -delta * margin : 0;
    const nextAccumulatedProfit = Number(target.accumulated_profit || 0) + profitDelta;
    await run("UPDATE gas_inventory SET quantity_in_stock = ?, accumulated_profit = ?, updated_at = ? WHERE id = ?", [
      nextQty,
      nextAccumulatedProfit,
      nowIso,
      target.id,
    ]);
    return;
  }
  let remaining = -delta;
  const available = rows.reduce((s, r) => s + Number(r.quantity_in_stock || 0), 0);
  if (available < remaining) throw new Error("Not enough stock for this sale.");
  for (const row of rows) {
    if (remaining <= 0) break;
    const q = Number(row.quantity_in_stock || 0);
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    const margin = Number(row.profit_margin || 0);
    const profitDelta = recordProfit ? take * margin : 0;
    const nextAccumulatedProfit = Number(row.accumulated_profit || 0) + profitDelta;
    await run("UPDATE gas_inventory SET quantity_in_stock = ?, accumulated_profit = ?, updated_at = ? WHERE id = ?", [
      q - take,
      nextAccumulatedProfit,
      nowIso,
      row.id,
    ]);
    remaining -= take;
  }
}

app.get("/api/gas", auth, allowRoles("owner", "employee"), async (_req, res) => {
  const rows = await all("SELECT * FROM gas_inventory ORDER BY id DESC");
  res.json(rows);
});

app.get("/api/gas/employee-items", auth, allowRoles("employee"), async (_req, res) => {
  const rows = await all(
    `SELECT size_kg, COALESCE(SUM(quantity_in_stock), 0) AS quantity_in_stock
     FROM gas_inventory
     GROUP BY size_kg
     HAVING COALESCE(SUM(quantity_in_stock), 0) > 0
     ORDER BY size_kg ASC`
  );
  res.json(rows);
});

app.get("/api/gas/sales", auth, allowRoles("owner", "employee"), async (req, res) => {
  if (req.user.role === "owner") {
    const rows = await all("SELECT * FROM gas_sales ORDER BY id DESC");
    return res.json(rows);
  }
  const rows = await all("SELECT * FROM gas_sales WHERE created_by = ? ORDER BY id DESC", [req.user.username]);
  return res.json(rows);
});

app.post("/api/gas/sales", auth, allowRoles("employee"), async (req, res) => {
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const sizeKg = normalizeGasSizeKg(p.size_kg);
  if (sizeKg == null) return res.status(400).json({ error: "Cylinder size (kg) must be a positive number." });
  const qty = Math.floor(Number(p.quantity_sold));
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).json({ error: "Quantity sold must be at least 1." });
  const invLine = await getGasCurrentLine(sizeKg);
  if (!invLine) return res.status(400).json({ error: "No inventory record found for this cylinder size." });
  const price = Number(invLine.selling_price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Selling price is not set for this size." });
  try {
    await adjustGasStock(sizeKg, -qty);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Could not process sale." });
  }
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO gas_sales
    (date, size_kg, quantity_sold, price_per_item, total_amount, through_party, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [dateCanon, sizeKg, qty, price, qty * price, throughParty, req.user.username, nowIso, nowIso]
  );
  res.json({ ok: true });
});

app.put("/api/gas/sales/:id", auth, allowRoles("employee"), async (req, res) => {
  const id = Number(req.params.id);
  const current = await get("SELECT * FROM gas_sales WHERE id = ? AND created_by = ?", [id, req.user.username]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const sizeKg = normalizeGasSizeKg(p.size_kg);
  if (sizeKg == null) return res.status(400).json({ error: "Cylinder size (kg) must be a positive number." });
  const qty = Math.floor(Number(p.quantity_sold));
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).json({ error: "Quantity sold must be at least 1." });
  const invLine = await getGasCurrentLine(sizeKg);
  if (!invLine) return res.status(400).json({ error: "No inventory record found for this cylinder size." });
  const price = Number(invLine.selling_price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Selling price is not set for this size." });
  try {
    await run("BEGIN TRANSACTION");
    await adjustGasStock(Number(current.size_kg), Number(current.quantity_sold));
    await adjustGasStock(sizeKg, -qty);
    await run(
      `UPDATE gas_sales
       SET date = ?, size_kg = ?, quantity_sold = ?, price_per_item = ?, total_amount = ?, through_party = ?, updated_at = ?
       WHERE id = ?`,
      [dateCanon, sizeKg, qty, price, qty * price, throughParty, new Date().toISOString(), id]
    );
    await run("COMMIT");
  } catch (err) {
    try {
      await run("ROLLBACK");
    } catch (_e) {
      // ignore
    }
    return res.status(400).json({ error: err.message || "Could not update sale." });
  }
  res.json({ ok: true });
});

app.delete("/api/gas/sales/:id", auth, allowRoles("employee"), async (req, res) => {
  const id = Number(req.params.id);
  const current = await get("SELECT * FROM gas_sales WHERE id = ? AND created_by = ?", [id, req.user.username]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  try {
    await adjustGasStock(Number(current.size_kg), Number(current.quantity_sold));
  } catch (err) {
    return res.status(400).json({ error: err.message || "Could not delete sale." });
  }
  await run("DELETE FROM gas_sales WHERE id = ?", [id]);
  res.json({ ok: true });
});

app.post("/api/gas", auth, allowRoles("owner"), async (req, res) => {
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const sizeKg = normalizeGasSizeKg(p.size_kg);
  if (sizeKg == null) return res.status(400).json({ error: "Cylinder size (kg) must be a positive number." });
  const quantity = Number(p.quantity_in_stock);
  const buying = Number(p.buying_price);
  const selling = Number(p.selling_price);
  const margin = Number(p.profit_margin);
  const reorder = Number(p.reorder_level);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: "Quantity in stock must be zero or greater." });
  }
  if (!Number.isFinite(buying) || buying < 0 || !Number.isFinite(selling) || selling < 0) {
    return res.status(400).json({ error: "Buying and selling price must be valid non-negative numbers." });
  }
  if (!Number.isFinite(reorder) || reorder < 0) {
    return res.status(400).json({ error: "Reorder level must be zero or greater." });
  }
  if (!Number.isFinite(margin) || margin < 0) {
    return res.status(400).json({ error: "Profit margin must be zero or greater." });
  }
  const qtyAdd = Math.floor(quantity);
  const existing = await get("SELECT * FROM gas_inventory WHERE size_kg = ? ORDER BY id DESC LIMIT 1", [sizeKg]);
  if (existing) {
    await run(
      `UPDATE gas_inventory SET
       date = ?, quantity_in_stock = ?, accumulated_stock = ?, buying_price = ?, selling_price = ?, profit_margin = ?, reorder_level = ?, updated_at = ?
       WHERE id = ?`,
      [
        dateCanon,
        Number(existing.quantity_in_stock || 0) + qtyAdd,
        Number(existing.accumulated_stock || 0) + qtyAdd,
        buying,
        selling,
        margin,
        Math.floor(reorder),
        new Date().toISOString(),
        existing.id,
      ]
    );
  } else {
    await run(
      `INSERT INTO gas_inventory
      (date, size_kg, quantity_in_stock, accumulated_stock, buying_price, selling_price, profit_margin, accumulated_profit, reorder_level, created_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        dateCanon,
        sizeKg,
        qtyAdd,
        qtyAdd,
        buying,
        selling,
        margin,
        Math.floor(reorder),
        req.user.username,
        new Date().toISOString(),
      ]
    );
  }
  res.json({ ok: true });
});

app.put("/api/gas/:id", auth, allowRoles("owner"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid inventory id." });
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const sizeKg = normalizeGasSizeKg(p.size_kg);
  if (sizeKg == null) return res.status(400).json({ error: "Cylinder size (kg) must be a positive number." });
  const quantity = Number(p.quantity_in_stock);
  const buying = Number(p.buying_price);
  const selling = Number(p.selling_price);
  const margin = Number(p.profit_margin);
  const reorder = Number(p.reorder_level);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: "Quantity in stock must be zero or greater." });
  }
  if (!Number.isFinite(buying) || buying < 0 || !Number.isFinite(selling) || selling < 0) {
    return res.status(400).json({ error: "Buying and selling price must be valid non-negative numbers." });
  }
  if (!Number.isFinite(reorder) || reorder < 0) {
    return res.status(400).json({ error: "Reorder level must be zero or greater." });
  }
  if (!Number.isFinite(margin) || margin < 0) {
    return res.status(400).json({ error: "Profit margin must be zero or greater." });
  }
  const existing = await get(
    "SELECT quantity_in_stock, COALESCE(accumulated_stock, 0) AS accumulated_stock, size_kg FROM gas_inventory WHERE id = ?",
    [id]
  );
  if (!existing) return res.status(404).json({ error: "Inventory record not found." });
  if (Number(existing.size_kg) !== sizeKg) {
    return res.status(400).json({ error: "Cylinder size (kg) cannot be changed on an existing row. Add stock under that size instead." });
  }
  const nextQty = Math.floor(quantity);
  const oldQty = Number(existing.quantity_in_stock || 0);
  const addOnly = Math.max(0, nextQty - oldQty);
  const nextAccumulated = Number(existing.accumulated_stock || 0) + addOnly;
  const result = await run(
    `UPDATE gas_inventory SET
      date = ?, size_kg = ?, quantity_in_stock = ?, accumulated_stock = ?, buying_price = ?, selling_price = ?, profit_margin = ?, reorder_level = ?, updated_at = ?
     WHERE id = ?`,
    [
      dateCanon,
      sizeKg,
      nextQty,
      nextAccumulated,
      buying,
      selling,
      margin,
      Math.floor(reorder),
      new Date().toISOString(),
      id,
    ]
  );
  if (result.changes === 0) return res.status(404).json({ error: "Inventory record not found." });
  res.json({ ok: true });
});

app.delete("/api/gas/:id", auth, allowRoles("owner"), async (req, res) => {
  const result = await run("DELETE FROM gas_inventory WHERE id = ?", [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: "Inventory record not found." });
  res.json({ ok: true });
});

app.get("/api/expenditure", auth, allowRoles("employee"), async (req, res) => {
  const rows = await all("SELECT * FROM employee_expenditure WHERE created_by = ? ORDER BY id DESC", [
    req.user.username,
  ]);
  res.json(rows);
});

app.post("/api/expenditure", auth, allowRoles("employee"), async (req, res) => {
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const description = String(p.description || "").trim();
  if (!description) return res.status(400).json({ error: "Description is required." });
  const moneyOut = Number(p.money_out);
  const total = Number(p.total);
  if (!Number.isFinite(moneyOut) || moneyOut < 0) {
    return res.status(400).json({ error: "Money out must be a valid non-negative number." });
  }
  if (!Number.isFinite(total) || total < 0) {
    return res.status(400).json({ error: "Total must be a valid non-negative number." });
  }
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO employee_expenditure (date, description, money_out, total, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [dateCanon, description, moneyOut, total, req.user.username, nowIso, nowIso]
  );
  res.json({ ok: true });
});

app.put("/api/expenditure/:id", auth, allowRoles("employee"), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get("SELECT * FROM employee_expenditure WHERE id = ? AND created_by = ?", [
    id,
    req.user.username,
  ]);
  if (!existing) return res.status(404).json({ error: "Record not found." });
  const p = req.body;
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const description = String(p.description || "").trim();
  if (!description) return res.status(400).json({ error: "Description is required." });
  const moneyOut = Number(p.money_out);
  const total = Number(p.total);
  if (!Number.isFinite(moneyOut) || moneyOut < 0) {
    return res.status(400).json({ error: "Money out must be a valid non-negative number." });
  }
  if (!Number.isFinite(total) || total < 0) {
    return res.status(400).json({ error: "Total must be a valid non-negative number." });
  }
  await run(
    `UPDATE employee_expenditure SET date = ?, description = ?, money_out = ?, total = ?, updated_at = ? WHERE id = ?`,
    [dateCanon, description, moneyOut, total, new Date().toISOString(), id]
  );
  res.json({ ok: true });
});

app.delete("/api/expenditure/:id", auth, allowRoles("employee"), async (req, res) => {
  const result = await run("DELETE FROM employee_expenditure WHERE id = ? AND created_by = ?", [
    Number(req.params.id),
    req.user.username,
  ]);
  if (result.changes === 0) return res.status(404).json({ error: "Record not found." });
  res.json({ ok: true });
});

app.get("/api/sales/bags", auth, async (_req, res) => {
  const rows = await all("SELECT * FROM sales_bags ORDER BY id DESC");
  res.json(rows);
});

app.post("/api/sales/bags", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const bagSize = Number(p.bag_size);
  const bagsSold = Number(p.bags_sold);
  const pricePerBag = Number(p.price_per_bag);
  const throughParty = normalizeThroughParty(p.through_party);
  const isThrough = throughParty != null;
  const passThroughStatus = isThrough ? normalizePassThroughStatus(p.pass_through_status) : null;
  if (!validateFeed(p.brand, p.feed_type, bagSize)) {
    return res.status(400).json({ error: "Invalid brand/feed type/bag size combination." });
  }
  if (!Number.isFinite(bagsSold) || bagsSold < 1) {
    return res.status(400).json({ error: "Bags sold must be at least 1." });
  }
  if (!Number.isFinite(pricePerBag) || pricePerBag < 0) {
    return res.status(400).json({ error: "Price per bag is required." });
  }
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const brandKey = resolveBrandKey(p.brand);
  const item = await getInventoryItem(brandKey, p.feed_type, bagSize);
  if (!item) {
    return res.status(400).json({
      error: "No inventory record for this product. The owner must add it under Feed Inventory first.",
    });
  }
  if (!(await assertEmployeeFeedSalePrices(req, res, "bags", p))) return;
  const buying = Number(item.buying_price);
  const totalAmount = isThrough ? buying * bagsSold : bagsSold * pricePerBag;
  try {
    await adjustInventoryBags({
      brand: p.brand,
      feedType: p.feed_type,
      bagSize,
      deltaBags: -bagsSold,
      recordProfit: !isThrough,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO sales_bags (date, brand, feed_type, bag_size, bags_sold, price_per_bag, total_amount, through_party, pass_through_status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.date,
      p.brand,
      p.feed_type,
      bagSize,
      bagsSold,
      pricePerBag,
      totalAmount,
      throughParty,
      passThroughStatus,
      req.user.username,
      nowIso,
      nowIso,
    ]
  );
  res.json({ ok: true });
});

app.put("/api/sales/bags/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const bagSize = Number(p.bag_size);
  const bagsSold = Number(p.bags_sold);
  const pricePerBag = Number(p.price_per_bag);
  const throughParty = normalizeThroughParty(p.through_party);
  const isThrough = throughParty != null;
  if (!validateFeed(p.brand, p.feed_type, bagSize)) {
    return res.status(400).json({ error: "Invalid brand/feed type/bag size combination." });
  }
  if (!Number.isFinite(bagsSold) || bagsSold < 1) {
    return res.status(400).json({ error: "Bags sold must be at least 1." });
  }
  if (!Number.isFinite(pricePerBag) || pricePerBag < 0) {
    return res.status(400).json({ error: "Price per bag is required." });
  }
  const idNum = Number(req.params.id);
  const current = await get("SELECT * FROM sales_bags WHERE id = ?", [idNum]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  const passThroughStatus = isThrough
    ? normalizePassThroughStatus(p.pass_through_status ?? current.pass_through_status)
    : null;
  if (req.user.role === "employee" && current.created_by !== req.user.username) {
    return res.status(403).json({ error: "You can only edit your own bag sales." });
  }
  if (!assertEmployeeSaleEditAllowed(req, res, current, EMPLOYEE_BAG_SALE_EDIT_WINDOW_MS)) return;
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const brandKeyNew = resolveBrandKey(p.brand);
  const itemNew = await getInventoryItem(brandKeyNew, p.feed_type, bagSize);
  if (!itemNew) {
    return res.status(400).json({
      error: "No inventory record for this product. The owner must add it under Feed Inventory first.",
    });
  }
  if (!(await assertEmployeeFeedSalePrices(req, res, "bags", p))) return;
  const buying = Number(itemNew.buying_price);
  const totalAmount = isThrough ? buying * bagsSold : bagsSold * pricePerBag;
  const wasThrough = isThroughPartyBagSaleRow(current);

  try {
    await run("BEGIN TRANSACTION");
    await adjustInventoryBags({
      brand: current.brand,
      feedType: current.feed_type,
      bagSize: current.bag_size,
      deltaBags: Number(current.bags_sold),
      recordProfit: !wasThrough,
    });
    await adjustInventoryBags({
      brand: p.brand,
      feedType: p.feed_type,
      bagSize,
      deltaBags: -bagsSold,
      recordProfit: !isThrough,
    });
    await run(
      `UPDATE sales_bags SET date=?, brand=?, feed_type=?, bag_size=?, bags_sold=?, price_per_bag=?, total_amount=?, through_party=?, pass_through_status=?, updated_at=? WHERE id=?`,
      [
        p.date,
        p.brand,
        p.feed_type,
        bagSize,
        bagsSold,
        pricePerBag,
        totalAmount,
        throughParty,
        passThroughStatus,
        new Date().toISOString(),
        idNum,
      ]
    );
    await run("COMMIT");
  } catch (error) {
    try {
      await run("ROLLBACK");
    } catch (_rollbackErr) {
      // ignore
    }
    return res.status(400).json({ error: error.message || "Could not update sale." });
  }
  res.json({ ok: true });
});

app.put("/api/sales/bags/:id/pass-through-status", auth, allowRoles("owner"), async (req, res) => {
  const idNum = Number(req.params.id);
  if (!Number.isFinite(idNum) || idNum < 1) return res.status(400).json({ error: "Invalid sale id." });
  const current = await get("SELECT id, through_party FROM sales_bags WHERE id = ?", [idNum]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  if (!normalizeThroughParty(current.through_party)) {
    return res.status(400).json({ error: "Status is only available for pass-through sales." });
  }
  const status = normalizePassThroughStatus(req.body?.status);
  await run("UPDATE sales_bags SET pass_through_status = ?, updated_at = ? WHERE id = ?", [
    status,
    new Date().toISOString(),
    idNum,
  ]);
  res.json({ ok: true });
});

app.delete("/api/sales/bags/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const idNum = Number(req.params.id);
  const current = await get("SELECT * FROM sales_bags WHERE id = ?", [idNum]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  if (req.user.role === "employee") {
    if (current.created_by !== req.user.username) {
      return res.status(403).json({ error: "You can only delete your own bag sales." });
    }
    /** No time window for delete (edit/update still uses 4 hours on PUT). */
  }
  try {
    await deleteFeedBagSaleRowById(idNum);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  res.json({ ok: true });
});

app.get("/api/sales/kg", auth, async (_req, res) => {
  const rows = await all("SELECT * FROM sales_kg ORDER BY id DESC");
  const weightMap = await getRetailWeightKgByKeyMap();
  res.json(enrichSalesKgRowsWithCumulative(rows, weightMap));
});

/** Owner: retail view — aggregates from employee “Sales Per Kg” (kg sold, bags opened, bags completed from kg). */
app.get("/api/retail-feed-summary", auth, allowRoles("owner"), async (_req, res) => {
  try {
    const keyForDayProduct = (dateVal, brandVal, feedVal) => {
      const dateCanon = normalizeInventoryDate(dateVal) || String(dateVal || "").trim();
      return `${dateCanon}|${resolveBrandKey(brandVal)}|${normalizeFeedType(feedVal)}`;
    };
    const rows = await all(
      `SELECT sk.date AS date, sk.brand AS brand, sk.feed_type AS feed_type,
        SUM(sk.kg_sold) AS total_kg_sold,
        SUM(CASE WHEN u.role = 'employee' THEN sk.kg_sold ELSE 0 END) AS employee_kg_sold,
        SUM(COALESCE(sk.bag_opened, 0)) AS bags_opened
       FROM sales_kg sk
       LEFT JOIN users u ON u.username = sk.created_by
       GROUP BY sk.date, sk.brand, sk.feed_type
       ORDER BY sk.date DESC, sk.brand ASC, sk.feed_type ASC`
    );
    const weightMap = await getRetailWeightKgByKeyMap();
    const detailRows = await all("SELECT id, date, brand, feed_type, kg_sold, bag_opened FROM sales_kg ORDER BY id DESC");
    const detailEnriched = enrichSalesKgRowsWithCumulative(detailRows, weightMap);
    const remainingByDayProduct = new Map();
    for (const dRow of detailEnriched) {
      const key = keyForDayProduct(dRow.date, dRow.brand, dRow.feed_type);
      const existing = remainingByDayProduct.get(key);
      const rowId = Number(dRow.id) || 0;
      if (!existing || rowId > existing.id) {
        remainingByDayProduct.set(key, {
          id: rowId,
          remaining: Number(dRow.total_kgs_remaining) || 0,
        });
      }
    }
    const enriched = rows.map((r) => {
      const bk = resolveBrandKey(r.brand);
      const bagSize = effectiveKgPerOpenedBagForDisplay(weightMap, bk, r.feed_type);
      const totalKg = Number(r.total_kg_sold) || 0;
      const hadOpenedBag = (Number(r.bags_opened) || 0) > 0 || totalKg > 0;
      const key = keyForDayProduct(r.date, r.brand, r.feed_type);
      const remaining = Number(remainingByDayProduct.get(key)?.remaining || 0);
      return {
        date: r.date,
        brand: r.brand,
        feed_type: r.feed_type,
        bag_size: bagSize,
        total_kg_sold: totalKg,
        remaining_kg: remaining,
        employee_kg_sold: Number(r.employee_kg_sold) || 0,
        // Display as a simple flag: once any bag is open for that day/product, show 1.
        bags_opened: hadOpenedBag ? 1 : 0,
        bags_sold_from_kg: bagsFromTotalKg(totalKg, bagSize),
      };
    });
    res.json(enriched);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not load retail summary." });
  }
});

/** Cumulative retail kg profit (all dates). Legacy path kept for older clients. */
app.get("/api/retail/cumulative-kg-profit", auth, allowRoles("owner"), async (_req, res) => {
  try {
    const data = await computeCumulativeRetailKgProfit();
    res.json(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not compute cumulative retail kg profit." });
  }
});

app.get("/api/retail/today-kg-profit", auth, allowRoles("owner"), async (_req, res) => {
  try {
    const data = await computeCumulativeRetailKgProfit();
    res.json(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not compute retail kg profit." });
  }
});

app.get("/api/retail-feed-pricing", auth, async (req, res) => {
  const rows = await all("SELECT * FROM retail_feed_pricing ORDER BY id DESC");
  if (req.user.role !== "owner") {
    res.json(
      rows.map((r) => ({
        id: r.id,
        brand: r.brand,
        feed_type: r.feed_type,
        bag_size: r.bag_size,
        price_per_kg: r.price_per_kg,
        weight_kg: r.weight_kg,
      }))
    );
  } else {
    res.json(rows);
  }
});

app.post("/api/retail-feed-pricing", auth, allowRoles("owner"), async (req, res) => {
  const p = req.body;
  const brandKey = resolveBrandKey(p.brand);
  const items = feedCatalog[brandKey];
  if (!items) return res.status(400).json({ error: "Invalid brand." });
  const canonFeed =
    items.find((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))?.type || p.feed_type;
  const bagSize = catalogBagSizeForFeed(brandKey, canonFeed);
  if (!validateFeed(p.brand, canonFeed, bagSize)) {
    return res.status(400).json({ error: "Invalid brand/feed type combination." });
  }
  const price = Number(p.price_per_kg);
  const margin = Number(p.profit_margin_per_kg);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Invalid price per kg." });
  if (!Number.isFinite(margin)) return res.status(400).json({ error: "Invalid profit margin per kg." });
  let weightKg = null;
  if (p.weight_kg !== undefined && p.weight_kg !== null && String(p.weight_kg).trim() !== "") {
    const w = Number(p.weight_kg);
    if (!Number.isFinite(w) || w < 0) return res.status(400).json({ error: "Invalid weight (kg)." });
    weightKg = w > 0 ? w : null;
  }
  const existing = await get("SELECT id FROM retail_feed_pricing WHERE brand = ? AND feed_type = ?", [
    brandKey,
    canonFeed,
  ]);
  if (existing) {
    return res.status(400).json({ error: "A retail price already exists for this product. Edit the row instead." });
  }
  const now = new Date().toISOString();
  await run(
    `INSERT INTO retail_feed_pricing (brand, feed_type, bag_size, price_per_kg, profit_margin_per_kg, weight_kg, accumulated_profit, created_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [brandKey, canonFeed, bagSize, price, margin, weightKg, req.user.username, now]
  );
  res.json({ ok: true });
});

app.put("/api/retail-feed-pricing/:id", auth, allowRoles("owner"), async (req, res) => {
  const p = req.body;
  const id = Number(req.params.id);
  const row = await get("SELECT * FROM retail_feed_pricing WHERE id = ?", [id]);
  if (!row) return res.status(404).json({ error: "Record not found." });
  const brandKey = resolveBrandKey(p.brand);
  const items = feedCatalog[brandKey];
  if (!items) return res.status(400).json({ error: "Invalid brand." });
  const canonFeed =
    items.find((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))?.type || p.feed_type;
  const bagSize = catalogBagSizeForFeed(brandKey, canonFeed);
  if (!validateFeed(p.brand, canonFeed, bagSize)) {
    return res.status(400).json({ error: "Invalid brand/feed type combination." });
  }
  const price = Number(p.price_per_kg);
  const margin = Number(p.profit_margin_per_kg);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Invalid price per kg." });
  if (!Number.isFinite(margin)) return res.status(400).json({ error: "Invalid profit margin per kg." });
  let weightKg = null;
  if (p.weight_kg !== undefined && p.weight_kg !== null && String(p.weight_kg).trim() !== "") {
    const w = Number(p.weight_kg);
    if (!Number.isFinite(w) || w < 0) return res.status(400).json({ error: "Invalid weight (kg)." });
    weightKg = w > 0 ? w : null;
  }
  const now = new Date().toISOString();
  await run(
    `UPDATE retail_feed_pricing SET brand=?, feed_type=?, bag_size=?, price_per_kg=?, profit_margin_per_kg=?, weight_kg=?, updated_at=? WHERE id=?`,
    [brandKey, canonFeed, bagSize, price, margin, weightKg, now, id]
  );
  res.json({ ok: true });
});

app.delete("/api/retail-feed-pricing/:id", auth, allowRoles("owner"), async (req, res) => {
  const result = await run("DELETE FROM retail_feed_pricing WHERE id = ?", [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: "Record not found." });
  res.json({ ok: true });
});

app.post("/api/sales/kg", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const brandKey = resolveBrandKey(p.brand);
  const kgSold = Number(p.kg_sold);
  const pricePerKg = Number(p.price_per_kg);
  const bagOpened = Math.max(0, Math.floor(Number(p.bag_opened ?? 0)));
  const items = feedCatalog[brandKey];
  if (!items || !items.some((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))) {
    return res.status(400).json({ error: "Invalid brand/feed type combination." });
  }
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  if (!(await assertEmployeeFeedSalePrices(req, res, "kg", p))) return;
  const defaultBagSize = catalogBagSizeForFeed(brandKey, p.feed_type);
  const nowIso = new Date().toISOString();

  let allSkBrand = [];
  let wmCoerce = new Map();
  if (req.user.role === "employee") {
    allSkBrand = await all("SELECT * FROM sales_kg WHERE brand = ?", [brandKey]);
    wmCoerce = await getRetailWeightKgByKeyMap();
  }

  /** Employees: kg_sold in the request is only this sale’s kg; merge into the same day’s row for this product. */
  if (req.user.role === "employee") {
    const existing = await getEmployeeConsolidatedSalesKgRow(dateCanon, brandKey, p.feed_type, req.user.username);
    if (existing) {
      const addKg = kgSold;
      if (!Number.isFinite(addKg) || addKg <= 0) {
        return res.status(400).json({ error: "Kg sold for this add-on must be greater than zero." });
      }
      if (!salePriceMatchesInventory(Number(existing.price_per_kg), pricePerKg)) {
        return res.status(400).json({
          error: "Price per kg must match the existing line for this product today. Refresh and try again.",
        });
      }
      const carriedBefore = remainingKgCarryoverBeforeSaleDateWithMap(
        dateCanon,
        brandKey,
        p.feed_type,
        allSkBrand,
        wmCoerce
      );
      let incrementBag = bagOpened;
      if (incrementBag > 0) {
        if (carriedBefore > 1e-6) incrementBag = 0;
        else {
          const openedTodayTotal = await sumBagOpenedTodayForProduct(brandKey, p.feed_type, dateCanon, null);
          if (openedTodayTotal >= 1) incrementBag = 0;
        }
      }
      let baseBagOpened = Number(existing.bag_opened || 0);
      if (carriedBefore > 1e-6 && baseBagOpened > 0) baseBagOpened = 0;

      const newKgSold = Number(existing.kg_sold) + addKg;
      const newBagOpened = baseBagOpened + incrementBag;
      const others = await sumKgSoldForSalesKgLine(dateCanon, brandKey, p.feed_type, existing.id);
      const oldCum = others + Number(existing.kg_sold);
      const newCum = others + newKgSold;
      const invDelta = bagsFromTotalKg(newCum, defaultBagSize) - bagsFromTotalKg(oldCum, defaultBagSize);
      try {
        await adjustInventoryBags({
          brand: brandKey,
          feedType: p.feed_type,
          bagSize: defaultBagSize,
          deltaBags: -invDelta,
        });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
      const rf = await getRetailFeedLine(brandKey, p.feed_type);
      const retailMarginSnap =
        existing.retail_margin_per_kg != null && String(existing.retail_margin_per_kg) !== ""
          ? Number(existing.retail_margin_per_kg)
          : rf
            ? Number(rf.profit_margin_per_kg) || 0
            : null;
      if (retailMarginSnap != null && Number(retailMarginSnap) !== 0) {
        await adjustRetailAccumulatedProfit(brandKey, p.feed_type, addKg * retailMarginSnap);
      }
      const bagsSoldCol =
        bagsFromTotalKg(newCum, defaultBagSize) - bagsFromTotalKg(others, defaultBagSize);
      const totalAmount = newKgSold * Number(existing.price_per_kg);
      await run(
        `UPDATE sales_kg SET bags_sold=?, kg_sold=?, total_amount=?, bag_opened=?, retail_margin_per_kg=?, through_party=?, updated_at=? WHERE id=?`,
        [bagsSoldCol, newKgSold, totalAmount, newBagOpened, retailMarginSnap, throughParty, nowIso, existing.id]
      );
      return res.json({ ok: true, merged: true });
    }
  }

  let insertBagOpened = bagOpened;
  if (req.user.role === "employee") {
    const carriedBefore = remainingKgCarryoverBeforeSaleDateWithMap(
      dateCanon,
      brandKey,
      p.feed_type,
      allSkBrand,
      wmCoerce
    );
    if (insertBagOpened > 0) {
      if (carriedBefore > 1e-6) insertBagOpened = 0;
      else {
        const openedToday = await sumBagOpenedTodayForProduct(brandKey, p.feed_type, dateCanon, null);
        if (openedToday >= 1) insertBagOpened = 0;
      }
    }
  }

  const totalAmount = kgSold * pricePerKg;
  const prevKg = await sumKgSoldForSalesKgLine(dateCanon, brandKey, p.feed_type, null);
  const incrementalBags = bagsFromTotalKg(prevKg + kgSold, defaultBagSize) - bagsFromTotalKg(prevKg, defaultBagSize);
  try {
    await adjustInventoryBags({
      brand: brandKey,
      feedType: p.feed_type,
      bagSize: defaultBagSize,
      deltaBags: -incrementalBags,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const rf = await getRetailFeedLine(brandKey, p.feed_type);
  let retailMarginSnap = null;
  if (rf) {
    retailMarginSnap = Number(rf.profit_margin_per_kg) || 0;
    await adjustRetailAccumulatedProfit(brandKey, p.feed_type, kgSold * retailMarginSnap);
  }
  await run(
    `INSERT INTO sales_kg (date, brand, feed_type, bags_sold, kg_sold, price_per_kg, total_amount, bag_opened, retail_margin_per_kg, through_party, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dateCanon,
      brandKey,
      p.feed_type,
      incrementalBags,
      kgSold,
      pricePerKg,
      totalAmount,
      insertBagOpened,
      retailMarginSnap,
      throughParty,
      req.user.username,
      nowIso,
      nowIso,
    ]
  );
  res.json({ ok: true });
});

app.put("/api/sales/kg/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const brandKey = resolveBrandKey(p.brand);
  const kgSold = Number(p.kg_sold);
  const pricePerKg = Number(p.price_per_kg);
  const bagOpened = Math.max(0, Math.floor(Number(p.bag_opened ?? 0)));
  const items = feedCatalog[brandKey];
  if (!items || !items.some((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))) {
    return res.status(400).json({ error: "Invalid brand/feed type combination." });
  }
  const dateCanon = normalizeInventoryDate(p.date);
  if (!dateCanon) return res.status(400).json({ error: "Invalid date. Use DD/MM/YYYY." });
  const totalAmount = kgSold * pricePerKg;
  const current = await get("SELECT * FROM sales_kg WHERE id = ?", [Number(req.params.id)]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  if (!assertEmployeeSaleEditAllowed(req, res, current)) return;
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  if (!(await assertEmployeeFeedSalePrices(req, res, "kg", p))) return;
  const defaultBagSize = catalogBagSizeForFeed(brandKey, p.feed_type);
  const currentBrandKey = resolveBrandKey(current.brand);
  const currentBagSize = catalogBagSizeForFeed(currentBrandKey, current.feed_type);
  const idNum = Number(req.params.id);
  const dateCanonCurrent = normalizeInventoryDate(current.date) || String(current.date || "").trim();

  let effectiveBagOpenedPut = bagOpened;
  if (req.user.role === "employee") {
    const allSkBrandPut = await all("SELECT * FROM sales_kg WHERE brand = ?", [brandKey]);
    const wmPut = await getRetailWeightKgByKeyMap();
    const carriedPut = remainingKgCarryoverBeforeSaleDateWithMap(
      dateCanon,
      brandKey,
      p.feed_type,
      allSkBrandPut,
      wmPut
    );
    if (effectiveBagOpenedPut > 0) {
      if (carriedPut > 1e-6) effectiveBagOpenedPut = 0;
      else {
        const openedOthersPut = await sumBagOpenedTodayForProduct(brandKey, p.feed_type, dateCanon, idNum);
        if (openedOthersPut >= 1) effectiveBagOpenedPut = 0;
      }
    }
  }

  try {
    const sameItem =
      dateCanonCurrent === dateCanon &&
      currentBrandKey === brandKey &&
      normalizeFeedType(current.feed_type) === normalizeFeedType(p.feed_type);

    if (sameItem) {
      const others = await sumKgSoldForSalesKgLine(dateCanon, brandKey, p.feed_type, idNum);
      const oldCum = others + Number(current.kg_sold);
      const newCum = others + kgSold;
      const invDelta = bagsFromTotalKg(newCum, defaultBagSize) - bagsFromTotalKg(oldCum, defaultBagSize);
      await adjustInventoryBags({
        brand: brandKey,
        feedType: p.feed_type,
        bagSize: defaultBagSize,
        deltaBags: -invDelta,
      });
    } else {
      const othersOld = await sumKgSoldForSalesKgLine(dateCanonCurrent, currentBrandKey, current.feed_type, idNum);
      const oldCum = othersOld + Number(current.kg_sold);
      const revertDelta = bagsFromTotalKg(oldCum, currentBagSize) - bagsFromTotalKg(othersOld, currentBagSize);
      await adjustInventoryBags({
        brand: current.brand,
        feedType: current.feed_type,
        bagSize: currentBagSize,
        deltaBags: revertDelta,
      });

      const othersNew = await sumKgSoldForSalesKgLine(dateCanon, brandKey, p.feed_type, idNum);
      const newCum = othersNew + kgSold;
      const applyDelta = bagsFromTotalKg(newCum, defaultBagSize) - bagsFromTotalKg(othersNew, defaultBagSize);
      await adjustInventoryBags({
        brand: brandKey,
        feedType: p.feed_type,
        bagSize: defaultBagSize,
        deltaBags: -applyDelta,
      });
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const rfNew = await getRetailFeedLine(brandKey, p.feed_type);
  const newRetailSnap = rfNew ? Number(rfNew.profit_margin_per_kg) || 0 : null;
  if (current.retail_margin_per_kg != null && Number(current.retail_margin_per_kg) !== 0) {
    await adjustRetailAccumulatedProfit(
      currentBrandKey,
      current.feed_type,
      -Number(current.kg_sold) * Number(current.retail_margin_per_kg)
    );
  }
  if (newRetailSnap != null) {
    await adjustRetailAccumulatedProfit(brandKey, p.feed_type, kgSold * newRetailSnap);
  }

  const othersAfter = await sumKgSoldForSalesKgLine(dateCanon, brandKey, p.feed_type, idNum);
  const incrementalStored =
    bagsFromTotalKg(othersAfter + kgSold, defaultBagSize) - bagsFromTotalKg(othersAfter, defaultBagSize);

  await run(
    `UPDATE sales_kg SET date=?, brand=?, feed_type=?, bags_sold=?, kg_sold=?, price_per_kg=?, total_amount=?, bag_opened=?, retail_margin_per_kg=?, through_party=?, updated_at=? WHERE id=?`,
    [
      dateCanon,
      brandKey,
      p.feed_type,
      incrementalStored,
      kgSold,
      pricePerKg,
      totalAmount,
      effectiveBagOpenedPut,
      newRetailSnap,
      throughParty,
      new Date().toISOString(),
      idNum,
    ]
  );
  res.json({ ok: true });
});

app.delete("/api/sales/kg/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const current = await get("SELECT * FROM sales_kg WHERE id = ?", [Number(req.params.id)]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  if (req.user.role === "employee") {
    if (current.created_by !== req.user.username) {
      return res.status(403).json({ error: "You can only delete your own kg sales." });
    }
    if (!assertEmployeeSaleEditAllowed(req, res, current, EMPLOYEE_KG_SALE_DELETE_WINDOW_MS)) return;
  }
  const currentBrandKey = resolveBrandKey(current.brand);
  const defaultBagSize = catalogBagSizeForFeed(currentBrandKey, current.feed_type);
  const idNum = Number(req.params.id);
  try {
    const others = await sumKgSoldForSalesKgLine(current.date, currentBrandKey, current.feed_type, idNum);
    const oldCum = others + Number(current.kg_sold);
    const revertDelta = bagsFromTotalKg(oldCum, defaultBagSize) - bagsFromTotalKg(others, defaultBagSize);
    await adjustInventoryBags({
      brand: current.brand,
      feedType: current.feed_type,
      bagSize: defaultBagSize,
      deltaBags: revertDelta,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (current.retail_margin_per_kg != null && Number(current.retail_margin_per_kg) !== 0) {
    await adjustRetailAccumulatedProfit(
      currentBrandKey,
      current.feed_type,
      -Number(current.kg_sold) * Number(current.retail_margin_per_kg)
    );
  }
  await run("DELETE FROM sales_kg WHERE id = ?", [idNum]);
  res.json({ ok: true });
});

app.get("/api/chicken-breeds", auth, async (req, res) => {
  try {
    await ensureChickenBreedsSeeded();
    const rows = await all("SELECT * FROM chicken_breeds ORDER BY breed ASC");
    if (req.user.role === "employee") {
      return res.json(rows.map((r) => ({ breed: r.breed, selling_price: r.selling_price })));
    }
    res.json(rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not load chicken breeds." });
  }
});

app.put("/api/chicken-breeds", auth, allowRoles("owner"), async (req, res) => {
  const breed = normalizeChickenBreed(req.body.breed);
  if (!breed) return res.status(400).json({ error: "Invalid breed." });
  const buying = Number(req.body.buying_price);
  const selling = Number(req.body.selling_price);
  const marginRaw = req.body.profit_margin_per_chick;
  if (!Number.isFinite(buying) || buying < 0) {
    return res.status(400).json({ error: "Buying price must be zero or greater." });
  }
  if (!Number.isFinite(selling) || selling < 0) {
    return res.status(400).json({ error: "Selling price must be zero or greater." });
  }
  const margin =
    marginRaw == null || marginRaw === "" ? selling - buying : Number(req.body.profit_margin_per_chick);
  if (!Number.isFinite(margin)) {
    return res.status(400).json({ error: "Profit margin per chick is required." });
  }
  const now = new Date().toISOString();
  const result = await run(
    `UPDATE chicken_breeds SET buying_price = ?, selling_price = ?, profit_margin_per_chick = ?, updated_at = ? WHERE breed = ?`,
    [buying, selling, margin, now, breed]
  );
  if (result.changes === 0) return res.status(404).json({ error: "Breed not found." });
  res.json({ ok: true });
});

app.get("/api/chicken-sales/profit-summary", auth, allowRoles("owner"), async (_req, res) => {
  try {
    const data = await computeChickenProfitSummary(null);
    res.json(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not compute chicken profit summary." });
  }
});

app.get("/api/chicken-sales", auth, async (req, res) => {
  if (req.user.role === "employee") {
    const rows = await all(
      `SELECT cs.*, u.role AS creator_role
       FROM chicken_sales cs
       INNER JOIN users u ON u.username = cs.created_by AND u.role = 'employee'
       ORDER BY cs.id DESC`
    );
    return res.json(
      rows.map((r) => ({
        ...r,
        creator_role: r.creator_role || "employee",
      }))
    );
  }
  /** Owner: full list — your inventory lines plus staff chick sales (so Profit (sale) can show staff margin). */
  const rows = await all(
    `SELECT cs.*, u.role AS creator_role
     FROM chicken_sales cs
     INNER JOIN users u ON u.username = cs.created_by
     ORDER BY cs.id DESC`
  );
  res.json(
    rows.map((r) => ({
      ...r,
      creator_role: r.creator_role || "owner",
    }))
  );
});

/** Wipe all chick inventory + staff sale lines and reset per-breed accumulated chick profit (owner only). */
app.post("/api/chicken-sales/clear-all", auth, allowRoles("owner"), async (_req, res) => {
  try {
    await run("DELETE FROM chicken_sales");
    await run("UPDATE chicken_breeds SET accumulated_profit = 0");
    res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not clear chicken sales." });
  }
});

app.post("/api/chicken-sales", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const breed = normalizeChickenBreed(p.breed);
  if (!breed) return res.status(400).json({ error: "Select a valid breed." });
  const qty = Number(p.quantity_birds);
  const unitPrice = Number(p.unit_price);
  const weightKg = p.weight_kg === "" || p.weight_kg == null ? null : Number(p.weight_kg);
  const totalAmount = qty * unitPrice;
  const description = String(p.description || "").trim();
  if (!Number.isFinite(qty) || qty < 50) {
    return res.status(400).json({ error: "Quantity must be at least 50 chicks." });
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return res.status(400).json({ error: "Price per chick is required." });
  }
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  if (!(await assertEmployeeChickenSalePrice(req, res, breed, unitPrice))) return;
  const marginSnap = await resolveChickenSaleMarginSnap(req, res, breed, unitPrice, p);
  if (marginSnap == null) return;
  const cust = normalizeChickenCustomerPayment(p, totalAmount, req.user.role);
  const recordsProfit = req.user.role === "employee";
  const marginSnapStored = recordsProfit ? marginSnap : 0;
  if (recordsProfit && chickenStaffSalePaymentIsCleared({ payment_status: cust.payment_status })) {
    await adjustChickenBreedAccumulatedProfit(breed, qty * marginSnap);
  }
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO chicken_sales (date, description, quantity_birds, weight_kg, unit_price, total_amount, breed, margin_snap, customer_name, customer_phone, money_paid, payment_status, through_party, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.date,
      description,
      qty,
      weightKg,
      unitPrice,
      totalAmount,
      breed,
      marginSnapStored,
      cust.customer_name,
      cust.customer_phone,
      cust.money_paid,
      cust.payment_status,
      throughParty,
      req.user.username,
      nowIso,
      nowIso,
    ]
  );
  await syncChickenBreedPricesFromOwnerSale(req, breed, p, marginSnap);
  res.json({ ok: true });
});

app.put("/api/chicken-sales/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const throughParty = normalizeThroughParty(p.through_party);
  const breed = normalizeChickenBreed(p.breed);
  if (!breed) return res.status(400).json({ error: "Select a valid breed." });
  const qty = Number(p.quantity_birds);
  const unitPrice = Number(p.unit_price);
  const weightKg = p.weight_kg === "" || p.weight_kg == null ? null : Number(p.weight_kg);
  const totalAmount = qty * unitPrice;
  const description = String(p.description || "").trim();
  if (!Number.isFinite(qty) || qty < 50) {
    return res.status(400).json({ error: "Quantity must be at least 50 chicks." });
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return res.status(400).json({ error: "Price per chick is required." });
  }
  const currentCh = await get("SELECT * FROM chicken_sales WHERE id = ?", [Number(req.params.id)]);
  if (!currentCh) return res.status(404).json({ error: "Sale not found." });
  if (!(await assertChickenSaleRowMatchesActor(req, res, currentCh))) return;
  /** Chicken sales: employees may edit at any time (no 1-hour window; feed bag/kg sales still use `assertEmployeeSaleEditAllowed`). */
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  await reverseChickenSaleProfitEffect(currentCh);
  if (!(await assertEmployeeChickenSalePrice(req, res, breed, unitPrice))) return;
  const marginSnap = await resolveChickenSaleMarginSnap(req, res, breed, unitPrice, p);
  if (marginSnap == null) return;
  const cust = normalizeChickenCustomerPayment(p, totalAmount, req.user.role);
  const recordsProfit = req.user.role === "employee";
  const marginSnapStored = recordsProfit ? marginSnap : 0;
  if (recordsProfit && chickenStaffSalePaymentIsCleared({ payment_status: cust.payment_status })) {
    await adjustChickenBreedAccumulatedProfit(breed, qty * marginSnap);
  }
  await run(
    `UPDATE chicken_sales SET date=?, description=?, quantity_birds=?, weight_kg=?, unit_price=?, total_amount=?, breed=?, margin_snap=?, customer_name=?, customer_phone=?, money_paid=?, payment_status=?, through_party=?, updated_at=? WHERE id=?`,
    [
      p.date,
      description,
      qty,
      weightKg,
      unitPrice,
      totalAmount,
      breed,
      marginSnapStored,
      cust.customer_name,
      cust.customer_phone,
      cust.money_paid,
      cust.payment_status,
      throughParty,
      new Date().toISOString(),
      Number(req.params.id),
    ]
  );
  await syncChickenBreedPricesFromOwnerSale(req, breed, p, marginSnap);
  res.json({ ok: true });
});

app.delete("/api/chicken-sales/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const idNum = Number(req.params.id);
  const row = await get("SELECT * FROM chicken_sales WHERE id = ?", [idNum]);
  if (!row) return res.status(404).json({ error: "Record not found." });
  if (req.user.role === "owner") {
    const ownerRow = await get(
      `SELECT cs.* FROM chicken_sales cs
       INNER JOIN users u ON u.username = cs.created_by AND u.role = 'owner'
       WHERE cs.id = ?`,
      [idNum]
    );
    if (!ownerRow) return res.status(404).json({ error: "Inventory record not found." });
    await reverseChickenSaleProfitEffect(ownerRow);
    await run("DELETE FROM chicken_sales WHERE id = ?", [idNum]);
    return res.json({ ok: true });
  }
  const creator = await get("SELECT role FROM users WHERE username = ?", [row.created_by]);
  if (creator?.role !== "employee" || row.created_by !== req.user.username) {
    return res.status(403).json({ error: "You can only delete your own chick sales." });
  }
  await reverseChickenSaleProfitEffect(row);
  await run("DELETE FROM chicken_sales WHERE id = ?", [idNum]);
  res.json({ ok: true });
});

/**
 * Reverses inventory / retail profit for all feed sales by `creator`, then deletes those rows.
 * Caller may wrap in a transaction.
 */
async function reverseAndDeleteFeedSalesForCreator(creator) {
  const sbRowsRev = await all("SELECT * FROM sales_bags WHERE created_by = ?", [creator]);
  for (const row of sbRowsRev) {
    const sold = Number(row.bags_sold) || 0;
    if (!sold) continue;
    try {
      await adjustInventoryBags({
        brand: row.brand,
        feedType: row.feed_type,
        bagSize: row.bag_size,
        deltaBags: sold,
        recordProfit: !isThroughPartyBagSaleRow(row),
      });
    } catch (_err) {
      // skip if no matching inventory
    }
  }

  const skRowsToClear = await all("SELECT * FROM sales_kg WHERE created_by = ?", [creator]);
  for (const row of skRowsToClear) {
    if (row.retail_margin_per_kg != null && Number(row.retail_margin_per_kg) !== 0) {
      try {
        await adjustRetailAccumulatedProfit(
          resolveBrandKey(row.brand),
          row.feed_type,
          -Number(row.kg_sold) * Number(row.retail_margin_per_kg)
        );
      } catch (_err) {
        // ignore
      }
    }
  }

  const skGroups = await all(
    `SELECT brand, feed_type, SUM(kg_sold) AS total_kg
     FROM sales_kg
     WHERE created_by = ?
     GROUP BY brand, feed_type`,
    [creator]
  );

  for (const g of skGroups) {
    const totalKg = Number(g.total_kg) || 0;
    if (totalKg <= 0) continue;
    const brandKey = resolveBrandKey(g.brand);
    const bagSize = catalogBagSizeForFeed(brandKey, g.feed_type);
    const sold = bagsFromTotalKg(totalKg, bagSize);
    if (!sold) continue;
    try {
      await adjustInventoryBags({
        brand: brandKey,
        feedType: g.feed_type,
        bagSize,
        deltaBags: sold,
      });
    } catch (_err) {
      // skip if no matching inventory
    }
  }

  const sbDel = await run("DELETE FROM sales_bags WHERE created_by = ?", [creator]);
  const skDel = await run("DELETE FROM sales_kg WHERE created_by = ?", [creator]);
  return {
    sales_bags: sbDel?.changes || 0,
    sales_kg: skDel?.changes || 0,
  };
}

/**
 * Wipes all bag sales, kg sales, and chicken sales for every user, reversing stock and profit effects.
 * Inventory / retail pricing rows remain; only transactional sales lines are removed. Owner-only.
 */
async function wipeAllSalesDataForAllUsers() {
  const users = await all("SELECT username FROM users");
  let salesBags = 0;
  let salesKg = 0;
  let chickenSales = 0;
  for (const { username } of users) {
    const d = await reverseAndDeleteFeedSalesForCreator(username);
    salesBags += d.sales_bags;
    salesKg += d.sales_kg;
    chickenSales += await reverseAndDeleteChickenSalesForCreator(username);
  }
  await run("UPDATE chicken_breeds SET accumulated_profit = 0");
  await run("UPDATE retail_feed_pricing SET accumulated_profit = 0");
  return {
    sales_bags: salesBags,
    sales_kg: salesKg,
    chicken_sales: chickenSales,
    usersProcessed: users.length,
  };
}

/** Same wipe as POST /api/admin/wipe-all-sales-data; for CLI (`node scripts/wipe-all-sales.js`). */
async function runWipeAllSalesDataCli() {
  await ensureTenantInitialized("amana");
  await run("BEGIN TRANSACTION");
  try {
    const stats = await wipeAllSalesDataForAllUsers();
    await run("COMMIT");
    return stats;
  } catch (err) {
    try {
      await run("ROLLBACK");
    } catch (_e) {
      // ignore
    }
    throw err;
  }
}

/**
 * Delete one `sales_bags` row like `DELETE /api/sales/bags/:id` (restore stock / reverse margin profit).
 * For CLI: `node scripts/delete-feed-bag-sale.js --id 12` or `--date 01/05/2026 --brand "Sigma Feeds" --feed "Growers bags" --bags 2`
 */
async function deleteFeedBagSaleRowById(idNum) {
  const current = await get("SELECT * FROM sales_bags WHERE id = ?", [idNum]);
  if (!current) {
    throw new Error(`No bag sale found with id ${idNum}.`);
  }
  await adjustInventoryBags({
    brand: current.brand,
    feedType: current.feed_type,
    bagSize: current.bag_size,
    deltaBags: Number(current.bags_sold),
    recordProfit: !isThroughPartyBagSaleRow(current),
  });
  await run("DELETE FROM sales_bags WHERE id = ?", [idNum]);
  return current;
}

function argvFlagValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function argvHasFlag(flag) {
  return process.argv.includes(flag);
}

/** Parses `--brand` / `--feed` and fixes `npm ... --brand "Sigma"--feed Growers` (missing space → merged token). */
function argvBrandAndFeedForDeleteCli() {
  let brand = argvFlagValue("--brand");
  let feedType = argvFlagValue("--feed");
  const brandIdx = process.argv.indexOf("--brand");
  if (brand && brand.includes("--feed")) {
    const idx = brand.indexOf("--feed");
    const inlineFeed = brand.slice(idx + 6).trim();
    brand = brand.slice(0, idx).trim();
    if (inlineFeed) feedType = feedType || inlineFeed;
  }
  if (!feedType && brandIdx !== -1 && brandIdx + 2 < process.argv.length) {
    const next = process.argv[brandIdx + 2];
    if (next && !String(next).startsWith("--")) {
      feedType = next;
    }
  }
  return { brand, feedType };
}

function inventoryDbPathForHint() {
  const dataDir = process.env.AMANA_DATA_DIR || path.join(__dirname, "data");
  return path.join(dataDir, "inventory.db");
}

async function formatBagSaleDeleteNoMatchHint(dateStr, brand, feedType, bagsSold) {
  const day = normalizeInventoryDate(dateStr);
  const dbPath = inventoryDbPathForHint();
  const recent = await all(
    "SELECT id, date, brand, feed_type, bag_size, bags_sold, created_by FROM sales_bags ORDER BY id DESC LIMIT 50"
  );
  const sameDay = day ? recent.filter((r) => normalizeInventoryDate(r.date) === day) : [];
  const lines = [];
  lines.push(`Database file used: ${dbPath}`);
  if (day && sameDay.length) {
    lines.push(`Rows on ${day}:`);
    for (const r of sameDay) {
      lines.push(
        `  id=${r.id}  brand=${r.brand}  feed_type=${r.feed_type}  ${r.bag_size}kg  bags_sold=${r.bags_sold}  created_by=${r.created_by}`
      );
    }
  } else {
    lines.push(`No rows on calendar day ${day || dateStr} in this database.`);
    if (recent.length) {
      lines.push("Latest bag sales (up to 15):");
      for (const r of recent.slice(0, 15)) {
        lines.push(
          `  id=${r.id}  date=${r.date}  ${r.brand}  ${r.feed_type}  bags=${r.bags_sold}  by=${r.created_by}`
        );
      }
    }
  }
  lines.push(
    'Tip: use full catalog names, e.g. --brand "Sigma Feeds" --feed "Growers bags" (note the space before --feed). Or delete by id from the app: --id <n>.'
  );
  if (brand || feedType) {
    lines.push(`You searched: brand=${JSON.stringify(brand)} feed_type=${JSON.stringify(feedType)} bags=${bagsSold}`);
  }
  return `\n${lines.join("\n")}`;
}

/** Same calendar day + brand + bags count (ignores feed type) — use only when unique. */
async function findFeedBagSalesByDateBrandBags(dateStr, brand, bagsSold) {
  const day = normalizeInventoryDate(dateStr);
  if (!day) return [];
  const wantBags = Number(bagsSold);
  if (!Number.isFinite(wantBags) || wantBags < 1) return [];
  const rows = await all("SELECT * FROM sales_bags ORDER BY id DESC");
  return rows.filter(
    (r) =>
      normalizeInventoryDate(r.date) === day &&
      normalizeBrand(r.brand) === normalizeBrand(brand) &&
      Number(r.bags_sold) === wantBags
  );
}

/** Find bag sales matching calendar date (DD/MM/YYYY), brand, feed type, and bags count (normalized like inventory). */
async function findFeedBagSalesMatchingCriteria(dateStr, brand, feedType, bagsSold) {
  const day = normalizeInventoryDate(dateStr);
  if (!day) {
    throw new Error(`Invalid sale date "${dateStr}". Use DD/MM/YYYY (e.g. 01/05/2026).`);
  }
  const wantBags = Number(bagsSold);
  if (!Number.isFinite(wantBags) || wantBags < 1) {
    throw new Error("bags must be a positive number.");
  }
  const rows = await all("SELECT * FROM sales_bags ORDER BY id DESC");
  return rows.filter(
    (r) =>
      normalizeInventoryDate(r.date) === day &&
      normalizeBrand(r.brand) === normalizeBrand(brand) &&
      normalizeFeedType(r.feed_type) === normalizeFeedType(feedType) &&
      Number(r.bags_sold) === wantBags
  );
}

async function runDeleteFeedBagSaleCli() {
  await ensureTenantInitialized("amana");
  const idRaw = argvFlagValue("--id");
  const dryRun = argvHasFlag("--dry-run");

  if (idRaw != null) {
    const idNum = Number(idRaw);
    if (!Number.isFinite(idNum) || idNum < 1) {
      throw new Error("Invalid --id (expected a positive integer).");
    }
    const row = await get("SELECT * FROM sales_bags WHERE id = ?", [idNum]);
    if (!row) throw new Error(`No bag sale found with id ${idNum}.`);
    if (dryRun) {
      return { dryRun: true, matched: [row], deletedId: null };
    }
    await run("BEGIN TRANSACTION");
    try {
      await deleteFeedBagSaleRowById(idNum);
      await run("COMMIT");
    } catch (err) {
      try {
        await run("ROLLBACK");
      } catch (_e) {
        // ignore
      }
      throw err;
    }
    return { dryRun: false, matched: [row], deletedId: idNum };
  }

  const dateStr = argvFlagValue("--date");
  const { brand, feedType } = argvBrandAndFeedForDeleteCli();
  const bagsStr = argvFlagValue("--bags");
  if (!dateStr || !brand || !feedType || bagsStr == null) {
    throw new Error(
      "Usage: node scripts/delete-feed-bag-sale.js --id <n> [--dry-run]\n" +
        "   or: node scripts/delete-feed-bag-sale.js --date DD/MM/YYYY --brand \"Sigma Feeds\" --feed \"Growers bags\" --bags 2 [--dry-run]\n" +
        "   or: same with --fuzzy to match by date + brand + bag count only when exactly one row matches.\n" +
        '   PowerShell: leave a space between closing quote and --feed, e.g. --brand \"Sigma Feeds\" --feed \"Growers bags\"'
    );
  }
  let matches = await findFeedBagSalesMatchingCriteria(dateStr, brand, feedType, bagsStr);
  if (matches.length === 0 && argvHasFlag("--fuzzy")) {
    const fuzzy = await findFeedBagSalesByDateBrandBags(dateStr, brand, bagsStr);
    if (fuzzy.length === 1) {
      matches = fuzzy;
    } else if (fuzzy.length > 1) {
      const ids = fuzzy.map((m) => `${m.id}(${m.feed_type})`).join(", ");
      const hint = await formatBagSaleDeleteNoMatchHint(dateStr, brand, feedType, bagsStr);
      throw new Error(`--fuzzy found multiple rows on that date for this brand and bag count: ${ids}.${hint}`);
    }
  }
  if (matches.length === 0) {
    const hint = await formatBagSaleDeleteNoMatchHint(dateStr, brand, feedType, bagsStr);
    throw new Error(
      "No matching bag sale rows (check date, brand, feed type, and bag count). If the sale is on Render, set AMANA_DATA_DIR to your disk mount path, or use --fuzzy when only one Sigma line matches that day and bag count." +
        hint
    );
  }
  if (matches.length > 1) {
    const ids = matches.map((m) => m.id).join(", ");
    throw new Error(
      `Multiple rows match (${ids}). Use --id <id> with one of these, or narrow the criteria.`
    );
  }
  const only = matches[0];
  if (dryRun) {
    return { dryRun: true, matched: [only], deletedId: null };
  }
  await run("BEGIN TRANSACTION");
  try {
    await deleteFeedBagSaleRowById(Number(only.id));
    await run("COMMIT");
  } catch (err) {
    try {
      await run("ROLLBACK");
    } catch (_e) {
      // ignore
    }
    throw err;
  }
  return { dryRun: false, matched: [only], deletedId: Number(only.id) };
}

/** Owner: remove all sales history (owner + staff) with full stock/profit reversals. */
app.post("/api/admin/wipe-all-sales-data", auth, allowRoles("owner"), async (_req, res) => {
  try {
    await run("BEGIN TRANSACTION");
    const stats = await wipeAllSalesDataForAllUsers();
    await run("COMMIT");
    res.json({ ok: true, ...stats });
  } catch (err) {
    try {
      await run("ROLLBACK");
    } catch (_rollbackErr) {
      // ignore
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not wipe sales data." });
  }
});

app.use(express.static(PUBLIC_DIR, { dotfiles: "allow" }));

/** SPA fallback: only for GET/HEAD. Unknown /api/* or other methods return JSON (no broken sendFile). */
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found." });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(404).json({ error: "Not found." });
  }
  if (!fs.existsSync(INDEX_HTML)) {
    return res.status(500).type("text").send("Server error: index.html is missing from the public folder.");
  }
  res.sendFile(INDEX_HTML, { dotfiles: "allow" }, (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("sendFile index.html:", err.message);
      if (!res.headersSent) res.status(500).send("Could not load the application.");
    }
  });
});

let httpServer = null;

async function startServer(port = PORT) {
  if (httpServer) return httpServer;
  await ensureTenantInitialized("amana");

  await new Promise((resolve, reject) => {
    httpServer = app
      .listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`Amana Inventory server running at http://localhost:${port}`);
        resolve();
      })
      .on("error", reject);
  });

  return httpServer;
}

async function stopServer() {
  if (!httpServer) return;
  await new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  httpServer = null;
}

module.exports = { startServer, stopServer, runWipeAllSalesDataCli, runDeleteFeedBagSaleCli };

if (require.main === module) {
  startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
}
