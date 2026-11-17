import type { PaginationParams } from '../utilities/pagination.js';
export interface SaleItemInput {
    product_id: number | string;
    quantity: number;
    unit_price: number;
    batch_id?: number | string;
}
export interface CreateSaleInput {
    customer_id?: number | string | null;
    items: SaleItemInput[];
    payment_method: string;
    discount?: number;
    tax?: number;
    notes?: string;
    user_id?: string | number;
    idempotency_key?: string;
}
export declare class SaleService {
    /**
     * Get paginated sales records with search and filters
     */
    static getSales(params: PaginationParams): Promise<{
        items: any[];
        total: number;
    }>;
    /**
     * Get single sale by ID with line items
     */
    static getSaleById(id: string | number): Promise<any>;
    /**
     * Process a new POS / Retail sale with FEFO batch allocation, concurrency lock and ledger logging
     */
    static createSale(data: CreateSaleInput): Promise<any>;
    /**
     * Module 18: Protect completed sales from unauthorized alteration or deletion
     */
    static updateSale(): Promise<never>;
    static deleteSale(): Promise<never>;
    /**
     * Process customer sale return
     */
    static createSaleReturn(saleId: string | number, returnData: {
        product_id?: number | string;
        quantity: number;
        reason: string;
        restock?: boolean;
        user_id?: string | number;
    }): Promise<any>;
}
