const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// Find all onclick, onchange, onsubmit, oninput etc.
const handlerRegex = /on[a-z]+=["']([^"']+)["']/gi;
const handlers = new Set();
let match;
while ((match = handlerRegex.exec(html)) !== null) {
  handlers.add(match[1].trim());
}

console.log(`Found ${handlers.size} unique event handler expressions in index.html.`);

// Let's inspect which top-level objects/functions are invoked
const calledTargets = new Set();
for (const h of handlers) {
  // Extract function calls like "app.showView('...')", "productsModule.openAddProduct()", "modal.close()", "this.value"
  const m = h.match(/^([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\s*\(/);
  if (m) {
    calledTargets.add(m[1]);
  }
}

console.log('Invoked methods count:', calledTargets.size);

// Read all public/js files
const jsDir = path.join(__dirname, '..', 'public', 'js');
const jsFiles = [];
function readAllJs(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, ent.name);
    if (ent.isDirectory()) readAllJs(f);
    else if (ent.name.endsWith('.js')) jsFiles.push({ path: f, content: fs.readFileSync(f, 'utf8') });
  }
}
readAllJs(jsDir);

// Check if each target is defined in at least one JS file or standard browser API
const standardGlobals = new Set([
  'document.getElementById', 'console.log', 'alert', 'confirm', 'history.back', 'window.location.reload',
  'event.preventDefault', 'event.stopPropagation'
]);

const missingTargets = [];
for (const target of calledTargets) {
  if (standardGlobals.has(target)) continue;
  if (target.startsWith('document.') || target.startsWith('window.') || target.startsWith('event.')) continue;
  
  const parts = target.split('.');
  const funcName = parts[parts.length - 1];
  
  // Search for method definition in JS files
  let found = false;
  for (const js of jsFiles) {
    if (js.content.includes(funcName + '(') || 
        js.content.includes(funcName + ' =') || 
        js.content.includes(funcName + ':') ||
        js.content.includes(target)) {
      found = true;
      break;
    }
  }

  if (!found) {
    missingTargets.push(target);
  }
}

console.log('Potentially missing handler targets:', missingTargets);
