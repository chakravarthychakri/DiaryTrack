// ====================================================================
// MODULE 4: PRODUCT MANAGEMENT & CATEGORY REST APIS
// ====================================================================

const {
  db,
  logAudit,
  UNIT_DEFINITIONS,
  canConvertUnits,
  convertQuantity
} = require('./db');

module.exports = function registerProductRoutes(app, authenticateToken, requireRole, optionalAuth) {
  // -------------------------------------------------------------
  // 4.3: UNITS & CONVERSION HELPERS
  // -------------------------------------------------------------
  app.get('/api/units', (req, res) => {
    res.json({
      success: true,
      data: UNIT_DEFINITIONS,
      list: Object.keys(UNIT_DEFINITIONS).map(u => ({
        name: u,
        ...UNIT_DEFINITIONS[u]
      }))
    });
  });

  app.post('/api/units/convert', (req, res) => {
    try {
      const { quantity, from_unit, to_unit } = req.body;
      if (quantity === undefined || !from_unit || !to_unit) {
        return res.status(400).json({ success: false, error: 'quantity, from_unit, and to_unit are required.' });
      }

      if (!canConvertUnits(from_unit, to_unit)) {
        return res.status(400).json({
          success: false,
          compatible: false,
          error: `Incompatible units: Cannot convert ${from_unit} (${UNIT_DEFINITIONS[from_unit]?.dimension}) to ${to_unit} (${UNIT_DEFINITIONS[to_unit]?.dimension}). Never combine incompatible units.`
        });
      }

      const converted = convertQuantity(Number(quantity), from_unit, to_unit);
      res.json({
        success: true,
        compatible: true,
        from_unit,
        to_unit,
        original_quantity: Number(quantity),
        converted_quantity: converted
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4.2: CATEGORY MANAGEMENT (CRUD)
  // -------------------------------------------------------------
  app.get('/api/categories', (req, res) => {
    try {
      const categories = db.prepare(`
        SELECT 
          c.*,
          COUNT(p.id) as product_count,
          SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) as active_product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id
        GROUP BY c.id
        ORDER BY c.name ASC
      `).all();

      res.json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/categories', authenticateToken, requireRole(['Administrator']), (req, res) => {
    try {
      const { name, description, icon = 'box' } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Category name is required.' });
      }

      const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(name.trim());
      if (existing) {
        return res.status(400).json({ success: false, error: 'A category with this name already exists.' });
      }

      const stmt = db.prepare('INSERT INTO categories (name, description, icon) VALUES (?, ?, ?)');
      const result = stmt.run(name.trim(), description || '', icon);
      const newId = Number(result.lastInsertRowid);

      logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_CATEGORY', 'CATEGORY', newId, `Added category: ${name.trim()}`, req.ip);
      res.json({ success: true, id: newId, message: 'Category created successfully!' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/categories/:id', authenticateToken, requireRole(['Administrator']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, description, icon } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Category name is required.' });
      }

      const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?').get(name.trim(), id);
      if (existing) {
        return res.status(400).json({ success: false, error: 'Another category with this name already exists.' });
      }

      db.prepare(`
        UPDATE categories 
        SET name = ?, description = COALESCE(?, description), icon = COALESCE(?, icon)
        WHERE id = ?
      `).run(name.trim(), description, icon, id);

      logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE_CATEGORY', 'CATEGORY', id, `Updated category: ${name.trim()}`, req.ip);
      res.json({ success: true, message: 'Category updated successfully!' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/categories/:id', authenticateToken, requireRole(['Administrator']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const prodCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id).count;

      if (prodCount > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete category: ${prodCount} products are currently assigned to this category. Please reassign them first.`
        });
      }

      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      logAudit(req.user.id, req.user.name, req.user.role, 'DELETE_CATEGORY', 'CATEGORY', id, `Deleted category id ${id}`, req.ip);
      res.json({ success: true, message: 'Category deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4.1 & 4.4: PRODUCT LISTING WITH FILTERS, SEARCH & SORTING
  // -------------------------------------------------------------
  app.get('/api/products', optionalAuth, (req, res) => {
    try {
      const { categoryId, search, status, sortBy = 'name_asc' } = req.query;

      let query = `
        SELECT 
          p.*,
          c.name as category_name,
          s.name as supplier_name,
          s.phone as supplier_phone,
          COALESCE(SUM(b.current_quantity), 0) as current_stock,
          COUNT(DISTINCT b.id) as active_batches,
          ROUND(COALESCE(SUM(b.current_quantity), 0) * p.purchase_price, 2) as stock_valuation
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
        WHERE 1=1
      `;
      const params = [];

      // Category filter
      if (categoryId && categoryId !== 'all') {
        query += ' AND p.category_id = ?';
        params.push(Number(categoryId));
      }

      // Search keyword (Name, SKU, Barcode, Description)
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?)';
        params.push(term, term, term, term);
      }

      // Status filters
      if (status === 'active') {
        query += " AND p.is_active = 1 AND (p.status = 'Active' OR p.status IS NULL)";
      } else if (status === 'inactive') {
        query += " AND (p.is_active = 0 OR p.status = 'Inactive')";
      } else if (status === 'discontinued') {
        query += " AND p.status = 'Discontinued'";
      }

      query += ' GROUP BY p.id';

      // Stock status (HAVING clause)
      if (status === 'low') {
        query += ' HAVING current_stock <= p.min_stock_level AND current_stock > 0';
      } else if (status === 'out') {
        query += ' HAVING current_stock = 0';
      } else if (status === 'in_stock') {
        query += ' HAVING current_stock > p.min_stock_level';
      }

      // Sorting
      switch (sortBy) {
        case 'price_asc':
          query += ' ORDER BY p.selling_price ASC';
          break;
        case 'price_desc':
          query += ' ORDER BY p.selling_price DESC';
          break;
        case 'name_desc':
          query += ' ORDER BY p.name DESC';
          break;
        case 'stock_desc':
          query += ' ORDER BY current_stock DESC';
          break;
        case 'stock_asc':
          query += ' ORDER BY current_stock ASC';
          break;
        case 'name_asc':
        default:
          query += ' ORDER BY p.name ASC';
          break;
      }

      const products = db.prepare(query).all(...params);

      // Add computed profit margins to each product
      const enrichedProducts = products.map(p => {
        const marginAmount = Number((p.selling_price - p.purchase_price).toFixed(2));
        const marginPercent = p.selling_price > 0
          ? Number(((marginAmount / p.selling_price) * 100).toFixed(1))
          : 0;

        return {
          ...p,
          margin_amount: marginAmount,
          margin_percent: marginPercent
        };
      });

      res.json({ success: true, data: enrichedProducts });
    } catch (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4.4: VIEW SINGLE PRODUCT DETAILS & COMPREHENSIVE OVERVIEW
  // -------------------------------------------------------------
  app.get('/api/products/:id', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const product = db.prepare(`
        SELECT 
          p.*,
          c.name as category_name,
          s.name as supplier_name,
          s.phone as supplier_phone,
          s.email as supplier_email
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = ?
      `).get(id);

      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      // 1. Active Batches with expiry days left
      const batches = db.prepare(`
        SELECT 
          b.*,
          br.name as branch_name,
          ROUND(b.current_quantity * b.purchase_cost, 2) as batch_valuation,
          CAST((julianday(b.expiry_date) - julianday('now')) AS INTEGER) as days_until_expiry
        FROM batches b
        JOIN branches br ON b.branch_id = br.id
        WHERE b.product_id = ? AND b.current_quantity > 0
        ORDER BY b.expiry_date ASC
      `).all(id);

      // 2. All-Time Sales Statistics
      const salesStats = db.prepare(`
        SELECT 
          COALESCE(SUM(si.quantity), 0) as total_units_sold,
          COALESCE(SUM(si.total_price), 0) as total_revenue,
          COALESCE(SUM(si.profit), 0) as total_profit,
          COUNT(DISTINCT si.sale_id) as total_orders
        FROM sale_items si
        WHERE si.product_id = ?
      `).get(id);

      // 3. All-Time Procurement Statistics
      const purchaseStats = db.prepare(`
        SELECT 
          COALESCE(SUM(pi.quantity), 0) as total_units_purchased,
          COALESCE(SUM(pi.total_cost), 0) as total_procurement_cost,
          COUNT(DISTINCT pi.purchase_id) as total_pos
        FROM purchase_items pi
        WHERE pi.product_id = ?
      `).get(id);

      // 4. Waste & Spoilage Statistics
      const wasteStats = db.prepare(`
        SELECT 
          COALESCE(SUM(quantity), 0) as total_units_spoiled,
          COALESCE(SUM(total_loss_value), 0) as total_waste_loss
        FROM waste_damaged
        WHERE product_id = ?
      `).get(id);

      const currentStock = batches.reduce((sum, b) => sum + b.current_quantity, 0);
      const stockValuation = Number((currentStock * product.purchase_price).toFixed(2));
      const marginAmount = Number((product.selling_price - product.purchase_price).toFixed(2));
      const marginPercent = product.selling_price > 0
        ? Number(((marginAmount / product.selling_price) * 100).toFixed(1))
        : 0;

      res.json({
        success: true,
        data: {
          ...product,
          current_stock: currentStock,
          stock_valuation: stockValuation,
          margin_amount: marginAmount,
          margin_percent: marginPercent,
          batches,
          sales_stats: salesStats,
          purchase_stats: purchaseStats,
          waste_stats: wasteStats
        }
      });
    } catch (err) {
      console.error('Error fetching product details:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4.4: VIEW PRODUCT SALES HISTORY
  // -------------------------------------------------------------
  app.get('/api/products/:id/sales-history', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const sales = db.prepare(`
        SELECT 
          s.id as sale_id,
          s.invoice_no,
          s.sale_date,
          COALESCE(c.name, 'Walk-in Retail') as customer_name,
          si.quantity,
          si.unit_price,
          si.unit_cost,
          si.total_price,
          si.profit,
          s.payment_method,
          s.payment_status,
          s.cashier_name,
          p.unit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE si.product_id = ?
        ORDER BY s.sale_date DESC, s.id DESC
        LIMIT 100
      `).all(id);

      res.json({ success: true, data: sales });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4.4: VIEW PRODUCT PURCHASE HISTORY
  // -------------------------------------------------------------
  app.get('/api/products/:id/purchase-history', optionalAuth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const purchases = db.prepare(`
        SELECT 
          pu.id as purchase_id,
          pu.invoice_no,
          pu.purchase_date,
          s.name as supplier_name,
          pi.batch_number,
          pi.mfg_date,
          pi.expiry_date,
          pi.quantity,
          pi.unit_cost,
          pi.total_cost,
          pu.payment_status,
          pu.payment_method,
          p.unit
        FROM purchase_items pi
        JOIN purchases pu ON pi.purchase_id = pu.id
        JOIN products p ON pi.product_id = p.id
        JOIN suppliers s ON pu.supplier_id = s.id
        WHERE pi.product_id = ?
        ORDER BY pu.purchase_date DESC, pu.id DESC
        LIMIT 100
      `).all(id);

      res.json({ success: true, data: purchases });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4.1: ADD PRODUCT (ADMIN & MANAGER)
  // -------------------------------------------------------------
  app.post('/api/products', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const {
        category_id,
        name,
        sku,
        barcode,
        unit,
        purchase_price,
        selling_price,
        min_stock_level,
        shelf_life_days,
        storage_temperature,
        description,
        supplier_id,
        image_url,
        status = 'Active'
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Product name is required.' });
      }
      if (!unit) {
        return res.status(400).json({ success: false, error: 'Measurement unit is required.' });
      }
      if (selling_price === undefined || Number(selling_price) < 0) {
        return res.status(400).json({ success: false, error: 'A valid non-negative selling price is required.' });
      }

      // Generate or normalize SKU
      let finalSku = (sku || '').trim().toUpperCase();
      if (!finalSku) {
        const prefix = name.trim().slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD');
        finalSku = `${prefix}-${Date.now().toString().slice(-5)}`;
      }

      // Check unique SKU
      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(finalSku);
      if (existing) {
        return res.status(400).json({ success: false, error: `A product with SKU "${finalSku}" already exists.` });
      }

      const stmt = db.prepare(`
        INSERT INTO products (
          category_id, name, sku, barcode, unit, purchase_price, selling_price,
          min_stock_level, shelf_life_days, storage_temperature, description,
          supplier_id, image_url, status, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      const result = stmt.run(
        category_id || 9,
        name.trim(),
        finalSku,
        barcode || finalSku,
        unit,
        Number(purchase_price) || 0,
        Number(selling_price) || 0,
        Number(min_stock_level) || 10,
        Number(shelf_life_days) || 3,
        storage_temperature || '2°C - 4°C',
        description || '',
        supplier_id ? Number(supplier_id) : null,
        image_url || '',
        status
      );

      const newId = Number(result.lastInsertRowid);
      logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_PRODUCT', 'PRODUCT', newId, `Added dairy product: ${name.trim()} (${finalSku})`, req.ip);

      res.status(201).json({
        success: true,
        id: newId,
        data: { id: newId, sku: finalSku },
        message: `Product "${name.trim()}" created successfully with SKU ${finalSku}!`
      });
    } catch (err) {
      console.error('Error creating product:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4.4: EDIT PRODUCT (ADMIN & MANAGER)
  // -------------------------------------------------------------
  app.put('/api/products/:id', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const {
        category_id,
        name,
        sku,
        barcode,
        unit,
        purchase_price,
        selling_price,
        min_stock_level,
        shelf_life_days,
        storage_temperature,
        description,
        supplier_id,
        image_url,
        status,
        is_active
      } = req.body;

      const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      if (sku) {
        const skuCheck = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(sku.trim().toUpperCase(), id);
        if (skuCheck) {
          return res.status(400).json({ success: false, error: `Another product with SKU "${sku}" already exists.` });
        }
      }

      let activeFlag = is_active !== undefined ? Number(is_active) : 1;
      let finalStatus = status || 'Active';
      if (finalStatus === 'Inactive' || finalStatus === 'Discontinued') {
        activeFlag = 0;
      } else if (activeFlag === 0) {
        finalStatus = 'Inactive';
      }

      db.prepare(`
        UPDATE products SET
          category_id = COALESCE(?, category_id),
          name = COALESCE(?, name),
          sku = COALESCE(?, sku),
          barcode = COALESCE(?, barcode),
          unit = COALESCE(?, unit),
          purchase_price = COALESCE(?, purchase_price),
          selling_price = COALESCE(?, selling_price),
          min_stock_level = COALESCE(?, min_stock_level),
          shelf_life_days = COALESCE(?, shelf_life_days),
          storage_temperature = COALESCE(?, storage_temperature),
          description = COALESCE(?, description),
          supplier_id = COALESCE(?, supplier_id),
          image_url = COALESCE(?, image_url),
          status = ?,
          is_active = ?
        WHERE id = ?
      `).run(
        category_id !== undefined ? Number(category_id) : null,
        name ? name.trim() : null,
        sku ? sku.trim().toUpperCase() : null,
        barcode !== undefined ? barcode : null,
        unit !== undefined ? unit : null,
        purchase_price !== undefined ? Number(purchase_price) : null,
        selling_price !== undefined ? Number(selling_price) : null,
        min_stock_level !== undefined ? Number(min_stock_level) : null,
        shelf_life_days !== undefined ? Number(shelf_life_days) : null,
        storage_temperature !== undefined ? storage_temperature : null,
        description !== undefined ? description : null,
        supplier_id !== undefined ? Number(supplier_id) : null,
        image_url !== undefined ? image_url : null,
        finalStatus,
        activeFlag,
        id
      );

      logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE_PRODUCT', 'PRODUCT', id, `Updated product details for ${name || product.name}`, req.ip);
      res.json({ success: true, message: 'Product updated successfully!' });
    } catch (err) {
      console.error('Error updating product:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4.4: DELETE OR DEACTIVATE PRODUCT (SOFT DELETE WITH TRANSACTION HISTORY SAFETY)
  // -------------------------------------------------------------
  app.delete('/api/products/:id', authenticateToken, requireRole(['Administrator']), (req, res) => {
    try {
      const id = Number(req.params.id);
      const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      // Check transaction history in sales, purchases, batches, waste
      const salesCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(id).count;
      const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?').get(id).count;
      const batchCount = db.prepare('SELECT COUNT(*) as count FROM batches WHERE product_id = ?').get(id).count;
      const wasteCount = db.prepare('SELECT COUNT(*) as count FROM waste_damaged WHERE product_id = ?').get(id).count;

      const hasHistory = salesCount > 0 || purchaseCount > 0 || batchCount > 0 || wasteCount > 0;

      if (hasHistory) {
        // Enforce soft delete / deactivation
        db.prepare("UPDATE products SET is_active = 0, status = 'Discontinued' WHERE id = ?").run(id);

        logAudit(
          req.user.id, req.user.name, req.user.role,
          'DEACTIVATE_PRODUCT', 'PRODUCT', id,
          `Soft deactivated product "${product.name}" due to transaction history (${salesCount} sales, ${purchaseCount} purchases, ${batchCount} batches).`,
          req.ip
        );

        return res.json({
          success: true,
          softDeleted: true,
          message: `Product "${product.name}" has ${salesCount} sales and ${purchaseCount} purchases. It has been safely deactivated and marked as "Discontinued" to preserve accounting records.`
        });
      }

      // If absolutely no history, hard delete can be safely performed
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      logAudit(req.user.id, req.user.name, req.user.role, 'DELETE_PRODUCT', 'PRODUCT', id, `Hard deleted product "${product.name}" (no transaction history).`, req.ip);

      res.json({
        success: true,
        softDeleted: false,
        message: `Product "${product.name}" had no transaction history and was permanently removed.`
      });
    } catch (err) {
      console.error('Error deleting product:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
};
