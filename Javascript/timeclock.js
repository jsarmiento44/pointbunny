import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ── State ─────────────────────────────────────────────────────────────────────

let _staffRecord  = null;  // { id, firstName, lastName, businessId }
let _shift        = null;  // { id, clockedInAt } | null
let _activeBreak  = null;  // { id, startedAt } | null
let _timerHandle  = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];

const $ = id => document.getElementById(id);

const show = id => $( id)?.classList.remove('hidden');
const hide = id => $( id)?.classList.add('hidden');

const showScreen = name => {
  ['tcScreenLoading','tcScreenActivate','tcScreenLogin','tcScreenShift']
    .forEach(id => id === `tcScreen${name}` ? show(id) : hide(id));
};

const formatDuration = (ms) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const formatHM = (ms) => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const formatTime = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const avatarColor = name => {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ── Device activation ─────────────────────────────────────────────────────────

const TOKEN_KEY = 'pointbunny_timeclock_token';
const BIZ_KEY   = 'pointbunny_timeclock_biz';

const checkDeviceRegistration = async () => {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored) return false;

  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, timeclock_token')
    .eq('timeclock_token', stored)
    .maybeSingle();

  if (error || !data) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(BIZ_KEY);
    return false;
  }

  localStorage.setItem(BIZ_KEY, JSON.stringify({ id: data.id, name: data.name }));
  return true;
};

const handleActivate = async () => {
  const code = $('tcActivateInput')?.value.trim().toUpperCase();
  hide('tcActivateError');
  if (!code || code.length < 4) return;

  const btn = $('tcActivateBtn');
  btn.disabled = true;
  btn.textContent = 'Checking…';

  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, timeclock_token')
    .eq('timeclock_token', code)
    .maybeSingle();

  if (error || !data) {
    show('tcActivateError');
    btn.disabled = false;
    btn.textContent = 'Activate';
    return;
  }

  localStorage.setItem(TOKEN_KEY, code);
  localStorage.setItem(BIZ_KEY, JSON.stringify({ id: data.id, name: data.name }));
  loadLoginScreen();
};

// ── Login ─────────────────────────────────────────────────────────────────────

const loadLoginScreen = () => {
  const biz = JSON.parse(localStorage.getItem(BIZ_KEY) || 'null');
  const bizNameEl = $('tcBusinessName');
  if (bizNameEl) bizNameEl.textContent = biz?.name ?? '';
  showScreen('Login');
  $('tcEmail')?.focus();
};

const handleLogin = async () => {
  const email    = $('tcEmail')?.value.trim();
  const password = $('tcPassword')?.value;
  hide('tcLoginError');

  const btn = $('tcLoginBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    show('tcLoginError');
    btn.disabled = false;
    btn.textContent = 'Sign In';
    return;
  }

  const biz = JSON.parse(localStorage.getItem(BIZ_KEY) || 'null');
  if (!biz) { await supabase.auth.signOut(); show('tcLoginError'); btn.disabled = false; btn.textContent = 'Sign In'; return; }

  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .select('id, first_name, last_name, business_id, pin, is_active')
    .eq('user_id', authData.user.id)
    .eq('business_id', biz.id)
    .maybeSingle();

  if (staffRow && staffRow.is_active === false) {
    $('tcLoginError').textContent = 'Your account has been deactivated. Please contact your business owner.';
    show('tcLoginError');
    await supabase.auth.signOut();
    btn.disabled = false;
    btn.textContent = 'Sign In';
    return;
  }

  if (staffError || !staffRow) {
    $('tcLoginError').textContent = 'Staff record not found for this business.';
    show('tcLoginError');
    await supabase.auth.signOut();
    btn.disabled = false;
    btn.textContent = 'Sign In';
    return;
  }

  _staffRecord = { id: staffRow.id, firstName: staffRow.first_name, lastName: staffRow.last_name, businessId: staffRow.business_id, pin: staffRow.pin ?? null, email: authData.user.email };
  await loadShiftScreen();
};

// ── Shift screen ──────────────────────────────────────────────────────────────

