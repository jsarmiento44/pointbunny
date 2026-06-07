const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CATEGORY_LABELS = {
  billing: 'Billing',
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  account: 'Account',
  other: 'Other',
};

class SupportView {
  _modal          = document.getElementById('supportModal');
  _shell          = document.querySelector('.support-shell');
  _closeBtn       = document.getElementById('supportCloseBtn');
  _ticketList     = document.getElementById('supportTicketList');
  _thread         = document.getElementById('supportThread');
  _detailTitle    = document.getElementById('supportDetailTitle');
  _detailStatus   = document.getElementById('supportDetailStatus');
  _detailCategory = document.getElementById('supportDetailCategory');
  _unreadBadge    = document.getElementById('supportUnreadBadge');
  _currentTicketId = null;
  _selectedRating  = 0;

  // ── Open / Close ──────────────────────────────────────────────────────────────

  open() {
    this._modal.classList.remove('hidden');
    this._shell?.classList.remove('support-shell--detail');
    this._showMain('welcome');
  }

  _close() {
    this._shell?.classList.add('modal-exiting');
    setTimeout(() => {
      this._shell?.classList.remove('modal-exiting');
      this._modal.classList.add('hidden');
    }, 220);
  }

  // ── Main panel switching (right side) ────────────────────────────────────────

  _showMain(name) {
    ['supportWelcomePanel', 'supportNewPanel', 'supportDetailPanel', 'supportSuccessPanel']
      .forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById(`support${name.charAt(0).toUpperCase() + name.slice(1)}Panel`)
      ?.classList.remove('hidden');
  }

  showNewTicketPanel() {
    this._clearActiveRow();
    document.getElementById('newTicketModal')?.classList.remove('hidden');
  }

  closeNewTicketModal() {
    const modal = document.getElementById('newTicketModal');
    const inner = modal?.querySelector('.modal-container');
    if (inner) inner.classList.add('modal-exiting');
    setTimeout(() => {
      inner?.classList.remove('modal-exiting');
      modal?.classList.add('hidden');
    }, 220);
  }

  showListPanel()    { this._shell?.classList.remove('support-shell--detail'); this._showMain('welcome'); this._clearActiveRow(); }
  showSuccessPanel() { this.closeNewTicketModal(); this._showMain('success'); }

  // ── Ticket list rendering ─────────────────────────────────────────────────────

  renderTicketList(tickets) {
    if (!tickets.length) {
      this._ticketList.innerHTML = '<li class="support-empty">No tickets yet.<br>Hit "New Ticket" to get started.</li>';
      return;
    }
    this._ticketList.innerHTML = tickets.map(t => `
      <li class="support-ticket-row${this._currentTicketId === t.id ? ' support-ticket-row--active' : ''}" data-id="${t.id}">
        ${t.has_unread_reply ? '<span class="support-unread-dot"></span>' : '<span style="width:7px;flex-shrink:0"></span>'}
        <div class="support-ticket-info">
          <span class="support-ticket-subject">${esc(t.subject)}</span>
          <span class="support-ticket-meta">${CATEGORY_LABELS[t.category] ?? t.category} &middot; ${this._relativeDate(t.created_at)}</span>
          <span class="support-chip support-chip--${t.status}">${t.status === 'solved' ? 'Solved' : 'Open'}</span>
        </div>
      </li>
    `).join('');
  }

  _clearActiveRow() {
    this._currentTicketId = null;
    document.querySelectorAll('.support-ticket-row--active')
      .forEach(r => r.classList.remove('support-ticket-row--active'));
  }

  _setActiveRow(ticketId) {
    document.querySelectorAll('.support-ticket-row').forEach(r => {
      r.classList.toggle('support-ticket-row--active', r.dataset.id === ticketId);
    });
  }

  // ── Thread rendering ──────────────────────────────────────────────────────────

