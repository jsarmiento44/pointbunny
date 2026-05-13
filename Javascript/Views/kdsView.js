const PREVIEW_COUNT = 5;

const fmtTime = iso =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

class KDSView {
  _list       = document.getElementById('openOrdersList');
  _viewAllBtn = document.getElementById('openOrdersViewAll');
  _expanded   = false;

  renderQueue(queue) {
    if (queue.length === 0) {
      this._list.innerHTML = '<li class="oq-empty">No active orders.</li>';
      this._viewAllBtn.classList.add('hidden');
      this._expanded = false;
      return;
    }

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

  _rowMarkup(order, num, hidden) {
    const typeLabel = order.orderType === 'takeout' ? 'Takeout' : 'Dine In';
    const itemCount = order.items.reduce((sum, it) => sum + (it.quantity ?? 1), 0);
    const time = fmtTime(order.saleDate);

    return `
      <li class="oq-row${hidden ? ' oq-row--hidden' : ''}" data-order-id="${order.id}">
        <div class="oq-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div class="oq-info">
          <span class="oq-num">#${num}</span>
          <span class="oq-sub">${typeLabel} &middot; ${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
        </div>
        <span class="oq-time">${time}</span>
        <span class="oq-badge oq-badge--preparing" data-badge-id="${order.id}">Preparing</span>
        <button class="oq-done-btn btn" data-order-id="${order.id}" type="button">Done</button>
      </li>`;
  }

  updateTimers(queue, now, yellowThreshold, redThreshold) {
    queue.forEach(order => {
      const elapsed = Math.floor((now - order.startedAt) / 1000);
      const badge = this._list.querySelector(`.oq-badge[data-badge-id="${order.id}"]`);
      const row   = this._list.querySelector(`.oq-row[data-order-id="${order.id}"]`);
      if (!badge || !row) return;

      const isWarn   = elapsed >= yellowThreshold && elapsed < redThreshold;
      const isUrgent = elapsed >= redThreshold;
      badge.className = `oq-badge ${isUrgent ? 'oq-badge--urgent' : isWarn ? 'oq-badge--warn' : 'oq-badge--preparing'}`;
      badge.textContent = isUrgent ? '🔥 Urgent' : isWarn ? '⏰ Delayed' : 'Preparing';
      row.classList.toggle('oq-row--warn',   isWarn);
      row.classList.toggle('oq-row--urgent', isUrgent);
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
}

export default new KDSView();
