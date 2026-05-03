class AuthView {
  _overlay       = document.getElementById('authOverlay');
  _wrapper       = document.getElementById('authFormsWrapper');
  _loginForm     = document.getElementById('loginForm');
  _signUpForm    = document.getElementById('signUpForm');
  _emailInput    = document.getElementById('loginEmail');
  _passwordInput = document.getElementById('loginPassword');
  _errorEl       = document.getElementById('loginError');
  _signUpErrorEl = document.getElementById('signUpError');
  _signInBtn     = document.getElementById('signInBtn');
  _signUpBtn     = document.getElementById('signUpBtn');
  _onSignUp      = false;

  constructor() {
    document.getElementById('showSignUpLink').addEventListener('click', (e) => {
      e.preventDefault();
      if (!this._onSignUp) this._slide('forward');
    });
    document.getElementById('showSignInLink').addEventListener('click', (e) => {
      e.preventDefault();
      if (this._onSignUp) this._slide('back');
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────

  show() { this._overlay.classList.remove('hidden'); }
  hide() { this._overlay.classList.add('hidden'); }

  showError(msg)       { this._errorEl.textContent = msg; }
  showSignUpError(msg) { this._signUpErrorEl.textContent = msg; }

  clearErrors() {
    this._errorEl.textContent = '';
    this._signUpErrorEl.textContent = '';
  }

  setLoading(bool) {
    this._signInBtn.disabled = bool;
    if (bool) {
      this._signInBtn.innerHTML = '<span class="btn-spinner"></span>Signing in…';
    } else {
      this._signInBtn.textContent = 'Sign In';
    }
  }

  setSignUpLoading(bool) {
    this._signUpBtn.disabled = bool;
    this._signUpBtn.textContent = bool ? 'Creating account…' : 'Create Account';
  }

  showCheckEmail(email) {
    this._signUpForm.innerHTML = `
      <p style="text-align:center; font-size:1.05rem; font-weight:600; margin:8px 0;">Check your email</p>
      <p class="auth-switch" style="text-align:center; margin-top:8px;">
        A confirmation link was sent to <strong>${email}</strong>.<br/>
        Click it to activate your account, then sign in.
      </p>
      <p class="auth-switch" style="text-align:center; margin-top:10px; font-size:0.8rem;">
        Don't see it? Check your <strong>spam or junk folder</strong>.
      </p>
      <p class="auth-switch" style="margin-top:20px;">
        <a href="#" id="backToSignIn">Back to sign in</a>
      </p>
    `;
    document.getElementById('backToSignIn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._slide('back');
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  _addHandlerSignIn(handler) {
    this._loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._errorEl.textContent = '';
      handler(this._emailInput.value.trim(), this._passwordInput.value);
    });
  }

  _addHandlerSignUp(handler) {
    this._signUpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._signUpErrorEl.textContent = '';

      const firstName = document.getElementById('signUpFirstName')?.value.trim();
      const lastName  = document.getElementById('signUpLastName')?.value.trim();
      const email     = document.getElementById('signUpEmail')?.value.trim();
      const password  = document.getElementById('signUpPassword')?.value;
      const confirm   = document.getElementById('signUpConfirm')?.value;

      if (!firstName)       { this._signUpErrorEl.textContent = 'Please enter your first name.'; return; }
      if (!lastName)        { this._signUpErrorEl.textContent = 'Please enter your last name.'; return; }
      if (!email)           { this._signUpErrorEl.textContent = 'Please enter your email.'; return; }
      if (password.length < 6) { this._signUpErrorEl.textContent = 'Password must be at least 6 characters.'; return; }
      if (password !== confirm) { this._signUpErrorEl.textContent = 'Passwords do not match.'; return; }

      handler({ firstName, lastName, email, password });
    });
  }

  // ── Sign-in success animation ─────────────────────────────────────────────

  playSignInSuccess() {
    return new Promise(resolve => {
      const card = this._overlay.querySelector('.auth-card');
      card.classList.add('auth-card--animating', 'auth-card--signing-in');

      const sweep = document.createElement('div');
      sweep.className = 'auth-sweep auth-sweep--forward';
      card.appendChild(sweep);
      requestAnimationFrame(() => requestAnimationFrame(() => sweep.classList.add('auth-sweep--active')));

      setTimeout(() => {
        this._overlay.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        this._overlay.style.opacity = '0';
        this._overlay.style.transform = 'scale(0.97)';
        setTimeout(() => {
          this._overlay.classList.add('hidden');
          this._overlay.style.cssText = '';
          card.classList.remove('auth-card--animating', 'auth-card--signing-in');
          resolve();
        }, 320);
      }, 460);
    });
  }

  // ── Slide animation ───────────────────────────────────────────────────────

  _slide(direction) {
    const DURATION = 220;
    const forward  = direction === 'forward';
    const outEl    = forward ? this._loginForm  : this._signUpForm;
    const inEl     = forward ? this._signUpForm : this._loginForm;
    const outX     = forward ? '-28px' : '28px';
    const inX      = forward ? '28px'  : '-28px';
    const card     = this._overlay.querySelector('.auth-card');

    this.clearErrors();

    // Clip card only during animation (prevents sweep from painting outside rounded corners)
    card.classList.add('auth-card--animating');
    setTimeout(() => card.classList.remove('auth-card--animating'), 700);

    // Green sweep line
    const sweep = document.createElement('div');
    sweep.className = `auth-sweep auth-sweep--${forward ? 'forward' : 'back'}`;
    card.appendChild(sweep);
    requestAnimationFrame(() => requestAnimationFrame(() => sweep.classList.add('auth-sweep--active')));
    setTimeout(() => {
      sweep.style.transition = 'opacity 0.2s ease';
      sweep.style.opacity = '0';
      setTimeout(() => sweep.remove(), 220);
    }, 460);

    // Fade out current form
    outEl.style.transition = `opacity ${DURATION}ms ease, transform ${DURATION}ms ease`;
    outEl.style.opacity    = '0';
    outEl.style.transform  = `translateX(${outX})`;

    setTimeout(() => {
      outEl.classList.add('hidden');
      outEl.style.cssText = '';

      // Widen/narrow the card
      if (forward) card.classList.add('auth-card--wide');
      else card.classList.remove('auth-card--wide');

      // Fade in next form
      inEl.style.opacity   = '0';
      inEl.style.transform = `translateX(${inX})`;
      inEl.classList.remove('hidden');

      requestAnimationFrame(() => requestAnimationFrame(() => {
        inEl.style.transition = `opacity ${DURATION}ms ease, transform ${DURATION}ms ease`;
        inEl.style.opacity    = '1';
        inEl.style.transform  = 'translateX(0)';
        setTimeout(() => { inEl.style.cssText = ''; }, DURATION + 10);
      }));

      this._onSignUp = forward;
    }, DURATION);
  }
}

export default new AuthView();
