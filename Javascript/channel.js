const channel = new BroadcastChannel('pointy-displays');

export default channel;

// ── Message types ─────────────────────────────────────────────────────────────

export const MSG = {
  // KDS: cashier → kitchen
  KDS_QUEUE_SYNC:   'KDS_QUEUE_SYNC',   // full queue snapshot
  // KDS: kitchen → cashier
  KDS_REQUEST_SYNC: 'KDS_REQUEST_SYNC', // kitchen window just opened, needs current queue
  KDS_ORDER_DONE:   'KDS_ORDER_DONE',   // cook marked an order done

  // CFD: cashier → customer display
  CFD_CART_UPDATE:    'CFD_CART_UPDATE',    // cart changed (add/remove/clear)
  CFD_SALE_COMPLETE:  'CFD_SALE_COMPLETE',  // transaction finished
  // CFD: customer display → cashier
  CFD_REQUEST_SYNC:   'CFD_REQUEST_SYNC',   // CFD just opened, needs current cart
};
