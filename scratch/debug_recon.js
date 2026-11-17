const { db } = require('../server/db');

const recon = db.prepare(`
  SELECT 
    p.id, p.name,
    COALESCE(SUM(b.current_quantity), 0) as on_hand
  FROM products p
  LEFT JOIN batches b ON p.id = b.product_id AND b.current_quantity > 0
  WHERE p.is_active = 1
  GROUP BY p.id
`).all();

console.log('Sample on-hand:');
recon.slice(0, 5).forEach(r => console.log(r));

console.log('\nSample movements for product 1 and 2:');
console.log(db.prepare('SELECT movement_type, sum(quantity) as qty FROM stock_movements WHERE product_id = 1 GROUP BY movement_type').all());
console.log(db.prepare('SELECT movement_type, sum(quantity) as qty FROM stock_movements WHERE product_id = 2 GROUP BY movement_type').all());

// Check other products that may not have stock_movements
const prodsWithMovements = db.prepare('SELECT DISTINCT product_id FROM stock_movements').all().map(r => r.product_id);
console.log('\nProducts with movements count:', prodsWithMovements.length);
console.log('Total active products:', recon.length);