  renderThread(ticket, replies) {
    this._currentTicketId = ticket.id;
    this._setActiveRow(ticket.id);

    this._detailTitle.textContent = ticket.subject;
    this._detailCategory.textContent = CATEGORY_LABELS[ticket.category] ?? ticket.category;
    this._detailCategory.className = `support-chip support-chip--open`;

    this._detailStatus.textContent = ticket.status === 'solved' ? 'Solved' : 'Open';
    this._detailStatus.className = `support-status-chip support-chip--${ticket.status}`;

    const ticketIdEl = document.getElementById('supportDetailTicketId');
    if (ticketIdEl) ticketIdEl.textContent = '#' + ticket.id.replace(/-/g, '').slice(0, 8).toUpperCase();

    const solvedBtn = document.getElementById('supportMarkSolvedBtn');
    if (solvedBtn) solvedBtn.classList.toggle('hidden', ticket.status === 'solved');

    const replyBar = document.getElementById('supportReplyBar');
    if (replyBar) replyBar.classList.toggle('hidden', ticket.status === 'solved');

    const ratingBar  = document.getElementById('supportRatingBar');
    const ratingDone = document.getElementById('supportRatingDone');
    const showPrompt = ticket.status === 'solved' && !ticket.rating;
    if (ratingBar)  ratingBar.classList.toggle('hidden', !showPrompt);
    if (ratingDone) ratingDone.classList.add('hidden');
    if (showPrompt) this._resetStars();

    const emojis = ['', '😤', '😕', '😐', '😊', '🤩'];
    const labels = ['', 'Bad', 'Poor', 'OK', 'Good', 'Great'];

    const allMessages = [
      { sender_type: 'business', message: ticket.message, created_at: ticket.created_at, attachment: ticket.attachments?.[0] },
      ...replies,
    ];

    const closureBlock = ticket.status === 'solved' ? `
      <div class="support-closure">
        <div class="support-closure-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p class="support-closure-title">Ticket closed</p>
        ${ticket.rating ? `<p class="support-closure-rating">You rated this conversation ${emojis[ticket.rating]} <strong>${labels[ticket.rating]}</strong></p>` : ''}
      </div>
    ` : '';

    this._thread.innerHTML = allMessages.map(msg => `
      <div class="support-msg support-msg--${msg.sender_type}">
        <div class="support-msg-bubble">
          <p class="support-msg-text">${esc(msg.message)}</p>
          ${msg.attachment ? `<a class="support-msg-attachment" href="${esc(msg.attachment)}" target="_blank" rel="noopener">View attachment</a>` : ''}
        </div>
        <span class="support-msg-time">${msg.sender_type === 'admin' ? 'Pointbunny Support' : 'You'} &middot; ${this._relativeDate(msg.created_at)}</span>
      </div>
    `).join('') + closureBlock;

    this._shell?.classList.add('support-shell--detail');
    this._showMain('detail');
    setTimeout(() => { this._thread.scrollTop = this._thread.scrollHeight; }, 0);
  }

  // ── Unread badge on home card ─────────────────────────────────────────────────

  syncUnreadBadge(tickets) {
    const count = tickets.filter(t => t.has_unread_reply).length;
    if (count > 0) {
      this._unreadBadge.textContent = count;
      this._unreadBadge.classList.remove('hidden');
    } else {
      this._unreadBadge.classList.add('hidden');
    }
  }

  // ── New ticket form helpers ───────────────────────────────────────────────────

  _getTicketFormData() {
    const input = document.getElementById('ticketFiles');
    return {
      category: document.getElementById('ticketCategory')?.value,
      subject:  document.getElementById('ticketSubject')?.value.trim(),
      message:  document.getElementById('ticketMessage')?.value.trim(),
      files:    input ? Array.from(input.files).slice(0, 1) : [],
    };
  }

