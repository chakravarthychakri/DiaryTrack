// ====================================================================
// Module 9 Automated Test Suite: Supplier Management & Performance
// ====================================================================

const EventEmitter = require('events');
const app = require('../server/index');

function invokeApp(method, url, body = null, headers = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
    req.headers = { ...headers };
    req.query = {};
    req.ip = '127.0.0.1';
    req.connection = { remoteAddress: '127.0.0.1' };
    req.socket = { remoteAddress: '127.0.0.1' };

    const parsedUrl = new URL(url, 'http://localhost');
    req.originalUrl = url;
    req.path = parsedUrl.pathname;
    const queryObj = {};
    parsedUrl.searchParams.forEach((v, k) => { queryObj[k] = v; });
    req.query = queryObj;

    req.body = body || {};

    const res = new EventEmitter();
    let resHeaders = {};
    let statusCode = 200;
    let resData = '';

    res.statusCode = 200;
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.status = (code) => { statusCode = code; res.statusCode = code; return res; };
    res.json = (json) => {
      resHeaders['content-type'] = 'application/json';
      resolve({ status: statusCode, headers: resHeaders, data: json });
    };
    res.send = (data) => {
      resData = data;
      resolve({ status: statusCode, headers: resHeaders, data: resData });
    };
    res.end = (data) => {
      if (data) resData += data;
      resolve({ status: statusCode, headers: resHeaders, data: resData });
    };

    app.handle(req, res);
  });
}

