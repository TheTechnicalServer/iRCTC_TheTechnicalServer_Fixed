'use strict';

(() => {
  const U = globalThis.IRCTCFastUtils;
  const STORAGE_KEY = 'irctcPassengers';
  const CONFIG_VERSION = 8;
  const LIMITS = Object.freeze({ general: 6, tatkal: 4 });
  const PAYMENT_PROVIDERS = Object.freeze(['paytm-upi', 'bhim-upi', 'phonepe', 'razorpay']);
  const blankPassenger = () => ({ name: '', age: '', gender: 'Male', nationality: 'India', berth: 'No Preference', concession: 'None' });
  const defaults = Object.freeze({
    version: CONFIG_VERSION,
    bookingType: 'general',
    passengers: [blankPassenger()],
    contact: { countryCode: '+91', mobile: '', email: '' },
    preferences: { autoUpgradation: true, confirmBerths: false, travelInsurance: 'yes', paymentMode: 'upi', paymentProvider: 'paytm-upi', autoPreparePayment: false, autoContinue: true, autoReviewContinue: false, autoPayAndBook: false, autoPilot: false, developerMode: false }
  });
  const els = {};
  let config;

  const limitFor = (type) => LIMITS[type] || LIMITS.general;
  const cloneConfig = (source = defaults) => {
    const input = source || defaults;
    const bookingType = input.bookingType === 'tatkal' ? 'tatkal' : 'general';
    const rawPassengers = input.passengers?.length ? input.passengers : defaults.passengers;
    return {
      version: CONFIG_VERSION,
      bookingType,
      passengers: rawPassengers.slice(0, limitFor(bookingType)).map((passenger) => ({ ...blankPassenger(), ...passenger })),
      contact: { ...defaults.contact, ...(input.contact || {}) },
      preferences: {
        ...defaults.preferences,
        ...(input.preferences || {}),
        paymentProvider: PAYMENT_PROVIDERS.includes(input.preferences?.paymentProvider) ? input.preferences.paymentProvider : 'paytm-upi',
        autoPreparePayment: Boolean(input.preferences?.autoPreparePayment),
        autoReviewContinue: Boolean(input.preferences?.autoReviewContinue),
        autoPayAndBook: Boolean(input.preferences?.autoPayAndBook),
        autoPilot: Boolean(input.preferences?.autoPilot),
        developerMode: Boolean(input.preferences?.developerMode)
      }
    };
  };
  config = cloneConfig();

  const cacheEls = () => Object.assign(els, {
    form: document.getElementById('settingsForm'), bookingType: document.getElementById('bookingType'), limitNote: document.getElementById('passengerLimitNote'),
    passengerList: document.getElementById('passengerList'), template: document.getElementById('passengerTemplate'), addPassenger: document.getElementById('addPassenger'),
    resetDefaults: document.getElementById('resetDefaults'), toggleAutopilot: document.getElementById('toggleAutopilot'), message: document.getElementById('message'),
    mobile: document.getElementById('mobile'), email: document.getElementById('email'), autoUpgradation: document.getElementById('autoUpgradation'),
    confirmBerths: document.getElementById('confirmBerths'), paymentProvider: document.getElementById('paymentProvider'), lastPaymentMethodSection: document.getElementById('lastPaymentMethodSection'), autoPreparePayment: document.getElementById('autoPreparePayment'), autoContinue: document.getElementById('autoContinue'), autoReviewContinue: document.getElementById('autoReviewContinue'), autoPayAndBook: document.getElementById('autoPayAndBook'), autoPilot: document.getElementById('autoPilot'), developerMode: document.getElementById('developerMode')
  });

  const notify = (text, error = false) => {
    els.message.textContent = text;
    els.message.classList.toggle('error', error);
  };

  const saveThroughBackground = (next) => new Promise((resolve) => {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      resolve({ ok: false, error: 'Extension service worker is unavailable.' });
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: 'IRCTC_FAST_SAVE_CONFIG', config: next }, (response) => {
        const error = chrome.runtime.lastError;
        resolve(response || { ok: false, error: error?.message || 'Extension service worker did not respond.' });
      });
    } catch (error) {
      resolve({ ok: false, error: error.message || 'Extension save request failed.' });
    }
  });

  const saveConfig = async (value) => {
    const next = cloneConfig(value);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (await U.storageSet({ [STORAGE_KEY]: next })) {
        return { ok: true, config: next };
      }
      await U.delay(80);
    }
    const fallback = await saveThroughBackground(next);
    if (fallback.ok) {
      return { ok: true, config: cloneConfig(fallback.config || next) };
    }
    return { ok: false, error: fallback.error || 'Storage save failed. Reload the extension and try again.' };
  };
  const readPassengers = () => Array.from(els.passengerList.querySelectorAll('.passenger-card')).map((card) => {
    const passenger = {};
    card.querySelectorAll('[data-field]').forEach((field) => { passenger[field.dataset.field] = field.value.trim(); });
    return passenger;
  });
  const readForm = () => ({
    version: CONFIG_VERSION,
    bookingType: els.bookingType.value,
    passengers: readPassengers(),
    contact: { countryCode: '+91', mobile: els.mobile.value.replace(/\D/g, '').slice(0, 10), email: els.email.value.trim() },
    preferences: {
      autoUpgradation: els.autoUpgradation.checked, confirmBerths: els.confirmBerths.checked,
      travelInsurance: document.querySelector('input[name="travelInsurance"]:checked')?.value || 'yes',
      paymentMode: document.querySelector('input[name="paymentMode"]:checked')?.value || 'upi',
      paymentProvider: els.paymentProvider.value || 'paytm-upi',
      autoPreparePayment: els.autoPreparePayment.checked,
      autoContinue: els.autoContinue.checked, autoReviewContinue: els.autoReviewContinue.checked, autoPayAndBook: els.autoPayAndBook.checked, autoPilot: els.autoPilot.checked, developerMode: els.developerMode.checked
    }
  });
  const updateLimit = () => {
    const limit = limitFor(els.bookingType.value);
    const used = els.passengerList.querySelectorAll('.passenger-card').length;
    els.limitNote.textContent = `${used} of ${limit} passenger slots in use (${els.bookingType.value === 'tatkal' ? 'Tatkal' : 'General'}).`;
    els.addPassenger.disabled = used >= limit;
    els.addPassenger.textContent = used >= limit ? `Passenger limit reached (${limit})` : '+ Add Passenger';
    els.toggleAutopilot.textContent = els.autoPilot.checked ? 'Autofill ON' : 'Autofill OFF';
    els.toggleAutopilot.dataset.enabled = String(els.autoPilot.checked);
  };
  const renderPassengers = () => {
    const fragment = document.createDocumentFragment();
    config.passengers.forEach((passenger, index) => {
      const card = els.template.content.firstElementChild.cloneNode(true);
      card.dataset.index = String(index);
      card.querySelector('h2').textContent = `Passenger ${index + 1}`;
      card.querySelector('.remove-passenger').hidden = config.passengers.length === 1;
      card.querySelectorAll('[data-field]').forEach((field) => { field.value = passenger[field.dataset.field] || ''; });
      fragment.append(card);
    });
    els.passengerList.replaceChildren(fragment);
  };
  const render = () => {
    els.bookingType.value = config.bookingType;
    els.mobile.value = config.contact.mobile || '';
    els.email.value = config.contact.email || '';
    els.autoUpgradation.checked = Boolean(config.preferences.autoUpgradation);
    els.confirmBerths.checked = Boolean(config.preferences.confirmBerths);
    els.autoContinue.checked = Boolean(config.preferences.autoContinue);
    els.autoReviewContinue.checked = Boolean(config.preferences.autoReviewContinue);
    els.autoPayAndBook.checked = Boolean(config.preferences.autoPayAndBook);
    els.autoPilot.checked = Boolean(config.preferences.autoPilot);
    els.developerMode.checked = Boolean(config.preferences.developerMode);
    els.paymentProvider.value = config.preferences.paymentProvider || 'paytm-upi';
    els.autoPreparePayment.checked = Boolean(config.preferences.autoPreparePayment);
    const insurance = document.querySelector(`input[name="travelInsurance"][value="${config.preferences.travelInsurance}"]`);
    const payment = document.querySelector(`input[name="paymentMode"][value="${config.preferences.paymentMode}"]`);
    if (insurance) insurance.checked = true;
    if (payment) payment.checked = true;
    renderPassengers();
    updatePaymentAutomationControl();
    updateLimit();
  };
  const updatePaymentAutomationControl = () => {
    const upiSelected = document.querySelector('input[name="paymentMode"]:checked')?.value === 'upi';
    els.lastPaymentMethodSection.classList.toggle('is-disabled', !upiSelected);
    els.paymentProvider.disabled = !upiSelected;
    els.autoPreparePayment.disabled = !upiSelected;
    if (!upiSelected) els.autoPreparePayment.checked = false;
  };
  const validate = (next) => {
    const limit = limitFor(next.bookingType);
    if (!next.passengers.length) return 'Add at least one passenger.';
    if (next.passengers.length > limit) return `${next.bookingType === 'tatkal' ? 'Tatkal' : 'General'} allows at most ${limit} passengers.`;
    for (let index = 0; index < next.passengers.length; index += 1) {
      const passenger = next.passengers[index];
      const age = Number(passenger.age);
      if (passenger.name.trim().length < 2) return `Passenger ${index + 1}: enter a valid name.`;
      if (!Number.isFinite(age) || age < 0 || age > 100) return `Passenger ${index + 1}: age must be between 0 and 100.`;
    }
    if (next.contact.mobile && next.contact.mobile.length !== 10) return 'Mobile number must be exactly 10 digits.';
    if (next.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.contact.email)) return 'Enter a valid email address.';
    return '';
  };
  const save = async () => {
    const next = readForm();
    const error = validate(next);
    if (error) return notify(error, true);
    const result = await saveConfig(next);
    if (!result.ok) return notify(result.error, true);
    config = result.config;
    render();
    notify('Saved. Use the floating panel on the IRCTC passenger page.');
  };
  const setBookingType = () => {
    const next = readForm();
    const limit = limitFor(next.bookingType);
    if (next.passengers.length > limit) {
      next.passengers = next.passengers.slice(0, limit);
      notify(`Passenger list adjusted to the ${limit}-passenger ${next.bookingType === 'tatkal' ? 'Tatkal' : 'General'} limit.`);
    }
    config = cloneConfig(next);
    render();
  };
  const wire = () => {
    els.form.addEventListener('submit', (event) => { event.preventDefault(); save(); });
    els.addPassenger.addEventListener('click', () => {
      const next = readForm();
      if (next.passengers.length >= limitFor(next.bookingType)) return updateLimit();
      next.passengers.push(blankPassenger());
      config = cloneConfig(next); render();
    });
    els.passengerList.addEventListener('click', (event) => {
      const remove = event.target.closest('.remove-passenger');
      if (!remove) return;
      const next = readForm();
      if (next.passengers.length > 1) next.passengers.splice(Number(remove.closest('.passenger-card').dataset.index), 1);
      config = cloneConfig(next); render();
    });
    els.bookingType.addEventListener('change', setBookingType);
    document.querySelectorAll('input[name="paymentMode"]').forEach((input) => input.addEventListener('change', updatePaymentAutomationControl));
    els.autoPilot.addEventListener('change', updateLimit);
    els.toggleAutopilot.addEventListener('click', () => { els.autoPilot.checked = !els.autoPilot.checked; updateLimit(); });
    els.mobile.addEventListener('input', () => { els.mobile.value = els.mobile.value.replace(/\D/g, '').slice(0, 10); });
    els.resetDefaults.addEventListener('click', async () => { const result = await saveConfig(defaults); if (result.ok) { config = result.config; render(); notify('Defaults restored.'); } else notify(result.error, true); });
  };
  const init = async () => {
    cacheEls();
    const stored = await U.storageGet([STORAGE_KEY]);
    config = cloneConfig(stored[STORAGE_KEY] || defaults);
    if (!stored[STORAGE_KEY] || Number(stored[STORAGE_KEY].version || 0) < CONFIG_VERSION) await saveConfig(config);
    render(); wire();
  };
  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
