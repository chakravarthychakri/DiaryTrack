const XLSX = require('xlsx');
const { db, formatDate } = require('./db');

// Helper to convert array of objects into an Excel worksheet with column widths
function createSheetWithWidths(data, colWidths = {}) {
  const ws = XLSX.utils.json_to_sheet(data);
  const keys = data.length > 0 ? Object.keys(data[0]) : [];
  ws['!cols'] = keys.map(k => ({
    wch: colWidths[k] || Math.max(k.length + 4, 12)
  }));
  return ws;
}

// 1. Sales Report
function generateSalesReport({ startDate, endDate, branchId }) {
  let query = `
    SELECT 
      s.invoice_no AS [Invoice No],
      s.sale_date AS [Date],
      COALESCE(c.name, 'Walk-in Retail') AS [Customer],
      b.name AS [Branch],
      s.total_amount AS [Subtotal (₹)],
      s.discount_amount AS [Discount (₹)],
      s.tax_amount AS [Tax (₹)],
      s.net_amount AS [Net Amount (₹)],
      s.total_cost AS [Cost Goods Sold (₹)],
      s.profit_earned AS [Profit (₹)],
      s.payment_method AS [Payment Method],
      s.payment_status AS [Status],
      s.cashier_name AS [Cashier]
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN branches b ON s.branch_id = b.id
    WHERE 1=1
  `;
  const params = [];
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
  query += ' ORDER BY s.sale_date DESC, s.id DESC';

  const rows = db.prepare(query).all(...params);

  const wb = XLSX.utils.book_new();
  const ws = createSheetWithWidths(rows, {
    'Invoice No': 16,
    'Date': 14,
    'Customer': 26,
    'Branch': 24,
    'Net Amount (₹)': 16,
    'Profit (₹)': 14
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Sales & Profits');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 2. Inventory Valuation Report
function generateInventoryReport({ branchId }) {
  let query = `
    SELECT 
      p.sku AS [SKU],
      p.name AS [Product Name],
      c.name AS [Category],
      p.unit AS [Unit],
      COALESCE(SUM(b.current_quantity), 0) AS [Current Stock],
      p.min_stock_level AS [Min Threshold],
      p.purchase_price AS [Cost Price (₹)],
      p.selling_price AS [Selling Price (₹)],
      ROUND(COALESCE(SUM(b.current_quantity), 0) * p.purchase_price, 2) AS [Inventory Valuation (₹)],
      ROUND(COALESCE(SUM(b.current_quantity), 0) * p.selling_price, 2) AS [Retail Potential (₹)],
      CASE 
        WHEN COALESCE(SUM(b.current_quantity), 0) <= p.min_stock_level THEN 'LOW STOCK ALERT'
        ELSE 'OPTIMAL'
      END AS [Stock Health]
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
  `;
  const params = [];
  if (branchId && branchId !== 'all') {
    query += ' AND b.branch_id = ?';
    params.push(Number(branchId));
  }
  query += `
    GROUP BY p.id
    ORDER BY c.name ASC, p.name ASC
  `;

  const rows = db.prepare(query).all(...params);

  // Also query active batches breakdown
  const batchQuery = `
    SELECT 
      b.batch_number AS [Batch No],
      p.name AS [Product],
      br.name AS [Branch],
      b.mfg_date AS [Mfg Date],
      b.expiry_date AS [Expiry Date],
      b.current_quantity AS [Quantity Available],
      p.unit AS [Unit],
      b.purchase_cost AS [Unit Cost (₹)],
      ROUND(b.current_quantity * b.purchase_cost, 2) AS [Batch Value (₹)],
      b.status AS [Batch Status]
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN branches br ON b.branch_id = br.id
    WHERE b.current_quantity > 0
    ORDER BY b.expiry_date ASC
  `;
  const batchRows = db.prepare(batchQuery).all();

  const wb = XLSX.utils.book_new();
  const wsInv = createSheetWithWidths(rows, {
    'SKU': 16,
    'Product Name': 32,
    'Category': 20,
    'Inventory Valuation (₹)': 22,
    'Stock Health': 18
  });
  const wsBatches = createSheetWithWidths(batchRows, {
    'Batch No': 18,
    'Product': 30,
    'Branch': 24,
    'Expiry Date': 14
  });

  XLSX.utils.book_append_sheet(wb, wsInv, 'Stock Valuation');
  XLSX.utils.book_append_sheet(wb, wsBatches, 'Batch Expiry Detail');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 3. Expiry and Waste Loss Report (Module 11)
function generateWasteReport(filters = {}) {
  const { startDate, endDate, waste_type, productId, branchId } = filters;
  let whereClauses = ['1=1'];
  const params = [];

  if (startDate) {
    whereClauses.push('w.recorded_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('w.recorded_date <= ?');
    params.push(endDate);
  }
  if (waste_type && waste_type !== 'all') {
    whereClauses.push('w.waste_type = ?');
    params.push(waste_type);
  }
  if (productId && productId !== 'all') {
    whereClauses.push('w.product_id = ?');
    params.push(Number(productId));
  }
  if (branchId && branchId !== 'all') {
    whereClauses.push('w.branch_id = ?');
    params.push(Number(branchId));
  }

  const whereSql = whereClauses.join(' AND ');

  // Sheet 1: Wastage & Loss Journal
  const query = `
    SELECT 
      w.recorded_date AS [Loss Date],
      'WST-' || PRINTF('%04d', w.id) AS [Voucher ID],
      p.name AS [Product],
      p.sku AS [SKU],
      c.name AS [Category],
      COALESCE(b.batch_number, 'Direct Batch') AS [Batch No],
      br.name AS [Branch],
      w.waste_type AS [Wastage Type],
      w.quantity AS [Quantity Lost],
      COALESCE(w.unit, p.unit) AS [Unit],
      w.unit_cost AS [Cost per Unit (₹)],
      w.total_loss_value AS [Financial Loss (₹)],
      w.reason AS [Reason for Loss],
      w.action_taken AS [Action / Disposal],
      w.recorded_by AS [Recorded By]
    FROM waste_damaged w
    JOIN products p ON w.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN batches b ON w.batch_id = b.id
    JOIN branches br ON w.branch_id = br.id
    WHERE ${whereSql}
    ORDER BY w.recorded_date DESC, w.id DESC
  `;
  const rows = db.prepare(query).all(...params);

  // Sheet 2: Current Expiry Risks
  const today = formatDate(new Date());
  const riskQuery = `
    SELECT 
      b.batch_number AS [Batch No],
      p.name AS [Product],
      p.sku AS [SKU],
      c.name AS [Category],
      br.name AS [Branch],
      b.expiry_date AS [Expiry Date],
      CASE 
        WHEN b.expiry_date < '${today}' THEN 'Already Expired (' || CAST(JULIANDAY('${today}') - JULIANDAY(b.expiry_date) AS INTEGER) || 'd ago)'
        WHEN b.expiry_date = '${today}' THEN 'Expiring Today'
        ELSE CAST(JULIANDAY(b.expiry_date) - JULIANDAY('${today}') AS INTEGER) || ' days left'
      END AS [Shelf-Life Status],
      b.current_quantity AS [Sitting Stock],
      p.unit AS [Unit],
      b.purchase_cost AS [Cost Price (₹)],
      p.selling_price AS [Retail Price (₹)],
      ROUND(b.current_quantity * b.purchase_cost, 2) AS [Loss Exposure (₹)]
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN branches br ON b.branch_id = br.id
    WHERE b.current_quantity > 0 AND b.expiry_date <= DATE('${today}', '+7 days')
    ORDER BY b.expiry_date ASC, [Loss Exposure (₹)] DESC
  `;
  const riskRows = db.prepare(riskQuery).all();

  // Sheet 3: Loss Summary by Type & Category
  const summaryTypeQuery = `
    SELECT 
      w.waste_type AS [Wastage Type],
      COUNT(*) AS [Total Incidents],
      ROUND(SUM(w.quantity), 2) AS [Total Units Lost],
      ROUND(SUM(w.total_loss_value), 2) AS [Total Financial Loss (₹)]
    FROM waste_damaged w
    GROUP BY w.waste_type
    ORDER BY [Total Financial Loss (₹)] DESC
  `;
  const summaryTypeRows = db.prepare(summaryTypeQuery).all();

  const wb = XLSX.utils.book_new();

  const ws = createSheetWithWidths(rows, {
    'Loss Date': 14,
    'Voucher ID': 14,
    'Product': 30,
    'SKU': 14,
    'Category': 18,
    'Batch No': 16,
    'Branch': 22,
    'Wastage Type': 16,
    'Quantity Lost': 14,
    'Financial Loss (₹)': 18,
    'Reason for Loss': 28,
    'Action / Disposal': 24,
    'Recorded By': 18
  });

  const wsRisks = createSheetWithWidths(riskRows, {
    'Batch No': 16,
    'Product': 30,
    'Category': 18,
    'Expiry Date': 14,
    'Shelf-Life Status': 22,
    'Sitting Stock': 14,
    'Loss Exposure (₹)': 18
  });

  const wsSummary = createSheetWithWidths(summaryTypeRows, {
    'Wastage Type': 20,
    'Total Incidents': 16,
    'Total Units Lost': 18,
    'Total Financial Loss (₹)': 24
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Wastage Journal');
  XLSX.utils.book_append_sheet(wb, wsRisks, 'Current Expiry Risks');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Loss Summary by Type');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 4. Purchases and Supplier Ledger Report
function generatePurchasesReport(filters = {}) {
  const { startDate, endDate, branchId, supplierId, status } = filters;
  let query = `
    SELECT 
      p.invoice_no AS [PO Number],
      p.purchase_date AS [Date],
      s.name AS [Supplier],
      s.phone AS [Supplier Phone],
      br.name AS [Receiving Branch],
      p.status AS [Order Status],
      p.total_amount AS [Gross Amount (₹)],
      p.tax_amount AS [Tax (₹)],
      p.discount_amount AS [Discount (₹)],
      p.net_amount AS [Net Amount (₹)],
      p.payment_status AS [Payment Status],
      p.payment_method AS [Payment Method],
      p.received_at AS [Received Date],
      p.received_by AS [Received By],
      p.created_by AS [Created By],
      p.notes AS [Notes]
    FROM purchases p
    JOIN suppliers s ON p.supplier_id = s.id
    JOIN branches br ON p.branch_id = br.id
    WHERE 1=1
  `;
  const params = [];
  if (startDate) {
    query += ' AND p.purchase_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND p.purchase_date <= ?';
    params.push(endDate);
  }
  if (supplierId && supplierId !== 'all') {
    query += ' AND p.supplier_id = ?';
    params.push(Number(supplierId));
  }
  if (status && status !== 'all') {
    query += ' AND p.status = ?';
    params.push(status);
  }
  if (branchId && branchId !== 'all') {
    query += ' AND p.branch_id = ?';
    params.push(Number(branchId));
  }
  query += ' ORDER BY p.purchase_date DESC, p.id DESC';
  const rows = db.prepare(query).all(...params);

  // Sheet 2: Line items breakdown
  let itemsQuery = `
    SELECT 
      p.invoice_no AS [PO Number],
      p.purchase_date AS [Date],
      s.name AS [Supplier],
      prod.name AS [Product],
      prod.sku AS [SKU],
      pi.batch_number AS [Batch Number],
      pi.mfg_date AS [Mfg Date],
      pi.expiry_date AS [Expiry Date],
      pi.quantity AS [Quantity],
      prod.unit AS [Unit],
      pi.unit_cost AS [Unit Cost (₹)],
      pi.total_cost AS [Line Total (₹)]
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    JOIN suppliers s ON p.supplier_id = s.id
    JOIN products prod ON pi.product_id = prod.id
    WHERE 1=1
  `;
  const itemParams = [];
  if (startDate) {
    itemsQuery += ' AND p.purchase_date >= ?';
    itemParams.push(startDate);
  }
  if (endDate) {
    itemsQuery += ' AND p.purchase_date <= ?';
    itemParams.push(endDate);
  }
  if (supplierId && supplierId !== 'all') {
    itemsQuery += ' AND p.supplier_id = ?';
    itemParams.push(Number(supplierId));
  }
  if (status && status !== 'all') {
    itemsQuery += ' AND p.status = ?';
    itemParams.push(status);
  }
  itemsQuery += ' ORDER BY p.purchase_date DESC, pi.id ASC';
  const itemRows = db.prepare(itemsQuery).all(...itemParams);

  // Sheet 3: Supplier returns (if any)
  const returns = db.prepare(`
    SELECT 
      sr.return_no AS [Return No],
      sr.return_date AS [Return Date],
      p.invoice_no AS [PO Reference],
      s.name AS [Supplier],
      prod.name AS [Product],
      sr.quantity AS [Qty Returned],
      prod.unit AS [Unit],
      sr.unit_cost AS [Unit Cost (₹)],
      sr.total_return_value AS [Return Value (₹)],
      sr.refund_type AS [Refund Settlement],
      sr.reason AS [Reason],
      sr.returned_by AS [Officer]
    FROM supplier_returns sr
    LEFT JOIN purchases p ON sr.purchase_id = p.id
    JOIN suppliers s ON sr.supplier_id = s.id
    JOIN products prod ON sr.product_id = prod.id
    ORDER BY sr.return_date DESC
  `).all();

  // Sheet 4: Supplier Balances
  const supplierSummary = db.prepare(`
    SELECT 
      s.name AS [Supplier],
      s.contact_person AS [Contact],
      s.phone AS [Phone],
      s.gst_number AS [GST / Tax ID],
      s.balance_due AS [Outstanding Balance (₹)],
      COUNT(p.id) AS [Total Purchase Orders],
      COALESCE(SUM(p.net_amount), 0) AS [Lifetime Procurement (₹)]
    FROM suppliers s
    LEFT JOIN purchases p ON s.id = p.supplier_id
    GROUP BY s.id
  `).all();

  const wb = XLSX.utils.book_new();
  const wsPO = createSheetWithWidths(rows, {
    'PO Number': 16,
    'Date': 14,
    'Supplier': 32,
    'Order Status': 14,
    'Net Amount (₹)': 16
  });
  const wsItems = createSheetWithWidths(itemRows, {
    'PO Number': 16,
    'Product': 28,
    'Batch Number': 16,
    'Line Total (₹)': 16
  });
  const wsReturns = createSheetWithWidths(returns, {
    'Return No': 16,
    'Supplier': 28,
    'Product': 26,
    'Return Value (₹)': 18
  });
  const wsSupp = createSheetWithWidths(supplierSummary, {
    'Supplier': 32,
    'Outstanding Balance (₹)': 22,
    'Lifetime Procurement (₹)': 24
  });

  XLSX.utils.book_append_sheet(wb, wsPO, 'Purchases Overview');
  XLSX.utils.book_append_sheet(wb, wsItems, 'Order Line Items');
  XLSX.utils.book_append_sheet(wb, wsReturns, 'Supplier Returns');
  XLSX.utils.book_append_sheet(wb, wsSupp, 'Supplier Payables');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 5. Executive Master Summary (All-in-one Business Dashboard Export)
function generateMasterBusinessReport() {
  const wb = XLSX.utils.book_new();

  // Metrics summary
  const totalSales = db.prepare('SELECT COALESCE(SUM(net_amount), 0) as rev, COALESCE(SUM(profit_earned), 0) as prof, COUNT(*) as orders FROM sales').get();
  const totalPurchases = db.prepare('SELECT COALESCE(SUM(net_amount), 0) as cost, COUNT(*) as count FROM purchases').get();
  const totalLoss = db.prepare('SELECT COALESCE(SUM(total_loss_value), 0) as loss, COALESCE(SUM(quantity), 0) as qty FROM waste_damaged').get();
  const stockValuation = db.prepare('SELECT ROUND(SUM(b.current_quantity * p.purchase_price), 2) as val FROM batches b JOIN products p ON b.product_id = p.id WHERE b.current_quantity > 0').get();
  const totalCustomerUdhar = db.prepare('SELECT COALESCE(SUM(credit_balance), 0) as udhar FROM customers').get();
  const totalSupplierDue = db.prepare('SELECT COALESCE(SUM(balance_due), 0) as due FROM suppliers').get();

  const summaryData = [
    { 'Metric': 'Total Sales Revenue (All Time)', 'Value (₹)': totalSales.rev, 'Note': `${totalSales.orders} total sales orders processed` },
    { 'Metric': 'Total Net Profit Earned', 'Value (₹)': totalSales.prof, 'Note': `Net margin: ${totalSales.rev > 0 ? ((totalSales.prof / totalSales.rev) * 100).toFixed(1) : 0}%` },
    { 'Metric': 'Current Active Inventory Value (at Cost)', 'Value (₹)': stockValuation.val || 0, 'Note': 'Real-time valuation across all active batches' },
    { 'Metric': 'Total Expired & Damaged Product Loss', 'Value (₹)': totalLoss.loss, 'Note': `${totalLoss.qty} units spoiled / discarded` },
    { 'Metric': 'Total Supplier Procurement Paid/Billed', 'Value (₹)': totalPurchases.cost, 'Note': `${totalPurchases.count} purchase shipments received` },
    { 'Metric': 'Total Customer Outstanding Credit (Udhar)', 'Value (₹)': totalCustomerUdhar.udhar, 'Note': 'Accounts Receivable from customers' },
    { 'Metric': 'Total Supplier Outstanding Payable', 'Value (₹)': totalSupplierDue.due, 'Note': 'Accounts Payable to dairy farmers & suppliers' }
  ];

  // Top Selling Products
  const bestSellers = db.prepare(`
    SELECT 
      p.name AS [Product],
      c.name AS [Category],
      SUM(si.quantity) AS [Total Units Sold],
      p.unit AS [Unit],
      ROUND(SUM(si.total_price), 2) AS [Gross Revenue (₹)],
      ROUND(SUM(si.profit), 2) AS [Total Profit Generated (₹)]
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    GROUP BY p.id
    ORDER BY [Total Units Sold] DESC
    LIMIT 10
  `).all();

  // Slow Moving / Least Selling Products
  const leastSellers = db.prepare(`
    SELECT 
      p.name AS [Product],
      c.name AS [Category],
      COALESCE(SUM(si.quantity), 0) AS [Units Sold],
      p.unit AS [Unit],
      COALESCE(SUM(b.current_quantity), 0) AS [Stock Sitting in Store],
      p.purchase_price AS [Unit Cost (₹)]
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN sale_items si ON p.id = si.product_id
    LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
    GROUP BY p.id
    ORDER BY [Units Sold] ASC, [Stock Sitting in Store] DESC
    LIMIT 10
  `).all();

  const wsSummary = createSheetWithWidths(summaryData, { 'Metric': 42, 'Value (₹)': 20, 'Note': 46 });
  const wsBest = createSheetWithWidths(bestSellers, { 'Product': 32, 'Category': 20, 'Gross Revenue (₹)': 20, 'Total Profit Generated (₹)': 24 });
  const wsLeast = createSheetWithWidths(leastSellers, { 'Product': 32, 'Category': 20, 'Stock Sitting in Store': 22 });

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive KPIs');
  XLSX.utils.book_append_sheet(wb, wsBest, 'Top Selling Products');
  XLSX.utils.book_append_sheet(wb, wsLeast, 'Least Selling Products');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 6. Stock Movements Audit Ledger Report (Module 8)
function generateMovementsReport(filters = {}) {
  const { startDate, endDate, flow, movement_type, productId, branchId, search } = filters;

  let query = `
    SELECT 
      'MOV-' || sm.id AS [Movement ID],
      sm.created_at AS [Date & Time],
      sm.flow_type AS [Flow Direction],
      sm.movement_type AS [Movement Type],
      p.name AS [Product Name],
      p.sku AS [SKU],
      COALESCE(b.batch_number, 'N/A') AS [Batch Number],
      sm.quantity AS [Quantity Moved],
      sm.unit AS [Unit],
      sm.previous_stock AS [Previous Stock],
      sm.updated_stock AS [Updated Stock],
      sm.reference_txn AS [Reference Txn / Document],
      sm.reason AS [Reason / Notes],
      sm.cost_impact AS [Financial Impact (₹)],
      sm.performed_by AS [Recorded By],
      fb.name AS [From Branch],
      tb.name AS [To Branch]
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN batches b ON sm.batch_id = b.id
    LEFT JOIN branches fb ON sm.from_branch_id = fb.id
    LEFT JOIN branches tb ON sm.to_branch_id = tb.id
    WHERE 1=1
  `;
  const params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR sm.reason LIKE ? OR sm.reference_txn LIKE ? OR sm.performed_by LIKE ?)';
    params.push(term, term, term, term, term);
  }

  if (flow && flow !== 'all') {
    query += ' AND LOWER(sm.flow_type) = LOWER(?)';
    params.push(flow);
  }

  if (movement_type && movement_type !== 'all') {
    query += ' AND sm.movement_type = ?';
    params.push(movement_type);
  }

  if (productId && productId !== 'all') {
    query += ' AND sm.product_id = ?';
    params.push(Number(productId));
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

  query += ' ORDER BY sm.id DESC';

  const rows = db.prepare(query).all(...params);

  // Summary by Movement Type
  const summaryRows = db.prepare(`
    SELECT 
      movement_type AS [Movement Type],
      flow_type AS [Flow Direction],
      COUNT(*) AS [Total Transactions],
      ROUND(SUM(quantity), 2) AS [Total Quantity Moved],
      ROUND(SUM(cost_impact), 2) AS [Cumulative Cost Impact (₹)]
    FROM stock_movements
    GROUP BY movement_type, flow_type
    ORDER BY flow_type ASC, [Total Transactions] DESC
  `).all();

  const wb = XLSX.utils.book_new();
  const wsMovements = createSheetWithWidths(rows, {
    'Movement ID': 14,
    'Date & Time': 20,
    'Flow Direction': 14,
    'Movement Type': 24,
    'Product Name': 28,
    'SKU': 14,
    'Batch Number': 16,
    'Quantity Moved': 16,
    'Previous Stock': 14,
    'Updated Stock': 14,
    'Reference Txn / Document': 22,
    'Reason / Notes': 32,
    'Recorded By': 18
  });

  const wsSummary = createSheetWithWidths(summaryRows, {
    'Movement Type': 26,
    'Flow Direction': 16,
    'Total Transactions': 18,
    'Total Quantity Moved': 20,
    'Cumulative Cost Impact (₹)': 24
  });

  XLSX.utils.book_append_sheet(wb, wsMovements, 'Movements Audit');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Flow Summary');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 7. MODULE 9: SUPPLIER-WISE PURCHASE & PERFORMANCE REPORT
function generateSupplierPurchasesReport({ supplierId, startDate, endDate, status } = {}) {
  let suppWhere = '1=1';
  const suppParams = [];

  if (supplierId && supplierId !== 'all') {
    suppWhere += ' AND s.id = ?';
    suppParams.push(Number(supplierId));
  }

  if (status && status !== 'all') {
    suppWhere += ' AND s.status = ?';
    suppParams.push(status);
  }

  // 1. Supplier Performance Summary
  const suppliers = db.prepare(`
    SELECT 
      s.id,
      'SUP-' || PRINTF('%04d', s.id) AS [Supplier ID],
      COALESCE(s.company_name, s.name) AS [Company Name],
      s.name AS [Supplier / Farm Name],
      COALESCE(s.contact_person, 'N/A') AS [Contact Person],
      s.phone AS [Phone Number],
      COALESCE(s.email, 'N/A') AS [Email],
      COALESCE(s.gst_number, 'N/A') AS [GSTIN],
      COALESCE(s.payment_terms, 'Net 15') AS [Payment Terms],
      COALESCE(s.status, 'Active') AS [Status],
      s.balance_due AS [Outstanding Balance (₹)],
      COUNT(DISTINCT p.id) AS [Total POs],
      SUM(CASE WHEN p.status = 'Received' THEN 1 ELSE 0 END) AS [Received POs],
      COALESCE(SUM(CASE WHEN p.status = 'Received' THEN p.net_amount ELSE 0 END), 0) AS [Lifetime Procurement (₹)],
      COUNT(DISTINCT sr.id) AS [Total Returns Count],
      COALESCE(SUM(sr.total_return_value), 0) AS [Total Return Value (₹)]
    FROM suppliers s
    LEFT JOIN purchases p ON s.id = p.supplier_id
    LEFT JOIN supplier_returns sr ON s.id = sr.supplier_id
    WHERE ${suppWhere}
    GROUP BY s.id
    ORDER BY s.name ASC
  `).all(...suppParams);

  // Compute calculated metrics for each supplier
  const summaryRows = suppliers.map(s => {
    const lifetime = Number(s['Lifetime Procurement (₹)']);
    const returnsVal = Number(s['Total Return Value (₹)']);
    const netProcurement = Number((lifetime - returnsVal).toFixed(2));
    const defectRate = lifetime > 0 ? Number(((returnsVal / lifetime) * 100).toFixed(2)) : 0;
    
    let grade = '⭐⭐⭐⭐⭐ Grade A (Excellent)';
    if (defectRate > 3) grade = '⚠️ Grade C (High Defect Rate)';
    else if (defectRate > 1) grade = '⭐⭐⭐⭐ Grade B (Good)';

    const paymentsRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as paid FROM supplier_payments WHERE supplier_id = ?').get(s.id);
    const totalPaid = Number(paymentsRow ? paymentsRow.paid : 0);

    const { id, ...cleanObj } = s;
    return {
      ...cleanObj,
      'Net Procurement (₹)': netProcurement,
      'Total Paid (₹)': totalPaid,
      'Defect Rate (%)': `${defectRate}%`,
      'Quality Rating': grade
    };
  });

  // 2. Purchase Orders Ledger
  let poWhere = '1=1';
  const poParams = [];
  if (supplierId && supplierId !== 'all') {
    poWhere += ' AND p.supplier_id = ?';
    poParams.push(Number(supplierId));
  }
  if (startDate) {
    poWhere += ' AND p.purchase_date >= ?';
    poParams.push(startDate);
  }
  if (endDate) {
    poWhere += ' AND p.purchase_date <= ?';
    poParams.push(endDate);
  }

  const poRows = db.prepare(`
    SELECT 
      p.invoice_no AS [PO Number],
      p.purchase_date AS [Order Date],
      'SUP-' || PRINTF('%04d', s.id) AS [Supplier ID],
      s.name AS [Supplier Name],
      COALESCE(b.name, 'Main Cold Store') AS [Destination Branch],
      p.total_amount AS [Subtotal (₹)],
      p.tax_amount AS [Tax (₹)],
      p.discount_amount AS [Discount (₹)],
      p.net_amount AS [Net Amount (₹)],
      p.status AS [Order Status],
      p.payment_status AS [Payment Status],
      p.payment_method AS [Payment Method],
      COALESCE(p.received_at, 'N/A') AS [Received Date],
      COALESCE(p.received_by, 'N/A') AS [Received By Officer]
    FROM purchases p
    JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN branches b ON p.branch_id = b.id
    WHERE ${poWhere}
    ORDER BY p.purchase_date DESC, p.id DESC
  `).all(...poParams);

  // 3. Supplier Returns Ledger
  let retWhere = '1=1';
  const retParams = [];
  if (supplierId && supplierId !== 'all') {
    retWhere += ' AND sr.supplier_id = ?';
    retParams.push(Number(supplierId));
  }
  if (startDate) {
    retWhere += ' AND sr.return_date >= ?';
    retParams.push(startDate);
  }
  if (endDate) {
    retWhere += ' AND sr.return_date <= ?';
    retParams.push(endDate);
  }

  const returnRows = db.prepare(`
    SELECT 
      sr.return_no AS [Return No],
      sr.return_date AS [Return Date],
      'SUP-' || PRINTF('%04d', s.id) AS [Supplier ID],
      s.name AS [Supplier Name],
      p.name AS [Product Returned],
      p.sku AS [SKU],
      COALESCE(b.batch_number, 'N/A') AS [Batch Number],
      sr.quantity AS [Quantity Returned],
      sr.unit_cost AS [Unit Cost (₹)],
      sr.total_return_value AS [Return Value (₹)],
      sr.reason AS [Defect / Return Reason],
      sr.refund_type AS [Refund Settlement Mode],
      sr.returned_by AS [Authorized Officer]
    FROM supplier_returns sr
    JOIN suppliers s ON sr.supplier_id = s.id
    JOIN products p ON sr.product_id = p.id
    LEFT JOIN batches b ON sr.batch_id = b.id
    WHERE ${retWhere}
    ORDER BY sr.return_date DESC, sr.id DESC
  `).all(...retParams);

  // 4. Payments Journal
  let payWhere = '1=1';
  const payParams = [];
  if (supplierId && supplierId !== 'all') {
    payWhere += ' AND sp.supplier_id = ?';
    payParams.push(Number(supplierId));
  }
  if (startDate) {
    payWhere += ' AND sp.payment_date >= ?';
    payParams.push(startDate);
  }
  if (endDate) {
    payWhere += ' AND sp.payment_date <= ?';
    payParams.push(endDate);
  }

  const paymentRows = db.prepare(`
    SELECT 
      'PAY-' || PRINTF('%05d', sp.id) AS [Payment ID],
      sp.payment_date AS [Payment Date],
      'SUP-' || PRINTF('%04d', s.id) AS [Supplier ID],
      s.name AS [Supplier Name],
      sp.amount AS [Amount Paid (₹)],
      sp.payment_mode AS [Payment Mode],
      COALESCE(sp.reference_no, 'N/A') AS [Reference / UTR #],
      COALESCE(sp.notes, 'N/A') AS [Notes / Settlement Memo],
      sp.recorded_by AS [Recorded By Officer]
    FROM supplier_payments sp
    JOIN suppliers s ON sp.supplier_id = s.id
    WHERE ${payWhere}
    ORDER BY sp.payment_date DESC, sp.id DESC
  `).all(...payParams);

  const wb = XLSX.utils.book_new();

  const wsSummary = createSheetWithWidths(summaryRows, {
    'Supplier ID': 14,
    'Company Name': 28,
    'Supplier / Farm Name': 30,
    'Contact Person': 20,
    'Phone Number': 16,
    'Email': 24,
    'GSTIN': 18,
    'Payment Terms': 14,
    'Status': 12,
    'Outstanding Balance (₹)': 22,
    'Total POs': 12,
    'Received POs': 14,
    'Lifetime Procurement (₹)': 24,
    'Total Return Value (₹)': 22,
    'Net Procurement (₹)': 22,
    'Total Paid (₹)': 18,
    'Defect Rate (%)': 16,
    'Quality Rating': 26
  });

  const wsPOs = createSheetWithWidths(poRows, {
    'PO Number': 18,
    'Order Date': 14,
    'Supplier ID': 14,
    'Supplier Name': 28,
    'Destination Branch': 22,
    'Net Amount (₹)': 16,
    'Order Status': 14,
    'Payment Status': 14,
    'Payment Method': 18,
    'Received Date': 16,
    'Received By Officer': 20
  });

  const wsReturns = createSheetWithWidths(returnRows, {
    'Return No': 16,
    'Return Date': 14,
    'Supplier ID': 14,
    'Supplier Name': 28,
    'Product Returned': 26,
    'SKU': 14,
    'Batch Number': 16,
    'Quantity Returned': 18,
    'Return Value (₹)': 18,
    'Defect / Return Reason': 30,
    'Refund Settlement Mode': 20,
    'Authorized Officer': 18
  });

  const wsPayments = createSheetWithWidths(paymentRows, {
    'Payment ID': 14,
    'Payment Date': 14,
    'Supplier ID': 14,
    'Supplier Name': 28,
    'Amount Paid (₹)': 18,
    'Payment Mode': 18,
    'Reference / UTR #': 20,
    'Notes / Settlement Memo': 32,
    'Recorded By Officer': 20
  });

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Supplier Performance');
  XLSX.utils.book_append_sheet(wb, wsPOs, 'Purchase Orders');
  XLSX.utils.book_append_sheet(wb, wsReturns, 'Supplier Returns');
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments Journal');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 8. Customer Sales & Returns Report (Module 10)
function generateCustomerSalesReport({ startDate, endDate, customerId, type }) {
  let custWhere = '1=1';
  const custParams = [];
  if (customerId && customerId !== 'all') {
    custWhere += ' AND c.id = ?';
    custParams.push(Number(customerId));
  }
  if (type && type !== 'all') {
    custWhere += ' AND c.type = ?';
    custParams.push(type);
  }

  // 1. Customer Summary
  const summaryRows = db.prepare(`
    SELECT 
      'CUST-' || PRINTF('%04d', c.id) AS [Customer ID],
      c.name AS [Customer Name],
      c.type AS [Customer Type],
      c.phone AS [Phone Number],
      COALESCE(c.email, 'N/A') AS [Email],
      COALESCE(c.address, 'Counter / Walk-in') AS [Address],
      c.status AS [Status],
      COALESCE(c.credit_balance, 0) AS [Outstanding Udhar (₹)],
      COALESCE(c.loyalty_points, 0) AS [Loyalty Points],
      COUNT(DISTINCT s.id) AS [Total Orders],
      ROUND(COALESCE(SUM(DISTINCT s.net_amount), 0), 2) AS [Lifetime Purchases (₹)],
      ROUND(COALESCE(ret.total_refunded, 0), 2) AS [Returns Value (₹)],
      ROUND(COALESCE(SUM(DISTINCT s.net_amount), 0) - COALESCE(ret.total_refunded, 0), 2) AS [Net Revenue (₹)],
      CASE 
        WHEN COUNT(DISTINCT s.id) > 0 THEN ROUND(COALESCE(SUM(DISTINCT s.net_amount), 0) / COUNT(DISTINCT s.id), 2)
        ELSE 0 
      END AS [Average Order (₹)],
      COALESCE(MIN(s.sale_date), 'N/A') AS [First Order Date],
      COALESCE(MAX(s.sale_date), 'N/A') AS [Last Order Date],
      ROUND(COALESCE(pay.total_paid, 0), 2) AS [Total Udhar Settled (₹)]
    FROM customers c
    LEFT JOIN sales s ON c.id = s.customer_id
    LEFT JOIN (
      SELECT customer_id, SUM(refund_amount) as total_refunded
      FROM customer_returns
      GROUP BY customer_id
    ) ret ON c.id = ret.customer_id
    LEFT JOIN (
      SELECT customer_id, SUM(amount) as total_paid
      FROM customer_payments
      GROUP BY customer_id
    ) pay ON c.id = pay.customer_id
    WHERE ${custWhere}
    GROUP BY c.id
    ORDER BY [Lifetime Purchases (₹)] DESC, c.name ASC
  `).all(...custParams);

  // 2. Sales Journal
  let salesWhere = '1=1';
  const salesParams = [];
  if (customerId && customerId !== 'all') {
    salesWhere += ' AND s.customer_id = ?';
    salesParams.push(Number(customerId));
  }
  if (type && type !== 'all') {
    salesWhere += ' AND c.type = ?';
    salesParams.push(type);
  }
  if (startDate) {
    salesWhere += ' AND s.sale_date >= ?';
    salesParams.push(startDate);
  }
  if (endDate) {
    salesWhere += ' AND s.sale_date <= ?';
    salesParams.push(endDate);
  }

  const salesRows = db.prepare(`
    SELECT 
      s.invoice_no AS [Invoice No],
      s.sale_date AS [Date],
      CASE 
        WHEN s.customer_id IS NOT NULL THEN 'CUST-' || PRINTF('%04d', s.customer_id)
        ELSE 'CUST-WALKIN'
      END AS [Customer ID],
      COALESCE(c.name, 'Walk-in Retail Customer') AS [Customer Name],
      COALESCE(c.type, 'Retail') AS [Customer Type],
      b.name AS [Branch],
      s.total_amount AS [Subtotal (₹)],
      s.discount_amount AS [Discount (₹)],
      s.tax_amount AS [Tax (₹)],
      s.net_amount AS [Net Amount (₹)],
      s.payment_method AS [Payment Method],
      s.payment_status AS [Payment Status],
      s.cashier_name AS [Cashier]
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN branches b ON s.branch_id = b.id
    WHERE ${salesWhere}
    ORDER BY s.sale_date DESC, s.id DESC
  `).all(...salesParams);

  // 3. Customer Returns Journal
  let retWhere = '1=1';
  const retParams = [];
  if (customerId && customerId !== 'all') {
    retWhere += ' AND cr.customer_id = ?';
    retParams.push(Number(customerId));
  }
  if (startDate) {
    retWhere += ' AND cr.return_date >= ?';
    retParams.push(startDate);
  }
  if (endDate) {
    retWhere += ' AND cr.return_date <= ?';
    retParams.push(endDate);
  }

  const returnRows = db.prepare(`
    SELECT 
      'CR-' || PRINTF('%04d', cr.id) AS [Return No],
      cr.return_date AS [Return Date],
      COALESCE(s.invoice_no, 'Direct Return') AS [Invoice No],
      CASE 
        WHEN cr.customer_id IS NOT NULL THEN 'CUST-' || PRINTF('%04d', cr.customer_id)
        ELSE 'CUST-WALKIN'
      END AS [Customer ID],
      COALESCE(c.name, 'Walk-in Retail Customer') AS [Customer Name],
      p.name AS [Product Name],
      p.sku AS [SKU],
      COALESCE(bat.batch_number, 'N/A') AS [Batch Number],
      cr.quantity AS [Quantity Returned],
      p.unit AS [Unit],
      cr.unit_price AS [Unit Price (₹)],
      cr.refund_amount AS [Refund Amount (₹)],
      cr.reason AS [Return Reason],
      cr.refund_method AS [Refund Method],
      cr.processed_by AS [Processed By]
    FROM customer_returns cr
    LEFT JOIN customers c ON cr.customer_id = c.id
    LEFT JOIN products p ON cr.product_id = p.id
    LEFT JOIN batches bat ON cr.batch_id = bat.id
    LEFT JOIN sales s ON cr.sale_id = s.id
    WHERE ${retWhere}
    ORDER BY cr.return_date DESC, cr.id DESC
  `).all(...retParams);

  // 4. Udhar Settlements Journal
  let payWhere = '1=1';
  const payParams = [];
  if (customerId && customerId !== 'all') {
    payWhere += ' AND cp.customer_id = ?';
    payParams.push(Number(customerId));
  }
  if (startDate) {
    payWhere += ' AND cp.payment_date >= ?';
    payParams.push(startDate);
  }
  if (endDate) {
    payWhere += ' AND cp.payment_date <= ?';
    payParams.push(endDate);
  }

  const paymentRows = db.prepare(`
    SELECT 
      'PAY-' || PRINTF('%05d', cp.id) AS [Payment ID],
      cp.payment_date AS [Payment Date],
      'CUST-' || PRINTF('%04d', c.id) AS [Customer ID],
      c.name AS [Customer Name],
      c.type AS [Customer Type],
      cp.amount AS [Amount Received (₹)],
      cp.payment_mode AS [Payment Mode],
      COALESCE(cp.reference_no, 'N/A') AS [Reference / UTR #],
      COALESCE(cp.notes, 'N/A') AS [Notes / Memo],
      cp.received_by AS [Received By]
    FROM customer_payments cp
    JOIN customers c ON cp.customer_id = c.id
    WHERE ${payWhere}
    ORDER BY cp.payment_date DESC, cp.id DESC
  `).all(...payParams);

  const wb = XLSX.utils.book_new();

  const wsSummary = createSheetWithWidths(summaryRows, {
    'Customer ID': 14,
    'Customer Name': 28,
    'Customer Type': 20,
    'Phone Number': 16,
    'Email': 24,
    'Address': 28,
    'Status': 12,
    'Outstanding Udhar (₹)': 22,
    'Loyalty Points': 14,
    'Total Orders': 14,
    'Lifetime Purchases (₹)': 22,
    'Returns Value (₹)': 18,
    'Net Revenue (₹)': 18,
    'Average Order (₹)': 18,
    'First Order Date': 16,
    'Last Order Date': 16,
    'Total Udhar Settled (₹)': 22
  });

  const wsSales = createSheetWithWidths(salesRows, {
    'Invoice No': 16,
    'Date': 14,
    'Customer ID': 14,
    'Customer Name': 28,
    'Customer Type': 18,
    'Branch': 22,
    'Net Amount (₹)': 16,
    'Payment Method': 18,
    'Payment Status': 16,
    'Cashier': 18
  });

  const wsReturns = createSheetWithWidths(returnRows, {
    'Return No': 14,
    'Return Date': 14,
    'Invoice No': 16,
    'Customer ID': 14,
    'Customer Name': 26,
    'Product Name': 26,
    'SKU': 14,
    'Batch Number': 16,
    'Quantity Returned': 18,
    'Unit Price (₹)': 14,
    'Refund Amount (₹)': 18,
    'Return Reason': 30,
    'Refund Method': 22,
    'Processed By': 18
  });

  const wsPayments = createSheetWithWidths(paymentRows, {
    'Payment ID': 14,
    'Payment Date': 14,
    'Customer ID': 14,
    'Customer Name': 28,
    'Customer Type': 18,
    'Amount Received (₹)': 20,
    'Payment Mode': 16,
    'Reference / UTR #': 20,
    'Notes / Memo': 30,
    'Received By': 18
  });

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Customer Summary');
  XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Journal');
  XLSX.utils.book_append_sheet(wb, wsReturns, 'Returns Journal');
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Udhar Settlements');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 9. Analytics & Business Intelligence Report (Module 12)
function generateAnalyticsReport({ startDate, endDate, branchId, categoryId } = {}) {
  const wb = XLSX.utils.book_new();

  const today = new Date();
  const todayStr = formatDate(today);
  const start = startDate || '2020-01-01';
  const end = endDate || todayStr;

  let salesWhere = `s.sale_date >= ? AND s.sale_date <= ?`;
  const salesParams = [start, end];
  if (branchId && branchId !== 'all') {
    salesWhere += ` AND s.branch_id = ?`;
    salesParams.push(Number(branchId));
  }

  // Sales Totals
  const salesTotal = db.prepare(`
    SELECT 
      COALESCE(SUM(s.total_amount), 0) as gross_sales,
      COALESCE(SUM(s.discount_amount), 0) as discounts,
      COALESCE(SUM(s.tax_amount), 0) as taxes,
      COALESCE(SUM(s.net_amount), 0) as net_sales_raw,
      COALESCE(SUM(s.total_cost), 0) as cogs,
      COUNT(s.id) as total_orders
    FROM sales s
    WHERE ${salesWhere}
  `).get(...salesParams);

  // Customer Returns
  const returnsTotal = db.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) as returns
    FROM customer_returns
    WHERE return_date >= ? AND return_date <= ?
  `).get(start, end).returns;

  const grossSales = salesTotal.gross_sales;
  const discounts = salesTotal.discounts;
  const netSales = Math.max(0, grossSales - discounts - returnsTotal);
  const cogs = salesTotal.cogs;
  const grossProfit = netSales - cogs;
  const grossMargin = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) + '%' : '0.0%';

  // Operating Expenses
  const expenses = db.prepare(`
    SELECT category, ROUND(SUM(amount), 2) as amount
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
    GROUP BY category
  `).all(start, end);

  const expMap = {};
  let totalExpenses = 0;
  expenses.forEach(e => {
    expMap[e.category] = e.amount;
    totalExpenses += e.amount;
  });

  const rent = expMap['Rent'] || 0;
  const electricity = expMap['Electricity'] || 0;
  const transport = expMap['Transport'] || 0;
  const salaries = expMap['Employee Salaries'] || 0;
  const otherExp = Math.max(0, totalExpenses - rent - electricity - transport - salaries);

  const operatingProfit = grossProfit - totalExpenses;
  const operatingMargin = netSales > 0 ? ((operatingProfit / netSales) * 100).toFixed(1) + '%' : '0.0%';

  // Spoilage Loss
  const spoilageLoss = db.prepare(`
    SELECT COALESCE(SUM(total_loss_value), 0) as loss
    FROM waste_damaged
    WHERE recorded_date >= ? AND recorded_date <= ?
  `).get(start, end).loss;

  const netBusinessProfit = operatingProfit - spoilageLoss;
  const netMargin = netSales > 0 ? ((netBusinessProfit / netSales) * 100).toFixed(1) + '%' : '0.0%';

  // Sheet 1: Executive Financial Summary (P&L)
  const pnlRows = [
    { 'Financial Metric': 'Gross Sales (Store Revenue)', 'Amount (₹)': Number(grossSales.toFixed(2)), 'Percentage / Notes': 'Total retail POS turnover before discounts' },
    { 'Financial Metric': 'Less: Sales Discounts Allowed', 'Amount (₹)': Number((-discounts).toFixed(2)), 'Percentage / Notes': 'Promotional & bill discounts' },
    { 'Financial Metric': 'Less: Customer Sales Returns', 'Amount (₹)': Number((-returnsTotal).toFixed(2)), 'Percentage / Notes': 'Damaged/expired goods returned by customers' },
    { 'Financial Metric': '= Net Sales', 'Amount (₹)': Number(netSales.toFixed(2)), 'Percentage / Notes': '100.0% Base turnover' },
    { 'Financial Metric': 'Less: Cost of Goods Sold (COGS)', 'Amount (₹)': Number((-cogs).toFixed(2)), 'Percentage / Notes': 'Actual batch purchase costs allocated on checkout' },
    { 'Financial Metric': '= Gross Profit', 'Amount (₹)': Number(grossProfit.toFixed(2)), 'Percentage / Notes': `Gross Margin: ${grossMargin}` },
    { 'Financial Metric': 'Operating Expenses: Rent', 'Amount (₹)': Number((-rent).toFixed(2)), 'Percentage / Notes': 'Shop & cold room facility rent' },
    { 'Financial Metric': 'Operating Expenses: Electricity', 'Amount (₹)': Number((-electricity).toFixed(2)), 'Percentage / Notes': 'Commercial chillers & deep freezer power' },
    { 'Financial Metric': 'Operating Expenses: Transport / Fuel', 'Amount (₹)': Number((-transport).toFixed(2)), 'Percentage / Notes': 'Daily milk procurement & delivery logistics' },
    { 'Financial Metric': 'Operating Expenses: Employee Salaries', 'Amount (₹)': Number((-salaries).toFixed(2)), 'Percentage / Notes': 'Staff & cashier wages' },
    { 'Financial Metric': 'Operating Expenses: Other Overheads', 'Amount (₹)': Number((-otherExp).toFixed(2)), 'Percentage / Notes': 'Packaging, lab tests, repairs & admin' },
    { 'Financial Metric': 'Total Operating Expenses', 'Amount (₹)': Number((-totalExpenses).toFixed(2)), 'Percentage / Notes': 'Total overhead costs' },
    { 'Financial Metric': '= Operating Profit (EBITDA)', 'Amount (₹)': Number(operatingProfit.toFixed(2)), 'Percentage / Notes': `Operating Margin: ${operatingMargin}` },
    { 'Financial Metric': 'Less: Spoilage & Expiry Loss', 'Amount (₹)': Number((-spoilageLoss).toFixed(2)), 'Percentage / Notes': 'Expired, sour, or damaged dairy write-offs' },
    { 'Financial Metric': '= True Net Business Profit', 'Amount (₹)': Number(netBusinessProfit.toFixed(2)), 'Percentage / Notes': `Net Margin: ${netMargin}` },
    { 'Financial Metric': 'Total Orders Completed', 'Amount (₹)': salesTotal.total_orders, 'Percentage / Notes': `Average Order Value: ₹${salesTotal.total_orders > 0 ? (netSales / salesTotal.total_orders).toFixed(2) : 0}` }
  ];

  // Sheet 2: Daily Sales Breakdown
  const dailyRows = db.prepare(`
    SELECT 
      s.sale_date AS [Date],
      COUNT(s.id) AS [Orders],
      ROUND(SUM(s.total_amount), 2) AS [Gross Sales (₹)],
      ROUND(SUM(s.discount_amount), 2) AS [Discounts (₹)],
      ROUND(SUM(s.net_amount), 2) AS [Net Sales (₹)],
      ROUND(SUM(s.total_cost), 2) AS [Cost of Goods (₹)],
      ROUND(SUM(s.profit_earned), 2) AS [Gross Profit (₹)],
      ROUND((SUM(s.profit_earned) / MAX(1, SUM(s.net_amount))) * 100, 1) || '%' AS [Margin %]
    FROM sales s
    WHERE ${salesWhere}
    GROUP BY s.sale_date
    ORDER BY s.sale_date DESC
  `).all(...salesParams);

  // Sheet 3: Product Performance & Velocity
  const productRows = db.prepare(`
    SELECT 
      p.id AS [Product ID],
      p.name AS [Product Name],
      c.name AS [Category],
      p.unit AS [Unit],
      p.purchase_price AS [Unit Cost (₹)],
      p.selling_price AS [Selling Price (₹)],
      COALESCE(sales_agg.units_sold, 0) AS [Units Sold],
      COALESCE(sales_agg.revenue, 0) AS [Revenue (₹)],
      COALESCE(sales_agg.profit, 0) AS [Gross Profit (₹)],
      COALESCE(sales_agg.tx_count, 0) AS [Transactions],
      COALESCE(stock_agg.current_stock, 0) AS [Stock on Hand],
      ROUND(COALESCE(stock_agg.current_stock, 0) * p.purchase_price, 2) AS [Stock Valuation (₹)],
      CASE 
        WHEN COALESCE(sales_agg.units_sold, 0) = 0 AND COALESCE(stock_agg.current_stock, 0) > 0 THEN '⚠️ Zero Movement (Promo Recommended)'
        WHEN COALESCE(sales_agg.units_sold, 0) > 0 AND (COALESCE(stock_agg.current_stock, 0) / sales_agg.units_sold) >= 2.5 THEN '⚡ Slow Mover (Discount Recommended)'
        WHEN COALESCE(sales_agg.units_sold, 0) > 20 THEN '🔥 High Demand Fast Mover'
        ELSE '✅ Normal Velocity'
      END AS [Velocity Status]
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN (
      SELECT 
        si.product_id,
        ROUND(SUM(si.quantity), 2) as units_sold,
        ROUND(SUM(si.total_price), 2) as revenue,
        ROUND(SUM(si.profit), 2) as profit,
        COUNT(DISTINCT s.id) as tx_count
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE ${salesWhere}
      GROUP BY si.product_id
    ) sales_agg ON p.id = sales_agg.product_id
    LEFT JOIN (
      SELECT product_id, ROUND(SUM(current_quantity), 2) as current_stock
      FROM batches
      WHERE current_quantity > 0
      GROUP BY product_id
    ) stock_agg ON p.id = stock_agg.product_id
    WHERE p.status = 'Active'
    ORDER BY [Units Sold] DESC, [Revenue (₹)] DESC
  `).all(...salesParams);

  // Sheet 4: Category & Payment BI
  const catRows = db.prepare(`
    SELECT 
      c.name AS [Category],
      ROUND(SUM(si.quantity), 1) AS [Units Sold],
      ROUND(SUM(si.total_price), 2) AS [Revenue (₹)],
      ROUND(SUM(si.quantity * si.unit_cost), 2) AS [Cost of Goods (₹)],
      ROUND(SUM(si.profit), 2) AS [Gross Profit (₹)],
      ROUND((SUM(si.profit) / MAX(1, SUM(si.total_price))) * 100, 1) || '%' AS [Margin %],
      COUNT(DISTINCT s.id) AS [Bills]
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE ${salesWhere}
    GROUP BY c.id
    ORDER BY [Revenue (₹)] DESC
  `).all(...salesParams);

  // Sheet 5: Operating Expenses Ledger
  const expRows = db.prepare(`
    SELECT 
      e.id AS [Expense ID],
      e.expense_date AS [Date],
      e.category AS [Category],
      e.title AS [Expense Title / Description],
      e.amount AS [Amount (₹)],
      e.payment_mode AS [Payment Mode],
      COALESCE(e.reference_no, '-') AS [Reference / UTR #],
      COALESCE(e.notes, '-') AS [Notes],
      e.recorded_by AS [Recorded By]
    FROM expenses e
    WHERE e.expense_date >= ? AND e.expense_date <= ?
    ORDER BY e.expense_date DESC, e.id DESC
  `).all(start, end);

  // Create worksheets
  const wsPnl = createSheetWithWidths(pnlRows, {
    'Financial Metric': 32,
    'Amount (₹)': 18,
    'Percentage / Notes': 45
  });

  const wsDaily = createSheetWithWidths(dailyRows, {
    'Date': 14,
    'Orders': 10,
    'Gross Sales (₹)': 16,
    'Discounts (₹)': 14,
    'Net Sales (₹)': 16,
    'Cost of Goods (₹)': 16,
    'Gross Profit (₹)': 16,
    'Margin %': 12
  });

  const wsProducts = createSheetWithWidths(productRows, {
    'Product ID': 12,
    'Product Name': 28,
    'Category': 16,
    'Unit': 10,
    'Unit Cost (₹)': 14,
    'Selling Price (₹)': 16,
    'Units Sold': 14,
    'Revenue (₹)': 16,
    'Gross Profit (₹)': 16,
    'Transactions': 14,
    'Stock on Hand': 14,
    'Stock Valuation (₹)': 18,
    'Velocity Status': 34
  });

  const wsCategories = createSheetWithWidths(catRows, {
    'Category': 20,
    'Units Sold': 14,
    'Revenue (₹)': 16,
    'Cost of Goods (₹)': 16,
    'Gross Profit (₹)': 16,
    'Margin %': 12,
    'Bills': 10
  });

  const wsExpenses = createSheetWithWidths(expRows, {
    'Expense ID': 12,
    'Date': 14,
    'Category': 18,
    'Expense Title / Description': 35,
    'Amount (₹)': 14,
    'Payment Mode': 16,
    'Reference / UTR #': 20,
    'Notes': 30,
    'Recorded By': 16
  });

  XLSX.utils.book_append_sheet(wb, wsPnl, 'Executive P&L Summary');
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Sales Daily Trend');
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Product Performance & BI');
  XLSX.utils.book_append_sheet(wb, wsCategories, 'Category BI');
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Operating Expenses Ledger');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  generateSalesReport,
  generateInventoryReport,
  generateWasteReport,
  generatePurchasesReport,
  generateMasterBusinessReport,
  generateMovementsReport,
  generateSupplierPurchasesReport,
  generateCustomerSalesReport,
  generateAnalyticsReport
};
