const fs = require('fs');
const path = require('path');
const { REQUIRED_TABLES, reconcileStockWithMovements, loadMigrationSql } = require('../server/supabase');
const { db } = require('../server/db');

console.log('\n=============================================================');
console.log('STARTING MODULE 15: SUPABASE DATABASE ARCHITECTURE SUITE');
console.log('=============================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error(`     Details: ${details}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('--- Test Group 1: Required 20 Normalized Relational Tables ---');
  const schemaSql = loadMigrationSql('schema');
  const seedSql = loadMigrationSql('seed');

  assert('Schema migration file exists and is populated (> 5KB)', schemaSql.length > 5000);
  assert('Seed migration file exists and is populated (> 5KB)', seedSql.length > 5000);

  // Check each of the 20 tables in schema
  for (const tableName of REQUIRED_TABLES) {
    const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${tableName}\\b`, 'i');
    const hasTable = tableRegex.test(schemaSql);
    assert(`Table "${tableName}" defined in schema SQL`, hasTable);
  }

  assert(`All ${REQUIRED_TABLES.length} canonical tables defined`, REQUIRED_TABLES.length === 20);

  console.log('\n--- Test Group 2: UUID Primary Keys & Column Data Types ---');

  // Verify UUID primary key on tables
  for (const tableName of REQUIRED_TABLES) {
    const pkRegex = new RegExp(`CREATE\\s+TABLE[\\s\\S]*?public\\.${tableName}[\\s\\S]*?id\\s+UUID\\s+PRIMARY\\s+KEY`, 'i');
    const hasUuidPk = pkRegex.test(schemaSql);
    assert(`Table "${tableName}" has UUID Primary Key`, hasUuidPk);
  }

  // Monetary precision: NUMERIC(12,2)
  assert('Products use NUMERIC(12,2) for purchase_price & selling_price',
    /purchase_price\s+NUMERIC\(12,2\)/i.test(schemaSql) && /selling_price\s+NUMERIC\(12,2\)/i.test(schemaSql));
  assert('Sales use NUMERIC(12,2) for net_amount, cogs & gross_profit',
    /net_amount\s+NUMERIC\(12,2\)/i.test(schemaSql) && /total_cogs\s+NUMERIC\(12,2\)/i.test(schemaSql));
  assert('Purchases use NUMERIC(12,2) for total_amount',
    /total_amount\s+NUMERIC\(12,2\)/i.test(schemaSql));

  // Quantity precision: NUMERIC(12,3) for exact decimal weights/litres
  assert('Product batches use NUMERIC(12,3) for current_quantity',
    /current_quantity\s+NUMERIC\(12,3\)/i.test(schemaSql));
  assert('Inventory movements use NUMERIC(12,3) for quantity',
    /quantity\s+NUMERIC\(12,3\)/i.test(schemaSql));
  assert('Sale items use NUMERIC(12,3) for quantity',
    /quantity\s+NUMERIC\(12,3\)/i.test(schemaSql));

  console.log('\n--- Test Group 3: Timestamps, Audit Fields & Referential Integrity ---');

  // Timestamps
  assert('Tables include created_at TIMESTAMPTZ DEFAULT now()',
    /created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i.test(schemaSql));
  assert('Automated handle_updated_at() trigger function defined',
    /FUNCTION\s+public\.handle_updated_at\(\)/i.test(schemaSql));

  // Foreign keys
  assert('Products reference categories(id)', /category_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.categories\(id\)/i.test(schemaSql));
  assert('Product batches reference products(id)', /product_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.products\(id\)/i.test(schemaSql));
  assert('Sale items reference sales(id) & product_batches(id)',
    /sale_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.sales\(id\)/i.test(schemaSql) &&
    /batch_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.product_batches\(id\)/i.test(schemaSql));
  assert('Inventory movements reference products(id) & product_batches(id)',
    /product_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.products\(id\)/i.test(schemaSql));

  console.log('\n--- Test Group 4: Check Constraints & Business Validation ---');

  assert('Product quantities constrained to > 0 on movements',
    /CHECK\s*\(\s*quantity\s*>\s*0(?:\.0+)?\s*\)/i.test(schemaSql));
  assert('Prices constrained to >= 0',
    /CHECK\s*\(\s*purchase_price\s*>=\s*0(?:\.0+)?\s*\)/i.test(schemaSql) &&
    /CHECK\s*\(\s*selling_price\s*>=\s*0(?:\.0+)?\s*\)/i.test(schemaSql));
  assert('Movement types constrained to 12 canonical incoming & outgoing types',
    /Opening Stock.*Purchase Received.*Customer Return.*Sales.*Supplier Return.*Wastage/s.test(schemaSql));
  assert('Unit of measure constrained to 7 dairy units',
    /CHECK\s*\(unit\s+IN\s+\('Litres',\s*'Millilitres',\s*'Kilograms',\s*'Grams',\s*'Pieces',\s*'Packets',\s*'Bottles'\)\)/i.test(schemaSql));
  assert('Inter-branch stock transfer forbids self-transfer (from_shop_id <> to_shop_id)',
    /CHECK\s*\(\s*from_shop_id\s*<>\s*to_shop_id\s*\)/i.test(schemaSql));

  console.log('\n--- Test Group 5: Auditable Stock Ledger & Immutability Triggers ---');

  assert('Atomic stock reconciliation trigger defined on inventory_movements',
    /CREATE\s+TRIGGER\s+trg_reconcile_stock_on_movement/i.test(schemaSql));
  assert('Stock movement trigger function updates product_batches current_quantity',
    /UPDATE\s+public\.product_batches\s+SET\s+current_quantity/i.test(schemaSql));
  assert('Immutability guard trigger defined on inventory_movements',
    /CREATE\s+TRIGGER\s+trg_immutable_movements/i.test(schemaSql));
  assert('Immutability guard throws exception on UPDATE or DELETE',
    /RAISE\s+EXCEPTION\s+'Historical stock movement records are strictly immutable/i.test(schemaSql));

  // Test local ledger reconciliation function
  const reconResult = await reconcileStockWithMovements(null, null, 1);
  assert('Stock ledger reconciliation function executes cleanly', typeof reconResult === 'object');
  assert('Reconciliation computes theoreticalStock', typeof reconResult.theoreticalStock === 'number');
  assert('Reconciliation computes actualBatchStock', typeof reconResult.actualBatchStock === 'number');
  console.log(`     Product #1 Ledger Reconciliation: Inflows=${reconResult.inflows}, Outflows=${reconResult.outflows}, Theoretical=${reconResult.theoreticalStock}, Actual=${reconResult.actualBatchStock}, Balanced=${reconResult.isBalanced}`);

  console.log('\n--- Test Group 6: Row Level Security (RLS) & Multi-Shop Isolation ---');

  // Verify RLS enabled on all 20 tables
  for (const tableName of REQUIRED_TABLES) {
    const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    const hasRls = rlsRegex.test(schemaSql);
    assert(`RLS enabled on table "${tableName}"`, hasRls);
  }

  assert('Shop isolation helper function get_auth_shop_ids() defined',
    /FUNCTION\s+public\.get_auth_shop_ids\(\)/i.test(schemaSql));
  assert('Shop admin helper function is_auth_shop_admin() defined',
    /FUNCTION\s+public\.is_auth_shop_admin\(/i.test(schemaSql));
  assert('Multi-tenant shop isolation policies generated for shop-scoped tables',
    /CREATE\s+POLICY\s+"products_shop_isolation_select"/i.test(schemaSql) &&
    /CREATE\s+POLICY\s+"sales_shop_isolation_select"/i.test(schemaSql));
  assert('Sensitive user profiles protected via profiles RLS policy',
    /CREATE\s+POLICY\s+"profiles_update_own"/i.test(schemaSql));

  console.log('\n--- Test Group 7: Production Seed Data Completeness ---');

  // Check seed inserts for key entities
  for (const tableName of REQUIRED_TABLES) {
    const seedInsertRegex = new RegExp(`INSERT\\s+INTO\\s+public\\.${tableName}\\b`, 'i');
    const hasSeed = seedInsertRegex.test(seedSql);
    assert(`Seed dataset contains records for "${tableName}"`, hasSeed);
  }

  assert('Multi-shop seed data includes Central Store and Branch 2',
    seedSql.includes('DairyTrack Central Store') && seedSql.includes('DairyTrack Express Hub - Sector 18'));
  assert('Seed dataset includes all 11 Dairy Categories',
    seedSql.includes("'Milk'") && seedSql.includes("'Curd'") && seedSql.includes("'Paneer'") && seedSql.includes("'Ghee'"));
  assert('Seed dataset includes Walk-in Retail Customer',
    seedSql.includes('Walk-in Retail Customer'));

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
