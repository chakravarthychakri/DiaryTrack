"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierService = void 0;
const index_js_1 = require("../database/index.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
class SupplierService {
    /**
     * List suppliers with pagination, search, balance due and status filters
     */
    static async getSuppliers(params) {
        const { offset, limit, search, filters, sortBy, sortOrder } = params;
        const conditions = ['1=1'];
        const queryParams = [];
        if (search) {
            conditions.push('(s.name LIKE ? OR s.company_name LIKE ? OR s.phone LIKE ? OR s.gst_number LIKE ?)');
            const wild = `%${search}%`;
            queryParams.push(wild, wild, wild, wild);
        }
        if (filters.status) {
            conditions.push('s.status = ?');
            queryParams.push(filters.status);
        }
        if (filters.has_balance === 'true' || filters.hasBalance === 'true') {
            conditions.push('s.balance_due > 0');
        }
        const whereClause = conditions.join(' AND ');
        const countRes = await index_js_1.Database.queryOne(`
      SELECT COUNT(*) as total FROM suppliers s WHERE ${whereClause}
    `, queryParams);
        const allowedSort = {
            name: 's.name',
            company: 's.company_name',
            balance: 's.balance_due',
            balance_due: 's.balance_due',
            created_at: 's.created_at',
        };
        const orderCol = allowedSort[sortBy] || 's.name';
        const items = await index_js_1.Database.query(`
      SELECT s.* FROM suppliers s
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
     * Get supplier by ID
     */
    static async getSupplierById(id) {
        const supplier = await index_js_1.Database.queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
        if (!supplier) {
            throw new errorHandler_js_1.AppError(`Supplier #${id} not found`, 404);
        }
        return supplier;
    }
    /**
     * Create new supplier
     */
    static async createSupplier(data) {
        const result = await index_js_1.Database.execute(`
      INSERT INTO suppliers (
        company_name, name, contact_person, phone, email,
        address, gst_number, payment_terms, balance_due, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
            data.company_name?.trim() || data.name?.trim(),
            data.name?.trim(),
            data.contact_person?.trim() || '',
            data.phone?.trim(),
            data.email?.trim() || null,
            data.address?.trim() || null,
            data.gst_number?.trim() || null,
            data.payment_terms || 'Net 15',
            data.balance_due || 0,
            data.status || 'Active',
        ]);
        return SupplierService.getSupplierById(result.lastInsertRowid);
    }
    /**
     * Update existing supplier
     */
    static async updateSupplier(id, data) {
        await SupplierService.getSupplierById(id);
        const fields = [];
        const values = [];
        const allowedFields = [
            'company_name', 'name', 'contact_person', 'phone', 'email',
            'address', 'gst_number', 'payment_terms', 'balance_due', 'status'
        ];
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        }
        if (fields.length === 0) {
            return SupplierService.getSupplierById(id);
        }
        values.push(id);
        await index_js_1.Database.execute(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, values);
        return SupplierService.getSupplierById(id);
    }
}
exports.SupplierService = SupplierService;
//# sourceMappingURL=supplier.service.js.map