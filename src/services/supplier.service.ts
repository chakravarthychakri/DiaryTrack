import { Database } from '../database/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { PaginationParams } from '../utilities/pagination.js';

export interface SupplierItem {
  id: string | number;
  company_name?: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  address?: string;
  gst_number?: string;
  payment_terms?: string;
  balance_due: number;
  status: string;
  created_at?: string;
}

export class SupplierService {
  /**
   * List suppliers with pagination, search, balance due and status filters
   */
  public static async getSuppliers(params: PaginationParams): Promise<{ items: SupplierItem[]; total: number }> {
    const { offset, limit, search, filters, sortBy, sortOrder } = params;

    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

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

    const countRes = await Database.queryOne<{ total: number }>(`
      SELECT COUNT(*) as total FROM suppliers s WHERE ${whereClause}
    `, queryParams);

    const allowedSort: Record<string, string> = {
      name: 's.name',
      company: 's.company_name',
      balance: 's.balance_due',
      balance_due: 's.balance_due',
      created_at: 's.created_at',
    };
    const orderCol = allowedSort[sortBy] || 's.name';

    const items = await Database.query<SupplierItem>(`
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
  public static async getSupplierById(id: string | number): Promise<SupplierItem> {
    const supplier = await Database.queryOne<SupplierItem>(`SELECT * FROM suppliers WHERE id = ?`, [id]);
    if (!supplier) {
      throw new AppError(`Supplier #${id} not found`, 404);
    }
    return supplier;
  }

  /**
   * Create new supplier
   */
  public static async createSupplier(data: Partial<SupplierItem>): Promise<SupplierItem> {
    const result = await Database.execute(`
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
  public static async updateSupplier(id: string | number, data: Partial<SupplierItem>): Promise<SupplierItem> {
    await SupplierService.getSupplierById(id);

    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = [
      'company_name', 'name', 'contact_person', 'phone', 'email',
      'address', 'gst_number', 'payment_terms', 'balance_due', 'status'
    ];

    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push((data as any)[field]);
      }
    }

    if (fields.length === 0) {
      return SupplierService.getSupplierById(id);
    }

    values.push(id);
    await Database.execute(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, values);

    return SupplierService.getSupplierById(id);
  }
}
