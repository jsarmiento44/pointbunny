import { supabase } from './supabase.js';

const BROADCAST_EVENT = 'msg';
const BC_NAME = 'pointbunny-local';

class PointbunnyChannel {
  constructor() {
    this._handler = null;

    // Native BroadcastChannel: synchronous, zero-network, same-browser windows only.
    // Used alongside Supabase Realtime so messages survive brief connection drops.
    this._bc = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(BC_NAME)
      : null;
    if (this._bc) {
      this._bc.onmessage = ({ data }) => {
        if (this._handler) this._handler({ data });
      };
    }

    this.ready = new Promise(resolve => {
      this._ch = supabase.channel('pointbunny-displays', {
        config: { broadcast: { self: false } },
      });
      this._ch.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
        if (this._handler) this._handler({ data: payload });
      });
      this._ch.subscribe(status => {
        if (status === 'SUBSCRIBED') resolve();
      });
    });
  }

  postMessage(data) {
    this._ch.send({ type: 'broadcast', event: BROADCAST_EVENT, payload: data });
    this._bc?.postMessage(data);
  }

  set onmessage(fn) {
    this._handler = fn;
  }
}

const channel = new PointbunnyChannel();
export default channel;

// ── Message types ─────────────────────────────────────────────────────────────

export const MSG = {
  // KDS: cashier → kitchen
  KDS_QUEUE_SYNC:   'KDS_QUEUE_SYNC',   // full queue snapshot
  // KDS: kitchen → cashier
  KDS_REQUEST_SYNC: 'KDS_REQUEST_SYNC', // kitchen window just opened, needs current queue
  KDS_ORDER_DONE:   'KDS_ORDER_DONE',   // cook committed an order as done (after undo window)
  KDS_ORDER_VOIDED: 'KDS_ORDER_VOIDED', // cashier/manager voided a transaction; remove from KDS

  // CFD: cashier → customer display
  CFD_CART_UPDATE:    'CFD_CART_UPDATE',    // cart changed (add/remove/clear)
  CFD_SALE_COMPLETE:  'CFD_SALE_COMPLETE',  // transaction finished
  // CFD: customer display → cashier
  CFD_REQUEST_SYNC:   'CFD_REQUEST_SYNC',   // CFD just opened, needs current cart
};
