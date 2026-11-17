// ====================================================================
// DairyTrack Global State Store with Role-Based Permissions
// ====================================================================

const state = {
  currentBranchId: localStorage.getItem('dairytrack_branch') || '1',
  currencySymbol: '₹',
  taxRatePercent: 5.0,
  activeView: 'dashboard',
  theme: localStorage.getItem('dairytrack_theme') || 'light',

  // Authentication State
  authToken: localStorage.getItem('dairytrack_token') || null,
  currentUser: JSON.parse(localStorage.getItem('dairytrack_user') || 'null'),

  // Role Permissions Matrix
  // Administrator: Full access
  // Manager: Stock, Purchases, Sales, Analytics, Reports, Suppliers
  // Shopkeeper / Staff: Record sales, create bills, check stock, authorized movements
  rolePermissions: {
    'Administrator': [
      'dashboard', 'products', 'inventory', 'sales', 'purchases',
      'movements', 'suppliers', 'customers', 'expiry', 'analytics',
      'reports', 'notifications', 'users', 'settings'
    ],
    'Manager': [
      'dashboard', 'products', 'inventory', 'sales', 'purchases',
      'movements', 'suppliers', 'customers', 'expiry', 'analytics',
      'reports', 'notifications'
    ],
    'Shopkeeper': [
      'dashboard', 'products', 'inventory', 'sales', 'movements', 'customers', 'notifications'
    ]
  },

  canAccess(viewName) {
    if (!this.currentUser) return false;
    const role = this.currentUser.role || 'Shopkeeper';
    const allowed = this.rolePermissions[role] || this.rolePermissions['Shopkeeper'];
    return allowed.includes(viewName);
  },

  // POS Cart State
  posCart: [],
  posDiscount: 0,
  posCustomerId: null,
  posPaymentMethod: 'Cash',

  // Cached Master Lists
  categories: [],
  products: [],
  branches: [],
  customers: [],
  suppliers: [],

  setSession(token, userObj) {
    this.authToken = token;
    this.currentUser = userObj;
    localStorage.setItem('dairytrack_token', token);
    localStorage.setItem('dairytrack_user', JSON.stringify(userObj));
  },

  clearSession() {
    this.authToken = null;
    this.currentUser = null;
    localStorage.removeItem('dairytrack_token');
    localStorage.removeItem('dairytrack_user');
  },

  setTheme(newTheme) {
    this.theme = newTheme;
    localStorage.setItem('dairytrack_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  },

  setBranch(branchId) {
    this.currentBranchId = branchId;
    localStorage.setItem('dairytrack_branch', branchId);
  }
};
