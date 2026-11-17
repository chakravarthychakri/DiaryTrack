// ====================================================================
// MODULE 5: INVENTORY MANAGEMENT, FEFO ALLOCATION & STOCK LEDGER
// ====================================================================

const inventoryModule = {
  activeTab: 'batches',
  batchesList: [],
  reconList: [],
  historyList: [],
  historyPage: 1,
  historyTotalPages: 1,
  alertsData: null,
  activeReturnType: 'customer',

  async init() {
    this.bindEvents();
    this.populateBranchDropdowns();
    await Promise.all([
      this.loadDashboardSummary(),
      this.loadBatches(),
      this.loadAlertsCountOnly()
    ]);
  },

  bindEvents() {
    // Batches filters
    const searchInput = document.getElementById('batch-filter-search');
    const statusSelect = document.getElementById('batch-filter-status');
    const branchSelect = document.getElementById('batch-filter-branch');

    if (searchInput) searchInput.oninput = () => this.filterBatches();
    if (statusSelect) statusSelect.onchange = () => this.filterBatches();
    if (branchSelect) branchSelect.onchange = () => this.filterBatches();

    // Damage loss live preview calculator
    const damageQtyInput = document.getElementById('damage-qty');
    if (damageQtyInput) {
      damageQtyInput.oninput = () => this.updateDamageLossPreview();
    }
  },

  populateBranchDropdowns() {
    const branches = state.branches || [];
    const branchOpts = '<option value="all">All Branches</option>' +
      branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

    const bFilter = document.getElementById('batch-filter-branch');
    if (bFilter && bFilter.options.length <= 1) {
      bFilter.innerHTML = branchOpts;
    }
  },

  // -------------------------------------------------------------
  // SUB-TAB NAVIGATION
  // -------------------------------------------------------------
  switchTab(tabName) {
    this.activeTab = tabName;

    // Toggle button styles
    ['batches', 'reconciliation', 'history', 'alerts'].forEach(t => {
      const btn = document.getElementById(`inv-tab-btn-${t}`);
      const pane = document.getElementById(`inv-pane-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (pane) pane.style.display = (t === tabName) ? 'block' : 'none';
    });

    if (tabName === 'batches') {
      this.loadBatches();
    } else if (tabName === 'reconciliation') {
      this.loadReconciliation();
    } else if (tabName === 'history') {
      this.loadHistory();
    } else if (tabName === 'alerts') {
      this.loadAlerts();
    }
  },

  // -------------------------------------------------------------
  // 5.1: INVENTORY DASHBOARD KPI STATS
  // -------------------------------------------------------------
  async loadDashboardSummary() {
    try {
      const res = await api.getInventoryDashboard(state.currentBranchId);
      if (!res.success) return;

      const d = res.data;

      // 1. Available Inventory
      const availEl = document.getElementById('inv-kpi-available');
      const bCountEl = document.getElementById('inv-kpi-batches-count');
      if (availEl) availEl.textContent = `${d.available_inventory} Units`;
      if (bCountEl) bCountEl.textContent = `${d.active_batches} Active Batches`;

      // 2. Valuation
      const valEl = document.getElementById('inv-kpi-valuation');
      if (valEl) valEl.textContent = ui.formatCurrency(d.inventory_valuation);

      // 3. Low Stock
      const lowEl = document.getElementById('inv-kpi-low-stock');
      if (lowEl) lowEl.textContent = `${d.low_stock_items} SKUs`;

      // 4. Out of Stock
      const outEl = document.getElementById('inv-kpi-out-stock');
      if (outEl) outEl.textContent = `${d.out_of_stock_products} SKUs`;

      // 5. Near Expiry
      const nearEl = document.getElementById('inv-kpi-near-expiry');
      const nearSubEl = document.getElementById('inv-kpi-near-expiry-sub');
      if (nearEl) nearEl.textContent = `${d.near_expiry_warning.units} Units`;
      if (nearSubEl) {
        nearSubEl.textContent = `Critical: ${d.near_expiry_critical.units} in ≤${d.near_expiry_critical.days}d (${ui.formatCurrency(d.near_expiry_critical.value)})`;
      }

      // 6. Expired
      const expEl = document.getElementById('inv-kpi-expired');
      const expSubEl = document.getElementById('inv-kpi-expired-sub');
      if (expEl) expEl.textContent = `${d.expired_stock.units} Units`;
      if (expSubEl) expSubEl.textContent = `Loss: ${ui.formatCurrency(d.expired_stock.loss_value)}`;

      // 7. Damaged
      const damEl = document.getElementById('inv-kpi-damaged');
      const damSubEl = document.getElementById('inv-kpi-damaged-sub');
      if (damEl) damEl.textContent = `${d.damaged_stock.units} Units`;
      if (damSubEl) damSubEl.textContent = `Loss: ${ui.formatCurrency(d.damaged_stock.total_loss)}`;

    } catch (err) {
      console.error('Error loading inventory dashboard summary:', err);
    }
  },

  async loadAlertsCountOnly() {
    try {
      const res = await api.getInventoryAlerts(state.currentBranchId);
      if (res.success && res.data) {
        const badge = document.getElementById('inv-alert-badge-count');
        if (badge) {
          badge.textContent = res.data.total_alerts || 0;
          badge.style.display = (res.data.total_alerts > 0) ? 'inline-block' : 'none';
        }
      }
    } catch (err) {
      console.error('Error loading alert count:', err);
    }
  },

  // -------------------------------------------------------------
  // 5.4: ACTIVE BATCHES & FEFO ORDERING
  // -------------------------------------------------------------
  async loadBatches() {
    try {
      ui.renderSkeleton('batches-table-body', 6);
      const res = await api.getBatches({ branchId: state.currentBranchId });
      if (res.success) {
        this.batchesList = res.data;
        this.filterBatches();
      }
    } catch (err) {
      console.error('Error loading batches:', err);
    }
  },

  filterBatches() {
    const search = (document.getElementById('batch-filter-search')?.value || '').toLowerCase().trim();
    const status = document.getElementById('batch-filter-status')?.value || 'all';
    const branch = document.getElementById('batch-filter-branch')?.value || 'all';

    let filtered = this.batchesList.filter(b => {
      const matchesSearch = !search ||
        (b.batch_number && b.batch_number.toLowerCase().includes(search)) ||
        (b.product_name && b.product_name.toLowerCase().includes(search)) ||
        (b.sku && b.sku.toLowerCase().includes(search)) ||
        (b.supplier_name && b.supplier_name.toLowerCase().includes(search));

      const matchesStatus = status === 'all' || b.dynamic_status === status;
      const matchesBranch = branch === 'all' || String(b.branch_id) === String(branch);

      return matchesSearch && matchesStatus && matchesBranch;
    });

    this.renderBatchesTable(filtered);
  },

  renderBatchesTable(items) {
    const tbody = document.getElementById('batches-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
            No batches found matching current filters.
          </td>
        </tr>
      `;
      return;
    }

    // FEFO ranking counter for active batches
    let fefoRank = 1;
    let html = '';

    items.forEach(b => {
      const isAvailable = Number(b.current_quantity) > 0;
      const daysUntil = b.days_until_expiry !== undefined ? b.days_until_expiry : this.calcDaysDiff(b.expiry_date);

      // Expiry tag & badge
      let expiryTag = '';
      if (daysUntil < 0) {
        expiryTag = `<span class="status-chip badge-danger">🚨 Expired ${Math.abs(daysUntil)}d ago</span>`;
      } else if (daysUntil <= 3) {
        expiryTag = `<span class="status-chip badge-danger">🚨 Critical: ${daysUntil}d left</span>`;
      } else if (daysUntil <= 7) {
        expiryTag = `<span class="status-chip badge-warning">⚠️ Warning: ${daysUntil}d left</span>`;
      } else {
        expiryTag = `<span class="status-chip badge-success">🟢 Fresh (${daysUntil}d)</span>`;
      }

      // FEFO Priority Badge
      let fefoBadge = '<span style="color:var(--text-muted); font-size:0.75rem;">-</span>';
      if (isAvailable && daysUntil >= 0) {
        if (fefoRank === 1) {
          fefoBadge = `<span class="fefo-badge fefo-badge-primary" title="Allocated first during checkout">#1 Next to Sell</span>`;
        } else {
          fefoBadge = `<span class="fefo-badge">#${fefoRank} FEFO</span>`;
        }
        fefoRank++;
      } else if (isAvailable && daysUntil < 0) {
        fefoBadge = `<span class="fefo-badge" style="background:#FEE2E2; color:#991B1B; border-color:#FECACA;">Quarantine</span>`;
      }

      html += `
        <tr>
          <td>${fefoBadge}</td>
          <td>
            <div style="font-weight:700; font-family:monospace; font-size:0.875rem; color:var(--text-primary);">${b.batch_number}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">Batch #${b.id}</div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-primary);">${b.product_name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              ${b.sku} • ${b.category_name || 'Dairy'}
              ${b.storage_temperature ? ` • <span style="color:#0284C7;">🌡️ ${b.storage_temperature}</span>` : ''}
            </div>
          </td>
          <td>
            <span style="font-size:0.8rem; font-weight:600;">${b.branch_name || 'Main Shop'}</span>
          </td>
          <td>
            <span style="font-size:0.8rem; color:var(--text-secondary);">${b.supplier_name || 'Direct / Vendor'}</span>
          </td>
          <td>${ui.formatDate(b.mfg_date)}</td>
          <td>
            <div style="font-weight:700;">${ui.formatDate(b.expiry_date)}</div>
            <div style="margin-top:2px;">${expiryTag}</div>
          </td>
          <td>
            <span style="font-size:0.95rem; font-weight:800; color:${isAvailable ? 'var(--text-primary)' : 'var(--text-muted)'};">
              ${b.current_quantity}
            </span>
            <span style="font-size:0.75rem; color:var(--text-muted);">/ ${b.initial_quantity} ${b.unit || 'Units'}</span>
          </td>
          <td>${ui.formatCurrency(b.purchase_cost)}</td>
          <td style="font-weight:700; color:var(--primary-dark);">${ui.formatCurrency(b.batch_valuation)}</td>
          <td>
            <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
              ${isAvailable ? `
                <button class="btn btn-sm btn-secondary" onclick="inventoryModule.openAdjustStockModal(${b.id})" title="Adjust stock count">
                  Adjust
                </button>
                <button class="btn btn-sm btn-secondary" onclick="inventoryModule.openTransferStockModal(${b.id})" title="Transfer to another branch">
                  Transfer
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="inventoryModule.openRecordDamageModal(${b.id}, '${this.escapeJs(b.product_name)}', '${b.batch_number}', ${b.current_quantity}, ${b.purchase_cost}, '${b.unit}')" title="Record spoilage / damage">
                  Damage
                </button>
              ` : `
                <span style="font-size:0.75rem; color:var(--text-muted);">Depleted</span>
              `}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  calcDaysDiff(dateStr) {
    if (!dateStr) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diff = target.getTime() - now.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  },

  escapeJs(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  },

  // -------------------------------------------------------------
  // 5.2: STOCK RECONCILIATION FORMULA LEDGER
  // -------------------------------------------------------------
  async loadReconciliation() {
    try {
      ui.renderSkeleton('recon-table-body', 6);
      const res = await api.getInventoryReconciliation({ branchId: state.currentBranchId });
      if (res.success) {
        this.reconList = res.data;
        this.filterReconciliation();
      }
    } catch (err) {
      console.error('Error loading reconciliation:', err);
    }
  },

  filterReconciliation() {
    const search = (document.getElementById('recon-filter-search')?.value || '').toLowerCase().trim();
    const varianceFilter = document.getElementById('recon-filter-variance')?.value || 'all';

    let filtered = this.reconList.filter(item => {
      const matchesSearch = !search ||
        item.product_name.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search);

      const matchesVariance = varianceFilter === 'all' ||
        (varianceFilter === 'reconciled' && item.is_reconciled) ||
        (varianceFilter === 'discrepancy' && !item.is_reconciled);

      return matchesSearch && matchesVariance;
    });

    this.renderReconciliationTable(filtered);
  },

  renderReconciliationTable(items) {
    const tbody = document.getElementById('recon-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="15" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
            No products found for reconciliation audit.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(r => {
      const statusChip = r.is_reconciled ?
        '<span class="status-chip badge-success">✅ Reconciled</span>' :
        `<span class="status-chip badge-danger" title="Discrepancy: ${r.variance} ${r.unit}">⚠️ Discrepancy (${r.variance > 0 ? '+' : ''}${r.variance})</span>`;

      html += `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--text-primary);">${r.product_name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${r.sku} • ${r.unit}</div>
          </td>
          <td class="movement-neutral">${r.opening_stock}</td>
          <td class="movement-in">+${r.purchases_received}</td>
          <td class="movement-in">${r.sale_returns > 0 ? `+${r.sale_returns}` : '0'}</td>
          <td class="movement-in">${r.transfers_in > 0 ? `+${r.transfers_in}` : '0'}</td>
          <td class="movement-out">-${r.sales}</td>
          <td class="movement-out">${r.supplier_returns > 0 ? `-${r.supplier_returns}` : '0'}</td>
          <td class="movement-out">${r.transfers_out > 0 ? `-${r.transfers_out}` : '0'}</td>
          <td class="movement-out">${r.expired_stock > 0 ? `-${r.expired_stock}` : '0'}</td>
          <td class="movement-out">${r.damaged_stock > 0 ? `-${r.damaged_stock}` : '0'}</td>
          <td>
            ${r.other_inflows > 0 ? `<span class="movement-in">+${r.other_inflows}</span>` : ''}
            ${r.other_outflows > 0 ? `<span class="movement-out">-${r.other_outflows}</span>` : ''}
            ${r.other_inflows === 0 && r.other_outflows === 0 ? '<span style="color:var(--text-muted);">0</span>' : ''}
          </td>
          <td style="font-weight:800; background:rgba(22, 163, 74, 0.05); font-size:0.9rem;">
            ${r.calculated_closing_stock} ${r.unit}
          </td>
          <td style="font-weight:800; background:rgba(59, 130, 246, 0.05); font-size:0.9rem; color:var(--primary-dark);">
            ${r.actual_on_hand_stock} ${r.unit}
          </td>
          <td style="font-weight:700; color:${r.variance === 0 ? 'var(--success)' : 'var(--danger)'};">
            ${r.variance > 0 ? `+${r.variance}` : r.variance} ${r.unit}
          </td>
          <td>${statusChip}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 5.3: STOCK MOVEMENT HISTORY AUDIT LEDGER
  // -------------------------------------------------------------
  async loadHistory() {
    try {
      ui.renderSkeleton('history-table-body', 6);

      const params = {
        branchId: state.currentBranchId,
        page: this.historyPage,
        limit: 15,
        movementType: document.getElementById('history-filter-type')?.value,
        search: document.getElementById('history-filter-search')?.value,
        startDate: document.getElementById('history-filter-start')?.value,
        endDate: document.getElementById('history-filter-end')?.value
      };

      const res = await api.getInventoryHistory(params);
      if (res.success) {
        this.historyList = res.data;
        this.historyTotalPages = res.pagination.totalPages || 1;
        this.renderHistoryTable(res.data, res.pagination);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  },

  debouncedFilterHistory() {
    clearTimeout(this._histTimer);
    this._histTimer = setTimeout(() => {
      this.historyPage = 1;
      this.loadHistory();
    }, 300);
  },

  resetHistoryFilters() {
    const searchEl = document.getElementById('history-filter-search');
    const typeEl = document.getElementById('history-filter-type');
    const startEl = document.getElementById('history-filter-start');
    const endEl = document.getElementById('history-filter-end');

    if (searchEl) searchEl.value = '';
    if (typeEl) typeEl.value = 'all';
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';

    this.historyPage = 1;
    this.loadHistory();
  },

  prevHistoryPage() {
    if (this.historyPage > 1) {
      this.historyPage--;
      this.loadHistory();
    }
  },

  nextHistoryPage() {
    if (this.historyPage < this.historyTotalPages) {
      this.historyPage++;
      this.loadHistory();
    }
  },

  renderHistoryTable(items, pagination) {
    const tbody = document.getElementById('history-table-body');
    const pageInfo = document.getElementById('history-pagination-info');
    const prevBtn = document.getElementById('history-prev-btn');
    const nextBtn = document.getElementById('history-next-btn');
    const indicator = document.getElementById('history-page-indicator');

    if (pageInfo && pagination) {
      pageInfo.textContent = `Showing ${items.length} of ${pagination.totalRecords} stock movements`;
    }
    if (indicator && pagination) {
      indicator.textContent = `Page ${pagination.page} of ${pagination.totalPages || 1}`;
    }
    if (prevBtn) prevBtn.disabled = this.historyPage <= 1;
    if (nextBtn) nextBtn.disabled = this.historyPage >= this.historyTotalPages;

    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
            No stock movement ledger records found.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(m => {
      let typeBadge = 'badge-info';
      if (['Purchase Received', 'Opening Stock', 'Transfer In', 'Sale Return'].includes(m.movement_type)) {
        typeBadge = 'badge-success';
      } else if (['Sale', 'Damage', 'Expired', 'Transfer Out', 'Supplier Return'].includes(m.movement_type)) {
        typeBadge = 'badge-danger';
      } else if (m.movement_type === 'Adjustment') {
        typeBadge = 'badge-warning';
      }

      const isPositive = ['Purchase Received', 'Opening Stock', 'Transfer In', 'Sale Return'].includes(m.movement_type);

      html += `
        <tr>
          <td>
            <div style="font-weight:600; font-size:0.825rem;">${ui.formatDate(m.movement_date || m.created_at)}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${m.created_at ? m.created_at.slice(11, 16) : ''}</div>
          </td>
          <td>
            <span class="status-chip ${typeBadge}">${m.movement_type}</span>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-primary);">${m.product_name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">
              ${m.batch_number ? `Batch: ${m.batch_number}` : ''} ${m.sku ? `• ${m.sku}` : ''}
            </div>
          </td>
          <td>
            <span style="font-weight:800; font-size:0.95rem; color:${isPositive ? 'var(--success)' : 'var(--danger)'};">
              ${isPositive ? '+' : '-'}${m.quantity} ${m.unit || 'Units'}
            </span>
          </td>
          <td>
            <div style="font-size:0.8rem; font-weight:600;">
              ${m.from_branch_name ? `${m.from_branch_name} ➔ ` : ''}${m.to_branch_name || 'Branch'}
            </div>
          </td>
          <td>
            <span style="font-size:0.8rem; color:var(--text-secondary);">${m.reason || '-'}</span>
          </td>
          <td style="font-weight:700; color:var(--primary-dark);">
            ${ui.formatCurrency(m.cost_impact || 0)}
          </td>
          <td>
            <span style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">${m.performed_by || 'System'}</span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 5.5: LIVE ALERTS & UNUSUAL ADJUSTMENTS
  // -------------------------------------------------------------
  async loadAlerts() {
    try {
      const container = document.getElementById('inv-alerts-list');
      if (container) {
        container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted);">Checking perishable inventory alerts...</div>';
      }

      const res = await api.getInventoryAlerts(state.currentBranchId);
      if (!res.success) return;

      this.alertsData = res.data;

      // Update badge
      const badge = document.getElementById('inv-alert-badge-count');
      if (badge) {
        badge.textContent = res.data.total_alerts || 0;
        badge.style.display = (res.data.total_alerts > 0) ? 'inline-block' : 'none';
      }

      this.renderAlertsView(res.data);
    } catch (err) {
      console.error('Error loading inventory alerts:', err);
    }
  },

  renderAlertsView(data) {
    const container = document.getElementById('inv-alerts-list');
    if (!container) return;

    if (!data.total_alerts) {
      container.innerHTML = `
        <div style="text-align:center; padding:3rem; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg);">
          <div style="font-size:2.5rem; margin-bottom:0.75rem;">🎉</div>
          <h4 style="font-weight:700; font-size:1.1rem; color:var(--primary-dark); margin-bottom:0.25rem;">All Inventory Clear!</h4>
          <p style="color:var(--text-muted); font-size:0.875rem;">No near-expiry batches, stockouts, or unusual stock adjustments detected at this time.</p>
        </div>
      `;
      return;
    }

    let html = '';

    // 1. Expired Batches on Shelf (Critical Danger)
    if (data.expired_on_shelf && data.expired_on_shelf.length) {
      html += `
        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.95rem; font-weight:700; color:var(--danger); display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            🚨 Expired Products on Shelf (${data.expired_on_shelf.length} Batches) - Immediate Quarantine Required
          </h4>
      `;
      data.expired_on_shelf.forEach(b => {
        html += `
          <div class="alert-item-card critical">
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${b.product_name} (${b.sku})</div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                Batch: <strong style="font-family:monospace;">${b.batch_number}</strong> • Branch: <strong>${b.branch_name}</strong> • Expiry Date: <strong style="color:var(--danger);">${ui.formatDate(b.expiry_date)}</strong>
              </div>
              <div style="font-size:0.8rem; margin-top:4px;">
                Remaining: <strong style="color:var(--danger);">${b.current_quantity} ${b.unit}</strong> • Estimated Loss: <strong>${ui.formatCurrency(b.potential_loss)}</strong>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-sm btn-outline-danger" onclick="inventoryModule.openRecordDamageModal(${b.id}, '${this.escapeJs(b.product_name)}', '${b.batch_number}', ${b.current_quantity}, ${b.purchase_cost}, '${b.unit}')">
                Quarantine & Write-Off
              </button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // 2. Critical Expiry (<= 3 Days)
    if (data.near_expiry_critical && data.near_expiry_critical.length) {
      html += `
        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.95rem; font-weight:700; color:#DC2626; display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            🔥 Critical Expiry (${data.near_expiry_critical.length} Batches expiring in ≤${data.settings.critical_days} Days)
          </h4>
      `;
      data.near_expiry_critical.forEach(b => {
        html += `
          <div class="alert-item-card critical">
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${b.product_name} (${b.sku})</div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                Batch: <strong style="font-family:monospace;">${b.batch_number}</strong> • Branch: <strong>${b.branch_name}</strong> • Expiry: <strong>${ui.formatDate(b.expiry_date)}</strong> (${b.days_until_expiry} days left)
              </div>
              <div style="font-size:0.8rem; margin-top:4px;">
                Stock: <strong>${b.current_quantity} ${b.unit}</strong> • Value at Risk: <strong style="color:#DC2626;">${ui.formatCurrency(b.potential_loss)}</strong>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-sm btn-secondary" onclick="app.navigate('sales')">
                Promote at POS
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="inventoryModule.openRecordDamageModal(${b.id}, '${this.escapeJs(b.product_name)}', '${b.batch_number}', ${b.current_quantity}, ${b.purchase_cost}, '${b.unit}')">
                Write-Off
              </button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // 3. Warning Expiry (4-7 Days)
    if (data.near_expiry_warning && data.near_expiry_warning.length) {
      html += `
        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.95rem; font-weight:700; color:var(--warning); display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            ⚠️ Near Expiry Warning (${data.near_expiry_warning.length} Batches expiring in ≤${data.settings.warning_days} Days)
          </h4>
      `;
      data.near_expiry_warning.forEach(b => {
        html += `
          <div class="alert-item-card warning">
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${b.product_name} (${b.sku})</div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                Batch: <strong style="font-family:monospace;">${b.batch_number}</strong> • Branch: <strong>${b.branch_name}</strong> • Expiry: <strong>${ui.formatDate(b.expiry_date)}</strong> (${b.days_until_expiry} days)
              </div>
              <div style="font-size:0.8rem; margin-top:4px;">
                Available: <strong>${b.current_quantity} ${b.unit}</strong> • Valuation: <strong>${ui.formatCurrency(b.potential_loss)}</strong>
              </div>
            </div>
            <div>
              <button class="btn btn-sm btn-secondary" onclick="inventoryModule.switchTab('batches')">
                View in FEFO
              </button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // 4. Out of Stock Products
    if (data.out_of_stock && data.out_of_stock.length) {
      html += `
        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.95rem; font-weight:700; color:var(--danger); display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            ❌ Out of Stock SKUs (${data.out_of_stock.length} Products with Zero Stock)
          </h4>
      `;
      data.out_of_stock.forEach(p => {
        html += `
          <div class="alert-item-card critical">
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${p.name} (${p.sku})</div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                Category: <strong>${p.category_name}</strong> • Min Level: <strong>${p.min_stock_level} ${p.unit}</strong>
              </div>
              <div style="font-size:0.8rem; color:var(--danger); font-weight:700; margin-top:4px;">
                Currently 0 ${p.unit} in stock. Customer sales blocked.
              </div>
            </div>
            <div>
              <button class="btn btn-sm btn-primary" onclick="inventoryModule.openReceiveStockModal(${p.id})">
                + Intake Stock
              </button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // 5. Low Stock Products
    if (data.low_stock && data.low_stock.length) {
      html += `
        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.95rem; font-weight:700; color:var(--warning); display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            📉 Low Stock Items (${data.low_stock.length} SKUs Below Minimum Reorder Level)
          </h4>
      `;
      data.low_stock.forEach(p => {
        html += `
          <div class="alert-item-card warning">
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${p.name} (${p.sku})</div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                Available Stock: <strong style="color:var(--warning); font-size:0.95rem;">${p.current_stock} ${p.unit}</strong> • Min Required: <strong>${p.min_stock_level} ${p.unit}</strong>
              </div>
            </div>
            <div>
              <button class="btn btn-sm btn-primary" onclick="inventoryModule.openReceiveStockModal(${p.id})">
                Reorder / Receive
              </button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // 6. Unusual Stock Adjustments
    if (data.unusual_adjustments && data.unusual_adjustments.length) {
      html += `
        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.95rem; font-weight:700; color:#7C3AED; display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            ⚡ Unusual Stock Adjustments (${data.unusual_adjustments.length} Flagged Movements)
          </h4>
      `;
      data.unusual_adjustments.forEach(a => {
        html += `
          <div class="alert-item-card adjustment">
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${a.product_name} (${a.batch_number})</div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">
                Adjusted by: <strong>${a.performed_by}</strong> on ${ui.formatDate(a.movement_date || a.created_at)}
              </div>
              <div style="font-size:0.8rem; margin-top:4px;">
                Quantity Change: <strong style="color:#7C3AED;">${a.quantity} units</strong> • Financial Impact: <strong>${ui.formatCurrency(a.cost_impact)}</strong> • Reason: <em>${a.reason}</em>
              </div>
            </div>
            <div>
              <span class="status-chip badge-warning">Audit Review</span>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    container.innerHTML = html;
  },

  // -------------------------------------------------------------
  // MODAL 1: RECEIVE STOCK (BATCH INTAKE)
  // -------------------------------------------------------------
  openReceiveStockModal(presetProductId) {
    const prodSelect = document.getElementById('batch-form-product');
    const branchSelect = document.getElementById('batch-form-branch');
    const suppSelect = document.getElementById('batch-form-supplier');

    // Populate products
    if (prodSelect) {
      prodSelect.innerHTML = '<option value="">-- Choose Product --</option>' +
        (state.products || []).map(p => `
          <option value="${p.id}" data-shelf="${p.shelf_life_days || 3}" data-cost="${p.purchase_price || 0}" data-price="${p.selling_price || 0}" data-unit="${p.unit || 'Units'}" ${presetProductId && p.id === presetProductId ? 'selected' : ''}>
            ${p.name} (${p.sku})
          </option>
        `).join('');
    }

    // Populate branches
    if (branchSelect) {
      branchSelect.innerHTML = (state.branches || []).map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    // Populate suppliers
    if (suppSelect) {
      suppSelect.innerHTML = '<option value="">-- Direct / Unknown Vendor --</option>' +
        (state.suppliers || []).map(s => `<option value="${s.id}">${s.name} (${s.contact_person || 'Supplier'})</option>`).join('');
    }

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('batch-form-mfg').value = today;
    document.getElementById('batch-form-number').value = `BAT-${Date.now().toString().slice(-6)}`;
    document.getElementById('batch-form-qty').value = '50';

    if (presetProductId) {
      this.onBatchProductChange();
    } else {
      document.getElementById('batch-form-expiry').value = '';
      document.getElementById('batch-form-cost').value = '';
      document.getElementById('batch-form-price').value = '';
    }

    ui.openModal('batch-modal');
  },

  // Backwards compatibility alias
  openNewModal() {
    this.openReceiveStockModal();
  },

  onBatchProductChange() {
    const select = document.getElementById('batch-form-product');
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) return;

    const shelf = Number(opt.dataset.shelf) || 3;
    const cost = Number(opt.dataset.cost) || 0;
    const price = Number(opt.dataset.price) || 0;
    const unit = opt.dataset.unit || 'Units';

    const unitLabel = document.getElementById('batch-form-unit-label');
    if (unitLabel) unitLabel.textContent = unit;

    const mfgVal = document.getElementById('batch-form-mfg').value;
    const mfgDate = mfgVal ? new Date(mfgVal) : new Date();
    const expDate = new Date(mfgDate);
    expDate.setDate(expDate.getDate() + shelf);

    document.getElementById('batch-form-expiry').value = expDate.toISOString().split('T')[0];
    document.getElementById('batch-form-cost').value = cost;
    document.getElementById('batch-form-price').value = price;
  },

  // Backwards compatibility alias
  onProductChange() {
    this.onBatchProductChange();
  },

  async submitReceiveStock(e) {
    e.preventDefault();
    const payload = {
      product_id: Number(document.getElementById('batch-form-product').value),
      branch_id: Number(document.getElementById('batch-form-branch').value) || 1,
      supplier_id: document.getElementById('batch-form-supplier').value ? Number(document.getElementById('batch-form-supplier').value) : null,
      batch_number: document.getElementById('batch-form-number').value.trim(),
      mfg_date: document.getElementById('batch-form-mfg').value,
      expiry_date: document.getElementById('batch-form-expiry').value,
      quantity: Number(document.getElementById('batch-form-qty').value),
      purchase_cost: Number(document.getElementById('batch-form-cost').value),
      selling_price: Number(document.getElementById('batch-form-price').value),
      invoice_ref: document.getElementById('batch-form-invoice')?.value.trim(),
      notes: document.getElementById('batch-form-notes')?.value.trim()
    };

    try {
      const res = await api.receiveStock(payload);
      if (res.success) {
        ui.showToast(res.message || 'Stock received into inventory successfully!', 'success');
        ui.closeModal('batch-modal');
        await this.loadBatches();
        await this.loadDashboardSummary();
        await this.loadAlertsCountOnly();
        if (productsModule.loadProducts) productsModule.loadProducts();
        if (dashboardModule.loadStats) dashboardModule.loadStats();
      } else {
        ui.showToast(res.error || 'Failed to receive stock', 'danger');
      }
    } catch (err) {
      ui.showToast(err.message || 'Error receiving stock', 'danger');
    }
  },

  // Backwards compatibility alias
  submitForm(e) {
    this.submitReceiveStock(e);
  },

  // -------------------------------------------------------------
  // MODAL 2: OPENING STOCK
  // -------------------------------------------------------------
  openOpeningStockModal() {
    const prodSelect = document.getElementById('opening-stock-product');
    const branchSelect = document.getElementById('opening-stock-branch');

    if (prodSelect) {
      prodSelect.innerHTML = '<option value="">-- Choose Product --</option>' +
        (state.products || []).map(p => `
          <option value="${p.id}" data-shelf="${p.shelf_life_days || 3}" data-cost="${p.purchase_price || 0}" data-price="${p.selling_price || 0}" data-unit="${p.unit || 'Units'}">
            ${p.name} (${p.sku})
          </option>
        `).join('');
    }

    if (branchSelect) {
      branchSelect.innerHTML = (state.branches || []).map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    document.getElementById('opening-stock-batch-no').value = `OPEN-${Date.now().toString().slice(-6)}`;
    document.getElementById('opening-stock-qty').value = '100';
    document.getElementById('opening-stock-notes').value = 'Initial shop inventory count';

    ui.openModal('opening-stock-modal');
  },

  onOpeningProductChange() {
    const select = document.getElementById('opening-stock-product');
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) return;

    const shelf = Number(opt.dataset.shelf) || 3;
    const cost = Number(opt.dataset.cost) || 0;
    const price = Number(opt.dataset.price) || 0;
    const unit = opt.dataset.unit || 'Units';

    const unitLabel = document.getElementById('opening-stock-unit-label');
    if (unitLabel) unitLabel.textContent = unit;

    const today = new Date();
    today.setDate(today.getDate() + shelf);
    document.getElementById('opening-stock-expiry').value = today.toISOString().split('T')[0];
    document.getElementById('opening-stock-cost').value = cost;
    document.getElementById('opening-stock-price').value = price;
  },

  async submitOpeningStock(e) {
    e.preventDefault();
    const payload = {
      product_id: Number(document.getElementById('opening-stock-product').value),
      branch_id: Number(document.getElementById('opening-stock-branch').value) || 1,
      batch_number: document.getElementById('opening-stock-batch-no').value.trim(),
      quantity: Number(document.getElementById('opening-stock-qty').value),
      purchase_cost: Number(document.getElementById('opening-stock-cost').value),
      selling_price: Number(document.getElementById('opening-stock-price').value),
      expiry_date: document.getElementById('opening-stock-expiry').value,
      notes: document.getElementById('opening-stock-notes').value.trim()
    };

    try {
      const res = await api.addOpeningStock(payload);
      if (res.success) {
        ui.showToast(res.message || 'Opening stock established successfully!', 'success');
        ui.closeModal('opening-stock-modal');
        await this.loadBatches();
        await this.loadDashboardSummary();
        await this.loadAlertsCountOnly();
        if (productsModule.loadProducts) productsModule.loadProducts();
      } else {
        ui.showToast(res.error || 'Failed to save opening stock', 'danger');
      }
    } catch (err) {
      ui.showToast(err.message || 'Error saving opening stock', 'danger');
    }
  },

  // -------------------------------------------------------------
  // MODAL 3: ADJUST STOCK
  // -------------------------------------------------------------
  openAdjustStockModal(targetBatchId) {
    const select = document.getElementById('adjust-batch-select');
    if (select) {
      select.innerHTML = '<option value="">-- Choose Batch to Adjust --</option>' +
        this.batchesList.filter(b => b.current_quantity > 0 || b.id === targetBatchId).map(b => `
          <option value="${b.id}" data-name="${this.escapeJs(b.product_name)}" data-qty="${b.current_quantity}" data-cost="${b.purchase_cost}" data-unit="${b.unit}" data-batch="${b.batch_number}" ${targetBatchId && b.id === targetBatchId ? 'selected' : ''}>
            ${b.batch_number} - ${b.product_name} (${b.current_quantity} ${b.unit} available)
          </option>
        `).join('');
    }

    document.getElementById('adjust-qty').value = '';
    document.getElementById('adjust-notes').value = '';

    if (targetBatchId) {
      this.onAdjustBatchChange();
    } else {
      const info = document.getElementById('adjust-batch-info');
      if (info) info.style.display = 'none';
    }

    ui.openModal('adjust-stock-modal');
  },

  onAdjustBatchChange() {
    const select = document.getElementById('adjust-batch-select');
    const opt = select.options[select.selectedIndex];
    const info = document.getElementById('adjust-batch-info');
    if (!opt || !opt.value) {
      if (info) info.style.display = 'none';
      return;
    }

    if (info) {
      info.style.display = 'block';
      info.innerHTML = `
        <strong>${opt.dataset.name}</strong> • Batch: <code>${opt.dataset.batch}</code><br>
        Current Stock: <strong>${opt.dataset.qty} ${opt.dataset.unit}</strong> | Unit Cost: <strong>${ui.formatCurrency(opt.dataset.cost)}</strong>
      `;
    }
  },

  async submitAdjustStock(e) {
    e.preventDefault();
    const payload = {
      batch_id: Number(document.getElementById('adjust-batch-select').value),
      adjustment_type: document.getElementById('adjust-type').value,
      quantity: Number(document.getElementById('adjust-qty').value),
      reason: document.getElementById('adjust-reason').value,
      notes: document.getElementById('adjust-notes').value.trim()
    };

    try {
      const res = await api.adjustStock(payload);
      if (res.success) {
        ui.showToast(res.message || 'Stock adjusted successfully!', 'success');
        ui.closeModal('adjust-stock-modal');
        await this.loadBatches();
        await this.loadDashboardSummary();
        await this.loadAlertsCountOnly();
        if (productsModule.loadProducts) productsModule.loadProducts();
      } else {
        ui.showToast(res.error || 'Failed to adjust stock', 'danger');
      }
    } catch (err) {
      ui.showToast(err.message || 'Error adjusting stock', 'danger');
    }
  },

  // -------------------------------------------------------------
  // MODAL 4: INTER-BRANCH STOCK TRANSFER
  // -------------------------------------------------------------
  openTransferStockModal(targetBatchId) {
    const fromSelect = document.getElementById('transfer-from-branch');
    const toSelect = document.getElementById('transfer-to-branch');
    const batchSelect = document.getElementById('transfer-batch-select');

    const branches = state.branches || [];

    if (fromSelect) {
      fromSelect.innerHTML = branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    if (toSelect) {
      toSelect.innerHTML = branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
      if (branches.length > 1) toSelect.selectedIndex = 1;
    }

    this.onTransferFromChange(targetBatchId);
    document.getElementById('transfer-qty').value = '';
    document.getElementById('transfer-notes').value = '';

    ui.openModal('transfer-stock-modal');
  },

  onTransferFromChange(targetBatchId) {
    const fromBranchId = document.getElementById('transfer-from-branch')?.value;
    const batchSelect = document.getElementById('transfer-batch-select');

    if (!batchSelect) return;

    const available = this.batchesList.filter(b =>
      b.current_quantity > 0 && (!fromBranchId || String(b.branch_id) === String(fromBranchId))
    );

    batchSelect.innerHTML = '<option value="">-- Choose Batch to Transfer --</option>' +
      available.map(b => `
        <option value="${b.id}" data-name="${this.escapeJs(b.product_name)}" data-qty="${b.current_quantity}" data-unit="${b.unit}" data-batch="${b.batch_number}" ${targetBatchId && b.id === targetBatchId ? 'selected' : ''}>
          ${b.batch_number} - ${b.product_name} (${b.current_quantity} ${b.unit} available)
        </option>
      `).join('');

    this.onTransferBatchChange();
  },

  onTransferBatchChange() {
    const select = document.getElementById('transfer-batch-select');
    const opt = select.options[select.selectedIndex];
    const info = document.getElementById('transfer-batch-info');

    if (!opt || !opt.value) {
      if (info) info.style.display = 'none';
      return;
    }

    if (info) {
      info.style.display = 'block';
      info.innerHTML = `
        Transferring: <strong>${opt.dataset.name}</strong> (${opt.dataset.batch})<br>
        Source Available: <strong>${opt.dataset.qty} ${opt.dataset.unit}</strong>
      `;
    }
  },

  async submitTransferStock(e) {
    e.preventDefault();
    const fromBranch = Number(document.getElementById('transfer-from-branch').value);
    const toBranch = Number(document.getElementById('transfer-to-branch').value);

    if (fromBranch === toBranch) {
      ui.showToast('Source and Destination branches must be different.', 'warning');
      return;
    }

    const payload = {
      batch_id: Number(document.getElementById('transfer-batch-select').value),
      from_branch_id: fromBranch,
      to_branch_id: toBranch,
      quantity: Number(document.getElementById('transfer-qty').value),
      transfer_reason: document.getElementById('transfer-reason').value,
      notes: document.getElementById('transfer-notes').value.trim()
    };

    try {
      const res = await api.transferStock(payload);
      if (res.success) {
        ui.showToast(res.message || 'Stock transferred successfully!', 'success');
        ui.closeModal('transfer-stock-modal');
        await this.loadBatches();
        await this.loadDashboardSummary();
      } else {
        ui.showToast(res.error || 'Failed to transfer stock', 'danger');
      }
    } catch (err) {
      ui.showToast(err.message || 'Error transferring stock', 'danger');
    }
  },

  // -------------------------------------------------------------
  // MODAL 5: PROCESS RETURNS (CUSTOMER & SUPPLIER)
  // -------------------------------------------------------------
  openReturnModal() {
    // Populate customers
    const custSelect = document.getElementById('return-customer-select');
    if (custSelect) {
      custSelect.innerHTML = '<option value="">Walk-in Retail Customer</option>' +
        (state.customers || []).map(c => `<option value="${c.id}">${c.name} (${c.phone || 'No phone'})</option>`).join('');
    }

    // Populate branches
    const bSelect1 = document.getElementById('return-branch-select');
    const bSelect2 = document.getElementById('return-supp-branch-select');
    const branchOpts = (state.branches || []).map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    if (bSelect1) bSelect1.innerHTML = branchOpts;
    if (bSelect2) bSelect2.innerHTML = branchOpts;

    // Populate suppliers
    const suppSelect = document.getElementById('return-supplier-select');
    if (suppSelect) {
      suppSelect.innerHTML = '<option value="">-- Choose Vendor --</option>' +
        (state.suppliers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    // Populate products for customer return
    const prodSelect = document.getElementById('return-product-select');
    if (prodSelect) {
      prodSelect.innerHTML = '<option value="">-- Choose Product Returned --</option>' +
        (state.products || []).map(p => `
          <option value="${p.id}" data-price="${p.selling_price || 0}">
            ${p.name} (${p.sku})
          </option>
        `).join('');
    }

    // Populate supplier batches
    const suppBatchSelect = document.getElementById('return-supp-batch-select');
    if (suppBatchSelect) {
      suppBatchSelect.innerHTML = '<option value="">-- Choose Batch to Return --</option>' +
        this.batchesList.filter(b => b.current_quantity > 0).map(b => `
          <option value="${b.id}" data-name="${this.escapeJs(b.product_name)}" data-qty="${b.current_quantity}" data-cost="${b.purchase_cost}" data-batch="${b.batch_number}">
            ${b.batch_number} - ${b.product_name} (${b.current_quantity} in stock)
          </option>
        `).join('');
    }

    this.switchReturnType('customer');
    ui.openModal('process-return-modal');
  },

  switchReturnType(type) {
    this.activeReturnType = type;
    const custBtn = document.getElementById('btn-return-customer-tab');
    const suppBtn = document.getElementById('btn-return-supplier-tab');
    const custForm = document.getElementById('customer-return-form');
    const suppForm = document.getElementById('supplier-return-form');

    if (type === 'customer') {
      if (custBtn) { custBtn.className = 'btn btn-sm btn-primary'; }
      if (suppBtn) { suppBtn.className = 'btn btn-sm btn-secondary'; }
      if (custForm) custForm.style.display = 'flex';
      if (suppForm) suppForm.style.display = 'none';
    } else {
      if (custBtn) { custBtn.className = 'btn btn-sm btn-secondary'; }
      if (suppBtn) { suppBtn.className = 'btn btn-sm btn-primary'; }
      if (custForm) custForm.style.display = 'none';
      if (suppForm) suppForm.style.display = 'flex';
    }
  },

  onReturnProductChange() {
    const prodId = Number(document.getElementById('return-product-select')?.value);
    const batchSelect = document.getElementById('return-cust-batch-select');
    if (!batchSelect) return;

    const matchingBatches = this.batchesList.filter(b => b.product_id === prodId && b.current_quantity > 0);
    batchSelect.innerHTML = '<option value="">-- Auto-select Earliest Batch --</option>' +
      matchingBatches.map(b => `<option value="${b.id}">${b.batch_number} (Exp: ${b.expiry_date})</option>`).join('');
  },

  onReturnSuppBatchChange() {
    const select = document.getElementById('return-supp-batch-select');
    const opt = select.options[select.selectedIndex];
    const info = document.getElementById('return-supp-batch-info');
    if (!opt || !opt.value) {
      if (info) info.style.display = 'none';
      return;
    }

    if (info) {
      info.style.display = 'block';
      info.innerHTML = `
        Returning: <strong>${opt.dataset.name}</strong> (${opt.dataset.batch})<br>
        On-Hand: <strong>${opt.dataset.qty}</strong> | Unit Cost: <strong>${ui.formatCurrency(opt.dataset.cost)}</strong>
      `;
    }
  },

  triggerReturnSubmit() {
    if (this.activeReturnType === 'customer') {
      document.getElementById('customer-return-form').requestSubmit();
    } else {
      document.getElementById('supplier-return-form').requestSubmit();
    }
  },

  async submitReturn(e, returnType) {
    e.preventDefault();

    let payload = { return_type: returnType };

    if (returnType === 'Customer Return') {
      payload.customer_id = document.getElementById('return-customer-select').value ? Number(document.getElementById('return-customer-select').value) : null;
      payload.branch_id = Number(document.getElementById('return-branch-select').value) || 1;
      payload.product_id = Number(document.getElementById('return-product-select').value);
      payload.batch_id = document.getElementById('return-cust-batch-select').value ? Number(document.getElementById('return-cust-batch-select').value) : null;
      payload.quantity = Number(document.getElementById('return-qty').value);
      payload.restock_action = document.getElementById('return-restock-action').value;
      payload.refund_amount = Number(document.getElementById('return-refund-amount').value) || 0;
      payload.reason = document.getElementById('return-cust-notes').value.trim();
    } else {
      payload.supplier_id = Number(document.getElementById('return-supplier-select').value);
      payload.branch_id = Number(document.getElementById('return-supp-branch-select').value) || 1;
      payload.batch_id = Number(document.getElementById('return-supp-batch-select').value);
      payload.quantity = Number(document.getElementById('return-supp-qty').value);
      payload.refund_amount = Number(document.getElementById('return-supp-refund').value) || 0;
      payload.reason = document.getElementById('return-supp-reason').value;
      payload.notes = document.getElementById('return-supp-notes').value.trim();
    }

    try {
      const res = await api.processReturn(payload);
      if (res.success) {
        ui.showToast(res.message || 'Return processed successfully!', 'success');
        ui.closeModal('process-return-modal');
        await this.loadBatches();
        await this.loadDashboardSummary();
        if (productsModule.loadProducts) productsModule.loadProducts();
      } else {
        ui.showToast(res.error || 'Failed to process return', 'danger');
      }
    } catch (err) {
      ui.showToast(err.message || 'Error processing return', 'danger');
    }
  },

  // -------------------------------------------------------------
  // MODAL 6: RECORD DAMAGE / SPOILAGE
  // -------------------------------------------------------------
  openRecordDamageModal(batchId, productName, batchNumber, currentQty, unitCost, unit) {
    document.getElementById('damage-batch-id').value = batchId;
    document.getElementById('damage-batch-label').value = `${productName} (Batch: ${batchNumber}) - Max ${currentQty} ${unit}`;

    const qtyInput = document.getElementById('damage-qty');
    qtyInput.value = '1';
    qtyInput.max = currentQty;
    qtyInput.dataset.cost = unitCost;

    this.updateDamageLossPreview();
    ui.openModal('record-damage-modal');
  },

  updateDamageLossPreview() {
    const qtyInput = document.getElementById('damage-qty');
    const cost = Number(qtyInput?.dataset.cost) || 0;
    const qty = Number(qtyInput?.value) || 0;
    const preview = document.getElementById('damage-loss-preview');
    if (preview) {
      preview.textContent = ui.formatCurrency(cost * qty);
    }
  },

  async submitRecordDamage(e) {
    e.preventDefault();
    const payload = {
      batch_id: Number(document.getElementById('damage-batch-id').value),
      quantity: Number(document.getElementById('damage-qty').value),
      reason: document.getElementById('damage-reason').value,
      notes: document.getElementById('damage-notes').value.trim()
    };

    try {
      const res = await api.recordDamage(payload);
      if (res.success) {
        ui.showToast(res.message || 'Damage / spoilage loss recorded.', 'success');
        ui.closeModal('record-damage-modal');
        await this.loadBatches();
        await this.loadDashboardSummary();
        await this.loadAlertsCountOnly();
        if (productsModule.loadProducts) productsModule.loadProducts();
      } else {
        ui.showToast(res.error || 'Failed to record damage', 'danger');
      }
    } catch (err) {
      ui.showToast(err.message || 'Error recording damage', 'danger');
    }
  },

  // -------------------------------------------------------------
  // MODAL 7: ALERT SETTINGS
  // -------------------------------------------------------------
  async openAlertSettingsModal() {
    try {
      const res = await api.getInventoryAlertSettings();
      if (res.success && res.data) {
        document.getElementById('setting-warn-days').value = res.data.warning_days;
        document.getElementById('setting-crit-days').value = res.data.critical_days;
        document.getElementById('setting-adj-qty').value = res.data.unusual_adjustment_qty;
        document.getElementById('setting-adj-cost').value = res.data.unusual_adjustment_cost;
      }
      ui.openModal('alert-settings-modal');
    } catch (err) {
      console.error('Error loading alert settings:', err);
      ui.openModal('alert-settings-modal');
    }
  },

  async submitAlertSettings(e) {
    e.preventDefault();
    const payload = {
      warning_days: Number(document.getElementById('setting-warn-days').value),
      critical_days: Number(document.getElementById('setting-crit-days').value),
      unusual_adjustment_qty: Number(document.getElementById('setting-adj-qty').value),
      unusual_adjustment_cost: Number(document.getElementById('setting-adj-cost').value)
    };

    try {
      const res = await api.saveInventoryAlertSettings(payload);
      if (res.success) {
        ui.showToast('Inventory alert thresholds updated!', 'success');
        ui.closeModal('alert-settings-modal');
        await this.loadDashboardSummary();
        if (this.activeTab === 'alerts') {
          await this.loadAlerts();
        } else {
          await this.loadAlertsCountOnly();
        }
      } else {
        ui.showToast(res.error || 'Failed to update settings', 'danger');
      }
    } catch (err) {
      ui.showToast(err.message || 'Error updating settings', 'danger');
    }
  }
};
