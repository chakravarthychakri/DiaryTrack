"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const index_js_1 = require("../database/index.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
class InventoryService {
    /**
     * Get current inventory summary, batch details, and stock valuations
     */
    static async getInventory(params) {
        const { offset, limit, search, filters } = params;
        const conditions = ['1=1'];
        const queryParams = [];
        if (search) {
            conditions.push('(p.name LIKE ? OR p.sku LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`);
        }
        if (filters.category_id) {
            conditions.push('p.category_id = ?');
            queryParams.push(filters.category_id);
        }
        const whereClause = conditions.join(' AND ');
        // Aggregate inventory stats
        const stats = await index_js_1.Database.queryOne(`
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COALESCE(SUM(b.current_quantity), 0) as total_units_in_stock,
        COALESCE(SUM(b.current_quantity * p.purchase_price), 0) as total_inventory_cost_value,
        COALESCE(SUM(b.current_quantity * p.selling_price), 0) as total_inventory_retail_value,
        SUM(CASE WHEN b.current_quantity <= p.min_stock_level AND b.current_quantity > 0 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN b.current_quantity IS NULL OR b.current_quantity <= 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
      WHERE ${whereClause}
    `, queryParams);
        // Paginated product inventory rows with active batches
        const products = await index_js_1.Database.query(`
      SELECT 
        p.id, p.name, p.sku, p.unit, p.min_stock_level,
        p.purchase_price as cost_price, p.selling_price, p.shelf_life_days,
        c.name as category_name,
        COALESCE(SUM(b.current_quantity), 0) as current_stock,
        ROUND(COALESCE(SUM(b.current_quantity), 0) * p.purchase_price, 2) as stock_valuation
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
      WHERE ${whereClause}
      GROUP BY p.id
      ORDER BY p.name ASC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);
        // Attach batch allocations for each product
        for (const prod of products) {
            const batchList = await index_js_1.Database.query(`
        SELECT id, batch_number as batch_code, expiry_date, current_quantity as quantity, purchase_cost as cost_price, status
        FROM batches
        WHERE product_id = ? AND current_quantity > 0
        ORDER BY date(expiry_date) ASC
      `, [prod.id]);
            prod.batches = batchList;
        }
        const countRes = await index_js_1.Database.queryOne(`
      SELECT COUNT(*) as total FROM products p WHERE ${whereClause}
    `, queryParams);
        return {
            stats: {
                total_products: stats?.total_products || 0,
                total_units: Number((stats?.total_units_in_stock || 0).toFixed(3)),
                total_valuation: Number((stats?.total_inventory_cost_value || 0).toFixed(2)),
                retail_valuation: Number((stats?.total_inventory_retail_value || 0).toFixed(2)),
                low_stock_count: stats?.low_stock_count || 0,
                out_of_stock_count: stats?.out_of_stock_count || 0,
            },
            items: products,
            total: countRes?.total || 0,
        };
    }
    /**
     * Get auditable stock ledger movements
     */
    static async getMovements(params) {
        const { offset, limit, search, filters, sortBy, sortOrder } = params;
        const conditions = ['1=1'];
        const queryParams = [];
        if (search) {
            conditions.push('(p.name LIKE ? OR m.reason LIKE ? OR m.reference_txn LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (filters.flow_type) {
            conditions.push('m.flow_type = ?');
            queryParams.push(filters.flow_type);
        }
        if (filters.movement_type) {
            conditions.push('m.movement_type = ?');
            queryParams.push(filters.movement_type);
        }
        if (filters.product_id) {
            conditions.push('m.product_id = ?');
            queryParams.push(filters.product_id);
        }
        const whereClause = conditions.join(' AND ');
        const countRes = await index_js_1.Database.queryOne(`
      SELECT COUNT(*) as total 
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      WHERE ${whereClause}
    `, queryParams);
        const allowedSort = {
            date: 'm.created_at',
            created_at: 'm.created_at',
            quantity: 'm.quantity',
            product: 'p.name',
        };
        const orderCol = allowedSort[sortBy] || 'm.created_at';
        const items = await index_js_1.Database.query(`
      SELECT 
        m.id,
        m.movement_type,
        m.flow_type,
        m.quantity,
        m.previous_stock,
        m.updated_stock,
        m.reference_txn as reference_id,
        m.reason,
        m.performed_by as recorded_by,
        m.created_at,
        p.name as product_name,
        p.unit as product_unit,
        b.batch_number as batch_code,
        b.expiry_date
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN batches b ON m.batch_id = b.id
      WHERE ${whereClause}
      ORDER BY ${orderCol} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);
        return {
            items,
            total: countRes?.total || 0,
        };
    }
    /**
     * Create an inventory adjustment (reconciliation, shrinkage, breakages)
     */
    static async createAdjustment(data) {
        const qty = Number(data.quantity);
        if (isNaN(qty) || qty <= 0) {
            throw new errorHandler_js_1.AppError('Quantity must be greater than zero', 400);
        }
        const product = await index_js_1.Database.queryOne(`SELECT * FROM products WHERE id = ?`, [data.product_id]);
        if (!product) {
            throw new errorHandler_js_1.AppError('Target product does not exist', 404);
        }
        const stockRow = await index_js_1.Database.queryOne(`
      SELECT COALESCE(SUM(current_quantity), 0) as current_stock FROM batches WHERE product_id = ? AND current_quantity > 0
    `, [data.product_id]);
        const prevStock = Number(stockRow?.current_stock || 0);
        const flowType = data.flow_type || 'Outflow';
        const movementType = data.movement_type || (flowType === 'Inflow' ? 'Audit Correction In' : 'Audit Correction Out');
        let updatedStock = prevStock;
        if (flowType === 'Inflow') {
            updatedStock = prevStock + qty;
            // Add or credit to existing batch or create a reconciliation batch
            const existingBatch = await index_js_1.Database.queryOne(`
        SELECT id FROM batches WHERE product_id = ? AND current_quantity > 0 LIMIT 1
      `, [data.product_id]);
            if (existingBatch) {
                await index_js_1.Database.execute(`UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?`, [qty, existingBatch.id]);
            }
            else {
                await index_js_1.Database.execute(`
          INSERT INTO batches (product_id, branch_id, batch_number, mfg_date, expiry_date, initial_quantity, current_quantity, purchase_cost, selling_price, status)
          VALUES (?, 1, ?, date('now'), date('now', '+7 days'), ?, ?, ?, ?, 'Active')
        `, [data.product_id, `ADJ-${Date.now().toString().slice(-4)}`, qty, qty, product.purchase_price, product.selling_price]);
            }
        }
        else {
            if (prevStock < qty) {
                throw new errorHandler_js_1.AppError(`Insufficient stock for outflow adjustment. Available: ${prevStock}, Requested: ${qty}`, 400);
            }
            updatedStock = prevStock - qty;
            // Deduct from batch
            await index_js_1.Database.execute(`
        UPDATE batches 
        SET current_quantity = MAX(0, current_quantity - ?) 
        WHERE id = (SELECT id FROM batches WHERE product_id = ? AND current_quantity > 0 ORDER BY date(expiry_date) ASC LIMIT 1)
      `, [qty, data.product_id]);
        }
        // Insert into stock_movements
        const result = await index_js_1.Database.execute(`
      INSERT INTO stock_movements (
        movement_type, product_id, batch_id, from_branch_id, to_branch_id,
        quantity, unit, previous_stock, updated_stock, flow_type,
        reference_txn, reason, performed_by, movement_date, created_at
      ) VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), datetime('now'))
    `, [
            movementType,
            data.product_id,
            data.batch_id || null,
            qty,
            product.unit,
            prevStock,
            updatedStock,
            flowType,
            `ADJ-${Date.now().toString().slice(-6)}`,
            data.reason.trim(),
            data.user_id || 'Administrator',
        ]);
        return {
            movement_id: result.lastInsertRowid,
            product_id: data.product_id,
            product_name: product.name,
            flow_type: flowType,
            quantity: qty,
            previous_stock: prevStock,
            updated_stock: updatedStock,
            reason: data.reason,
        };
    }
}
exports.InventoryService = InventoryService;
//# sourceMappingURL=inventory.service.js.map