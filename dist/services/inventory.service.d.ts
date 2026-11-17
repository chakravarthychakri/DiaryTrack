import type { PaginationParams } from '../utilities/pagination.js';
export declare class InventoryService {
    /**
     * Get current inventory summary, batch details, and stock valuations
     */
    static getInventory(params: PaginationParams): Promise<any>;
    /**
     * Get auditable stock ledger movements
     */
    static getMovements(params: PaginationParams): Promise<{
        items: any[];
        total: number;
    }>;
    /**
     * Create an inventory adjustment (reconciliation, shrinkage, breakages)
     */
    static createAdjustment(data: {
        product_id: number | string;
        batch_id?: number | string;
        flow_type?: 'Inflow' | 'Outflow';
        movement_type?: string;
        quantity: number;
        reason: string;
        user_id?: number | string;
    }): Promise<any>;
}
