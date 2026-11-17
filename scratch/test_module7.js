const http = require('http');
const app = require('../server/index');

function request(port, path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { ...headers };
    if (body) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: path,
      method: method,
      headers: reqHeaders
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting MODULE 7: PURCHASES AND PROCUREMENT Automated Verification Suite...\n');
  
  // Start server on an ephemeral port in the same process
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const port = server.address().port;
  console.log(`  Test server listening on ephemeral port: ${port}\n`);

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // 1. Authenticate as Administrator
    const loginRes = await request(port, '/api/auth/login', 'POST', { login: 'admin', password: 'admin123' });
    assert(loginRes.status === 200 && loginRes.data.success, 'Administrator login succeeds');
    const token = loginRes.data.data.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    };

    // 2. Test KPI Stats
    const statsRes = await request(port, '/api/purchases/stats', 'GET', null, authHeaders);
    assert(statsRes.status === 200 && statsRes.data.success, 'GET /api/purchases/stats returns 200');
    assert(typeof statsRes.data.data.total_procurement_spend === 'number', 'KPI returns total procurement spend');
    assert(typeof statsRes.data.data.total_supplier_payables === 'number', 'KPI returns supplier payables');

    // 3. Test CRITICAL CONSTRAINT: Draft PO MUST NOT increase stock
    const prodRes = await request(port, '/api/products/1', 'GET', null, authHeaders);
    const initialStock = prodRes.data.data.current_stock;
    console.log(`\n  Initial stock for Product 1 (${prodRes.data.data.name}): ${initialStock} ${prodRes.data.data.unit}`);

    const batchesBefore = await request(port, '/api/inventory/batches?productId=1', 'GET', null, authHeaders);
    const initialBatchCount = batchesBefore.data.data.length;

    // Create Draft Purchase Order for 100 units
    const draftPoRes = await request(port, '/api/purchases', 'POST', {
      supplier_id: 1,
      branch_id: 1,
      purchase_date: '2026-11-17',
      status: 'Draft',
      invoice_no: `TEST-DRAFT-${Date.now().toString().slice(-4)}`,
      payment_status: 'Unpaid',
      payment_method: 'Bank Transfer',
      notes: 'Draft order for constraint verification',
      items: [
        {
          product_id: 1,
          batch_number: `BAT-DRAFT-${Date.now().toString().slice(-4)}`,
          quantity: 100,
          unit_cost: 55,
          mfg_date: '2026-11-17',
          expiry_date: '2026-11-20'
        }
      ]
    }, authHeaders);

    assert(draftPoRes.status === 200 && draftPoRes.data.success, 'Draft Purchase Order created successfully');
    assert(draftPoRes.data.status === 'Draft', 'PO record status is Draft');
    const draftPoId = draftPoRes.data.id;

    // VERIFY STOCK HAS NOT CHANGED
    const prodAfterDraft = await request(port, '/api/products/1', 'GET', null, authHeaders);
    assert(prodAfterDraft.data.data.current_stock === initialStock,
      `CRITICAL CONSTRAINT MET: Stock did NOT change after Draft PO! (${initialStock} == ${prodAfterDraft.data.data.current_stock})`);

    const batchesAfterDraft = await request(port, '/api/inventory/batches?productId=1', 'GET', null, authHeaders);
    assert(batchesAfterDraft.data.data.length === initialBatchCount,
      `Batches count unchanged after Draft PO (${initialBatchCount} == ${batchesAfterDraft.data.data.length})`);

    // 4. Test Edit Draft PO
    const editDraftRes = await request(port, `/api/purchases/${draftPoId}`, 'PUT', {
      supplier_id: 1,
      branch_id: 1,
      purchase_date: '2026-11-17',
      invoice_no: `TEST-DRAFT-MOD-${Date.now().toString().slice(-4)}`,
      payment_status: 'Unpaid',
      payment_method: 'Bank Transfer',
      notes: 'Updated draft order notes',
      items: [
        {
          product_id: 1,
          batch_number: `BAT-MOD-${Date.now().toString().slice(-4)}`,
          quantity: 80, // changed from 100 to 80
          unit_cost: 54.5,
          mfg_date: '2026-11-17',
          expiry_date: '2026-11-21'
        }
      ]
    }, authHeaders);
    assert(editDraftRes.status === 200 && editDraftRes.data.success, 'Edit Draft Purchase Order succeeds');

    // Verify details reflect update
    const getDraftDetails = await request(port, `/api/purchases/${draftPoId}`, 'GET', null, authHeaders);
    assert(getDraftDetails.data.data.items[0].quantity === 80, 'Updated draft item quantity is 80 units');

    // 5. Test Confirm Reception of Draft PO
    console.log('\n  Confirming arrival of shipment for Draft PO...');
    const receiveRes = await request(port, `/api/purchases/${draftPoId}/receive`, 'POST', {}, authHeaders);
    assert(receiveRes.status === 200 && receiveRes.data.success, 'Confirm reception succeeds');

    // VERIFY STOCK HAS NOW INCREASED BY EXACTLY 80 UNITS
    const prodAfterReceive = await request(port, '/api/products/1', 'GET', null, authHeaders);
    const expectedStock = initialStock + 80;
    assert(prodAfterReceive.data.data.current_stock === expectedStock,
      `Stock increased by 80 units upon reception (${initialStock} -> ${prodAfterReceive.data.data.current_stock})`);

    // Verify PO status is Received
    const poDetailsReceived = await request(port, `/api/purchases/${draftPoId}`, 'GET', null, authHeaders);
    assert(poDetailsReceived.data.data.status === 'Received', 'PO status is now Received');
    assert(poDetailsReceived.data.data.received_by !== null, 'PO received_by is stamped');

    // Verify attempted edit on Received PO fails with 400
    const invalidEdit = await request(port, `/api/purchases/${draftPoId}`, 'PUT', {
      items: [{ product_id: 1, quantity: 10, unit_cost: 50 }]
    }, authHeaders);
    assert(invalidEdit.status === 400, 'Attempt to edit a Received PO is properly rejected with 400');

    // 6. Test Instant Received PO
    console.log('\n  Testing instant Received PO creation...');
    const instantPo = await request(port, '/api/purchases', 'POST', {
      supplier_id: 2,
      branch_id: 1,
      purchase_date: '2026-11-17',
      status: 'Received',
      invoice_no: `TEST-REC-${Date.now().toString().slice(-4)}`,
      payment_status: 'Paid',
      payment_method: 'UPI',
      items: [
        {
          product_id: 2,
          batch_number: `BAT-TON-REC-${Date.now().toString().slice(-4)}`,
          quantity: 40,
          unit_cost: 27,
          mfg_date: '2026-11-17',
          expiry_date: '2026-11-20'
        }
      ]
    }, authHeaders);
    assert(instantPo.status === 200 && instantPo.data.success, 'Instant Received PO creation succeeds');
    const instantPoId = instantPo.data.id;

    // 7. Test Cancel PO
    console.log('\n  Testing Cancellation of Draft PO...');
    const poToCancel = await request(port, '/api/purchases', 'POST', {
      supplier_id: 1,
      branch_id: 1,
      status: 'Draft',
      invoice_no: `TEST-CANC-${Date.now().toString().slice(-4)}`,
      items: [{ product_id: 1, quantity: 15, unit_cost: 54 }]
    }, authHeaders);
    const cancelId = poToCancel.data.id;

    const cancelRes = await request(port, `/api/purchases/${cancelId}/cancel`, 'POST', { reason: 'Supplier out of milk' }, authHeaders);
    assert(cancelRes.status === 200 && cancelRes.data.success, 'Cancel draft PO succeeds');

    // Attempting to cancel a Received PO must fail
    const invalidCancel = await request(port, `/api/purchases/${instantPoId}/cancel`, 'POST', {}, authHeaders);
    assert(invalidCancel.status === 400, 'Attempting to cancel a Received shipment is properly rejected with 400');

    // 8. Test Supplier Return
    console.log('\n  Testing Supplier Return (Vendor Refund / Credit)...');
    const instantDetails = await request(port, `/api/purchases/${instantPoId}`, 'GET', null, authHeaders);
    const batchId = instantDetails.data.data.items[0].batch_id;
    const initialBatchQty = instantDetails.data.data.items[0].quantity;

    const returnRes = await request(port, `/api/purchases/${instantPoId}/return`, 'POST', {
      batch_id: batchId,
      quantity: 10,
      reason: 'Curdled taste on delivery',
      refund_type: 'Credit Note'
    }, authHeaders);
    assert(returnRes.status === 200 && returnRes.data.success, 'Supplier Return recorded successfully');
    assert(returnRes.data.return_no.startsWith('SR-'), 'Return number format is SR-XXXXXX');

    // Verify batch stock was reduced
    const batchAfterReturn = await request(port, `/api/inventory/batches?productId=2`, 'GET', null, authHeaders);
    const updatedBatch = batchAfterReturn.data.data.find(b => b.id === batchId);
    assert(updatedBatch && updatedBatch.current_quantity === (initialBatchQty - 10),
      `Batch quantity accurately reduced by return quantity (${initialBatchQty} -> ${updatedBatch?.current_quantity})`);

    // Verify supplier returns list
    const allReturns = await request(port, '/api/purchases-returns', 'GET', null, authHeaders);
    assert(allReturns.data.data.length > 0, 'GET /api/purchases-returns returns recorded returns');

    // 9. Test Stock Reconciliation Formula
    console.log('\n  Verifying Module 5.2 Stock Reconciliation Formula...');
    const reconRes = await request(port, '/api/inventory/reconciliation', 'GET', null, authHeaders);
    assert(reconRes.status === 200 && reconRes.data.success, 'GET /api/inventory/reconciliation succeeds');
    const discrepancies = reconRes.data.data.filter(r => r.variance !== 0);
    assert(discrepancies.length === 0, `All active products fully reconciled with 0 variance! (Discrepancies: ${discrepancies.length})`);

    // 10. Test Purchases Excel Report Download
    console.log('\n  Testing Purchases Excel Report Generation...');
    const excelRes = await request(port, '/api/reports/download/purchases', 'GET', null, authHeaders);
    assert(excelRes.status === 200, 'Excel purchases report download endpoint returns 200');
    assert(excelRes.headers['content-type'].includes('spreadsheetml'), 'Content-Type is Excel xlsx');

    console.log(`\n======================================================`);
    console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`======================================================\n`);

  } finally {
    server.close();
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
