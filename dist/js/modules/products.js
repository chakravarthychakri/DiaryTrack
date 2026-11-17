// ====================================================================
// MODULE 4: PRODUCT MANAGEMENT CONTROLLER
// ====================================================================

const productsModule = {
  productsList: [],
  categoriesList: [],
  suppliersList: [],
  searchDebounce: null,
  activeDetailProductId: null,

  async init() {
    await Promise.all([
      this.loadCategories(),
      this.loadSuppliers()
    ]);
    await this.loadProducts();
    this.bindEvents();
    this.calculateMargin();
    this.calculateUnitConversion();
  },

  bindEvents() {
    const searchInput = document.getElementById('product-filter-search');
    const catSelect = document.getElementById('product-filter-category');
    const stockSelect = document.getElementById('product-filter-stock');
    const sortSelect = document.getElementById('product-filter-sort');

    if (searchInput) {
      searchInput.oninput = () => {
        clearTimeout(this.searchDebounce);
        this.searchDebounce = setTimeout(() => this.loadProducts(), 250);
      };
    }
    if (catSelect) {
      catSelect.onchange = () => this.loadProducts();
    }
    if (stockSelect) {
      stockSelect.onchange = () => this.loadProducts();
    }
    if (sortSelect) {
      sortSelect.onchange = () => this.loadProducts();
    }
  },

  // -------------------------------------------------------------
  // 4.2: CATEGORIES LOADING & POPULATION
  // -------------------------------------------------------------
  async loadCategories() {
    try {
      const res = await api.getCategories();
      if (res.success) {
        this.categoriesList = res.data;
        state.categories = res.data;

        // Filter dropdown
        const filterCat = document.getElementById('product-filter-category');
        if (filterCat) {
          const currentVal = filterCat.value;
          filterCat.innerHTML = '<option value="all">All Dairy Categories</option>' +
            res.data.map(c => `<option value="${c.id}" ${c.id == currentVal ? 'selected' : ''}>${c.name} (${c.active_product_count || c.product_count || 0})</option>`).join('');
        }

        // Form category select
        const formCat = document.getElementById('product-form-category');
        if (formCat) {
          formCat.innerHTML = res.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        // Render in Category Management list
        this.renderCategoryList();
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  },

  // -------------------------------------------------------------
  // SUPPLIERS LOADING
  // -------------------------------------------------------------
  async loadSuppliers() {
    try {
      const res = await api.getSuppliers();
      if (res.success) {
        this.suppliersList = res.data;
        state.suppliers = res.data;

        const formSupp = document.getElementById('product-form-supplier');
        if (formSupp) {
          formSupp.innerHTML = '<option value="">-- Choose Default Supplier --</option>' +
            res.data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  },

  // -------------------------------------------------------------
  // 4.1 & 4.4: LOAD & RENDER PRODUCTS WITH FILTERS & SORT
  // -------------------------------------------------------------
  async loadProducts() {
    const tbody = document.getElementById('products-table-body');
    if (!tbody) return;

    try {
      ui.renderSkeleton('products-table-body', 6);

      const search = document.getElementById('product-filter-search')?.value || '';
      const categoryId = document.getElementById('product-filter-category')?.value || 'all';
      const status = document.getElementById('product-filter-stock')?.value || 'all';
      const sortBy = document.getElementById('product-filter-sort')?.value || 'name_asc';

      const res = await api.getProducts({
        search,
        categoryId,
        status,
        sortBy
      });

      if (!res.success) throw new Error(res.error);

      this.productsList = res.data || [];
      state.products = this.productsList;
      this.renderTable(this.productsList);

    } catch (err) {
      console.error('Failed to load products:', err);
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding: 2.5rem; color: var(--danger);">
            Failed to load dairy products: ${err.message}
          </td>
        </tr>
      `;
    }
  },

  getCategoryIcon(catName) {
    const map = {
      'Milk': '🥛',
      'Curd': '🥣',
      'Buttermilk': '🥤',
      'Paneer': '🧀',
      'Butter': '🧈',
      'Ghee': '🫙',
      'Cheese': '🧀',
      'Cream': '🥛',
      'Flavoured Milk': '🧃',
      'Ice Cream': '🍦',
      'Other Dairy Products': '📦'
    };
    return map[catName] || '🥛';
  },

  renderTable(items) {
    const tbody = document.getElementById('products-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding: 3rem; color: var(--text-muted);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🥛</div>
            <div style="font-weight:700; color:var(--text-primary);">No products match your criteria</div>
            <div style="font-size:0.8rem; margin-top:0.25rem;">Try adjusting search keywords, category filters, or add a new product.</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(p => {
      // Stock Status Chip
      let stockBadgeClass = 'badge-success';
      let stockLabel = 'In Stock';
      if (p.current_stock <= 0) {
        stockBadgeClass = 'badge-danger';
        stockLabel = 'Out of Stock';
      } else if (p.current_stock <= p.min_stock_level) {
        stockBadgeClass = 'badge-warning';
        stockLabel = 'Low Stock';
      }

      // Status Badge
      let statusClass = 'badge-success';
      let statusText = p.status || 'Active';
      if (statusText === 'Inactive') {
        statusClass = 'badge-warning';
      } else if (statusText === 'Discontinued' || p.is_active === 0) {
        statusClass = 'badge-danger';
        statusText = 'Discontinued';
      }

      // Margin Chip
      let marginClass = 'margin-mid';
      if (p.margin_percent >= 25) marginClass = 'margin-high';
      else if (p.margin_percent <= 10) marginClass = 'margin-low';

      // Visual Thumbnail or Icon Box
      const defaultIcon = this.getCategoryIcon(p.category_name);
      let thumbHtml = `<div class="prod-icon-box">${defaultIcon}</div>`;
      if (p.image_url && p.image_url.startsWith('http')) {
        thumbHtml = `
          <div class="prod-thumb">
            <img src="${p.image_url}" alt="${p.name}" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'font-size:1.4rem;\\'>${defaultIcon}</span>';">
          </div>
        `;
      } else if (p.image_url && p.image_url.length <= 4) {
        thumbHtml = `<div class="prod-icon-box">${p.image_url}</div>`;
      }

      html += `
        <tr>
          <!-- Product Name & Description -->
          <td>
            <div class="prod-cell">
              ${thumbHtml}
              <div>
                <a href="javascript:void(0)" onclick="productsModule.viewDetails(${p.id})" style="font-weight:700; color:var(--text-primary); text-decoration:none; font-size:0.9rem;">
                  ${p.name}
                </a>
                <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.2; margin-top:2px;">
                  ${p.description || 'Pure farm dairy product'}
                </div>
              </div>
            </div>
          </td>

          <!-- Category -->
          <td>
            <span class="status-chip badge-info" style="font-weight:600;">
              ${p.category_name || 'Dairy'}
            </span>
          </td>

          <!-- SKU / Barcode -->
          <td>
            <code style="font-size:0.8rem; background:var(--bg-subtle); padding:2px 6px; border-radius:4px; font-weight:700;">${p.sku}</code>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">
              ${p.barcode ? `Barcode: ${p.barcode}` : 'No Barcode'}
            </div>
          </td>

          <!-- Unit -->
          <td style="font-weight:600; color:var(--text-primary);">${p.unit}</td>

          <!-- Purchase Price -->
          <td style="font-weight:500;">${ui.formatCurrency(p.purchase_price)}</td>

          <!-- Selling MRP & Margin -->
          <td>
            <div style="font-weight:800; color:var(--primary-dark); font-size:0.95rem;">
              ${ui.formatCurrency(p.selling_price)}
            </div>
            <span class="margin-chip ${marginClass}">
              +${ui.formatCurrency(p.margin_amount)} (${p.margin_percent}%)
            </span>
          </td>

          <!-- Current Stock -->
          <td>
            <div style="font-weight:800; font-size:1rem; color:var(--text-primary);">
              ${p.current_stock} <span style="font-size:0.75rem; font-weight:500; color:var(--text-secondary);">${p.unit}</span>
            </div>
            <span class="status-chip ${stockBadgeClass}" style="margin-top:2px;">
              ${stockLabel} (min ${p.min_stock_level})
            </span>
          </td>

          <!-- Preferred Supplier -->
          <td>
            <div style="font-weight:600; font-size:0.825rem; color:var(--text-primary);">${p.supplier_name || 'Direct Farmers'}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${p.supplier_phone || ''}</div>
          </td>

          <!-- Status -->
          <td>
            <span class="status-chip ${statusClass}">${statusText}</span>
          </td>

          <!-- Actions -->
          <td style="text-align: right;">
            <div style="display:inline-flex; gap:0.35rem; align-items:center;">
              <!-- View Details -->
              <button class="btn btn-sm btn-secondary" onclick="productsModule.viewDetails(${p.id})" title="View Product Details, Batches & History" style="padding:0.35rem 0.55rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>

              <!-- Edit (Admin & Manager) -->
              <button class="btn btn-sm btn-secondary" onclick="productsModule.editProduct(${p.id})" title="Edit Product" style="padding:0.35rem 0.55rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>

              <!-- Deactivate / Delete (Admin Only) -->
              <button class="btn btn-sm btn-outline-danger" onclick="productsModule.deleteOrDeactivate(${p.id})" title="Deactivate or Delete Product" style="padding:0.35rem 0.55rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 4.4: VIEW PRODUCT DETAILS (COMPREHENSIVE MODAL)
  // -------------------------------------------------------------
  async viewDetails(id) {
    this.activeDetailProductId = id;
    try {
      const res = await api.getProductDetails(id);
      if (!res.success) throw new Error(res.error);
      const p = res.data;

      // Populate Header
      document.getElementById('detail-prod-name').textContent = p.name;
      document.getElementById('detail-prod-category').textContent = p.category_name || 'Dairy';
      document.getElementById('detail-prod-sku').textContent = `SKU: ${p.sku}`;

      const statusChip = document.getElementById('detail-prod-status-chip');
      statusChip.textContent = p.status || 'Active';
      statusChip.className = `status-chip badge-${(p.status === 'Discontinued' || p.is_active === 0) ? 'danger' : (p.status === 'Inactive' ? 'warning' : 'success')}`;

      // Thumbnail
      const defaultIcon = this.getCategoryIcon(p.category_name);
      const imgBox = document.getElementById('detail-prod-image-box');
      if (p.image_url && p.image_url.startsWith('http')) {
        imgBox.innerHTML = `<img src="${p.image_url}" alt="${p.name}" onerror="this.onerror=null; this.parentElement.textContent='${defaultIcon}';">`;
      } else {
        imgBox.textContent = p.image_url || defaultIcon;
      }

      // Key Metrics
      document.getElementById('detail-stat-stock').textContent = `${p.current_stock} ${p.unit}`;
      document.getElementById('detail-stat-valuation').textContent = `Valuation: ${ui.formatCurrency(p.stock_valuation)}`;

      document.getElementById('detail-stat-pricing').textContent = `${ui.formatCurrency(p.purchase_price)} / ${ui.formatCurrency(p.selling_price)}`;
      document.getElementById('detail-stat-margin').textContent = `+${ui.formatCurrency(p.margin_amount)} (${p.margin_percent}% margin)`;

      document.getElementById('detail-stat-sold').textContent = `${p.sales_stats?.total_units_sold || 0} ${p.unit}`;
      document.getElementById('detail-stat-revenue').textContent = `Revenue: ${ui.formatCurrency(p.sales_stats?.total_revenue || 0)}`;

      document.getElementById('detail-stat-supplier').textContent = p.supplier_name || 'Direct Farmers';
      document.getElementById('detail-stat-supplier-contact').textContent = p.supplier_phone || 'Direct Sourcing';

      // Populate Tab 1: Active Batches
      const batchBody = document.getElementById('detail-batches-table-body');
      if (p.batches && p.batches.length) {
        batchBody.innerHTML = p.batches.map(b => {
          const isUrgent = b.days_until_expiry <= 2;
          const isExpired = b.days_until_expiry < 0;
          let expiryColor = 'var(--text-primary)';
          if (isExpired) expiryColor = 'var(--danger)';
          else if (isUrgent) expiryColor = 'var(--warning)';

          return `
            <tr>
              <td><strong style="color:var(--primary);">${b.batch_number}</strong></td>
              <td>${b.branch_name}</td>
              <td>${ui.formatDate(b.mfg_date)}</td>
              <td style="color:${expiryColor}; font-weight:700;">${ui.formatDate(b.expiry_date)}</td>
              <td>
                <span class="status-chip badge-${isExpired ? 'danger' : (isUrgent ? 'warning' : 'success')}">
                  ${isExpired ? `Expired ${Math.abs(b.days_until_expiry)}d ago` : `${b.days_until_expiry} days left`}
                </span>
              </td>
              <td style="font-weight:800;">${b.current_quantity} ${p.unit}</td>
              <td style="font-weight:600;">${ui.formatCurrency(b.batch_valuation)}</td>
            </tr>
          `;
        }).join('');
      } else {
        batchBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No active inventory batches available for this product.</td></tr>';
      }

      // Reset Tabs to Active Batches
      this.switchDetailTab('batches');

      app.openModal('product-details-modal');

    } catch (err) {
      console.error('Failed to open product details:', err);
      ui.showToast('Could not load product details: ' + err.message, 'error');
    }
  },

  async switchDetailTab(tabName) {
    document.querySelectorAll('#prod-detail-tabs .modal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.prod-tab-content').forEach(c => c.style.display = 'none');
    const activeContent = document.getElementById(`detail-tab-${tabName}`);
    if (activeContent) activeContent.style.display = 'block';

    if (!this.activeDetailProductId) return;

    // Load sales history if tab clicked
    if (tabName === 'sales') {
      const salesBody = document.getElementById('detail-sales-table-body');
      salesBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem;">Loading sales history...</td></tr>';
      try {
        const res = await api.getProductSalesHistory(this.activeDetailProductId);
        if (res.success && res.data.length) {
          salesBody.innerHTML = res.data.map(s => `
            <tr>
              <td><strong style="color:var(--primary);">${s.invoice_no}</strong></td>
              <td>${ui.formatDate(s.sale_date)}</td>
              <td>${s.customer_name}</td>
              <td style="font-weight:700;">${s.quantity} ${s.unit}</td>
              <td>${ui.formatCurrency(s.unit_price)}</td>
              <td style="font-weight:700; color:var(--primary-dark);">${ui.formatCurrency(s.total_price)}</td>
              <td style="font-weight:700; color:var(--success);">+${ui.formatCurrency(s.profit)}</td>
              <td><span class="status-chip badge-${s.payment_status === 'Paid' ? 'success' : 'warning'}">${s.payment_method}</span></td>
            </tr>
          `).join('');
        } else {
          salesBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No sales recorded for this product yet.</td></tr>';
        }
      } catch (e) {
        salesBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--danger);">${e.message}</td></tr>`;
      }
    }

    // Load purchase history if tab clicked
    if (tabName === 'purchases') {
      const purchBody = document.getElementById('detail-purchases-table-body');
      purchBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem;">Loading purchase orders...</td></tr>';
      try {
        const res = await api.getProductPurchaseHistory(this.activeDetailProductId);
        if (res.success && res.data.length) {
          purchBody.innerHTML = res.data.map(p => `
            <tr>
              <td><strong style="color:var(--text-primary);">${p.invoice_no}</strong></td>
              <td>${ui.formatDate(p.purchase_date)}</td>
              <td>${p.supplier_name}</td>
              <td><code>${p.batch_number}</code></td>
              <td style="font-weight:700;">${p.quantity} ${p.unit}</td>
              <td>${ui.formatCurrency(p.unit_cost)}</td>
              <td style="font-weight:700;">${ui.formatCurrency(p.total_cost)}</td>
              <td><span class="status-chip badge-${p.payment_status === 'Paid' ? 'success' : 'warning'}">${p.payment_status}</span></td>
            </tr>
          `).join('');
        } else {
          purchBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No procurement orders recorded for this product.</td></tr>';
        }
      } catch (e) {
        purchBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--danger);">${e.message}</td></tr>`;
      }
    }
  },

  // -------------------------------------------------------------
  // 4.1: ADD / EDIT PRODUCT MODAL HANDLERS
  // -------------------------------------------------------------
  openNewModal() {
    document.getElementById('product-modal-title').textContent = 'Add New Dairy Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-form-id').value = '';

    // Auto-generate suggested SKU
    const rand = Math.floor(100 + Math.random() * 900);
    document.getElementById('product-form-sku').value = `PRD-${Date.now().toString().slice(-4)}-${rand}`;
    document.getElementById('product-form-status').value = 'Active';
    document.getElementById('product-form-min').value = '10';
    document.getElementById('product-form-shelf').value = '3';
    document.getElementById('product-form-temp').value = '2°C - 4°C';

    this.calculateMargin();
    app.openModal('product-modal');
  },

  editProduct(id) {
    const p = this.productsList.find(x => x.id === id);
    if (!p) return;

    document.getElementById('product-modal-title').textContent = 'Edit Product: ' + p.name;
    document.getElementById('product-form-id').value = p.id;
    document.getElementById('product-form-name').value = p.name;
    document.getElementById('product-form-category').value = p.category_id;
    document.getElementById('product-form-sku').value = p.sku;
    document.getElementById('product-form-barcode').value = p.barcode || '';
    document.getElementById('product-form-unit').value = p.unit;
    document.getElementById('product-form-cost').value = p.purchase_price;
    document.getElementById('product-form-price').value = p.selling_price;
    document.getElementById('product-form-min').value = p.min_stock_level;
    document.getElementById('product-form-shelf').value = p.shelf_life_days;
    document.getElementById('product-form-temp').value = p.storage_temperature || '2°C - 4°C';
    document.getElementById('product-form-supplier').value = p.supplier_id || '';
    document.getElementById('product-form-status').value = p.status || (p.is_active ? 'Active' : 'Inactive');
    document.getElementById('product-form-image').value = p.image_url || '';
    document.getElementById('product-form-desc').value = p.description || '';

    this.calculateMargin();
    app.openModal('product-modal');
  },

  calculateMargin() {
    const cost = parseFloat(document.getElementById('product-form-cost')?.value || '0');
    const price = parseFloat(document.getElementById('product-form-price')?.value || '0');
    const previewEl = document.getElementById('product-form-margin-preview');
    if (!previewEl) return;

    const marginAmt = price - cost;
    const marginPct = price > 0 ? ((marginAmt / price) * 100).toFixed(1) : 0;

    let color = 'var(--text-secondary)';
    if (marginPct >= 20) color = 'var(--success)';
    else if (marginPct > 0) color = 'var(--primary)';
    else if (marginPct < 0) color = 'var(--danger)';

    previewEl.style.color = color;
    previewEl.textContent = `${ui.formatCurrency(marginAmt)} (${marginPct}%)`;
  },

  selectImagePreset(presetVal) {
    if (!presetVal) return;
    document.getElementById('product-form-image').value = presetVal;
  },

  async submitForm(e) {
    e.preventDefault();
    const id = document.getElementById('product-form-id').value;

    const payload = {
      name: document.getElementById('product-form-name').value.trim(),
      category_id: document.getElementById('product-form-category').value,
      sku: document.getElementById('product-form-sku').value.trim().toUpperCase(),
      barcode: document.getElementById('product-form-barcode').value.trim(),
      unit: document.getElementById('product-form-unit').value,
      purchase_price: parseFloat(document.getElementById('product-form-cost').value || '0'),
      selling_price: parseFloat(document.getElementById('product-form-price').value || '0'),
      min_stock_level: parseFloat(document.getElementById('product-form-min').value || '10'),
      shelf_life_days: parseInt(document.getElementById('product-form-shelf').value || '3', 10),
      storage_temperature: document.getElementById('product-form-temp').value.trim(),
      supplier_id: document.getElementById('product-form-supplier').value || null,
      status: document.getElementById('product-form-status').value,
      image_url: document.getElementById('product-form-image').value.trim(),
      description: document.getElementById('product-form-desc').value.trim()
    };

    try {
      if (id) {
        const res = await api.updateProduct(id, payload);
        if (!res.success) throw new Error(res.error);
        ui.showToast('Product updated successfully!', 'success');
      } else {
        const res = await api.createProduct(payload);
        if (!res.success) throw new Error(res.error);
        ui.showToast('New dairy product added to catalog!', 'success');
      }

      app.closeModal('product-modal');
      await this.loadProducts();
      await this.loadCategories();
      dashboardModule.loadStats();

    } catch (err) {
      console.error('Error saving product:', err);
      ui.showToast(err.message || 'Failed to save product record', 'error');
    }
  },

  // -------------------------------------------------------------
  // 4.4: DELETE OR DEACTIVATE PRODUCT WITH HISTORY SAFETY
  // -------------------------------------------------------------
  async deleteOrDeactivate(id) {
    const p = this.productsList.find(x => x.id === id);
    const prodName = p ? p.name : `Product #${id}`;

    if (!confirm(`Are you sure you want to remove or deactivate "${prodName}"?\n\nIf this product has existing sales or purchase transaction history, it will be safely marked as "Discontinued" to preserve accounting records.`)) {
      return;
    }

    try {
      const res = await api.deleteProduct(id);
      if (!res.success) throw new Error(res.error);

      if (res.softDeleted) {
        ui.showToast(res.message, 'warning');
      } else {
        ui.showToast(res.message, 'success');
      }

      await this.loadProducts();
      await this.loadCategories();
      dashboardModule.loadStats();

    } catch (err) {
      console.error('Error in product deletion:', err);
      ui.showToast(err.message || 'Failed to delete product', 'error');
    }
  },

  // -------------------------------------------------------------
  // 4.2: CATEGORY MANAGEMENT MODAL & CRUD
  // -------------------------------------------------------------
  openCategoryModal() {
    this.resetCategoryForm();
    this.renderCategoryList();
    app.openModal('category-modal');
  },

  renderCategoryList() {
    const container = document.getElementById('category-list-container');
    if (!container) return;

    if (!this.categoriesList || !this.categoriesList.length) {
      container.innerHTML = '<div style="padding:1.5rem; text-align:center; color:var(--text-muted);">No categories defined.</div>';
      return;
    }

    container.innerHTML = this.categoriesList.map(c => `
      <div class="category-item-row">
        <div>
          <strong style="color:var(--text-primary); font-size:0.875rem;">${c.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${c.description || 'Dairy category'}</div>
        </div>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span class="status-chip badge-info">${c.active_product_count || c.product_count || 0} Products</span>
          <button class="btn btn-sm btn-secondary" onclick="productsModule.editCategory(${c.id})" style="padding:0.25rem 0.5rem;" title="Edit Category">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="productsModule.deleteCategory(${c.id})" style="padding:0.25rem 0.5rem;" title="Delete Category">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `).join('');
  },

  editCategory(id) {
    const c = this.categoriesList.find(x => x.id === id);
    if (!c) return;

    document.getElementById('category-form-title').textContent = `Edit Category: ${c.name}`;
    document.getElementById('category-form-id').value = c.id;
    document.getElementById('category-form-name').value = c.name;
    document.getElementById('category-form-icon').value = c.icon || 'milk';
    document.getElementById('category-form-desc').value = c.description || '';

    document.getElementById('category-cancel-edit-btn').style.display = 'inline-flex';
    document.getElementById('category-submit-btn').textContent = 'Update Category';
  },

  resetCategoryForm() {
    document.getElementById('category-form-title').textContent = 'Add New Category';
    document.getElementById('category-form').reset();
    document.getElementById('category-form-id').value = '';
    document.getElementById('category-cancel-edit-btn').style.display = 'none';
    document.getElementById('category-submit-btn').textContent = 'Save Category';
  },

  async submitCategoryForm(e) {
    e.preventDefault();
    const id = document.getElementById('category-form-id').value;
    const name = document.getElementById('category-form-name').value.trim();
    const icon = document.getElementById('category-form-icon').value.trim();
    const description = document.getElementById('category-form-desc').value.trim();

    try {
      if (id) {
        const res = await api.updateCategory(id, { name, icon, description });
        if (!res.success) throw new Error(res.error);
        ui.showToast('Category updated successfully!', 'success');
      } else {
        const res = await api.createCategory({ name, icon, description });
        if (!res.success) throw new Error(res.error);
        ui.showToast(`Category "${name}" created!`, 'success');
      }

      this.resetCategoryForm();
      await this.loadCategories();
      await this.loadProducts();

    } catch (err) {
      console.error('Error saving category:', err);
      ui.showToast(err.message || 'Failed to save category', 'error');
    }
  },

  async deleteCategory(id) {
    const c = this.categoriesList.find(x => x.id === id);
    if (!confirm(`Are you sure you want to delete category "${c ? c.name : id}"?`)) return;

    try {
      const res = await api.deleteCategory(id);
      if (!res.success) throw new Error(res.error);
      ui.showToast('Category deleted successfully.', 'info');
      await this.loadCategories();
      await this.loadProducts();
    } catch (err) {
      console.error('Error deleting category:', err);
      ui.showToast(err.message || 'Cannot delete category', 'error');
    }
  },

  // -------------------------------------------------------------
  // 4.3: UNIT CONVERTER CALCULATOR TOOL
  // -------------------------------------------------------------
  openUnitConverterModal() {
    this.calculateUnitConversion();
    app.openModal('unit-converter-modal');
  },

  calculateUnitConversion() {
    const qty = parseFloat(document.getElementById('unit-conv-qty')?.value || '1');
    const fromUnit = document.getElementById('unit-conv-from')?.value || 'Litres';
    const toUnit = document.getElementById('unit-conv-to')?.value || 'Millilitres';

    const resultBox = document.getElementById('unit-conv-result-box');
    const resultText = document.getElementById('unit-conv-result-text');
    const dimTag = document.getElementById('unit-conv-dimension-tag');
    if (!resultText) return;

    const unitDefinitions = {
      'Litres': { dimension: 'volume', factor: 1000, label: 'Litres', symbol: 'L' },
      'Millilitres': { dimension: 'volume', factor: 1, label: 'Millilitres', symbol: 'ml' },
      'Kilograms': { dimension: 'weight', factor: 1000, label: 'Kilograms', symbol: 'kg' },
      'Grams': { dimension: 'weight', factor: 1, label: 'Grams', symbol: 'g' },
      'Pieces': { dimension: 'count', factor: 1, label: 'Pieces', symbol: 'pcs' },
      'Packets': { dimension: 'count', factor: 1, label: 'Packets', symbol: 'pkt' },
      'Bottles': { dimension: 'count', factor: 1, label: 'Bottles', symbol: 'btl' }
    };

    const from = unitDefinitions[fromUnit];
    const to = unitDefinitions[toUnit];

    if (!from || !to) return;

    if (from.dimension !== to.dimension) {
      resultBox.style.background = 'var(--danger-light)';
      resultBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      resultText.style.color = 'var(--danger)';
      resultText.innerHTML = `⚠️ Incompatible Units: ${fromUnit} &rarr; ${toUnit}`;
      dimTag.textContent = `Rule 4.3: Never combine incompatible dimensions! (${from.dimension.toUpperCase()} cannot convert to ${to.dimension.toUpperCase()})`;
      return;
    }

    // Compatible conversion
    resultBox.style.background = 'var(--primary-light)';
    resultBox.style.borderColor = 'rgba(22, 163, 74, 0.2)';
    resultText.style.color = 'var(--primary-dark)';

    const baseVal = qty * from.factor;
    const converted = baseVal / to.factor;

    resultText.textContent = `${qty} ${fromUnit} = ${converted.toFixed(converted % 1 === 0 ? 0 : 3)} ${toUnit}`;
    dimTag.textContent = `Dimension: ${from.dimension.toUpperCase()} (Standard Ratio: 1 ${from.dimension === 'volume' ? 'Litre = 1000 ml' : (from.dimension === 'weight' ? 'Kilogram = 1000 g' : 'Discrete Units')})`;
  }
};
