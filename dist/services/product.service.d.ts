import type { PaginationParams } from '../utilities/pagination.js';
export interface ProductItem {
    id: string | number;
    name: string;
    category_id: number;
    category_name?: string;
    sku?: string;
    barcode?: string;
    unit: string;
    cost_price: number;
    selling_price: number;
    current_stock: number;
    min_stock_level: number;
    shelf_life_days?: number;
    is_perishable?: number;
    status: string;
}
export declare class ProductService {
    /**
     * List products with pagination, search, sorting and filtering
     */
    static getProducts(params: PaginationParams): Promise<{
        items: ProductItem[];
        total: number;
    }>;
    /**
     * Get product by ID
     */
    static getProductById(id: string | number): Promise<ProductItem>;
    /**
     * Create a new product
     */
    static createProduct(data: Partial<ProductItem>): Promise<ProductItem>;
    /**
     * Update an existing product
     */
    static updateProduct(id: string | number, data: Partial<ProductItem>): Promise<ProductItem>;
    /**
     * Delete product by ID
     */
    static deleteProduct(id: string | number): Promise<{
        deleted: boolean;
        id: string | number;
    }>;
}
