// ====================================================================
// MODULE 10: CUSTOMER MANAGEMENT API ROUTES & LEDGER
// ====================================================================

const { db, logAudit, formatDate } = require('./db');
const { generateCustomerSalesReport } = require('./reports');

function getTodayDate() {
  return formatDate(new Date());
}

module.exports = function registerCustomerRoutes(app, authenticateToken, requireRole, optionalAuth) {

  // -------------------------------------------------------------
  // 10.1: CUSTOMER STATS & KPIS
  // -------------------------------------------------------------
  app.get('/api/customers/stats', optionalAuth, (req, res) => {
    try {
      // General customer breakdown
      const stats = db.prepare(`
        SELECT 
          COUNT(DISTINCT c.id) as total_customers,
          SUM(CASE WHEN c.status = 'Active' THEN 1 ELSE 0 END) as active_customers,
          SUM(CASE WHEN c.type = 'Retail' AND c.id != 5 THEN 1 ELSE 0 END) as retail_customers,
          SUM(CASE WHEN c.type = 'Wholesale' THEN 1 ELSE 0 END) as wholesale_customers,
          SUM(CASE WHEN c.type = 'Daily Subscription' THEN 1 ELSE 0 END) as subscription_customers,
          ROUND(COALESCE(SUM(c.credit_balance), 0), 2) as total_udhar_balance,
          COUNT(CASE WHEN c.credit_balance > 0 THEN 1 END) as customers_with_udhar,
          COALESCE(SUM(c.loyalty_points), 0) as total_loyalty_points
        FROM customers c
      `).get();

      // Sales analytics breakdown (Registered vs Walk-in)
      const salesRow = db.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          ROUND(COALESCE(SUM(net_amount), 0), 2) as lifetime_revenue,
          ROUND(COALESCE(SUM(CASE WHEN customer_id IS NOT NULL AND customer_id != 5 THEN net_amount ELSE 0 END), 0), 2) as registered_sales,
          ROUND(COALESCE(SUM(CASE WHEN customer_id IS NULL OR customer_id = 5 THEN net_amount ELSE 0 END), 0), 2) as walkin_sales,
          COUNT(CASE WHEN customer_id IS NOT NULL AND customer_id != 5 THEN 1 END) as registered_orders,
          COUNT(CASE WHEN customer_id IS NULL OR customer_id = 5 THEN 1 END) as walkin_orders
        FROM sales
      `).get();

      // Returns analytics
      const returnsRow = db.prepare(`
        SELECT 
          COUNT(*) as total_returns_count,
          ROUND(COALESCE(SUM(refund_amount), 0), 2) as total_returns_value,
          ROUND(COALESCE(SUM(quantity), 0), 2) as total_units_returned
        FROM customer_returns
      `).get();

      // Udhar payments collected
      const paymentsRow = db.prepare(`
        SELECT 
          COUNT(*) as total_payments_count,
          ROUND(COALESCE(SUM(amount), 0), 2) as total_collected_udhar
        FROM customer_payments
      `).get();

      const lifetimeRev = salesRow ? salesRow.lifetime_revenue : 0;
      const totalReturnsVal = returnsRow ? returnsRow.total_returns_value : 0;
      const netCustRevenue = Math.max(0, Number((lifetimeRev - totalReturnsVal).toFixed(2)));

      res.json({
        success: true,
        data: {
          total_customers: stats.total_customers || 0,
          active_customers: stats.active_customers || 0,
          retail_customers: stats.retail_customers || 0,
          wholesale_customers: stats.wholesale_customers || 0,
          subscription_customers: stats.subscription_customers || 0,
          total_udhar_balance: stats.total_udhar_balance || 0,
          customers_with_udhar: stats.customers_with_udhar || 0,
          total_loyalty_points: stats.total_loyalty_points || 0,
          total_orders: salesRow ? salesRow.total_orders : 0,
          lifetime_revenue: lifetimeRev,
          registered_sales: salesRow ? salesRow.registered_sales : 0,
          walkin_sales: salesRow ? salesRow.walkin_sales : 0,
          registered_orders: salesRow ? salesRow.registered_orders : 0,
          walkin_orders: salesRow ? salesRow.walkin_orders : 0,
          total_returns_count: returnsRow ? returnsRow.total_returns_count : 0,
          total_returns_value: totalReturnsVal,
          total_units_returned: returnsRow ? returnsRow.total_units_returned : 0,
          total_collected_udhar: paymentsRow ? paymentsRow.total_collected_udhar : 0,
          total_payments_count: paymentsRow ? paymentsRow.total_payments_count : 0,
          net_customer_revenue: netCustRevenue
        }
      });
    } catch (err) {
      console.error('Error fetching customer stats:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.2: EXCEL REPORT EXPORT (Placed before :id to prevent conflict)
  // -------------------------------------------------------------
  app.get('/api/customers/report', optionalAuth, (req, res) => {
    try {
      const buffer = generateCustomerSalesReport(req.query);
      const filename = `DairyTrack_Customer_Sales_Report_${getTodayDate()}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      console.error('Error exporting customer sales report:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.3: CUSTOMER RETURNS LIST (Placed before :id)
  // -------------------------------------------------------------
  app.get('/api/customers/returns', optionalAuth, (req, res) => {
    try {
      const {
        search,
        customer_id,
        product_id,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      let whereClauses = ['1=1'];
      const params = [];

      if (customer_id && customer_id !== 'all') {
        whereClauses.push('cr.customer_id = ?');
        params.push(Number(customer_id));
      }

      if (product_id && product_id !== 'all') {
        whereClauses.push('cr.product_id = ?');
        params.push(Number(product_id));
      }

      if (startDate) {
        whereClauses.push('cr.return_date >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereClauses.push('cr.return_date <= ?');
        params.push(endDate);
      }

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        whereClauses.push('(cr.return_no LIKE ? OR p.name LIKE ? OR c.name LIKE ? OR cr.reason LIKE ?)');
        params.push(term, term, term, term);
      }

      const whereSql = whereClauses.join(' AND ');

      const countRow = db.prepare(`
        SELECT COUNT(*) as total 
        FROM customer_returns cr
        LEFT JOIN customers c ON cr.customer_id = c.id
        LEFT JOIN products p ON cr.product_id = p.id
        WHERE ${whereSql}
      `).get(...params);

      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
      const queryParams = [...params, Number(limit), offset];

      const returns = db.prepare(`
        SELECT 
          cr.*,
          'CR-' || PRINTF('%04d', cr.id) as formatted_return_no,
          COALESCE(c.name, 'Walk-in Retail Customer') as customer_name,
          c.phone as customer_phone,
          c.type as customer_type,
          p.name as product_name,
          p.sku as product_sku,
          p.unit as product_unit,
          b.batch_number,
          b.expiry_date as batch_expiry,
          s.invoice_no as sale_invoice_no
        FROM customer_returns cr
        LEFT JOIN customers c ON cr.customer_id = c.id
        LEFT JOIN products p ON cr.product_id = p.id
        LEFT JOIN batches b ON cr.batch_id = b.id
        LEFT JOIN sales s ON cr.sale_id = s.id
        WHERE ${whereSql}
        ORDER BY cr.return_date DESC, cr.id DESC
        LIMIT ? OFFSET ?
      `).all(...queryParams);

      res.json({
        success: true,
        data: returns,
        pagination: {
          total: countRow ? countRow.total : 0,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil((countRow ? countRow.total : 0) / Number(limit))
        }
      });
    } catch (err) {
      console.error('Error fetching customer returns:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.4: RECORD CUSTOMER RETURN (POST /api/customers/returns)
  // Restores batch inventory, records stock movement, adjusts Udhar / refund
  // -------------------------------------------------------------
  app.post('/api/customers/returns', authenticateToken, (req, res) => {
    try {
      const {
        sale_id,
        customer_id,
        product_id,
        batch_id,
        quantity,
        unit_price,
        refund_amount,
        reason,
        refund_method = 'Cash',
        return_date,
        reduce_udhar = false
      } = req.body;

      const returnQty = Number(quantity);
      if (!returnQty || returnQty <= 0) {
        return res.status(400).json({ success: false, error: 'Valid positive return quantity is required.' });
      }

      if (!product_id) {
        return res.status(400).json({ success: false, error: 'Product is required.' });
      }

      const product = db.prepare('SELECT id, name, sku, unit, purchase_price, selling_price FROM products WHERE id = ?').get(Number(product_id));
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      // Determine batch to return stock into
      let targetBatch = null;
      if (batch_id) {
        targetBatch = db.prepare('SELECT id, batch_number, branch_id, current_quantity, purchase_cost FROM batches WHERE id = ?').get(Number(batch_id));
      }

      if (!targetBatch) {
        // Fallback: pick the latest active batch for this product
        targetBatch = db.prepare(`
          SELECT id, batch_number, branch_id, current_quantity, purchase_cost 
          FROM batches 
          WHERE product_id = ? 
          ORDER BY expiry_date DESC, id DESC 
          LIMIT 1
        `).get(Number(product_id));
      }

      // If still no batch exists, create a return recovery batch
      if (!targetBatch) {
        const batchNo = `BAT-RET-${Date.now().toString().slice(-6)}`;
        const expDate = formatDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
        const newBatchRes = db.prepare(`
          INSERT INTO batches (product_id, batch_number, branch_id, initial_quantity, current_quantity, purchase_cost, expiry_date, received_date)
          VALUES (?, ?, 1, 0, 0, ?, ?, ?)
        `).run(product.id, batchNo, product.purchase_price || 0, expDate, getTodayDate());
        targetBatch = {
          id: Number(newBatchRes.lastInsertRowid),
          batch_number: batchNo,
          branch_id: 1,
          current_quantity: 0,
          purchase_cost: product.purchase_price || 0
        };
      }

      const unitPriceVal = Number(unit_price) >= 0 ? Number(unit_price) : product.selling_price;
      const totalRefund = Number(refund_amount) >= 0 ? Number(refund_amount) : Number((returnQty * unitPriceVal).toFixed(2));
      const returnDateVal = return_date || getTodayDate();
      const returnNo = `CR-${Date.now().toString().slice(-4)}`;
      const processedBy = req.user && req.user.name ? req.user.name : 'Authorized Staff';

      let custId = customer_id ? Number(customer_id) : null;
      if (custId === 0) custId = null;

      // Begin atomic transaction
      db.exec('BEGIN');
      let returnId = null;

      try {
        // 1. Insert customer return record
        const insertReturn = db.prepare(`
          INSERT INTO customer_returns (
            return_no, sale_id, customer_id, product_id, batch_id,
            quantity, unit_price, refund_amount, reason, refund_method,
            return_date, processed_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          returnNo,
          sale_id ? Number(sale_id) : null,
          custId,
          product.id,
          targetBatch.id,
          returnQty,
          unitPriceVal,
          totalRefund,
          (reason || 'Customer Return').trim(),
          refund_method,
          returnDateVal,
          processedBy
        );

        returnId = Number(insertReturn.lastInsertRowid);

        // 2. Fetch current total stock before update
        const onHandRow = db.prepare('SELECT COALESCE(SUM(current_quantity), 0) as stock FROM batches WHERE product_id = ?').get(product.id);
        const prevTotalStock = Number(onHandRow ? onHandRow.stock : 0);
        const updatedTotalStock = prevTotalStock + returnQty;

        // 3. Restore batch current quantity
        db.prepare('UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?').run(returnQty, targetBatch.id);

        // 4. Record stock movement for reconciliation formula (Customer Return -> Inflow)
        db.prepare(`
          INSERT INTO stock_movements (
            movement_type, product_id, batch_id, from_branch_id, to_branch_id,
            quantity, unit, previous_stock, updated_stock, flow_type,
            reference_txn, reason, cost_impact, performed_by, movement_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'Customer Return',
          product.id,
          targetBatch.id,
          null,
          targetBatch.branch_id || 1,
          returnQty,
          product.unit || 'Units',
          prevTotalStock,
          updatedTotalStock,
          'Inflow',
          returnNo,
          `Customer Return #${returnNo}: ${(reason || 'Product returned by customer').trim()}`,
          totalRefund,
          processedBy,
          returnDateVal
        );

        // 5. If refund is Store Credit / Udhar Adjustment or reduce_udhar requested, reduce customer's credit_balance
        if (custId && (reduce_udhar || refund_method === 'Store Credit / Udhar Adjustment')) {
          db.prepare('UPDATE customers SET credit_balance = MAX(0, credit_balance - ?) WHERE id = ?').run(totalRefund, custId);

          // Also record payment settlement entry for audit clarity
          db.prepare(`
            INSERT INTO customer_payments (
              customer_id, payment_date, amount, payment_mode, reference_no, notes, received_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            custId,
            returnDateVal,
            totalRefund,
            'Credit Note / Return',
            returnNo,
            `Udhar credit reduction from return of ${returnQty} ${product.unit} ${product.name}`,
            processedBy
          );
        }

        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      logAudit(
        req.user ? req.user.id : null,
        processedBy,
        req.user ? req.user.role : 'Staff',
        'CUSTOMER_RETURN',
        'CUSTOMER_RETURN',
        returnId,
        `Recorded customer return #${returnNo}: ${returnQty} ${product.unit} of ${product.name} (Refund: ₹${totalRefund}, Method: ${refund_method})`,
        req.ip
      );

      res.json({
        success: true,
        id: returnId,
        return_no: returnNo,
        refund_amount: totalRefund,
        message: `Customer return recorded successfully! ${returnQty} ${product.unit} of ${product.name} restored to stock.`
      });
    } catch (err) {
      console.error('Error processing customer return:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.5: LIST CUSTOMERS (SEARCH, FILTER, SORT & METRICS)
  // -------------------------------------------------------------
  app.get('/api/customers', optionalAuth, (req, res) => {
    try {
      const {
        search,
        type, // 'all', 'Retail', 'Wholesale', 'Daily Subscription'
        status, // 'all', 'Active', 'Inactive'
        udhar, // 'all', 'due', 'clear'
        sort = 'name_asc',
        page = 1,
        limit = 50
      } = req.query;

      let whereClauses = ['1=1'];
      const params = [];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        whereClauses.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ?)');
        params.push(term, term, term, term);
      }

      if (type && type !== 'all') {
        whereClauses.push('c.type = ?');
        params.push(type);
      }

      if (status && status !== 'all') {
        whereClauses.push('c.status = ?');
        params.push(status);
      }

      if (udhar === 'due') {
        whereClauses.push('c.credit_balance > 0');
      } else if (udhar === 'clear') {
        whereClauses.push('(c.credit_balance <= 0 OR c.credit_balance IS NULL)');
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count query
      const countRow = db.prepare(`
        SELECT COUNT(*) as total 
        FROM customers c 
        WHERE ${whereSql}
      `).get(...params);

      // Sorting
      let orderBy = 'c.name ASC';
      switch (sort) {
        case 'name_desc':
          orderBy = 'c.name DESC';
          break;
        case 'spent_desc':
          orderBy = 'lifetime_spent DESC';
          break;
        case 'spent_asc':
          orderBy = 'lifetime_spent ASC';
          break;
        case 'balance_desc':
          orderBy = 'c.credit_balance DESC';
          break;
        case 'orders_desc':
          orderBy = 'order_count DESC';
          break;
        case 'recent':
          orderBy = 'c.id DESC';
          break;
        case 'name_asc':
        default:
          orderBy = 'c.name ASC';
          break;
      }

      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
      const queryParams = [...params, Number(limit), offset];

      const customers = db.prepare(`
        SELECT 
          c.*,
          'CUST-' || PRINTF('%04d', c.id) as formatted_cust_id,
          COUNT(DISTINCT s.id) as order_count,
          ROUND(COALESCE(SUM(DISTINCT s.net_amount), 0), 2) as lifetime_spent,
          MAX(s.sale_date) as last_order_date,
          COALESCE(ret.returns_count, 0) as total_returns_count,
          ROUND(COALESCE(ret.total_refunded, 0), 2) as total_returns_value,
          ROUND(COALESCE(SUM(DISTINCT s.net_amount), 0) - COALESCE(ret.total_refunded, 0), 2) as net_purchases
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id
        LEFT JOIN (
          SELECT customer_id, COUNT(*) as returns_count, SUM(refund_amount) as total_refunded
          FROM customer_returns
          GROUP BY customer_id
        ) ret ON c.id = ret.customer_id
        WHERE ${whereSql}
        GROUP BY c.id
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `).all(...queryParams);

      // Add average order value to each customer
      const enrichedCustomers = customers.map(c => {
        const orderCount = Number(c.order_count || 0);
        const spent = Number(c.lifetime_spent || 0);
        const avgOrder = orderCount > 0 ? Number((spent / orderCount).toFixed(2)) : 0;
        return {
          ...c,
          avg_order_value: avgOrder
        };
      });

      res.json({
        success: true,
        data: enrichedCustomers,
        pagination: {
          total: countRow ? countRow.total : 0,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil((countRow ? countRow.total : 0) / Number(limit))
        }
      });
    } catch (err) {
      console.error('Error fetching customers:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.6: GET 360° CUSTOMER PROFILE DETAILS (GET /api/customers/:id)
  // -------------------------------------------------------------
  app.get('/api/customers/:id', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Valid customer ID is required.' });
      }

      const customer = db.prepare(`
        SELECT 
          c.*,
          'CUST-' || PRINTF('%04d', c.id) as formatted_cust_id
        FROM customers c
        WHERE c.id = ?
      `).get(id);

      if (!customer) {
        return res.status(404).json({ success: false, error: 'Customer not found.' });
      }

      // Sales overview
      const salesOverview = db.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          ROUND(COALESCE(SUM(net_amount), 0), 2) as gross_sales,
          ROUND(COALESCE(SUM(discount_amount), 0), 2) as total_discounts,
          ROUND(COALESCE(SUM(tax_amount), 0), 2) as total_taxes,
          MAX(sale_date) as last_order_date,
          MIN(sale_date) as first_order_date
        FROM sales
        WHERE customer_id = ?
      `).get(id);

      // Returns overview
      const returnsOverview = db.prepare(`
        SELECT 
          COUNT(*) as returns_count,
          ROUND(COALESCE(SUM(refund_amount), 0), 2) as total_refund_amount,
          ROUND(COALESCE(SUM(quantity), 0), 2) as total_returned_qty
        FROM customer_returns
        WHERE customer_id = ?
      `).get(id);

      // Payments overview
      const paymentsOverview = db.prepare(`
        SELECT 
          COUNT(*) as payments_count,
          ROUND(COALESCE(SUM(amount), 0), 2) as total_payments_made,
          MAX(payment_date) as last_payment_date
        FROM customer_payments
        WHERE customer_id = ?
      `).get(id);

      const grossSales = salesOverview ? salesOverview.gross_sales : 0;
      const totalOrders = salesOverview ? salesOverview.total_orders : 0;
      const refundAmount = returnsOverview ? returnsOverview.total_refund_amount : 0;
      const netPurchases = Math.max(0, Number((grossSales - refundAmount).toFixed(2)));
      const avgOrder = totalOrders > 0 ? Number((grossSales / totalOrders).toFixed(2)) : 0;

      // Recent 20 sales transactions
      const recentSales = db.prepare(`
        SELECT 
          s.id,
          s.invoice_no,
          s.sale_date,
          s.payment_method,
          s.payment_status,
          s.net_amount,
          s.discount_amount,
          s.tax_amount,
          s.cashier_name,
          s.created_at,
          COUNT(si.id) as item_count
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.customer_id = ?
        GROUP BY s.id
        ORDER BY s.sale_date DESC, s.id DESC
        LIMIT 20
      `).all(id);

      // Customer Returns list
      const returns = db.prepare(`
        SELECT 
          cr.*,
          'CR-' || PRINTF('%04d', cr.id) as formatted_return_no,
          p.name as product_name,
          p.sku as product_sku,
          p.unit as product_unit,
          b.batch_number,
          s.invoice_no as sale_invoice_no
        FROM customer_returns cr
        JOIN products p ON cr.product_id = p.id
        LEFT JOIN batches b ON cr.batch_id = b.id
        LEFT JOIN sales s ON cr.sale_id = s.id
        WHERE cr.customer_id = ?
        ORDER BY cr.return_date DESC, cr.id DESC
      `).all(id);

      // Udhar Payment ledger
      const payments = db.prepare(`
        SELECT 
          cp.*,
          'PAY-' || PRINTF('%05d', cp.id) as formatted_payment_id
        FROM customer_payments cp
        WHERE cp.customer_id = ?
        ORDER BY cp.payment_date DESC, cp.id DESC
      `).all(id);

      // Top purchased dairy products
      const topProducts = db.prepare(`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.unit as product_unit,
          c.name as category_name,
          ROUND(SUM(si.quantity), 2) as total_quantity_bought,
          ROUND(SUM(si.total_price), 2) as total_spend
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE s.customer_id = ?
        GROUP BY p.id
        ORDER BY total_spend DESC
        LIMIT 5
      `).all(id);

      res.json({
        success: true,
        data: {
          customer,
          metrics: {
            gross_sales: grossSales,
            total_orders: totalOrders,
            net_purchases: netPurchases,
            avg_order_value: avgOrder,
            total_discounts: salesOverview ? salesOverview.total_discounts : 0,
            returns_count: returnsOverview ? returnsOverview.returns_count : 0,
            total_refund_amount: refundAmount,
            total_returned_qty: returnsOverview ? returnsOverview.total_returned_qty : 0,
            payments_count: paymentsOverview ? paymentsOverview.payments_count : 0,
            total_payments_made: paymentsOverview ? paymentsOverview.total_payments_made : 0,
            last_order_date: salesOverview ? salesOverview.last_order_date : null,
            first_order_date: salesOverview ? salesOverview.first_order_date : null,
            last_payment_date: paymentsOverview ? paymentsOverview.last_payment_date : null
          },
          recentSales,
          returns,
          payments,
          topProducts
        }
      });
    } catch (err) {
      console.error('Error fetching customer details:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.7: ADD NEW CUSTOMER (POST /api/customers)
  // -------------------------------------------------------------
  app.post('/api/customers', authenticateToken, (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        address,
        type = 'Retail',
        credit_balance = 0,
        status = 'Active',
        notes = ''
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Customer name is required.' });
      }

      if (!phone || !phone.trim()) {
        return res.status(400).json({ success: false, error: 'Mobile / Phone number is required.' });
      }

      const initialCredit = Number(credit_balance) || 0;

      const result = db.prepare(`
        INSERT INTO customers (
          name, phone, email, address, type, credit_balance, status, notes, loyalty_points
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        name.trim(),
        phone.trim(),
        (email || '').trim(),
        (address || '').trim(),
        type,
        initialCredit,
        status,
        (notes || '').trim()
      );

      const newId = Number(result.lastInsertRowid);
      const custCode = `CUST-${String(newId).padStart(4, '0')}`;

      logAudit(
        req.user ? req.user.id : null,
        req.user ? req.user.name : 'Staff',
        req.user ? req.user.role : 'Staff',
        'CUSTOMER_CREATE',
        'CUSTOMER',
        newId,
        `Created new customer ${custCode} (${name.trim()}, Type: ${type}, Phone: ${phone.trim()})`,
        req.ip
      );

      res.json({
        success: true,
        id: newId,
        customer_code: custCode,
        message: `Customer ${name.trim()} registered successfully with ID ${custCode}!`
      });
    } catch (err) {
      console.error('Error creating customer:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.8: EDIT / UPDATE CUSTOMER (PUT /api/customers/:id)
  // -------------------------------------------------------------
  app.put('/api/customers/:id', authenticateToken, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Valid customer ID is required.' });
      }

      const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Customer not found.' });
      }

      const {
        name,
        phone,
        email,
        address,
        type,
        status,
        credit_balance,
        notes
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Customer name is required.' });
      }

      if (!phone || !phone.trim()) {
        return res.status(400).json({ success: false, error: 'Phone number is required.' });
      }

      const updatedName = name.trim();
      const updatedPhone = phone.trim();
      const updatedEmail = email !== undefined ? email.trim() : existing.email;
      const updatedAddress = address !== undefined ? address.trim() : existing.address;
      const updatedType = type || existing.type;
      const updatedStatus = status || existing.status;
      const updatedCredit = credit_balance !== undefined ? Number(credit_balance) : existing.credit_balance;
      const updatedNotes = notes !== undefined ? notes.trim() : existing.notes;

      db.prepare(`
        UPDATE customers 
        SET name = ?, phone = ?, email = ?, address = ?, type = ?, status = ?, credit_balance = ?, notes = ?
        WHERE id = ?
      `).run(
        updatedName,
        updatedPhone,
        updatedEmail,
        updatedAddress,
        updatedType,
        updatedStatus,
        updatedCredit,
        updatedNotes,
        id
      );

      const custCode = `CUST-${String(id).padStart(4, '0')}`;

      logAudit(
        req.user ? req.user.id : null,
        req.user ? req.user.name : 'Staff',
        req.user ? req.user.role : 'Staff',
        'CUSTOMER_UPDATE',
        'CUSTOMER',
        id,
        `Updated customer profile ${custCode} (${updatedName})`,
        req.ip
      );

      res.json({
        success: true,
        message: `Customer ${updatedName} updated successfully!`
      });
    } catch (err) {
      console.error('Error updating customer:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.9: RECORD UDHAR PAYMENT SETTLEMENT (POST /api/customers/:id/pay-credit)
  // -------------------------------------------------------------
  app.post('/api/customers/:id/pay-credit', authenticateToken, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: 'Valid customer ID is required.' });
      }

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      if (!customer) {
        return res.status(404).json({ success: false, error: 'Customer not found.' });
      }

      const {
        amount,
        payment_mode = 'Cash',
        reference_no = '',
        notes = '',
        payment_date
      } = req.body;

      const payAmount = Number(amount);
      if (!payAmount || payAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid payment amount is required.' });
      }

      const payDate = payment_date || getTodayDate();
      const receivedBy = req.user ? req.user.name : 'Cashier';

      db.exec('BEGIN');
      let paymentId = null;

      try {
        // 1. Update customer credit balance
        db.prepare('UPDATE customers SET credit_balance = MAX(0, credit_balance - ?) WHERE id = ?').run(payAmount, id);

        // 2. Insert payment journal record
        const pResult = db.prepare(`
          INSERT INTO customer_payments (
            customer_id, payment_date, amount, payment_mode, reference_no, notes, received_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          payDate,
          payAmount,
          payment_mode,
          (reference_no || '').trim(),
          (notes || '').trim(),
          receivedBy
        );

        paymentId = Number(pResult.lastInsertRowid);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      const updatedBalance = Math.max(0, (customer.credit_balance || 0) - payAmount);

      logAudit(
        req.user ? req.user.id : null,
        receivedBy,
        req.user ? req.user.role : 'Staff',
        'UDHAR_PAYMENT',
        'CUSTOMER_PAYMENT',
        paymentId,
        `Collected Udhar payment ₹${payAmount} from ${customer.name} via ${payment_mode} (Remaining balance: ₹${updatedBalance.toFixed(2)})`,
        req.ip
      );

      res.json({
        success: true,
        payment_id: paymentId,
        amount_paid: payAmount,
        remaining_balance: updatedBalance,
        message: `Successfully recorded ₹${payAmount.toFixed(2)} Udhar payment for ${customer.name}!`
      });
    } catch (err) {
      console.error('Error recording Udhar payment:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10.10: SUB-RESOURCE ENDPOINTS FOR CUSTOMER PROFILE TABS
  // -------------------------------------------------------------
  // Purchases (Sales) for a customer
  app.get('/api/customers/:id/purchases', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const sales = db.prepare(`
        SELECT 
          s.*,
          b.name as branch_name,
          COUNT(si.id) as item_count
        FROM sales s
        LEFT JOIN branches b ON s.branch_id = b.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.customer_id = ?
        GROUP BY s.id
        ORDER BY s.sale_date DESC, s.id DESC
      `).all(id);

      res.json({ success: true, data: sales });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Returns for a customer
  app.get('/api/customers/:id/returns', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const returns = db.prepare(`
        SELECT 
          cr.*,
          'CR-' || PRINTF('%04d', cr.id) as formatted_return_no,
          p.name as product_name,
          p.sku as product_sku,
          p.unit as product_unit,
          b.batch_number,
          s.invoice_no as sale_invoice_no
        FROM customer_returns cr
        JOIN products p ON cr.product_id = p.id
        LEFT JOIN batches b ON cr.batch_id = b.id
        LEFT JOIN sales s ON cr.sale_id = s.id
        WHERE cr.customer_id = ?
        ORDER BY cr.return_date DESC, cr.id DESC
      `).all(id);

      res.json({ success: true, data: returns });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Payments for a customer
  app.get('/api/customers/:id/payments', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const payments = db.prepare(`
        SELECT 
          cp.*,
          'PAY-' || PRINTF('%05d', cp.id) as formatted_payment_id
        FROM customer_payments cp
        WHERE cp.customer_id = ?
        ORDER BY cp.payment_date DESC, cp.id DESC
      `).all(id);

      res.json({ success: true, data: payments });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

};
