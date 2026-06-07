const THEME_KEY = 'pointbunny-theme';

const getTheme = () => localStorage.getItem(THEME_KEY) || 'dark';

const apply = (theme) => {
  document.body.setAttribute('data-theme', theme);
  const btn = document.getElementById('displayThemeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀︎' : '✦';
};

const toggle = () => {
  const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  apply(next);
  localStorage.setItem(THEME_KEY, next);
};

// Apply theme from localStorage on load
apply(getTheme());

// Keep in sync if cashier changes theme in the main window
window.addEventListener('storage', (e) => {
  if (e.key === THEME_KEY && e.newValue) apply(e.newValue);
});

// Wire toggle button
document.getElementById('displayThemeToggle')
  ?.addEventListener('click', toggle);
