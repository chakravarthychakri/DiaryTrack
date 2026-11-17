// ====================================================================
// MODULE 14: NOTIFICATIONS AND ALERTS SYSTEM
// In-App Notification Center, Real-Time Alert Engine & Configurable Settings
// ====================================================================

const { db, formatDate, addDays, logAudit } = require('./db');

// Map canonical notification types to their high-level category
const TYPE_CATEGORY_MAP = {
  'stock_low': 'stock',
  'stock_out': 'stock',
  'expiry_near': 'expiry',
  'expired': 'expiry',
  'wastage_unusual': 'wastage',
  'purchase_new': 'purchases',
  'sale_complete': 'sales',
  'transaction_failed': 'sales',
  'system_event': 'system'
};

// Map notification type to setting key
const TYPE_SETTING_MAP = {
  'stock_low': 'notify_low_stock',
  'stock_out': 'notify_out_of_stock',
  'expiry_near': 'notify_near_expiry',
  'expired': 'notify_expired_products',
  'wastage_unusual': 'notify_unusual_wastage',
  'purchase_new': 'notify_new_purchases',
  'sale_complete': 'notify_sales_completion',
  'transaction_failed': 'notify_failed_transactions',
  'system_event': 'notify_system_events'
};

/**
 * Centralized Notification Dispatcher
 * Checks user notification preferences and prevents duplicate spam alerts.
 */
function emitNotification({
  type,
  title,
  message,
  severity = 'info',
  link_view = null,
  reference_id = null,
  category = null
}) {
  try {
    const cat = category || TYPE_CATEGORY_MAP[type] || 'system';
    const settingKey = TYPE_SETTING_MAP[type];

    // 1. Check if user disabled this alert category
    if (settingKey) {
      const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey);
      if (setting && setting.value === '0') {
        // Disabled by user configuration
        return null;
      }
    }

    // 2. Prevent duplicate unread notifications within the last 15 minutes
    const duplicate = db.prepare(`
      SELECT id FROM notifications 
      WHERE type = ? AND title = ? AND is_read = 0 
        AND created_at >= datetime('now', '-15 minutes')
      LIMIT 1
    `).get(type, title);

    if (duplicate) {
      return null;
    }

    // 3. Insert notification
    const res = db.prepare(`
      INSERT INTO notifications (type, category, title, message, severity, is_read, link_view, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, datetime('now', 'localtime'))
    `).run(type, cat, title, message, severity, link_view, reference_id ? String(reference_id) : null);

    return Number(res.lastInsertRowid);
  } catch (err) {
    console.error('Error emitting notification:', err.message);
    return null;
  }
}

/**
 * Background & On-Demand Alert Scanner
 * Audits stock levels and expiry schedules to generate actionable alerts.
 */
