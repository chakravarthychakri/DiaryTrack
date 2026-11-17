/**
 * Complete DairyTrack Frontend Type Definitions
 */
export interface User {
    id: string | number;
    name: string;
    email: string;
    username: string;
    role: 'Administrator' | 'Manager' | 'Shopkeeper' | 'Auditor';
    shop_id?: string | number;
    branch_name?: string;
}
export interface Category {
    id: number;
    name: string;
    description?: string;
    icon?: string;
    product_count?: number;
}
export interface ProductBatch {
    id: number;
    product_id: number;
    batch_code: string;
    expiry_date: string;
    quantity: number;
    cost_price: number;
    selling_price?: number;
    status: 'Active' | 'Near Expiry' | 'Expired' | 'Depleted';
}
export interface Product {
    id: number | string;
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
    status: 'Active' | 'Inactive';
    batches?: ProductBatch[];
}
export interface SaleItem {
    id?: number;
    product_id: number;
    product_name: string;
    product_unit?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    batch_id?: number;
    batch_code?: string;
}
export interface Sale {
    id: number | string;
    invoice_number: string;
    customer_id?: number | null;
    customer_name?: string;
    customer_phone?: string;
    subtotal: number;
    discount: number;
    tax: number;
    net_amount: number;
    cost_of_goods_sold?: number;
    gross_profit?: number;
    payment_method: string;
    payment_status: 'Paid' | 'Partial' | 'Pending';
    created_at: string;
    items?: SaleItem[];
}
export interface PurchaseItem {
    id?: number;
    product_id: number;
    product_name: string;
    product_unit?: string;
    ordered_quantity: number;
    cost_price: number;
    total_cost: number;
}
export interface Purchase {
    id: number | string;
    po_number: string;
    supplier_id: number;
    supplier_name?: string;
    supplier_phone?: string;
    total_amount: number;
    net_amount?: number;
    status: 'Pending' | 'Received' | 'Cancelled';
    payment_status: 'Paid' | 'Unpaid' | 'Partial';
    created_at: string;
    items?: PurchaseItem[];
}
export interface StockMovement {
    id: number | string;
    movement_type: string;
    flow_type: 'Inflow' | 'Outflow';
    product_id: number;
    product_name: string;
    product_unit: string;
    batch_code?: string;
    quantity: number;
    previous_stock: number;
    updated_stock: number;
    reference_id?: string;
    reason?: string;
    recorded_by?: string;
    created_at: string;
}
export interface Supplier {
    id: number | string;
    name: string;
    company_name?: string;
    contact_person?: string;
    phone: string;
    email?: string;
    address?: string;
    gst_number?: string;
    payment_terms?: string;
    balance_due: number;
    status: 'Active' | 'Inactive';
    created_at?: string;
}
export interface Customer {
    id: number | string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    credit_balance: number;
    loyalty_points?: number;
    status: 'Active' | 'Inactive';
    created_at?: string;
}
export interface NotificationItem {
    id: string | number;
    type: string;
    title: string;
    message: string;
    severity: 'info' | 'success' | 'warning' | 'danger';
    is_read: boolean | number;
    created_at: string;
}
export interface ProfitAnalytics {
    gross_sales: number;
    discounts: number;
    sales_returns: number;
    net_sales: number;
    cogs: number;
    gross_profit: number;
    gross_margin_pct: number;
    operating_expenses: number;
    operating_profit: number;
    spoilage_loss: number;
    net_business_profit: number;
    expenses_breakdown?: Record<string, number>;
}
export interface DashboardSummary {
    today_sales: number;
    today_orders: number;
    inventory_valuation: number;
    low_stock_alerts: number;
    expiring_soon_count: number;
    gross_profit_month: number;
}
