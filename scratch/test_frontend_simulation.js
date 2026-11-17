const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== COMBINED FRONTEND SCRIPT SIMULATION ===\n');

const publicDir = path.join(__dirname, '..', 'public');

const scripts = [
  'js/api.js',
  'js/state.js',
  'js/ui.js',
  'js/modules/auth.js',
  'js/modules/dashboard.js',
  'js/modules/products.js',
  'js/modules/inventory.js',
  'js/modules/sales.js',
  'js/modules/purchases.js',
  'js/modules/movements.js',
  'js/modules/suppliers.js',
  'js/modules/customers.js',
  'js/modules/expiry.js',
  'js/modules/analytics.js',
  'js/modules/reports.js',
  'js/modules/notifications.js',
  'js/modules/users.js',
  'js/modules/settings.js',
  'js/app.js'
];

let combinedCode = '';
for (const s of scripts) {
  const code = fs.readFileSync(path.join(publicDir, s), 'utf8');
  combinedCode += `\n// --- START: ${s} ---\n` + code;
}

// Attach inspector tests at the end
combinedCode += `
console.log('Verifying in-scope modules:');
const checkList = {
  api: typeof api,
  state: typeof state,
  ui: typeof ui,
  authModule: typeof authModule,
  dashboardModule: typeof dashboardModule,
  productsModule: typeof productsModule,
  inventoryModule: typeof inventoryModule,
  salesModule: typeof salesModule,
  purchasesModule: typeof purchasesModule,
  movementsModule: typeof movementsModule,
  suppliersModule: typeof suppliersModule,
  customersModule: typeof customersModule,
  expiryModule: typeof expiryModule,
  analyticsModule: typeof analyticsModule,
  reportsModule: typeof reportsModule,
  notificationsModule: typeof notificationsModule,
  usersModule: typeof usersModule,
  settingsModule: typeof settingsModule,
  app: typeof app
};
console.log(JSON.stringify(checkList, null, 2));

// Test calling openModal on app
app.openModal('report-preview-modal');
app.closeModal('report-preview-modal');
console.log('SUCCESS: app.openModal and app.closeModal run without error!');
`;

const mockElement = (id) => ({
  id,
  value: '',
  textContent: '',
  innerHTML: '',
  style: {},
  classList: {
    add: () => {},
    remove: () => {},
    toggle: () => {},
    contains: () => false
  },
  appendChild: () => {},
  removeChild: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  setAttribute: () => {},
  getAttribute: () => '',
  focus: () => {},
  click: () => {},
  reset: () => {},
  requestSubmit: () => {}
});

const mockDocument = {
  getElementById: (id) => mockElement(id),
  querySelectorAll: (selector) => [mockElement('sel-1'), mockElement('sel-2')],
  querySelector: (selector) => mockElement('sel-single'),
  createElement: (tagName) => mockElement('created-' + tagName),
  body: mockElement('body'),
  addEventListener: () => {}
};

const mockWindow = {
  localStorage: {
    store: {
      token: 'mock-token',
      user: JSON.stringify({ id: 1, name: 'Admin', role: 'Administrator', email: 'admin@dairytrack.com' })
    },
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  },
  location: { reload: () => {} },
  open: () => {},
  alert: (msg) => console.log('Alert:', msg),
  confirm: () => true,
  fetch: async () => ({
    ok: true,
    json: async () => ({ success: true, data: [] })
  }),
  setInterval: () => 1,
  clearInterval: () => {},
  setTimeout: (fn) => {},
  clearTimeout: () => {},
  document: mockDocument,
  console: console
};
mockWindow.window = mockWindow;

const context = vm.createContext(mockWindow);

try {
  vm.runInContext(combinedCode, context);
  console.log('\n[PASS] All combined client scripts executed without a single runtime exception!');
} catch (err) {
  console.error('\n[FAIL] Runtime error in client scripts:', err);
}
