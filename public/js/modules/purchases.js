// ====================================================================
// MODULE 7: PURCHASES AND PROCUREMENT FRONTEND CONTROLLER
// ====================================================================

const purchasesModule = {
  purchasesList: [],
  supplierReturnsList: [],
  currentTab: 'all', // 'all', 'Received', 'Draft', 'Cancelled', 'returns'
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  },
  filters: {
    search: '',
    supplier_id: 'all',
    payment_status: 'all',
    startDate: '',
    endDate: ''
  },
  currentDetailsPO: null,
  activeBatchesCache: [],
  debounceTimer: null,

  async init() {
    this.populateSupplierFilter();
    await Promise.all([
      this.loadStats(),
      this.loadPurchases()
    ]);
  },

  populateSupplierFilter() {
    const sel = document.getElementById('po-filter-supplier');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All Dairy Suppliers</option>' +
      state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  },

  async loadStats() {
    try {
      const res = await api.getPurchaseStats({ branchId: state.currentBranchId });
      if (res && res.success) {
        const d = res.data;
        // Update 4 KPI Cards
        const spendEl = document.getElementById('po-stat-total-spend');
        if (spendEl) spendEl.textContent = ui.formatCurrency(d.total_procurement_spend);

        const ordersEl = document.getElementById('po-stat-total-orders');
        if (ordersEl) ordersEl.textContent = d.total_orders;

        const ordersSubEl = document.getElementById('po-stat-orders-sub');
        if (ordersSubEl) ordersSubEl.textContent = `${d.received_orders} received shipments`;

        const draftEl = document.getElementById('po-stat-draft-orders');
        if (draftEl) draftEl.textContent = d.draft_orders;

        const payablesEl = document.getElementById('po-stat-payables');
        if (payablesEl) payablesEl.textContent = ui.formatCurrency(d.total_supplier_payables);

        // Update Tab Badges
        const tabAll = document.getElementById('po-tab-count-all');
        if (tabAll) tabAll.textContent = d.total_orders;

        const tabRec = document.getElementById('po-tab-count-received');
        if (tabRec) tabRec.textContent = d.received_orders;

        const tabDraft = document.getElementById('po-tab-count-draft');
        if (tabDraft) tabDraft.textContent = d.draft_orders;

        const tabCanc = document.getElementById('po-tab-count-cancelled');
        if (tabCanc) tabCanc.textContent = d.cancelled_orders;

        const tabRet = document.getElementById('po-tab-count-returns');
        if (tabRet) tabRet.textContent = d.total_supplier_returns_count;
      }
    } catch (err) {
      console.error('Error loading purchase stats:', err);
    }
  },

  async loadPurchases() {
    try {
      ui.renderSkeleton('purchases-table-body', 6);

      const params = {
        page: this.pagination.page,
        limit: this.pagination.limit,
        search: this.filters.search,
        supplier_id: this.filters.supplier_id,
        payment_status: this.filters.payment_status,
        startDate: this.filters.startDate,
        endDate: this.filters.endDate,
        branch_id: state.currentBranchId
      };

      if (this.currentTab !== 'all' && this.currentTab !== 'returns') {
        params.status = this.currentTab;
      }

      const res = await api.getPurchases(params);
      if (res && res.success) {
        this.purchasesList = res.data;
        if (res.pagination) {
          this.pagination = res.pagination;
        }
        this.renderTable(res.data);
        this.renderPagination();
      }
    } catch (err) {
      console.error('Error loading purchases:', err);
      ui.showToast('Failed to load purchase records', 'danger');
    }
  },

  setTab(tabName) {
    this.currentTab = tabName;

    // Toggle tab active button
    document.querySelectorAll('.po-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const ordersPane = document.getElementById('po-pane-orders');
    const returnsPane = document.getElementById('po-pane-returns');

    if (tabName === 'returns') {
      if (ordersPane) ordersPane.style.display = 'none';
      if (returnsPane) returnsPane.style.display = 'block';
      this.loadSupplierReturns();
    } else {
      if (ordersPane) ordersPane.style.display = 'block';
      if (returnsPane) returnsPane.style.display = 'none';
      this.pagination.page = 1;
      this.loadPurchases();
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('purchases-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:0.5rem;">📦</div>
            <div style="font-weight:700; font-size:1rem; color:var(--text-secondary);">No purchase orders found</div>
            <div style="font-size:0.8rem; margin-top:4px;">Try adjusting your filters or create a new purchase order above.</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(p => {
      // Payment badge
      let payBadge = 'badge-success';
      if (p.payment_status === 'Unpaid') payBadge = 'badge-danger';
      else if (p.payment_status === 'Partial') payBadge = 'badge-warning';

      // Order status badge
      let statusBadge = 'badge-received';
      let statusIcon = '✅';
      if (p.status === 'Draft') {
        statusBadge = 'badge-draft';
        statusIcon = '📝';
      } else if (p.status === 'Cancelled') {
        statusBadge = 'badge-danger';
        statusIcon = '❌';
      }

      // Action buttons depending on status
      let actionButtons = `
        <button class="btn btn-sm btn-secondary" onclick="purchasesModule.openDetailsModal(${p.id})" title="View PO Details & Line Items">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
      `;

      if (p.status === 'Draft') {
        actionButtons += `
          <button class="btn btn-sm btn-primary" onclick="purchasesModule.confirmReceive(${p.id}, '${p.invoice_no}')" title="Confirm Reception & Stock In" style="background:var(--primary); padding:0.25rem 0.5rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="purchasesModule.openEditModal(${p.id})" title="Edit Draft Order">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="purchasesModule.cancelPO(${p.id}, '${p.invoice_no}')" title="Cancel Draft Order" style="color:var(--danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
          </button>
        `;
      } else if (p.status === 'Received') {
        actionButtons += `
          <button class="btn btn-sm btn-secondary" onclick="purchasesModule.openReturnForPO(${p.id})" title="Record Supplier Return" style="color:#7E22CE;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          </button>
        `;
      }

      html += `
        <tr>
          <td>
            <div style="font-weight:700; font-family:monospace; color:var(--primary-dark); font-size:0.875rem;">${p.invoice_no}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">PO ID: #${p.id}</div>
          </td>
          <td>
            <div style="font-weight:600; font-size:0.85rem;">${ui.formatDate(p.purchase_date)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${p.payment_method || 'Bank Transfer'}</div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-primary); font-size:0.875rem;">${p.supplier_name}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${p.supplier_phone || '-'}</div>
          </td>
          <td>
            <span style="font-size:0.825rem; font-weight:600;">${p.branch_name || 'Main Dairy Plant'}</span>
          </td>
          <td>
            <div style="font-weight:700; font-size:0.85rem;">${p.item_count || 1} Products</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${p.total_quantity || 0} Units total</div>
          </td>
          <td>
            <div style="font-weight:800; color:var(--text-primary); font-size:0.95rem;">${ui.formatCurrency(p.net_amount)}</div>
            ${p.discount_amount > 0 ? `<div style="font-size:0.7rem; color:var(--success);">Disc: -₹${Number(p.discount_amount).toFixed(2)}</div>` : ''}
          </td>
          <td>
            <span class="status-chip ${payBadge}">${p.payment_status}</span>
          </td>
          <td>
            <span class="status-chip ${statusBadge}">${statusIcon} ${p.status}</span>
          </td>
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:0.35rem;">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderPagination() {
    const { page, total, limit, totalPages } = this.pagination;
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    const infoEl = document.getElementById('po-pagination-info');
    if (infoEl) infoEl.textContent = `Showing ${start} to ${end} of ${total} purchases`;

    const indicatorEl = document.getElementById('po-page-indicator');
    if (indicatorEl) indicatorEl.textContent = `Page ${page} of ${totalPages || 1}`;

    const prevBtn = document.getElementById('po-prev-btn');
    if (prevBtn) prevBtn.disabled = (page <= 1);

    const nextBtn = document.getElementById('po-next-btn');
    if (nextBtn) nextBtn.disabled = (page >= totalPages);
  },

  prevPage() {
    if (this.pagination.page > 1) {
      this.pagination.page--;
      this.loadPurchases();
    }
  },

  nextPage() {
    if (this.pagination.page < this.pagination.totalPages) {
      this.pagination.page++;
      this.loadPurchases();
    }
  },

  debounceFilter() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.applyFilters();
    }, 300);
  },

  applyFilters() {
    this.filters.search = (document.getElementById('po-filter-search')?.value || '').trim();
    this.filters.supplier_id = document.getElementById('po-filter-supplier')?.value || 'all';
    this.filters.payment_status = document.getElementById('po-filter-payment')?.value || 'all';
    this.filters.startDate = document.getElementById('po-filter-start')?.value || '';
    this.filters.endDate = document.getElementById('po-filter-end')?.value || '';

    this.pagination.page = 1;
    this.loadPurchases();
  },

  resetFilters() {
    const sInput = document.getElementById('po-filter-search');
    if (sInput) sInput.value = '';
    const suppSel = document.getElementById('po-filter-supplier');
    if (suppSel) suppSel.value = 'all';
    const paySel = document.getElementById('po-filter-payment');
    if (paySel) paySel.value = 'all';
    const startInput = document.getElementById('po-filter-start');
    if (startInput) startInput.value = '';
    const endInput = document.getElementById('po-filter-end');
    if (endInput) endInput.value = '';

    this.filters = {
      search: '',
      supplier_id: 'all',
      payment_status: 'all',
      startDate: '',
      endDate: ''
    };
    this.pagination.page = 1;
    this.loadPurchases();
  },

  // -------------------------------------------------------------
  // SUPPLIER RETURNS LISTING
  // -------------------------------------------------------------
  async loadSupplierReturns() {
    try {
      ui.renderSkeleton('supplier-returns-table-body', 4);
      const res = await api.getSupplierReturns();
      if (res && res.success) {
        this.supplierReturnsList = res.data;
        this.renderSupplierReturnsTable(res.data);
      }
    } catch (err) {
      console.error('Error loading returns:', err);
    }
  },

  renderSupplierReturnsTable(items) {
    const tbody = document.getElementById('supplier-returns-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align:center; padding:3rem; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:0.5rem;">↩️</div>
            <div style="font-weight:700; color:var(--text-secondary);">No supplier returns recorded</div>
            <div style="font-size:0.8rem; margin-top:4px;">Defective, sour, or leaking goods returned to vendors will be listed here.</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(r => {
      html += `
        <tr>
          <td>
            <div style="font-weight:700; font-family:monospace; color:var(--danger);">${r.return_no}</div>
          </td>
          <td>${ui.formatDate(r.return_date)}</td>
          <td>
            <span style="font-family:monospace; font-weight:600;">${r.purchase_invoice_no || 'Direct Return'}</span>
          </td>
          <td>
            <div style="font-weight:700;">${r.supplier_name}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${r.supplier_phone || '-'}</div>
          </td>
          <td>
            <div style="font-weight:600;">${r.product_name}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${r.product_sku || ''}</div>
          </td>
          <td>
            <code style="font-size:0.75rem;">${r.batch_number || '-'}</code>
          </td>
          <td>
            <span style="font-weight:700; color:var(--danger);">${r.quantity} ${r.product_unit || 'Units'}</span>
          </td>
          <td>
            <span style="font-weight:800; color:var(--danger);">${ui.formatCurrency(r.total_return_value)}</span>
          </td>
          <td>
            <span class="status-chip badge-purple">${r.refund_type}</span>
          </td>
          <td>
            <span style="font-size:0.8rem; color:var(--text-secondary);">${r.reason}</span>
          </td>
          <td>
            <span style="font-size:0.8rem; color:var(--text-muted);">${r.returned_by || 'Admin'}</span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // CREATE & EDIT MODAL
  // -------------------------------------------------------------
  openNewModal() {
    document.getElementById('po-modal-title').textContent = 'New Purchase Order & Stock Intake';
    document.getElementById('po-edit-id').value = '';
    document.getElementById('purchase-form').reset();

    // Populate suppliers and branches
    const suppSelect = document.getElementById('po-supplier');
    const branchSelect = document.getElementById('po-branch');

    if (suppSelect) {
      suppSelect.innerHTML = '<option value="">-- Select Dairy Supplier / Co-op * --</option>' +
        state.suppliers.map(s => `<option value="${s.id}">${s.name} (Due: ₹${Number(s.balance_due).toFixed(2)})</option>`).join('');
    }
    if (branchSelect) {
      branchSelect.innerHTML = state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    document.getElementById('po-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('po-invoice-no').value = '';
    document.getElementById('po-tax-amount').value = '0.00';
    document.getElementById('po-discount-amount').value = '0.00';
    document.getElementById('po-order-status').value = 'Received';
    document.getElementById('po-order-status').disabled = false;
    this.onStatusChange();

    // Clear and add first item row
    const container = document.getElementById('po-items-container');
    container.innerHTML = '';
    this.addItemRow();
    this.calcTotals();

    ui.openModal('purchase-modal');
  },

  async openEditModal(id) {
    try {
      const res = await api.getPurchaseDetails(id);
      if (!res || !res.success) {
        ui.showToast('Could not load purchase details for editing', 'danger');
        return;
      }
      const p = res.data;

      if (p.status !== 'Draft') {
        ui.showToast(`Cannot edit: PO is already '${p.status}'. Only Draft POs can be edited.`, 'warning');
        return;
      }

      document.getElementById('po-modal-title').textContent = `Edit Draft Purchase Order #${p.invoice_no}`;
      document.getElementById('po-edit-id').value = p.id;

      // Populate selects
      const suppSelect = document.getElementById('po-supplier');
      const branchSelect = document.getElementById('po-branch');

      if (suppSelect) {
        suppSelect.innerHTML = state.suppliers.map(s => `<option value="${s.id}" ${s.id === p.supplier_id ? 'selected' : ''}>${s.name} (Due: ₹${Number(s.balance_due).toFixed(2)})</option>`).join('');
      }
      if (branchSelect) {
        branchSelect.innerHTML = state.branches.map(b => `<option value="${b.id}" ${b.id === p.branch_id ? 'selected' : ''}>${b.name}</option>`).join('');
      }

      document.getElementById('po-date').value = p.purchase_date;
      document.getElementById('po-invoice-no').value = p.invoice_no;
      document.getElementById('po-tax-amount').value = Number(p.tax_amount || 0).toFixed(2);
      document.getElementById('po-discount-amount').value = Number(p.discount_amount || 0).toFixed(2);
      document.getElementById('po-payment-status').value = p.payment_status || 'Paid';
      document.getElementById('po-payment-method').value = p.payment_method || 'Bank Transfer';
      document.getElementById('po-notes').value = p.notes || '';

      const statusSel = document.getElementById('po-order-status');
      statusSel.value = 'Draft';
      statusSel.disabled = true; // Once draft, edit stays draft; use Confirm Receipt to receive

      // Rebuild items
      const container = document.getElementById('po-items-container');
      container.innerHTML = '';
      if (p.items && p.items.length) {
        p.items.forEach(it => {
          this.addItemRow(it);
        });
      } else {
        this.addItemRow();
      }

      this.calcTotals();
      ui.openModal('purchase-modal');
    } catch (err) {
      console.error('Error opening edit modal:', err);
    }
  },

  addItemRow(data = null) {
    const container = document.getElementById('po-items-container');
    if (!container) return;

    const rowId = 'po-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const div = document.createElement('div');
    div.className = 'po-item-row-card';
    div.id = rowId;

    const productOptions = state.products.map(p =>
      `<option value="${p.id}" data-cost="${p.purchase_price}" data-shelf="${p.shelf_life_days}" ${data && data.product_id === p.id ? 'selected' : ''}>${p.name} (${p.unit})</option>`
    ).join('');

    const defaultMfg = data ? data.mfg_date : new Date().toISOString().split('T')[0];
    const defaultBatch = data ? data.batch_number : `BAT-${Date.now().toString().slice(-4)}`;
    const defaultQty = data ? data.quantity : 50;
    const defaultCost = data ? data.unit_cost : (state.products[0]?.purchase_price || 40);

    // Initial expiry calc
    let defaultExpiry = data ? data.expiry_date : '';
    if (!defaultExpiry) {
      const expD = new Date();
      expD.setDate(expD.getDate() + (state.products[0]?.shelf_life_days || 3));
      defaultExpiry = expD.toISOString().split('T')[0];
    }

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
        <span style="font-weight:700; font-size:0.78rem; color:var(--primary-dark);">📦 Shipment Item</span>
        <button type="button" style="background:none; border:none; color:var(--danger); cursor:pointer; font-weight:700; font-size:0.75rem;" onclick="purchasesModule.removeItemRow('${rowId}')">
          &times; Remove Item
        </button>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2;">
          <label class="form-label" style="font-size:0.72rem;">Product *</label>
          <select class="form-control po-item-product" required onchange="purchasesModule.onItemProductChange(this, '${rowId}')">
            <option value="">-- Choose Dairy Product --</option>
            ${productOptions}
          </select>
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label" style="font-size:0.72rem;">Batch Number *</label>
          <input type="text" class="form-control po-item-batch" value="${defaultBatch}" required>
        </div>
      </div>
      <div class="form-row" style="margin-top:0.35rem;">
        <div class="form-group" style="flex:1;">
          <label class="form-label" style="font-size:0.72rem;">Mfg Date</label>
          <input type="date" class="form-control po-item-mfg" value="${defaultMfg}" onchange="purchasesModule.onItemMfgChange('${rowId}')">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label" style="font-size:0.72rem;">Expiry Date *</label>
          <input type="date" class="form-control po-item-expiry" value="${defaultExpiry}" required>
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label" style="font-size:0.72rem;">Quantity *</label>
          <input type="number" step="0.5" class="form-control po-item-qty" value="${defaultQty}" required min="0.5" oninput="purchasesModule.calcTotals()">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label" style="font-size:0.72rem;">Cost / Unit (₹) *</label>
          <input type="number" step="0.01" class="form-control po-item-cost" value="${defaultCost}" required min="0" oninput="purchasesModule.calcTotals()">
        </div>
      </div>
    `;

    container.appendChild(div);
  },

  removeItemRow(rowId) {
    const el = document.getElementById(rowId);
    if (el) el.remove();
    this.calcTotals();
  },

  onItemProductChange(selectEl, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt || !opt.value) return;

    const shelf = Number(opt.dataset.shelf) || 3;
    const cost = Number(opt.dataset.cost) || 0;

    const mfgVal = row.querySelector('.po-item-mfg').value;
    const mfgDate = mfgVal ? new Date(mfgVal) : new Date();
    const expDate = new Date(mfgDate);
    expDate.setDate(expDate.getDate() + shelf);

    row.querySelector('.po-item-expiry').value = expDate.toISOString().split('T')[0];
    row.querySelector('.po-item-cost').value = cost.toFixed(2);

    this.calcTotals();
  },

  onItemMfgChange(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const prodSelect = row.querySelector('.po-item-product');
    const opt = prodSelect?.options[prodSelect.selectedIndex];
    const shelf = Number(opt?.dataset.shelf) || 3;

    const mfgVal = row.querySelector('.po-item-mfg').value;
    if (mfgVal) {
      const expDate = new Date(mfgVal);
      expDate.setDate(expDate.getDate() + shelf);
      row.querySelector('.po-item-expiry').value = expDate.toISOString().split('T')[0];
    }
  },

  calcTotals() {
    const rows = document.querySelectorAll('#po-items-container .po-item-row-card');
    let subtotal = 0;

    rows.forEach(r => {
      const qty = Number(r.querySelector('.po-item-qty')?.value) || 0;
      const cost = Number(r.querySelector('.po-item-cost')?.value) || 0;
      subtotal += (qty * cost);
    });

    const tax = Number(document.getElementById('po-tax-amount')?.value) || 0;
    const discount = Number(document.getElementById('po-discount-amount')?.value) || 0;
    const net = Math.max(0, subtotal + tax - discount);

    const subEl = document.getElementById('po-subtotal-display');
    if (subEl) subEl.textContent = `Items Subtotal: ₹${subtotal.toFixed(2)}`;

    const netEl = document.getElementById('po-net-total-display');
    if (netEl) netEl.textContent = `₹${net.toFixed(2)}`;
  },

  onStatusChange() {
    const st = document.getElementById('po-order-status').value;
    const notice = document.getElementById('po-status-notice');
    const btn = document.getElementById('po-submit-btn');

    if (st === 'Received') {
      if (notice) {
        notice.innerHTML = 'ℹ️ <strong>Received Status:</strong> Stock inventory will immediately increase and active perishable batches will be created under FEFO rules.';
        notice.style.borderLeftColor = 'var(--primary)';
      }
      if (btn) btn.textContent = 'Save Purchase & Activate Batches';
    } else {
      if (notice) {
        notice.innerHTML = '📝 <strong>Draft Status:</strong> Purchase Order is created for future intake. <strong>Stock will NOT be increased</strong> until confirmed as received.';
        notice.style.borderLeftColor = 'var(--warning)';
      }
      if (btn) btn.textContent = 'Save Draft Purchase Order';
    }
  },

  submitForm(e) {
    return this.submitPurchase(e);
  },

  async submitPurchase(e) {
    if (e && e.preventDefault) e.preventDefault();

    const editId = document.getElementById('po-edit-id').value;
    const supplierId = document.getElementById('po-supplier').value;
    const branchId = document.getElementById('po-branch').value;
    const purchaseDate = document.getElementById('po-date').value;
    const invoiceNo = document.getElementById('po-invoice-no').value;
    const orderStatus = document.getElementById('po-order-status').value;
    const taxAmount = Number(document.getElementById('po-tax-amount').value) || 0;
    const discountAmount = Number(document.getElementById('po-discount-amount').value) || 0;
    const paymentStatus = document.getElementById('po-payment-status').value;
    const paymentMethod = document.getElementById('po-payment-method').value;
    const notes = document.getElementById('po-notes').value;

    const rows = document.querySelectorAll('#po-items-container .po-item-row-card');
    if (!rows || rows.length === 0) {
      ui.showToast('Please add at least one line item to the order.', 'warning');
      return;
    }

    const items = [];
    rows.forEach(r => {
      const prodId = r.querySelector('.po-item-product').value;
      const bNum = r.querySelector('.po-item-batch').value;
      const mDate = r.querySelector('.po-item-mfg').value;
      const eDate = r.querySelector('.po-item-expiry').value;
      const qty = Number(r.querySelector('.po-item-qty').value);
      const cost = Number(r.querySelector('.po-item-cost').value);

      if (prodId && qty > 0 && cost >= 0) {
        items.push({
          product_id: Number(prodId),
          batch_number: bNum,
          mfg_date: mDate,
          expiry_date: eDate,
          quantity: qty,
          unit_cost: cost
        });
      }
    });

    if (items.length === 0) {
      ui.showToast('Please ensure all items have valid products, quantities and costs.', 'warning');
      return;
    }

    const payload = {
      supplier_id: Number(supplierId),
      branch_id: Number(branchId),
      purchase_date: purchaseDate,
      invoice_no: invoiceNo,
      status: orderStatus,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      notes,
      items
    };

    try {
      let res;
      if (editId) {
        res = await api.updatePurchase(editId, payload);
      } else {
        res = await api.createPurchase(payload);
      }

      if (res && res.success) {
        ui.showToast(res.message || 'Purchase order processed successfully!', 'success');
        ui.closeModal('purchase-modal');

        // Refresh all connected modules
        await Promise.all([
          this.loadStats(),
          this.loadPurchases(),
          inventoryModule.loadDashboardStats(),
          inventoryModule.loadBatches(),
          productsModule.loadProducts(),
          suppliersModule.loadSuppliers(),
          dashboardModule.loadStats()
        ]);
      } else {
        ui.showToast(res?.error || 'Failed to save purchase order', 'danger');
      }
    } catch (err) {
      console.error('Error submitting purchase:', err);
      ui.showToast(err.message || 'Server error saving purchase', 'danger');
    }
  },

  // -------------------------------------------------------------
  // VIEW PURCHASE DETAILS MODAL
  // -------------------------------------------------------------
  async openDetailsModal(id) {
    try {
      const res = await api.getPurchaseDetails(id);
      if (!res || !res.success) {
        ui.showToast('Could not load purchase details', 'danger');
        return;
      }

      const p = res.data;
      this.currentDetailsPO = p;

      document.getElementById('po-view-inv').textContent = p.invoice_no;
      document.getElementById('po-view-date').textContent = ui.formatDate(p.purchase_date);

      // Status chip
      const statusChip = document.getElementById('po-view-status-chip');
      statusChip.className = 'status-chip';
      if (p.status === 'Received') {
        statusChip.classList.add('badge-received');
        statusChip.textContent = '✅ Received (Stock In)';
      } else if (p.status === 'Draft') {
        statusChip.classList.add('badge-draft');
        statusChip.textContent = '📝 Draft (Pending Delivery)';
      } else {
        statusChip.classList.add('badge-danger');
        statusChip.textContent = '❌ Cancelled';
      }

      // Payment chip
      const payChip = document.getElementById('po-view-pay-chip');
      payChip.className = 'status-chip';
      if (p.payment_status === 'Paid') {
        payChip.classList.add('badge-success');
      } else if (p.payment_status === 'Partial') {
        payChip.classList.add('badge-warning');
      } else {
        payChip.classList.add('badge-danger');
      }
      payChip.textContent = p.payment_status;

      // Stats
      document.getElementById('po-view-gross').textContent = ui.formatCurrency(p.total_amount);
      document.getElementById('po-view-tax-disc').textContent = `+₹${Number(p.tax_amount || 0).toFixed(2)} / -₹${Number(p.discount_amount || 0).toFixed(2)}`;
      document.getElementById('po-view-net').textContent = ui.formatCurrency(p.net_amount);
      document.getElementById('po-view-item-count').textContent = `${p.items ? p.items.length : 0} Products`;

      // Supplier details
      document.getElementById('po-view-supp-name').textContent = p.supplier_name;
      document.getElementById('po-view-supp-phone').textContent = `Phone: ${p.supplier_phone || '-'} | Contact: ${p.supplier_contact || '-'}`;
      document.getElementById('po-view-supp-gst').textContent = `GSTIN: ${p.supplier_gst || 'Unregistered'} | Terms: Net 15`;
      document.getElementById('po-view-supp-balance').textContent = `Supplier Balance Due: ₹${Number(p.supplier_balance_due || 0).toFixed(2)}`;

      // Warehouse info
      document.getElementById('po-view-branch').textContent = p.branch_name || 'Main Cold Hub';
      document.getElementById('po-view-created-by').textContent = p.created_by || 'Administrator';
      document.getElementById('po-view-received-at').textContent = p.received_at ? ui.formatDate(p.received_at) : (p.status === 'Draft' ? 'Awaiting Physical Reception' : 'Completed');
      document.getElementById('po-view-method').textContent = `${p.payment_method} ${p.notes ? '• ' + p.notes : ''}`;

      // Line items table
      const itemsBody = document.getElementById('po-view-items-body');
      let itemsHtml = '';
      if (p.items && p.items.length) {
        p.items.forEach(it => {
          let batchStatusTag = '<span class="status-chip badge-warning">Pending Reception</span>';
          if (p.status === 'Received') {
            batchStatusTag = `<span class="status-chip badge-success">Active (${it.batch_current_quantity ?? it.quantity} left)</span>`;
          } else if (p.status === 'Cancelled') {
            batchStatusTag = '<span class="status-chip badge-gray">Cancelled</span>';
          }

          itemsHtml += `
            <tr>
              <td>
                <div style="font-weight:700;">${it.product_name}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">${it.product_sku || '-'}</div>
              </td>
              <td><code style="font-weight:700;">${it.batch_number}</code></td>
              <td>${ui.formatDate(it.mfg_date)}</td>
              <td><strong>${ui.formatDate(it.expiry_date)}</strong></td>
              <td><span style="font-weight:700;">${it.quantity} ${it.product_unit || 'Units'}</span></td>
              <td>${ui.formatCurrency(it.unit_cost)}</td>
              <td style="font-weight:700;">${ui.formatCurrency(it.total_cost)}</td>
              <td>${batchStatusTag}</td>
            </tr>
          `;
        });
      } else {
        itemsHtml = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No line items found.</td></tr>';
      }
      itemsBody.innerHTML = itemsHtml;

      // Returns section (if any)
      const returnsSec = document.getElementById('po-view-returns-section');
      const returnsBody = document.getElementById('po-view-returns-body');
      if (p.returns && p.returns.length > 0) {
        returnsSec.style.display = 'block';
        let retHtml = '';
        p.returns.forEach(r => {
          retHtml += `
            <tr>
              <td><code style="color:var(--danger); font-weight:700;">${r.return_no}</code></td>
              <td>${ui.formatDate(r.return_date)}</td>
              <td>${r.product_name} (${r.batch_number || ''})</td>
              <td><strong>${r.quantity} ${r.product_unit || 'Units'}</strong></td>
              <td style="color:var(--danger); font-weight:700;">${ui.formatCurrency(r.total_return_value)}</td>
              <td>${r.reason}</td>
              <td><span class="status-chip badge-purple">${r.refund_type}</span></td>
            </tr>
          `;
        });
        returnsBody.innerHTML = retHtml;
      } else {
        returnsSec.style.display = 'none';
      }

      // Action Buttons
      const actionsContainer = document.getElementById('po-view-action-buttons');
      let actHtml = `
        <button class="btn btn-secondary" onclick="purchasesModule.printPoInvoice(${p.id})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print PO Receipt
        </button>
      `;

      if (p.status === 'Draft') {
        actHtml += `
          <button class="btn btn-danger btn-sm" onclick="purchasesModule.cancelPO(${p.id}, '${p.invoice_no}')">
            Cancel Order
          </button>
          <button class="btn btn-secondary btn-sm" onclick="app.closeModal('purchase-details-modal'); purchasesModule.openEditModal(${p.id});">
            Edit Draft
          </button>
          <button class="btn btn-primary" onclick="purchasesModule.confirmReceive(${p.id}, '${p.invoice_no}')" style="background:var(--primary);">
            Confirm Reception & Stock In
          </button>
        `;
      } else if (p.status === 'Received') {
        actHtml += `
          <button class="btn btn-secondary" onclick="purchasesModule.openReturnForPO(${p.id})" style="color:var(--danger); border-color:#FCA5A5;">
            ↩️ Record Supplier Return
          </button>
        `;
      }

      actionsContainer.innerHTML = actHtml;

      ui.openModal('purchase-details-modal');
    } catch (err) {
      console.error('Error opening details modal:', err);
    }
  },

  // -------------------------------------------------------------
  // CONFIRM RECEPTION & CANCEL OPERATIONS
  // -------------------------------------------------------------
  async confirmReceive(id, invNo) {
    if (!confirm(`Confirm arrival of shipment for Purchase Order #${invNo}?\n\nThis will immediately increment on-hand inventory, create active batches, and record incoming stock movements.`)) {
      return;
    }

    try {
      const res = await api.receivePurchase(id);
      if (res && res.success) {
        ui.showToast(res.message || 'Shipment received and batches activated!', 'success');
        ui.closeModal('purchase-details-modal');
        await Promise.all([
          this.loadStats(),
          this.loadPurchases(),
          inventoryModule.loadDashboardStats(),
          inventoryModule.loadBatches(),
          productsModule.loadProducts(),
          suppliersModule.loadSuppliers(),
          dashboardModule.loadStats()
        ]);
      } else {
        ui.showToast(res?.error || 'Failed to receive purchase order', 'danger');
      }
    } catch (err) {
      console.error('Error confirming receipt:', err);
      ui.showToast(err.message || 'Server error processing receipt', 'danger');
    }
  },

  async cancelPO(id, invNo) {
    const reason = prompt(`Reason for cancelling Purchase Order #${invNo}:`, 'Vendor unable to supply');
    if (reason === null) return;

    try {
      const res = await api.cancelPurchase(id, { reason });
      if (res && res.success) {
        ui.showToast(res.message || `Purchase order #${invNo} cancelled.`, 'success');
        ui.closeModal('purchase-details-modal');
        await Promise.all([
          this.loadStats(),
          this.loadPurchases()
        ]);
      } else {
        ui.showToast(res?.error || 'Failed to cancel purchase order', 'danger');
      }
    } catch (err) {
      console.error('Error cancelling purchase:', err);
      ui.showToast(err.message || 'Server error cancelling order', 'danger');
    }
  },

  // -------------------------------------------------------------
  // SUPPLIER RETURNS OPERATION
  // -------------------------------------------------------------
  async openSupplierReturnModal(preselectedPurchaseId = null) {
    const poInput = document.getElementById('ret-purchase-id');
    if (poInput) poInput.value = preselectedPurchaseId || '';
    document.getElementById('supplier-return-form')?.reset();
    document.getElementById('ret-date').value = new Date().toISOString().split('T')[0];

    // Populate suppliers
    const suppSelect = document.getElementById('ret-supplier');
    if (suppSelect) {
      suppSelect.innerHTML = '<option value="">-- Choose Dairy Supplier * --</option>' +
        state.suppliers.map(s => `<option value="${s.id}">${s.name} (Due: ₹${Number(s.balance_due).toFixed(2)})</option>`).join('');
    }

    // Load active batches cache
    try {
      const bRes = await api.getBatches({ branchId: state.currentBranchId });
      if (bRes && bRes.success) {
        this.activeBatchesCache = bRes.data.filter(b => b.current_quantity > 0);
      }
    } catch (e) {
      console.error('Error caching batches:', e);
    }

    this.onReturnSupplierChange();
    ui.openModal('supplier-return-modal');
  },

  openReturnForPO(purchaseId) {
    ui.closeModal('purchase-details-modal');
    this.openSupplierReturnModal(purchaseId);
  },

  onReturnSupplierChange() {
    const suppId = Number(document.getElementById('ret-supplier')?.value);
    const batchSelect = document.getElementById('ret-batch');
    if (!batchSelect) return;

    // Filter batches matching supplier if known, or all active batches
    let matchingBatches = this.activeBatchesCache;
    if (suppId) {
      const filtered = this.activeBatchesCache.filter(b => b.supplier_id === suppId);
      if (filtered.length > 0) matchingBatches = filtered;
    }

    if (!matchingBatches.length) {
      batchSelect.innerHTML = '<option value="">-- No Active Batches with Stock Available --</option>';
      document.getElementById('ret-batch-info-box').style.display = 'none';
      return;
    }

    batchSelect.innerHTML = '<option value="">-- Select Active Batch to Deduct & Return * --</option>' +
      matchingBatches.map(b => `<option value="${b.id}" data-cost="${b.purchase_cost}" data-qty="${b.current_quantity}" data-prod="${b.product_name}" data-unit="${b.unit || ''}">
        ${b.product_name} • Batch ${b.batch_number} (${b.current_quantity} ${b.unit || 'units'} available, Cost: ₹${b.purchase_cost})
      </option>`).join('');

    this.onReturnBatchChange();
  },

  onReturnBatchChange() {
    const batchSelect = document.getElementById('ret-batch');
    const opt = batchSelect?.options[batchSelect.selectedIndex];
    const infoBox = document.getElementById('ret-batch-info-box');

    if (!opt || !opt.value) {
      if (infoBox) infoBox.style.display = 'none';
      document.getElementById('ret-unit-cost').value = '0.00';
      document.getElementById('ret-value-display').textContent = '₹0.00';
      return;
    }

    const availableQty = Number(opt.dataset.qty) || 0;
    const unitCost = Number(opt.dataset.cost) || 0;
    const prodName = opt.dataset.prod;
    const unit = opt.dataset.unit;

    document.getElementById('ret-unit-cost').value = unitCost.toFixed(2);
    const qtyInput = document.getElementById('ret-qty');
    qtyInput.max = availableQty;
    qtyInput.value = Math.min(10, availableQty);

    if (infoBox) {
      infoBox.style.display = 'block';
      infoBox.innerHTML = `
        <strong>Selected:</strong> ${prodName} | Available On-Hand: <strong>${availableQty} ${unit}</strong> | Unit Cost: ₹${unitCost.toFixed(2)}
      `;
    }

    this.calcReturnValue();
  },

  calcReturnValue() {
    const qty = Number(document.getElementById('ret-qty')?.value) || 0;
    const cost = Number(document.getElementById('ret-unit-cost')?.value) || 0;
    const total = qty * cost;
    const disp = document.getElementById('ret-value-display');
    if (disp) disp.textContent = `₹${total.toFixed(2)}`;
  },

  async submitSupplierReturn(e) {
    e.preventDefault();

    const poId = document.getElementById('ret-purchase-id').value;
    const batchId = document.getElementById('ret-batch').value;
    const quantity = Number(document.getElementById('ret-qty').value);
    const refundType = document.getElementById('ret-settlement').value;
    const reason = document.getElementById('ret-reason').value;
    const notes = document.getElementById('ret-notes').value;

    if (!batchId || !quantity || quantity <= 0) {
      ui.showToast('Please select a batch and valid return quantity.', 'warning');
      return;
    }

    const payload = {
      batch_id: Number(batchId),
      quantity,
      refund_type: refundType,
      reason,
      notes
    };

    try {
      const res = await api.returnPurchase(poId || 0, payload);
      if (res && res.success) {
        ui.showToast(res.message || 'Supplier return recorded and stock deducted!', 'success');
        ui.closeModal('supplier-return-modal');

        // Refresh all records
        await Promise.all([
          this.loadStats(),
          this.loadPurchases(),
          this.loadSupplierReturns(),
          inventoryModule.loadDashboardStats(),
          inventoryModule.loadBatches(),
          suppliersModule.loadSuppliers()
        ]);
      } else {
        ui.showToast(res?.error || 'Failed to record supplier return', 'danger');
      }
    } catch (err) {
      console.error('Error submitting return:', err);
      ui.showToast(err.message || 'Server error recording supplier return', 'danger');
    }
  },

  // -------------------------------------------------------------
  // EXCEL REPORT DOWNLOAD & THERMAL PO RECEIPT
  // -------------------------------------------------------------
  downloadExcelReport() {
    const params = new URLSearchParams();
    if (this.currentTab !== 'all' && this.currentTab !== 'returns') {
      params.append('status', this.currentTab);
    }
    if (this.filters.supplier_id && this.filters.supplier_id !== 'all') {
      params.append('supplierId', this.filters.supplier_id);
    }
    if (this.filters.startDate) {
      params.append('startDate', this.filters.startDate);
    }
    if (this.filters.endDate) {
      params.append('endDate', this.filters.endDate);
    }
    if (state.currentBranchId && state.currentBranchId !== 'all') {
      params.append('branchId', state.currentBranchId);
    }

    const url = `/api/reports/download/purchases?${params.toString()}`;
    window.open(url, '_blank');
  },

  printPoInvoice(id) {
    if (!this.currentDetailsPO || this.currentDetailsPO.id !== id) {
      return;
    }
    const p = this.currentDetailsPO;

    const printWin = window.open('', '_blank', 'width=800,height=700');
    if (!printWin) {
      alert('Please allow popups to print Purchase Order receipts.');
      return;
    }

    let itemsTable = '';
    if (p.items && p.items.length) {
      p.items.forEach((it, idx) => {
        itemsTable += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${it.product_name}</strong><br><small>${it.batch_number}</small></td>
            <td>${it.expiry_date}</td>
            <td>${it.quantity} ${it.product_unit || 'Units'}</td>
            <td>₹${Number(it.unit_cost).toFixed(2)}</td>
            <td style="text-align:right;">₹${Number(it.total_cost).toFixed(2)}</td>
          </tr>
        `;
      });
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order ${p.invoice_no} - DairyTrack</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px; }
          .logo { font-size: 22px; font-weight: 800; color: #16a34a; }
          .po-title { font-size: 20px; font-weight: 700; text-align: right; }
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 13px; }
          td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 13px; }
          .totals { margin-left: auto; width: 280px; font-size: 14px; }
          .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .totals-final { font-size: 16px; font-weight: 800; border-top: 2px solid #1e293b; padding-top: 6px; color: #16a34a; }
          .footer { margin-top: 40px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">🥛 DairyTrack Smart Dairy</div>
            <div style="font-size:12px; color:#64748b;">Smart Inventory • Better Sales • Smarter Business</div>
          </div>
          <div>
            <div class="po-title">PURCHASE ORDER</div>
            <div style="font-family:monospace; font-weight:700;">${p.invoice_no}</div>
            <div style="font-size:12px; color:#64748b;">Status: <strong>${p.status}</strong></div>
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <strong>Supplier / Vendor:</strong><br>
            ${p.supplier_name}<br>
            Phone: ${p.supplier_phone || '-'}<br>
            GSTIN: ${p.supplier_gst || 'Unregistered'}
          </div>
          <div style="text-align:right;">
            <strong>Order Details:</strong><br>
            Date: ${p.purchase_date}<br>
            Receiving Store: ${p.branch_name || 'Main Dairy Plant'}<br>
            Payment Mode: ${p.payment_method} (${p.payment_status})
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Product & Batch</th>
              <th>Expiry Date</th>
              <th>Quantity</th>
              <th>Unit Rate</th>
              <th style="text-align:right;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTable}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Items Subtotal:</span>
            <span>₹${Number(p.total_amount).toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>GST / Tax:</span>
            <span>+₹${Number(p.tax_amount || 0).toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Discount:</span>
            <span>-₹${Number(p.discount_amount || 0).toFixed(2)}</span>
          </div>
          <div class="totals-row totals-final">
            <span>Net Procurement Total:</span>
            <span>₹${Number(p.net_amount).toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          Generated automatically by DairyTrack System • Authorized Dairy Procurement Slip
        </div>
      </body>
      </html>
    `);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  }
};
