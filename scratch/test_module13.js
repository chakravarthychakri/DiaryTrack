// ====================================================================
// COMPREHENSIVE AUTOMATED TEST SUITE FOR MODULE 13:
// EXCEL REPORT GENERATION (EXCELJS)
// ====================================================================
const app = require('../server/index');
const { db } = require('../server/db');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

// Create test session for Admin user
const token = 'test-token-mod13-' + crypto.randomBytes(16).toString('hex');
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
  console.log('STARTING MODULE 13: EXCEL REPORT GENERATION TESTS (EXCELJS)');
  console.log('=============================================================\n');

  try {
    // -----------------------------------------------------------
    // TEST GROUP 1: MASTER COMPLETE 10-SHEET WORKBOOK (13.2)
    // -----------------------------------------------------------
    console.log('--- Test Group 1: 13.2 Master 10-Sheet Workbook Structure ---');
    const masterRes = await callApp('GET', '/api/reports/download/master?range=all');
    assert(masterRes.status === 200, 'GET /api/reports/download/master returns 200 OK');
    assert(masterRes.headers['content-type'].includes('spreadsheetml'), 'Content-Type is Excel spreadsheetml');
    assert(masterRes.buffer && masterRes.buffer.length > 5000, `Workbook generated with binary size ${masterRes.buffer.length} bytes`);

    // Parse workbook using ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(masterRes.buffer);

    const sheetNames = workbook.worksheets.map(w => w.name);
    console.log('  Worksheets found in master workbook:', sheetNames);

    const expectedSheets = [
      'Dashboard Summary',
      'Product Master',
      'Daily Sales',
      'Purchase History',
      'Current Inventory',
      'Stock Movement',
      'Top Selling Products',
      'Profit and Loss',
      'Expired and Damaged',
      'Supplier Report'
    ];

    expectedSheets.forEach(sheetName => {
      assert(sheetNames.includes(sheetName), `Master workbook includes "${sheetName}"`);
    });

    assert(workbook.worksheets.length === 10, 'Workbook contains exactly 10 distinct worksheets');

    // -----------------------------------------------------------
    // TEST GROUP 2: EXCEL FORMATTING VALIDATION (13.3)
    // -----------------------------------------------------------
    console.log('\n--- Test Group 2: 13.3 Professional ExcelJS Formatting ---');
    
    // Check Sheet 3 (Daily Sales) for green header, white text, borders, auto-filter, frozen rows
    const salesWs = workbook.getWorksheet('Daily Sales');
    assert(salesWs !== undefined, 'Found Daily Sales worksheet');

    const headerRow = salesWs.getRow(1);
    const firstHeaderCell = headerRow.getCell(1);

    // Green Header & White Text
    assert(firstHeaderCell.fill && firstHeaderCell.fill.fgColor && firstHeaderCell.fill.fgColor.argb === 'FF15803D', 'Header fill is Green (FF15803D)');
    assert(firstHeaderCell.font && firstHeaderCell.font.color && firstHeaderCell.font.color.argb === 'FFFFFFFF', 'Header font color is White (FFFFFFFF)');
    assert(firstHeaderCell.font.bold === true, 'Header text is Bold');

    // Frozen Header Row
    assert(salesWs.views && salesWs.views.length > 0, 'Worksheet views configuration exists');
    assert(salesWs.views[0].state === 'frozen' && salesWs.views[0].ySplit >= 1, 'Header row is frozen (ySplit >= 1)');

    // Auto Filter
    assert(salesWs.autoFilter !== undefined && salesWs.autoFilter !== null, 'Excel auto-filter is defined on Daily Sales');

    // Check Data Rows: borders & currency formatting
    if (salesWs.rowCount >= 2) {
      const dataRow = salesWs.getRow(2);
      const cell1 = dataRow.getCell(1);
      assert(cell1.border && cell1.border.top && cell1.border.bottom, 'Data cells have professional borders');

      // Check revenue cell (col 10) currency format
      const revCell = dataRow.getCell(10);
      assert(revCell.numFmt && revCell.numFmt.includes('₹'), 'Revenue cell is formatted with INR currency symbol (₹)');
    }

    // Check Auto column widths
    const col1 = salesWs.getColumn(1);
    assert(col1.width >= 12, `Column 1 width is auto-fitted: ${col1.width} >= 12`);

    // Check Total row with formula
    const lastRow = salesWs.getRow(salesWs.rowCount);
    const firstCellLastRow = lastRow.getCell(1).value;
    assert(firstCellLastRow === 'TOTALS', 'Bottom row is TOTALS row');
    const formulaCell = lastRow.getCell(5); // Qty total
    assert(typeof formulaCell.value === 'object' && formulaCell.value.formula !== undefined, `Totals row contains formula: ${formulaCell.value.formula}`);

    // Check Sheet 5 (Current Inventory) for conditional formatting
    const invWs = workbook.getWorksheet('Current Inventory');
    assert(invWs !== undefined, 'Found Current Inventory worksheet');
    assert(invWs.autoFilter !== undefined, 'Current Inventory has autoFilter enabled');
    assert(invWs.views[0].state === 'frozen', 'Current Inventory has frozen header');

    // -----------------------------------------------------------
    // TEST GROUP 3: 13.1 EXCEL EXPORT OPTIONS & DATE RANGES
    // -----------------------------------------------------------
    console.log('\n--- Test Group 3: 13.1 Timeframe & Filtering Options ---');

    const ranges = ['today', 'yesterday', '7days', '30days', 'this_month', 'last_month', 'all'];
    for (const r of ranges) {
      const res = await callApp('GET', `/api/reports/download/master?range=${r}`);
      assert(res.status === 200, `GET /api/reports/download/master?range=${r} succeeds`);
    }

    // Custom date range
    const customRes = await callApp('GET', '/api/reports/download/master?range=custom&startDate=2026-11-01&endDate=2026-11-15');
    assert(customRes.status === 200, 'GET /api/reports/download/master with custom range succeeds');

    // Filters: Category, Product, Supplier, Branch, Movement Type
    const filterCatRes = await callApp('GET', '/api/reports/download/master?range=all&categoryId=1');
    assert(filterCatRes.status === 200, 'Filtering by categoryId succeeds');

    const filterProdRes = await callApp('GET', '/api/reports/download/master?range=all&productId=1');
    assert(filterProdRes.status === 200, 'Filtering by productId succeeds');

    const filterSupRes = await callApp('GET', '/api/reports/download/master?range=all&supplierId=1');
    assert(filterSupRes.status === 200, 'Filtering by supplierId succeeds');

    const filterBranchRes = await callApp('GET', '/api/reports/download/master?range=all&branchId=1');
    assert(filterBranchRes.status === 200, 'Filtering by branchId succeeds');

    const filterMoveRes = await callApp('GET', '/api/reports/download/master?range=all&movementType=Sales');
    assert(filterMoveRes.status === 200, 'Filtering by movementType succeeds');

    // -----------------------------------------------------------
    // TEST GROUP 4: 13.4 INDIVIDUAL WORKSHEET EXPORTS
    // -----------------------------------------------------------
    console.log('\n--- Test Group 4: 13.4 Individual Worksheet Downloads ---');
    const individualSheets = [
      'dashboard',
      'products',
      'sales',
      'purchases',
      'inventory',
      'movements',
      'top-selling',
      'pnl',
      'waste',
      'suppliers'
    ];

    for (const sheet of individualSheets) {
      const res = await callApp('GET', `/api/reports/download/${sheet}?range=30days`);
      assert(res.status === 200, `Download individual sheet "${sheet}" returns 200 OK`);
      assert(res.buffer && res.buffer.length > 2000, `Individual sheet "${sheet}" size is ${res.buffer.length} bytes`);
    }

    // -----------------------------------------------------------
    // TEST GROUP 5: 13.4 REPORT PREVIEW API
    // -----------------------------------------------------------
    console.log('\n--- Test Group 5: 13.4 Live Report Preview API ---');
    for (const sheet of ['dashboard', 'sales', 'inventory', 'pnl', 'products']) {
      const prevRes = await callApp('GET', `/api/reports/preview?sheet=${sheet}&range=all`);
      assert(prevRes.status === 200, `GET /api/reports/preview?sheet=${sheet} returns 200 OK`);
      assert(prevRes.data && prevRes.data.success === true, 'Preview response success is true');
      assert(Array.isArray(prevRes.data.data.headers), `Preview for ${sheet} contains headers array`);
      assert(Array.isArray(prevRes.data.data.rows), `Preview for ${sheet} contains rows array`);
    }

    // -----------------------------------------------------------
    // TEST GROUP 6: 13.4 PRINT / PDF SUMMARY VIEW
    // -----------------------------------------------------------
    console.log('\n--- Test Group 6: 13.4 Printable Summary & PDF View ---');
    const printRes = await callApp('GET', '/api/reports/print-view?range=all');
    assert(printRes.status === 200, 'GET /api/reports/print-view returns 200 OK');
    assert(printRes.headers['content-type'].includes('text/html'), 'Content-Type is text/html');
    const htmlStr = printRes.buffer.toString('utf8');
    assert(htmlStr.includes('DairyTrack'), 'Print view contains DairyTrack branding');
    assert(htmlStr.includes('Executive Financial Summary'), 'Print view contains Executive Financial Summary');
    assert(htmlStr.includes('window.print()'), 'Print view contains native print trigger');
    assert(htmlStr.includes('Statement of Profit & Loss Overview'), 'Print view contains P&L Overview');

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    // Clean up session token
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
