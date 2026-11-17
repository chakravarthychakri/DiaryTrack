-- ====================================================================
-- MODULE 15: SUPABASE POSTGRESQL NORMALIZED RELATIONAL DATABASE SCHEMA
-- Multi-Tenant Dairy Shop Management & Auditable Inventory Ledger System
-- ====================================================================

-- 1. Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. TABLE DEFINITIONS (20 NORMALIZED RELATIONAL TABLES)
-- ====================================================================

-- -------------------------------------------------------------
-- TABLE 1: profiles
-- User profiles synchronized with Supabase Auth (auth.users)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'Shopkeeper' CHECK (role IN ('Administrator', 'Manager', 'Shopkeeper')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 2: shops
-- Dairy shop units, central distribution hubs & retail branches
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  gstin TEXT,
  fssai_license TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Delhi',
  postal_code TEXT,
  upi_vpa TEXT,
  tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (tax_rate_percent >= 0.00),
  is_main_branch BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 3: shop_members
-- Multi-tenant user authorization & branch membership mapping
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Shopkeeper' CHECK (role IN ('Administrator', 'Manager', 'Shopkeeper')),
  is_primary_shop BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, profile_id)
);

-- -------------------------------------------------------------
-- TABLE 4: categories
-- Canonical dairy product classifications (Milk, Curd, Ghee, etc.)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 5: suppliers
-- Dairy farmers, cooperatives & packaging material vendors
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  gstin TEXT,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_terms TEXT DEFAULT 'Net 15',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 6: products
-- Catalog products with SKU, unit of measure & stock limits
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  unit TEXT NOT NULL CHECK (unit IN ('Litres', 'Millilitres', 'Kilograms', 'Grams', 'Pieces', 'Packets', 'Bottles')),
  purchase_price NUMERIC(12,2) NOT NULL CHECK (purchase_price >= 0.00),
  selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0.00),
  min_stock_level NUMERIC(12,3) NOT NULL DEFAULT 5.000 CHECK (min_stock_level >= 0.000),
  shelf_life_days INTEGER NOT NULL DEFAULT 2 CHECK (shelf_life_days >= 1),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, sku)
);

-- -------------------------------------------------------------
-- TABLE 7: customers
-- Retail walk-in clients, wholesale caterers & credit (Udhar) accounts
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  type TEXT NOT NULL DEFAULT 'Retail' CHECK (type IN ('Retail', 'Wholesale', 'Restaurant/Catering', 'Dairy Farmer')),
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 5000.00 CHECK (credit_limit >= 0.00),
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (credit_balance >= 0.00),
  loyalty_points INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Blocked')),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 8: product_batches
-- Perishable batch tracking with FEFO expiry & purchase costs
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  initial_quantity NUMERIC(12,3) NOT NULL CHECK (initial_quantity >= 0.000),
  current_quantity NUMERIC(12,3) NOT NULL CHECK (current_quantity >= 0.000),
  purchase_cost NUMERIC(12,2) NOT NULL CHECK (purchase_cost >= 0.00),
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Depleted', 'Expired', 'Recalled', 'Quarantined')),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, product_id, batch_number)
);

-- -------------------------------------------------------------
-- TABLE 9: purchases
-- Inbound procurement purchase orders & supplier consignments
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  po_number TEXT NOT NULL,
  supplier_invoice_no TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0.00),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0.00),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0.00),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0.00),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Ordered', 'Received', 'Cancelled', 'Partial')),
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partial', 'Paid')),
  received_at TIMESTAMPTZ,
  received_by UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, po_number)
);

-- -------------------------------------------------------------
-- TABLE 10: purchase_items
-- Granular line items linking purchases to product batches
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.product_batches(id),
  batch_number TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0.000),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0.00),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0.00),
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 11: sales
-- Point of Sale customer invoices, tax totals & payment metadata
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  invoice_no TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0.00),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0.00),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0.00),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0.00),
  total_cogs NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_cogs >= 0.00),
  gross_profit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Credit (Udhar)', 'Split / Multiple')),
  payment_status TEXT NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Partial', 'Unpaid', 'Refunded')),
  payment_reference TEXT,
  notes TEXT,
  cashier_id UUID NOT NULL REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, invoice_no)
);

-- -------------------------------------------------------------
-- TABLE 12: sale_items
-- Sold product lines with FEFO batch deduction & COGS tracking
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0.000),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0.00),
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0.00),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0.00),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0.00),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0.00),
  profit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 13: payments