  setTicketSubmitting(loading) {
    const btn = document.getElementById('ticketSubmitBtn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Sending…' : 'Send Message';
  }

  showTicketResult(success, message) {
    const el = document.getElementById('ticketStatusMsg');
    if (!el) return;
    el.textContent = message;
    el.className = `ticket-status-msg ${success ? 'ticket-status-msg--ok' : 'ticket-status-msg--err'}`;
  }

  resetTicketForm() {
    ['ticketCategory', 'ticketSubject', 'ticketMessage', 'ticketFiles'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const list = document.getElementById('ticketFileList');
    if (list) list.innerHTML = '';
    const msg = document.getElementById('ticketStatusMsg');
    if (msg) msg.className = 'ticket-status-msg hidden';
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  _addHandlerOpen(handler) {
    document.addEventListener('click', e => {
      if (e.target.closest("[data-action='support']")) handler();
    });
  }

  _addHandlerClose() {
    this._closeBtn.addEventListener('click', () => this._close());
    this._modal.addEventListener('click', e => {
      if (e.target === this._modal) this._close();
    });
  }

  _addHandlerNewTicket(handler) {
    document.getElementById('supportNewTicketBtn')?.addEventListener('click', handler);
  }

  _addHandlerCloseNewTicket(handler) {
    const modal = document.getElementById('newTicketModal');
    document.getElementById('newTicketCloseBtn')?.addEventListener('click', handler);
    modal?.addEventListener('click', e => { if (e.target === modal) handler(); });
  }

  _addHandlerBackToList(handler) {
    document.getElementById('supportBackToListBtn2')?.addEventListener('click', handler);
  }

  _addHandlerTicketClick(handler) {
    this._ticketList.addEventListener('click', e => {
      const row = e.target.closest('.support-ticket-row[data-id]');
      if (!row) return;
      handler(row.dataset.id);
    });
  }

  _addHandlerMarkSolved(handler) {
    document.getElementById('supportMarkSolvedBtn')?.addEventListener('click', () => {
      handler(this._currentTicketId);
    });
  }

  _addHandlerSubmitTicket(handler) {
    document.getElementById('ticketSubmitBtn')?.addEventListener('click', () => handler());
  }

  _addHandlerViewTickets(handler) {
    document.getElementById('supportViewTicketsBtn')?.addEventListener('click', handler);
  }

  _addHandlerSendReply(handler) {
    document.getElementById('supportReplySendBtn')?.addEventListener('click', handler);
    document.getElementById('supportReplyInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handler();
    });
  }

  _addHandlerStarInteraction() {
    const container = document.getElementById('supportStars');
    if (!container) return;
    container.addEventListener('mouseover', e => {
      const star = e.target.closest('.support-star[data-value]');
      if (!star) return;
      container.querySelectorAll('.support-star').forEach(s => s.classList.toggle('support-star--hover', s === star));
    });
    container.addEventListener('mouseleave', () => {
      container.querySelectorAll('.support-star').forEach(s => s.classList.remove('support-star--hover'));
    });
    container.addEventListener('click', e => {
      const star = e.target.closest('.support-star[data-value]');
      if (!star) return;
      this._selectedRating = parseInt(star.dataset.value);
      container.querySelectorAll('.support-star').forEach(s => s.classList.toggle('support-star--active', s === star));
    });
  }

  _addHandlerSubmitRating(handler) {
    document.getElementById('supportRatingSubmitBtn')?.addEventListener('click', handler);
  }

  getRatingData() {
    return {
      rating:  this._selectedRating,
      comment: document.getElementById('supportRatingComment')?.value.trim() ?? '',
    };
  }

  setRatingSubmitting(loading) {
    const btn = document.getElementById('supportRatingSubmitBtn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Submitting…' : 'Submit Rating';
  }

  _resetStars() {
    this._selectedRating = 0;
    document.querySelectorAll('.support-star').forEach(s => {
      s.classList.remove('support-star--active', 'support-star--hover');
    });
    const comment = document.getElementById('supportRatingComment');
    if (comment) comment.value = '';
  }

  _addHandlerTicketFiles() {
    const input = document.getElementById('ticketFiles');
    const list  = document.getElementById('ticketFileList');
    if (!input || !list) return;
    input.addEventListener('change', () => {
      const files = Array.from(input.files).slice(0, 1);
      list.innerHTML = files.map(f => `<li class="ticket-file-item">${esc(f.name)}</li>`).join('');
    });
  }

  _getReplyText() {
    return document.getElementById('supportReplyInput')?.value.trim() ?? '';
  }

  clearReplyInput() {
    const el = document.getElementById('supportReplyInput');
    if (el) el.value = '';
  }

  setReplySending(loading) {
    const btn = document.getElementById('supportReplySendBtn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Sending…' : 'Send';
  }

  setCurrentTicket(id) { this._currentTicketId = id; }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _relativeDate(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}

export default new SupportView();
