const express = require('express');
const fs = require('fs');
const path = require('path');

// Extract all endpoints called from public/js/api.js
const apiJsContent = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'api.js'), 'utf8');

// Match this.get('/...', this.post('/...', this.put('/...', this.delete('/...
const endpointRegex = /this\.(get|post|put|delete)\((?:`([^`]+)`|'([^']+)'|"([^"]+)")/g;
const clientEndpoints = [];
let match;
while ((match = endpointRegex.exec(apiJsContent)) !== null) {
  const method = match[1].toUpperCase();
  const uri = match[2] || match[3] || match[4];
  clientEndpoints.push({ method, uri });
}

console.log(`Found ${clientEndpoints.length} API calls in api.js`);

// Load all server router definitions and match against server
// We can mount express app and inspect router stack
const app = express();
app.use(express.json());

// Mock auth middleware for route registration
const dummyAuth = (req, res, next) => next();

// Mount all routers as done in server/index.js
const authRoutes = require('../server/index').authRouter || express.Router();
app.use('/api', require('../server/product_routes'));
app.use('/api', require('../server/inventory_routes'));
app.use('/api', require('../server/sales_routes'));
app.use('/api', require('../server/purchases_routes'));
app.use('/api', require('../server/movements_routes'));
app.use('/api', require('../server/supplier_routes'));
app.use('/api', require('../server/customer_routes'));
app.use('/api', require('../server/expiry_routes'));
app.use('/api', require('../server/analytics_routes'));
app.use('/api', require('../server/reports'));

// Also check routes defined directly in index.js
const indexFile = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');

const routeMatches = [];
const serverRouteRegex = /app\.(get|post|put|delete)\(['"]([^'"]+)['"]/g;
while ((match = serverRouteRegex.exec(indexFile)) !== null) {
  routeMatches.push({ method: match[1].toUpperCase(), path: match[2] });
}

// Print summary of client calls
console.log('Sample client calls:');
clientEndpoints.slice(0, 10).forEach(c => console.log(`  ${c.method} /api${c.uri}`));

console.log(`Total server index inline endpoints: ${routeMatches.length}`);
