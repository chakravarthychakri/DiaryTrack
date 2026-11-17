const app = require('../server/index');
const { db } = require('../server/db');
const crypto = require('crypto');

// Create test session for Admin user
const token = 'test-token-mod11-' + crypto.randomBytes(16).toString('hex');
db.prepare(`
  INSERT INTO sessions (token, user_id, expires_at)
  VALUES (?, 1, datetime('now', '+1 day'))
`).run(token);

function callApp(method, url, body = null, headers = {}) {
  return new Promise((resolve) => {
    const defaultHeaders = {
      'host': 'localhost:3000',
      'authorization': `Bearer ${token}`,
      ...headers
    };

    if (body) {
      defaultHeaders['content-type'] = 'application/json';
    }

    const { EventEmitter } = require('events');
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = defaultHeaders;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;
    req.ip = '127.0.0.1';

    if (body) {
      req.body = body;
    } else {
      req.body = {};
    }

    const res = new EventEmitter();
    let resHeaders = {};
    let chunks = [];
    res.statusCode = 200;

    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.status = (code) => { res.statusCode = code; return res; };
    
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };

    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const buffer = Buffer.concat(chunks);
      const isJson = (resHeaders['content-type'] || '').includes('json');
      let data = null;
      if (isJson) {
        try {
          data = JSON.parse(buffer.toString('utf8'));
        } catch (e) {
          data = buffer.toString('utf8');
        }
      } else {
        data = buffer;
      }
      resolve({ status: res.statusCode, headers: resHeaders, data, buffer });
    };

    res.json = (obj) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(obj));
    };

    res.send = (val) => {
      if (typeof val === 'object' && !Buffer.isBuffer(val)) {
        res.json(val);
      } else {
        res.end(val);
      }
    };

    app.handle(req, res);
  });
}

