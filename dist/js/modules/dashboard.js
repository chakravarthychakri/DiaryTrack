// ====================================================================
// Module 3: Dashboard & Business Analytics System
// ====================================================================

const dashboardModule = {
  currentSalesPeriod: 'weekly',
  salesOverviewData: null,
  cachedStats: null,
  trxType: 'all',
  trxPage: 1,
  trxLimit: 8,
  trxSearchDebounce: null,
  cachedProducts: [],
  cachedBatches: [],

  async init() {
    this.initDateFilters();
    await this.loadStats();
    await this.loadTransactions();
  },

  initDateFilters() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const startDateEl = document.getElementById('trx-filter-start-date');
    const endDateEl = document.getElementById('trx-filter-end-date');
    if (startDateEl && !startDateEl.value) startDateEl.value = thirtyDaysAgo;
    if (endDateEl && !endDateEl.value) endDateEl.value = today;
  },

  // -------------------------------------------------------------
  // 3.1 & 3.2: LOAD AND RENDER COMPREHENSIVE DASHBOARD STATS
  // -------------------------------------------------------------
  async loadStats() {
    try {
      ui.renderSkeleton('dashboard-kpi-grid', 5);
      const res = await api.getDashboardStats(state.currentBranchId);
      if (!res.success) return;
      const d = res.data;
      this.cachedStats = d;

      // 1. Update Global Sidebar Badges
      const expBadge = document.getElementById('sidebar-expiry-badge');
      if (expBadge) {
        const expiredCount = d.inventoryOverview ? d.inventoryOverview.expiredUnits : 0;
        expBadge.textContent = expiredCount;
        expBadge.style.display = expiredCount > 0 ? 'inline-block' : 'none';
      }

      const lowBadge = document.getElementById('sidebar-low-stock-badge');
      if (lowBadge) {
        const lowCount = d.inventoryOverview ? d.inventoryOverview.lowStockCount : 0;
        lowBadge.textContent = lowCount;
        lowBadge.style.display = lowCount > 0 ? 'inline-block' : 'none';
      }

      // 2. Render Exact 10 KPI Cards
      this.renderKpiCards(d.kpiCards);

      // 3. Store Sales Overview Data & Render Active Period (Weekly default)
      this.salesOverviewData = d.salesOverview;
      this.renderSalesOverviewChart(this.currentSalesPeriod);

      // 4. Render Profit Analysis
      this.renderProfitAnalysis(d.profitAnalysis);

      // 5. Render Inventory Overview Gauges & Urgent Expiry
      this.renderInventoryOverview(d.inventoryOverview);
      this.renderUrgentExpiry(d.criticalExpiryBatches || []);

      // 6. Render Product Performance (Top 5 & Lowest 5)
      this.renderBestSelling(d.productPerformance?.topFive || []);
      this.renderLeastSelling(d.productPerformance?.lowestFive || []);

      // 7. Render Category Donut
      ui.renderCategoryDonut('dashboard-category-chart-container', d.productPerformance?.categorySales || []);

    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      ui.showToast('Could not refresh dashboard metrics', 'error');
    }
  },

  // -------------------------------------------------------------
  // 3.1: EXACT 10 KPI CARDS WITH TRENDS AND PREVIOUS PERIOD COMPARISON
  // -------------------------------------------------------------
  renderKpiCards(cards) {
    const kpiGrid = document.getElementById('dashboard-kpi-grid');
    if (!kpiGrid || !cards || !cards.length) return;

    const iconMap = {
      receipt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line></svg>`,
      dollar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
      box: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
      'shopping-bag': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`,
      layers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
      'trending-up': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
      'alert-triangle': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      clock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
      trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
      archive: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`
    };

    const colorBorderMap = {
      primary: 'var(--primary)',
      success: 'var(--success)',
      warning: 'var(--warning)',
      danger: 'var(--danger)',
      info: 'var(--info)'
    };

    const colorBgMap = {
      primary: 'var(--primary-light)',
      success: 'var(--success-light)',
      warning: 'var(--warning-light)',
      danger: 'var(--danger-light)',
      info: 'var(--info-light)'
    };

    let html = '';
    cards.forEach(card => {
      const topColor = colorBorderMap[card.color] || 'var(--primary)';
      const pillBg = colorBgMap[card.color] || 'var(--bg-subtle)';
      const iconSvg = iconMap[card.icon] || iconMap.box;

      // Metric Value Formatting
      let formattedVal = card.isCurrency ? ui.formatCurrency(card.value) : ui.formatNumber(card.value);
      if (card.unit) {
        formattedVal += ` <span style="font-size:0.8rem; font-weight:500; color:var(--text-secondary);">${card.unit}</span>`;
      }

      // Comparison / Trend badge
      let trendBadge = '';
      if (card.changePercent !== undefined) {
        const isUp = card.changePercent >= 0;
        const trendClass = isUp ? 'trend-up' : 'trend-down';
        const arrow = isUp ? '▲ +' : '▼ ';
        trendBadge = `
          <span class="kpi-trend-pill ${trendClass}" title="Previous period: ${card.isCurrency ? ui.formatCurrency(card.prevValue || 0) : card.prevValue || 0}">
            ${arrow}${Math.abs(card.changePercent)}% vs yest
          </span>
        `;
      } else if (card.subtext) {
        trendBadge = `<span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">${card.subtext}</span>`;
      }

      html += `
        <div class="kpi-card-v3" style="border-top: 4px solid ${topColor};">
          <div class="kpi-card-top">
            <span class="kpi-title">${card.title}</span>
            <div class="kpi-icon-pill" style="background:${pillBg}; color:${topColor};">
              ${iconSvg}
            </div>
          </div>
          <div class="kpi-metric-val">${formattedVal}</div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:auto;">
            ${trendBadge}
          </div>
        </div>
      `;
    });

    kpiGrid.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 3.2: SALES OVERVIEW (DAILY / WEEKLY / MONTHLY / YEARLY)
  // -------------------------------------------------------------
  switchSalesPeriod(period) {
    this.currentSalesPeriod = period;

    // Toggle tab active class
    const tabBtns = document.querySelectorAll('#sales-overview-period-tabs .period-tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });

    this.renderSalesOverviewChart(period);
  },

  renderSalesOverviewChart(period) {
    if (!this.salesOverviewData || !this.salesOverviewData[period]) {
      document.getElementById('dashboard-trend-chart-container').innerHTML = `
        <div style="padding:2.5rem; text-align:center; color:var(--text-muted);">
          No ${period} sales transactions recorded for this period.
        </div>
      `;
      return;
    }

    const dataPoints = this.salesOverviewData[period];
    if (!dataPoints.length) {
      document.getElementById('dashboard-trend-chart-container').innerHTML = `
        <div style="padding:2.5rem; text-align:center; color:var(--text-muted);">
          No sales activity recorded in this period.
        </div>
      `;
      document.getElementById('period-summary-revenue').textContent = '₹0.00';
      document.getElementById('period-summary-cogs').textContent = '₹0.00';
      document.getElementById('period-summary-profit').textContent = '₹0.00';
      document.getElementById('period-summary-orders').textContent = '0';
      return;
    }

    // Calculate period summary
    let sumRev = 0;
    let sumCogs = 0;
    let sumProfit = 0;
    let sumOrders = 0;

    const labels = [];
    const revs = [];
    const costs = [];
    const profits = [];

    dataPoints.forEach(p => {
      labels.push(p.label);
      const rev = Number(p.revenue || 0);
      const cogs = Number(p.cogs || 0);
      const profit = Number(p.profit || 0);
      const orders = Number(p.orders || 0);

      sumRev += rev;
      sumCogs += cogs;
      sumProfit += profit;
      sumOrders += orders;

      revs.push(rev);
      costs.push(cogs);
      profits.push(profit);
    });

    // Update period summary chips
    document.getElementById('period-summary-revenue').textContent = ui.formatCurrency(sumRev);
    document.getElementById('period-summary-cogs').textContent = ui.formatCurrency(sumCogs);
    document.getElementById('period-summary-profit').textContent = ui.formatCurrency(sumProfit);
    document.getElementById('period-summary-orders').textContent = sumOrders;

    // Render multi-series interactive trend chart
    ui.renderTrendChart('dashboard-trend-chart-container', {
      dates: labels,
      series: [
        { name: 'Revenue', data: revs, color: '#16A34A', fill: true },
        { name: 'Cost of Goods', data: costs, color: '#64748B', fill: false },
        { name: 'Gross Profit', data: profits, color: '#0284C7', fill: false }
      ]
    });
  },

  // -------------------------------------------------------------
  // 3.2: PROFIT & LOSS ANALYSIS
  // -------------------------------------------------------------
  renderProfitAnalysis(p) {
    const el = document.getElementById('dashboard-profit-analysis-container');
    if (!el || !p) return;

    const marginChip = document.getElementById('profit-margin-chip');
    if (marginChip) {
      marginChip.textContent = `${p.marginPercent}% Gross Margin`;
    }

    el.innerHTML = `
      <div class="profit-metrics-row">
        <div class="profit-metric-box">
          <div class="profit-metric-label">Total Revenue</div>
          <div class="profit-metric-value" style="color:var(--primary);">${ui.formatCurrency(p.revenue)}</div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Gross Sales</div>
        </div>

        <div class="profit-metric-box">
          <div class="profit-metric-label">Cost of Goods</div>
          <div class="profit-metric-value" style="color:var(--text-secondary);">${ui.formatCurrency(p.cogs)}</div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Procurement Cost</div>
        </div>

        <div class="profit-metric-box">
          <div class="profit-metric-label">Gross Profit</div>
          <div class="profit-metric-value" style="color:var(--success);">${ui.formatCurrency(p.grossProfit)}</div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Before Spoilage</div>
        </div>

        <div class="profit-metric-box" style="border-color: rgba(239, 68, 68, 0.3);">
          <div class="profit-metric-label" style="color:var(--danger);">Wastage / Loss</div>
          <div class="profit-metric-value" style="color:var(--danger);">${ui.formatCurrency(p.wastageCost)}</div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Discarded Stock</div>
        </div>
      </div>

      <!-- Net Retained Earnings Card -->
      <div style="padding:1rem; border-radius:var(--radius-md); background:var(--primary-light); border: 1px solid rgba(22, 163, 74, 0.2); display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--primary-dark);">Net Retained Earnings</div>
          <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">Gross Profit minus Spoilage Write-Offs</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.4rem; font-weight:800; color:var(--primary-dark);">${ui.formatCurrency(p.netEarnings)}</div>
          <span class="status-chip badge-success" style="font-size:0.65rem;">Active Realized</span>
        </div>
      </div>
    `;
  },

  // -------------------------------------------------------------
  // 3.2: INVENTORY OVERVIEW GAUGES
  // -------------------------------------------------------------
  renderInventoryOverview(inv) {
    const el = document.getElementById('dashboard-inventory-gauges');
    if (!el || !inv) return;

    el.innerHTML = `
      <div class="inventory-gauge-card" style="border-left-color: var(--primary);">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Available Stock</div>
        <div style="font-size:1.6rem; font-weight:800; color:var(--text-primary); margin:0.3rem 0;">
          ${ui.formatNumber(inv.availableUnits)} <span style="font-size:0.8rem; font-weight:500; color:var(--text-secondary);">Units</span>
        </div>
        <div style="font-size:0.72rem; color:var(--success); font-weight:600;">✓ Healthy Shelf Inventory</div>
      </div>

      <div class="inventory-gauge-card" style="border-left-color: var(--warning);">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Low Stock SKUs</div>
        <div style="font-size:1.6rem; font-weight:800; color:var(--warning); margin:0.3rem 0;">
          ${inv.lowStockCount} <span style="font-size:0.8rem; font-weight:500; color:var(--text-secondary);">Items</span>
        </div>
        <div style="font-size:0.72rem; color:var(--warning); font-weight:600;">⚠️ At or below reorder level</div>
      </div>

      <div class="inventory-gauge-card" style="border-left-color: var(--danger);">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Out of Stock</div>
        <div style="font-size:1.6rem; font-weight:800; color:var(--danger); margin:0.3rem 0;">
          ${inv.outOfStockCount} <span style="font-size:0.8rem; font-weight:500; color:var(--text-secondary);">Items</span>
        </div>
        <div style="font-size:0.72rem; color:var(--danger); font-weight:600;">❌ 0 units remaining</div>
      </div>

      <div class="inventory-gauge-card" style="border-left-color: #DC2626;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Expired On Shelf</div>
        <div style="font-size:1.6rem; font-weight:800; color:#DC2626; margin:0.3rem 0;">
          ${ui.formatNumber(inv.expiredUnits)} <span style="font-size:0.8rem; font-weight:500; color:var(--text-secondary);">Units</span>
        </div>
        <div style="font-size:0.72rem; color:var(--danger); font-weight:600;">⛔ Needs quarantine</div>
      </div>
    `;
  },

  // -------------------------------------------------------------
  // 3.2: URGENT EXPIRY ALERTS (< 48 HOURS)
  // -------------------------------------------------------------
  renderUrgentExpiry(batches) {
    const el = document.getElementById('dashboard-critical-expiry-list');
    if (!el) return;

    if (!batches || !batches.length) {
      el.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--success); margin-bottom:0.5rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <div style="font-weight:600; color:var(--text-primary);">All Stock Fresh!</div>
          <div style="font-size:0.75rem;">No production batches expiring in the next 48 hours.</div>
        </div>
      `;
      return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:0.6rem;">';
    batches.forEach(b => {
      const isPast = new Date(b.expiry_date) < new Date();
      html += `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 0.75rem; border-radius:var(--radius-md); background:var(--bg-subtle); border-left: 3px solid ${isPast ? 'var(--danger)' : 'var(--warning)'};">
          <div>
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">${b.product_name}</div>
            <div style="font-size:0.72rem; color:var(--text-secondary);">${b.batch_number} • Exp: <strong style="color:${isPast ? 'var(--danger)' : 'var(--warning)'};">${ui.formatDate(b.expiry_date)}</strong></div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800; font-size:0.9rem; color:${isPast ? 'var(--danger)' : 'var(--warning)'};">${b.current_quantity} ${b.unit}</div>
            <div style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">${ui.formatCurrency(b.loss_risk)} loss risk</div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    el.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 3.2: PRODUCT PERFORMANCE (TOP 5 BEST & TOP 5 LEAST SELLING)
  // -------------------------------------------------------------
  renderBestSelling(items) {
    const table = document.getElementById('dashboard-best-selling-table');
    if (!table) return;

    if (!items || !items.length) {
      table.innerHTML = '<tbody><tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No sales recorded yet.</td></tr></tbody>';
      return;
    }

    let html = `
      <thead>
        <tr>
          <th>Product</th>
          <th>Units Sold</th>
          <th>Revenue</th>
          <th>Profit</th>
        </tr>
      </thead>
      <tbody>
    `;

    items.forEach((it, idx) => {
      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:0.72rem; font-weight:800; width:18px; height:18px; border-radius:50%; background:var(--primary-light); color:var(--primary-dark); display:inline-flex; align-items:center; justify-content:center;">${idx + 1}</span>
              <div>
                <div style="font-weight:700; font-size:0.85rem;">${it.name}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${it.category}</div>
              </div>
            </div>
          </td>
          <td style="font-weight:700; color:var(--primary-dark);">${it.units_sold} ${it.unit}</td>
          <td style="font-weight:600;">${ui.formatCurrency(it.revenue)}</td>
          <td style="font-weight:700; color:var(--success);">${ui.formatCurrency(it.profit)}</td>
        </tr>
      `;
    });
    html += '</tbody>';
    table.innerHTML = html;
  },

  renderLeastSelling(items) {
    const table = document.getElementById('dashboard-least-selling-table');
    if (!table) return;

    if (!items || !items.length) {
      table.innerHTML = '<tbody><tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No slow moving items detected.</td></tr></tbody>';
      return;
    }

    let html = `
      <thead>
        <tr>
          <th>Product</th>
          <th>Sold</th>
          <th>Sitting Stock</th>
          <th>MRP</th>
        </tr>
      </thead>
      <tbody>
    `;

    items.forEach(it => {
      html += `
        <tr>
          <td>
            <div style="font-weight:700; font-size:0.85rem;">${it.name}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${it.category}</div>
          </td>
          <td style="font-weight:700; color:var(--warning);">${it.units_sold} ${it.unit}</td>
          <td style="font-weight:700; color:var(--danger);">${it.stock_on_hand} ${it.unit}</td>
          <td style="font-weight:600;">${ui.formatCurrency(it.selling_price)}</td>
        </tr>
      `;
    });
    html += '</tbody>';
    table.innerHTML = html;
  },

  // -------------------------------------------------------------
  // 3.3: RECENT TRANSACTIONS (MULTI-TYPE, FILTER, SORT & PAGINATION)
  // -------------------------------------------------------------
  setTrxType(type) {
    this.trxType = type;
    this.trxPage = 1;

    // Toggle active pill styling
    const pills = document.querySelectorAll('.trx-filter-row .trx-type-pill');
    pills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.type === type);
    });

    this.loadTransactions();
  },

  debounceTrxSearch() {
    clearTimeout(this.trxSearchDebounce);
    this.trxSearchDebounce = setTimeout(() => {
      this.trxPage = 1;
      this.loadTransactions();
    }, 300);
  },

  prevTrxPage() {
    if (this.trxPage > 1) {
      this.trxPage--;
      this.loadTransactions();
    }
  },

  nextTrxPage() {
    this.trxPage++;
    this.loadTransactions();
  },

  async loadTransactions() {
    const table = document.getElementById('dashboard-recent-transactions-table');
    if (!table) return;

    try {
      const search = document.getElementById('trx-filter-search')?.value || '';
      const startDate = document.getElementById('trx-filter-start-date')?.value || '';
      const endDate = document.getElementById('trx-filter-end-date')?.value || '';
      const sort = document.getElementById('trx-filter-sort')?.value || 'newest';

      table.innerHTML = '<tbody><tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading transactions...</td></tr></tbody>';

      const res = await api.getDashboardTransactions({
        type: this.trxType,
        search,
        startDate,
        endDate,
        sort,
        page: this.trxPage,
        limit: this.trxLimit
      });

      if (!res.success) throw new Error(res.error);

      const items = res.data || [];
      const pg = res.pagination || { page: 1, totalPages: 1, totalCount: items.length };

      // Update Pagination Bar
      const startIdx = items.length ? (pg.page - 1) * pg.limit + 1 : 0;
      const endIdx = (pg.page - 1) * pg.limit + items.length;
      document.getElementById('trx-pagination-info').textContent = `Showing ${startIdx} to ${endIdx} of ${pg.totalCount} transactions`;
      document.getElementById('trx-page-indicator').textContent = `Page ${pg.page} of ${pg.totalPages}`;
      document.getElementById('trx-prev-btn').disabled = pg.page <= 1;
      document.getElementById('trx-next-btn').disabled = pg.page >= pg.totalPages;

      if (!items.length) {
        table.innerHTML = '<tbody><tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No transactions found matching the filter criteria.</td></tr></tbody>';
        return;
      }

      let html = `
        <thead>
          <tr>
            <th>Type</th>
            <th>Reference #</th>
            <th>Date</th>
            <th>Customer / Party / Product</th>
            <th>Details / Reason</th>
            <th>Amount / Impact</th>
            <th>Status / Operator</th>
          </tr>
        </thead>
        <tbody>
      `;

      items.forEach(it => {
        let typeBadge = '';
        let amountFormatted = '';

        if (it.type === 'Sale') {
          typeBadge = '<span class="status-chip badge-success">💰 Sale</span>';
          amountFormatted = `<span style="font-weight:700; color:var(--primary-dark);">+${ui.formatCurrency(it.amount)}</span>`;
        } else if (it.type === 'Purchase') {
          typeBadge = '<span class="status-chip badge-info">📦 Purchase</span>';
          amountFormatted = `<span style="font-weight:700; color:var(--text-primary);">${ui.formatCurrency(it.amount)}</span>`;
        } else if (it.type.includes('Movement') || it.type === 'Transfer' || it.type === 'Adjustment') {
          typeBadge = '<span class="status-chip badge-warning">🔄 Stock Move</span>';
          amountFormatted = `<span style="font-weight:600; color:var(--text-secondary);">${ui.formatCurrency(it.amount || 0)}</span>`;
        } else {
          typeBadge = '<span class="status-chip badge-danger">⚠️ Loss / Return</span>';
          amountFormatted = `<span style="font-weight:700; color:var(--danger); font-size:0.85rem;">-${ui.formatCurrency(it.amount)} loss</span>`;
        }

        html += `
          <tr>
            <td>${typeBadge}</td>
            <td>
              ${it.type === 'Sale' 
                ? `<a href="javascript:void(0)" onclick="salesModule.viewInvoice(${it.id})" style="font-weight:700; color:var(--primary); text-decoration:none;">${it.ref_no}</a>` 
                : `<strong style="font-weight:700; color:var(--text-primary);">${it.ref_no}</strong>`
              }
            </td>
            <td style="font-size:0.8rem; color:var(--text-secondary);">${ui.formatDate(it.date)}</td>
            <td style="font-weight:600;">${it.party}</td>
            <td style="font-size:0.8rem; color:var(--text-muted);">${it.details || '—'}</td>
            <td>${amountFormatted}</td>
            <td>
              <div style="font-size:0.8rem; font-weight:600;">${it.status || 'Completed'}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">By ${it.operator || 'Staff'}</div>
            </td>
          </tr>
        `;
      });

      html += '</tbody>';
      table.innerHTML = html;

    } catch (err) {
      console.error('Error loading transactions feed:', err);
      table.innerHTML = '<tbody><tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--danger);">Failed to load transactions.</td></tr></tbody>';
    }
  },

  // -------------------------------------------------------------
  // 3.4: QUICK ACTIONS HANDLERS
  // -------------------------------------------------------------
  openAddProduct() {
    app.navigate('products');
    setTimeout(() => {
      app.openNewProductModal();
    }, 100);
  },

  openRecordPurchase() {
    app.navigate('purchases');
    setTimeout(() => {
      purchasesModule.openNewModal();
    }, 100);
  },

  openGenerateReport() {
    app.navigate('reports');
  },

  async openQuickAddStock() {
    try {
      const prodRes = await api.getProducts({ status: 'active' });
      const branchRes = await api.getBranches();

      if (prodRes.success) {
        this.cachedProducts = prodRes.data;
        const pSelect = document.getElementById('qas-product-id');
        pSelect.innerHTML = '<option value="">-- Select Product --</option>' +
          prodRes.data.map(p => `<option value="${p.id}" data-cost="${p.purchase_price}" data-shelflife="${p.shelf_life_days}">${p.name} (${p.unit})</option>`).join('');
      }

      if (branchRes.success) {
        const bSelect = document.getElementById('qas-branch-id');
        bSelect.innerHTML = branchRes.data.map(b => `<option value="${b.id}" ${b.id === state.currentBranchId ? 'selected' : ''}>${b.name}</option>`).join('');
      }

      // Default batch number
      const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const rand = Math.floor(100 + Math.random() * 900);
      document.getElementById('qas-batch-number').value = `B-${todayStr}-${rand}`;
      document.getElementById('qas-mfg-date').value = new Date().toISOString().split('T')[0];

      app.openModal('quick-add-stock-modal');
    } catch (err) {
      console.error('Failed to open Quick Add Stock modal:', err);
      ui.showToast('Could not load products for stock addition', 'error');
    }
  },

  onQuickStockProductChange() {
    const pSelect = document.getElementById('qas-product-id');
    const selectedOption = pSelect.options[pSelect.selectedIndex];
    if (!selectedOption || !selectedOption.value) return;

    const cost = selectedOption.dataset.cost;
    const shelfLife = parseInt(selectedOption.dataset.shelflife || '7', 10);

    if (cost) document.getElementById('qas-cost').value = cost;

    // Auto calculate expiry
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + shelfLife);
    document.getElementById('qas-exp-date').value = expDate.toISOString().split('T')[0];
  },

  async submitQuickAddStock(e) {
    e.preventDefault();
    try {
      const productId = Number(document.getElementById('qas-product-id').value);
      const batchNumber = document.getElementById('qas-batch-number').value.trim();
      const quantity = Number(document.getElementById('qas-quantity').value);
      const purchaseCost = Number(document.getElementById('qas-cost').value);
      const branchId = Number(document.getElementById('qas-branch-id').value);
      const mfgDate = document.getElementById('qas-mfg-date').value;
      const expiryDate = document.getElementById('qas-exp-date').value;
      const notes = document.getElementById('qas-notes').value.trim();

      const res = await api.quickAddStock({
        product_id: productId,
        batch_number: batchNumber,
        quantity,
        purchase_cost: purchaseCost,
        branch_id: branchId,
        mfg_date: mfgDate,
        expiry_date: expiryDate,
        notes
      });

      if (!res.success) throw new Error(res.error);

      ui.showToast('Stock added successfully!', 'success');
      app.closeModal('quick-add-stock-modal');

      // Refresh Dashboard & Transactions
      await this.loadStats();
      await this.loadTransactions();

    } catch (err) {
      console.error('Error adding stock:', err);
      ui.showToast(err.message || 'Failed to add stock', 'error');
    }
  },

  async openQuickRecordLoss() {
    try {
      const prodRes = await api.getProducts({ status: 'active' });
      if (prodRes.success) {
        this.cachedProducts = prodRes.data;
        const pSelect = document.getElementById('qrl-product-id');
        pSelect.innerHTML = '<option value="">-- Select Product --</option>' +
          prodRes.data.map(p => `<option value="${p.id}">${p.name} (${p.unit})</option>`).join('');
      }

      document.getElementById('qrl-batch-id').innerHTML = '<option value="">-- Choose Active Batch --</option>';
      document.getElementById('qrl-batch-stock-hint').textContent = '';
      app.openModal('quick-record-loss-modal');
    } catch (err) {
      console.error('Failed to open Quick Record Loss modal:', err);
      ui.showToast('Could not load products for loss record', 'error');
    }
  },

  async onQuickLossProductChange() {
    const productId = document.getElementById('qrl-product-id').value;
    const bSelect = document.getElementById('qrl-batch-id');
    const hint = document.getElementById('qrl-batch-stock-hint');
    hint.textContent = '';

    if (!productId) {
      bSelect.innerHTML = '<option value="">-- Choose Active Batch --</option>';
      return;
    }

    try {
      const res = await api.getBatches({ productId, status: 'active' });
      if (res.success && res.data.length) {
        this.cachedBatches = res.data;
        bSelect.innerHTML = '<option value="">-- Choose Active Batch --</option>' +
          res.data.map(b => `<option value="${b.id}" data-stock="${b.current_quantity}" data-cost="${b.purchase_cost}">Batch ${b.batch_number} (Avail: ${b.current_quantity}, Exp: ${ui.formatDate(b.expiry_date)})</option>`).join('');
      } else {
        bSelect.innerHTML = '<option value="">-- No Active Batches with Stock --</option>';
        hint.textContent = 'No positive stock batches available for this product.';
      }
    } catch (err) {
      console.error('Failed to load product batches:', err);
    }
  },

  onQuickLossBatchChange() {
    const bSelect = document.getElementById('qrl-batch-id');
    const selectedOption = bSelect.options[bSelect.selectedIndex];
    const hint = document.getElementById('qrl-batch-stock-hint');
    if (!selectedOption || !selectedOption.value) {
      hint.textContent = '';
      return;
    }

    const availStock = selectedOption.dataset.stock;
    const cost = selectedOption.dataset.cost;
    hint.textContent = `Available stock in this batch: ${availStock} units (Cost: ₹${cost}/unit)`;
    document.getElementById('qrl-quantity').max = availStock;
  },

  async submitQuickRecordLoss(e) {
    e.preventDefault();
    try {
      const productId = Number(document.getElementById('qrl-product-id').value);
      const batchId = Number(document.getElementById('qrl-batch-id').value);
      const quantity = Number(document.getElementById('qrl-quantity').value);
      const reason = document.getElementById('qrl-reason').value;
      const actionTaken = document.getElementById('qrl-action').value;
      const notes = document.getElementById('qrl-notes').value.trim();

      const res = await api.quickRecordLoss({
        product_id: productId,
        batch_id: batchId,
        quantity,
        reason,
        action_taken: actionTaken,
        notes
      });

      if (!res.success) throw new Error(res.error);

      ui.showToast('Stock loss recorded and deducted from inventory.', 'success');
      app.closeModal('quick-record-loss-modal');

      // Refresh Dashboard & Transactions
      await this.loadStats();
      await this.loadTransactions();

    } catch (err) {
      console.error('Error recording stock loss:', err);
      ui.showToast(err.message || 'Failed to record stock loss', 'error');
    }
  }
};
