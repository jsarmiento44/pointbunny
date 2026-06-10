class AuthView {
  _overlay       = document.getElementById('authOverlay');
  _wrapper       = document.getElementById('authFormsWrapper');
  _loginForm     = document.getElementById('loginForm');
  _signUpForm    = document.getElementById('signUpForm');
  _forgotForm    = document.getElementById('forgotForm');
  _resetForm     = document.getElementById('resetForm');
  _inviteForm    = document.getElementById('inviteForm');
  _emailInput    = document.getElementById('loginEmail');
  _passwordInput = document.getElementById('loginPassword');
  _errorEl       = document.getElementById('loginError');
  _signUpErrorEl = document.getElementById('signUpError');
  _forgotErrorEl = document.getElementById('forgotError');
  _resetErrorEl  = document.getElementById('resetError');
  _inviteErrorEl = document.getElementById('inviteError');
  _signInBtn     = document.getElementById('signInBtn');
  _signUpBtn     = document.getElementById('signUpBtn');
  _forgotBtn     = document.getElementById('forgotBtn');
  _resetBtn      = document.getElementById('resetBtn');
  _inviteBtn     = document.getElementById('inviteBtn');
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
    document.getElementById('showForgotLink').addEventListener('click', (e) => {
      e.preventDefault();
      this._slideTo(this._loginForm, this._forgotForm, 'forward', false);
    });
    document.getElementById('backToLoginFromForgot').addEventListener('click', (e) => {
      e.preventDefault();
      this._slideTo(this._forgotForm, this._loginForm, 'back', false);
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────

  show() { this._overlay.classList.remove('hidden'); }
  hide() { this._overlay.classList.add('hidden'); }

  showError(msg)       { this._errorEl.textContent = msg; }
  showSignUpError(msg) { this._signUpErrorEl.textContent = msg; }
  showForgotError(msg) { this._forgotErrorEl.textContent = msg; }
  showResetError(msg)  { this._resetErrorEl.textContent = msg; }

  clearErrors() {
    this._errorEl.innerHTML         = '';
    this._signUpErrorEl.textContent = '';
    this._forgotErrorEl.textContent = '';
    this._resetErrorEl.textContent  = '';
    this._inviteErrorEl.textContent = '';
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

  setForgotLoading(bool) {
    this._forgotBtn.disabled = bool;
    this._forgotBtn.textContent = bool ? 'Sending…' : 'Send Reset Link';
  }

  setResetLoading(bool) {
    this._resetBtn.disabled = bool;
    this._resetBtn.textContent = bool ? 'Saving…' : 'Set New Password';
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

  showForgotSent(email) {
    this._forgotForm.innerHTML = `
      <p style="text-align:center; font-size:1.05rem; font-weight:600; margin:8px 0;">Check your email</p>
      <p class="auth-switch" style="text-align:center; margin-top:8px;">
        A password reset link was sent to <strong>${email}</strong>.
      </p>
      <p class="auth-switch" style="text-align:center; margin-top:10px; font-size:0.8rem;">
        Don't see it? Check your <strong>spam or junk folder</strong>.
      </p>
      <p class="auth-switch" style="margin-top:20px;">
        <a href="#" id="backToLoginFromSent">Back to sign in</a>
      </p>
    `;
    document.getElementById('backToLoginFromSent')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._slideTo(this._forgotForm, this._loginForm, 'back', false);
    });
  }

  showResetPassword() {
    this._loginForm.classList.add('hidden');
    this._signUpForm.classList.add('hidden');
    this._forgotForm.classList.add('hidden');
    this._resetForm.classList.remove('hidden');
  }

  showInviteForm(firstName) {
    this._loginForm.classList.add('hidden');
    this._signUpForm.classList.add('hidden');
    this._forgotForm.classList.add('hidden');
    this._resetForm.classList.add('hidden');
    const greetEl = document.getElementById('inviteGreeting');
    if (greetEl) greetEl.textContent = firstName ? `Welcome, ${firstName}!` : 'Welcome!';
    this._inviteForm.classList.remove('hidden');
  }

  showInviteError(msg) { this._inviteErrorEl.textContent = msg; }

  setInviteLoading(bool) {
    this._inviteBtn.disabled = bool;
    this._inviteBtn.textContent = bool ? 'Setting up…' : 'Set Up Account';
  }

  showResetSuccess() {
    this._resetForm.innerHTML = `
      <p style="text-align:center; font-size:1.05rem; font-weight:600; margin:8px 0;">Password updated</p>
      <p class="auth-switch" style="text-align:center; margin-top:8px;">
        Your password has been changed successfully.
      </p>
      <p class="auth-switch" style="margin-top:20px;">
        <a href="#" id="goToSignInAfterReset">Sign in with your new password</a>
      </p>
    `;
    document.getElementById('goToSignInAfterReset')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '';
      this._resetForm.classList.add('hidden');
      this._loginForm.classList.remove('hidden');
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  showGoogleInAppError(url) {
    this._errorEl.innerHTML = `Google sign-in requires Safari or Chrome. <a href="${url}" target="_blank" rel="noopener" style="color:var(--brand-1);font-weight:600;text-decoration:underline;">Open in browser</a>`;
  }

  setGoogleLoading(bool) {
    const btn = document.getElementById('googleSignInBtn');
    if (!btn) return;
    btn.disabled = bool;
    btn.innerHTML = bool
      ? '<span class="btn-spinner"></span>Redirecting…'
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>Continue with Google`;
  }

  _addHandlerGoogleSignIn(handler) {
    document.getElementById('googleSignInBtn')?.addEventListener('click', handler);
  }

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

      if (!firstName)           { this._signUpErrorEl.textContent = 'Please enter your first name.'; return; }
      if (!lastName)            { this._signUpErrorEl.textContent = 'Please enter your last name.'; return; }
      if (!email)               { this._signUpErrorEl.textContent = 'Please enter your email.'; return; }
      if (password.length < 6)  { this._signUpErrorEl.textContent = 'Password must be at least 6 characters.'; return; }
      if (password !== confirm)  { this._signUpErrorEl.textContent = 'Passwords do not match.'; return; }

      handler({ firstName, lastName, email, password });
    });
  }

  _addHandlerForgotPassword(handler) {
    this._forgotForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._forgotErrorEl.textContent = '';
      const email = document.getElementById('forgotEmail')?.value.trim();
      if (!email) { this._forgotErrorEl.textContent = 'Please enter your email.'; return; }
      handler(email);
    });
  }

  _addHandlerAcceptInvite(handler) {
    this._inviteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._inviteErrorEl.textContent = '';
      const password = document.getElementById('invitePassword')?.value;
      const confirm  = document.getElementById('inviteConfirm')?.value;
      const pin      = document.getElementById('invitePin')?.value.trim();

      if (!password || password.length < 6) { this._inviteErrorEl.textContent = 'Password must be at least 6 characters.'; return; }
      if (password !== confirm)              { this._inviteErrorEl.textContent = 'Passwords do not match.'; return; }
      if (!pin || !/^\d{6}$/.test(pin))      { this._inviteErrorEl.textContent = 'PIN must be exactly 6 digits.'; return; }

      handler({ password, pin });
    });
  }

  _addHandlerResetPassword(handler) {
    this._resetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._resetErrorEl.textContent = '';
      const password = document.getElementById('resetPassword')?.value;
      const confirm  = document.getElementById('resetConfirm')?.value;
      if (!password || password.length < 6) { this._resetErrorEl.textContent = 'Password must be at least 6 characters.'; return; }
      if (password !== confirm)              { this._resetErrorEl.textContent = 'Passwords do not match.'; return; }
      handler(password);
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

  _slideTo(fromEl, toEl, direction, makeWide) {
    const DURATION = 220;
    const forward  = direction === 'forward';
    const outX     = forward ? '-28px' : '28px';
    const inX      = forward ? '28px'  : '-28px';
    const card     = this._overlay.querySelector('.auth-card');

    this.clearErrors();
    card.classList.add('auth-card--animating');
    setTimeout(() => card.classList.remove('auth-card--animating'), 700);

    const sweep = document.createElement('div');
    sweep.className = `auth-sweep auth-sweep--${forward ? 'forward' : 'back'}`;
    card.appendChild(sweep);
    requestAnimationFrame(() => requestAnimationFrame(() => sweep.classList.add('auth-sweep--active')));
    setTimeout(() => {
      sweep.style.transition = 'opacity 0.2s ease';
      sweep.style.opacity = '0';
      setTimeout(() => sweep.remove(), 220);
    }, 460);

    fromEl.style.transition = `opacity ${DURATION}ms ease, transform ${DURATION}ms ease`;
    fromEl.style.opacity    = '0';
    fromEl.style.transform  = `translateX(${outX})`;

    setTimeout(() => {
      fromEl.classList.add('hidden');
      fromEl.style.cssText = '';

      if (makeWide) card.classList.add('auth-card--wide');
      else          card.classList.remove('auth-card--wide');

      toEl.style.opacity   = '0';
      toEl.style.transform = `translateX(${inX})`;
      toEl.classList.remove('hidden');

      requestAnimationFrame(() => requestAnimationFrame(() => {
        toEl.style.transition = `opacity ${DURATION}ms ease, transform ${DURATION}ms ease`;
        toEl.style.opacity    = '1';
        toEl.style.transform  = 'translateX(0)';
        setTimeout(() => { toEl.style.cssText = ''; }, DURATION + 10);
      }));
    }, DURATION);
  }

  _slide(direction) {
    const forward = direction === 'forward';
    this._slideTo(
      forward ? this._loginForm  : this._signUpForm,
      forward ? this._signUpForm : this._loginForm,
      direction,
      forward,
    );
    setTimeout(() => { this._onSignUp = forward; }, 230);
  }
}

export default new AuthView();
