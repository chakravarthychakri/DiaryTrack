# 📖 DairyTrack – Operational User Manual & Best Practices

Welcome to the **DairyTrack** User Manual. This guide provides role-specific workflows for Cashiers, Store Managers, and Dairy Shop Owners to efficiently run daily operations.

---

## 👥 User Roles & Responsibilities

| Role | Key Focus | Primary Pages Used |
| :--- | :--- | :--- |
| **Cashier / Shopkeeper** | Fast counter billing, UPI/Cash payments, customer credit (Udhar) collection | `Sales (POS)`, `Customers`, `Products` |
| **Store Manager** | Procurement, batch creation, shelf-life monitoring, waste write-offs | `Inventory`, `Purchases`, `Suppliers`, `Expiry Management` |
| **Shop Owner / Admin** | Profitability, financial analysis, Excel audits, staff management, backups | `Dashboard`, `Analytics`, `Reports`, `User Management`, `Settings` |

---

## 🛒 1. Cashier Workflow: POS Billing & Sales

### A. Conducting a Sale
1. Navigate to **Sales & Billing** from the sidebar or press `F2`.
2. **Search Products**: Type product name or SKU in the search bar, or click directly on the category tabs (Milk, Curd, Paneer, Ghee).
3. **Add Items to Cart**: Click on an item or click the `+` button. The system automatically selects the batch nearest to expiry using **FEFO**.
4. **Select Customer**:
   - Leave as **Walk-in Retail** for anonymous customers.
   - Or search existing customer by name/phone for loyalty points or Udhar credit.
5. **Apply Discounts / Taxes**: Enter discount percentage or flat amount if promotional pricing applies.
6. **Select Payment Method**:
   - **Cash**: Enter received amount to calculate change.
   - **UPI**: Display dynamic QR or prompt user for VPA payment confirmation.
   - **Customer Credit (Udhar)**: Only available for registered customers within their approved credit limit.
   - **Card / Split**: Split across modes.
7. **Complete & Print Invoice**: Click **Complete Sale**. The system prints a clean 80mm thermal receipt or A4 invoice and automatically deducts batch stock.

### B. Handling Customer Returns
1. Go to **Customers** -> **Customer Returns** or open the invoice from **Sales History**.
2. Select the line item and quantity being returned.
3. State the reason (e.g., *Defective packaging*, *Accidental purchase*).
4. Select **Restock to Inventory** if the dairy package is intact and chilled. If spoiled, leave unchecked to route to wastage.
5. Refund amount is disbursed via original payment method.

---

## 📦 2. Manager Workflow: Procurement & Batch Management

### A. Receiving Raw Milk or Packaged Consignments
1. Go to **Purchase Orders & Procurement**.
2. Click **Create Purchase Order**.
3. Select the **Supplier** (farmer or cooperative union).
4. Enter line items:
   - Select product (e.g., *Cow Milk 1L*).
   - Inward quantity (e.g., *200 L*).
   - Unit procurement price (e.g., *₹42/L*).
   - Enter **Manufacturing Date** and **Expiry Date** from container labels.
5. Click **Save as Draft** if awaiting delivery truck.
6. When the truck arrives at the dock:
   - Inspect container seals and verify temperature (Must be $\le 4^\circ\text{C}$).
   - Click **Confirm Receipt**.
   - The system generates active product batches and updates stock balances instantly.

### B. Monitoring the Expiry Radar
Dairy products have short shelf lives (2 to 7 days). DairyTrack prevents selling expired milk:
1. Open **Expiry Management** daily at morning opening.
2. Review the **Critical Batches (0-2 Days Left)**:
   - Identify batches nearing expiration.
   - Apply a discount to sell out before end-of-day.
3. Review **Expired Batches**:
   - For batches past date, click **Write-Off**.
   - Select disposition (*Discarded* or *Sent to Byproduct / Chhena Conversion*).
   - The system deducts stock and records the loss under Spoilage.

### C. Returning Defective Stock to Suppliers
If a milk tanker tests positive for high acidity or souring:
1. Open **Suppliers** -> **Supplier Returns**.
2. Click **Log Supplier Return**.
3. Select supplier, batch, rejected quantity, and reason.
4. The system reduces batch stock and offsets the supplier's balance due.

---

## 👑 3. Owner Workflow: BI Analytics, Reports & Administration

### A. Reviewing True Business Profitability
Never confuse revenue with profit!
1. Open **Business Intelligence & Analytics**.
2. Select the report period (Today, Last 7 Days, Current Month).
3. DairyTrack displays:
   - **Gross Sales**: Total retail billing value.
   - **Cost of Goods Sold (COGS)**: Exact purchase cost of batches sold.
   - **Gross Profit**: Net Sales minus COGS.
   - **Operating Profit**: Gross Profit minus recorded shop overhead expenses (Rent, Electricity, Driver Salaries).

### B. Tracking Operating Expenses
1. In **Analytics**, open **Operating Expenses**.
2. Click **Add Expense**.
3. Log daily expenditures:
   - Electricity (refrigeration compressors)
   - Cold chain transport fuel
   - Employee salaries
   - Shop rent
4. This ensures your P&L statements reflect actual net take-home earnings.

### C. Generating Multi-Sheet Excel Workbooks
1. Open **Excel Report Center**.
2. Choose your date range (e.g., *Current Month* or *Last 30 Days*).
3. Click **Download Complete Excel Workbook**.
4. DairyTrack downloads an **ExcelJS 10-Sheet Workbook**:
   - `Sheet 1: Dashboard Summary`
   - `Sheet 2: Product Master`
   - `Sheet 3: Daily Sales`
   - `Sheet 4: Purchase History`
   - `Sheet 5: Current Inventory`
   - `Sheet 6: Stock Movement Journal`
   - `Sheet 7: Top Selling Products`
   - `Sheet 8: Profit & Loss Statement`
   - `Sheet 9: Expired & Damaged Products`
   - `Sheet 10: Supplier Report`
   All sheets feature green headers, INR currency formatting, and frozen top rows ready for your CA or tax accountant.

### D. System Security & Physical Backups
1. Open **Settings** -> **Database Backups**.
2. Click **Create Immediate Backup**.
3. The system generates an encrypted copy of the SQLite database and records a SHA-256 cryptographic checksum.
4. Store backup files off-site weekly for business continuity.
