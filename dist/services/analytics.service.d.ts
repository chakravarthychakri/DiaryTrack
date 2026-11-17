export declare class AnalyticsService {
    /**
     * Get full executive analytics dashboard
     */
    static getDashboard(range?: string, filters?: any): Promise<any>;
    /**
     * Compute top performing products by quantity, revenue or transaction count
     */
    static getTopProducts(metric?: 'quantity' | 'revenue' | 'transactions', limit?: number): Promise<any[]>;
    /**
     * Sales trend analytics: daily trends, category breakdown, payment methods
     */
    static getSalesAnalytics(period?: string, filters?: any): Promise<any>;
    /**
     * Profit & Loss calculation:
     * Net Sales = Gross Sales - Discounts - Returns
     * Gross Profit = Net Sales - COGS
     * Operating Profit = Gross Profit - Operating Expenses
     */
    static getProfitAnalytics(range?: string): Promise<any>;
}
