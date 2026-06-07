const PREVIEW_COUNT = 8;

const fmtTime = iso =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

class KDSView {
  _list          = document.getElementById('openOrdersList');
  _viewAllBtn    = document.getElementById('openOrdersViewAll');
  _expanded      = false;
  _modalBackdrop = document.getElementById('allOrdersBackdrop');
  _modalList     = document.getElementById('allOrdersModalList');
  _modalCount    = document.getElementById('allOrdersModalCount');
  _modalOpen     = false;

  renderQueue(queue) {
    if (queue.length === 0) {
      this._list.innerHTML = `
        <li class="oq-empty-state">
          <span class="oq-empty-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </span>
          <span class="oq-empty-title">All caught up</span>
          <span class="oq-empty-subtitle">New orders will appear here as they come in</span>
        </li>`;
      this._viewAllBtn.classList.add('hidden');
      this._expanded = false;
    } else {
      this._list.innerHTML = queue
        .map((order, i) => this._rowMarkup(order, i + 1, i >= PREVIEW_COUNT && !this._expanded))
        .join('');

      if (queue.length > PREVIEW_COUNT) {
        this._viewAllBtn.classList.remove('hidden');
        this._viewAllBtn.textContent = this._expanded
          ? 'Show Less'
          : `View All (${queue.length})`;
      } else {
        this._viewAllBtn.classList.add('hidden');
        this._expanded = false;
      }
    }

    if (this._modalOpen) this._renderModalList(queue);
  }

  _renderModalList(queue) {
    if (this._modalCount) {
      this._modalCount.textContent = queue.length > 0
        ? `${queue.length} order${queue.length !== 1 ? 's' : ''}`
        : '';
    }
    if (queue.length === 0) {
      this._modalList.innerHTML = '<li class="oq-empty">No active orders.</li>';
      return;  // modal uses compact empty state
    }
    this._modalList.innerHTML = queue
      .map((order, i) => this._rowMarkup(order, i + 1, false))
      .join('');
  }

  openModal(queue) {
    this._modalOpen = true;
    this._modalBackdrop.classList.remove('hidden');
    this._renderModalList(queue);
  }

  closeModal() {
    this._modalOpen = false;
    this._modalBackdrop.classList.add('hidden');
  }

  _addHandlerOpenModal(getQueue) {
    document.getElementById('openOrdersExpandBtn')?.addEventListener('click', () => {
      this.openModal(getQueue());
    });
  }

  _addHandlerModalClose() {
    document.getElementById('allOrdersCloseBtn')?.addEventListener('click', () => this.closeModal());
    this._modalBackdrop?.addEventListener('click', e => {
      if (e.target === this._modalBackdrop) this.closeModal();
    });
  }

  _addHandlerModalDone(handler) {
    this._modalList?.addEventListener('click', e => {
      const btn = e.target.closest('.oq-done-btn');
      if (!btn) return;
      handler(btn.dataset.orderId);
    });
  }

  _buildItemPreview(items) {
    const parts = items.map(it => {
      const qty = it.quantity ?? 1;
      let label = it.itemName;
      if (qty > 1) label += ` ×${qty}`;
      const firstVariant = it.selectedVariants?.[0];
      if (firstVariant?.optionName) label += ` (${firstVariant.optionName})`;
      return label;
    });
    const text = parts.join(' · ');
    return text.length > 55 ? text.slice(0, 52) + '…' : text;
  }

