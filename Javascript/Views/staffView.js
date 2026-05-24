class StaffView {
  _panel      = document.querySelector('#staffPanel');
  _list       = document.querySelector('#staffList');
  _rolesEl    = document.querySelector('#staffRolesContent');
  _payrollEl  = document.querySelector('#staffPayrollContent');
  _formModal  = document.querySelector('#inviteStaffModal');

  open(canManage = false) {
    this._panel.classList.remove('hidden', 'cashflow-exiting');
    const inviteBtn = this._panel.querySelector('#inviteStaffBtn');
    if (inviteBtn) inviteBtn.classList.toggle('hidden', !canManage);
    this._switchTab('members');
  }

  _switchTab(tab) {
    this._panel.querySelectorAll('.staff-tab').forEach(btn => {
      btn.classList.toggle('staff-tab--active', btn.dataset.tab === tab);
    });
    this._list.classList.toggle('hidden', tab !== 'members');
    this._rolesEl.classList.toggle('hidden', tab !== 'roles');
    this._payrollEl.classList.toggle('hidden', tab !== 'payroll');
    if (tab === 'payroll' && !this._payrollEl.dataset.rendered) {
      this._renderPayrollComingSoon();
      this._payrollEl.dataset.rendered = '1';
    }
  }

  _renderPayrollComingSoon() {
    this._payrollEl.innerHTML = `
      <div class="staff-soon-hero">
        <div class="staff-soon-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h2 class="staff-soon-title">Payroll & Time Tracker</h2>
        <p class="staff-soon-sub">Track shifts, manage timesheets, and run payroll — all inside Pointy. We're building this now.</p>
        <div class="staff-soon-features">
          <div class="staff-soon-feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Clock In / Clock Out
          </div>
          <div class="staff-soon-feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Timesheets & Schedules
          </div>
          <div class="staff-soon-feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Pay Runs & Summaries
          </div>
          <div class="staff-soon-feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Hours vs. Sales Reports
          </div>
        </div>
      </div>
    `;
  }

  _addHandlerTabs() {
    this._panel.querySelector('.staff-sidebar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.staff-tab');
      if (!btn) return;
      this._switchTab(btn.dataset.tab);
    });
  }

  close() {
    this._panel.classList.add('cashflow-exiting');
    setTimeout(() => {
      this._panel.classList.add('hidden');
      this._panel.classList.remove('cashflow-exiting');
    }, 220);
  }

  render(staff, canManage = false) {
    this._list.innerHTML = this._generateListMarkup(staff, canManage);
  }

  renderRoles(roles) {
    if (!roles?.length) {
      this._rolesEl.innerHTML = `<p class="staff-empty">No roles defined.</p>`;
      return;
    }
    this._rolesEl.innerHTML = roles.map(r => `
      <div class="staff-role-card">
        <div class="staff-role-card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="staff-role-card-info">
          <div class="staff-role-card-name">${r.name}</div>
          <div class="staff-role-card-desc">${_roleDescription(r.name)}</div>
        </div>
      </div>
    `).join('');

    function _roleDescription(name) {
      const map = {
        Admin:   'Full access — manage staff, menu, sales, and settings.',
        Manager: 'Manage menu and sales. Cannot change staff or settings.',
        Cashier: 'Process sales only.',
      };
      return map[name] ?? 'Custom role.';
    }
  }

  _generateListMarkup(staff, canManage) {
    if (!staff.length)
      return `<li class="staff-empty">No staff members yet. Hit "+ Invite" to add someone.</li>`;

    const AVATAR_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];

    return staff.map((s, i) => {
      const initials = `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase() || '?';
      const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return `
      <li class="staff-item" data-id="${s.id}">
        <div class="staff-avatar" style="background:${color}">${initials}</div>
        <div class="staff-item-info">
          <div class="staff-item-name">${s.firstName} ${s.lastName}${s.isSelf ? ' <span class="staff-you-tag">you</span>' : ''}</div>
          <div class="staff-item-email">${s.email}</div>
        </div>
        <div class="staff-item-meta">
          <span class="staff-role-badge">${s.role}</span>
          <span class="staff-status-badge staff-status-badge--${s.isPending ? 'pending' : 'active'}">
            ${s.isPending ? 'Pending' : 'Active'}
          </span>
        </div>
        ${canManage && !s.isSelf ? `
        <div class="staff-item-actions">
          <button class="staff-action-btn" data-id="${s.id}" data-action="edit" type="button" title="Edit role">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="staff-action-btn staff-action-btn--pin" data-id="${s.id}" data-action="pin" type="button" title="${s.hasPin ? 'Change PIN' : 'Set PIN'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${s.hasPin ? 'Change PIN' : 'Set PIN'}
          </button>
          <button class="staff-action-btn staff-action-btn--remove" data-id="${s.id}" data-action="remove" type="button" title="Remove">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Remove
          </button>
        </div>` : ''}
      </li>`;
    }).join('');
  }

  showInviteForm(roles) {
    const formEl = this._formModal.querySelector('#inviteStaffForm');
    formEl.innerHTML = `
      <button class="modal-close-btn" id="inviteFormCloseBtn" type="button">&times;</button>
      <h2 class="edit-form-title">Invite Staff Member</h2>

      <div class="auth-col-pair">
        <div class="edit-field">
          <label for="inviteFirstName">First name</label>
          <input type="text" id="inviteFirstName" placeholder="Maria" autocomplete="off" />
        </div>
        <div class="edit-field">
          <label for="inviteLastName">Last name</label>
          <input type="text" id="inviteLastName" placeholder="Santos" autocomplete="off" />
        </div>
      </div>

      <div class="edit-field">
        <label for="inviteEmail">Email</label>
        <input type="email" id="inviteEmail" placeholder="staff@example.com" autocomplete="off" />
      </div>

      <div class="edit-field">
        <label for="inviteRole">Role</label>
        <select id="inviteRole" class="settings-select">
          ${roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
        </select>
      </div>

      <p class="settings-section-hint" style="margin-top:8px;">
        They'll need to sign up at your POS using this email address to activate their account.
      </p>

      <div class="adj-form-actions">
        <button type="button" class="btn" id="inviteCancelBtn">Cancel</button>
        <button type="button" class="btn primary" id="inviteSaveBtn">Add Member</button>
      </div>
    `;

    document.getElementById('inviteFormCloseBtn')?.addEventListener('click', () => this.closeForm());
    document.getElementById('inviteCancelBtn')?.addEventListener('click', () => this.closeForm());

    this._formModal.classList.remove('hidden');
    document.getElementById('inviteFirstName')?.focus();
  }

  closeForm() {
    this._formModal.classList.add('hidden');
    this._formModal.querySelector('#inviteStaffForm').innerHTML = '';
  }

  _getInviteData() {
    return {
      firstName: document.getElementById('inviteFirstName')?.value.trim(),
      lastName:  document.getElementById('inviteLastName')?.value.trim(),
      email:     document.getElementById('inviteEmail')?.value.trim(),
      roleId:    document.getElementById('inviteRole')?.value,
    };
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  _addHandlerOpen(handler) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest("[data-action='staff']")) return;
      handler();
    });
  }

  _addHandlerClose(handler) {
    this._panel.querySelector('.staff-back')?.addEventListener('click', () => handler());
    this._formModal.addEventListener('click', (e) => {
      if (e.target === this._formModal) this.closeForm();
    });
  }

  _addHandlerInvite(handler) {
    this._panel.querySelector('#inviteStaffBtn')?.addEventListener('click', () => handler());
  }

  _addHandlerSaveInvite(handler) {
    this._formModal.addEventListener('click', (e) => {
      if (!e.target.closest('#inviteSaveBtn')) return;
      const data = this._getInviteData();
      if (!data.firstName) { alert('Please enter a first name.'); return; }
      if (!data.lastName)  { alert('Please enter a last name.'); return; }
      if (!data.email)     { alert('Please enter an email.'); return; }
      handler(data);
    });
  }

  _addHandlerRemove(handler) {
    this._list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove"]');
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerEditRole(handler) {
    this._list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="edit"]');
      if (!btn) return;
      if (document.getElementById('staffEditRoleModal')) return;
      const staffId = btn.dataset.id;
      handler(staffId);
    });
  }

  showEditRoleModal(staff, roles) {
    const modal = document.createElement('div');
    modal.className = 'cashier-picker-overlay';
    modal.id = 'staffEditRoleModal';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="cashier-picker-card" style="max-width:340px">
        <div class="cashier-picker-header">
          <div>
            <h3 class="cashier-picker-title">Edit Staff</h3>
            <p class="cashier-picker-subtitle">${staff.firstName} ${staff.lastName}</p>
          </div>
          <button class="modal-close-btn" id="editRoleCloseBtn" type="button">&times;</button>
        </div>
        <div class="edit-field" style="margin-top:8px">
          <label for="editRoleSelect">Role</label>
          <select id="editRoleSelect" class="settings-select">
            ${roles.map(r => `<option value="${r.id}" ${r.id === staff.roleId ? 'selected' : ''}>${r.name}</option>`).join('')}
          </select>
        </div>
        <div class="adj-form-actions" style="margin-top:16px">
          <button type="button" class="btn" id="editRoleCancelBtn">Cancel</button>
          <button type="button" class="btn primary" id="editRoleSaveBtn">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    document.getElementById('editRoleCloseBtn')?.addEventListener('click', close);
    document.getElementById('editRoleCancelBtn')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    return {
      onSave: (cb) => {
        document.getElementById('editRoleSaveBtn')?.addEventListener('click', () => {
          const roleId = document.getElementById('editRoleSelect')?.value;
          close();
          cb(roleId);
        });
      }
    };
  }

  _addHandlerSetPin(handler) {
    this._list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="pin"]');
      if (!btn) return;
      if (document.querySelector('.cashier-picker-overlay')) return;
      const staffId = btn.dataset.id;
      const modal = document.createElement('div');
      modal.className = 'cashier-picker-overlay';
      modal.style.zIndex = '99999';
      modal.innerHTML = `
        <div class="cashier-picker-card" style="max-width:320px">
          <div class="cashier-picker-header">
            <div>
              <h3 class="cashier-picker-title">Set PIN</h3>
              <p class="cashier-picker-subtitle">6-digit cashier PIN</p>
            </div>
            <button class="modal-close-btn" data-action="pin-close" type="button">&times;</button>
          </div>
          <form class="edit-field" style="margin-top:8px" onsubmit="return false">
            <input type="password" data-input="pin" placeholder="Enter 6-digit PIN" maxlength="6" inputmode="numeric" autocomplete="new-password" class="settings-input" style="font-size:1.4rem;letter-spacing:0.5rem;text-align:center" />
          </form>
          <div class="adj-form-actions" style="margin-top:16px">
            <button type="button" class="btn" data-action="pin-cancel">Cancel</button>
            <button type="button" class="btn primary" data-action="pin-save">Save PIN</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const pinInput = modal.querySelector('[data-input="pin"]');
      pinInput?.focus();
      const close = () => modal.remove();
      modal.querySelector('[data-action="pin-close"]')?.addEventListener('click', close);
      modal.querySelector('[data-action="pin-cancel"]')?.addEventListener('click', close);
      modal.addEventListener('click', e => { if (e.target === modal) close(); });
      modal.querySelector('[data-action="pin-save"]')?.addEventListener('click', () => {
        const pin = pinInput?.value.trim();
        if (!pin || !/^\d{6}$/.test(pin)) {
          pinInput?.classList.add('input-error');
          return;
        }
        close();
        handler(staffId, pin);
      });
    });
  }
}

const _view = new StaffView();
_view._addHandlerTabs();
export default _view;
