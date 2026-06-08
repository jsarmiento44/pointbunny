import { track, flush } from '../analytics.js';
import { initPhoneInput } from '../phoneInput.js';

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
  _phoneIti  = null;

  _onBeforeUnload = () => {
    track('onboarding_abandoned', { last_step: this._current + 1, steps_total: STEPS });
    flush();
  };

  _detectCountry() {
    const tz   = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const lang = (navigator.language ?? '').toUpperCase();
    if (lang.endsWith('-US') || (tz.startsWith('America/') && !lang.endsWith('-CA') && !lang.endsWith('-MX') && !lang.endsWith('-BR'))) return 'us';
    if (lang.endsWith('-PH') || tz === 'Asia/Manila') return 'ph';
    if (lang.endsWith('-CA') || tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver') || tz.startsWith('America/Winnipeg')) return 'ca';
    if (lang.endsWith('-GB') || tz === 'Europe/London') return 'gb';
    if (lang.endsWith('-AU') || tz.startsWith('Australia/')) return 'au';
    if (lang.endsWith('-SG') || tz === 'Asia/Singapore') return 'sg';
    if (lang.endsWith('-MY') || tz === 'Asia/Kuala_Lumpur') return 'my';
    if (lang.endsWith('-IN') || tz.startsWith('Asia/Kolkata')) return 'in';
    if (lang.endsWith('-NZ') || tz.startsWith('Pacific/Auckland')) return 'nz';
    if (lang.endsWith('-AE') || tz === 'Asia/Dubai') return 'ae';
    if (lang.endsWith('-JP') || tz === 'Asia/Tokyo') return 'jp';
    return 'us';
  }

  show() {
    this._current   = 0;
    this._startedAt = Date.now();
    this._stepTimes = [Date.now()];
    this._steps.forEach((s, i) => s.classList.toggle('ob-step--hidden', i !== 0));
    this._updateUI();
    this._overlay.classList.remove('hidden');
    this._focusCurrent();

    const detected = this._detectCountry();

    if (!this._phoneIti) {
      this._phoneIti = initPhoneInput('onboardingPhone');
    }
    if (this._phoneIti) this._phoneIti.setCountry(detected);

    const countryEl = document.getElementById('onboardingCountry');
    if (countryEl && !countryEl.value) countryEl.value = detected.toUpperCase();

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

  _syncAddressCountry() {
    if (!this._phoneIti) return;
    const cc = this._phoneIti.getSelectedCountryData()?.iso2?.toUpperCase();
    const countryEl = document.getElementById('onboardingCountry');
    if (cc && countryEl?.querySelector(`option[value="${cc}"]`)) countryEl.value = cc;
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
      const phone = this._phoneIti?.getNumber() ?? '';
      if (!phone) { this.showError('Please enter a phone number.'); return false; }
      if (!this._phoneIti?.isValidNumber()) { this.showError('Please enter a valid phone number.'); return false; }
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
          phone:        this._phoneIti?.getNumber() ?? '',
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

    this._overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this._nextBtn.disabled) {
        e.preventDefault();
        this._nextBtn.click();
      }
    });
  }
}

export default new OnboardingView();
