// ====================================================================
// MODULE 12: ANALYTICS AND BUSINESS INTELLIGENCE
// ====================================================================

const analyticsModule = {
  // Module View State
  currentRange: '30days',
  currentGranularity: 'daily', // 'daily' | 'weekly' | 'monthly' | 'yearly'
  currentChartType: 'area',    // 'area' | 'bar' | 'line'
  currentRankingType: 'quantity', // 'quantity' | 'revenue' | 'transactions'
  currentStagnantTab: 'slow',     // 'slow' | 'zero' | 'promo'
  productSearchTerm: '',
  lastData: null,
  allExpenses: [],

  async init() {
    this.populateCategoryFilter();
    this.setupDateDefaults();
    await this.loadAnalytics();
  },

  setupDateDefaults() {
    const today = new Date();
    const todayStr = ui.formatDate(today);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const startStr = ui.formatDate(thirtyDaysAgo);

    const startInput = document.getElementById('analytics-start-date');
    const endInput = document.getElementById('analytics-end-date');
    if (startInput && !startInput.value) startInput.value = startStr;
    if (endInput && !endInput.value) endInput.value = todayStr;
  },

  async populateCategoryFilter() {
    const select = document.getElementById('analytics-category-filter');
    if (!select || select.children.length > 1) return;

    try {
      const res = await api.getCategories();
      if (res.success && res.data) {
        res.data.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          select.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn('Failed to load categories for analytics filter:', e);
    }
  },

  onRangeChange() {
    const rangeSelect = document.getElementById('analytics-range-select');
    const customDiv = document.getElementById('analytics-custom-dates');
    if (!rangeSelect) return;

    this.currentRange = rangeSelect.value;
    if (this.currentRange === 'custom') {
      if (customDiv) customDiv.style.display = 'inline-flex';
    } else {
      if (customDiv) customDiv.style.display = 'none';
      this.loadAnalytics();
    }
  },

  async loadAnalytics() {
    try {
      const range = document.getElementById('analytics-range-select')?.value || this.currentRange;
      const categoryId = document.getElementById('analytics-category-filter')?.value || 'all';
      const startDate = document.getElementById('analytics-start-date')?.value || '';
      const endDate = document.getElementById('analytics-end-date')?.value || '';

      const params = { range, categoryId };
      if (range === 'custom') {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      // Fetch analytics dashboard payload & expenses concurrently
      const [analyticsRes, expensesRes] = await Promise.all([
        api.getAnalyticsDashboard(params),
        api.getExpenses(params)
      ]);

      if (!analyticsRes.success) {
        ui.showToast(analyticsRes.error || 'Failed to load analytics', 'danger');
        return;
      }

      this.lastData = analyticsRes.data;
      if (expensesRes.success) {
        this.allExpenses = expensesRes.data || [];
      }

      const d = this.lastData;

      // 1. 12.4 Render Profit Analytics KPI Cards
      this.renderProfitKPIs(d.profit_analytics);

      // 2. 12.5 Render Interactive Timeline Chart (Sales, Cost, Profit)
      this.renderTrendChart();

      // 3. 12.3 & 12.5 Render Category Breakdown
      this.renderCategoryChart(d.sales_analytics.category_breakdown);

      // 4. 12.3 & 12.5 Render Payment Methods Distribution
      this.renderPaymentChart(d.sales_analytics.payment_methods);

      // 5. 12.1 Render Top-Selling Products (Top 5 Switchable)
      this.renderTopProducts();

      // 6. 12.2 Render Lowest-Selling & Stagnant Products
      this.renderStagnantProducts();

      // 7. 12.4 Render Operating Expenses Ledger
      this.renderExpensesLedger(expensesRes);

      // 8. 12.3 Render Comprehensive Product-Wise Sales Breakdown
      this.renderComprehensiveProductTable(d.sales_analytics.product_breakdown);

    } catch (err) {
      console.error('Error loading analytics:', err);
      ui.showToast('Error loading analytics dashboard: ' + err.message, 'danger');
    }
  },

  // -------------------------------------------------------------
  // 12.4 PROFIT ANALYTICS KPI CARDS
  // -------------------------------------------------------------
  renderProfitKPIs(pa) {
    if (!pa) return;

    // 1. Net Sales
    const netSalesEl = document.getElementById('bi-net-sales');
    const grossSalesSub = document.getElementById('bi-gross-sales-sub');
    const returnsSub = document.getElementById('bi-returns-sub');
    if (netSalesEl) netSalesEl.textContent = ui.formatCurrency(pa.net_sales);
    if (grossSalesSub) grossSalesSub.textContent = `Gross: ${ui.formatCurrency(pa.gross_sales)}`;
    if (returnsSub) {
      const ded = (pa.discounts + pa.sales_returns);
      returnsSub.textContent = ded > 0 ? `-${ui.formatCurrency(ded)} disc/returns` : 'No returns';
    }

    // 2. Cost of Goods Sold (COGS)
    const cogsEl = document.getElementById('bi-cogs');
    if (cogsEl) cogsEl.textContent = ui.formatCurrency(pa.cogs);

    // 3. Gross Profit
    const grossProfitEl = document.getElementById('bi-gross-profit');
    const grossMarginEl = document.getElementById('bi-gross-margin');
    if (grossProfitEl) grossProfitEl.textContent = ui.formatCurrency(pa.gross_profit);
    if (grossMarginEl) grossMarginEl.textContent = `Gross Margin: ${pa.gross_margin_pct}%`;

    // 4. Operating Expenses
    const opExpEl = document.getElementById('bi-operating-expenses');
    const expSubEl = document.getElementById('bi-expenses-sub');
    if (opExpEl) opExpEl.textContent = ui.formatCurrency(pa.operating_expenses.total);
    if (expSubEl) {
      const bk = pa.operating_expenses.breakdown || {};
      const rent = bk['Rent'] || 0;
      const sal = bk['Employee Salaries'] || 0;
      expSubEl.textContent = `Rent: ${ui.formatCurrency(rent)}, Salaries: ${ui.formatCurrency(sal)}`;
    }

    // 5. Operating Profit
    const opProfitEl = document.getElementById('bi-operating-profit');
    const opMarginEl = document.getElementById('bi-operating-margin');
    if (opProfitEl) {
      opProfitEl.textContent = ui.formatCurrency(pa.operating_profit);
      opProfitEl.style.color = pa.operating_profit >= 0 ? '#8B5CF6' : 'var(--danger)';
    }
    if (opMarginEl) opMarginEl.textContent = `Op Margin: ${pa.operating_margin_pct}%`;

    // 6. True Net Business Profit
    const netProfitEl = document.getElementById('bi-net-profit');
    const netMarginEl = document.getElementById('bi-net-margin');
    const spoilageSub = document.getElementById('bi-spoilage-deduction');
    if (netProfitEl) {
      netProfitEl.textContent = ui.formatCurrency(pa.net_business_profit);
      netProfitEl.style.color = pa.net_business_profit >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    if (netMarginEl) {
      netMarginEl.textContent = `Net Margin: ${pa.net_business_margin_pct}%`;
      netMarginEl.className = `status-chip ${pa.net_business_margin_pct >= 0 ? 'badge-success' : 'badge-danger'}`;
    }
    if (spoilageSub) {
      spoilageSub.textContent = pa.spoilage_loss > 0 ? `-${ui.formatCurrency(pa.spoilage_loss)} spoilage loss` : 'Zero spoilage loss';
    }
  },

  // -------------------------------------------------------------
  // 12.5 INTERACTIVE CHARTS: TIMELINE DYNAMICS
  // -------------------------------------------------------------
  setGranularity(gran) {
    this.currentGranularity = gran;
    document.querySelectorAll('#analytics-timeline-switcher button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-gran') === gran);
    });
    this.renderTrendChart();
  },

  setChartType(type) {
    this.currentChartType = type;
    document.querySelectorAll('#analytics-chart-type-switcher button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-type') === type);
    });
    this.renderTrendChart();
  },

  renderTrendChart() {
    if (!this.lastData || !this.lastData.sales_analytics) return;

    const timelineData = this.lastData.sales_analytics[this.currentGranularity] || [];
    const container = document.getElementById('analytics-trend-chart');
    if (!container) return;

    if (timelineData.length === 0) {
      container.innerHTML = `<div style="padding:3rem; text-align:center; color:var(--text-muted);">No sales recorded in the selected period.</div>`;
      return;
    }

    const labels = timelineData.map(t => t.period);
    const revs = timelineData.map(t => t.revenue);
    const costs = timelineData.map(t => t.cogs);
    const profits = timelineData.map(t => t.profit);

    const series = [
      { name: 'Net Revenue (₹)', data: revs, color: '#16A34A', fillOpacity: 0.16 },
      { name: 'Cost of Goods (₹)', data: costs, color: '#64748B', fillOpacity: 0.08 },
      { name: 'Gross Profit (₹)', data: profits, color: '#0284C7', fillOpacity: 0.12 }
    ];

    if (this.currentChartType === 'area') {
      ui.renderAreaChart('analytics-trend-chart', { labels, series, unit: state.currencySymbol });
    } else if (this.currentChartType === 'bar') {
      ui.renderBarChart('analytics-trend-chart', { labels, series, unit: state.currencySymbol });
    } else {
      ui.renderLineChart('analytics-trend-chart', { labels, series, unit: state.currencySymbol });
    }
  },

  // -------------------------------------------------------------
  // 12.3 & 12.5 CATEGORY BREAKDOWN CHART
  // -------------------------------------------------------------
  renderCategoryChart(cats) {
    const container = document.getElementById('analytics-category-chart');
    const badge = document.getElementById('analytics-category-count-badge');
    if (!container) return;

    if (!cats || cats.length === 0) {
      container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No category sales in selected range.</div>`;
      if (badge) badge.textContent = '0 Categories';
      return;
    }

    if (badge) badge.textContent = `${cats.length} Categories`;

    // Render multi-series horizontal/column bar chart showing Category Revenue vs Gross Profit
    const labels = cats.slice(0, 7).map(c => c.category);
    const revData = cats.slice(0, 7).map(c => c.revenue);
    const profitData = cats.slice(0, 7).map(c => c.gross_profit);

    const series = [
      { name: 'Revenue (₹)', data: revData, color: '#0284C7' },
      { name: 'Profit (₹)', data: profitData, color: '#16A34A' }
    ];

    ui.renderBarChart('analytics-category-chart', { labels, series, unit: state.currencySymbol });
  },

  // -------------------------------------------------------------
  // 12.3 & 12.5 PAYMENT METHODS CHART
  // -------------------------------------------------------------
  renderPaymentChart(methods) {
    const container = document.getElementById('analytics-payment-chart');
    const badge = document.getElementById('analytics-total-tx-badge');
    if (!container) return;

    if (!methods || methods.length === 0) {
      container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No payment records available.</div>`;
      if (badge) badge.textContent = '0 Transactions';
      return;
    }

    const totalTx = methods.reduce((acc, m) => acc + m.transaction_count, 0);
    if (badge) badge.textContent = `${totalTx} Transactions`;

    const colors = ['#16A34A', '#0284C7', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];
    const pieData = methods.map((m, idx) => ({
      label: `${m.payment_method} (${m.transaction_count})`,
      value: m.total_amount,
      color: colors[idx % colors.length]
    }));

    ui.renderPieChart('analytics-payment-chart', { data: pieData, donut: true, unit: state.currencySymbol });
  },

  // -------------------------------------------------------------
  // 12.1 TOP-SELLING PRODUCTS (TOP 5 SWITCHABLE)
  // -------------------------------------------------------------
  setRankingType(type) {
    this.currentRankingType = type;
    document.getElementById('btn-rank-qty')?.classList.toggle('active', type === 'quantity');
    document.getElementById('btn-rank-rev')?.classList.toggle('active', type === 'revenue');
    document.getElementById('btn-rank-tx')?.classList.toggle('active', type === 'transactions');
    this.renderTopProducts();
  },

  renderTopProducts() {
    if (!this.lastData || !this.lastData.top_products) return;

    const tbody = document.getElementById('analytics-top-products-body');
    const thMetric1 = document.getElementById('th-top-metric-1');
    const thMetric2 = document.getElementById('th-top-metric-2');
    if (!tbody) return;

    let items = [];
    if (this.currentRankingType === 'quantity') {
      items = this.lastData.top_products.by_quantity || [];
      if (thMetric1) thMetric1.textContent = 'Quantity Sold';
      if (thMetric2) thMetric2.textContent = 'Revenue (₹)';
    } else if (this.currentRankingType === 'revenue') {
      items = this.lastData.top_products.by_revenue || [];
      if (thMetric1) thMetric1.textContent = 'Revenue (₹)';
      if (thMetric2) thMetric2.textContent = 'Units Sold';
    } else {
      items = this.lastData.top_products.by_transactions || [];
      if (thMetric1) thMetric1.textContent = 'Transactions';
      if (thMetric2) thMetric2.textContent = 'Revenue (₹)';
    }

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:2rem; text-align:center; color:var(--text-muted);">No product sales recorded in this period.</td></tr>`;
      return;
    }

    const rankMedals = ['🥇 #1', '🥈 #2', '🥉 #3', '#4', '#5'];

    let html = '';
    items.forEach((p, idx) => {
      let metric1Val = '';
      let metric2Val = '';

      if (this.currentRankingType === 'quantity') {
        metric1Val = `<strong style="color:var(--primary-dark); font-size:0.95rem;">${p.quantity_sold} ${p.unit}</strong>`;
        metric2Val = ui.formatCurrency(p.revenue_generated);
      } else if (this.currentRankingType === 'revenue') {
        metric1Val = `<strong style="color:var(--success); font-size:0.95rem;">${ui.formatCurrency(p.revenue_generated)}</strong>`;
        metric2Val = `${p.quantity_sold} ${p.unit}`;
      } else {
        metric1Val = `<strong style="color:#8B5CF6; font-size:0.95rem;">${p.transaction_count} orders</strong>`;
        metric2Val = ui.formatCurrency(p.revenue_generated);
      }

      html += `
        <tr>
          <td><span style="font-weight:800; font-size:0.9rem;">${rankMedals[idx] || `#${idx + 1}`}</span></td>
          <td style="font-weight:700;">${p.name}</td>
          <td><span class="status-chip badge-info">${p.category}</span></td>
          <td>${metric1Val}</td>
          <td style="font-weight:600;">${metric2Val}</td>
          <td style="font-weight:700; color:var(--success);">+${ui.formatCurrency(p.profit_generated || 0)}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 12.2 LOWEST-SELLING & STAGNANT PRODUCTS
  // -------------------------------------------------------------
  setStagnantTab(tab) {
    this.currentStagnantTab = tab;
    document.getElementById('btn-stagnant-slow')?.classList.toggle('active', tab === 'slow');
    document.getElementById('btn-stagnant-zero')?.classList.toggle('active', tab === 'zero');
    document.getElementById('btn-stagnant-promo')?.classList.toggle('active', tab === 'promo');
    this.renderStagnantProducts();
  },

  renderStagnantProducts() {
    if (!this.lastData || !this.lastData.inventory_velocity) return;

    const tbody = document.getElementById('analytics-stagnant-products-body');
    if (!tbody) return;

    const iv = this.lastData.inventory_velocity;
    let list = [];

    if (this.currentStagnantTab === 'slow') {
      list = iv.slow_moving || [];
    } else if (this.currentStagnantTab === 'zero') {
      list = iv.zero_sellers || [];
    } else {
      list = iv.promotional_attention || [];
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:2rem; text-align:center; color:var(--text-muted);">No products match this velocity filter. Inventory moving healthily!</td></tr>`;
      return;
    }

    let html = '';
    list.slice(0, 6).forEach(p => {
      let badgeHtml = '';
      if (p.units_sold === 0) {
        badgeHtml = `<span class="velocity-badge velocity-badge-zero">❌ Zero Sales (${p.current_stock} ${p.unit} sitting)</span>`;
      } else if (p.stock_to_sales_ratio && Number(p.stock_to_sales_ratio) >= 2.5) {
        badgeHtml = `<span class="velocity-badge velocity-badge-slow">⚠️ Slow Mover (${p.stock_to_sales_ratio}x Stock-to-Sales)</span>`;
      } else {
        badgeHtml = `<span class="velocity-badge velocity-badge-promo">🏷️ Promo Discount Recommended</span>`;
      }

      const recText = p.recommendation || (p.units_sold === 0 ? 'Zero sales velocity: feature on POS storefront or offer 10% BOGO discount' : 'High inventory relative to sales: apply 15% clearance promo');

      html += `
        <tr>
          <td style="font-weight:700;">${p.name}</td>
          <td><span class="status-chip badge-info">${p.category}</span></td>
          <td style="font-weight:600; color:var(--warning);">${p.units_sold} ${p.unit}</td>
          <td style="font-weight:800; color:var(--danger);">${p.current_stock} ${p.unit}</td>
          <td style="font-weight:700;">${ui.formatCurrency(p.stock_valuation || 0)}</td>
          <td>
            ${badgeHtml}
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">${recText}</div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 12.4 OPERATING EXPENSES LEDGER
  // -------------------------------------------------------------
  renderExpensesLedger(res) {
    const tbody = document.getElementById('analytics-expenses-body');
    const badge = document.getElementById('bi-total-expenses-badge');
    if (!tbody) return;

    const list = this.allExpenses;
    const total = list.reduce((acc, r) => acc + r.amount, 0);

    if (badge) badge.textContent = `Total Operating Overheads: ${ui.formatCurrency(total)}`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="padding:2rem; text-align:center; color:var(--text-muted);">No operating expenses logged for this timeframe. Click "+ Add Expense" to track rent, salaries, or power bills.</td></tr>`;
      return;
    }

    let html = '';
    list.forEach(e => {
      let catBadgeClass = 'badge-info';
      if (e.category === 'Rent') catBadgeClass = 'badge-primary';
      else if (e.category === 'Electricity') catBadgeClass = 'badge-warning';
      else if (e.category === 'Transport') catBadgeClass = 'badge-info';
      else if (e.category === 'Employee Salaries') catBadgeClass = 'badge-success';

      html += `
        <tr>
          <td style="font-weight:600;">${e.expense_date}</td>
          <td><span class="status-chip ${catBadgeClass}">${e.category}</span></td>
          <td style="font-weight:700;">${e.title}</td>
          <td style="font-weight:800; color:var(--warning);">${ui.formatCurrency(e.amount)}</td>
          <td><span class="status-chip badge-neutral">${e.payment_mode || 'Cash'}</span></td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${e.reference_no || '-'}</td>
          <td style="font-size:0.8rem; color:var(--text-muted); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.notes || '-'}</td>
          <td style="font-size:0.8rem;">${e.recorded_by || 'Admin'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="analyticsModule.deleteExpense(${e.id})" title="Delete Expense Record" style="color:var(--danger); border-color:var(--border-subtle);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 12.3 COMPREHENSIVE PRODUCT-WISE SALES TABLE
  // -------------------------------------------------------------
  filterProductTable() {
    const input = document.getElementById('analytics-product-search');
    this.productSearchTerm = (input ? input.value : '').toLowerCase().trim();
    if (this.lastData && this.lastData.sales_analytics) {
      this.renderComprehensiveProductTable(this.lastData.sales_analytics.product_breakdown);
    }
  },

  renderComprehensiveProductTable(products) {
    const tbody = document.getElementById('analytics-products-body');
    if (!tbody) return;

    if (!products || products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="padding:2rem; text-align:center; color:var(--text-muted);">No products registered in system.</td></tr>`;
      return;
    }

    let filtered = products;
    if (this.productSearchTerm) {
      filtered = products.filter(p => 
        p.name.toLowerCase().includes(this.productSearchTerm) ||
        p.category.toLowerCase().includes(this.productSearchTerm)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="padding:2rem; text-align:center; color:var(--text-muted);">No products match "${this.productSearchTerm}".</td></tr>`;
      return;
    }

    let html = '';
    filtered.forEach(p => {
      const cogs = Number(p.units_sold) * Number(p.purchase_price);
      const grossProfit = Math.max(0, Number(p.revenue) - cogs);
      const marginPct = p.revenue > 0 ? ((grossProfit / p.revenue) * 100).toFixed(1) : 0;

      let velocityTag = '<span class="status-chip badge-neutral">Normal</span>';
      if (p.units_sold === 0 && p.current_stock > 0) {
        velocityTag = '<span class="status-chip badge-danger">Zero Movement</span>';
      } else if (p.units_sold > 0 && (p.current_stock / p.units_sold) >= 2.5) {
        velocityTag = '<span class="status-chip badge-warning">Slow Velocity</span>';
      } else if (p.units_sold >= 15) {
        velocityTag = '<span class="status-chip badge-success">🔥 Fast Mover</span>';
      }

      html += `
        <tr>
          <td style="font-weight:700;">${p.name}</td>
          <td><span class="status-chip badge-info">${p.category}</span></td>
          <td style="font-weight:800; color:var(--primary-dark);">${p.units_sold} ${p.unit}</td>
          <td style="font-weight:700;">${p.current_stock} ${p.unit}</td>
          <td style="font-weight:700;">${ui.formatCurrency(p.revenue)}</td>
          <td style="color:var(--text-secondary);">${ui.formatCurrency(cogs)}</td>
          <td style="font-weight:700; color:var(--success);">+${ui.formatCurrency(grossProfit)}</td>
          <td><span class="status-chip ${marginPct >= 20 ? 'badge-success' : 'badge-info'}">${marginPct}%</span></td>
          <td>${velocityTag}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // -------------------------------------------------------------
  // OPERATING EXPENSES CRUD OPERATIONS
  // -------------------------------------------------------------
  openExpenseModal() {
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.value = ui.formatDate(new Date());

    const titleInput = document.getElementById('exp-title');
    const amtInput = document.getElementById('exp-amount');
    const refInput = document.getElementById('exp-reference');
    const notesInput = document.getElementById('exp-notes');

    if (titleInput) titleInput.value = '';
    if (amtInput) amtInput.value = '';
    if (refInput) refInput.value = '';
    if (notesInput) notesInput.value = '';

    app.openModal('expense-modal');
  },

  async submitExpense(event) {
    event.preventDefault();
    try {
      const expense_date = document.getElementById('exp-date')?.value;
      const category = document.getElementById('exp-category')?.value;
      const title = document.getElementById('exp-title')?.value;
      const amount = parseFloat(document.getElementById('exp-amount')?.value);
      const payment_mode = document.getElementById('exp-payment-mode')?.value;
      const reference_no = document.getElementById('exp-reference')?.value;
      const notes = document.getElementById('exp-notes')?.value;

      if (!expense_date || !category || !title || isNaN(amount) || amount <= 0) {
        ui.showToast('Please provide a valid date, category, description and amount.', 'danger');
        return;
      }

      const payload = {
        expense_date,
        category,
        title,
        amount,
        payment_mode,
        reference_no,
        notes
      };

      const res = await api.createExpense(payload);
      if (!res.success) {
        ui.showToast(res.error || 'Failed to save expense', 'danger');
        return;
      }

      ui.showToast(`Operating expense of ${ui.formatCurrency(amount)} logged under ${category}`, 'success');
      app.closeModal('expense-modal');
      await this.loadAnalytics();

    } catch (err) {
      console.error(err);
      ui.showToast('Failed to record expense: ' + err.message, 'danger');
    }
  },

  async deleteExpense(id) {
    if (!confirm(`Are you sure you want to remove this expense record #${id}? This will adjust operating profit calculations.`)) {
      return;
    }

    try {
      const res = await api.deleteExpense(id);
      if (!res.success) {
        ui.showToast(res.error || 'Failed to delete expense', 'danger');
        return;
      }

      ui.showToast('Expense record deleted successfully', 'success');
      await this.loadAnalytics();
    } catch (err) {
      ui.showToast('Failed to delete expense: ' + err.message, 'danger');
    }
  },

  // -------------------------------------------------------------
  // EXCEL REPORT DOWNLOAD
  // -------------------------------------------------------------
  exportReport() {
    const range = document.getElementById('analytics-range-select')?.value || this.currentRange;
    const categoryId = document.getElementById('analytics-category-filter')?.value || 'all';
    const startDate = document.getElementById('analytics-start-date')?.value || '';
    const endDate = document.getElementById('analytics-end-date')?.value || '';

    let url = `/api/reports/download/analytics?range=${range}&categoryId=${categoryId}`;
    if (range === 'custom') {
      url += `&startDate=${startDate}&endDate=${endDate}`;
    }

    window.open(url, '_blank');
    ui.showToast('Generating and downloading Analytics & BI Excel Report...', 'info');
  }
};
