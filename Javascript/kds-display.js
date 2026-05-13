import channel, { MSG } from './channel.js';
import './display-theme.js';

const grid = document.getElementById('kdsWinGrid');
const countEl = document.getElementById('kdsWinCount');

let queue = [];
let thresholds = { yellow: 180, red: 300 };
let tickInterval = null;

// ── Rendering ─────────────────────────────────────────────────────────────────

const cardMarkup = (order, num) => {
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
};

const renderQueue = () => {
  const visible = queue.slice(0, 10);
  const newCount = queue.length > 0 ? `${queue.length} order${queue.length !== 1 ? 's' : ''}` : '';
  if (countEl.textContent !== newCount) {
    countEl.textContent = newCount;
    countEl.classList.remove('updated');
    void countEl.offsetWidth;
    countEl.classList.add('updated');
  }

  if (visible.length === 0) {
    grid.innerHTML = '<p class="kds-empty">No active orders.</p>';
    return;
  }
  grid.innerHTML = visible.map((order, i) => cardMarkup(order, i + 1)).join('');
};

// ── Timer tick ────────────────────────────────────────────────────────────────

const tick = () => {
  if (queue.length === 0) { stopTick(); return; }
  const now = Date.now();
  queue.forEach(order => {
    const elapsed = Math.floor((now - order.startedAt) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timerEl = grid.querySelector(`.kds-timer[data-order-id="${order.id}"]`);
    const cardEl  = grid.querySelector(`.kds-card[data-order-id="${order.id}"]`);
    if (!timerEl || !cardEl) return;
    const isWarn   = elapsed >= thresholds.yellow && elapsed < thresholds.red;
    const isUrgent = elapsed >= thresholds.red;
    const timeStr  = `${mins}:${String(secs).padStart(2, '0')}`;
    timerEl.textContent = isUrgent ? `🔥 ${timeStr}` : isWarn ? `⏰ ${timeStr}` : timeStr;
    timerEl.classList.toggle('kds-timer--warn',   isWarn);
    timerEl.classList.toggle('kds-timer--urgent', isUrgent);
    cardEl.classList.toggle('kds-card--warn',   isWarn);
    cardEl.classList.toggle('kds-card--urgent', isUrgent);
  });
};

const startTick = () => { if (!tickInterval) tickInterval = setInterval(tick, 1000); };
const stopTick  = () => { clearInterval(tickInterval); tickInterval = null; };

// ── Done button ───────────────────────────────────────────────────────────────

grid.addEventListener('click', e => {
  const btn = e.target.closest('.kds-done-btn');
  if (!btn) return;
  const id = btn.dataset.orderId;
  queue = queue.filter(o => o.id !== id);
  renderQueue();
  if (queue.length === 0) stopTick();
  channel.postMessage({ type: MSG.KDS_ORDER_DONE, id });
});

// ── Channel messages ──────────────────────────────────────────────────────────

channel.onmessage = ({ data }) => {
  if (data.type === MSG.KDS_QUEUE_SYNC) {
    queue = data.queue ?? [];
    if (data.thresholds) thresholds = data.thresholds;
    renderQueue();
    queue.length > 0 ? startTick() : stopTick();
  }
};

// ── Init — ask cashier for current queue ──────────────────────────────────────

channel.ready.then(() => channel.postMessage({ type: MSG.KDS_REQUEST_SYNC }));