const loadShiftScreen = async () => {
  if (!_staffRecord.pin) {
    showPinSetup(() => loadShiftScreen());
    return;
  }

  showScreen('Shift');

  const rawName  = `${_staffRecord.firstName ?? ''} ${_staffRecord.lastName ?? ''}`.trim();
  const fullName = rawName || _staffRecord.email?.split('@')[0]?.replace(/[._-]/g, ' ') || 'Staff';
  const initials = fullName.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
  const color    = avatarColor(fullName);

  const avatarEl = $('tcAvatar');
  avatarEl.textContent      = initials;
  avatarEl.style.background = color;
  $('tcStaffName').textContent = fullName;

  await refreshShiftState();
};

const refreshShiftState = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, clocked_in_at, clocked_out_at')
    .eq('staff_id', _staffRecord.id)
    .gte('clocked_in_at', todayStart.toISOString())
    .is('clocked_out_at', null)
    .order('clocked_in_at', { ascending: false })
    .limit(1);

  _shift = shifts?.[0] ? { id: shifts[0].id, clockedInAt: shifts[0].clocked_in_at } : null;
  _activeBreak = null;

  if (_shift) {
    const { data: breaks } = await supabase
      .from('shift_breaks')
      .select('id, started_at')
      .eq('shift_id', _shift.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1);
    _activeBreak = breaks?.[0] ? { id: breaks[0].id, startedAt: breaks[0].started_at } : null;
  }

  renderShiftUI();
};

const renderShiftUI = () => {
  clearInterval(_timerHandle);

  const actionsEl   = $('tcActions');
  const timerBlock  = $('tcTimerBlock');
  const timerEl     = $('tcTimerDisplay');
  const timerLabel  = $('tcTimerLabel');
  const statusEl    = $('tcShiftStatus');
  const summaryEl   = $('tcSummary');

  hide('tcSummary');
  show('tcTimerBlock');
  timerEl.classList.remove('tc-timer--break');

  if (!_shift) {
    // Not clocked in
    statusEl.textContent = 'Not clocked in';
    timerBlock.style.display = 'none';
    actionsEl.innerHTML = `<button class="tc-btn tc-btn--primary" id="tcClockInBtn" type="button">Clock In</button>`;
    $('tcClockInBtn').addEventListener('click', handleClockIn);

  } else if (_activeBreak) {
    // On break
    timerBlock.style.display = '';
    statusEl.textContent = `On break since ${formatTime(_activeBreak.startedAt)}`;
    timerEl.classList.add('tc-timer--break');
    timerLabel.textContent = 'Break time';

    const tick = () => timerEl.textContent = formatDuration(Date.now() - new Date(_activeBreak.startedAt));
    tick();
    _timerHandle = setInterval(tick, 1000);

    actionsEl.innerHTML = `<button class="tc-btn tc-btn--primary" id="tcResumeBtn" type="button">Resume</button>`;
    $('tcResumeBtn').addEventListener('click', handleResume);

  } else {
    // Clocked in, working
    timerBlock.style.display = '';
    statusEl.textContent = `Clocked in at ${formatTime(_shift.clockedInAt)}`;
    timerLabel.textContent = 'Time on shift';

    const tick = () => timerEl.textContent = formatDuration(Date.now() - new Date(_shift.clockedInAt));
    tick();
    _timerHandle = setInterval(tick, 1000);

    actionsEl.innerHTML = `
      <button class="tc-btn tc-btn--break" id="tcBreakBtn" type="button">Take a Break</button>
      <button class="tc-btn tc-btn--danger" id="tcClockOutBtn" type="button">Clock Out</button>
    `;
    $('tcBreakBtn').addEventListener('click', handleBreak);
    $('tcClockOutBtn').addEventListener('click', handleClockOut);
  }
};

// ── Actions ───────────────────────────────────────────────────────────────────

const handleClockIn = async () => {
  const btn = $('tcClockInBtn');
  btn.disabled = true;
  btn.textContent = 'Clocking in…';

  const { data, error } = await supabase
    .from('shifts')
    .insert({ business_id: _staffRecord.businessId, staff_id: _staffRecord.id, clocked_in_at: new Date().toISOString() })
    .select('id, clocked_in_at')
    .single();

  if (error) { btn.disabled = false; btn.textContent = 'Clock In'; return; }
  _shift = { id: data.id, clockedInAt: data.clocked_in_at };
  _activeBreak = null;
  renderShiftUI();
};

