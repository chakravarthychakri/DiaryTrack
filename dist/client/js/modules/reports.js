// ====================================================================
// MODULE 13: EXCEL REPORT GENERATION CONTROLLER
// ====================================================================

const reportsModule = {
  activePreviewSheet: 'dashboard',
  dropdownsLoaded: false,

  async init() {
    this.setupDateDefaults();
    if (!this.dropdownsLoaded) {
      await this.populateFilterDropdowns();
      this.dropdownsLoaded = true;
    }
  },

  setupDateDefaults() {
    const today = new Date();
    const todayStr = ui.formatDate(today);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const startStr = ui.formatDate(thirtyDaysAgo);

    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput && !startInput.value) startInput.value = startStr;
    if (endInput && !endInput.value) endInput.value = todayStr;
  },

  async populateFilterDropdowns() {
    try {
      // 1. Categories
      const catRes = await api.getCategories();
      const catSelect = document.getElementById('report-category-filter');
      if (catSelect && catRes.success && catRes.data) {
        catRes.data.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          catSelect.appendChild(opt);
        });
      }

      // 2. Products
      const prodRes = await api.getProducts();
      const prodSelect = document.getElementById('report-product-filter');
      if (prodSelect && prodRes.success && prodRes.data) {
        prodRes.data.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          prodSelect.appendChild(opt);
        });
      }

      // 3. Suppliers
      const supRes = await api.getSuppliers();
      const supSelect = document.getElementById('report-supplier-filter');
      if (supSelect && supRes.success && supRes.data) {
        supRes.data.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          supSelect.appendChild(opt);
        });
      }

      // 4. Branches
      const branchRes = await api.getBranches();
      const branchSelect = document.getElementById('report-branch-filter');
      if (branchSelect && branchRes.success && branchRes.data) {
        branchRes.data.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.name;
          branchSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn('Failed to populate report filters:', e);
    }
  },

  onRangeChange() {
    const rangeSelect = document.getElementById('report-range-select');
    const customDiv = document.getElementById('report-custom-dates-wrap');
    if (!rangeSelect) return;

    if (rangeSelect.value === 'custom') {
      if (customDiv) customDiv.style.display = 'inline-flex';
    } else {
      if (customDiv) customDiv.style.display = 'none';
    }
  },

  // Collect all filter parameters currently selected in the UI
  getFilterParams() {
    const range = document.getElementById('report-range-select')?.value || 'all';
    const startDate = document.getElementById('report-start-date')?.value || '';
    const endDate = document.getElementById('report-end-date')?.value || '';
    const categoryId = document.getElementById('report-category-filter')?.value || 'all';
    const productId = document.getElementById('report-product-filter')?.value || 'all';
    const supplierId = document.getElementById('report-supplier-filter')?.value || 'all';
    const branchId = document.getElementById('report-branch-filter')?.value || 'all';
    const movementType = document.getElementById('report-movement-type-filter')?.value || 'all';

    const params = new URLSearchParams();
    params.set('range', range);
    if (range === 'custom') {
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
    }
    if (categoryId !== 'all') params.set('categoryId', categoryId);
    if (productId !== 'all') params.set('productId', productId);
    if (supplierId !== 'all') params.set('supplierId', supplierId);
    if (branchId !== 'all') params.set('branchId', branchId);
    if (movementType !== 'all') params.set('movementType', movementType);

    return params.toString();
  },

  // 13.4 Download Master 10-Sheet Workbook
  downloadMaster() {
    const query = this.getFilterParams();
    const url = `/api/reports/download/master?${query}`;
    ui.showToast('Compiling 10-Sheet Master Business Workbook with ExcelJS...', 'info');

    const a = document.createElement('a');
    a.href = url;
    a.download = `DairyTrack_Master_Complete_Report_${ui.formatDate(new Date())}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      ui.showToast('Master Excel Workbook downloaded successfully!', 'success');
    }, 1500);
  },

  // 13.4 Download Individual Sheet Report
  download(type) {
    const query = this.getFilterParams();
    const url = `/api/reports/download/${type}?${query}`;
    ui.showToast(`Generating ${type.toUpperCase()} Excel worksheet...`, 'info');

    const a = document.createElement('a');
    a.href = url;
    a.download = `DairyTrack_${type}_${ui.formatDate(new Date())}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      ui.showToast(`${type.toUpperCase()} report downloaded successfully!`, 'success');
    }, 1200);
  },

  // 13.4 Print Report / Save PDF
  printReport() {
    const query = this.getFilterParams();
    const printUrl = `/api/reports/print-view?${query}`;
    window.open(printUrl, '_blank', 'width=900,height=750,scrollbars=yes');
  },

  // 13.4 Preview Before Downloading
  async openPreviewModal(sheetName = 'dashboard') {
    this.activePreviewSheet = sheetName;
    app.openModal('report-preview-modal');
    await this.switchPreviewTab(sheetName);
  },

  async switchPreviewTab(sheetName) {
    this.activePreviewSheet = sheetName;
    
    // Update active tab button style
    document.querySelectorAll('.report-preview-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-sheet') === sheetName);
    });

    const tbody = document.getElementById('report-preview-tbody');
    const thead = document.getElementById('report-preview-thead');
    const titleEl = document.getElementById('report-preview-sheet-title');
    const countBadge = document.getElementById('report-preview-count-badge');

    if (thead) thead.innerHTML = '<tr><th style="padding:1rem;">Loading...</th></tr>';
    if (tbody) tbody.innerHTML = '<tr><td style="padding:2.5rem; text-align:center; color:var(--text-muted);">Fetching live server data...</td></tr>';

    try {
      const range = document.getElementById('report-range-select')?.value || 'all';
      const startDate = document.getElementById('report-start-date')?.value || '';
      const endDate = document.getElementById('report-end-date')?.value || '';
      const categoryId = document.getElementById('report-category-filter')?.value || 'all';
      const productId = document.getElementById('report-product-filter')?.value || 'all';

      const res = await api.getReportPreview(sheetName, {
        range,
        startDate,
        endDate,
        categoryId,
        productId
      });

      if (!res.success || !res.data) {
        if (tbody) tbody.innerHTML = `<tr><td style="padding:2rem; text-align:center; color:var(--danger);">Failed to load preview data: ${res.error || 'Server error'}</td></tr>`;
        return;
      }

      const d = res.data;
      if (titleEl) titleEl.textContent = `Worksheet Preview: ${d.sheetName}`;
      if (countBadge) countBadge.textContent = `${d.count || 0} Records`;

      // Render headers
      if (thead) {
        thead.innerHTML = `
          <tr>
            ${(d.headers || []).map(h => `<th style="background:#15803D; color:#FFF; font-weight:700; padding:0.6rem 0.85rem; border:1px solid #CBD5E1;">${h}</th>`).join('')}
          </tr>
        `;
      }

      // Render rows
      if (tbody) {
        if (!d.rows || d.rows.length === 0) {
          tbody.innerHTML = `<tr><td colspan="${(d.headers || []).length}" style="padding:2rem; text-align:center; color:var(--text-muted);">No records found matching criteria in this sheet.</td></tr>`;
          return;
        }

        let html = '';
        d.rows.forEach((row, idx) => {
          const bg = idx % 2 === 1 ? 'background:var(--bg-subtle);' : '';
          html += `<tr style="${bg}">`;
          row.forEach((cell, cellIdx) => {
            const isFirst = cellIdx === 0;
            const isBold = isFirst || String(cell).startsWith('₹') || String(cell).startsWith('=');
            html += `<td style="padding:0.5rem 0.85rem; border:1px solid #CBD5E1; ${isBold ? 'font-weight:600;' : ''}">${cell}</td>`;
          });
          html += '</tr>';
        });
        tbody.innerHTML = html;
      }

    } catch (e) {
      console.error(e);
      if (tbody) tbody.innerHTML = `<tr><td style="padding:2rem; text-align:center; color:var(--danger);">Error rendering preview: ${e.message}</td></tr>`;
    }
  },

  downloadCurrentPreviewSheet() {
    this.download(this.activePreviewSheet);
  }
};
