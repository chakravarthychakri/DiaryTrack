// ====================================================================
// MODULE 5: INVENTORY MANAGEMENT, FEFO ALLOCATION & STOCK LEDGER
// ====================================================================

const {
  db,
  formatDate,
  addDays,
  logAudit
} = require('./db');

function getTodayDate() {
  return formatDate(new Date());
}

module.exports = function registerInventoryRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // -------------------------------------------------------------
  // 5.1: INVENTORY DASHBOARD SUMMARY STATS
  // -------------------------------------------------------------
  app.get('/api/inventory/dashboard', optionalAuth, (req, res) => {
    try {
      const { branchId } = req.query;
      const branchFilter = branchId && branchId !== 'all' ? Number(branchId) : null;
      const today = getTodayDate();
      const now = new Date();

      // Read configurable alert thresholds from settings
      const warningDaysSetting = db.prepare("SELECT value FROM settings WHERE key = 'alert_expiry_warning_days'").get();
      const criticalDaysSetting = db.prepare("SELECT value FROM settings WHERE key = 'alert_expiry_critical_days'").get();
      const warnDays = warningDaysSetting ? parseInt(warningDaysSetting.value, 10) : 7;
      const critDays = criticalDaysSetting ? parseInt(criticalDaysSetting.value, 10) : 3;

      const warnDate = formatDate(addDays(now, warnDays));
      const critDate = formatDate(addDays(now, critDays));

      // 1. Total Available Inventory & Valuation
      let availQuery = `
        SELECT 
          COALESCE(SUM(b.current_quantity), 0) as total_units,
          COUNT(DISTINCT b.id) as active_batches,
          ROUND(COALESCE(SUM(b.current_quantity * b.purchase_cost), 0), 2) as total_valuation
        FROM batches b
        WHERE b.current_quantity > 0
      `;
      const availParams = [];
      if (branchFilter) {
        availQuery += ' AND b.branch_id = ?';
        availParams.push(branchFilter);
      }
      const availStats = db.prepare(availQuery).get(...availParams);

      // 2. Low Stock & Out of Stock Products
      let stockCountsQuery = `
        SELECT 
          SUM(CASE WHEN current_stock <= min_stock_level AND current_stock > 0 THEN 1 ELSE 0 END) as low_stock_count,
          SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
          COUNT(*) as total_active_skus
        FROM (
          SELECT p.id, p.min_stock_level, COALESCE(SUM(b.current_quantity), 0) as current_stock
          FROM products p
          LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
          WHERE p.is_active = 1
          ${branchFilter ? 'AND (b.branch_id = ? OR b.branch_id IS NULL)' : ''}
          GROUP BY p.id
        )
      `;
      const stockCounts = db.prepare(stockCountsQuery).get(...(branchFilter ? [branchFilter] : []));

      // 3. Near Expiry (<= 7 Days & <= 3 Days)
      let nearExpQuery = `
        SELECT 
          COUNT(DISTINCT b.id) as batch_count,
          COALESCE(SUM(b.current_quantity), 0) as units,
          ROUND(COALESCE(SUM(b.current_quantity * b.purchase_cost), 0), 2) as at_risk_value
        FROM batches b
        WHERE b.current_quantity > 0 AND b.expiry_date >= ? AND b.expiry_date <= ?
      `;
      const nearExpParams = [today, warnDate];
      if (branchFilter) {
        nearExpQuery += ' AND b.branch_id = ?';
        nearExpParams.push(branchFilter);
      }
      const nearExpiryStats = db.prepare(nearExpQuery).get(...nearExpParams);

      let critExpQuery = `
        SELECT 
          COUNT(DISTINCT b.id) as batch_count,
          COALESCE(SUM(b.current_quantity), 0) as units,
          ROUND(COALESCE(SUM(b.current_quantity * b.purchase_cost), 0), 2) as at_risk_value
        FROM batches b
        WHERE b.current_quantity > 0 AND b.expiry_date >= ? AND b.expiry_date <= ?
      `;
      const critExpParams = [today, critDate];
      if (branchFilter) {
        critExpQuery += ' AND b.branch_id = ?';
        critExpParams.push(branchFilter);
      }
      const criticalExpiryStats = db.prepare(critExpQuery).get(...critExpParams);

      // 4. Expired Stock on Shelf (< Today)
      let expiredQuery = `
        SELECT 
          COUNT(DISTINCT b.id) as batch_count,
          COALESCE(SUM(b.current_quantity), 0) as units,
          ROUND(COALESCE(SUM(b.current_quantity * b.purchase_cost), 0), 2) as loss_value
        FROM batches b
        WHERE b.current_quantity > 0 AND b.expiry_date < ?
      `;
      const expParams = [today];
      if (branchFilter) {
        expiredQuery += ' AND b.branch_id = ?';
        expParams.push(branchFilter);
      }
      const expiredStats = db.prepare(expiredQuery).get(...expParams);

      // 5. Damaged & Spoiled Stock (Historical waste records)
      let wasteQuery = `
        SELECT 
          COUNT(*) as incident_count,
          COALESCE(SUM(quantity), 0) as units,
          ROUND(COALESCE(SUM(total_loss_value), 0), 2) as total_loss
        FROM waste_damaged
        WHERE 1=1
      `;
      const wasteParams = [];
      if (branchFilter) {
        wasteQuery += ' AND branch_id = ?';
        wasteParams.push(branchFilter);
      }
      const wasteStats = db.prepare(wasteQuery).get(...wasteParams);

      res.json({
        success: true,
        data: {
          available_inventory: availStats.total_units,
          active_batches: availStats.active_batches,
          inventory_valuation: availStats.total_valuation,
          low_stock_items: stockCounts.low_stock_count || 0,
          out_of_stock_products: stockCounts.out_of_stock_count || 0,
          total_active_skus: stockCounts.total_active_skus || 0,
          near_expiry_warning: {
            days: warnDays,
            batches: nearExpiryStats.batch_count,
            units: nearExpiryStats.units,
            value: nearExpiryStats.at_risk_value
          },
          near_expiry_critical: {
            days: critDays,
            batches: criticalExpiryStats.batch_count,
            units: criticalExpiryStats.units,
            value: criticalExpiryStats.at_risk_value
          },
          expired_stock: {
            batches: expiredStats.batch_count,
            units: expiredStats.units,
            loss_value: expiredStats.loss_value
          },
          damaged_stock: {
            incidents: wasteStats.incident_count,
            units: wasteStats.units,
            total_loss: wasteStats.total_loss
          }
        }
      });
    } catch (err) {
      console.error('Error fetching inventory dashboard:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 5.2: STOCK RECONCILIATION FORMULA
  // Closing Stock = Opening Stock + Purchases Received + Sale Returns + Transfers In 
  //                 - Sales - Supplier Returns - Transfers Out - Expired Stock - Damaged Stock - Other Outflows
  // -------------------------------------------------------------
  app.get('/api/inventory/reconciliation', optionalAuth, (req, res) => {
    try {
      const { productId, branchId } = req.query;

      let prodQuery = 'SELECT id, name, sku, unit, min_stock_level, purchase_price, selling_price FROM products WHERE is_active = 1';
      const prodParams = [];
      if (productId) {
        prodQuery += ' AND id = ?';
        prodParams.push(Number(productId));
      }
      const products = db.prepare(prodQuery).all(...prodParams);

      const reconciliation = products.map(prod => {
        // Query movements by movement_type for this product
        let mQuery = `
          SELECT 
            movement_type,
            COALESCE(SUM(quantity), 0) as total_qty,
            ROUND(COALESCE(SUM(cost_impact), 0), 2) as total_cost
          FROM stock_movements
          WHERE product_id = ?
        `;
        const mParams = [prod.id];
        if (branchId && branchId !== 'all') {
          mQuery += ' AND (from_branch_id = ? OR to_branch_id = ?)';
          mParams.push(Number(branchId), Number(branchId));
        }
        mQuery += ' GROUP BY movement_type';

        const rows = db.prepare(mQuery).all(...mParams);
        const map = {};
        rows.forEach(r => { map[r.movement_type] = Number(r.total_qty); });

        const openingStock = map['Opening Stock'] || 0;
        const purchasesReceived = (map['Purchase Received'] || 0) + (map['Purchase'] || 0);
        const saleReturns = map['Sale Return'] || 0;
        const transfersIn = map['Transfer In'] || 0;

        const sales = map['Sale'] || 0;
        const supplierReturns = (map['Supplier Return'] || 0) + (map['Return to Supplier'] || 0);
        const transfersOut = map['Transfer Out'] || 0;
        const expiredStock = map['Expired'] || 0;
        const damagedStock = map['Damage'] || 0;
        const otherOutflows = map['Adjustment'] ? (map['Adjustment'] < 0 ? Math.abs(map['Adjustment']) : 0) : 0;
        const otherInflows = map['Adjustment'] ? (map['Adjustment'] > 0 ? map['Adjustment'] : 0) : 0;

        // Apply formula
        const calculatedClosing = openingStock + purchasesReceived + saleReturns + transfersIn + otherInflows
                                 - sales - supplierReturns - transfersOut - expiredStock - damagedStock - otherOutflows;

        // Query actual stock on hand across non-zero batches
        let actualStockQuery = 'SELECT COALESCE(SUM(current_quantity), 0) as on_hand FROM batches WHERE product_id = ? AND current_quantity > 0';
        const actualParams = [prod.id];
        if (branchId && branchId !== 'all') {
          actualStockQuery += ' AND branch_id = ?';
          actualParams.push(Number(branchId));
        }
        const actualOnHand = Number(db.prepare(actualStockQuery).get(...actualParams).on_hand);

        const variance = Number((actualOnHand - calculatedClosing).toFixed(2));

        return {
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          purchase_price: prod.purchase_price,
          opening_stock: openingStock,
          purchases_received: purchasesReceived,
          sale_returns: saleReturns,
          transfers_in: transfersIn,
          sales: sales,
          supplier_returns: supplierReturns,
          transfers_out: transfersOut,
          expired_stock: expiredStock,
          damaged_stock: damagedStock,
          other_outflows: otherOutflows,
          other_inflows: otherInflows,
          calculated_closing_stock: Number(calculatedClosing.toFixed(2)),
          actual_on_hand_stock: actualOnHand,
          variance: variance,
          is_balanced: Math.abs(variance) < 0.01,
          valuation: Number((actualOnHand * prod.purchase_price).toFixed(2))
        };
      });

      res.json({
        success: true,
        data: reconciliation,
        formula: "Closing Stock = Opening Stock + Purchases Received + Sale Returns + Transfers In - Sales - Supplier Returns - Transfers Out - Expired Stock - Damaged Stock - Other Outflows"
      });
    } catch (err) {
      console.error('Error in stock reconciliation:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 5.4: BATCH MANAGEMENT WITH FEFO ALLOCATION
  // -------------------------------------------------------------
  app.get('/api/inventory/batches', optionalAuth, (req, res) => {
    try {
      const { branchId, productId, status, search, sortBy = 'fefo' } = req.query;
      const today = getTodayDate();
      const threeDays = formatDate(addDays(new Date(), 3));
      const sevenDays = formatDate(addDays(new Date(), 7));

      let query = `
        SELECT 
          b.*,
          p.name as product_name,
          p.sku,
          p.unit,
          p.storage_temperature,
          p.min_stock_level,
          c.name as category_name,
          br.name as branch_name,
          s.name as supplier_name,
          s.phone as supplier_phone,
          ROUND(b.current_quantity * b.purchase_cost, 2) as batch_valuation,
          CAST((julianday(b.expiry_date) - julianday('now')) AS INTEGER) as days_until_expiry,
          CASE
            WHEN b.current_quantity <= 0 THEN 'Depleted'
            WHEN b.expiry_date < ? THEN 'Expired'
            WHEN b.expiry_date <= ? THEN 'Near Expiry'
            ELSE 'Active'
          END as dynamic_status
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN branches br ON b.branch_id = br.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE 1=1
      `;
      const params = [today, threeDays];

      if (branchId && branchId !== 'all') {
        query += ' AND b.branch_id = ?';
        params.push(Number(branchId));
      }
      if (productId) {
        query += ' AND b.product_id = ?';
        params.push(Number(productId));
      }
      if (search) {
        query += ' AND (b.batch_number LIKE ? OR p.name LIKE ? OR p.sku LIKE ? OR s.name LIKE ?)';
        const t = `%${search}%`;
        params.push(t, t, t, t);
      }
      if (status && status !== 'all') {
        if (status === 'Expired') {
          query += ' AND b.expiry_date < ? AND b.current_quantity > 0';
          params.push(today);
        } else if (status === 'Near Expiry') {
          query += ' AND b.expiry_date <= ? AND b.expiry_date >= ? AND b.current_quantity > 0';
          params.push(sevenDays, today);
        } else if (status === 'Active') {
          query += ' AND b.expiry_date > ? AND b.current_quantity > 0';
          params.push(sevenDays);
        } else if (status === 'Depleted') {
          query += ' AND b.current_quantity <= 0';
        }
      }

      // FEFO Sort: Earliest expiry date first
      if (sortBy === 'fefo') {
        query += ' ORDER BY b.current_quantity > 0 DESC, b.expiry_date ASC, b.id ASC';
      } else if (sortBy === 'expiry_desc') {
        query += ' ORDER BY b.expiry_date DESC';
      } else if (sortBy === 'stock_desc') {
        query += ' ORDER BY b.current_quantity DESC';
      } else {
        query += ' ORDER BY b.id DESC';
      }

      const batches = db.prepare(query).all(...params);

      // Compute FEFO allocation priority index for active batches
      const fefoProductMap = {};
      const enrichedBatches = batches.map(b => {
        if (b.current_quantity > 0 && b.dynamic_status !== 'Expired') {
          fefoProductMap[b.product_id] = (fefoProductMap[b.product_id] || 0) + 1;
          return {
            ...b,
            fefo_priority: fefoProductMap[b.product_id]
          };
        }
        return {
          ...b,
          fefo_priority: null
        };
      });

      res.json({ success: true, data: enrichedBatches });
    } catch (err) {
      console.error('Error fetching inventory batches:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 5.3: INVENTORY OPERATIONS
  // -------------------------------------------------------------

  // 1. Add Opening Stock
  app.post('/api/inventory/opening-stock', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const {
        product_id, branch_id = 1, batch_number, quantity, purchase_cost,
        selling_price, mfg_date, expiry_date, supplier_id, notes
      } = req.body;

      if (!product_id || !quantity || Number(quantity) <= 0 || !expiry_date) {
        return res.status(400).json({ success: false, error: 'Product, valid positive quantity and expiry date are required.' });
      }

      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id));
      if (!prod) return res.status(404).json({ success: false, error: 'Product not found.' });

      const today = getTodayDate();
      const bNum = (batch_number || `OPN-${Date.now().toString().slice(-6)}`).trim().toUpperCase();
      const pCost = purchase_cost !== undefined ? Number(purchase_cost) : prod.purchase_price;
      const sPrice = selling_price !== undefined ? Number(selling_price) : prod.selling_price;
      const mDate = mfg_date || today;

      const result = db.prepare(`
        INSERT INTO batches (
          product_id, branch_id, batch_number, mfg_date, expiry_date,
          initial_quantity, current_quantity, purchase_cost, selling_price,
          status, supplier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
      `).run(
        prod.id,
        Number(branch_id),
        bNum,
        mDate,
        expiry_date,
        Number(quantity),
        Number(quantity),
        pCost,
        sPrice,
        supplier_id ? Number(supplier_id) : (prod.supplier_id || null)
      );

      const batchId = Number(result.lastInsertRowid);

      // Record in stock_movements as Opening Stock
      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, to_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Opening Stock', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        prod.id,
        batchId,
        Number(branch_id),
        Number(quantity),
        notes || 'Opening Stock Initial Setup',
        Number((quantity * pCost).toFixed(2)),
        req.user.name,
        today
      );

      logAudit(req.user.id, req.user.name, req.user.role, 'ADD_OPENING_STOCK', 'BATCH', batchId, `Added opening stock: ${quantity} ${prod.unit} of ${prod.name} (Batch ${bNum})`, req.ip);

      res.json({
        success: true,
        message: `Opening stock of ${quantity} ${prod.unit} recorded for ${prod.name}.`,
        batch_id: batchId
      });
    } catch (err) {
      console.error('Error adding opening stock:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Receive New Stock (Direct Intake / Batch Receipt)
  app.post(['/api/inventory/receive-stock', '/api/inventory/batch'], authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const {
        product_id, supplier_id, branch_id = 1, batch_number, quantity,
        purchase_cost, selling_price, mfg_date, expiry_date, invoice_ref, notes
      } = req.body;

      if (!product_id || !quantity || Number(quantity) <= 0 || !expiry_date) {
        return res.status(400).json({ success: false, error: 'Product, valid quantity and expiry date are required.' });
      }

      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id));
      if (!prod) return res.status(404).json({ success: false, error: 'Product not found.' });

      const today = getTodayDate();
      const bNum = (batch_number || `BAT-${Date.now().toString().slice(-6)}`).trim().toUpperCase();
      const pCost = purchase_cost !== undefined ? Number(purchase_cost) : prod.purchase_price;
      const sPrice = selling_price !== undefined ? Number(selling_price) : prod.selling_price;
      const mDate = mfg_date || today;

      const result = db.prepare(`
        INSERT INTO batches (
          product_id, branch_id, batch_number, mfg_date, expiry_date,
          initial_quantity, current_quantity, purchase_cost, selling_price,
          status, supplier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
      `).run(
        prod.id,
        Number(branch_id),
        bNum,
        mDate,
        expiry_date,
        Number(quantity),
        Number(quantity),
        pCost,
        sPrice,
        supplier_id ? Number(supplier_id) : (prod.supplier_id || null)
      );

      const batchId = Number(result.lastInsertRowid);

      // Record in stock_movements as Purchase Received
      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, to_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Purchase Received', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        prod.id,
        batchId,
        Number(branch_id),
        Number(quantity),
        invoice_ref ? `Invoice/PO: ${invoice_ref} - ${notes || 'Intake'}` : (notes || 'Batch Delivery Receipt'),
        Number((quantity * pCost).toFixed(2)),
        req.user.name,
        today
      );

      logAudit(req.user.id, req.user.name, req.user.role, 'RECEIVE_STOCK', 'BATCH', batchId, `Received ${quantity} ${prod.unit} of ${prod.name} (Batch ${bNum})`, req.ip);

      res.json({
        success: true,
        message: `Successfully received ${quantity} ${prod.unit} of ${prod.name}!`,
        id: batchId,
        batch_id: batchId
      });
    } catch (err) {
      console.error('Error receiving stock:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Adjust Stock (Positive or Negative Variance) - Supports /api/inventory/adjustments
  app.post(['/api/inventory/adjust-stock', '/api/inventory/adjustments'], authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const {
        batch_id, adjustment_type, quantity, adjustment_quantity, reason, notes
      } = req.body;

      const rawQty = quantity !== undefined ? Number(quantity) : (adjustment_quantity !== undefined ? Number(adjustment_quantity) : NaN);
      if (!batch_id || isNaN(rawQty) || rawQty === 0 || !reason) {
        return res.status(400).json({ success: false, error: 'Batch ID, valid non-zero quantity adjustment, and reason are required.' });
      }

      const batch = db.prepare(`
        SELECT b.*, p.name as product_name, p.unit
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.id = ?
      `).get(Number(batch_id));

      if (!batch) return res.status(404).json({ success: false, error: 'Batch not found.' });

      const isIncrease = adjustment_type ? adjustment_type === 'Increase' : (rawQty > 0);
      const adjQty = Math.abs(rawQty);
      let newQty = isIncrease ? (batch.current_quantity + adjQty) : (batch.current_quantity - adjQty);

      if (newQty < 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot decrease stock by ${adjQty} units. Batch only has ${batch.current_quantity} ${batch.unit} remaining.`
        });
      }

      const newStatus = newQty === 0 ? 'Depleted' : 'Active';
      db.prepare('UPDATE batches SET current_quantity = ?, status = ? WHERE id = ?').run(newQty, newStatus, batch.id);

      const today = getTodayDate();
      const signedQty = isIncrease ? adjQty : -adjQty;
      const costImpact = Number((adjQty * batch.purchase_cost).toFixed(2));

      // Record in stock_movements
      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Adjustment', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.product_id,
        batch.id,
        batch.branch_id,
        signedQty,
        `${reason} - ${notes || 'Manual stock adjustment'}`,
        isIncrease ? costImpact : -costImpact,
        req.user.name,
        today
      );

      // Check for Unusual Stock Adjustment Alert (Section 5.5)
      const unusalQtySetting = db.prepare("SELECT value FROM settings WHERE key = 'alert_unusual_adjustment_qty'").get();
      const unusalCostSetting = db.prepare("SELECT value FROM settings WHERE key = 'alert_unusual_adjustment_cost'").get();
      const unusualQtyThreshold = unusalQtySetting ? parseFloat(unusalQtySetting.value) : 25;
      const unusualCostThreshold = unusalCostSetting ? parseFloat(unusalCostSetting.value) : 1000;

      const isUnusual = adjQty >= unusualQtyThreshold || costImpact >= unusualCostThreshold;
      if (isUnusual) {
        db.prepare(`
          INSERT INTO notifications (type, title, message, severity)
          VALUES ('unusual_adjustment', ?, ?, 'warning')
        `).run(
          `Unusual Stock Adjustment: ${batch.product_name}`,
          `${req.user.name} adjusted ${isIncrease ? '+' : '-'}${adjQty} ${batch.unit} (₹${costImpact}) on Batch ${batch.batch_number}. Reason: ${reason}`
        );
      }

      logAudit(req.user.id, req.user.name, req.user.role, 'ADJUST_STOCK', 'BATCH', batch.id, `Stock adjustment (${isIncrease ? '+' : '-'}${adjQty} ${batch.unit}) on ${batch.product_name}. Reason: ${reason}`, req.ip);

      res.json({
        success: true,
        message: `Adjusted stock by ${isIncrease ? '+' : '-'}${adjQty} ${batch.unit}. New balance: ${newQty} ${batch.unit}.`,
        is_unusual: isUnusual,
        new_quantity: newQty
      });
    } catch (err) {
      console.error('Error adjusting stock:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Record Damage & Spoilage Write-Off
  app.post('/api/inventory/record-damage', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const { batch_id, quantity, reason, action_taken = 'Discarded', notes } = req.body;
      if (!batch_id || !quantity || Number(quantity) <= 0 || !reason) {
        return res.status(400).json({ success: false, error: 'Batch ID, valid quantity and damage reason are required.' });
      }

      const batch = db.prepare(`
        SELECT b.*, p.name as product_name, p.unit
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.id = ?
      `).get(Number(batch_id));

      if (!batch) return res.status(404).json({ success: false, error: 'Batch not found.' });

      const dmgQty = Number(quantity);
      if (batch.current_quantity < dmgQty) {
        return res.status(400).json({
          success: false,
          error: `Cannot record damage of ${dmgQty} units. Only ${batch.current_quantity} ${batch.unit} available in batch.`
        });
      }

      const newQty = batch.current_quantity - dmgQty;
      const newStatus = newQty === 0 ? 'Depleted' : batch.status;
      db.prepare('UPDATE batches SET current_quantity = ?, status = ? WHERE id = ?').run(newQty, newStatus, batch.id);

      const today = getTodayDate();
      const lossValue = Number((dmgQty * batch.purchase_cost).toFixed(2));

      // Record in waste_damaged
      const wasteRes = db.prepare(`
        INSERT INTO waste_damaged (
          product_id, batch_id, branch_id, quantity, unit_cost,
          total_loss_value, reason, action_taken, recorded_date, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.product_id,
        batch.id,
        batch.branch_id,
        dmgQty,
        batch.purchase_cost,
        lossValue,
        reason,
        action_taken,
        today,
        req.user.name
      );

      // Record in stock_movements as Damage
      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Damage', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.product_id,
        batch.id,
        batch.branch_id,
        dmgQty,
        `Damage: ${reason} - ${notes || action_taken}`,
        lossValue,
        req.user.name,
        today
      );

      logAudit(req.user.id, req.user.name, req.user.role, 'RECORD_DAMAGE', 'WASTE', wasteRes.lastInsertRowid, `Recorded damage of ${dmgQty} ${batch.unit} on ${batch.product_name}. Loss: ₹${lossValue}`, req.ip);

      res.json({
        success: true,
        message: `Recorded damage of ${dmgQty} ${batch.unit} for ${batch.product_name}. Loss: ₹${lossValue}.`,
        remaining_quantity: newQty,
        loss_value: lossValue
      });
    } catch (err) {
      console.error('Error recording damage:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Record Expiry Discard / Quarantine
  app.post('/api/inventory/record-expiry', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const { batch_id, quantity, action_taken = 'Discarded / Bio-Waste', notes } = req.body;
      if (!batch_id) {
        return res.status(400).json({ success: false, error: 'Batch ID is required.' });
      }

      const batch = db.prepare(`
        SELECT b.*, p.name as product_name, p.unit
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.id = ?
      `).get(Number(batch_id));

      if (!batch) return res.status(404).json({ success: false, error: 'Batch not found.' });

      const expQty = quantity ? Number(quantity) : batch.current_quantity;
      if (batch.current_quantity < expQty) {
        return res.status(400).json({
          success: false,
          error: `Cannot discard ${expQty} units. Batch has ${batch.current_quantity} remaining.`
        });
      }

      const newQty = batch.current_quantity - expQty;
      db.prepare('UPDATE batches SET current_quantity = ?, status = ? WHERE id = ?').run(newQty, 'Expired', batch.id);

      const today = getTodayDate();
      const lossValue = Number((expQty * batch.purchase_cost).toFixed(2));

      // Record in waste_damaged
      db.prepare(`
        INSERT INTO waste_damaged (
          product_id, batch_id, branch_id, quantity, unit_cost,
          total_loss_value, reason, action_taken, recorded_date, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'Expired', ?, ?, ?)
      `).run(
        batch.product_id,
        batch.id,
        batch.branch_id,
        expQty,
        batch.purchase_cost,
        lossValue,
        action_taken,
        today,
        req.user.name
      );

      // Record in stock_movements as Expired
      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Expired', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.product_id,
        batch.id,
        batch.branch_id,
        expQty,
        `Shelf Expiry: ${notes || action_taken}`,
        lossValue,
        req.user.name,
        today
      );

      logAudit(req.user.id, req.user.name, req.user.role, 'RECORD_EXPIRY', 'BATCH', batch.id, `Quarantined/discarded expired batch ${batch.batch_number} (${expQty} ${batch.unit}). Loss: ₹${lossValue}`, req.ip);

      res.json({
        success: true,
        message: `Batch ${batch.batch_number} (${expQty} ${batch.unit}) marked as expired and discarded. Financial loss: ₹${lossValue}.`
      });
    } catch (err) {
      console.error('Error recording expiry:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Transfer Stock between Branches
  app.post('/api/inventory/transfer-stock', authenticateToken, requireRole(['Administrator', 'Manager', 'Shopkeeper']), (req, res) => {
    try {
      const { batch_id, from_branch_id, to_branch_id, quantity, reason, notes } = req.body;
      if (!batch_id || !from_branch_id || !to_branch_id || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({ success: false, error: 'Batch, origin branch, destination branch, and positive quantity are required.' });
      }

      if (Number(from_branch_id) === Number(to_branch_id)) {
        return res.status(400).json({ success: false, error: 'Origin and destination branches must be different.' });
      }

      const batch = db.prepare(`
        SELECT b.*, p.name as product_name, p.unit
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.id = ? AND b.branch_id = ?
      `).get(Number(batch_id), Number(from_branch_id));

      if (!batch) return res.status(404).json({ success: false, error: 'Source batch not found at specified origin branch.' });

      const transferQty = Number(quantity);
      if (batch.current_quantity < transferQty) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock at origin: only ${batch.current_quantity} ${batch.unit} available in this batch.`
        });
      }

      // Deduct from source batch
      const newSourceQty = batch.current_quantity - transferQty;
      db.prepare('UPDATE batches SET current_quantity = ? WHERE id = ?').run(newSourceQty, batch.id);

      // Check if matching batch already exists at target branch
      let targetBatch = db.prepare(`
        SELECT id, current_quantity FROM batches 
        WHERE product_id = ? AND branch_id = ? AND batch_number = ?
      `).get(batch.product_id, Number(to_branch_id), batch.batch_number);

      let targetBatchId;
      if (targetBatch) {
        db.prepare('UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?')
          .run(transferQty, targetBatch.id);
        targetBatchId = targetBatch.id;
      } else {
        const ins = db.prepare(`
          INSERT INTO batches (
            product_id, branch_id, batch_number, mfg_date, expiry_date,
            initial_quantity, current_quantity, purchase_cost, selling_price, status, supplier_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        `).run(
          batch.product_id,
          Number(to_branch_id),
          batch.batch_number,
          batch.mfg_date,
          batch.expiry_date,
          transferQty,
          transferQty,
          batch.purchase_cost,
          batch.selling_price,
          batch.supplier_id
        );
        targetBatchId = Number(ins.lastInsertRowid);
      }

      const today = getTodayDate();
      const fromBranch = db.prepare('SELECT name FROM branches WHERE id = ?').get(Number(from_branch_id))?.name || 'Hub';
      const toBranch = db.prepare('SELECT name FROM branches WHERE id = ?').get(Number(to_branch_id))?.name || 'Branch';

      // Record in stock_movements as Transfer In and Transfer Out
      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id, to_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Transfer Out', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.product_id,
        batch.id,
        Number(from_branch_id),
        Number(to_branch_id),
        transferQty,
        `Transfer to ${toBranch}: ${reason || notes || 'Stock rebalance'}`,
        Number((transferQty * batch.purchase_cost).toFixed(2)),
        req.user.name,
        today
      );

      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id, to_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Transfer In', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.product_id,
        targetBatchId,
        Number(from_branch_id),
        Number(to_branch_id),
        transferQty,
        `Received from ${fromBranch}: ${reason || notes || 'Stock rebalance'}`,
        Number((transferQty * batch.purchase_cost).toFixed(2)),
        req.user.name,
        today
      );

      logAudit(req.user.id, req.user.name, req.user.role, 'TRANSFER_STOCK', 'BATCH', batch.id, `Transferred ${transferQty} ${batch.unit} of ${batch.product_name} from ${fromBranch} to ${toBranch}`, req.ip);

      res.json({
        success: true,
        message: `Successfully transferred ${transferQty} ${batch.unit} of ${batch.product_name} from ${fromBranch} to ${toBranch}.`,
        source_remaining: newSourceQty
      });
    } catch (err) {
      console.error('Error transferring stock:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Process Returns (Customer Returns to Stock or Supplier Return Outflows)
  app.post('/api/inventory/process-return', authenticateToken, requireRole(['Administrator', 'Manager', 'Shopkeeper']), (req, res) => {
    try {
      const {
        return_type, product_id, batch_id, quantity, invoice_ref,
        condition = 'Restockable', reason, notes
      } = req.body;

      if (!return_type || !product_id || !quantity || Number(quantity) <= 0 || !reason) {
        return res.status(400).json({ success: false, error: 'Return type, product, positive quantity and reason are required.' });
      }

      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id));
      if (!prod) return res.status(404).json({ success: false, error: 'Product not found.' });

      const returnQty = Number(quantity);
      const today = getTodayDate();

      if (return_type === 'Customer Return') {
        // Customer returning item
        if (condition === 'Restockable') {
          // Re-credit quantity back into active batch
          let targetBatch;
          if (batch_id) {
            targetBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id));
          }
          if (!targetBatch) {
            targetBatch = db.prepare('SELECT * FROM batches WHERE product_id = ? AND current_quantity > 0 ORDER BY expiry_date DESC LIMIT 1').get(prod.id);
          }

          if (targetBatch) {
            db.prepare('UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?')
              .run(returnQty, targetBatch.id);
          }

          db.prepare(`
            INSERT INTO stock_movements (
              movement_type, product_id, batch_id,
              quantity, reason, cost_impact, performed_by, movement_date
            ) VALUES ('Sale Return', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            prod.id,
            targetBatch ? targetBatch.id : null,
            returnQty,
            `Customer Return (${invoice_ref || 'Counter'}): ${reason}`,
            Number((returnQty * prod.purchase_price).toFixed(2)),
            req.user.name,
            today
          );

          logAudit(req.user.id, req.user.name, req.user.role, 'CUSTOMER_RETURN_RESTOCK', 'PRODUCT', prod.id, `Restocked customer return of ${returnQty} ${prod.unit} of ${prod.name}`, req.ip);

          return res.json({
            success: true,
            message: `Customer return of ${returnQty} ${prod.unit} Restocked to shelf.`
          });
        } else {
          // Customer returned defective/spoiled item -> Write-off
          const costLoss = Number((returnQty * prod.purchase_price).toFixed(2));
          db.prepare(`
            INSERT INTO waste_damaged (
              product_id, branch_id, quantity, unit_cost, total_loss_value,
              reason, action_taken, recorded_date, recorded_by
            ) VALUES (?, 1, ?, ?, ?, ?, 'Customer Return Discarded', ?, ?)
          `).run(
            prod.id,
            returnQty,
            prod.purchase_price,
            costLoss,
            `Customer Return: ${reason}`,
            today,
            req.user.name
          );

          db.prepare(`
            INSERT INTO stock_movements (
              movement_type, product_id,
              quantity, reason, cost_impact, performed_by, movement_date
            ) VALUES ('Damage', ?, ?, ?, ?, ?, ?)
          `).run(
            prod.id,
            returnQty,
            `Customer Return Defective: ${reason}`,
            costLoss,
            req.user.name,
            today
          );

          return res.json({
            success: true,
            message: `Customer return of ${returnQty} ${prod.unit} accepted as Defective/Damaged and written off. Financial loss: ₹${costLoss}.`
          });
        }
      } else {
        // Supplier Return (Outflow returning substandard/damaged stock to dairy farmer or supplier)
        if (!batch_id) {
          return res.status(400).json({ success: false, error: 'Batch ID is required for supplier returns.' });
        }
        const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id));
        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found.' });

        if (batch.current_quantity < returnQty) {
          return res.status(400).json({
            success: false,
            error: `Cannot return ${returnQty} units to supplier. Only ${batch.current_quantity} available in batch.`
          });
        }

        const newQty = batch.current_quantity - returnQty;
        db.prepare('UPDATE batches SET current_quantity = ? WHERE id = ?').run(newQty, batch.id);

        const returnVal = Number((returnQty * batch.purchase_cost).toFixed(2));

        db.prepare(`
          INSERT INTO stock_movements (
            movement_type, product_id, batch_id, from_branch_id,
            quantity, reason, cost_impact, performed_by, movement_date
          ) VALUES ('Supplier Return', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          prod.id,
          batch.id,
          batch.branch_id,
          returnQty,
          `Supplier Return (Debit Note / Ref: ${invoice_ref || 'None'}): ${reason}`,
          returnVal,
          req.user.name,
          today
        );

        logAudit(req.user.id, req.user.name, req.user.role, 'SUPPLIER_RETURN', 'BATCH', batch.id, `Returned ${returnQty} ${prod.unit} of ${prod.name} to supplier. Debit: ₹${returnVal}`, req.ip);

        return res.json({
          success: true,
          message: `Returned ${returnQty} ${prod.unit} of ${prod.name} back to supplier. Balance due credited: ₹${returnVal}.`,
          remaining_batch_qty: newQty
        });
      }
    } catch (err) {
      console.error('Error processing return:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. View Complete Stock Movement History
  app.get('/api/inventory/history', optionalAuth, (req, res) => {
    try {
      const {
        productId, batchId, movementType, branchId,
        startDate, endDate, search, page = 1, limit = 15
      } = req.query;

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const offset = (pageNum - 1) * limitNum;

      let query = `
        SELECT 
          sm.*,
          p.name as product_name,
          p.sku,
          p.unit,
          c.name as category_name,
          b.batch_number,
          fb.name as from_branch_name,
          tb.name as to_branch_name
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN batches b ON sm.batch_id = b.id
        LEFT JOIN branches fb ON sm.from_branch_id = fb.id
        LEFT JOIN branches tb ON sm.to_branch_id = tb.id
        WHERE 1=1
      `;
      const params = [];

      if (productId) {
        query += ' AND sm.product_id = ?';
        params.push(Number(productId));
      }
      if (batchId) {
        query += ' AND sm.batch_id = ?';
        params.push(Number(batchId));
      }
      if (movementType && movementType !== 'all') {
        query += ' AND sm.movement_type = ?';
        params.push(movementType);
      }
      if (branchId && branchId !== 'all') {
        query += ' AND (sm.from_branch_id = ? OR sm.to_branch_id = ?)';
        params.push(Number(branchId), Number(branchId));
      }
      if (startDate) {
        query += ' AND sm.movement_date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND sm.movement_date <= ?';
        params.push(endDate);
      }
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR b.batch_number LIKE ? OR sm.reason LIKE ? OR sm.performed_by LIKE ?)';
        params.push(term, term, term, term, term);
      }

      // Total count query
      const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
      const totalCount = db.prepare(countQuery).get(...params).total;

      query += ' ORDER BY sm.movement_date DESC, sm.id DESC LIMIT ? OFFSET ?';
      params.push(limitNum, offset);

      const items = db.prepare(query).all(...params);

      res.json({
        success: true,
        data: items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages: Math.ceil(totalCount / limitNum) || 1
        }
      });
    } catch (err) {
      console.error('Error fetching stock history:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 5.5: ALERTS & CONFIGURABLE THRESHOLDS
  // -------------------------------------------------------------
  app.get('/api/inventory/alerts', optionalAuth, (req, res) => {
    try {
      const today = getTodayDate();
      const now = new Date();

      // Read settings
      const warnSetting = db.prepare("SELECT value FROM settings WHERE key = 'alert_expiry_warning_days'").get();
      const critSetting = db.prepare("SELECT value FROM settings WHERE key = 'alert_expiry_critical_days'").get();
      const warnDays = warnSetting ? parseInt(warnSetting.value, 10) : 7;
      const critDays = critSetting ? parseInt(critSetting.value, 10) : 3;

      const warnDate = formatDate(addDays(now, warnDays));
      const critDate = formatDate(addDays(now, critDays));

      // 1. Low Stock Alerts
      const lowStockAlerts = db.prepare(`
        SELECT p.id, p.name, p.sku, p.unit, p.min_stock_level,
               COALESCE(SUM(b.current_quantity), 0) as current_stock,
               ROUND(COALESCE(SUM(b.current_quantity), 0) * p.purchase_price, 2) as valuation
        FROM products p
        LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
        WHERE p.is_active = 1
        GROUP BY p.id
        HAVING current_stock <= p.min_stock_level AND current_stock > 0
        ORDER BY current_stock ASC
      `).all();

      // 2. Out of Stock Alerts
      const outOfStockAlerts = db.prepare(`
        SELECT p.id, p.name, p.sku, p.unit, p.min_stock_level
        FROM products p
        LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
        WHERE p.is_active = 1
        GROUP BY p.id
        HAVING COALESCE(SUM(b.current_quantity), 0) = 0
        ORDER BY p.name ASC
      `).all();

      // 3. Expiring within Critical Days (<= 3 Days)
      const criticalExpiryAlerts = db.prepare(`
        SELECT b.id, b.batch_number, b.expiry_date, b.current_quantity,
               b.purchase_cost, p.name as product_name, p.unit, br.name as branch_name,
               ROUND(b.current_quantity * b.purchase_cost, 2) as loss_risk,
               CAST((julianday(b.expiry_date) - julianday('now')) AS INTEGER) as days_remaining
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date >= ? AND b.expiry_date <= ?
        ORDER BY b.expiry_date ASC
      `).all(today, critDate);

      // 4. Expiring within Warning Days (<= 7 Days, > 3 Days)
      const warningExpiryAlerts = db.prepare(`
        SELECT b.id, b.batch_number, b.expiry_date, b.current_quantity,
               b.purchase_cost, p.name as product_name, p.unit, br.name as branch_name,
               ROUND(b.current_quantity * b.purchase_cost, 2) as loss_risk,
               CAST((julianday(b.expiry_date) - julianday('now')) AS INTEGER) as days_remaining
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date > ? AND b.expiry_date <= ?
        ORDER BY b.expiry_date ASC
      `).all(critDate, warnDate);

      // 5. Expired Products on Shelf (< Today)
      const expiredAlerts = db.prepare(`
        SELECT b.id, b.batch_number, b.expiry_date, b.current_quantity,
               b.purchase_cost, p.name as product_name, p.unit, br.name as branch_name,
               ROUND(b.current_quantity * b.purchase_cost, 2) as loss_risk,
               CAST((julianday('now') - julianday(b.expiry_date)) AS INTEGER) as days_overdue
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN branches br ON b.branch_id = br.id
        WHERE b.current_quantity > 0 AND b.expiry_date < ?
        ORDER BY b.expiry_date ASC
      `).all(today);

      // 6. Recent Unusual Adjustments
      const unusualAdjustments = db.prepare(`
        SELECT sm.*, p.name as product_name, p.unit, b.batch_number
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN batches b ON sm.batch_id = b.id
        WHERE sm.movement_type = 'Adjustment' AND (ABS(sm.quantity) >= 25 OR ABS(sm.cost_impact) >= 1000)
        ORDER BY sm.id DESC
        LIMIT 10
      `).all();

      res.json({
        success: true,
        data: {
          low_stock: lowStockAlerts,
          out_of_stock: outOfStockAlerts,
          critical_expiry_3d: criticalExpiryAlerts,
          warning_expiry_7d: warningExpiryAlerts,
          expired_on_shelf: expiredAlerts,
          unusual_adjustments: unusualAdjustments,
          thresholds: {
            warning_days: warnDays,
            critical_days: critDays
          }
        }
      });
    } catch (err) {
      console.error('Error fetching inventory alerts:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Alert Settings: Get and Update
  app.get('/api/inventory/alert-settings', (req, res) => {
    try {
      const settings = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'alert_%'").all();
      const map = {};
      settings.forEach(s => { map[s.key] = s.value; });
      res.json({ success: true, data: map });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/inventory/alert-settings', authenticateToken, requireRole(['Administrator']), (req, res) => {
    try {
      const {
        alert_expiry_warning_days = '7',
        alert_expiry_critical_days = '3',
        alert_unusual_adjustment_qty = '25',
        alert_unusual_adjustment_cost = '1000'
      } = req.body;

      const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      upsert.run('alert_expiry_warning_days', String(alert_expiry_warning_days));
      upsert.run('alert_expiry_critical_days', String(alert_expiry_critical_days));
      upsert.run('alert_unusual_adjustment_qty', String(alert_unusual_adjustment_qty));
      upsert.run('alert_unusual_adjustment_cost', String(alert_unusual_adjustment_cost));

      logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE_ALERT_SETTINGS', 'SETTINGS', 'INVENTORY', 'Updated inventory alert thresholds', req.ip);
      res.json({ success: true, message: 'Alert threshold settings updated!' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
};
