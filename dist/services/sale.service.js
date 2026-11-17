"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleService = void 0;
const index_js_1 = require("../database/index.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
// Module 18: Critical section concurrency mutex for stock allocation
let saleCheckoutMutex = Promise.resolve();
async function runWithSaleMutex(fn) {
    let release = () => { };
    const nextLock = new Promise(resolve => { release = resolve; });
    const currentLock = saleCheckoutMutex;
    saleCheckoutMutex = nextLock;
    try {
        await currentLock;
        return await fn();
    }
    finally {
        release();
    }
}
class SaleService {
    /**
     * Get paginated sales records with search and filters
     */
    static async getSales(params) {
        const { offset, limit, search, filters, sortBy, sortOrder } = params;
        const conditions = ['1=1'];
        const queryParams = [];
        if (search) {
            conditions.push('(s.invoice_no LIKE ? OR c.name LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`);
        }
        if (filters.payment_method) {
            conditions.push('s.payment_method = ?');
            queryParams.push(filters.payment_method);
        }
        if (filters.customer_id) {
            conditions.push('s.customer_id = ?');
            queryParams.push(filters.customer_id);
        }
        const whereClause = conditions.join(' AND ');
        const countRes = await index_js_1.Database.queryOne(`
      SELECT COUNT(*) as total 
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE ${whereClause}
    `, queryParams);
        const allowedSort = {
            date: 's.created_at',
            created_at: 's.created_at',
            amount: 's.net_amount',
            net_amount: 's.net_amount',
        };
        const orderCol = allowedSort[sortBy] || 's.created_at';
        const items = await index_js_1.Database.query(`
      SELECT 
        s.id,
        s.invoice_no as invoice_number,
        s.customer_id,
        s.total_amount as subtotal,
        s.discount_amount as discount,
        s.tax_amount as tax,
        s.net_amount,
        s.total_cost as cost_of_goods_sold,
        s.profit_earned as gross_profit,
        s.payment_method,
        s.payment_status,
        s.created_at,
        c.name as customer_name,
        c.phone as customer_phone
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
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
     * Get single sale by ID with line items
     */
    static async getSaleById(id) {
        const sale = await index_js_1.Database.queryOne(`
      SELECT 
        s.id,
        s.invoice_no as invoice_number,
        s.customer_id,
        s.total_amount as subtotal,
        s.discount_amount as discount,
        s.tax_amount as tax,
        s.net_amount,
        s.total_cost as cost_of_goods_sold,
        s.profit_earned as gross_profit,
        s.payment_method,
        s.payment_status,
        s.notes,
        s.created_at,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `, [id]);
        if (!sale) {
            throw new errorHandler_js_1.AppError(`Sale invoice #${id} not found`, 404);
        }
        const items = await index_js_1.Database.query(`
      SELECT 
        si.*,
        p.name as product_name,
        p.sku as product_sku,
        p.unit as product_unit,
        b.batch_number as batch_code,
        b.expiry_date
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN batches b ON si.batch_id = b.id
      WHERE si.sale_id = ?
    `, [id]);
        sale.items = items;
        return sale;
    }
    /**
     * Process a new POS / Retail sale with FEFO batch allocation, concurrency lock and ledger logging
     */
    static async createSale(data) {
        return await runWithSaleMutex(async () => {
            if (!data.items || data.items.length === 0) {
                throw new errorHandler_js_1.AppError('Sale must include at least one item', 400);
            }
            // Check Idempotency Key
            if (data.idempotency_key) {
                const existing = await index_js_1.Database.queryOne(`SELECT * FROM sales WHERE notes LIKE ?`, [`%[IDEMPOTENCY:${data.idempotency_key}]%`]);
                if (existing) {
                    return SaleService.getSaleById(existing.id);
                }
            }
            const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;
            // Prevent duplicate invoice
            const existingInvoice = await index_js_1.Database.queryOne(`SELECT id FROM sales WHERE invoice_no = ?`, [invoiceNo]);
            if (existingInvoice) {
                throw new errorHandler_js_1.AppError(`Duplicate invoice number detected: ${invoiceNo}`, 409);
            }
            let subtotal = 0;
            let totalCogs = 0;
            const preparedItems = [];
            for (const item of data.items) {
                const prod = await index_js_1.Database.queryOne(`SELECT * FROM products WHERE id = ?`, [item.product_id]);
                if (!prod) {
                    throw new errorHandler_js_1.AppError(`Product #${item.product_id} not found`, 404);
                }
                const qty = Number(item.quantity);
                if (isNaN(qty) || !isFinite(qty) || qty <= 0) {
                    throw new errorHandler_js_1.AppError(`Invalid quantity for product ${prod.name}: must be a positive finite number`, 400);
                }
                // Module 18: Unit-based precision validation
                const countUnits = ['pcs', 'pkt', 'btl', 'cup', 'box', 'piece', 'packet', 'bottle'];
                const unitLower = (prod.unit || '').toLowerCase();
                if (countUnits.some(u => unitLower.includes(u))) {
                    if (!Number.isInteger(qty)) {
                        throw new errorHandler_js_1.AppError(`Invalid quantity entry: "${prod.name}" (${prod.unit}) requires whole integer quantities`, 400);
                    }
                }
                else {
                    const decimalStr = String(qty).split('.')[1] || '';
                    if (decimalStr.length > 3) {
                        throw new errorHandler_js_1.AppError(`Invalid quantity entry: "${prod.name}" (${prod.unit}) allows at most 3 decimal places`, 400);
                    }
                }
                const stockRow = await index_js_1.Database.queryOne(`
          SELECT COALESCE(SUM(current_quantity), 0) as current_stock FROM batches WHERE product_id = ? AND current_quantity > 0
        `, [prod.id]);
                const currentStock = Number(stockRow?.current_stock || 0);
                if (currentStock < qty) {
                    throw new errorHandler_js_1.AppError(`Insufficient stock for "${prod.name}". Available: ${currentStock}, Requested: ${qty}`, 400);
                }
                // FEFO Batch allocation: pick earliest expiring batch
                let batchId = item.batch_id;
                let unitCost = prod.purchase_price || 0;
                if (!batchId) {
                    const batch = await index_js_1.Database.queryOne(`
            SELECT id, purchase_cost, current_quantity 
            FROM batches 
            WHERE product_id = ? AND current_quantity >= ? 
            ORDER BY date(expiry_date) ASC 
            LIMIT 1
          `, [prod.id, qty]);
                    if (batch) {
                        batchId = batch.id;
                        unitCost = batch.purchase_cost || unitCost;
                    }
                    else {
                        const firstBatch = await index_js_1.Database.queryOne(`
              SELECT id, purchase_cost FROM batches WHERE product_id = ? AND current_quantity > 0 ORDER BY date(expiry_date) ASC LIMIT 1
            `, [prod.id]);
                        if (firstBatch) {
                            batchId = firstBatch.id;
                            unitCost = firstBatch.purchase_cost || unitCost;
                        }
                    }
                }
                const unitPrice = Number(item.unit_price !== undefined ? item.unit_price : prod.selling_price);
                const lineTotal = Number((qty * unitPrice).toFixed(2));
                const lineCogs = Number((qty * unitCost).toFixed(2));
                const lineProfit = Number((lineTotal - lineCogs).toFixed(2));
                subtotal += lineTotal;
                totalCogs += lineCogs;
                preparedItems.push({
                    productId: prod.id,
                    batchId: Number(batchId || 0),
                    quantity: qty,
                    unitPrice,
                    unitCost,
                    lineTotal,
                    lineProfit,
                    productName: prod.name,
                    prevStock: currentStock,
                });
            }
            const discount = Number(data.discount || 0);
            const tax = Number(data.tax || 0);
            const netAmount = Number(Math.max(0, subtotal - discount + tax).toFixed(2));
            const grossProfit = Number((netAmount - totalCogs).toFixed(2));
            const notesWithIdempotency = [
                data.notes || '',
                data.idempotency_key ? `[IDEMPOTENCY:${data.idempotency_key}]` : ''
            ].filter(Boolean).join(' ');
            // Create Sale record
            const saleResult = await index_js_1.Database.execute(`
        INSERT INTO sales (
          invoice_no, branch_id, customer_id, sale_date, total_amount, discount_amount, tax_amount,
          net_amount, total_cost, profit_earned, payment_method,
          payment_status, notes, created_at
        ) VALUES (?, 1, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, 'Paid', ?, datetime('now'))
      `, [
                invoiceNo,
                data.customer_id || null,
                subtotal,
                discount,
                tax,
                netAmount,
                totalCogs,
                grossProfit,
                data.payment_method || 'Cash',
                notesWithIdempotency,
            ]);
            const saleId = saleResult.lastInsertRowid;
            // Insert sale items and deduct stock atomically
            for (const item of preparedItems) {
                await index_js_1.Database.execute(`
          INSERT INTO sale_items (
            sale_id, product_id, batch_id, quantity, unit_price, unit_cost, total_price, profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [saleId, item.productId, item.batchId || null, item.quantity, item.unitPrice, item.unitCost, item.lineTotal, item.lineProfit]);
                if (item.batchId) {
                    await index_js_1.Database.execute(`
            UPDATE batches 
            SET current_quantity = MAX(0, current_quantity - ?) 
            WHERE id = ?
          `, [item.quantity, item.batchId]);
                }
                const updatedStock = item.prevStock - item.quantity;
                // Record in immutable stock ledger
                await index_js_1.Database.execute(`
          INSERT INTO stock_movements (
            movement_type, product_id, batch_id, from_branch_id, to_branch_id,
            quantity, previous_stock, updated_stock, flow_type, reference_txn,
            reason, performed_by, movement_date, created_at
          ) VALUES ('Sale Outflow', ?, ?, 1, 1, ?, ?, ?, 'Outflow', ?, ?, ?, date('now'), datetime('now'))
        `, [
                    item.productId,
                    item.batchId || null,
                    item.quantity,
                    item.prevStock,
                    updatedStock,
                    invoiceNo,
                    `POS Sale Invoice #${invoiceNo}`,
                    data.user_id || 'Cashier',
                ]);
            }
            return SaleService.getSaleById(saleId);
        });
    }
    /**
     * Module 18: Protect completed sales from unauthorized alteration or deletion
     */
    static async updateSale() {
        throw new errorHandler_js_1.AppError('COMPLETED_TRANSACTIONS_IMMUTABLE: Completed sales invoices cannot be modified directly. Process a customer return instead.', 403);
    }
    static async deleteSale() {
        throw new errorHandler_js_1.AppError('COMPLETED_TRANSACTIONS_IMMUTABLE: Completed sales invoices cannot be deleted. Process a customer return instead.', 403);
    }
    /**
     * Process customer sale return
     */
    static async createSaleReturn(saleId, returnData) {
        const sale = await SaleService.getSaleById(saleId);
        const qty = Number(returnData.quantity);
        if (qty <= 0) {
            throw new errorHandler_js_1.AppError('Return quantity must be greater than zero', 400);
        }
        const targetItem = returnData.product_id
            ? sale.items.find((i) => String(i.product_id) === String(returnData.product_id))
            : sale.items[0];
        if (!targetItem) {
            throw new errorHandler_js_1.AppError('Specified product was not found on this sale invoice', 404);
        }
        const refundAmount = Number((qty * targetItem.unit_price).toFixed(2));
        const restock = returnData.restock !== false;
        const returnNo = `RET-${Date.now().toString().slice(-6)}`;
        await index_js_1.Database.execute(`
      INSERT INTO customer_returns (
        return_no, sale_id, customer_id, product_id, batch_id,
        quantity, unit_price, refund_amount, reason, refund_method,
        return_date, processed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Cash', date('now'), ?, datetime('now'))
    `, [
            returnNo,
            saleId,
            sale.customer_id || null,
            targetItem.product_id,
            targetItem.batch_id || null,
            qty,
            targetItem.unit_price,
            refundAmount,
            returnData.reason.trim(),
            returnData.user_id || 'Cashier',
        ]);
        // Restock batch if requested
        if (restock && targetItem.batch_id) {
            await index_js_1.Database.execute(`UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?`, [qty, targetItem.batch_id]);
        }
        // Record movement in stock ledger
        if (restock) {
            const stockRow = await index_js_1.Database.queryOne(`
        SELECT COALESCE(SUM(current_quantity), 0) as current_stock FROM batches WHERE product_id = ? AND current_quantity > 0
      `, [targetItem.product_id]);
            const prevStock = Number(stockRow?.current_stock || 0);
            const updatedStock = prevStock + qty;
            await index_js_1.Database.execute(`
        INSERT INTO stock_movements (
          movement_type, product_id, batch_id, from_branch_id, to_branch_id,
          quantity, previous_stock, updated_stock, flow_type, reference_txn,
          reason, performed_by, movement_date, created_at
        ) VALUES ('Sales Return Inflow', ?, ?, 1, 1, ?, ?, ?, 'Inflow', ?, ?, ?, date('now'), datetime('now'))
      `, [
                targetItem.product_id,
                targetItem.batch_id || null,
                qty,
                prevStock,
                updatedStock,
                sale.invoice_number,
                `Customer Return for Inv #${sale.invoice_number}: ${returnData.reason}`,
                returnData.user_id || 'Cashier',
            ]);
        }
        return {
            return_no: returnNo,
            sale_id: saleId,
            product_name: targetItem.product_name,
            quantity_returned: qty,
            refund_amount: refundAmount,
            restocked: restock,
        };
    }
}
exports.SaleService = SaleService;
//# sourceMappingURL=sale.service.js.map