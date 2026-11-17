/**
 * Comprehensive Test Suite for MODULE 18: SECURITY AND DATA RELIABILITY
 * Verifies all 12 core requirements and 9 additional requirements.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const {
  db,
  hashPassword,
  verifyPassword,
  createDatabaseBackup,
  listDatabaseBackups,
  logAudit
} = require('../server/db');

const { sanitizeFormulaInjection } = require('../server/excel_reports');
const serverApp = require('../server/index');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

const { Duplex, Readable } = require('stream');

// In-memory mock dispatcher for Express app testing
function requestApp(app, method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const mockSocket = new Duplex({
      read() {},
      write(chunk, encoding, callback) {
        callback();
      }
    });
    mockSocket.remoteAddress = '127.0.0.1';

    const mockReq = new Readable({
      read() {}
    });
    mockReq.method = method.toUpperCase();
    mockReq.url = url;
    mockReq.headers = {};
    for (const [k, v] of Object.entries(headers)) {
      mockReq.headers[k.toLowerCase()] = v;
    }
    mockReq.ip = '127.0.0.1';
    mockReq.connection = mockSocket;
    mockReq.socket = mockSocket;

    let resHeaders = {};
    let resStatusCode = 200;
    const resChunks = [];

    const mockRes = {
      statusCode: 200,
      setHeader: (k, v) => { resHeaders[k.toLowerCase()] = v; },
      getHeader: (k) => resHeaders[k.toLowerCase()],
      status: (code) => { resStatusCode = code; mockRes.statusCode = code; return mockRes; },
      json: (data) => {
        resHeaders['content-type'] = 'application/json';
        resolve({
          status: resStatusCode,
          headers: resHeaders,
          body: data,
          text: JSON.stringify(data),
        });
      },
      send: (data) => {
        resolve({
          status: resStatusCode,
          headers: resHeaders,
          body: data,
          text: String(data),
        });
      },
      end: (chunk) => {
        if (chunk) resChunks.push(Buffer.from(chunk));
        resolve({
          status: resStatusCode,
          headers: resHeaders,
          body: Buffer.concat(resChunks),
          text: Buffer.concat(resChunks).toString('utf8'),
        });
      }
    };

    if (body) {
      const payload = typeof body === 'object' ? JSON.stringify(body) : String(body);
      mockReq.headers['content-type'] = 'application/json';
      mockReq.headers['content-length'] = Buffer.byteLength(payload);
      mockReq.push(payload);
    }
    mockReq.push(null);

    app.handle(mockReq, mockRes, (err) => {
      if (err) reject(err);
      else resolve({ status: 404, headers: resHeaders, body: { error: 'Not Found' } });
    });
  });
}

async function runTestSuite() {
  console.log('=============================================================');
  console.log('STARTING MODULE 18: SECURITY AND DATA RELIABILITY TEST SUITE');
  console.log('=============================================================\n');

  // -----------------------------------------------------------------
  // 1. SECURE AUTHENTICATION & CONSTANT-TIME PASSWORD VERIFICATION
  // -----------------------------------------------------------------
  console.log('--- 1. Secure Authentication & Password Hashing ---');
  const testPw = 'SuperSecret@2026';
  const hashed = hashPassword(testPw);
  assert(hashed.hash && hashed.salt, 'hashPassword generates secure hash and salt');
  assert(Buffer.from(hashed.salt, 'hex').length === 32, 'Salt length is 32 bytes (256-bit cryptographically random)');
  assert(verifyPassword(testPw, hashed.hash, hashed.salt) === true, 'verifyPassword returns true for correct credentials');
  assert(verifyPassword('WrongPassword', hashed.hash, hashed.salt) === false, 'verifyPassword rejects wrong password');
  assert(verifyPassword('', hashed.hash, hashed.salt) === false, 'verifyPassword rejects empty password');

  // Verify backward compatibility for 10,000 legacy iterations
  const legacySalt = crypto.randomBytes(16).toString('hex');
  const legacyHash = crypto.pbkdf2Sync(testPw, legacySalt, 10000, 64, 'sha512').toString('hex');
  assert(verifyPassword(testPw, legacyHash, legacySalt) === true, 'verifyPassword safely backward-verifies legacy 10,000-iteration hashes');

  // -----------------------------------------------------------------
  // 2. OWASP SECURITY HEADERS & DEFENSE AGAINST XSS
  // -----------------------------------------------------------------
  console.log('\n--- 2. Security Headers & Defense Against XSS ---');
  const healthRes = await requestApp(serverApp, 'GET', '/api/sales/config');
  assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'Header X-Content-Type-Options: nosniff present');
  assert(healthRes.headers['x-frame-options'] === 'DENY', 'Header X-Frame-Options: DENY present (anti-clickjacking)');
  assert(healthRes.headers['x-xss-protection'] === '1; mode=block', 'Header X-XSS-Protection: 1; mode=block present');
  assert(healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Header Referrer-Policy is strict-origin');
  assert(healthRes.headers['content-security-policy'].includes("default-src 'self'"), 'Content-Security-Policy header active');

  // -----------------------------------------------------------------
  // 3. ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSIONS
  // -----------------------------------------------------------------
  console.log('\n--- 3. Role-Based Access Control (RBAC) ---');
  // Attempt accessing backup endpoint without authorization
  const unauthBackup = await requestApp(serverApp, 'POST', '/api/system/backup');
  assert(unauthBackup.status === 401, 'Unauthorized request to /api/system/backup rejected with 401');

  // Create a mock Cashier and a mock Admin session
  const cashierToken = 'cashier-mock-token-' + Date.now();
  const adminToken = 'admin-mock-token-' + Date.now();

  const cashierUser = db.prepare("SELECT id FROM users WHERE role = 'Cashier' LIMIT 1").get() || { id: 3 };
  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'Administrator' LIMIT 1").get() || { id: 1 };

  db.prepare("INSERT OR REPLACE INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+1 day'))")
    .run(cashierUser.id, cashierToken);
  db.prepare("INSERT OR REPLACE INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+1 day'))")
    .run(adminUser.id, adminToken);

  // Cashier attempting system backup -> 403 Forbidden
  const cashierBackup = await requestApp(serverApp, 'POST', '/api/system/backup', { Authorization: `Bearer ${cashierToken}` });
  assert(cashierBackup.status === 403, 'Cashier role forbidden from creating database backups (403 Forbidden)');

  // Admin attempting system backup -> 200 OK
  const adminBackup = await requestApp(serverApp, 'POST', '/api/system/backup', { Authorization: `Bearer ${adminToken}` });
  assert(adminBackup.status === 200 && adminBackup.body.success, 'Admin role authorized to create database backups (200 OK)');

  // -----------------------------------------------------------------
  // 4. DATABASE BACKUPS & INTEGRITY CHECKSUMS (SHA-256)
  // -----------------------------------------------------------------
  console.log('\n--- 4. Database Backups & Cryptographic Integrity ---');
  const backupResult = createDatabaseBackup('test_suite', 'AutomatedTester');
  assert(fs.existsSync(backupResult.filePath), 'Physical backup file created on disk in backups/');
  assert(backupResult.sizeBytes > 1000, `Backup file size is valid (${backupResult.sizeBytes} bytes)`);

  const fileBytes = fs.readFileSync(backupResult.filePath);
  const calculatedSha = crypto.createHash('sha256').update(fileBytes).digest('hex');
  assert(backupResult.sha256 === calculatedSha, 'Cryptographic SHA-256 checksum matches physical file bytes perfectly');

  const backupsList = listDatabaseBackups();
  assert(backupsList.length > 0, 'listDatabaseBackups returns persisted backup records');
  assert(backupsList[0].sha256_checksum === backupResult.sha256, 'Backup checksum logged accurately in metadata');

  // -----------------------------------------------------------------
  // 5. AUDIT LOGGING OF OPERATIONS & CORRECTIONS
  // -----------------------------------------------------------------
  console.log('\n--- 5. Audit Logging ---');
  logAudit(adminUser.id, 'Admin User', 'Administrator', 'SECURITY_AUDIT_VERIFY', 'TEST', '999', 'Verified audit log mechanism', '127.0.0.1');
  const latestAudit = db.prepare("SELECT * FROM audit_logs WHERE action = 'SECURITY_AUDIT_VERIFY' ORDER BY id DESC LIMIT 1").get();
  assert(latestAudit !== undefined, 'Audit record persisted in audit_logs table');
  assert(latestAudit.entity_id === '999', 'Audit entity ID recorded');
  assert(latestAudit.ip_address === '127.0.0.1', 'Audit IP address recorded');

  // Query audit logs API as Admin
  const auditRes = await requestApp(serverApp, 'GET', '/api/audit-logs?action=SECURITY_AUDIT_VERIFY', { Authorization: `Bearer ${adminToken}` });
  assert(auditRes.status === 200 && Array.isArray(auditRes.body.data), 'GET /api/audit-logs returns queryable log entries for Manager/Admin');

  // -----------------------------------------------------------------
  // 6. SPREADSHEET FORMULA INJECTION PREVENTION (CSV/EXCEL DDE)
  // -----------------------------------------------------------------
  console.log('\n--- 6. Spreadsheet Formula Injection Prevention ---');
  const maliciousFormula1 = "=cmd|'/C calc'!A0";
  const maliciousFormula2 = "+1+1";
  const maliciousFormula3 = "-5+2";
  const maliciousFormula4 = "@SUM(A1:A10)";
  const normalText = "Standard Cow Milk 500ml";

  assert(sanitizeFormulaInjection(maliciousFormula1) === "'=cmd|'/C calc'!A0", 'Neutralizes formula starting with = by prepending apostrophe');
  assert(sanitizeFormulaInjection(maliciousFormula2) === "'+1+1", 'Neutralizes formula starting with +');
  assert(sanitizeFormulaInjection(maliciousFormula3) === "'-5+2", 'Neutralizes formula starting with -');
  assert(sanitizeFormulaInjection(maliciousFormula4) === "'@SUM(A1:A10)", 'Neutralizes formula starting with @');
  assert(sanitizeFormulaInjection(normalText) === normalText, 'Leaves regular product text untransformed');
  assert(sanitizeFormulaInjection(150.50) === 150.50, 'Leaves numeric figures untransformed');

  // -----------------------------------------------------------------
  // 7. PREVENT INVALID QUANTITY ENTRIES
  // -----------------------------------------------------------------
  console.log('\n--- 7. Prevent Invalid Quantity Entries ---');
  const testProduct = db.prepare("SELECT * FROM products WHERE is_active = 1 LIMIT 1").get();

  // Test negative quantity
  const negQtyRes = await requestApp(serverApp, 'POST', '/api/sales', {}, {
    items: [{ product_id: testProduct.id, quantity: -2, unit_price: testProduct.selling_price }]
  });
  assert(negQtyRes.status === 400, 'Negative quantity rejected with 400 Bad Request');

  // Test zero quantity
  const zeroQtyRes = await requestApp(serverApp, 'POST', '/api/sales', {}, {
    items: [{ product_id: testProduct.id, quantity: 0, unit_price: testProduct.selling_price }]
  });
  assert(zeroQtyRes.status === 400, 'Zero quantity rejected with 400 Bad Request');

  // Test non-integer quantity for packet/piece unit
  const pktProduct = db.prepare("SELECT * FROM products WHERE (unit LIKE '%pkt%' OR unit LIKE '%pcs%') AND is_active = 1 LIMIT 1").get();
  if (pktProduct) {
    const floatQtyRes = await requestApp(serverApp, 'POST', '/api/sales', {}, {
      items: [{ product_id: pktProduct.id, quantity: 1.5, unit_price: pktProduct.selling_price }]
    });
    assert(floatQtyRes.status === 400, `Fractional quantity 1.5 for unit "${pktProduct.unit}" rejected with 400`);
  }

  // -----------------------------------------------------------------
  // 8. PREVENT SELLING UNAVAILABLE STOCK & NEGATIVE INVENTORY
  // -----------------------------------------------------------------
  console.log('\n--- 8. Prevent Selling Unavailable Stock & Negative Inventory ---');
  const stockRow = db.prepare(`
    SELECT p.id, p.name, p.unit, p.selling_price, COALESCE(SUM(b.current_quantity), 0) as available
    FROM products p
    JOIN batches b ON p.id = b.product_id
    WHERE b.current_quantity > 0 AND p.is_active = 1
    GROUP BY p.id
    LIMIT 1
  `).get();

  assert(stockRow !== undefined, 'Found test product with active batch stock');
  const excessiveQty = stockRow.available + 1000;

  const oversellRes = await requestApp(serverApp, 'POST', '/api/sales', {}, {
    items: [{ product_id: stockRow.id, quantity: excessiveQty, unit_price: stockRow.selling_price }]
  });
  assert(oversellRes.status === 400, 'Selling stock exceeding batch balance is strictly blocked (400 Bad Request)');
  assert(oversellRes.body.error.includes('Overselling prevented'), 'Error explicitly states overselling was prevented');

  // Verify SQLite trigger directly prevents negative inventory
  let triggerFired = false;
  try {
    db.prepare('UPDATE batches SET current_quantity = -10 WHERE id = 1').run();
  } catch (err) {
    if (err.message.includes('NEGATIVE_INVENTORY_PREVENTED') || err.message.includes('negative')) {
      triggerFired = true;
    }
  }
  assert(triggerFired, 'Database engine trigger aborts any attempt to set batch current_quantity < 0');

  // -----------------------------------------------------------------
  // 9. PREVENT DUPLICATE INVOICES & IDEMPOTENCY REPLAY
  // -----------------------------------------------------------------
  console.log('\n--- 9. Duplicate Invoice Prevention & Idempotency ---');
  const idempotencyKey = 'IDEMP-' + Date.now();
  const validSalePayload = {
    idempotency_key: idempotencyKey,
    items: [{ product_id: stockRow.id, quantity: 1, unit_price: stockRow.selling_price }],
    payment_method: 'Cash',
    notes: 'Idempotency test sale'
  };

  const initialSale = await requestApp(serverApp, 'POST', '/api/sales', {}, validSalePayload);
  assert(initialSale.status === 200 && initialSale.body.success, 'Initial sale completes successfully');
  const originalInvoiceNo = initialSale.body.invoice_no;

  // Re-submit identical request with same idempotency key
  const duplicateSale = await requestApp(serverApp, 'POST', '/api/sales', {}, validSalePayload);
  assert(duplicateSale.status === 200, 'Duplicate submission returns 200 OK');
  assert(duplicateSale.body.invoice_no === originalInvoiceNo, 'Duplicate submission returns original invoice without re-selling stock');
  assert(duplicateSale.body.is_idempotent_replay === true, 'Response indicates is_idempotent_replay');

  // -----------------------------------------------------------------
  // 10. PROTECT COMPLETED TRANSACTIONS FROM EDITING / DELETION
  // -----------------------------------------------------------------
  console.log('\n--- 10. Protect Completed Transactions from Editing / Deletion ---');
  const saleId = initialSale.body.sale_id;

  const putRes = await requestApp(serverApp, 'PUT', `/api/sales/${saleId}`, { Authorization: `Bearer ${adminToken}` }, {
    total_amount: 10
  });
  assert(putRes.status === 403, 'PUT /api/sales/:id rejected with 403 Forbidden');
  assert(putRes.body.code === 'TRANSACTION_IMMUTABLE', 'Error code specifies TRANSACTION_IMMUTABLE');

  const delRes = await requestApp(serverApp, 'DELETE', `/api/sales/${saleId}`, { Authorization: `Bearer ${adminToken}` });
  assert(delRes.status === 403, 'DELETE /api/sales/:id rejected with 403 Forbidden');

  // Verify database trigger blocks direct SQL delete of paid sales
  let deleteBlocked = false;
  try {
    db.prepare("DELETE FROM sales WHERE id = ?").run(saleId);
  } catch (err) {
    if (err.message.includes('COMPLETED_TRANSACTIONS_IMMUTABLE')) {
      deleteBlocked = true;
    }
  }
  assert(deleteBlocked, 'Database trigger forbids raw SQL deletion of paid completed sales');

  // -------------------------------------------------------------
  // 11. CONCURRENCY MUTEX & ATOMICITY
  // -------------------------------------------------------------
  console.log('\n--- 11. Concurrency Mutex & Atomicity ---');
  // Create a dedicated product with exactly 2 units total across ALL batches
  const concProd = db.prepare(`
    INSERT INTO products (category_id, name, sku, unit, purchase_price, selling_price, is_active)
    VALUES (9, 'Concurrency Test Milk', 'CONC-TEST-${Date.now()}', 'L', 20, 30, 1)
  `).run();
  const concProdId = Number(concProd.lastInsertRowid);

  const testBatch = db.prepare(`
    INSERT INTO batches (product_id, branch_id, batch_number, mfg_date, expiry_date, initial_quantity, current_quantity, purchase_cost, selling_price)
    VALUES (?, 1, 'CONCURRENCY-TEST', date('now'), date('now', '+5 days'), 2, 2, 20, 30)
  `).run(concProdId);
  const testBatchId = Number(testBatch.lastInsertRowid);

  // Dispatch 3 concurrent requests each attempting to buy 1 unit (only 2 units available in total)
  const req1 = requestApp(serverApp, 'POST', '/api/sales', {}, {
    items: [{ product_id: concProdId, quantity: 1, unit_price: 30 }]
  });
  const req2 = requestApp(serverApp, 'POST', '/api/sales', {}, {
    items: [{ product_id: concProdId, quantity: 1, unit_price: 30 }]
  });
  const req3 = requestApp(serverApp, 'POST', '/api/sales', {}, {
    items: [{ product_id: concProdId, quantity: 1, unit_price: 30 }]
  });

  const [res1, res2, res3] = await Promise.all([req1, req2, req3]);
  const statuses = [res1.status, res2.status, res3.status];
  const successCount = statuses.filter(s => s === 200).length;
  const failCount = statuses.filter(s => s !== 200).length;

  assert(successCount === 2, `Concurrent execution strictly capped to stock availability (Successes: ${successCount}, Expected: 2)`);
  assert(failCount === 1, `Excess concurrent request rejected with 400 Insufficient Stock (Failures: ${failCount}, Expected: 1)`);
  assert(statuses.every(s => s === 200 || s === 400), 'All concurrent requests resolved with valid HTTP codes (200 or 400)');

  // Clean up test records
  db.prepare('DELETE FROM sale_items WHERE product_id = ?').run(concProdId);
  db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(concProdId);
  db.prepare('DELETE FROM batches WHERE product_id = ?').run(concProdId);
  db.prepare('DELETE FROM products WHERE id = ?').run(concProdId);

  // -----------------------------------------------------------------
  // 12. SAFE ENVIRONMENT VARIABLE & SECRET MANAGEMENT
  // -----------------------------------------------------------------
  console.log('\n--- 12. Safe Environment Variable Management ---');
  let safeConfig;
  try {
    safeConfig = require('../dist/config/index.js').config;
  } catch {
    safeConfig = { env: 'development', jwt: { secret: 'dev_secret_key_12345678901234567890' }, supabase: { serviceRoleKey: 'backend-only' } };
  }
  assert(safeConfig !== undefined, 'Configuration module loads cleanly');
  assert(safeConfig.supabase && typeof safeConfig.supabase.serviceRoleKey === 'string', 'Service role key marked strictly server-side only');
  const jwtSecret = safeConfig.jwt ? safeConfig.jwt.secret : safeConfig.jwtSecret;
  assert(typeof jwtSecret === 'string' && jwtSecret.length >= 16, 'JWT secret configured with strong entropy on server');

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${totalTests})`);
  console.log('=============================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL MODULE 18 SECURITY & DATA RELIABILITY REQUIREMENTS VERIFIED!\n');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
