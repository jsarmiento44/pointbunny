class StaffView {
  _panel     = document.querySelector('#staffPanel');
  _list      = document.querySelector('#staffList');
  _formModal = document.querySelector('#inviteStaffModal');

  open() {
    this._panel.classList.remove('hidden', 'cashflow-exiting');
  }

  close() {
    this._panel.classList.add('cashflow-exiting');
    setTimeout(() => {
      this._panel.classList.add('hidden');
      this._panel.classList.remove('cashflow-exiting');
    }, 220);
  }

  render(staff) {
    this._list.innerHTML = this._generateListMarkup(staff);
  }

  _generateListMarkup(staff) {
    if (!staff.length)
      return `<li class="staff-empty">No staff members yet. Hit "+ Invite" to add someone.</li>`;

    return staff.map(s => `
      <li class="staff-item" data-id="${s.id}">
        <div class="staff-item-info">
          <div class="staff-item-name">${s.firstName} ${s.lastName}</div>
          <div class="staff-item-email">${s.email}</div>
        </div>
        <div class="staff-item-meta">
          <span class="staff-role-badge">${s.role}</span>
          <span class="staff-status-badge staff-status-badge--${s.isPending ? 'pending' : 'active'}">
            ${s.isPending ? 'Pending' : 'Active'}
          </span>
        </div>
        ${!s.isSelf ? `<button class="btn staff-remove-btn" data-id="${s.id}" type="button">Remove</button>` : ''}
      </li>
    `).join('');
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
      const btn = e.target.closest('.staff-remove-btn');
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }
}

export default new StaffView();
