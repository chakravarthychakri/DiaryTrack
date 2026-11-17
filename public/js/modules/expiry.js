// ====================================================================
// MODULE 11: EXPIRY & WASTAGE MANAGEMENT CONTROLLER
// ====================================================================

const expiryModule = {
  dashboardData: null,
  activeTab: 'expired',
  productsList: [],
  activeBatches: [],
  selectedBatch: null,
  pendingWastagePayload: null,
  filters: {
    search: '',
    waste_type: 'all',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 15
  },
  filterTimeout: null,

  async init() {
    await Promise.all([
      this.loadDashboard(),
      this.loadProducts()
    ]);
  },

  async loadProducts() {
    try {
      const res = await api.getProducts({ limit: 100 });
      if (res && res.success) {
        this.productsList = res.data;
      }
    } catch (err) {
      console.warn('Could not load products for wastage modal:', err);
    }
  },

  // -------------------------------------------------------------
  // 11.1: LOAD DASHBOARD & 5 KPI CARDS
  // -------------------------------------------------------------
  async loadDashboard() {
    try {
      ui.renderSkeleton('expiry-table-body', 5);
      const res = await api.getExpiryDashboard();
      if (res && res.success && res.data) {
        this.dashboardData = res.data;
        this.renderKpis(res.data.metrics);
        this.updateTabBadges();
        await this.renderActiveTab();
      }
    } catch (err) {
      console.error('Error loading expiry dashboard:', err);
    }
  },

  renderKpis(m) {
    if (!m) return;

    // 1. Expiring Today
    const todayEl = document.getElementById('exp-stat-today');
    const todaySubEl = document.getElementById('exp-stat-today-sub');
    if (todayEl) todayEl.textContent = m.expiring_today_count || 0;
    if (todaySubEl) todaySubEl.textContent = `${ui.formatCurrency(m.expiring_today_loss || 0)} critical shelf risk`;

    // 2. Expiring in <= 3 Days
    const d3El = document.getElementById('exp-stat-3days');
    const d3SubEl = document.getElementById('exp-stat-3days-sub');
    if (d3El) d3El.textContent = m.expiring_3days_count || 0;
    if (d3SubEl) d3SubEl.textContent = `${ui.formatCurrency(m.expiring_3days_loss || 0)} priority push`;

    // 3. Expiring in 4 - 7 Days
    const d7El = document.getElementById('exp-stat-7days');
    const d7SubEl = document.getElementById('exp-stat-7days-sub');
    if (d7El) d7El.textContent = m.expiring_7days_count || 0;
    if (d7SubEl) d7SubEl.textContent = `${ui.formatCurrency(m.expiring_7days_loss || 0)} monitoring window`;

    // 4. Already Expired in Stock
    const expEl = document.getElementById('exp-stat-expired');
    const expSubEl = document.getElementById('exp-stat-expired-sub');
    if (expEl) expEl.textContent = m.already_expired_count || 0;
    if (expSubEl) expSubEl.textContent = `${ui.formatCurrency(m.already_expired_loss || 0)} sitting loss value`;

    // 5. Total Expiry & Wastage Loss
    const lossEl = document.getElementById('exp-stat-loss');
    const lossSubEl = document.getElementById('exp-stat-loss-sub');
    if (lossEl) lossEl.textContent = ui.formatCurrency(m.total_expiry_loss || 0);
    if (lossSubEl) {
      const breakdown = m.waste_type_breakdown || {};
      lossSubEl.textContent = `Damaged: ₹${(breakdown.Damaged || 0).toLocaleString()} | Spoiled: ₹${(breakdown.Spoiled || 0).toLocaleString()}`;
    }
  },

  updateTabBadges() {
    if (!this.dashboardData) return;
    const { expiringToday, expiringThreeDays, expiringSevenDays, alreadyExpired } = this.dashboardData;

    const bExpired = document.getElementById('exp-tab-badge-expired');
    if (bExpired) bExpired.textContent = (alreadyExpired || []).length;

    const bToday = document.getElementById('exp-tab-badge-today');
    if (bToday) bToday.textContent = (expiringToday || []).length;

    const b3Days = document.getElementById('exp-tab-badge-3days');
    if (b3Days) b3Days.textContent = (expiringThreeDays || []).length;

    const b7Days = document.getElementById('exp-tab-badge-7days');
    if (b7Days) b7Days.textContent = (expiringSevenDays || []).length;
  },

  // -------------------------------------------------------------
  // 11.2: TAB NAVIGATION & TABLE RENDERING
  // -------------------------------------------------------------
  async switchTab(tab) {
    this.activeTab = tab;

    const tabs = ['expired', 'today', '3days', '7days', 'history'];
    tabs.forEach(t => {
      const btn = document.getElementById(`exp-tab-btn-${t}`);
      if (btn) btn.classList.toggle('active', t === tab);
    });

    const toolbar = document.getElementById('exp-filter-toolbar');
    if (toolbar) {
      toolbar.style.display = tab === 'history' ? 'block' : 'none';
    }

    const paginationContainer = document.getElementById('exp-pagination-container');
    if (paginationContainer && tab !== 'history') {
      paginationContainer.innerHTML = '';
    }

    await this.renderActiveTab();
  },

  async renderActiveTab() {
    const thead = document.getElementById('expiry-table-head');
    const tbody = document.getElementById('expiry-table-body');
    if (!thead || !tbody) return;

    if (this.activeTab === 'history') {
      await this.renderHistoryTable();
      return;
    }

    if (!this.dashboardData) return;

    let items = [];
    let emptyMsg = '';
    let badgeColorClass = 'var(--danger)';

    switch (this.activeTab) {
      case 'expired':
        items = this.dashboardData.alreadyExpired || [];
        emptyMsg = '✅ Fantastic! No expired dairy batches currently sitting in stock.';
        badgeColorClass = 'var(--danger)';
        break;
      case 'today':
        items = this.dashboardData.expiringToday || [];
        emptyMsg = '✅ Clear! No products expiring today.';
        badgeColorClass = '#C2410C';
        break;
      case '3days':
        items = this.dashboardData.expiringThreeDays || [];
        emptyMsg = '✅ No batches expiring in the next 3 days.';
        badgeColorClass = 'var(--warning)';
        break;
      case '7days':
        items = this.dashboardData.expiringSevenDays || [];
        emptyMsg = '✅ No batches expiring within the 4-7 days window.';
        badgeColorClass = 'var(--primary)';
        break;
    }

    thead.innerHTML = `
      <tr>
        <th>Batch Number</th>
        <th>Product Details</th>
        <th>Category</th>
        <th>Branch</th>
        <th>Expiry Date</th>
        <th>Shelf Status</th>
        <th>Available Stock</th>
        <th>Unit Cost</th>
        <th>Loss Exposure</th>
        <th style="text-align:right;">Action</th>
      </tr>
    `;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding:3rem; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:0.5rem;">🎉</div>
            <div style="font-weight:700; font-size:1.05rem;">${emptyMsg}</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(b => {
      let statusBadge = '';
      if (this.activeTab === 'expired') {
        const daysAgo = b.days_overdue !== undefined ? b.days_overdue : Math.max(1, Math.floor((new Date() - new Date(b.expiry_date)) / 86400000));
        statusBadge = `<span class="status-chip badge-danger">Expired ${daysAgo}d ago</span>`;
      } else if (this.activeTab === 'today') {
        statusBadge = '<span class="status-chip badge-warning" style="background:#FFEDD5; color:#C2410C; border:1px solid rgba(194,65,12,0.3);">🔥 Expiring Today</span>';
      } else if (this.activeTab === '3days') {
        statusBadge = `<span class="status-chip badge-warning">⚠️ ${b.days_left}d left</span>`;
      } else {
        statusBadge = `<span class="status-chip badge-info">📅 ${b.days_left}d left</span>`;
      }

      html += `
        <tr>
          <td>
            <div style="font-weight:800; font-family:monospace; font-size:0.92rem;">${b.batch_number}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${b.storage_temperature || 'Cold Storage'}</div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-primary); font-size:0.92rem;">${b.product_name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">SKU: ${b.product_sku || '-'}</div>
          </td>
          <td>
            <span class="status-chip badge-info">${b.category_name}</span>
          </td>
          <td>${b.branch_name || 'Main Dairy'}</td>
          <td>
            <strong style="color:${badgeColorClass}; font-size:0.9rem;">
              ${ui.formatDate(b.expiry_date)}
            </strong>
          </td>
          <td>
            ${statusBadge}
          </td>
          <td>
            <span style="font-size:0.95rem; font-weight:800;">${b.current_quantity} ${b.unit}</span>
          </td>
          <td>${ui.formatCurrency(b.purchase_cost)}</td>
          <td>
            <div style="font-weight:800; color:${badgeColorClass}; font-size:0.95rem;">
              ${ui.formatCurrency(b.loss_amount)}
            </div>
          </td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-danger" onclick="expiryModule.openWastageModal(${b.id}, ${b.product_id})" title="Record Wastage & Write Off">
              Write Off Loss
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  async renderHistoryTable() {
    const thead = document.getElementById('expiry-table-head');
    const tbody = document.getElementById('expiry-table-body');
    if (!thead || !tbody) return;

    thead.innerHTML = `
      <tr>
        <th style="width:110px;">Voucher #</th>
        <th>Date</th>
        <th>Product & SKU</th>
        <th>Batch Number</th>
        <th>Category</th>
        <th>Quantity Lost</th>
        <th>Cost / Unit</th>
        <th>Total Financial Loss</th>
        <th>Reason & Explanation</th>
        <th>Action Taken</th>
        <th>Recorded By</th>
      </tr>
    `;

    ui.renderSkeleton('expiry-table-body', 5);

    try {
      const res = await api.getWastageHistory(this.filters);
      if (res && res.success) {
        const items = res.data;
        const bHistory = document.getElementById('exp-tab-badge-history');
        if (bHistory) bHistory.textContent = res.pagination ? res.pagination.total : items.length;

        if (!items || !items.length) {
          tbody.innerHTML = `
            <tr>
              <td colspan="11" style="text-align:center; padding:3rem; color:var(--text-muted);">
                <div style="font-size:2rem; margin-bottom:0.5rem;">📜</div>
                <div style="font-weight:700; font-size:1.05rem;">No wastage or loss records found</div>
                <div style="font-size:0.85rem;">Modify search filters or record new wastage above.</div>
              </td>
            </tr>
          `;
          return;
        }

        let html = '';
        items.forEach(w => {
          let wasteBadge = 'badge-waste-spoiled';
          if (w.waste_type === 'Expired') wasteBadge = 'badge-waste-expired';
          else if (w.waste_type === 'Damaged') wasteBadge = 'badge-waste-damaged';
          else if (w.waste_type === 'Spilled') wasteBadge = 'badge-waste-spilled';
          else if (w.waste_type === 'Other Wastage') wasteBadge = 'badge-waste-other';

          html += `
            <tr>
              <td>
                <span class="status-chip badge-danger" style="font-weight:800; font-family:monospace;">
                  ${w.formatted_waste_id || 'WST-' + w.id}
                </span>
              </td>
              <td>${ui.formatDate(w.recorded_date)}</td>
              <td>
                <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${w.product_name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">${w.product_sku || ''}</div>
              </td>
              <td>
                <code style="font-weight:700; font-size:0.8rem;">${w.batch_number || 'Direct'}</code>
                ${w.batch_expiry_date ? `<div style="font-size:0.72rem; color:var(--text-muted);">Exp: ${ui.formatDate(w.batch_expiry_date)}</div>` : ''}
              </td>
              <td>
                <span class="status-chip ${wasteBadge}">${w.waste_type || 'Spoiled'}</span>
              </td>
              <td>
                <span style="font-weight:800; color:var(--danger); font-size:0.95rem;">${w.quantity} ${w.unit}</span>
              </td>
              <td>${ui.formatCurrency(w.unit_cost)}</td>
              <td>
                <div style="font-weight:800; color:var(--danger); font-size:1rem;">
                  ${ui.formatCurrency(w.total_loss_value)}
                </div>
              </td>
              <td>
                <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${w.reason}</div>
              </td>
              <td>
                <span class="status-chip badge-secondary" style="font-size:0.75rem;">${w.action_taken || 'Discarded'}</span>
              </td>
              <td>
                <span style="font-size:0.8rem; color:var(--text-secondary);">${w.recorded_by || 'Staff'}</span>
              </td>
            </tr>
          `;
        });

        tbody.innerHTML = html;
        this.renderPagination(res.pagination);
      }
    } catch (err) {
      console.error('Error rendering wastage history:', err);
    }
  },

  renderPagination(p) {
    const container = document.getElementById('exp-pagination-container');
    if (!container) return;

    if (!p || p.total <= p.limit) {
      container.innerHTML = `
        <div style="font-size:0.85rem; color:var(--text-secondary);">
          Showing all <b>${p ? p.total : 0}</b> wastage events
        </div>
      `;
      return;
    }

    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.page * p.limit, p.total);

    container.innerHTML = `
      <div style="font-size:0.85rem; color:var(--text-secondary);">
        Showing <b>${start} - ${end}</b> of <b>${p.total}</b> wastage logs (Page ${p.page} of ${p.pages})
      </div>
      <div style="display:flex; gap:0.4rem;">
        <button class="btn btn-sm btn-secondary" ${p.page <= 1 ? 'disabled' : ''} onclick="expiryModule.goToPage(${p.page - 1})">
          &larr; Previous
        </button>
        <button class="btn btn-sm btn-secondary" ${p.page >= p.pages ? 'disabled' : ''} onclick="expiryModule.goToPage(${p.page + 1})">
          Next &rarr;
        </button>
      </div>
    `;
  },

  goToPage(page) {
    this.filters.page = page;
    this.renderHistoryTable();
  },

  // -------------------------------------------------------------
  // 11.3: FILTER HANDLERS
  // -------------------------------------------------------------
  applyFilters() {
    const searchEl = document.getElementById('exp-filter-search');
    const typeEl = document.getElementById('exp-filter-type');
    const startEl = document.getElementById('exp-filter-start-date');
    const endEl = document.getElementById('exp-filter-end-date');

    this.filters.search = searchEl ? searchEl.value.trim() : '';
    this.filters.waste_type = typeEl ? typeEl.value : 'all';
    this.filters.startDate = startEl ? startEl.value : '';
    this.filters.endDate = endEl ? endEl.value : '';
    this.filters.page = 1;

    this.renderHistoryTable();
  },

  debounceFilter() {
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => {
      this.applyFilters();
    }, 280);
  },

  resetFilters() {
    const searchEl = document.getElementById('exp-filter-search');
    const typeEl = document.getElementById('exp-filter-type');
    const startEl = document.getElementById('exp-filter-start-date');
    const endEl = document.getElementById('exp-filter-end-date');

    if (searchEl) searchEl.value = '';
    if (typeEl) typeEl.value = 'all';
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';

    this.filters = {
      search: '',
      waste_type: 'all',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 15
    };

    this.renderHistoryTable();
  },

  // -------------------------------------------------------------
  // 11.4: RECORD WASTAGE MODAL & TWO-STEP INVENTORY CONFIRMATION
  // -------------------------------------------------------------
  async openWastageModal(preselectedBatchId = null, preselectedProductId = null) {
    const form = document.getElementById('expiry-action-form');
    if (form) form.reset();

    document.getElementById('exp-action-date').value = ui.getTodayDate();
    document.getElementById('exp-action-reason-custom-wrap').style.display = 'none';

    // Populate product dropdown
    const prodSel = document.getElementById('exp-action-product-id');
    if (prodSel) {
      let pHtml = '<option value="">Select product to record wastage...</option>';
      this.productsList.forEach(p => {
        pHtml += `<option value="${p.id}" data-unit="${p.unit || 'Units'}" data-price="${p.purchase_price || 0}">${p.name} (${p.sku}) - ${p.unit}</option>`;
      });
      prodSel.innerHTML = pHtml;
    }

    if (preselectedProductId) {
      prodSel.value = String(preselectedProductId);
      await this.onProductChange();
    }

    if (preselectedBatchId) {
      const batchSel = document.getElementById('exp-action-batch-id');
      if (batchSel) {
        batchSel.value = String(preselectedBatchId);
        this.onBatchChange();
      }
    }

    ui.openModal('expiry-action-modal');
  },

  openActionModal(batchId, prodName, batchNum, qty, unit) {
    // Backward compatibility shortcut: find product
    this.openWastageModal(batchId, null);
  },

  async onProductChange() {
    const prodSel = document.getElementById('exp-action-product-id');
    const batchSel = document.getElementById('exp-action-batch-id');
    const unitLabel = document.getElementById('exp-action-unit-label');
    const costInput = document.getElementById('exp-action-unit-cost');

    if (!prodSel || !prodSel.value) {
      if (batchSel) batchSel.innerHTML = '<option value="">Select product first...</option>';
      if (unitLabel) unitLabel.textContent = 'Units';
      if (costInput) costInput.value = '';
      this.calcLoss();
      return;
    }

    const selectedOpt = prodSel.options[prodSel.selectedIndex];
    const unit = selectedOpt.getAttribute('data-unit') || 'Units';
    const fallbackPrice = selectedOpt.getAttribute('data-price') || '0';
    if (unitLabel) unitLabel.textContent = unit;

    // Load active batches for product
    try {
      if (batchSel) {
        batchSel.innerHTML = '<option value="">Loading batches...</option>';
        const res = await api.getBatches({ productId: Number(prodSel.value) });
        if (res && res.success && res.data && res.data.length) {
          this.activeBatches = res.data;
          let bHtml = '<option value="">Select batch...</option>';
          res.data.forEach(b => {
            bHtml += `<option value="${b.id}" data-qty="${b.current_quantity}" data-cost="${b.purchase_cost}" data-exp="${b.expiry_date}">${b.batch_number} (Avail: ${b.current_quantity} ${unit} | Exp: ${ui.formatDate(b.expiry_date)})</option>`;
          });
          batchSel.innerHTML = bHtml;

          // Auto-select earliest expiry batch (FEFO)
          if (res.data[0]) {
            batchSel.value = String(res.data[0].id);
            this.onBatchChange();
          }
        } else {
          batchSel.innerHTML = '<option value="">⚠️ No active batches found with stock</option>';
          if (costInput) costInput.value = fallbackPrice;
        }
      }
    } catch (err) {
      console.warn('Error loading product batches:', err);
    }

    this.calcLoss();
  },

  onBatchChange() {
    const batchSel = document.getElementById('exp-action-batch-id');
    const availLabel = document.getElementById('exp-action-batch-avail-label');
    const qtyInput = document.getElementById('exp-action-qty');
    const costInput = document.getElementById('exp-action-unit-cost');

    if (!batchSel || !batchSel.value) {
      if (availLabel) availLabel.textContent = 'Select batch';
      this.selectedBatch = null;
      this.calcLoss();
      return;
    }

    const selectedOpt = batchSel.options[batchSel.selectedIndex];
    const availQty = Number(selectedOpt.getAttribute('data-qty') || 0);
    const cost = Number(selectedOpt.getAttribute('data-cost') || 0);
    const expDate = selectedOpt.getAttribute('data-exp') || '';

    this.selectedBatch = {
      id: Number(batchSel.value),
      batch_number: selectedOpt.text.split(' ')[0],
      current_quantity: availQty,
      purchase_cost: cost,
      expiry_date: expDate
    };

    if (availLabel) {
      availLabel.textContent = `Available: ${availQty} in stock (Exp: ${ui.formatDate(expDate)})`;
    }

    if (costInput) costInput.value = cost;
    if (qtyInput) {
      qtyInput.max = availQty;
      if (!qtyInput.value || Number(qtyInput.value) > availQty) {
        qtyInput.value = Math.min(availQty, 1);
      }
    }

    // Auto-detect if expired
    const isPast = new Date(expDate) < new Date();
    if (isPast) {
      const typeSel = document.getElementById('exp-action-waste-type');
      if (typeSel) typeSel.value = 'Expired';
    }

    this.calcLoss();
  },

  onWasteTypeChange() {
    const typeSel = document.getElementById('exp-action-waste-type');
    const reasonSel = document.getElementById('exp-action-reason-select');
    if (!typeSel || !reasonSel) return;

    switch (typeSel.value) {
      case 'Expired':
        reasonSel.value = 'Expired past shelf life';
        break;
      case 'Damaged':
        reasonSel.value = 'Leaked pouch / cracked bottle';
        break;
      case 'Spilled':
        reasonSel.value = 'Boiling / processing tank spill';
        break;
      case 'Spoiled':
        reasonSel.value = 'Curdled / Sour taste';
        break;
      case 'Other Wastage':
        reasonSel.value = 'Quality testing lab sample';
        break;
    }
    this.onReasonSelectChange();
  },

  onReasonSelectChange() {
    const reasonSel = document.getElementById('exp-action-reason-select');
    const customWrap = document.getElementById('exp-action-reason-custom-wrap');
    if (!reasonSel || !customWrap) return;

    customWrap.style.display = reasonSel.value === 'Custom' ? 'block' : 'none';
  },

  calcLoss() {
    const qty = Number(document.getElementById('exp-action-qty').value) || 0;
    const cost = Number(document.getElementById('exp-action-unit-cost').value) || 0;
    const lossInput = document.getElementById('exp-action-total-loss');
    if (lossInput) {
      lossInput.value = (qty * cost).toFixed(2);
    }
  },

  // First step: validate and prompt confirmation
  handleFormSubmit(e) {
    e.preventDefault();

    const prodSel = document.getElementById('exp-action-product-id');
    const batchSel = document.getElementById('exp-action-batch-id');
    const wasteType = document.getElementById('exp-action-waste-type').value;
    const qty = Number(document.getElementById('exp-action-qty').value);
    const unitCost = Number(document.getElementById('exp-action-unit-cost').value);
    const totalLoss = Number(document.getElementById('exp-action-total-loss').value);
    const actionTaken = document.getElementById('exp-action-type').value;
    const recordDate = document.getElementById('exp-action-date').value;

    const reasonSel = document.getElementById('exp-action-reason-select');
    const customReason = document.getElementById('exp-action-reason-custom').value.trim();
    const finalReason = reasonSel.value === 'Custom' ? (customReason || 'Other wastage') : reasonSel.value;

    if (!prodSel.value) {
      ui.showToast('Please select a product.', 'warning');
      return;
    }

    if (!batchSel.value) {
      ui.showToast('Please select an active batch.', 'warning');
      return;
    }

    if (!qty || qty <= 0) {
      ui.showToast('Please enter a valid quantity.', 'warning');
      return;
    }

    if (this.selectedBatch && qty > this.selectedBatch.current_quantity) {
      ui.showToast(`Cannot deduct ${qty}. Only ${this.selectedBatch.current_quantity} available in batch.`, 'error');
      return;
    }

    const prodName = prodSel.options[prodSel.selectedIndex].text.split(' (')[0];
    const unit = document.getElementById('exp-action-unit-label').textContent;

    // Package payload
    this.pendingWastagePayload = {
      product_id: Number(prodSel.value),
      batch_id: Number(batchSel.value),
      quantity: qty,
      waste_type: wasteType,
      unit_cost: unitCost,
      total_loss_value: totalLoss,
      action_taken: actionTaken,
      recorded_date: recordDate,
      reason: finalReason
    };

    // Populate confirmation modal
    document.getElementById('exp-confirm-product').textContent = prodName;
    document.getElementById('exp-confirm-batch').textContent = this.selectedBatch ? this.selectedBatch.batch_number : `Batch #${batchSel.value}`;
    document.getElementById('exp-confirm-category').textContent = wasteType;
    document.getElementById('exp-confirm-qty').textContent = `${qty} ${unit}`;
    document.getElementById('exp-confirm-loss').textContent = ui.formatCurrency(totalLoss);

    // Open confirmation modal
    ui.openModal('expiry-confirm-modal');
  },

  // Second step: confirmed inventory deduction
  async executeConfirmedWastage() {
    if (!this.pendingWastagePayload) return;

    try {
      const res = await api.recordWastage(this.pendingWastagePayload);
      if (res && res.success) {
        ui.showToast(res.message || 'Wastage recorded and stock deducted from inventory!', 'success');
        ui.closeModal('expiry-confirm-modal');
        ui.closeModal('expiry-action-modal');

        this.pendingWastagePayload = null;
        await this.loadDashboard();

        // Refresh cross-module inventory and dashboard
        if (typeof inventoryModule !== 'undefined' && inventoryModule.loadBatches) {
          inventoryModule.loadBatches();
        }
        if (typeof productsModule !== 'undefined' && productsModule.loadProducts) {
          productsModule.loadProducts();
        }
        if (typeof dashboardModule !== 'undefined' && dashboardModule.loadStats) {
          dashboardModule.loadStats();
        }
      } else {
        ui.showToast(res ? res.error : 'Failed to deduct wastage.', 'error');
      }
    } catch (err) {
      console.error('Error executing wastage deduction:', err);
      ui.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // 11.5: EXCEL REPORT DOWNLOAD
  // -------------------------------------------------------------
  downloadReport() {
    const params = new URLSearchParams();
    if (this.filters.waste_type && this.filters.waste_type !== 'all') params.append('waste_type', this.filters.waste_type);
    if (this.filters.startDate) params.append('startDate', this.filters.startDate);
    if (this.filters.endDate) params.append('endDate', this.filters.endDate);

    window.location.href = `/api/expiry/report?${params.toString()}`;
  }
};
