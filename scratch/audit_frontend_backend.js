const fs = require('fs');
const path = require('path');

console.log('=== DAIRYTRACK FULL CODEBASE INTEGRITY AUDIT ===\n');

const publicDir = path.join(__dirname, '..', 'public');
const serverDir = path.join(__dirname, '..', 'server');

let totalIssues = 0;

// 1. Audit public/index.html IDs and Handlers
const htmlPath = path.join(publicDir, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Collect all IDs defined in HTML
const idRegex = /id=["']([^"']+)["']/g;
const htmlIds = new Set();
let match;
while ((match = idRegex.exec(htmlContent)) !== null) {
  htmlIds.add(match[1]);
}
console.log(`Found ${htmlIds.size} unique element IDs in index.html`);

// Collect all inline event handlers in index.html (onclick, onchange, onsubmit, etc.)
const inlineHandlerRegex = /on(?:click|change|submit|input|keyup|keydown)=["']([^"']+)["']/g;
const inlineHandlers = [];
while ((match = inlineHandlerRegex.exec(htmlContent)) !== null) {
  inlineHandlers.push(match[1]);
}
console.log(`Found ${inlineHandlers.length} inline event handlers in index.html`);

// Check JS files for getElementById references
const jsFiles = [];
function findJs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) findJs(full);
    else if (ent.name.endsWith('.js')) jsFiles.push(full);
  }
}
findJs(publicDir);

console.log(`Found ${jsFiles.length} JavaScript files in public/`);

const missingIds = new Map();
const getElementByIdRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;

for (const jsFile of jsFiles) {
  const content = fs.readFileSync(jsFile, 'utf8');
  const rel = path.relative(publicDir, jsFile);
  while ((match = getElementByIdRegex.exec(content)) !== null) {
    const id = match[1];
    // Some IDs might be dynamically generated, but static ones should exist
    if (!htmlIds.has(id) && !id.includes('${') && !id.includes('+')) {
      if (!missingIds.has(id)) missingIds.set(id, []);
      missingIds.get(id).push(rel);
    }
  }
}

if (missingIds.size > 0) {
  console.log(`\n--- Potentially Missing Element IDs referenced via getElementById (${missingIds.size}): ---`);
  for (const [id, files] of missingIds.entries()) {
    console.log(`  [!] ID "${id}" referenced in: ${files.join(', ')}`);
  }
} else {
  console.log('\n[PASS] All getElementById references exist in index.html!');
}

// 2. Check Backend Routes & Database methods
console.log('\n--- Checking Server Routes & DB methods ---');
const db = require('../server/db');
console.log('[PASS] DB loaded cleanly. Tables configured:', Object.keys(db).length > 0);

// Check if all route files can be required without error
const routeFiles = fs.readdirSync(serverDir).filter(f => f.endsWith('.js'));
for (const rf of routeFiles) {
  try {
    const mod = require(path.join(serverDir, rf));
    console.log(`[PASS] server/${rf} loaded cleanly`);
  } catch (err) {
    console.error(`[FAIL] server/${rf} failed to load:`, err.message);
    totalIssues++;
  }
}

console.log(`\nAudit completed with ${totalIssues} critical server require errors and ${missingIds.size} potential missing DOM IDs.`);
