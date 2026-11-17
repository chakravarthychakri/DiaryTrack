// ====================================================================
// DairyTrack API Client with Authentication & Session Management
// ====================================================================

const api = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Attach Bearer token if logged in
    if (state.authToken) {
      headers['Authorization'] = `Bearer ${state.authToken}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (response.status === 401) {
        // Session expired or invalid
        if (state.authToken && !endpoint.includes('/auth/login')) {
          ui.showToast('Session expired. Please log in again.', 'warning');
          authModule.handleLogout(false);
        }
        throw new Error(data.error || 'Authentication required');
      }

      if (response.status === 403) {
        ui.showToast(data.error || 'Access Denied: Insufficient permissions.', 'error');
        throw new Error(data.error || 'Forbidden');
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed request`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/me')) {
        ui.showToast(err.message || 'Network request failed', 'error');
      }
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    }
    const qStr = query.toString();
    return this.request(qStr ? `${endpoint}?${qStr}` : endpoint, { method: 'GET' });
  },

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  // Module 2: Authentication
  login(login, password) {
    return this.post('/auth/login', { login, password });
  },

  register(data) {
    return this.post('/auth/register', data);
  },

  logout() {
    return this.post('/auth/logout');
  },

  forgotPassword(email) {
    return this.post('/auth/forgot-password', { email });
  },

  resetPassword(email, resetCode, newPassword) {
    return this.post('/auth/reset-password', { email, resetCode, newPassword });
  },

  getMe() {
    return this.get('/auth/me');
  },

  // User Management & Audit Trail (Administrator)
  getUsers() {
    return this.get('/users');
  },

  createUser(data) {
    return this.post('/users', data);
  },

  updateUser(id, data) {
    return this.put(`/users/${id}`, data);
  },

  toggleUserStatus(id, isActive) {
    return this.patch(`/users/${id}/status`, { is_active: isActive });
  },

  getAuditLogs() {
    return this.get('/audit-logs');
  },

  // Operations
  getDashboardStats(branchId) {
    return this.get('/dashboard/stats', { branchId });
  },

  getDashboardSalesOverview(period, branchId) {
    return this.get('/dashboard/charts/sales-overview', { period, branchId });
  },

  getDashboardTransactions(params) {
    return this.get('/dashboard/transactions', params);
  },

  quickAddStock(data) {
    return this.post('/dashboard/quick-actions/add-stock', data);
  },

  quickRecordLoss(data) {
    return this.post('/dashboard/quick-actions/record-loss', data);
  },

  // Module 4: Products & Categories API
  getProducts(params) {
    return this.get('/products', params);
  },

  getProductDetails(id) {
    return this.get(`/products/${id}`);
  },

  getProductSalesHistory(id) {
    return this.get(`/products/${id}/sales-history`);
  },

  getProductPurchaseHistory(id) {
    return this.get(`/products/${id}/purchase-history`);
  },

  createProduct(data) {
    return this.post('/products', data);
  },

  updateProduct(id, data) {
    return this.put(`/products/${id}`, data);
  },

  deleteProduct(id) {
    return this.delete(`/products/${id}`);
  },

  getCategories() {
    return this.get('/categories');
  },

  createCategory(data) {
    return this.post('/categories', data);
  },

  updateCategory(id, data) {
    return this.put(`/categories/${id}`, data);
  },

  deleteCategory(id) {
    return this.delete(`/categories/${id}`);
  },

  getUnits() {
    return this.get('/units');
  },

  convertUnit(quantity, fromUnit, toUnit) {
    return this.post('/units/convert', { quantity, from_unit: fromUnit, to_unit: toUnit });
  },

  // MODULE 5: INVENTORY MANAGEMENT & FEFO APIS
  getInventoryDashboard(branchId) {
    return this.get('/inventory/dashboard', branchId ? { branchId } : {});
  },

  getInventoryReconciliation(params) {
    return this.get('/inventory/reconciliation', params);
  },

  getBatches(params) {
    return this.get('/inventory/batches', params);
  },

  createBatch(data) {
    return this.post('/inventory/receive-stock', data);
  },

  receiveStock(data) {
    return this.post('/inventory/receive-stock', data);
  },

  addOpeningStock(data) {
    return this.post('/inventory/opening-stock', data);
  },

  adjustStock(data) {
    return this.post('/inventory/adjust-stock', data);
  },

  recordDamage(data) {
    return this.post('/inventory/record-damage', data);
  },

  recordExpiry(data) {
    return this.post('/inventory/record-expiry', data);
  },

  transferStock(data) {
    return this.post('/inventory/transfer-stock', data);
  },

  processReturn(data) {
    return this.post('/inventory/process-return', data);
  },

  getInventoryHistory(params) {
    return this.get('/inventory/history', params);
  },

  getInventoryAlerts(branchId) {
    return this.get('/inventory/alerts', branchId ? { branchId } : {});
  },

  getInventoryAlertSettings() {
    return this.get('/inventory/alert-settings');
  },

  saveInventoryAlertSettings(data) {
    return this.post('/inventory/alert-settings', data);
  },

  getSales(params) {
    return this.get('/sales', params);
  },

  getSalesConfig() {
    return this.get('/sales/config');
  },

  validateCart(data) {
    return this.post('/sales/validate-cart', data);
  },

  getSaleDetails(id) {
    return this.get(`/sales/${id}`);
  },

  createSale(data) {
    return this.post('/sales', data);
  },

  // MODULE 7: PURCHASES & PROCUREMENT APIS
  getPurchaseStats(params) {
    return this.get('/purchases/stats', params);
  },

  getPurchases(params) {
    return this.get('/purchases', params);
  },

  getPurchaseDetails(id) {
    return this.get(`/purchases/${id}`);
  },

  createPurchase(data) {
    return this.post('/purchases', data);
  },

  updatePurchase(id, data) {
    return this.put(`/purchases/${id}`, data);
  },

  receivePurchase(id) {
    return this.post(`/purchases/${id}/receive`);
  },

  cancelPurchase(id, data = {}) {
    return this.post(`/purchases/${id}/cancel`, data);
  },

  returnPurchase(id, data) {
    return this.post(`/purchases/${id}/return`, data);
  },

  getSupplierReturns() {
    return this.get('/purchases-returns');
  },

  // MODULE 8: STOCK MOVEMENTS APIS
  getMovementStats(params) {
    return this.get('/movements/stats', params);
  },

  getMovements(params) {
    return this.get('/movements', params);
  },

  getMovementTypes() {
    return this.get('/movements/types');
  },

  getMovementDetails(id) {
    return this.get(`/movements/${id}`);
  },

  createMovement(data) {
    return this.post('/movements', data);
  },

  createMovementCorrection(data) {
    return this.post('/movements/correction', data);
  },

  // MODULE 9: SUPPLIER MANAGEMENT APIS
  getSupplierStats() {
    return this.get('/suppliers/stats');
  },

  getSuppliers(params) {
    return this.get('/suppliers', params);
  },

  getSupplierDetails(id) {
    return this.get(`/suppliers/${id}`);
  },

  createSupplier(data) {
    return this.post('/suppliers', data);
  },

  updateSupplier(id, data) {
    return this.put(`/suppliers/${id}`, data);
  },

  paySupplier(id, data) {
    return this.post(`/suppliers/${id}/pay`, data);
  },

  getSupplierPurchases(id, params) {
    return this.get(`/suppliers/${id}/purchases`, params);
  },

  getSupplierReturns(id) {
    return this.get(`/suppliers/${id}/returns`);
  },

  getSupplierPayments(id) {
    return this.get(`/suppliers/${id}/payments`);
  },

  // ==========================================
  // MODULE 10: CUSTOMER MANAGEMENT & UDHAR LEDGER
  // ==========================================
  getCustomerStats() {
    return this.get('/customers/stats');
  },

  getCustomers(params = {}) {
    return this.get('/customers', params);
  },

  getCustomer(id) {
    return this.get(`/customers/${id}`);
  },

  createCustomer(data) {
    return this.post('/customers', data);
  },

  updateCustomer(id, data) {
    return this.put(`/customers/${id}`, data);
  },

  payCustomerCredit(id, data) {
    return this.post(`/customers/${id}/pay-credit`, data);
  },

  recordCustomerReturn(data) {
    return this.post('/customers/returns', data);
  },

  getCustomerReturns(params = {}) {
    return this.get('/customers/returns', params);
  },

  getCustomerPurchases(id, params = {}) {
    return this.get(`/customers/${id}/purchases`, params);
  },

  getCustomerReturnsForId(id) {
    return this.get(`/customers/${id}/returns`);
  },

  getCustomerPayments(id) {
    return this.get(`/customers/${id}/payments`);
  },

  // ==========================================
  // MODULE 11: EXPIRY & WASTAGE MANAGEMENT
  // ==========================================
  getExpiryData() {
    return this.get('/expiry');
  },

  getExpiryDashboard() {
    return this.get('/expiry/dashboard');
  },

  getWastageHistory(params = {}) {
    return this.get('/expiry/wastage', params);
  },

  recordWastage(data) {
    return this.post('/expiry/wastage', data);
  },

  takeExpiryAction(data) {
    return this.post('/expiry/action', data);
  },

  // ==========================================
  // MODULE 12: ANALYTICS & BUSINESS INTELLIGENCE
  // ==========================================
  getAnalyticsDashboard(params = {}) {
    return this.get('/analytics/dashboard', typeof params === 'string' ? { range: params } : params);
  },

  getAnalytics(params) {
    if (typeof params === 'string') {
      return this.get('/analytics/dashboard', { range: params });
    }
    return this.get('/analytics/dashboard', params || {});
  },

  getExpenses(params = {}) {
    return this.get('/expenses', params);
  },

  createExpense(data) {
    return this.post('/expenses', data);
  },

  deleteExpense(id) {
    return this.delete(`/expenses/${id}`);
  },

    // ==========================================
    // MODULE 13: EXCEL REPORT GENERATION & PREVIEW
    // ==========================================
    getReportPreview(sheet, params = {}) {
      return this.get('/reports/preview', { sheet, ...params });
    },

  getBranches() {
    return this.get('/branches');
  },

  getSettings() {
    return this.get('/settings');
  },

  saveSettings(data) {
    return this.post('/settings', data);
  },

  // ==========================================
  // MODULE 14: NOTIFICATIONS AND ALERTS
  // ==========================================
  getNotifications(params = {}) {
    return this.get('/notifications', params);
  },

  getNotificationStats() {
    return this.get('/notifications/stats');
  },

  markNotificationsRead(data = {}) {
    return this.post('/notifications/mark-all-read', data);
  },

  markNotificationRead(id) {
    return this.put(`/notifications/${id}/read`);
  },

  deleteNotification(id) {
    return this.delete(`/notifications/${id}`);
  },

  clearReadNotifications() {
    return this.delete('/notifications/clear-read');
  },

  scanSystemAlerts() {
    return this.post('/notifications/scan');
  },

  getNotificationSettings() {
    return this.get('/notifications/settings');
  },

  saveNotificationSettings(data) {
    return this.post('/notifications/settings', data);
  },

  triggerTestNotification(type) {
    return this.post('/notifications/test', { type });
  },

  searchGlobal(q) {
    return this.get('/search', { q });
  }
};
