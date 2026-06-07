import { track, flush } from '../analytics.js';

const STEPS = 4;

class OnboardingView {
  _overlay   = document.getElementById('onboardingOverlay');
  _errorEl   = document.getElementById('onboardingError');
  _nextBtn   = document.getElementById('onboardingNextBtn');
  _backBtn   = document.getElementById('onboardingBackBtn');
  _dots      = [...document.querySelectorAll('.ob-dot')];
  _steps     = [...document.querySelectorAll('.ob-step')];
  _current   = 0;
  _startedAt = null;
  _stepTimes = [];

  _onBeforeUnload = () => {
    track('onboarding_abandoned', { last_step: this._current + 1, steps_total: STEPS });
    flush();
  };

  _detectCountry() {
    const tz   = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const lang = (navigator.language ?? '').toUpperCase();
    if (lang.endsWith('-US') || (tz.startsWith('America/') && !lang.endsWith('-CA') && !lang.endsWith('-MX') && !lang.endsWith('-BR'))) return 'US';
    if (lang.endsWith('-PH') || tz === 'Asia/Manila') return 'PH';
    if (lang.endsWith('-CA') || tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver') || tz.startsWith('America/Winnipeg')) return 'CA';
    if (lang.endsWith('-GB') || tz === 'Europe/London') return 'GB';
    if (lang.endsWith('-AU') || tz.startsWith('Australia/')) return 'AU';
    if (lang.endsWith('-SG') || tz === 'Asia/Singapore') return 'SG';
    if (lang.endsWith('-MY') || tz === 'Asia/Kuala_Lumpur') return 'MY';
    if (lang.endsWith('-IN') || tz.startsWith('Asia/Kolkata')) return 'IN';
    if (lang.endsWith('-NZ') || tz.startsWith('Pacific/Auckland')) return 'NZ';
    if (lang.endsWith('-AE') || tz === 'Asia/Dubai') return 'AE';
    if (lang.endsWith('-JP') || tz === 'Asia/Tokyo') return 'JP';
    return 'US';
  }

  show() {
    this._current   = 0;
    this._startedAt = Date.now();
    this._stepTimes = [Date.now()];
    this._steps.forEach((s, i) => s.classList.toggle('ob-step--hidden', i !== 0));
    this._updateUI();
    this._overlay.classList.remove('hidden');
    this._focusCurrent();
    // Auto-detect country → set phone code + placeholder
    const detected   = this._detectCountry();
    const codeSelect = document.getElementById('onboardingPhoneCode');
    if (codeSelect) {
      const match = [...codeSelect.options].find(o => o.dataset.cc === detected);
      if (match) {
        codeSelect.value = match.value;
        // Select the right option when multiple share the same value (e.g. US/CA both +1)
        for (const opt of codeSelect.options) {
          if (opt.dataset.cc === detected) { codeSelect.selectedIndex = opt.index; break; }
        }
        this._updatePhonePlaceholder(codeSelect);
      }
    }
    // Pre-fill address country with same detection
    const countryEl = document.getElementById('onboardingCountry');
    if (countryEl && !countryEl.value) countryEl.value = detected;
    track('onboarding_started');
    track('onboarding_step_viewed', { step: 1 });
    window.addEventListener('beforeunload', this._onBeforeUnload);
  }

  hide() {
    this._overlay.classList.add('hidden');
    window.removeEventListener('beforeunload', this._onBeforeUnload);
  }

  showError(msg) { this._errorEl.textContent = msg; }
  clearError()   { this._errorEl.textContent = ''; }

  setLoading(bool) {
    this._nextBtn.disabled    = bool;
    this._nextBtn.textContent = bool ? 'Saving…' : this._nextLabel();
  }

  _nextLabel() {
    return this._current === STEPS - 1 ? 'Get Started' : 'Next';
  }

  _updateUI() {
    this._dots.forEach((d, i) => d.classList.toggle('ob-dot--active', i === this._current));
    this._backBtn.classList.toggle('hidden', this._current === 0);
    this._nextBtn.textContent = this._nextLabel();
  }

  _updatePhonePlaceholder(codeSelect) {
    const ph = codeSelect.options[codeSelect.selectedIndex]?.dataset.ph;
    const input = document.getElementById('onboardingPhone');
    if (ph && input) input.placeholder = ph;
  }

  _syncAddressCountry() {
    const codeSelect = document.getElementById('onboardingPhoneCode');
    const countryEl  = document.getElementById('onboardingCountry');
    if (!codeSelect || !countryEl) return;
    const cc = codeSelect.options[codeSelect.selectedIndex]?.dataset.cc;
    if (cc && countryEl.querySelector(`option[value="${cc}"]`)) countryEl.value = cc;
  }

  _focusCurrent() {
    const input = this._steps[this._current]?.querySelector('input, select');
    if (input) setTimeout(() => input.focus(), 200);
  }

  _goTo(index, direction) {
    const timeOnStep = Date.now() - (this._stepTimes[this._current] ?? Date.now());
    if (direction === 'forward') {
      track('onboarding_step_completed', { step: this._current + 1, time_ms: timeOnStep });
    } else {
      track('onboarding_step_back', { from_step: this._current + 1 });
    }

    const outEl = this._steps[this._current];
    const inEl  = this._steps[index];
    const outX  = direction === 'forward' ? '-28px' : '28px';
    const inX   = direction === 'forward' ? '28px'  : '-28px';

    outEl.style.transition = 'opacity 160ms ease, transform 160ms ease';
    outEl.style.opacity    = '0';
    outEl.style.transform  = `translateX(${outX})`;

    setTimeout(() => {
      outEl.classList.add('ob-step--hidden');
      outEl.style.cssText = '';
      inEl.style.opacity   = '0';
      inEl.style.transform = `translateX(${inX})`;
      inEl.classList.remove('ob-step--hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        inEl.style.transition = 'opacity 160ms ease, transform 160ms ease';
        inEl.style.opacity    = '1';
        inEl.style.transform  = 'translateX(0)';
        setTimeout(() => { inEl.style.cssText = ''; }, 170);
      }));
      this._current = index;
      this._stepTimes[index] = Date.now();
      this._updateUI();
      this.clearError();
      this._focusCurrent();
      if (index === 3) this._syncAddressCountry();
      track('onboarding_step_viewed', { step: index + 1 });
    }, 160);
  }

  _validate() {
    if (this._current === 0) {
      if (!document.getElementById('onboardingBizName')?.value.trim()) {
        this.showError('Please enter your business name.');
        return false;
      }
    }
    if (this._current === 1) {
      if (!document.getElementById('onboardingBizType')?.value) {
        this.showError('Please select a business type.');
        return false;
      }
      if (!document.getElementById('onboardingBizIndustry')?.value) {
        this.showError('Please select an industry.');
        return false;
      }
    }
    if (this._current === 2) {
      const phone  = document.getElementById('onboardingPhone')?.value.trim();
      const digits = (phone ?? '').replace(/\D/g, '');
      if (!phone)            { this.showError('Please enter a phone number.'); return false; }
      if (digits.length < 6) { this.showError('Please enter a valid phone number.'); return false; }
    }
    if (this._current === 3) {
      const street   = document.getElementById('onboardingStreet')?.value.trim();
      const city     = document.getElementById('onboardingCity')?.value.trim();
      const province = document.getElementById('onboardingProvince')?.value.trim();
      const zip      = document.getElementById('onboardingZip')?.value.trim();
      const country  = document.getElementById('onboardingCountry')?.value;
      if (!street)   { this.showError('Please enter your street address.'); return false; }
      if (!city)     { this.showError('Please enter your city or municipality.'); return false; }
      if (!province) { this.showError('Please enter your province or state.'); return false; }
      if (!zip)      { this.showError('Please enter your ZIP or postal code.'); return false; }
      if (!country)  { this.showError('Please select your country.'); return false; }
    }
    return true;
  }

  _addHandlerSubmit(handler) {
    this._nextBtn.addEventListener('click', () => {
      this.clearError();
      if (!this._validate()) return;
      if (this._current < STEPS - 1) {
        this._goTo(this._current + 1, 'forward');
      } else {
        const totalMs = Date.now() - (this._startedAt ?? Date.now());
        track('onboarding_completed', { total_time_ms: totalMs });
        handler({
          businessName: document.getElementById('onboardingBizName')?.value.trim(),
          businessType: document.getElementById('onboardingBizType')?.value,
          industry:     document.getElementById('onboardingBizIndustry')?.value,
          phone:        `${document.getElementById('onboardingPhoneCode')?.value ?? ''} ${document.getElementById('onboardingPhone')?.value.trim() ?? ''}`.trim(),
          street:       document.getElementById('onboardingStreet')?.value.trim(),
          city:         document.getElementById('onboardingCity')?.value.trim(),
          province:     document.getElementById('onboardingProvince')?.value.trim(),
          zip:          document.getElementById('onboardingZip')?.value.trim(),
          country:      document.getElementById('onboardingCountry')?.value,
        });
      }
    });

    this._backBtn.addEventListener('click', () => {
      if (this._current > 0) this._goTo(this._current - 1, 'back');
    });

    document.getElementById('onboardingPhoneCode')?.addEventListener('change', (e) => {
      this._updatePhonePlaceholder(e.target);
    });

    this._overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this._nextBtn.disabled) {
        e.preventDefault();
        this._nextBtn.click();
      }
    });
  }
}

export default new OnboardingView();
