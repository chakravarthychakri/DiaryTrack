// ====================================================================
// MODULE 8: STOCK MOVEMENT MANAGEMENT API ROUTES & AUDIT TRAIL
// ====================================================================

const {
  db,
  formatDate,
  addDays,
  logAudit
} = require('./db');
const { generateMovementsReport } = require('./reports');

function getTodayDate() {
  return formatDate(new Date());
}

// Canonical Movement Types Defined by Module 8 Specification
const MOVEMENT_TYPES = {
  INCOMING: [
    { type: 'Opening Stock', label: 'Opening Stock Baseline', icon: '🏁', description: 'Initial stock intake when configuring inventory' },
    { type: 'Purchase Received', label: 'Purchase Received (PO)', icon: '📥', description: 'Stock arrived from dairy farmers or commercial co-ops' },
    { type: 'Customer Return', label: 'Customer Return (Sale Return)', icon: '↩️', description: 'Products returned by retail or wholesale buyers' },
    { type: 'Transfer In', label: 'Transfer In (From Branch)', icon: '🚛', description: 'Stock received from another shop or central cold room' },
    { type: 'Authorized Stock Correction', label: 'Authorized Stock Correction (Surplus)', icon: '➕', description: 'Auditable positive adjustment following physical stock audit' }
  ],
  OUTGOING: [
    { type: 'Sales', label: 'Sales (POS Checkout)', icon: '🛒', description: 'Stock sold through Point of Sale cashier billing' },
    { type: 'Supplier Return', label: 'Supplier Return (Vendor Return)', icon: '📦', description: 'Defective or sour goods returned back to the dairy supplier' },
    { type: 'Transfer Out', label: 'Transfer Out (To Branch)', icon: '🚚', description: 'Stock dispatched to another shop or retail counter' },
    { type: 'Expired Stock', label: 'Expired Stock Discard', icon: '⏰', description: 'Perishable products past shelf life quarantined & written off' },
    { type: 'Damaged Stock', label: 'Damaged Stock Write-off', icon: '💥', description: 'Leaking pouches, broken tubs, or cold-chain damaged inventory' },
    { type: 'Wastage', label: 'Wastage (Evaporation / Spillage)', icon: '🗑️', description: 'Boiling, processing, or dispensing dairy volume loss' },
    { type: 'Other Authorized Adjustment', label: 'Other Authorized Adjustment (Shortage)', icon: '➖', description: 'Auditable negative adjustment following physical count deficit' }
  ]
};

const INCOMING_NAMES = MOVEMENT_TYPES.INCOMING.map(m => m.type).concat(['Purchase', 'Sale Return']);
const OUTGOING_NAMES = MOVEMENT_TYPES.OUTGOING.map(m => m.type).concat(['Sale', 'Return to Supplier', 'Expired', 'Damage', 'Damage / Spoilage']);

