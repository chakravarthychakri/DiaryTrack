// ====================================================================
// MODULE 13: ADVANCED EXCEL REPORT GENERATION ENGINE (EXCELJS)
// ====================================================================
const ExcelJS = require('exceljs');
const { db, formatDate, addDays } = require('./db');

// Styling constants for professional green-themed Excel reports (13.3)
const STYLES = {
  // 13.3 Green worksheet headings with white text
  headerFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF15803D' } // Emerald / Dairy Green
  },
  headerFont: {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' } // White text
  },
  headerAlignment: {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true
  },
  
  // Title Banner
  titleBannerFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF166534' } // Darker green
  },
  titleBannerFont: {
    name: 'Calibri',
    size: 15,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  },
  subTitleFont: {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FFDCFCE7' }
  },

  // Section Sub-header
  sectionHeaderFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' } // Light slate
  },
  sectionHeaderFont: {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FF1E293B' }
  },

  // Data rows
  dataFont: {
    name: 'Calibri',
    size: 10,
    color: { argb: 'FF1E293B' }
  },
  dataRowEvenFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' } // Subtle alternate row tint
  },

  // 13.3 Professional borders
  thinBorder: {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  },

  // Formula Totals row
  totalRowFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }
  },
  totalFont: {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FF0F172A' }
  },
  totalBorder: {
    top: { style: 'thin', color: { argb: 'FF475569' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  },

  // 13.3 Conditional highlights
  lowStockFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEF3C7' } // Light amber
  },
  outOfStockFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEE2E2' } // Light red
  },
  expiredFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEE2E2' } // Light red
  },

  // Number Formats
  numFmtCurrency: '"₹"#,##0.00;[Red]-"₹"#,##0.00',
  numFmtQuantity: '#,##0.00',
  numFmtInteger: '#,##0',
  numFmtPercent: '0.0%',
  numFmtDate: 'YYYY-MM-DD'
};

// -------------------------------------------------------------
// 13.1 DATE RANGE RESOLUTION HELPER
// -------------------------------------------------------------
function resolveDateRange(range = 'all', customStart = null, customEnd = null) {
  const today = new Date();
  const todayStr = formatDate(today);
  let startDate = customStart;
  let endDate = customEnd || todayStr;
  let label = 'Complete Historical Report';

  switch (range) {
    case 'today':
      startDate = todayStr;
      endDate = todayStr;
      label = `Today (${todayStr})`;
      break;
    case 'yesterday': {
      const y = addDays(today, -1);
      startDate = formatDate(y);
      endDate = formatDate(y);
      label = `Yesterday (${startDate})`;
      break;
    }
    case '7days':
      startDate = formatDate(addDays(today, -6));
      endDate = todayStr;
      label = `Last 7 Days (${startDate} to ${endDate})`;
      break;
    case '30days':
      startDate = formatDate(addDays(today, -29));
      endDate = todayStr;
      label = `Last 30 Days (${startDate} to ${endDate})`;
      break;
    case 'this_month': {
      const yr = today.getFullYear();
      const mo = String(today.getMonth() + 1).padStart(2, '0');
      startDate = `${yr}-${mo}-01`;
      const lastDay = new Date(yr, today.getMonth() + 1, 0).getDate();
      endDate = `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;
      label = `Current Month (${startDate} to ${endDate})`;
      break;
    }
    case 'last_month': {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const yr = prev.getFullYear();
      const mo = String(prev.getMonth() + 1).padStart(2, '0');
      startDate = `${yr}-${mo}-01`;
      const lastDay = new Date(yr, prev.getMonth() + 1, 0).getDate();
      endDate = `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;
      label = `Previous Month (${startDate} to ${endDate})`;
      break;
    }
    case 'custom':
      if (!startDate) startDate = formatDate(addDays(today, -29));
      if (!endDate) endDate = todayStr;
      label = `Custom Range (${startDate} to ${endDate})`;
      break;
    case 'all':
    default:
      startDate = '2020-01-01';
      endDate = '2099-12-31';
      label = 'Complete Historical Report (All Time)';
      break;
  }

  return { startDate, endDate, label };
}

// Helper to autofit column widths
function autoFitColumns(worksheet, minWidth = 12, maxWidth = 42) {
  worksheet.columns.forEach(column => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      let str = '';
      if (val !== null && val !== undefined) {
        if (typeof val === 'object' && val.result !== undefined) {
          str = String(val.result);
        } else {
          str = String(val);
        }
      }
      maxLen = Math.max(maxLen, str.length);
    });
    column.width = Math.max(minWidth, Math.min(maxLen + 4, maxWidth));
  });
}

// -------------------------------------------------------------
// 13.2 WORKBOOK BUILDER: 10 DISTINCT WORKSHEETS
// -------------------------------------------------------------

