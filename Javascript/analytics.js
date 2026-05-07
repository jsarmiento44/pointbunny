/**
 * Click analytics — passive event collection for future product insights.
 *
 * Supabase table required:
 *
 *   create table analytics (
 *     id         uuid        primary key default gen_random_uuid(),
 *     user_id    uuid        references auth.users on delete set null,
 *     button_id  text        not null,
 *     label      text,
 *     clicked_at timestamptz not null default now()
 *   );
 *
 *   -- RLS: users can only insert their own rows
 *   alter table analytics enable row level security;
 *   create policy "insert own" on analytics for insert
 *     with check (auth.uid() = user_id);
 */

import { supabase } from './supabase.js';

let _userId   = null;
let _buffer   = [];
let _interval = null;

const MAX_BUFFER        = 500;
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

// ── Button identification ─────────────────────────────────────────────────────

const _identify = (target) => {
  const el = target.closest('button, [role="button"], [data-action]');
  if (!el) return null;

  // Priority: id → data-action → aria-label → trimmed text content
  const buttonId =
    el.id ||
    el.dataset.action ||
    el.getAttribute('aria-label') ||
    el.textContent.trim().slice(0, 40).replace(/\s+/g, ' ') ||
    'unknown';

  const label =
    el.getAttribute('aria-label') ||
    el.textContent.trim().slice(0, 80).replace(/\s+/g, ' ') ||
    el.id ||
    'unknown';

  return { buttonId, label };
};

// ── Recorder ─────────────────────────────────────────────────────────────────

const _record = (e) => {
  if (_buffer.length >= MAX_BUFFER) return;
  const info = _identify(e.target);
  if (!info) return;
  _buffer.push({
    user_id:    _userId,
    button_id:  info.buttonId,
    label:      info.label,
    clicked_at: new Date().toISOString(),
  });
};

// ── Flush ─────────────────────────────────────────────────────────────────────

export const flush = async () => {
  if (_buffer.length === 0 || !_userId) return;
  const events = _buffer.splice(0);
  try {
    await supabase.from('analytics').insert(events);
  } catch (_) {
    // Analytics must never surface errors or break the app
  }
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export const init = (userId) => {
  _userId = userId;
  document.addEventListener('click', _record, { capture: true });
  _interval = setInterval(flush, FLUSH_INTERVAL_MS);
};

export const destroy = async () => {
  document.removeEventListener('click', _record, { capture: true });
  clearInterval(_interval);
  _interval = null;
  await flush();
};
