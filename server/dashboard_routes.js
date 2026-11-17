const { db, formatDate, addDays } = require('./db');
const { cacheMiddleware } = require('./cache');

function getTodayDate() {
  return formatDate(new Date());
}

function calcPercentChange(current, previous) {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

module.exports = function registerDashboardRoutes(app, optionalAuth) {
  // -------------------------------------------------------------
  // MODULE 3.1 & 3.2: COMPLETE 10 KPI CARDS & INTERACTIVE CHARTS
  // -------------------------------------------------------------
  app.get('/api/dashboard/stats', optionalAuth, cacheMiddleware('dashboard:stats', 20), (req, res) => {
    try {
      const { branchId } = req.query;
      const branchFilter = branchId && branchId !== 'all' ? Number(branchId) : null;
      const today = getTodayDate();
      const now = new Date();
      const yesterday = formatDate(addDays(now, -1));
      const sevenDaysAgo = formatDate(addDays(now, -7));
      const thirtyDaysAgo = formatDate(addDays(now, -30));
      const startOfYear = `${now.getFullYear()}-01-01`;

      // 1. Today & Yesterday Stats
      let todayQuery = `
        SELECT 
          COUNT(DISTINCT s.id) as order_count,
          COALESCE(SUM(s.net_amount), 0) as revenue,
          COALESCE(SUM(s.total_cost), 0) as cogs,
          COALESCE(SUM(s.profit_earned), 0) as profit,
          COALESCE(SUM(si.quantity), 0) as qty_sold
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.sale_date = ?
      `;
      const todayParams = [today];
      if (branchFilter) {
        todayQuery += ' AND s.branch_id = ?';
        todayParams.push(branchFilter);
      }
      const todayStats = db.prepare(todayQuery).get(...todayParams);

      let yestQuery = `
        SELECT 
          COUNT(DISTINCT s.id) as order_count,
          COALESCE(SUM(s.net_amount), 0) as revenue,
          COALESCE(SUM(s.profit_earned), 0) as profit,
          COALESCE(SUM(si.quantity), 0) as qty_sold
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.sale_date = ?
      `;
      const yestParams = [yesterday];
      if (branchFilter) {
        yestQuery += ' AND s.branch_id = ?';
        yestParams.push(branchFilter);
      }
      const yestStats = db.prepare(yestQuery).get(...yestParams);

      // Total Products
      const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count;

      // Available Stock & Total Stock Value
      let stockQuery = `
        SELECT 
          COALESCE(SUM(b.current_quantity), 0) as total_units,
          COUNT(DISTINCT b.id) as batch_count,
          ROUND(COALESCE(SUM(b.current_quantity * p.purchase_price), 0), 2) as valuation
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.current_quantity > 0
      `;
      const stockParams = [];
      if (branchFilter) {
        stockQuery += ' AND b.branch_id = ?';
        stockParams.push(branchFilter);
      }
      const stockStats = db.prepare(stockQuery).get(...stockParams);

      // Low Stock & Out of Stock
      const stockStatusCounts = db.prepare(`
        SELECT 
          SUM(CASE WHEN current_stock <= min_stock_level AND current_stock > 0 THEN 1 ELSE 0 END) as low_stock,
          SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) as out_of_stock
        FROM (
          SELECT p.id, p.min_stock_level, COALESCE(SUM(b.current_quantity), 0) as current_stock
          FROM products p
          LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
          WHERE p.is_active = 1
          GROUP BY p.id
        )
      `).get();

      // Expired Products (units on shelf)
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

      // Damaged Products (historical and write-offs)
      let wasteQuery = `
        SELECT 
          COUNT(*) as log_count,
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

      // Exact 10 KPI Cards with comparisons & status colors
      const kpiCards = [
        {
          id: 'today_sales',
          title: "Today's Total Sales",
          value: todayStats.order_count,
          unit: "Orders",
          prevValue: yestStats.order_count,
          changePercent: calcPercentChange(todayStats.order_count, yestStats.order_count),
          trend: todayStats.order_count >= yestStats.order_count ? "up" : "down",
          color: "primary",
          icon: "receipt"
        },
        {
          id: 'today_revenue',
          title: "Today's Revenue",
          value: todayStats.revenue,
          isCurrency: true,
          prevValue: yestStats.revenue,
          changePercent: calcPercentChange(todayStats.revenue, yestStats.revenue),
          trend: todayStats.revenue >= yestStats.revenue ? "up" : "down",
          color: "primary",
          icon: "dollar"
        },
        {
          id: 'total_products',
          title: "Total Products",
          value: totalProducts,
          unit: "SKUs",
          subtext: "Active in Catalog",
          trend: "neutral",
          color: "info",
          icon: "box"
        },
        {
          id: 'total_qty_sold',
          title: "Total Quantity Sold",
          value: todayStats.qty_sold,
          unit: "Units Today",
          prevValue: yestStats.qty_sold,
          changePercent: calcPercentChange(todayStats.qty_sold, yestStats.qty_sold),
          trend: todayStats.qty_sold >= yestStats.qty_sold ? "up" : "down",
          color: "success",
          icon: "shopping-bag"
        },
        {
          id: 'available_stock',
          title: "Available Stock",
          value: stockStats.total_units,
          unit: "Units",
          subtext: `${stockStats.batch_count} Active Batches`,
          trend: "neutral",
          color: "info",
          icon: "layers"
        },
        {
          id: 'gross_profit',
          title: "Estimated Gross Profit",
          value: todayStats.profit,
          isCurrency: true,
          prevValue: yestStats.profit,
          changePercent: calcPercentChange(todayStats.profit, yestStats.profit),
          trend: todayStats.profit >= yestStats.profit ? "up" : "down",
          color: "success",
          icon: "trending-up"
        },
        {
          id: 'low_stock',
          title: "Low Stock Products",
          value: stockStatusCounts.low_stock || 0,
          unit: "Items",
          subtext: "Below Reorder Level",
          trend: (stockStatusCounts.low_stock || 0) > 0 ? "down" : "neutral",
          color: "warning",
          icon: "alert-triangle"
        },
        {
          id: 'expired_products',
          title: "Expired Products",
          value: expiredStats.units,
          unit: "Units on Shelf",
          subtext: `${expiredStats.batch_count} Batches (₹${expiredStats.loss_value})`,
          trend: expiredStats.units > 0 ? "down" : "neutral",
          color: "danger",
          icon: "clock"
        },
        {
          id: 'damaged_products',
          title: "Damaged Products",
          value: wasteStats.units,
          unit: "Units Spoiled",
          subtext: `Loss: ₹${wasteStats.total_loss}`,
          trend: "down",
          color: "danger",
          icon: "trash"
        },
        {
          id: 'total_stock_value',
          title: "Total Stock Value",
          value: stockStats.valuation,
          isCurrency: true,
          subtext: "Valuation at Cost",
          trend: "up",
          color: "primary",
          icon: "archive"
        }
      ];

      // 3.2 CHARTS DATA

      // 1. Sales Overview (Daily, Weekly, Monthly, Yearly)
      const dailySales = db.prepare(`
        SELECT 
          strftime('%H:00', created_at) as label,
          ROUND(SUM(net_amount), 2) as revenue,
          ROUND(SUM(profit_earned), 2) as profit,
          COUNT(*) as orders
        FROM sales
        WHERE sale_date = ?
        GROUP BY label
        ORDER BY label ASC
      `).all(today);

      const weeklySales = db.prepare(`
        SELECT 
          sale_date as label,
          ROUND(SUM(net_amount), 2) as revenue,
          ROUND(SUM(total_cost), 2) as cogs,
          ROUND(SUM(profit_earned), 2) as profit,
          COUNT(*) as orders
        FROM sales
        WHERE sale_date >= ?
        GROUP BY sale_date
        ORDER BY sale_date ASC
      `).all(sevenDaysAgo);

      const monthlySales = db.prepare(`
        SELECT 
          sale_date as label,
          ROUND(SUM(net_amount), 2) as revenue,
          ROUND(SUM(total_cost), 2) as cogs,
          ROUND(SUM(profit_earned), 2) as profit,
          COUNT(*) as orders
        FROM sales
        WHERE sale_date >= ?
        GROUP BY sale_date
        ORDER BY sale_date ASC
      `).all(thirtyDaysAgo);

      const yearlySales = db.prepare(`
        SELECT 
          strftime('%Y-%m', sale_date) as label,
          ROUND(SUM(net_amount), 2) as revenue,
          ROUND(SUM(total_cost), 2) as cogs,
          ROUND(SUM(profit_earned), 2) as profit,
          COUNT(*) as orders
        FROM sales
        WHERE sale_date >= ?
        GROUP BY strftime('%Y-%m', sale_date)
        ORDER BY label ASC
      `).all(startOfYear);

      // 2. Product Performance
      const topFiveSelling = db.prepare(`
        SELECT 
          p.id, p.name, p.unit, c.name as category,
          ROUND(SUM(si.quantity), 1) as units_sold,
          ROUND(SUM(si.total_price), 2) as revenue,
          ROUND(SUM(si.profit), 2) as profit
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        GROUP BY p.id
        ORDER BY units_sold DESC
        LIMIT 5
      `).all();

      const lowestSelling = db.prepare(`
        SELECT 
          p.id, p.name, p.unit, c.name as category,
          COALESCE(SUM(si.quantity), 0) as units_sold,
          COALESCE(SUM(b.current_quantity), 0) as stock_on_hand,
          p.selling_price
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN sale_items si ON p.id = si.product_id
        LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
        GROUP BY p.id
        ORDER BY units_sold ASC, stock_on_hand DESC
        LIMIT 5
      `).all();

      const categoryWiseSales = db.prepare(`
        SELECT 
          c.name as category,
          ROUND(SUM(si.total_price), 2) as revenue,
          ROUND(SUM(si.quantity), 1) as quantity
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        GROUP BY c.id
        ORDER BY revenue DESC
      `).all();

      // 3. Inventory Overview Stats
      const inventoryOverview = {
        availableUnits: stockStats.total_units,
        lowStockCount: stockStatusCounts.low_stock || 0,
        outOfStockCount: stockStatusCounts.out_of_stock || 0,
        expiredUnits: expiredStats.units
      };

      // 4. Profit Analysis Stats
      const allTimeTotals = db.prepare(`
        SELECT 
          COALESCE(SUM(net_amount), 0) as total_revenue,
          COALESCE(SUM(total_cost), 0) as total_cogs,
          COALESCE(SUM(profit_earned), 0) as total_gross_profit
        FROM sales
      `).get();

      const profitAnalysis = {
        revenue: allTimeTotals.total_revenue,
        cogs: allTimeTotals.total_cogs,
        grossProfit: allTimeTotals.total_gross_profit,
        wastageCost: wasteStats.total_loss,
        netEarnings: allTimeTotals.total_gross_profit - wasteStats.total_loss,
        marginPercent: allTimeTotals.total_revenue > 0 
          ? Number(((allTimeTotals.total_gross_profit / allTimeTotals.total_revenue) * 100).toFixed(1))
          : 0
      };

      res.json({
        success: true,
        data: {
          kpiCards,
          salesOverview: {
            daily: dailySales,
            weekly: weeklySales,
            monthly: monthlySales,
            yearly: yearlySales
          },
          productPerformance: {
            topFive: topFiveSelling,
            lowestFive: lowestSelling,
            categorySales: categoryWiseSales
          },
          inventoryOverview,
          profitAnalysis
        }
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // MODULE 3.3: RECENT TRANSACTIONS (Multi-Type Feed with Search, Sorting & Pagination)
  // -------------------------------------------------------------
  app.get('/api/dashboard/transactions', optionalAuth, (req, res) => {
    try {
      const { type, search, startDate, endDate, sort, page = 1, limit = 8 } = req.query;
      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(50, Math.max(1, Number(limit)));
      const offset = (pageNum - 1) * limitNum;

      const items = [];

      // 1. Sales
      if (!type || type === 'all' || type === 'sales') {
        let q = `
          SELECT 
            s.id, 'Sale' as type, s.invoice_no as ref_no, s.sale_date as date,
            COALESCE(c.name, 'Walk-in Retail') as party,
            s.net_amount as amount, s.payment_method as details,
            s.payment_status as status, s.cashier_name as operator,
            s.created_at
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE 1=1
        `;
        const p = [];
        if (startDate) { q += ' AND s.sale_date >= ?'; p.push(startDate); }
        if (endDate) { q += ' AND s.sale_date <= ?'; p.push(endDate); }
        if (search) {
          q += ' AND (s.invoice_no LIKE ? OR c.name LIKE ?)';
          p.push(`%${search}%`, `%${search}%`);
        }
        const sales = db.prepare(q).all(...p);
        items.push(...sales);
      }

      // 2. Purchases
      if (!type || type === 'all' || type === 'purchases') {
        let q = `
          SELECT 
            p.id, 'Purchase' as type, p.invoice_no as ref_no, p.purchase_date as date,
            s.name as party,
            p.net_amount as amount, p.payment_method as details,
            p.payment_status as status, p.created_by as operator,
            p.created_at
          FROM purchases p
          JOIN suppliers s ON p.supplier_id = s.id
          WHERE 1=1
        `;
        const p = [];
        if (startDate) { q += ' AND p.purchase_date >= ?'; p.push(startDate); }
        if (endDate) { q += ' AND p.purchase_date <= ?'; p.push(endDate); }
        if (search) {
          q += ' AND (p.invoice_no LIKE ? OR s.name LIKE ?)';
          p.push(`%${search}%`, `%${search}%`);
        }
        const purchases = db.prepare(q).all(...p);
        items.push(...purchases);
      }

      // 3. Stock Adjustments & Transfers
      if (!type || type === 'all' || type === 'adjustments') {
        let q = `
          SELECT 
            sm.id, sm.movement_type as type, ('MOV-#' || sm.id) as ref_no, sm.movement_date as date,
            (pr.name || ' (' || sm.quantity || ' ' || pr.unit || ')') as party,
            sm.cost_impact as amount, sm.reason as details,
            'Completed' as status, sm.performed_by as operator,
            sm.created_at
          FROM stock_movements sm
          JOIN products pr ON sm.product_id = pr.id
          WHERE sm.movement_type IN ('Transfer', 'Adjustment')
        `;
        const p = [];
        if (startDate) { q += ' AND sm.movement_date >= ?'; p.push(startDate); }
        if (endDate) { q += ' AND sm.movement_date <= ?'; p.push(endDate); }
        if (search) {
          q += ' AND (pr.name LIKE ? OR sm.reason LIKE ?)';
          p.push(`%${search}%`, `%${search}%`);
        }
        const adjs = db.prepare(q).all(...p);
        items.push(...adjs);
      }

      // 4. Returns & Spoilage Write-Offs
      if (!type || type === 'all' || type === 'returns') {
        let q = `
          SELECT 
            w.id, 'Damage / Return' as type, ('WST-#' || w.id) as ref_no, w.recorded_date as date,
            (pr.name || ' (' || w.quantity || ' ' || pr.unit || ')') as party,
            w.total_loss_value as amount, (w.reason || ' - ' || w.action_taken) as details,
            w.action_taken as status, w.recorded_by as operator,
            w.created_at
          FROM waste_damaged w
          JOIN products pr ON w.product_id = pr.id
          WHERE 1=1
        `;
        const p = [];
        if (startDate) { q += ' AND w.recorded_date >= ?'; p.push(startDate); }
        if (endDate) { q += ' AND w.recorded_date <= ?'; p.push(endDate); }
        if (search) {
          q += ' AND (pr.name LIKE ? OR w.reason LIKE ?)';
          p.push(`%${search}%`, `%${search}%`);
        }
        const returns = db.prepare(q).all(...p);
        items.push(...returns);
      }

      // Sorting
      if (sort === 'amount_desc') {
        items.sort((a, b) => b.amount - a.amount);
      } else if (sort === 'amount_asc') {
        items.sort((a, b) => a.amount - b.amount);
      } else if (sort === 'oldest') {
        items.sort((a, b) => new Date(a.date) - new Date(b.date));
      } else {
        items.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
      }

      const totalCount = items.length;
      const paginatedItems = items.slice(offset, offset + limitNum);
      const totalPages = Math.ceil(totalCount / limitNum) || 1;

      res.json({
        success: true,
        data: paginatedItems,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages
        }
      });
    } catch (err) {
      console.error('Error fetching transactions:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // MODULE 3.4: QUICK ACTIONS ENDPOINTS
  // -------------------------------------------------------------

  // Quick Action: Add Stock / Top-Up Batch
  app.post('/api/dashboard/quick-actions/add-stock', optionalAuth, (req, res) => {
    try {
      const {
        product_id,
        batch_number,
        quantity,
        purchase_cost,
        branch_id = 1,
        mfg_date,
        expiry_date,
        notes
      } = req.body;

      if (!product_id || !quantity || quantity <= 0) {
        return res.status(400).json({ success: false, error: 'Product ID and valid positive quantity are required.' });
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      const today = getTodayDate();
      const finalMfg = mfg_date || today;
      let finalExp = expiry_date;
      if (!finalExp) {
        finalExp = formatDate(addDays(new Date(finalMfg), product.shelf_life_days || 7));
      }

      const cost = purchase_cost !== undefined ? Number(purchase_cost) : product.purchase_price;
      const bNum = batch_number || `BATCH-${Date.now().toString().slice(-6)}`;

      // Insert or update batch
      const result = db.prepare(`
        INSERT INTO batches (
          product_id, branch_id, batch_number, mfg_date, expiry_date,
          initial_quantity, current_quantity, purchase_cost, selling_price, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
      `).run(
        product_id,
        branch_id,
        bNum,
        finalMfg,
        finalExp,
        quantity,
        quantity,
        cost,
        product.selling_price
      );

      const batchId = result.lastInsertRowid;

      // Log stock movement
      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, to_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Adjustment', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product_id,
        batchId,
        branch_id,
        quantity,
        notes || 'Quick Add Stock via Dashboard',
        Number((quantity * cost).toFixed(2)),
        req.user?.name || 'Administrator',
        today
      );

      // Audit Log
      db.prepare(`
        INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, 'QUICK_ADD_STOCK', 'batch', ?, ?)
      `).run(
        req.user?.id || 1,
        req.user?.name || 'Administrator',
        req.user?.role || 'Administrator',
        String(batchId),
        `Quick added ${quantity} ${product.unit} of ${product.name} (Batch ${bNum})`
      );

      res.json({
        success: true,
        message: `Successfully added ${quantity} units of ${product.name}`,
        data: { batch_id: batchId, batch_number: bNum, quantity }
      });
    } catch (err) {
      console.error('Error in quick add stock:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Quick Action: Record Stock Loss (Expired / Damaged)
  app.post('/api/dashboard/quick-actions/record-loss', optionalAuth, (req, res) => {
    try {
      const {
        product_id,
        batch_id,
        quantity,
        reason = 'Expired',
        action_taken = 'Discarded',
        notes
      } = req.body;

      if (!product_id || !batch_id || !quantity || quantity <= 0) {
        return res.status(400).json({ success: false, error: 'Product ID, Batch ID, and valid loss quantity are required.' });
      }

      const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND product_id = ?').get(batch_id, product_id);
      if (!batch) {
        return res.status(404).json({ success: false, error: 'Specified batch not found for this product.' });
      }

      if (batch.current_quantity < quantity) {
        return res.status(400).json({
          success: false,
          error: `Cannot record loss of ${quantity} units. Batch only has ${batch.current_quantity} available.`
        });
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
      const today = getTodayDate();
      const lossValue = Number((quantity * batch.purchase_cost).toFixed(2));

      // Deduct batch quantity
      const newQty = batch.current_quantity - quantity;
      const newStatus = newQty === 0 ? 'Depleted' : batch.status;
      db.prepare('UPDATE batches SET current_quantity = ?, status = ? WHERE id = ?').run(newQty, newStatus, batch_id);

      // Record in waste_damaged
      const wasteResult = db.prepare(`
        INSERT INTO waste_damaged (
          product_id, batch_id, branch_id, quantity, unit_cost,
          total_loss_value, reason, action_taken, recorded_date, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product_id,
        batch_id,
        batch.branch_id,
        quantity,
        batch.purchase_cost,
        lossValue,
        reason,
        action_taken,
        today,
        req.user?.name || 'Administrator'
      );

      // Record stock movement (Damage)
      db.prepare(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id,
          quantity, reason, cost_impact, performed_by, movement_date
        ) VALUES ('Damage', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product_id,
        batch_id,
        batch.branch_id,
        quantity,
        `${reason} - ${notes || action_taken}`,
        lossValue,
        req.user?.name || 'Administrator',
        today
      );

      // Audit Log
      db.prepare(`
        INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, 'RECORD_STOCK_LOSS', 'waste_damaged', ?, ?)
      `).run(
        req.user?.id || 1,
        req.user?.name || 'Administrator',
        req.user?.role || 'Administrator',
        String(wasteResult.lastInsertRowid),
        `Recorded loss of ${quantity} units of ${product.name} (Batch ${batch.batch_number}). Loss value: ₹${lossValue}`
      );

      res.json({
        success: true,
        message: `Recorded ${quantity} units loss for ${product.name}. Financial loss: ₹${lossValue}`,
        data: {
          waste_id: wasteResult.lastInsertRowid,
          product_name: product.name,
          quantity,
          loss_value: lossValue,
          remaining_batch_qty: newQty
        }
      });
    } catch (err) {
      console.error('Error in quick record loss:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
};
