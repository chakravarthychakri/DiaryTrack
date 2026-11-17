const express = require('express');
const { db, formatDate, addDays } = require('../server/db');
const { registerNotificationRoutes, emitNotification, scanSystemAlerts } = require('../server/notification_routes');

console.log('\n=============================================================');
console.log('STARTING MODULE 14: NOTIFICATIONS & ALERTS VERIFICATION SUITE');
console.log('=============================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error(`     Details: ${details}`);
    failedTests++;
  }
}

// Set up mock Express App
const app = express();
app.use(express.json());

// Dummy Auth Middleware
const mockAdmin = { id: 1, name: 'Suresh Sharma', role: 'Administrator' };
const dummyAuth = (req, res, next) => { req.user = mockAdmin; next(); };
const dummyRequireRole = (roles) => (req, res, next) => next();

// Register notification routes
registerNotificationRoutes(app, dummyAuth, dummyRequireRole, dummyAuth);

// Helper for simulated requests
async function request(method, path, body = null, query = null) {
  return new Promise((resolve) => {
    let url = path;
    if (query) {
      const q = new URLSearchParams(query).toString();
      if (q) url += (url.includes('?') ? '&' : '?') + q;
    }

    const req = {
      method,
      url,
      headers: { host: 'localhost' },
      body: body || {},
      query: query || {}
    };

    // Parse path and query
    const [pathname, qs] = url.split('?');
    req.path = pathname;
    if (qs) {
      const searchParams = new URLSearchParams(qs);
      req.query = Object.fromEntries(searchParams.entries());
    }

    let statusCode = 200;
    const resHeaders = {};
    let responseData = null;

    const res = {
      status(code) { statusCode = code; return this; },
      setHeader(name, val) { resHeaders[name.toLowerCase()] = val; return this; },
      json(data) { responseData = data; resolve({ status: statusCode, headers: resHeaders, body: data }); },
      send(data) { responseData = data; resolve({ status: statusCode, headers: resHeaders, body: data }); }
    };

    app.handle(req, res, (err) => {
      if (err) {
        resolve({ status: 500, headers: resHeaders, body: { error: err.message } });
      } else {
        resolve({ status: 404, headers: resHeaders, body: { error: 'Not Found' } });
      }
    });
  });
}