// --- SHEET 1: DASHBOARD SUMMARY ---
function buildSheet1DashboardSummary(workbook, filters) {
  const ws = workbook.addWorksheet('Dashboard Summary', {
    properties: { tabColor: { argb: 'FF15803D' } }
  });

  const { startDate, endDate, label } = resolveDateRange(filters.range, filters.startDate, filters.endDate);
  const branchId = filters.branchId && filters.branchId !== 'all' ? Number(filters.branchId) : null;

  // Title Banner
  ws.mergeCells('A1:F1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '🥛 DAIRYTRACK – EXECUTIVE BUSINESS SUMMARY';
  titleCell.fill = STYLES.titleBannerFill;
  titleCell.font = STYLES.titleBannerFont;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 36;

  ws.mergeCells('A2:F2');
  const subCell = ws.getCell('A2');
  subCell.value = `Report Period: ${label} | Generated on: ${formatDate(new Date())} | Scope: ${branchId ? `Branch #${branchId}` : 'All Branches'}`;
  subCell.fill = STYLES.titleBannerFill;
  subCell.font = STYLES.subTitleFont;
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 20;

  // Blank row
  ws.addRow([]);

  // Section Header: Core Financial Indicators
  const secRow1 = ws.addRow(['KEY EXECUTIVE PERFORMANCE INDICATORS', '', '', '', '', '']);
  ws.mergeCells(`A${secRow1.number}:F${secRow1.number}`);
  secRow1.getCell(1).fill = STYLES.sectionHeaderFill;
  secRow1.getCell(1).font = STYLES.sectionHeaderFont;
  secRow1.height = 24;

  // Compute Metrics from DB
  let salesWhere = 's.sale_date >= ? AND s.sale_date <= ?';
  const salesParams = [startDate, endDate];
  if (branchId) {
    salesWhere += ' AND s.branch_id = ?';
    salesParams.push(branchId);
  }

  const salesTotals = db.prepare(`
    SELECT 
      COALESCE(SUM(s.total_amount), 0) as gross_sales,
      COALESCE(SUM(s.discount_amount), 0) as discounts,
      COALESCE(SUM(s.net_amount), 0) as net_sales,
      COALESCE(SUM(s.total_cost), 0) as cogs,
      COALESCE(SUM(s.profit_earned), 0) as gross_profit,
      COUNT(s.id) as orders
    FROM sales s
    WHERE ${salesWhere}
  `).get(...salesParams);

  const unitsSoldRow = db.prepare(`
    SELECT COALESCE(SUM(si.quantity), 0) as total_units
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE ${salesWhere}
  `).get(...salesParams);
  const totalUnitsSold = unitsSoldRow ? unitsSoldRow.total_units : 0;

  let purWhere = "p.purchase_date >= ? AND p.purchase_date <= ? AND p.status = 'Received'";
  const purParams = [startDate, endDate];
  if (branchId) {
    purWhere += ' AND p.branch_id = ?';
    purParams.push(branchId);
  }
  const purRow = db.prepare(`
    SELECT COALESCE(SUM(p.total_amount), 0) as total_purchases
    FROM purchases p
    WHERE ${purWhere}
  `).get(...purParams);
  const totalPurchases = purRow ? purRow.total_purchases : 0;

  let expWhere = 'e.expense_date >= ? AND e.expense_date <= ?';
  const expParams = [startDate, endDate];
  if (branchId) {
    expWhere += ' AND e.branch_id = ?';
    expParams.push(branchId);
  }
  const expRow = db.prepare(`
    SELECT COALESCE(SUM(e.amount), 0) as total_expenses
    FROM expenses e
    WHERE ${expWhere}
  `).get(...expParams);
  const totalExpenses = expRow ? expRow.total_expenses : 0;

  let wasteWhere = 'w.recorded_date >= ? AND w.recorded_date <= ?';
  const wasteParams = [startDate, endDate];
  if (branchId) {
    wasteWhere += ' AND w.branch_id = ?';
    wasteParams.push(branchId);
  }
  const wasteRow = db.prepare(`
    SELECT COALESCE(SUM(w.total_loss_value), 0) as total_loss
    FROM waste_damaged w
    WHERE ${wasteWhere}
  `).get(...wasteParams);
  const totalWastage = wasteRow ? wasteRow.total_loss : 0;

  const currentInvVal = db.prepare(`
    SELECT ROUND(COALESCE(SUM(b.current_quantity * p.purchase_price), 0), 2) as inv_value
    FROM batches b
    JOIN products p ON b.product_id = p.id
    WHERE b.current_quantity > 0
  `).get().inv_value;

  const grossProfit = salesTotals.net_sales - salesTotals.cogs;
  const operatingProfit = grossProfit - totalExpenses;

  // Add KPI rows
  const kpis = [
    ['Total Net Sales Revenue', Number(salesTotals.net_sales.toFixed(2)), STYLES.numFmtCurrency, 'Total shop POS revenue realized after discounts'],
    ['Total Quantity Sold', Number(totalUnitsSold.toFixed(2)), STYLES.numFmtQuantity, 'Aggregated units/litres/kg sold to customers'],
    ['Total Purchases Received', Number(totalPurchases.toFixed(2)), STYLES.numFmtCurrency, 'Stock intake from approved supplier invoices'],
    ['Gross Profit', Number(grossProfit.toFixed(2)), STYLES.numFmtCurrency, 'Net Sales minus Allocated Batch COGS'],
    ['Total Operating Expenses', Number(totalExpenses.toFixed(2)), STYLES.numFmtCurrency, 'Store overheads (Rent, Power, Salaries, Logistics)'],
    ['Operating Profit (EBITDA)', Number(operatingProfit.toFixed(2)), STYLES.numFmtCurrency, 'Gross Profit minus Total Operating Overheads'],
    ['Total Wastage & Expiry Loss', Number(totalWastage.toFixed(2)), STYLES.numFmtCurrency, 'Spoiled, curdled, expired or damaged stock write-offs'],
    ['Current Inventory Asset Value', Number(currentInvVal.toFixed(2)), STYLES.numFmtCurrency, 'Warehouse & shelf valuation based on purchase cost']
  ];

  kpis.forEach(([labelName, val, numFormat, notes], idx) => {
    const r = ws.addRow([labelName, val, '', notes, '', '']);
    ws.mergeCells(`A${r.number}:B${r.number}`);
    ws.mergeCells(`D${r.number}:F${r.number}`);
    
    r.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    r.getCell(3).value = val;
    r.getCell(3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(3).numFmt = numFormat;
    r.getCell(3).alignment = { horizontal: 'right' };
    
    r.getCell(4).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
    r.height = 20;

    [1, 2, 3, 4, 5, 6].forEach(colIdx => {
      r.getCell(colIdx).border = STYLES.thinBorder;
      if (idx % 2 === 1) r.getCell(colIdx).fill = STYLES.dataRowEvenFill;
    });
  });

  // Blank row
  ws.addRow([]);

  // Section Header: Top Five Selling Products
  const secRow2 = ws.addRow(['TOP FIVE SELLING PRODUCTS IN SELECTED PERIOD', '', '', '', '', '']);
  ws.mergeCells(`A${secRow2.number}:F${secRow2.number}`);
  secRow2.getCell(1).fill = STYLES.sectionHeaderFill;
  secRow2.getCell(1).font = STYLES.sectionHeaderFont;
  secRow2.height = 24;

  const topHeaders = ['Rank', 'Product Name', 'Category', 'Quantity Sold', 'Revenue (₹)', 'Gross Profit (₹)'];
  const topHeaderRow = ws.addRow(topHeaders);
  topHeaderRow.height = 24;
  topHeaderRow.eachCell((cell) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = STYLES.headerAlignment;
    cell.border = STYLES.thinBorder;
  });

  const topProducts = db.prepare(`
    SELECT 
      p.name,
      c.name as category,
      p.unit,
      ROUND(SUM(si.quantity), 1) as quantity_sold,
      ROUND(SUM(si.total_price), 2) as revenue,
      ROUND(SUM(si.profit), 2) as profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE ${salesWhere}
    GROUP BY p.id
    ORDER BY quantity_sold DESC
    LIMIT 5
  `).all(...salesParams);

  topProducts.forEach((p, idx) => {
    const row = ws.addRow([
      `#${idx + 1}`,
      p.name,
      p.category,
      p.quantity_sold,
      p.revenue,
      p.profit
    ]);
    row.height = 20;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(4).numFmt = STYLES.numFmtQuantity;
    row.getCell(5).numFmt = STYLES.numFmtCurrency;
    row.getCell(6).numFmt = STYLES.numFmtCurrency;
    row.eachCell((cell, colNumber) => {
      cell.font = STYLES.dataFont;
      cell.border = STYLES.thinBorder;
      if (idx % 2 === 1) cell.fill = STYLES.dataRowEvenFill;
    });
  });

  autoFitColumns(ws, 12, 38);
}

// --- SHEET 2: PRODUCT MASTER ---
function buildSheet2ProductMaster(workbook, filters) {
  const ws = workbook.addWorksheet('Product Master', {
    properties: { tabColor: { argb: 'FF0284C7' } }
  });

  const headers = [
    'Product ID',
    'Product Name',
    'Category',
    'Unit',
    'Cost Price (₹)',
    'Selling Price (₹)',
    'Minimum Stock',
    'Current Stock',
    'Stock Status',
    'Barcode / SKU',
    'Supplier'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  // Freeze header and enable filters
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'K1' };

  let query = `
    SELECT 
      p.id,
      p.name,
      c.name as category,
      p.unit,
      p.purchase_price,
      p.selling_price,
      p.min_stock_level AS min_stock,
      COALESCE(stock_agg.current_stock, 0) as current_stock,
      p.sku,
      COALESCE(s.name, 'Multiple / Local Farm') as supplier_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN (
      SELECT product_id, ROUND(SUM(current_quantity), 2) as current_stock
      FROM batches
      WHERE current_quantity > 0
      GROUP BY product_id
    ) stock_agg ON p.id = stock_agg.product_id
    WHERE 1=1
  `;
  const params = [];
  if (filters.categoryId && filters.categoryId !== 'all') {
    query += ' AND p.category_id = ?';
    params.push(Number(filters.categoryId));
  }
  if (filters.productId && filters.productId !== 'all') {
    query += ' AND p.id = ?';
    params.push(Number(filters.productId));
  }
  query += ' ORDER BY c.name ASC, p.name ASC';

  const rows = db.prepare(query).all(...params);

  rows.forEach((p, idx) => {
    let status = 'Optimal';
    if (p.current_stock <= 0) status = 'Out of Stock';
    else if (p.current_stock <= p.min_stock) status = 'Low Stock';

    const r = ws.addRow([
      p.id,
      p.name,
      p.category,
      p.unit,
      p.purchase_price,
      p.selling_price,
      p.min_stock,
      p.current_stock,
      status,
      p.sku || '-',
      p.supplier_name
    ]);
    r.height = 20;

    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(5).numFmt = STYLES.numFmtCurrency;
    r.getCell(6).numFmt = STYLES.numFmtCurrency;
    r.getCell(7).numFmt = STYLES.numFmtQuantity;
    r.getCell(8).numFmt = STYLES.numFmtQuantity;
    r.getCell(9).alignment = { horizontal: 'center' };

    r.eachCell(c => {
      c.font = STYLES.dataFont;
      c.border = STYLES.thinBorder;
      if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
    });

    // 13.3 Conditional formatting highlight for low/out of stock
    if (status === 'Out of Stock') {
      r.getCell(8).fill = STYLES.outOfStockFill;
      r.getCell(9).fill = STYLES.outOfStockFill;
      r.getCell(9).font = { bold: true, color: { argb: 'FF991B1B' } };
    } else if (status === 'Low Stock') {
      r.getCell(8).fill = STYLES.lowStockFill;
      r.getCell(9).fill = STYLES.lowStockFill;
      r.getCell(9).font = { bold: true, color: { argb: 'FF92400E' } };
    }
  });

  autoFitColumns(ws, 12, 35);
}

// --- SHEET 3: DAILY SALES ---
function buildSheet3DailySales(workbook, filters) {
  const ws = workbook.addWorksheet('Daily Sales', {
    properties: { tabColor: { argb: 'FF16A34A' } }
  });

  const { startDate, endDate } = resolveDateRange(filters.range, filters.startDate, filters.endDate);
  const branchId = filters.branchId && filters.branchId !== 'all' ? Number(filters.branchId) : null;

  const headers = [
    'Invoice Number',
    'Date',
    'Product',
    'Category',
    'Quantity',
    'Unit',
    'Unit Price (₹)',
    'Discount (₹)',
    'Tax (₹)',
    'Revenue (₹)',
    'Cost of Goods (₹)',
    'Gross Profit (₹)',
    'Payment Method',
    'Customer',
    'Staff Cashier'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'O1' };

  let query = `
    SELECT 
      s.invoice_no,
      s.sale_date,
      p.name as product_name,
      c.name as category,
      si.quantity,
      p.unit,
      si.unit_price,
      ROUND(COALESCE(s.discount_amount * (si.total_price / MAX(1, s.total_amount)), 0), 2) as item_discount,
      ROUND(COALESCE(s.tax_amount * (si.total_price / MAX(1, s.total_amount)), 0), 2) as item_tax,
      si.total_price as revenue,
      ROUND(si.quantity * si.unit_cost, 2) as cogs,
      si.profit,
      s.payment_method,
      COALESCE(cust.name, 'Walk-in Retail') as customer_name,
      s.cashier_name
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN customers cust ON s.customer_id = cust.id
    WHERE s.sale_date >= ? AND s.sale_date <= ?
  `;
  const params = [startDate, endDate];
  if (branchId) {
    query += ' AND s.branch_id = ?';
    params.push(branchId);
  }
  if (filters.categoryId && filters.categoryId !== 'all') {
    query += ' AND p.category_id = ?';
    params.push(Number(filters.categoryId));
  }
  if (filters.productId && filters.productId !== 'all') {
    query += ' AND p.id = ?';
    params.push(Number(filters.productId));
  }
  query += ' ORDER BY s.sale_date DESC, s.id DESC';

  const rows = db.prepare(query).all(...params);

  let totalQty = 0;
  let totalDisc = 0;
  let totalTax = 0;
  let totalRev = 0;
  let totalCogs = 0;
  let totalProfit = 0;

  rows.forEach((item, idx) => {
    totalQty += item.quantity;
    totalDisc += item.item_discount;
    totalTax += item.item_tax;
    totalRev += item.revenue;
    totalCogs += item.cogs;
    totalProfit += item.profit;

    const r = ws.addRow([
      item.invoice_no,
      item.sale_date,
      item.product_name,
      item.category,
      item.quantity,
      item.unit,
      item.unit_price,
      item.item_discount,
      item.item_tax,
      item.revenue,
      item.cogs,
      item.profit,
      item.payment_method,
      item.customer_name,
      item.cashier_name
    ]);
    r.height = 20;

    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(2).alignment = { horizontal: 'center' };
    r.getCell(5).numFmt = STYLES.numFmtQuantity;
    r.getCell(7).numFmt = STYLES.numFmtCurrency;
    r.getCell(8).numFmt = STYLES.numFmtCurrency;
    r.getCell(9).numFmt = STYLES.numFmtCurrency;
    r.getCell(10).numFmt = STYLES.numFmtCurrency;
    r.getCell(11).numFmt = STYLES.numFmtCurrency;
    r.getCell(12).numFmt = STYLES.numFmtCurrency;

    r.eachCell(c => {
      c.font = STYLES.dataFont;
      c.border = STYLES.thinBorder;
      if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
    });
  });

  // 13.3 Formula Totals Row
  const lastRowIdx = rows.length + 1;
  const totRow = ws.addRow([
    'TOTALS',
    '',
    '',
    '',
    rows.length > 0 ? { formula: `SUM(E2:E${lastRowIdx})`, result: totalQty } : 0,
    '',
    '',
    rows.length > 0 ? { formula: `SUM(H2:H${lastRowIdx})`, result: totalDisc } : 0,
    rows.length > 0 ? { formula: `SUM(I2:I${lastRowIdx})`, result: totalTax } : 0,
    rows.length > 0 ? { formula: `SUM(J2:J${lastRowIdx})`, result: totalRev } : 0,
    rows.length > 0 ? { formula: `SUM(K2:K${lastRowIdx})`, result: totalCogs } : 0,
    rows.length > 0 ? { formula: `SUM(L2:L${lastRowIdx})`, result: totalProfit } : 0,
    '',
    '',
    ''
  ]);
  totRow.height = 24;
  totRow.getCell(5).numFmt = STYLES.numFmtQuantity;
  totRow.getCell(8).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(9).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(10).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(11).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(12).numFmt = STYLES.numFmtCurrency;

  totRow.eachCell(c => {
    c.fill = STYLES.totalRowFill;
    c.font = STYLES.totalFont;
    c.border = STYLES.totalBorder;
  });

  autoFitColumns(ws, 12, 35);
}

// --- SHEET 4: PURCHASE HISTORY ---
function buildSheet4PurchaseHistory(workbook, filters) {
  const ws = workbook.addWorksheet('Purchase History', {
    properties: { tabColor: { argb: 'FFF59E0B' } }
  });

  const { startDate, endDate } = resolveDateRange(filters.range, filters.startDate, filters.endDate);
  const branchId = filters.branchId && filters.branchId !== 'all' ? Number(filters.branchId) : null;

  const headers = [
    'Purchase ID',
    'Supplier',
    'Invoice / Bill #',
    'Date',
    'Product',
    'Category',
    'Quantity',
    'Unit',
    'Cost Price (₹)',
    'Total Amount (₹)',
    'Batch Number',
    'Expiry Date',
    'Payment Status'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'M1' };

  let query = `
    SELECT 
      pu.id as purchase_id,
      s.name as supplier_name,
      pu.invoice_no,
      pu.purchase_date,
      p.name as product_name,
      c.name as category,
      pi.quantity,
      p.unit,
      pi.unit_cost,
      pi.total_cost,
      pi.batch_number,
      pi.expiry_date,
      pu.payment_status
    FROM purchase_items pi
    JOIN purchases pu ON pi.purchase_id = pu.id
    JOIN suppliers s ON pu.supplier_id = s.id
    JOIN products p ON pi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE pu.purchase_date >= ? AND pu.purchase_date <= ?
  `;
  const params = [startDate, endDate];
  if (branchId) {
    query += ' AND pu.branch_id = ?';
    params.push(branchId);
  }
  if (filters.supplierId && filters.supplierId !== 'all') {
    query += ' AND pu.supplier_id = ?';
    params.push(Number(filters.supplierId));
  }
  if (filters.productId && filters.productId !== 'all') {
    query += ' AND pi.product_id = ?';
    params.push(Number(filters.productId));
  }
  query += ' ORDER BY pu.purchase_date DESC, pu.id DESC';

  const rows = db.prepare(query).all(...params);

  let totalQty = 0;
  let totalCost = 0;

  rows.forEach((pi, idx) => {
    totalQty += pi.quantity;
    totalCost += pi.total_cost;

    const r = ws.addRow([
      `PO-${String(pi.purchase_id).padStart(5, '0')}`,
      pi.supplier_name,
      pi.invoice_no,
      pi.purchase_date,
      pi.product_name,
      pi.category,
      pi.quantity,
      pi.unit,
      pi.unit_cost,
      pi.total_cost,
      pi.batch_number || '-',
      pi.expiry_date || '-',
      pi.payment_status
    ]);
    r.height = 20;

    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(4).alignment = { horizontal: 'center' };
    r.getCell(7).numFmt = STYLES.numFmtQuantity;
    r.getCell(9).numFmt = STYLES.numFmtCurrency;
    r.getCell(10).numFmt = STYLES.numFmtCurrency;
    r.getCell(12).alignment = { horizontal: 'center' };

    r.eachCell(c => {
      c.font = STYLES.dataFont;
      c.border = STYLES.thinBorder;
      if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
    });
  });

  const lastRowIdx = rows.length + 1;
  const totRow = ws.addRow([
    'TOTALS',
    '',
    '',
    '',
    '',
    '',
    rows.length > 0 ? { formula: `SUM(G2:G${lastRowIdx})`, result: totalQty } : 0,
    '',
    '',
    rows.length > 0 ? { formula: `SUM(J2:J${lastRowIdx})`, result: totalCost } : 0,
    '',
    '',
    ''
  ]);
  totRow.height = 24;
  totRow.getCell(7).numFmt = STYLES.numFmtQuantity;
  totRow.getCell(10).numFmt = STYLES.numFmtCurrency;
  totRow.eachCell(c => {
    c.fill = STYLES.totalRowFill;
    c.font = STYLES.totalFont;
    c.border = STYLES.totalBorder;
  });

  autoFitColumns(ws, 12, 35);
}

// --- SHEET 5: CURRENT INVENTORY (CANONICAL RECONCILIATION) ---
function buildSheet5CurrentInventory(workbook, filters) {
  const ws = workbook.addWorksheet('Current Inventory', {
    properties: { tabColor: { argb: 'FF8B5CF6' } }
  });

  const { startDate, endDate } = resolveDateRange(filters.range, filters.startDate, filters.endDate);

  const headers = [
    'Product ID',
    'Product',
    'Category',
    'Unit',
    'Opening Stock',
    'Purchases (+)',
    'Sales Returns (+)',
    'Quantity Sold (-)',
    'Supplier Returns (-)',
    'Net Transfers (±)',
    'Wastage / Loss (-)',
    'Closing Stock',
    'Unit Cost (₹)',
    'Stock Value (₹)',
    'Min Stock',
    'Stock Status'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'P1' };

  // Query each component of the canonical inventory formula:
  // Closing Stock = Opening + Purchases + Sales Returns - Sales - Supplier Returns ± Transfers - Wastage
  const products = db.prepare(`
    SELECT 
      p.id,
      p.name,
      c.name as category,
      p.unit,
      p.purchase_price,
      p.min_stock_level AS min_stock,
      COALESCE(stock_agg.current_stock, 0) as closing_stock,
      COALESCE(sales_agg.sold_qty, 0) as sold_qty,
      COALESCE(pur_agg.pur_qty, 0) as pur_qty,
      COALESCE(sret_agg.sret_qty, 0) as sret_qty,
      COALESCE(cret_agg.cret_qty, 0) as cret_qty,
      COALESCE(waste_agg.waste_qty, 0) as waste_qty,
      COALESCE(open_agg.open_qty, 0) as open_stock
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN (
      SELECT product_id, ROUND(SUM(current_quantity), 2) as current_stock
      FROM batches
      WHERE current_quantity > 0
      GROUP BY product_id
    ) stock_agg ON p.id = stock_agg.product_id
    LEFT JOIN (
      SELECT si.product_id, ROUND(SUM(si.quantity), 2) as sold_qty
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY si.product_id
    ) sales_agg ON p.id = sales_agg.product_id
    LEFT JOIN (
      SELECT pi.product_id, ROUND(SUM(pi.quantity), 2) as pur_qty
      FROM purchase_items pi
      JOIN purchases pu ON pi.purchase_id = pu.id
      WHERE pu.purchase_date >= ? AND pu.purchase_date <= ? AND pu.status = 'Received'
      GROUP BY pi.product_id
    ) pur_agg ON p.id = pur_agg.product_id
    LEFT JOIN (
      SELECT product_id, ROUND(SUM(quantity), 2) as sret_qty
      FROM supplier_returns
      WHERE return_date >= ? AND return_date <= ?
      GROUP BY product_id
    ) sret_agg ON p.id = sret_agg.product_id
    LEFT JOIN (
      SELECT product_id, ROUND(SUM(quantity), 2) as cret_qty
      FROM customer_returns
      WHERE return_date >= ? AND return_date <= ?
      GROUP BY product_id
    ) cret_agg ON p.id = cret_agg.product_id
    LEFT JOIN (
      SELECT product_id, ROUND(SUM(quantity), 2) as waste_qty
      FROM waste_damaged
      WHERE recorded_date >= ? AND recorded_date <= ?
      GROUP BY product_id
    ) waste_agg ON p.id = waste_agg.product_id
    LEFT JOIN (
      SELECT product_id, ROUND(SUM(quantity), 2) as open_qty
      FROM stock_movements
      WHERE movement_type = 'Opening Stock Baseline'
      GROUP BY product_id
    ) open_agg ON p.id = open_agg.product_id
    WHERE p.status = 'Active'
    ORDER BY c.name ASC, p.name ASC
  `).all(startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate);

  let totalClosing = 0;
  let totalVal = 0;

  products.forEach((p, idx) => {
    // If opening stock was not explicitly set as baseline, deduce it from formula:
    // Opening = Closing - Purchases - Sales Returns + Sales + Supplier Returns + Wastage
    let opening = p.open_stock;
    if (opening === 0) {
      opening = Math.max(0, p.closing_stock - p.pur_qty - p.cret_qty + p.sold_qty + p.sret_qty + p.waste_qty);
    }
    const transfers = 0; // Standard single-branch balance
    const stockVal = p.closing_stock * p.purchase_price;
    totalClosing += p.closing_stock;
    totalVal += stockVal;

    let status = 'Optimal';
    if (p.closing_stock <= 0) status = 'Out of Stock';
    else if (p.closing_stock <= p.min_stock) status = 'Low Stock';

    const r = ws.addRow([
      p.id,
      p.name,
      p.category,
      p.unit,
      Number(opening.toFixed(2)),
      p.pur_qty,
      p.cret_qty,
      p.sold_qty,
      p.sret_qty,
      transfers,
      p.waste_qty,
      p.closing_stock,
      p.purchase_price,
      Number(stockVal.toFixed(2)),
      p.min_stock,
      status
    ]);
    r.height = 20;

    r.getCell(1).alignment = { horizontal: 'center' };
    [5, 6, 7, 8, 9, 10, 11, 12, 15].forEach(colIdx => {
      r.getCell(colIdx).numFmt = STYLES.numFmtQuantity;
    });
    r.getCell(13).numFmt = STYLES.numFmtCurrency;
    r.getCell(14).numFmt = STYLES.numFmtCurrency;
    r.getCell(16).alignment = { horizontal: 'center' };

    r.eachCell(c => {
      c.font = STYLES.dataFont;
      c.border = STYLES.thinBorder;
      if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
    });

    if (status === 'Out of Stock') {
      r.getCell(12).fill = STYLES.outOfStockFill;
      r.getCell(16).fill = STYLES.outOfStockFill;
      r.getCell(16).font = { bold: true, color: { argb: 'FF991B1B' } };
    } else if (status === 'Low Stock') {
      r.getCell(12).fill = STYLES.lowStockFill;
      r.getCell(16).fill = STYLES.lowStockFill;
      r.getCell(16).font = { bold: true, color: { argb: 'FF92400E' } };
    }
  });

  const lastRowIdx = products.length + 1;
  const totRow = ws.addRow([
    'TOTALS',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    products.length > 0 ? { formula: `SUM(L2:L${lastRowIdx})`, result: totalClosing } : 0,
    '',
    products.length > 0 ? { formula: `SUM(N2:N${lastRowIdx})`, result: totalVal } : 0,
    '',
    ''
  ]);
  totRow.height = 24;
  totRow.getCell(12).numFmt = STYLES.numFmtQuantity;
  totRow.getCell(14).numFmt = STYLES.numFmtCurrency;
  totRow.eachCell(c => {
    c.fill = STYLES.totalRowFill;
    c.font = STYLES.totalFont;
    c.border = STYLES.totalBorder;
  });

  autoFitColumns(ws, 12, 34);
}

// --- SHEET 6: STOCK MOVEMENT ---
function buildSheet6StockMovement(workbook, filters) {
  const ws = workbook.addWorksheet('Stock Movement', {
    properties: { tabColor: { argb: 'FF0D9488' } }
  });

  const { startDate, endDate } = resolveDateRange(filters.range, filters.startDate, filters.endDate);

  const headers = [
    'Movement ID',
    'Product',
    'Category',
    'Date & Time',
    'Movement Type',
    'Direction',
    'Quantity',
    'Unit',
    'Reason / Notes',
    'Previous Stock',
    'Updated Stock',
    'Reference Txn',
    'Recorded By'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'M1' };

  let query = `
    SELECT 
      m.id,
      p.name as product_name,
      c.name as category,
      m.movement_date,
      m.movement_type,
      m.flow_type,
      m.quantity,
      m.unit,
      m.reason,
      m.previous_stock,
      m.updated_stock,
      m.reference_txn,
      m.performed_by
    FROM stock_movements m
    JOIN products p ON m.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE m.movement_date >= ? AND m.movement_date <= ?
  `;
  const params = [startDate, endDate];
  if (filters.movementType && filters.movementType !== 'all') {
    query += ' AND m.movement_type = ?';
    params.push(filters.movementType);
  }
  if (filters.productId && filters.productId !== 'all') {
    query += ' AND m.product_id = ?';
    params.push(Number(filters.productId));
  }
  query += ' ORDER BY m.id DESC';

  const rows = db.prepare(query).all(...params);

  rows.forEach((m, idx) => {
    const r = ws.addRow([
      `MOV-${String(m.id).padStart(6, '0')}`,
      m.product_name,
      m.category,
      m.movement_date,
      m.movement_type,
      m.flow_type,
      m.quantity,
      m.unit,
      m.reason || '-',
      m.previous_stock,
      m.updated_stock,
      m.reference_txn || '-',
      m.performed_by || 'Staff'
    ]);
    r.height = 20;

    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(4).alignment = { horizontal: 'center' };
    r.getCell(6).alignment = { horizontal: 'center' };
    r.getCell(7).numFmt = STYLES.numFmtQuantity;
    r.getCell(10).numFmt = STYLES.numFmtQuantity;
    r.getCell(11).numFmt = STYLES.numFmtQuantity;

    r.eachCell(c => {
      c.font = STYLES.dataFont;
      c.border = STYLES.thinBorder;
      if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
    });

    if (m.flow_type === 'Inflow') {
      r.getCell(6).font = { bold: true, color: { argb: 'FF15803D' } };
    } else {
      r.getCell(6).font = { bold: true, color: { argb: 'FFB91C1C' } };
    }
  });

  autoFitColumns(ws, 12, 35);
}

// --- SHEET 7: TOP SELLING PRODUCTS ---
function buildSheet7TopSelling(workbook, filters) {
  const ws = workbook.addWorksheet('Top Selling Products', {
    properties: { tabColor: { argb: 'FF10B981' } }
  });

  const { startDate, endDate } = resolveDateRange(filters.range, filters.startDate, filters.endDate);

  const headers = [
    'Rank',
    'Product',
    'Category',
    'Quantity Sold',
    'Unit',
    'Revenue (₹)',
    'Cost of Goods (₹)',
    'Gross Profit (₹)',
    'Margin %',
    'Number of Transactions'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'J1' };

  let query = `
    SELECT 
      p.name as product_name,
      c.name as category,
      p.unit,
      ROUND(SUM(si.quantity), 1) as quantity_sold,
      ROUND(SUM(si.total_price), 2) as revenue,
      ROUND(SUM(si.quantity * si.unit_cost), 2) as cogs,
      ROUND(SUM(si.profit), 2) as profit,
      COUNT(DISTINCT s.id) as tx_count
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE s.sale_date >= ? AND s.sale_date <= ?
  `;
  const params = [startDate, endDate];
  if (filters.categoryId && filters.categoryId !== 'all') {
    query += ' AND p.category_id = ?';
    params.push(Number(filters.categoryId));
  }
  query += ' GROUP BY p.id ORDER BY quantity_sold DESC';

  const rows = db.prepare(query).all(...params);

  let totalQty = 0;
  let totalRev = 0;
  let totalCogs = 0;
  let totalProfit = 0;
  let totalTx = 0;

  rows.forEach((p, idx) => {
    totalQty += p.quantity_sold;
    totalRev += p.revenue;
    totalCogs += p.cogs;
    totalProfit += p.profit;
    totalTx += p.tx_count;

    const marginPct = p.revenue > 0 ? (p.profit / p.revenue) : 0;

    const r = ws.addRow([
      `#${idx + 1}`,
      p.product_name,
      p.category,
      p.quantity_sold,
      p.unit,
      p.revenue,
      p.cogs,
      p.profit,
      marginPct,
      p.tx_count
    ]);
    r.height = 20;

    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(4).numFmt = STYLES.numFmtQuantity;
    r.getCell(6).numFmt = STYLES.numFmtCurrency;
    r.getCell(7).numFmt = STYLES.numFmtCurrency;
    r.getCell(8).numFmt = STYLES.numFmtCurrency;
    r.getCell(9).numFmt = STYLES.numFmtPercent;
    r.getCell(10).numFmt = STYLES.numFmtInteger;

    r.eachCell(c => {
      c.font = STYLES.dataFont;
      c.border = STYLES.thinBorder;
      if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
    });
  });

  const lastRowIdx = rows.length + 1;
  const totRow = ws.addRow([
    'TOTALS',
    '',
    '',
    rows.length > 0 ? { formula: `SUM(D2:D${lastRowIdx})`, result: totalQty } : 0,
    '',
    rows.length > 0 ? { formula: `SUM(F2:F${lastRowIdx})`, result: totalRev } : 0,
    rows.length > 0 ? { formula: `SUM(G2:G${lastRowIdx})`, result: totalCogs } : 0,
    rows.length > 0 ? { formula: `SUM(H2:H${lastRowIdx})`, result: totalProfit } : 0,
    totalRev > 0 ? (totalProfit / totalRev) : 0,
    rows.length > 0 ? { formula: `SUM(J2:J${lastRowIdx})`, result: totalTx } : 0
  ]);
  totRow.height = 24;
  totRow.getCell(4).numFmt = STYLES.numFmtQuantity;
  totRow.getCell(6).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(7).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(8).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(9).numFmt = STYLES.numFmtPercent;
  totRow.getCell(10).numFmt = STYLES.numFmtInteger;

  totRow.eachCell(c => {
    c.fill = STYLES.totalRowFill;
    c.font = STYLES.totalFont;
    c.border = STYLES.totalBorder;
  });

  autoFitColumns(ws, 12, 35);
}

// --- SHEET 8: PROFIT AND LOSS ---
function buildSheet8ProfitAndLoss(workbook, filters) {
  const ws = workbook.addWorksheet('Profit and Loss', {
    properties: { tabColor: { argb: 'FFEA580C' } }
  });

  const { startDate, endDate, label } = resolveDateRange(filters.range, filters.startDate, filters.endDate);

  // Title Banner
  ws.mergeCells('A1:D1');
  const t = ws.getCell('A1');
  t.value = 'DAIRYTRACK – STATEMENT OF PROFIT AND LOSS';
  t.fill = STYLES.titleBannerFill;
  t.font = STYLES.titleBannerFont;
  t.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 36;

  ws.mergeCells('A2:D2');
  const st = ws.getCell('A2');
  st.value = `Accounting Timeframe: ${label} | Prepared under True Cost Principle`;
  st.fill = STYLES.titleBannerFill;
  st.font = STYLES.subTitleFont;
  st.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 20;

  ws.addRow([]);

  const headers = ['Financial Metric', 'Amount (₹)', '% of Net Sales', 'Accounting Classification & Notes'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  // Calculate figures from database
  const sales = db.prepare(`
    SELECT 
      COALESCE(SUM(total_amount), 0) as gross_sales,
      COALESCE(SUM(discount_amount), 0) as discounts,
      COALESCE(SUM(total_cost), 0) as cogs,
      COUNT(id) as orders
    FROM sales
    WHERE sale_date >= ? AND sale_date <= ?
  `).get(startDate, endDate);

  const returnsRow = db.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) as returns
    FROM customer_returns
    WHERE return_date >= ? AND return_date <= ?
  `).get(startDate, endDate);
  const returns = returnsRow ? returnsRow.returns : 0;

  const grossSales = sales.gross_sales;
  const discounts = sales.discounts;
  const netSales = Math.max(0, grossSales - discounts - returns);
  const cogs = sales.cogs;
  const grossProfit = netSales - cogs;

  const expRows = db.prepare(`
    SELECT category, ROUND(SUM(amount), 2) as amount
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
    GROUP BY category
  `).all(startDate, endDate);

  const expMap = {};
  let totalExpenses = 0;
  expRows.forEach(e => {
    expMap[e.category] = e.amount;
    totalExpenses += e.amount;
  });

  const rent = expMap['Rent'] || 0;
  const electricity = expMap['Electricity'] || 0;
  const transport = expMap['Transport'] || 0;
  const salaries = expMap['Employee Salaries'] || 0;
  const otherExp = Math.max(0, totalExpenses - rent - electricity - transport - salaries);

  const operatingProfit = grossProfit - totalExpenses;

  const wasteLoss = db.prepare(`
    SELECT COALESCE(SUM(total_loss_value), 0) as loss
    FROM waste_damaged
    WHERE recorded_date >= ? AND recorded_date <= ?
  `).get(startDate, endDate).loss;

  const trueNetProfit = operatingProfit - wasteLoss;

  const pnlItems = [
    ['Gross Sales (POS Turnover)', grossSales, grossSales / Math.max(1, netSales), 'Total retail and wholesale receipts before deductions'],
    ['Less: Promotional Discounts Allowed', -discounts, -discounts / Math.max(1, netSales), 'Promotional price markdowns & customer concessions'],
    ['Less: Customer Sales Returns', -returns, -returns / Math.max(1, netSales), 'Value of damaged or rejected milk/curd refunded to buyers'],
    ['= NET SALES REVENUE', netSales, 1.0, 'Base operational turnover (100.0%)'],
    ['Less: Cost of Goods Sold (COGS)', -cogs, -cogs / Math.max(1, netSales), 'Actual FEFO purchase acquisition costs for sold units'],
    ['= GROSS PROFIT', grossProfit, grossProfit / Math.max(1, netSales), 'Gross margin available to cover store overheads'],
    ['Operating Overhead: Rent', -rent, -rent / Math.max(1, netSales), 'Dairy shop, processing floor & cold room lease expense'],
    ['Operating Overhead: Electricity', -electricity, -electricity / Math.max(1, netSales), 'Commercial chillers, deep freezers & milk vat power bills'],
    ['Operating Overhead: Transport / Logistics', -transport, -transport / Math.max(1, netSales), 'Milk procurement van diesel and distribution logistics'],
    ['Operating Overhead: Employee Salaries', -salaries, -salaries / Math.max(1, netSales), 'Monthly wages for counter cashiers and delivery staff'],
    ['Operating Overhead: Other Overheads', -otherExp, -otherExp / Math.max(1, netSales), 'Lactometer chemicals, butter paper, poly bags & repairs'],
    ['TOTAL OPERATING EXPENSES', -totalExpenses, -totalExpenses / Math.max(1, netSales), 'Total fixed and variable shop operational overheads'],
    ['= OPERATING PROFIT (EBITDA)', operatingProfit, operatingProfit / Math.max(1, netSales), 'Operational earnings before spoilage write-offs and tax'],
    ['Less: Spoilage, Expiry & Leakage Losses', -wasteLoss, -wasteLoss / Math.max(1, netSales), 'Direct asset write-offs of expired milk, curd, or curdled stock'],
    ['= TRUE NET BUSINESS PROFIT', trueNetProfit, trueNetProfit / Math.max(1, netSales), 'Final bottom-line net profit retained by business']
  ];

  pnlItems.forEach(([name, amt, pct, notes], idx) => {
    const isHeaderLine = name.startsWith('=') || name === 'TOTAL OPERATING EXPENSES';
    const r = ws.addRow([name, amt, pct, notes]);
    r.height = isHeaderLine ? 24 : 20;

    r.getCell(2).numFmt = STYLES.numFmtCurrency;
    r.getCell(3).numFmt = STYLES.numFmtPercent;

    if (isHeaderLine) {
      r.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: amt >= 0 ? 'FF15803D' : 'FFB91C1C' } };
      r.getCell(3).font = { name: 'Calibri', size: 10, bold: true };
      r.eachCell(c => {
        c.fill = STYLES.totalRowFill;
        c.border = STYLES.totalBorder;
      });
    } else {
      r.getCell(1).font = STYLES.dataFont;
      r.eachCell(c => {
        c.border = STYLES.thinBorder;
        if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
      });
    }
  });

  autoFitColumns(ws, 14, 45);
}

// --- SHEET 9: EXPIRED AND DAMAGED PRODUCTS ---
function buildSheet9ExpiredAndDamaged(workbook, filters) {
  const ws = workbook.addWorksheet('Expired and Damaged', {
    properties: { tabColor: { argb: 'FFDC2626' } }
  });

  const { startDate, endDate } = resolveDateRange(filters.range, filters.startDate, filters.endDate);

  const headers = [
    'Voucher ID',
    'Product',
    'Category',
    'Batch #',
    'Expiry Date',
    'Quantity Lost',
    'Unit',
    'Wastage Reason / Type',
    'Unit Cost (₹)',
    'Total Loss (₹)',
    'Disposal Action',
    'Recorded Date',
    'Recorded By'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'M1' };

  let query = `
    SELECT 
      w.id,
      p.name as product_name,
      c.name as category,
      COALESCE(b.batch_number, '-') as batch_no,
      COALESCE(b.expiry_date, '-') as expiry_date,
      w.quantity,
      w.unit,
      COALESCE(w.waste_type, w.reason) as reason,
      w.unit_cost,
      w.total_loss_value,
      COALESCE(w.action_taken, 'Safely Discarded') as action_taken,
      w.recorded_date,
      w.recorded_by
    FROM waste_damaged w
    JOIN products p ON w.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN batches b ON w.batch_id = b.id
    WHERE w.recorded_date >= ? AND w.recorded_date <= ?
  `;
  const params = [startDate, endDate];
  if (filters.categoryId && filters.categoryId !== 'all') {
    query += ' AND p.category_id = ?';
    params.push(Number(filters.categoryId));
  }
  query += ' ORDER BY w.recorded_date DESC, w.id DESC';

  const rows = db.prepare(query).all(...params);

  let totalQty = 0;
  let totalLoss = 0;

  rows.forEach((w, idx) => {
    totalQty += w.quantity;
    totalLoss += w.total_loss_value;

    const r = ws.addRow([
      `WST-${String(w.id).padStart(5, '0')}`,
      w.product_name,
      w.category,
      w.batch_no,
      w.expiry_date,
      w.quantity,
      w.unit,
      w.reason,
      w.unit_cost,
      w.total_loss_value,
      w.action_taken,
      w.recorded_date,
      w.recorded_by
    ]);
    r.height = 20;

    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(5).alignment = { horizontal: 'center' };
    r.getCell(6).numFmt = STYLES.numFmtQuantity;
    r.getCell(9).numFmt = STYLES.numFmtCurrency;
    r.getCell(10).numFmt = STYLES.numFmtCurrency;
    r.getCell(12).alignment = { horizontal: 'center' };

    r.eachCell(c => {
      c.font = STYLES.dataFont;
      c.border = STYLES.thinBorder;
      if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
    });

    // 13.3 Conditional formatting highlight for loss values
    r.getCell(10).fill = STYLES.expiredFill;
    r.getCell(10).font = { bold: true, color: { argb: 'FF991B1B' } };
  });

  const lastRowIdx = rows.length + 1;
  const totRow = ws.addRow([
    'TOTALS',
    '',
    '',
    '',
    '',
    rows.length > 0 ? { formula: `SUM(F2:F${lastRowIdx})`, result: totalQty } : 0,
    '',
    '',
    '',
    rows.length > 0 ? { formula: `SUM(J2:J${lastRowIdx})`, result: totalLoss } : 0,
    '',
    '',
    ''
  ]);
  totRow.height = 24;
  totRow.getCell(6).numFmt = STYLES.numFmtQuantity;
  totRow.getCell(10).numFmt = STYLES.numFmtCurrency;
  totRow.eachCell(c => {
    c.fill = STYLES.totalRowFill;
    c.font = STYLES.totalFont;
    c.border = STYLES.totalBorder;
  });

  autoFitColumns(ws, 12, 35);
}

// --- SHEET 10: SUPPLIER REPORT ---
function buildSheet10SupplierReport(workbook, filters) {
  const ws = workbook.addWorksheet('Supplier Report', {
    properties: { tabColor: { argb: 'FF4F46E5' } }
  });

  const { startDate, endDate } = resolveDateRange(filters.range, filters.startDate, filters.endDate);

  const headers = [
    'Supplier ID',
    'Supplier Name',
    'Contact Person',
    'Mobile Number',
    'Purchase Count',
    'Total Purchased (₹)',
    'Returns (₹)',
    'Payments (₹)',
    'Outstanding Balance (₹)',
    'Status'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell(c => {
    c.fill = STYLES.headerFill;
    c.font = STYLES.headerFont;
    c.alignment = STYLES.headerAlignment;
    c.border = STYLES.thinBorder;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'J1' };

  let query = `
    SELECT 
      s.id,
      s.name,
      s.contact_person,
      s.phone,
      s.status,
      COALESCE(p_agg.order_count, 0) as order_count,
      COALESCE(p_agg.total_purchased, 0) as total_purchased,
      COALESCE(ret_agg.total_returns, 0) as total_returns,
      COALESCE(pay_agg.total_paid, 0) as total_paid,
      s.balance_due as current_balance
    FROM suppliers s
    LEFT JOIN (
      SELECT 
        supplier_id,
        COUNT(id) as order_count,
        ROUND(SUM(total_amount), 2) as total_purchased
      FROM purchases
      WHERE purchase_date >= ? AND purchase_date <= ? AND status = 'Received'
      GROUP BY supplier_id
    ) p_agg ON s.id = p_agg.supplier_id
    LEFT JOIN (
      SELECT 
        supplier_id,
        ROUND(SUM(total_return_value), 2) as total_returns
      FROM supplier_returns
      WHERE return_date >= ? AND return_date <= ?
      GROUP BY supplier_id
    ) ret_agg ON s.id = ret_agg.supplier_id
    LEFT JOIN (
      SELECT 
        supplier_id,
        ROUND(SUM(amount), 2) as total_paid
      FROM supplier_payments
      WHERE payment_date >= ? AND payment_date <= ?
      GROUP BY supplier_id
    ) pay_agg ON s.id = pay_agg.supplier_id
    WHERE 1=1
  `;
  const params = [startDate, endDate, startDate, endDate, startDate, endDate];
  if (filters.supplierId && filters.supplierId !== 'all') {
    query += ' AND s.id = ?';
    params.push(Number(filters.supplierId));
  }
  query += ' ORDER BY total_purchased DESC, s.name ASC';

  const rows = db.prepare(query).all(...params);

  let totalOrders = 0;
  let totalPurchased = 0;
  let totalReturns = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  rows.forEach((s, idx) => {
    totalOrders += s.order_count;
    totalPurchased += s.total_purchased;
    totalReturns += s.total_returns;
    totalPaid += s.total_paid;
    totalBalance += (s.current_balance || 0);

    const r = ws.addRow([
      `SUP-${String(s.id).padStart(4, '0')}`,
      s.name,
      s.contact_person,
      s.phone,
      s.order_count,
      s.total_purchased,
      s.total_returns,
      s.total_paid,
      s.current_balance || 0,
      s.status
    ]);
    r.height = 20;

    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(5).numFmt = STYLES.numFmtInteger;
    r.getCell(6).numFmt = STYLES.numFmtCurrency;
    r.getCell(7).numFmt = STYLES.numFmtCurrency;
    r.getCell(8).numFmt = STYLES.numFmtCurrency;
    r.getCell(9).numFmt = STYLES.numFmtCurrency;
    r.getCell(10).alignment = { horizontal: 'center' };

    r.eachCell(c => {
      c.font = STYLES.dataFont;
      c.border = STYLES.thinBorder;
      if (idx % 2 === 1) c.fill = STYLES.dataRowEvenFill;
    });

    if (s.current_balance > 0) {
      r.getCell(9).font = { bold: true, color: { argb: 'FFB91C1C' } };
    }
  });

  const lastRowIdx = rows.length + 1;
  const totRow = ws.addRow([
    'TOTALS',
    '',
    '',
    '',
    rows.length > 0 ? { formula: `SUM(E2:E${lastRowIdx})`, result: totalOrders } : 0,
    rows.length > 0 ? { formula: `SUM(F2:F${lastRowIdx})`, result: totalPurchased } : 0,
    rows.length > 0 ? { formula: `SUM(G2:G${lastRowIdx})`, result: totalReturns } : 0,
    rows.length > 0 ? { formula: `SUM(H2:H${lastRowIdx})`, result: totalPaid } : 0,
    rows.length > 0 ? { formula: `SUM(I2:I${lastRowIdx})`, result: totalBalance } : 0,
    ''
  ]);
  totRow.height = 24;
  totRow.getCell(5).numFmt = STYLES.numFmtInteger;
  totRow.getCell(6).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(7).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(8).numFmt = STYLES.numFmtCurrency;
  totRow.getCell(9).numFmt = STYLES.numFmtCurrency;
  totRow.eachCell(c => {
    c.fill = STYLES.totalRowFill;
    c.font = STYLES.totalFont;
    c.border = STYLES.totalBorder;
  });

  autoFitColumns(ws, 12, 35);
}

// -------------------------------------------------------------
// MODULE 18: FORMULA INJECTION SANITIZATION HELPER
// Prevents CSV / Excel Formula Injection (DDE attacks)
// -------------------------------------------------------------
function sanitizeFormulaInjection(value) {
  if (typeof value === 'string') {
    // If the text starts with formula triggers =, +, -, @, tab, or newline, escape with apostrophe
    if (/^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }
  } else if (Array.isArray(value)) {
    return value.map(sanitizeFormulaInjection);
  } else if (value && typeof value === 'object' && !value.formula && !(value instanceof Date)) {
    const copy = {};
    for (const key of Object.keys(value)) {
      copy[key] = sanitizeFormulaInjection(value[key]);
    }
    return copy;
  }
  return value;
}

function secureWorkbook(workbook) {
  const origAddWorksheet = workbook.addWorksheet.bind(workbook);
  workbook.addWorksheet = function(name, options) {
    const sheet = origAddWorksheet(name, options);
    const origAddRow = sheet.addRow.bind(sheet);
    sheet.addRow = function(values, style) {
      const sanitized = sanitizeFormulaInjection(values);
      return origAddRow(sanitized, style);
    };
    return sheet;
  };
  return workbook;
}

// -------------------------------------------------------------
// MASTER COMPLETE WORKBOOK GENERATOR (10 WORKSHEETS)
// -------------------------------------------------------------
async function generateMasterExcelJSWorkbook(filters = {}) {
  const workbook = new ExcelJS.Workbook();
  secureWorkbook(workbook);
  workbook.creator = 'DairyTrack Smart Management & Analytics';
  workbook.lastModifiedBy = 'DairyTrack Automated Reporting Engine';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Build all 10 canonical worksheets
  buildSheet1DashboardSummary(workbook, filters);
  buildSheet2ProductMaster(workbook, filters);
  buildSheet3DailySales(workbook, filters);
  buildSheet4PurchaseHistory(workbook, filters);
  buildSheet5CurrentInventory(workbook, filters);
  buildSheet6StockMovement(workbook, filters);
  buildSheet7TopSelling(workbook, filters);
  buildSheet8ProfitAndLoss(workbook, filters);
  buildSheet9ExpiredAndDamaged(workbook, filters);
  buildSheet10SupplierReport(workbook, filters);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// -------------------------------------------------------------
// INDIVIDUAL WORKSHEET EXPORT GENERATOR
// -------------------------------------------------------------
async function generateSingleSheetExcelJS(sheetType, filters = {}) {
  const workbook = new ExcelJS.Workbook();
  secureWorkbook(workbook);
  workbook.creator = 'DairyTrack Smart Management & Analytics';

  switch (sheetType) {
    case 'dashboard':
    case 'summary':
      buildSheet1DashboardSummary(workbook, filters);
      break;
    case 'products':
    case 'product-master':
      buildSheet2ProductMaster(workbook, filters);
      break;
    case 'sales':
    case 'daily-sales':
      buildSheet3DailySales(workbook, filters);
      break;
    case 'purchases':
    case 'purchase-history':
      buildSheet4PurchaseHistory(workbook, filters);
      break;
    case 'inventory':
    case 'current-inventory':
      buildSheet5CurrentInventory(workbook, filters);
      break;
    case 'movements':
    case 'stock-movement':
      buildSheet6StockMovement(workbook, filters);
      break;
    case 'top-selling':
      buildSheet7TopSelling(workbook, filters);
      break;
    case 'pnl':
    case 'profit-and-loss':
      buildSheet8ProfitAndLoss(workbook, filters);
      break;
    case 'waste':
    case 'expired-damaged':
      buildSheet9ExpiredAndDamaged(workbook, filters);
      break;
    case 'suppliers':
    case 'supplier-report':
      buildSheet10SupplierReport(workbook, filters);
      break;
    default:
      // Master complete workbook
      return generateMasterExcelJSWorkbook(filters);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// -------------------------------------------------------------
// 13.4 REPORT PREVIEW DATA EXTRACTOR (JSON FOR FRONTEND PREVIEW)
// -------------------------------------------------------------
function getReportPreviewData(sheetType, filters = {}) {
  const { startDate, endDate, label } = resolveDateRange(filters.range, filters.startDate, filters.endDate);

  switch (sheetType) {
    case 'dashboard': {
      const summary = db.prepare(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as gross_sales,
          COALESCE(SUM(net_amount), 0) as net_sales,
          COALESCE(SUM(total_cost), 0) as cogs,
          COALESCE(SUM(profit_earned), 0) as gross_profit,
          COUNT(id) as orders
        FROM sales
        WHERE sale_date >= ? AND sale_date <= ?
      `).get(startDate, endDate);

      const exp = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date >= ? AND expense_date <= ?
      `).get(startDate, endDate).total;

      const waste = db.prepare(`
        SELECT COALESCE(SUM(total_loss_value), 0) as total FROM waste_damaged WHERE recorded_date >= ? AND recorded_date <= ?
      `).get(startDate, endDate).total;

      const headers = ['Metric', 'Value', 'Notes'];
      const rows = [
        ['Report Period', label, 'Active filter period'],
        ['Total Net Revenue', `₹${summary.net_sales.toFixed(2)}`, 'POS turnover'],
        ['Total Orders', summary.orders, 'Completed customer bills'],
        ['Gross Profit', `₹${summary.gross_profit.toFixed(2)}`, 'Net Sales minus COGS'],
        ['Operating Expenses', `₹${exp.toFixed(2)}`, 'Shop overheads'],
        ['Operating Profit', `₹${(summary.gross_profit - exp).toFixed(2)}`, 'Gross Profit - Expenses'],
        ['Wastage Loss', `₹${waste.toFixed(2)}`, 'Expired & damaged stock']
      ];

      return { sheetName: 'Dashboard Summary', headers, rows, count: rows.length };
    }

    case 'sales': {
      const sales = db.prepare(`
        SELECT 
          s.invoice_no, s.sale_date, p.name as product, si.quantity, p.unit, si.unit_price, si.total_price as revenue, s.payment_method
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE s.sale_date >= ? AND s.sale_date <= ?
        ORDER BY s.sale_date DESC LIMIT 50
      `).all(startDate, endDate);

      const headers = ['Invoice #', 'Date', 'Product', 'Quantity', 'Unit Price', 'Revenue', 'Payment Method'];
      const rows = sales.map(s => [
        s.invoice_no,
        s.sale_date,
        s.product,
        `${s.quantity} ${s.unit}`,
        `₹${s.unit_price}`,
        `₹${s.revenue}`,
        s.payment_method
      ]);
      return { sheetName: 'Daily Sales', headers, rows, count: sales.length };
    }

    case 'inventory': {
      const inv = db.prepare(`
        SELECT 
          p.id, p.name, c.name as category, p.unit, p.purchase_price, p.min_stock_level AS min_stock,
          COALESCE(SUM(b.current_quantity), 0) as closing_stock
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
        GROUP BY p.id
        ORDER BY c.name, p.name LIMIT 50
      `).all();

      const headers = ['ID', 'Product', 'Category', 'Stock on Hand', 'Unit Cost', 'Stock Value', 'Min Stock', 'Status'];
      const rows = inv.map(i => {
        const val = i.closing_stock * i.purchase_price;
        let st = 'Optimal';
        if (i.closing_stock <= 0) st = 'Out of Stock';
        else if (i.closing_stock <= i.min_stock) st = 'Low Stock';
        return [
          i.id,
          i.name,
          i.category,
          `${i.closing_stock} ${i.unit}`,
          `₹${i.purchase_price}`,
          `₹${val.toFixed(2)}`,
          `${i.min_stock} ${i.unit}`,
          st
        ];
      });
      return { sheetName: 'Current Inventory', headers, rows, count: inv.length };
    }

    case 'pnl': {
      const s = db.prepare(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as gross,
          COALESCE(SUM(discount_amount), 0) as disc,
          COALESCE(SUM(total_cost), 0) as cogs
        FROM sales WHERE sale_date >= ? AND sale_date <= ?
      `).get(startDate, endDate);

      const ret = db.prepare(`
        SELECT COALESCE(SUM(refund_amount), 0) as val FROM customer_returns WHERE return_date >= ? AND return_date <= ?
      `).get(startDate, endDate).val;

      const exp = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as val FROM expenses WHERE expense_date >= ? AND expense_date <= ?
      `).get(startDate, endDate).val;

      const waste = db.prepare(`
        SELECT COALESCE(SUM(total_loss_value), 0) as val FROM waste_damaged WHERE recorded_date >= ? AND recorded_date <= ?
      `).get(startDate, endDate).val;

      const net = Math.max(0, s.gross - s.disc - ret);
      const grossProfit = net - s.cogs;
      const opProfit = grossProfit - exp;
      const netProfit = opProfit - waste;

      const headers = ['Financial Metric', 'Amount', 'Accounting Description'];
      const rows = [
        ['Gross Sales', `₹${s.gross.toFixed(2)}`, 'Total POS retail receipts'],
        ['Less: Discounts', `-₹${s.disc.toFixed(2)}`, 'Promotions allowed'],
        ['Less: Customer Returns', `-₹${ret.toFixed(2)}`, 'Sales refunds'],
        ['= Net Sales', `₹${net.toFixed(2)}`, 'Base turnover'],
        ['Less: Cost of Goods (COGS)', `-₹${s.cogs.toFixed(2)}`, 'FEFO batch allocated procurement costs'],
        ['= Gross Profit', `₹${grossProfit.toFixed(2)}`, `Gross margin: ${net > 0 ? ((grossProfit/net)*100).toFixed(1) : 0}%`],
        ['Less: Operating Overheads', `-₹${exp.toFixed(2)}`, 'Rent, power, salaries, fuel'],
        ['= Operating Profit (EBITDA)', `₹${opProfit.toFixed(2)}`, 'Earnings before spoilage and tax'],
        ['Less: Expiry & Spoilage Write-offs', `-₹${waste.toFixed(2)}`, 'Expired/damaged write-offs'],
        ['= True Net Business Profit', `₹${netProfit.toFixed(2)}`, `Net margin: ${net > 0 ? ((netProfit/net)*100).toFixed(1) : 0}%`]
      ];
      return { sheetName: 'Profit and Loss', headers, rows, count: rows.length };
    }

    default: {
      // Default to Product Master preview
      const prods = db.prepare(`
        SELECT p.id, p.name, c.name as category, p.unit, p.purchase_price, p.selling_price, p.min_stock_level AS min_stock
        FROM products p
        JOIN categories c ON p.category_id = c.id
        ORDER BY c.name, p.name LIMIT 50
      `).all();
      const headers = ['ID', 'Product Name', 'Category', 'Unit', 'Cost Price', 'Selling Price', 'Min Stock'];
      const rows = prods.map(p => [
        p.id,
        p.name,
        p.category,
        p.unit,
        `₹${p.purchase_price}`,
        `₹${p.selling_price}`,
        p.min_stock
      ]);
      return { sheetName: 'Product Master', headers, rows, count: prods.length };
    }
  }
}

// -------------------------------------------------------------
// 13.4 HTML / PRINTABLE PDF SUMMARY GENERATOR
// -------------------------------------------------------------
function generatePrintableSummaryHtml(filters = {}) {
  const { startDate, endDate, label } = resolveDateRange(filters.range, filters.startDate, filters.endDate);

  const salesTotals = db.prepare(`
    SELECT 
      COALESCE(SUM(total_amount), 0) as gross_sales,
      COALESCE(SUM(discount_amount), 0) as discounts,
      COALESCE(SUM(net_amount), 0) as net_sales,
      COALESCE(SUM(total_cost), 0) as cogs,
      COALESCE(SUM(profit_earned), 0) as gross_profit,
      COUNT(id) as orders
    FROM sales
    WHERE sale_date >= ? AND sale_date <= ?
  `).get(startDate, endDate);

  const returns = db.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) as total FROM customer_returns WHERE return_date >= ? AND return_date <= ?
  `).get(startDate, endDate).total;

  const netSales = Math.max(0, salesTotals.gross_sales - salesTotals.discounts - returns);
  const grossProfit = netSales - salesTotals.cogs;

  const expenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date >= ? AND expense_date <= ?
  `).get(startDate, endDate).total;

  const spoilage = db.prepare(`
    SELECT COALESCE(SUM(total_loss_value), 0) as total FROM waste_damaged WHERE recorded_date >= ? AND recorded_date <= ?
  `).get(startDate, endDate).total;

  const operatingProfit = grossProfit - expenses;
  const netBusinessProfit = operatingProfit - spoilage;

  const topProducts = db.prepare(`
    SELECT 
      p.name, c.name as category, p.unit,
      ROUND(SUM(si.quantity), 1) as quantity_sold,
      ROUND(SUM(si.total_price), 2) as revenue,
      ROUND(SUM(si.profit), 2) as profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE s.sale_date >= ? AND s.sale_date <= ?
    GROUP BY p.id
    ORDER BY quantity_sold DESC
    LIMIT 5
  `).all(startDate, endDate);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DairyTrack Executive Report - ${label}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1E293B; line-height: 1.4; margin: 0; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #16A34A; padding-bottom: 12px; margin-bottom: 20px; }
    .brand-title { font-size: 24px; font-weight: 800; color: #15803D; margin: 0; }
    .brand-sub { font-size: 11px; color: #64748B; margin: 2px 0 0 0; }
    .meta-box { text-align: right; font-size: 11px; color: #475569; }
    .badge { display: inline-block; background: #DCFCE7; color: #15803D; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; }
    .section-title { font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; margin: 16px 0 8px 0; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .kpi-card { border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px; background: #F8FAFC; }
    .kpi-label { font-size: 10px; text-transform: uppercase; color: #64748B; font-weight: 700; }
    .kpi-value { font-size: 18px; font-weight: 800; color: #0F172A; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th { background: #15803D; color: #FFFFFF; text-align: left; padding: 6px 8px; font-weight: 700; }
    td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
    tr:nth-child(even) td { background: #F8FAFC; }
    .text-right { text-align: right; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 15px; border-top: 1px dashed #94A3B8; }
    .sig-box { width: 28%; text-align: center; font-size: 11px; color: #475569; }
    .sig-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-weight: 700; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:15px; text-align:right;">
    <button onclick="window.print()" style="padding:8px 16px; background:#16A34A; color:#fff; border:none; border-radius:4px; font-weight:700; cursor:pointer;">🖨️ Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1 class="brand-title">🥛 DairyTrack</h1>
      <p class="brand-sub">Smart Dairy Shop Management & Analytics System</p>
    </div>
    <div class="meta-box">
      <div><span class="badge">Official Business Summary</span></div>
      <div style="margin-top:4px;"><strong>Period:</strong> ${label}</div>
      <div><strong>Generated:</strong> ${formatDate(new Date())}</div>
    </div>
  </div>

  <div class="section-title">Executive Financial Summary</div>
  <div class="kpi-grid">
    <div class="kpi-card" style="border-top: 3px solid #16A34A;">
      <div class="kpi-label">Net Sales Revenue</div>
      <div class="kpi-value">₹${netSales.toFixed(2)}</div>
      <div style="font-size:9px; color:#64748B;">Orders: ${salesTotals.orders}</div>
    </div>
    <div class="kpi-card" style="border-top: 3px solid #0284C7;">
      <div class="kpi-label">Gross Profit</div>
      <div class="kpi-value" style="color:#0284C7;">₹${grossProfit.toFixed(2)}</div>
      <div style="font-size:9px; color:#64748B;">Margin: ${netSales > 0 ? ((grossProfit/netSales)*100).toFixed(1) : 0}%</div>
    </div>
    <div class="kpi-card" style="border-top: 3px solid #F59E0B;">
      <div class="kpi-label">Operating Expenses</div>
      <div class="kpi-value" style="color:#D97706;">₹${expenses.toFixed(2)}</div>
      <div style="font-size:9px; color:#64748B;">Rent, Power, Wages</div>
    </div>
    <div class="kpi-card" style="border-top: 3px solid #15803D;">
      <div class="kpi-label">True Net Profit</div>
      <div class="kpi-value" style="color:#15803D;">₹${netBusinessProfit.toFixed(2)}</div>
      <div style="font-size:9px; color:#64748B;">After spoilage loss</div>
    </div>
  </div>

  <div class="section-title">Top 5 Best-Selling Products</div>
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Product Name</th>
        <th>Category</th>
        <th class="text-right">Quantity Sold</th>
        <th class="text-right">Revenue (₹)</th>
        <th class="text-right">Gross Profit (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${topProducts.map((p, idx) => `
        <tr>
          <td>#${idx + 1}</td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category}</td>
          <td class="text-right">${p.quantity_sold} ${p.unit}</td>
          <td class="text-right">₹${p.revenue.toFixed(2)}</td>
          <td class="text-right" style="color:#15803D; font-weight:700;">+₹${p.profit.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">Statement of Profit & Loss Overview</div>
  <table>
    <thead>
      <tr>
        <th>Account Description</th>
        <th class="text-right">Amount (₹)</th>
        <th class="text-right">% Net Sales</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Gross Sales Revenue</td><td class="text-right">₹${salesTotals.gross_sales.toFixed(2)}</td><td class="text-right">${netSales > 0 ? ((salesTotals.gross_sales/netSales)*100).toFixed(1) : 0}%</td></tr>
      <tr><td>Less: Discounts & Concessions</td><td class="text-right">-₹${salesTotals.discounts.toFixed(2)}</td><td class="text-right">-</td></tr>
      <tr><td>Less: Customer Returns</td><td class="text-right">-₹${returns.toFixed(2)}</td><td class="text-right">-</td></tr>
      <tr style="font-weight:700; background:#F1F5F9;"><td>= Net Sales Revenue</td><td class="text-right">₹${netSales.toFixed(2)}</td><td class="text-right">100.0%</td></tr>
      <tr><td>Less: Cost of Goods Sold (COGS)</td><td class="text-right">-₹${salesTotals.cogs.toFixed(2)}</td><td class="text-right">${netSales > 0 ? ((salesTotals.cogs/netSales)*100).toFixed(1) : 0}%</td></tr>
      <tr style="font-weight:700; background:#F1F5F9;"><td>= Gross Profit</td><td class="text-right">₹${grossProfit.toFixed(2)}</td><td class="text-right">${netSales > 0 ? ((grossProfit/netSales)*100).toFixed(1) : 0}%</td></tr>
      <tr><td>Less: Operating Expenses (Rent, Power, Salaries, Transport)</td><td class="text-right">-₹${expenses.toFixed(2)}</td><td class="text-right">-</td></tr>
      <tr style="font-weight:700; background:#F1F5F9;"><td>= Operating Profit (EBITDA)</td><td class="text-right">₹${operatingProfit.toFixed(2)}</td><td class="text-right">${netSales > 0 ? ((operatingProfit/netSales)*100).toFixed(1) : 0}%</td></tr>
      <tr><td>Less: Spoilage & Expiry Losses</td><td class="text-right">-₹${spoilage.toFixed(2)}</td><td class="text-right">-</td></tr>
      <tr style="font-weight:800; background:#DCFCE7; color:#15803D;"><td>= True Net Business Profit</td><td class="text-right">₹${netBusinessProfit.toFixed(2)}</td><td class="text-right">${netSales > 0 ? ((netBusinessProfit/netSales)*100).toFixed(1) : 0}%</td></tr>
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line">Prepared By (Staff)</div>
    </div>
    <div class="sig-box">
      <div class="sig-line">Verified By (Manager)</div>
    </div>
    <div class="sig-box">
      <div class="sig-line">Authorized Signatory (Owner)</div>
    </div>
  </div>
</body>
</html>
  `;
  return html;
}

module.exports = {
  resolveDateRange,
  generateMasterExcelJSWorkbook,
  generateSingleSheetExcelJS,
  getReportPreviewData,
  generatePrintableSummaryHtml,
  sanitizeFormulaInjection
};
