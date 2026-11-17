// ====================================================================
// DairyTrack Main App Orchestrator & Router with RBAC
// ====================================================================

const app = {
  async init() {
    console.log('🚀 Initializing DairyTrack Management System...');

    // Initialize Theme
    state.setTheme(state.theme);
    this.updateThemeIcons();

    // Set Live Clock / Date
    this.updateDateDisplay();
    setInterval(() => this.updateDateDisplay(), 60000);

    // Initialize Auth Module (Checks active session or prompts login)
    await authModule.init();

    // Load Branches & Notifications
    await this.loadBranches();
    await this.loadNotifications();

    // Setup Event Listeners & Router
    this.setupNavigation();
    this.setupGlobalSearch();
    this.setupShortcuts();
    this.setupTopActions();

    // Apply Role-Based Navigation Permissions
    this.updateNavigationPermissions();

    // Load Initial View (or fallback to Dashboard)
    const initialView = state.canAccess(state.activeView) ? state.activeView : 'dashboard';
    await this.navigate(initialView);
  },

  updateDateDisplay() {
    const el = document.getElementById('current-date-text');
    if (el) {
      const now = new Date();
      el.textContent = now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  },

  updateNavigationPermissions() {
    if (!state.currentUser) return;
    const role = state.currentUser.role || 'Shopkeeper';

    // Update Sidebar Navigation Visibility
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      const view = link.getAttribute('data-view');
      const isAllowed = state.canAccess(view);
      link.style.display = isAllowed ? 'flex' : 'none';
    });

    // Update UI Action Buttons based on Role
    // 1. Products Add button (Admin & Manager only) & Category Management (Admin only)
    const prodActions = document.getElementById('products-action-buttons');
    if (prodActions) {
      prodActions.style.display = (role === 'Administrator' || role === 'Manager') ? 'flex' : 'none';
    }
    const manageCatBtn = document.getElementById('manage-categories-btn');
    if (manageCatBtn) {
      manageCatBtn.style.display = (role === 'Administrator') ? 'inline-flex' : 'none';
    }

    // 2. Inventory Action buttons (All roles can view & execute permitted actions; Admin & Manager have full access)
    const invActions = document.getElementById('inventory-action-buttons');
    if (invActions) {
      invActions.style.display = 'flex';
    }

    // 3. Purchase Order button (Admin & Manager only)
    const poActions = document.getElementById('purchases-action-buttons');
    if (poActions) {
      poActions.style.display = (role === 'Administrator' || role === 'Manager') ? 'flex' : 'none';
    }

    // 4. Supplier Register button (Admin & Manager only)
    const suppActions = document.getElementById('suppliers-action-buttons');
    if (suppActions) {
      suppActions.style.display = (role === 'Administrator' || role === 'Manager') ? 'flex' : 'none';
    }

    // Update Profile Header
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    const avatarEl = document.getElementById('header-user-avatar');
    const menuNameEl = document.getElementById('menu-user-fullname');
    const menuEmailEl = document.getElementById('menu-user-email');

    if (nameEl) nameEl.textContent = state.currentUser.name;
    if (roleEl) roleEl.textContent = state.currentUser.role;
    if (avatarEl) avatarEl.textContent = state.currentUser.name.charAt(0).toUpperCase();
    if (menuNameEl) menuNameEl.textContent = state.currentUser.name;
    if (menuEmailEl) menuEmailEl.textContent = state.currentUser.email;
  },

  async loadBranches() {
    try {
      const res = await api.getBranches();
      if (res.success) {
        state.branches = res.data;
        const select = document.getElementById('top-branch-select');
        if (select) {
          select.innerHTML = '<option value="all">🏢 All Branches & Hubs</option>' +
            res.data.map(b => `<option value="${b.id}" ${b.id == state.currentBranchId ? 'selected' : ''}>📍 ${b.name}</option>`).join('');

          select.onchange = (e) => {
            state.setBranch(e.target.value);
            ui.showToast('Switched to ' + select.options[select.selectedIndex].text, 'info');
            this.refreshCurrentView();
          };
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  async loadNotifications() {
    try {
      if (typeof notificationsModule !== 'undefined' && notificationsModule.loadStats) {
        await notificationsModule.loadStats(false);
        await notificationsModule.loadNotifications();
      }
    } catch (err) {
      console.error(err);
    }
  },

  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-view]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        this.navigate(targetView);
        document.getElementById('app-sidebar')?.classList.remove('mobile-open');
      });
    });

    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }
  },

  async navigate(viewName) {
    // 1. Check Role-based permission
    const accessDeniedBanner = document.getElementById('access-denied-view');
    if (!state.canAccess(viewName)) {
      document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
      if (accessDeniedBanner) {
        document.getElementById('denied-role-name').textContent = state.currentUser ? state.currentUser.role : 'Guest';
        accessDeniedBanner.style.display = 'block';
      }
      ui.showToast(`Access Restricted: Role '${state.currentUser ? state.currentUser.role : 'Guest'}' cannot access '${viewName}'`, 'warning');
      return;
    }

    if (accessDeniedBanner) accessDeniedBanner.style.display = 'none';
    state.activeView = viewName;

    // Highlight nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-view') === viewName);
    });

    // Show view section
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSec = document.getElementById(`view-${viewName}`);
    if (targetSec) {
      targetSec.classList.add('active');
    }

    // Load data for module
    switch (viewName) {
      case 'dashboard':
        await dashboardModule.init();
        break;
      case 'products':
        await productsModule.init();
        break;
      case 'inventory':
        await inventoryModule.init();
        break;
      case 'sales':
        await salesModule.init();
        break;
      case 'purchases':
        await purchasesModule.init();
        break;
      case 'movements':
        await movementsModule.init();
        break;
      case 'suppliers':
        await suppliersModule.init();
        break;
      case 'customers':
        await customersModule.init();
        break;
      case 'expiry':
        await expiryModule.init();
        break;
      case 'analytics':
        await analyticsModule.init();
        break;
      case 'reports':
        await reportsModule.init();
        break;
      case 'notifications':
        await notificationsModule.init();
        break;
      case 'users':
        await usersModule.init();
        break;
      case 'settings':
        await settingsModule.init();
        break;
    }
  },

  refreshCurrentView() {
    this.updateNavigationPermissions();
    this.navigate(state.activeView);
  },

  setupGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const dropdown = document.getElementById('global-search-dropdown');
    if (!input || !dropdown) return;

    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value.trim();
      if (val.length < 2) {
        dropdown.classList.remove('active');
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await api.searchGlobal(val);
          if (res.success && res.data.length > 0) {
            let html = '<div class="search-group-title">Search Results</div>';
            res.data.forEach(item => {
              let icon = '📦';
              if (item.type === 'sale') icon = '🧾';
              else if (item.type === 'customer') icon = '👤';
              else if (item.type === 'supplier') icon = '🚜';

              html += `
                <div class="search-item" onclick="app.onSearchResultClick('${item.type}', ${item.id})">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span>${icon}</span>
                    <div>
                      <div style="font-weight:700; font-size:0.85rem;">${item.title}</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">${item.subtitle}</div>
                    </div>
                  </div>
                  <span class="status-chip badge-info" style="text-transform:capitalize;">${item.type}</span>
                </div>
              `;
            });
            dropdown.innerHTML = html;
            dropdown.classList.add('active');
          } else {
            dropdown.innerHTML = '<div style="padding:1rem; font-size:0.8rem; color:var(--text-muted); text-align:center;">No matching items found.</div>';
            dropdown.classList.add('active');
          }
        } catch (err) {
          console.error(err);
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  },

  onSearchResultClick(type, id) {
    document.getElementById('global-search-dropdown')?.classList.remove('active');
    document.getElementById('global-search-input').value = '';

    if (type === 'product') {
      this.navigate('products');
    } else if (type === 'sale') {
      salesModule.viewInvoice(id);
    } else if (type === 'customer') {
      this.navigate('customers');
    } else if (type === 'supplier') {
      this.navigate('suppliers');
    }
  },

  setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        this.navigate('sales');
        document.getElementById('pos-product-search')?.focus();
      }
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        document.querySelectorAll('.notification-popover.active').forEach(p => p.classList.remove('active'));
        document.getElementById('global-search-dropdown')?.classList.remove('active');
      }
    });
  },

  setupTopActions() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
        state.setTheme(nextTheme);
        this.updateThemeIcons();
        ui.showToast(`Switched to ${nextTheme} mode`, 'info');
      });
    }

    const notifBtn = document.getElementById('notif-bell-btn');
    const notifPopover = document.getElementById('notification-popover');
    if (notifBtn && notifPopover) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('user-switcher-popover')?.classList.remove('active');
        notifPopover.classList.toggle('active');
      });
    }

    const markReadBtn = document.getElementById('mark-notifications-read');
    if (markReadBtn) {
      markReadBtn.addEventListener('click', async () => {
        await api.markNotificationsRead();
        await this.loadNotifications();
        ui.showToast('All notifications marked as read', 'info');
      });
    }

    const userBtn = document.getElementById('user-profile-menu-trigger');
    const userPopover = document.getElementById('user-switcher-popover');
    if (userBtn && userPopover) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifPopover?.classList.remove('active');
        userPopover.classList.toggle('active');
      });
    }

    document.addEventListener('click', () => {
      notifPopover?.classList.remove('active');
      userPopover?.classList.remove('active');
    });
  },

  updateThemeIcons() {
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = state.theme === 'dark' ? 'block' : 'none';
      moonIcon.style.display = state.theme === 'dark' ? 'none' : 'block';
    }
  },

  // Modal convenience methods for HTML onclick
  openNewProductModal() { productsModule.openNewModal(); },
  submitProductForm(e) { productsModule.submitForm(e); },
  openNewBatchModal() { inventoryModule.openNewModal(); },
  submitBatchForm(e) { inventoryModule.submitForm(e); },
  onBatchProductChange() { inventoryModule.onProductChange(); },
  openReceiveStockModal(id) { inventoryModule.openReceiveStockModal(id); },
  openOpeningStockModal() { inventoryModule.openOpeningStockModal(); },
  openAdjustStockModal(id) { inventoryModule.openAdjustStockModal(id); },
  openTransferStockModal(id) { inventoryModule.openTransferStockModal(id); },
  openReturnModal() { inventoryModule.openReturnModal(); },
  openAlertSettingsModal() { inventoryModule.openAlertSettingsModal(); },
  clearPosCart() { salesModule.clearCart(); },
  recalculatePosTotals() { salesModule.recalculatePosTotals(); },
  processPosCheckout() { salesModule.processCheckout(); },
  showPastSalesHistory() { salesModule.showPastSalesHistory(); },
  openNewPurchaseModal() { purchasesModule.openNewModal(); },
  addPoItemRow() { purchasesModule.addItemRow(); },
  submitPurchaseOrder(e) { purchasesModule.submitPurchase(e); },
  openNewMovementModal() { movementsModule.openNewModal(); },
  onMovementTypeChange() { movementsModule.onTypeChange(); },
  onMoveProductChange() { movementsModule.onProductChange(); },
  submitMovementForm(e) { movementsModule.submitForm(e); },
  openNewSupplierModal() { suppliersModule.openNewModal(); },
  submitSupplierForm(e) { suppliersModule.submitForm(e); },
  submitSupplierPayment(e) { suppliersModule.submitPayment(e); },
  openNewCustomerModal() { customersModule.openNewModal(); },
  submitCustomerForm(e) { customersModule.submitForm(e); },
  submitUdharPayment(e) { customersModule.submitUdharPayment(e); },
  switchExpiryTab(tab) { expiryModule.switchTab(tab); },
  openWastageModal() { expiryModule.openWastageModal(); },
  submitExpiryAction(e) { expiryModule.handleFormSubmit(e); },
  loadAnalytics() { analyticsModule.loadAnalytics(); },
  downloadReport(type) { reportsModule.download(type); },
  downloadMasterReport() { reportsModule.download('master'); },
  downloadInventoryReport() { reportsModule.download('inventory'); },
  downloadWasteReport() { reportsModule.download('waste'); },
  openNewUserModal() { usersModule.openNewModal(); },
  submitUserForm(e) { usersModule.submitForm(e); },
  saveSettings(e) { settingsModule.saveSettings(e); },
  openNotificationSettings() { notificationsModule.openSettingsModal(); },
  triggerNotificationScan() { notificationsModule.triggerScan(); },
  saveNotificationSettings(e) { notificationsModule.saveSettings(e); },
  openModal(id) { ui.openModal(id); },
  closeModal(id) { ui.closeModal(id); }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
