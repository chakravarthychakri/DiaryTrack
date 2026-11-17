# 📡 DairyTrack REST API Reference Documentation

The DairyTrack API is built with Node.js, Express, and TypeScript. It provides a standardized RESTful interface for dairy inventory, FEFO batch allocation, POS counter transactions, analytics, and reporting.

---

## 🔐 Standard Headers & Authentication

All protected endpoints require a JWT Bearer Token in the `Authorization` header:

```http
Authorization: Bearer <YOUR_SESSION_TOKEN>
Content-Type: application/json
```

### Standard Response Schemas

#### Success
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... }
}
```

#### Error
```json
{
  "success": false,
  "error": "Detailed validation or permission error message."
}
```

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
Authenticates a user by email or username and password. Returns a 7-day session token.
- **Request Body**:
  ```json
  {
    "login": "admin@dairytrack.com",
    "password": "Password@123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": 1,
      "name": "Shop Admin",
      "email": "admin@dairytrack.com",
      "role": "Administrator"
    }
  }
  ```

### `POST /api/auth/register`
Self-registers a new user account with default `Shopkeeper` or assigned role.
- **Request Body**:
  ```json
  {
    "name": "Rahul Verma",
    "email": "rahul@dairytrack.com",
    "password": "Password@123",
    "phone": "9876543210",
    "role": "Shopkeeper"
  }
  ```
- **Response `201 Created`**

### `POST /api/auth/logout`
Destroys the current session token.
- **Response `200 OK`**

### `GET /api/auth/me`
Returns the currently authenticated user's session details.

---

## 2. Products & Categories Endpoints

### `GET /api/products`
Retrieves products with stock aggregations, active batches count, and pricing margins.
- **Query Parameters**:
  - `search` (string): Search by name, SKU, or barcode
  - `categoryId` (number): Filter by category
  - `status` (`'active'` | `'inactive'` | `'low'` | `'out'`)
  - `sortBy` (`'name_asc'` | `'name_desc'` | `'price_asc'` | `'price_desc'` | `'stock_asc'` | `'stock_desc'`)
  - `page` (number, default: 1), `limit` (number, default: 50)
- **Response `200 OK`**

### `POST /api/products` *(Admin / Manager)*
Creates a new dairy product. Automatically generates unique SKU if omitted.
- **Request Body**:
  ```json
  {
    "name": "Standardized Milk 500ml",
    "sku": "MLK-500ML",
    "category_id": 9,
    "unit": "pkt",
    "purchase_price": 26.00,
    "selling_price": 30.00,
    "min_stock_level": 25,
    "shelf_life_days": 2,
    "storage_temperature": "2°C - 4°C"
  }
  ```
- **Response `201 Created`**

### `PUT /api/products/:id` *(Admin / Manager)*
Updates product master details.

### `DELETE /api/products/:id` *(Admin Only)*
Soft-deletes or archives a product.

---

## 3. Inventory & Batch Management

### `GET /api/inventory`
Lists on-hand inventory balances, batch lists, and stock valuation totals.

### `GET /api/inventory/movements`
Lists auditable stock ledger transactions with pagination.
- **Query Parameters**: `startDate`, `endDate`, `movement_type`, `productId`, `page`, `limit`

### `POST /api/inventory/adjustments` *(Admin / Manager)*
Adjusts stock quantity for a specific batch (positive or negative) with reason and auditable movement logging.
- **Request Body**:
  ```json
  {
    "batch_id": 14,
    "adjustment_quantity": -2,
    "reason": "Container leaked during cold storage inspection",
    "notes": "Logged during morning audit"
  }
  ```
- **Response `200 OK`**

### `GET /api/inventory/reconciliation`
Compares theoretical stock from movements ledger against physical batches on hand.

---

## 4. Sales & POS Billing Endpoints

### `GET /api/sales`
Lists sales transactions with cashier information and payment methods.

### `POST /api/sales`
Executes atomic checkout. Automatically liquidates stock using **FEFO (First-Expired-First-Out)**, creates customer invoice, and updates Udhar/loyalty points.
- **Idempotency**: Pass `idempotency_key` to prevent accidental double-billing on rapid clicks.
- **Request Body**:
  ```json
  {
    "idempotency_key": "txn-pos-1731800000",
    "customer_id": 1,
    "items": [
      { "product_id": 1, "quantity": 5, "unit_price": 30.00 }
    ],
    "payment_method": "UPI",
    "discount_amount": 0.00,
    "tax_amount": 0.00
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "invoice_no": "INV-2026-00124",
    "net_amount": 150.00,
    "payment_status": "Paid"
  }
  ```

### `POST /api/sales/:id/returns` *(Admin / Manager)*
Processes customer sales return. Restores batch stock, logs inventory movement, and computes refund amount.

---

## 5. Purchases & Procurement

### `GET /api/purchases`
Lists procurement purchase orders with status (`'Draft'` | `'Received'` | `'Cancelled'`).

### `POST /api/purchases` *(Admin / Manager)*
Creates purchase order record in `'Draft'` state without mutating inventory.
- **Request Body**:
  ```json
  {
    "supplier_id": 1,
    "purchase_date": "2026-11-17",
    "status": "Draft",
    "items": [
      {
        "product_id": 1,
        "quantity": 100,
        "unit_cost": 26.00,
        "mfg_date": "2026-11-17",
        "expiry_date": "2026-11-20"
      }
    ]
  }
  ```
- **Response `201 Created`**

### `POST /api/purchases/:id/receive` *(Admin / Manager)*
Confirms shipment receipt. Creates new product batches, records inward stock movements, and updates supplier balance due.
- **Response `200 OK`**

### `POST /api/purchases/:id/cancel` *(Admin / Manager)*
Cancels a draft purchase order. Strictly isolated from inventory.

---

## 6. Suppliers & Farmers

### `GET /api/suppliers`
Lists suppliers with balance due, purchase count, and return totals.

### `POST /api/suppliers` *(Admin / Manager)*
Adds a new milk farmer or commercial packaging supplier.

### `POST /api/suppliers/:id/pay` *(Admin / Manager)*
Records payment disbursement to supplier and reduces outstanding `balance_due`.

### `POST /api/suppliers/returns` *(Admin / Manager)*
Logs return of defective or sour dairy batch back to supplier. Deducts batch stock and offsets balance due.

---

## 7. Customers & Udhar Ledger

### `GET /api/customers`
Lists customers with outstanding credit (Udhar) balances and loyalty points.

### `POST /api/customers`
Registers new retail or wholesale customer.

### `POST /api/customers/:id/pay-credit`
Records Udhar settlement payment from customer.

---

## 8. Expiry & Spoilage Radar

### `GET /api/expiry/dashboard`
Returns real-time radar categorizing batches:
- Critical Expiry (0-2 days remaining)
- Warning Expiry (3-5 days remaining)
- Expired Batches

### `POST /api/expiry/write-off` *(Admin / Manager)*
Writes off expired or damaged batch, reduces stock, and logs financial loss under `waste_damaged`.

---

## 9. Business Intelligence & Analytics

### `GET /api/analytics/dashboard`
Comprehensive KPI payload containing sales trends, payment method breakdowns, top categories, and financial margins.

### `GET /api/analytics/top-products`
Top 5 products ranked switchably by:
- `metric=revenue`
- `metric=quantity`
- `metric=transactions`

### `GET /api/analytics/sales`
Period sales analytics with daily, weekly, monthly, and yearly aggregation.

### `GET /api/analytics/profit`
Reconciles profitability:
$$\text{Net Sales} = \text{Gross Sales} - \text{Discounts} - \text{Returns}$$
$$\text{Gross Profit} = \text{Net Sales} - \text{COGS}$$
$$\text{Operating Profit} = \text{Gross Profit} - \text{Operating Expenses}$$

### `GET /api/expenses` & `POST /api/expenses`
Manages operating expenses (Rent, Electricity, Salaries, Transport).

---

## 10. Multi-Sheet Excel Reports

### `GET /api/reports/excel`
Generates a complete **10-Sheet professional Excel workbook** formatted with green headers, INR currency, frozen panes, and auto-width columns.
- **Query Parameters**:
  - `range`: `'today'` | `'yesterday'` | `'7days'` | `'30days'` | `'current_month'` | `'previous_month'` | `'all'` | `'custom'`
  - `startDate`, `endDate`, `categoryId`, `supplierId`
- **Response**: Binary Excel stream (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).

### `GET /api/reports/pdf`
Generates a print-ready Executive Financial Summary with printable styling.

---

## 11. In-App Notification Center

### `GET /api/notifications`
Fetches unread alerts for low stock, expiring batches, and system events.

### `POST /api/notifications/:id/read`
Marks single notification as read.

### `POST /api/notifications/read-all`
Marks all alerts as read.

---

## 12. Security & Database Backups

### `POST /api/system/backup` *(Admin Only)*
Creates a physical backup copy of the database and generates a SHA-256 cryptographic verification checksum.

### `GET /api/system/backups` *(Admin Only)*
Lists persisted backups with file sizes, timestamps, and checksums.

### `GET /api/audit-logs` *(Admin / Manager)*
Returns chronological security and administrative action logs.
