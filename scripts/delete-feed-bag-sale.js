#!/usr/bin/env node
/**
 * Remove one Sales Per Bags row (same logic as owner DELETE /api/sales/bags/:id).
 * Run from project root. Uses AMANA_DATA_DIR from .env when set (e.g. Render disk).
 *
 * Examples:
 *   node scripts/delete-feed-bag-sale.js --date 01/05/2026 --brand "Sigma Feeds" --feed "Growers bags" --bags 2
 *   node scripts/delete-feed-bag-sale.js --date 01/05/2026 --brand "Sigma Feeds" --feed "Starter bags" --bags 2 --dry-run
 *   npm run delete-bag-sale -- --date 01/05/2026 --brand "Sigma Feeds" --feed "Growers bags" --bags 2
 *     (must be a space before --feed; do not write "Sigma Feeds"--feed)
 *   npm run delete-bag-sale -- --date 01/05/2026 --brand "Sigma Feeds" --bags 2 --fuzzy
 *     (--fuzzy: match by date + brand + bag count only if exactly one row; ignores feed type)
 *   node scripts/delete-feed-bag-sale.js --id 42
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const { runDeleteFeedBagSaleCli } = require("../server.js");

runDeleteFeedBagSaleCli()
  .then((result) => {
    // eslint-disable-next-line no-console
    console.log("[amana] delete-feed-bag-sale:", JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[amana] delete-feed-bag-sale failed:", err.message || err);
    process.exit(1);
  });