  _rowMarkup(order, num, hidden) {
    const orderTypeEnabled = localStorage.getItem('pointbunny_order_type_enabled') !== 'false';
    const typeLabel = (!orderTypeEnabled || !order.orderType) ? '' : order.orderType === 'takeout' ? 'Takeout' : 'Dine In';
    const preview = this._buildItemPreview(order.items);
    const elapsed = Math.floor((Date.now() - order.startedAt) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const waitStr = mins > 0 ? `${mins}m ${secs}s waiting` : `${secs}s waiting`;

    return `
      <li class="oq-row${hidden ? ' oq-row--hidden' : ''}" data-order-id="${order.id}">
        <div class="oq-left">
          <span class="oq-order-num">#${order.ticketNumber ?? num}${typeLabel ? ` <span class="oq-type">${typeLabel}</span>` : ''}</span>
          <span class="oq-items">${preview}</span>
          <span class="oq-waiting" data-waiting-id="${order.id}">${waitStr}</span>
        </div>
        <div class="oq-right">
          <span class="oq-badge oq-badge--preparing" data-badge-id="${order.id}">Preparing</span>
          <button class="oq-done-btn btn" data-order-id="${order.id}" type="button">Mark Done</button>
        </div>
      </li>`;
  }

  updateTimers(queue, now, yellowThreshold, redThreshold) {
    const roots = this._modalOpen
      ? [this._list, this._modalList]
      : [this._list];

    queue.forEach(order => {
      const elapsed  = Math.floor((now - order.startedAt) / 1000);
      const isWarn   = elapsed >= yellowThreshold && elapsed < redThreshold;
      const isUrgent = elapsed >= redThreshold;
      const cls      = `oq-badge ${isUrgent ? 'oq-badge--urgent' : isWarn ? 'oq-badge--warn' : 'oq-badge--preparing'}`;
      const text     = isUrgent ? '🔥 Urgent' : isWarn ? '⏰ Delayed' : 'Preparing';
      const mins     = Math.floor(elapsed / 60);
      const secs     = elapsed % 60;
      const waitStr  = mins > 0 ? `${mins}m ${secs}s waiting` : `${secs}s waiting`;

      roots.forEach(root => {
        const badge   = root.querySelector(`.oq-badge[data-badge-id="${order.id}"]`);
        const row     = root.querySelector(`.oq-row[data-order-id="${order.id}"]`);
        const waiting = root.querySelector(`.oq-waiting[data-waiting-id="${order.id}"]`);
        if (!badge || !row) return;
        badge.className = cls;
        badge.textContent = text;
        row.classList.toggle('oq-row--warn',   isWarn);
        row.classList.toggle('oq-row--urgent', isUrgent);
        if (waiting) waiting.textContent = waitStr;
      });
    });
  }

  playNewOrderSound() {
    try {
      const ctx = new AudioContext();
      const frequencies = [523.25, 659.25, 783.99];
      frequencies.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.07);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.35);
        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.35);
      });
    } catch (_) {}
  }

  _addHandlerViewAll() {
    this._viewAllBtn.addEventListener('click', () => {
      this._expanded = !this._expanded;
      Array.from(this._list.querySelectorAll('.oq-row')).forEach((row, i) => {
        row.classList.toggle('oq-row--hidden', !this._expanded && i >= PREVIEW_COUNT);
      });
      this._viewAllBtn.textContent = this._expanded ? 'Show Less' : `View All`;
    });
  }

  _addHandlerDone(handler) {
    this._list.addEventListener('click', e => {
      const btn = e.target.closest('.oq-done-btn');
      if (!btn) return;
      handler(btn.dataset.orderId);
    });
  }

  showUndoToast(order, onUndo, durationMs) {
    const label = order.ticketNumber ? `#${order.ticketNumber}` : 'Order';
    const el = document.createElement('div');
    el.className = 'toast toast--undo';
    let remaining = Math.ceil(durationMs / 1000);

    el.innerHTML = `
      <span class="toast-undo-msg">${label} marked done</span>
      <span class="toast-undo-countdown">${remaining}s</span>
      <button class="toast-undo-btn" type="button">Undo</button>`;
    el.querySelector('.toast-undo-btn').addEventListener('click', onUndo, { once: true });

    let container = document.getElementById('undoToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'undoToastContainer';
      container.className = 'undo-toast-container';
      document.body.appendChild(container);
    }
    container.appendChild(el);
    void el.offsetHeight;
    el.classList.add('toast--visible');

    const countdownInterval = setInterval(() => {
      remaining--;
      const cd = el.querySelector('.toast-undo-countdown');
      if (cd) cd.textContent = `${remaining}s`;
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
      el.classList.remove('toast--visible');
      el.addEventListener('transitionend', () => {
        el.remove();
        const c = document.getElementById('undoToastContainer');
        if (c && c.children.length === 0) c.remove();
      }, { once: true });
    };
  }
}

export default new KDSView();