// Helper to record an immutable stock movement
function recordStockMovement(dbInstance, {
  movement_type,
  product_id,
  batch_id = null,
  from_branch_id = null,
  to_branch_id = null,
  quantity,
  reason = '',
  cost_impact = 0,
  performed_by = 'Administrator',
  movement_date = null,
  reference_txn = null,
  correction_of_id = null,
  flow_type = null,
  previous_stock = null,
  updated_stock = null
}) {
  const prod = dbInstance.prepare('SELECT id, name, unit, purchase_price FROM products WHERE id = ?').get(Number(product_id));
  const unit = prod ? prod.unit : 'Units';

  const isIncoming = INCOMING_NAMES.includes(movement_type);
  const flow = flow_type || (isIncoming ? 'Inflow' : 'Outflow');

  let prev = previous_stock;
  let updated = updated_stock;

  if (prev === null || updated === null) {
    const onHand = dbInstance.prepare('SELECT COALESCE(SUM(current_quantity), 0) as stock FROM batches WHERE product_id = ? AND current_quantity > 0').get(Number(product_id));
    const currentOnHand = Number(onHand ? onHand.stock : 0);

    if (flow === 'Inflow') {
      prev = Math.max(0, currentOnHand - Number(quantity));
      updated = currentOnHand;
    } else {
      prev = currentOnHand + Number(quantity);
      updated = currentOnHand;
    }
  }

  const date = movement_date || getTodayDate();
  const ref = reference_txn || `MOV-${Date.now().toString().slice(-6)}`;

  const res = dbInstance.prepare(`
    INSERT INTO stock_movements (
      movement_type, product_id, batch_id, from_branch_id, to_branch_id,
      quantity, unit, previous_stock, updated_stock, flow_type,
      reference_txn, reason, cost_impact, performed_by, correction_of_id,
      movement_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    movement_type,
    Number(product_id),
    batch_id ? Number(batch_id) : null,
    from_branch_id ? Number(from_branch_id) : null,
    to_branch_id ? Number(to_branch_id) : null,
    Number(quantity),
    unit,
    Number(prev),
    Number(updated),
    flow,
    ref,
    reason || '',
    Number(cost_impact),
    performed_by || 'Administrator',
    correction_of_id ? Number(correction_of_id) : null,
    date
  );

  return Number(res.lastInsertRowid);
}

module.exports = function registerMovementsRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // -------------------------------------------------------------
  // 8.1: MOVEMENT TYPES METADATA
  // -------------------------------------------------------------
  app.get('/api/movements/types', optionalAuth, (req, res) => {
    res.json({
      success: true,
      data: MOVEMENT_TYPES
    });
  });

  // -------------------------------------------------------------
  // 8.2: MOVEMENT SUMMARY STATS
  // -------------------------------------------------------------
  app.get('/api/movements/stats', optionalAuth, (req, res) => {
    try {
      const { branchId, productId, startDate, endDate } = req.query;
      const today = getTodayDate();

      let whereClause = '1=1';
      const params = [];

      if (branchId && branchId !== 'all') {
        whereClause += ' AND (sm.from_branch_id = ? OR sm.to_branch_id = ?)';
        params.push(Number(branchId), Number(branchId));
      }

      if (productId && productId !== 'all') {
        whereClause += ' AND sm.product_id = ?';
        params.push(Number(productId));
      }

      if (startDate) {
        whereClause += ' AND sm.movement_date >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND sm.movement_date <= ?';
        params.push(endDate);
      }

      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_movements,
          SUM(CASE WHEN sm.flow_type = 'Inflow' THEN 1 ELSE 0 END) as incoming_count,
          SUM(CASE WHEN sm.flow_type = 'Outflow' THEN 1 ELSE 0 END) as outgoing_count,
          ROUND(COALESCE(SUM(CASE WHEN sm.flow_type = 'Inflow' THEN sm.quantity ELSE 0 END), 0), 2) as total_inflow_units,
          ROUND(COALESCE(SUM(CASE WHEN sm.flow_type = 'Outflow' THEN sm.quantity ELSE 0 END), 0), 2) as total_outflow_units,
          ROUND(COALESCE(SUM(sm.cost_impact), 0), 2) as total_financial_impact,
          SUM(CASE WHEN sm.movement_date = ? THEN 1 ELSE 0 END) as today_movements_count
        FROM stock_movements sm
        WHERE ${whereClause}
      `).get(...params, today);

      const netUnits = Number((stats.total_inflow_units - stats.total_outflow_units).toFixed(2));

      res.json({
        success: true,
        data: {
          total_movements: Number(stats.total_movements || 0),
          incoming_count: Number(stats.incoming_count || 0),
          outgoing_count: Number(stats.outgoing_count || 0),
          total_inflow_units: Number(stats.total_inflow_units || 0),
          total_outflow_units: Number(stats.total_outflow_units || 0),
          net_units_delta: netUnits,
          total_financial_impact: Number(stats.total_financial_impact || 0),
          today_movements_count: Number(stats.today_movements_count || 0)
        }
      });
    } catch (err) {
      console.error('Error fetching movement stats:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 8.3: LIST STOCK MOVEMENTS WITH COMPREHENSIVE FILTERING & PAGINATION
  // -------------------------------------------------------------
  app.get('/api/movements', optionalAuth, (req, res) => {
    try {
      const {
        search,
        flow, // 'all', 'inflow', 'outflow'
        movement_type,
        product_id,
        batch_id,
        branch_id,
        startDate,
        endDate,
        page = 1,
        limit = 30
      } = req.query;

      let whereClauses = ['1=1'];
      const params = [];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        whereClauses.push('(p.name LIKE ? OR p.sku LIKE ? OR sm.reason LIKE ? OR sm.reference_txn LIKE ? OR sm.performed_by LIKE ?)');
        params.push(term, term, term, term, term);
      }

      if (flow && flow !== 'all') {
        whereClauses.push('LOWER(sm.flow_type) = LOWER(?)');
        params.push(flow);
      }

      if (movement_type && movement_type !== 'all') {
        whereClauses.push('sm.movement_type = ?');
        params.push(movement_type);
      }

      if (product_id && product_id !== 'all') {
        whereClauses.push('sm.product_id = ?');
        params.push(Number(product_id));
      }

      if (batch_id && batch_id !== 'all') {
        whereClauses.push('sm.batch_id = ?');
        params.push(Number(batch_id));
      }

      if (branch_id && branch_id !== 'all') {
        whereClauses.push('(sm.from_branch_id = ? OR sm.to_branch_id = ?)');
        params.push(Number(branch_id), Number(branch_id));
      }

      if (startDate) {
        whereClauses.push('sm.movement_date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereClauses.push('sm.movement_date <= ?');
        params.push(endDate);
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count query
      const countRow = db.prepare(`
        SELECT COUNT(*) as total
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        WHERE ${whereSql}
      `).get(...params);

      const total = countRow ? countRow.total : 0;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 30));
      const offset = (pageNum - 1) * limitNum;

      // Data query with complete relational context
      const query = `
        SELECT 
          sm.*,
          p.name as product_name,
          p.sku as product_sku,
          COALESCE(sm.unit, p.unit) as display_unit,
          p.selling_price as current_selling_price,
          b.batch_number,
          b.expiry_date as batch_expiry_date,
          fb.name as from_branch_name,
          tb.name as to_branch_name,
          corr.reference_txn as original_movement_ref
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN batches b ON sm.batch_id = b.id
        LEFT JOIN branches fb ON sm.from_branch_id = fb.id
        LEFT JOIN branches tb ON sm.to_branch_id = tb.id
        LEFT JOIN stock_movements corr ON sm.correction_of_id = corr.id
        WHERE ${whereSql}
        ORDER BY sm.id DESC
        LIMIT ? OFFSET ?
      `;

      const movements = db.prepare(query).all(...params, limitNum, offset);

      res.json({
        success: true,
        data: movements,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      });
    } catch (err) {
      console.error('Error fetching stock movements:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 8.4: GET SINGLE MOVEMENT DETAILS WITH AUDIT VOUCHER
  // -------------------------------------------------------------
  app.get('/api/movements/:id', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Valid movement ID is required.' });
      }

      const movement = db.prepare(`
        SELECT 
          sm.*,
          p.name as product_name,
          p.sku as product_sku,
          p.category_id,
          cat.name as category_name,
          COALESCE(sm.unit, p.unit) as display_unit,
          p.purchase_price,
          p.selling_price,
          b.batch_number,
          b.mfg_date as batch_mfg_date,
          b.expiry_date as batch_expiry_date,
          b.current_quantity as batch_current_quantity,
          b.status as batch_status,
          fb.name as from_branch_name,
          tb.name as to_branch_name,
          orig.id as original_id,
          orig.reference_txn as original_ref,
          orig.movement_type as original_type,
          orig.reason as original_reason
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN categories cat ON p.category_id = cat.id
        LEFT JOIN batches b ON sm.batch_id = b.id
        LEFT JOIN branches fb ON sm.from_branch_id = fb.id
        LEFT JOIN branches tb ON sm.to_branch_id = tb.id
        LEFT JOIN stock_movements orig ON sm.correction_of_id = orig.id
        WHERE sm.id = ?
      `).get(id);

      if (!movement) {
        return res.status(404).json({ success: false, error: 'Stock movement record not found.' });
      }

      // Check if this movement has any subsequent corrections
      const corrections = db.prepare(`
        SELECT id, movement_type, quantity, reason, reference_txn, performed_by, created_at
        FROM stock_movements
        WHERE correction_of_id = ?
        ORDER BY id DESC
      `).all(id);

      res.json({
        success: true,
        data: {
          ...movement,
          corrections
        }
      });
    } catch (err) {
      console.error('Error fetching movement details:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 8.5: CREATE MANUAL MOVEMENT (TRANSFERS, DAMAGES, RETURNS)
  // -------------------------------------------------------------
  app.post('/api/movements', optionalAuth, (req, res) => {
    try {
      const {
        movement_type,
        product_id,
        batch_id,
        from_branch_id,
        to_branch_id,
        quantity,
        reason,
        reference_txn,
        performed_by
      } = req.body;

      const qty = Number(quantity);
      if (!product_id || !qty || qty <= 0) {
        return res.status(400).json({ success: false, error: 'Product and a valid quantity (> 0) are required.' });
      }

      if (!movement_type) {
        return res.status(400).json({ success: false, error: 'Movement type is required.' });
      }

      const prod = db.prepare('SELECT id, name, unit, purchase_price FROM products WHERE id = ?').get(Number(product_id));
      if (!prod) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      const actor = req.user ? req.user.name : (performed_by || 'Staff');
      const unitCost = prod.purchase_price || 0;
      const totalCost = qty * unitCost;

      // Start atomic transaction
      db.exec('BEGIN');

      try {
        let batchId = batch_id ? Number(batch_id) : null;
        let fromBranch = from_branch_id ? Number(from_branch_id) : 1;
        let toBranch = to_branch_id ? Number(to_branch_id) : null;
        let flowType = 'Outflow';
        let recordedRef = reference_txn || `MOV-${Date.now().toString().slice(-6)}`;

        // Branch Transfer logic
        if (movement_type === 'Transfer' || movement_type === 'Transfer Out') {
          if (!from_branch_id || !to_branch_id || from_branch_id === to_branch_id) {
            db.exec('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Transfer requires different source and destination branches.' });
          }

          if (batchId) {
            const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
            if (!batch || batch.current_quantity < qty) {
              db.exec('ROLLBACK');
              return res.status(400).json({ success: false, error: `Insufficient quantity in Batch #${batch?.batch_number || batchId}. Only ${batch?.current_quantity || 0} units available.` });
            }

            // Deduct from source batch
            db.prepare('UPDATE batches SET current_quantity = current_quantity - ? WHERE id = ?').run(qty, batchId);

            // Create transferred batch in destination branch
            const destBatch = db.prepare(`
              INSERT INTO batches (
                product_id, branch_id, batch_number, mfg_date, expiry_date,
                initial_quantity, current_quantity, purchase_cost, selling_price, status, supplier_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
            `).run(
              batch.product_id,
              toBranch,
              `${batch.batch_number}-TRF`,
              batch.mfg_date,
              batch.expiry_date,
              qty,
              qty,
              batch.purchase_cost,
              batch.selling_price,
              batch.supplier_id
            );

            // Record Transfer Out Movement
            const movOutId = recordStockMovement(db, {
              movement_type: 'Transfer Out',
              product_id: prod.id,
              batch_id: batchId,
              from_branch_id: fromBranch,
              to_branch_id: toBranch,
              quantity: qty,
              reason: reason || 'Inter-branch dispatch',
              cost_impact: -totalCost,
              performed_by: actor,
              reference_txn: recordedRef,
              flow_type: 'Outflow'
            });

            // Record Transfer In Movement
            recordStockMovement(db, {
              movement_type: 'Transfer In',
              product_id: prod.id,
              batch_id: Number(destBatch.lastInsertRowid),
              from_branch_id: fromBranch,
              to_branch_id: toBranch,
              quantity: qty,
              reason: reason || 'Inter-branch reception',
              cost_impact: totalCost,
              performed_by: actor,
              reference_txn: recordedRef,
              flow_type: 'Inflow',
              correction_of_id: movOutId
            });

            db.exec('COMMIT');
            return res.json({ success: true, message: `Transferred ${qty} ${prod.unit} of ${prod.name} successfully!` });
          }
        }

        // Damage / Spoilage / Wastage
        else if (['Damage', 'Damaged Stock', 'Damage / Spoilage', 'Wastage', 'Expired Stock', 'Expired'].includes(movement_type)) {
          if (batchId) {
            const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
            if (batch && batch.current_quantity < qty) {
              db.exec('ROLLBACK');
              return res.status(400).json({ success: false, error: `Cannot write off ${qty} units: Batch #${batch.batch_number} has only ${batch.current_quantity} units available.` });
            }
            db.prepare('UPDATE batches SET current_quantity = MAX(0, current_quantity - ?) WHERE id = ?').run(qty, batchId);
          }

          db.prepare(`
            INSERT INTO waste_damaged (
              product_id, batch_id, branch_id, quantity, unit_cost, total_loss_value,
              reason, action_taken, recorded_date, recorded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Discarded', ?, ?)
          `).run(
            prod.id,
            batchId,
            fromBranch,
            qty,
            unitCost,
            totalCost,
            reason || 'Recorded waste/damage',
            getTodayDate(),
            actor
          );

          flowType = 'Outflow';
        }

        // Return to Supplier
        else if (['Return to Supplier', 'Supplier Return'].includes(movement_type)) {
          if (batchId) {
            db.prepare('UPDATE batches SET current_quantity = MAX(0, current_quantity - ?) WHERE id = ?').run(qty, batchId);
          }
          flowType = 'Outflow';
        }

        // Customer Return
        else if (['Customer Return', 'Sale Return'].includes(movement_type)) {
          if (batchId) {
            db.prepare('UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?').run(qty, batchId);
          }
          flowType = 'Inflow';
        }

        const movId = recordStockMovement(db, {
          movement_type,
          product_id: prod.id,
          batch_id: batchId,
          from_branch_id: fromBranch,
          to_branch_id: toBranch,
          quantity: qty,
          reason: reason || '',
          cost_impact: flowType === 'Inflow' ? totalCost : -totalCost,
          performed_by: actor,
          reference_txn: recordedRef,
          flow_type: flowType
        });

        db.exec('COMMIT');

        logAudit(
          req.user ? req.user.id : null,
          actor,
          req.user ? req.user.role : 'Staff',
          'RECORD_STOCK_MOVEMENT',
          'STOCK_MOVEMENT',
          movId,
          `Recorded ${movement_type} of ${qty} ${prod.unit} for ${prod.name}`,
          req.ip
        );

        res.json({
          success: true,
          id: movId,
          message: `Stock movement (${movement_type}) recorded successfully!`
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('Error creating stock movement:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 8.6: AUDITABLE STOCK CORRECTION (MANDATORY MODULE 8 RULE)
  // "Do not allow users to modify historical movements without recording an auditable correction."
  // -------------------------------------------------------------
  app.post('/api/movements/correction', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const {
        movement_id,
        product_id,
        batch_id,
        correction_type, // 'Surplus Correction (Inflow)' or 'Shortage Correction (Outflow)'
        quantity,
        reason,
        reference_txn
      } = req.body;

      const qty = Number(quantity);
      if (!product_id || !batch_id || !qty || qty <= 0) {
        return res.status(400).json({ success: false, error: 'Product, Batch, and a positive correction quantity are required.' });
      }

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: 'A mandatory auditable reason/justification (minimum 5 characters) is required to record a stock correction.'
        });
      }

      const prod = db.prepare('SELECT id, name, unit, purchase_price FROM products WHERE id = ?').get(Number(product_id));
      if (!prod) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id));
      if (!batch) {
        return res.status(404).json({ success: false, error: 'Specified batch not found.' });
      }

      const isSurplus = (correction_type === 'Surplus Correction (Inflow)' || correction_type === 'Inflow' || correction_type === 'Surplus');
      const movementType = isSurplus ? 'Authorized Stock Correction' : 'Other Authorized Adjustment';
      const flowType = isSurplus ? 'Inflow' : 'Outflow';
      const refCode = reference_txn && reference_txn.trim() ? reference_txn.trim() : `CORR-${Date.now().toString().slice(-6)}`;
      const costImpact = isSurplus ? (qty * batch.purchase_cost) : -(qty * batch.purchase_cost);

      db.exec('BEGIN');

      try {
        if (!isSurplus) {
          if (batch.current_quantity < qty) {
            db.exec('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: `Cannot apply negative correction of ${qty} units: Batch #${batch.batch_number} has only ${batch.current_quantity} ${prod.unit} available.`
            });
          }
          // Deduct from batch
          db.prepare('UPDATE batches SET current_quantity = current_quantity - ? WHERE id = ?').run(qty, batch.id);
        } else {
          // Add to batch
          db.prepare('UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?').run(qty, batch.id);
        }

        const corrId = recordStockMovement(db, {
          movement_type: movementType,
          product_id: prod.id,
          batch_id: batch.id,
          from_branch_id: batch.branch_id,
          to_branch_id: batch.branch_id,
          quantity: qty,
          reason: `[Correction Authorization] ${reason.trim()}`,
          cost_impact: costImpact,
          performed_by: `${req.user.name} (${req.user.role})`,
          reference_txn: refCode,
          flow_type: flowType,
          correction_of_id: movement_id ? Number(movement_id) : null
        });

        db.exec('COMMIT');

        logAudit(
          req.user.id,
          req.user.name,
          req.user.role,
          'AUDITABLE_STOCK_CORRECTION',
          'STOCK_MOVEMENT',
          corrId,
          `Authorized ${movementType} of ${qty} ${prod.unit} on Batch #${batch.batch_number} for ${prod.name}. Justification: ${reason.trim()}`,
          req.ip
        );

        res.json({
          success: true,
          id: corrId,
          reference_txn: refCode,
          message: `Auditable stock correction ${refCode} successfully applied and recorded.`
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('Error recording stock correction:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 8.7: STRICT IMMUTABILITY GUARDS (PREVENT EDIT/DELETE OF HISTORICAL MOVEMENTS)
  // -------------------------------------------------------------
  app.put('/api/movements/:id', authenticateToken, (req, res) => {
    logAudit(
      req.user ? req.user.id : null,
      req.user ? req.user.name : 'Unknown',
      req.user ? req.user.role : 'Staff',
      'BLOCKED_HISTORICAL_MOVEMENT_EDIT_ATTEMPT',
      'STOCK_MOVEMENT',
      req.params.id,
      'Attempted direct modification of immutable stock movement record',
      req.ip
    );

    return res.status(403).json({
      success: false,
      error: "Direct alteration of historical stock movement records is strictly prohibited by DairyTrack audit rules. To adjust inventory counts, please record an 'Authorized Stock Correction' with formal justification."
    });
  });

  app.delete('/api/movements/:id', authenticateToken, (req, res) => {
    logAudit(
      req.user ? req.user.id : null,
      req.user ? req.user.name : 'Unknown',
      req.user ? req.user.role : 'Staff',
      'BLOCKED_HISTORICAL_MOVEMENT_DELETE_ATTEMPT',
      'STOCK_MOVEMENT',
      req.params.id,
      'Attempted deletion of immutable stock movement record',
      req.ip
    );

    return res.status(403).json({
      success: false,
      error: "Stock movement entries are permanent auditable ledger records and cannot be deleted."
    });
  });

  // -------------------------------------------------------------
  // 8.8: EXCEL EXPORT ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/movements/export', optionalAuth, (req, res) => {
    try {
      const buffer = generateMovementsReport(req.query);
      const filename = `DairyTrack_Stock_Movements_${getTodayDate()}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      console.error('Error exporting movements report:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

};

module.exports.recordStockMovement = recordStockMovement;