async function runTests() {
  console.log('--- Test Group 1: 14.1 Alert Categories & Emitters ---');

  // Clear test notifications
  db.prepare("DELETE FROM notifications WHERE title LIKE 'UnitTest%'").run();

  // 1. Low stock alert
  const id1 = emitNotification({
    type: 'stock_low',
    title: 'UnitTest: Low Stock Alert',
    message: 'Cow Milk stock is 8 packets (min 10).',
    severity: 'warning',
    link_view: 'inventory',
    reference_id: 1
  });
  assert('Low stock alert emitted successfully', id1 > 0);

  // 2. Out of stock alert
  const id2 = emitNotification({
    type: 'stock_out',
    title: 'UnitTest: Out of Stock Alert',
    message: 'Paneer 1kg is 0 units remaining.',
    severity: 'danger',
    link_view: 'inventory',
    reference_id: 4
  });
  assert('Out of stock alert emitted successfully', id2 > 0);

  // 3. Near expiry alert
  const id3 = emitNotification({
    type: 'expiry_near',
    title: 'UnitTest: Near Expiry Alert',
    message: 'Batch BAT-101 expires in 2 days.',
    severity: 'warning',
    link_view: 'expiry',
    reference_id: 1
  });
  assert('Near expiry alert emitted successfully', id3 > 0);

  // 4. Expired products alert
  const id4 = emitNotification({
    type: 'expired',
    title: 'UnitTest: Expired Stock Alert',
    message: 'Batch BAT-099 expired yesterday.',
    severity: 'danger',
    link_view: 'expiry',
    reference_id: 99
  });
  assert('Expired product alert emitted successfully', id4 > 0);

  // 5. Unusual wastage alert
  const id5 = emitNotification({
    type: 'wastage_unusual',
    title: 'UnitTest: High Wastage Spillage',
    message: '20L of milk lost due to cooler seal leak (₹1,300 loss).',
    severity: 'danger',
    link_view: 'expiry',
    reference_id: 1
  });
  assert('Unusual wastage alert emitted successfully', id5 > 0);

  // 6. New purchase alert
  const id6 = emitNotification({
    type: 'purchase_new',
    title: 'UnitTest: New Purchase Order PO-1099',
    message: 'Received 100 units from Amrit Milk Producers.',
    severity: 'info',
    link_view: 'purchases',
    reference_id: 1099
  });
  assert('New purchase alert emitted successfully', id6 > 0);

  // 7. Sales completion alert
  const id7 = emitNotification({
    type: 'sale_complete',
    title: 'UnitTest: Sale Completed INV-8891',
    message: 'Invoice billed for ₹1,450 via UPI QR.',
    severity: 'success',
    link_view: 'sales',
    reference_id: 8891
  });
  assert('Sales completion alert emitted successfully', id7 > 0);

  // 8. Failed transaction alert
  const id8 = emitNotification({
    type: 'transaction_failed',
    title: 'UnitTest: Transaction Failed',
    message: 'Payment gateway timeout for order #TXN-FAIL-01.',
    severity: 'danger',
    link_view: 'sales'
  });
  assert('Failed transaction alert emitted successfully', id8 > 0);

  // 9. System event alert
  const id9 = emitNotification({
    type: 'system_event',
    title: 'UnitTest: Security Audit Checkpoint',
    message: 'Database ledger verified and configuration updated.',
    severity: 'info',
    link_view: 'settings'
  });
  assert('Important system event alert emitted successfully', id9 > 0);

  console.log('\n--- Test Group 2: 14.2 Query, Filtering & Notification Feed ---');

  // List notifications
  const listRes = await request('GET', '/api/notifications');
  assert('GET /api/notifications returns 200 OK', listRes.status === 200);
  assert('Response success is true', listRes.body.success === true);
  assert('Notifications array returned', Array.isArray(listRes.body.data));
  assert('Total count is positive', listRes.body.totalCount > 0);
  assert('Unread count is positive', listRes.body.unreadCount > 0);
  assert('Category breakdown counts present', typeof listRes.body.categoryCounts === 'object');
  assert('Severity stats present', typeof listRes.body.stats === 'object');

  // Filter by category: stock
  const stockRes = await request('GET', '/api/notifications', null, { category: 'stock' });
  assert('Filter by category=stock succeeds', stockRes.status === 200);
  const allStock = stockRes.body.data.every(n => n.category === 'stock');
  assert('All returned alerts have category "stock"', allStock);

  // Filter by category: expiry
  const expiryRes = await request('GET', '/api/notifications', null, { category: 'expiry' });
  assert('Filter by category=expiry succeeds', expiryRes.status === 200);
  const allExpiry = expiryRes.body.data.every(n => n.category === 'expiry');
  assert('All returned alerts have category "expiry"', allExpiry);

  // Filter by severity: danger
  const dangerRes = await request('GET', '/api/notifications', null, { severity: 'danger' });
  assert('Filter by severity=danger succeeds', dangerRes.status === 200);
  const allDanger = dangerRes.body.data.every(n => n.severity === 'danger');
  assert('All returned alerts have severity "danger"', allDanger);

  // Filter by unread
  const unreadRes = await request('GET', '/api/notifications', null, { is_read: '0' });
  assert('Filter by is_read=0 succeeds', unreadRes.status === 200);
  const allUnread = unreadRes.body.data.every(n => n.is_read === 0);
  assert('All returned alerts are unread', allUnread);

  // Search filter
  const searchRes = await request('GET', '/api/notifications', null, { search: 'High Wastage' });
  assert('Search by keyword succeeds', searchRes.status === 200 && searchRes.body.data.length >= 1);
  assert('Search matches target title', searchRes.body.data[0].title.includes('High Wastage'));

  // Notification stats KPI endpoint
  const statsRes = await request('GET', '/api/notifications/stats');
  assert('GET /api/notifications/stats returns 200 OK', statsRes.status === 200);
  assert('Stats include unreadCount', typeof statsRes.body.unreadCount === 'number');
  assert('Stats include criticalCount', typeof statsRes.body.criticalCount === 'number');
  assert('Stats include warningCount', typeof statsRes.body.warningCount === 'number');
  assert('Stats include todayCount', typeof statsRes.body.todayCount === 'number');

  console.log('\n--- Test Group 3: 14.3 Read, Dismiss & Clear Lifecycle ---');

  // Mark single notification as read
  const readRes = await request('PUT', `/api/notifications/${id1}/read`);
  assert('PUT /api/notifications/:id/read returns 200 OK', readRes.status === 200);
  const updatedItem = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(id1);
  assert('Target notification is now marked is_read = 1', updatedItem && updatedItem.is_read === 1);

  // Delete single notification
  const delRes = await request('DELETE', `/api/notifications/${id8}`);
  assert('DELETE /api/notifications/:id returns 200 OK', delRes.status === 200);
  const checkDeleted = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id8);
  assert('Target notification no longer exists in database', checkDeleted === undefined);

  // Mark all notifications as read
  const markAllRes = await request('POST', '/api/notifications/mark-all-read');
  assert('POST /api/notifications/mark-all-read returns 200 OK', markAllRes.status === 200);
  const remainingUnread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').get().c;
  assert('All notifications are now read (unread count == 0)', remainingUnread === 0);

  // Clear read notifications
  const clearRes = await request('DELETE', '/api/notifications/clear-read');
  assert('DELETE /api/notifications/clear-read returns 200 OK', clearRes.status === 200);
  const totalRemaining = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE is_read = 1').get().c;
  assert('All read notifications purged from database', totalRemaining === 0);

  console.log('\n--- Test Group 4: 14.4 System Alert Scanner Engine ---');

  // Scan system alerts
  const scanRes = await request('POST', '/api/notifications/scan');
  assert('POST /api/notifications/scan returns 200 OK', scanRes.status === 200);
  assert('Scan engine reports generated count', typeof scanRes.body.generatedCount === 'number');
  assert('Scan engine returns generated alerts array', Array.isArray(scanRes.body.generated));

  console.log('\n--- Test Group 5: 14.5 Configurable Notification Settings ---');

  // Get current settings
  const getSettingsRes = await request('GET', '/api/notifications/settings');
  assert('GET /api/notifications/settings returns 200 OK', getSettingsRes.status === 200);
  const cfg = getSettingsRes.body.data;
  assert('Config includes notify_low_stock toggle', typeof cfg.notify_low_stock === 'boolean');
  assert('Config includes notify_out_of_stock toggle', typeof cfg.notify_out_of_stock === 'boolean');
  assert('Config includes notify_near_expiry toggle', typeof cfg.notify_near_expiry === 'boolean');
  assert('Config includes notify_expired_products toggle', typeof cfg.notify_expired_products === 'boolean');
  assert('Config includes notify_unusual_wastage toggle', typeof cfg.notify_unusual_wastage === 'boolean');
  assert('Config includes notify_new_purchases toggle', typeof cfg.notify_new_purchases === 'boolean');
  assert('Config includes notify_sales_completion toggle', typeof cfg.notify_sales_completion === 'boolean');
  assert('Config includes notify_failed_transactions toggle', typeof cfg.notify_failed_transactions === 'boolean');
  assert('Config includes notify_system_events toggle', typeof cfg.notify_system_events === 'boolean');
  assert('Config includes notify_expiry_days threshold', typeof cfg.notify_expiry_days === 'number');
  assert('Config includes notify_wastage_threshold', typeof cfg.notify_wastage_threshold === 'number');
  assert('Config includes sound and toast toggles', typeof cfg.notify_sound_enabled === 'boolean' && typeof cfg.notify_toasts_enabled === 'boolean');

  // Update notification settings
  const updateSettingsRes = await request('POST', '/api/notifications/settings', {
    notify_low_stock: false,
    notify_expiry_days: 5,
    notify_wastage_threshold: 750,
    notify_sound_enabled: false
  });
  assert('POST /api/notifications/settings returns 200 OK', updateSettingsRes.status === 200);

  // Verify settings persistence
  const savedLow = db.prepare("SELECT value FROM settings WHERE key = 'notify_low_stock'").get().value;
  const savedDays = db.prepare("SELECT value FROM settings WHERE key = 'notify_expiry_days'").get().value;
  const savedWaste = db.prepare("SELECT value FROM settings WHERE key = 'notify_wastage_threshold'").get().value;
  assert('Setting notify_low_stock persisted as "0"', savedLow === '0');
  assert('Setting notify_expiry_days persisted as "5"', savedDays === '5');
  assert('Setting notify_wastage_threshold persisted as "750"', savedWaste === '750');

  // Test that toggling off low stock stops emitNotification from creating it
  const blockedId = emitNotification({
    type: 'stock_low',
    title: 'Blocked Low Stock Alert',
    message: 'This should not be saved because notify_low_stock is 0.',
    severity: 'warning'
  });
  assert('emitNotification respects disabled settings toggle and returns null', blockedId === null);

  // Restore settings toggle
  await request('POST', '/api/notifications/settings', {
    notify_low_stock: true,
    notify_expiry_days: 3,
    notify_wastage_threshold: 500,
    notify_sound_enabled: true
  });

  console.log('\n--- Test Group 6: 14.6 Test Alert Generator ---');

  // Test triggering sample alerts
  const test1 = await request('POST', '/api/notifications/test', { type: 'stock_low' });
  assert('Test alert for stock_low returns 200 OK', test1.status === 200 && test1.body.notificationId > 0);

  const test2 = await request('POST', '/api/notifications/test', { type: 'sale_complete' });
  assert('Test alert for sale_complete returns 200 OK', test2.status === 200 && test2.body.notificationId > 0);

  const test3 = await request('POST', '/api/notifications/test', { type: 'transaction_failed' });
  assert('Test alert for transaction_failed returns 200 OK', test3.status === 200 && test3.body.notificationId > 0);

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
