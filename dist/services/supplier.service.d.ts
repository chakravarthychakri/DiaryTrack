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
export declare class SupplierService {
    /**
     * List suppliers with pagination, search, balance due and status filters
     */
    static getSuppliers(params: PaginationParams): Promise<{
        items: SupplierItem[];
        total: number;
    }>;
    /**
     * Get supplier by ID
     */
    static getSupplierById(id: string | number): Promise<SupplierItem>;
    /**
     * Create new supplier
     */
    static createSupplier(data: Partial<SupplierItem>): Promise<SupplierItem>;
    /**
     * Update existing supplier
     */
    static updateSupplier(id: string | number, data: Partial<SupplierItem>): Promise<SupplierItem>;
}
