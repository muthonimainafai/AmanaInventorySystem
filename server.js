const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "amana-inventory-secret-change-me";

let db = null;

function ensureDb() {
  if (db) return db;
  const dataDir = process.env.AMANA_DATA_DIR || path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, "inventory.db");
  db = new sqlite3.Database(dbPath);
  return db;
}

/** Brand / feed types / bag sizes — single source (original Amana Kuku Feeds specification). */
const feedCatalog = require("./feedCatalog.json");

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  return next();
});
app.use(express.static(path.join(__dirname, "public")));

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

/** One-time: accumulated_profit = total profit from bags recorded as sold (historical sales × current margin). */
async function migrateAccumulatedProfitFromSalesIfNeeded() {
  const row = await get("SELECT value FROM app_meta WHERE key = ?", ["accumulated_profit_v2"]);
  if (row?.value === "1") return;
  const invRows = await all("SELECT * FROM inventory");
  for (const inv of invRows) {
    const margin = Number(inv.profit_margin_per_bag) || 0;
    const sb = await get(
      `SELECT COALESCE(SUM(bags_sold), 0) AS t FROM sales_bags
       WHERE brand = ? AND feed_type = ? AND bag_size = ?`,
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
  await run("ALTER TABLE sales_bags ADD COLUMN created_at TEXT").catch(() => {});
  await run("ALTER TABLE sales_kg ADD COLUMN created_at TEXT").catch(() => {});
  await run(`UPDATE sales_bags SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''`).catch(() => {});
  await run(`UPDATE sales_kg SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''`).catch(() => {});

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

  await run("ALTER TABLE inventory ADD COLUMN profit_margin_per_bag REAL NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE inventory ADD COLUMN accumulated_profit REAL NOT NULL DEFAULT 0").catch(() => {});
  await run("ALTER TABLE inventory ADD COLUMN accumulated_bags INTEGER NOT NULL DEFAULT 0").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const accBagsMigrated = await get("SELECT value FROM app_meta WHERE key = ?", ["accumulated_bags_v1"]);
  if (!accBagsMigrated || accBagsMigrated.value !== "1") {
    await run(`UPDATE inventory SET accumulated_bags = quantity_in_stock`);
    await run(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, ["accumulated_bags_v1", "1"]);
  }

  await migrateAccumulatedProfitFromSalesIfNeeded();

  const owner = await get("SELECT id FROM users WHERE username = ?", ["owner"]);
  if (!owner) {
    const ownerHash = await bcrypt.hash("Owner@123", 10);
    const employeeHash = await bcrypt.hash("Employee@123", 10);
    await run(
      "INSERT INTO users (username, password_hash, role, full_name) VALUES (?,?,?,?)",
      ["owner", ownerHash, "owner", "Shop Owner"]
    );
    await run(
      "INSERT INTO users (username, password_hash, role, full_name) VALUES (?,?,?,?)",
      ["employee", employeeHash, "employee", "Shop Employee"]
    );
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

const EMPLOYEE_SALE_EDIT_WINDOW_MS = 60 * 60 * 1000;

/** Employees may only PUT a sale within 1 hour of when it was first recorded (`created_at`). */
function assertEmployeeSaleEditAllowed(req, res, saleRow) {
  if (req.user.role !== "employee") return true;
  const createdIso = saleRow.created_at || saleRow.updated_at;
  if (!createdIso) {
    res.status(403).json({
      error: "Employees can only edit a sale within 1 hour of when it was recorded.",
    });
    return false;
  }
  const createdMs = new Date(createdIso).getTime();
  if (!Number.isFinite(createdMs)) {
    res.status(403).json({
      error: "Employees can only edit a sale within 1 hour of when it was recorded.",
    });
    return false;
  }
  if (Date.now() - createdMs > EMPLOYEE_SALE_EDIT_WINDOW_MS) {
    res.status(403).json({
      error: "This sale can no longer be edited (1 hour after it was recorded). Ask the owner if a change is needed.",
    });
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

/** Per inventory line (brand + feed + bag size): profit from today’s bag/kg sales, using current margins. */
async function todayProfitByInventoryLines(today) {
  const invRows = await all("SELECT brand, feed_type, bag_size, profit_margin_per_bag FROM inventory");
  const marginMap = new Map();
  for (const inv of invRows) {
    marginMap.set(inventoryProfitKey(inv.brand, inv.feed_type, inv.bag_size), Number(inv.profit_margin_per_bag) || 0);
  }
  const profits = new Map();
  const sbRows = await all("SELECT * FROM sales_bags WHERE date = ?", [today]);
  for (const row of sbRows) {
    const key = inventoryProfitKey(row.brand, row.feed_type, row.bag_size);
    const m = marginMap.get(key);
    if (m != null) {
      profits.set(key, (profits.get(key) || 0) + Number(row.bags_sold) * m);
    }
  }
  const skRows = await all("SELECT * FROM sales_kg WHERE date = ?", [today]);
  for (const row of skRows) {
    const brandKey = resolveBrandKey(row.brand);
    const bagSize =
      (feedCatalog[brandKey] || []).find((i) => normalizeFeedType(i.type) === normalizeFeedType(row.feed_type))?.bagSize || 50;
    const key = inventoryProfitKey(row.brand, row.feed_type, bagSize);
    const m = marginMap.get(key);
    if (m != null) {
      profits.set(key, (profits.get(key) || 0) + Number(row.bags_sold || 0) * m);
    }
  }
  return profits;
}

async function computeTodayFeedSalesProfit() {
  const today = todayDMY();
  const lineMap = await todayProfitByInventoryLines(today);
  let total = 0;
  for (const v of lineMap.values()) total += v;
  return { totalProfit: total, today, timeZone: AMANA_TZ };
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

/** Employees must use the owner’s selling price from inventory (bags: per bag; kg: per kg = selling ÷ bag kg). */
async function assertEmployeeFeedSalePrices(req, res, mode, p) {
  if (req.user.role !== "employee") return true;
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

/** Profit from bags sold: each bag adds profit_margin_per_bag; returning stock (positive deltaBags) reverses it. Sums quantity across all rows for this product; sells FIFO (oldest row first). Does not change accumulated_bags (owner-only lifetime intake). */
async function adjustInventoryBags({ brand, feedType, bagSize, deltaBags }) {
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
    const profitDelta = -delta * margin;
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
    const profitDelta = -take * margin;
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
    { expiresIn: "10h" }
  );
  return res.json({ token, user: { username: user.username, role: user.role, fullName: user.full_name } });
});

/** Public product list (brands / feed types / bag sizes) — no auth so the UI can always populate dropdowns. */
app.get("/api/catalog", (_req, res) => {
  res.json(feedCatalog);
});

/** Today’s cumulative profit from feed bag sales (bags + kg lines), using current inventory margins. */
app.get("/api/sales/today-profit", auth, async (_req, res) => {
  try {
    const data = await computeTodayFeedSalesProfit();
    res.json(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || "Could not compute today's profit." });
  }
});

app.get("/api/inventory", auth, allowRoles("owner"), async (_req, res) => {
  const today = todayDMY();
  const lineProfits = await todayProfitByInventoryLines(today);
  const rows = await all("SELECT * FROM inventory ORDER BY id DESC");
  const enriched = rows.map((r) => ({
    ...r,
    today_profit: lineProfits.get(inventoryProfitKey(r.brand, r.feed_type, r.bag_size)) || 0,
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
    const oldQty = Number(existing.quantity_in_stock);
    const qtyDelta = quantity - oldQty;
    const nextAccumulatedBags = Math.max(0, Number(existing.accumulated_bags) + qtyDelta);

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

app.get("/api/sales/bags", auth, async (_req, res) => {
  const rows = await all("SELECT * FROM sales_bags ORDER BY id DESC");
  res.json(rows);
});

app.post("/api/sales/bags", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const bagSize = Number(p.bag_size);
  const bagsSold = Number(p.bags_sold);
  const pricePerBag = Number(p.price_per_bag);
  if (!validateFeed(p.brand, p.feed_type, bagSize)) {
    return res.status(400).json({ error: "Invalid brand/feed type/bag size combination." });
  }
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  if (!(await assertEmployeeFeedSalePrices(req, res, "bags", p))) return;
  const totalAmount = bagsSold * pricePerBag;
  try {
    await adjustInventoryBags({
      brand: p.brand,
      feedType: p.feed_type,
      bagSize,
      deltaBags: -bagsSold,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO sales_bags (date, brand, feed_type, bag_size, bags_sold, price_per_bag, total_amount, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.date, p.brand, p.feed_type, bagSize, bagsSold, pricePerBag, totalAmount, req.user.username, nowIso, nowIso]
  );
  res.json({ ok: true });
});

app.put("/api/sales/bags/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const bagSize = Number(p.bag_size);
  const bagsSold = Number(p.bags_sold);
  const pricePerBag = Number(p.price_per_bag);
  if (!validateFeed(p.brand, p.feed_type, bagSize)) {
    return res.status(400).json({ error: "Invalid brand/feed type/bag size combination." });
  }
  const totalAmount = bagsSold * pricePerBag;
  const current = await get("SELECT * FROM sales_bags WHERE id = ?", [Number(req.params.id)]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  if (!assertEmployeeSaleEditAllowed(req, res, current)) return;
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  if (!(await assertEmployeeFeedSalePrices(req, res, "bags", p))) return;
  try {
    const sameItem =
      current.brand === p.brand && current.feed_type === p.feed_type && Number(current.bag_size) === bagSize;
    if (sameItem) {
      const delta = Number(current.bags_sold) - bagsSold;
      await adjustInventoryBags({
        brand: p.brand,
        feedType: p.feed_type,
        bagSize,
        deltaBags: delta,
      });
    } else {
      await adjustInventoryBags({
        brand: current.brand,
        feedType: current.feed_type,
        bagSize: current.bag_size,
        deltaBags: Number(current.bags_sold),
      });
      await adjustInventoryBags({
        brand: p.brand,
        feedType: p.feed_type,
        bagSize,
        deltaBags: -bagsSold,
      });
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  await run(
    `UPDATE sales_bags SET date=?, brand=?, feed_type=?, bag_size=?, bags_sold=?, price_per_bag=?, total_amount=?, updated_at=? WHERE id=?`,
    [p.date, p.brand, p.feed_type, bagSize, bagsSold, pricePerBag, totalAmount, new Date().toISOString(), Number(req.params.id)]
  );
  res.json({ ok: true });
});

app.delete("/api/sales/bags/:id", auth, allowRoles("owner"), async (req, res) => {
  const current = await get("SELECT * FROM sales_bags WHERE id = ?", [Number(req.params.id)]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  try {
    await adjustInventoryBags({
      brand: current.brand,
      feedType: current.feed_type,
      bagSize: current.bag_size,
      deltaBags: Number(current.bags_sold),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  await run("DELETE FROM sales_bags WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
});

app.get("/api/sales/kg", auth, async (_req, res) => {
  const rows = await all("SELECT * FROM sales_kg ORDER BY id DESC");
  res.json(rows);
});

app.post("/api/sales/kg", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const brandKey = resolveBrandKey(p.brand);
  const bagsSold = Number(p.bags_sold);
  const kgSold = Number(p.kg_sold);
  const pricePerKg = Number(p.price_per_kg);
  const items = feedCatalog[brandKey];
  if (!items || !items.some((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))) {
    return res.status(400).json({ error: "Invalid brand/feed type combination." });
  }
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  if (!(await assertEmployeeFeedSalePrices(req, res, "kg", p))) return;
  const totalAmount = kgSold * pricePerKg;
  const defaultBagSize =
    (feedCatalog[brandKey] || []).find((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))?.bagSize || 50;
  try {
    await adjustInventoryBags({
      brand: brandKey,
      feedType: p.feed_type,
      bagSize: defaultBagSize,
      deltaBags: -bagsSold,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO sales_kg (date, brand, feed_type, bags_sold, kg_sold, price_per_kg, total_amount, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.date, brandKey, p.feed_type, bagsSold, kgSold, pricePerKg, totalAmount, req.user.username, nowIso, nowIso]
  );
  res.json({ ok: true });
});

app.put("/api/sales/kg/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const brandKey = resolveBrandKey(p.brand);
  const bagsSold = Number(p.bags_sold);
  const kgSold = Number(p.kg_sold);
  const pricePerKg = Number(p.price_per_kg);
  const items = feedCatalog[brandKey];
  if (!items || !items.some((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))) {
    return res.status(400).json({ error: "Invalid brand/feed type combination." });
  }
  const totalAmount = kgSold * pricePerKg;
  const current = await get("SELECT * FROM sales_kg WHERE id = ?", [Number(req.params.id)]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  if (!assertEmployeeSaleEditAllowed(req, res, current)) return;
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  if (!(await assertEmployeeFeedSalePrices(req, res, "kg", p))) return;
  const defaultBagSize =
    (feedCatalog[brandKey] || []).find((i) => normalizeFeedType(i.type) === normalizeFeedType(p.feed_type))?.bagSize || 50;
  const currentBagSize =
    (feedCatalog[resolveBrandKey(current.brand)] || []).find(
      (i) => normalizeFeedType(i.type) === normalizeFeedType(current.feed_type)
    )?.bagSize || 50;
  try {
    const sameItem =
      current.brand === p.brand && current.feed_type === p.feed_type && Number(currentBagSize) === Number(defaultBagSize);
    if (sameItem) {
      const delta = Number(current.bags_sold || 0) - bagsSold;
      await adjustInventoryBags({
        brand: brandKey,
        feedType: p.feed_type,
        bagSize: defaultBagSize,
        deltaBags: delta,
      });
    } else {
      await adjustInventoryBags({
        brand: current.brand,
        feedType: current.feed_type,
        bagSize: currentBagSize,
        deltaBags: Number(current.bags_sold || 0),
      });
      await adjustInventoryBags({
        brand: brandKey,
        feedType: p.feed_type,
        bagSize: defaultBagSize,
        deltaBags: -bagsSold,
      });
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  await run(
    `UPDATE sales_kg SET date=?, brand=?, feed_type=?, bags_sold=?, kg_sold=?, price_per_kg=?, total_amount=?, updated_at=? WHERE id=?`,
    [p.date, brandKey, p.feed_type, bagsSold, kgSold, pricePerKg, totalAmount, new Date().toISOString(), Number(req.params.id)]
  );
  res.json({ ok: true });
});

app.delete("/api/sales/kg/:id", auth, allowRoles("owner"), async (req, res) => {
  const current = await get("SELECT * FROM sales_kg WHERE id = ?", [Number(req.params.id)]);
  if (!current) return res.status(404).json({ error: "Sale not found." });
  const defaultBagSize =
    (feedCatalog[current.brand] || []).find((i) => i.type === current.feed_type)?.bagSize || 50;
  try {
    await adjustInventoryBags({
      brand: current.brand,
      feedType: current.feed_type,
      bagSize: defaultBagSize,
      deltaBags: Number(current.bags_sold || 0),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  await run("DELETE FROM sales_kg WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
});

app.get("/api/chicken-sales", auth, async (_req, res) => {
  const rows = await all("SELECT * FROM chicken_sales ORDER BY id DESC");
  res.json(rows);
});

app.post("/api/chicken-sales", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const qty = Number(p.quantity_birds);
  const unitPrice = Number(p.unit_price);
  const weightKg = p.weight_kg === "" || p.weight_kg == null ? null : Number(p.weight_kg);
  const totalAmount = qty * unitPrice;
  const description = String(p.description || "").trim();
  if (!description) return res.status(400).json({ error: "Description is required." });
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO chicken_sales (date, description, quantity_birds, weight_kg, unit_price, total_amount, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.date, description, qty, weightKg, unitPrice, totalAmount, req.user.username, nowIso, nowIso]
  );
  res.json({ ok: true });
});

app.put("/api/chicken-sales/:id", auth, allowRoles("owner", "employee"), async (req, res) => {
  const p = req.body;
  const qty = Number(p.quantity_birds);
  const unitPrice = Number(p.unit_price);
  const weightKg = p.weight_kg === "" || p.weight_kg == null ? null : Number(p.weight_kg);
  const totalAmount = qty * unitPrice;
  const description = String(p.description || "").trim();
  if (!description) return res.status(400).json({ error: "Description is required." });
  const currentCh = await get("SELECT * FROM chicken_sales WHERE id = ?", [Number(req.params.id)]);
  if (!currentCh) return res.status(404).json({ error: "Sale not found." });
  if (!assertEmployeeSaleEditAllowed(req, res, currentCh)) return;
  if (!employeeSaleDateAllowed(req, res, p.date)) return;
  await run(
    `UPDATE chicken_sales SET date=?, description=?, quantity_birds=?, weight_kg=?, unit_price=?, total_amount=?, updated_at=? WHERE id=?`,
    [p.date, description, qty, weightKg, unitPrice, totalAmount, new Date().toISOString(), Number(req.params.id)]
  );
  res.json({ ok: true });
});

app.delete("/api/chicken-sales/:id", auth, allowRoles("owner"), async (req, res) => {
  await run("DELETE FROM chicken_sales WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
});

/**
 * Development/testing helper:
 * Deletes only sales records created_by = current user, and reverses stock/profit effects in `inventory`
 * for both sales tables (`sales_bags` and `sales_kg`).
 */
app.post("/api/testing/clear-my-sales", auth, allowRoles("owner", "employee"), async (req, res) => {
  const creator = req.user.username;
  try {
    await run("BEGIN TRANSACTION");

    const sbGroups = await all(
      `SELECT brand, feed_type, bag_size, SUM(bags_sold) AS bags_sold
       FROM sales_bags
       WHERE created_by = ?
       GROUP BY brand, feed_type, bag_size`,
      [creator]
    );

    for (const g of sbGroups) {
      const sold = Number(g.bags_sold) || 0;
      if (!sold) continue;
      try {
        await adjustInventoryBags({
          brand: g.brand,
          feedType: g.feed_type,
          bagSize: g.bag_size,
          deltaBags: sold,
        });
      } catch (_err) {
        // skip if no matching inventory
      }
    }

    const skGroups = await all(
      `SELECT brand, feed_type, SUM(bags_sold) AS bags_sold
       FROM sales_kg
       WHERE created_by = ?
       GROUP BY brand, feed_type`,
      [creator]
    );

    for (const g of skGroups) {
      const sold = Number(g.bags_sold) || 0;
      if (!sold) continue;

      const brandKey = resolveBrandKey(g.brand);
      const bagSize =
        (feedCatalog[brandKey] || []).find(
          (i) => normalizeFeedType(i.type) === normalizeFeedType(g.feed_type)
        )?.bagSize || 50;
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

    await run("COMMIT");
    res.json({ ok: true, deleted: { sales_bags: sbDel?.changes || 0, sales_kg: skDel?.changes || 0 } });
  } catch (err) {
    try {
      await run("ROLLBACK");
    } catch (_rollbackErr) {
      // ignore rollback failures
    }
    res.status(500).json({ error: err.message || "Could not clear sales." });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

let httpServer = null;

async function startServer(port = PORT) {
  if (httpServer) return httpServer;
  ensureDb();
  await initDb();

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

module.exports = { startServer, stopServer };

if (require.main === module) {
  startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
}
