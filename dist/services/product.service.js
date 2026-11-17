"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const index_js_1 = require("../database/index.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
class ProductService {
    /**
     * List products with pagination, search, sorting and filtering
     */
    static async getProducts(params) {
        const { page, limit, offset, search, sortBy, sortOrder, filters } = params;
        const conditions = ['1=1'];
        const queryParams = [];
        // Search filter across name, SKU, and barcode
        if (search) {
            conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
            const wild = `%${search}%`;
            queryParams.push(wild, wild, wild);
        }
        // Category filter
        if (filters.category_id || filters.categoryId) {
            conditions.push('p.category_id = ?');
            queryParams.push(Number(filters.category_id || filters.categoryId));
        }
        // Status filter
        if (filters.status) {
            if (filters.status === 'Active') {
                conditions.push('(p.is_active = 1)');
            }
            else if (filters.status === 'Inactive') {
                conditions.push('(p.is_active = 0)');
            }
        }
        const whereClause = conditions.join(' AND ');
        // Safe sorting
        const allowedSortFields = {
            name: 'p.name',
            price: 'p.selling_price',
            selling_price: 'p.selling_price',
            cost_price: 'p.purchase_price',
            id: 'p.id',
        };
        const orderColumn = allowedSortFields[sortBy] || 'p.name';
        // Count total matches
        const countSql = `SELECT COUNT(*) as total FROM products p WHERE ${whereClause}`;
        const countResult = await index_js_1.Database.queryOne(countSql, queryParams);
        const total = countResult?.total || 0;
        // Fetch paginated rows with computed current_stock from batches
        const dataSql = `
      SELECT 
        p.id,
        p.category_id,
        p.name,
        p.sku,
        p.barcode,
        p.unit,
        p.purchase_price as cost_price,
        p.selling_price,
        p.min_stock_level,
        p.shelf_life_days,
        p.is_active,
        c.name as category_name,
        COALESCE((SELECT SUM(current_quantity) FROM batches WHERE product_id = p.id AND current_quantity > 0), 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
      ORDER BY ${orderColumn} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `;
        const rawItems = await index_js_1.Database.query(dataSql, [...queryParams, limit, offset]);
        const items = rawItems.map(p => ({
            ...p,
            cost_price: Number(p.cost_price || 0),
            selling_price: Number(p.selling_price || 0),
            current_stock: Number(p.current_stock || 0),
            status: p.is_active === 0 ? 'Inactive' : 'Active',
        }));
        return { items, total };
    }
    /**
     * Get product by ID
     */
    static async getProductById(id) {
        const p = await index_js_1.Database.queryOne(`SELECT 
        p.id, p.category_id, p.name, p.sku, p.barcode, p.unit,
        p.purchase_price as cost_price, p.selling_price, p.min_stock_level, p.shelf_life_days, p.is_active,
        c.name as category_name,
        COALESCE((SELECT SUM(current_quantity) FROM batches WHERE product_id = p.id AND current_quantity > 0), 0) as current_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`, [id]);
        if (!p) {
            throw new errorHandler_js_1.AppError(`Product with ID ${id} not found`, 404);
        }
        return {
            ...p,
            cost_price: Number(p.cost_price || 0),
            selling_price: Number(p.selling_price || 0),
            current_stock: Number(p.current_stock || 0),
            status: p.is_active === 0 ? 'Inactive' : 'Active',
        };
    }
    /**
     * Create a new product
     */
    static async createProduct(data) {
        const costPrice = Number(data.cost_price || 0);
        const sellingPrice = Number(data.selling_price || 0);
        const minStock = Number(data.min_stock_level || 5);
        const unit = data.unit || 'Piece';
        const sku = data.sku || `SKU-${Date.now().toString().slice(-6)}`;
        const barcode = data.barcode || `890${Date.now().toString().slice(-9)}`;
        const result = await index_js_1.Database.execute(`INSERT INTO products (
        name, category_id, sku, barcode, unit, purchase_price, selling_price,
        min_stock_level, shelf_life_days, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, [
            data.name?.trim(),
            data.category_id || 1,
            sku,
            barcode,
            unit,
            costPrice,
            sellingPrice,
            minStock,
            data.shelf_life_days || 7,
        ]);
        return ProductService.getProductById(result.lastInsertRowid);
    }
    /**
     * Update an existing product
     */
    static async updateProduct(id, data) {
        await ProductService.getProductById(id);
        const fields = [];
        const values = [];
        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name.trim());
        }
        if (data.category_id !== undefined) {
            fields.push('category_id = ?');
            values.push(data.category_id);
        }
        if (data.unit !== undefined) {
            fields.push('unit = ?');
            values.push(data.unit);
        }
        if (data.cost_price !== undefined) {
            fields.push('purchase_price = ?');
            values.push(Number(data.cost_price));
        }
        if (data.selling_price !== undefined) {
            fields.push('selling_price = ?');
            values.push(Number(data.selling_price));
        }
        if (data.min_stock_level !== undefined) {
            fields.push('min_stock_level = ?');
            values.push(Number(data.min_stock_level));
        }
        if (fields.length > 0) {
            values.push(id);
            await index_js_1.Database.execute(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
        }
        return ProductService.getProductById(id);
    }
    /**
     * Delete product by ID
     */
    static async deleteProduct(id) {
        await ProductService.getProductById(id);
        await index_js_1.Database.execute(`DELETE FROM products WHERE id = ?`, [id]);
        return { deleted: true, id };
    }
}
exports.ProductService = ProductService;
//# sourceMappingURL=product.service.js.map