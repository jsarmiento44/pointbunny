class KDSView {
  _panel = document.getElementById('kdsPanel');
  _grid = document.getElementById('kdsGrid');
  _queueCount = document.getElementById('kdsQueueCount');

  open(queue) {
    this._panel.classList.remove('hidden');
    this.renderQueue(queue);
  }

  close() {
    this._panel.classList.add('hidden');
  }

  renderQueue(queue) {
    const visible = queue.slice(0, 10);
    if (this._queueCount) {
      this._queueCount.textContent = queue.length > 0
        ? `${queue.length} order${queue.length !== 1 ? 's' : ''}`
        : '';
    }
    if (visible.length === 0) {
      this._grid.innerHTML = '<p class="kds-empty">No active orders.</p>';
      return;
    }
    this._grid.innerHTML = visible.map((order, i) => this._cardMarkup(order, i + 1)).join('');
  }

  _cardMarkup(order, num) {
    const itemsHtml = order.items.map(item => {
      const variants = item.selectedVariants
        ?.map(v => v.variantName)
        .filter(Boolean)
        .join(', ');
      return `<li class="kds-item">${item.itemName} ×${item.quantity}${variants ? `<span class="kds-item-variants"> · ${variants}</span>` : ''}</li>`;
    }).join('');

    return `
      <div class="kds-card" data-order-id="${order.id}">
        <div class="kds-card-header">
          <span class="kds-order-num">#${num}</span>
          <span class="kds-timer" data-order-id="${order.id}">0:00</span>
        </div>
        <ul class="kds-items">${itemsHtml}</ul>
        <div class="kds-card-footer">
          <span class="kds-total">$${order.totalPrice.toFixed(2)}</span>
          <button class="kds-done-btn btn primary" data-order-id="${order.id}" type="button">Done</button>
        </div>
      </div>
    `;
  }

  updateTimers(queue, now, yellowThreshold, redThreshold) {
    queue.forEach(order => {
      const elapsed = Math.floor((now - order.startedAt) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timerEl = this._grid.querySelector(`.kds-timer[data-order-id="${order.id}"]`);
      const cardEl = this._grid.querySelector(`.kds-card[data-order-id="${order.id}"]`);
      if (!timerEl || !cardEl) return;
      timerEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
      const isWarn = elapsed >= yellowThreshold && elapsed < redThreshold;
      const isUrgent = elapsed >= redThreshold;
      timerEl.classList.toggle('kds-timer--warn', isWarn);
      timerEl.classList.toggle('kds-timer--urgent', isUrgent);
      cardEl.classList.toggle('kds-card--warn', isWarn);
      cardEl.classList.toggle('kds-card--urgent', isUrgent);
    });
  }

  playNewOrderSound() {
    try {
      const ctx = new AudioContext();
      const frequencies = [523.25, 659.25, 783.99]; // C5 E5 G5 — a short bright chord
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
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

  _addHandlerOpen(handler) {
    document.getElementById('kdsOpenBtn').addEventListener('click', handler);
  }

  _addHandlerClose(handler) {
    document.getElementById('kdsCloseBtn').addEventListener('click', handler);
  }

  _addHandlerDone(handler) {
    this._grid.addEventListener('click', e => {
      const btn = e.target.closest('.kds-done-btn');
      if (!btn) return;
      handler(btn.dataset.orderId);
    });
  }
}

export default new KDSView();
