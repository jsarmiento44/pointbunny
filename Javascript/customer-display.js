import channel, { MSG } from './channel.js';
import './display-theme.js';

const cartEl     = document.getElementById('cfdCart');
const idleEl     = document.getElementById('cfdIdle');
const totalBar   = document.getElementById('cfdTotalBar');
const totalEl    = document.getElementById('cfdTotalAmount');
const thankyouEl = document.getElementById('cfdThankyou');
const adEl       = document.getElementById('cfdAd');
const adImg      = document.getElementById('cfdAdImg');
const storeEl    = document.getElementById('cfdStoreName');

// ── Ad image ──────────────────────────────────────────────────────────────────

const adUrl = localStorage.getItem('pointy_cfd_ad');
if (adUrl) {
  adImg.src = adUrl;
  adEl.classList.remove('hidden');
}

const storedName = localStorage.getItem('pointy_store_name');
if (storedName) storeEl.textContent = storedName;

// ── Rendering ─────────────────────────────────────────────────────────────────

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const renderCart = (cart, total) => {
  thankyouEl.classList.remove('visible');

  if (!cart || cart.length === 0) {
    cartEl.innerHTML = '<p class="cfd-cart-empty">Waiting for order…</p>';
    totalBar.classList.add('hidden');
    return;
  }

  cartEl.innerHTML = cart.map(item => {
    const variants = item.selectedVariants
      ?.map(v => v.variantName)
      .filter(Boolean)
      .join(', ');
    return `
      <div class="cfd-cart-row">
        <div class="cfd-item-name">
          ${item.itemName}
          ${variants ? `<span class="cfd-item-variants">${variants}</span>` : ''}
        </div>
        <span class="cfd-item-qty">×${item.quantity}</span>
        <span class="cfd-item-price">${fmt(item.totalPrice)}</span>
      </div>
    `;
  }).join('');

  totalEl.textContent = fmt(total);
  totalBar.classList.remove('hidden');
  totalEl.classList.remove('updated');
  void totalEl.offsetWidth; // force reflow to re-trigger animation
  totalEl.classList.add('updated');
};

const showThankyou = () => {
  cartEl.innerHTML = '';
  totalBar.classList.add('hidden');
  thankyouEl.classList.add('visible');
  setTimeout(() => {
    thankyouEl.classList.remove('visible');
    cartEl.innerHTML = '<p class="cfd-cart-empty">Waiting for order…</p>';
  }, 3500);
};

// ── Channel messages ──────────────────────────────────────────────────────────

channel.onmessage = ({ data }) => {
  switch (data.type) {
    case MSG.CFD_CART_UPDATE:
      renderCart(data.cart, data.total);
      break;
    case MSG.CFD_SALE_COMPLETE:
      showThankyou();
      break;
  }
};

// ── Init — ask cashier for current cart ───────────────────────────────────────

channel.postMessage({ type: MSG.CFD_REQUEST_SYNC });
