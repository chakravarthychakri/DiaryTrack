// ====================================================================
// MODULE 6: SALES AND BILLING (POS) SYSTEM
// ====================================================================

const salesModule = {
  posProducts: [],
  activeCategory: 'all',
  activeStockFilter: 'all',
  activeSort: 'default',
  activePaymentMethod: 'Cash',
  salesConfig: null,
  currentReceiptSale: null,
  pastSalesList: [],
  isSubmittingCheckout: false,

  async init() {
    this.bindEvents();
    await Promise.all([
      this.loadSalesConfig(),
      this.loadCustomers(),
      this.loadPosProducts()
    ]);
    this.renderCategorySidebar();
    this.renderCart();
    this.updateCashierBadge();
  },

  bindEvents() {
    // Product Search Input
    const searchInput = document.getElementById('pos-product-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.filterProducts(e.target.value);
      };
    }

    // Barcode Scanner Input (Press Enter to immediately add item to cart)
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (barcodeInput) {
      barcodeInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleBarcodeScan(barcodeInput.value);
        }
      };
    }

    // Global POS Keyboard Shortcut: F2 to trigger checkout
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        const salesSection = document.getElementById('view-sales');
        if (salesSection && salesSection.classList.contains('active')) {
          e.preventDefault();
          this.processCheckout();
        }
      }
    });
  },

  updateCashierBadge() {
    const badge = document.getElementById('pos-terminal-cashier');
    if (badge && state.currentUser) {
      badge.textContent = `${state.currentUser.name} (${state.currentUser.role || 'Staff'})`;
    }
  },

  async loadSalesConfig() {
    try {
      const res = await api.getSalesConfig();
      if (res.success && res.data) {
        this.salesConfig = res.data;
        // Set default tax select if present
        const taxSelect = document.getElementById('pos-tax-rate-select');
        if (taxSelect && res.data.tax_gst_percent !== undefined) {
          taxSelect.value = res.data.tax_gst_percent.toFixed(1);
        }
        const upiLabel = document.getElementById('pos-upi-vpa-label');
        if (upiLabel && res.data.upi_vpa) {
          upiLabel.textContent = res.data.upi_vpa;
        }
      }
    } catch (err) {
      console.error('Error loading sales config:', err);
    }
  },

  async loadCustomers() {
    try {
      const res = await api.getCustomers();
      if (res.success) {
        state.customers = res.data;
        const select = document.getElementById('pos-customer-select');
        if (select) {
          select.innerHTML = '<option value="">Walk-in Retail Customer</option>' +
            res.data.map(c => `
              <option value="${c.id}" data-credit="${c.credit_balance || 0}" data-phone="${c.phone || ''}">
                ${c.name} (${c.type}) ${c.credit_balance > 0 ? `[Udhar: ₹${c.credit_balance}]` : ''}
              </option>
            `).join('');
        }
      }
    } catch (err) {
      console.error('Error loading customers for POS:', err);
    }
  },

  onCustomerChange() {
    const select = document.getElementById('pos-customer-select');
    const opt = select.options[select.selectedIndex];
    const balanceTag = document.getElementById('pos-customer-balance-tag');
    const creditWarn = document.getElementById('pos-credit-warning');

    if (!opt || !opt.value) {
      if (balanceTag) balanceTag.textContent = '';
      if (creditWarn) creditWarn.textContent = '⚠️ Select a registered customer above to record balance in Udhar ledger.';
      return;
    }

    const credit = Number(opt.dataset.credit) || 0;
    if (balanceTag) {
      balanceTag.textContent = credit > 0 ? `Udhar: ₹${credit}` : 'No Outstanding Udhar';
      balanceTag.style.color = credit > 0 ? 'var(--danger)' : 'var(--success)';
    }

    if (creditWarn) {
      creditWarn.innerHTML = `Credit Customer: <strong>${opt.text}</strong><br>Existing Udhar: ₹${credit.toFixed(2)}`;
    }
  },

  async loadPosProducts() {
    try {
      const res = await api.getProducts();
      if (res.success) {
        this.posProducts = res.data;
        this.filterProducts(document.getElementById('pos-product-search')?.value || '');
      }
    } catch (err) {
      console.error('Error loading POS products:', err);
    }
  },

  // -------------------------------------------------------------
  // 6.1 LEFT SECTION: CATEGORIES & QUICK FILTERS
  // -------------------------------------------------------------
  renderCategorySidebar() {
    const container = document.getElementById('pos-category-sidebar-list');
    if (!container) return;

    // Dairy category icons map
    const catIcons = {
      'Milk': '🥛',
      'Curd': '🥣',
      'Buttermilk': '🥤',
      'Paneer': '🧈',
      'Butter': '🧈',
      'Ghee': '🫙',
      'Cheese': '🧀',
      'Cream': '🥛',
      'Flavoured Milk': '🥤',
      'Ice Cream': '🍦',
      'Other Dairy Products': '📦'
    };

    let totalCount = this.posProducts.length;

    let html = `
      <button type="button" class="pos-cat-item ${this.activeCategory === 'all' ? 'active' : ''}" onclick="salesModule.filterByCategory('all')">
        <span style="display:flex; align-items:center; gap:0.5rem;">
          <span>🥛</span>
          <span>All Dairy Items</span>
        </span>
        <span class="pos-cat-count-badge">${totalCount}</span>
      </button>
    `;

    (state.categories || []).forEach(c => {
      const count = this.posProducts.filter(p => p.category_id === c.id).length;
      const icon = catIcons[c.name] || '🧀';
      const isActive = this.activeCategory == c.id ? 'active' : '';

      html += `
        <button type="button" class="pos-cat-item ${isActive}" onclick="salesModule.filterByCategory(${c.id})">
          <span style="display:flex; align-items:center; gap:0.5rem;">
            <span>${icon}</span>
            <span>${c.name}</span>
          </span>
          <span class="pos-cat-count-badge">${count}</span>
        </button>
      `;
    });

    container.innerHTML = html;
  },

  filterByCategory(catId) {
    this.activeCategory = catId;
    this.renderCategorySidebar();

    // Update title
    const titleEl = document.getElementById('pos-middle-title');
    if (titleEl) {
      if (catId === 'all') {
        titleEl.textContent = 'All Dairy Products';
      } else {
        const cat = state.categories.find(c => c.id === catId);
        titleEl.textContent = cat ? cat.name : 'Category Products';
      }
    }

    this.filterProducts(document.getElementById('pos-product-search')?.value || '');
  },

  setStockFilter(type) {
    this.activeStockFilter = type;
    ['all', 'instock', 'low'].forEach(t => {
      const btn = document.getElementById(`pos-stock-filter-${t}`);
      if (btn) btn.classList.toggle('active', (t === 'all' && type === 'all') || (t === 'instock' && type === 'in_stock') || (t === 'low' && type === 'low_stock'));
    });
    this.filterProducts(document.getElementById('pos-product-search')?.value || '');
  },

  onSortChange() {
    this.activeSort = document.getElementById('pos-sort-select')?.value || 'default';
    this.filterProducts(document.getElementById('pos-product-search')?.value || '');
  },

  handleBarcodeScan(barcode) {
    const b = (barcode || '').trim().toLowerCase();
    if (!b) return;

    const matched = this.posProducts.find(p =>
      (p.barcode && p.barcode.toLowerCase() === b) ||
      (p.sku && p.sku.toLowerCase() === b) ||
      (p.name && p.name.toLowerCase() === b)
    );

    if (matched) {
      if (matched.current_stock <= 0) {
        ui.showToast(`Product "${matched.name}" is OUT OF STOCK. Cannot bill.`, 'danger');
      } else {
        this.addToCart(matched.id);
        ui.showToast(`Scanned & added: ${matched.name}`, 'success');
      }
      const input = document.getElementById('pos-barcode-input');
      if (input) input.value = '';
    } else {
      ui.showToast(`No product found for barcode: "${barcode}"`, 'warning');
    }
  },

  // -------------------------------------------------------------
  // 6.1 MIDDLE SECTION: PRODUCT CARDS GRID
  // -------------------------------------------------------------
  filterProducts(query) {
    const q = (query || '').toLowerCase().trim();

    let filtered = this.posProducts.filter(p => {
      // Category filter
      const matchesCat = this.activeCategory === 'all' || p.category_id == this.activeCategory;

      // Search filter
      const matchesQ = !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));

      // Stock status filter
      let matchesStock = true;
      if (this.activeStockFilter === 'in_stock') {
        matchesStock = p.current_stock > 0;
      } else if (this.activeStockFilter === 'low_stock') {
        matchesStock = p.current_stock <= p.min_stock_level && p.current_stock > 0;
      }

      return matchesCat && matchesQ && matchesStock;
    });

    // Sorting
    if (this.activeSort === 'price_asc') {
      filtered.sort((a, b) => a.selling_price - b.selling_price);
    } else if (this.activeSort === 'price_desc') {
      filtered.sort((a, b) => b.selling_price - a.selling_price);
    } else if (this.activeSort === 'stock_desc') {
      filtered.sort((a, b) => b.current_stock - a.current_stock);
    } else if (this.activeSort === 'name_asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Update count label
    const countLabel = document.getElementById('pos-product-count-label');
    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} products available`;
    }

    this.renderProductGrid(filtered);
  },

  renderProductGrid(items) {
    const container = document.getElementById('pos-product-grid-container');
    if (!container) return;

    if (!items || !items.length) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem 1rem; text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-lg);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">No Products Found</div>
          <div style="font-size: 0.85rem;">Try adjusting your search query, barcode scanner or category filter.</div>
        </div>
      `;
      return;
    }

    const catIcons = {
      'Milk': '🥛',
      'Curd': '🥣',
      'Buttermilk': '🥤',
      'Paneer': '🧈',
      'Butter': '🧈',
      'Ghee': '🫙',
      'Cheese': '🧀',
      'Cream': '🥛',
      'Flavoured Milk': '🥤',
      'Ice Cream': '🍦',
      'Other Dairy Products': '📦'
    };

    let html = '';
    items.forEach(p => {
      const isOut = p.current_stock <= 0;
      const isLow = p.current_stock <= p.min_stock_level && p.current_stock > 0;
      const icon = catIcons[p.category_name] || '🧀';

      let stockBadgeHtml = '';
      if (isOut) {
        stockBadgeHtml = `<span class="pos-card-stock-tag" style="color:var(--danger);">❌ Out of Stock</span>`;
      } else if (isLow) {
        stockBadgeHtml = `<span class="pos-card-stock-tag" style="color:var(--warning);">⚠️ Low: ${p.current_stock} ${p.unit}</span>`;
      } else {
        stockBadgeHtml = `<span class="pos-card-stock-tag" style="color:var(--success);">🟢 ${p.current_stock} ${p.unit} in stock</span>`;
      }

      html += `
        <div class="pos-product-card ${isOut ? 'out-of-stock' : ''}" onclick="salesModule.addToCart(${p.id})" title="${isOut ? 'Out of Stock' : 'Click to add to cart'}">
          <div class="pos-card-visual">
            <span class="pos-card-cat-badge">${p.category_name}</span>
            <span>${icon}</span>
          </div>
          <div class="pos-card-body">
            <div class="pos-card-title" title="${p.name}">${p.name}</div>
            <div class="pos-card-sku">${p.sku} • ${p.unit}</div>
            ${stockBadgeHtml}
          </div>
          <div class="pos-card-footer">
            <div class="pos-card-price">${ui.formatCurrency(p.selling_price)}</div>
            <button type="button" class="pos-card-add-btn" onclick="event.stopPropagation(); salesModule.addToCart(${p.id})" ${isOut ? 'disabled title="Out of Stock"' : 'title="Add 1 to cart"'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 6.2 RIGHT SECTION: SHOPPING CART & QUANTITY CONTROLS
  // -------------------------------------------------------------
  addToCart(productId) {
    const prod = this.posProducts.find(p => p.id === productId);
    if (!prod) return;

    if (prod.current_stock <= 0) {
      ui.showToast(`Product "${prod.name}" is OUT OF STOCK.`, 'danger');
      return;
    }

    const existing = state.posCart.find(i => i.product_id === productId);

    // Prevent adding more than available stock
    if (existing) {
      if (existing.quantity + 1 > prod.current_stock) {
        ui.showToast(`Cannot add more: Only ${prod.current_stock} ${prod.unit} of "${prod.name}" available in stock.`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      state.posCart.push({
        product_id: prod.id,
        name: prod.name,
        unit: prod.unit,
        unit_price: prod.selling_price,
        unit_cost: prod.purchase_price,
        max_stock: prod.current_stock,
        quantity: 1
      });
    }

    this.renderCart();
  },

  updateCartQty(productId, delta) {
    const item = state.posCart.find(i => i.product_id === productId);
    if (!item) return;

    const prod = this.posProducts.find(p => p.id === productId);
    const maxAvail = prod ? prod.current_stock : item.max_stock;

    if (delta > 0 && item.quantity + delta > maxAvail) {
      ui.showToast(`Stock limit reached: Only ${maxAvail} ${item.unit} available for "${item.name}".`, 'warning');
      return;
    }

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this.renderCart();
  },

  setCartItemQty(productId, val) {
    const item = state.posCart.find(i => i.product_id === productId);
    if (!item) return;

    const prod = this.posProducts.find(p => p.id === productId);
    const maxAvail = prod ? prod.current_stock : item.max_stock;

    let qty = parseFloat(val);
    if (isNaN(qty) || qty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (qty > maxAvail) {
      ui.showToast(`Adjusted to max available stock (${maxAvail} ${item.unit}).`, 'warning');
      qty = maxAvail;
    }

    item.quantity = qty;
    this.renderCart();
  },

  removeFromCart(productId) {
    state.posCart = state.posCart.filter(i => i.product_id !== productId);
    this.renderCart();
  },

  clearCart() {
    state.posCart = [];
    const discInput = document.getElementById('pos-discount-input');
    if (discInput) discInput.value = '0';
    const cashInput = document.getElementById('pos-cash-tendered');
    if (cashInput) cashInput.value = '';
    this.renderCart();
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items-container');
    const badge = document.getElementById('pos-cart-count-badge');
    if (!container) return;

    const totalCount = state.posCart.reduce((sum, i) => sum + i.quantity, 0);
    if (badge) badge.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

    if (state.posCart.length === 0) {
      container.innerHTML = `
        <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:0.6rem;">
          <div style="font-size: 2.5rem; opacity: 0.6;">🛒</div>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">Cart is Empty</div>
          <div style="font-size: 0.8rem; line-height: 1.4;">Click products or scan barcodes to start billing.</div>
        </div>
      `;
      this.recalculatePosTotals();
      return;
    }

    let html = '';
    state.posCart.forEach(item => {
      const lineTotal = item.quantity * item.unit_price;
      html += `
        <div class="pos-cart-row">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${item.name}
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted);">
              ${ui.formatCurrency(item.unit_price)} / ${item.unit}
            </div>
          </div>
          <div class="pos-cart-stepper">
            <button type="button" class="pos-stepper-btn" onclick="salesModule.updateCartQty(${item.product_id}, -1)">-</button>
            <input type="number" class="pos-stepper-input" value="${item.quantity}" min="0.1" step="1" onchange="salesModule.setCartItemQty(${item.product_id}, this.value)">
            <button type="button" class="pos-stepper-btn" onclick="salesModule.updateCartQty(${item.product_id}, 1)">+</button>
          </div>
          <div style="font-weight:800; font-size:0.9rem; min-width:65px; text-align:right; color:var(--primary-dark);">
            ${ui.formatCurrency(lineTotal)}
          </div>
          <button type="button" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.1rem; line-height:1; padding:2px 4px;" onclick="salesModule.removeFromCart(${item.product_id})" title="Remove item">
            &times;
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
    this.recalculatePosTotals();
  },

  // -------------------------------------------------------------
  // 6.2 CALCULATIONS, DISCOUNTS & TAXES
  // -------------------------------------------------------------
  recalculatePosTotals() {
    let subtotal = 0;
    state.posCart.forEach(i => {
      subtotal += i.quantity * i.unit_price;
    });

    const discType = document.getElementById('pos-discount-type')?.value || 'flat';
    const discInputVal = Number(document.getElementById('pos-discount-input')?.value) || 0;

    let discountAmount = 0;
    if (discType === 'percent') {
      const pct = Math.min(100, Math.max(0, discInputVal));
      discountAmount = Number(((subtotal * pct) / 100).toFixed(2));
    } else {
      discountAmount = Math.min(subtotal, Math.max(0, discInputVal));
    }

    const discDisplay = document.getElementById('pos-discount-val-display');
    if (discDisplay) {
      discDisplay.textContent = `-${ui.formatCurrency(discountAmount)}`;
    }

    const taxRate = parseFloat(document.getElementById('pos-tax-rate-select')?.value) || 0;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
    const grandTotal = Number((taxableAmount + taxAmount).toFixed(2));

    const subtotalEl = document.getElementById('pos-subtotal');
    const taxEl = document.getElementById('pos-tax-amount');
    const totalEl = document.getElementById('pos-grand-total');

    if (subtotalEl) subtotalEl.textContent = ui.formatCurrency(subtotal);
    if (taxEl) taxEl.textContent = `+${ui.formatCurrency(taxAmount)}`;
    if (totalEl) totalEl.textContent = ui.formatCurrency(grandTotal);

    this.calcCashChange();

    const checkoutBtn = document.getElementById('pos-checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.disabled = state.posCart.length === 0 || this.isSubmittingCheckout;
    }
  },

  // -------------------------------------------------------------
  // 6.3 PAYMENT METHODS SUPPORT
  // -------------------------------------------------------------
  selectPaymentMethod(method) {
    this.activePaymentMethod = method;

    ['Cash', 'UPI', 'Card', 'Customer Credit'].forEach(m => {
      const btnId = m === 'Cash' ? 'btn-pay-cash' : (m === 'UPI' ? 'btn-pay-upi' : (m === 'Card' ? 'btn-pay-card' : 'btn-pay-credit'));
      const btn = document.getElementById(btnId);
      if (btn) btn.classList.toggle('active', m === method);
    });

    const label = document.getElementById('pos-payment-mode-label');
    if (label) label.textContent = method;

    // Show/hide relevant subpanels
    const cashPanel = document.getElementById('pos-pay-panel-cash');
    const upiPanel = document.getElementById('pos-pay-panel-upi');
    const cardPanel = document.getElementById('pos-pay-panel-card');
    const creditPanel = document.getElementById('pos-pay-panel-credit');

    if (cashPanel) cashPanel.style.display = (method === 'Cash') ? 'block' : 'none';
    if (upiPanel) upiPanel.style.display = (method === 'UPI') ? 'block' : 'none';
    if (cardPanel) cardPanel.style.display = (method === 'Card') ? 'block' : 'none';
    if (creditPanel) creditPanel.style.display = (method === 'Customer Credit') ? 'block' : 'none';

    if (method === 'Cash') {
      this.calcCashChange();
    }
  },

  calcCashChange() {
    const cashInput = document.getElementById('pos-cash-tendered');
    const changeDisplay = document.getElementById('pos-change-due');
    if (!cashInput || !changeDisplay) return;

    let subtotal = 0;
    state.posCart.forEach(i => subtotal += i.quantity * i.unit_price);
    const discType = document.getElementById('pos-discount-type')?.value || 'flat';
    const discInputVal = Number(document.getElementById('pos-discount-input')?.value) || 0;
    const discount = discType === 'percent' ? (subtotal * discInputVal) / 100 : discInputVal;
    const taxRate = parseFloat(document.getElementById('pos-tax-rate-select')?.value) || 0;
    const tax = Math.max(0, subtotal - discount) * (taxRate / 100);
    const net = Math.max(0, subtotal - discount + tax);

    const tendered = parseFloat(cashInput.value);
    if (!isNaN(tendered) && tendered >= net) {
      const change = tendered - net;
      changeDisplay.textContent = ui.formatCurrency(change);
      changeDisplay.style.color = 'var(--success)';
    } else {
      changeDisplay.textContent = '₹0.00';
      changeDisplay.style.color = 'var(--text-muted)';
    }
  },

  // -------------------------------------------------------------
  // 6.6 ATOMIC CHECKOUT & INVENTORY DEDUCTION
  // -------------------------------------------------------------
  async processCheckout() {
    if (this.isSubmittingCheckout) return;

    if (state.posCart.length === 0) {
      ui.showToast('Shopping cart is empty. Please add items to bill.', 'warning');
      return;
    }

    const customerId = document.getElementById('pos-customer-select')?.value;
    const paymentMethod = this.activePaymentMethod;

    // Validate Customer Credit (Udhar)
    if (paymentMethod === 'Customer Credit' && !customerId) {
      ui.showToast('Please select a registered customer to record a Credit (Udhar) sale.', 'warning');
      return;
    }

    // Prevent overselling: validate cart on server
    try {
      const valRes = await api.validateCart({
        items: state.posCart,
        branch_id: state.currentBranchId
      });
      if (!valRes.success) {
        ui.showToast(valRes.error || 'Cart items no longer available in stock.', 'danger');
        await this.loadPosProducts();
        return;
      }
    } catch (e) {
      // Continue to checkout transaction which strictly rolls back on oversell
    }

    let subtotal = 0;
    state.posCart.forEach(i => subtotal += i.quantity * i.unit_price);
    const discType = document.getElementById('pos-discount-type')?.value || 'flat';
    const discInputVal = Number(document.getElementById('pos-discount-input')?.value) || 0;
    const discount = discType === 'percent' ? Number(((subtotal * discInputVal) / 100).toFixed(2)) : Number(discInputVal.toFixed(2));
    const taxRate = parseFloat(document.getElementById('pos-tax-rate-select')?.value) || 0;
    const tax = Number((Math.max(0, subtotal - discount) * (taxRate / 100)).toFixed(2));

    let paymentRef = null;
    let paymentDetails = null;

    if (paymentMethod === 'UPI') {
      paymentRef = document.getElementById('pos-upi-ref')?.value.trim() || 'UPI-APP-SCAN';
    } else if (paymentMethod === 'Card') {
      const last4 = document.getElementById('pos-card-last4')?.value.trim() || '0000';
      const auth = document.getElementById('pos-card-auth')?.value.trim() || '';
      paymentRef = `Card **** ${last4}`;
      paymentDetails = auth ? `Auth: ${auth}` : null;
    } else if (paymentMethod === 'Cash') {
      const tendered = document.getElementById('pos-cash-tendered')?.value;
      if (tendered) paymentDetails = `Cash Tendered: ₹${tendered}`;
    }

    const payload = {
      customer_id: customerId ? Number(customerId) : null,
      branch_id: Number(state.currentBranchId) || 1,
      items: state.posCart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price
      })),
      discount_amount: discount,
      tax_amount: tax,
      payment_method: paymentMethod,
      payment_ref: paymentRef,
      payment_details: paymentDetails,
      cashier_name: state.currentUser ? state.currentUser.name : 'Counter Staff',
      notes: `POS Counter sale via ${paymentMethod}`
    };

    // Lock button to prevent duplicate submissions
    this.isSubmittingCheckout = true;
    const checkoutBtn = document.getElementById('pos-checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = `
        <span class="loading-spinner" style="width:16px; height:16px; border:2px solid #FFF; border-top-color:transparent; border-radius:50%; display:inline-block; animation:spin 0.6s linear infinite;"></span>
        Processing Transaction...
      `;
    }

    try {
      const res = await api.createSale(payload);

      if (res.success) {
        ui.showToast(`Invoice #${res.invoice_no} completed successfully!`, 'success');
        this.clearCart();

        // Refresh all stock and analytics in background
        await Promise.all([
          this.loadPosProducts(),
          inventoryModule.loadBatches(),
          inventoryModule.loadDashboardSummary(),
          dashboardModule.loadStats()
        ]);

        // Immediately open printable receipt
        await this.viewInvoice(res.sale_id);
      } else {
        ui.showToast(res.error || 'Sale transaction failed. Please check stock.', 'danger');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      ui.showToast(err.message || 'Error completing checkout transaction.', 'danger');
    } finally {
      this.isSubmittingCheckout = false;
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Complete Sale & Print Bill (F2)
        `;
      }
    }
  },

  // -------------------------------------------------------------
  // 6.5 RECEIPT GENERATION & PDF EXPORT
  // -------------------------------------------------------------
  async viewInvoice(saleId) {
    try {
      const res = await api.getSaleDetails(saleId);
      if (!res.success) return;
      const s = res.data;
      this.currentReceiptSale = s;

      const shop = s.shop_details || {};
      const shopName = shop.name || 'DairyTrack Smart Dairy & Creamery';
      const shopGstin = shop.gstin || '07AAAAA0000A1Z5';
      const shopAddress = shop.address || s.branch_address || '124 Milkman Boulevard, Dairy Hub, Sector 4';
      const shopPhone = shop.phone || s.branch_phone || '+91 98765 43210';

      const container = document.getElementById('invoice-modal-content');
      const printableArea = document.getElementById('printable-receipt-area');

      const receiptHtml = `
        <div id="dairytrack-receipt-document" style="font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #111827; background: #FFFFFF; max-width: 420px; margin: 0 auto; padding: 10px;">
          <!-- Shop Header -->
          <div style="text-align: center; border-bottom: 2px dashed #9CA3AF; padding-bottom: 10px; margin-bottom: 10px;">
            <img src="/images/logo.png" alt="DairyTrack Logo" style="height: 52px; max-width: 170px; margin: 0 auto 6px auto; display: block; object-fit: contain;">
            <div style="font-size: 18px; font-weight: 900; letter-spacing: -0.5px; color: #14532D;">
              ${shopName.toUpperCase()}
            </div>
            <div style="font-size: 11px; color: #4B5563; margin-top: 2px;">${shopAddress}</div>
            <div style="font-size: 11px; color: #4B5563;">Ph: ${shopPhone} • GSTIN: ${shopGstin}</div>
            <div style="font-size: 11px; font-weight: 700; color: #16A34A; margin-top: 4px;">*** TAX INVOICE ***</div>
          </div>

          <!-- Invoice Metadata -->
          <div style="font-size: 11px; border-bottom: 1px dashed #9CA3AF; padding-bottom: 6px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span>INVOICE: <strong>${s.invoice_no}</strong></span>
              <span>DATE: ${ui.formatDate(s.sale_date)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>TXN ID: <strong>${s.transaction_id || ('TXN-' + s.id)}</strong></span>
              <span>TIME: ${s.created_at ? s.created_at.slice(11, 16) : 'Counter'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span>CUSTOMER: <strong>${s.customer_name}</strong></span>
              <span>CASHIER: <strong>${s.cashier_name}</strong></span>
            </div>
            ${s.customer_phone ? `<div>PHONE: ${s.customer_phone}</div>` : ''}
          </div>

          <!-- Line Items Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px;">
            <thead>
              <tr style="border-bottom: 1px solid #111827; text-align: left;">
                <th style="padding: 4px 0;">Item Description</th>
                <th style="padding: 4px 0; text-align: center;">Qty</th>
                <th style="padding: 4px 0; text-align: right;">Rate</th>
                <th style="padding: 4px 0; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${s.items.map(it => `
                <tr style="border-bottom: 1px dotted #E5E7EB;">
                  <td style="padding: 5px 0;">
                    <div style="font-weight: 700;">${it.product_name}</div>
                    <div style="font-size: 10px; color: #6B7280;">
                      ${it.batch_number ? `Batch: ${it.batch_number}` : ''} ${it.unit ? `• ${it.unit}` : ''}
                    </div>
                  </td>
                  <td style="padding: 5px 0; text-align: center; font-weight: 700;">${it.quantity}</td>
                  <td style="padding: 5px 0; text-align: right;">₹${it.unit_price.toFixed(2)}</td>
                  <td style="padding: 5px 0; text-align: right; font-weight: 700;">₹${it.total_price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Financial Breakdown -->
          <div style="border-top: 1px dashed #9CA3AF; padding-top: 6px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>Total Items:</span>
              <span>${s.items.reduce((acc, it) => acc + it.quantity, 0)} Units</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>Subtotal:</span>
              <span>₹${s.total_amount.toFixed(2)}</span>
            </div>
            ${s.discount_amount > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #DC2626;">
                <span>Discount Applied:</span>
                <span>-₹${s.discount_amount.toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>Tax / GST:</span>
              <span>₹${s.tax_amount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; border-top: 2px solid #111827; border-bottom: 2px solid #111827; padding: 6px 0; margin: 6px 0;">
              <span>NET PAYABLE:</span>
              <span>₹${s.net_amount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px;">
              <span>PAYMENT MODE:</span>
              <span><strong>${s.payment_method.toUpperCase()} (${s.payment_status.toUpperCase()})</strong></span>
            </div>
            ${s.payment_ref ? `
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
                <span>REF / UTR:</span>
                <span><strong>${s.payment_ref}</strong></span>
              </div>
            ` : ''}
          </div>

          <!-- Footer Guidance -->
          <div style="text-align: center; margin-top: 14px; border-top: 1px dashed #9CA3AF; padding-top: 8px; font-size: 11px; color: #4B5563;">
            Pure Farm Fresh Dairy Products<br>
            Please store milk, paneer & curd chilled at 2°C - 4°C.<br>
            <strong>*** THANK YOU! VISIT AGAIN ***</strong>
          </div>
        </div>
      `;

      if (container) container.innerHTML = receiptHtml;
      if (printableArea) printableArea.innerHTML = receiptHtml;

      ui.openModal('invoice-modal');
    } catch (err) {
      console.error('Error viewing invoice:', err);
    }
  },

  printReceipt() {
    window.print();
  },

  downloadReceiptPdf() {
    if (!this.currentReceiptSale) {
      window.print();
      return;
    }

    const s = this.currentReceiptSale;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const content = document.getElementById('invoice-modal-content')?.innerHTML || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${s.invoice_no}</title>
        <style>
          body { margin: 0; padding: 20px; font-family: monospace; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  },

  // -------------------------------------------------------------
  // PAST SALES INVOICES HISTORY
  // -------------------------------------------------------------
  async showPastSalesHistory() {
    ui.openModal('past-sales-modal');
    await this.loadPastSales();
  },

  async loadPastSales() {
    try {
      ui.renderSkeleton('past-sales-table-body', 6);
      const params = {
        search: document.getElementById('past-sales-search')?.value,
        startDate: document.getElementById('past-sales-start')?.value,
        endDate: document.getElementById('past-sales-end')?.value,
        branchId: state.currentBranchId,
        limit: 50
      };

      const res = await api.getSales(params);
      if (res.success) {
        this.pastSalesList = res.data;
        this.filterPastSales();
      }
    } catch (err) {
      console.error('Error loading past sales:', err);
    }
  },

  filterPastSales() {
    const payFilter = document.getElementById('past-sales-payment')?.value || 'all';
    const search = (document.getElementById('past-sales-search')?.value || '').toLowerCase().trim();

    let filtered = this.pastSalesList.filter(s => {
      const matchesPay = payFilter === 'all' || s.payment_method.toLowerCase().includes(payFilter.toLowerCase());
      const matchesSearch = !search ||
        s.invoice_no.toLowerCase().includes(search) ||
        (s.transaction_id && s.transaction_id.toLowerCase().includes(search)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(search)) ||
        (s.customer_phone && s.customer_phone.includes(search));
      return matchesPay && matchesSearch;
    });

    const tbody = document.getElementById('past-sales-table-body');
    if (!tbody) return;

    if (!filtered || !filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">
            No sales invoices found matching filters.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    filtered.forEach(s => {
      let payBadge = 'badge-success';
      if (s.payment_status === 'Credit') payBadge = 'badge-warning';

      html += `
        <tr>
          <td><strong style="font-family:monospace; color:var(--primary);">${s.invoice_no}</strong></td>
          <td><span style="font-family:monospace; font-size:0.75rem; color:var(--text-muted);">${s.transaction_id || '-'}</span></td>
          <td>${ui.formatDate(s.sale_date)}</td>
          <td>
            <div style="font-weight:600;">${s.customer_name}</div>
            ${s.customer_phone ? `<div style="font-size:0.72rem; color:var(--text-muted);">${s.customer_phone}</div>` : ''}
          </td>
          <td>${s.total_items || 1} items</td>
          <td style="font-weight:800; color:var(--primary-dark);">${ui.formatCurrency(s.net_amount)}</td>
          <td><span class="status-chip ${payBadge}">${s.payment_method}</span></td>
          <td><span style="font-size:0.8rem; color:var(--text-secondary);">${s.cashier_name}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="salesModule.viewInvoice(${s.id})">
              Bill
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }
};
