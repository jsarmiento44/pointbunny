const _todayDateValue  = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const _todayMonthValue = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const _todayYear       = () => new Date().getFullYear();

const _currentWeekValue = () => {
  const now = new Date();
  const diffToMon = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  return `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
};

const _prevNextValue = (type, value, delta) => {
  if (type === 'week') {
    const d = new Date(value + 'T00:00:00');
    d.setDate(d.getDate() + delta * 7);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  if (type === 'month') {
    const [y, m] = value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  if (type === 'year') {
    return String(parseInt(value) + delta);
  }
  return value;
};

const _isFutureValue = (type, value) => {
  if (type === 'week')  return value >= _currentWeekValue();
  if (type === 'month') return value >= _todayMonthValue();
  if (type === 'year')  return parseInt(value) >= _todayYear();
  return false;
};

class StaffView {
  _panel      = document.querySelector('#staffPanel');
  _list       = document.querySelector('#staffList');
  _rolesEl    = document.querySelector('#staffRolesContent');
  _payrollEl  = document.querySelector('#staffPayrollContent');
  _formModal  = document.querySelector('#inviteStaffModal');

  open(canManage = false) {
    this._panel.classList.remove('hidden', 'cashflow-exiting');
    const inviteBtn = this._panel.querySelector('#inviteStaffBtn');
    if (inviteBtn) inviteBtn.classList.toggle('hidden', !canManage);
    this._switchTab('members');
  }

  _payrollHandler = null;

  _switchTab(tab) {
    this._panel.querySelectorAll('.staff-tab').forEach(btn => {
      btn.classList.toggle('staff-tab--active', btn.dataset.tab === tab);
    });
    this._list.classList.toggle('hidden', tab !== 'members');
    this._rolesEl.classList.toggle('hidden', tab !== 'roles');
    this._payrollEl.classList.toggle('hidden', tab !== 'payroll');
    if (tab === 'payroll' && this._payrollHandler) {
      this._payrollHandler();
    }
  }

  _addHandlerPayrollTab(handler) {
    this._payrollHandler = handler;
  }

  _periodChangeHandler = null;

  _addHandlerTimesheetPeriod(handler) {
    this._periodChangeHandler = handler;
  }

  renderTimesheets(shifts, staff, canEdit = false, periodMeta = { type: 'week', value: '', label: '' }) {
    const AVATAR_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];

    const workedMs = (shift) => {
      if (!shift.clockedOutAt) return null;
      const total = new Date(shift.clockedOutAt) - new Date(shift.clockedInAt);
      const breakMs = (shift.breaks ?? []).reduce((s, b) => {
        if (!b.endedAt) return s;
        return s + (new Date(b.endedAt) - new Date(b.startedAt));
      }, 0);
      return Math.max(0, total - breakMs);
    };

    const fmtTime = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const fmtDate = iso => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const fmtHM   = ms  => {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const byStaff = new Map();
    for (const sh of shifts) {
      if (!byStaff.has(sh.staffId)) byStaff.set(sh.staffId, []);
      byStaff.get(sh.staffId).push(sh);
    }

    // Single pass: collect all group data
    const groups = [];
    let colorIdx = 0;
    for (const [staffId, shs] of byStaff) {
      const s        = staff.find(m => m.id === staffId);
      const name     = s ? `${s.firstName} ${s.lastName}`.trim() : shs[0]?.staffName ?? '?';
      const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      const color    = AVATAR_COLORS[colorIdx++ % AVATAR_COLORS.length];
      const totalMs  = shs.reduce((acc, sh) => { const ms = workedMs(sh); return ms != null ? acc + ms : acc; }, 0);
      const rate     = s?.hourlyRate ?? shs[0]?.hourlyRate ?? null;
      const gross    = rate !== null ? (totalMs / 3600000 * rate) : null;
      groups.push({ staffId, shs, name, initials, color, totalMs, rate, gross });
    }

    // Summary card
    let summaryHtml = '';
    if (groups.length > 0) {
      const rows = groups.map(g => `
        <div class="payroll-summary-row">
          <div class="payroll-summary-avatar" style="background:${g.color}">${g.initials}</div>
          <div class="payroll-summary-name">${g.name}</div>
          <div class="payroll-summary-hrs">${fmtHM(g.totalMs)}</div>
          ${g.gross !== null ? `<div class="payroll-summary-gross">$${g.gross.toFixed(2)}</div>` : '<div></div>'}
        </div>`).join('');
      summaryHtml = `<div class="payroll-summary-card">${rows}</div>`;
    }

    // Detailed groups
    let groupsHtml = '';
    if (groups.length === 0) {
      groupsHtml = `<p class="staff-empty" style="padding:24px 0">No shifts recorded for this period.</p>`;
    } else {
      groupsHtml = groups.map(g => {
        const shiftRows = g.shs.map(sh => {
          const ms        = workedMs(sh);
          const isOpen    = !sh.clockedOutAt;
          const openBadge = isOpen ? `<span class="payroll-badge-active">Active</span>` : '';

          const allBreaks = sh.breaks ?? [];
          const breakSubRows = allBreaks.map(b => {
            const bMs  = b.endedAt ? new Date(b.endedAt) - new Date(b.startedAt) : null;
            return `
              <div class="payroll-break-row">
                <div class="payroll-break-label">Break</div>
                <div>${fmtTime(b.startedAt)} → ${b.endedAt ? fmtTime(b.endedAt) : '–'}</div>
                <div class="payroll-break-dur">${bMs !== null ? fmtHM(bMs) : '–'}</div>
                <div></div>
              </div>`;
          }).join('');

          return `
            <div class="payroll-shift-entry">
              <div class="payroll-shift-row">
                <div class="payroll-shift-date">${fmtDate(sh.clockedInAt)}</div>
                <div class="payroll-shift-times">
                  ${fmtTime(sh.clockedInAt)} → ${sh.clockedOutAt ? fmtTime(sh.clockedOutAt) : '–'}
                  ${openBadge}
                </div>
                <div class="payroll-shift-hrs">${ms !== null ? fmtHM(ms) : '–'}</div>
                ${canEdit ? `<button class="payroll-edit-btn" data-id="${sh.id}" type="button">Edit</button>` : ''}
              </div>
              ${breakSubRows}
            </div>`;
        }).join('');
        const rateStr  = g.rate !== null ? `· $${Number(g.rate).toFixed(2)}/hr` : '';
        const grossStr = g.gross !== null ? `· <span class="payroll-group-gross">$${g.gross.toFixed(2)} gross</span>` : '';
        return `
          <div class="payroll-group">
            <div class="payroll-group-header">
              <div class="payroll-group-avatar" style="background:${g.color}">${g.initials}</div>
              <div class="payroll-group-name">${g.name}</div>
              <div class="payroll-group-meta">${fmtHM(g.totalMs)} ${rateStr} ${grossStr}</div>
            </div>
            <div class="payroll-group-shifts">${shiftRows}</div>
          </div>`;
      }).join('');
    }

    const { type, value, label } = periodMeta;

    const exportCsv = () => {
      const rows = [];
      for (const g of groups) {
        for (const sh of g.shs) {
          const ms     = workedMs(sh);
          const grossV = ms !== null && g.rate !== null ? (ms / 3600000 * g.rate) : null;
          const bMs    = (sh.breaks ?? []).reduce((s, b) => {
            if (!b.endedAt) return s;
            return s + (new Date(b.endedAt) - new Date(b.startedAt));
          }, 0);
          rows.push([
            g.name,
            fmtDate(sh.clockedInAt),
            fmtTime(sh.clockedInAt),
            sh.clockedOutAt ? fmtTime(sh.clockedOutAt) : '',
            bMs > 0 ? fmtHM(bMs) : '',
            ms !== null ? fmtHM(ms) : '',
            g.rate !== null ? `$${Number(g.rate).toFixed(2)}` : '',
            grossV !== null ? `$${grossV.toFixed(2)}` : '',
          ]);
        }
      }
      rows.unshift(['Staff', 'Date', 'Clock In', 'Clock Out', 'Break', 'Hours Worked', 'Hourly Rate', 'Gross Pay']);
      rows.unshift([`Pointy Timesheets – ${label}`]);
      const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const slug = label.replace(/\s+[–-]\s+|[^a-z0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `timesheets-${slug}.csv`; a.click();
      URL.revokeObjectURL(url);
    };

    const exportPdf = () => {
      const sumRows = groups.map(g => `
        <tr>
          <td>${g.name}</td>
          <td class="hrs">${fmtHM(g.totalMs)}</td>
          <td>${g.rate !== null ? `$${Number(g.rate).toFixed(2)}/hr` : '–'}</td>
          <td>${g.gross !== null ? `$${g.gross.toFixed(2)}` : '–'}</td>
        </tr>`).join('');

      const details = groups.map(g => {
        const rateCol    = g.rate !== null;
        const shiftRows  = g.shs.map(sh => {
          const ms    = workedMs(sh);
          const grossV = ms !== null && g.rate !== null ? (ms / 3600000 * g.rate) : null;
          const bMs   = (sh.breaks ?? []).reduce((s, b) => {
            if (!b.endedAt) return s;
            return s + (new Date(b.endedAt) - new Date(b.startedAt));
          }, 0);
          return `<tr>
            <td>${fmtDate(sh.clockedInAt)}</td>
            <td>${fmtTime(sh.clockedInAt)}</td>
            <td>${sh.clockedOutAt ? fmtTime(sh.clockedOutAt) : '–'}</td>
            <td>${bMs > 0 ? fmtHM(bMs) : '–'}</td>
            <td class="hrs">${ms !== null ? fmtHM(ms) : '–'}</td>
            ${rateCol ? `<td>${grossV !== null ? `$${grossV.toFixed(2)}` : '–'}</td>` : ''}
          </tr>`;
        }).join('');
        return `
          <h2>${g.name}</h2>
          <table>
            <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Break</th><th>Hours</th>${rateCol ? '<th>Gross Pay</th>' : ''}</tr></thead>
            <tbody>${shiftRows}</tbody>
          </table>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Timesheets – ${label}</title>
        <style>
          *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111;font-size:14px}
          h1{font-size:1.3rem;margin:0 0 2px}
          .period{color:#555;font-size:.85rem;margin-bottom:20px}
          h2{font-size:.95rem;margin:20px 0 6px;border-bottom:2px solid #e5e7eb;padding-bottom:4px}
          table{width:100%;border-collapse:collapse;margin-bottom:8px}
          th{text-align:left;font-size:.78rem;text-transform:uppercase;letter-spacing:.03em;color:#666;border-bottom:1.5px solid #e5e7eb;padding:5px 8px}
          td{padding:7px 8px;font-size:.85rem;border-bottom:1px solid #f0f0f0}
          .hrs{color:#16a34a;font-weight:700}
          @media print{body{padding:12px}}
        </style></head><body>
        <h1>Timesheets</h1>
        <p class="period">${label}</p>
        ${groups.length > 0 ? `
          <h2>Summary</h2>
          <table><thead><tr><th>Staff</th><th>Total Hours</th><th>Rate</th><th>Gross Pay</th></tr></thead>
          <tbody>${sumRows}</tbody></table>
          ${details}` : '<p>No shifts recorded for this period.</p>'}
      </body></html>`;

      const win = window.open('', '_blank', 'width=820,height=900');
      if (!win) { alert('Allow pop-ups to export PDF.'); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    };

    const isCurrent  = type !== 'custom' && _isFutureValue(type, value);
    const chipLabel  = type === 'month' ? 'This month' : type === 'year' ? 'This year' : 'This week';
    const prevSvg    = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    const nextSvg    = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

    const navHtml = type === 'custom'
      ? `<div class="payroll-period-custom">
          <input type="date" id="payrollCustomFrom" class="payroll-period-input" value="${value?.from ?? ''}" />
          <span class="payroll-period-sep">–</span>
          <input type="date" id="payrollCustomTo" class="payroll-period-input" value="${value?.to ?? ''}" />
          <button id="payrollCustomApply" class="btn primary" type="button" style="padding:4px 14px;font-size:0.82rem">Apply</button>
        </div>`
      : `<div class="payroll-period-nav">
          <button class="payroll-nav-btn" id="payrollPrev" type="button" aria-label="Previous">${prevSvg}</button>
          <span class="payroll-period-label">${label}</span>
          ${!isCurrent ? `<button class="payroll-period-chip" id="payrollToday" type="button">${chipLabel}</button>` : ''}
          <button class="payroll-nav-btn${isCurrent ? ' payroll-nav-btn--disabled' : ''}" id="payrollNext" type="button" aria-label="Next" ${isCurrent ? 'disabled' : ''}>${nextSvg}</button>
        </div>`;

    const dlIcon    = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    const chevDown  = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

    this._payrollEl.innerHTML = `
      <div class="payroll-header">
        <h3 class="payroll-title">Timesheets</h3>
        <div class="payroll-header-actions">
          <div class="payroll-export-menu" id="payrollExportMenu">
            <button class="payroll-export-btn" id="payrollExportToggle" type="button">
              ${dlIcon} Export ${chevDown}
            </button>
            <div class="payroll-export-dropdown hidden" id="payrollExportDropdown">
              <button class="payroll-export-option" id="payrollExportPdf" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                PDF
              </button>
              <button class="payroll-export-option" id="payrollExportCsv" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                CSV / Excel
              </button>
            </div>
          </div>
          ${canEdit ? `<button class="btn primary" id="payrollAddShiftBtn" type="button">+ Add Shift</button>` : ''}
        </div>
      </div>
      <div class="payroll-tc-card" id="payrollOpenTimeclock" role="button" tabindex="0">
        <div class="payroll-tc-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="payroll-tc-body">
          <div class="payroll-tc-title">
            Open Time Clock
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>
          <div class="payroll-tc-desc">Staff use this page to clock in and out. Opens in a new tab — works on any tablet or shared device.</div>
        </div>
      </div>
      <details class="payroll-info-card">
        <summary class="payroll-info-summary">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          How does the Time Clock work?
          <svg class="payroll-info-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <ol class="payroll-info-steps">
          <li><strong>Open Time Clock</strong> — Click the <em>Time Clock</em> button above to open the clock-in page in a new tab. This is the page staff use to clock in and out.</li>
          <li><strong>Activate a device</strong> — On first use, the page asks for an activation code. Go to <strong>Settings → Business → Time Clock Device</strong>, click <em>Generate Code</em>, then enter that code on the device.</li>
          <li><strong>Staff sign in</strong> — Each staff member logs in with their own account (not the POS owner account). They can clock in, take breaks, and clock out.</li>
          <li><strong>Shifts appear here</strong> — Every clock-in/out is recorded as a shift. Use the period picker to browse history. Admins can also manually add or edit shifts with <em>+ Add Shift</em>.</li>
        </ol>
      </details>
      <div class="payroll-period-bar">
        <div class="payroll-period-tabs">
          ${['week','month','year','custom'].map(t =>
            `<button class="payroll-period-tab${type === t ? ' payroll-period-tab--active' : ''}" data-ptype="${t}" type="button">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`
          ).join('')}
        </div>
        ${navHtml}
      </div>
      ${summaryHtml}
      ${groupsHtml}
    `;

    this._payrollEl.querySelectorAll('.payroll-period-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const newType = btn.dataset.ptype;
        if (newType === type) return;
        let newValue;
        if (newType === 'week')       newValue = _currentWeekValue();
        else if (newType === 'month') newValue = _todayMonthValue();
        else if (newType === 'year')  newValue = String(_todayYear());
        else                          newValue = { from: _todayDateValue(), to: _todayDateValue() };
        this._periodChangeHandler?.(newType, newValue);
      });
    });

    document.getElementById('payrollPrev')?.addEventListener('click', () => {
      this._periodChangeHandler?.(type, _prevNextValue(type, value, -1));
    });
    document.getElementById('payrollNext')?.addEventListener('click', () => {
      if (!isCurrent) this._periodChangeHandler?.(type, _prevNextValue(type, value, 1));
    });
    document.getElementById('payrollToday')?.addEventListener('click', () => {
      const curVal = type === 'month' ? _todayMonthValue() : type === 'year' ? String(_todayYear()) : _currentWeekValue();
      this._periodChangeHandler?.(type, curVal);
    });
    document.getElementById('payrollCustomApply')?.addEventListener('click', () => {
      const from = document.getElementById('payrollCustomFrom')?.value;
      const to   = document.getElementById('payrollCustomTo')?.value;
      if (!from || !to) return;
      if (from > to) { alert('Start date must be before end date.'); return; }
      this._periodChangeHandler?.('custom', { from, to });
    });

    document.getElementById('payrollOpenTimeclock')?.addEventListener('click', () => {
      window.open('timeclock.html', '_blank');
    });

    const exportToggle   = document.getElementById('payrollExportToggle');
    const exportDropdown = document.getElementById('payrollExportDropdown');
    const closeExportMenu = () => {
      exportDropdown?.classList.add('hidden');
      exportToggle?.classList.remove('payroll-export-btn--open');
    };
    exportToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = exportDropdown.classList.contains('hidden');
      exportDropdown.classList.toggle('hidden');
      exportToggle.classList.toggle('payroll-export-btn--open', opening);
      if (opening) setTimeout(() => document.addEventListener('click', closeExportMenu, { once: true }), 0);
    });
    document.getElementById('payrollExportPdf')?.addEventListener('click', (e) => {
      e.stopPropagation(); closeExportMenu(); exportPdf();
    });
    document.getElementById('payrollExportCsv')?.addEventListener('click', (e) => {
      e.stopPropagation(); closeExportMenu(); exportCsv();
    });

    if (canEdit) {
      document.getElementById('payrollAddShiftBtn')?.addEventListener('click', () => this._showShiftModal(null, staff));
      this._payrollEl.querySelectorAll('.payroll-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sh = shifts.find(s => s.id === btn.dataset.id);
          if (sh) this._showShiftModal(sh, staff);
        });
      });
    }
  }

  _saveRateHandler = null;

  _addHandlerSaveHourlyRate(handler) {
    this._saveRateHandler = handler;
  }

  _showShiftModal(shift, staff) {
    if (document.getElementById('shiftEditModal')) return;
    const isEdit = !!shift;
    const modal = document.createElement('div');
    modal.className = 'cashier-picker-overlay';
    modal.id = 'shiftEditModal';
    modal.style.zIndex = '99999';

    const toLocalInput = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const staffOptions = staff.map(s => `<option value="${s.id}" ${shift?.staffId === s.id ? 'selected' : ''}>${s.firstName} ${s.lastName}</option>`).join('');

    modal.innerHTML = `
      <div class="cashier-picker-card" style="max-width:360px;width:calc(100vw - 40px);overflow:hidden">
        <div class="cashier-picker-header">
          <div><h3 class="cashier-picker-title">${isEdit ? 'Edit Shift' : 'Add Shift'}</h3></div>
          <button class="modal-close-btn" data-action="close" type="button">&times;</button>
        </div>
        <div class="edit-field" style="margin-top:8px">
          <label>Staff Member</label>
          <select id="shiftStaffSelect" class="settings-select">${staffOptions}</select>
        </div>
        <div class="edit-field" style="margin-top:10px">
          <label>Clock In</label>
          <input type="datetime-local" id="shiftClockIn" class="settings-input" value="${toLocalInput(shift?.clockedInAt)}" style="width:100%" />
        </div>
        <div class="edit-field" style="margin-top:10px">
          <label>Clock Out</label>
          <input type="datetime-local" id="shiftClockOut" class="settings-input" value="${toLocalInput(shift?.clockedOutAt)}" style="width:100%" />
        </div>
        <div class="edit-field" style="margin-top:10px">
          <label>Note (optional)</label>
          <input type="text" id="shiftNote" class="settings-input" placeholder="e.g. Covered for Maria" value="${shift?.note ?? ''}" />
        </div>
        <div class="adj-form-actions" style="margin-top:16px">
          <button type="button" class="btn" data-action="close">Cancel</button>
          <button type="button" class="btn primary" data-action="save">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll('[data-action="close"]').forEach(b => b.addEventListener('click', close));
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('[data-action="save"]').addEventListener('click', () => {
      const staffId     = document.getElementById('shiftStaffSelect')?.value;
      const clockedInAt = document.getElementById('shiftClockIn')?.value;
      const clockedOutAt= document.getElementById('shiftClockOut')?.value;
      const note        = document.getElementById('shiftNote')?.value.trim();
      if (!clockedInAt) { alert('Clock-in time is required.'); return; }
      close();
      if (this._shiftSaveHandler) this._shiftSaveHandler({
        id:           shift?.id ?? null,
        staffId,
        clockedInAt:  new Date(clockedInAt).toISOString(),
        clockedOutAt: clockedOutAt ? new Date(clockedOutAt).toISOString() : null,
        note,
      });
    });
  }

  _shiftSaveHandler = null;

  _addHandlerSaveShift(handler) {
    this._shiftSaveHandler = handler;
  }

  _addHandlerTabs() {
    this._panel.querySelector('.staff-sidebar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.staff-tab');
      if (!btn) return;
      this._switchTab(btn.dataset.tab);
    });
  }

  close() {
    this._panel.classList.add('cashflow-exiting');
    setTimeout(() => {
      this._panel.classList.add('hidden');
      this._panel.classList.remove('cashflow-exiting');
    }, 220);
  }

  render(staff, canManage = false) {
    this._list.innerHTML = this._generateListMarkup(staff, canManage);
  }

  renderRoles(roles) {
    if (!roles?.length) {
      this._rolesEl.innerHTML = `<p class="staff-empty">No roles defined.</p>`;
      return;
    }
    this._rolesEl.innerHTML = roles.map(r => `
      <div class="staff-role-card">
        <div class="staff-role-card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="staff-role-card-info">
          <div class="staff-role-card-name">${r.name}</div>
          <div class="staff-role-card-desc">${_roleDescription(r.name)}</div>
        </div>
      </div>
    `).join('');

    function _roleDescription(name) {
      const map = {
        Admin:   'Full access — manage staff, menu, sales, and settings.',
        Manager: 'Manage menu and sales. Cannot change staff or settings.',
        Cashier: 'Process sales only.',
      };
      return map[name] ?? 'Custom role.';
    }
  }

  _generateListMarkup(staff, canManage) {
    if (!staff.length)
      return `<li class="staff-empty">No staff members yet. Hit "+ Invite" to add someone.</li>`;

    const AVATAR_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];

    return staff.map((s, i) => {
      const initials = `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase() || '?';
      const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return `
      <li class="staff-item" data-id="${s.id}">
        <div class="staff-avatar" style="background:${color}">${initials}</div>
        <div class="staff-item-info">
          <div class="staff-item-name">${s.firstName} ${s.lastName}${s.isSelf ? ' <span class="staff-you-tag">you</span>' : ''}</div>
          <div class="staff-item-email">${s.email}</div>
        </div>
        <div class="staff-item-meta">
          <span class="staff-role-badge">${s.role}</span>
          <span class="staff-status-badge staff-status-badge--${s.isPending ? 'pending' : 'active'}">
            ${s.isPending ? 'Pending' : 'Active'}
          </span>
        </div>
        ${canManage && !s.isSelf ? `
        <div class="staff-item-actions">
          <button class="staff-action-btn" data-id="${s.id}" data-action="edit" type="button" title="Edit role">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="staff-action-btn staff-action-btn--pin" data-id="${s.id}" data-action="pin" type="button" title="${s.hasPin ? 'Change PIN' : 'Set PIN'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${s.hasPin ? 'Change PIN' : 'Set PIN'}
          </button>
          <button class="staff-action-btn staff-action-btn--remove" data-id="${s.id}" data-action="remove" type="button" title="Remove">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Remove
          </button>
        </div>` : ''}
      </li>`;
    }).join('');
  }

  showInviteForm(roles) {
    const formEl = this._formModal.querySelector('#inviteStaffForm');
    formEl.innerHTML = `
      <button class="modal-close-btn" id="inviteFormCloseBtn" type="button">&times;</button>
      <h2 class="edit-form-title">Invite Staff Member</h2>

      <div class="auth-col-pair">
        <div class="edit-field">
          <label for="inviteFirstName">First name</label>
          <input type="text" id="inviteFirstName" placeholder="Maria" autocomplete="off" />
        </div>
        <div class="edit-field">
          <label for="inviteLastName">Last name</label>
          <input type="text" id="inviteLastName" placeholder="Santos" autocomplete="off" />
        </div>
      </div>

      <div class="edit-field">
        <label for="inviteEmail">Email</label>
        <input type="email" id="inviteEmail" placeholder="staff@example.com" autocomplete="off" />
      </div>

      <div class="edit-field">
        <label for="inviteRole">Role</label>
        <select id="inviteRole" class="settings-select">
          ${roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
        </select>
      </div>

      <p class="settings-section-hint" style="margin-top:8px;">
        They'll need to sign up at your POS using this email address to activate their account.
      </p>

      <div class="adj-form-actions">
        <button type="button" class="btn" id="inviteCancelBtn">Cancel</button>
        <button type="button" class="btn primary" id="inviteSaveBtn">Add Member</button>
      </div>
    `;

    document.getElementById('inviteFormCloseBtn')?.addEventListener('click', () => this.closeForm());
    document.getElementById('inviteCancelBtn')?.addEventListener('click', () => this.closeForm());

    this._formModal.classList.remove('hidden');
    document.getElementById('inviteFirstName')?.focus();
  }

  closeForm() {
    this._formModal.classList.add('hidden');
    this._formModal.querySelector('#inviteStaffForm').innerHTML = '';
  }

  _getInviteData() {
    return {
      firstName: document.getElementById('inviteFirstName')?.value.trim(),
      lastName:  document.getElementById('inviteLastName')?.value.trim(),
      email:     document.getElementById('inviteEmail')?.value.trim(),
      roleId:    document.getElementById('inviteRole')?.value,
    };
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  _addHandlerOpen(handler) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest("[data-action='staff']")) return;
      handler();
    });
  }

  _addHandlerClose(handler) {
    this._panel.querySelector('.staff-back')?.addEventListener('click', () => handler());
    this._formModal.addEventListener('click', (e) => {
      if (e.target === this._formModal) this.closeForm();
    });
  }

  _addHandlerInvite(handler) {
    this._panel.querySelector('#inviteStaffBtn')?.addEventListener('click', () => handler());
  }

  _addHandlerSaveInvite(handler) {
    this._formModal.addEventListener('click', (e) => {
      if (!e.target.closest('#inviteSaveBtn')) return;
      const data = this._getInviteData();
      if (!data.firstName) { alert('Please enter a first name.'); return; }
      if (!data.lastName)  { alert('Please enter a last name.'); return; }
      if (!data.email)     { alert('Please enter an email.'); return; }
      handler(data);
    });
  }

  _addHandlerRemove(handler) {
    this._list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove"]');
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerEditRole(handler) {
    this._list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="edit"]');
      if (!btn) return;
      if (document.getElementById('staffEditRoleModal')) return;
      const staffId = btn.dataset.id;
      handler(staffId);
    });
  }

  showEditRoleModal(staff, roles) {
    const modal = document.createElement('div');
    modal.className = 'cashier-picker-overlay';
    modal.id = 'staffEditRoleModal';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
      <div class="cashier-picker-card" style="max-width:340px;width:calc(100vw - 40px)">
        <div class="cashier-picker-header">
          <div>
            <h3 class="cashier-picker-title">Edit Staff</h3>
            <p class="cashier-picker-subtitle">${staff.firstName} ${staff.lastName}</p>
          </div>
          <button class="modal-close-btn" id="editRoleCloseBtn" type="button">&times;</button>
        </div>
        <div class="edit-field" style="margin-top:8px">
          <label for="editRoleSelect">Role</label>
          <select id="editRoleSelect" class="settings-select">
            ${roles.map(r => `<option value="${r.id}" ${r.id === staff.roleId ? 'selected' : ''}>${r.name}</option>`).join('')}
          </select>
        </div>
        <div class="edit-field" style="margin-top:10px">
          <label for="editHourlyRate">Hourly Rate (optional)</label>
          <input type="number" id="editHourlyRate" class="settings-input" min="0" step="0.01"
            placeholder="e.g. 85.00" value="${staff.hourlyRate ?? ''}" />
          <p class="settings-section-hint" style="margin-top:4px">Used to calculate gross pay in timesheets.</p>
        </div>
        <div class="adj-form-actions" style="margin-top:16px">
          <button type="button" class="btn" id="editRoleCancelBtn">Cancel</button>
          <button type="button" class="btn primary" id="editRoleSaveBtn">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    document.getElementById('editRoleCloseBtn')?.addEventListener('click', close);
    document.getElementById('editRoleCancelBtn')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    return {
      onSave: (cb) => {
        document.getElementById('editRoleSaveBtn')?.addEventListener('click', () => {
          const roleId     = document.getElementById('editRoleSelect')?.value;
          const rateVal    = document.getElementById('editHourlyRate')?.value.trim();
          const hourlyRate = rateVal === '' ? null : parseFloat(rateVal);
          close();
          cb(roleId, hourlyRate);
        });
      }
    };
  }

  _addHandlerSetPin(handler) {
    this._list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="pin"]');
      if (!btn) return;
      if (document.querySelector('.cashier-picker-overlay')) return;
      const staffId = btn.dataset.id;
      const modal = document.createElement('div');
      modal.className = 'cashier-picker-overlay';
      modal.style.zIndex = '99999';
      modal.innerHTML = `
        <div class="cashier-picker-card" style="max-width:320px">
          <div class="cashier-picker-header">
            <div>
              <h3 class="cashier-picker-title">Set PIN</h3>
              <p class="cashier-picker-subtitle">6-digit cashier PIN</p>
            </div>
            <button class="modal-close-btn" data-action="pin-close" type="button">&times;</button>
          </div>
          <form class="edit-field" style="margin-top:8px" onsubmit="return false">
            <input type="password" data-input="pin" placeholder="Enter 6-digit PIN" maxlength="6" inputmode="numeric" autocomplete="new-password" class="settings-input" style="font-size:1.4rem;letter-spacing:0.5rem;text-align:center" />
          </form>
          <div class="adj-form-actions" style="margin-top:16px">
            <button type="button" class="btn" data-action="pin-cancel">Cancel</button>
            <button type="button" class="btn primary" data-action="pin-save">Save PIN</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const pinInput = modal.querySelector('[data-input="pin"]');
      pinInput?.focus();
      const close = () => modal.remove();
      modal.querySelector('[data-action="pin-close"]')?.addEventListener('click', close);
      modal.querySelector('[data-action="pin-cancel"]')?.addEventListener('click', close);
      modal.addEventListener('click', e => { if (e.target === modal) close(); });
      modal.querySelector('[data-action="pin-save"]')?.addEventListener('click', () => {
        const pin = pinInput?.value.trim();
        if (!pin || !/^\d{6}$/.test(pin)) {
          pinInput?.classList.add('input-error');
          return;
        }
        close();
        handler(staffId, pin);
      });
    });
  }
}

const _view = new StaffView();
_view._addHandlerTabs();
export default _view;