const handleBreak = async () => {
  const btn = $('tcBreakBtn');
  btn.disabled = true;
  btn.textContent = 'Starting break…';

  const { data, error } = await supabase
    .from('shift_breaks')
    .insert({ shift_id: _shift.id, started_at: new Date().toISOString() })
    .select('id, started_at')
    .single();

  if (error) { btn.disabled = false; btn.textContent = 'Take a Break'; return; }
  _activeBreak = { id: data.id, startedAt: data.started_at };
  renderShiftUI();
};

const handleResume = async () => {
  const btn = $('tcResumeBtn');
  btn.disabled = true;
  btn.textContent = 'Resuming…';

  const { error } = await supabase
    .from('shift_breaks')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', _activeBreak.id);

  if (error) { btn.disabled = false; btn.textContent = 'Resume'; return; }
  _activeBreak = null;
  renderShiftUI();
};

const handleClockOut = () => {
  showClockOutConfirm(async () => {
    const btn = $('tcClockOutBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Clocking out…'; }

    const now = new Date().toISOString();

    if (_activeBreak) {
      await supabase.from('shift_breaks').update({ ended_at: now }).eq('id', _activeBreak.id);
    }

    const { error } = await supabase
      .from('shifts')
      .update({ clocked_out_at: now })
      .eq('id', _shift.id);

    if (error) {
      if (btn) { btn.disabled = false; btn.textContent = 'Clock Out'; }
      return;
    }

    clearInterval(_timerHandle);
    await showClockOutSummary(now);
  });
};

// ── Clock-out confirmation ────────────────────────────────────────────────────

const showClockOutConfirm = (onConfirmed) => {
  if (_staffRecord.pin) {
    showPinPad(onConfirmed);
  } else {
    showPasswordConfirm(onConfirmed);
  }
};

const showPinPad = (onConfirmed) => {
  const PIN_LEN = _staffRecord.pin.length;
  let entered = '';

  const overlay = document.createElement('div');
  overlay.className = 'tc-pinpad-overlay';

  const dots = Array.from({ length: PIN_LEN }, () => `<div class="tc-pinpad-dot"></div>`).join('');
  const bsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>`;

  overlay.innerHTML = `
    <div class="tc-pinpad-card">
      <h2 class="tc-pinpad-title">Confirm Clock Out</h2>
      <p class="tc-pinpad-sub">Enter your PIN</p>
      <div class="tc-pinpad-dots" id="tcPinpadDots">${dots}</div>
      <p class="tc-pinpad-error hidden" id="tcPinpadError">Incorrect PIN. Try again.</p>
      <div class="tc-pinpad-grid">
        ${[1,2,3,4,5,6,7,8,9].map(n =>
          `<button class="tc-pinpad-key" data-key="${n}" type="button">${n}</button>`
        ).join('')}
        <button class="tc-pinpad-key tc-pinpad-key--action" data-key="back" type="button">${bsIcon}</button>
        <button class="tc-pinpad-key" data-key="0" type="button">0</button>
        <button class="tc-pinpad-key tc-pinpad-key--confirm" data-key="confirm" type="button">✓</button>
      </div>
      <button class="tc-pinpad-cancel" id="tcPinpadCancel" type="button">Cancel</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const dotsEl = () => overlay.querySelectorAll('.tc-pinpad-dot');
  const updateDots = () => dotsEl().forEach((d, i) => d.classList.toggle('tc-pinpad-dot--filled', i < entered.length));

  const tryConfirm = () => {
    if (entered === _staffRecord.pin) {
      overlay.remove();
      onConfirmed();
    } else {
      const errEl = overlay.querySelector('#tcPinpadError');
      errEl?.classList.remove('hidden');
      const dotsWrap = overlay.querySelector('#tcPinpadDots');
      dotsWrap?.classList.add('tc-pinpad-dots--shake');
      setTimeout(() => dotsWrap?.classList.remove('tc-pinpad-dots--shake'), 500);
      entered = '';
      updateDots();
    }
  };

  overlay.addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (!key) return;
    if (key === 'back') {
      entered = entered.slice(0, -1);
      overlay.querySelector('#tcPinpadError')?.classList.add('hidden');
    } else if (key === 'confirm') {
      tryConfirm();
    } else {
      if (entered.length < PIN_LEN) {
        entered += key;
        overlay.querySelector('#tcPinpadError')?.classList.add('hidden');
        if (entered.length === PIN_LEN) tryConfirm();
      }
    }
    updateDots();
  });

  overlay.querySelector('#tcPinpadCancel')?.addEventListener('click', () => overlay.remove());
};

