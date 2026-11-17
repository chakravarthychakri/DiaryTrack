const { db } = require('../server/db');

console.log('Purchases count:', db.prepare('SELECT count(*) as count FROM purchases').get());
console.log('Recent purchases:', db.prepare('SELECT * FROM purchases LIMIT 3').all());
console.log('Suppliers:', db.prepare('SELECT id, name, balance_due FROM suppliers').all());