function scanSystemAlerts() {
  const generated = [];
  const today = formatDate(new Date());

  // 1. Get Expiry Lead Time Setting (Default: 3 days)
  const expiryDaysRow = db.prepare("SELECT value FROM settings WHERE key = 'notify_expiry_days'").get();
  const warningDays = expiryDaysRow ? parseInt(expiryDaysRow.value, 10) || 3 : 3;
  const warningDate = formatDate(addDays(new Date(), warningDays));

  // --- 1. Out of Stock Alert & Low Stock Alert ---
  const products = db.prepare(`
    SELECT 
      p.id, p.name, p.sku, p.unit, p.min_stock_level,
      COALESCE(SUM(b.current_quantity), 0) as total_stock
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
    WHERE p.is_active = 1
    GROUP BY p.id
  `).all();

  for (const prod of products) {
    const stock = Number(prod.total_stock);
    const minStock = Number(prod.min_stock_level) || 5;

    if (stock <= 0) {
      const id = emitNotification({
        type: 'stock_out',
        category: 'stock',
        title: `Out of Stock: ${prod.name}`,
        message: `Inventory depleted to 0 ${prod.unit || 'units'}. Customers cannot order this item. Replenish immediately.`,
        severity: 'danger',
        link_view: 'inventory',
        reference_id: prod.id
      });
      if (id) generated.push({ id, type: 'stock_out', title: `Out of Stock: ${prod.name}` });
    } else if (stock <= minStock) {
      const id = emitNotification({
        type: 'stock_low',
        category: 'stock',
        title: `Low Stock Alert: ${prod.name}`,
        message: `Current stock is ${stock} ${prod.unit || 'units'} (Minimum threshold: ${minStock} ${prod.unit || 'units'}). Reorder suggested.`,
        severity: 'warning',
        link_view: 'inventory',
        reference_id: prod.id
      });
      if (id) generated.push({ id, type: 'stock_low', title: `Low Stock Alert: ${prod.name}` });
    }
  }

  // --- 2. Expired Products Alert ---
  const expiredBatches = db.prepare(`
    SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name, p.unit
    FROM batches b
    JOIN products p ON b.product_id = p.id
    WHERE b.current_quantity > 0 AND b.expiry_date < ?
  `).all(today);

  for (const eb of expiredBatches) {
    const id = emitNotification({
      type: 'expired',
      category: 'expiry',
      title: `Expired Inventory: ${eb.product_name}`,
      message: `Batch #${eb.batch_number} expired on ${eb.expiry_date} with ${eb.current_quantity} ${eb.unit || 'units'} remaining. Move to discard or return.`,
      severity: 'danger',
      link_view: 'expiry',
      reference_id: eb.id
    });
    if (id) generated.push({ id, type: 'expired', title: `Expired: ${eb.product_name}` });
  }

  // --- 3. Near Expiry Alert ---
  const nearExpiryBatches = db.prepare(`
    SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name, p.unit
    FROM batches b
    JOIN products p ON b.product_id = p.id
    WHERE b.current_quantity > 0 AND b.expiry_date >= ? AND b.expiry_date <= ?
  `).all(today, warningDate);

  for (const nb of nearExpiryBatches) {
    const daysLeft = Math.ceil((new Date(nb.expiry_date) - new Date(today)) / (1000 * 60 * 60 * 24));
    const dayLabel = daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;

    const id = emitNotification({
      type: 'expiry_near',
      category: 'expiry',
      title: `Near Expiry: ${nb.product_name} (${dayLabel})`,
      message: `Batch #${nb.batch_number} (${nb.current_quantity} ${nb.unit || 'units'}) expires ${dayLabel} (${nb.expiry_date}). Discount or prioritize in POS.`,
      severity: daysLeft <= 1 ? 'danger' : 'warning',
      link_view: 'expiry',
      reference_id: nb.id
    });
    if (id) generated.push({ id, type: 'expiry_near', title: `Near Expiry: ${nb.product_name}` });
  }

  return generated;
}

/**
 * Register All Module 14 Notification Routes on Express Application
 */
function registerNotificationRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // -------------------------------------------------------------
  // 14.1: LIST NOTIFICATIONS WITH FILTERING & PAGINATION
  // -------------------------------------------------------------
  app.get('/api/notifications', optionalAuth, (req, res) => {
    try {
      const {
        category,
        type,
        severity,
        is_read,
        search,
        page = 1,
        limit = 30
      } = req.query;

      let whereClauses = ['1=1'];
      const params = [];

      if (category && category !== 'all') {
        whereClauses.push('category = ?');
        params.push(category);
      }

      if (type && type !== 'all') {
        whereClauses.push('type = ?');
        params.push(type);
      }

      if (severity && severity !== 'all') {
        whereClauses.push('severity = ?');
        params.push(severity);
      }

      if (is_read !== undefined && is_read !== 'all') {
        whereClauses.push('is_read = ?');
        params.push(parseInt(is_read, 10));
      }

      if (search && search.trim()) {
        whereClauses.push('(title LIKE ? OR message LIKE ?)');
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count matching filters
      const totalCount = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE ${whereSql}`).get(...params).count;

      // Overall unread count
      const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get().count;

      // Category breakdown for filter badges
      const categoryRows = db.prepare(`
        SELECT category, COUNT(*) as total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
        FROM notifications
        GROUP BY category
      `).all();

      const categoryCounts = {
        all: totalCount,
        unread: unreadCount,
        stock: 0,
        expiry: 0,
        wastage: 0,
        sales: 0,
        purchases: 0,
        system: 0
      };

      categoryRows.forEach(r => {
        if (r.category && categoryCounts[r.category] !== undefined) {
          categoryCounts[r.category] = r.total;
        }
      });

      // Pagination
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const notifications = db.prepare(`
        SELECT * FROM notifications 
        WHERE ${whereSql}
        ORDER BY is_read ASC, id DESC
        LIMIT ? OFFSET ?
      `).all(...params, limitNum, offset);

      // Severity stats
      const stats = {
        unread: unreadCount,
        danger: db.prepare("SELECT COUNT(*) as c FROM notifications WHERE severity = 'danger' AND is_read = 0").get().c,
        warning: db.prepare("SELECT COUNT(*) as c FROM notifications WHERE severity = 'warning' AND is_read = 0").get().c,
        info: db.prepare("SELECT COUNT(*) as c FROM notifications WHERE severity = 'info' AND is_read = 0").get().c,
        success: db.prepare("SELECT COUNT(*) as c FROM notifications WHERE severity = 'success' AND is_read = 0").get().c
      };

      res.json({
        success: true,
        data: notifications,
        totalCount,
        unreadCount,
        categoryCounts,
        stats,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.2: NOTIFICATIONS SUMMARY STATS
  // -------------------------------------------------------------
  app.get('/api/notifications/stats', optionalAuth, (req, res) => {
    try {
      const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get().count;
      const criticalCount = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE severity = 'danger' AND is_read = 0").get().count;
      const warningCount = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE severity = 'warning' AND is_read = 0").get().count;
      const todayCount = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE DATE(created_at) = DATE('now', 'localtime')").get().count;

      res.json({
        success: true,
        unreadCount,
        criticalCount,
        warningCount,
        todayCount
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.3: MARK ALL NOTIFICATIONS AS READ
  // -------------------------------------------------------------
  app.post('/api/notifications/mark-all-read', optionalAuth, (req, res) => {
    try {
      const { category } = req.body || {};
      if (category && category !== 'all') {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE category = ? AND is_read = 0').run(category);
      } else {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
      }

      res.json({ success: true, message: 'Notifications marked as read.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.4: MARK SINGLE NOTIFICATION AS READ
  // -------------------------------------------------------------
  app.put('/api/notifications/:id/read', optionalAuth, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
      if (!notif) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }

      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
      res.json({ success: true, message: 'Notification marked as read.', id });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.5: CLEAR ALL READ NOTIFICATIONS (Placed before :id to prevent route shadowing)
  // -------------------------------------------------------------
  app.delete('/api/notifications/clear-read', optionalAuth, (req, res) => {
    try {
      const result = db.prepare('DELETE FROM notifications WHERE is_read = 1').run();
      res.json({ success: true, message: `Cleared ${result.changes} read notifications.` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.6: DISMISS / DELETE SINGLE NOTIFICATION
  // -------------------------------------------------------------
  app.delete('/api/notifications/:id', optionalAuth, (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const resDel = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
      if (resDel.changes === 0) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }

      res.json({ success: true, message: 'Notification deleted.', id });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.7: TRIGGER SYSTEM AUDIT & ALERT SCAN
  // -------------------------------------------------------------
  app.post('/api/notifications/scan', optionalAuth, (req, res) => {
    try {
      const generated = scanSystemAlerts();
      const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get().count;

      res.json({
        success: true,
        message: generated.length > 0 ? `Alert scan completed: generated ${generated.length} new alert(s).` : 'Alert scan completed: All systems healthy.',
        generatedCount: generated.length,
        generated,
        unreadCount
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.8: GET CONFIGURABLE NOTIFICATION SETTINGS
  // -------------------------------------------------------------
  app.get('/api/notifications/settings', optionalAuth, (req, res) => {
    try {
      const settingKeys = [
        'notify_low_stock',
        'notify_out_of_stock',
        'notify_near_expiry',
        'notify_expired_products',
        'notify_unusual_wastage',
        'notify_new_purchases',
        'notify_sales_completion',
        'notify_failed_transactions',
        'notify_system_events',
        'notify_expiry_days',
        'notify_wastage_threshold',
        'notify_sound_enabled',
        'notify_toasts_enabled'
      ];

      const settings = {};
      const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${settingKeys.map(() => '?').join(',')})`).all(...settingKeys);
      rows.forEach(r => { settings[r.key] = r.value; });

      // Defaults if not set
      const config = {
        notify_low_stock: settings.notify_low_stock !== '0',
        notify_out_of_stock: settings.notify_out_of_stock !== '0',
        notify_near_expiry: settings.notify_near_expiry !== '0',
        notify_expired_products: settings.notify_expired_products !== '0',
        notify_unusual_wastage: settings.notify_unusual_wastage !== '0',
        notify_new_purchases: settings.notify_new_purchases !== '0',
        notify_sales_completion: settings.notify_sales_completion !== '0',
        notify_failed_transactions: settings.notify_failed_transactions !== '0',
        notify_system_events: settings.notify_system_events !== '0',
        notify_expiry_days: parseInt(settings.notify_expiry_days || '3', 10),
        notify_wastage_threshold: parseFloat(settings.notify_wastage_threshold || '500'),
        notify_sound_enabled: settings.notify_sound_enabled !== '0',
        notify_toasts_enabled: settings.notify_toasts_enabled !== '0'
      };

      res.json({ success: true, data: config });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.9: UPDATE CONFIGURABLE NOTIFICATION SETTINGS
  // -------------------------------------------------------------
  app.post('/api/notifications/settings', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const updates = req.body;
      const allowedKeys = [
        'notify_low_stock',
        'notify_out_of_stock',
        'notify_near_expiry',
        'notify_expired_products',
        'notify_unusual_wastage',
        'notify_new_purchases',
        'notify_sales_completion',
        'notify_failed_transactions',
        'notify_system_events',
        'notify_expiry_days',
        'notify_wastage_threshold',
        'notify_sound_enabled',
        'notify_toasts_enabled'
      ];

      const upsert = db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);

      for (const key of allowedKeys) {
        if (updates[key] !== undefined) {
          let val = updates[key];
          if (typeof val === 'boolean') {
            val = val ? '1' : '0';
          } else {
            val = String(val);
          }
          upsert.run(key, val);
        }
      }

      logAudit(req.user ? req.user.id : 1, 'UPDATE', 'Settings', 'Updated notification center alert preferences and thresholds');

      // Also emit a system event notification
      emitNotification({
        type: 'system_event',
        category: 'system',
        title: 'Notification Settings Updated',
        message: `Alert preferences and thresholds updated by ${req.user ? req.user.name : 'Administrator'}.`,
        severity: 'info',
        link_view: 'settings'
      });

      res.json({ success: true, message: 'Notification preferences saved successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 14.10: TRIGGER TEST ALERT FOR ANY CATEGORY
  // -------------------------------------------------------------
  app.post('/api/notifications/test', authenticateToken, requireRole(['Administrator']), (req, res) => {
    try {
      const { type = 'system_event' } = req.body;
      const testAlerts = {
        'stock_low': {
          title: 'Test Alert: Low Stock Warning',
          message: 'Cow Milk 500ml pouch stock is currently 8 packets (below minimum 10).',
          severity: 'warning',
          link_view: 'inventory'
        },
        'stock_out': {
          title: 'Test Alert: Product Out of Stock',
          message: 'Desi Cow Ghee 1kg jar is completely out of stock (0 jars remaining).',
          severity: 'danger',
          link_view: 'inventory'
        },
        'expiry_near': {
          title: 'Test Alert: Near Expiry Batch',
          message: 'Batch #BAT-TEST-01 (20 units of Dahi) expires tomorrow. Immediate action advised.',
          severity: 'warning',
          link_view: 'expiry'
        },
        'expired': {
          title: 'Test Alert: Expired Batch Discovered',
          message: 'Batch #BAT-OLD-99 (5 units of Buttermilk) expired yesterday. Discard required.',
          severity: 'danger',
          link_view: 'expiry'
        },
        'wastage_unusual': {
          title: 'Test Alert: High Wastage Spillage',
          message: '15 Litres of Buffalo Milk leaked from cooler valve (Total loss: ₹975.00).',
          severity: 'danger',
          link_view: 'expiry'
        },
        'purchase_new': {
          title: 'Test Alert: New Purchase Consignment',
          message: 'Shipment #PO-2026-099 received from Kisan Dairy Co-operative (150 units).',
          severity: 'info',
          link_view: 'purchases'
        },
        'sale_complete': {
          title: 'Test Alert: POS Sale Completed',
          message: 'Invoice #INV-TEST-001 generated for ₹1,250.00 via UPI QR.',
          severity: 'success',
          link_view: 'sales'
        },
        'transaction_failed': {
          title: 'Test Alert: Payment Transaction Declined',
          message: 'UPI payment timeout for customer cart (Invoice #INV-FAIL-09).',
          severity: 'danger',
          link_view: 'sales'
        },
        'system_event': {
          title: 'Test Alert: Scheduled System Maintenance',
          message: 'Automated database vacuum and security audit cycle executed successfully.',
          severity: 'info',
          link_view: 'settings'
        }
      };

      const template = testAlerts[type] || testAlerts['system_event'];
      const id = emitNotification({
        type,
        category: TYPE_CATEGORY_MAP[type] || 'system',
        title: template.title,
        message: template.message,
        severity: template.severity,
        link_view: template.link_view
      });

      res.json({
        success: true,
        message: `Generated test alert for ${type}`,
        notificationId: id
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

}

module.exports = {
  registerNotificationRoutes,
  emitNotification,
  scanSystemAlerts
};