const showPasswordConfirm = (onConfirmed) => {
  const overlay = document.createElement('div');
  overlay.className = 'tc-pinpad-overlay';
  overlay.innerHTML = `
    <div class="tc-pinpad-card">
      <h2 class="tc-pinpad-title">Confirm Clock Out</h2>
      <p class="tc-pinpad-sub">Enter your password to confirm</p>
      <div class="tc-field" style="width:100%">
        <label for="tcConfirmPassword">Password</label>
        <input type="password" id="tcConfirmPassword" placeholder="••••••••" autocomplete="current-password" />
      </div>
      <p class="tc-pinpad-error hidden" id="tcConfirmError">Incorrect password.</p>
      <button class="tc-btn tc-btn--danger" id="tcConfirmBtn" type="button">Clock Out</button>
      <button class="tc-pinpad-cancel" id="tcConfirmCancel" type="button">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#tcConfirmPassword')?.focus();

  const tryConfirm = async () => {
    const password = overlay.querySelector('#tcConfirmPassword')?.value;
    const btn = overlay.querySelector('#tcConfirmBtn');
    btn.disabled = true; btn.textContent = 'Verifying…';
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (error) {
      overlay.querySelector('#tcConfirmError')?.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Clock Out';
      return;
    }
    overlay.remove();
    onConfirmed();
  };

  overlay.querySelector('#tcConfirmBtn')?.addEventListener('click', tryConfirm);
  overlay.querySelector('#tcConfirmPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter') tryConfirm(); });
  overlay.querySelector('#tcConfirmCancel')?.addEventListener('click', () => overlay.remove());
};

// ── First-login PIN setup ─────────────────────────────────────────────────────

const showPinSetup = (onComplete) => {
  const PIN_LEN = 4;
  let step = 1; // 1 = create, 2 = confirm
  let firstPin = '';
  let entered = '';

  const overlay = document.createElement('div');
  overlay.className = 'tc-pinpad-overlay';

  const bsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>`;

  const renderCard = () => {
    const title = step === 1 ? 'Create Your PIN' : 'Confirm Your PIN';
    const sub   = step === 1 ? "You'll use this to confirm clock-outs" : 'Re-enter your PIN to confirm';
    const dots  = Array.from({ length: PIN_LEN }, () => `<div class="tc-pinpad-dot"></div>`).join('');
    overlay.innerHTML = `
      <div class="tc-pinpad-card">
        <h2 class="tc-pinpad-title">${title}</h2>
        <p class="tc-pinpad-sub">${sub}</p>
        <div class="tc-pinpad-dots" id="tcSetupDots">${dots}</div>
        <p class="tc-pinpad-error hidden" id="tcSetupError"></p>
        <div class="tc-pinpad-grid">
          ${[1,2,3,4,5,6,7,8,9].map(n =>
            `<button class="tc-pinpad-key" data-key="${n}" type="button">${n}</button>`
          ).join('')}
          <button class="tc-pinpad-key tc-pinpad-key--action" data-key="back" type="button">${bsIcon}</button>
          <button class="tc-pinpad-key" data-key="0" type="button">0</button>
          <button class="tc-pinpad-key tc-pinpad-key--confirm" data-key="confirm" type="button">✓</button>
        </div>
      </div>
    `;
  };

  const updateDots = () => {
    overlay.querySelectorAll('.tc-pinpad-dot').forEach((d, i) => {
      d.classList.toggle('tc-pinpad-dot--filled', i < entered.length);
    });
  };

  const showError = (msg) => {
    const dotsWrap = overlay.querySelector('#tcSetupDots');
    const errEl    = overlay.querySelector('#tcSetupError');
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    dotsWrap?.classList.add('tc-pinpad-dots--shake');
    setTimeout(() => dotsWrap?.classList.remove('tc-pinpad-dots--shake'), 400);
  };

  const tryAdvance = async () => {
    if (entered.length < PIN_LEN) return;

    if (step === 1) {
      firstPin = entered;
      entered = '';
      step = 2;
      renderCard();
      return;
    }

    if (entered !== firstPin) {
      firstPin = '';
      entered = '';
      step = 1;
      renderCard();
      requestAnimationFrame(() => showError("PINs don't match. Try again."));
      return;
    }

    const confirmKey = overlay.querySelector('[data-key="confirm"]');
    if (confirmKey) { confirmKey.disabled = true; confirmKey.textContent = '…'; }

    const { error } = await supabase.from('staff').update({ pin: firstPin }).eq('id', _staffRecord.id);

    if (error) {
      if (confirmKey) { confirmKey.disabled = false; confirmKey.textContent = '✓'; }
      showError('Could not save PIN. Try again.');
      entered = '';
      return;
    }

    _staffRecord.pin = firstPin;
    overlay.remove();
    onComplete();
  };

  overlay.addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (!key) return;
    e.stopPropagation();

    if (key === 'back') {
      entered = entered.slice(0, -1);
      overlay.querySelector('#tcSetupError')?.classList.add('hidden');
    } else if (key === 'confirm') {
      tryAdvance();
      return;
    } else {
      if (entered.length < PIN_LEN) {
        entered += key;
        overlay.querySelector('#tcSetupError')?.classList.add('hidden');
        if (entered.length === PIN_LEN) { updateDots(); tryAdvance(); return; }
      }
    }
    updateDots();
  });

  renderCard();
  document.body.appendChild(overlay);
};