-- Financial transaction ledger for customers, suppliers & sales
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Customer Settlement', 'Supplier Settlement', 'Sale POS Payment', 'Expense Payment')),
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  sale_id UUID REFERENCES public.sales(id),
  purchase_id UUID REFERENCES public.purchases(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0.00),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Credit Note')),
  reference_no TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 14: inventory_movements
-- Auditable Single Source of Truth for all stock inflows & outflows
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.product_batches(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'Opening Stock', 'Purchase Received', 'Customer Return', 'Transfer In', 'Authorized Correction In',
    'Sales', 'Supplier Return', 'Transfer Out', 'Expired Stock', 'Damaged Stock', 'Wastage', 'Authorized Correction Out'
  )),
  flow_type TEXT NOT NULL CHECK (flow_type IN ('Inflow', 'Outflow')),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0.000),
  unit TEXT NOT NULL,
  previous_stock NUMERIC(12,3) NOT NULL CHECK (previous_stock >= 0.000),
  updated_stock NUMERIC(12,3) NOT NULL CHECK (updated_stock >= 0.000),
  cost_impact NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  reference_txn TEXT,
  reason TEXT NOT NULL,
  correction_of_id UUID REFERENCES public.inventory_movements(id),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 15: stock_transfers
-- Inter-branch stock transfers between shops/warehouses
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT NOT NULL,
  from_shop_id UUID NOT NULL REFERENCES public.shops(id),
  to_shop_id UUID NOT NULL REFERENCES public.shops(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0.000),
  unit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Transit' CHECK (status IN ('Pending', 'In Transit', 'Received', 'Cancelled')),
  sent_by UUID NOT NULL REFERENCES public.profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID REFERENCES public.profiles(id),
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_shop_id <> to_shop_id)
);

-- -------------------------------------------------------------
-- TABLE 16: returns
-- Customer return vouchers and supplier defective return credits
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL,
  return_type TEXT NOT NULL CHECK (return_type IN ('Customer Return', 'Supplier Return')),
  sale_id UUID REFERENCES public.sales(id),
  purchase_id UUID REFERENCES public.purchases(id),
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  total_refund_amount NUMERIC(12,2) NOT NULL CHECK (total_refund_amount >= 0.00),
  settlement_method TEXT NOT NULL CHECK (settlement_method IN ('Cash', 'UPI', 'Store Credit / Udhar Adjustment', 'Credit Note', 'Replacement')),
  reason TEXT NOT NULL,
  processed_by UUID NOT NULL REFERENCES public.profiles(id),
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, return_number)
);

-- -------------------------------------------------------------
-- TABLE 17: return_items
-- Returned line items detailing restock vs damage disposal
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.product_batches(id),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0.000),
  unit_price_or_cost NUMERIC(12,2) NOT NULL CHECK (unit_price_or_cost >= 0.00),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0.00),
  restock_action TEXT NOT NULL CHECK (restock_action IN ('Restock to Inventory', 'Damage / Discard', 'Supplier Return Quarantine')),
  condition_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 18: expenses
