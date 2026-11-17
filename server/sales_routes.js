// ====================================================================
// MODULE 6: SALES & BILLING (POS) API ROUTES
// ====================================================================

const {
  db,
  formatDate,
  logAudit
} = require('./db');
const { emitNotification } = require('./notification_routes');
const { queryCache } = require('./cache');

function getTodayDate() {
  return formatDate(new Date());
}

function generateInvoiceNumber() {
  const d = new Date();
  const dateStr = d.getFullYear().toString() + 
    String(d.getMonth() + 1).padStart(2, '0') + 
    String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${rand}`;
}

function generateTransactionId() {
  return `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

module.exports = function registerSalesRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // -------------------------------------------------------------
  // 6.1: GET SALES CONFIG & BILLING SETTINGS
  // -------------------------------------------------------------
  app.get('/api/sales/config', optionalAuth, (req, res) => {
    try {
      const settingsRows = db.prepare('SELECT key, value FROM settings').all();
      const settings = {};
      settingsRows.forEach(r => { settings[r.key] = r.value; });

      res.json({
        success: true,
        data: {
          tax_gst_enabled: settings.tax_gst_enabled !== '0',
          tax_gst_percent: parseFloat(settings.tax_gst_percent) || 5.0,
          shop_name: settings.shop_name || 'DairyTrack Smart Dairy & Creamery',
          shop_address: settings.shop_address || '124 Milkman Boulevard, Dairy Hub, Sector 4',
          shop_phone: settings.shop_phone || '+91 98765 43210',
          shop_gstin: settings.shop_gstin || '07AAAAA0000A1Z5',
          upi_vpa: settings.upi_vpa || 'dairytrack@upi',
          payment_methods: [
            { id: 'Cash', label: 'Cash', icon: '💵' },
            { id: 'UPI', label: 'UPI / QR Code', icon: '📱' },
            { id: 'Card', label: 'Debit / Credit Card', icon: '💳' },
            { id: 'Customer Credit', label: 'Customer Credit (Udhar)', icon: '📒' }
          ]
        }
      });
    } catch (err) {
      console.error('Error fetching sales config:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 6.2: VALIDATE CART AVAILABILITY (PREVENT OVERSELLING)
  // -------------------------------------------------------------
  app.post('/api/sales/validate-cart', optionalAuth, (req, res) => {
    try {
      const { items, branch_id = 1 } = req.body;
      const branchId = Number(branch_id);

      if (!items || !items.length) {
        return res.status(400).json({ success: false, error: 'Cart is empty' });
      }

      const issues = [];

      for (const item of items) {
        const prodId = Number(item.product_id);
        const reqQty = Number(item.quantity);

        const prod = db.prepare('SELECT name, unit, is_active FROM products WHERE id = ?').get(prodId);
        if (!prod || prod.is_active === 0) {
          issues.push({ product_id: prodId, error: 'Product is discontinued or inactive.' });
          continue;
        }

        const stockRow = db.prepare(`
          SELECT COALESCE(SUM(current_quantity), 0) as available
          FROM batches
          WHERE product_id = ? AND branch_id = ? AND current_quantity > 0
        `).get(prodId, branchId);

        const available = Number(stockRow.available);
        if (available < reqQty) {
          issues.push({
            product_id: prodId,
            product_name: prod.name,
            requested: reqQty,
            available: available,
            unit: prod.unit,
            error: `Insufficient stock for ${prod.name}. Available: ${available} ${prod.unit}, Requested: ${reqQty} ${prod.unit}.`
          });
        }
      }

      if (issues.length > 0) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: issues[0].error,
          issues
        });
      }

      res.json({ success: true, valid: true, message: 'All cart items available in stock.' });
    } catch (err) {
      console.error('Error validating cart:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 6.3: LIST SALES TRANSACTIONS (HISTORY)
  // -------------------------------------------------------------
  app.get('/api/sales', optionalAuth, (req, res) => {
    try {
      const { search, startDate, endDate, branchId, customerId, page = 1, limit = 50 } = req.query;
      const p = Math.max(1, parseInt(page, 10));
      const l = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (p - 1) * l;

      let query = `
        SELECT 
          s.*,
          COALESCE(c.name, 'Walk-in Retail') as customer_name,
          c.phone as customer_phone,
          br.name as branch_name,
          COUNT(si.id) as total_items
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN branches br ON s.branch_id = br.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        query += ' AND (s.invoice_no LIKE ? OR s.transaction_id LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
        const t = `%${search}%`;
        params.push(t, t, t, t);
      }
      if (startDate) {
        query += ' AND s.sale_date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND s.sale_date <= ?';
        params.push(endDate);
      }
      if (branchId && branchId !== 'all') {
        query += ' AND s.branch_id = ?';
        params.push(Number(branchId));
      }
      if (customerId) {
        query += ' AND s.customer_id = ?';
        params.push(Number(customerId));
      }

      query += ' GROUP BY s.id ORDER BY s.id DESC LIMIT ? OFFSET ?';
      params.push(l, offset);

      const sales = db.prepare(query).all(...params);

      // Count total for pagination
      let countQuery = `
        SELECT COUNT(DISTINCT s.id) as total
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE 1=1
      `;
      const countParams = [];
      if (search) {
        countQuery += ' AND (s.invoice_no LIKE ? OR s.transaction_id LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
        const t = `%${search}%`;
        countParams.push(t, t, t, t);
      }
      if (startDate) {
        countQuery += ' AND s.sale_date >= ?';
        countParams.push(startDate);
      }
      if (endDate) {
        countQuery += ' AND s.sale_date <= ?';
        countParams.push(endDate);
      }
      if (branchId && branchId !== 'all') {
        countQuery += ' AND s.branch_id = ?';
        countParams.push(Number(branchId));
      }
      if (customerId) {
        countQuery += ' AND s.customer_id = ?';
        countParams.push(Number(customerId));
      }

      const totalCount = db.prepare(countQuery).get(...countParams).total;

      res.json({
        success: true,
        data: sales,
        pagination: {
          page: p,
          limit: l,
          totalRecords: totalCount,
          totalPages: Math.ceil(totalCount / l)
        }
      });
    } catch (err) {
      console.error('Error fetching sales:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 6.4: SINGLE SALE DETAILS & RECEIPT (6.4 & 6.5)
  // -------------------------------------------------------------
  app.get('/api/sales/:id', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const sale = db.prepare(`
        SELECT 
          s.*,
          COALESCE(c.name, 'Walk-in Retail') as customer_name,
          c.phone as customer_phone,
          c.address as customer_address,
          c.credit_balance as customer_balance,
          br.name as branch_name,
          br.address as branch_address,
          br.phone as branch_phone
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN branches br ON s.branch_id = br.id
        WHERE s.id = ?
      `).get(id);

      if (!sale) return res.status(404).json({ success: false, error: 'Sale invoice not found' });

      // Fetch shop details from settings
      const shopName = db.prepare("SELECT value FROM settings WHERE key = 'shop_name'").get()?.value || 'DairyTrack Smart Dairy & Creamery';
      const shopGstin = db.prepare("SELECT value FROM settings WHERE key = 'shop_gstin'").get()?.value || '07AAAAA0000A1Z5';
      const shopAddress = db.prepare("SELECT value FROM settings WHERE key = 'shop_address'").get()?.value || sale.branch_address;
      const shopPhone = db.prepare("SELECT value FROM settings WHERE key = 'shop_phone'").get()?.value || sale.branch_phone;

      const items = db.prepare(`
        SELECT 
          si.*,
          p.name as product_name,
          p.sku,
          p.unit,
          b.batch_number,
          b.expiry_date
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        LEFT JOIN batches b ON si.batch_id = b.id
        WHERE si.sale_id = ?
      `).all(id);

      res.json({
        success: true,
        data: {
          ...sale,
          shop_details: {
            name: shopName,
            gstin: shopGstin,
            address: shopAddress,
            phone: shopPhone
          },
          items
        }
      });
    } catch (err) {
      console.error('Error fetching sale details:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // MODULE 18: MUTEX LOCK FOR CONCURRENT SALES ALLOCATION
  // -------------------------------------------------------------
  let checkoutMutex = Promise.resolve();

  async function runWithCheckoutMutex(fn) {
    let release;
    const nextLock = new Promise(resolve => { release = resolve; });
    const currentLock = checkoutMutex;
    checkoutMutex = nextLock;
    try {
      await currentLock;
      return await fn();
    } finally {
      release();
    }
  }

  // -------------------------------------------------------------
  // MODULE 18: PROTECT COMPLETED SALES TRANSACTIONS FROM EDITING
  // -------------------------------------------------------------
  app.put('/api/sales/:id', optionalAuth, (req, res) => {
    return res.status(403).json({
      success: false,
      error: 'COMPLETED_TRANSACTIONS_IMMUTABLE: Completed sales invoices cannot be modified directly. Process a customer return instead.',
      code: 'TRANSACTION_IMMUTABLE'
    });
  });

  app.delete('/api/sales/:id', optionalAuth, (req, res) => {
    return res.status(403).json({
      success: false,
      error: 'COMPLETED_TRANSACTIONS_IMMUTABLE: Completed sales invoices cannot be deleted. Process a customer return instead.',
      code: 'TRANSACTION_IMMUTABLE'
    });
  });

  // -------------------------------------------------------------
  // 6.5: ATOMIC POS CHECKOUT & INVENTORY DEDUCTION (6.2, 6.3, 6.4, 6.6)
  // -------------------------------------------------------------
  app.post('/api/sales', optionalAuth, async (req, res) => {
    await runWithCheckoutMutex(async () => {
      // Check Idempotency Key first before opening a transaction
      const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key || req.body.client_transaction_id;
      if (idempotencyKey) {
        const existing = db.prepare('SELECT * FROM sales WHERE transaction_id = ? OR notes LIKE ?')
          .get(String(idempotencyKey), `%[IDEMPOTENCY:${idempotencyKey}]%`);
        if (existing) {
          return res.json({
            success: true,
            message: `Idempotent request: returning existing sale invoice #${existing.invoice_no}`,
            sale_id: existing.id,
            invoice_no: existing.invoice_no,
            transaction_id: existing.transaction_id,
            net_amount: existing.net_amount,
            payment_method: existing.payment_method,
            payment_status: existing.payment_status,
            is_idempotent_replay: true
          });
        }
      }

      // ATOMIC TRANSACTION: Wrap entire sale & inventory updates in SQLite BEGIN ... COMMIT
      db.exec('BEGIN');

      try {
        const {
          customer_id,
          branch_id = 1,
          items,
          discount_amount = 0,
          tax_amount = 0,
          payment_method = 'Cash',
          payment_ref,
          payment_details,
          cashier_name,
          notes
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
          db.exec('ROLLBACK');
          return res.status(400).json({ success: false, error: 'Cart cannot be empty. Please select products.' });
        }

        const branchId = Number(branch_id) || 1;
        const invoiceNo = generateInvoiceNumber();
        const transactionId = idempotencyKey ? String(idempotencyKey) : generateTransactionId();
        const saleDate = getTodayDate();
        const cashierUser = req.user ? req.user.name : (cashier_name || 'Counter Staff');
        const cashierId = req.user ? req.user.id : null;

        // Prevent duplicate invoice number in database
        const dupCheck = db.prepare('SELECT id FROM sales WHERE invoice_no = ?').get(invoiceNo);
        if (dupCheck) {
          db.exec('ROLLBACK');
          return res.status(409).json({ success: false, error: `Duplicate invoice number detected: ${invoiceNo}` });
        }

        let calculatedSubtotal = 0;
        let totalCostOfGoods = 0;
        const processedItems = [];

        // ---------------------------------------------------------
        // 1. OVERSOLD VALIDATION & FEFO BATCH ALLOCATION
        // ---------------------------------------------------------
        for (const item of items) {
          const prodId = Number(item.product_id);
          const requestedQty = Number(item.quantity);
          const unitPrice = Number(item.unit_price);

          if (!prodId || isNaN(requestedQty) || !isFinite(requestedQty) || requestedQty <= 0) {
            db.exec('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Invalid quantity: quantity must be a positive finite number greater than zero.' });
          }

          const prod = db.prepare('SELECT id, name, sku, unit, purchase_price, selling_price, is_active FROM products WHERE id = ?').get(prodId);
          if (!prod) {
            db.exec('ROLLBACK');
            return res.status(404).json({ success: false, error: `Product ID #${prodId} not found in catalog.` });
          }
          if (prod.is_active === 0) {
            db.exec('ROLLBACK');
            return res.status(400).json({ success: false, error: `Product "${prod.name}" is discontinued and cannot be sold.` });
          }

          // Module 18: Unit-based precision validation
          const countUnits = ['pcs', 'pkt', 'btl', 'cup', 'box', 'piece', 'packet', 'bottle'];
          const unitLower = (prod.unit || '').toLowerCase();
          if (countUnits.some(u => unitLower.includes(u))) {
            if (!Number.isInteger(requestedQty)) {
              db.exec('ROLLBACK');
              return res.status(400).json({
                success: false,
                error: `Invalid quantity entry: "${prod.name}" is sold in unit "${prod.unit}" which requires whole integer quantities (decimals not allowed).`
              });
            }
          } else {
            const decimalStr = String(requestedQty).split('.')[1] || '';
            if (decimalStr.length > 3) {
              db.exec('ROLLBACK');
              return res.status(400).json({
                success: false,
                error: `Invalid quantity entry: "${prod.name}" allows up to 3 decimal places for ${prod.unit}.`
              });
            }
          }

          // Check total available stock across active batches in this branch
          const stockRow = db.prepare(`
            SELECT COALESCE(SUM(current_quantity), 0) as available
            FROM batches
            WHERE product_id = ? AND branch_id = ? AND current_quantity > 0
          `).get(prodId, branchId);

          const availableQty = Number(stockRow.available);

          // PREVENT OVERSELLING: Strict check
          if (availableQty < requestedQty) {
            db.exec('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: `Overselling prevented: Insufficient stock for "${prod.name}". Available: ${availableQty} ${prod.unit}, Requested: ${requestedQty} ${prod.unit}.`
            });
          }

        // Strict FEFO (First Expiry, First Out) batch liquidation
        const availableBatches = db.prepare(`
          SELECT * FROM batches 
          WHERE product_id = ? AND branch_id = ? AND current_quantity > 0
          ORDER BY expiry_date ASC, id ASC
        `).all(prodId, branchId);

        let remainingToDeduct = requestedQty;

        for (const batch of availableBatches) {
          if (remainingToDeduct <= 0) break;

          const take = Math.min(Number(batch.current_quantity), remainingToDeduct);
          const newQty = Number((batch.current_quantity - take).toFixed(2));

          // Deduct from batch
          db.prepare('UPDATE batches SET current_quantity = ? WHERE id = ?').run(newQty, batch.id);

          const lineCost = take * batch.purchase_cost;
          const lineRevenue = take * unitPrice;
          const lineProfit = lineRevenue - lineCost;

          totalCostOfGoods += lineCost;
          remainingToDeduct = Number((remainingToDeduct - take).toFixed(2));

          processedItems.push({
            product_id: prodId,
            batch_id: batch.id,
            quantity: take,
            unit_price: unitPrice,
            unit_cost: batch.purchase_cost,
            total_price: Number(lineRevenue.toFixed(2)),
            profit: Number(lineProfit.toFixed(2))
          });
        }

        calculatedSubtotal += requestedQty * unitPrice;
      }

      // ---------------------------------------------------------
      // 2. FINANCIAL CALCULATIONS
      // ---------------------------------------------------------
      const discount = Math.max(0, Number(discount_amount) || 0);
      const tax = Math.max(0, Number(tax_amount) || 0);
      const netAmount = Math.max(0, Number((calculatedSubtotal - discount + tax).toFixed(2)));
      const profitEarned = Number((netAmount - totalCostOfGoods).toFixed(2));

      // Payment Status: Credit if Customer Credit, else Paid
      let paymentStatus = 'Paid';
      if (payment_method === 'Customer Credit') {
        paymentStatus = 'Credit';
      }

      // ---------------------------------------------------------
      // 3. INSERT SALES RECORD
      // ---------------------------------------------------------
      const saleResult = db.prepare(`
        INSERT INTO sales (
          invoice_no, transaction_id, customer_id, branch_id, sale_date,
          total_amount, tax_amount, discount_amount, net_amount, total_cost, profit_earned,
          payment_method, payment_status, payment_ref, payment_details,
          cashier_name, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNo,
        transactionId,
        customer_id ? Number(customer_id) : null,
        branchId,
        saleDate,
        Number(calculatedSubtotal.toFixed(2)),
        Number(tax.toFixed(2)),
        Number(discount.toFixed(2)),
        netAmount,
        Number(totalCostOfGoods.toFixed(2)),
        profitEarned,
        payment_method,
        paymentStatus,
        payment_ref ? String(payment_ref).trim() : null,
        payment_details ? String(payment_details).trim() : null,
        cashierUser,
        notes || 'Counter POS checkout'
      );

      const saleId = Number(saleResult.lastInsertRowid);

      // ---------------------------------------------------------
      // 4. INSERT SALE ITEMS & INVENTORY STOCK MOVEMENTS
      // ---------------------------------------------------------
      const insertSaleItem = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, batch_id, quantity, unit_price, unit_cost, total_price, profit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMovement = db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Sale', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of processedItems) {
        // Record sale line item
        insertSaleItem.run(
          saleId,
          item.product_id,
          item.batch_id,
          item.quantity,
          item.unit_price,
          item.unit_cost,
          item.total_price,
          item.profit
        );

        // Record stock movement transaction
        insertMovement.run(
          item.product_id,
          item.batch_id,
          branchId,
          item.quantity,
          `POS Invoice #${invoiceNo} (Txn: ${transactionId})`,
          Number((item.unit_cost * item.quantity).toFixed(2)),
          cashierUser,
          saleDate
        );
      }

      // ---------------------------------------------------------
      // 5. UPDATE CUSTOMER CREDIT IF UDHAR & LOYALTY POINTS
      // ---------------------------------------------------------
      if (customer_id && payment_method === 'Customer Credit') {
        db.prepare('UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ?')
          .run(netAmount, Number(customer_id));
      }

      if (customer_id) {
        const points = Math.floor(netAmount / 50);
        if (points > 0) {
          db.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?')
            .run(points, Number(customer_id));
        }
      }

      // ---------------------------------------------------------
      // 6. AUDIT LOGGING & NOTIFICATION
      // ---------------------------------------------------------
      logAudit(
        cashierId,
        cashierUser,
        req.user ? req.user.role : 'Shopkeeper',
        'POS_SALE_COMPLETED',
        'SALE',
        saleId,
        `Completed sale ${invoiceNo} (${transactionId}) for ₹${netAmount} via ${payment_method}`,
        req.ip
      );

      // Commit transaction cleanly
      db.exec('COMMIT');
      queryCache.invalidatePattern('dashboard');
      queryCache.invalidatePattern('analytics');

      // Module 14: Emit Sales Completion Notification
      emitNotification({
        type: 'sale_complete',
        category: 'sales',
        title: `Sale Completed: #${invoiceNo}`,
        message: `Invoice #${invoiceNo} billed for ₹${netAmount.toFixed(2)} via ${payment_method}. Items sold: ${items.length}.`,
        severity: 'success',
        link_view: 'sales',
        reference_id: saleId
      });

      res.json({
        success: true,
        message: `Sale completed successfully! Invoice #${invoiceNo}`,
        sale_id: saleId,
        invoice_no: invoiceNo,
        transaction_id: transactionId,
        net_amount: netAmount,
        payment_method: payment_method,
        payment_status: paymentStatus
      });

    } catch (err) {
      // In case of any error or unexpected exception, rollback entire transaction
      try { db.exec('ROLLBACK'); } catch {}
      console.error('Error during POS checkout:', err);

      // Module 14: Emit Failed Transaction Notification
      emitNotification({
        type: 'transaction_failed',
        category: 'sales',
        title: 'POS Checkout Failed',
        message: `Order checkout transaction aborted: ${err.message || 'Validation or inventory deduction error.'}`,
        severity: 'danger',
        link_view: 'sales'
      });

      res.status(500).json({ success: false, error: err.message || 'Transaction failed during checkout.' });
    }
  });

  // -------------------------------------------------------------
  // 6.7: SALES RETURN (Module 16 & 19: POST /api/sales/:id/returns)
  // -------------------------------------------------------------
  app.post('/api/sales/:id/returns', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const saleId = Number(req.params.id);
      const { items, restock = true, refund_method = 'Cash' } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one return item is required.' });
      }

      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      if (!sale) {
        return res.status(404).json({ success: false, error: 'Sale record not found.' });
      }

      db.exec('BEGIN');
      try {
        let totalRefund = 0;
        const returnDate = getTodayDate();
        const returnNo = `CR-${Date.now().toString().slice(-4)}`;

        for (const item of items) {
          const qty = Number(item.quantity);
          const prodId = Number(item.product_id);
          const reason = item.reason || 'Customer Return';

          // Locate corresponding sale_item
          const saleItem = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND product_id = ? LIMIT 1').get(saleId, prodId);
          const unitPrice = saleItem ? saleItem.unit_price : 0;
          const lineRefund = qty * unitPrice;
          totalRefund += lineRefund;

          // Locate batch to restock
          let targetBatchId = saleItem ? saleItem.batch_id : null;
          if (!targetBatchId) {
            const fallbackBatch = db.prepare('SELECT id FROM batches WHERE product_id = ? ORDER BY id DESC LIMIT 1').get(prodId);
            if (fallbackBatch) targetBatchId = fallbackBatch.id;
          }

          if (restock && targetBatchId) {
            db.prepare('UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?').run(qty, targetBatchId);
            db.prepare(`
              INSERT INTO stock_movements (
                movement_type, product_id, batch_id, to_branch_id,
                quantity, reason, cost_impact, performed_by, movement_date
              ) VALUES ('Customer Return', ?, ?, 1, ?, ?, ?, ?, ?)
            `).run(
              prodId,
              targetBatchId,
              qty,
              `Customer return from Invoice #${sale.invoice_no}: ${reason}`,
              saleItem ? (saleItem.unit_cost * qty) : 0,
              req.user.name,
              returnDate
            );
          }

          // Record in customer_returns
          db.prepare(`
            INSERT INTO customer_returns (
              return_no, sale_id, customer_id, product_id, batch_id,
              quantity, unit_price, refund_amount, reason, refund_method,
              return_date, processed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            returnNo,
            saleId,
            sale.customer_id || null,
            prodId,
            targetBatchId,
            qty,
            unitPrice,
            lineRefund,
            reason,
            refund_method,
            returnDate,
            req.user.name
          );
        }

        db.exec('COMMIT');
        queryCache.invalidatePattern('dashboard');
        queryCache.invalidatePattern('analytics');

        logAudit(
          req.user.id,
          req.user.name,
          req.user.role,
          'CUSTOMER_RETURN_PROCESSED',
          'SALE',
          saleId,
          `Processed customer return for Invoice #${sale.invoice_no}. Total refund: ₹${totalRefund.toFixed(2)}`,
          req.ip
        );

        res.json({
          success: true,
          message: 'Customer return processed successfully.',
          total_refund: totalRefund
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('Error processing sales return:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
});
};
