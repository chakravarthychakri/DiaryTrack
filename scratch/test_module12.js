// ====================================================================
// COMPREHENSIVE AUTOMATED TEST SUITE FOR MODULE 12:
// ANALYTICS AND BUSINESS INTELLIGENCE
// ====================================================================
const app = require('../server/index');
const { db } = require('../server/db');
const crypto = require('crypto');
const XLSX = require('xlsx');

// Create test session for Admin user
const token = 'test-token-mod12-' + crypto.randomBytes(16).toString('hex');
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

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('STARTING MODULE 12: ANALYTICS & BUSINESS INTELLIGENCE TESTS');
  console.log('=============================================================\n');

  try {
    // -----------------------------------------------------------
    // TEST GROUP 1: ANALYTICS DASHBOARD API & PROFIT FORMULAS (12.4)
    // -----------------------------------------------------------
    console.log('--- Test Group 1: 12.4 Profit Analytics Calculations ---');
    const dashRes = await callApp('GET', '/api/analytics/dashboard?range=all');
    assert(dashRes.status === 200, 'GET /api/analytics/dashboard returns 200 OK');
    assert(dashRes.data && dashRes.data.success === true, 'Response success is true');

    const pa = dashRes.data.data.profit_analytics;
    assert(pa !== undefined, 'profit_analytics object is returned');

    console.log('  Profit Analytics Metrics:', {
      gross_sales: pa.gross_sales,
      discounts: pa.discounts,
      sales_returns: pa.sales_returns,
      net_sales: pa.net_sales,
      cogs: pa.cogs,
      gross_profit: pa.gross_profit,
      gross_margin_pct: pa.gross_margin_pct,
      operating_expenses: pa.operating_expenses.total,
      operating_profit: pa.operating_profit,
      spoilage_loss: pa.spoilage_loss,
      net_business_profit: pa.net_business_profit
    });

    // Verification of exact business formulas:
    // Net Sales = Gross Sales - Discounts - Sales Returns
    const expectedNetSales = Math.max(0, Number((pa.gross_sales - pa.discounts - pa.sales_returns).toFixed(2)));
    assert(Math.abs(pa.net_sales - expectedNetSales) < 0.05, `Net Sales correctly calculated: ₹${pa.net_sales} == ₹${expectedNetSales}`);

    // Gross Profit = Net Sales - Cost of Goods Sold
    const expectedGrossProfit = Number((pa.net_sales - pa.cogs).toFixed(2));
    assert(Math.abs(pa.gross_profit - expectedGrossProfit) < 0.05, `Gross Profit correctly calculated: ₹${pa.gross_profit} == ₹${expectedGrossProfit}`);

    // Operating Profit = Gross Profit - Operating Expenses
    const expectedOperatingProfit = Number((pa.gross_profit - pa.operating_expenses.total).toFixed(2));
    assert(Math.abs(pa.operating_profit - expectedOperatingProfit) < 0.05, `Operating Profit correctly calculated: ₹${pa.operating_profit} == ₹${expectedOperatingProfit}`);

    // Net Business Profit = Operating Profit - Spoilage Loss
    const expectedNetBusinessProfit = Number((pa.operating_profit - pa.spoilage_loss).toFixed(2));
    assert(Math.abs(pa.net_business_profit - expectedNetBusinessProfit) < 0.05, `Net Business Profit correctly accounts for Spoilage: ₹${pa.net_business_profit} == ₹${expectedNetBusinessProfit}`);

    // Operating Expenses categorized
    const expBk = pa.operating_expenses.breakdown;
    assert(expBk['Rent'] !== undefined, 'Rent expense category is tracked');
    assert(expBk['Electricity'] !== undefined, 'Electricity expense category is tracked');
    assert(expBk['Transport'] !== undefined, 'Transport expense category is tracked');
    assert(expBk['Employee Salaries'] !== undefined, 'Employee salaries expense category is tracked');
    assert(expBk['Other Expenses'] !== undefined, 'Other expenses category is tracked');

    // -----------------------------------------------------------
    // TEST GROUP 2: 12.1 TOP-SELLING PRODUCTS (SWITCHABLE RANKINGS)
    // -----------------------------------------------------------
    console.log('\n--- Test Group 2: 12.1 Top-Selling Products Switcher ---');
    const tp = dashRes.data.data.top_products;
    assert(Array.isArray(tp.by_quantity), 'top_products.by_quantity is an array');
    assert(Array.isArray(tp.by_revenue), 'top_products.by_revenue is an array');
    assert(Array.isArray(tp.by_transactions), 'top_products.by_transactions is an array');

    assert(tp.by_quantity.length <= 5, 'Top 5 products by quantity contains at most 5 items');
    assert(tp.by_revenue.length <= 5, 'Top 5 products by revenue contains at most 5 items');
    assert(tp.by_transactions.length <= 5, 'Top 5 products by transactions contains at most 5 items');

    if (tp.by_quantity.length > 1) {
      assert(tp.by_quantity[0].quantity_sold >= tp.by_quantity[1].quantity_sold, 'Top by quantity is sorted descending');
    }
    if (tp.by_revenue.length > 1) {
      assert(tp.by_revenue[0].revenue_generated >= tp.by_revenue[1].revenue_generated, 'Top by revenue is sorted descending');
    }
    if (tp.by_transactions.length > 1) {
      assert(tp.by_transactions[0].transaction_count >= tp.by_transactions[1].transaction_count, 'Top by transactions is sorted descending');
    }

    console.log('  Top 1 by Quantity:', tp.by_quantity[0] ? `${tp.by_quantity[0].name} (${tp.by_quantity[0].quantity_sold} ${tp.by_quantity[0].unit})` : 'N/A');
    console.log('  Top 1 by Revenue:', tp.by_revenue[0] ? `${tp.by_revenue[0].name} (₹${tp.by_revenue[0].revenue_generated})` : 'N/A');
    console.log('  Top 1 by Orders:', tp.by_transactions[0] ? `${tp.by_transactions[0].name} (${tp.by_transactions[0].transaction_count} orders)` : 'N/A');

    // -----------------------------------------------------------
    // TEST GROUP 3: 12.2 LOWEST-SELLING & STAGNANT PRODUCTS
    // -----------------------------------------------------------
    console.log('\n--- Test Group 3: 12.2 Lowest-Selling & Stagnant Inventory ---');
    const iv = dashRes.data.data.inventory_velocity;
    assert(Array.isArray(iv.low_sellers), 'inventory_velocity.low_sellers is an array');
    assert(Array.isArray(iv.zero_sellers), 'inventory_velocity.zero_sellers is an array');
    assert(Array.isArray(iv.slow_moving), 'inventory_velocity.slow_moving is an array');
    assert(Array.isArray(iv.promotional_attention), 'inventory_velocity.promotional_attention is an array');

    if (iv.slow_moving.length > 0) {
      const sm1 = iv.slow_moving[0];
      assert(sm1.recommendation !== undefined, `Slow mover tagged with actionable recommendation: "${sm1.recommendation}"`);
      assert(sm1.stock_to_sales_ratio !== undefined, `Stock-to-sales ratio computed: ${sm1.stock_to_sales_ratio}`);
    }

    // -----------------------------------------------------------
    // TEST GROUP 4: 12.3 SALES ANALYTICS BREAKDOWNS
    // -----------------------------------------------------------
    console.log('\n--- Test Group 4: 12.3 Sales Analytics Breakdowns ---');
    const sa = dashRes.data.data.sales_analytics;
    assert(Array.isArray(sa.daily), 'Daily sales breakdown is present');
    assert(Array.isArray(sa.weekly), 'Weekly sales breakdown is present');
    assert(Array.isArray(sa.monthly), 'Monthly sales breakdown is present');
    assert(Array.isArray(sa.yearly), 'Yearly sales breakdown is present');
    assert(Array.isArray(sa.category_breakdown), 'Category breakdown is present');
    assert(Array.isArray(sa.product_breakdown), 'Product breakdown is present');
    assert(Array.isArray(sa.payment_methods), 'Payment methods analysis is present');

    if (sa.category_breakdown.length > 0) {
      const cat1 = sa.category_breakdown[0];
      assert(cat1.category !== undefined && cat1.revenue !== undefined && cat1.margin_pct !== undefined, 'Category sales record has name, revenue, and margin %');
    }

    if (sa.payment_methods.length > 0) {
      const pm1 = sa.payment_methods[0];
      assert(pm1.payment_method !== undefined && pm1.percentage_share !== undefined, `Payment method ${pm1.payment_method} has share ${pm1.percentage_share}%`);
    }

    // -----------------------------------------------------------
    // TEST GROUP 5: DATE RANGE & CATEGORY FILTERS
    // -----------------------------------------------------------
    console.log('\n--- Test Group 5: Reactive Date Range & Category Filtering ---');
    const todayRes = await callApp('GET', '/api/analytics/dashboard?range=today');
    assert(todayRes.status === 200, 'GET /api/analytics/dashboard?range=today succeeds');

    const sevenDaysRes = await callApp('GET', '/api/analytics/dashboard?range=7days');
    assert(sevenDaysRes.status === 200, 'GET /api/analytics/dashboard?range=7days succeeds');

    const monthRes = await callApp('GET', '/api/analytics/dashboard?range=this_month');
    assert(monthRes.status === 200, 'GET /api/analytics/dashboard?range=this_month succeeds');

    const yearRes = await callApp('GET', '/api/analytics/dashboard?range=this_year');
    assert(yearRes.status === 200, 'GET /api/analytics/dashboard?range=this_year succeeds');

    const customRes = await callApp('GET', '/api/analytics/dashboard?range=custom&startDate=2026-11-01&endDate=2026-11-15');
    assert(customRes.status === 200, 'GET /api/analytics/dashboard with custom dates succeeds');

    const catFilterRes = await callApp('GET', '/api/analytics/dashboard?range=all&categoryId=1');
    assert(catFilterRes.status === 200, 'GET /api/analytics/dashboard with categoryId=1 succeeds');

    // -----------------------------------------------------------
    // TEST GROUP 6: OPERATING EXPENSES CRUD OPERATIONS
    // -----------------------------------------------------------
    console.log('\n--- Test Group 6: Operating Expenses CRUD ---');
    const getExpRes = await callApp('GET', '/api/expenses');
    assert(getExpRes.status === 200, 'GET /api/expenses returns 200 OK');
    assert(Array.isArray(getExpRes.data.data), 'Expenses list returned as array');
    assert(getExpRes.data.total > 0, `Initial total expenses recorded: ₹${getExpRes.data.total}`);

    // Create a new expense
    const newExpPayload = {
      expense_date: '2026-11-16',
      category: 'Electricity',
      title: 'Solar Backup & Inverter Battery Maintenance',
      amount: 3500,
      payment_mode: 'UPI',
      reference_no: 'UPI-TEST-99001',
      notes: 'Automated test suite expense entry'
    };

    const createExpRes = await callApp('POST', '/api/expenses', newExpPayload);
    assert(createExpRes.status === 201, 'POST /api/expenses returns 201 Created');
    assert(createExpRes.data && createExpRes.data.data && createExpRes.data.data.id > 0, 'Created expense returns positive ID');
    const createdExpId = createExpRes.data.data.id;

    // Verify it exists in list
    const verifyExpRes = await callApp('GET', `/api/expenses?search=UPI-TEST-99001`);
    assert(verifyExpRes.data.data.length === 1, 'Newly created expense found via search');
    assert(verifyExpRes.data.data[0].amount === 3500, 'Expense amount matches 3500');

    // Delete test expense
    const delExpRes = await callApp('DELETE', `/api/expenses/${createdExpId}`);
    assert(delExpRes.status === 200, 'DELETE /api/expenses/:id returns 200 OK');

    // Verify deletion
    const verifyDelRes = await callApp('GET', `/api/expenses?search=UPI-TEST-99001`);
    assert(verifyDelRes.data.data.length === 0, 'Expense successfully removed from database');

    // -----------------------------------------------------------
    // TEST GROUP 7: EXCEL BI & ANALYTICS REPORT EXPORT
    // -----------------------------------------------------------
    console.log('\n--- Test Group 7: Excel BI Report Export ---');
    const reportRes = await callApp('GET', '/api/reports/download/analytics?range=all');
    assert(reportRes.status === 200, 'GET /api/reports/download/analytics returns 200 OK');
    assert(
      (reportRes.headers['content-type'] || '').includes('spreadsheetml'),
      'Content-type is application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    assert(reportRes.buffer && reportRes.buffer.length > 2000, `Excel file received with binary payload of ${reportRes.buffer.length} bytes`);

    // Parse Excel workbook with XLSX library to verify sheet structure
    const wb = XLSX.read(reportRes.buffer, { type: 'buffer' });
    console.log('  Worksheet names in exported workbook:', wb.SheetNames);
    assert(wb.SheetNames.includes('Executive P&L Summary'), 'Sheet "Executive P&L Summary" is present');
    assert(wb.SheetNames.includes('Sales Daily Trend'), 'Sheet "Sales Daily Trend" is present');
    assert(wb.SheetNames.includes('Product Performance & BI'), 'Sheet "Product Performance & BI" is present');
    assert(wb.SheetNames.includes('Category BI'), 'Sheet "Category BI" is present');
    assert(wb.SheetNames.includes('Operating Expenses Ledger'), 'Sheet "Operating Expenses Ledger" is present');

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    // Clean up test session token
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  }
}

runTests();
