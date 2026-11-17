const { db } = require('../server/db');

const products = db.prepare('SELECT id, name, sku FROM products WHERE is_active = 1').all();

products.forEach(prod => {
  const rows = db.prepare('SELECT movement_type, COALESCE(SUM(quantity), 0) as qty FROM stock_movements WHERE product_id = ? GROUP BY movement_type').all(prod.id);
  const map = {};
  rows.forEach(r => map[r.movement_type] = Number(r.qty));

  const openingStock = map['Opening Stock'] || 0;
  const purchasesReceived = (map['Purchase Received'] || 0) + (map['Purchase'] || 0);
  const saleReturns = map['Sale Return'] || 0;
  const transfersIn = map['Transfer In'] || 0;
  const sales = map['Sale'] || 0;
  const supplierReturns = (map['Supplier Return'] || 0) + (map['Return to Supplier'] || 0);
  const transfersOut = map['Transfer Out'] || 0;
  const expiredStock = map['Expired'] || 0;
  const damagedStock = map['Damage'] || 0;

  const actualOnHand = Number(db.prepare('SELECT COALESCE(SUM(current_quantity), 0) as on_hand FROM batches WHERE product_id = ? AND current_quantity > 0').get(prod.id).on_hand);

  const calc = openingStock + purchasesReceived + saleReturns + transfersIn - sales - supplierReturns - transfersOut - expiredStock - damagedStock;
  const diff = actualOnHand - calc;
  if (diff !== 0) {
    console.log(`Product ${prod.id} (${prod.name}): on_hand=${actualOnHand}, calc=${calc}, diff=${diff}`, map);
  }
});
