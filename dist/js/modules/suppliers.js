// ====================================================================
// Module 9: Supplier Management, Payables & Performance Ledger
// ====================================================================

const suppliersModule = {
  suppliersList: [],
  stats: null,
  currentPage: 1,
  pageSize: 15,
  totalPages: 1,
  totalCount: 0,
  currentSupplierDetails: null,
  activeDetailsTab: 'scorecard',
  searchDebounceTimer: null,

  async init() {
    await this.loadStats();
    await this.loadSuppliers();
  },

  async loadStats() {
    try {
      const res = await api.getSupplierStats();
      if (res && res.success) {
        const s = res.data;
        this.stats = s;

        const totalEl = document.getElementById('supp-stat-total');
        if (totalEl) totalEl.textContent = ui.formatNumber(s.total_suppliers || 0);

        const activeSubEl = document.getElementById('supp-stat-active-sub');
        if (activeSubEl) activeSubEl.textContent = `${ui.formatNumber(s.active_suppliers || 0)} active dairy co-ops / farms`;

        const procEl = document.getElementById('supp-stat-procurement');
        if (procEl) procEl.textContent = ui.formatCurrency(s.lifetime_procurement || 0);

        const ordersSubEl = document.getElementById('supp-stat-orders-sub');
        if (ordersSubEl) ordersSubEl.textContent = `${ui.formatNumber(s.total_orders_count || 0)} total purchase orders`;

        const balEl = document.getElementById('supp-stat-balance');
        if (balEl) balEl.textContent = ui.formatCurrency(s.total_balance_due || 0);

        const dueSubEl = document.getElementById('supp-stat-due-sub');
        if (dueSubEl) dueSubEl.textContent = `${ui.formatNumber(s.suppliers_with_due || 0)} suppliers with pending dues`;

        const retEl = document.getElementById('supp-stat-returns');
        if (retEl) retEl.textContent = ui.formatCurrency(s.total_returns_value || 0);

        const defectSubEl = document.getElementById('supp-stat-defect-sub');
        if (defectSubEl) defectSubEl.textContent = `${s.overall_defect_rate || 0}% overall defect rate`;
      }
    } catch (err) {
      console.error('Error loading supplier stats:', err);
    }
  },

  async loadSuppliers() {
    try {
      ui.renderSkeleton('suppliers-table-body', 5);

      const params = {
        page: this.currentPage,
        limit: this.pageSize
      };

      const searchVal = document.getElementById('supp-filter-search')?.value?.trim();
      if (searchVal) params.search = searchVal;

      const statusVal = document.getElementById('supp-filter-status')?.value;
      if (statusVal && statusVal !== 'all') params.status = statusVal;

      const balanceVal = document.getElementById('supp-filter-balance')?.value;
      if (balanceVal && balanceVal !== 'all') params.balance = balanceVal;

      const sortVal = document.getElementById('supp-filter-sort')?.value;
      if (sortVal) params.sort = sortVal;

      const res = await api.getSuppliers(params);
      if (res && res.success) {
        this.suppliersList = res.data || [];
        state.suppliers = res.data || [];
        this.renderTable(this.suppliersList);

        if (res.pagination) {
          this.currentPage = res.pagination.page;
          this.totalPages = res.pagination.totalPages;
          this.totalCount = res.pagination.total;

          const startIdx = this.totalCount === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
          const endIdx = Math.min(this.currentPage * this.pageSize, this.totalCount);

          const pageInfo = document.getElementById('supp-pagination-info');
          if (pageInfo) {
            pageInfo.textContent = `Showing ${startIdx} to ${endIdx} of ${this.totalCount} suppliers`;
          }

          const pageInd = document.getElementById('supp-page-indicator');
          if (pageInd) {
            pageInd.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
          }

          const prevBtn = document.getElementById('supp-prev-btn');
          if (prevBtn) prevBtn.disabled = this.currentPage <= 1;

          const nextBtn = document.getElementById('supp-next-btn');
          if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
        }
      }
    } catch (err) {
      console.error('Error loading suppliers:', err);
      const tbody = document.getElementById('suppliers-table-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2.5rem; color:var(--danger);">Failed to load suppliers.</td></tr>`;
      }
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('suppliers-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
            <div style="font-size:2.4rem; margin-bottom:0.5rem;">🚜</div>
            <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary); margin-bottom:0.25rem;">No Suppliers Found</div>
            <div style="font-size:0.85rem;">Try adjusting the search criteria or click 'Register Supplier' to add one.</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(s => {
      const code = s.formatted_id || `SUP-${String(s.id).padStart(4, '0')}`;
      const hasDue = Number(s.balance_due) > 0;
      const perf = s.performance || {};
      const defectRate = perf.defect_rate !== undefined ? perf.defect_rate : 0;

      let gradeBadge = '<span class="status-chip badge-grade-a">⭐⭐⭐⭐⭐ Grade A</span>';
      if (perf.grade === 'C') {
        gradeBadge = '<span class="status-chip badge-grade-c">⚠️ Grade C</span>';
      } else if (perf.grade === 'B') {
        gradeBadge = '<span class="status-chip badge-grade-b">⭐⭐⭐⭐ Grade B</span>';
      }

      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <code style="font-size:0.75rem; font-weight:800; color:var(--primary-dark); background:var(--bg-subtle); padding:2px 5px; border-radius:4px;">
                ${code}
              </code>
            </div>
            <div style="font-weight:800; color:var(--text-primary); font-size:0.9rem; margin-top:2px;">
              ${s.company_name || s.name}
            </div>
            ${s.company_name && s.company_name !== s.name ? `<div style="font-size:0.75rem; color:var(--text-muted);">${s.name}</div>` : ''}
          </td>
          <td>
            <div style="font-weight:600; font-size:0.85rem;">${s.contact_person || '-'}</div>
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary);">${s.phone}</div>
            ${s.email ? `<div style="font-size:0.72rem; color:var(--text-muted);">${s.email}</div>` : ''}
          </td>
          <td>
            <code style="font-size:0.78rem;">${s.gst_number || 'Unregistered'}</code>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:3px; align-items:flex-start;">
              <span class="status-chip badge-info" style="font-size:0.7rem;">${s.payment_terms || 'Net 15'}</span>
              <span class="status-chip ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}" style="font-size:0.7rem;">${s.status || 'Active'}</span>
            </div>
          </td>
          <td>
            <div style="font-weight:800; font-size:0.925rem; color:var(--text-primary);">${ui.formatCurrency(s.lifetime_procurement || 0)}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${s.total_purchases_count || 0} POs (${s.received_purchases_count || 0} received)</div>
          </td>
          <td>
            <div style="font-weight:700; font-size:0.875rem; color:#7E22CE;">${ui.formatCurrency(s.total_returns_value || 0)}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${s.total_returns_count || 0} returns &bull; <strong style="color:${defectRate > 2 ? 'var(--danger)' : 'var(--text-secondary)'};">${defectRate}% defect</strong></div>
          </td>
          <td>
            <div style="font-weight:800; font-size:0.95rem; color:${hasDue ? 'var(--danger)' : 'var(--success)'};">
              ${ui.formatCurrency(s.balance_due || 0)}
            </div>
            ${hasDue ? '<span class="status-chip badge-danger" style="margin-top:2px; font-size:0.7rem;">Outstanding</span>' : '<span class="status-chip badge-success" style="margin-top:2px; font-size:0.7rem;">Settled</span>'}
          </td>
          <td>
            ${gradeBadge}
          </td>
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:0.35rem;">
              <button class="btn btn-sm btn-secondary" onclick="suppliersModule.openDetailsModal(${s.id})" title="View 360° Profile & Ledger" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
                🔍 Details
              </button>
              <button class="btn btn-sm btn-secondary" onclick="suppliersModule.openEditModal(${s.id})" title="Edit Supplier Profile" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
                ✏️ Edit
              </button>
              ${hasDue ? `
                <button class="btn btn-sm btn-primary" onclick="suppliersModule.openPayModal(${s.id}, '${s.name.replace(/'/g, "\\'")}', ${s.balance_due})" title="Pay Outstanding Settlement" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
                  💳 Pay
                </button>
              ` : `
                <button class="btn btn-sm btn-secondary" onclick="app.navigate('purchases')" title="Create Purchase Order" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
                  ➕ Order
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  debounceFilter() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadSuppliers();
    }, 300);
  },

  applyFilters() {
    this.currentPage = 1;
    this.loadSuppliers();
  },

  resetFilters() {
    const sInput = document.getElementById('supp-filter-search');
    if (sInput) sInput.value = '';

    const stSelect = document.getElementById('supp-filter-status');
    if (stSelect) stSelect.value = 'all';

    const bSelect = document.getElementById('supp-filter-balance');
    if (bSelect) bSelect.value = 'all';

    const sortSelect = document.getElementById('supp-filter-sort');
    if (sortSelect) sortSelect.value = 'name_asc';

    this.applyFilters();
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadSuppliers();
    }
  },

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadSuppliers();
    }
  },

  // -------------------------------------------------------------
  // ADD & EDIT SUPPLIER MODAL
  // -------------------------------------------------------------
  openNewModal() {
    const form = document.getElementById('supplier-form');
    if (form) form.reset();

    const idInput = document.getElementById('supp-id');
    if (idInput) idInput.value = '';

    const titleEl = document.getElementById('supp-modal-title');
    if (titleEl) titleEl.textContent = 'Register New Supplier';

    const obRow = document.getElementById('supp-opening-balance-row');
    if (obRow) obRow.style.display = 'block';

    const statusSelect = document.getElementById('supp-status');
    if (statusSelect) statusSelect.value = 'Active';

    ui.openModal('supplier-modal');
  },

  async openEditModal(id) {
    try {
      const s = this.suppliersList.find(x => x.id === Number(id)) || (await api.getSupplierDetails(id)).data;
      if (!s) {
        ui.showToast('Supplier record not found.', 'error');
        return;
      }

      const idInput = document.getElementById('supp-id');
      if (idInput) idInput.value = s.id;

      const titleEl = document.getElementById('supp-modal-title');
      if (titleEl) titleEl.textContent = `Edit Supplier – ${s.name}`;

      const compInput = document.getElementById('supp-company');
      if (compInput) compInput.value = s.company_name || s.name;

      const nameInput = document.getElementById('supp-name');
      if (nameInput) nameInput.value = s.name;

      const personInput = document.getElementById('supp-person');
      if (personInput) personInput.value = s.contact_person || '';

      const phoneInput = document.getElementById('supp-phone');
      if (phoneInput) phoneInput.value = s.phone;

      const emailInput = document.getElementById('supp-email');
      if (emailInput) emailInput.value = s.email || '';

      const gstInput = document.getElementById('supp-gst');
      if (gstInput) gstInput.value = s.gst_number || '';

      const termsSelect = document.getElementById('supp-terms');
      if (termsSelect) termsSelect.value = s.payment_terms || 'Net 15';

      const statusSelect = document.getElementById('supp-status');
      if (statusSelect) statusSelect.value = s.status || 'Active';

      const addrInput = document.getElementById('supp-address');
      if (addrInput) addrInput.value = s.address || '';

      // Hide opening balance row on edit
      const obRow = document.getElementById('supp-opening-balance-row');
      if (obRow) obRow.style.display = 'none';

      ui.openModal('supplier-modal');
    } catch (err) {
      console.error(err);
      ui.showToast('Could not load supplier for editing.', 'error');
    }
  },

  async submitForm(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('supp-id')?.value;
    const name = document.getElementById('supp-name')?.value?.trim();
    const company = document.getElementById('supp-company')?.value?.trim();
    const person = document.getElementById('supp-person')?.value?.trim();
    const phone = document.getElementById('supp-phone')?.value?.trim();
    const email = document.getElementById('supp-email')?.value?.trim();
    const gst = document.getElementById('supp-gst')?.value?.trim();
    const terms = document.getElementById('supp-terms')?.value;
    const status = document.getElementById('supp-status')?.value || 'Active';
    const address = document.getElementById('supp-address')?.value?.trim();
    const openingBalance = parseFloat(document.getElementById('supp-opening-balance')?.value) || 0;

    if (!name) {
      ui.showToast('Supplier name is required.', 'warning');
      return;
    }
    if (!phone) {
      ui.showToast('Mobile / phone number is required.', 'warning');
      return;
    }

    const payload = {
      name,
      company_name: company || name,
      contact_person: person,
      phone,
      email,
      address,
      gst_number: gst,
      payment_terms: terms,
      status
    };

    try {
      if (id) {
        // Edit existing
        const res = await api.updateSupplier(id, payload);
        if (res && res.success) {
          ui.showToast(res.message || 'Supplier profile updated!', 'success');
          ui.closeModal('supplier-modal');
          await this.loadStats();
          await this.loadSuppliers();
          if (this.currentSupplierDetails && this.currentSupplierDetails.id === Number(id)) {
            await this.openDetailsModal(id);
          }
        } else {
          ui.showToast(res.error || 'Failed to update supplier.', 'error');
        }
      } else {
        // Create new
        payload.opening_balance = openingBalance;
        const res = await api.createSupplier(payload);
        if (res && res.success) {
          ui.showToast(res.message || 'Supplier registered successfully!', 'success');
          ui.closeModal('supplier-modal');
          await this.loadStats();
          await this.loadSuppliers();
        } else {
          ui.showToast(res.error || 'Failed to register supplier.', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      ui.showToast(err.message || 'Error saving supplier record.', 'error');
    }
  },

  // -------------------------------------------------------------
  // PAYMENT SETTLEMENT MODAL & RECORDING
  // -------------------------------------------------------------
  openPayModal(id, name, due) {
    const payId = document.getElementById('supp-pay-id');
    const payName = document.getElementById('supp-pay-name');
    const payDue = document.getElementById('supp-pay-due');
    const payAmount = document.getElementById('supp-pay-amount');
    const payMode = document.getElementById('supp-pay-mode');
    const payRef = document.getElementById('supp-pay-ref');
    const payDate = document.getElementById('supp-pay-date');
    const payNotes = document.getElementById('supp-pay-notes');

    if (payId) payId.value = id;
    if (payName) payName.value = name;
    if (payDue) payDue.value = ui.formatCurrency(due);
    if (payAmount) payAmount.value = due > 0 ? due : '';
    if (payMode) payMode.value = 'UPI';
    if (payRef) payRef.value = `UTR-${Date.now().toString().slice(-6)}`;
    if (payDate) payDate.value = new Date().toISOString().split('T')[0];
    if (payNotes) payNotes.value = 'Procurement payment settlement';

    ui.openModal('supplier-pay-modal');
  },

  async submitPayment(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('supp-pay-id')?.value;
    const amount = parseFloat(document.getElementById('supp-pay-amount')?.value);
    const mode = document.getElementById('supp-pay-mode')?.value;
    const ref = document.getElementById('supp-pay-ref')?.value;
    const date = document.getElementById('supp-pay-date')?.value;
    const notes = document.getElementById('supp-pay-notes')?.value;

    if (!amount || amount <= 0) {
      ui.showToast('Please enter a valid payment amount greater than zero.', 'warning');
      return;
    }

    try {
      const res = await api.paySupplier(id, {
        amount,
        payment_mode: mode,
        reference_no: ref,
        payment_date: date,
        notes
      });

      if (res && res.success) {
        ui.showToast(res.message || 'Payment recorded successfully!', 'success');
        ui.closeModal('supplier-pay-modal');
        await this.loadStats();
        await this.loadSuppliers();
        if (typeof dashboardModule !== 'undefined' && dashboardModule.loadStats) dashboardModule.loadStats();
        if (this.currentSupplierDetails && this.currentSupplierDetails.id === Number(id)) {
          await this.openDetailsModal(id);
        }
      } else {
        ui.showToast(res.error || 'Failed to record supplier payment.', 'error');
      }
    } catch (err) {
      console.error(err);
      ui.showToast(err.message || 'Error processing supplier payment.', 'error');
    }
  },

  // -------------------------------------------------------------
  // 360-DEGREE SUPPLIER DETAILS MODAL
  // -------------------------------------------------------------
  async openDetailsModal(id) {
    try {
      const res = await api.getSupplierDetails(id);
      if (!res || !res.success || !res.data) {
        ui.showToast('Could not load supplier details.', 'error');
        return;
      }

      const d = res.data;
      this.currentSupplierDetails = d;
      const m = d.metrics || {};

      // Header elements
      document.getElementById('supp-view-title').textContent = d.company_name || d.name;
      document.getElementById('supp-view-code').textContent = d.formatted_id;
      document.getElementById('supp-view-company').textContent = d.name;

      const statusBadge = document.getElementById('supp-view-status-badge');
      if (statusBadge) {
        statusBadge.textContent = d.status || 'Active';
        statusBadge.className = `status-chip ${d.status === 'Active' ? 'badge-success' : 'badge-danger'}`;
      }

      const gradeBadge = document.getElementById('supp-view-grade-badge');
      if (gradeBadge) {
        gradeBadge.textContent = m.grade_label || 'Grade A (Excellent)';
        gradeBadge.className = `status-chip ${m.grade === 'C' ? 'badge-grade-c' : (m.grade === 'B' ? 'badge-grade-b' : 'badge-grade-a')}`;
      }

      // Tab 1: Financial & Scorecard Metrics
      document.getElementById('supp-view-lifetime').textContent = ui.formatCurrency(m.lifetime_procurement || 0);
      document.getElementById('supp-view-paid').textContent = ui.formatCurrency(m.total_paid || 0);
      document.getElementById('supp-view-balance').textContent = ui.formatCurrency(d.balance_due || 0);
      document.getElementById('supp-view-returns-val').textContent = ui.formatCurrency(m.total_returns_value || 0);

      document.getElementById('supp-view-total-orders').textContent = m.total_orders || 0;
      document.getElementById('supp-view-received-orders').textContent = m.received_orders || 0;
      document.getElementById('supp-view-fulfillment').textContent = `${m.fulfillment_rate || 100}%`;
      document.getElementById('supp-view-defect').textContent = `${m.defect_rate || 0}%`;

      // Profile details
      document.getElementById('supp-view-contact-person').textContent = d.contact_person || 'N/A';
      document.getElementById('supp-view-phone').textContent = d.phone;
      document.getElementById('supp-view-email').textContent = d.email || 'N/A';
      document.getElementById('supp-view-address').textContent = d.address || 'N/A';
      document.getElementById('supp-view-gst').textContent = d.gst_number || 'N/A';
      document.getElementById('supp-view-terms').textContent = d.payment_terms || 'Net 15';
      document.getElementById('supp-view-net-proc').textContent = ui.formatCurrency(m.net_procurement || 0);
      document.getElementById('supp-view-created').textContent = d.created_at ? ui.formatDate(d.created_at) : 'N/A';

      // Tab counts
      document.getElementById('supp-tab-count-po').textContent = d.purchases ? d.purchases.length : 0;
      document.getElementById('supp-tab-count-returns').textContent = d.returns ? d.returns.length : 0;
      document.getElementById('supp-tab-count-payments').textContent = d.payments ? d.payments.length : 0;

      // Render Purchase Orders Table
      const poBody = document.getElementById('supp-purchases-table-body');
      if (poBody) {
        if (!d.purchases || !d.purchases.length) {
          poBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No purchase orders placed with this supplier yet.</td></tr>`;
        } else {
          poBody.innerHTML = d.purchases.map(p => `
            <tr>
              <td><strong style="font-family:monospace; color:var(--primary-dark);">${p.invoice_no}</strong></td>
              <td>${ui.formatDate(p.purchase_date)}</td>
              <td>${p.branch_name || 'Main Shop'}</td>
              <td>${p.items_count || 1} items</td>
              <td style="font-weight:700;">${ui.formatCurrency(p.net_amount)}</td>
              <td>
                <span class="status-chip ${p.status === 'Received' ? 'badge-success' : (p.status === 'Draft' ? 'badge-warning' : 'badge-danger')}">
                  ${p.status}
                </span>
              </td>
              <td>
                <span class="status-chip ${p.payment_status === 'Paid' ? 'badge-success' : (p.payment_status === 'Partial' ? 'badge-warning' : 'badge-danger')}">
                  ${p.payment_status}
                </span>
              </td>
            </tr>
          `).join('');
        }
      }

      // Render Returns Table
      const retBody = document.getElementById('supp-returns-table-body');
      if (retBody) {
        if (!d.returns || !d.returns.length) {
          retBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Zero returns! Excellent supplier quality record.</td></tr>`;
        } else {
          retBody.innerHTML = d.returns.map(r => `
            <tr>
              <td><strong style="font-family:monospace; color:#B45309;">${r.return_no}</strong></td>
              <td>${ui.formatDate(r.return_date)}</td>
              <td>
                <div style="font-weight:700;">${r.product_name}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">Batch: ${r.batch_number || 'N/A'}</div>
              </td>
              <td style="font-weight:700;">${r.quantity}</td>
              <td style="font-weight:700; color:var(--danger);">${ui.formatCurrency(r.total_return_value)}</td>
              <td style="font-size:0.8rem;">${r.reason}</td>
              <td><span class="status-chip badge-info">${r.refund_type || 'Credit Note'}</span></td>
            </tr>
          `).join('');
        }
      }

      // Render Payments Table
      const payBody = document.getElementById('supp-payments-table-body');
      if (payBody) {
        if (!d.payments || !d.payments.length) {
          payBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No payment settlements logged for this supplier yet.</td></tr>`;
        } else {
          payBody.innerHTML = d.payments.map(pay => `
            <tr>
              <td><strong style="font-family:monospace; color:var(--primary-dark);">PAY-${String(pay.id).padStart(5, '0')}</strong></td>
              <td>${ui.formatDate(pay.payment_date)}</td>
              <td style="font-weight:800; color:var(--success); font-size:0.95rem;">${ui.formatCurrency(pay.amount)}</td>
              <td><span class="status-chip badge-info">${pay.payment_mode || 'Bank Transfer'}</span></td>
              <td><code style="font-size:0.75rem;">${pay.reference_no || '-'}</code></td>
              <td><span style="font-size:0.78rem;">${pay.recorded_by || 'Admin'}</span></td>
              <td style="font-size:0.78rem; color:var(--text-secondary);">${pay.notes || '-'}</td>
            </tr>
          `).join('');
        }
      }

      this.switchDetailsTab('scorecard');
      ui.openModal('supplier-details-modal');
    } catch (err) {
      console.error(err);
      ui.showToast('Failed to load supplier details.', 'error');
    }
  },

  switchDetailsTab(tab) {
    this.activeDetailsTab = tab;
    document.querySelectorAll('.supp-modal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    ['scorecard', 'purchases', 'returns', 'payments'].forEach(t => {
      const pane = document.getElementById(`supp-tab-pane-${t}`);
      if (pane) pane.style.display = t === tab ? 'block' : 'none';
    });
  },

  openEditFromDetails() {
    if (this.currentSupplierDetails) {
      const id = this.currentSupplierDetails.id;
      ui.closeModal('supplier-details-modal');
      this.openEditModal(id);
    }
  },

  openPayFromDetails() {
    if (this.currentSupplierDetails) {
      const d = this.currentSupplierDetails;
      ui.closeModal('supplier-details-modal');
      this.openPayModal(d.id, d.name, d.balance_due);
    }
  },

  // -------------------------------------------------------------
  // EXCEL REPORT DOWNLOADS
  // -------------------------------------------------------------
  downloadReport() {
    const params = new URLSearchParams();

    const searchVal = document.getElementById('supp-filter-search')?.value?.trim();
    if (searchVal) params.append('search', searchVal);

    const statusVal = document.getElementById('supp-filter-status')?.value;
    if (statusVal && statusVal !== 'all') params.append('status', statusVal);

    ui.showToast('Generating Supplier-Wise Purchase & Performance Report...', 'info');
    window.location.href = `/api/reports/download/supplier-purchases?${params.toString()}`;
  },

  downloadSupplierStatement() {
    if (!this.currentSupplierDetails) return;
    const sId = this.currentSupplierDetails.id;
    ui.showToast(`Generating statement for ${this.currentSupplierDetails.name}...`, 'info');
    window.location.href = `/api/reports/download/supplier-purchases?supplierId=${sId}`;
  }
};
