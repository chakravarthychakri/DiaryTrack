// ====================================================================
// Module 8: Stock Movement Management & Auditable Correction Ledger
// ====================================================================

const movementsModule = {
  movementsList: [],
  typesMetadata: null,
  stats: null,
  currentFlow: 'all', // 'all', 'inflow', 'outflow', 'corrections'
  currentPage: 1,
  pageSize: 15,
  totalPages: 1,
  totalCount: 0,
  currentMovementDetails: null,
  searchDebounceTimer: null,
  selectedProductBatches: [],
  corrProductBatches: [],

  async init() {
    await this.loadTypes();
    this.populateFilterOptions();
    await this.loadStats();
    await this.loadMovements();
  },

  async loadTypes() {
    try {
      const res = await api.getMovementTypes();
      if (res && res.success) {
        this.typesMetadata = res.data;
        const typeSelect = document.getElementById('mov-filter-type');
        if (typeSelect) {
          let opts = '<option value="all">All Movement Types</option>';
          if (res.data.INCOMING) {
            opts += '<optgroup label="Incoming (Inflows)">';
            res.data.INCOMING.forEach(t => {
              opts += `<option value="${t.type}">${t.icon || '📥'} ${t.label || t.type}</option>`;
            });
            opts += '</optgroup>';
          }
          if (res.data.OUTGOING) {
            opts += '<optgroup label="Outgoing (Outflows)">';
            res.data.OUTGOING.forEach(t => {
              opts += `<option value="${t.type}">${t.icon || '📤'} ${t.label || t.type}</option>`;
            });
            opts += '</optgroup>';
          }
          typeSelect.innerHTML = opts;
        }
      }
    } catch (err) {
      console.warn('Could not load movement types metadata:', err);
    }
  },

  populateFilterOptions() {
    const prodFilter = document.getElementById('mov-filter-product');
    if (prodFilter && state.products) {
      prodFilter.innerHTML = '<option value="all">All Dairy Products</option>' +
        state.products.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('');
    }
  },

  async loadStats() {
    try {
      const startDate = document.getElementById('mov-filter-start')?.value || '';
      const endDate = document.getElementById('mov-filter-end')?.value || '';
      const productId = document.getElementById('mov-filter-product')?.value || '';
      const branchId = state.currentBranchId || 'all';

      const res = await api.getMovementStats({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        productId: productId !== 'all' ? productId : undefined,
        branchId: branchId !== 'all' ? branchId : undefined
      });

      if (res && res.success) {
        const s = res.data;
        this.stats = s;

        // KPI Stat Cards
        const totalEl = document.getElementById('mov-stat-total');
        if (totalEl) totalEl.textContent = ui.formatNumber(s.total_movements || 0);

        const todaySubEl = document.getElementById('mov-stat-today-sub');
        if (todaySubEl) todaySubEl.textContent = `${ui.formatNumber(s.today_movements_count || 0)} transactions today`;

        const inflowEl = document.getElementById('mov-stat-inflow');
        if (inflowEl) inflowEl.textContent = `${ui.formatNumber(s.total_inflow_units || 0)} Units`;

        const inflowSubEl = document.getElementById('mov-stat-inflow-count');
        if (inflowSubEl) inflowSubEl.textContent = `${ui.formatNumber(s.incoming_count || 0)} incoming batches/receipts`;

        const outflowEl = document.getElementById('mov-stat-outflow');
        if (outflowEl) outflowEl.textContent = `${ui.formatNumber(s.total_outflow_units || 0)} Units`;

        const outflowSubEl = document.getElementById('mov-stat-outflow-count');
        if (outflowSubEl) outflowSubEl.textContent = `${ui.formatNumber(s.outgoing_count || 0)} sales & write-offs`;

        const netEl = document.getElementById('mov-stat-net');
        if (netEl) {
          const delta = Number(s.net_units_delta || 0);
          netEl.textContent = `${delta > 0 ? '+' : ''}${ui.formatNumber(delta)} Units`;
          netEl.style.color = delta >= 0 ? 'var(--primary-dark)' : 'var(--danger)';
        }

        // Tab Badges
        const tabAll = document.getElementById('mov-tab-count-all');
        if (tabAll) tabAll.textContent = ui.formatNumber(s.total_movements || 0);

        const tabIn = document.getElementById('mov-tab-count-inflow');
        if (tabIn) tabIn.textContent = ui.formatNumber(s.incoming_count || 0);

        const tabOut = document.getElementById('mov-tab-count-outflow');
        if (tabOut) tabOut.textContent = ui.formatNumber(s.outgoing_count || 0);
      }
    } catch (err) {
      console.error('Error loading movement stats:', err);
    }
  },

  async loadMovements() {
    try {
      ui.renderSkeleton('movements-table-body', 6);

      const params = {
        page: this.currentPage,
        limit: this.pageSize
      };

      if (this.currentFlow === 'inflow') {
        params.flow = 'inflow';
      } else if (this.currentFlow === 'outflow') {
        params.flow = 'outflow';
      } else if (this.currentFlow === 'corrections') {
        params.movement_type = 'Authorized Stock Correction';
      }

      const typeVal = document.getElementById('mov-filter-type')?.value;
      if (typeVal && typeVal !== 'all' && this.currentFlow !== 'corrections') {
        params.movement_type = typeVal;
      }

      const prodVal = document.getElementById('mov-filter-product')?.value;
      if (prodVal && prodVal !== 'all') {
        params.product_id = prodVal;
      }

      const startVal = document.getElementById('mov-filter-start')?.value;
      if (startVal) params.startDate = startVal;

      const endVal = document.getElementById('mov-filter-end')?.value;
      if (endVal) params.endDate = endVal;

      const searchVal = document.getElementById('mov-filter-search')?.value?.trim();
      if (searchVal) params.search = searchVal;

      const res = await api.getMovements(params);
      if (res && res.success) {
        this.movementsList = res.data || [];
        this.renderTable(this.movementsList);

        if (res.pagination) {
          this.currentPage = res.pagination.page;
          this.totalPages = res.pagination.totalPages;
          this.totalCount = res.pagination.total;

          const startIdx = this.totalCount === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
          const endIdx = Math.min(this.currentPage * this.pageSize, this.totalCount);

          const pageInfo = document.getElementById('mov-pagination-info');
          if (pageInfo) {
            pageInfo.textContent = `Showing ${startIdx} to ${endIdx} of ${this.totalCount} movements`;
          }

          const pageInd = document.getElementById('mov-page-indicator');
          if (pageInd) {
            pageInd.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
          }

          const prevBtn = document.getElementById('mov-prev-btn');
          if (prevBtn) prevBtn.disabled = this.currentPage <= 1;

          const nextBtn = document.getElementById('mov-next-btn');
          if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;

          // If corrections tab count is needed
          if (this.currentFlow === 'corrections') {
            const corrTabCount = document.getElementById('mov-tab-count-corrections');
            if (corrTabCount) corrTabCount.textContent = ui.formatNumber(this.totalCount);
          }
        }
      }
    } catch (err) {
      console.error('Error loading movements:', err);
      const tbody = document.getElementById('movements-table-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--danger);">Failed to load movements. Please try again.</td></tr>`;
      }
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('movements-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
            <div style="font-size:2.2rem; margin-bottom:0.5rem;">📜</div>
            <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary); margin-bottom:0.25rem;">No Stock Movement Records Found</div>
            <div style="font-size:0.85rem;">Try adjusting the flow filter, date range, or record a new stock movement.</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(m => {
      const isCorrection = m.movement_type === 'Authorized Stock Correction' || m.movement_type === 'Other Authorized Adjustment' || m.correction_of_id;
      const isInflow = m.flow_type === 'Inflow';

      // Badge style
      let flowBadge = '';
      if (isCorrection) {
        flowBadge = `<span class="status-chip badge-correction">⚖️ Correction</span>`;
      } else if (isInflow) {
        flowBadge = `<span class="status-chip badge-inflow">📥 Inflow</span>`;
      } else {
        flowBadge = `<span class="status-chip badge-outflow">📤 Outflow</span>`;
      }

      // Quantity style
      const qtySign = isInflow ? '+' : '-';
      const qtyColor = isInflow ? 'var(--success)' : (isCorrection ? '#B45309' : 'var(--danger)');

      // Reference code
      const movCode = m.reference_txn || `MOV-${String(m.id).padStart(6, '0')}`;

      // Stock evolution
      const prevStock = m.previous_stock !== null && m.previous_stock !== undefined ? m.previous_stock : '-';
      const nextStock = m.updated_stock !== null && m.updated_stock !== undefined ? m.updated_stock : '-';

      html += `
        <tr>
          <td>
            <div style="font-weight:800; font-family:monospace; color:var(--primary-dark); font-size:0.85rem;">
              ${movCode}
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted);">ID: #${m.id}</div>
          </td>
          <td>
            <div style="font-size:0.825rem; font-weight:600;">${ui.formatDate(m.movement_date)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${m.created_at ? m.created_at.slice(11, 16) : ''}</div>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
              ${flowBadge}
              <div style="font-size:0.8rem; font-weight:700; color:var(--text-primary);">${m.movement_type}</div>
            </div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-primary); font-size:0.875rem;">${m.product_name || 'Dairy Item'}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">SKU: ${m.product_sku || '-'}</div>
          </td>
          <td>
            <code style="font-size:0.75rem; background:var(--bg-subtle); padding:2px 6px; border-radius:4px;">
              ${m.batch_number || 'All Batches'}
            </code>
          </td>
          <td>
            <span style="font-weight:800; font-size:0.95rem; color:${qtyColor};">
              ${qtySign}${m.quantity} ${m.display_unit || m.unit || ''}
            </span>
          </td>
          <td>
            <div style="font-family:monospace; font-size:0.82rem; font-weight:700; color:var(--text-secondary); background:var(--bg-subtle); padding:3px 6px; border-radius:4px; display:inline-block;">
              ${prevStock} &rarr; <span style="color:var(--text-primary); font-weight:800;">${nextStock}</span>
            </div>
          </td>
          <td style="max-width:200px;">
            <div style="font-size:0.8rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${m.reason || ''}">
              ${m.reason || '-'}
            </div>
            ${m.original_movement_ref ? `<div style="font-size:0.7rem; color:#B45309;">Ref: ${m.original_movement_ref}</div>` : ''}
          </td>
          <td>
            <span style="font-size:0.775rem; color:var(--text-secondary);">${m.performed_by || 'System'}</span>
          </td>
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:0.35rem;">
              <button class="btn btn-sm btn-secondary" onclick="movementsModule.openDetailsModal(${m.id})" title="View Complete Audit Voucher" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
                🔍 Details
              </button>
              <button class="btn btn-sm btn-secondary" onclick="movementsModule.openCorrectionModal(${m.id})" title="Record Authorized Correction for this Movement" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-color:#F59E0B; color:#B45309;">
                ⚖️ Correct
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  setFlowTab(flow) {
    this.currentFlow = flow;
    this.currentPage = 1;

    document.querySelectorAll('.mov-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-flow') === flow);
    });

    this.loadMovements();
  },

  debounceFilter() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadMovements();
    }, 300);
  },

  applyFilters() {
    this.currentPage = 1;
    this.loadMovements();
    this.loadStats();
  },

  resetFilters() {
    const sInput = document.getElementById('mov-filter-search');
    if (sInput) sInput.value = '';

    const tSelect = document.getElementById('mov-filter-type');
    if (tSelect) tSelect.value = 'all';

    const pSelect = document.getElementById('mov-filter-product');
    if (pSelect) pSelect.value = 'all';

    const startInput = document.getElementById('mov-filter-start');
    if (startInput) startInput.value = '';

    const endInput = document.getElementById('mov-filter-end');
    if (endInput) endInput.value = '';

    this.currentFlow = 'all';
    document.querySelectorAll('.mov-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-flow') === 'all');
    });

    this.applyFilters();
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadMovements();
    }
  },

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadMovements();
    }
  },

  // -------------------------------------------------------------
  // RECORD MOVEMENT MODAL
  // -------------------------------------------------------------
  openNewModal() {
    const prodSelect = document.getElementById('move-product');
    const fromSelect = document.getElementById('move-from-branch');
    const toSelect = document.getElementById('move-to-branch');
    const qtyInput = document.getElementById('move-qty');
    const reasonInput = document.getElementById('move-reason');
    const refInput = document.getElementById('move-ref-txn');
    const previewBox = document.getElementById('move-preview-box');

    if (qtyInput) qtyInput.value = '';
    if (reasonInput) reasonInput.value = '';
    if (refInput) refInput.value = '';
    if (previewBox) previewBox.style.display = 'none';

    if (prodSelect && state.products) {
      prodSelect.innerHTML = '<option value="">-- Choose Product --</option>' +
        state.products.map(p => `<option value="${p.id}">${p.name} (${p.current_stock || 0} ${p.unit} in stock)</option>`).join('');
    }

    const branchOpts = (state.branches || [{ id: 1, name: 'Main Shop' }]).map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    if (fromSelect) fromSelect.innerHTML = branchOpts;
    if (toSelect) toSelect.innerHTML = branchOpts;

    if (toSelect && state.branches && state.branches.length > 1) {
      toSelect.selectedIndex = 1;
    }

    this.onTypeChange();
    this.onProductChange();
    ui.openModal('movement-modal');
  },

  onTypeChange() {
    const type = document.getElementById('move-type')?.value;
    const branchesRow = document.getElementById('move-branches-row');
    if (!branchesRow) return;

    if (type === 'Transfer' || type === 'Transfer Out' || type === 'Transfer In') {
      branchesRow.style.display = 'grid';
    } else {
      branchesRow.style.display = 'none';
    }

    this.calcPreview();
  },

  async onProductChange() {
    const prodId = document.getElementById('move-product')?.value;
    const batchSelect = document.getElementById('move-batch');
    const infoBox = document.getElementById('move-batch-info-box');
    if (!batchSelect) return;

    if (!prodId) {
      batchSelect.innerHTML = '<option value="">-- Select Product First --</option>';
      if (infoBox) infoBox.style.display = 'none';
      this.selectedProductBatches = [];
      this.calcPreview();
      return;
    }

    try {
      const res = await api.getBatches({ productId: prodId, status: 'Active' });
      if (res && res.success && res.data.length > 0) {
        this.selectedProductBatches = res.data;
        batchSelect.innerHTML = res.data.map(b =>
          `<option value="${b.id}">${b.batch_number} (Avail: ${b.current_quantity} ${b.unit || ''} | Exp: ${ui.formatDate(b.expiry_date)})</option>`
        ).join('');
      } else {
        this.selectedProductBatches = [];
        batchSelect.innerHTML = '<option value="">No active batches for this product</option>';
      }
      this.onBatchChange();
    } catch (err) {
      console.error(err);
      this.selectedProductBatches = [];
    }
  },

  onBatchChange() {
    const batchId = document.getElementById('move-batch')?.value;
    const infoBox = document.getElementById('move-batch-info-box');
    if (!batchId || !this.selectedProductBatches.length) {
      if (infoBox) infoBox.style.display = 'none';
      this.calcPreview();
      return;
    }

    const batch = this.selectedProductBatches.find(b => String(b.id) === String(batchId));
    if (batch && infoBox) {
      infoBox.style.display = 'block';
      infoBox.innerHTML = `
        <strong>Batch Code:</strong> ${batch.batch_number} &nbsp;|&nbsp;
        <strong>Available Qty:</strong> <span style="font-weight:800; color:var(--primary-dark);">${batch.current_quantity} ${batch.unit || ''}</span> &nbsp;|&nbsp;
        <strong>Expires:</strong> ${ui.formatDate(batch.expiry_date)}
      `;
    }

    this.calcPreview();
  },

  calcPreview() {
    const previewBox = document.getElementById('move-preview-box');
    const previewText = document.getElementById('move-preview-text');
    const batchId = document.getElementById('move-batch')?.value;
    const qty = parseFloat(document.getElementById('move-qty')?.value);
    const type = document.getElementById('move-type')?.value;

    if (!previewBox || !previewText) return;

    if (!batchId || isNaN(qty) || qty <= 0) {
      previewBox.style.display = 'none';
      return;
    }

    const batch = this.selectedProductBatches.find(b => String(b.id) === String(batchId));
    if (!batch) {
      previewBox.style.display = 'none';
      return;
    }

    const currentQty = batch.current_quantity || 0;
    const unit = batch.unit || 'Units';
    const isOutflow = ['Transfer Out', 'Supplier Return', 'Damaged Stock', 'Expired Stock', 'Wastage', 'Other Authorized Adjustment', 'Transfer'].includes(type);

    previewBox.style.display = 'block';

    if (isOutflow) {
      const nextQty = Math.max(0, currentQty - qty);
      if (qty > currentQty) {
        previewText.innerHTML = `
          <span style="color:var(--danger);">${currentQty} &rarr; Deficit! (Exceeds available ${currentQty} ${unit})</span>
        `;
      } else {
        previewText.innerHTML = `
          <span>${currentQty} ${unit} &rarr; <strong style="color:var(--primary-dark);">${nextQty.toFixed(1)} ${unit}</strong></span>
        `;
      }
    } else {
      const nextQty = currentQty + qty;
      previewText.innerHTML = `
        <span>${currentQty} ${unit} &rarr; <strong style="color:var(--success);">${nextQty.toFixed(1)} ${unit}</strong></span>
      `;
    }
  },

  async submitMovement(e) {
    if (e && e.preventDefault) e.preventDefault();

    const type = document.getElementById('move-type').value;
    const prodId = document.getElementById('move-product').value;
    const batchId = document.getElementById('move-batch').value;
    const fromB = document.getElementById('move-from-branch').value;
    const toB = document.getElementById('move-to-branch').value;
    const qty = parseFloat(document.getElementById('move-qty').value);
    const reason = document.getElementById('move-reason').value;
    const refTxn = document.getElementById('move-ref-txn').value;

    if (!prodId) {
      ui.showToast('Please select a product.', 'warning');
      return;
    }

    if (!qty || qty <= 0) {
      ui.showToast('Please enter a valid quantity greater than zero.', 'warning');
      return;
    }

    if ((type === 'Transfer' || type === 'Transfer Out') && fromB === toB) {
      ui.showToast('Transfer requires different source and destination branches.', 'warning');
      return;
    }

    const payload = {
      movement_type: type,
      product_id: prodId,
      batch_id: batchId || null,
      from_branch_id: fromB || null,
      to_branch_id: (type === 'Transfer' || type === 'Transfer Out' || type === 'Transfer In') ? toB : null,
      quantity: qty,
      reason: reason || `${type} recorded`,
      reference_txn: refTxn || null,
      performed_by: state.currentUser ? (state.currentUser.name || state.currentUser.username) : 'Staff'
    };

    try {
      const res = await api.createMovement(payload);
      if (res && res.success) {
        ui.showToast(res.message || `Stock movement recorded successfully!`, 'success');
        ui.closeModal('movement-modal');
        await this.loadStats();
        await this.loadMovements();
        if (typeof inventoryModule !== 'undefined' && inventoryModule.loadBatches) inventoryModule.loadBatches();
        if (typeof productsModule !== 'undefined' && productsModule.loadProducts) productsModule.loadProducts();
        if (typeof dashboardModule !== 'undefined' && dashboardModule.loadStats) dashboardModule.loadStats();
      } else {
        ui.showToast(res.error || 'Failed to record stock movement.', 'error');
      }
    } catch (err) {
      console.error(err);
      ui.showToast(err.message || 'Error executing stock movement.', 'error');
    }
  },

  submitForm(e) {
    return this.submitMovement(e);
  },

  // -------------------------------------------------------------
  // MOVEMENT DETAILS & PRINTABLE AUDIT VOUCHER
  // -------------------------------------------------------------
  async openDetailsModal(id) {
    try {
      const res = await api.getMovementDetails(id);
      if (!res || !res.success || !res.data) {
        ui.showToast('Could not load movement details.', 'error');
        return;
      }

      const d = res.data;
      this.currentMovementDetails = d;

      // Title & Header Badges
      const code = d.reference_txn || `MOV-${String(d.id).padStart(6, '0')}`;
      document.getElementById('mov-view-title').textContent = code;

      const flowBadge = document.getElementById('mov-view-flow-badge');
      if (flowBadge) {
        flowBadge.textContent = d.flow_type === 'Inflow' ? '📥 Inflow' : (d.correction_of_id ? '⚖️ Correction' : '📤 Outflow');
        flowBadge.className = d.flow_type === 'Inflow' ? 'status-chip badge-inflow' : (d.correction_of_id ? 'status-chip badge-correction' : 'status-chip badge-outflow');
      }

      const typeBadge = document.getElementById('mov-view-type-badge');
      if (typeBadge) {
        typeBadge.textContent = d.movement_type;
      }

      const dateEl = document.getElementById('mov-view-date');
      if (dateEl) {
        dateEl.textContent = `${ui.formatDate(d.movement_date)} ${d.created_at ? d.created_at.slice(11, 16) : ''}`;
      }

      // 3 Stat Tiles
      const qtyEl = document.getElementById('mov-view-qty');
      if (qtyEl) {
        const sign = d.flow_type === 'Inflow' ? '+' : '-';
        qtyEl.textContent = `${sign}${d.quantity} ${d.display_unit || d.unit || 'Units'}`;
        qtyEl.style.color = d.flow_type === 'Inflow' ? 'var(--success)' : 'var(--danger)';
      }

      const evoEl = document.getElementById('mov-view-evolution');
      if (evoEl) {
        evoEl.textContent = `${d.previous_stock !== null ? d.previous_stock : '-'} → ${d.updated_stock !== null ? d.updated_stock : '-'}`;
      }

      const costEl = document.getElementById('mov-view-cost');
      if (costEl) {
        costEl.textContent = ui.formatCurrency(Math.abs(d.cost_impact || 0));
      }

      // Product Specs
      document.getElementById('mov-view-prod-name').textContent = d.product_name || '-';
      document.getElementById('mov-view-prod-sku').textContent = d.product_sku || '-';
      document.getElementById('mov-view-prod-cat').textContent = d.category_name || 'Dairy';
      document.getElementById('mov-view-prod-unit').textContent = d.display_unit || d.unit || '-';

      // Batch Details
      document.getElementById('mov-view-batch').textContent = d.batch_number || 'All Batches';
      document.getElementById('mov-view-mfg').textContent = d.batch_mfg_date ? ui.formatDate(d.batch_mfg_date) : 'N/A';
      document.getElementById('mov-view-expiry').textContent = d.batch_expiry_date ? ui.formatDate(d.batch_expiry_date) : 'N/A';
      document.getElementById('mov-view-batch-live').textContent = d.batch_current_quantity !== null && d.batch_current_quantity !== undefined ? `${d.batch_current_quantity} ${d.display_unit || d.unit || ''}` : 'N/A';

      // Audit Trail
      document.getElementById('mov-view-ref').textContent = d.reference_txn || code;
      document.getElementById('mov-view-officer').textContent = d.performed_by || 'Staff';
      document.getElementById('mov-view-from').textContent = d.from_branch_name || 'Main Shop';
      document.getElementById('mov-view-to').textContent = d.to_branch_name || 'N/A (Local / Consumed)';
      document.getElementById('mov-view-reason').textContent = d.reason || 'Standard operational movement';

      // Corrections section
      const corrSection = document.getElementById('mov-view-corr-section');
      const corrContent = document.getElementById('mov-view-corr-content');
      if (corrSection && corrContent) {
        if (d.corrections && d.corrections.length > 0) {
          corrSection.style.display = 'block';
          corrContent.innerHTML = d.corrections.map(c => `
            <div style="padding:0.4rem 0; border-bottom:1px dashed #F59E0B;">
              <strong>${c.reference_txn || `CORR-${c.id}`}:</strong> ${c.movement_type} (${c.quantity} units) by <em>${c.performed_by}</em> &mdash;
              <span>${c.reason}</span>
            </div>
          `).join('');
        } else {
          corrSection.style.display = 'none';
        }
      }

      ui.openModal('movement-details-modal');
    } catch (err) {
      console.error('Error fetching movement details:', err);
      ui.showToast('Failed to load movement details.', 'error');
    }
  },

  printVoucher() {
    const d = this.currentMovementDetails;
    if (!d) {
      ui.showToast('No movement details selected to print.', 'warning');
      return;
    }

    const code = d.reference_txn || `MOV-${String(d.id).padStart(6, '0')}`;
    const printWin = window.open('', '_blank', 'width=800,height=700');
    if (!printWin) {
      ui.showToast('Pop-up was blocked. Please allow pop-ups for printable vouchers.', 'warning');
      return;
    }

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DairyTrack Movement Voucher - ${code}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 2rem; color: #1E293B; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #00A859; padding-bottom: 1rem; margin-bottom: 1.5rem; }
          .brand { font-size: 1.6rem; font-weight: 800; color: #00A859; }
          .tagline { font-size: 0.85rem; color: #64748B; }
          .voucher-title { font-size: 1.4rem; font-weight: 800; color: #0F172A; text-align: right; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
          .box { border: 1px solid #E2E8F0; border-radius: 8px; padding: 1rem; background: #F8FAFC; font-size: 0.875rem; }
          .box-title { font-weight: 800; color: #00A859; margin-bottom: 0.5rem; font-size: 0.95rem; text-transform: uppercase; }
          .stat-banner { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; text-align: center; }
          .stat-val { font-size: 1.3rem; font-weight: 800; color: #065F46; }
          .stat-lbl { font-size: 0.75rem; color: #047857; text-transform: uppercase; font-weight: 700; }
          .signature-row { display: flex; justify-content: space-between; margin-top: 3rem; padding-top: 1rem; border-top: 1px dashed #CBD5E1; font-size: 0.85rem; color: #64748B; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="/images/logo.png" alt="DairyTrack Logo" style="height:56px; max-width:180px; object-fit:contain;">
          </div>
          <div>
            <div class="voucher-title">STOCK MOVEMENT VOUCHER</div>
            <div style="text-align:right; font-family:monospace; font-weight:700;">${code}</div>
            <div style="text-align:right; font-size:0.8rem; color:#64748B;">Date: ${ui.formatDate(d.movement_date)}</div>
          </div>
        </div>

        <div class="stat-banner">
          <div>
            <div class="stat-lbl">Quantity Moved</div>
            <div class="stat-val">${d.quantity} ${d.display_unit || d.unit || 'Units'}</div>
          </div>
          <div>
            <div class="stat-lbl">Stock Evolution</div>
            <div class="stat-val" style="font-family:monospace;">${d.previous_stock !== null ? d.previous_stock : '-'} &rarr; ${d.updated_stock !== null ? d.updated_stock : '-'}</div>
          </div>
          <div>
            <div class="stat-lbl">Flow & Type</div>
            <div class="stat-val" style="font-size:1.05rem;">${d.flow_type} &bull; ${d.movement_type}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="box">
            <div class="box-title">Product Details</div>
            <div><strong>Product:</strong> ${d.product_name || '-'}</div>
            <div><strong>SKU:</strong> ${d.product_sku || '-'}</div>
            <div><strong>Category:</strong> ${d.category_name || 'Dairy'}</div>
            <div><strong>Measurement Unit:</strong> ${d.display_unit || d.unit || '-'}</div>
          </div>
          <div class="box">
            <div class="box-title">Perishable Batch Info</div>
            <div><strong>Batch Code:</strong> ${d.batch_number || 'All Batches'}</div>
            <div><strong>Mfg Date:</strong> ${d.batch_mfg_date ? ui.formatDate(d.batch_mfg_date) : 'N/A'}</div>
            <div><strong>Expiry Date:</strong> ${d.batch_expiry_date ? ui.formatDate(d.batch_expiry_date) : 'N/A'}</div>
            <div><strong>Live Stock:</strong> ${d.batch_current_quantity !== null && d.batch_current_quantity !== undefined ? `${d.batch_current_quantity} ${d.display_unit || d.unit || ''}` : 'N/A'}</div>
          </div>
        </div>

        <div class="box" style="margin-bottom: 1.5rem;">
          <div class="box-title">Audit Log & Authorization</div>
          <div><strong>Source Branch:</strong> ${d.from_branch_name || 'Main Shop'}</div>
          <div><strong>Destination Branch:</strong> ${d.to_branch_name || 'Local Store / Consumer'}</div>
          <div><strong>Recorded By Officer:</strong> ${d.performed_by || 'Staff'}</div>
          <div><strong>Audit Justification:</strong> ${d.reason || 'Operational stock change'}</div>
        </div>

        <div class="signature-row">
          <div>Prepared By: __________________________</div>
          <div>Audited & Verified By: __________________________</div>
          <div>Shop Manager Stamp / Signature</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(content);
    printWin.document.close();
  },

  // -------------------------------------------------------------
  // AUTHORIZED CORRECTION MODAL & OPERATIONS
  // -------------------------------------------------------------
  async openCorrectionModal(movementId = null) {
    const hiddenId = document.getElementById('corr-movement-id');
    const prodSelect = document.getElementById('corr-product');
    const batchSelect = document.getElementById('corr-batch');
    const infoBox = document.getElementById('corr-batch-info');
    const dirSelect = document.getElementById('corr-direction');
    const qtyInput = document.getElementById('corr-qty');
    const refInput = document.getElementById('corr-ref');
    const reasonInput = document.getElementById('corr-reason');

    if (hiddenId) hiddenId.value = movementId || '';
    if (qtyInput) qtyInput.value = '';
    if (refInput) refInput.value = `AUDIT-${Date.now().toString().slice(-6)}`;
    if (reasonInput) reasonInput.value = '';
    if (infoBox) infoBox.style.display = 'none';

    // Populate products
    if (prodSelect && state.products) {
      prodSelect.innerHTML = '<option value="">-- Choose Target Product --</option>' +
        state.products.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('');
    }

    if (movementId) {
      // Find movement or fetch details
      const m = this.movementsList.find(x => x.id === Number(movementId));
      if (m) {
        if (prodSelect) prodSelect.value = m.product_id;
        await this.onCorrProductChange();
        if (batchSelect && m.batch_id) {
          batchSelect.value = m.batch_id;
          this.onCorrBatchChange();
        }
        if (reasonInput) {
          reasonInput.value = `Variance identified against ${m.reference_txn || `MOV-${m.id}`}: `;
        }
      } else {
        await this.onCorrProductChange();
      }
    } else {
      await this.onCorrProductChange();
    }

    ui.openModal('movement-correction-modal');
  },

  openCorrectionForCurrent() {
    if (this.currentMovementDetails) {
      const id = this.currentMovementDetails.id;
      ui.closeModal('movement-details-modal');
      this.openCorrectionModal(id);
    } else {
      this.openCorrectionModal();
    }
  },

  async onCorrProductChange() {
    const prodId = document.getElementById('corr-product')?.value;
    const batchSelect = document.getElementById('corr-batch');
    const infoBox = document.getElementById('corr-batch-info');
    if (!batchSelect) return;

    if (!prodId) {
      batchSelect.innerHTML = '<option value="">-- Select Product First --</option>';
      if (infoBox) infoBox.style.display = 'none';
      this.corrProductBatches = [];
      return;
    }

    try {
      const res = await api.getBatches({ productId: prodId, status: 'Active' });
      if (res && res.success && res.data.length > 0) {
        this.corrProductBatches = res.data;
        batchSelect.innerHTML = res.data.map(b =>
          `<option value="${b.id}">${b.batch_number} (Avail: ${b.current_quantity} ${b.unit || ''} | Exp: ${ui.formatDate(b.expiry_date)})</option>`
        ).join('');
      } else {
        this.corrProductBatches = [];
        batchSelect.innerHTML = '<option value="">No active batches for this product</option>';
      }
      this.onCorrBatchChange();
    } catch (err) {
      console.error(err);
      this.corrProductBatches = [];
    }
  },

  onCorrBatchChange() {
    const batchId = document.getElementById('corr-batch')?.value;
    const infoBox = document.getElementById('corr-batch-info');
    if (!batchId || !this.corrProductBatches.length) {
      if (infoBox) infoBox.style.display = 'none';
      return;
    }

    const batch = this.corrProductBatches.find(b => String(b.id) === String(batchId));
    if (batch && infoBox) {
      infoBox.style.display = 'block';
      infoBox.innerHTML = `
        <strong>Batch Code:</strong> ${batch.batch_number} &nbsp;|&nbsp;
        <strong>Available Qty:</strong> <span style="font-weight:800; color:#B45309;">${batch.current_quantity} ${batch.unit || ''}</span> &nbsp;|&nbsp;
        <strong>Expires:</strong> ${ui.formatDate(batch.expiry_date)}
      `;
    }
  },

  onCorrDirectionChange() {
    // Optional hook if direction changes
  },

  async submitCorrection(e) {
    if (e && e.preventDefault) e.preventDefault();

    const movId = document.getElementById('corr-movement-id').value;
    const prodId = document.getElementById('corr-product').value;
    const batchId = document.getElementById('corr-batch').value;
    const direction = document.getElementById('corr-direction').value;
    const qty = parseFloat(document.getElementById('corr-qty').value);
    const ref = document.getElementById('corr-ref').value;
    const reason = document.getElementById('corr-reason').value;

    if (!prodId) {
      ui.showToast('Please select the target product.', 'warning');
      return;
    }

    if (!batchId) {
      ui.showToast('Please select the target batch for correction.', 'warning');
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      ui.showToast('Please enter a valid correction quantity (> 0).', 'warning');
      return;
    }

    if (!reason || reason.trim().length < 5) {
      ui.showToast('Audit rules require a detailed justification (min 5 characters).', 'warning');
      return;
    }

    const payload = {
      movement_id: movId ? Number(movId) : null,
      product_id: Number(prodId),
      batch_id: Number(batchId),
      correction_type: direction,
      quantity: qty,
      reference_txn: ref ? ref.trim() : null,
      reason: reason.trim()
    };

    try {
      const res = await api.createMovementCorrection(payload);
      if (res && res.success) {
        ui.showToast(res.message || 'Auditable correction successfully recorded!', 'success');
        ui.closeModal('movement-correction-modal');
        await this.loadStats();
        await this.loadMovements();
        if (typeof inventoryModule !== 'undefined' && inventoryModule.loadBatches) inventoryModule.loadBatches();
        if (typeof productsModule !== 'undefined' && productsModule.loadProducts) productsModule.loadProducts();
        if (typeof dashboardModule !== 'undefined' && dashboardModule.loadStats) dashboardModule.loadStats();
      } else {
        ui.showToast(res.error || 'Failed to record correction.', 'error');
      }
    } catch (err) {
      console.error(err);
      ui.showToast(err.message || 'Error recording auditable correction.', 'error');
    }
  },

  // -------------------------------------------------------------
  // EXCEL EXPORT
  // -------------------------------------------------------------
  downloadExcelReport() {
    const params = new URLSearchParams();

    if (this.currentFlow === 'inflow') {
      params.append('flow', 'inflow');
    } else if (this.currentFlow === 'outflow') {
      params.append('flow', 'outflow');
    }

    const typeVal = document.getElementById('mov-filter-type')?.value;
    if (typeVal && typeVal !== 'all') params.append('movement_type', typeVal);

    const prodVal = document.getElementById('mov-filter-product')?.value;
    if (prodVal && prodVal !== 'all') params.append('product_id', prodVal);

    const startVal = document.getElementById('mov-filter-start')?.value;
    if (startVal) params.append('startDate', startVal);

    const endVal = document.getElementById('mov-filter-end')?.value;
    if (endVal) params.append('endDate', endVal);

    const searchVal = document.getElementById('mov-filter-search')?.value?.trim();
    if (searchVal) params.append('search', searchVal);

    ui.showToast('Generating Excel Movement Audit Report...', 'info');
    window.location.href = `/api/reports/download/movements?${params.toString()}`;
  }
};
