// ====================================================================
// MODULE 9: SUPPLIER MANAGEMENT API ROUTES & LEDGER
// ====================================================================

const { db, logAudit, formatDate } = require('./db');
const { generateSupplierPurchasesReport } = require('./reports');

function getTodayDate() {
  return formatDate(new Date());
}

module.exports = function registerSupplierRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // -------------------------------------------------------------
  // 9.1: SUPPLIER STATS & KPIS
  // -------------------------------------------------------------
  app.get('/api/suppliers/stats', optionalAuth, (req, res) => {
    try {
      const stats = db.prepare(`
        SELECT 
          COUNT(DISTINCT s.id) as total_suppliers,
          SUM(CASE WHEN s.status = 'Active' THEN 1 ELSE 0 END) as active_suppliers,
          SUM(CASE WHEN s.status = 'Inactive' THEN 1 ELSE 0 END) as inactive_suppliers,
          ROUND(COALESCE(SUM(s.balance_due), 0), 2) as total_balance_due,
          COUNT(CASE WHEN s.balance_due > 0 THEN 1 END) as suppliers_with_due
        FROM suppliers s
      `).get();

      const procurementRow = db.prepare(`
        SELECT 
          ROUND(COALESCE(SUM(net_amount), 0), 2) as lifetime_procurement,
          COUNT(*) as total_orders_count
        FROM purchases
        WHERE status = 'Received'
      `).get();

      const returnsRow = db.prepare(`
        SELECT 
          ROUND(COALESCE(SUM(total_return_value), 0), 2) as total_returns_value,
          COUNT(*) as total_returns_count
        FROM supplier_returns
      `).get();

      const paymentsRow = db.prepare(`
        SELECT 
          ROUND(COALESCE(SUM(amount), 0), 2) as total_paid_value,
          COUNT(*) as total_payments_count
        FROM supplier_payments
      `).get();

      const lifetimeProc = procurementRow ? procurementRow.lifetime_procurement : 0;
      const totalReturns = returnsRow ? returnsRow.total_returns_value : 0;
      const defectRate = lifetimeProc > 0 ? Number(((totalReturns / lifetimeProc) * 100).toFixed(2)) : 0;

      res.json({
        success: true,
        data: {
          total_suppliers: stats.total_suppliers || 0,
          active_suppliers: stats.active_suppliers || 0,
          inactive_suppliers: stats.inactive_suppliers || 0,
          total_balance_due: stats.total_balance_due || 0,
          suppliers_with_due: stats.suppliers_with_due || 0,
          lifetime_procurement: lifetimeProc,
          total_orders_count: procurementRow ? procurementRow.total_orders_count : 0,
          total_returns_value: totalReturns,
          total_returns_count: returnsRow ? returnsRow.total_returns_count : 0,
          total_paid_value: paymentsRow ? paymentsRow.total_paid_value : 0,
          total_payments_count: paymentsRow ? paymentsRow.total_payments_count : 0,
          overall_defect_rate: defectRate
        }
      });
    } catch (err) {
      console.error('Error fetching supplier stats:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.2: LIST SUPPLIERS (SEARCH, FILTER, SORT & METRICS)
  // -------------------------------------------------------------
  app.get('/api/suppliers', optionalAuth, (req, res) => {
    try {
      const {
        search,
        status, // 'all', 'Active', 'Inactive'
        balance, // 'all', 'due', 'settled'
        sort = 'name_asc',
        page = 1,
        limit = 50
      } = req.query;

      let whereClauses = ['1=1'];
      const params = [];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        whereClauses.push('(s.name LIKE ? OR s.company_name LIKE ? OR s.contact_person LIKE ? OR s.phone LIKE ? OR s.email LIKE ? OR s.gst_number LIKE ?)');
        params.push(term, term, term, term, term, term);
      }

      if (status && status !== 'all') {
        whereClauses.push('s.status = ?');
        params.push(status);
      }

      if (balance === 'due') {
        whereClauses.push('s.balance_due > 0');
      } else if (balance === 'settled') {
        whereClauses.push('(s.balance_due = 0 OR s.balance_due IS NULL)');
      }

      const whereSql = whereClauses.join(' AND ');

      // Sorting map
      let orderSql = 's.name ASC';
      switch (sort) {
        case 'name_desc': orderSql = 's.name DESC'; break;
        case 'balance_desc': orderSql = 's.balance_due DESC'; break;
        case 'balance_asc': orderSql = 's.balance_due ASC'; break;
        case 'procurement_desc': orderSql = 'lifetime_procurement DESC'; break;
        case 'orders_desc': orderSql = 'total_purchases_count DESC'; break;
        case 'newest': orderSql = 's.id DESC'; break;
        default: orderSql = 's.name ASC';
      }

      // Count query
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM suppliers s WHERE ${whereSql}`).get(...params);
      const total = countRow ? countRow.total : 0;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      // Relational data query with aggregated performance
      const query = `
        SELECT 
          s.*,
          'SUP-' || PRINTF('%04d', s.id) as formatted_id,
          COUNT(DISTINCT p.id) as total_purchases_count,
          SUM(CASE WHEN p.status = 'Received' THEN 1 ELSE 0 END) as received_purchases_count,
          COALESCE(SUM(CASE WHEN p.status = 'Received' THEN p.net_amount ELSE 0 END), 0) as lifetime_procurement,
          COUNT(DISTINCT sr.id) as total_returns_count,
          COALESCE(SUM(sr.total_return_value), 0) as total_returns_value,
          (
            SELECT COALESCE(SUM(amount), 0) 
            FROM supplier_payments sp 
            WHERE sp.supplier_id = s.id
          ) as total_paid_amount
        FROM suppliers s
        LEFT JOIN purchases p ON s.id = p.supplier_id
        LEFT JOIN supplier_returns sr ON s.id = sr.supplier_id
        WHERE ${whereSql}
        GROUP BY s.id
        ORDER BY ${orderSql}
        LIMIT ? OFFSET ?
      `;

      const suppliers = db.prepare(query).all(...params, limitNum, offset);

      // Add calculated performance fields
      const enriched = suppliers.map(s => {
        const lifetime = Number(s.lifetime_procurement || 0);
        const returns = Number(s.total_returns_value || 0);
        const totalOrders = Number(s.total_purchases_count || 0);
        const recOrders = Number(s.received_purchases_count || 0);

        const defectRate = lifetime > 0 ? Number(((returns / lifetime) * 100).toFixed(2)) : 0;
        const fulfillmentRate = totalOrders > 0 ? Math.round((recOrders / totalOrders) * 100) : 100;

        let grade = 'A';
        let gradeLabel = 'Grade A (Excellent)';
        if (defectRate > 3) {
          grade = 'C';
          gradeLabel = 'Grade C (High Defect Risk)';
        } else if (defectRate > 1) {
          grade = 'B';
          gradeLabel = 'Grade B (Good Quality)';
        }

        return {
          ...s,
          company_name: s.company_name || s.name,
          status: s.status || 'Active',
          balance_due: Number(s.balance_due || 0),
          net_procurement: Number((lifetime - returns).toFixed(2)),
          performance: {
            defect_rate: defectRate,
            fulfillment_rate: fulfillmentRate,
            grade,
            grade_label: gradeLabel
          }
        };
      });

      res.json({
        success: true,
        data: enriched,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      });
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.3: SUPPLIER-WISE PURCHASE REPORT EXCEL DOWNLOAD
  // (Registered BEFORE /api/suppliers/:id to prevent 'report' matching as :id)
  // -------------------------------------------------------------
  app.get('/api/suppliers/report', optionalAuth, (req, res) => {
    try {
      const buffer = generateSupplierPurchasesReport(req.query);
      const filename = `DairyTrack_Supplier_Purchases_${getTodayDate()}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      console.error('Error generating supplier purchases report:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.4: GET SINGLE SUPPLIER DETAILS WITH FULL 360-DEGREE LEDGER
  // -------------------------------------------------------------
  app.get('/api/suppliers/:id', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, error: 'Valid supplier ID required.' });

      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
      if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found.' });

      // Purchases for this supplier
      const purchases = db.prepare(`
        SELECT 
          p.*,
          COALESCE(b.name, 'Main Cold Store') as branch_name,
          (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count
        FROM purchases p
        LEFT JOIN branches b ON p.branch_id = b.id
        WHERE p.supplier_id = ?
        ORDER BY p.purchase_date DESC, p.id DESC
        LIMIT 25
      `).all(id);

      // Returns for this supplier
      const returns = db.prepare(`
        SELECT 
          sr.*,
          p.name as product_name,
          p.sku as product_sku,
          b.batch_number
        FROM supplier_returns sr
        JOIN products p ON sr.product_id = p.id
        LEFT JOIN batches b ON sr.batch_id = b.id
        WHERE sr.supplier_id = ?
        ORDER BY sr.return_date DESC, sr.id DESC
      `).all(id);

      // Payments for this supplier
      const payments = db.prepare(`
        SELECT * FROM supplier_payments
        WHERE supplier_id = ?
        ORDER BY payment_date DESC, id DESC
      `).all(id);

      // Metrics computation
      const lifetimeProc = purchases.filter(p => p.status === 'Received').reduce((sum, p) => sum + Number(p.net_amount), 0);
      const returnsValue = returns.reduce((sum, r) => sum + Number(r.total_return_value), 0);
      const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);

      const defectRate = lifetimeProc > 0 ? Number(((returnsValue / lifetimeProc) * 100).toFixed(2)) : 0;
      const fulfillmentRate = purchases.length > 0 ? Math.round((purchases.filter(p => p.status === 'Received').length / purchases.length) * 100) : 100;

      let grade = 'A';
      let gradeLabel = 'Grade A (Excellent)';
      if (defectRate > 3) {
        grade = 'C';
        gradeLabel = 'Grade C (High Defect Risk)';
      } else if (defectRate > 1) {
        grade = 'B';
        gradeLabel = 'Grade B (Good Quality)';
      }

      res.json({
        success: true,
        data: {
          ...supplier,
          formatted_id: `SUP-${String(supplier.id).padStart(4, '0')}`,
          company_name: supplier.company_name || supplier.name,
          status: supplier.status || 'Active',
          balance_due: Number(supplier.balance_due || 0),
          metrics: {
            lifetime_procurement: lifetimeProc,
            net_procurement: Number((lifetimeProc - returnsValue).toFixed(2)),
            total_returns_value: returnsValue,
            total_paid: totalPaid,
            total_orders: purchases.length,
            received_orders: purchases.filter(p => p.status === 'Received').length,
            returns_count: returns.length,
            payments_count: payments.length,
            defect_rate: defectRate,
            fulfillment_rate: fulfillmentRate,
            grade,
            grade_label: gradeLabel
          },
          purchases,
          returns,
          payments
        }
      });
    } catch (err) {
      console.error('Error fetching supplier details:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.4: REGISTER NEW SUPPLIER
  // -------------------------------------------------------------
  app.post('/api/suppliers', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const {
        name,
        company_name,
        contact_person,
        phone,
        email,
        address,
        gst_number,
        payment_terms,
        status = 'Active',
        opening_balance = 0
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Supplier / Farm name is required.' });
      }

      if (!phone || !phone.trim()) {
        return res.status(400).json({ success: false, error: 'Mobile / Phone number is required.' });
      }

      const balance = Number(opening_balance) || 0;

      const result = db.prepare(`
        INSERT INTO suppliers (
          name, company_name, contact_person, phone, email, address,
          gst_number, payment_terms, balance_due, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        (company_name && company_name.trim()) ? company_name.trim() : name.trim(),
        (contact_person && contact_person.trim()) ? contact_person.trim() : '',
        phone.trim(),
        (email && email.trim()) ? email.trim() : '',
        (address && address.trim()) ? address.trim() : '',
        (gst_number && gst_number.trim()) ? gst_number.trim().toUpperCase() : '',
        payment_terms || 'Net 15',
        balance,
        status || 'Active'
      );

      const supplierId = Number(result.lastInsertRowid);

      logAudit(
        req.user.id,
        req.user.name,
        req.user.role,
        'REGISTER_SUPPLIER',
        'SUPPLIER',
        supplierId,
        `Registered supplier: ${name.trim()} (${phone.trim()}), Opening balance: ₹${balance}`,
        req.ip
      );

      res.json({
        success: true,
        id: supplierId,
        formatted_id: `SUP-${String(supplierId).padStart(4, '0')}`,
        message: `Supplier "${name.trim()}" registered successfully!`
      });
    } catch (err) {
      console.error('Error creating supplier:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.5: EDIT SUPPLIER DETAILS
  // -------------------------------------------------------------
  app.put('/api/suppliers/:id', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, error: 'Valid supplier ID required.' });

      const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ success: false, error: 'Supplier not found.' });

      const {
        name,
        company_name,
        contact_person,
        phone,
        email,
        address,
        gst_number,
        payment_terms,
        status
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Supplier name is required.' });
      }

      if (!phone || !phone.trim()) {
        return res.status(400).json({ success: false, error: 'Phone number is required.' });
      }

      db.prepare(`
        UPDATE suppliers SET
          name = ?,
          company_name = ?,
          contact_person = ?,
          phone = ?,
          email = ?,
          address = ?,
          gst_number = ?,
          payment_terms = ?,
          status = ?
        WHERE id = ?
      `).run(
        name.trim(),
        (company_name && company_name.trim()) ? company_name.trim() : name.trim(),
        contact_person ? contact_person.trim() : '',
        phone.trim(),
        email ? email.trim() : '',
        address ? address.trim() : '',
        gst_number ? gst_number.trim().toUpperCase() : '',
        payment_terms || existing.payment_terms || 'Net 15',
        status || existing.status || 'Active',
        id
      );

      logAudit(
        req.user.id,
        req.user.name,
        req.user.role,
        'UPDATE_SUPPLIER',
        'SUPPLIER',
        id,
        `Updated supplier profile #${id} (${name.trim()})`,
        req.ip
      );

      res.json({
        success: true,
        message: `Supplier "${name.trim()}" updated successfully!`
      });
    } catch (err) {
      console.error('Error updating supplier:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.6: RECORD SUPPLIER PAYMENT SETTLEMENT
  // -------------------------------------------------------------
  app.post('/api/suppliers/:id/pay', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, error: 'Valid supplier ID required.' });

      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
      if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found.' });

      const {
        amount,
        payment_mode = 'Bank Transfer',
        reference_no,
        payment_date,
        notes
      } = req.body;

      const payAmount = Number(amount);
      if (!payAmount || payAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero.' });
      }

      const pDate = payment_date || getTodayDate();
      const refCode = reference_no && reference_no.trim() ? reference_no.trim() : `PAY-${Date.now().toString().slice(-6)}`;
      const actor = req.user ? req.user.name : 'Administrator';

      db.exec('BEGIN');

      try {
        // 1. Record in supplier_payments
        const payResult = db.prepare(`
          INSERT INTO supplier_payments (
            supplier_id, payment_date, amount, payment_mode, reference_no, notes, recorded_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          pDate,
          payAmount,
          payment_mode,
          refCode,
          notes ? notes.trim() : `Settlement of ₹${payAmount}`,
          actor
        );

        const paymentId = Number(payResult.lastInsertRowid);

        // 2. Decrement balance_due
        db.prepare(`
          UPDATE suppliers
          SET balance_due = MAX(0, balance_due - ?)
          WHERE id = ?
        `).run(payAmount, id);

        const updatedSupplier = db.prepare('SELECT balance_due FROM suppliers WHERE id = ?').get(id);

        db.exec('COMMIT');

        logAudit(
          req.user.id,
          req.user.name,
          req.user.role,
          'PAY_SUPPLIER',
          'SUPPLIER',
          id,
          `Recorded payment of ₹${payAmount} to ${supplier.name} via ${payment_mode} (Ref: ${refCode}). Remaining due: ₹${updatedSupplier.balance_due}`,
          req.ip
        );

        res.json({
          success: true,
          id: paymentId,
          reference_no: refCode,
          new_balance_due: updatedSupplier.balance_due,
          message: `Payment of ₹${payAmount.toLocaleString('en-IN')} to "${supplier.name}" recorded successfully!`
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('Error recording supplier payment:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.7: GET SUPPLIER PURCHASES
  // -------------------------------------------------------------
  app.get('/api/suppliers/:id/purchases', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const purchases = db.prepare(`
        SELECT 
          p.*,
          COALESCE(b.name, 'Main Cold Store') as branch_name,
          (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count
        FROM purchases p
        LEFT JOIN branches b ON p.branch_id = b.id
        WHERE p.supplier_id = ?
        ORDER BY p.purchase_date DESC, p.id DESC
      `).all(id);

      res.json({ success: true, data: purchases });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.8: GET SUPPLIER RETURNS
  // -------------------------------------------------------------
  app.get('/api/suppliers/:id/returns', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const returns = db.prepare(`
        SELECT 
          sr.*,
          p.name as product_name,
          p.sku as product_sku,
          b.batch_number
        FROM supplier_returns sr
        JOIN products p ON sr.product_id = p.id
        LEFT JOIN batches b ON sr.batch_id = b.id
        WHERE sr.supplier_id = ?
        ORDER BY sr.return_date DESC, sr.id DESC
      `).all(id);

      res.json({ success: true, data: returns });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.9: GET SUPPLIER PAYMENTS
  // -------------------------------------------------------------
  app.get('/api/suppliers/:id/payments', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const payments = db.prepare(`
        SELECT * FROM supplier_payments
        WHERE supplier_id = ?
        ORDER BY payment_date DESC, id DESC
      `).all(id);

      res.json({ success: true, data: payments });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9.10: RECORD SUPPLIER RETURN (POST /api/suppliers/returns)
  // -------------------------------------------------------------
  app.post('/api/suppliers/returns', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const {
        supplier_id,
        purchase_id = null,
        product_id,
        batch_id,
        quantity,
        reason = 'Supplier Return',
        unit_cost
      } = req.body;

      const returnQty = Number(quantity);
      if (!supplier_id || !product_id || !batch_id || isNaN(returnQty) || returnQty <= 0) {
        return res.status(400).json({ success: false, error: 'Valid supplier, product, batch, and return quantity are required.' });
      }

      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id));
      if (!batch) {
        return res.status(404).json({ success: false, error: 'Batch not found.' });
      }

      if (batch.current_quantity < returnQty) {
        return res.status(400).json({ success: false, error: `Cannot return ${returnQty} units. Batch only has ${batch.current_quantity} remaining.` });
      }

      const costPerUnit = unit_cost !== undefined ? Number(unit_cost) : batch.purchase_cost;
      const totalReturnValue = Number((returnQty * costPerUnit).toFixed(2));
      const returnDate = getTodayDate();
      const returnNo = `SR-${Date.now().toString().slice(-4)}`;

      db.exec('BEGIN');
      try {
        // 1. Deduct stock from batch
        const newQty = batch.current_quantity - returnQty;
        const newStatus = newQty === 0 ? 'Depleted' : 'Active';
        db.prepare('UPDATE batches SET current_quantity = ?, status = ? WHERE id = ?').run(newQty, newStatus, batch.id);

        // 2. Insert into supplier_returns
        const returnRes = db.prepare(`
          INSERT INTO supplier_returns (
            return_no, supplier_id, purchase_id, product_id, batch_id, branch_id,
            quantity, unit_cost, total_return_value, reason, return_date, returned_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          returnNo,
          Number(supplier_id),
          purchase_id ? Number(purchase_id) : null,
          Number(product_id),
          batch.id,
          batch.branch_id || 1,
          returnQty,
          costPerUnit,
          totalReturnValue,
          reason.trim(),
          returnDate,
          req.user.name
        );

        // 3. Insert stock movement
        db.prepare(`
          INSERT INTO stock_movements (
            movement_type, product_id, batch_id, from_branch_id,
            quantity, reason, cost_impact, performed_by, movement_date
          ) VALUES ('Supplier Return', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          Number(product_id),
          batch.id,
          batch.branch_id || 1,
          returnQty,
          `Supplier Return #${returnNo}: ${reason}`,
          -totalReturnValue,
          req.user.name,
          returnDate
        );

        // 4. Reduce supplier balance_due if positive
        db.prepare('UPDATE suppliers SET balance_due = MAX(0, balance_due - ?) WHERE id = ?').run(totalReturnValue, Number(supplier_id));

        db.exec('COMMIT');

        logAudit(
          req.user.id,
          req.user.name,
          req.user.role,
          'SUPPLIER_RETURN_PROCESSED',
          'SUPPLIER',
          Number(supplier_id),
          `Processed supplier return ${returnNo} (${returnQty} units, ₹${totalReturnValue})`,
          req.ip
        );

        res.status(201).json({
          success: true,
          id: Number(returnRes.lastInsertRowid),
          return_no: returnNo,
          message: `Supplier return ${returnNo} recorded successfully.`
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

};
