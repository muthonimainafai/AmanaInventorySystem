#!/usr/bin/env node
/**
 * Reassign one Sales Per Kg row to a different brand (keeps kg, bags, prices, etc.).
 * Run from project root. Uses AMANA_DATA_DIR from .env when set (e.g. Render disk).
 *
 * Examples:
 *   node scripts/reassign-sales-kg-brand.js --id 42 --to-brand "Isinya Feeds"
 *   node scripts/reassign-sales-kg-brand.js --date 18/05/2026 --from-brand Sigma --feed Starter --to-brand "Isinya Feeds" --created-by FaithMaina
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const { runReassignSalesKgBrandCli } = require("../server.js");

runReassignSalesKgBrandCli()
  .then((result) => {
    // eslint-disable-next-line no-console
    console.log("[amana] reassign-sales-kg-brand:", JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[amana] reassign-sales-kg-brand failed:", err.message || err);
    process.exit(1);
  });
