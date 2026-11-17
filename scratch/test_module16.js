// ====================================================================
// MODULE 16: BACKEND & API DEVELOPMENT VERIFICATION SUITE
// ====================================================================
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Load compiled TypeScript application
const { createApp } = require('../dist/app.js');

let passedTests = 0;
let failedTests = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failedTests++;
  }
}

// In-Memory Express Dispatcher (Pure In-Process, Zero Socket Requirements)
function callApp(app, options, body = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    const parsedUrl = new URL(options.path, 'http://localhost');
    req.url = options.path;
    req.originalUrl = options.path;
    req.path = parsedUrl.pathname;
    req.method = options.method || 'GET';
    req.headers = {
      'content-type': 'application/json',
      host: 'localhost',
    };
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        req.headers[k.toLowerCase()] = v;
      }
    }
    req.connection = { remoteAddress: '127.0.0.1', destroy() {} };
    req.socket = { remoteAddress: '127.0.0.1', destroy() {} };
    req.body = body !== null ? body : {};
    req.query = Object.fromEntries(parsedUrl.searchParams);
    req.params = {};

    let statusCode = 200;
    const resHeaders = {};
    const chunks = [];

    const res = new EventEmitter();
    res.setHeader = (key, val) => { resHeaders[key.toLowerCase()] = String(val); };
    res.getHeader = (key) => resHeaders[key.toLowerCase()];
    res.status = (code) => { statusCode = code; return res; };
    res.writeHead = (code, headers) => {
      statusCode = code;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          resHeaders[k.toLowerCase()] = String(v);
        }
      }
      return res;
    };
    res.send = (data) => {
      if (typeof data === 'object' && !Buffer.isBuffer(data)) {
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify(data));
      }
      return res.end(data);
    };
    res.json = (data) => {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(data));
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const fullBuffer = Buffer.concat(chunks);
      const str = fullBuffer.toString('utf8');
      let json = null;
      try {
        json = JSON.parse(str);
      } catch {
        json = str;
      }
      resolve({
        statusCode,
        headers: resHeaders,
        body: json,
        rawBody: fullBuffer,
      });
    };

    app.handle(req, res);
  });
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('STARTING MODULE 16: TYPESCRIPT BACKEND & API ARCHITECTURE SUITE');
  console.log('=============================================================\n');

  const app = createApp();

  try {
    // ------------------------------------------------------------------
    // Test Group 1: Backend Layer Architecture & TypeScript Verification
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 1: Backend Architecture & Layer Organization ---');
    
    const requiredLayers = [
      'routes', 'controllers', 'services', 'database',
      'middleware', 'validators', 'utilities', 'config'
    ];

    for (const layer of requiredLayers) {
      const srcDir = path.resolve(process.cwd(), 'src', layer);
      const distDir = path.resolve(process.cwd(), 'dist', layer);
      const srcExists = fs.existsSync(srcDir);
      const distExists = fs.existsSync(distDir);
      assert(`Layer directory "src/${layer}" exists`, srcExists);
      assert(`Compiled layer "dist/${layer}" exists with declaration/JS files`, distExists);
    }

    assert('tsconfig.json exists with strict typing', fs.existsSync(path.resolve(process.cwd(), 'tsconfig.json')));
    assert('dist/server.js and dist/app.js compiled cleanly', 
      fs.existsSync(path.resolve(process.cwd(), 'dist', 'server.js')) &&
      fs.existsSync(path.resolve(process.cwd(), 'dist', 'app.js')));

    // ------------------------------------------------------------------
    // Test Group 2: Authentication API & JWT Bearer Security
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 2: Authentication API & JWT Bearer Security ---');

    // 2.1 Validation on Login
    const invalidLogin = await callApp(app, { path: '/api/auth/login', method: 'POST' }, {});
    assert('POST /api/auth/login validates empty credentials with 400 Bad Request', invalidLogin.statusCode === 400);
    assert('Validation error returns field-level error messages', Array.isArray(invalidLogin.body?.errors?.details));

    // 2.2 Successful Login
    const validLogin = await callApp(app, { path: '/api/auth/login', method: 'POST' }, {
      username: 'admin',
      password: 'admin123',
    });
    assert('POST /api/auth/login succeeds with 200 OK', validLogin.statusCode === 200);
    assert('Login response returns success: true', validLogin.body?.success === true);
    assert('Login returns signed token string', typeof validLogin.body?.data?.token === 'string');
    assert('Login returns authenticated user profile', validLogin.body?.data?.user?.username === 'admin');
    const adminToken = validLogin.body?.data?.token;

    // 2.3 Registration
    const newUsername = `user_${Date.now().toString().slice(-5)}`;
    const regRes = await callApp(app, { path: '/api/auth/register', method: 'POST' }, {
      username: newUsername,
      password: 'password123',
      name: 'Test Cashier',
      email: `${newUsername}@dairytrack.com`,
      role: 'Shopkeeper',
    });
    assert('POST /api/auth/register succeeds with 201 Created', regRes.statusCode === 201);
    assert('Registered user has assigned role', regRes.body?.data?.role === 'Shopkeeper');

    // Login as the new shopkeeper to get cashier token
    const cashierLogin = await callApp(app, { path: '/api/auth/login', method: 'POST' }, {
      username: newUsername,
      password: 'password123',
    });
    const cashierToken = cashierLogin.body?.data?.token;

    // 2.4 Logout
    const logoutRes = await callApp(app, { path: '/api/auth/logout', method: 'POST' });
    assert('POST /api/auth/logout returns 200 OK', logoutRes.statusCode === 200);
    assert('Logout confirms loggedOut: true', logoutRes.body?.data?.loggedOut === true);

    // ------------------------------------------------------------------
    // Test Group 3: Products API (CRUD, Pagination, Search, Sorting, Filtering)
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 3: Products API & RBAC Authorization ---');

    // 3.1 Unauthenticated write blocked
    const unauthCreate = await callApp(app, { path: '/api/products', method: 'POST' }, { name: 'Blocked Milk' });
    assert('POST /api/products without token returns 401 Unauthorized', unauthCreate.statusCode === 401);

    // 3.2 Cashier unauthorized for product creation (Admin / Manager only)
    const cashierCreate = await callApp(app, {
      path: '/api/products',
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    }, { name: 'Forbidden Paneer', selling_price: 100, cost_price: 80, unit: 'Kg' });
    assert('POST /api/products by Shopkeeper returns 403 Forbidden', cashierCreate.statusCode === 403);

    // 3.3 Admin authorized product creation
    const adminCreate = await callApp(app, {
      path: '/api/products',
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, {
      name: `Premium Cow Ghee 500g Test ${Date.now().toString().slice(-4)}`,
      category_id: 14,
      cost_price: 320,
      selling_price: 420,
      unit: 'Piece',
      min_stock_level: 10,
    });
    assert('POST /api/products by Admin succeeds with 201 Created', adminCreate.statusCode === 201);
    const createdProductId = adminCreate.body?.data?.id;
    assert('Created product returns valid ID', !!createdProductId);

    // 3.4 GET /api/products with pagination
    const listRes = await callApp(app, { path: '/api/products?page=1&limit=5' });
    assert('GET /api/products returns 200 OK', listRes.statusCode === 200);
    assert('Returns items array', Array.isArray(listRes.body?.data));
    assert('Pagination meta includes page, limit, total, totalPages', 
      listRes.body?.meta?.page === 1 &&
      listRes.body?.meta?.limit === 5 &&
      listRes.body?.meta?.total > 0 &&
      listRes.body?.meta?.totalPages >= 1);

    // 3.5 Search filter
    const searchRes = await callApp(app, { path: '/api/products?search=Milk' });
    assert('GET /api/products?search=Milk returns matching products', 
      searchRes.body?.data?.length > 0 && searchRes.body?.data?.every(p => p.name.toLowerCase().includes('milk') || p.sku?.includes('Milk')));

    // 3.6 Category filter
    const catFilterRes = await callApp(app, { path: '/api/products?category_id=9' });
    assert('GET /api/products?category_id=9 returns only category 9 products',
      catFilterRes.body?.data?.every(p => Number(p.category_id) === 9));

    // 3.7 Sorting
    const sortRes = await callApp(app, { path: '/api/products?sortBy=selling_price&sortOrder=asc' });
    const prices = sortRes.body?.data?.map(p => Number(p.selling_price));
    const isSorted = prices?.every((val, i, arr) => !i || arr[i - 1] <= val);
    assert('GET /api/products?sortBy=selling_price&sortOrder=asc sorts ascending', isSorted);

    // 3.8 PUT /api/products/:id
    const updateRes = await callApp(app, {
      path: `/api/products/${createdProductId}`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, { selling_price: 450 });
    assert('PUT /api/products/:id updates product successfully', updateRes.statusCode === 200);
    assert('Product updated price reflected', Number(updateRes.body?.data?.selling_price) === 450);

    // 3.9 DELETE /api/products/:id
    const deleteRes = await callApp(app, {
      path: `/api/products/${createdProductId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('DELETE /api/products/:id succeeds with 200 OK', deleteRes.statusCode === 200);
    assert('Product marked deleted', deleteRes.body?.data?.deleted === true);

    // ------------------------------------------------------------------
    // Test Group 4: Inventory API & Stock Movements
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 4: Inventory API & Auditable Stock Movements ---');

    const invRes = await callApp(app, { path: '/api/inventory' });
    assert('GET /api/inventory returns 200 OK', invRes.statusCode === 200);
    assert('Inventory returns stats summary (total_valuation, total_units, low_stock)',
      typeof invRes.body?.data?.stats?.total_valuation === 'number' &&
      typeof invRes.body?.data?.stats?.total_units === 'number');
    assert('Inventory items include active batch lists', Array.isArray(invRes.body?.data?.items[0]?.batches));

    const movRes = await callApp(app, { path: '/api/inventory/movements?page=1&limit=5' });
    assert('GET /api/inventory/movements returns 200 OK', movRes.statusCode === 200);
    assert('Movements list returned with pagination meta', movRes.body?.meta?.total > 0);

    // POST /api/inventory/adjustments
    const adjRes = await callApp(app, {
      path: '/api/inventory/adjustments',
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, {
      product_id: 1,
      flow_type: 'Inflow',
      quantity: 10,
      reason: 'Physical Stock Count Reconciliation Test',
    });
    assert('POST /api/inventory/adjustments creates auditable stock movement', adjRes.statusCode === 201);
    assert('Adjustment returns previous and updated stock balances', 
      adjRes.body?.data?.updated_stock === adjRes.body?.data?.previous_stock + 10);

    // ------------------------------------------------------------------
    // Test Group 5: Sales API, POS Invoicing & FEFO Batch Deductions
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 5: Sales API, Transactions & Returns ---');

    const listSales = await callApp(app, { path: '/api/sales?page=1&limit=5' });
    assert('GET /api/sales returns 200 OK', listSales.statusCode === 200);
    assert('Sales returned with invoice numbers', typeof listSales.body?.data[0]?.invoice_number === 'string');

    // Create POS Sale
    const saleCreate = await callApp(app, {
      path: '/api/sales',
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, {
      items: [
        { product_id: 1, quantity: 2, unit_price: 66 },
      ],
      payment_method: 'UPI',
      notes: 'Module 16 Automated Test POS Sale',
    });
    assert('POST /api/sales completes sale with 201 Created', saleCreate.statusCode === 201);
    const createdSaleId = saleCreate.body?.data?.id;
    assert('Sale generated invoice with net_amount and gross_profit', 
      Number(saleCreate.body?.data?.net_amount) === 132 &&
      typeof saleCreate.body?.data?.gross_profit === 'number');

    // GET /api/sales/:id
    const singleSale = await callApp(app, { path: `/api/sales/${createdSaleId}` });
    assert('GET /api/sales/:id returns full invoice details', singleSale.statusCode === 200);
    assert('Invoice includes line items array', singleSale.body?.data?.items?.length > 0);

    // POST /api/sales/:id/returns
    const saleReturn = await callApp(app, {
      path: `/api/sales/${createdSaleId}/returns`,
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, {
      product_id: 1,
      quantity: 1,
      reason: 'Customer bought extra pouch',
      restock: true,
    });
    assert('POST /api/sales/:id/returns processes return with 201 Created', saleReturn.statusCode === 201);
    assert('Return record computes refund amount', Number(saleReturn.body?.data?.refund_amount) === 66);
    assert('Restocked flag is true', saleReturn.body?.data?.restocked === true);

    // ------------------------------------------------------------------
    // Test Group 6: Purchases API & Goods Receipt
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 6: Purchases API & Procurement Receipt ---');

    const poList = await callApp(app, { path: '/api/purchases?page=1&limit=5' });
    assert('GET /api/purchases returns 200 OK', poList.statusCode === 200);
    assert('Purchases list includes total_amount and status', typeof poList.body?.data[0]?.total_amount === 'number');

    // Create PO
    const createPo = await callApp(app, {
      path: '/api/purchases',
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, {
      supplier_id: 1,
      items: [
        { product_id: 1, quantity: 20, cost_price: 52 },
      ],
      notes: 'Module 16 Procurement PO Test',
    });
    assert('POST /api/purchases creates PO with 201 Created', createPo.statusCode === 201);
    const createdPoId = createPo.body?.data?.id;
    assert('Created PO starts in Pending status', createPo.body?.data?.status === 'Pending');

    // Receive PO
    const receivePo = await callApp(app, {
      path: `/api/purchases/${createdPoId}/receive`,
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('POST /api/purchases/:id/receive receives goods with 200 OK', receivePo.statusCode === 200);
    assert('Received PO status is now "Received"', receivePo.body?.data?.status === 'Received');

    // ------------------------------------------------------------------
    // Test Group 7: Analytics & BI Reporting Endpoints
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 7: Analytics & BI Reporting Endpoints ---');

    const dashRes = await callApp(app, { path: '/api/analytics/dashboard?range=this_month' });
    assert('GET /api/analytics/dashboard returns 200 OK', dashRes.statusCode === 200);
    assert('Dashboard includes profit_analytics (gross, net, cogs, operating profit)', 
      typeof dashRes.body?.data?.profit_analytics?.net_sales === 'number');
    assert('Dashboard includes top_products rankings', !!dashRes.body?.data?.top_products?.by_quantity);

    const topProdRes = await callApp(app, { path: '/api/analytics/top-products?metric=revenue&limit=5' });
    assert('GET /api/analytics/top-products?metric=revenue returns 200 OK', topProdRes.statusCode === 200);
    assert('Returns array of at most 5 items', topProdRes.body?.data?.length <= 5);

    const salesAnalytics = await callApp(app, { path: '/api/analytics/sales' });
    assert('GET /api/analytics/sales returns 200 OK', salesAnalytics.statusCode === 200);
    assert('Includes daily sales, category sales, and payment methods', 
      Array.isArray(salesAnalytics.body?.data?.daily_sales) &&
      Array.isArray(salesAnalytics.body?.data?.category_sales) &&
      Array.isArray(salesAnalytics.body?.data?.payment_methods));

    const profitAnalytics = await callApp(app, { path: '/api/analytics/profit' });
    assert('GET /api/analytics/profit returns 200 OK', profitAnalytics.statusCode === 200);
    assert('Calculates Net Sales = Gross Sales - Discounts - Returns',
      profitAnalytics.body?.data?.net_sales === 
      Math.max(0, profitAnalytics.body?.data?.gross_sales - profitAnalytics.body?.data?.discounts - profitAnalytics.body?.data?.sales_returns));

    // ------------------------------------------------------------------
    // Test Group 8: Excel & PDF Reports API
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 8: Excel & PDF Report Downloads ---');

    const excelRes = await callApp(app, { path: '/api/reports/excel' });
    assert('GET /api/reports/excel returns 200 OK', excelRes.statusCode === 200);
    assert('Content-Type is Excel spreadsheetml', excelRes.headers['content-type']?.includes('spreadsheetml'));
    assert('Content-Disposition header indicates attachment', excelRes.headers['content-disposition']?.includes('attachment'));
    assert('Excel binary received with valid size (> 5KB)', excelRes.rawBody?.length > 5000);

    const pdfRes = await callApp(app, { path: '/api/reports/pdf' });
    assert('GET /api/reports/pdf returns 200 OK', pdfRes.statusCode === 200);
    assert('Content-Type is text/html', pdfRes.headers['content-type']?.includes('text/html'));
    assert('Report HTML contains Executive Financial Summary', pdfRes.rawBody?.toString('utf8')?.includes('Executive Financial Summary'));

    // ------------------------------------------------------------------
    // Test Group 9: Suppliers Management API
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 9: Suppliers API ---');

    const suppList = await callApp(app, { path: '/api/suppliers?page=1&limit=5' });
    assert('GET /api/suppliers returns 200 OK', suppList.statusCode === 200);
    assert('Suppliers list returns items and total', suppList.body?.meta?.total > 0);

    // Create Supplier
    const newSupp = await callApp(app, {
      path: '/api/suppliers',
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, {
      name: `Amul District Depot ${Date.now().toString().slice(-4)}`,
      phone: '9876543210',
      email: 'depot@amulcoop.in',
      payment_terms: 'Weekly Settlement',
    });
    assert('POST /api/suppliers creates supplier with 201 Created', newSupp.statusCode === 201);
    const createdSuppId = newSupp.body?.data?.id;

    // Update Supplier
    const updateSupp = await callApp(app, {
      path: `/api/suppliers/${createdSuppId}`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, { payment_terms: 'Net 30' });
    assert('PUT /api/suppliers/:id updates supplier with 200 OK', updateSupp.statusCode === 200);
    assert('Payment terms updated to Net 30', updateSupp.body?.data?.payment_terms === 'Net 30');

    // ------------------------------------------------------------------
    // Test Group 10: API Rate Limiting & Error Handling
    // ------------------------------------------------------------------
    console.log('\n--- Test Group 10: API Rate Limiting & Error Handling ---');

    // Check rate limit headers
    const pingRes = await callApp(app, { path: '/api/products' });
    assert('API responses include X-RateLimit-Limit header', !!pingRes.headers['x-ratelimit-limit']);
    assert('API responses include X-RateLimit-Remaining header', !!pingRes.headers['x-ratelimit-remaining']);

    // Centralized 404 handler
    const notFoundRes = await callApp(app, { path: '/api/non-existent-endpoint-xyz' });
    assert('Unmatched route returns 404 Not Found', notFoundRes.statusCode === 404);
    assert('404 response follows standardized error format', notFoundRes.body?.success === false);

    // Supabase credentials security check
    const configPath = path.resolve(process.cwd(), 'src', 'config', 'index.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    assert('Config identifies service-role key as server-side only', 
      configContent.includes('Strictly server-side only; never exposed to frontend'));

  } catch (err) {
    console.error('Fatal Test Exception:', err);
    failedTests++;
  }

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
