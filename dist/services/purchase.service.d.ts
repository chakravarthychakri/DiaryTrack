import type { PaginationParams } from '../utilities/pagination.js';
export interface PurchaseItemInput {
    product_id: number | string;
    quantity: number;
    cost_price: number;
}
export interface CreatePurchaseInput {
    supplier_id: number | string;
    items: PurchaseItemInput[];
    delivery_date?: string;
    notes?: string;
    user_id?: string | number;
}
export declare class PurchaseService {
    /**
     * Get paginated purchases
     */
    static getPurchases(params: PaginationParams): Promise<{
        items: any[];
        total: number;
    }>;
    /**
     * Get purchase by ID
     */
    static getPurchaseById(id: string | number): Promise<any>;
    /**
     * Create a new purchase order
     */
    static createPurchase(data: CreatePurchaseInput): Promise<any>;
    /**
     * Receive goods for a purchase order, creating batches and updating inventory ledger
     */
    static receivePurchase(id: string | number, receiveData?: {
        received_date?: string;
        user_id?: string | number;
    }): Promise<any>;
}