async function runTests() {
  console.log("====================================================================");
  console.log("🧪 RUNNING COMPREHENSIVE TESTS FOR MODULE 9: SUPPLIER MANAGEMENT");
  console.log("====================================================================\n");

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

  // 1. Authenticate as Administrator & Staff
  console.log("--- 1. Authentication & Role Tokens ---");
  const adminLogin = await invokeApp('POST', '/api/auth/login', { login: 'admin', password: 'admin123' });
  assert(adminLogin.status === 200 && adminLogin.data.success, "Administrator login succeeds");
  const adminToken = adminLogin.data.token || adminLogin.data.data?.token;
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const staffLogin = await invokeApp('POST', '/api/auth/login', { login: 'staff', password: 'password123' });
  const staffToken = staffLogin.status === 200 ? (staffLogin.data.token || staffLogin.data.data?.token) : null;
  const staffHeaders = staffToken ? { authorization: `Bearer ${staffToken}` } : {};

  // 2. Test GET /api/suppliers/stats
  console.log("\n--- 2. Supplier KPI Statistics ---");
  const statsRes = await invokeApp('GET', '/api/suppliers/stats', null, adminHeaders);
  assert(statsRes.status === 200 && statsRes.data.success, "GET /api/suppliers/stats returns 200 OK");
  const stats = statsRes.data.data;
  assert(typeof stats.total_suppliers === 'number' && stats.total_suppliers >= 4, `Total suppliers count: ${stats.total_suppliers}`);
  assert(typeof stats.active_suppliers === 'number', `Active suppliers count: ${stats.active_suppliers}`);
  assert(typeof stats.total_balance_due === 'number', `Total outstanding balance due: ₹${stats.total_balance_due}`);
  assert(typeof stats.lifetime_procurement === 'number', `Lifetime procurement: ₹${stats.lifetime_procurement}`);
  assert(typeof stats.total_returns_value === 'number', `Total returns value: ₹${stats.total_returns_value}`);
  assert(typeof stats.total_paid_value === 'number', `Total settlements paid: ₹${stats.total_paid_value}`);
  assert(typeof stats.overall_defect_rate === 'number', `Overall defect rate: ${stats.overall_defect_rate}%`);

  // 3. Test GET /api/suppliers (List, Enriched Metrics & Filters)
  console.log("\n--- 3. List Suppliers & Relational Performance Metrics ---");
  const listRes = await invokeApp('GET', '/api/suppliers?page=1&limit=10', null, adminHeaders);
  assert(listRes.status === 200 && listRes.data.success, "GET /api/suppliers returns 200 OK");
  assert(Array.isArray(listRes.data.data) && listRes.data.data.length > 0, "Returns list of supplier records");
  assert(!!listRes.data.pagination, "Includes pagination object");

  const s1 = listRes.data.data[0];
  assert(!!s1.formatted_id && s1.formatted_id.startsWith('SUP-'), `Formatted supplier ID present (${s1.formatted_id})`);
  assert(!!s1.company_name, `Company name present (${s1.company_name})`);
  assert('balance_due' in s1, `Balance due present (₹${s1.balance_due})`);
  assert(!!s1.performance && typeof s1.performance.defect_rate === 'number', `Performance metrics scorecard present (Defect: ${s1.performance.defect_rate}%, Grade: ${s1.performance.grade})`);

  // Filter test: search
  const searchRes = await invokeApp('GET', '/api/suppliers?search=Green+Valley', null, adminHeaders);
  assert(searchRes.status === 200 && searchRes.data.data.length > 0 && searchRes.data.data.every(s => s.name.includes('Green') || s.company_name.includes('Green')),
    "Search filter correctly locates suppliers by keyword");

  // Filter test: balance=due
  const dueRes = await invokeApp('GET', '/api/suppliers?balance=due', null, adminHeaders);
  assert(dueRes.status === 200 && dueRes.data.data.every(s => s.balance_due > 0),
    "Balance filter 'due' returns only suppliers with outstanding balances");

  // 4. Test GET /api/suppliers/:id (360-Degree Profile)
  console.log("\n--- 4. Single Supplier 360-Degree Profile & Sub-Ledgers ---");
  const targetSupplierId = s1.id;
  const detailRes = await invokeApp('GET', `/api/suppliers/${targetSupplierId}`, null, adminHeaders);
  assert(detailRes.status === 200 && detailRes.data.success, `GET /api/suppliers/${targetSupplierId} returns 200 OK`);
  const d = detailRes.data.data;
  assert(d.id === targetSupplierId, `Loaded supplier #${d.id} matching requested`);
  assert(Array.isArray(d.purchases), "Contains linked purchases array");
  assert(Array.isArray(d.returns), "Contains linked supplier returns array");
  assert(Array.isArray(d.payments), "Contains linked payment settlements array");
  assert(!!d.metrics && typeof d.metrics.lifetime_procurement === 'number', "Contains calculated metrics scorecard");

  // 5. Test POST /api/suppliers (Add Supplier & RBAC)
  console.log("\n--- 5. Add New Supplier & Validation / RBAC ---");
  // Test 5a: Validation failure on missing name/phone
  const badReqRes = await invokeApp('POST', '/api/suppliers', { name: '', phone: '' }, adminHeaders);
  assert(badReqRes.status === 400 && !badReqRes.data.success, "Validation rejects missing name or phone with 400");

  // Test 5b: RBAC check - Staff cannot create supplier
  if (staffToken) {
    const staffDeniedRes = await invokeApp('POST', '/api/suppliers', {
      name: 'Unauthorized Supplier',
      phone: '+91 99999 00000'
    }, staffHeaders);
    assert(staffDeniedRes.status === 403, "Staff user cannot create supplier (403 Forbidden)");
  }

  // Test 5c: Admin creates supplier
  const uniqueCode = Date.now().toString().slice(-4);
  const newSuppPayload = {
    company_name: `Himalayan Organic Dairy Ltd ${uniqueCode}`,
    name: `Himalayan Milk Farmers Co-op ${uniqueCode}`,
    contact_person: 'Suresh Negi',
    phone: `+91 97111 ${uniqueCode}`,
    email: `contact@himalayandairy${uniqueCode}.com`,
    address: 'Shed 9, Hill Dairy Zone, Shimla',
    gst_number: '02AABCH1234K1Z5',
    payment_terms: 'Weekly',
    status: 'Active',
    opening_balance: 5000
  };

  const createRes = await invokeApp('POST', '/api/suppliers', newSuppPayload, adminHeaders);
  assert(createRes.status === 200 && createRes.data.success, "Administrator successfully registers new supplier");
  const createdSuppId = createRes.data.id;
  assert(!!createdSuppId, `Created supplier assigned ID #${createdSuppId} (${createRes.data.formatted_id})`);

  // Verify created supplier details
  const verifyCreated = await invokeApp('GET', `/api/suppliers/${createdSuppId}`, null, adminHeaders);
  assert(verifyCreated.data.data.company_name === newSuppPayload.company_name, "Company name persisted correctly");
  assert(verifyCreated.data.data.balance_due === 5000, "Initial opening balance persisted correctly (₹5,000)");

  // 6. Test PUT /api/suppliers/:id (Edit Supplier Profile)
  console.log("\n--- 6. Edit Supplier Profile ---");
  const editPayload = {
    company_name: `Himalayan Organic Dairy Ltd (HQ)`,
    name: `Himalayan Milk Farmers Co-op (Updated)`,
    contact_person: 'Suresh Negi (Director)',
    phone: `+91 97111 ${uniqueCode}`,
    email: `info@himalayandairy.com`,
    address: 'Shed 9 & 10, Hill Dairy Zone, Shimla',
    gst_number: '02AABCH1234K1Z5',
    payment_terms: 'Net 15',
    status: 'Active'
  };

  const editRes = await invokeApp('PUT', `/api/suppliers/${createdSuppId}`, editPayload, adminHeaders);
  assert(editRes.status === 200 && editRes.data.success, "PUT /api/suppliers/:id successfully updates profile");

  const verifyEdited = await invokeApp('GET', `/api/suppliers/${createdSuppId}`, null, adminHeaders);
  assert(verifyEdited.data.data.contact_person === 'Suresh Negi (Director)', "Contact person updated");
  assert(verifyEdited.data.data.payment_terms === 'Net 15', "Payment terms updated to Net 15");

  // 7. Test POST /api/suppliers/:id/pay (Payment Settlement & Balance Deduction)
  console.log("\n--- 7. Record Settlement Payment & Ledger Update ---");
  const payAmount = 2000;
  const payRes = await invokeApp('POST', `/api/suppliers/${createdSuppId}/pay`, {
    amount: payAmount,
    payment_mode: 'UPI',
    reference_no: `UPI-TEST-${uniqueCode}`,
    payment_date: '2026-11-17',
    notes: 'Advance settlement for morning milk delivery'
  }, adminHeaders);

  assert(payRes.status === 200 && payRes.data.success, "Payment settlement recorded successfully");
  assert(payRes.data.new_balance_due === 3000, `Balance due decreased from ₹5000 to ₹${payRes.data.new_balance_due} (5000 - 2000)`);

  // Verify payment is now listed in supplier payment history
  const payListRes = await invokeApp('GET', `/api/suppliers/${createdSuppId}/payments`, null, adminHeaders);
  assert(payListRes.status === 200 && payListRes.data.data.some(p => p.amount === payAmount && p.reference_no === `UPI-TEST-${uniqueCode}`),
    "Payment appears in supplier's dedicated payment journal");

  // 8. Test Sub-resource Endpoints
  console.log("\n--- 8. Supplier Sub-resource History Endpoints ---");
  const purchasesRes = await invokeApp('GET', `/api/suppliers/1/purchases`, null, adminHeaders);
  assert(purchasesRes.status === 200 && Array.isArray(purchasesRes.data.data), "GET /api/suppliers/1/purchases returns purchase orders");

  const returnsRes = await invokeApp('GET', `/api/suppliers/2/returns`, null, adminHeaders);
  assert(returnsRes.status === 200 && Array.isArray(returnsRes.data.data), "GET /api/suppliers/2/returns returns vendor returns");

  // 9. Test Excel Report Generation
  console.log("\n--- 9. Supplier-Wise Purchase Excel Report Export ---");
  const reportRes = await invokeApp('GET', '/api/reports/download/supplier-purchases', null, adminHeaders);
  assert(reportRes.status === 200, "GET /api/reports/download/supplier-purchases returns 200 OK");
  assert(reportRes.headers['content-type'].includes('spreadsheetml'), "Content-Type is Excel spreadsheetml");
  const isZip = Buffer.isBuffer(reportRes.data) && reportRes.data[0] === 0x50 && reportRes.data[1] === 0x4B;
  assert(isZip, "Report payload is a valid binary .xlsx workbook (PK header)");

  // Test supplier-specific statement export
  const singleReportRes = await invokeApp('GET', `/api/suppliers/report?supplierId=1`, null, adminHeaders);
  assert(singleReportRes.status === 200, "GET /api/suppliers/report?supplierId=1 returns 200 OK");

  console.log("\n====================================================================");
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("====================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
