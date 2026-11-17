/**
 * Module 17 Verification Script: Frontend Project Structure
 * Verifies all 15 pages, 11 reusable components, layouts, hooks, contexts,
 * types, utilities, styles, and entry points.
 */

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
console.log('🔍 Starting Module 17 Frontend Structure Audit...\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assertFile(filePath, desc) {
  totalChecks++;
  const fullPath = path.resolve(rootDir, filePath);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    if (stats.size > 20) {
      console.log(`  ✅ [PASS] ${desc} (${filePath}) [${stats.size} bytes]`);
      passedChecks++;
      return true;
    } else {
      console.error(`  ❌ [FAIL] ${desc} (${filePath}) is empty or too small`);
      failedChecks++;
      return false;
    }
  } else {
    console.error(`  ❌ [FAIL] ${desc} (${filePath}) DOES NOT EXIST`);
    failedChecks++;
    return false;
  }
}

function assertDir(dirPath, desc) {
  totalChecks++;
  const fullPath = path.resolve(rootDir, dirPath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    console.log(`  📁 [PASS] ${desc} (${dirPath})`);
    passedChecks++;
    return true;
  } else {
    console.error(`  ❌ [FAIL] Directory ${desc} (${dirPath}) NOT FOUND`);
    failedChecks++;
    return false;
  }
}

console.log('--- 1. Checking Required Directories ---');
const requiredDirs = [
  'src/assets',
  'src/components/layout',
  'src/components/dashboard',
  'src/components/products',
  'src/components/inventory',
  'src/components/sales',
  'src/components/purchases',
  'src/components/reports',
  'src/components/analytics',
  'src/components/shared',
  'src/pages',
  'src/hooks',
  'src/services',
  'src/context',
  'src/types',
  'src/utils',
  'src/routes',
  'src/styles',
];
requiredDirs.forEach(d => assertDir(d, `Directory: ${d}`));

console.log('\n--- 2. Checking 15 Required Pages ---');
const requiredPages = [
  'src/pages/Login.tsx',
  'src/pages/Register.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Products.tsx',
  'src/pages/Inventory.tsx',
  'src/pages/Sales.tsx',
  'src/pages/Purchases.tsx',
  'src/pages/StockMovements.tsx',
  'src/pages/Suppliers.tsx',
  'src/pages/Customers.tsx',
  'src/pages/ExpiryManagement.tsx',
  'src/pages/Analytics.tsx',
  'src/pages/Reports.tsx',
  'src/pages/UserManagement.tsx',
  'src/pages/Settings.tsx',
];
requiredPages.forEach(p => assertFile(p, `Page: ${path.basename(p)}`));

console.log('\n--- 3. Checking 11 Reusable Component Types ---');
const reusableComponents = [
  { path: 'src/components/layout/Sidebar.tsx', name: '1. Sidebar' },
  { path: 'src/components/layout/Topbar.tsx', name: '2. Topbar' },
  { path: 'src/components/shared/KpiCard.tsx', name: '3. KPI Cards' },
  { path: 'src/components/shared/DataTable.tsx', name: '4. Data Tables' },
  { path: 'src/components/shared/SearchBar.tsx', name: '5. Search Bars' },
  { path: 'src/components/shared/DateFilter.tsx', name: '6. Date Filters' },
  { path: 'src/components/shared/FormInput.tsx', name: '7. Forms (FormInput)' },
  { path: 'src/components/shared/Modal.tsx', name: '8. Modals' },
  { path: 'src/components/shared/ChartWrapper.tsx', name: '9. Charts (ChartWrapper)' },
  { path: 'src/components/shared/NotificationCenter.tsx', name: '10. Notifications' },
  { path: 'src/components/shared/ExportButton.tsx', name: '11. Export Buttons' },
];
reusableComponents.forEach(c => assertFile(c.path, `Component: ${c.name}`));

console.log('\n--- 4. Checking Contexts & Hooks ---');
assertFile('src/context/AuthContext.tsx', 'AuthContext');
assertFile('src/context/NotificationContext.tsx', 'NotificationContext');
assertFile('src/hooks/useAuth.ts', 'useAuth hook');
assertFile('src/hooks/useProducts.ts', 'useProducts hook');
assertFile('src/hooks/useInventory.ts', 'useInventory hook');
assertFile('src/hooks/useSales.ts', 'useSales hook');
assertFile('src/hooks/useNotifications.ts', 'useNotifications hook');
assertFile('src/hooks/useDebounce.ts', 'useDebounce hook');

console.log('\n--- 5. Checking Types, Utilities & Config ---');
assertFile('src/types/index.ts', 'Domain TypeScript Interfaces');
assertFile('src/utils/cn.ts', 'Tailwind merge helper (cn)');
assertFile('src/utils/formatters.ts', 'Formatters (currency, dates, quantity)');
assertFile('src/styles/globals.css', 'Tailwind globals.css');
assertFile('src/routes/AppRoutes.tsx', 'React Router AppRoutes');
assertFile('src/App.tsx', 'Root App.tsx');
assertFile('src/main.tsx', 'Entry main.tsx');
assertFile('index.html', 'Vite HTML Entry');
assertFile('vite.config.ts', 'Vite Configuration');
assertFile('tailwind.config.js', 'Tailwind Configuration');

console.log('\n=============================================');
console.log(`SUMMARY: ${passedChecks}/${totalChecks} Checks Passed (${failedChecks} failed)`);
console.log('=============================================');

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('🎉 MODULE 17 FRONTEND PROJECT STRUCTURE 100% COMPLETE & VERIFIED!\n');
  process.exit(0);
}
