// ====================================================================
// MODULE 10: CUSTOMER MANAGEMENT & UDHAR LEDGER CONTROLLER
// ====================================================================

const customersModule = {
  customersList: [],
  currentCustomerDetails: null,
  productsList: [],
  filters: {
    search: '',
    type: 'all',
    udhar: 'all',
    status: 'all',
    sort: 'name_asc',
    page: 1,
    limit: 15
  },
  filterTimeout: null,

  async init() {
    await Promise.all([
      this.loadStats(),
      this.loadCustomers(),
      this.loadProductsList()
    ]);
  },

  async loadProductsList() {
    try {
      const res = await api.getProducts({ limit: 100 });
      if (res && res.success) {
        this.productsList = res.data;
      }
    } catch (err) {
      console.warn('Could not load products for return dropdowns:', err);
    }
  },

  // -------------------------------------------------------------
  // 10.1: KPI STAT CARDS
  // -------------------------------------------------------------
  async loadStats() {
    try {
      const res = await api.getCustomerStats();
      if (!res || !res.success || !res.data) return;

      const s = res.data;

      // 1. Total Customers
      const totalEl = document.getElementById('cust-stat-total');
      if (totalEl) totalEl.textContent = s.total_customers || 0;
      const activeSubEl = document.getElementById('cust-stat-active-sub');
      if (activeSubEl) {
        activeSubEl.textContent = `${s.active_customers || 0} active | ${s.wholesale_customers || 0} wholesale | ${s.subscription_customers || 0} subs`;
      }

      // 2. Lifetime Revenue
      const salesEl = document.getElementById('cust-stat-sales');
      if (salesEl) salesEl.textContent = ui.formatCurrency(s.lifetime_revenue || 0);
      const salesSubEl = document.getElementById('cust-stat-sales-sub');
      if (salesSubEl) {
        salesSubEl.textContent = `${s.total_orders || 0} orders (₹${(s.walkin_sales || 0).toLocaleString('en-IN')} walk-in)`;
      }

      // 3. Outstanding Udhar
      const udharEl = document.getElementById('cust-stat-udhar');
      if (udharEl) udharEl.textContent = ui.formatCurrency(s.total_udhar_balance || 0);
      const udharSubEl = document.getElementById('cust-stat-udhar-sub');
      if (udharSubEl) {
        udharSubEl.textContent = `${s.customers_with_udhar || 0} accounts with pending dues`;
      }

      // 4. Returns & Refunds
      const returnsEl = document.getElementById('cust-stat-returns');
      if (returnsEl) returnsEl.textContent = ui.formatCurrency(s.total_returns_value || 0);
      const returnsSubEl = document.getElementById('cust-stat-returns-sub');
      if (returnsSubEl) {
        returnsSubEl.textContent = `${s.total_returns_count || 0} returns (${s.total_units_returned || 0} units)`;
      }
    } catch (err) {
      console.error('Error loading customer stats:', err);
    }
  },

  // -------------------------------------------------------------
  // 10.2: LOAD & RENDER CUSTOMERS TABLE
  // -------------------------------------------------------------
  async loadCustomers() {
    try {
      ui.renderSkeleton('customers-table-body', 5);
      const res = await api.getCustomers(this.filters);

      if (res && res.success) {
        this.customersList = res.data;
        state.customers = res.data;
        this.renderTable(res.data);
        this.renderPagination(res.pagination);
      } else {
        const tbody = document.getElementById('customers-table-body');
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--danger);">${res ? res.error : 'Failed to load customers.'}</td></tr>`;
        }
      }
    } catch (err) {
      console.error('Error loading customers:', err);
      const tbody = document.getElementById('customers-table-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--danger);">Error loading customer directory: ${err.message}</td></tr>`;
      }
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:0.5rem;">👥</div>
            <div style="font-weight:700; font-size:1.05rem; margin-bottom:0.25rem;">No customers found</div>
            <div style="font-size:0.85rem;">Try modifying your search or filter criteria, or register a new customer above.</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(c => {
      const isWalkin = c.id === 5;
      const code = c.formatted_cust_id || `CUST-${String(c.id).padStart(4, '0')}`;
      const hasCredit = Number(c.credit_balance || 0) > 0;
      const orderCount = Number(c.order_count || 0);
      const lifetimeSpent = Number(c.lifetime_spent || 0);
      const netPurchases = Number(c.net_purchases !== undefined ? c.net_purchases : lifetimeSpent);
      const returnsCount = Number(c.total_returns_count || 0);
      const returnsVal = Number(c.total_returns_value || 0);

      // Category badge
      let typeBadgeClass = 'cust-badge-retail';
      if (c.type === 'Wholesale') typeBadgeClass = 'cust-badge-wholesale';
      else if (c.type === 'Daily Subscription') typeBadgeClass = 'cust-badge-subscription';

      // Status chip
      const isActive = c.status !== 'Inactive';
      const statusChip = isActive
        ? '<span class="status-chip badge-success">Active</span>'
        : '<span class="status-chip badge-danger">Inactive</span>';

      html += `
        <tr style="${!isActive ? 'opacity:0.65;' : ''}">
          <td>
            <span class="status-chip badge-info" style="font-weight:800; cursor:pointer;" onclick="customersModule.openDetailsModal(${c.id})" title="Click to view 360° Profile">
              ${code}
            </span>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-primary); font-size:0.92rem; cursor:pointer;" onclick="customersModule.openDetailsModal(${c.id})">
              ${c.name} ${isWalkin ? '<span style="font-size:0.75rem; color:var(--primary); font-weight:600;">(Default Walk-in)</span>' : ''}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:2px;">
              <span>📞 <a href="tel:${c.phone}" style="color:inherit; text-decoration:none; font-weight:600;">${c.phone}</a></span>
              ${c.email ? `<span>✉️ ${c.email}</span>` : ''}
            </div>
            ${c.address ? `<div style="font-size:0.73rem; color:var(--text-secondary); margin-top:1px;">📍 ${c.address}</div>` : ''}
          </td>
          <td>
            <span class="status-chip ${typeBadgeClass}">${c.type || 'Retail'}</span>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-primary);">${ui.formatCurrency(lifetimeSpent)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${orderCount} order${orderCount !== 1 ? 's' : ''}</div>
            ${returnsCount > 0 ? `<div style="font-size:0.72rem; color:var(--text-secondary);">Net: ${ui.formatCurrency(netPurchases)}</div>` : ''}
          </td>
          <td>
            ${returnsCount > 0 ? `
              <div style="font-weight:700; color:#B45309;">${ui.formatCurrency(returnsVal)}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">${returnsCount} return${returnsCount !== 1 ? 's' : ''}</div>
            ` : `
              <span style="font-size:0.8rem; color:var(--text-muted);">None</span>
            `}
          </td>
          <td>
            <div style="font-weight:800; font-size:0.95rem; color:${hasCredit ? 'var(--danger)' : 'var(--text-primary)'};">
              ${ui.formatCurrency(c.credit_balance || 0)}
            </div>
            ${hasCredit ? '<span class="status-chip badge-danger" style="margin-top:2px; font-size:0.68rem;">Udhar Due</span>' : '<span class="status-chip badge-success" style="font-size:0.68rem;">Settled</span>'}
          </td>
          <td>
            <span class="status-chip badge-info" style="font-weight:700;">⭐ ${c.loyalty_points || 0} pts</span>
          </td>
          <td>
            ${statusChip}
          </td>
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:0.35rem; flex-wrap:nowrap;">
              <button class="btn btn-sm btn-secondary" onclick="customersModule.openDetailsModal(${c.id})" title="View 360° Profile & Ledger">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              ${hasCredit ? `
                <button class="btn btn-sm btn-success" onclick="customersModule.openUdharModal(${c.id}, '${c.name.replace(/'/g, "\\'")}', ${c.credit_balance})" title="Collect Udhar Payment">
                  Collect
                </button>
              ` : `
                <button class="btn btn-sm btn-secondary" onclick="app.navigate('sales')" title="Create POS Sale">
                  Bill
                </button>
              `}
              <button class="btn btn-sm btn-warning" onclick="customersModule.openReturnModalForCustomer(${c.id})" title="Record Customer Return">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="customersModule.openEditModal(${c.id})" title="Edit Customer Details">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderPagination(p) {
    const container = document.getElementById('cust-pagination-container');
    if (!container) return;

    if (!p || p.total <= p.limit) {
      container.innerHTML = `
        <div style="font-size:0.85rem; color:var(--text-secondary);">
          Showing <b>${this.customersList.length}</b> customer${this.customersList.length !== 1 ? 's' : ''}
        </div>
      `;
      return;
    }

    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.page * p.limit, p.total);

    container.innerHTML = `
      <div style="font-size:0.85rem; color:var(--text-secondary);">
        Showing <b>${start} - ${end}</b> of <b>${p.total}</b> customers (Page ${p.page} of ${p.pages})
      </div>
      <div style="display:flex; gap:0.4rem;">
        <button class="btn btn-sm btn-secondary" ${p.page <= 1 ? 'disabled' : ''} onclick="customersModule.goToPage(${p.page - 1})">
          &larr; Previous
        </button>
        <button class="btn btn-sm btn-secondary" ${p.page >= p.pages ? 'disabled' : ''} onclick="customersModule.goToPage(${p.page + 1})">
          Next &rarr;
        </button>
      </div>
    `;
  },

  goToPage(page) {
    this.filters.page = page;
    this.loadCustomers();
  },

  // -------------------------------------------------------------
  // 10.3: FILTER HANDLERS
  // -------------------------------------------------------------
  applyFilters() {
    const searchEl = document.getElementById('cust-filter-search');
    const typeEl = document.getElementById('cust-filter-type');
    const udharEl = document.getElementById('cust-filter-udhar');
    const statusEl = document.getElementById('cust-filter-status');
    const sortEl = document.getElementById('cust-filter-sort');

    this.filters.search = searchEl ? searchEl.value.trim() : '';
    this.filters.type = typeEl ? typeEl.value : 'all';
    this.filters.udhar = udharEl ? udharEl.value : 'all';
    this.filters.status = statusEl ? statusEl.value : 'all';
    this.filters.sort = sortEl ? sortEl.value : 'name_asc';
    this.filters.page = 1;

    this.loadCustomers();
  },

  debounceFilter() {
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => {
      this.applyFilters();
    }, 280);
  },

  resetFilters() {
    const searchEl = document.getElementById('cust-filter-search');
    const typeEl = document.getElementById('cust-filter-type');
    const udharEl = document.getElementById('cust-filter-udhar');
    const statusEl = document.getElementById('cust-filter-status');
    const sortEl = document.getElementById('cust-filter-sort');

    if (searchEl) searchEl.value = '';
    if (typeEl) typeEl.value = 'all';
    if (udharEl) udharEl.value = 'all';
    if (statusEl) statusEl.value = 'all';
    if (sortEl) sortEl.value = 'name_asc';

    this.filters = {
      search: '',
      type: 'all',
      udhar: 'all',
      status: 'all',
      sort: 'name_asc',
      page: 1,
      limit: 15
    };

    this.loadCustomers();
  },

  // -------------------------------------------------------------
  // 10.4: ADD / EDIT CUSTOMER MODAL
  // -------------------------------------------------------------
  openNewModal() {
    const form = document.getElementById('customer-form');
    if (form) form.reset();
    document.getElementById('cust-edit-id').value = '';
    document.getElementById('cust-modal-title').textContent = 'Register New Customer';
    document.getElementById('cust-type').value = 'Retail';
    document.getElementById('cust-status').value = 'Active';
    document.getElementById('cust-credit-balance').value = '0';
    ui.openModal('customer-modal');
  },

  async openEditModal(id) {
    try {
      const res = await api.getCustomer(id);
      if (!res || !res.success || !res.data) {
        ui.showToast('Could not load customer data for editing.', 'error');
        return;
      }

      const c = res.data.customer;
      document.getElementById('cust-edit-id').value = c.id;
      document.getElementById('cust-modal-title').textContent = `Edit Customer: ${c.name} (${c.formatted_cust_id})`;
      document.getElementById('cust-name').value = c.name || '';
      document.getElementById('cust-type').value = c.type || 'Retail';
      document.getElementById('cust-phone').value = c.phone || '';
      document.getElementById('cust-email').value = c.email || '';
      document.getElementById('cust-status').value = c.status || 'Active';
      document.getElementById('cust-credit-balance').value = c.credit_balance || 0;
      document.getElementById('cust-address').value = c.address || '';
      document.getElementById('cust-notes').value = c.notes || '';

      ui.openModal('customer-modal');
    } catch (err) {
      console.error('Error opening edit customer modal:', err);
      ui.showToast(err.message, 'error');
    }
  },

  async submitForm(e) {
    e.preventDefault();
    const editId = document.getElementById('cust-edit-id').value;
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const type = document.getElementById('cust-type').value;
    const email = document.getElementById('cust-email').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const status = document.getElementById('cust-status').value;
    const credit_balance = Number(document.getElementById('cust-credit-balance').value) || 0;
    const notes = document.getElementById('cust-notes').value.trim();

    if (!name || !phone) {
      ui.showToast('Customer name and mobile phone are required.', 'warning');
      return;
    }

    const payload = {
      name,
      phone,
      type,
      email,
      address,
      status,
      credit_balance,
      notes
    };

    try {
      let res;
      if (editId) {
        res = await api.updateCustomer(editId, payload);
      } else {
        res = await api.createCustomer(payload);
      }

      if (res && res.success) {
        ui.showToast(res.message || 'Customer saved successfully!', 'success');
        ui.closeModal('customer-modal');
        await this.loadStats();
        await this.loadCustomers();
        if (typeof salesModule !== 'undefined' && salesModule.loadCustomers) {
          salesModule.loadCustomers();
        }
      } else {
        ui.showToast(res ? res.error : 'Failed to save customer.', 'error');
      }
    } catch (err) {
      console.error('Error saving customer:', err);
      ui.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // 10.5: UDHAR SETTLEMENT MODAL
  // -------------------------------------------------------------
  openUdharModal(id, name, balance) {
    document.getElementById('udhar-cust-id').value = id;
    document.getElementById('udhar-cust-name').value = `${name} (CUST-${String(id).padStart(4, '0')})`;
    document.getElementById('udhar-cust-balance').value = ui.formatCurrency(balance);
    document.getElementById('udhar-pay-amount').value = balance;
    document.getElementById('udhar-pay-mode').value = 'UPI';
    document.getElementById('udhar-pay-date').value = ui.getTodayDate();
    document.getElementById('udhar-pay-ref').value = '';
    document.getElementById('udhar-pay-notes').value = '';
    ui.openModal('udhar-payment-modal');
  },

  async submitUdharPayment(e) {
    e.preventDefault();
    const id = document.getElementById('udhar-cust-id').value;
    const amount = Number(document.getElementById('udhar-pay-amount').value);
    const payment_mode = document.getElementById('udhar-pay-mode').value;
    const payment_date = document.getElementById('udhar-pay-date').value;
    const reference_no = document.getElementById('udhar-pay-ref').value.trim();
    const notes = document.getElementById('udhar-pay-notes').value.trim();

    if (!amount || amount <= 0) {
      ui.showToast('Please enter a valid payment amount.', 'warning');
      return;
    }

    try {
      const res = await api.payCustomerCredit(id, {
        amount,
        payment_mode,
        payment_date,
        reference_no,
        notes
      });

      if (res && res.success) {
        ui.showToast(res.message || 'Udhar payment recorded successfully!', 'success');
        ui.closeModal('udhar-payment-modal');
        await this.loadStats();
        await this.loadCustomers();
        if (typeof salesModule !== 'undefined' && salesModule.loadCustomers) {
          salesModule.loadCustomers();
        }
        if (typeof dashboardModule !== 'undefined' && dashboardModule.loadStats) {
          dashboardModule.loadStats();
        }

        // If details modal is open for this customer, refresh it
        if (this.currentCustomerDetails && this.currentCustomerDetails.customer.id === Number(id)) {
          this.openDetailsModal(id);
        }
      } else {
        ui.showToast(res ? res.error : 'Failed to record Udhar payment.', 'error');
      }
    } catch (err) {
      console.error('Error submitting Udhar payment:', err);
      ui.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // 10.6: CUSTOMER RETURNS MODAL
  // -------------------------------------------------------------
  async openReturnModal(preselectedCustomerId = null) {
    await this.populateReturnDropdowns(preselectedCustomerId);
    const form = document.getElementById('customer-return-form');
    if (form) form.reset();

    const dateEl = document.getElementById('cust-return-date');
    if (dateEl) dateEl.value = ui.getTodayDate();

    const custSel = document.getElementById('cust-return-customer-id');
    if (custSel && preselectedCustomerId) {
      custSel.value = String(preselectedCustomerId);
    }

    this.onReturnCustomerChange();
    ui.openModal('customer-return-modal');
  },

  openReturnModalForCustomer(id) {
    this.openReturnModal(id);
  },

  async populateReturnDropdowns(preselectedCustId = null) {
    // Populate customer dropdown
    const custSel = document.getElementById('cust-return-customer-id');
    if (custSel) {
      let custHtml = '<option value="5">Walk-in Retail Customer (Default)</option>';
      this.customersList.forEach(c => {
        if (c.id !== 5) {
          custHtml += `<option value="${c.id}" ${preselectedCustId === c.id ? 'selected' : ''}>${c.name} (${c.formatted_cust_id || 'CUST-' + c.id}) - ${c.phone}</option>`;
        }
      });
      custSel.innerHTML = custHtml;
    }

    // Populate products dropdown
    const prodSel = document.getElementById('cust-return-product-id');
    if (prodSel) {
      let prodHtml = '<option value="">Select product to return...</option>';
      if (this.productsList && this.productsList.length) {
        this.productsList.forEach(p => {
          prodHtml += `<option value="${p.id}" data-price="${p.selling_price || 0}" data-unit="${p.unit || 'Units'}">${p.name} (${p.sku}) - ₹${p.selling_price}/${p.unit}</option>`;
        });
      }
      prodSel.innerHTML = prodHtml;
    }

    // Reset batches
    const batchSel = document.getElementById('cust-return-batch-id');
    if (batchSel) {
      batchSel.innerHTML = '<option value="">Auto-Assign / Latest Batch</option>';
    }
  },

  onReturnCustomerChange() {
    const custSel = document.getElementById('cust-return-customer-id');
    const wrap = document.getElementById('cust-return-reduce-udhar-wrap');
    if (!custSel || !wrap) return;

    const custId = Number(custSel.value);
    const customer = this.customersList.find(c => c.id === custId);

    if (customer && Number(customer.credit_balance || 0) > 0) {
      wrap.style.display = 'block';
      const chk = document.getElementById('cust-return-reduce-udhar');
      if (chk) chk.checked = true;
    } else {
      wrap.style.display = 'none';
      const chk = document.getElementById('cust-return-reduce-udhar');
      if (chk) chk.checked = false;
    }
  },

  async onReturnProductChange() {
    const prodSel = document.getElementById('cust-return-product-id');
    const unitLabel = document.getElementById('cust-return-unit-label');
    const priceEl = document.getElementById('cust-return-price');
    const batchSel = document.getElementById('cust-return-batch-id');

    if (!prodSel) return;
    const selectedOpt = prodSel.options[prodSel.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) {
      if (unitLabel) unitLabel.textContent = 'Units';
      if (priceEl) priceEl.value = '';
      if (batchSel) batchSel.innerHTML = '<option value="">Auto-Assign / Latest Batch</option>';
      this.calcReturnRefund();
      return;
    }

    const price = selectedOpt.getAttribute('data-price') || '0';
    const unit = selectedOpt.getAttribute('data-unit') || 'Units';

    if (unitLabel) unitLabel.textContent = unit;
    if (priceEl) priceEl.value = price;

    // Load active batches for this product
    try {
      if (batchSel) {
        batchSel.innerHTML = '<option value="">Loading batches...</option>';
        const prodId = Number(selectedOpt.value);
        const res = await api.getBatches({ productId: prodId });
        let batchHtml = '<option value="">Auto-Assign / Latest Batch</option>';
        if (res && res.success && res.data && res.data.length) {
          res.data.forEach(b => {
            batchHtml += `<option value="${b.id}">${b.batch_number} (Exp: ${b.expiry_date} | Stock: ${b.current_quantity})</option>`;
          });
        }
        batchSel.innerHTML = batchHtml;
      }
    } catch (err) {
      console.warn('Error loading product batches:', err);
      if (batchSel) batchSel.innerHTML = '<option value="">Auto-Assign / Latest Batch</option>';
    }

    this.calcReturnRefund();
  },

  calcReturnRefund() {
    const qty = Number(document.getElementById('cust-return-qty').value) || 0;
    const price = Number(document.getElementById('cust-return-price').value) || 0;
    const refundEl = document.getElementById('cust-return-refund');
    if (refundEl) {
      const refund = (qty * price).toFixed(2);
      refundEl.value = refund;
    }
  },

  async submitReturn(e) {
    e.preventDefault();
    const customer_id = document.getElementById('cust-return-customer-id').value;
    const invoice_no = document.getElementById('cust-return-invoice-no').value.trim();
    const product_id = document.getElementById('cust-return-product-id').value;
    const batch_id = document.getElementById('cust-return-batch-id').value;
    const quantity = Number(document.getElementById('cust-return-qty').value);
    const unit_price = Number(document.getElementById('cust-return-price').value);
    const refund_amount = Number(document.getElementById('cust-return-refund').value);
    const refund_method = document.getElementById('cust-return-method').value;
    const return_date = document.getElementById('cust-return-date').value;
    const reason = document.getElementById('cust-return-reason').value;
    const notes = document.getElementById('cust-return-notes').value.trim();
    const reduce_udhar = document.getElementById('cust-return-reduce-udhar') ? document.getElementById('cust-return-reduce-udhar').checked : false;

    if (!product_id) {
      ui.showToast('Please select a product to return.', 'warning');
      return;
    }

    if (!quantity || quantity <= 0) {
      ui.showToast('Please enter a valid return quantity.', 'warning');
      return;
    }

    const payload = {
      customer_id: customer_id ? Number(customer_id) : 5,
      invoice_no,
      product_id: Number(product_id),
      batch_id: batch_id ? Number(batch_id) : null,
      quantity,
      unit_price,
      refund_amount,
      refund_method,
      return_date,
      reason: notes ? `${reason} - ${notes}` : reason,
      reduce_udhar
    };

    try {
      const res = await api.recordCustomerReturn(payload);
      if (res && res.success) {
        ui.showToast(res.message || 'Customer return processed and inventory restored!', 'success');
        ui.closeModal('customer-return-modal');
        await this.loadStats();
        await this.loadCustomers();

        // Refresh details modal if open
        if (this.currentCustomerDetails && this.currentCustomerDetails.customer.id === Number(customer_id)) {
          this.openDetailsModal(customer_id);
        }
      } else {
        ui.showToast(res ? res.error : 'Failed to record return.', 'error');
      }
    } catch (err) {
      console.error('Error submitting customer return:', err);
      ui.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // 10.7: 360° CUSTOMER PROFILE DETAILS MODAL
  // -------------------------------------------------------------
  async openDetailsModal(id) {
    try {
      const res = await api.getCustomer(id);
      if (!res || !res.success || !res.data) {
        ui.showToast('Failed to load customer profile details.', 'error');
        return;
      }

      this.currentCustomerDetails = res.data;
      const { customer, metrics, recentSales, returns, payments, topProducts } = res.data;

      // Header
      document.getElementById('cust-details-code').textContent = customer.formatted_cust_id || `CUST-${String(customer.id).padStart(4, '0')}`;
      document.getElementById('cust-details-name').textContent = customer.name;

      const typeBadge = document.getElementById('cust-details-type-badge');
      if (typeBadge) {
        typeBadge.textContent = customer.type || 'Retail';
        typeBadge.className = `status-chip ${customer.type === 'Wholesale' ? 'cust-badge-wholesale' : customer.type === 'Daily Subscription' ? 'cust-badge-subscription' : 'cust-badge-retail'}`;
      }

      const statusChip = document.getElementById('cust-details-status-chip');
      if (statusChip) {
        statusChip.textContent = customer.status || 'Active';
        statusChip.className = `status-chip ${customer.status !== 'Inactive' ? 'badge-success' : 'badge-danger'}`;
      }

      const subTitle = document.getElementById('cust-details-subtitle');
      if (subTitle) {
        subTitle.textContent = `Phone: ${customer.phone || 'N/A'} | Email: ${customer.email || 'N/A'} | Address: ${customer.address || 'Counter / Walk-in'}`;
      }

      // Tab badges count
      document.getElementById('cust-details-sales-count').textContent = metrics.total_orders || 0;
      document.getElementById('cust-details-returns-count').textContent = metrics.returns_count || 0;
      document.getElementById('cust-details-payments-count').textContent = metrics.payments_count || 0;

      // Scorecard tiles
      document.getElementById('cust-score-gross').textContent = ui.formatCurrency(metrics.gross_sales || 0);
      document.getElementById('cust-score-net').textContent = ui.formatCurrency(metrics.net_purchases || 0);
      document.getElementById('cust-score-udhar').textContent = ui.formatCurrency(customer.credit_balance || 0);
      document.getElementById('cust-score-loyalty').textContent = `⭐ ${customer.loyalty_points || 0} pts`;

      // Engagement metrics
      document.getElementById('cust-score-orders').textContent = `${metrics.total_orders || 0} orders`;
      document.getElementById('cust-score-avg-order').textContent = ui.formatCurrency(metrics.avg_order_value || 0);
      document.getElementById('cust-score-discounts').textContent = ui.formatCurrency(metrics.total_discounts || 0);
      document.getElementById('cust-score-udhar-paid').textContent = ui.formatCurrency(metrics.total_payments_made || 0);
      document.getElementById('cust-score-last-order').textContent = metrics.last_order_date || 'No orders yet';

      // Favorite Products
      const topProdContainer = document.getElementById('cust-details-top-products');
      if (topProdContainer) {
        if (topProducts && topProducts.length) {
          let topHtml = '<div style="display:flex; flex-direction:column; gap:0.4rem;">';
          topProducts.forEach(tp => {
            topHtml += `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
                <div>
                  <span style="font-weight:700;">${tp.product_name}</span>
                  <span style="font-size:0.75rem; color:var(--text-muted);">(${tp.total_quantity_bought} ${tp.product_unit})</span>
                </div>
                <div style="font-weight:700; color:var(--primary-dark);">${ui.formatCurrency(tp.total_spend)}</div>
              </div>
            `;
          });
          topHtml += '</div>';
          topProdContainer.innerHTML = topHtml;
        } else {
          topProdContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No purchases yet.</div>';
        }
      }

      // Customer Notes
      const notesEl = document.getElementById('cust-details-notes');
      if (notesEl) {
        notesEl.textContent = customer.notes || 'No special notes or preferences recorded.';
      }

      // Render Sales Tab Table
      this.renderDetailsSalesTable(recentSales);

      // Render Returns Tab Table
      this.renderDetailsReturnsTable(returns);

      // Render Payments Tab Table
      this.renderDetailsPaymentsTable(payments);

      // Collect Udhar button visibility
      const collectBtn = document.getElementById('cust-details-collect-btn');
      if (collectBtn) {
        collectBtn.style.display = Number(customer.credit_balance || 0) > 0 ? 'inline-block' : 'none';
      }

      this.switchDetailsTab('scorecard');
      ui.openModal('customer-details-modal');
    } catch (err) {
      console.error('Error loading customer 360 profile:', err);
      ui.showToast(err.message, 'error');
    }
  },

  renderDetailsSalesTable(sales) {
    const tbody = document.getElementById('cust-details-sales-tbody');
    if (!tbody) return;

    if (!sales || !sales.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No sales recorded for this customer.</td></tr>';
      return;
    }

    let html = '';
    sales.forEach(s => {
      html += `
        <tr>
          <td style="font-weight:700; color:var(--primary-dark);">${s.invoice_no}</td>
          <td>${s.sale_date}</td>
          <td>${s.item_count || 1} items</td>
          <td><span class="status-chip badge-info">${s.payment_method || 'Cash'}</span></td>
          <td>${ui.formatCurrency(s.discount_amount || 0)}</td>
          <td style="font-weight:700;">${ui.formatCurrency(s.net_amount)}</td>
          <td><span class="status-chip badge-success">${s.payment_status || 'Paid'}</span></td>
          <td>${s.cashier_name || 'Staff'}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  },

  renderDetailsReturnsTable(returns) {
    const tbody = document.getElementById('cust-details-returns-tbody');
    if (!tbody) return;

    if (!returns || !returns.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No returns processed for this customer.</td></tr>';
      return;
    }

    let html = '';
    returns.forEach(r => {
      html += `
        <tr>
          <td style="font-weight:700; color:#B45309;">${r.formatted_return_no || r.return_no}</td>
          <td>${r.return_date}</td>
          <td><b>${r.product_name}</b> <span style="font-size:0.75rem; color:var(--text-muted);">(${r.product_sku})</span></td>
          <td>${r.batch_number || 'Auto'}</td>
          <td>${r.quantity} ${r.product_unit}</td>
          <td style="font-weight:700; color:var(--danger);">${ui.formatCurrency(r.refund_amount)}</td>
          <td style="font-size:0.8rem;">${r.reason || 'Customer Return'}</td>
          <td><span class="status-chip badge-warning">${r.refund_method || 'Cash'}</span></td>
          <td>${r.processed_by || 'Staff'}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  },

  renderDetailsPaymentsTable(payments) {
    const tbody = document.getElementById('cust-details-payments-tbody');
    if (!tbody) return;

    if (!payments || !payments.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No Udhar payment settlements recorded yet.</td></tr>';
      return;
    }

    let html = '';
    payments.forEach(p => {
      html += `
        <tr>
          <td style="font-weight:700; color:var(--primary);">${p.formatted_payment_id || 'PAY-' + p.id}</td>
          <td>${p.payment_date}</td>
          <td style="font-weight:700; color:#15803D;">${ui.formatCurrency(p.amount)}</td>
          <td><span class="status-chip badge-success">${p.payment_mode || 'Cash'}</span></td>
          <td style="font-size:0.8rem; font-family:monospace;">${p.reference_no || '-'}</td>
          <td style="font-size:0.8rem;">${p.notes || '-'}</td>
          <td>${p.received_by || 'Staff'}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  },

  switchDetailsTab(tabName) {
    const tabs = ['scorecard', 'sales', 'returns', 'payments'];
    tabs.forEach(t => {
      const btn = document.getElementById(`cust-tab-btn-${t}`);
      const pane = document.getElementById(`cust-details-pane-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (pane) pane.style.display = t === tabName ? 'block' : 'none';
    });
  },

  openUdharFromDetails() {
    if (!this.currentCustomerDetails) return;
    const c = this.currentCustomerDetails.customer;
    ui.closeModal('customer-details-modal');
    this.openUdharModal(c.id, c.name, c.credit_balance);
  },

  openReturnFromDetails() {
    if (!this.currentCustomerDetails) return;
    const c = this.currentCustomerDetails.customer;
    ui.closeModal('customer-details-modal');
    this.openReturnModal(c.id);
  },

  openEditFromDetails() {
    if (!this.currentCustomerDetails) return;
    const c = this.currentCustomerDetails.customer;
    ui.closeModal('customer-details-modal');
    this.openEditModal(c.id);
  },

  downloadCustomerStatement() {
    if (!this.currentCustomerDetails) return;
    const c = this.currentCustomerDetails.customer;
    window.location.href = `/api/customers/report?customerId=${c.id}`;
  },

  // -------------------------------------------------------------
  // 10.8: EXCEL REPORT DOWNLOAD
  // -------------------------------------------------------------
  downloadReport() {
    const params = new URLSearchParams();
    if (this.filters.type && this.filters.type !== 'all') params.append('type', this.filters.type);
    window.location.href = `/api/customers/report?${params.toString()}`;
  }
};
