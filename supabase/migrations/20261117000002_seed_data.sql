-- ====================================================================
-- MODULE 15: SUPABASE POSTGRESQL PRODUCTION SEED DATA
-- Normalized Multi-Tenant Seed Dataset for DairyTrack
-- ====================================================================

-- 1. SEED PROFILES
INSERT INTO public.profiles (id, email, full_name, phone, role, is_active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@dairytrack.com', 'Suresh Sharma (Owner)', '+91 98765 00001', 'Administrator', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager@dairytrack.com', 'Kavita Patel (Store Manager)', '+91 98765 00002', 'Manager', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'shopkeeper@dairytrack.com', 'Rahul Verma (Billing Staff)', '+91 98765 00003', 'Shopkeeper', true)
ON CONFLICT (id) DO NOTHING;

-- 2. SEED SHOPS / BRANCHES (Supports Single Shop & Multi-Branch Networks)
INSERT INTO public.shops (id, name, legal_name, gstin, fssai_license, phone, email, address, city, state, postal_code, upi_vpa, tax_rate_percent, is_main_branch, is_active, created_by)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'DairyTrack Central Store', 'DairyTrack Pure Milk & Foods Pvt Ltd', '07AAAAA0000A1Z5', '10022011000123', '+91 98765 43210', 'central@dairytrack.com', '124 Milkman Boulevard, Dairy Hub, Sector 4', 'New Delhi', 'Delhi', '110001', 'dairytrack@upi', 5.00, true, true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'DairyTrack Express Hub - Sector 18', 'DairyTrack Pure Milk & Foods Pvt Ltd', '07AAAAA0000A1Z5', '10022011000124', '+91 98765 43211', 'express18@dairytrack.com', 'Shop 14, Commercial Market, Sector 18', 'New Delhi', 'Delhi', '110018', 'dairytrack.sec18@upi', 5.00, false, true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- 3. SEED SHOP MEMBERSHIPS
INSERT INTO public.shop_members (id, shop_id, profile_id, role, is_primary_shop)
VALUES
  ('33333333-3333-3333-3333-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Administrator', true),
  ('33333333-3333-3333-3333-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Administrator', false),
  ('33333333-3333-3333-3333-000000000003', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Manager', true),
  ('33333333-3333-3333-3333-000000000004', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Shopkeeper', true)
ON CONFLICT (id) DO NOTHING;

-- 4. SEED 11 CANONICAL DAIRY CATEGORIES
INSERT INTO public.categories (id, shop_id, name, slug, description, icon)
VALUES
  ('44444444-4444-4444-4444-000000000001', '11111111-1111-1111-1111-111111111111', 'Milk', 'milk', 'Fresh cow, buffalo, toned & pasteurized milk', 'milk'),
  ('44444444-4444-4444-4444-000000000002', '11111111-1111-1111-1111-111111111111', 'Curd', 'curd', 'Fresh curd, probiotic dahi & set yogurt', 'cup-soda'),
  ('44444444-4444-4444-4444-000000000003', '11111111-1111-1111-1111-111111111111', 'Buttermilk', 'buttermilk', 'Chaas, spiced buttermilk & lassi', 'glass-water'),
  ('44444444-4444-4444-4444-000000000004', '11111111-1111-1111-1111-111111111111', 'Paneer', 'paneer', 'Fresh malai paneer & diced cottage cheese', 'box'),
  ('44444444-4444-4444-4444-000000000005', '11111111-1111-1111-1111-111111111111', 'Butter', 'butter', 'Salted table butter, white makkhan & cooking butter', 'cookie'),
  ('44444444-4444-4444-4444-000000000006', '11111111-1111-1111-1111-111111111111', 'Ghee', 'ghee', 'Pure desi cow ghee, buffalo ghee & bilona ghee', 'sparkles'),
  ('44444444-4444-4444-4444-000000000007', '11111111-1111-1111-1111-111111111111', 'Cheese', 'cheese', 'Cheddar slices, mozzarella blocks & cheese cubes', 'layers'),
  ('44444444-4444-4444-4444-000000000008', '11111111-1111-1111-1111-111111111111', 'Cream', 'cream', 'Fresh dairy cream & malai for cooking', 'cloud'),
  ('44444444-4444-4444-4444-000000000009', '11111111-1111-1111-1111-111111111111', 'Flavoured Milk', 'flavoured-milk', 'Badam, chocolate, strawberry & kesar milk', 'cup'),
  ('44444444-4444-4444-4444-000000000010', '11111111-1111-1111-1111-111111111111', 'Ice Cream', 'ice-cream', 'Kulfi, party tubs, ice cream bars & cones', 'ice-cream'),
  ('44444444-4444-4444-4444-000000000011', '11111111-1111-1111-1111-111111111111', 'Other Dairy Products', 'other-dairy', 'Khoya, mawa, condensed milk & specialty items', 'package')
ON CONFLICT (id) DO NOTHING;

-- 5. SEED SUPPLIERS
INSERT INTO public.suppliers (id, shop_id, name, company_name, contact_person, phone, email, address, gstin, balance_due, payment_terms, status)
VALUES
  ('55555555-5555-5555-5555-000000000001', '11111111-1111-1111-1111-111111111111', 'Gokul Dairy Cooperative', 'Gokul Milk Producers Federation Ltd', 'Mahesh Yadav', '+91 98220 11223', 'procurement@gokuldairy.coop', 'Village Kheda, Milk Route 4, Anand', '24AAACG1234F1Z8', 14500.00, 'Net 7', 'Active'),
  ('55555555-5555-5555-5555-000000000002', '11111111-1111-1111-1111-111111111111', 'Amrit Milk Producers', 'Amrit Agro & Dairy Products Ltd', 'Rajesh Patel', '+91 98220 44556', 'rajesh@amritmilk.com', 'Plot 45, GIDC Industrial Estate, Mehsana', '24AAACA9876P1ZV', 7390.00, 'Net 15', 'Active'),
  ('55555555-5555-5555-5555-000000000003', '11111111-1111-1111-1111-111111111111', 'Kisan Dairy Farms', 'Kisan Milk & Cattle Breeders Union', 'Vikram Singh', '+91 98220 77889', 'vikram@kisandairy.org', 'NH-8, Milestone 42, Karnal', '06AAACK5544R1ZM', 0.00, 'Net 15', 'Active'),
  ('55555555-5555-5555-5555-000000000004', '11111111-1111-1111-1111-111111111111', 'Shree Krishna Desi Ghee', 'Shree Krishna Organic Dairy Products', 'Gopal Sharma', '+91 98220 99001', 'orders@krishnaghee.in', 'Near Gaushala, Mathura Road, Vrindavan', '09AAACS3322B1ZN', 23480.00, 'Net 30', 'Active')
ON CONFLICT (id) DO NOTHING;

-- 6. SEED PRODUCTS
INSERT INTO public.products (id, shop_id, category_id, supplier_id, name, sku, barcode, unit, purchase_price, selling_price, min_stock_level, shelf_life_days, is_active)
VALUES
  ('66666666-6666-6666-6666-000000000001', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-000000000001', '55555555-5555-5555-5555-000000000001', 'Fresh Pure Cow Milk 1L Pouch', 'MLK-COW-001', '890103001001', 'Litres', 54.00, 64.00, 20.000, 2, true),
  ('66666666-6666-6666-6666-000000000002', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-000000000001', '55555555-5555-5555-5555-000000000001', 'Standard Toned Milk 500ml', 'MLK-TON-002', '890103001002', 'Litres', 24.00, 28.00, 15.000, 2, true),
  ('66666666-6666-6666-6666-000000000003', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-000000000002', '55555555-5555-5555-5555-000000000002', 'Thick Set Curd 400g Cup', 'CRD-SET-001', '890103002001', 'Grams', 32.00, 40.00, 10.000, 5, true),
  ('66666666-6666-6666-6666-000000000004', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-000000000004', '55555555-5555-5555-5555-000000000002', 'Fresh Malai Paneer 1kg Block', 'PNR-MAL-001', '890103004001', 'Kilograms', 360.00, 430.00, 8.000, 4, true),
  ('66666666-6666-6666-6666-000000000005', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-000000000005', '55555555-5555-5555-5555-000000000003', 'Salted Table Butter 500g', 'BTR-SLT-001', '890103005001', 'Packets', 245.00, 280.00, 12.000, 180, true),
  ('66666666-6666-6666-6666-000000000006', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-000000000006', '55555555-5555-5555-5555-000000000004', 'Pure Desi Cow Ghee 1L Tin', 'GHE-DSY-001', '890103006001', 'Litres', 620.00, 750.00, 6.000, 365, true)
ON CONFLICT (id) DO NOTHING;

-- 7. SEED CUSTOMERS
INSERT INTO public.customers (id, shop_id, name, phone, email, address, type, credit_limit, credit_balance, loyalty_points, status)
VALUES
  ('77777777-7777-7777-7777-000000000001', '11111111-1111-1111-1111-111111111111', 'Walk-in Retail Customer', '+91 99999 99999', 'walkin@dairytrack.com', 'Counter Retail Cash', 'Retail', 0.00, 0.00, 0, 'Active'),
  ('77777777-7777-7777-7777-000000000002', '11111111-1111-1111-1111-111111111111', 'Hotel Anand Royal Grand', '+91 98110 22334', 'procurement@anandroyal.com', '12 Ring Road, Civil Lines', 'Restaurant/Catering', 25000.00, 7300.00, 240, 'Active'),
  ('77777777-7777-7777-7777-000000000003', '11111111-1111-1111-1111-111111111111', 'Sharma Sweets & Caterers', '+91 98110 55667', 'sharma.sweets@gmail.com', 'Market Chowk, Main Bazaar', 'Wholesale', 15000.00, 1850.00, 110, 'Active')
ON CONFLICT (id) DO NOTHING;

-- 8. SEED PRODUCT BATCHES
INSERT INTO public.product_batches (id, shop_id, product_id, batch_number, initial_quantity, current_quantity, purchase_cost, manufacturing_date, expiry_date, received_date, status)
VALUES
  ('88888888-8888-8888-8888-000000000001', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-000000000001', 'BAT-MLK-101', 50.000, 38.000, 54.00, CURRENT_DATE - 1, CURRENT_DATE + 1, CURRENT_DATE - 1, 'Active'),
  ('88888888-8888-8888-8888-000000000002', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-000000000001', 'BAT-MLK-102', 150.000, 135.000, 54.00, CURRENT_DATE, CURRENT_DATE + 2, CURRENT_DATE, 'Active'),
  ('88888888-8888-8888-8888-000000000003', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-000000000003', 'BAT-CRD-201', 40.000, 26.000, 32.00, CURRENT_DATE - 1, CURRENT_DATE + 3, CURRENT_DATE - 1, 'Active'),
  ('88888888-8888-8888-8888-000000000004', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-000000000004', 'BAT-PNR-301', 25.000, 14.000, 360.00, CURRENT_DATE - 1, CURRENT_DATE + 2, CURRENT_DATE - 1, 'Active'),
  ('88888888-8888-8888-8888-000000000005', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-000000000006', 'BAT-GHE-401', 30.000, 28.000, 620.00, CURRENT_DATE - 10, CURRENT_DATE + 355, CURRENT_DATE - 10, 'Active')
ON CONFLICT (id) DO NOTHING;

-- 9. SEED PURCHASES
INSERT INTO public.purchases (id, shop_id, supplier_id, po_number, supplier_invoice_no, purchase_date, subtotal, tax_amount, discount_amount, total_amount, status, payment_status, received_at, received_by)
VALUES
  ('99999999-9999-9999-9999-000000000001', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-000000000001', 'PO-1001', 'INV-GOKUL-4401', CURRENT_DATE - 1, 10800.00, 540.00, 0.00, 11340.00, 'Received', 'Paid', now() - INTERVAL '1 day', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- 10. SEED PURCHASE ITEMS
INSERT INTO public.purchase_items (id, purchase_id, product_id, batch_id, batch_number, quantity, unit_cost, total_amount, manufacturing_date, expiry_date)
VALUES
  ('aaaaaaaa-1111-1111-1111-000000000001', '99999999-9999-9999-9999-000000000001', '66666666-6666-6666-6666-000000000001', '88888888-8888-8888-8888-000000000001', 'BAT-MLK-101', 50.000, 54.00, 2700.00, CURRENT_DATE - 1, CURRENT_DATE + 1),
  ('aaaaaaaa-1111-1111-1111-000000000002', '99999999-9999-9999-9999-000000000001', '66666666-6666-6666-6666-000000000001', '88888888-8888-8888-8888-000000000002', 'BAT-MLK-102', 150.000, 54.00, 8100.00, CURRENT_DATE, CURRENT_DATE + 2)
ON CONFLICT (id) DO NOTHING;

-- 11. SEED SALES & BILLING
INSERT INTO public.sales (id, shop_id, customer_id, invoice_no, transaction_id, sale_date, subtotal, discount_amount, tax_amount, net_amount, total_cogs, gross_profit, payment_method, payment_status, payment_reference, cashier_id)
VALUES
  ('bbbbbbbb-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-000000000001', 'INV-1001', 'TXN-CASH-00109', now() - INTERVAL '4 hours', 192.00, 0.00, 9.60, 201.60, 162.00, 39.60, 'Cash', 'Paid', 'CASH-REC-109', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
ON CONFLICT (id) DO NOTHING;

-- 12. SEED SALE ITEMS
INSERT INTO public.sale_items (id, sale_id, product_id, batch_id, quantity, unit_price, unit_cost, discount_amount, tax_amount, total_price, profit)
VALUES
  ('cccccccc-1111-1111-1111-000000000001', 'bbbbbbbb-1111-1111-1111-000000000001', '66666666-6666-6666-6666-000000000001', '88888888-8888-8888-8888-000000000001', 3.000, 64.00, 54.00, 0.00, 9.60, 201.60, 30.00)
ON CONFLICT (id) DO NOTHING;

-- 13. SEED PAYMENTS
INSERT INTO public.payments (id, shop_id, payment_type, customer_id, supplier_id, sale_id, purchase_id, amount, payment_mode, reference_no, payment_date, notes, recorded_by)
VALUES
  ('dddddddd-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'Sale POS Payment', '77777777-7777-7777-7777-000000000001', NULL, 'bbbbbbbb-1111-1111-1111-000000000001', NULL, 201.60, 'Cash', 'CASH-REC-109', CURRENT_DATE, 'POS counter checkout', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('dddddddd-1111-1111-1111-000000000002', '11111111-1111-1111-1111-111111111111', 'Supplier Settlement', NULL, '55555555-5555-5555-5555-000000000001', NULL, '99999999-9999-9999-9999-000000000001', 11340.00, 'Bank Transfer', 'NEFT-GV-88910', CURRENT_DATE - 1, 'Full procurement payment for PO-1001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- 14. SEED INVENTORY MOVEMENTS (Auditable Stock Ledger)
INSERT INTO public.inventory_movements (id, shop_id, product_id, batch_id, movement_type, flow_type, quantity, unit, previous_stock, updated_stock, cost_impact, reference_txn, reason, recorded_by, movement_date)
VALUES
  ('eeeeeeee-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-000000000001', '88888888-8888-8888-8888-000000000001', 'Purchase Received', 'Inflow', 50.000, 'Litres', 0.000, 50.000, 2700.00, 'PO-1001', 'Received consignment from Gokul Dairy', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - INTERVAL '1 day'),
  ('eeeeeeee-1111-1111-1111-000000000002', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-000000000001', '88888888-8888-8888-8888-000000000001', 'Sales', 'Outflow', 3.000, 'Litres', 50.000, 47.000, -162.00, 'INV-1001', 'POS retail customer purchase', 'cccccccc-cccc-cccc-cccc-cccccccccccc', now() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

-- 15. SEED STOCK TRANSFERS
INSERT INTO public.stock_transfers (id, transfer_number, from_shop_id, to_shop_id, product_id, batch_id, quantity, unit, status, sent_by, sent_at, notes)
VALUES
  ('ffffffff-1111-1111-1111-000000000001', 'TRF-1001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-000000000001', '88888888-8888-8888-8888-000000000002', 15.000, 'Litres', 'Received', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() - INTERVAL '1 day', 'Morning branch transfer for Sector 18 store')
ON CONFLICT (id) DO NOTHING;

-- 16. SEED RETURNS
INSERT INTO public.returns (id, shop_id, return_number, return_type, sale_id, customer_id, total_refund_amount, settlement_method, reason, processed_by, return_date)
VALUES
  ('12121212-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'CR-1001', 'Customer Return', 'bbbbbbbb-1111-1111-1111-000000000001', '77777777-7777-7777-7777-000000000001', 64.00, 'Cash', 'Unopened pouch bought by mistake', 'cccccccc-cccc-cccc-cccc-cccccccccccc', CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- 17. SEED RETURN ITEMS
INSERT INTO public.return_items (id, return_id, product_id, batch_id, quantity, unit_price_or_cost, total_amount, restock_action, condition_notes)
VALUES
  ('13131313-1111-1111-1111-000000000001', '12121212-1111-1111-1111-000000000001', '66666666-6666-6666-6666-000000000001', '88888888-8888-8888-8888-000000000001', 1.000, 64.00, 64.00, 'Restock to Inventory', 'Pouch sealed and chilled, restocked into counter display')
ON CONFLICT (id) DO NOTHING;

-- 18. SEED EXPENSES
INSERT INTO public.expenses (id, shop_id, category, title, amount, payment_mode, reference_no, expense_date, notes, recorded_by)
VALUES
  ('14141414-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'Rent', 'Central Dairy Showroom & Cold Room Rent', 25000.00, 'Bank Transfer', 'NEFT-RENT-NOV26', CURRENT_DATE - 15, 'Monthly lease for Sector 4 premises', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('14141414-1111-1111-1111-000000000002', '11111111-1111-1111-1111-111111111111', 'Electricity', 'Commercial Chillers & Freezers Power Bill', 14500.00, 'UPI', 'UPI-EB-88910', CURRENT_DATE - 10, 'Electricity bill for 3 chillers and blast freezers', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('14141414-1111-1111-1111-000000000003', '11111111-1111-1111-1111-111111111111', 'Transport', 'Daily Milk Procurement & Route Van Diesel', 8200.00, 'UPI', 'UPI-FUEL-4412', CURRENT_DATE - 5, 'Diesel fuel for morning collection trips', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;

-- 19. SEED NOTIFICATIONS
INSERT INTO public.notifications (id, shop_id, type, category, title, message, severity, is_read, link_view, reference_id)
VALUES
  ('15151515-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'stock_low', 'stock', 'Low Stock Alert: Salted Table Butter 500g', 'Stock is currently 12 packets (minimum threshold: 15 packets). Reorder suggested.', 'warning', false, 'inventory', '66666666-6666-6666-6666-000000000005'),
  ('15151515-1111-1111-1111-000000000002', '11111111-1111-1111-1111-111111111111', 'expiry_near', 'expiry', 'Near Expiry: Pure Cow Milk (Tomorrow)', 'Batch #BAT-MLK-101 has 38 Litres expiring tomorrow. Prioritize in counter display.', 'warning', false, 'expiry', '88888888-8888-8888-8888-000000000001'),
  ('15151515-1111-1111-1111-000000000003', '11111111-1111-1111-1111-111111111111', 'purchase_new', 'purchases', 'New Consignment Received: PO-1001', 'Confirmed receipt of 200 Litres milk from Gokul Dairy Cooperative.', 'info', true, 'purchases', '99999999-9999-9999-9999-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 20. SEED AUDIT LOGS
INSERT INTO public.audit_logs (id, shop_id, user_id, user_name, user_role, action, entity_type, entity_id, description, ip_address)
VALUES
  ('16161616-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Suresh Sharma', 'Administrator', 'INITIALIZE_SYSTEM', 'SHOP', '11111111-1111-1111-1111-111111111111', 'Initialized Supabase normalized relational database schema with 20 tables & multi-branch isolation', '127.0.0.1')
ON CONFLICT (id) DO NOTHING;
