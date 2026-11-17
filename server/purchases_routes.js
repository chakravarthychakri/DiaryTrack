// ====================================================================
// MODULE 7: PURCHASES AND PROCUREMENT API ROUTES
// ====================================================================

const {
  db,
  formatDate,
  addDays,
  logAudit
} = require('./db');
const { emitNotification } = require('./notification_routes');

function getTodayDate() {
  return formatDate(new Date());
}

module.exports = function registerPurchasesRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // -------------------------------------------------------------
  // 7.0: PROCUREMENT KPI STATISTICS & SUMMARY
  // -------------------------------------------------------------
  app.get('/api/purchases/stats', optionalAuth, (req, res) => {
    try {
      const { branchId } = req.query;
      const branchFilter = branchId && branchId !== 'all' ? Number(branchId) : null;

      // 1. Total Spend on Received Purchases
      let spendQuery = `
        SELECT 
          COALESCE(SUM(net_amount), 0) as total_spend,
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'Received' THEN 1 ELSE 0 END) as received_orders,
          SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft_orders,
          SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM purchases
        WHERE 1=1
      `;
      const spendParams = [];
      if (branchFilter) {
        spendQuery += ' AND branch_id = ?';
        spendParams.push(branchFilter);
      }
      const orderStats = db.prepare(spendQuery).get(...spendParams);

      // Spend last 30 days
      const thirtyDaysAgo = formatDate(addDays(new Date(), -30));
      let recentSpendQuery = `
        SELECT COALESCE(SUM(net_amount), 0) as spend_30d
        FROM purchases
        WHERE status = 'Received' AND purchase_date >= ?
      `;
      const recentSpendParams = [thirtyDaysAgo];
      if (branchFilter) {
        recentSpendQuery += ' AND branch_id = ?';
        recentSpendParams.push(branchFilter);
      }
      const recentSpend = db.prepare(recentSpendQuery).get(...recentSpendParams);

      // 2. Outstanding Supplier Payables
      const payables = db.prepare('SELECT COALESCE(SUM(balance_due), 0) as total_payables, COUNT(*) as supplier_count FROM suppliers').get();

      // 3. Total Supplier Returns Cost
      const returnStats = db.prepare('SELECT COALESCE(SUM(total_return_value), 0) as total_returned_val, COUNT(*) as return_count FROM supplier_returns').get();

      res.json({
        success: true,
        data: {
          total_procurement_spend: Number(orderStats.total_spend || 0),
          total_orders: Number(orderStats.total_orders || 0),
          received_orders: Number(orderStats.received_orders || 0),
          draft_orders: Number(orderStats.draft_orders || 0),
          cancelled_orders: Number(orderStats.cancelled_orders || 0),
          spend_last_30_days: Number(recentSpend ? recentSpend.spend_30d : 0),
          total_supplier_payables: Number(payables ? payables.total_payables : 0),
          total_supplier_returns_value: Number(returnStats ? returnStats.total_returned_val : 0),
          total_supplier_returns_count: Number(returnStats ? returnStats.return_count : 0)
        }
      });
    } catch (err) {
      console.error('Error fetching purchase stats:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7.2: LIST PURCHASES WITH COMPREHENSIVE FILTERING & PAGINATION
  // -------------------------------------------------------------
  app.get('/api/purchases', optionalAuth, (req, res) => {
    try {
      const {
        search,
        status,
        payment_status,
        supplier_id,
        branch_id,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      let whereClauses = ['1=1'];
      const params = [];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        whereClauses.push('(p.invoice_no LIKE ? OR s.name LIKE ? OR p.notes LIKE ?)');
        params.push(term, term, term);
      }

      if (status && status !== 'all') {
        whereClauses.push('p.status = ?');
        params.push(status);
      }

      if (payment_status && payment_status !== 'all') {
        whereClauses.push('p.payment_status = ?');
        params.push(payment_status);
      }

      if (supplier_id && supplier_id !== 'all') {
        whereClauses.push('p.supplier_id = ?');
        params.push(Number(supplier_id));
      }

      if (branch_id && branch_id !== 'all') {
        whereClauses.push('p.branch_id = ?');
        params.push(Number(branch_id));
      }

      if (startDate) {
        whereClauses.push('p.purchase_date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereClauses.push('p.purchase_date <= ?');
        params.push(endDate);
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count query
      const countRow = db.prepare(`
        SELECT COUNT(DISTINCT p.id) as total
        FROM purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        WHERE ${whereSql}
      `).get(...params);

      const total = countRow ? countRow.total : 0;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      // Data query
      const query = `
        SELECT 
          p.*,
          s.name as supplier_name,
          s.phone as supplier_phone,
          s.contact_person as supplier_contact,
          s.balance_due as supplier_balance_due,
          br.name as branch_name,
          COUNT(pi.id) as item_count,
          COALESCE(SUM(pi.quantity), 0) as total_quantity
        FROM purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        JOIN branches br ON p.branch_id = br.id
        LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
        WHERE ${whereSql}
        GROUP BY p.id
        ORDER BY p.purchase_date DESC, p.id DESC
        LIMIT ? OFFSET ?
      `;

      const purchases = db.prepare(query).all(...params, limitNum, offset);

      res.json({
        success: true,
        data: purchases,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      });
    } catch (err) {
      console.error('Error listing purchases:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7.2: GET SINGLE PURCHASE ORDER DETAILS WITH LINE ITEMS & BATCHES
  // -------------------------------------------------------------
  app.get('/api/purchases/:id', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Valid purchase ID is required.' });
      }

      const purchase = db.prepare(`
        SELECT 
          p.*,
          s.name as supplier_name,
          s.contact_person as supplier_contact,
          s.phone as supplier_phone,
          s.email as supplier_email,
          s.address as supplier_address,
          s.gst_number as supplier_gst,
          s.balance_due as supplier_balance_due,
          br.name as branch_name,
          br.address as branch_address
        FROM purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        JOIN branches br ON p.branch_id = br.id
        WHERE p.id = ?
      `).get(id);

      if (!purchase) {
        return res.status(404).json({ success: false, error: 'Purchase record not found.' });
      }

      // Line items with product details and batch links
      const items = db.prepare(`
        SELECT 
          pi.*,
          prod.name as product_name,
          prod.sku as product_sku,
          prod.unit as product_unit,
          prod.selling_price as current_selling_price,
          b.batch_number as live_batch_number,
          b.current_quantity as batch_current_quantity,
          b.status as batch_status
        FROM purchase_items pi
        JOIN products prod ON pi.product_id = prod.id
        LEFT JOIN batches b ON pi.batch_id = b.id
        WHERE pi.purchase_id = ?
        ORDER BY pi.id ASC
      `).all(id);

      // Returns recorded against this purchase
      const returns = db.prepare(`
        SELECT 
          sr.*,
          prod.name as product_name,
          prod.unit as product_unit,
          b.batch_number
        FROM supplier_returns sr
        JOIN products prod ON sr.product_id = prod.id
        LEFT JOIN batches b ON sr.batch_id = b.id
        WHERE sr.purchase_id = ?
        ORDER BY sr.id DESC
      `).all(id);

      res.json({
        success: true,
        data: {
          ...purchase,
          items,
          returns
        }
      });
    } catch (err) {
      console.error('Error fetching purchase details:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7.1 & 7.3: CREATE PURCHASE (DRAFT OR RECEIVED)
  // -------------------------------------------------------------
  app.post('/api/purchases', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const {
        supplier_id,
        branch_id,
        purchase_date,
        invoice_no,
        items,
        tax_amount = 0,
        discount_amount = 0,
        payment_status = 'Paid',
        payment_method = 'Bank Transfer',
        status = 'Draft', // 'Draft' or 'Received'
        notes = ''
      } = req.body;

      if (!supplier_id) {
        return res.status(400).json({ success: false, error: 'Supplier is required.' });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one valid line item is required.' });
      }

      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(supplier_id));
      if (!supplier) {
        return res.status(400).json({ success: false, error: 'Selected supplier does not exist.' });
      }

      const branchId = Number(branch_id) || 1;
      const pDate = purchase_date || getTodayDate();
      const orderStatus = (status === 'Received') ? 'Received' : 'Draft';
      const invNo = invoice_no && invoice_no.trim() ? invoice_no.trim() : `PO-${Date.now().toString().slice(-6)}`;

      // Calculate totals
      let totalAmount = 0;
      for (const item of items) {
        const qty = Number(item.quantity);
        const cost = Number(item.unit_cost);
        if (!item.product_id || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
          return res.status(400).json({ success: false, error: 'Each item must have a valid product, quantity > 0, and cost >= 0.' });
        }
        totalAmount += qty * cost;
      }

      const tax = Math.max(0, Number(tax_amount) || 0);
      const discount = Math.max(0, Number(discount_amount) || 0);
      const netAmount = Math.max(0, totalAmount + tax - discount);

      // Start atomic transaction
      db.exec('BEGIN');

      try {
        const isReceived = (orderStatus === 'Received');
        const receivedAt = isReceived ? new Date().toISOString() : null;
        const receivedBy = isReceived ? req.user.name : null;

        const purchaseRes = db.prepare(`
          INSERT INTO purchases (
            invoice_no, supplier_id, branch_id, purchase_date, total_amount,
            tax_amount, discount_amount, net_amount, payment_status, payment_method,
            status, received_at, received_by, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          invNo,
          Number(supplier_id),
          branchId,
          pDate,
          totalAmount,
          tax,
          discount,
          netAmount,
          payment_status,
          payment_method,
          orderStatus,
          receivedAt,
          receivedBy,
          notes || '',
          req.user.name
        );

        const purchaseId = Number(purchaseRes.lastInsertRowid);

        const insertPurchaseItem = db.prepare(`
          INSERT INTO purchase_items (
            purchase_id, product_id, batch_id, batch_number, mfg_date, expiry_date, quantity, unit_cost, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertBatch = db.prepare(`
          INSERT INTO batches (
            product_id, branch_id, batch_number, mfg_date, expiry_date,
            initial_quantity, current_quantity, purchase_cost, selling_price, status, supplier_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        `);

        const insertMovement = db.prepare(`
          INSERT INTO stock_movements (
            movement_type, product_id, batch_id, to_branch_id, quantity,
            reason, cost_impact, performed_by, movement_date
          ) VALUES ('Purchase Received', ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const updateProdPrice = db.prepare('UPDATE products SET purchase_price = ? WHERE id = ?');

        for (const it of items) {
          const prodId = Number(it.product_id);
          const qty = Number(it.quantity);
          const cost = Number(it.unit_cost);
          const lineTotal = qty * cost;
          const bNum = it.batch_number && it.batch_number.trim() ? it.batch_number.trim() : `BAT-${Date.now().toString().slice(-4)}-${prodId}`;
          const mDate = it.mfg_date || pDate;
          const eDate = it.expiry_date || formatDate(addDays(new Date(pDate), 4));

          let batchId = null;

          // CRITICAL CONSTRAINT: Only create batches, stock movements, and update stock IF Received!
          if (isReceived) {
            const prod = db.prepare('SELECT selling_price FROM products WHERE id = ?').get(prodId);
            const sPrice = prod ? prod.selling_price : cost * 1.25;

            const bRes = insertBatch.run(
              prodId,
              branchId,
              bNum,
              mDate,
              eDate,
              qty,
              qty,
              cost,
              sPrice,
              Number(supplier_id)
            );
            batchId = Number(bRes.lastInsertRowid);

            // Record stock movement for stock reconciliation formula
            insertMovement.run(
              prodId,
              batchId,
              branchId,
              qty,
              `Procurement PO: ${invNo}`,
              lineTotal,
              req.user.name,
              pDate
            );

            // Update latest purchase price on product
            updateProdPrice.run(cost, prodId);
          }

          // Insert line item (linking batchId if received)
          insertPurchaseItem.run(
            purchaseId,
            prodId,
            batchId,
            bNum,
            mDate,
            eDate,
            qty,
            cost,
            lineTotal
          );
        }

        // If received and not paid in full, increase supplier balance due
        if (isReceived && payment_status !== 'Paid') {
          const unpaidAmount = payment_status === 'Unpaid' ? netAmount : (netAmount / 2);
          db.prepare('UPDATE suppliers SET balance_due = balance_due + ? WHERE id = ?').run(unpaidAmount, Number(supplier_id));
        }

        db.exec('COMMIT');

        logAudit(
          req.user.id,
          req.user.name,
          req.user.role,
          isReceived ? 'CREATE_PURCHASE_RECEIVED' : 'CREATE_PURCHASE_DRAFT',
          'PURCHASE',
          purchaseId,
          `Recorded ${orderStatus} PO: ${invNo} from ${supplier.name} for ₹${netAmount.toFixed(2)} (${items.length} items)`,
          req.ip
        );

        // Module 14: Emit New Purchase Notification
        emitNotification({
          type: 'purchase_new',
          category: 'purchases',
          title: isReceived ? `Consignment Received: ${invNo}` : `New Purchase Order: ${invNo}`,
          message: `${orderStatus} PO #${invNo} (${items.length} items) from ${supplier.name} for ₹${netAmount.toFixed(2)}.`,
          severity: isReceived ? 'success' : 'info',
          link_view: 'purchases',
          reference_id: purchaseId
        });

        res.status(201).json({
          success: true,
          id: purchaseId,
          data: { id: purchaseId, invoice_no: invNo, status: orderStatus },
          invoice_no: invNo,
          status: orderStatus,
          message: isReceived
            ? `Purchase PO ${invNo} confirmed and received! Stock updated and batches activated.`
            : `Purchase Order ${invNo} saved as Draft. Stock has NOT been altered until shipment reception.`
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('Error creating purchase:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7.2: EDIT DRAFT PURCHASE ORDER
  // -------------------------------------------------------------
  app.put('/api/purchases/:id', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Purchase record not found.' });
      }

      if (existing.status !== 'Draft') {
        return res.status(400).json({
          success: false,
          error: `Cannot edit this purchase order because its status is '${existing.status}'. Only Draft purchase orders can be modified.`
        });
      }

      const {
        supplier_id,
        branch_id,
        purchase_date,
        invoice_no,
        items,
        tax_amount = 0,
        discount_amount = 0,
        payment_status = 'Paid',
        payment_method = 'Bank Transfer',
        notes = ''
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one valid line item is required.' });
      }

      const supplierId = supplier_id ? Number(supplier_id) : existing.supplier_id;
      const branchId = branch_id ? Number(branch_id) : existing.branch_id;
      const pDate = purchase_date || existing.purchase_date;
      const invNo = invoice_no && invoice_no.trim() ? invoice_no.trim() : existing.invoice_no;

      let totalAmount = 0;
      for (const item of items) {
        const qty = Number(item.quantity);
        const cost = Number(item.unit_cost);
        if (!item.product_id || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
          return res.status(400).json({ success: false, error: 'Each item must have a valid product, quantity > 0, and cost >= 0.' });
        }
        totalAmount += qty * cost;
      }

      const tax = Math.max(0, Number(tax_amount) || 0);
      const discount = Math.max(0, Number(discount_amount) || 0);
      const netAmount = Math.max(0, totalAmount + tax - discount);

      db.exec('BEGIN');
      try {
        // Update purchase header
        db.prepare(`
          UPDATE purchases SET
            invoice_no = ?, supplier_id = ?, branch_id = ?, purchase_date = ?,
            total_amount = ?, tax_amount = ?, discount_amount = ?, net_amount = ?,
            payment_status = ?, payment_method = ?, notes = ?
          WHERE id = ?
        `).run(
          invNo,
          supplierId,
          branchId,
          pDate,
          totalAmount,
          tax,
          discount,
          netAmount,
          payment_status,
          payment_method,
          notes || '',
          id
        );

        // Delete old items and insert fresh ones
        db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);

        const insertItem = db.prepare(`
          INSERT INTO purchase_items (
            purchase_id, product_id, batch_number, mfg_date, expiry_date, quantity, unit_cost, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const it of items) {
          const prodId = Number(it.product_id);
          const qty = Number(it.quantity);
          const cost = Number(it.unit_cost);
          const lineTotal = qty * cost;
          const bNum = it.batch_number && it.batch_number.trim() ? it.batch_number.trim() : `BAT-${Date.now().toString().slice(-4)}-${prodId}`;
          const mDate = it.mfg_date || pDate;
          const eDate = it.expiry_date || formatDate(addDays(new Date(pDate), 4));

          insertItem.run(
            id,
            prodId,
            bNum,
            mDate,
            eDate,
            qty,
            cost,
            lineTotal
          );
        }

        db.exec('COMMIT');

        logAudit(
          req.user.id,
          req.user.name,
          req.user.role,
          'UPDATE_PURCHASE_DRAFT',
          'PURCHASE',
          id,
          `Updated draft PO: ${invNo} (Total: ₹${netAmount.toFixed(2)}, ${items.length} items)`,
          req.ip
        );

        res.json({
          success: true,
          message: `Draft purchase order ${invNo} updated successfully!`
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('Error updating draft purchase:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7.2 & 7.3: CONFIRM RECEPTION OF A DRAFT PURCHASE ORDER
  // -------------------------------------------------------------
  app.post('/api/purchases/:id/receive', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);

      if (!purchase) {
        return res.status(404).json({ success: false, error: 'Purchase record not found.' });
      }

      if (purchase.status !== 'Draft') {
        return res.status(400).json({
          success: false,
          error: `Purchase order #${purchase.invoice_no} is already '${purchase.status}'. Only Draft orders can be confirmed as received.`
        });
      }

      const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);
      if (!items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Cannot receive purchase order with zero line items.' });
      }

      db.exec('BEGIN');

      try {
        const receivedAt = new Date().toISOString();
        const receivedBy = req.user.name;

        // 1. Update purchase status
        db.prepare(`
          UPDATE purchases SET
            status = 'Received',
            received_at = ?,
            received_by = ?
          WHERE id = ?
        `).run(receivedAt, receivedBy, id);

        const insertBatch = db.prepare(`
          INSERT INTO batches (
            product_id, branch_id, batch_number, mfg_date, expiry_date,
            initial_quantity, current_quantity, purchase_cost, selling_price, status, supplier_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        `);

        const insertMovement = db.prepare(`
          INSERT INTO stock_movements (
            movement_type, product_id, batch_id, to_branch_id, quantity,
            reason, cost_impact, performed_by, movement_date
          ) VALUES ('Purchase Received', ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const updatePiBatch = db.prepare('UPDATE purchase_items SET batch_id = ? WHERE id = ?');
        const updateProdCost = db.prepare('UPDATE products SET purchase_price = ? WHERE id = ?');

        // 2. Activate batches & record movements
        for (const it of items) {
          const prod = db.prepare('SELECT selling_price FROM products WHERE id = ?').get(it.product_id);
          const sPrice = prod ? prod.selling_price : it.unit_cost * 1.25;

          const bRes = insertBatch.run(
            it.product_id,
            purchase.branch_id,
            it.batch_number,
            it.mfg_date,
            it.expiry_date,
            it.quantity,
            it.quantity,
            it.unit_cost,
            sPrice,
            purchase.supplier_id
          );
          const batchId = Number(bRes.lastInsertRowid);

          updatePiBatch.run(batchId, it.id);

          insertMovement.run(
            it.product_id,
            batchId,
            purchase.branch_id,
            it.quantity,
            `Received PO: ${purchase.invoice_no}`,
            it.total_cost,
            req.user.name,
            getTodayDate()
          );

          updateProdCost.run(it.unit_cost, it.product_id);
        }

        // 3. Update supplier balance if unpaid
        if (purchase.payment_status !== 'Paid') {
          const unpaid = purchase.payment_status === 'Unpaid' ? purchase.net_amount : (purchase.net_amount / 2);
          db.prepare('UPDATE suppliers SET balance_due = balance_due + ? WHERE id = ?').run(unpaid, purchase.supplier_id);
        }

        db.exec('COMMIT');

        logAudit(
          req.user.id,
          req.user.name,
          req.user.role,
          'CONFIRM_PURCHASE_RECEIVED',
          'PURCHASE',
          id,
          `Confirmed shipment receipt for PO: ${purchase.invoice_no}. ${items.length} batches created & stock added.`,
          req.ip
        );

        // Module 14: Emit Goods Received Notification
        emitNotification({
          type: 'purchase_new',
          category: 'purchases',
          title: `Shipment Received: ${purchase.invoice_no}`,
          message: `PO #${purchase.invoice_no} received from ${purchase.supplier_name || 'Supplier'}. ${items.length} product batches stocked.`,
          severity: 'success',
          link_view: 'purchases',
          reference_id: id
        });

        res.json({
          success: true,
          message: `Purchase PO #${purchase.invoice_no} successfully confirmed as Received! Stock added to inventory.`
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('Error confirming purchase receipt:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7.2: CANCEL DRAFT PURCHASE ORDER
  // -------------------------------------------------------------
  app.post('/api/purchases/:id/cancel', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);

      if (!purchase) {
        return res.status(404).json({ success: false, error: 'Purchase record not found.' });
      }

      if (purchase.status === 'Received') {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel a received shipment. Products are already in physical inventory. Use Supplier Return to record return of stock.'
        });
      }

      if (purchase.status === 'Cancelled') {
        return res.status(400).json({ success: false, error: 'This purchase order is already cancelled.' });
      }

      const { reason = 'Cancelled by manager' } = req.body;

      db.prepare("UPDATE purchases SET status = 'Cancelled', notes = notes || ' [Cancelled: ' || ? || ']' WHERE id = ?").run(reason, id);

      logAudit(
        req.user.id,
        req.user.name,
        req.user.role,
        'CANCEL_PURCHASE_ORDER',
        'PURCHASE',
        id,
        `Cancelled PO: ${purchase.invoice_no}. Reason: ${reason}`,
        req.ip
      );

      res.json({
        success: true,
        message: `Purchase order #${purchase.invoice_no} has been cancelled.`
      });
    } catch (err) {
      console.error('Error cancelling purchase:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7.2: RECORD SUPPLIER RETURN (RETURN DEFECTIVE GOODS TO VENDOR)
  // -------------------------------------------------------------
  app.post('/api/purchases/:id/return', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const purchaseId = Number(req.params.id);
      const {
        batch_id,
        quantity,
        reason,
        refund_type = 'Credit Note', // 'Credit Note', 'Cash Refund', 'Replacement'
        notes = ''
      } = req.body;

      if (!batch_id || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({ success: false, error: 'Valid batch selection and return quantity are required.' });
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, error: 'Reason for return is required (e.g. Curdled, Leaking seal, Quality rejected).' });
      }

      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id));
      if (!batch) {
        return res.status(404).json({ success: false, error: 'Target batch record not found.' });
      }

      const returnQty = Number(quantity);
      if (batch.current_quantity < returnQty) {
        return res.status(400).json({
          success: false,
          error: `Insufficient batch quantity. Only ${batch.current_quantity} units available in Batch #${batch.batch_number}, cannot return ${returnQty} units.`
        });
      }

      const purchase = purchaseId ? db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) : null;
      const supplierId = (purchase && purchase.supplier_id) || batch.supplier_id || 1;
      const unitCost = batch.purchase_cost;
      const totalReturnValue = returnQty * unitCost;
      const returnNo = `SR-${Date.now().toString().slice(-6)}`;
      const returnDate = getTodayDate();

      db.exec('BEGIN');

      try {
        // 1. Deduct stock from the batch
        db.prepare('UPDATE batches SET current_quantity = current_quantity - ? WHERE id = ?').run(returnQty, batch.id);

        // 2. Record supplier return entry
        db.prepare(`
          INSERT INTO supplier_returns (
            return_no, purchase_id, supplier_id, product_id, batch_id, branch_id,
            quantity, unit_cost, total_return_value, reason, refund_type, return_date, returned_by, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          returnNo,
          purchaseId || null,
          supplierId,
          batch.product_id,
          batch.id,
          batch.branch_id,
          returnQty,
          unitCost,
          totalReturnValue,
          reason.trim(),
          refund_type,
          returnDate,
          req.user.name,
          notes || ''
        );

        // 3. Record stock movement for reconciliation formula (movement_type = 'Supplier Return')
        db.prepare(`
          INSERT INTO stock_movements (
            movement_type, product_id, batch_id, from_branch_id, quantity,
            reason, cost_impact, performed_by, movement_date
          ) VALUES ('Supplier Return', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          batch.product_id,
          batch.id,
          batch.branch_id,
          returnQty,
          `Supplier Return ${returnNo}: ${reason.trim()}`,
          -totalReturnValue,
          req.user.name,
          returnDate
        );

        // 4. Adjust supplier balance if credit note or balance due exists
        if (refund_type === 'Credit Note') {
          db.prepare('UPDATE suppliers SET balance_due = MAX(0, balance_due - ?) WHERE id = ?').run(totalReturnValue, supplierId);
        }

        db.exec('COMMIT');

        logAudit(
          req.user.id,
          req.user.name,
          req.user.role,
          'RECORD_SUPPLIER_RETURN',
          'SUPPLIER_RETURN',
          returnNo,
          `Returned ${returnQty} units of Batch #${batch.batch_number} to supplier. Value: ₹${totalReturnValue.toFixed(2)} (${refund_type})`,
          req.ip
        );

        res.json({
          success: true,
          return_no: returnNo,
          total_return_value: totalReturnValue,
          message: `Supplier return ${returnNo} recorded! ${returnQty} units deducted from stock.`
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('Error recording supplier return:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7.2: GET ALL SUPPLIER RETURNS LIST
  // -------------------------------------------------------------
  app.get('/api/purchases-returns', optionalAuth, (req, res) => {
    try {
      const returns = db.prepare(`
        SELECT 
          sr.*,
          s.name as supplier_name,
          s.phone as supplier_phone,
          prod.name as product_name,
          prod.sku as product_sku,
          prod.unit as product_unit,
          b.batch_number,
          p.invoice_no as purchase_invoice_no
        FROM supplier_returns sr
        JOIN suppliers s ON sr.supplier_id = s.id
        JOIN products prod ON sr.product_id = prod.id
        LEFT JOIN batches b ON sr.batch_id = b.id
        LEFT JOIN purchases p ON sr.purchase_id = p.id
        ORDER BY sr.return_date DESC, sr.id DESC
      `).all();

      res.json({ success: true, data: returns });
    } catch (err) {
      console.error('Error fetching supplier returns:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

};