-- Operating expenses (Rent, Electricity, Transport, Salaries)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('Rent', 'Electricity', 'Transport', 'Employee Salaries', 'Packaging', 'Maintenance', 'Other Expenses')),
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0.00),
  payment_mode TEXT NOT NULL DEFAULT 'Bank Transfer' CHECK (payment_mode IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque')),
  reference_no TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 19: notifications
-- In-app alert center entries across 9 operational categories
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'stock_low', 'stock_out', 'expiry_near', 'expired', 'wastage_unusual',
    'purchase_new', 'sale_complete', 'transaction_failed', 'system_event'
  )),
  category TEXT NOT NULL DEFAULT 'system' CHECK (category IN ('stock', 'expiry', 'wastage', 'sales', 'purchases', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'danger')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  link_view TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- TABLE 20: audit_logs
-- Immutable tamper-evident system audit trail
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 3. PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_shop_members_user ON public.shop_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_products_shop_cat ON public.products(shop_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_batches_fefo ON public.product_batches(shop_id, product_id, expiry_date, current_quantity);
CREATE INDEX IF NOT EXISTS idx_purchases_shop_date ON public.purchases(shop_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_po ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop_date ON public.sales(shop_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON public.sales(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch ON public.sale_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_date ON public.payments(shop_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_ledger ON public.inventory_movements(shop_id, product_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_batch ON public.inventory_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_transfers_route ON public.stock_transfers(from_shop_id, to_shop_id, status);
CREATE INDEX IF NOT EXISTS idx_returns_shop ON public.returns(shop_id, return_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_cat ON public.expenses(shop_id, category, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_notif_shop_unread ON public.notifications(shop_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_shop_entity ON public.audit_logs(shop_id, entity_type, created_at DESC);

-- ====================================================================
-- 4. AUTOMATED UPDATED_AT TRIGGER FUNCTION
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles', 'shops', 'shop_members', 'categories', 'suppliers',
    'products', 'customers', 'product_batches', 'purchases', 'sales',
    'stock_transfers', 'returns', 'expenses'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at_%1$I ON public.%1$I;
      CREATE TRIGGER trg_updated_at_%1$I
      BEFORE UPDATE ON public.%1$I
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    ', tbl);
  END LOOP;
END $$;

-- ====================================================================
-- 5. AUDITABLE STOCK LEDGER ATOMIC RECONCILIATION TRIGGERS
-- Important Inventory Rule: inventory_movements is the source of truth
-- ====================================================================

-- Function to atomically reconcile batch current_quantity from inventory_movements
CREATE OR REPLACE FUNCTION public.trg_process_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_qty NUMERIC(12,3);
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    -- Fetch batch quantity with lock
    SELECT current_quantity INTO v_batch_qty
    FROM public.product_batches
    WHERE id = NEW.batch_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target product batch % does not exist', NEW.batch_id;
    END IF;

    IF NEW.flow_type = 'Inflow' THEN
      UPDATE public.product_batches
      SET 
        current_quantity = current_quantity + NEW.quantity,
        status = CASE WHEN current_quantity + NEW.quantity > 0 THEN 'Active' ELSE status END
      WHERE id = NEW.batch_id;
    ELSIF NEW.flow_type = 'Outflow' THEN
      IF v_batch_qty < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock in batch %. Available: %, Attempted Outflow: %',
          NEW.batch_id, v_batch_qty, NEW.quantity;
      END IF;

      UPDATE public.product_batches
      SET 
        current_quantity = current_quantity - NEW.quantity,
        status = CASE WHEN current_quantity - NEW.quantity = 0 THEN 'Depleted' ELSE status END
      WHERE id = NEW.batch_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reconcile_stock_on_movement ON public.inventory_movements;
CREATE TRIGGER trg_reconcile_stock_on_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.trg_process_inventory_movement();

-- Immutability Guard: Prevent modifying or deleting historical stock movements
CREATE OR REPLACE FUNCTION public.trg_guard_inventory_movements_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Historical stock movement records are strictly immutable. Use an authorized correction movement instead.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_movements ON public.inventory_movements;
CREATE TRIGGER trg_immutable_movements
BEFORE UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_inventory_movements_immutability();

-- ====================================================================
-- 6. ROW LEVEL SECURITY (RLS) & SHOP-LEVEL DATA ISOLATION POLICIES
-- ====================================================================

-- Enable RLS across all 20 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security helper: List shop IDs current user belongs to
CREATE OR REPLACE FUNCTION public.get_auth_shop_ids()
RETURNS TABLE (shop_id UUID) SECURITY DEFINER
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT sm.shop_id FROM public.shop_members sm
  WHERE sm.profile_id = auth.uid()
$$;

-- Security helper: Check if user is shop administrator
CREATE OR REPLACE FUNCTION public.is_auth_shop_admin(check_shop_id UUID)
RETURNS BOOLEAN SECURITY DEFINER
SET search_path = public
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members sm
    WHERE sm.profile_id = auth.uid()
      AND sm.shop_id = check_shop_id
      AND sm.role = 'Administrator'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'Administrator'
  );
$$;

-- 1. Profiles RLS
DROP POLICY IF EXISTS "profiles_select_own_or_colleagues" ON public.profiles;
CREATE POLICY "profiles_select_own_or_colleagues" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR
  id IN (SELECT sm.profile_id FROM public.shop_members sm WHERE sm.shop_id IN (SELECT public.get_auth_shop_ids()))
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- 2. Shops RLS (Users see and access their assigned shops)
DROP POLICY IF EXISTS "shops_member_access" ON public.shops;
CREATE POLICY "shops_member_access" ON public.shops
FOR SELECT USING (
  id IN (SELECT public.get_auth_shop_ids()) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Administrator')
);

DROP POLICY IF EXISTS "shops_admin_modify" ON public.shops;
CREATE POLICY "shops_admin_modify" ON public.shops
FOR ALL USING (public.is_auth_shop_admin(id));

-- 3. Shop Members RLS
DROP POLICY IF EXISTS "shop_members_select" ON public.shop_members;
CREATE POLICY "shop_members_select" ON public.shop_members
FOR SELECT USING (shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "shop_members_admin_manage" ON public.shop_members;
CREATE POLICY "shop_members_admin_manage" ON public.shop_members
FOR ALL USING (public.is_auth_shop_admin(shop_id));

-- 4. Explicit Shop-Scoped Tables RLS (Select, Insert, Update, Admin Delete)

-- Products
DROP POLICY IF EXISTS "products_shop_isolation_select" ON public.products;
CREATE POLICY "products_shop_isolation_select" ON public.products
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "products_shop_isolation_insert" ON public.products;
CREATE POLICY "products_shop_isolation_insert" ON public.products
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "products_shop_isolation_update" ON public.products;
CREATE POLICY "products_shop_isolation_update" ON public.products
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "products_shop_isolation_delete" ON public.products;
CREATE POLICY "products_shop_isolation_delete" ON public.products
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Sales
DROP POLICY IF EXISTS "sales_shop_isolation_select" ON public.sales;
CREATE POLICY "sales_shop_isolation_select" ON public.sales
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "sales_shop_isolation_insert" ON public.sales;
CREATE POLICY "sales_shop_isolation_insert" ON public.sales
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "sales_shop_isolation_update" ON public.sales;
CREATE POLICY "sales_shop_isolation_update" ON public.sales
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "sales_shop_isolation_delete" ON public.sales;
CREATE POLICY "sales_shop_isolation_delete" ON public.sales
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Purchases
DROP POLICY IF EXISTS "purchases_shop_isolation_select" ON public.purchases;
CREATE POLICY "purchases_shop_isolation_select" ON public.purchases
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "purchases_shop_isolation_insert" ON public.purchases;
CREATE POLICY "purchases_shop_isolation_insert" ON public.purchases
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "purchases_shop_isolation_update" ON public.purchases;
CREATE POLICY "purchases_shop_isolation_update" ON public.purchases
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "purchases_shop_isolation_delete" ON public.purchases;
CREATE POLICY "purchases_shop_isolation_delete" ON public.purchases
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Categories
DROP POLICY IF EXISTS "categories_shop_isolation_select" ON public.categories;
CREATE POLICY "categories_shop_isolation_select" ON public.categories
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "categories_shop_isolation_insert" ON public.categories;
CREATE POLICY "categories_shop_isolation_insert" ON public.categories
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "categories_shop_isolation_update" ON public.categories;
CREATE POLICY "categories_shop_isolation_update" ON public.categories
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "categories_shop_isolation_delete" ON public.categories;
CREATE POLICY "categories_shop_isolation_delete" ON public.categories
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Suppliers
DROP POLICY IF EXISTS "suppliers_shop_isolation_select" ON public.suppliers;
CREATE POLICY "suppliers_shop_isolation_select" ON public.suppliers
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "suppliers_shop_isolation_insert" ON public.suppliers;
CREATE POLICY "suppliers_shop_isolation_insert" ON public.suppliers
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "suppliers_shop_isolation_update" ON public.suppliers;
CREATE POLICY "suppliers_shop_isolation_update" ON public.suppliers
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "suppliers_shop_isolation_delete" ON public.suppliers;
CREATE POLICY "suppliers_shop_isolation_delete" ON public.suppliers
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Customers
DROP POLICY IF EXISTS "customers_shop_isolation_select" ON public.customers;
CREATE POLICY "customers_shop_isolation_select" ON public.customers
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "customers_shop_isolation_insert" ON public.customers;
CREATE POLICY "customers_shop_isolation_insert" ON public.customers
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "customers_shop_isolation_update" ON public.customers;
CREATE POLICY "customers_shop_isolation_update" ON public.customers
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "customers_shop_isolation_delete" ON public.customers;
CREATE POLICY "customers_shop_isolation_delete" ON public.customers
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Product Batches
DROP POLICY IF EXISTS "product_batches_shop_isolation_select" ON public.product_batches;
CREATE POLICY "product_batches_shop_isolation_select" ON public.product_batches
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "product_batches_shop_isolation_insert" ON public.product_batches;
CREATE POLICY "product_batches_shop_isolation_insert" ON public.product_batches
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "product_batches_shop_isolation_update" ON public.product_batches;
CREATE POLICY "product_batches_shop_isolation_update" ON public.product_batches
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "product_batches_shop_isolation_delete" ON public.product_batches;
CREATE POLICY "product_batches_shop_isolation_delete" ON public.product_batches
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Payments
DROP POLICY IF EXISTS "payments_shop_isolation_select" ON public.payments;
CREATE POLICY "payments_shop_isolation_select" ON public.payments
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "payments_shop_isolation_insert" ON public.payments;
CREATE POLICY "payments_shop_isolation_insert" ON public.payments
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "payments_shop_isolation_update" ON public.payments;
CREATE POLICY "payments_shop_isolation_update" ON public.payments
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "payments_shop_isolation_delete" ON public.payments;
CREATE POLICY "payments_shop_isolation_delete" ON public.payments
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Inventory Movements
DROP POLICY IF EXISTS "inventory_movements_shop_isolation_select" ON public.inventory_movements;
CREATE POLICY "inventory_movements_shop_isolation_select" ON public.inventory_movements
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "inventory_movements_shop_isolation_insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements_shop_isolation_insert" ON public.inventory_movements
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "inventory_movements_shop_isolation_delete" ON public.inventory_movements;
CREATE POLICY "inventory_movements_shop_isolation_delete" ON public.inventory_movements
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Returns
DROP POLICY IF EXISTS "returns_shop_isolation_select" ON public.returns;
CREATE POLICY "returns_shop_isolation_select" ON public.returns
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "returns_shop_isolation_insert" ON public.returns;
CREATE POLICY "returns_shop_isolation_insert" ON public.returns
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "returns_shop_isolation_update" ON public.returns;
CREATE POLICY "returns_shop_isolation_update" ON public.returns
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "returns_shop_isolation_delete" ON public.returns;
CREATE POLICY "returns_shop_isolation_delete" ON public.returns
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Expenses
DROP POLICY IF EXISTS "expenses_shop_isolation_select" ON public.expenses;
CREATE POLICY "expenses_shop_isolation_select" ON public.expenses
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "expenses_shop_isolation_insert" ON public.expenses;
CREATE POLICY "expenses_shop_isolation_insert" ON public.expenses
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "expenses_shop_isolation_update" ON public.expenses;
CREATE POLICY "expenses_shop_isolation_update" ON public.expenses
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "expenses_shop_isolation_delete" ON public.expenses;
CREATE POLICY "expenses_shop_isolation_delete" ON public.expenses
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Notifications
DROP POLICY IF EXISTS "notifications_shop_isolation_select" ON public.notifications;
CREATE POLICY "notifications_shop_isolation_select" ON public.notifications
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "notifications_shop_isolation_insert" ON public.notifications;
CREATE POLICY "notifications_shop_isolation_insert" ON public.notifications
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "notifications_shop_isolation_update" ON public.notifications;
CREATE POLICY "notifications_shop_isolation_update" ON public.notifications
FOR UPDATE USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "notifications_shop_isolation_delete" ON public.notifications;
CREATE POLICY "notifications_shop_isolation_delete" ON public.notifications
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- Audit Logs
DROP POLICY IF EXISTS "audit_logs_shop_isolation_select" ON public.audit_logs;
CREATE POLICY "audit_logs_shop_isolation_select" ON public.audit_logs
FOR SELECT USING (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "audit_logs_shop_isolation_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_shop_isolation_insert" ON public.audit_logs
FOR INSERT WITH CHECK (shop_id IS NULL OR shop_id IN (SELECT public.get_auth_shop_ids()));

DROP POLICY IF EXISTS "audit_logs_shop_isolation_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_shop_isolation_delete" ON public.audit_logs
FOR DELETE USING (public.is_auth_shop_admin(shop_id));

-- 5. Sub-item Tables RLS (purchase_items, sale_items, return_items)
DROP POLICY IF EXISTS "purchase_items_parent_access" ON public.purchase_items;
CREATE POLICY "purchase_items_parent_access" ON public.purchase_items
FOR ALL USING (
  purchase_id IN (SELECT id FROM public.purchases WHERE shop_id IN (SELECT public.get_auth_shop_ids()))
);

DROP POLICY IF EXISTS "sale_items_parent_access" ON public.sale_items;
CREATE POLICY "sale_items_parent_access" ON public.sale_items
FOR ALL USING (
  sale_id IN (SELECT id FROM public.sales WHERE shop_id IN (SELECT public.get_auth_shop_ids()))
);

DROP POLICY IF EXISTS "return_items_parent_access" ON public.return_items;
CREATE POLICY "return_items_parent_access" ON public.return_items
FOR ALL USING (
  return_id IN (SELECT id FROM public.returns WHERE shop_id IN (SELECT public.get_auth_shop_ids()))
);

-- 6. Stock Transfers RLS (Visible to either originating or receiving shop)
DROP POLICY IF EXISTS "transfers_shop_isolation" ON public.stock_transfers;
CREATE POLICY "transfers_shop_isolation" ON public.stock_transfers
FOR ALL USING (
  from_shop_id IN (SELECT public.get_auth_shop_ids()) OR
  to_shop_id IN (SELECT public.get_auth_shop_ids())
);
