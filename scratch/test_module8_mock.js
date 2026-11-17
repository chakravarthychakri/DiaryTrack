// ====================================================================
// Module 8 Automated Test Suite: Stock Movement Management & Audit Trail
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
  console.log("🧪 RUNNING COMPREHENSIVE TESTS FOR MODULE 8: STOCK MOVEMENTS");
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

  // 1. Authenticate as Administrator
  console.log("--- 1. Authenticate Administrator ---");
  const loginRes = await invokeApp('POST', '/api/auth/login', {
    login: 'admin',
    password: 'admin123'
  });
  assert(loginRes.status === 200 && loginRes.data.success, "Admin login successful");
  const token = loginRes.data.token || loginRes.data.data?.token;
  assert(!!token, "Received valid JWT token");
  const authHeaders = { authorization: `Bearer ${token}` };

  // 2. Test GET /api/movements/types
  console.log("\n--- 2. Movement Types Metadata (12 Movement Types) ---");
  const typesRes = await invokeApp('GET', '/api/movements/types', null, authHeaders);
  assert(typesRes.status === 200 && typesRes.data.success, "GET /api/movements/types returns 200 OK");
  const incoming = typesRes.data.data.INCOMING.map(t => t.type);
  const outgoing = typesRes.data.data.OUTGOING.map(t => t.type);
  assert(incoming.includes('Opening Stock') && incoming.includes('Purchase Received') && incoming.includes('Customer Return') && incoming.includes('Transfer In') && incoming.includes('Authorized Stock Correction'),
    "Includes all 5 canonical Incoming (Inflow) types");
  assert(outgoing.includes('Sales') && outgoing.includes('Supplier Return') && outgoing.includes('Transfer Out') && outgoing.includes('Damaged Stock') && outgoing.includes('Expired Stock') && outgoing.includes('Wastage') && outgoing.includes('Other Authorized Adjustment'),
    "Includes all 7 canonical Outgoing (Outflow) types");

  // 3. Test GET /api/movements/stats
  console.log("\n--- 3. Stock Movement Summary Stats (KPIs) ---");
  const statsRes = await invokeApp('GET', '/api/movements/stats', null, authHeaders);
  assert(statsRes.status === 200 && statsRes.data.success, "GET /api/movements/stats returns 200 OK");
  const stats = statsRes.data.data;
  assert(typeof stats.total_movements === 'number' && stats.total_movements >= 0, `Total movements metric: ${stats.total_movements}`);
  assert(typeof stats.total_inflow_units === 'number', `Total inflow units: ${stats.total_inflow_units}`);
  assert(typeof stats.total_outflow_units === 'number', `Total outflow units: ${stats.total_outflow_units}`);
  assert(typeof stats.net_units_delta === 'number', `Net units delta: ${stats.net_units_delta}`);

  // 4. Test GET /api/movements (List & Filtering)
  console.log("\n--- 4. List Stock Movements with Relational Fields ---");
  const listRes = await invokeApp('GET', '/api/movements?page=1&limit=10', null, authHeaders);
  assert(listRes.status === 200 && listRes.data.success, "GET /api/movements returns 200 OK");
  assert(Array.isArray(listRes.data.data), "Returns array of movement records");
  assert(listRes.data.pagination && typeof listRes.data.pagination.total === 'number', "Includes pagination metadata");
  
  if (listRes.data.data.length > 0) {
    const firstMov = listRes.data.data[0];
    assert('previous_stock' in firstMov && 'updated_stock' in firstMov, "Movement contains previous_stock and updated_stock evolution fields");
    assert('flow_type' in firstMov, `Movement contains flow_type (${firstMov.flow_type})`);
    assert(!!firstMov.product_name, `Movement joined with product name (${firstMov.product_name})`);
  }

  // Flow filter test: inflow
  const inflowListRes = await invokeApp('GET', '/api/movements?flow=inflow', null, authHeaders);
  assert(inflowListRes.status === 200 && inflowListRes.data.data.every(m => m.flow_type.toLowerCase() === 'inflow'),
    "Flow filter 'inflow' returns only Inflow records");

  // Flow filter test: outflow
  const outflowListRes = await invokeApp('GET', '/api/movements?flow=outflow', null, authHeaders);
  assert(outflowListRes.status === 200 && outflowListRes.data.data.every(m => m.flow_type.toLowerCase() === 'outflow'),
    "Flow filter 'outflow' returns only Outflow records");

  // 5. Test GET /api/movements/:id (Single Movement Voucher)
  console.log("\n--- 5. Single Movement Voucher Details ---");
  const targetId = listRes.data.data[0]?.id || 1;
  const detailRes = await invokeApp('GET', `/api/movements/${targetId}`, null, authHeaders);
  assert(detailRes.status === 200 && detailRes.data.success, `GET /api/movements/${targetId} returns 200 OK`);
  assert(detailRes.data.data.id === targetId, `Returned movement ID matches requested (${detailRes.data.data.id})`);
  assert(Array.isArray(detailRes.data.data.corrections), "Movement detail contains linked corrections array");

  // 6. Test STRICT IMMUTABILITY GUARDS (PUT & DELETE blocked)
  console.log("\n--- 6. Strict Immutability Guards (PUT / DELETE forbidden) ---");
  const putRes = await invokeApp('PUT', `/api/movements/${targetId}`, { quantity: 999 }, authHeaders);
  assert(putRes.status === 403, "Direct edit PUT /api/movements/:id is BLOCKED with 403 Forbidden");
  assert(putRes.data.error.includes("strictly prohibited"), "Audit error explains that direct modification is prohibited");

  const deleteRes = await invokeApp('DELETE', `/api/movements/${targetId}`, null, authHeaders);
  assert(deleteRes.status === 403, "Direct delete DELETE /api/movements/:id is BLOCKED with 403 Forbidden");
  assert(deleteRes.data.error.includes("permanent auditable ledger"), "Audit error explains that records cannot be deleted");

  // 7. Test POST /api/movements (Record Manual Movement: Damaged Stock)
  console.log("\n--- 7. Record Manual Stock Movement (Damaged Stock) ---");
  // Find an active batch
  const batchesRes = await invokeApp('GET', '/api/inventory/batches?status=Active', null, authHeaders);
  const activeBatch = batchesRes.data?.data?.[0];
  assert(!!activeBatch, `Found active batch #${activeBatch?.batch_number} (Qty: ${activeBatch?.current_quantity})`);

  const prevBatchQty = Number(activeBatch.current_quantity);
  const damageQty = 2.0;

  const moveRes = await invokeApp('POST', '/api/movements', {
    movement_type: 'Damaged Stock',
    product_id: activeBatch.product_id,
    batch_id: activeBatch.id,
    from_branch_id: activeBatch.branch_id || 1,
    quantity: damageQty,
    reason: 'Bottle seal cracked during transit',
    reference_txn: `DMG-${Date.now().toString().slice(-4)}`
  }, authHeaders);

  assert(moveRes.status === 200 && moveRes.data.success, "POST /api/movements successfully logged Damaged Stock");
  const createdMovId = moveRes.data.id;

  // Verify stock was reduced in the batch
  const verifyBatchRes = await invokeApp('GET', `/api/inventory/batches?productId=${activeBatch.product_id}`, null, authHeaders);
  const updatedBatch = verifyBatchRes.data?.data?.find(b => b.id === activeBatch.id);
  assert(updatedBatch && Number(updatedBatch.current_quantity) === Number((prevBatchQty - damageQty).toFixed(2)),
    `Batch quantity decremented from ${prevBatchQty} to ${updatedBatch?.current_quantity}`);

  // 8. Test POST /api/movements/correction (Authorized Auditable Correction)
  console.log("\n--- 8. Authorized Auditable Stock Correction ---");
  
  // Test 8a: Rejection on missing justification
  const badCorrRes = await invokeApp('POST', '/api/movements/correction', {
    movement_id: createdMovId,
    product_id: activeBatch.product_id,
    batch_id: activeBatch.id,
    correction_type: 'Surplus Correction (Inflow)',
    quantity: 1.0,
    reason: '' // Empty reason
  }, authHeaders);
  assert(badCorrRes.status === 400 && !badCorrRes.data.success, "Stock correction rejected when reason is missing or < 5 chars");

  // Test 8b: Surplus Correction (Add back 1 unit)
  const surplusQty = 1.0;
  const goodCorrRes = await invokeApp('POST', '/api/movements/correction', {
    movement_id: createdMovId,
    product_id: activeBatch.product_id,
    batch_id: activeBatch.id,
    correction_type: 'Surplus Correction (Inflow)',
    quantity: surplusQty,
    reference_txn: `CORR-AUDIT-${Date.now().toString().slice(-4)}`,
    reason: 'Physical inspection found 1 intact sealed unit mistakenly written off'
  }, authHeaders);

  assert(goodCorrRes.status === 200 && goodCorrRes.data.success, "Authorized Surplus Correction successfully recorded");
  const corrMovId = goodCorrRes.data.id;

  // Verify batch stock increased by surplusQty
  const verifyBatchRes2 = await invokeApp('GET', `/api/inventory/batches?productId=${activeBatch.product_id}`, null, authHeaders);
  const batchAfterCorr = verifyBatchRes2.data?.data?.find(b => b.id === activeBatch.id);
  assert(batchAfterCorr && Number(batchAfterCorr.current_quantity) === Number((updatedBatch.current_quantity + surplusQty).toFixed(2)),
    `Batch quantity after surplus correction is restored to ${batchAfterCorr?.current_quantity}`);

  // Verify the original movement now shows this correction in its details
  const originalWithCorrRes = await invokeApp('GET', `/api/movements/${createdMovId}`, null, authHeaders);
  assert(originalWithCorrRes.data.data.corrections.some(c => c.id === corrMovId),
    `Original movement #${createdMovId} links to audit correction #${corrMovId}`);

  // 9. Test Excel Export /api/reports/download/movements
  console.log("\n--- 9. Excel Movements Audit Report Export ---");
  const exportRes = await invokeApp('GET', '/api/reports/download/movements', null, authHeaders);
  assert(exportRes.status === 200, "GET /api/reports/download/movements returns 200 OK");
  assert(exportRes.headers['content-type'].includes('spreadsheetml'), "Content-Type is Excel spreadsheetml");
  const isZip = Buffer.isBuffer(exportRes.data) && exportRes.data[0] === 0x50 && exportRes.data[1] === 0x4B;
  assert(isZip, "Export payload is a valid binary .xlsx workbook (PK zip header)");

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
