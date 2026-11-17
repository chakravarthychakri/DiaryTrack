const app = require('../server/index');
const { db } = require('../server/db');
const crypto = require('crypto');

// Create test session for Admin user
const token = 'test-token-' + crypto.randomBytes(16).toString('hex');
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
  console.log('=== MODULE 10: CUSTOMER MANAGEMENT TEST SUITE ===\n');
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

  // 1. Stats Endpoint
  const statsRes = await callApp('GET', '/api/customers/stats');
  assert('GET /api/customers/stats returns 200', statsRes.status === 200);
  assert('Customer stats includes total_customers', statsRes.data && statsRes.data.data.total_customers >= 5);
  assert('Customer stats includes total_udhar_balance', statsRes.data && statsRes.data.data.total_udhar_balance !== undefined);
  assert('Customer stats distinguishes walk-in sales', statsRes.data && statsRes.data.data.walkin_sales !== undefined);

  // 2. Customers List
  const listRes = await callApp('GET', '/api/customers?limit=10');
  assert('GET /api/customers returns 200', listRes.status === 200);
  assert('Customer list contains data array', Array.isArray(listRes.data && listRes.data.data));
  assert('Customer includes formatted_cust_id', listRes.data && listRes.data.data[0].formatted_cust_id.startsWith('CUST-'));
  assert('Customer includes enriched net_purchases', listRes.data && listRes.data.data[0].net_purchases !== undefined);

  // 3. Register New Customer
  const newCustRes = await callApp('POST', '/api/customers', {
    name: 'Gokul Dairy Sweets Hub',
    phone: '+91 97654 32199',
    type: 'Wholesale',
    email: 'gokul@sweethub.in',
    address: 'Shop 14, Commercial Market, Dairy Enclave',
    credit_balance: 1500,
    status: 'Active',
    notes: 'Requires 50kg fresh paneer on festival days'
  });
  assert('POST /api/customers creates new customer', newCustRes.status === 200 && newCustRes.data.success);
  const createdCustId = newCustRes.data.id;
  assert('Created customer receives valid ID', createdCustId > 0);

  // 4. Get 360° Profile
  const profileRes = await callApp('GET', `/api/customers/${createdCustId}`);
  assert('GET /api/customers/:id returns 200', profileRes.status === 200);
  assert('Profile contains customer object', profileRes.data && profileRes.data.data.customer.name === 'Gokul Dairy Sweets Hub');
  assert('Profile contains scorecard metrics', profileRes.data && profileRes.data.data.metrics !== undefined);
  assert('Profile contains sales, returns, payments arrays', Array.isArray(profileRes.data.data.recentSales) && Array.isArray(profileRes.data.data.returns));

  // 5. Update Customer Details
  const updateRes = await callApp('PUT', `/api/customers/${createdCustId}`, {
    name: 'Gokul Dairy Sweets & Bakery',
    phone: '+91 97654 32199',
    type: 'Wholesale',
    email: 'gokul.bakery@sweethub.in',
    address: 'Shop 14-15, Commercial Market, Dairy Enclave',
    status: 'Active',
    notes: 'Updated: regular supply of 50kg Paneer + 20kg Butter'
  });
  assert('PUT /api/customers/:id updates customer info', updateRes.status === 200 && updateRes.data.success);

  // 6. Record Udhar Payment Settlement
  const payRes = await callApp('POST', `/api/customers/${createdCustId}/pay-credit`, {
    amount: 500,
    payment_mode: 'UPI',
    reference_no: 'UPI-GOKUL-9988',
    notes: 'First advance installment towards festival order'
  });
  assert('POST /api/customers/:id/pay-credit returns 200', payRes.status === 200 && payRes.data.success);
  assert('Payment updates remaining balance to ₹1000', payRes.data.remaining_balance === 1000);

  // 7. Verify Udhar Payment appears in ledger
  const paymentsRes = await callApp('GET', `/api/customers/${createdCustId}/payments`);
  assert('GET /api/customers/:id/payments lists payments', paymentsRes.status === 200 && paymentsRes.data.data.length >= 1);
  assert('Payment record contains reference_no', paymentsRes.data.data[0].reference_no === 'UPI-GOKUL-9988');

  // 8. Record Customer Return & Inventory Reversal
  // Get product 1 (Full Cream Fresh Milk)
  const prod = db.prepare('SELECT id, selling_price, unit FROM products WHERE id = 1').get();
  const targetBatch = db.prepare('SELECT id, current_quantity FROM batches WHERE product_id = 1 ORDER BY expiry_date DESC, id DESC LIMIT 1').get();
  const initialBatchQty = targetBatch.current_quantity;

  const returnRes = await callApp('POST', '/api/customers/returns', {
    customer_id: createdCustId,
    product_id: 1,
    batch_id: targetBatch.id,
    quantity: 3,
    unit_price: prod.selling_price || 33,
    refund_amount: 3 * (prod.selling_price || 33),
    refund_method: 'Store Credit / Udhar Adjustment',
    reason: 'Packaging leak during home transport',
    reduce_udhar: true
  });
  assert('POST /api/customers/returns processes return', returnRes.status === 200 && returnRes.data.success);
  assert('Return allocates unique CR-XXXX return number', returnRes.data.return_no.startsWith('CR-'));

  // 9. Verify Inventory Stock Reversal
  const batchAfter = db.prepare('SELECT current_quantity FROM batches WHERE id = ?').get(targetBatch.id);
  assert('Inventory batch quantity increased by 3 units', batchAfter.current_quantity === initialBatchQty + 3);

  // 10. Verify Stock Movement Logged (Customer Return -> Inflow)
  const smRow = db.prepare(`
    SELECT * FROM stock_movements 
    WHERE product_id = 1 AND movement_type = 'Customer Return' 
    ORDER BY id DESC LIMIT 1
  `).get();
  assert('Stock movement recorded with movement_type = "Customer Return"', smRow !== undefined);
  assert('Stock movement has flow_type = "Inflow"', smRow && smRow.flow_type === 'Inflow');
  assert('Stock movement quantity is 3', smRow && smRow.quantity === 3);

  // 11. Customer Returns List
  const retListRes = await callApp('GET', '/api/customers/returns');
  assert('GET /api/customers/returns returns 200', retListRes.status === 200 && Array.isArray(retListRes.data.data));
  assert('Returns list includes created return', retListRes.data.data.some(r => r.return_no === returnRes.data.return_no));

  // 12. Walk-in Customer Return (No customer_id provided / Walk-in profile)
  const walkinReturnRes = await callApp('POST', '/api/customers/returns', {
    customer_id: 5, // Walk-in customer profile
    product_id: 1,
    quantity: 1,
    unit_price: 33,
    refund_amount: 33,
    refund_method: 'Cash',
    reason: 'Wrong milk packet purchased at counter by walk-in'
  });
  assert('Walk-in customer can return goods without registration', walkinReturnRes.status === 200 && walkinReturnRes.data.success);

  // 13. Customer Sales Excel Report Generation
  const reportRes = await callApp('GET', '/api/customers/report');
  assert('GET /api/customers/report returns 200', reportRes.status === 200);
  assert('Report returns Excel content type', (reportRes.headers['content-type'] || '').includes('spreadsheetml'));
  assert('Report buffer contains valid XLSX header (PK)', reportRes.buffer && reportRes.buffer.slice(0, 2).toString() === 'PK');

  // 14. Report Download Endpoint
  const dlRes = await callApp('GET', '/api/reports/download/customer-sales');
  assert('GET /api/reports/download/customer-sales returns 200', dlRes.status === 200);
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
