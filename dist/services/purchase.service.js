"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseService = void 0;
const index_js_1 = require("../database/index.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
class PurchaseService {
    /**
     * Get paginated purchases
     */
    static async getPurchases(params) {
        const { offset, limit, search, filters, sortBy, sortOrder } = params;
        const conditions = ['1=1'];
        const queryParams = [];
        if (search) {
            conditions.push('(p.invoice_no LIKE ? OR s.name LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`);
        }
        if (filters.status) {
            conditions.push('p.status = ?');
            queryParams.push(filters.status);
        }
        if (filters.supplier_id) {
            conditions.push('p.supplier_id = ?');
            queryParams.push(filters.supplier_id);
        }
        const whereClause = conditions.join(' AND ');
        const countRes = await index_js_1.Database.queryOne(`
      SELECT COUNT(*) as total 
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE ${whereClause}
    `, queryParams);
        const allowedSort = {
            date: 'p.created_at',
            created_at: 'p.created_at',
            amount: 'p.total_amount',
        };
        const orderCol = allowedSort[sortBy] || 'p.created_at';
        const items = await index_js_1.Database.query(`
      SELECT 
        p.id,
        p.invoice_no as po_number,
        p.supplier_id,
        p.total_amount,
        p.net_amount,
        p.status,
        p.payment_status,
        p.created_at,
        s.name as supplier_name,
        s.company_name,
        s.phone as supplier_phone
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
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
     * Get purchase by ID
     */
    static async getPurchaseById(id) {
        const po = await index_js_1.Database.queryOne(`
      SELECT 
        p.id,
        p.invoice_no as po_number,
        p.supplier_id,
        p.total_amount,
        p.net_amount,
        p.status,
        p.payment_status,
        p.created_at,
        s.name as supplier_name,
        s.company_name,
        s.phone as supplier_phone,
        s.email as supplier_email
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `, [id]);
        if (!po) {
            throw new errorHandler_js_1.AppError(`Purchase Order #${id} not found`, 404);
        }
        const items = await index_js_1.Database.query(`
      SELECT 
        pi.id,
        pi.purchase_id,
        pi.product_id,
        pi.quantity as ordered_quantity,
        pi.unit_cost as cost_price,
        pi.total_cost,
        pr.name as product_name,
        pr.unit as product_unit,
        pr.sku as product_sku
      FROM purchase_items pi
      JOIN products pr ON pi.product_id = pr.id
      WHERE pi.purchase_id = ?
    `, [id]);
        po.items = items;
        return po;
    }
    /**
     * Create a new purchase order
     */
    static async createPurchase(data) {
        if (!data.items || data.items.length === 0) {
            throw new errorHandler_js_1.AppError('Purchase order must contain at least one item', 400);
        }
        const supplier = await index_js_1.Database.queryOne(`SELECT * FROM suppliers WHERE id = ?`, [data.supplier_id]);
        if (!supplier) {
            throw new errorHandler_js_1.AppError('Selected supplier does not exist', 404);
        }
        const poNumber = `PO-${Date.now().toString().slice(-8)}`;
        let totalAmount = 0;
        for (const item of data.items) {
            const qty = Number(item.quantity);
            const cost = Number(item.cost_price);
            if (qty <= 0 || cost < 0) {
                throw new errorHandler_js_1.AppError('Invalid quantity or cost price in purchase items', 400);
            }
            totalAmount += Number((qty * cost).toFixed(2));
        }
        const poResult = await index_js_1.Database.execute(`
      INSERT INTO purchases (
        invoice_no, supplier_id, branch_id, purchase_date, total_amount,
        tax_amount, discount_amount, net_amount, payment_status,
        payment_method, status, notes, created_at
      ) VALUES (?, ?, 1, date('now'), ?, 0, 0, ?, 'Unpaid', 'Bank Transfer', 'Pending', ?, datetime('now'))
    `, [
            poNumber,
            data.supplier_id,
            totalAmount,
            totalAmount,
            data.notes || '',
        ]);
        const poId = poResult.lastInsertRowid;
        for (const item of data.items) {
            const lineTotal = Number((item.quantity * item.cost_price).toFixed(2));
            const batchNo = `B-${Date.now().toString().slice(-4)}`;
            await index_js_1.Database.execute(`
        INSERT INTO purchase_items (
          purchase_id, product_id, batch_number, mfg_date, expiry_date, quantity, unit_cost, total_cost
        ) VALUES (?, ?, ?, date('now'), date('now', '+7 days'), ?, ?, ?)
      `, [poId, item.product_id, batchNo, item.quantity, item.cost_price, lineTotal]);
        }
        return PurchaseService.getPurchaseById(poId);
    }
    /**
     * Receive goods for a purchase order, creating batches and updating inventory ledger
     */
    static async receivePurchase(id, receiveData) {
        const po = await PurchaseService.getPurchaseById(id);
        if (po.status === 'Received') {
            throw new errorHandler_js_1.AppError('Purchase order has already been received and credited to stock', 400);
        }
        for (const item of po.items) {
            const prod = await index_js_1.Database.queryOne(`SELECT * FROM products WHERE id = ?`, [item.product_id]);
            const stockRow = await index_js_1.Database.queryOne(`
        SELECT COALESCE(SUM(current_quantity), 0) as current_stock FROM batches WHERE product_id = ? AND current_quantity > 0
      `, [item.product_id]);
            const prevStock = Number(stockRow?.current_stock || 0);
            const qty = Number(item.ordered_quantity);
            const updatedStock = prevStock + qty;
            const shelfLife = Number(prod.shelf_life_days || 7);
            const now = new Date();
            now.setDate(now.getDate() + shelfLife);
            const expiryDate = now.toISOString().split('T')[0];
            const batchCode = `B-${prod.sku || prod.id}-${Date.now().toString().slice(-4)}`;
            // Create new batch record
            const batchRes = await index_js_1.Database.execute(`
        INSERT INTO batches (
          product_id, branch_id, batch_number, mfg_date, expiry_date, initial_quantity,
          current_quantity, purchase_cost, selling_price, status, created_at
        ) VALUES (?, 1, ?, date('now'), ?, ?, ?, ?, ?, 'Active', datetime('now'))
      `, [item.product_id, batchCode, expiryDate, qty, qty, item.cost_price, prod.selling_price]);
            const batchId = batchRes.lastInsertRowid;
            // Update product purchase_price
            await index_js_1.Database.execute(`
        UPDATE products 
        SET purchase_price = ?
        WHERE id = ?
      `, [item.cost_price, item.product_id]);
            // Record in immutable stock ledger
            await index_js_1.Database.execute(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id, to_branch_id,
          quantity, previous_stock, updated_stock, flow_type, reference_txn,
          reason, performed_by, movement_date, created_at
        ) VALUES ('Purchase Inward', ?, ?, 1, 1, ?, ?, ?, 'Inflow', ?, ?, ?, date('now'), datetime('now'))
      `, [
                item.product_id,
                batchId,
                qty,
                prevStock,
                updatedStock,
                po.po_number,
                `PO Inward Receipt #${po.po_number}`,
                receiveData?.user_id || 'Inventory Manager',
            ]);
        }
        // Mark PO as Received
        await index_js_1.Database.execute(`
      UPDATE purchases 
      SET status = 'Received', received_at = datetime('now')
      WHERE id = ?
    `, [id]);
        return PurchaseService.getPurchaseById(id);
    }
}
exports.PurchaseService = PurchaseService;
//# sourceMappingURL=purchase.service.js.map