const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, 'dairytrack.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for reliability and speed
db.exec('PRAGMA foreign_keys = ON;');

// Crypto Helpers for local Auth fallback & session tokens
function hashPassword(password, salt = null) {
  if (!salt) salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  try {
    // 1. Check with modern 100,000 iterations (Module 18 standard)
    const checkNew = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const bufCheckNew = Buffer.from(checkNew, 'hex');
    const bufHash = Buffer.from(hash, 'hex');
    if (bufCheckNew.length === bufHash.length && crypto.timingSafeEqual(bufCheckNew, bufHash)) {
      return true;
    }

    // 2. Backward compatibility fallback to legacy 10,000 iterations for pre-existing seed users
    const checkOld = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const bufCheckOld = Buffer.from(checkOld, 'hex');
    if (bufCheckOld.length === bufHash.length && crypto.timingSafeEqual(bufCheckOld, bufHash)) {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function logAudit(userId, userName, userRole, action, entityType = null, entityId = null, details = null, ipAddress = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId || null, userName || 'System', userRole || 'System', action, entityType, entityId ? String(entityId) : null, details, ipAddress);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      phone TEXT,
      is_main INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'milk'
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id),
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT,
      unit TEXT NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      min_stock_level REAL DEFAULT 10,
      shelf_life_days INTEGER DEFAULT 3,
      storage_temperature TEXT DEFAULT '2°C - 4°C',
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT,
      contact_person TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      gst_number TEXT,
      balance_due REAL DEFAULT 0,
      payment_terms TEXT DEFAULT 'Net 15',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      payment_date DATE NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'Bank Transfer', -- 'Bank Transfer / NEFT', 'UPI', 'Cash', 'Cheque'
      reference_no TEXT,
      notes TEXT,
      recorded_by TEXT DEFAULT 'Administrator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      type TEXT DEFAULT 'Retail',
      credit_balance REAL DEFAULT 0,
      loyalty_points INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      batch_number TEXT NOT NULL,
      mfg_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      initial_quantity REAL NOT NULL,
      current_quantity REAL NOT NULL,
      purchase_cost REAL NOT NULL,
      selling_price REAL NOT NULL,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      purchase_date DATE NOT NULL,
      total_amount REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'Paid',
      payment_method TEXT DEFAULT 'Bank Transfer',
      status TEXT DEFAULT 'Received', -- 'Draft', 'Received', 'Cancelled'
      received_at DATETIME,
      received_by TEXT,
      notes TEXT,
      created_by TEXT DEFAULT 'Administrator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      batch_id INTEGER REFERENCES batches(id),
      batch_number TEXT NOT NULL,
      mfg_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      purchase_id INTEGER REFERENCES purchases(id),
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      batch_id INTEGER REFERENCES batches(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_return_value REAL NOT NULL,
      reason TEXT NOT NULL,
      refund_type TEXT DEFAULT 'Credit Note', -- 'Credit Note', 'Cash Refund', 'Replacement'
      return_date DATE NOT NULL,
      returned_by TEXT DEFAULT 'Administrator',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      sale_date DATE NOT NULL,
      total_amount REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      total_cost REAL NOT NULL DEFAULT 0,
      profit_earned REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      payment_status TEXT DEFAULT 'Paid',
      cashier_id INTEGER,
      cashier_name TEXT DEFAULT 'Admin',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      batch_id INTEGER REFERENCES batches(id),
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_price REAL NOT NULL,
      profit REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_type TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id),
      batch_id INTEGER REFERENCES batches(id),
      from_branch_id INTEGER REFERENCES branches(id),
      to_branch_id INTEGER REFERENCES branches(id),
      quantity REAL NOT NULL,
      unit TEXT,
      previous_stock REAL DEFAULT 0,
      updated_stock REAL DEFAULT 0,
      flow_type TEXT DEFAULT 'Inflow', -- 'Inflow' or 'Outflow'
      reference_txn TEXT,
      reason TEXT,
      cost_impact REAL DEFAULT 0,
      performed_by TEXT DEFAULT 'Administrator',
      correction_of_id INTEGER REFERENCES stock_movements(id),
      movement_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS waste_damaged (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      batch_id INTEGER REFERENCES batches(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_loss_value REAL NOT NULL,
      reason TEXT NOT NULL,
      action_taken TEXT DEFAULT 'Discarded',
      recorded_date DATE NOT NULL,
      recorded_by TEXT DEFAULT 'Administrator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      sha256_checksum TEXT NOT NULL,
      backup_type TEXT DEFAULT 'manual',
      created_by TEXT DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Module 18: Negative inventory prevention triggers
    CREATE TRIGGER IF NOT EXISTS trg_prevent_negative_batches_update
    BEFORE UPDATE ON batches
    FOR EACH ROW
    WHEN NEW.current_quantity < 0
    BEGIN
      SELECT RAISE(ABORT, 'NEGATIVE_INVENTORY_PREVENTED: current_quantity cannot be negative');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_prevent_negative_batches_insert
    BEFORE INSERT ON batches
    FOR EACH ROW
    WHEN NEW.current_quantity < 0
    BEGIN
      SELECT RAISE(ABORT, 'NEGATIVE_INVENTORY_PREVENTED: current_quantity cannot be negative');
    END;

    -- Module 18: Protect completed transactions from unauthorized deletion
    CREATE TRIGGER IF NOT EXISTS trg_protect_completed_sales_delete
    BEFORE DELETE ON sales
    FOR EACH ROW
    WHEN OLD.payment_status = 'Paid'
    BEGIN
      SELECT RAISE(ABORT, 'COMPLETED_TRANSACTIONS_IMMUTABLE: Completed sales cannot be deleted. Process a customer return instead.');
    END;
  `);

  migrateUsersTable();
}

function migrateUsersTable() {
  // Check if users table needs recreating to conform cleanly to Module 2 schema
  let needsRecreate = false;
  try {
    const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    if (!cols.includes('password_hash') || cols.includes('password')) {
      needsRecreate = true;
    }
  } catch {
    needsRecreate = true;
  }

  if (needsRecreate) {
    db.exec('DROP TABLE IF EXISTS users;');
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supabase_uid TEXT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Shopkeeper', -- 'Administrator', 'Manager', 'Shopkeeper'
        phone TEXT,
        branch_id INTEGER REFERENCES branches(id),
        is_active INTEGER DEFAULT 1,
        last_login DATETIME,
        reset_token TEXT,
        reset_token_expires DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('🔐 Users table initialized with Administrator, Manager, and Shopkeeper roles.');

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, username, password_hash, salt, role, phone, branch_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    // 1. Administrator (Complete application access)
    const adminPass = hashPassword('admin123');
    insertUser.run('Suresh Sharma (Owner)', 'admin@dairytrack.com', 'admin', adminPass.hash, adminPass.salt, 'Administrator', '+91 98765 00001', 1);

    // 2. Manager (Manage stock, purchases, sales, analytics, reports, suppliers)
    const managerPass = hashPassword('manager123');
    insertUser.run('Kavita Patel (Store Manager)', 'manager@dairytrack.com', 'manager', managerPass.hash, managerPass.salt, 'Manager', '+91 98765 00002', 1);

    // 3. Shopkeeper / Staff (Record sales, create bills, check stock, authorized movements)
    const cashierPass = hashPassword('staff123');
    insertUser.run('Rahul Verma (Billing Staff)', 'shopkeeper@dairytrack.com', 'shopkeeper', cashierPass.hash, cashierPass.salt, 'Shopkeeper', '+91 98765 00003', 1);

    // 4. Shopkeeper 2
    const storePass = hashPassword('staff123');
    insertUser.run('Anil Yadav (Store Keeper)', 'anil@dairytrack.com', 'anil', storePass.hash, storePass.salt, 'Shopkeeper', '+91 98765 00004', 1);

    logAudit(1, 'Suresh Sharma', 'Administrator', 'SYSTEM_INITIALIZATION', 'SYSTEM', '1', 'Initial system seeding with Administrator, Manager, and Shopkeeper accounts.');
  }

  // Ensure default Supabase settings keys exist
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('supabase_url', '');
  insertSetting.run('supabase_anon_key', '');

  // Safety column migrations
  try {
    const pCols = db.prepare('PRAGMA table_info(purchases)').all().map(c => c.name);
    if (!pCols.includes('created_by')) {
      db.exec("ALTER TABLE purchases ADD COLUMN created_by TEXT DEFAULT 'Administrator';");
    }
  } catch (e) {
    console.error('Migration error on purchases:', e.message);
  }

  // Module 4: Product Table Migrations & 11 Dairy Categories
  try {
    const prCols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
    if (!prCols.includes('image_url')) {
      db.exec('ALTER TABLE products ADD COLUMN image_url TEXT;');
    }
    if (!prCols.includes('supplier_id')) {
      db.exec('ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id);');
    }
    if (!prCols.includes('status')) {
      db.exec("ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'Active';");
    }

    // Seed 11 Required Dairy Categories (Module 4.2)
    const defaultCategories = [
      { name: 'Milk', description: 'Fresh cow, buffalo, toned & pasteurized milk', icon: 'milk' },
      { name: 'Curd', description: 'Fresh curd, probiotic dahi & set yogurt', icon: 'cup-soda' },
      { name: 'Buttermilk', description: 'Chaas, spiced buttermilk & lassi', icon: 'glass-water' },
      { name: 'Paneer', description: 'Fresh malai paneer & diced cottage cheese', icon: 'box' },
      { name: 'Butter', description: 'Salted table butter, white makkhan & cooking butter', icon: 'cookie' },
      { name: 'Ghee', description: 'Pure desi cow ghee, buffalo ghee & bilona ghee', icon: 'sparkles' },
      { name: 'Cheese', description: 'Cheddar slices, mozzarella blocks & cheese cubes', icon: 'layers' },
      { name: 'Cream', description: 'Fresh dairy cream & malai for cooking', icon: 'cloud' },
      { name: 'Flavoured Milk', description: 'Badam, chocolate, strawberry & kesar milk', icon: 'cup' },
      { name: 'Ice Cream', description: 'Kulfi, party tubs, ice cream bars & cones', icon: 'ice-cream' },
      { name: 'Other Dairy Products', description: 'Khoya, mawa, condensed milk & specialty items', icon: 'package' }
    ];

    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, description, icon) VALUES (?, ?, ?)');
    defaultCategories.forEach(cat => {
      insertCat.run(cat.name, cat.description, cat.icon);
    });

    // Link products to suppliers and categories if null
    db.exec(`
      UPDATE products SET status = 'Active' WHERE status IS NULL;
      UPDATE products SET supplier_id = 1 WHERE supplier_id IS NULL AND (category_id = 1 OR category_id = 2);
      UPDATE products SET supplier_id = 2 WHERE supplier_id IS NULL AND (category_id = 3 OR category_id = 4);
      UPDATE products SET supplier_id = 3 WHERE supplier_id IS NULL AND (category_id = 5 OR category_id = 6);
      UPDATE products SET supplier_id = 4 WHERE supplier_id IS NULL;
    `);

    // Assign clean category mapping where legacy categories were used
    const milkCat = db.prepare("SELECT id FROM categories WHERE name = 'Milk'").get();
    const curdCat = db.prepare("SELECT id FROM categories WHERE name = 'Curd'").get();
    const paneerCat = db.prepare("SELECT id FROM categories WHERE name = 'Paneer'").get();
    const butterCat = db.prepare("SELECT id FROM categories WHERE name = 'Butter'").get();
    const gheeCat = db.prepare("SELECT id FROM categories WHERE name = 'Ghee'").get();
    const cheeseCat = db.prepare("SELECT id FROM categories WHERE name = 'Cheese'").get();
    const buttermilkCat = db.prepare("SELECT id FROM categories WHERE name = 'Buttermilk'").get();
    const iceCreamCat = db.prepare("SELECT id FROM categories WHERE name = 'Ice Cream'").get();
    const flavMilkCat = db.prepare("SELECT id FROM categories WHERE name = 'Flavoured Milk'").get();
    const creamCat = db.prepare("SELECT id FROM categories WHERE name = 'Cream'").get();
    const otherCat = db.prepare("SELECT id FROM categories WHERE name = 'Other Dairy Products'").get();

    if (milkCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Milk%' AND name NOT LIKE '%Badam%' AND name NOT LIKE '%Chocolate%'").run(milkCat.id);
    if (curdCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Curd%' OR name LIKE '%Dahi%' OR name LIKE '%Yogurt%'").run(curdCat.id);
    if (paneerCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Paneer%'").run(paneerCat.id);
    if (butterCat) db.prepare("UPDATE products SET category_id = ? WHERE (name LIKE '%Butter%' OR name LIKE '%Makkhan%') AND name NOT LIKE '%Milk%' AND name NOT LIKE '%Chaas%'").run(butterCat.id);
    if (gheeCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Ghee%'").run(gheeCat.id);
    if (cheeseCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Cheese%'").run(cheeseCat.id);
    if (buttermilkCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Chaas%' OR name LIKE '%Buttermilk%' OR name LIKE '%Lassi%'").run(buttermilkCat.id);
    if (iceCreamCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Ice Cream%' OR name LIKE '%Kulfi%' OR name LIKE '%Party Tub%'").run(iceCreamCat.id);
    if (flavMilkCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Badam%' OR name LIKE '%Flavored%' OR name LIKE '%Flavoured%'").run(flavMilkCat.id);
    if (otherCat) db.prepare("UPDATE products SET category_id = ? WHERE name LIKE '%Rasgulla%' OR name LIKE '%Shrikhand%' OR name LIKE '%Mawa%' OR name LIKE '%Khoya%'").run(otherCat.id);

    // Fallback: If any product still has category_id <= 8, assign to 'Other Dairy Products'
    if (otherCat) {
      db.prepare("UPDATE products SET category_id = ? WHERE category_id <= 8").run(otherCat.id);
    }

    // Now delete legacy categories <= 8
    db.exec(`
      DELETE FROM categories WHERE id <= 8 AND name NOT IN ('Milk', 'Curd', 'Buttermilk', 'Paneer', 'Butter', 'Ghee', 'Cheese', 'Cream', 'Flavoured Milk', 'Ice Cream', 'Other Dairy Products');
    `);

    // Ensure at least one product in Cream category
    if (creamCat) {
      const creamProd = db.prepare('SELECT id FROM products WHERE category_id = ?').get(creamCat.id);
      if (!creamProd) {
        db.prepare(`
          INSERT INTO products (
            category_id, name, sku, barcode, unit, purchase_price, selling_price,
            min_stock_level, shelf_life_days, storage_temperature, description, supplier_id, status
          ) VALUES (?, 'Fresh Dairy Cooking Cream 250ml', 'CRM-250-01', '890103001889', 'Millilitres', 52.00, 70.00, 15, 10, '2°C - 4°C', 'Rich 25% fat pasteurized fresh cream for cooking and coffee', 2, 'Active')
        `).run(creamCat.id);
      }
    }

    // Module 5: Batch Supplier Link & Inventory Alert Settings
    const bCols = db.prepare('PRAGMA table_info(batches)').all().map(c => c.name);
    if (!bCols.includes('supplier_id')) {
      db.exec('ALTER TABLE batches ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id);');
    }

    // Default batches supplier link based on product's preferred supplier
    db.exec(`
      UPDATE batches SET supplier_id = (SELECT supplier_id FROM products WHERE products.id = batches.product_id)
      WHERE supplier_id IS NULL;
    `);

    // Ensure configurable inventory alert settings exist
    const insertAlertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insertAlertSetting.run('alert_expiry_warning_days', '7');
    insertAlertSetting.run('alert_expiry_critical_days', '3');
    insertAlertSetting.run('alert_unusual_adjustment_qty', '25');
    insertAlertSetting.run('alert_unusual_adjustment_cost', '1000');

    // Module 6: Sales & POS Billing Column Migrations
    const sCols = db.prepare('PRAGMA table_info(sales)').all().map(c => c.name);
    if (!sCols.includes('transaction_id')) {
      db.exec('ALTER TABLE sales ADD COLUMN transaction_id TEXT;');
    }
    if (!sCols.includes('payment_ref')) {
      db.exec('ALTER TABLE sales ADD COLUMN payment_ref TEXT;');
    }
    if (!sCols.includes('payment_details')) {
      db.exec('ALTER TABLE sales ADD COLUMN payment_details TEXT;');
    }

    // Default shop & billing settings
    const insertBillSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insertBillSetting.run('tax_gst_enabled', '1');
    insertBillSetting.run('tax_gst_percent', '5.0');
    insertBillSetting.run('shop_name', 'DairyTrack Smart Dairy & Creamery');
    insertBillSetting.run('shop_address', '124 Milkman Boulevard, Dairy Hub, Sector 4');
    insertBillSetting.run('shop_phone', '+91 98765 43210');
    insertBillSetting.run('shop_gstin', '07AAAAA0000A1Z5');
    insertBillSetting.run('upi_vpa', 'dairytrack@upi');

    // Module 7: Purchases & Procurement Migrations
    const purCols = db.prepare('PRAGMA table_info(purchases)').all().map(c => c.name);
    if (!purCols.includes('status')) {
      db.exec("ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'Received';");
    }
    if (!purCols.includes('received_at')) {
      db.exec("ALTER TABLE purchases ADD COLUMN received_at DATETIME;");
    }
    if (!purCols.includes('received_by')) {
      db.exec("ALTER TABLE purchases ADD COLUMN received_by TEXT;");
    }
    // Update existing purchases to have received_at and received_by
    db.exec(`
      UPDATE purchases 
      SET received_at = created_at, received_by = COALESCE(created_by, 'Administrator'), status = 'Received' 
      WHERE status IS NULL OR status = '';
    `);

    const piCols = db.prepare('PRAGMA table_info(purchase_items)').all().map(c => c.name);
    if (!piCols.includes('batch_id')) {
      db.exec("ALTER TABLE purchase_items ADD COLUMN batch_id INTEGER REFERENCES batches(id);");
    }

    // Link existing purchase_items to batches where batch_number matches
    db.exec(`
      UPDATE purchase_items
      SET batch_id = (
        SELECT id FROM batches 
        WHERE batches.batch_number = purchase_items.batch_number 
        LIMIT 1
      )
      WHERE batch_id IS NULL;
    `);

    // Ensure supplier_returns table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_no TEXT UNIQUE NOT NULL,
        purchase_id INTEGER REFERENCES purchases(id),
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        batch_id INTEGER REFERENCES batches(id),
        branch_id INTEGER NOT NULL REFERENCES branches(id),
        quantity REAL NOT NULL,
        unit_cost REAL NOT NULL,
        total_return_value REAL NOT NULL,
        reason TEXT NOT NULL,
        refund_type TEXT DEFAULT 'Credit Note',
        return_date DATE NOT NULL,
        returned_by TEXT DEFAULT 'Administrator',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Module 8: Stock Movements Column Migrations & Backfill
    const smCols = db.prepare('PRAGMA table_info(stock_movements)').all().map(c => c.name);
    if (!smCols.includes('unit')) {
      db.exec("ALTER TABLE stock_movements ADD COLUMN unit TEXT;");
    }
    if (!smCols.includes('previous_stock')) {
      db.exec("ALTER TABLE stock_movements ADD COLUMN previous_stock REAL DEFAULT 0;");
    }
    if (!smCols.includes('updated_stock')) {
      db.exec("ALTER TABLE stock_movements ADD COLUMN updated_stock REAL DEFAULT 0;");
    }
    if (!smCols.includes('flow_type')) {
      db.exec("ALTER TABLE stock_movements ADD COLUMN flow_type TEXT DEFAULT 'Inflow';");
    }
    if (!smCols.includes('reference_txn')) {
      db.exec("ALTER TABLE stock_movements ADD COLUMN reference_txn TEXT;");
    }
    if (!smCols.includes('correction_of_id')) {
      db.exec("ALTER TABLE stock_movements ADD COLUMN correction_of_id INTEGER REFERENCES stock_movements(id);");
    }

    // Backfill unit and flow_type for existing records
    db.exec(`
      UPDATE stock_movements 
      SET unit = (SELECT unit FROM products WHERE products.id = stock_movements.product_id) 
      WHERE unit IS NULL OR unit = '';
    `);

    db.exec(`
      UPDATE stock_movements
      SET flow_type = CASE 
        WHEN movement_type IN ('Opening Stock', 'Purchase Received', 'Purchase', 'Customer Return', 'Sale Return', 'Transfer In', 'Authorized Stock Correction') THEN 'Inflow'
        ELSE 'Outflow'
      END;
    `);

    db.exec(`
      UPDATE stock_movements
      SET reference_txn = CASE
        WHEN reason LIKE '%invoice #%' THEN 'INV-' || TRIM(SUBSTR(reason, INSTR(reason, '#') + 1))
        WHEN reason LIKE '%PO: %' THEN TRIM(SUBSTR(reason, INSTR(reason, 'PO: ') + 4))
        WHEN reason LIKE '%SR-%' THEN TRIM(SUBSTR(reason, INSTR(reason, 'SR-')))
        WHEN movement_type = 'Opening Stock' THEN 'OPENING-STOCK'
        ELSE 'MOV-' || id
      END
      WHERE reference_txn IS NULL OR reference_txn = '' OR reference_txn LIKE 'MOV-REF-%';
    `);

    // Backfill baseline previous_stock and updated_stock if both 0
    db.exec(`
      UPDATE stock_movements
      SET 
        previous_stock = CASE WHEN flow_type = 'Inflow' THEN 0 ELSE quantity END,
        updated_stock = CASE WHEN flow_type = 'Inflow' THEN quantity ELSE 0 END
      WHERE previous_stock = 0 AND updated_stock = 0;
    `);

    // Module 9: Suppliers Column Migrations & Supplier Payments Table
    const suppCols = db.prepare('PRAGMA table_info(suppliers)').all().map(c => c.name);
    if (!suppCols.includes('company_name')) {
      db.exec("ALTER TABLE suppliers ADD COLUMN company_name TEXT;");
    }
    if (!suppCols.includes('status')) {
      db.exec("ALTER TABLE suppliers ADD COLUMN status TEXT DEFAULT 'Active';");
    }

    db.exec(`
      UPDATE suppliers 
      SET company_name = name 
      WHERE company_name IS NULL OR company_name = '';
    `);

    db.exec(`
      UPDATE suppliers 
      SET status = 'Active' 
      WHERE status IS NULL OR status = '';
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL,
        amount REAL NOT NULL,
        payment_mode TEXT DEFAULT 'Bank Transfer',
        reference_no TEXT,
        notes TEXT,
        recorded_by TEXT DEFAULT 'Administrator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed baseline supplier payments if none exist
    const payCount = db.prepare('SELECT COUNT(*) as count FROM supplier_payments').get().count;
    if (payCount === 0) {
      db.exec(`
        INSERT INTO supplier_payments (supplier_id, payment_date, amount, payment_mode, reference_no, notes, recorded_by)
        VALUES 
          (1, '2026-11-10', 20000, 'Bank Transfer', 'NEFT-GV-9012', 'Weekly milk procurement bulk settlement', 'Administrator'),
          (1, '2026-11-14', 10000, 'UPI', 'UPI-94123-01', 'Partial settlement for weekend milk collection', 'Administrator'),
          (2, '2026-11-12', 30000, 'Cheque', 'CHQ-449102', 'Full payment for monthly bulk shipment', 'Administrator'),
          (3, '2026-11-05', 15000, 'Bank Transfer', 'NEFT-KDG-1102', 'Immediate dispatch settlement for desi ghee consignment', 'Administrator');
      `);
    }

    // Module 10: Customers Column Migrations, Customer Returns & Payments Tables
    const custCols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
    if (!custCols.includes('status')) {
      db.exec("ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'Active';");
    }
    if (!custCols.includes('notes')) {
      db.exec("ALTER TABLE customers ADD COLUMN notes TEXT;");
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_no TEXT UNIQUE NOT NULL,
        sale_id INTEGER REFERENCES sales(id),
        customer_id INTEGER REFERENCES customers(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        batch_id INTEGER REFERENCES batches(id),
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        refund_amount REAL NOT NULL,
        reason TEXT NOT NULL,
        refund_method TEXT DEFAULT 'Cash',
        return_date DATE NOT NULL,
        processed_by TEXT DEFAULT 'Staff',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL,
        amount REAL NOT NULL,
        payment_mode TEXT DEFAULT 'Cash',
        reference_no TEXT,
        notes TEXT,
        received_by TEXT DEFAULT 'Staff',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure Walk-in customer baseline exists with ID 5
    const walkIn = db.prepare('SELECT id FROM customers WHERE id = 5').get();
    if (!walkIn) {
      db.exec(`
        INSERT INTO customers (id, name, phone, email, address, type, credit_balance, loyalty_points, status, notes)
        VALUES (5, 'Walk-in Retail Customer', '+91 99999 99999', 'walkin@dairytrack.com', 'Counter Sales', 'Retail', 0, 0, 'Active', 'Standard walk-in customer profile');
      `);
    }

    // Seed sample customer payments and returns if empty
    const cpCount = db.prepare('SELECT COUNT(*) as count FROM customer_payments').get().count;
    if (cpCount === 0) {
      db.exec(`
        INSERT INTO customer_payments (customer_id, payment_date, amount, payment_mode, reference_no, notes, received_by)
        VALUES 
          (1, '2026-11-12', 3000, 'UPI', 'UPI-SHARMA-1101', 'Partial Udhar payment for catering event milk', 'Admin'),
          (2, '2026-11-14', 5000, 'Bank Transfer', 'NEFT-ANAND-8891', 'Udhar settlement payment from Hotel Anand Royal', 'Admin'),
          (3, '2026-11-16', 500, 'Cash', 'CASH-REC-102', 'Weekly subscription cash collection', 'Staff');
      `);
    }

    const crCount = db.prepare('SELECT COUNT(*) as count FROM customer_returns').get().count;
    if (crCount === 0) {
      db.exec(`
        INSERT INTO customer_returns (return_no, sale_id, customer_id, product_id, batch_id, quantity, unit_price, refund_amount, reason, refund_method, return_date, processed_by)
        VALUES 
          ('CR-1011', 1, 1, 1, 1, 2, 33, 66, 'Packaging seal leaking during transit', 'Store Credit / Udhar Adjustment', '2026-11-16', 'Admin');
      `);
    }

    // Module 11: Expiry and Wastage Column Migrations
    const wasteCols = db.prepare('PRAGMA table_info(waste_damaged)').all().map(c => c.name);
    if (!wasteCols.includes('waste_type')) {
      db.exec("ALTER TABLE waste_damaged ADD COLUMN waste_type TEXT DEFAULT 'Spoiled';");
    }
    if (!wasteCols.includes('unit')) {
      db.exec("ALTER TABLE waste_damaged ADD COLUMN unit TEXT;");
    }

    db.exec(`
      UPDATE waste_damaged
      SET unit = (SELECT unit FROM products WHERE products.id = waste_damaged.product_id)
      WHERE unit IS NULL OR unit = '';
    `);

    db.exec(`
      UPDATE waste_damaged
      SET waste_type = CASE 
        WHEN LOWER(reason) LIKE '%expire%' THEN 'Expired'
        WHEN LOWER(reason) LIKE '%leak%' OR LOWER(reason) LIKE '%crack%' OR LOWER(reason) LIKE '%damage%' OR LOWER(reason) LIKE '%burst%' THEN 'Damaged'
        WHEN LOWER(reason) LIKE '%spill%' OR LOWER(reason) LIKE '%overflow%' THEN 'Spilled'
        WHEN LOWER(reason) LIKE '%curdle%' OR LOWER(reason) LIKE '%sour%' OR LOWER(reason) LIKE '%taste%' OR LOWER(reason) LIKE '%cold chain%' THEN 'Spoiled'
        ELSE 'Other Wastage'
      END
      WHERE waste_type IS NULL OR waste_type = 'Spoiled' OR waste_type = '';
    `);

    // Module 12: Operating Expenses Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_date DATE NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_mode TEXT DEFAULT 'Bank Transfer',
        branch_id INTEGER DEFAULT 1 REFERENCES branches(id),
        reference_no TEXT,
        notes TEXT,
        recorded_by TEXT DEFAULT 'Administrator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const expCount = db.prepare('SELECT COUNT(*) as count FROM expenses').get().count;
    if (expCount === 0) {
      db.exec(`
        INSERT INTO expenses (expense_date, category, title, amount, payment_mode, reference_no, notes, recorded_by)
        VALUES 
          ('2026-11-01', 'Rent', 'Dairy Shop & Cold Room Monthly Rent', 25000, 'Bank Transfer', 'NEFT-RENT-NOV26', 'Showroom and cold store premises', 'Admin'),
          ('2026-11-05', 'Electricity', 'Commercial Chillers & Deep Freezers Power Bill', 14500, 'UPI', 'UPI-EB-88910', 'Monthly electricity bill for 3 chillers and vats', 'Admin'),
          ('2026-11-08', 'Transport', 'Daily Milk Procurement & Delivery Van Fuel', 8200, 'UPI', 'UPI-FUEL-4412', 'Diesel for milk transport van', 'Staff'),
          ('2026-11-10', 'Employee Salaries', 'Staff Wages (2 Cashiers & 1 Delivery Executive)', 32000, 'Bank Transfer', 'SAL-NOV26-ALL', 'Staff salary disbursement for November', 'Admin'),
          ('2026-11-12', 'Other Expenses', 'Milk Testing Chemicals & Poly Packaging Rolls', 4800, 'Cash', 'CASH-EXP-109', 'Lactometer chemicals, butter paper, polybags', 'Staff');
      `);
    }

    // Module 14: In-App Notification Center Columns & Configuration
    const notifCols = db.prepare('PRAGMA table_info(notifications)').all().map(c => c.name);
    if (!notifCols.includes('link_view')) {
      db.exec("ALTER TABLE notifications ADD COLUMN link_view TEXT;");
    }
    if (!notifCols.includes('reference_id')) {
      db.exec("ALTER TABLE notifications ADD COLUMN reference_id TEXT;");
    }
    if (!notifCols.includes('category')) {
      db.exec("ALTER TABLE notifications ADD COLUMN category TEXT DEFAULT 'system';");
    }

    // Seed Configurable Notification Settings
    const insertNotifSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insertNotifSetting.run('notify_low_stock', '1');
    insertNotifSetting.run('notify_out_of_stock', '1');
    insertNotifSetting.run('notify_near_expiry', '1');
    insertNotifSetting.run('notify_expired_products', '1');
    insertNotifSetting.run('notify_unusual_wastage', '1');
    insertNotifSetting.run('notify_new_purchases', '1');
    insertNotifSetting.run('notify_sales_completion', '1');
    insertNotifSetting.run('notify_failed_transactions', '1');
    insertNotifSetting.run('notify_system_events', '1');
    insertNotifSetting.run('notify_expiry_days', '3');
    insertNotifSetting.run('notify_wastage_threshold', '500');
    insertNotifSetting.run('notify_sound_enabled', '1');
    insertNotifSetting.run('notify_toasts_enabled', '1');

    // Update existing notifications with category and link_view
    db.exec(`
      UPDATE notifications SET category = 'expiry', link_view = 'expiry' WHERE type = 'expiry' AND (link_view IS NULL OR link_view = '');
      UPDATE notifications SET category = 'wastage', link_view = 'expiry' WHERE type = 'loss' AND (link_view IS NULL OR link_view = '');
      UPDATE notifications SET category = 'sales', link_view = 'sales' WHERE type = 'sale' AND (link_view IS NULL OR link_view = '');
      UPDATE notifications SET category = 'customers', link_view = 'customers' WHERE type = 'credit' AND (link_view IS NULL OR link_view = '');
      UPDATE notifications SET category = 'system', link_view = 'settings' WHERE category IS NULL OR category = '';
    `);

    // Ensure sample notifications for all required categories exist
    const hasOutStock = db.prepare("SELECT id FROM notifications WHERE type = 'stock_out'").get();
    if (!hasOutStock) {
      db.prepare(`
        INSERT INTO notifications (type, category, title, message, severity, is_read, link_view, created_at)
        VALUES 
          ('stock_out', 'stock', 'Out of Stock: Fresh Malai Paneer 1kg', 'Current stock is 0 units. Immediate supplier reorder recommended.', 'danger', 0, 'inventory', datetime('now', '-2 hours')),
          ('stock_low', 'stock', 'Low Stock Alert: Salted Table Butter 500g', 'Stock has fallen to 12 packets (Minimum threshold: 15 packets).', 'warning', 0, 'inventory', datetime('now', '-4 hours')),
          ('purchase_new', 'purchases', 'New Purchase Order Received: PO-1004', 'Confirmed receipt of 120 units from Amrit Milk Producers (₹7,200).', 'info', 0, 'purchases', datetime('now', '-1 day')),
          ('transaction_failed', 'sales', 'Failed Transaction: Card Payment Decline', 'Card transaction reference TXN-9981 declined by bank network. Order cancelled.', 'danger', 0, 'sales', datetime('now', '-6 hours')),
          ('system_event', 'system', 'System Security: Daily Ledger Backup', 'Automated nightly database checkpoint and ledger balance completed successfully.', 'info', 1, 'settings', datetime('now', '-18 hours'))
      `).run();
    }

  } catch (e) {
    console.error('Migration error on products/categories/batches:', e.message);
  }
}

// -------------------------------------------------------------
// MODULE 4.3: MEASUREMENT UNIT DEFINITIONS & CONVERSION UTILITY
// -------------------------------------------------------------
const UNIT_DEFINITIONS = {
  'Litres': { dimension: 'volume', factor: 1000, label: 'Litres', symbol: 'L' },
  'Millilitres': { dimension: 'volume', factor: 1, label: 'Millilitres', symbol: 'ml' },
  'Kilograms': { dimension: 'weight', factor: 1000, label: 'Kilograms', symbol: 'kg' },
  'Grams': { dimension: 'weight', factor: 1, label: 'Grams', symbol: 'g' },
  'Pieces': { dimension: 'count', factor: 1, label: 'Pieces', symbol: 'pcs' },
  'Packets': { dimension: 'count', factor: 1, label: 'Packets', symbol: 'pkt' },
  'Bottles': { dimension: 'count', factor: 1, label: 'Bottles', symbol: 'btl' }
};

function canConvertUnits(fromUnit, toUnit) {
  const from = UNIT_DEFINITIONS[fromUnit];
  const to = UNIT_DEFINITIONS[toUnit];
  if (!from || !to) return false;
  return from.dimension === to.dimension;
}

function convertQuantity(quantity, fromUnit, toUnit) {
  if (fromUnit === toUnit) return quantity;
  const from = UNIT_DEFINITIONS[fromUnit];
  const to = UNIT_DEFINITIONS[toUnit];
  if (!from || !to || from.dimension !== to.dimension) {
    throw new Error(`Incompatible measurement units: cannot combine or convert ${fromUnit} (${from?.dimension}) with ${toUnit} (${to?.dimension})`);
  }
  const baseValue = quantity * from.factor;
  return Number((baseValue / to.factor).toFixed(3));
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function addDays(d, days) {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
}

// -------------------------------------------------------------
// MODULE 18: DATABASE BACKUP & RESTORATION ENGINE
// -------------------------------------------------------------
function createDatabaseBackup(backupType = 'manual', user = 'System') {
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Force SQLite WAL checkpoint so all committed transactions are flushed to disk
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (err) {
    console.warn('WAL checkpoint notice:', err.message);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `dairytrack_backup_${timestamp}.db`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  fs.copyFileSync(dbPath, backupFilePath);

  // Compute cryptographic SHA-256 checksum
  const fileBuffer = fs.readFileSync(backupFilePath);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const sizeBytes = fileBuffer.length;

  try {
    db.prepare(`
      INSERT INTO backups (filename, file_path, file_size_bytes, sha256_checksum, backup_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(backupFileName, backupFilePath, sizeBytes, sha256, backupType, user);
  } catch (e) {
    console.error('Failed to log backup metadata:', e.message);
  }

  logAudit(null, user, 'Admin', 'DATABASE_BACKUP_CREATED', 'SYSTEM', null, `Created backup ${backupFileName} (${sizeBytes} bytes, SHA256: ${sha256.slice(0, 12)}...)`);

  return {
    filename: backupFileName,
    filePath: backupFilePath,
    sizeBytes,
    sha256,
    createdAt: new Date().toISOString()
  };
}

function listDatabaseBackups() {
  try {
    return db.prepare('SELECT * FROM backups ORDER BY id DESC').all();
  } catch {
    return [];
  }
}

initDatabase();

module.exports = {
  db,
  formatDate,
  addDays,
  hashPassword,
  verifyPassword,
  generateToken,
  logAudit,
  createDatabaseBackup,
  listDatabaseBackups,
  UNIT_DEFINITIONS,
  canConvertUnits,
  convertQuantity
};