const showClockOutSummary = async (clockedOutAt) => {
  // Fetch full shift + breaks for summary
  const { data: breaks } = await supabase
    .from('shift_breaks')
    .select('started_at, ended_at')
    .eq('shift_id', _shift.id);

  const shiftMs   = new Date(clockedOutAt) - new Date(_shift.clockedInAt);
  const breakMs   = (breaks ?? []).reduce((sum, b) => {
    const end = b.ended_at ? new Date(b.ended_at) : new Date(clockedOutAt);
    return sum + (end - new Date(b.started_at));
  }, 0);
  const workedMs  = shiftMs - breakMs;

  $('tcShiftStatus').textContent = 'Shift complete';
  $('tcTimerBlock').style.display = 'none';
  $('tcActions').innerHTML = '';

  const summaryEl = $('tcSummary');
  summaryEl.innerHTML = `
    <div class="tc-summary-row"><span>Clocked in</span><span>${formatTime(_shift.clockedInAt)}</span></div>
    <div class="tc-summary-row"><span>Clocked out</span><span>${formatTime(clockedOutAt)}</span></div>
    <div class="tc-summary-row"><span>Break time</span><span>${formatHM(breakMs)}</span></div>
    <div class="tc-summary-row tc-summary-total"><span>Time worked</span><span>${formatHM(workedMs)}</span></div>
  `;
  show('tcSummary');

  _shift       = null;
  _activeBreak = null;
};

// ── Sign out ──────────────────────────────────────────────────────────────────

const handleSignOut = async () => {
  clearInterval(_timerHandle);
  _staffRecord = null;
  _shift       = null;
  _activeBreak = null;
  await supabase.auth.signOut();
  $('tcEmail').value    = '';
  $('tcPassword').value = '';
  loadLoginScreen();
};

// ── Init ──────────────────────────────────────────────────────────────────────

const init = async () => {
  showScreen('Loading');

  // Wire static buttons
  $('tcActivateBtn')?.addEventListener('click', handleActivate);
  $('tcActivateInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleActivate(); });
  $('tcLoginBtn')?.addEventListener('click', handleLogin);
  $('tcPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  $('tcSignOutBtn')?.addEventListener('click', handleSignOut);

  // Check for existing session first
  const { data: { session } } = await supabase.auth.getSession();

  const registered = await checkDeviceRegistration();
  if (!registered) { showScreen('Activate'); return; }

  if (session) {
    const biz = JSON.parse(localStorage.getItem(BIZ_KEY) || 'null');
    if (biz) {
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id, first_name, last_name, business_id, pin')
        .eq('user_id', session.user.id)
        .eq('business_id', biz.id)
        .eq('is_active', true)
        .maybeSingle();

      if (staffRow) {
        _staffRecord = { id: staffRow.id, firstName: staffRow.first_name, lastName: staffRow.last_name, businessId: staffRow.business_id, pin: staffRow.pin ?? null, email: session.user.email };
        await loadShiftScreen();
        return;
      }
    }
    await supabase.auth.signOut();
  }

  loadLoginScreen();
};

init();
