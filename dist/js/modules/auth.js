// ====================================================================
// Module: Authentication & Session Management
// ====================================================================

const authModule = {
  async init() {
    this.bindEvents();
    await this.checkExistingSession();
  },

  bindEvents() {
    // User menu logout click
    const logoutBtn = document.getElementById('user-menu-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = () => this.handleLogout(true);
    }
  },

  async checkExistingSession() {
    if (state.authToken) {
      try {
        const res = await api.getMe();
        if (res.success && res.user) {
          state.currentUser = res.user;
          this.updateUserUI(res.user);
          app.updateNavigationPermissions();
          return;
        }
      } catch {
        // Token invalid, clear and prompt login
        state.clearSession();
      }
    }

    // If no valid session, check if we should auto-log in as demo Administrator or prompt login
    if (!state.currentUser) {
      // Prompt login modal
      this.openLoginModal();
    } else {
      this.updateUserUI(state.currentUser);
      app.updateNavigationPermissions();
    }
  },

  updateUserUI(user) {
    if (!user) return;
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    const avatarEl = document.getElementById('header-user-avatar');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) {
      roleEl.textContent = user.role;
      roleEl.className = 'user-role-chip';
      if (user.role === 'Administrator') roleEl.style.color = '#16A34A';
      else if (user.role === 'Manager') roleEl.style.color = '#0284C7';
      else roleEl.style.color = '#F59E0B';
    }
    if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
  },

  openLoginModal() {
    document.getElementById('login-form')?.reset();
    ui.openModal('login-modal');
  },

  openRegisterModal() {
    ui.closeModal('login-modal');
    document.getElementById('register-form')?.reset();
    ui.openModal('register-modal');
  },

  openForgotModal() {
    ui.closeModal('login-modal');
    document.getElementById('forgot-form')?.reset();
    ui.openModal('forgot-modal');
  },

  openResetModal(email = '', code = '') {
    ui.closeModal('forgot-modal');
    if (email) document.getElementById('reset-email').value = email;
    if (code) document.getElementById('reset-code').value = code;
    ui.openModal('reset-modal');
  },

  async submitLogin(e) {
    e.preventDefault();
    const loginVal = document.getElementById('login-identifier').value.trim();
    const passwordVal = document.getElementById('login-password').value;

    try {
      const res = await api.login(loginVal, passwordVal);
      if (res.success) {
        state.setSession(res.token, res.user);
        this.updateUserUI(res.user);
        app.updateNavigationPermissions();
        ui.closeModal('login-modal');
        ui.showToast(`Welcome back, ${res.user.name}! (${res.user.role})`, 'success');
        app.refreshCurrentView();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async quickDemoLogin(role) {
    let username = 'admin';
    let password = 'admin123';

    if (role === 'Manager') {
      username = 'manager';
      password = 'manager123';
    } else if (role === 'Shopkeeper') {
      username = 'shopkeeper';
      password = 'staff123';
    }

    try {
      const res = await api.login(username, password);
      if (res.success) {
        state.setSession(res.token, res.user);
        this.updateUserUI(res.user);
        app.updateNavigationPermissions();
        ui.closeModal('login-modal');
        document.getElementById('user-switcher-popover')?.classList.remove('active');
        ui.showToast(`Logged in as demo ${res.user.role} (${res.user.name})`, 'success');
        app.refreshCurrentView();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async submitRegister(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      username: document.getElementById('reg-username').value.trim(),
      password: document.getElementById('reg-password').value,
      phone: document.getElementById('reg-phone')?.value || '',
      role: 'Shopkeeper' // Public self-registration is Shopkeeper; Administrator can upgrade
    };

    try {
      const res = await api.register(payload);
      if (res.success) {
        state.setSession(res.token, res.user);
        this.updateUserUI(res.user);
        app.updateNavigationPermissions();
        ui.closeModal('register-modal');
        ui.showToast('Account created successfully! Welcome to DairyTrack.', 'success');
        app.refreshCurrentView();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async submitForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();

    try {
      const res = await api.forgotPassword(email);
      if (res.success) {
        ui.showToast('Password reset code generated!', 'info');
        // Pre-fill reset modal with code for smooth testing
        this.openResetModal(email, res.resetCode || '');
      }
    } catch (err) {
      console.error(err);
    }
  },

  async submitResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    const code = document.getElementById('reset-code').value.trim();
    const newPassword = document.getElementById('reset-new-password').value;

    try {
      const res = await api.resetPassword(email, code, newPassword);
      if (res.success) {
        ui.showToast(res.message, 'success');
        ui.closeModal('reset-modal');
        this.openLoginModal();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async handleLogout(showToast = true) {
    try {
      if (state.authToken) {
        await api.logout();
      }
    } catch {}

    state.clearSession();
    if (showToast) ui.showToast('You have been logged out.', 'info');
    document.getElementById('user-switcher-popover')?.classList.remove('active');
    this.openLoginModal();
  }
};
