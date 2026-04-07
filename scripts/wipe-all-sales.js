#!/usr/bin/env node
/**
 * Removes all bag sales, kg sales, and chicken sales for every user (with stock/profit reversals).
 * Run from project root: node scripts/wipe-all-sales.js
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const { runWipeAllSalesDataCli } = require("../server.js");

runWipeAllSalesDataCli()
  .then((stats) => {
    // eslint-disable-next-line no-console
    console.log("[amana] Sales data wiped:", stats);
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[amana] Wipe failed:", err.message || err);
    process.exit(1);
  });
