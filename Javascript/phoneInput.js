import intlTelInput from 'intl-tel-input/dist/js/intlTelInputWithUtils.mjs';
import 'intl-tel-input/dist/css/intlTelInput-no-assets.css';
import flagsUrl   from 'url:intl-tel-input/dist/img/flags.webp';
import flags2xUrl from 'url:intl-tel-input/dist/img/flags@2x.webp';

document.documentElement.style.setProperty('--iti-path-flags-1x', `url(${flagsUrl})`);
document.documentElement.style.setProperty('--iti-path-flags-2x', `url(${flags2xUrl})`);

export function initPhoneInput(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  const iti = intlTelInput(el, {
    initialCountry: 'us',
    separateDialCode: true,
    countrySearch: true,
    formatOnDisplay: true,
    dropdownContainer: document.body,
  });

  // CSS alone can lose the z-index race against Parcel's style injection order,
  // so also force it inline whenever the dropdown opens.
  el.addEventListener('open:countrydropdown', () => {
    const container = document.querySelector('.iti--container');
    if (container) container.style.setProperty('z-index', '10000', 'important');
  });

  return iti;
}
