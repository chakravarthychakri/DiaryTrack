const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'public', 'js', 'modules');
const moduleFiles = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));

const modules = [
  'dashboard', 'products', 'inventory', 'sales', 'purchases',
  'movements', 'suppliers', 'customers', 'expiry', 'analytics',
  'reports', 'notifications', 'users', 'settings', 'auth'
];

let errors = 0;

for (const mod of modules) {
  const filePath = path.join(modulesDir, `${mod}.js`);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing file for module: ${mod}.js`);
    errors++;
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  // Check if init() is defined
  const hasInit = /init\s*\([^)]*\)\s*\{/.test(content);
  if (!hasInit) {
    console.error(`Module ${mod}.js does not have an init() method!`);
    errors++;
  } else {
    console.log(`[PASS] ${mod}Module.init() is defined in ${mod}.js`);
  }
}

if (errors === 0) {
  console.log('\nAll 14 frontend modules define init() properly!');
} else {
  console.log(`\nFound ${errors} module initialization errors!`);
}
