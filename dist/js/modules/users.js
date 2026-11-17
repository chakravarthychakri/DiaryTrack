// ====================================================================
// Module: User Management & Employee Audit Trail (Administrator)
// ====================================================================

const usersModule = {
  usersList: [],
  activeTab: 'staff',

  async init() {
    await this.loadUsers();
  },

  async loadUsers() {
    try {
      ui.renderSkeleton('users-table-body', 4);
      const res = await api.getUsers();
      if (res.success) {
        this.usersList = res.data;
        this.renderTable(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  },

  async loadAuditLogs() {
    try {
      ui.renderSkeleton('audit-logs-table-body', 6);
      const res = await api.getAuditLogs();
      if (res.success) {
        this.renderAuditLogs(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.getElementById('users-tab-staff-btn')?.classList.toggle('btn-primary', tab === 'staff');
    document.getElementById('users-tab-staff-btn')?.classList.toggle('btn-secondary', tab !== 'staff');
    document.getElementById('users-tab-audit-btn')?.classList.toggle('btn-primary', tab === 'audit');
    document.getElementById('users-tab-audit-btn')?.classList.toggle('btn-secondary', tab !== 'audit');

    document.getElementById('users-staff-panel').style.display = tab === 'staff' ? 'block' : 'none';
    document.getElementById('users-audit-panel').style.display = tab === 'audit' ? 'block' : 'none';

    if (tab === 'staff') {
      this.loadUsers();
    } else {
      this.loadAuditLogs();
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No staff registered yet.</td></tr>';
      return;
    }

    let html = '';
    items.forEach(u => {
      let roleBadge = 'badge-info';
      if (u.role === 'Administrator') roleBadge = 'badge-success';
      else if (u.role === 'Manager') roleBadge = 'badge-primary';

      const isCurrent = state.currentUser && state.currentUser.id === u.id;

      html += `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${u.name} ${isCurrent ? '<span style="font-size:0.65rem; color:var(--primary); font-weight:700;">(YOU)</span>' : ''}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${u.email}</div>
          </td>
          <td><code>@${u.username}</code></td>
          <td>
            <span class="status-chip ${roleBadge}">${u.role}</span>
          </td>
          <td>${u.branch_name || 'All Branches'}</td>
          <td>
            <div style="font-size:0.8rem; font-weight:600;">🧾 ${u.sales_count || 0} bills</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">📦 ${u.purchases_count || 0} POs</div>
          </td>
          <td>
            <span style="font-size:0.78rem; color:var(--text-secondary);">${u.last_login ? ui.formatDate(u.last_login) : 'Never'}</span>
          </td>
          <td>
            <span class="status-chip ${u.is_active ? 'badge-success' : 'badge-danger'}">
              ${u.is_active ? 'Active' : 'Deactivated'}
            </span>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-sm btn-secondary" onclick="usersModule.editUser(${u.id})" title="Edit Details & Role">
                Edit
              </button>
              ${!isCurrent ? `
                <button class="btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-success'}" onclick="usersModule.toggleStatus(${u.id}, ${u.is_active ? 0 : 1})">
                  ${u.is_active ? 'Deactivate' : 'Activate'}
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderAuditLogs(logs) {
    const tbody = document.getElementById('audit-logs-table-body');
    if (!tbody) return;

    if (!logs || !logs.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No audit logs recorded yet.</td></tr>';
      return;
    }

    let html = '';
    logs.forEach(l => {
      let actionBadge = 'badge-info';
      if (l.action.includes('CREATE') || l.action.includes('LOGIN')) actionBadge = 'badge-success';
      else if (l.action.includes('WRITE_OFF') || l.action.includes('DEACTIVATE') || l.action.includes('FAILED')) actionBadge = 'badge-danger';
      else if (l.action.includes('UPDATE')) actionBadge = 'badge-warning';

      html += `
        <tr>
          <td>
            <div style="font-size:0.8rem; font-weight:600;">${ui.formatDate(l.created_at)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${new Date(l.created_at).toLocaleTimeString()}</div>
          </td>
          <td>
            <div style="font-weight:700;">${l.user_name || 'System'}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${l.user_role || '-'}</div>
          </td>
          <td>
            <span class="status-chip ${actionBadge}">${l.action}</span>
          </td>
          <td><code>${l.entity_type || '-'} ${l.entity_id ? '#' + l.entity_id : ''}</code></td>
          <td>
            <div style="font-size:0.8rem; color:var(--text-primary); max-width:350px;">${l.details || '-'}</div>
          </td>
          <td>
            <span style="font-size:0.75rem; color:var(--text-muted);">${l.ip_address || '127.0.0.1'}</span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  openNewModal() {
    document.getElementById('user-modal-title').textContent = 'Add New Staff Member';
    document.getElementById('user-form').reset();
    document.getElementById('usr-id').value = '';
    document.getElementById('usr-password-group').style.display = 'flex';
    document.getElementById('usr-password').required = true;

    const branchSelect = document.getElementById('usr-branch');
    if (branchSelect) {
      branchSelect.innerHTML = state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    ui.openModal('user-modal');
  },

  editUser(id) {
    const u = this.usersList.find(x => x.id === id);
    if (!u) return;

    document.getElementById('user-modal-title').textContent = 'Edit Employee: ' + u.name;
    document.getElementById('usr-id').value = u.id;
    document.getElementById('usr-name').value = u.name;
    document.getElementById('usr-email').value = u.email;
    document.getElementById('usr-username').value = u.username;
    document.getElementById('usr-role').value = u.role;
    document.getElementById('usr-phone').value = u.phone || '';

    const branchSelect = document.getElementById('usr-branch');
    if (branchSelect) {
      branchSelect.innerHTML = state.branches.map(b => `<option value="${b.id}" ${b.id == u.branch_id ? 'selected' : ''}>${b.name}</option>`).join('');
    }

    // Password not required on edit unless changing
    document.getElementById('usr-password').required = false;
    document.getElementById('usr-password').value = '';
    document.getElementById('usr-password-label').textContent = 'Change Password (Leave blank to keep current)';

    ui.openModal('user-modal');
  },

  async toggleStatus(id, newStatus) {
    const actionText = newStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionText} this staff account?`)) return;

    try {
      const res = await api.toggleUserStatus(id, newStatus);
      ui.showToast(res.message, 'success');
      await this.loadUsers();
    } catch (err) {
      console.error(err);
    }
  },

  async submitForm(e) {
    e.preventDefault();
    const id = document.getElementById('usr-id').value;
    const payload = {
      name: document.getElementById('usr-name').value.trim(),
      email: document.getElementById('usr-email').value.trim(),
      username: document.getElementById('usr-username').value.trim(),
      role: document.getElementById('usr-role').value,
      branch_id: document.getElementById('usr-branch').value,
      phone: document.getElementById('usr-phone').value.trim()
    };

    const passwordVal = document.getElementById('usr-password').value;
    if (passwordVal) {
      payload.password = passwordVal;
    }

    try {
      if (id) {
        await api.updateUser(id, payload);
        ui.showToast('Employee details updated!', 'success');
      } else {
        await api.createUser(payload);
        ui.showToast(`Employee created with role ${payload.role}!`, 'success');
      }
      ui.closeModal('user-modal');
      await this.loadUsers();
    } catch (err) {
      console.error(err);
    }
  }
};