async function runTests() {
  console.log('=== MODULE 11: EXPIRY & WASTAGE MANAGEMENT TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${extra}`);
      failed++;
    }
  }

  // 1. Expiry Dashboard (11.1)
  const dashRes = await callApp('GET', '/api/expiry/dashboard');
  assert('GET /api/expiry/dashboard returns 200', dashRes.status === 200);
  const m = dashRes.data && dashRes.data.data && dashRes.data.data.metrics;
  assert('Dashboard includes expiring_today metric', m && m.expiring_today_count !== undefined);
  assert('Dashboard includes expiring_3days metric', m && m.expiring_3days_count !== undefined);
  assert('Dashboard includes expiring_7days metric', m && m.expiring_7days_count !== undefined);
  assert('Dashboard includes already_expired metric', m && m.already_expired_count !== undefined);
  assert('Dashboard includes total_expiry_loss metric', m && m.total_expiry_loss !== undefined && m.total_expiry_loss >= 0);
  assert('Dashboard contains wasteByCategory breakdown', Array.isArray(dashRes.data.data.wasteByCategory));

  // 2. Backward Compatible /api/expiry
  const expRes = await callApp('GET', '/api/expiry');
  assert('GET /api/expiry returns 200', expRes.status === 200);
  assert('Returns expired array', Array.isArray(expRes.data.data.expired));
  assert('Returns critical array', Array.isArray(expRes.data.data.critical));
  assert('Returns upcoming array', Array.isArray(expRes.data.data.upcoming));
  assert('Returns wasteHistory array', Array.isArray(expRes.data.data.wasteHistory));

  // Create test batch for testing wastage deductions
  const testBatchNo = 'BAT-TEST-EXP-' + Date.now().toString().slice(-4);
  const insertBatch = db.prepare(`
    INSERT INTO batches (
      product_id, branch_id, batch_number, mfg_date, expiry_date,
      initial_quantity, current_quantity, purchase_cost, selling_price, status
    ) VALUES (1, 1, ?, '2026-11-10', '2026-11-15', 50, 50, 45, 60, 'Active')
  `).run(testBatchNo);
  const testBatchId = Number(insertBatch.lastInsertRowid);
  assert('Created test batch for wastage testing', testBatchId > 0);

  // 3. Record Wastage: Expired Products (11.2)
  const wasteExpiredRes = await callApp('POST', '/api/expiry/wastage', {
    product_id: 1,
    batch_id: testBatchId,
    quantity: 5,
    waste_type: 'Expired',
    unit_cost: 45,
    reason: 'Past expiration date on shelf',
    action_taken: 'Discarded & Safe Disposal'
  });
  assert('POST /api/expiry/wastage records Expired product', wasteExpiredRes.status === 200 && wasteExpiredRes.data.success);
  assert('Automatically calculates Wastage Cost = 5 * 45 = 225', wasteExpiredRes.data.loss_value === 225);

  // Verify batch inventory deducted: 50 - 5 = 45
  const b1 = db.prepare('SELECT current_quantity FROM batches WHERE id = ?').get(testBatchId);
  assert('Inventory deducted: remaining quantity is 45', b1.current_quantity === 45);

  // Verify stock movement logged as 'Expired Stock' (Outflow)
  const sm1 = db.prepare(`
    SELECT * FROM stock_movements 
    WHERE batch_id = ? AND movement_type = 'Expired Stock' 
    ORDER BY id DESC LIMIT 1
  `).get(testBatchId);
  assert('Stock movement logged as Expired Stock', sm1 !== undefined);
  assert('Stock movement flow_type is Outflow', sm1 && sm1.flow_type === 'Outflow');
  assert('Stock movement quantity is 5', sm1 && sm1.quantity === 5);

  // 4. Record Wastage: Damaged Products (11.2)
  const wasteDamagedRes = await callApp('POST', '/api/expiry/wastage', {
    product_id: 1,
    batch_id: testBatchId,
    quantity: 3,
    waste_type: 'Damaged',
    unit_cost: 45,
    reason: 'Pouch leaking from crate drop',
    action_taken: 'Bio-waste / Composted'
  });
  assert('POST /api/expiry/wastage records Damaged product', wasteDamagedRes.status === 200 && wasteDamagedRes.data.success);
  assert('Automatically calculates Wastage Cost = 3 * 45 = 135', wasteDamagedRes.data.loss_value === 135);

  // Verify batch inventory deducted: 45 - 3 = 42
  const b2 = db.prepare('SELECT current_quantity FROM batches WHERE id = ?').get(testBatchId);
  assert('Inventory deducted: remaining quantity is 42', b2.current_quantity === 42);

  // 5. Record Wastage: Spilled Products (11.2)
  const wasteSpilledRes = await callApp('POST', '/api/expiry/wastage', {
    product_id: 1,
    batch_id: testBatchId,
    quantity: 2,
    waste_type: 'Spilled',
    unit_cost: 45,
    reason: 'Counter transfer spill',
    action_taken: 'Discarded'
  });
  assert('POST /api/expiry/wastage records Spilled product', wasteSpilledRes.status === 200 && wasteSpilledRes.data.success);
  assert('Calculates Wastage Cost = 2 * 45 = 90', wasteSpilledRes.data.loss_value === 90);

  // 6. Record Wastage: Spoiled Products (11.2)
  const wasteSpoiledRes = await callApp('POST', '/api/expiry/wastage', {
    product_id: 1,
    batch_id: testBatchId,
    quantity: 4,
    waste_type: 'Spoiled',
    unit_cost: 45,
    reason: 'Curdled milk from refrigerator power interruption',
    action_taken: 'Drain Disposal'
  });
  assert('POST /api/expiry/wastage records Spoiled product', wasteSpoiledRes.status === 200 && wasteSpoiledRes.data.success);
  assert('Calculates Wastage Cost = 4 * 45 = 180', wasteSpoiledRes.data.loss_value === 180);

  // 7. Record Wastage: Other Wastage (11.2)
  const wasteOtherRes = await callApp('POST', '/api/expiry/wastage', {
    product_id: 1,
    batch_id: testBatchId,
    quantity: 1,
    waste_type: 'Other Wastage',
    unit_cost: 45,
    reason: 'Daily quality fat testing lab sample',
    action_taken: 'Lab Testing'
  });
  assert('POST /api/expiry/wastage records Other Wastage', wasteOtherRes.status === 200 && wasteOtherRes.data.success);
  assert('Calculates Wastage Cost = 1 * 45 = 45', wasteOtherRes.data.loss_value === 45);

  // Final batch inventory check: 42 - 2 - 4 - 1 = 35
  const bFinal = db.prepare('SELECT current_quantity FROM batches WHERE id = ?').get(testBatchId);
  assert('Total batch stock accurately confirmed and deducted to 35', bFinal.current_quantity === 35);

  // 8. Prevent over-deducting beyond available batch stock
  const overDeductRes = await callApp('POST', '/api/expiry/wastage', {
    product_id: 1,
    batch_id: testBatchId,
    quantity: 9999, // Exceeds 35
    waste_type: 'Damaged',
    reason: 'Massive impossible loss'
  });
  assert('Blocks over-deducting beyond available batch inventory (400)', overDeductRes.status === 400 && !overDeductRes.data.success);

  // 9. Wastage History Log (11.3)
  const histRes = await callApp('GET', '/api/expiry/wastage?limit=10');
  assert('GET /api/expiry/wastage returns 200', histRes.status === 200);
  assert('Wastage history contains array of records', Array.isArray(histRes.data.data));
  assert('Record includes formatted_waste_id (WST-XXXX)', histRes.data.data[0].formatted_waste_id.startsWith('WST-'));
  assert('Record contains unit and cost_per_unit', histRes.data.data[0].unit !== undefined && histRes.data.data[0].unit_cost !== undefined);
  assert('Record contains waste_type', histRes.data.data[0].waste_type !== undefined);

  // 10. Filter Wastage by Type
  const filterExpired = await callApp('GET', '/api/expiry/wastage?waste_type=Expired');
  assert('Filtering by waste_type=Expired returns only Expired', filterExpired.status === 200 && filterExpired.data.data.every(r => r.waste_type === 'Expired'));

  // 11. Excel Wastage Report Export
  const reportRes = await callApp('GET', '/api/expiry/report');
  assert('GET /api/expiry/report returns 200', reportRes.status === 200);
  assert('Report returns Excel content type', (reportRes.headers['content-type'] || '').includes('spreadsheetml'));
  assert('Report buffer contains valid XLSX header (PK)', reportRes.buffer && reportRes.buffer.slice(0, 2).toString() === 'PK');

  // 12. Direct Download Endpoint
  const dlRes = await callApp('GET', '/api/reports/download/waste');
  assert('GET /api/reports/download/waste returns 200', dlRes.status === 200);
  assert('Download buffer contains valid XLSX header', dlRes.buffer && dlRes.buffer.slice(0, 2).toString() === 'PK');

  console.log(`\n=============================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=============================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
