const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

let supabaseClient = null;

// The 20 Canonical Normalized Relational Tables Required by Module 15
const REQUIRED_TABLES = [
  'profiles',
  'shops',
  'shop_members',
  'categories',
  'products',
  'suppliers',
  'customers',
  'product_batches',
  'purchases',
  'purchase_items',
  'sales',
  'sale_items',
  'payments',
  'inventory_movements',
  'stock_transfers',
  'returns',
  'return_items',
  'expenses',
  'notifications',
  'audit_logs'
];

function getSupabaseConfig() {
  const urlSetting = db.prepare("SELECT value FROM settings WHERE key = 'supabase_url'").get();
  const keySetting = db.prepare("SELECT value FROM settings WHERE key = 'supabase_anon_key'").get();

  const supabaseUrl = process.env.SUPABASE_URL || (urlSetting ? urlSetting.value : '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY || (keySetting ? keySetting.value : '');

  return { supabaseUrl, supabaseKey };
}

function getSupabaseClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();
  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    if (!supabaseClient) {
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
    return supabaseClient;
  }
  return null;
}

// -------------------------------------------------------------
// MODULE 15: MIGRATION FILES LOADERS & METADATA
// -------------------------------------------------------------
function getMigrationPaths() {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  return {
    schemaPath: path.join(migrationsDir, '20261117000001_initial_schema.sql'),
    seedPath: path.join(migrationsDir, '20261117000002_seed_data.sql')
  };
}

function loadMigrationSql(type = 'schema') {
  const { schemaPath, seedPath } = getMigrationPaths();
  const target = type === 'schema' ? schemaPath : seedPath;
  if (!fs.existsSync(target)) {
    throw new Error(`Migration SQL file not found at ${target}`);
  }
  return fs.readFileSync(target, 'utf8');
}

/**
 * Reconciles batch stock against inventory movements ledger (Important Inventory Rule)
 */
async function reconcileStockWithMovements(client, shopId, productId) {
  if (!client) {
    // Local SQLite fallback execution
    const movementRows = db.prepare(`
      SELECT flow_type, COALESCE(SUM(quantity), 0) as total_qty
      FROM stock_movements
      WHERE product_id = ?
      GROUP BY flow_type
    `).all(productId);

    let inflows = 0;
    let outflows = 0;
    movementRows.forEach(r => {
      if (r.flow_type === 'Inflow') inflows = Number(r.total_qty);
      else if (r.flow_type === 'Outflow') outflows = Number(r.total_qty);
    });

    const theoreticalStock = inflows - outflows;
    const batchRow = db.prepare('SELECT COALESCE(SUM(current_quantity), 0) as stock FROM batches WHERE product_id = ? AND current_quantity > 0').get(productId);
    const actualBatchStock = Number(batchRow ? batchRow.stock : 0);

    return {
      productId,
      inflows,
      outflows,
      theoreticalStock,
      actualBatchStock,
      isBalanced: Math.abs(theoreticalStock - actualBatchStock) < 0.001,
      discrepancy: Number((actualBatchStock - theoreticalStock).toFixed(3))
    };
  }

  // Supabase PostgreSQL query implementation
  const { data: movements, error: mErr } = await client
    .from('inventory_movements')
    .select('flow_type, quantity')
    .eq('shop_id', shopId)
    .eq('product_id', productId);

  if (mErr) throw mErr;

  let inflows = 0;
  let outflows = 0;
  (movements || []).forEach(m => {
    if (m.flow_type === 'Inflow') inflows += Number(m.quantity);
    else if (m.flow_type === 'Outflow') outflows += Number(m.quantity);
  });

  const { data: batches, error: bErr } = await client
    .from('product_batches')
    .select('current_quantity')
    .eq('shop_id', shopId)
    .eq('product_id', productId);

  if (bErr) throw bErr;

  let actualBatchStock = 0;
  (batches || []).forEach(b => {
    actualBatchStock += Number(b.current_quantity);
  });

  const theoreticalStock = inflows - outflows;
  return {
    productId,
    inflows,
    outflows,
    theoreticalStock,
    actualBatchStock,
    isBalanced: Math.abs(theoreticalStock - actualBatchStock) < 0.001,
    discrepancy: Number((actualBatchStock - theoreticalStock).toFixed(3))
  };
}

// Supabase Auth Helpers
async function supabaseSignIn(email, password) {
  const client = getSupabaseClient();
  if (!client) return null; // Fallback to local auth
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase signIn error:', err.message);
    throw err;
  }
}

async function supabaseSignUp(email, password, userMetadata = {}) {
  const client = getSupabaseClient();
  if (!client) return null; // Fallback to local auth
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: userMetadata }
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase signUp error:', err.message);
    throw err;
  }
}

async function supabaseResetPassword(email) {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase resetPassword error:', err.message);
    throw err;
  }
}

module.exports = {
  REQUIRED_TABLES,
  getSupabaseConfig,
  getSupabaseClient,
  getMigrationPaths,
  loadMigrationSql,
  reconcileStockWithMovements,
  supabaseSignIn,
  supabaseSignUp,
  supabaseResetPassword
};
