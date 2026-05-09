import { supabase } from './supabase.js';

const BROADCAST_EVENT = 'msg';

class PointyChannel {
  constructor() {
    this._handler = null;
    this._ch = supabase.channel('pointy-displays', {
      config: { broadcast: { self: false } },
    });
    this._ch.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
      if (this._handler) this._handler({ data: payload });
    });
    this._ch.subscribe();
  }

  postMessage(data) {
    this._ch.send({ type: 'broadcast', event: BROADCAST_EVENT, payload: data });
  }

  set onmessage(fn) {
    this._handler = fn;
  }
}

const channel = new PointyChannel();
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
