import { initPhoneInput } from '../phoneInput.js';

// ── US timezone whitelist (IANA IDs) ─────────────────────────────────────────
// Used to filter Intl.supportedValuesOf('timeZone') down to US-relevant entries.
// Intl generates all display labels + live offsets at runtime — no hardcoded strings.
const US_TZ_IDS = new Set([
  'Pacific/Pago_Pago',               // American Samoa   (UTC−11)
  'Pacific/Honolulu',                // Hawaii            (UTC−10, no DST)
  'America/Adak',                    // Aleutian Islands  (UTC−10/−9, has DST)
  'America/Anchorage',               // Alaska            (UTC−9/−8)
  'America/Juneau',
  'America/Sitka',
  'America/Metlakatla',              //                   (UTC−9, no DST)
  'America/Nome',
  'America/Yakutat',
  'America/Los_Angeles',             // Pacific           (UTC−8/−7)
  'America/Phoenix',                 // Arizona           (UTC−7, no DST)
  'America/Denver',                  // Mountain          (UTC−7/−6)
  'America/Boise',
  'America/Chicago',                 // Central           (UTC−6/−5)
  'America/Menominee',
  'America/Indiana/Knox',
  'America/Indiana/Tell_City',
  'America/North_Dakota/Center',
  'America/North_Dakota/New_Salem',
  'America/North_Dakota/Beulah',
  'America/New_York',                // Eastern           (UTC−5/−4)
  'America/Detroit',
  'America/Indiana/Indianapolis',
  'America/Indiana/Marengo',
  'America/Indiana/Petersburg',
  'America/Indiana/Vevay',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Kentucky/Louisville',
  'America/Kentucky/Monticello',
  'America/Puerto_Rico',             // Atlantic PR       (UTC−4, no DST)
  'America/St_Thomas',               // US Virgin Islands (UTC−4)
  'Pacific/Guam',                    // Chamorro/Guam     (UTC+10, no DST)
  'Pacific/Saipan',                  // N. Mariana Is.    (UTC+10)
]);

function _buildTzOptions(selectedTz) {
  const now = new Date();

  // Pull every timezone the browser's IANA database knows, keep only US ones.
  // Falls back to the Set itself if supportedValuesOf isn't available (older browsers).
  const allTz = (typeof Intl.supportedValuesOf === 'function')
    ? Intl.supportedValuesOf('timeZone').filter(tz => US_TZ_IDS.has(tz))
    : [...US_TZ_IDS];

  const getPart = (tz, opts) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts })
      .formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? '';

  return allTz
    .map(tz => {
      // Familiar abbreviation: PST, EST, CDT, HST …
      const abbr  = getPart(tz, { timeZoneName: 'short' });
      // Current UTC offset: GMT-8, GMT+10 …
      const offset = getPart(tz, { timeZoneName: 'shortOffset' });
      // Readable city / region from IANA ID tail
      const city  = tz.split('/').pop().replace(/_/g, ' ');
      // Numeric offset (ms) for west→east sort
      const dtStr = new Intl.DateTimeFormat('sv-SE', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).format(now).replace(' ', 'T');
      const offsetMs = now.getTime() - new Date(dtStr + 'Z').getTime();

      return { tz, label: `${city} — ${abbr} (${offset})`, offsetMs, selected: tz === selectedTz };
    })
    .sort((a, b) => a.offsetMs - b.offsetMs);
}

class SettingsView {
  _modal    = document.getElementById("settingsModal");
  _phoneIti = null;
  _openBtn = document.getElementById("settingsBtn");
  _closeBtn = document.getElementById("settingsCloseBtn");
  _addBtn = document.getElementById("addAdjustmentBtn");
  _list = document.getElementById("adjustmentList");
  _showRemovedToggle = document.getElementById("showRemovedToggle");
  _printingToggle = document.getElementById("printingToggle");
  _confirmPrintToggle = document.getElementById("confirmPrintToggle");
  _twoCopiesToggle = document.getElementById("twoCopiesToggle");
  _orderTypeToggle = document.getElementById("orderTypeToggle");
  _kdsYellowInput = document.getElementById("kdsYellowInput");
  _kdsRedInput = document.getElementById("kdsRedInput");
  _kdsAutoInput = document.getElementById("kdsAutoInput");

