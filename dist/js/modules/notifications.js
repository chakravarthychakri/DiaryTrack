// ====================================================================
// MODULE 14: NOTIFICATIONS AND ALERTS CONTROLLER
// In-App Notification Center, Real-Time Alert Engine & Configurable Settings
// ====================================================================

const notificationsModule = {
  currentCategory: 'all',
  currentSeverity: 'all',
  unreadOnly: false,
  searchQuery: '',
  page: 1,
  limit: 25,
  lastStats: null,
  pollTimer: null,
  audioContext: null,

  async init() {
    console.log('🔔 Initializing Notifications & Alerts Module...');
    this.setupListeners();
    await this.loadStats();
    await this.loadNotifications();

    // Start Real-Time Background Notification Polling (Every 45s)
    if (!this.pollTimer) {
      this.pollTimer = setInterval(async () => {
        await this.loadStats(false);
      }, 45000);
    }
  },

  setupListeners() {
    const searchInput = document.getElementById('notif-search-input');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          this.page = 1;
          this.loadNotifications();
        }, 300);
      });
    }

    const severityFilter = document.getElementById('notif-severity-filter');
    if (severityFilter) {
      severityFilter.addEventListener('change', (e) => {
        this.currentSeverity = e.target.value;
        this.page = 1;
        this.loadNotifications();
      });
    }
  },

  // -------------------------------------------------------------
  // 14.1: LOAD NOTIFICATIONS FEED & STATS
  // -------------------------------------------------------------
  async loadStats(showToasts = true) {
    try {
      const res = await api.getNotificationStats();
      if (res.success) {
        this.lastStats = res;
        this.updateBadges(res.unreadCount);

        // Update KPI summary cards if present
        const elUnread = document.getElementById('notif-kpi-unread');
        const elCritical = document.getElementById('notif-kpi-critical');
        const elWarning = document.getElementById('notif-kpi-warning');
        const elToday = document.getElementById('notif-kpi-today');

        if (elUnread) elUnread.textContent = res.unreadCount;
        if (elCritical) elCritical.textContent = res.criticalCount;
        if (elWarning) elWarning.textContent = res.warningCount;
        if (elToday) elToday.textContent = res.todayCount;
      }
    } catch (err) {
      console.warn('Failed to load notification stats:', err);
    }
  },

  updateBadges(unreadCount) {
    // Header Bell Badge
    const headerBadge = document.getElementById('header-notif-count');
    if (headerBadge) {
      headerBadge.textContent = unreadCount;
      headerBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
      if (unreadCount > 0) {
        headerBadge.classList.add('pulse');
      } else {
        headerBadge.classList.remove('pulse');
      }
    }

    // Sidebar Notification Badge
    const sidebarBadge = document.getElementById('sidebar-notif-badge');
    if (sidebarBadge) {
      sidebarBadge.textContent = unreadCount;
      sidebarBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
  },

  async loadNotifications() {
    const container = document.getElementById('notif-feed-container');
    const headerList = document.getElementById('notification-list-body');

    if (container) {
      container.innerHTML = `
        <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <div class="loading-spinner" style="margin: 0 auto 1rem;"></div>
          <div>Loading alerts & system notifications...</div>
        </div>
      `;
    }

    try {
      const params = {
        category: this.currentCategory,
        severity: this.currentSeverity,
        search: this.searchQuery,
        page: this.page,
        limit: this.limit
      };

      if (this.unreadOnly) {
        params.is_read = 0;
      }

      const res = await api.getNotifications(params);

      if (!res.success) {
        if (container) {
          container.innerHTML = `
            <div style="padding: 2.5rem; text-align: center; color: var(--danger);">
              Failed to load notifications: ${res.error || 'Server error'}
            </div>
          `;
        }
        return;
      }

      this.updateBadges(res.unreadCount);
      this.renderCategoryCounts(res.categoryCounts, res.unreadCount);

      // 1. Render Header Popover List
      if (headerList) {
        this.renderHeaderPopover(res.data.slice(0, 6), res.unreadCount);
      }

      // 2. Render Main Notification Center Feed
      if (container) {
        this.renderFeed(res.data, container, res.totalCount, res.totalPages);
      }

    } catch (err) {
      console.error('Error fetching notifications:', err);
      if (container) {
        container.innerHTML = `
          <div style="padding: 2.5rem; text-align: center; color: var(--danger);">
            Network error loading alerts: ${err.message}
          </div>
        `;
      }
    }
  },

  renderCategoryCounts(catCounts, unreadCount) {
    if (!catCounts) return;
    const badgeAll = document.getElementById('notif-tab-all-count');
    const badgeUnread = document.getElementById('notif-tab-unread-count');
    const badgeStock = document.getElementById('notif-tab-stock-count');
    const badgeExpiry = document.getElementById('notif-tab-expiry-count');
    const badgeSales = document.getElementById('notif-tab-sales-count');
    const badgePurchases = document.getElementById('notif-tab-purchases-count');
    const badgeSystem = document.getElementById('notif-tab-system-count');

    if (badgeAll) badgeAll.textContent = catCounts.all || 0;
    if (badgeUnread) badgeUnread.textContent = unreadCount || 0;
    if (badgeStock) badgeStock.textContent = (catCounts.stock || 0);
    if (badgeExpiry) badgeExpiry.textContent = (catCounts.expiry || 0) + (catCounts.wastage || 0);
    if (badgeSales) badgeSales.textContent = catCounts.sales || 0;
    if (badgePurchases) badgePurchases.textContent = catCounts.purchases || 0;
    if (badgeSystem) badgeSystem.textContent = catCounts.system || 0;
  },

  renderHeaderPopover(items, unreadCount) {
    const headerList = document.getElementById('notification-list-body');
    if (!headerList) return;

    if (!items || items.length === 0) {
      headerList.innerHTML = `
        <div style="padding: 2rem 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🎉</div>
          <div>All caught up! No active alerts.</div>
        </div>
      `;
      return;
    }

    headerList.innerHTML = `
      ${items.map(item => `
        <div class="notification-item ${item.is_read ? '' : 'unread'}" 
             onclick="notificationsModule.onNotificationClick(${item.id}, '${item.link_view || ''}', '${item.reference_id || ''}')"
             style="cursor: pointer;">
          <span class="notif-dot ${item.severity || 'info'}"></span>
          <div class="notif-content" style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.15rem;">
              <span class="notif-title" style="font-size:0.82rem; font-weight:700;">${item.title}</span>
              <span style="font-size:0.68rem; color:var(--text-muted);">${this.formatTimeAgo(item.created_at)}</span>
            </div>
            <div class="notif-desc" style="font-size:0.75rem; color:var(--text-secondary); line-height:1.35;">${item.message}</div>
          </div>
        </div>
      `).join('')}
      <div style="padding: 0.6rem 1rem; text-align: center; background: var(--bg-subtle); border-top: 1px solid var(--border-color);">
        <button class="btn btn-secondary btn-sm" style="width: 100%; font-size: 0.78rem;" 
                onclick="app.navigate('notifications'); document.getElementById('notification-popover')?.classList.remove('active');">
          Open Full Notification Center &rarr;
        </button>
      </div>
    `;
  },

  renderFeed(items, container, totalCount, totalPages) {
    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="notif-empty-state">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🔔</div>
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem;">No Notifications Found</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 420px; margin: 0 auto 1.5rem;">
            ${this.searchQuery ? `No alerts match your search "${this.searchQuery}".` : 'There are no active alerts in this category. All operations and stock levels are running normally.'}
          </p>
          <div style="display:flex; gap:0.5rem; justify-content:center;">
            <button class="btn btn-secondary btn-sm" onclick="notificationsModule.triggerScan()">
              🔄 Scan Stock & Expiry Now
            </button>
            <button class="btn btn-primary btn-sm" onclick="notificationsModule.setCategory('all')">
              View All Categories
            </button>
          </div>
        </div>
      `;
      return;
    }

    const typeIcons = {
      'stock_low': '⚠️',
      'stock_out': '🚨',
      'expiry_near': '⏳',
      'expired': '❌',
      'wastage_unusual': '📉',
      'purchase_new': '📦',
      'sale_complete': '🧾',
      'transaction_failed': '⛔',
      'system_event': '⚙️'
    };

    const typeLabels = {
      'stock_low': 'Low Stock',
      'stock_out': 'Out of Stock',
      'expiry_near': 'Near Expiry',
      'expired': 'Expired Product',
      'wastage_unusual': 'Unusual Wastage',
      'purchase_new': 'Purchase Order',
      'sale_complete': 'Sale Completed',
      'transaction_failed': 'Failed Transaction',
      'system_event': 'System Event'
    };

    let html = `
      <div class="notif-feed-list">
        ${items.map(n => {
          const icon = typeIcons[n.type] || '🔔';
          const label = typeLabels[n.type] || (n.category || 'Notification').toUpperCase();
          const sevClass = n.severity || 'info';

          return `
            <div class="notif-card ${n.is_read ? 'read' : 'unread'} sev-${sevClass}" id="notif-card-${n.id}">
              <div class="notif-card-indicator"></div>
              <div class="notif-card-icon sev-bg-${sevClass}">
                ${icon}
              </div>
              <div class="notif-card-body">
                <div class="notif-card-header">
                  <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    <span class="notif-badge sev-${sevClass}">${label}</span>
                    <h4 class="notif-card-title">${n.title}</h4>
                    ${!n.is_read ? '<span class="notif-unread-dot" title="Unread"></span>' : ''}
                  </div>
                  <span class="notif-card-time" title="${n.created_at}">${this.formatTimeAgo(n.created_at)}</span>
                </div>
                
                <p class="notif-card-msg">${n.message}</p>
                
                <div class="notif-card-actions">
                  ${n.link_view ? `
                    <button class="btn btn-secondary btn-sm notif-action-btn" 
                            onclick="notificationsModule.onNotificationClick(${n.id}, '${n.link_view}', '${n.reference_id || ''}')">
                      Go to ${this.formatViewName(n.link_view)} &rarr;
                    </button>
                  ` : ''}
                  
                  <div style="display:flex; gap:0.35rem; margin-left:auto;">
                    ${!n.is_read ? `
                      <button class="btn btn-icon btn-sm" title="Mark as Read" onclick="notificationsModule.markRead(${n.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span style="font-size:0.75rem;">Mark Read</span>
                      </button>
                    ` : ''}
                    <button class="btn btn-icon btn-sm text-danger" title="Dismiss Notification" onclick="notificationsModule.deleteNotification(${n.id})">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Pagination Controls
    if (totalPages > 1) {
      html += `
        <div class="notif-pagination">
          <button class="btn btn-secondary btn-sm" ${this.page <= 1 ? 'disabled' : ''} onclick="notificationsModule.changePage(${this.page - 1})">
            &larr; Previous
          </button>
          <span style="font-size:0.8rem; color:var(--text-muted);">
            Page <strong>${this.page}</strong> of <strong>${totalPages}</strong> (${totalCount} total alerts)
          </span>
          <button class="btn btn-secondary btn-sm" ${this.page >= totalPages ? 'disabled' : ''} onclick="notificationsModule.changePage(${this.page + 1})">
            Next &rarr;
          </button>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  formatViewName(view) {
    const map = {
      'inventory': 'Inventory Batches',
      'products': 'Product Catalog',
      'sales': 'Sales / POS',
      'purchases': 'Purchases',
      'expiry': 'Expiry Dashboard',
      'customers': 'Customers',
      'suppliers': 'Suppliers',
      'reports': 'Reports',
      'settings': 'System Settings'
    };
    return map[view] || view;
  },

  formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHrs = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  },

  changePage(newPage) {
    this.page = newPage;
    this.loadNotifications();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // -------------------------------------------------------------
  // 14.2: CATEGORY & TAB SWITCHING
  // -------------------------------------------------------------
  setCategory(cat) {
    this.currentCategory = cat;
    this.unreadOnly = (cat === 'unread');
    if (this.unreadOnly) {
      this.currentCategory = 'all';
    }
    this.page = 1;

    document.querySelectorAll('.notif-filter-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cat') === cat);
    });

    this.loadNotifications();
  },

  // -------------------------------------------------------------
  // 14.3: MARK AS READ & ACTIONS
  // -------------------------------------------------------------
  async markRead(id) {
    try {
      const res = await api.markNotificationRead(id);
      if (res.success) {
        const card = document.getElementById(`notif-card-${id}`);
        if (card) {
          card.classList.remove('unread');
          card.classList.add('read');
          card.querySelector('.notif-unread-dot')?.remove();
        }
        await this.loadStats(false);
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  },

  async markAllRead() {
    try {
      const res = await api.markNotificationsRead({
        category: this.currentCategory !== 'all' ? this.currentCategory : null
      });
      if (res.success) {
        ui.showToast('All notifications marked as read', 'info');
        await this.loadStats();
        await this.loadNotifications();
      }
    } catch (err) {
      ui.showToast('Failed to mark all as read: ' + err.message, 'danger');
    }
  },

  async deleteNotification(id) {
    try {
      const res = await api.deleteNotification(id);
      if (res.success) {
        const card = document.getElementById(`notif-card-${id}`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(-6px)';
          setTimeout(() => card.remove(), 250);
        }
        await this.loadStats(false);
      }
    } catch (err) {
      ui.showToast('Failed to delete notification', 'danger');
    }
  },

  async clearReadNotifications() {
    if (!confirm('Are you sure you want to dismiss all read notifications?')) return;
    try {
      const res = await api.clearReadNotifications();
      if (res.success) {
        ui.showToast(res.message || 'Cleared read notifications', 'success');
        await this.loadStats();
        await this.loadNotifications();
      }
    } catch (err) {
      ui.showToast('Failed to clear read alerts: ' + err.message, 'danger');
    }
  },

  async onNotificationClick(id, linkView, referenceId) {
    await this.markRead(id);
    if (linkView) {
      app.navigate(linkView);
    }
  },

  // -------------------------------------------------------------
  // 14.4: BACKGROUND ALERT SCANNER TRIGGER
  // -------------------------------------------------------------
  async triggerScan() {
    ui.showToast('Auditing inventory batches, expiry schedules & stock levels...', 'info');
    try {
      const res = await api.scanSystemAlerts();
      if (res.success) {
        ui.showToast(res.message, res.generatedCount > 0 ? 'warning' : 'success');
        await this.loadStats();
        await this.loadNotifications();
      }
    } catch (err) {
      ui.showToast('Error scanning system alerts: ' + err.message, 'danger');
    }
  },

  // -------------------------------------------------------------
  // 14.5: CONFIGURABLE NOTIFICATION SETTINGS MODAL
  // -------------------------------------------------------------
  async openSettingsModal() {
    try {
      const res = await api.getNotificationSettings();
      if (!res.success || !res.data) {
        ui.showToast('Failed to load notification settings', 'danger');
        return;
      }

      const c = res.data;

      // Populate Toggles for all 9 required categories
      this.setCheckboxVal('notif-cfg-low-stock', c.notify_low_stock);
      this.setCheckboxVal('notif-cfg-out-stock', c.notify_out_of_stock);
      this.setCheckboxVal('notif-cfg-near-expiry', c.notify_near_expiry);
      this.setCheckboxVal('notif-cfg-expired', c.notify_expired_products);
      this.setCheckboxVal('notif-cfg-wastage', c.notify_unusual_wastage);
      this.setCheckboxVal('notif-cfg-purchases', c.notify_new_purchases);
      this.setCheckboxVal('notif-cfg-sales', c.notify_sales_completion);
      this.setCheckboxVal('notif-cfg-transactions', c.notify_failed_transactions);
      this.setCheckboxVal('notif-cfg-system', c.notify_system_events);

      // Populate Thresholds
      const expiryInput = document.getElementById('notif-cfg-expiry-days');
      if (expiryInput) expiryInput.value = c.notify_expiry_days || 3;

      const wasteInput = document.getElementById('notif-cfg-waste-thresh');
      if (wasteInput) wasteInput.value = c.notify_wastage_threshold || 500;

      this.setCheckboxVal('notif-cfg-sound', c.notify_sound_enabled);
      this.setCheckboxVal('notif-cfg-toasts', c.notify_toasts_enabled);

      app.openModal('notification-settings-modal');
    } catch (err) {
      console.error('Error opening notification settings:', err);
      ui.showToast('Network error loading settings', 'danger');
    }
  },

  setCheckboxVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(val);
  },

  async saveSettings(e) {
    if (e) e.preventDefault();

    const payload = {
      notify_low_stock: document.getElementById('notif-cfg-low-stock')?.checked,
      notify_out_of_stock: document.getElementById('notif-cfg-out-stock')?.checked,
      notify_near_expiry: document.getElementById('notif-cfg-near-expiry')?.checked,
      notify_expired_products: document.getElementById('notif-cfg-expired')?.checked,
      notify_unusual_wastage: document.getElementById('notif-cfg-wastage')?.checked,
      notify_new_purchases: document.getElementById('notif-cfg-purchases')?.checked,
      notify_sales_completion: document.getElementById('notif-cfg-sales')?.checked,
      notify_failed_transactions: document.getElementById('notif-cfg-transactions')?.checked,
      notify_system_events: document.getElementById('notif-cfg-system')?.checked,
      notify_expiry_days: parseInt(document.getElementById('notif-cfg-expiry-days')?.value || '3', 10),
      notify_wastage_threshold: parseFloat(document.getElementById('notif-cfg-waste-thresh')?.value || '500'),
      notify_sound_enabled: document.getElementById('notif-cfg-sound')?.checked,
      notify_toasts_enabled: document.getElementById('notif-cfg-toasts')?.checked
    };

    try {
      const res = await api.saveNotificationSettings(payload);
      if (res.success) {
        ui.showToast('Notification preferences saved successfully!', 'success');
        app.closeModal('notification-settings-modal');
        await this.loadNotifications();
      } else {
        ui.showToast(res.error || 'Failed to save settings', 'danger');
      }
    } catch (err) {
      ui.showToast('Error saving settings: ' + err.message, 'danger');
    }
  },

  // -------------------------------------------------------------
  // 14.6: TEST ALERT GENERATOR
  // -------------------------------------------------------------
  async triggerTestAlert(type) {
    try {
      const res = await api.triggerTestNotification(type);
      if (res.success) {
        ui.showToast(`Test alert generated: ${type}`, 'info');
        await this.loadStats();
        await this.loadNotifications();
      }
    } catch (err) {
      ui.showToast('Error generating test alert', 'danger');
    }
  }
};
