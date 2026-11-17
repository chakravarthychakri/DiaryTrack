// ====================================================================
// DairyTrack UI Helpers & Custom SVG Chart Engine
// ====================================================================

const ui = {
  // 1. Toast System
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    switch (type) {
      case 'success':
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        break;
      case 'error':
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        break;
      case 'warning':
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        break;
      default:
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        break;
    }

    toast.innerHTML = `
      ${iconSvg}
      <span style="flex:1;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // 2. Modals
  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  // 3. Formatters
  formatCurrency(value) {
    const sym = state.currencySymbol || '₹';
    const num = Number(value) || 0;
    return `${sym} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  formatNumber(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('en-IN');
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  },

  // 4. Loading Skeleton
  renderSkeleton(containerId, rows = 4) {
    const el = document.getElementById(containerId);
    if (!el) return;
    let html = '<div style="display:flex; flex-direction:column; gap:0.75rem; padding:1rem;">';
    for (let i = 0; i < rows; i++) {
      html += `
        <div style="height: 28px; background: linear-gradient(90deg, var(--bg-subtle) 25%, var(--border-color) 50%, var(--bg-subtle) 75%); background-size: 200% 100%; border-radius: var(--radius-sm); animation: shimmer 1.5s infinite;"></div>
      `;
    }
    html += '</div>';
    el.innerHTML = html;
  },

  // 5. SVG Multi-line / Area Chart Engine
  renderTrendChart(containerId, { dates, series }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!dates || dates.length === 0) {
      container.innerHTML = `
        <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
          No historical sales recorded for this period yet.
        </div>
      `;
      return;
    }

    const width = 650;
    const height = 240;
    const padding = { top: 25, right: 30, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Find max value across all series
    let maxVal = 100;
    for (const s of series) {
      for (const val of s.data) {
        if (val > maxVal) maxVal = val;
      }
    }
    maxVal = Math.ceil(maxVal * 1.15); // Add headroom

    const getX = (i) => padding.left + (i / Math.max(1, dates.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - (val / maxVal) * chartH;

    // Grid lines & labels
    let gridLinesSvg = '';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (maxVal / steps) * i;
      const y = getY(v);
      gridLinesSvg += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${state.currencySymbol}${Math.round(v)}</text>
      `;
    }

    // X Axis Labels
    let xLabelsSvg = '';
    dates.forEach((d, idx) => {
      const x = getX(idx);
      const shortD = d.split('-').slice(1).join('/');
      xLabelsSvg += `
        <text x="${x}" y="${height - 12}" font-size="10" fill="var(--text-secondary)" text-anchor="middle">${shortD}</text>
      `;
    });

    // Paths for each series
    let pathsSvg = '';
    let dotsSvg = '';
    series.forEach((s) => {
      let pathD = '';
      let areaD = '';

      s.data.forEach((val, i) => {
        const x = getX(i);
        const y = getY(val);
        if (i === 0) {
          pathD += `M ${x} ${y}`;
          areaD += `M ${x} ${padding.top + chartH} L ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
          areaD += ` L ${x} ${y}`;
        }
        dotsSvg += `
          <circle cx="${x}" cy="${y}" r="4" fill="${s.color}" stroke="var(--bg-surface)" stroke-width="2">
            <title>${s.name}: ${state.currencySymbol}${val} (${dates[i]})</title>
          </circle>
        `;
      });

      const lastX = getX(s.data.length - 1);
      areaD += ` L ${lastX} ${padding.top + chartH} Z`;

      if (s.fill) {
        pathsSvg += `<path d="${areaD}" fill="${s.color}" fill-opacity="0.12" />`;
      }
      pathsSvg += `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
    });

    // Legend
    let legendHtml = '<div style="display:flex; justify-content:center; gap:1.5rem; margin-top:0.75rem; font-size:0.78rem;">';
    series.forEach((s) => {
      legendHtml += `
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="width:12px; height:4px; background:${s.color}; border-radius:2px;"></span>
          <span style="font-weight:600; color:var(--text-secondary);">${s.name}</span>
        </div>
      `;
    });
    legendHtml += '</div>';

    container.innerHTML = `
      <div style="width:100%; overflow-x:auto;">
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
          ${gridLinesSvg}
          ${xLabelsSvg}
          ${pathsSvg}
          ${dotsSvg}
        </svg>
      </div>
      ${legendHtml}
    `;
  },

  // 6. SVG Donut / Category Chart
  renderCategoryDonut(containerId, categories) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!categories || categories.length === 0) {
      container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted);">No sales data available.</div>';
      return;
    }

    const totalRev = categories.reduce((sum, c) => sum + c.revenue, 0);
    const colors = ['#16A34A', '#0284C7', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B'];

    let legendHtml = '<div style="display:flex; flex-direction:column; gap:0.45rem; flex:1; max-height:180px; overflow-y:auto; padding-right:0.5rem;">';
    let currentAngle = 0;
    const size = 160;
    const r = 60;
    const cx = size / 2;
    const cy = size / 2;
    let pathsSvg = '';

    categories.forEach((cat, i) => {
      const pct = totalRev > 0 ? (cat.revenue / totalRev) : 0;
      const angle = pct * 360;
      const color = colors[i % colors.length];

      // Draw SVG donut slice
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle += angle;

      const x1 = cx + r * Math.cos((Math.PI / 180) * (startAngle - 90));
      const y1 = cy + r * Math.sin((Math.PI / 180) * (startAngle - 90));
      const x2 = cx + r * Math.cos((Math.PI / 180) * (endAngle - 90));
      const y2 = cy + r * Math.sin((Math.PI / 180) * (endAngle - 90));
      const largeArc = angle > 180 ? 1 : 0;

      if (totalRev > 0 && angle > 0) {
        pathsSvg += `
          <path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}" 
                fill="none" stroke="${color}" stroke-width="22" stroke-linecap="butt">
            <title>${cat.category}: ${state.currencySymbol}${cat.revenue.toFixed(2)} (${(pct * 100).toFixed(1)}%)</title>
          </path>
        `;
      }

      legendHtml += `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.78rem;">
          <div style="display:flex; align-items:center; gap:0.4rem; overflow:hidden;">
            <span style="width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0;"></span>
            <span style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${cat.category}</span>
          </div>
          <span style="font-weight:700; color:var(--text-secondary); margin-left:0.5rem;">${(pct * 100).toFixed(1)}%</span>
        </div>
      `;
    });
    legendHtml += '</div>';

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:1.5rem; justify-content:space-around;">
        <div style="position:relative; width:${size}px; height:${size}px; flex-shrink:0;">
          <svg viewBox="0 0 ${size} ${size}" style="transform: rotate(0deg); width:100%; height:100%;">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border-subtle)" stroke-width="22" />
            ${pathsSvg}
          </svg>
          <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none;">
            <span style="font-size:0.65rem; color:var(--text-muted); font-weight:600;">TOTAL</span>
            <span style="font-size:0.9rem; font-weight:800; color:var(--text-primary);">${state.currencySymbol}${Math.round(totalRev)}</span>
          </div>
        </div>
        ${legendHtml}
      </div>
    `;
  },

  // -------------------------------------------------------------
  // MODULE 12.5: INTERACTIVE SVG CHART ENGINES (Recharts-style)
  // -------------------------------------------------------------

  // 12.5.1 Bar Chart Engine (Vertical Columns or Horizontal Bars)
  renderBarChart(containerId, { labels, series, isHorizontal = false, unit = '₹' }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!labels || labels.length === 0 || !series || series.length === 0) {
      container.innerHTML = `<div style="padding:2.5rem; text-align:center; color:var(--text-muted);">No chart data available for this selection.</div>`;
      return;
    }

    const width = 660;
    const height = 260;
    const padding = { top: 25, right: 30, bottom: 45, left: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Find max value
    let maxVal = 10;
    series.forEach(s => {
      s.data.forEach(v => {
        if (Number(v) > maxVal) maxVal = Number(v);
      });
    });
    maxVal = Math.ceil(maxVal * 1.18); // Headroom

    let gridLinesSvg = '';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (maxVal / steps) * i;
      const y = padding.top + chartH - (v / maxVal) * chartH;
      gridLinesSvg += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${unit}${Math.round(v)}</text>
      `;
    }

    const groupW = chartW / labels.length;
    const barPadding = groupW * 0.2;
    const usableGroupW = groupW - barPadding;
    const barW = Math.max(6, Math.min(32, usableGroupW / series.length));

    let barsSvg = '';
    let xLabelsSvg = '';

    labels.forEach((lbl, groupIdx) => {
      const groupX = padding.left + groupIdx * groupW + barPadding / 2;
      const labelCenterX = groupX + usableGroupW / 2;
      const shortLbl = lbl.length > 10 ? lbl.substring(0, 9) + '…' : lbl;

      xLabelsSvg += `
        <text x="${labelCenterX}" y="${height - 12}" font-size="10" font-weight="500" fill="var(--text-secondary)" text-anchor="middle" transform="${labels.length > 7 ? `rotate(-20, ${labelCenterX}, ${height - 12})` : ''}">${shortLbl}</text>
      `;

      series.forEach((s, seriesIdx) => {
        const val = Number(s.data[groupIdx]) || 0;
        const barH = (val / maxVal) * chartH;
        const bx = groupX + seriesIdx * barW;
        const by = padding.top + chartH - barH;

        barsSvg += `
          <g class="recharts-bar-item">
            <rect x="${bx}" y="${by}" width="${barW - 2}" height="${Math.max(2, barH)}" rx="3" ry="3" fill="${s.color}" fill-opacity="0.9" style="transition: all 0.3s ease;">
              <title>${lbl} - ${s.name}: ${unit}${val}</title>
            </rect>
          </g>
        `;
      });
    });

    // Legend
    let legendHtml = '<div style="display:flex; justify-content:center; gap:1.5rem; margin-top:0.75rem; font-size:0.8rem;">';
    series.forEach(s => {
      legendHtml += `
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="width:12px; height:10px; background:${s.color}; border-radius:2px;"></span>
          <span style="font-weight:600; color:var(--text-secondary);">${s.name}</span>
        </div>
      `;
    });
    legendHtml += '</div>';

    container.innerHTML = `
      <div style="width:100%; overflow-x:auto;">
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
          ${gridLinesSvg}
          ${barsSvg}
          ${xLabelsSvg}
        </svg>
      </div>
      ${legendHtml}
    `;
  },

  // 12.5.2 Line Chart Engine (Multi-series with nodes)
  renderLineChart(containerId, { labels, series, unit = '₹' }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!labels || labels.length === 0 || !series || series.length === 0) {
      container.innerHTML = `<div style="padding:2.5rem; text-align:center; color:var(--text-muted);">No trend data recorded.</div>`;
      return;
    }

    const width = 660;
    const height = 260;
    const padding = { top: 25, right: 30, bottom: 45, left: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    let maxVal = 10;
    series.forEach(s => {
      s.data.forEach(v => {
        if (Number(v) > maxVal) maxVal = Number(v);
      });
    });
    maxVal = Math.ceil(maxVal * 1.15);

    const getX = (i) => padding.left + (i / Math.max(1, labels.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - (val / maxVal) * chartH;

    let gridLinesSvg = '';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (maxVal / steps) * i;
      const y = getY(v);
      gridLinesSvg += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${unit}${Math.round(v)}</text>
      `;
    }

    let xLabelsSvg = '';
    labels.forEach((lbl, idx) => {
      const x = getX(idx);
      const shortLbl = lbl.length > 8 ? lbl.substring(lbl.length - 5) : lbl;
      xLabelsSvg += `
        <text x="${x}" y="${height - 12}" font-size="10" fill="var(--text-secondary)" text-anchor="middle">${shortLbl}</text>
      `;
    });

    let linesSvg = '';
    let dotsSvg = '';

    series.forEach(s => {
      let pathD = '';
      s.data.forEach((val, i) => {
        const x = getX(i);
        const y = getY(val);
        if (i === 0) pathD += `M ${x} ${y}`;
        else pathD += ` L ${x} ${y}`;

        dotsSvg += `
          <circle cx="${x}" cy="${y}" r="4" fill="${s.color}" stroke="var(--bg-surface)" stroke-width="2">
            <title>${labels[i]} - ${s.name}: ${unit}${val}</title>
          </circle>
        `;
      });

      linesSvg += `
        <path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="${s.strokeWidth || 3}" 
              stroke-dasharray="${s.dashed ? '5,5' : 'none'}" stroke-linecap="round" stroke-linejoin="round" />
      `;
    });

    let legendHtml = '<div style="display:flex; justify-content:center; gap:1.5rem; margin-top:0.75rem; font-size:0.8rem;">';
    series.forEach(s => {
      legendHtml += `
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="width:14px; height:3px; background:${s.color}; border-radius:1px;"></span>
          <span style="font-weight:600; color:var(--text-secondary);">${s.name}</span>
        </div>
      `;
    });
    legendHtml += '</div>';

    container.innerHTML = `
      <div style="width:100%; overflow-x:auto;">
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
          ${gridLinesSvg}
          ${xLabelsSvg}
          ${linesSvg}
          ${dotsSvg}
        </svg>
      </div>
      ${legendHtml}
    `;
  },

  // 12.5.3 Area Chart Engine (Gradient/Translucent Filled Recharts Style)
  renderAreaChart(containerId, { labels, series, unit = '₹' }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!labels || labels.length === 0 || !series || series.length === 0) {
      container.innerHTML = `<div style="padding:2.5rem; text-align:center; color:var(--text-muted);">No sales data for area trends.</div>`;
      return;
    }

    const width = 660;
    const height = 260;
    const padding = { top: 25, right: 30, bottom: 45, left: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    let maxVal = 10;
    series.forEach(s => {
      s.data.forEach(v => {
        if (Number(v) > maxVal) maxVal = Number(v);
      });
    });
    maxVal = Math.ceil(maxVal * 1.15);

    const getX = (i) => padding.left + (i / Math.max(1, labels.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - (val / maxVal) * chartH;

    let gridLinesSvg = '';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (maxVal / steps) * i;
      const y = getY(v);
      gridLinesSvg += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${unit}${Math.round(v)}</text>
      `;
    }

    let xLabelsSvg = '';
    labels.forEach((lbl, idx) => {
      const x = getX(idx);
      const shortLbl = lbl.length > 8 ? lbl.substring(lbl.length - 5) : lbl;
      xLabelsSvg += `
        <text x="${x}" y="${height - 12}" font-size="10" fill="var(--text-secondary)" text-anchor="middle">${shortLbl}</text>
      `;
    });

    let pathsSvg = '';
    let dotsSvg = '';

    series.forEach(s => {
      let pathD = '';
      let areaD = '';

      s.data.forEach((val, i) => {
        const x = getX(i);
        const y = getY(val);
        if (i === 0) {
          pathD += `M ${x} ${y}`;
          areaD += `M ${x} ${padding.top + chartH} L ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
          areaD += ` L ${x} ${y}`;
        }
        dotsSvg += `
          <circle cx="${x}" cy="${y}" r="4" fill="${s.color}" stroke="var(--bg-surface)" stroke-width="2">
            <title>${labels[i]} - ${s.name}: ${unit}${val}</title>
          </circle>
        `;
      });

      const lastX = getX(s.data.length - 1);
      areaD += ` L ${lastX} ${padding.top + chartH} Z`;

      pathsSvg += `<path d="${areaD}" fill="${s.color}" fill-opacity="${s.fillOpacity || 0.16}" />`;
      pathsSvg += `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
    });

    let legendHtml = '<div style="display:flex; justify-content:center; gap:1.5rem; margin-top:0.75rem; font-size:0.8rem;">';
    series.forEach(s => {
      legendHtml += `
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="width:14px; height:8px; background:${s.color}; border-radius:2px; opacity:0.85;"></span>
          <span style="font-weight:600; color:var(--text-secondary);">${s.name}</span>
        </div>
      `;
    });
    legendHtml += '</div>';

    container.innerHTML = `
      <div style="width:100%; overflow-x:auto;">
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;">
          ${gridLinesSvg}
          ${xLabelsSvg}
          ${pathsSvg}
          ${dotsSvg}
        </svg>
      </div>
      ${legendHtml}
    `;
  },

  // 12.5.4 Pie / Donut Chart Engine
  renderPieChart(containerId, { data, donut = true, unit = '₹' }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted);">No distribution data available.</div>';
      return;
    }

    const totalVal = data.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const colors = ['#16A34A', '#0284C7', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B'];

    let legendHtml = '<div style="display:flex; flex-direction:column; gap:0.45rem; flex:1; max-height:200px; overflow-y:auto; padding-right:0.5rem;">';
    let currentAngle = 0;
    const size = 180;
    const r = donut ? 64 : 75;
    const cx = size / 2;
    const cy = size / 2;
    let pathsSvg = '';

    data.forEach((item, i) => {
      const val = Number(item.value) || 0;
      const pct = totalVal > 0 ? (val / totalVal) : 0;
      const angle = pct * 360;
      const color = item.color || colors[i % colors.length];

      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle += angle;

      const x1 = cx + r * Math.cos((Math.PI / 180) * (startAngle - 90));
      const y1 = cy + r * Math.sin((Math.PI / 180) * (startAngle - 90));
      const x2 = cx + r * Math.cos((Math.PI / 180) * (endAngle - 90));
      const y2 = cy + r * Math.sin((Math.PI / 180) * (endAngle - 90));
      const largeArc = angle > 180 ? 1 : 0;

      if (totalVal > 0 && angle > 0) {
        if (donut) {
          pathsSvg += `
            <path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}" 
                  fill="none" stroke="${color}" stroke-width="26" stroke-linecap="butt">
              <title>${item.label}: ${unit}${val.toFixed(2)} (${(pct * 100).toFixed(1)}%)</title>
            </path>
          `;
        } else {
          // Standard full pie wedge
          pathsSvg += `
            <path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" 
                  fill="${color}">
              <title>${item.label}: ${unit}${val.toFixed(2)} (${(pct * 100).toFixed(1)}%)</title>
            </path>
          `;
        }
      }

      legendHtml += `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.8rem;">
          <div style="display:flex; align-items:center; gap:0.45rem; overflow:hidden;">
            <span style="width:9px; height:9px; border-radius:50%; background:${color}; flex-shrink:0;"></span>
            <span style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${item.label}</span>
          </div>
          <span style="font-weight:700; color:var(--text-secondary); margin-left:0.5rem;">${(pct * 100).toFixed(1)}%</span>
        </div>
      `;
    });
    legendHtml += '</div>';

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:1.5rem; justify-content:space-around;">
        <div style="position:relative; width:${size}px; height:${size}px; flex-shrink:0;">
          <svg viewBox="0 0 ${size} ${size}" style="width:100%; height:100%;">
            ${donut ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border-subtle)" stroke-width="26" />` : ''}
            ${pathsSvg}
          </svg>
          ${donut ? `
            <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none;">
              <span style="font-size:0.65rem; color:var(--text-muted); font-weight:600;">TOTAL</span>
              <span style="font-size:0.95rem; font-weight:800; color:var(--text-primary);">${unit}${Math.round(totalVal)}</span>
            </div>
          ` : ''}
        </div>
        ${legendHtml}
      </div>
    `;
  }
};
