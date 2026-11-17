// ====================================================================
// MODULE 11: EXPIRY & WASTAGE MANAGEMENT API ROUTES & LEDGER
// ====================================================================

const { db, logAudit, formatDate, addDays } = require('./db');
const { generateWasteReport } = require('./reports');
const { emitNotification } = require('./notification_routes');

function getTodayDate() {
  return formatDate(new Date());
}

module.exports = function registerExpiryRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // -------------------------------------------------------------
  // 11.1: EXPIRY DASHBOARD METRICS & BATCH LISTS
  // -------------------------------------------------------------
  app.get('/api/expiry/dashboard', optionalAuth, (req, res) => {
    try {
      const today = getTodayDate();
      const threeDays = formatDate(addDays(new Date(), 3));
      const sevenDays = formatDate(addDays(new Date(), 7));

      // 1. Expiring Today (expiry_date = today)
      const expiringToday = db.prepare(`
        SELECT 
          b.*, p.name as product_name, p.sku as product_sku, p.unit, p.storage_temperature,
          c.name as category_name, br.name as branch_name,
          ROUND(b.current_quantity * b.purchase_cost, 2) as loss_amount,
          ROUND(b.current_quantity * p.selling_price, 2) as retail_value,
          0 as days_left
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date = ?
        ORDER BY b.current_quantity DESC
      `).all(today);

      // 2. Expiring within 3 days (tomorrow up to today + 3)
      const expiringThreeDays = db.prepare(`
        SELECT 
          b.*, p.name as product_name, p.sku as product_sku, p.unit, p.storage_temperature,
          c.name as category_name, br.name as branch_name,
          ROUND(b.current_quantity * b.purchase_cost, 2) as loss_amount,
          ROUND(b.current_quantity * p.selling_price, 2) as retail_value,
          CAST(JULIANDAY(b.expiry_date) - JULIANDAY(?) AS INTEGER) as days_left
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date > ? AND b.expiry_date <= ?
        ORDER BY b.expiry_date ASC, b.current_quantity DESC
      `).all(today, today, threeDays);

      // 3. Expiring within 7 days (day 4 up to day 7)
      const expiringSevenDays = db.prepare(`
        SELECT 
          b.*, p.name as product_name, p.sku as product_sku, p.unit, p.storage_temperature,
          c.name as category_name, br.name as branch_name,
          ROUND(b.current_quantity * b.purchase_cost, 2) as loss_amount,
          ROUND(b.current_quantity * p.selling_price, 2) as retail_value,
          CAST(JULIANDAY(b.expiry_date) - JULIANDAY(?) AS INTEGER) as days_left
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date > ? AND b.expiry_date <= ?
        ORDER BY b.expiry_date ASC, b.current_quantity DESC
      `).all(today, threeDays, sevenDays);

      // 4. Already Expired in stock (expiry_date < today and current_quantity > 0)
      const alreadyExpired = db.prepare(`
        SELECT 
          b.*, p.name as product_name, p.sku as product_sku, p.unit, p.storage_temperature,
          c.name as category_name, br.name as branch_name,
          ROUND(b.current_quantity * b.purchase_cost, 2) as loss_amount,
          ROUND(b.current_quantity * p.selling_price, 2) as retail_value,
          CAST(JULIANDAY(?) - JULIANDAY(b.expiry_date) AS INTEGER) as days_overdue
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date < ?
        ORDER BY b.expiry_date ASC, b.current_quantity DESC
      `).all(today, today);

      // 5. Total Expiry & Wastage Losses
      const lossTotals = db.prepare(`
        SELECT 
          ROUND(COALESCE(SUM(total_loss_value), 0), 2) as total_historical_loss,
          ROUND(COALESCE(SUM(CASE WHEN waste_type = 'Expired' OR LOWER(reason) LIKE '%expire%' THEN total_loss_value ELSE 0 END), 0), 2) as total_expiry_loss,
          ROUND(COALESCE(SUM(CASE WHEN waste_type = 'Damaged' THEN total_loss_value ELSE 0 END), 0), 2) as total_damaged_loss,
          ROUND(COALESCE(SUM(CASE WHEN waste_type = 'Spilled' THEN total_loss_value ELSE 0 END), 0), 2) as total_spilled_loss,
          ROUND(COALESCE(SUM(CASE WHEN waste_type = 'Spoiled' THEN total_loss_value ELSE 0 END), 0), 2) as total_spoiled_loss,
          ROUND(COALESCE(SUM(CASE WHEN waste_type = 'Other Wastage' THEN total_loss_value ELSE 0 END), 0), 2) as total_other_loss,
          COUNT(*) as total_waste_events
        FROM waste_damaged
      `).get();

      // Sitting losses in active inventory
      const sittingExpiredLoss = alreadyExpired.reduce((acc, row) => acc + row.loss_amount, 0);
      const sittingTodayLoss = expiringToday.reduce((acc, row) => acc + row.loss_amount, 0);
      const sitting3DaysLoss = expiringThreeDays.reduce((acc, row) => acc + row.loss_amount, 0);
      const sitting7DaysLoss = expiringSevenDays.reduce((acc, row) => acc + row.loss_amount, 0);

      // Category-wise waste breakdown
      const wasteByCategory = db.prepare(`
        SELECT 
          c.name as category,
          ROUND(SUM(w.total_loss_value), 2) as total_loss,
          ROUND(SUM(w.quantity), 2) as total_quantity,
          COUNT(*) as event_count
        FROM waste_damaged w
        JOIN products p ON w.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        GROUP BY c.id
        ORDER BY total_loss DESC
      `).all();

      res.json({
        success: true,
        data: {
          expiringToday,
          expiringThreeDays,
          expiringSevenDays,
          alreadyExpired,
          metrics: {
            // 11.1 Display metrics
            expiring_today_count: expiringToday.length,
            expiring_today_loss: Number(sittingTodayLoss.toFixed(2)),
            expiring_3days_count: expiringThreeDays.length,
            expiring_3days_loss: Number(sitting3DaysLoss.toFixed(2)),
            expiring_7days_count: expiringSevenDays.length,
            expiring_7days_loss: Number(sitting7DaysLoss.toFixed(2)),
            already_expired_count: alreadyExpired.length,
            already_expired_loss: Number(sittingExpiredLoss.toFixed(2)),
            total_expiry_loss: Number(((lossTotals ? lossTotals.total_expiry_loss : 0) + sittingExpiredLoss).toFixed(2)),
            total_historical_loss: lossTotals ? lossTotals.total_historical_loss : 0,
            waste_type_breakdown: {
              Expired: lossTotals ? lossTotals.total_expiry_loss : 0,
              Damaged: lossTotals ? lossTotals.total_damaged_loss : 0,
              Spilled: lossTotals ? lossTotals.total_spilled_loss : 0,
              Spoiled: lossTotals ? lossTotals.total_spoiled_loss : 0,
              Other: lossTotals ? lossTotals.total_other_loss : 0
            }
          },
          wasteByCategory
        }
      });
    } catch (err) {
      console.error('Error fetching expiry dashboard:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 11.2: BACKWARD COMPATIBLE /api/expiry (Full Feed)
  // -------------------------------------------------------------
  app.get('/api/expiry', optionalAuth, (req, res) => {
    try {
      const today = getTodayDate();
      const threeDays = formatDate(addDays(new Date(), 3));
      const sevenDays = formatDate(addDays(new Date(), 7));

      const expired = db.prepare(`
        SELECT 
          b.*, p.name as product_name, p.sku as product_sku, p.unit, p.storage_temperature,
          c.name as category_name, br.name as branch_name,
          ROUND(b.current_quantity * b.purchase_cost, 2) as loss_amount,
          CAST(JULIANDAY(?) - JULIANDAY(b.expiry_date) AS INTEGER) as days_overdue
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date < ?
        ORDER BY b.expiry_date ASC
      `).all(today, today);

      const critical = db.prepare(`
        SELECT 
          b.*, p.name as product_name, p.sku as product_sku, p.unit, p.storage_temperature,
          c.name as category_name, br.name as branch_name,
          ROUND(b.current_quantity * b.purchase_cost, 2) as loss_amount,
          CAST(JULIANDAY(b.expiry_date) - JULIANDAY(?) AS INTEGER) as days_left
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date >= ? AND b.expiry_date <= ?
        ORDER BY b.expiry_date ASC
      `).all(today, today, threeDays);

      const upcoming = db.prepare(`
        SELECT 
          b.*, p.name as product_name, p.sku as product_sku, p.unit, p.storage_temperature,
          c.name as category_name, br.name as branch_name,
          ROUND(b.current_quantity * b.purchase_cost, 2) as loss_amount,
          CAST(JULIANDAY(b.expiry_date) - JULIANDAY(?) AS INTEGER) as days_left
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date > ? AND b.expiry_date <= ?
        ORDER BY b.expiry_date ASC
      `).all(today, threeDays, sevenDays);

      const wasteHistory = db.prepare(`
        SELECT 
          w.*, p.name as product_name, p.sku as product_sku, p.unit,
          COALESCE(b.batch_number, 'Direct') as batch_number,
          br.name as branch_name
        FROM waste_damaged w
        JOIN products p ON w.product_id = p.id
        LEFT JOIN batches b ON w.batch_id = b.id
        JOIN branches br ON w.branch_id = br.id
        ORDER BY w.recorded_date DESC, w.id DESC
        LIMIT 100
      `).all();

      const totalHistoricalLoss = db.prepare('SELECT COALESCE(SUM(total_loss_value), 0) as loss FROM waste_damaged').get().loss;
      const totalExpiredSittingLoss = expired.reduce((acc, row) => acc + row.loss_amount, 0);
      const totalAtRiskValue = critical.reduce((acc, row) => acc + row.loss_amount, 0);

      // Expiring today subset
      const todayOnly = critical.filter(b => b.expiry_date === today);

      res.json({
        success: true,
        data: {
          expired,
          critical,
          upcoming,
          today: todayOnly,
          wasteHistory,
          metrics: {
            totalHistoricalLoss: Number(totalHistoricalLoss.toFixed(2)),
            totalExpiredSittingLoss: Number(totalExpiredSittingLoss.toFixed(2)),
            totalAtRiskValue: Number(totalAtRiskValue.toFixed(2)),
            expiredCount: expired.length,
            criticalCount: critical.length,
            upcomingCount: upcoming.length,
            todayCount: todayOnly.length
          }
        }
      });
    } catch (err) {
      console.error('Error fetching expiry data:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 11.3: WASTAGE HISTORY LOG (SEARCH, FILTER & PAGINATION)
  // -------------------------------------------------------------
  app.get('/api/expiry/wastage', optionalAuth, (req, res) => {
    try {
      const {
        search,
        waste_type, // 'all', 'Expired', 'Damaged', 'Spilled', 'Spoiled', 'Other Wastage'
        startDate,
        endDate,
        product_id,
        branch_id,
        page = 1,
        limit = 50
      } = req.query;

      let whereClauses = ['1=1'];
      const params = [];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        whereClauses.push('(p.name LIKE ? OR p.sku LIKE ? OR b.batch_number LIKE ? OR w.reason LIKE ? OR w.recorded_by LIKE ?)');
        params.push(term, term, term, term, term);
      }

      if (waste_type && waste_type !== 'all') {
        whereClauses.push('w.waste_type = ?');
        params.push(waste_type);
      }

      if (product_id && product_id !== 'all') {
        whereClauses.push('w.product_id = ?');
        params.push(Number(product_id));
      }

      if (branch_id && branch_id !== 'all') {
        whereClauses.push('w.branch_id = ?');
        params.push(Number(branch_id));
      }

      if (startDate) {
        whereClauses.push('w.recorded_date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereClauses.push('w.recorded_date <= ?');
        params.push(endDate);
      }

      const whereSql = whereClauses.join(' AND ');

      const countRow = db.prepare(`
        SELECT 
          COUNT(*) as total,
          ROUND(COALESCE(SUM(w.total_loss_value), 0), 2) as total_filtered_loss,
          ROUND(COALESCE(SUM(w.quantity), 0), 2) as total_filtered_qty
        FROM waste_damaged w
        JOIN products p ON w.product_id = p.id
        LEFT JOIN batches b ON w.batch_id = b.id
        WHERE ${whereSql}
      `).get(...params);

      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
      const queryParams = [...params, Number(limit), offset];

      const rows = db.prepare(`
        SELECT 
          w.*,
          'WST-' || PRINTF('%04d', w.id) as formatted_waste_id,
          p.name as product_name,
          p.sku as product_sku,
          COALESCE(w.unit, p.unit) as unit,
          c.name as category_name,
          COALESCE(b.batch_number, 'Direct Batch') as batch_number,
          b.expiry_date as batch_expiry_date,
          br.name as branch_name
        FROM waste_damaged w
        JOIN products p ON w.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN batches b ON w.batch_id = b.id
        JOIN branches br ON w.branch_id = br.id
        WHERE ${whereSql}
        ORDER BY w.recorded_date DESC, w.id DESC
        LIMIT ? OFFSET ?
      `).all(...queryParams);

      res.json({
        success: true,
        data: rows,
        summary: {
          total_loss: countRow ? countRow.total_filtered_loss : 0,
          total_quantity: countRow ? countRow.total_filtered_qty : 0
        },
        pagination: {
          total: countRow ? countRow.total : 0,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil((countRow ? countRow.total : 0) / Number(limit))
        }
      });
    } catch (err) {
      console.error('Error fetching wastage log:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 11.4: RECORD WASTAGE & DEDUCT FROM INVENTORY (CONFIRMED)
  // Automatically calculates: Wastage Cost = Wasted Quantity * Unit Cost
  // Deducts wastage quantities from inventory only after confirmation.
  // -------------------------------------------------------------
  app.post('/api/expiry/wastage', authenticateToken, (req, res) => {
    try {
      const {
        product_id,
        batch_id,
        quantity,
        waste_type = 'Spoiled',
        reason,
        unit_cost,
        action_taken = 'Discarded',
        recorded_date,
        branch_id
      } = req.body;

      const qty = Number(quantity);
      if (!qty || qty <= 0) {
        return res.status(400).json({ success: false, error: 'Valid positive wasted quantity is required.' });
      }

      if (!product_id) {
        return res.status(400).json({ success: false, error: 'Product is required.' });
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, error: 'Reason for wastage / loss is required.' });
      }

      const product = db.prepare('SELECT id, name, sku, unit, purchase_price, selling_price FROM products WHERE id = ?').get(Number(product_id));
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      // Identify target batch to deduct from
      let batch = null;
      if (batch_id) {
        batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id));
      }

      if (!batch) {
        // Fallback: pick the batch with available stock expiring earliest (FEFO)
        batch = db.prepare(`
          SELECT * FROM batches 
          WHERE product_id = ? AND current_quantity > 0 
          ORDER BY expiry_date ASC, id ASC 
          LIMIT 1
        `).get(product.id);
      }

      if (!batch) {
        return res.status(400).json({ success: false, error: `No active inventory batches with available stock found for ${product.name}.` });
      }

      // Check stock availability (Deduct only after confirmation)
      if (batch.current_quantity < qty) {
        return res.status(400).json({
          success: false,
          error: `Insufficient batch quantity. Batch ${batch.batch_number} has only ${batch.current_quantity} ${product.unit} available (requested: ${qty}).`
        });
      }

      // Cost Calculation: Wastage Cost = Wasted Quantity * Unit Cost
      const applicableCost = (unit_cost !== undefined && Number(unit_cost) >= 0)
        ? Number(unit_cost)
        : (batch.purchase_cost || product.purchase_price || 0);

      const totalLossValue = Number((qty * applicableCost).toFixed(2));
      const recordDate = recorded_date || getTodayDate();
      const targetBranchId = Number(branch_id || batch.branch_id || 1);
      const actor = req.user ? req.user.name : 'Administrator';

      // Canonical mapping to stock movement types:
      // 'Expired' -> 'Expired Stock'
      // 'Damaged' -> 'Damaged Stock'
      // 'Spilled', 'Spoiled', 'Other Wastage' -> 'Wastage'
      let canonicalMovementType = 'Wastage';
      if (waste_type === 'Expired') canonicalMovementType = 'Expired Stock';
      else if (waste_type === 'Damaged') canonicalMovementType = 'Damaged Stock';

      // Atomic Transaction
      db.exec('BEGIN');
      let wasteId = null;

      try {
        // 1. Fetch total product stock before deduction
        const onHandRow = db.prepare('SELECT COALESCE(SUM(current_quantity), 0) as stock FROM batches WHERE product_id = ?').get(product.id);
        const prevStock = Number(onHandRow ? onHandRow.stock : 0);
        const updatedStock = Math.max(0, prevStock - qty);

        // 2. Deduct batch current quantity
        db.prepare('UPDATE batches SET current_quantity = MAX(0, current_quantity - ?) WHERE id = ?').run(qty, batch.id);

        // 3. Record into waste_damaged table
        const insertRes = db.prepare(`
          INSERT INTO waste_damaged (
            product_id, batch_id, branch_id, quantity, unit, unit_cost, total_loss_value,
            waste_type, reason, action_taken, recorded_date, recorded_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          product.id,
          batch.id,
          targetBranchId,
          qty,
          product.unit || 'Units',
          applicableCost,
          totalLossValue,
          waste_type,
          reason.trim(),
          action_taken,
          recordDate,
          actor
        );

        wasteId = Number(insertRes.lastInsertRowid);
        const refNo = `WST-${String(wasteId).padStart(4, '0')}`;

        // 4. Record corresponding immutable stock movement (Outflow)
        db.prepare(`
          INSERT INTO stock_movements (
            movement_type, product_id, batch_id, from_branch_id, to_branch_id,
            quantity, unit, previous_stock, updated_stock, flow_type,
            reference_txn, reason, cost_impact, performed_by, movement_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          canonicalMovementType,
          product.id,
          batch.id,
          targetBranchId,
          null,
          qty,
          product.unit || 'Units',
          prevStock,
          updatedStock,
          'Outflow',
          refNo,
          `Wastage [${waste_type}]: ${reason.trim()} (${action_taken})`,
          -totalLossValue,
          actor,
          recordDate
        );

        db.exec('COMMIT');

        // Module 14: Check Unusual Wastage Threshold & Emit Notification
        const threshRow = db.prepare("SELECT value FROM settings WHERE key = 'notify_wastage_threshold'").get();
        const threshold = threshRow ? parseFloat(threshRow.value) || 500 : 500;
        if (totalLossValue >= threshold || qty >= 10) {
          emitNotification({
            type: 'wastage_unusual',
            category: 'wastage',
            title: `Unusual Wastage: ${product.name}`,
            message: `Recorded ${qty} ${product.unit} ${waste_type} loss from Batch #${batch.batch_number} (₹${totalLossValue.toFixed(2)} loss). Reason: ${reason.trim()}.`,
            severity: totalLossValue >= threshold * 2 ? 'danger' : 'warning',
            link_view: 'expiry',
            reference_id: product.id
          });
        }
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      logAudit(
        req.user ? req.user.id : null,
        actor,
        req.user ? req.user.role : 'Staff',
        'RECORD_WASTAGE',
        'WASTE',
        wasteId,
        `Recorded ${waste_type} loss: ${qty} ${product.unit} of ${product.name} (Batch ${batch.batch_number}). Financial loss: ₹${totalLossValue.toFixed(2)}`,
        req.ip
      );

      res.json({
        success: true,
        id: wasteId,
        loss_value: totalLossValue,
        remaining_batch_qty: Math.max(0, batch.current_quantity - qty),
        message: `Successfully recorded ${waste_type} loss of ${qty} ${product.unit} ${product.name}. Financial loss logged: ₹${totalLossValue.toFixed(2)}.`
      });
    } catch (err) {
      console.error('Error recording wastage:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Alias for backward compatibility and write-off requests
  app.post(['/api/expiry/action', '/api/expiry/write-off'], authenticateToken, (req, res) => {
    // Map action payload into wastage handler
    const { batch_id, quantity, action, reason, performed_by } = req.body;
    const batch = db.prepare('SELECT product_id, branch_id, purchase_cost, current_quantity FROM batches WHERE id = ?').get(Number(batch_id));
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found.' });
    }

    let wasteType = 'Expired';
    const lowerReason = (reason || '').toLowerCase();
    if (lowerReason.includes('leak') || lowerReason.includes('damage') || lowerReason.includes('crack')) {
      wasteType = 'Damaged';
    } else if (lowerReason.includes('spill') || lowerReason.includes('overflow')) {
      wasteType = 'Spilled';
    } else if (lowerReason.includes('curdle') || lowerReason.includes('sour') || lowerReason.includes('cold chain')) {
      wasteType = 'Spoiled';
    }

    req.body.product_id = batch.product_id;
    req.body.branch_id = batch.branch_id;
    req.body.unit_cost = batch.purchase_cost;
    req.body.waste_type = wasteType;
    req.body.action_taken = action || 'Discarded';

    // Call wastage logic
    const qty = (quantity !== undefined && Number(quantity) > 0) ? Number(quantity) : batch.current_quantity;
    const applicableCost = batch.purchase_cost;
    const totalLossValue = Number((qty * applicableCost).toFixed(2));
    const recordDate = getTodayDate();
    const actor = req.user ? req.user.name : (performed_by || 'Staff');

    db.exec('BEGIN');
    let wasteId = null;

    try {
      const prod = db.prepare('SELECT unit, name FROM products WHERE id = ?').get(batch.product_id);
      const onHandRow = db.prepare('SELECT COALESCE(SUM(current_quantity), 0) as stock FROM batches WHERE product_id = ?').get(batch.product_id);
      const prevStock = Number(onHandRow ? onHandRow.stock : 0);
      const updatedStock = Math.max(0, prevStock - qty);

      db.prepare('UPDATE batches SET current_quantity = MAX(0, current_quantity - ?) WHERE id = ?').run(qty, Number(batch_id));

      const insertRes = db.prepare(`
        INSERT INTO waste_damaged (
          product_id, batch_id, branch_id, quantity, unit, unit_cost, total_loss_value,
          waste_type, reason, action_taken, recorded_date, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.product_id,
        Number(batch_id),
        batch.branch_id,
        qty,
        prod ? prod.unit : 'Units',
        applicableCost,
        totalLossValue,
        wasteType,
        reason || 'Expired shelf life in store',
        action || 'Discarded',
        recordDate,
        actor
      );

      wasteId = Number(insertRes.lastInsertRowid);
      const refNo = `WST-${String(wasteId).padStart(4, '0')}`;

      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id, to_branch_id,
          quantity, unit, previous_stock, updated_stock, flow_type,
          reference_txn, reason, cost_impact, performed_by, movement_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        wasteType === 'Expired' ? 'Expired Stock' : (wasteType === 'Damaged' ? 'Damaged Stock' : 'Wastage'),
        batch.product_id,
        Number(batch_id),
        batch.branch_id,
        null,
        qty,
        prod ? prod.unit : 'Units',
        prevStock,
        updatedStock,
        'Outflow',
        refNo,
        `${action || 'Discarded'}: ${reason || 'Expired shelf life'}`,
        -totalLossValue,
        actor,
        recordDate
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      return res.status(500).json({ success: false, error: err.message });
    }

    logAudit(
      req.user ? req.user.id : null,
      actor,
      req.user ? req.user.role : 'Staff',
      'WRITE_OFF_SPOILAGE',
      'WASTE',
      wasteId,
      `Wrote off ${qty} units (${action}): ₹${totalLossValue.toFixed(2)} loss`,
      req.ip
    );

    res.json({
      success: true,
      id: wasteId,
      loss_value: totalLossValue,
      message: `Action recorded! ${qty} units marked as ${action}. Loss logged: ₹${totalLossValue.toFixed(2)}`
    });
  });

  // -------------------------------------------------------------
  // 11.5: EXCEL REPORT EXPORT
  // -------------------------------------------------------------
  app.get('/api/expiry/report', optionalAuth, (req, res) => {
    try {
      const buffer = generateWasteReport(req.query);
      const filename = `DairyTrack_Expiry_Wastage_Report_${getTodayDate()}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      console.error('Error generating wastage Excel report:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

};