  // ── Tab navigation ────────────────────────────────────────────────────────────

  openWithRole(role) {
    if (role === 'Admin' && !this._phoneIti) {
      this._phoneIti = initPhoneInput('settingsBusinessPhoneNumber');
    }
    this._switchTab(role === 'Admin' ? 'business' : 'profile');
    this.showBusinessSaveStatus(false, '');
  }

  _switchTab(name) {
    document.querySelectorAll('.settings-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.settingsTab === name);
    });
    const tabId = `settingsTab${name.charAt(0).toUpperCase() + name.slice(1)}`;
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.classList.toggle('hidden', tab.id !== tabId);
    });
  }

  _addHandlerNavTabs() {
    document.querySelector('.settings-nav')?.addEventListener('click', e => {
      const btn = e.target.closest('.settings-nav-btn[data-settings-tab]');
      if (!btn) return;
      this._switchTab(btn.dataset.settingsTab);
    });
  }

  // ── Business info ─────────────────────────────────────────────────────────────

  syncBusinessInfo({ name, email, phone, timezone, address, city, state, zip, isOwner }) {
    const n  = document.getElementById('settingsBusinessName');
    const e  = document.getElementById('settingsBusinessEmail');
    const a  = document.getElementById('settingsBusinessAddress');
    const c  = document.getElementById('settingsBusinessCity');
    const st = document.getElementById('settingsBusinessState');
    const z  = document.getElementById('settingsBusinessZip');
    if (n)  n.value  = name    ?? '';
    if (e)  e.value  = email   ?? '';
    if (a)  a.value  = address ?? '';
    if (c)  c.value  = city    ?? '';
    if (st) st.value = state   ?? '';
    if (z)  z.value  = zip     ?? '';
    if (this._phoneIti) this._phoneIti.setNumber(phone ?? '');

    // Timezone field — only shown to the business owner
    const tzField = document.getElementById('settingsTimezoneField');
    if (tzField) {
      tzField.classList.toggle('hidden', !isOwner);
      if (isOwner) {
        const tzSel = document.getElementById('settingsTimezone');
        if (tzSel) {
          // Default to current browser timezone if none saved
          const activeTz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
          const options = _buildTzOptions(activeTz);
          tzSel.innerHTML = options
            .map(o => `<option value="${o.tz}"${o.selected ? ' selected' : ''}>${o.label}</option>`)
            .join('');
          // Fallback: if saved tz not in list, prepend it
          if (!options.some(o => o.selected) && activeTz) {
            tzSel.insertAdjacentHTML('afterbegin',
              `<option value="${activeTz}" selected>${activeTz}</option>`);
          }
        }
      }
    }
  }

  _getBusinessFormData() {
    const phone = this._phoneIti ? this._phoneIti.getNumber() : '';
    const tzField = document.getElementById('settingsTimezoneField');
    const timezone = (!tzField || tzField.classList.contains('hidden'))
      ? null
      : (document.getElementById('settingsTimezone')?.value || null);
    return {
      name:    document.getElementById('settingsBusinessName')?.value.trim()    ?? '',
      email:   document.getElementById('settingsBusinessEmail')?.value.trim()   ?? '',
      phone,
      timezone,
      address: document.getElementById('settingsBusinessAddress')?.value.trim() ?? '',
      city:    document.getElementById('settingsBusinessCity')?.value.trim()    ?? '',
      state:   document.getElementById('settingsBusinessState')?.value.trim()   ?? '',
      zip:     document.getElementById('settingsBusinessZip')?.value.trim()     ?? '',
    };
  }

  _addHandlerSaveBusinessInfo(handler) {
    document.getElementById('saveBusinessInfoBtn')?.addEventListener('click', () => {
      const data = this._getBusinessFormData();
      if (!data.name) { this.showBusinessSaveStatus(false, 'Business name is required.'); return; }
      handler(data);
    });
  }

  _addHandlerGenerateTimeclockToken(handler) {
    document.getElementById('tcGenerateTokenBtn')?.addEventListener('click', () => handler());
  }

  showTimeclockToken(token) {
    const el = document.getElementById('tcTokenDisplay');
    if (!el) return;
    el.textContent = token;
    el.classList.remove('hidden');
    const btn = document.getElementById('tcGenerateTokenBtn');
    if (btn) btn.textContent = 'Regenerate';
  }

  showBusinessSaveStatus(success, msg) {
    const el = document.getElementById('businessSaveStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = `settings-save-status${success ? ' settings-save-status--ok' : msg ? ' settings-save-status--err' : ''}`;
    if (success) setTimeout(() => { el.textContent = ''; el.className = 'settings-save-status'; }, 3000);
  }

  // ── Profile info ──────────────────────────────────────────────────────────────

  syncProfileInfo({ firstName, lastName }) {
    const f = document.getElementById('settingsProfileFirstName');
    const l = document.getElementById('settingsProfileLastName');
    if (f) f.value = firstName ?? '';
    if (l) l.value = lastName  ?? '';
  }

  showProfileSaveStatus(success, msg) {
    const el = document.getElementById('profileSaveStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = `settings-save-status${success ? ' settings-save-status--ok' : msg ? ' settings-save-status--err' : ''}`;
    if (success) setTimeout(() => { el.textContent = ''; el.className = 'settings-save-status'; }, 3000);
  }

  // ── OTP verification steps ────────────────────────────────────────────────────

  showBusinessOTPStep(email) {
    const hint = document.getElementById('businessOtpHint');
    if (hint) hint.textContent = `A 6-digit code was sent to ${email}.`;
    document.getElementById('businessOtpError').textContent = '';
    document.getElementById('businessOtpInput').value = '';
    document.getElementById('businessSaveRow').classList.add('hidden');
    document.getElementById('businessOtpStep').classList.remove('hidden');
    setTimeout(() => document.getElementById('businessOtpInput')?.focus(), 50);
  }

  hideBusinessOTPStep() {
    document.getElementById('businessOtpStep').classList.add('hidden');
    document.getElementById('businessSaveRow').classList.remove('hidden');
  }

  showBusinessOTPError(msg) {
    const el = document.getElementById('businessOtpError');
    if (el) el.textContent = msg;
    const btn = document.getElementById('businessOtpVerifyBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Verify & Save'; }
  }

  showProfileOTPStep(email) {
    const hint = document.getElementById('profileOtpHint');
    if (hint) hint.textContent = `A 6-digit code was sent to ${email}.`;
    document.getElementById('profileOtpError').textContent = '';
    document.getElementById('profileOtpInput').value = '';
    document.getElementById('profileSaveRow').classList.add('hidden');
    document.getElementById('profileOtpStep').classList.remove('hidden');
    setTimeout(() => document.getElementById('profileOtpInput')?.focus(), 50);
  }

  hideProfileOTPStep() {
    document.getElementById('profileOtpStep').classList.add('hidden');
    document.getElementById('profileSaveRow').classList.remove('hidden');
  }

  showProfileOTPError(msg) {
    const el = document.getElementById('profileOtpError');
    if (el) el.textContent = msg;
    const btn = document.getElementById('profileOtpVerifyBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Verify & Save'; }
  }

  _addHandlerSaveProfile(handler) {
    document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
      const firstName = document.getElementById('settingsProfileFirstName')?.value.trim();
      const lastName  = document.getElementById('settingsProfileLastName')?.value.trim();
      if (!firstName) { this.showProfileSaveStatus(false, 'First name is required.'); return; }
      if (!lastName)  { this.showProfileSaveStatus(false, 'Last name is required.'); return; }
      handler({ firstName, lastName });
    });
  }

  _addHandlerVerifyBusinessOTP(handler) {
    document.getElementById('businessOtpVerifyBtn')?.addEventListener('click', () => {
      const token = document.getElementById('businessOtpInput')?.value.trim();
      if (!token || !/^\d{6}$/.test(token)) {
        document.getElementById('businessOtpError').textContent = 'Please enter the 6-digit code.';
        return;
      }
      handler(token);
    });
  }

  _addHandlerCancelBusinessOTP(handler) {
    document.getElementById('businessOtpCancelBtn')?.addEventListener('click', () => handler());
  }

  _addHandlerVerifyProfileOTP(handler) {
    document.getElementById('profileOtpVerifyBtn')?.addEventListener('click', () => {
      const token = document.getElementById('profileOtpInput')?.value.trim();
      if (!token || !/^\d{6}$/.test(token)) {
        document.getElementById('profileOtpError').textContent = 'Please enter the 6-digit code.';
        return;
      }
      handler(token);
    });
  }

  _addHandlerCancelProfileOTP(handler) {
    document.getElementById('profileOtpCancelBtn')?.addEventListener('click', () => handler());
  }

  // ── Open / Close ─────────────────────────────────────────────────────────────

  _addHandlerOpen(handler) {
    this._openBtn.addEventListener("click", () => {
      this._modal.classList.remove("hidden");
      handler();
    });
  }

  _addHandlerClose() {
    this._closeBtn.addEventListener("click", () => this._close());
    this._modal.addEventListener("click", (e) => {
      if (e.target === this._modal) this._close();
    });
  }

  _close() {
    document.getElementById('businessOtpStep')?.classList.add('hidden');
    document.getElementById('businessSaveRow')?.classList.remove('hidden');
    document.getElementById('profileOtpStep')?.classList.add('hidden');
    document.getElementById('profileSaveRow')?.classList.remove('hidden');
    const inner = this._modal.querySelector(".modal-container");
    if (inner) inner.classList.add("modal-exiting");
    setTimeout(() => {
      if (inner) inner.classList.remove("modal-exiting");
      this._modal.classList.add("hidden");
      this._removeForm();
    }, 220);
  }

  // ── Adjustment List ───────────────────────────────────────────────────────────

  renderAdjustments(adjustments) {
    if (adjustments.length === 0) {
      this._list.innerHTML =
        '<li class="adjustment-empty">No adjustments yet.</li>';
      return;
    }

    this._list.innerHTML = adjustments
      .map(
        (adj) => `
        <li class="adjustment-item" data-id="${adj.id}">
          <label class="switch">
            <input type="checkbox" class="adj-toggle" ${adj.enabled ? "checked" : ""} />
            <span class="slider round"></span>
          </label>
          <div class="adjustment-item-info">
            <div class="adjustment-item-name">${adj.name}</div>
            <div class="adjustment-item-meta">
              ${adj.type === "fee" ? "Fee" : "Discount"} &middot;
              ${adj.calculation === "fixed" ? "$" + adj.value.toFixed(2) : adj.value + "%"}
            </div>
          </div>
          <div class="adjustment-item-controls">
            <button class="adjustment-edit-btn" data-id="${adj.id}" type="button">Edit</button>
            <button class="adjustment-delete-btn" data-id="${adj.id}" type="button">Delete</button>
          </div>
        </li>
      `,
      )
      .join("");
  }

  // ── Add / Edit Form ───────────────────────────────────────────────────────────

  showForm(adjustment = null) {
    this._removeForm();
    const isEdit = adjustment !== null;

    const html = `
      <div class="adj-form" id="adjForm">
        <h4 class="adj-form-title">${isEdit ? "Edit Adjustment" : "New Adjustment"}</h4>

        <div class="edit-field">
          <label for="adjName">Name</label>
          <input type="text" id="adjName" placeholder="e.g. VAT, Service Charge"
            value="${isEdit ? adjustment.name : ""}" />
        </div>

        <p class="adj-form-sublabel">Type</p>
        <div class="adj-selector" id="adjTypeSelector">
          <button type="button" class="adj-selector-btn ${!isEdit || adjustment.type === "fee" ? "active" : ""}" data-value="fee">Fee</button>
          <button type="button" class="adj-selector-btn ${isEdit && adjustment.type === "discount" ? "active" : ""}" data-value="discount">Discount</button>
        </div>
        <input type="hidden" id="adjType" value="${isEdit ? adjustment.type : "fee"}" />

        <p class="adj-form-sublabel">Calculation</p>
        <div class="adj-selector" id="adjCalcSelector">
          <button type="button" class="adj-selector-btn ${!isEdit || adjustment.calculation === "fixed" ? "active" : ""}" data-value="fixed">Fixed ($)</button>
          <button type="button" class="adj-selector-btn ${isEdit && adjustment.calculation === "percentage" ? "active" : ""}" data-value="percentage">
            Percentage (%)
            <span class="adj-info-tip">i</span>
          </button>
        </div>
        <input type="hidden" id="adjCalc" value="${isEdit ? adjustment.calculation : "fixed"}" />

        <div class="edit-field">
          <label for="adjValue" id="adjValueLabel">
            ${isEdit && adjustment.calculation === "percentage" ? "Value (%)" : "Value ($)"}
          </label>
          <input type="number" id="adjValue" min="0" step="0.01" placeholder="0"
            value="${isEdit ? adjustment.value : ""}" />
        </div>

        <div class="adj-form-actions">
          <button type="button" class="btn" id="adjCancelBtn">Cancel</button>
          <button type="button" class="btn primary" id="adjSaveBtn"
            data-edit-id="${isEdit ? adjustment.id : ""}">
            ${isEdit ? "Update" : "Add"}
          </button>
        </div>
      </div>
    `;

    this._list.insertAdjacentHTML("beforebegin", html);

    // Wire selector groups
    document.querySelectorAll(".adj-selector").forEach((group) => {
      group.addEventListener("click", (e) => {
        const btn = e.target.closest(".adj-selector-btn");
        if (!btn) return;
        group
          .querySelectorAll(".adj-selector-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (group.id === "adjCalcSelector") {
          document.getElementById("adjCalc").value = btn.dataset.value;
          document.getElementById("adjValueLabel").textContent =
            btn.dataset.value === "percentage" ? "Value (%)" : "Value ($)";
        } else {
          document.getElementById("adjType").value = btn.dataset.value;
        }
      });
    });

    document
      .getElementById("adjCancelBtn")
      .addEventListener("click", () => this._removeForm());

    this._wireInfoTip();
    document.getElementById("adjName").focus();
  }

  _wireInfoTip() {
    document.querySelectorAll(".adj-info-tip").forEach((tip) => {
      tip.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelector(".adj-tooltip")?.remove();

        const rect = tip.getBoundingClientRect();
        const el = document.createElement("div");
        el.className = "adj-tooltip";
        el.textContent =
          "% of the running subtotal at the time this adjustment is applied";
        document.body.appendChild(el);

        el.style.left = `${rect.left + rect.width / 2 - el.offsetWidth / 2}px`;
        el.style.top = `${rect.top - el.offsetHeight - 8}px`;

        setTimeout(() => {
          document.addEventListener("click", () => el.remove(), { once: true });
        }, 0);
      });
    });
  }

  _removeForm() {
    document.getElementById("adjForm")?.remove();
  }

  _getFormData() {
    return {
      id: document.getElementById("adjSaveBtn")?.dataset.editId || null,
      name: document.getElementById("adjName")?.value.trim(),
      type: document.getElementById("adjType")?.value,
      calculation: document.getElementById("adjCalc")?.value,
      value: parseFloat(document.getElementById("adjValue")?.value),
    };
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  _addHandlerAdd() {
    this._addBtn.addEventListener("click", () => this.showForm());
  }

  _addHandlerSave(handler) {
    this._modal.addEventListener("click", (e) => {
      if (!e.target.closest("#adjSaveBtn")) return;
      const data = this._getFormData();
      if (!data.name) {
        alert("Please enter a name.");
        return;
      }
      if (isNaN(data.value) || data.value < 0) {
        alert("Please enter a valid value.");
        return;
      }
      handler(data);
      this._removeForm();
    });
  }

  _addHandlerEdit(handler) {
    this._list.addEventListener("click", (e) => {
      const btn = e.target.closest(".adjustment-edit-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerDelete(handler) {
    this._list.addEventListener("click", (e) => {
      const btn = e.target.closest(".adjustment-delete-btn");
      if (!btn) return;
      handler(btn.dataset.id);
    });
  }

  _addHandlerToggle(handler) {
    this._list.addEventListener("change", (e) => {
      const toggle = e.target.closest(".adj-toggle");
      if (!toggle) return;
      const id = toggle.closest(".adjustment-item").dataset.id;
      handler(id);
    });
  }

  _addHandlerShowRemoved(handler) {
    this._showRemovedToggle.addEventListener("change", () => {
      handler(this._showRemovedToggle.checked);
    });
  }

  syncShowRemovedToggle(value) {
    this._showRemovedToggle.checked = value;
  }

  _addHandlerTogglePrinting(handler) {
    this._printingToggle.addEventListener("change", () => {
      handler(this._printingToggle.checked);
    });
  }

  syncPrintingToggle(value) {
    this._printingToggle.checked = value;
  }

  _addHandlerToggleConfirmPrint(handler) {
    this._confirmPrintToggle.addEventListener("change", () => {
      handler(this._confirmPrintToggle.checked);
    });
  }

  syncConfirmPrintToggle(value) {
    this._confirmPrintToggle.checked = value;
  }

  _addHandlerToggleTwoCopies(handler) {
    this._twoCopiesToggle.addEventListener('change', () => handler(this._twoCopiesToggle.checked));
  }

  syncTwoCopiesToggle(value) {
    this._twoCopiesToggle.checked = value;
  }

  _addHandlerToggleOrderType(handler) {
    this._orderTypeToggle.addEventListener('change', () => handler(this._orderTypeToggle.checked));
  }

  syncOrderTypeToggle(value) {
    this._orderTypeToggle.checked = value;
  }

  // ── Display window size ───────────────────────────────────────────────────────

  _sizeToOption(size) {
    const key = `${size.width}x${size.height}`;
    return ['1024x768', '1280x720', '1920x1080'].includes(key) ? key : 'custom';
  }

  syncDisplaySizes(kdsSize, cfdSize) {
    const kdsSelect = document.getElementById('kdsWindowSizeSelect');
    const cfdSelect = document.getElementById('cfdWindowSizeSelect');

    const kdsOpt = this._sizeToOption(kdsSize);
    kdsSelect.value = kdsOpt;
    if (kdsOpt === 'custom') {
      document.getElementById('kdsCustomSize').classList.remove('hidden');
      document.getElementById('kdsCustomW').value = kdsSize.width;
      document.getElementById('kdsCustomH').value = kdsSize.height;
    }

    const cfdOpt = this._sizeToOption(cfdSize);
    cfdSelect.value = cfdOpt;
    if (cfdOpt === 'custom') {
      document.getElementById('cfdCustomSize').classList.remove('hidden');
      document.getElementById('cfdCustomW').value = cfdSize.width;
      document.getElementById('cfdCustomH').value = cfdSize.height;
    }

    // Sync ad preview
    const adUrl = localStorage.getItem('pointbunny_cfd_ad');
    if (adUrl) {
      document.getElementById('cfdAdPreview').classList.remove('hidden');
      document.getElementById('cfdAdPreviewImg').src = adUrl;
      document.getElementById('cfdAdRemoveBtn').classList.remove('hidden');
    }
  }

  _addHandlerDisplaySizes(kdsHandler, cfdHandler) {
    const kdsSelect  = document.getElementById('kdsWindowSizeSelect');
    const cfdSelect  = document.getElementById('cfdWindowSizeSelect');
    const kdsCustom  = document.getElementById('kdsCustomSize');
    const cfdCustom  = document.getElementById('cfdCustomSize');

    const readSize = (select, customEl) => {
      if (select.value === 'custom') {
        const w = parseInt(customEl.querySelector('[id$="CustomW"]').value) || 1920;
        const h = parseInt(customEl.querySelector('[id$="CustomH"]').value) || 1080;
        return { width: w, height: h };
      }
      const [w, h] = select.value.split('x').map(Number);
      return { width: w, height: h };
    };

    kdsSelect.addEventListener('change', () => {
      kdsCustom.classList.toggle('hidden', kdsSelect.value !== 'custom');
      if (kdsSelect.value !== 'custom') kdsHandler(readSize(kdsSelect, kdsCustom));
    });

    cfdSelect.addEventListener('change', () => {
      cfdCustom.classList.toggle('hidden', cfdSelect.value !== 'custom');
      if (cfdSelect.value !== 'custom') cfdHandler(readSize(cfdSelect, cfdCustom));
    });

    [document.getElementById('kdsCustomW'), document.getElementById('kdsCustomH')].forEach(input => {
      input.addEventListener('change', () => kdsHandler(readSize(kdsSelect, kdsCustom)));
    });

    [document.getElementById('cfdCustomW'), document.getElementById('cfdCustomH')].forEach(input => {
      input.addEventListener('change', () => cfdHandler(readSize(cfdSelect, cfdCustom)));
    });
  }

  // ── CFD ad image ──────────────────────────────────────────────────────────────

  _addHandlerCFDAdUpload(handler) {
    const input      = document.getElementById('cfdAdInput');
    const fileNameEl = document.getElementById('cfdAdFileName');
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      fileNameEl.textContent = file.name;
      handler(file);
    });
  }

  showCFDAdPreview(url) {
    document.getElementById('cfdAdPreview').classList.remove('hidden');
    document.getElementById('cfdAdPreviewImg').src = url;
    document.getElementById('cfdAdRemoveBtn').classList.remove('hidden');
  }

  _addHandlerCFDAdRemove(handler) {
    document.getElementById('cfdAdRemoveBtn').addEventListener('click', () => {
      document.getElementById('cfdAdPreview').classList.add('hidden');
      document.getElementById('cfdAdPreviewImg').src = '';
      document.getElementById('cfdAdRemoveBtn').classList.add('hidden');
      document.getElementById('cfdAdFileName').textContent = 'No file chosen';
      document.getElementById('cfdAdInput').value = '';
      handler();
    });
  }

  syncKDSThresholds(yellow, red, auto) {
    this._kdsYellowInput.value = yellow;
    this._kdsRedInput.value = red;
    this._kdsAutoInput.value = auto;
  }

  _addHandlerKDSThresholds(handler) {
    [this._kdsYellowInput, this._kdsRedInput, this._kdsAutoInput].forEach(input => {
      input.addEventListener('change', () => {
        const yellow = parseInt(this._kdsYellowInput.value) || 180;
        const red = parseInt(this._kdsRedInput.value) || 300;
        const auto = parseInt(this._kdsAutoInput.value) || 900;
        handler({ yellow, red, auto });
      });
    });
  }
}

export default new SettingsView();
