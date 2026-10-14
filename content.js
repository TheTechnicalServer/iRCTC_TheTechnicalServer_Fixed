'use strict';

(() => {
  if (window.__irctcAutoBookFastLoaded || location.hostname !== 'www.irctc.co.in') {
    return;
  }
  window.__irctcAutoBookFastLoaded = true;

  const U = globalThis.IRCTCFastUtils;
  const STORAGE_KEY = 'irctcPassengers';
  const POSITION_KEY = 'irctcAutoBookPopupPosition';
  const EXTENSION_ROOT_SELECTOR = '#irctc-fast-popup, #irctc-fast-settings';
  const CONFIG_VERSION = 8;
  const PASSENGER_LIMITS = Object.freeze({ general: 6, tatkal: 4 });
  const PAYMENT_PROVIDERS = Object.freeze(['paytm-upi', 'bhim-upi', 'phonepe', 'razorpay']);
  const FAST_CONTROL_DELAY = 12;
  const AUTO_START_DELAY = 65;
  const PASSENGER_RENDER_TIMEOUT = 1100;

  const blankPassenger = () => ({
    name: '',
    age: '',
    gender: 'Male',
    nationality: 'India',
    berth: 'No Preference',
    concession: 'None'
  });

  const defaultConfig = Object.freeze({
    version: CONFIG_VERSION,
    bookingType: 'general',
    passengers: [blankPassenger()],
    contact: { countryCode: '+91', mobile: '', email: '' },
    preferences: {
      autoUpgradation: true,
      confirmBerths: false,
      travelInsurance: 'yes',
      paymentMode: 'upi',
      paymentProvider: 'paytm-upi',
      autoPreparePayment: false,
      autoContinue: true,
      autoReviewContinue: false,
      autoPayAndBook: false,
      autoPilot: false,
      developerMode: false
    }
  });

  const selectors = Object.freeze({
    nameInputs: [
      'input[placeholder="Passenger Name"]',
      'input[placeholder="Full Name as per Govt. ID"]',
      'input[formcontrolname="passengerName"]',
      'input[placeholder*="Name"]'
    ],
    ageInputs: [
      'input[placeholder="Age"]',
      'input[formcontrolname="passengerAge"]'
    ],
    genderControls: [
      'select[formcontrolname="passengerGender"]',
      'select[formcontrolname="gender"]',
      'p-dropdown[formcontrolname="gender"]',
      'p-dropdown[formcontrolname="passengerGender"]'
    ],
    nationalityControls: [
      'select[formcontrolname="passengerNationality"]',
      'select[formcontrolname="nationality"]',
      'p-dropdown[formcontrolname="nationality"]',
      'p-dropdown[formcontrolname="passengerNationality"]'
    ],
    berthControls: [
      'select[formcontrolname="passengerBerthChoice"]',
      'select[formcontrolname="passengerBerthChoiceCode"]',
      'p-dropdown[formcontrolname="passengerBerthChoiceCode"]',
      'p-dropdown[formcontrolname="passengerBerthChoice"]'
    ],
    addPassenger: [
      '#psgn-form span.prenext',
      '#psgn-form a[tabindex="0"]',
      'span.add-passenger-span',
      'a.add-passenger-span',
      'button.add-passenger-span',
      '[class*="add-passenger"]',
      '.prenext'
    ],
    mobile: [
      'input[formcontrolname="mobileNumber"]',
      'input[placeholder="Passenger mobile number *"]',
      'input[placeholder*="mobile"]'
    ],
    email: [
      'input[formcontrolname="email"]',
      'input[type="email"]',
      'input[placeholder*="Email"]'
    ],
    autoUpgrade: [
      'p-checkbox[formcontrolname="autoUpgradation"]',
      'p-checkbox[formcontrolname="autoUpgradationSelected"]',
      'input[formcontrolname="autoUpgradationSelected"]',
      'input[formcontrolname="autoUpgradation"]'
    ],
    confirmBerths: [
      'p-checkbox[formcontrolname="bookOnlyIfConfirmBerths"]',
      'p-checkbox[formcontrolname="bookOnlyIfCnf"]',
      'input[formcontrolname="bookOnlyIfCnf"]',
      'input[formcontrolname="bookOnlyIfConfirmBerths"]'
    ],
    insuranceYes: [
      'p-radiobutton[formcontrolname="travelInsuranceOpted"][value="true"]',
      'p-radiobutton[formcontrolname="travelInsuranceOpted"][id^="travelInsuranceOptedYes"]',
      'p-radiobutton[formcontrolname="travelInsuranceOpted"][inputid="travelInsuranceOptedY"]',
      'input[name*="travelInsurance"][value="true"]'
    ],
    insuranceNo: [
      'p-radiobutton[formcontrolname="travelInsuranceOpted"][value="false"]',
      'p-radiobutton[formcontrolname="travelInsuranceOpted"][id^="travelInsuranceOptedNo"]',
      'p-radiobutton[formcontrolname="travelInsuranceOpted"][inputid="travelInsuranceOptedN"]',
      'input[name*="travelInsurance"][value="false"]'
    ],
    paymentUpi: [
      'p-radiobutton[formcontrolname="paymentType"][id="2"]',
      'p-radiobutton[formcontrolname="paymentMode"][inputid="paymentMode2"]',
      'p-radiobutton[formcontrolname="paymentType"][inputid="paymentMode2"]',
      'input[name*="payment"][value*="UPI" i]'
    ],
    paymentCards: [
      'p-radiobutton[formcontrolname="paymentType"][id="3"]',
      'p-radiobutton[formcontrolname="paymentMode"][inputid="paymentMode1"]',
      'p-radiobutton[formcontrolname="paymentType"][inputid="paymentMode1"]',
      'input[name*="payment"][value*="CARD" i]'
    ],
    continueButtons: [
      'button.btnSubmit[type="submit"]',
      'button.train_Search[type="submit"]',
      'button[type="submit"]'
    ],
  });

  const state = {
    config: {
      version: CONFIG_VERSION,
      bookingType: 'general',
      passengers: [blankPassenger()],
      contact: { ...defaultConfig.contact },
      preferences: { ...defaultConfig.preferences }
    },
    popup: null,
    status: null,
    progress: null,
    chips: null,
    timer: null,
    autoPilotButton: null,
    autoPilotFooter: null,
    minimized: false,
    isRunning: false,
    shouldStop: false,
    automationPaused: false,
    cached: new Map(),
    startTime: 0,
    settingsPanel: null,
    autoPilotWatcherStarted: false,
    autoPilotObserver: null,
    routeCheckTimer: 0,
    lastAutoPilotKey: '',
    lastAutoPilotAt: 0,
    reviewContinueKey: '',
    payAndBookKey: '',
    payAndBookRunning: false,
    reviewContinueRunning: false,
    paymentPreparedKey: '',
    paymentPrepareRunning: false,
    paymentCategoryKey: '',
    paymentPrepareAttempts: 0,
    completedFillKey: '',
    autoPilotSavePending: false,
    submitLocked: false,
    submitLockKey: '',
    submitLockAt: 0,
    fillButton: null,
    passengerInfoCount: null,
    footerPax: null,
    pageStage: null,
    headerMode: null,
    continueIndicator: null,
    clock: null,
    log: null,
    logs: [],
    refreshTimer: 0,
    searchButton: null,
    refillButton: null,
    stopButtons: []
  };

  const isLegacyDefaultPassengers = (passengers = []) => passengers.length === 2 &&
    passengers[0]?.name === 'Ravi Kumar' &&
    passengers[1]?.name === 'Priya Sharma';

  const cloneConfig = (config = defaultConfig) => {
    const source = config || defaultConfig;
    const legacy = Number(source.version || 0) < CONFIG_VERSION;
    const preferences = { ...defaultConfig.preferences, ...(source.preferences || {}) };
    preferences.paymentProvider = PAYMENT_PROVIDERS.includes(preferences.paymentProvider) ? preferences.paymentProvider : 'paytm-upi';
    if (legacy) {
      preferences.autoContinue = true;
    }
    const bookingType = source.bookingType === 'tatkal' ? 'tatkal' : 'general';
    const passengerLimit = PASSENGER_LIMITS[bookingType];
    return {
    version: CONFIG_VERSION,
    bookingType,
    passengers: isLegacyDefaultPassengers(source.passengers) ?
      [blankPassenger()] :
      ((source.passengers && source.passengers.length ? source.passengers : defaultConfig.passengers).slice(0, passengerLimit).map((passenger) => ({
        ...blankPassenger(),
        ...passenger
      }))),
    contact: { ...defaultConfig.contact, ...(source.contact || {}) },
    preferences: {
      ...preferences,
      autoPreparePayment: Boolean(preferences.autoPreparePayment),
      autoReviewContinue: Boolean(preferences.autoReviewContinue),
      autoPayAndBook: Boolean(preferences.autoPayAndBook),
      autoPilot: Boolean(preferences.autoPilot),
      developerMode: Boolean(preferences.developerMode)
    }
  };
  };

  const loadConfig = async () => {
    const data = await U.storageGet([STORAGE_KEY, POSITION_KEY]);
    state.config = cloneConfig(data[STORAGE_KEY] || state.config || defaultConfig);
    return data;
  };

  const saveDefaultIfNeeded = async () => {
    const data = await U.storageGet([STORAGE_KEY]);
    if (data[STORAGE_KEY] && (isLegacyDefaultPassengers(data[STORAGE_KEY].passengers) || Number(data[STORAGE_KEY].version || 0) < CONFIG_VERSION)) {
      await U.storageSet({ [STORAGE_KEY]: cloneConfig(data[STORAGE_KEY]) });
    }
  };

  const sendRuntimeMessage = (message) => new Promise((resolve) => {
    if (!globalThis.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      resolve({ ok: false, error: 'Runtime messaging is unavailable.' });
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime.lastError;
        resolve(response || { ok: false, error: error ? error.message : 'No response from extension service worker.' });
      });
    } catch (error) {
      resolve({ ok: false, error: error.message || 'Runtime messaging failed.' });
    }
  });

  const saveConfig = async (config) => {
    const nextConfig = cloneConfig(config);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (await U.storageSet({ [STORAGE_KEY]: nextConfig })) {
        return { ok: true, config: nextConfig, via: 'direct' };
      }
      await U.delay(80);
    }
    const fallback = await sendRuntimeMessage({ type: 'IRCTC_FAST_SAVE_CONFIG', config: nextConfig });
    return fallback && fallback.ok ?
      { ok: true, config: cloneConfig(fallback.config || nextConfig), via: 'background' } :
      { ok: false, error: fallback?.error || 'Storage save failed.' };
  };

  const saveAutoPilotPreference = async (enabled) => {
    const nextConfig = cloneConfig(state.config);
    nextConfig.preferences.autoPilot = Boolean(enabled);

    const backgroundSave = await sendRuntimeMessage({
      type: 'IRCTC_FAST_SET_AUTOPILOT',
      enabled: Boolean(enabled),
      config: nextConfig
    });
    if (backgroundSave && backgroundSave.ok) {
      return { ok: true, config: cloneConfig(backgroundSave.config || nextConfig), via: 'background' };
    }

    return saveConfig(nextConfig);
  };

  const isExtensionNode = (el) => Boolean(el && el.closest && el.closest(EXTENSION_ROOT_SELECTOR));

  const passengerFormRoot = () => document.querySelector('#psgn-form') ||
    document.querySelector('app-passenger-input') ||
    document.body;

  const queryFirst = (selectorList, root = document, cacheKey = '') => {
    if (cacheKey && state.cached.has(cacheKey)) {
      const cached = state.cached.get(cacheKey);
      if (cached && cached.isConnected && !isExtensionNode(cached)) {
        return cached;
      }
      state.cached.delete(cacheKey);
    }
    for (const selector of selectorList) {
      const el = root.querySelector(selector);
      if (el && !isExtensionNode(el)) {
        if (cacheKey) {
          state.cached.set(cacheKey, el);
        }
        return el;
      }
    }
    return null;
  };

  const queryAll = (selectorList, root = document) => {
    const found = [];
    const seen = new WeakSet();
    for (const selector of selectorList) {
      for (const el of root.querySelectorAll(selector)) {
        if (!seen.has(el) && !isExtensionNode(el)) {
          seen.add(el);
          found.push(el);
        }
      }
    }
    return found;
  };

  const findClickableText = (needle, root = document) => {
    const lower = needle.toLowerCase();
    const candidates = Array.from(root.querySelectorAll('button, a, span, div[role="button"], label'))
      .filter((el) => !isExtensionNode(el) && U.isVisible(el) && U.textOf(el).toLowerCase().includes(lower))
      .map((el) => {
        const text = U.textOf(el);
        const rect = el.getBoundingClientRect();
        return { el, text, area: rect.width * rect.height };
      })
      .sort((a, b) => {
        const exactA = a.text.toLowerCase().startsWith(lower) ? 0 : 1;
        const exactB = b.text.toLowerCase().startsWith(lower) ? 0 : 1;
        return exactA - exactB || a.text.length - b.text.length || a.area - b.area;
      });
    const candidate = candidates[0]?.el;
    return candidate?.closest('a, button, [role="button"]') || candidate || null;
  };

  const clickFast = (el) => {
    if (!el || state.shouldStop) {
      return false;
    }
    const target = el.closest?.('button, a, [role="button"], label') || el;
    if (target.disabled || target.getAttribute?.('aria-disabled') === 'true') {
      return false;
    }
    try {
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
    } catch (_error) {
      // Some PrimeNG virtual elements cannot be scrolled; clicking can continue.
    }
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    target.click();
    return true;
  };

  const updateUi = (status, progress, tone = 'gold') => {
    requestAnimationFrame(() => {
      if (state.status) {
        state.status.textContent = status;
        state.status.dataset.tone = tone;
        state.status.classList.remove('irctc-fast-text-blink');
        void state.status.offsetWidth;
        state.status.classList.add('irctc-fast-text-blink');
      }
      if (state.progress) {
        state.progress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
      }
      if (state.timer && state.startTime) {
        state.timer.textContent = `${((performance.now() - state.startTime) / 1000).toFixed(2)} s`;
      }
      if (state.fillButton) {
        state.fillButton.disabled = state.isRunning || state.submitLocked;
        state.fillButton.textContent = state.submitLocked ? 'Continue sent' :
          (state.config.preferences.autoContinue ? 'Fill & Continue' : 'Fill passenger data');
      }
      if (state.refillButton) {
        state.refillButton.disabled = state.isRunning;
      }
      updateStopButtons();
    });
  };

  const logEvent = (level, message) => {
    const entry = `${new Date().toLocaleTimeString()} ${level.toUpperCase()} ${message}`;
    state.logs.unshift(entry);
    state.logs.splice(10);
    if (state.log && state.config.preferences.developerMode) {
      state.log.textContent = state.logs.join('\n');
      state.log.hidden = false;
    } else if (state.log) {
      state.log.hidden = true;
    }
  };

  const isReviewBookingPage = () => /\/nget\/booking\/reviewBooking\/?$/i.test(location.pathname);
  const isPaymentOptionsPage = () => /\/nget\/payment\/bkgPaymentOptions\/?$/i.test(location.pathname);

  const detectPage = () => {
    const path = location.pathname;
    const text = U.textOf(document.body).toLowerCase();
    if (/psgninput/i.test(path) || document.querySelector('#psgn-form, app-passenger-input')) return 'Passenger details';
    if (isReviewBookingPage()) return 'Review — user Continue required';
    if (isPaymentOptionsPage()) return 'Payment — user approval required';
    if (/payment/i.test(path) || /payment options|make payment/i.test(text)) return 'Payment — manual';
    if (/booking-confirm|ticket-confirm|confirmation/i.test(path) || /booking confirmed|ticket booked/i.test(text)) return 'Confirmation';
    if (/train-search|train-list/i.test(path)) return 'Waiting for passenger page';
    if (/error|unable to process|something went wrong/i.test(text)) return 'IRCTC message';
    return 'IRCTC page';
  };

  const refreshPageStatus = () => {
    const now = new Date();
    if (state.clock) state.clock.textContent = now.toLocaleTimeString();
    if (state.pageStage) state.pageStage.textContent = detectPage();
    if (state.headerMode) {
      const limit = PASSENGER_LIMITS[state.config.bookingType] || PASSENGER_LIMITS.general;
      state.headerMode.textContent = `${state.config.bookingType === 'tatkal' ? 'Tatkal' : 'General'} · ${limit}`;
    }
    if (state.log) {
      state.log.hidden = !state.config.preferences.developerMode;
      if (state.config.preferences.developerMode) state.log.textContent = state.logs.join('\n') || 'No diagnostic events yet.';
    }
  };

  const flashClickTarget = (target) => {
    const el = target?.closest?.('button, label, input, select, .irctc-fast-chip') || target;
    if (!el || !el.classList) {
      return;
    }
    el.classList.remove('irctc-fast-clicked');
    void el.offsetWidth;
    el.classList.add('irctc-fast-clicked');
    setTimeout(() => el.classList.remove('irctc-fast-clicked'), 520);
  };

  const renderChips = () => {
    if (!state.chips) {
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const passenger of state.config.passengers.slice(0, 6)) {
      fragment.append(U.build('span', {
        class: 'irctc-fast-chip',
        text: `${passenger.name || 'Passenger'} - ${passenger.age || '-'}`
      }));
    }
    state.chips.replaceChildren(fragment);
    const label = `${state.config.passengers.length} passenger${state.config.passengers.length === 1 ? '' : 's'}`;
    if (state.passengerInfoCount) {
      state.passengerInfoCount.textContent = label;
    }
    if (state.footerPax) {
      state.footerPax.textContent = `${state.config.passengers.length} pax`;
    }
  };

  const passengerPageKey = () => `${location.pathname}${location.search}`;

  const updateContinueIndicator = (sent = false) => {
    if (!state.continueIndicator) {
      return;
    }
    state.continueIndicator.textContent = sent ? 'Continue sent' : 'Continue ready';
    state.continueIndicator.dataset.sent = String(sent);
  };

  const updateStopButtons = () => {
    for (const button of state.stopButtons) {
      button.textContent = state.automationPaused ? 'Start' : 'Stop';
      button.title = state.automationPaused ? 'Resume extension automation' : 'Stop extension automation';
      button.setAttribute('aria-pressed', String(state.automationPaused));
    }
  };

  const resetSubmitLock = () => {
    state.submitLocked = false;
    state.submitLockKey = '';
    state.submitLockAt = 0;
    if (state.fillButton) {
      state.fillButton.disabled = false;
      state.fillButton.textContent = state.config.preferences.autoContinue ? 'Fill & Continue' : 'Fill passenger data';
    }
    updateContinueIndicator(false);
  };

  const lockSubmit = () => {
    state.submitLocked = true;
    state.submitLockKey = passengerPageKey();
    state.submitLockAt = performance.now();
    if (state.fillButton) {
      state.fillButton.disabled = true;
      state.fillButton.textContent = 'Continue sent';
    }
    updateContinueIndicator(true);
  };

  const buildPopup = () => {
    const root = U.build('section', {
      id: 'irctc-fast-popup',
      class: 'irctc-fast-popup',
      role: 'region',
      'aria-label': 'IRCTC TheTechnicalServer'
    });

    const header = U.build('div', { class: 'irctc-fast-header' }, [
      U.build('div', { class: 'irctc-fast-title' }, [
        U.build('span', { text: 'IRCTC_TheTechnicalServer' })
      ]),
      U.build('strong', { class: 'irctc-fast-header-mode', id: 'irctc-fast-header-mode', text: 'General · 6' }),
      U.build('button', { class: 'irctc-fast-continue-indicator', id: 'irctc-fast-continue-indicator', type: 'button', disabled: true, text: 'Continue ready' }),
      U.build('button', { class: 'irctc-fast-header-stop', type: 'button', dataset: { action: 'stop' }, text: 'Stop' }),
      U.build('button', { class: 'irctc-fast-header-max', type: 'button', title: 'Maximize', dataset: { action: 'minimize' }, text: '+' }),
      U.build('span', { class: 'irctc-fast-drag-hint', title: 'Drag panel', text: 'DRAG' })
    ]);

    const body = U.build('div', { class: 'irctc-fast-body' }, [
      U.build('div', { class: 'irctc-fast-dashboard', 'aria-label': 'IRCTC page status' }, [
        U.build('div', {}, [U.build('span', { text: 'PAGE' }), U.build('strong', { id: 'irctc-fast-page-stage', text: 'Checking page' })]),
        U.build('div', {}, [U.build('span', { text: 'TIME' }), U.build('strong', { id: 'irctc-fast-clock', text: '--:--:--' })])
      ]),
      U.build('div', { class: 'irctc-fast-info-panel' }, [
        U.build('div', { class: 'irctc-fast-info-head' }, [
          U.build('span', { text: 'PSG INFO' }),
          U.build('strong', { id: 'irctc-fast-passenger-count', text: `${state.config.passengers.length} passenger${state.config.passengers.length === 1 ? '' : 's'}` })
        ]),
        U.build('div', { class: 'irctc-fast-chips', id: 'irctc-fast-chips' })
      ]),
      U.build('div', { class: 'irctc-fast-status-row' }, [
        U.build('span', { class: 'irctc-fast-dot' }),
        U.build('span', { class: 'irctc-fast-status', id: 'irctc-fast-status', text: 'Ready for IRCTC passenger page' })
      ]),
      U.build('div', { class: 'irctc-fast-progress-wrap' }, [
        U.build('div', { class: 'irctc-fast-progress', id: 'irctc-fast-progress' })
      ]),
      U.build('pre', { class: 'irctc-fast-log', id: 'irctc-fast-log', hidden: true, text: '' }),
      U.build('footer', { class: 'irctc-fast-footer' }, [
        U.build('span', { id: 'irctc-fast-footer-pax', text: `${state.config.passengers.length} pax` }),
        U.build('span', { text: 'Autopilot: OFF', id: 'irctc-fast-autopilot' }),
        U.build('span', { id: 'irctc-fast-timer', text: '0.00 s' })
      ]),
      U.build('div', { class: 'irctc-fast-actions' }, [
        U.build('div', { class: 'irctc-fast-primary-actions' }, [
          U.build('button', { class: 'irctc-fast-fill', type: 'button', dataset: { action: 'fill' }, text: 'Fill & Continue' })
        ]),
        U.build('div', { class: 'irctc-fast-secondary-actions' }, [
          U.build('button', { class: 'irctc-fast-refill', type: 'button', dataset: { action: 'refill' }, text: 'Refill only (no submit)' }),
          U.build('button', { class: 'irctc-fast-payment-setup', type: 'button', dataset: { action: 'preparePayment' }, text: 'Prepare UPI / Paytm' }),
          U.build('button', { class: 'irctc-fast-stop', type: 'button', dataset: { action: 'stop' }, text: 'Stop' }),
          U.build('button', { class: 'irctc-fast-auto-toggle', type: 'button', title: 'Autofill passenger page: OFF', dataset: { action: 'autopilot' }, text: 'Autofill OFF', 'aria-pressed': 'false' }),
          U.build('button', { class: 'irctc-fast-icon-btn', type: 'button', title: 'Quick settings', dataset: { action: 'settings' }, text: 'Settings' }),
          U.build('button', { class: 'irctc-fast-icon-btn', type: 'button', title: 'Minimize panel', dataset: { action: 'minimize' }, text: 'Minimize' })
        ])
      ])
    ]);

    root.append(header, body);
    return { root, header };
  };

  const injectPopup = async (storedPosition) => {
    if (document.getElementById('irctc-fast-popup')) {
      return;
    }
    const { root, header } = buildPopup();
    document.documentElement.append(root);

    state.popup = root;
    state.status = root.querySelector('#irctc-fast-status');
    state.progress = root.querySelector('#irctc-fast-progress');
    state.chips = root.querySelector('#irctc-fast-chips');
    state.timer = root.querySelector('#irctc-fast-timer');
    state.autoPilotButton = root.querySelector('[data-action="autopilot"]');
    state.autoPilotFooter = root.querySelector('#irctc-fast-autopilot');
    state.fillButton = root.querySelector('[data-action="fill"]');
    state.refillButton = root.querySelector('[data-action="refill"]');
    state.stopButtons = Array.from(root.querySelectorAll('[data-action="stop"]'));
    state.passengerInfoCount = root.querySelector('#irctc-fast-passenger-count');
    state.footerPax = root.querySelector('#irctc-fast-footer-pax');
    state.pageStage = root.querySelector('#irctc-fast-page-stage');
    state.headerMode = root.querySelector('#irctc-fast-header-mode');
    state.continueIndicator = root.querySelector('#irctc-fast-continue-indicator');
    state.clock = root.querySelector('#irctc-fast-clock');
    state.log = root.querySelector('#irctc-fast-log');
    if (storedPosition) {
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.left = `${storedPosition.left}px`;
      root.style.top = `${storedPosition.top}px`;
    }

    renderChips();
    updateAutopilotText();
    updateStopButtons();
    refreshPageStatus();
    wirePopup(root, header);
  };

  const updateAutopilotText = () => {
    const enabled = Boolean(state.config.preferences.autoPilot);
    const el = state.autoPilotFooter || document.getElementById('irctc-fast-autopilot');
    if (el) {
      el.textContent = `Autopilot: ${enabled ? 'ON' : 'OFF'}`;
    }
    const button = state.autoPilotButton || document.querySelector('[data-action="autopilot"]');
    if (button) {
      button.textContent = `Autofill ${enabled ? 'ON' : 'OFF'}`;
      button.dataset.enabled = String(enabled);
      button.dataset.saving = String(state.autoPilotSavePending);
      button.title = `Autofill passenger page: ${enabled ? 'ON' : 'OFF'}`;
      button.setAttribute('aria-pressed', String(enabled));
      button.disabled = state.autoPilotSavePending;
    }
    if (state.popup) {
      state.popup.classList.toggle('is-autopilot-on', enabled);
    }
    const settingsToggle = state.settingsPanel?.querySelector('[name="autoPilot"]');
    if (settingsToggle) {
      settingsToggle.checked = enabled;
    }
  };

  const setAutoPilotPreference = async (enabled, runWhenReady = false) => {
    if (state.autoPilotSavePending) {
      return false;
    }

    const previousConfig = cloneConfig(state.config);
    state.autoPilotSavePending = true;
    state.config.preferences.autoPilot = Boolean(enabled);
    updateAutopilotText();
    updateUi(`Saving Autopilot ${enabled ? 'ON' : 'OFF'}`, 8, 'gold');

    const result = await saveAutoPilotPreference(enabled);
    state.autoPilotSavePending = false;

    if (!result.ok) {
      state.config = previousConfig;
      updateAutopilotText();
      updateUi('Autopilot could not save. Reload extension once.', 100, 'error');
      return false;
    }

    state.config = cloneConfig(result.config);
    updateAutopilotText();
    updateUi(`Autopilot ${enabled ? 'ON' : 'OFF'} saved`, 0, enabled ? 'success' : 'gold');
    if (enabled && runWhenReady) {
      state.lastAutoPilotKey = '';
      scheduleAutoPilot('toggle');
    }
    return true;
  };

  const toggleAutopilot = () => setAutoPilotPreference(!state.config.preferences.autoPilot, true);

  const updateMinimizeButtons = (root) => {
    for (const button of root.querySelectorAll('[data-action="minimize"]')) {
      const isHeaderMax = button.classList.contains('irctc-fast-header-max');
      button.textContent = state.minimized ? '+' : '-';
      button.title = state.minimized ? 'Maximize' : (isHeaderMax ? 'Maximize' : 'Minimize');
      button.setAttribute('aria-label', state.minimized ? 'Maximize popup' : 'Minimize popup');
    }
  };

  const wirePopup = (root, header) => {
    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) {
        return;
      }
      flashClickTarget(button);
      const action = button.dataset.action;
      if (action === 'fill') {
        runAutoBook();
      } else if (action === 'refill') {
        // Refill is an explicit recovery action. It can re-enter cleared data,
        // but it must never send another Continue/submit request.
        runAutoBook({ force: true, allowContinue: false, source: 'refill' });
      } else if (action === 'preparePayment') {
        preparePaymentFromPanel();
      } else if (action === 'stop') {
        toggleAutomation();
      } else if (action === 'autopilot') {
        toggleAutopilot();
      } else if (action === 'minimize') {
        state.minimized = !state.minimized;
        root.classList.toggle('is-minimized', state.minimized);
        updateMinimizeButtons(root);
      } else if (action === 'settings') {
        toggleInlineSettings();
      }
    });

    let drag = null;
    const onMove = (event) => {
      if (!drag) {
        return;
      }
      event.preventDefault();
      const left = Math.max(8, Math.min(innerWidth - root.offsetWidth - 8, event.clientX - drag.x));
      const top = Math.max(8, Math.min(innerHeight - root.offsetHeight - 8, event.clientY - drag.y));
      requestAnimationFrame(() => {
        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
        root.style.right = 'auto';
        root.style.bottom = 'auto';
      });
    };
    const onUp = async () => {
      if (!drag) {
        return;
      }
      drag = null;
      removeEventListener('pointermove', onMove, U.active);
      removeEventListener('pointerup', onUp, U.passive);
      const rect = root.getBoundingClientRect();
      await U.storageSet({ [POSITION_KEY]: { left: Math.round(rect.left), top: Math.round(rect.top) } });
    };
    header.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) {
        return;
      }
      const rect = root.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      addEventListener('pointermove', onMove, U.active);
      addEventListener('pointerup', onUp, U.passive);
    }, U.passive);
  };

  const failIfStopped = () => {
    if (state.shouldStop) {
      throw new Error('Stopped');
    }
  };

  const hasUsablePassengerData = () => state.config.passengers.some((passenger) => passenger.name && passenger.age);

  const validateConfig = () => {
    const passengers = state.config.passengers || [];
    const passengerLimit = PASSENGER_LIMITS[state.config.bookingType] || PASSENGER_LIMITS.general;
    if (!passengers.length) {
      throw new Error('Add at least one passenger in settings.');
    }
    if (passengers.length > passengerLimit) {
      throw new Error(`${state.config.bookingType === 'tatkal' ? 'Tatkal' : 'General'} supports up to ${passengerLimit} passengers.`);
    }
    passengers.forEach((passenger, index) => {
      if (!passenger.name || passenger.name.trim().length < 2) {
        throw new Error(`Passenger ${index + 1}: name is missing.`);
      }
      const age = Number(passenger.age);
      if (!Number.isFinite(age) || age < 0 || age > 100) {
        throw new Error(`Passenger ${index + 1}: age must be 0-100.`);
      }
    });
    const mobile = (state.config.contact.mobile || '').replace(/\D/g, '');
    if (mobile && mobile.length !== 10) {
      throw new Error('Mobile number must be 10 digits.');
    }
  };

  const renderInlinePassenger = (passenger, index) => U.build('article', {
    class: 'irctc-fast-settings-card',
    dataset: { index: String(index) }
  }, [
    U.build('div', { class: 'irctc-fast-settings-title', text: `Passenger ${index + 1}` }),
    U.build('input', { type: 'text', placeholder: 'Name', value: passenger.name || '', dataset: { field: 'name' } }),
    U.build('input', { type: 'number', placeholder: 'Age', min: '0', max: '100', value: passenger.age || '', dataset: { field: 'age' } }),
    U.build('select', { dataset: { field: 'gender' } }, ['Male', 'Female', 'Transgender'].map((item) => U.build('option', {
      value: item,
      text: item,
      selected: (passenger.gender || 'Male') === item
    }))),
    U.build('select', { dataset: { field: 'berth' } }, ['No Preference', 'Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper', 'Window Side'].map((item) => U.build('option', {
      value: item,
      text: item,
      selected: (passenger.berth || 'No Preference') === item
    }))),
    U.build('button', { type: 'button', class: 'irctc-fast-settings-remove', dataset: { action: 'removePassenger' }, text: 'Remove', hidden: state.config.passengers.length === 1 })
  ]);

  const renderInlineSettings = () => {
    const passengerList = state.settingsPanel.querySelector('[data-panel="passengers"]');
    const fragment = document.createDocumentFragment();
    state.config.passengers.forEach((passenger, index) => {
      fragment.append(renderInlinePassenger(passenger, index));
    });
    passengerList.replaceChildren(fragment);
    state.settingsPanel.querySelector('[name="mobile"]').value = state.config.contact.mobile || '';
    state.settingsPanel.querySelector('[name="autoPilot"]').checked = Boolean(state.config.preferences.autoPilot);
    state.settingsPanel.querySelector('[name="autoContinue"]').checked = Boolean(state.config.preferences.autoContinue);
    state.settingsPanel.querySelector('[name="autoReviewContinue"]').checked = Boolean(state.config.preferences.autoReviewContinue);
    state.settingsPanel.querySelector('[name="autoPayAndBook"]').checked = Boolean(state.config.preferences.autoPayAndBook);
    state.settingsPanel.querySelector('[name="paymentMode"][value="upi"]').checked = state.config.preferences.paymentMode !== 'cards';
    state.settingsPanel.querySelector('[name="paymentMode"][value="cards"]').checked = state.config.preferences.paymentMode === 'cards';
    state.settingsPanel.querySelector('[name="paymentProvider"]').value = state.config.preferences.paymentProvider || 'paytm-upi';
    state.settingsPanel.querySelector('[name="autoPreparePayment"]').checked = Boolean(state.config.preferences.autoPreparePayment);
    syncInlinePaymentControls();
  };

  const syncInlinePaymentControls = () => {
    const upiSelected = state.settingsPanel.querySelector('[name="paymentMode"]:checked')?.value === 'upi';
    const provider = state.settingsPanel.querySelector('[name="paymentProvider"]');
    const automatic = state.settingsPanel.querySelector('[name="autoPreparePayment"]');
    provider.disabled = !upiSelected;
    automatic.disabled = !upiSelected;
    if (!upiSelected) automatic.checked = false;
  };

  const readInlineSettings = () => ({
    version: CONFIG_VERSION,
    bookingType: state.config.bookingType,
    passengers: Array.from(state.settingsPanel.querySelectorAll('.irctc-fast-settings-card')).map((card) => ({
      name: card.querySelector('[data-field="name"]').value.trim(),
      age: card.querySelector('[data-field="age"]').value.trim(),
      gender: card.querySelector('[data-field="gender"]').value,
      nationality: 'India',
      berth: card.querySelector('[data-field="berth"]').value,
      concession: 'None'
    })),
    contact: {
      countryCode: '+91',
      mobile: state.settingsPanel.querySelector('[name="mobile"]').value.replace(/\D/g, '').slice(0, 10),
      email: state.config.contact.email || ''
    },
    preferences: {
      ...state.config.preferences,
      paymentMode: state.settingsPanel.querySelector('[name="paymentMode"]:checked')?.value || 'upi',
      paymentProvider: state.settingsPanel.querySelector('[name="paymentProvider"]').value || 'paytm-upi',
      autoPreparePayment: state.settingsPanel.querySelector('[name="autoPreparePayment"]').checked,
      autoContinue: state.settingsPanel.querySelector('[name="autoContinue"]').checked,
      autoReviewContinue: state.settingsPanel.querySelector('[name="autoReviewContinue"]').checked,
      autoPayAndBook: state.settingsPanel.querySelector('[name="autoPayAndBook"]').checked,
      autoPilot: state.settingsPanel.querySelector('[name="autoPilot"]').checked
    }
  });

  const toggleInlineSettings = async () => {
    await loadConfig();
    if (state.settingsPanel) {
      state.settingsPanel.hidden = !state.settingsPanel.hidden;
      renderInlineSettings();
      return;
    }

    const panel = U.build('section', { class: 'irctc-fast-settings', id: 'irctc-fast-settings' }, [
      U.build('div', { class: 'irctc-fast-settings-head' }, [
        U.build('strong', { text: 'Quick Settings' }),
        U.build('button', { type: 'button', dataset: { action: 'closeSettings' }, text: 'X' })
      ]),
      U.build('div', { class: 'irctc-fast-settings-list', dataset: { panel: 'passengers' } }),
      U.build('button', { type: 'button', class: 'irctc-fast-settings-add', dataset: { action: 'addPassenger' }, text: '+ Add Passenger' }),
      U.build('label', { class: 'irctc-fast-settings-row' }, [
        U.build('span', { text: 'Mobile' }),
        U.build('input', { name: 'mobile', type: 'tel', maxlength: '10', placeholder: '10 digit mobile' })
      ]),
      U.build('div', { class: 'irctc-fast-settings-row' }, [
        U.build('span', { text: 'Payment' }),
        U.build('label', {}, [U.build('input', { name: 'paymentMode', type: 'radio', value: 'upi' }), ' BHIM/UPI']),
        U.build('label', {}, [U.build('input', { name: 'paymentMode', type: 'radio', value: 'cards' }), ' Cards'])
      ]),
      U.build('label', { class: 'irctc-fast-settings-row' }, [
        U.build('span', { text: 'UPI provider' }),
        U.build('select', { name: 'paymentProvider' }, [
          U.build('option', { value: 'paytm-upi', text: 'Paytm UPI (default)' }),
          U.build('option', { value: 'bhim-upi', text: 'BHIM UPI' }),
          U.build('option', { value: 'phonepe', text: 'PhonePe' }),
          U.build('option', { value: 'razorpay', text: 'Razorpay' })
        ])
      ]),
      U.build('label', { class: 'irctc-fast-settings-row' }, [
        U.build('span', { text: 'Last payment method' }),
        U.build('label', {}, [U.build('input', { name: 'autoPreparePayment', type: 'checkbox' }), ' Set UPI automatically'])
      ]),
      U.build('label', { class: 'irctc-fast-settings-row' }, [
        U.build('span', { text: 'Auto click Pay & Book (QR)' }),
        U.build('input', { name: 'autoPayAndBook', type: 'checkbox' })
      ]),
      U.build('label', { class: 'irctc-fast-settings-row' }, [
        U.build('span', { text: 'Autopilot' }),
        U.build('input', { name: 'autoPilot', type: 'checkbox' })
      ]),
      U.build('label', { class: 'irctc-fast-settings-row' }, [
        U.build('span', { text: 'Auto click Continue' }),
        U.build('input', { name: 'autoContinue', type: 'checkbox' })
      ]),
      U.build('label', { class: 'irctc-fast-settings-row' }, [
        U.build('span', { text: 'Auto Continue review' }),
        U.build('input', { name: 'autoReviewContinue', type: 'checkbox' })
      ]),
      U.build('button', { type: 'button', class: 'irctc-fast-settings-save', dataset: { action: 'saveSettings' }, text: 'Save Configuration' })
    ]);

    panel.addEventListener('input', (event) => {
      if (event.target.name === 'mobile') {
        event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
      }
    });
    panel.addEventListener('change', (event) => {
      if (event.target.name === 'paymentMode') {
        syncInlinePaymentControls();
      }
    });

    panel.addEventListener('click', async (event) => {
      flashClickTarget(event.target);
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) {
        return;
      }
      if (action === 'closeSettings') {
        panel.hidden = true;
      } else if (action === 'addPassenger') {
        state.config = readInlineSettings();
        const limit = PASSENGER_LIMITS[state.config.bookingType] || PASSENGER_LIMITS.general;
        if (state.config.passengers.length >= limit) {
          updateUi(`${state.config.bookingType === 'tatkal' ? 'Tatkal' : 'General'} passenger limit is ${limit}.`, 100, 'gold');
          return;
        }
        state.config.passengers.push(blankPassenger());
        renderInlineSettings();
      } else if (action === 'removePassenger') {
        const index = Number(event.target.closest('.irctc-fast-settings-card').dataset.index);
        state.config = readInlineSettings();
        if (state.config.passengers.length > 1) {
          state.config.passengers.splice(index, 1);
        }
        renderInlineSettings();
      } else if (action === 'saveSettings') {
        state.config = cloneConfig(readInlineSettings());
        const result = await saveConfig(state.config);
        if (result.ok) {
          state.config = cloneConfig(result.config);
          renderChips();
          updateAutopilotText();
          updateUi('Settings saved', 0, 'success');
          panel.hidden = true;
        } else {
          updateUi('Settings could not save. Try again after reload.', 100, 'error');
        }
      }
    });

    document.documentElement.append(panel);
    state.settingsPanel = panel;
    renderInlineSettings();
  };

  const waitForReady = async () => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      return;
    }
    await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  };

  const usableControls = (controls) => controls.filter((el) => U.isVisible(el) && !el.disabled && el.type !== 'hidden');

  const controlCount = (root = passengerFormRoot()) => Math.max(
    usableControls(queryAll(selectors.nameInputs, root)).length,
    usableControls(queryAll(selectors.ageInputs, root)).length,
    usableControls(queryAll(selectors.genderControls, root)).length
  );

  const findAddPassengerButton = () => {
    const root = passengerFormRoot();
    const seen = new WeakSet();
    const candidates = [
      ...queryAll(selectors.addPassenger, root),
      findClickableText('+ Add Passenger', root),
      findClickableText('Add Passenger', root)
    ].filter((el) => {
      if (!el || seen.has(el) || !U.isVisible(el)) {
        return false;
      }
      seen.add(el);
      const text = U.textOf(el).toLowerCase();
      return text.includes('add') || text.includes('passenger') || el.matches?.('[class*="add-passenger"], .prenext');
    });
    return candidates
      .map((el) => el.closest?.('button, a, [role="button"]') || el)
      .find((el) => el && U.isVisible(el) && !el.disabled) || null;
  };

  const waitForPassengerCount = async (expected, timeout = 2600) => {
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      failIfStopped();
      const count = controlCount();
      if (count >= expected) {
        return count;
      }
      await U.delay(25);
    }
    return controlCount();
  };

  const ensurePassengerSlots = async (targetCount) => {
    let count = controlCount();
    while (count < targetCount) {
      failIfStopped();
      const expected = count + 1;
      let nextCount = count;
      for (let attempt = 0; attempt < 3 && nextCount < expected; attempt += 1) {
        const add = findAddPassengerButton();
        if (!add) {
          throw new Error(`Only ${count || 1} passenger slot found, and Add Passenger is not visible.`);
        }
        updateUi(`Adding passenger slot ${expected}/${targetCount}`, 15 + Math.round((count / targetCount) * 10));
        clickFast(add);
        nextCount = await waitForPassengerCount(expected, 1100 + (attempt * 400));
      }
      if (nextCount < expected) {
        throw new Error(`Add Passenger did not create passenger ${expected}.`);
      }
      count = nextCount;
    }
  };

  const selectNative = (select, wanted) => {
    const normalized = String(wanted || '').toLowerCase();
    const options = Array.from(select.options || []);
    const match = options.find((option) => {
      const text = option.textContent.trim().toLowerCase();
      const value = String(option.value || '').toLowerCase();
      return text === normalized || text.includes(normalized) || value === normalized || value.includes(normalized);
    });
    if (match) {
      select.value = match.value;
      U.dispatchNative(select);
      return true;
    }
    const fallback = options.find((option) => /no preference/i.test(option.textContent || '')) || options[0];
    if (fallback && /berth|passengerBerthChoice/i.test(select.getAttribute('formcontrolname') || '')) {
      select.value = fallback.value;
      U.dispatchNative(select);
      return true;
    }
    return false;
  };

  const selectPrimeDropdown = async (dropdown, wanted) => {
    if (!dropdown) {
      return false;
    }
    clickFast(dropdown.querySelector('.ui-dropdown-trigger, .p-dropdown-trigger') || dropdown);
    await U.delay(FAST_CONTROL_DELAY);
    const options = Array.from(document.querySelectorAll('.ui-dropdown-item, .p-dropdown-item, li[role="option"]'));
    const normalized = String(wanted || '').toLowerCase();
    const option = options.find((item) => !isExtensionNode(item) && U.isVisible(item) && U.textOf(item).toLowerCase().includes(normalized));
    if (option) {
      clickFast(option);
      return true;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  };

  const setDropdownValue = async (control, wanted) => {
    if (!control || !wanted) {
      return false;
    }
    if (control.tagName === 'SELECT') {
      return selectNative(control, wanted);
    }
    return selectPrimeDropdown(control, wanted);
  };

  const fillPassengers = async () => {
    const passengers = state.config.passengers;
    const root = passengerFormRoot();
    let names = usableControls(queryAll(selectors.nameInputs, root));
    let ages = usableControls(queryAll(selectors.ageInputs, root));
    let genders = usableControls(queryAll(selectors.genderControls, root));
    let nationalities = usableControls(queryAll(selectors.nationalityControls, root));
    let berths = usableControls(queryAll(selectors.berthControls, root));

    if (names.length < passengers.length || ages.length < passengers.length) {
      await U.waitForElement(() => {
        const currentRoot = passengerFormRoot();
        const currentNames = usableControls(queryAll(selectors.nameInputs, currentRoot));
        const currentAges = usableControls(queryAll(selectors.ageInputs, currentRoot));
        return currentNames.length >= passengers.length && currentAges.length >= passengers.length ? currentRoot : null;
      }, PASSENGER_RENDER_TIMEOUT);
      names = usableControls(queryAll(selectors.nameInputs, root));
      ages = usableControls(queryAll(selectors.ageInputs, root));
      genders = usableControls(queryAll(selectors.genderControls, root));
      nationalities = usableControls(queryAll(selectors.nationalityControls, root));
      berths = usableControls(queryAll(selectors.berthControls, root));
    }

    if (names.length < passengers.length || ages.length < passengers.length) {
      throw new Error(`Passenger fields are not ready. Found ${Math.min(names.length, ages.length)} of ${passengers.length}.`);
    }

    for (let index = 0; index < passengers.length; index += 1) {
      failIfStopped();
      const passenger = passengers[index];
      U.setNativeValue(names[index], passenger.name.trim().toUpperCase());
      U.setNativeValue(ages[index], String(passenger.age));
      await setDropdownValue(genders[index], passenger.gender);
      await setDropdownValue(nationalities[index], passenger.nationality || 'India');
      await setDropdownValue(berths[index], passenger.berth || 'No Preference');
      updateUi(`Filled passenger ${index + 1}/${passengers.length}`, 20 + Math.round(((index + 1) / passengers.length) * 45));
    }
    await U.raf();
  };

  const fillContact = async () => {
    const mobile = queryFirst(selectors.mobile, document, 'mobile');
    if (mobile && state.config.contact.mobile) {
      U.setNativeValue(mobile, state.config.contact.mobile.replace(/\D/g, '').slice(-10));
    }
    const email = queryFirst(selectors.email, document, 'email');
    if (email && state.config.contact.email) {
      U.setNativeValue(email, state.config.contact.email.trim());
    }
  };

  const controlChecked = (el) => {
    if (!el) {
      return false;
    }
    const input = el.matches('input') ? el : el.querySelector('input');
    return Boolean(input && input.checked);
  };

  const setBooleanControl = (selectorList, enabled) => {
    const el = queryFirst(selectorList);
    if (!el) {
      return false;
    }
    const input = el.matches('input') ? el : el.querySelector('input');
    if (input) {
      if (input.checked !== enabled) {
        clickFast(el.matches('input') ? input : el);
      }
      U.dispatchNative(input, ['change', 'input']);
      return true;
    }
    if (controlChecked(el) !== enabled) {
      clickFast(el);
    }
    return true;
  };

  const radioChecked = (control) => {
    if (!control) {
      return false;
    }
    const input = control.matches('input') ? control : control.querySelector('input[type="radio"]');
    const box = control.matches('[role="radio"]') ? control : control.querySelector('[role="radio"], .ui-radiobutton-box, .p-radiobutton-box');
    return Boolean(
      (input && input.checked) ||
      (box && box.getAttribute('aria-checked') === 'true') ||
      (box && /\b(ui-state-active|p-highlight)\b/.test(box.className || ''))
    );
  };

  const clickRadioControl = (control) => {
    if (!control) {
      return false;
    }
    const root = control.matches('input') ? (control.closest('p-radiobutton') || control.closest('label') || control) : control;
    const id = root.id || control.id || '';
    const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    const target = label ||
      root.closest('label') ||
      root.querySelector('[role="radio"], .ui-radiobutton-box, .p-radiobutton-box') ||
      root;
    clickFast(target);

    const input = control.matches('input') ? control : root.querySelector('input[type="radio"]');
    if (input) {
      input.checked = true;
      U.dispatchNative(input, ['input', 'change']);
    }
    return true;
  };

  const clickRadioByText = (formName, textCandidates, fallbackIndex) => {
    const controls = Array.from(document.querySelectorAll(`p-radiobutton[formcontrolname="${formName}"], input[type="radio"][formcontrolname="${formName}"]`));
    for (const control of controls) {
      const shell = control.closest('label, div, span') || control;
      const text = U.textOf(shell).toLowerCase();
      if (textCandidates.some((candidate) => text.includes(candidate))) {
        return clickRadioControl(control);
      }
    }
    if (controls[fallbackIndex]) {
      return clickRadioControl(controls[fallbackIndex]);
    }
    return false;
  };

  const setPaymentMode = async (mode) => {
    const wantedId = mode === 'cards' ? '3' : '2';
    const textHints = mode === 'cards' ? ['card', 'credit', 'debit', 'net banking'] : ['upi', 'bhim'];
    const controls = Array.from(document.querySelectorAll('p-radiobutton[formcontrolname="paymentType"], p-radiobutton[formcontrolname="paymentMode"], input[type="radio"][name="paymentType"]'));
    const direct = controls.find((control) => {
      const input = control.matches('input') ? control : control.querySelector('input[type="radio"]');
      return control.id === wantedId || input?.value === wantedId;
    });
    const byText = controls.find((control) => {
      const shell = control.closest('label, span, div') || control;
      const text = U.textOf(shell).toLowerCase();
      return textHints.some((hint) => text.includes(hint));
    });
    const control = direct || byText || queryFirst(mode === 'cards' ? selectors.paymentCards : selectors.paymentUpi);
    if (!clickRadioControl(control)) {
      return false;
    }
    await U.delay(FAST_CONTROL_DELAY);
    if (!radioChecked(control)) {
      clickRadioControl(control);
      await U.delay(FAST_CONTROL_DELAY);
    }
    return radioChecked(control);
  };

  const paymentProviderHints = (provider) => ({
    'paytm-upi': ['paytm upi', 'paytm'],
    'bhim-upi': ['bhim upi', 'bhim'],
    phonepe: ['phonepe', 'phone pe'],
    razorpay: ['razorpay']
  }[provider] || ['paytm upi', 'paytm']);

  const findRadioByHints = (hints) => {
    const normalizedHints = hints.map((hint) => hint.toLowerCase());
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const match = radios.find((input) => {
      const wrapper = input.closest('label, p-radiobutton, .p-radiobutton, .ui-radiobutton, [role="radio"]');
      const text = [
        input.name,
        input.id,
        input.value,
        input.getAttribute('aria-label'),
        U.textOf(wrapper || input.parentElement || input)
      ].filter(Boolean).join(' ').toLowerCase();
      return normalizedHints.some((hint) => text.includes(hint));
    });
    return match?.closest('label, p-radiobutton, .p-radiobutton, .ui-radiobutton, [role="radio"]') || match || null;
  };

  const findPaymentChoiceByHints = (hints) => {
    const normalizedHints = hints.map((hint) => hint.toLowerCase());
    const cards = Array.from(document.querySelectorAll(
      '.bank-type, [tabindex="0"].link, .border-all, [role="tab"], label, p-radiobutton, .p-radiobutton, .ui-radiobutton'
    ));
    return cards.find((card) => {
      if (isExtensionNode(card) || !U.isVisible(card)) {
        return false;
      }
      const text = U.textOf(card).toLowerCase();
      return normalizedHints.some((hint) => text.includes(hint));
    }) || null;
  };

  const clickFirstVisibleText = (hints) => {
    const paymentChoice = findPaymentChoiceByHints(hints);
    if (paymentChoice && clickFast(paymentChoice)) {
      return true;
    }
    for (const hint of hints) {
      const target = findClickableText(hint);
      if (target && clickFast(target)) {
        return true;
      }
    }
    return false;
  };

  const normalizedPaymentText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const findIrctcPaymentControl = (label) => {
    const wanted = normalizedPaymentText(label);
    return Array.from(document.querySelectorAll('div[tabindex="0"].bank-type, div[tabindex="0"].border-all.link'))
      .find((control) => !isExtensionNode(control) && U.isVisible(control) && normalizedPaymentText(U.textOf(control)).includes(wanted)) || null;
  };

  const clickIrctcPaymentControl = (control) => {
    if (!control || state.shouldStop || state.automationPaused || control.getAttribute('aria-disabled') === 'true') {
      return false;
    }
    try {
      control.scrollIntoView({ block: 'center', inline: 'nearest' });
      control.focus({ preventScroll: true });
      control.click();
      return true;
    } catch (_error) {
      return false;
    }
  };

  const preparePaymentSelection = async ({ force = false } = {}) => {
    if (state.shouldStop || state.paymentPrepareRunning || !isPaymentOptionsPage()) {
      return false;
    }
    const pageKey = `${location.pathname}${location.search}`;
    if (!force && state.paymentPreparedKey === pageKey) {
      return true;
    }
    if (force || state.paymentCategoryKey !== pageKey) {
      state.paymentPrepareAttempts = 0;
      if (force) state.paymentCategoryKey = '';
    }
    if (!force && state.paymentPrepareAttempts >= 8) {
      updateUi('UPI provider did not appear. Use Prepare UPI / Paytm once after IRCTC finishes loading.', 100, 'gold');
      return false;
    }

    state.paymentPrepareRunning = true;
    try {
      const provider = state.config.preferences.paymentProvider || 'paytm-upi';
      if (state.config.preferences.paymentMode === 'cards') {
        state.paymentPreparedKey = pageKey;
        updateUi('Cards selected. Review the method and click Pay & Book yourself.', 100, 'gold');
        return true;
      }

      const providerName = provider === 'paytm-upi' ? 'Paytm UPI' : provider === 'bhim-upi' ? 'BHIM UPI' : provider === 'phonepe' ? 'PhonePe' : 'Razorpay';
      updateUi(`Opening BHIM/UPI/USSD for ${providerName}`, 35);
      const upiCategory = await U.waitForElement(() => findIrctcPaymentControl('BHIM/ UPI/ USSD'), 3200);
      if (!upiCategory) {
        state.paymentPrepareAttempts += 1;
        updateUi(`Waiting for BHIM/UPI/USSD (${state.paymentPrepareAttempts}/8).`, 35, 'gold');
        return false;
      }
      if (state.paymentCategoryKey !== pageKey && clickIrctcPaymentControl(upiCategory)) {
        state.paymentCategoryKey = pageKey;
      }

      const providerCard = await U.waitForElement(() => findIrctcPaymentControl(providerName), 3200);
      if (state.shouldStop || state.automationPaused) {
        return false;
      }
      const providerSelected = clickIrctcPaymentControl(providerCard);

      if (providerSelected) {
        state.paymentPreparedKey = pageKey;
        state.paymentPrepareAttempts = 0;
        updateUi(`${providerName} selected.${state.config.preferences.autoPayAndBook ? ' Clicking Pay & Book.' : ' Verify it, then click Pay & Book yourself.'}`, 100, 'success');
        if (state.config.preferences.autoPayAndBook) {
          state.paymentPrepareRunning = false;
          await clickPayAndBook();
        }
      } else {
        state.paymentPrepareAttempts += 1;
        updateUi(`Waiting for ${provider === 'paytm-upi' ? 'Paytm UPI' : 'UPI provider'} (${state.paymentPrepareAttempts}/8).`, 65, 'gold');
      }
      return providerSelected;
    } catch (error) {
      logEvent('warn', `Payment setup: ${error.message || 'selection unavailable'}`);
      updateUi('Payment options need manual selection. Pay & Book is never clicked automatically.', 100, 'gold');
      return false;
    } finally {
      state.paymentPrepareRunning = false;
    }
  };

  const findPayAndBookButton = () => Array.from(document.querySelectorAll('button, a.btn, input[type="submit"], input[type="button"]'))
    .filter((el) => !isExtensionNode(el) && U.isVisible(el))
    .find((el) => /pay\s*(&|and)\s*book/i.test(U.textOf(el) || el.value || ''));

  // Clicks IRCTC's own "Pay & Book" once so the gateway (QR / UPI) page opens.
  // The payment itself is never completed here: the user scans the QR and pays.
  const clickPayAndBook = async () => {
    const pageKey = `${location.pathname}${location.search}`;
    if (state.payAndBookRunning || state.payAndBookKey === pageKey || state.shouldStop || state.automationPaused ||
        !state.config.preferences.autoPayAndBook || state.config.preferences.paymentMode !== 'upi') {
      return false;
    }
    state.payAndBookRunning = true;
    try {
      // Give IRCTC a moment to register the provider selection and enable the button.
      await U.delay(500);
      const button = await U.waitForElement(() => {
        const candidate = findPayAndBookButton();
        return candidate && !candidate.disabled && candidate.getAttribute('aria-disabled') !== 'true' ? candidate : null;
      }, 6000);
      if (!button || state.shouldStop || state.automationPaused || !isPaymentOptionsPage()) {
        updateUi('Pay & Book button not ready. Click it yourself.', 100, 'gold');
        return false;
      }
      state.payAndBookKey = pageKey;
      button.scrollIntoView({ block: 'center', inline: 'nearest' });
      button.focus({ preventScroll: true });
      button.click();
      updateUi('Pay & Book clicked once. Scan the QR / approve UPI to pay.', 100, 'success');
      return true;
    } catch (error) {
      logEvent('warn', `Pay & Book: ${error.message || 'click failed'}`);
      return false;
    } finally {
      state.payAndBookRunning = false;
    }
  };

  const preparePaymentFromPanel = async () => {
    await loadConfig();
    if (state.automationPaused) {
      updateUi('Automation is stopped. Press Start to prepare payment.', 0, 'gold');
      return false;
    }
    if (!isPaymentOptionsPage()) {
      updateUi('Open IRCTC Payment Options to prepare UPI/Paytm.', 0, 'gold');
      return false;
    }
    return preparePaymentSelection({ force: true });
  };

  const setPreferences = async () => {
    const prefs = state.config.preferences;
    setBooleanControl(selectors.autoUpgrade, Boolean(prefs.autoUpgradation));
    setBooleanControl(selectors.confirmBerths, Boolean(prefs.confirmBerths));

    if (prefs.travelInsurance === 'yes') {
      clickRadioControl(queryFirst(selectors.insuranceYes)) || clickRadioByText('travelInsuranceOpted', ['yes'], 0);
    } else {
      clickRadioControl(queryFirst(selectors.insuranceNo)) || clickRadioByText('travelInsuranceOpted', ['no'], 1);
    }

    await setPaymentMode(prefs.paymentMode === 'cards' ? 'cards' : 'upi');
    await U.raf();
  };

  const clickContinue = async () => {
    if (state.submitLocked && state.submitLockKey === passengerPageKey()) {
      updateUi('Continue already submitted. Waiting for IRCTC response.', 100, 'success');
      return false;
    }
    const buttons = queryAll(selectors.continueButtons).filter((button) => U.isVisible(button) && /continue/i.test(U.textOf(button)));
    const button = buttons.find((item) => !item.classList.contains('mob-bot-btn')) || buttons[0] || findClickableText('Continue');
    if (!button) {
      throw new Error('Continue button is not visible.');
    }
    lockSubmit();
    button.dataset.irctcFastSubmitted = 'true';
    clickFast(button);
    await U.delay(FAST_CONTROL_DELAY);
    return true;
  };

  const reviewPageKey = () => `${location.pathname}${location.search}`;

  const clickReviewContinue = async () => {
    const pageKey = reviewPageKey();
    if (state.reviewContinueRunning || state.reviewContinueKey === pageKey || state.shouldStop) {
      return false;
    }
    const buttons = Array.from(document.querySelectorAll('button.btnPrimary, button.train_Search, button[type="submit"]'))
      .filter((button) => !isExtensionNode(button) && U.isVisible(button) && /continue/i.test(U.textOf(button)));
    const button = buttons[0] || findClickableText('Continue');
    if (!button || !U.isVisible(button)) {
      throw new Error('Review Continue button is not visible.');
    }

    state.reviewContinueRunning = true;
    state.reviewContinueKey = pageKey;
    updateContinueIndicator(true);
    button.dataset.irctcFastReviewSubmitted = 'true';
    clickFast(button);
    await U.delay(50);
    return true;
  };

  const handleModals = async () => {
    const pageText = U.textOf(document.body).toLowerCase();
    if (pageText.includes('request is under process') || pageText.includes('multiple request')) {
      state.submitLocked = true;
      state.submitLockKey = passengerPageKey();
      state.submitLockAt = performance.now();
      updateUi('IRCTC is already processing. Duplicate submit blocked.', 100, 'error');
      logEvent('warn', 'IRCTC processing state detected; duplicate action blocked.');
      return;
    }
    const manualPrompt = Array.from(document.querySelectorAll('[role="dialog"], .ui-dialog, .modal, .modal-dialog')).find((el) => U.isVisible(el));
    if (manualPrompt) {
      updateUi('IRCTC needs your review. No dialog button was clicked.', 100, 'gold');
      logEvent('info', 'A site dialog was detected and left for the user to review.');
    }
  };

  const stopRun = (message) => {
    state.automationPaused = true;
    state.shouldStop = true;
    state.isRunning = false;
    state.reviewContinueRunning = false;
    state.paymentPrepareRunning = false;
    clearTimeout(state.routeCheckTimer);
    updateStopButtons();
    updateUi(message, 0, 'error');
  };

  const startAutomation = () => {
    state.automationPaused = false;
    state.shouldStop = false;
    state.reviewContinueRunning = false;
    state.paymentPrepareRunning = false;
    updateStopButtons();
    updateUi('Automation resumed', 0, 'success');
    scheduleAutoPilot('resume');
  };

  const toggleAutomation = () => {
    if (state.automationPaused) {
      startAutomation();
    } else {
      stopRun('Automation stopped instantly');
    }
  };

  const runAutoBook = async ({ force = false, allowContinue, source = 'fill' } = {}) => {
    if (state.automationPaused) {
      updateUi('Automation is stopped. Press Start to resume.', 0, 'gold');
      return;
    }
    if (state.isRunning) {
      return;
    }
    const runKey = passengerPageKey();
    if (!force && state.completedFillKey === runKey) {
      updateUi('Passenger data is already filled on this page. Use Refill data only if fields were cleared.', 100, 'success');
      return;
    }
    if (state.submitLocked && state.submitLockKey === passengerPageKey()) {
      updateUi('Continue already submitted. Duplicate filling is blocked.', 100, 'success');
      return;
    }
    if (state.submitLocked && state.submitLockKey !== passengerPageKey()) {
      resetSubmitLock();
    }
    state.isRunning = true;
    state.shouldStop = false;
    state.cached.clear();
    state.startTime = performance.now();

    try {
      await loadConfig();
      const shouldContinue = allowContinue === undefined ? Boolean(state.config.preferences.autoContinue) : Boolean(allowContinue);
      renderChips();
      updateAutopilotText();
      validateConfig();
      if (!isPassengerInputPage()) {
        throw new Error('Open the IRCTC passenger details page before using passenger autofill.');
      }

      updateUi('Checking page readiness', 5);
      await waitForReady();
      failIfStopped();

      updateUi('Preparing passenger slots', 15);
      await ensurePassengerSlots(state.config.passengers.length);
      failIfStopped();

      updateUi('Filling passengers', 25);
      await fillPassengers();
      failIfStopped();

      updateUi('Filling contact details', 72);
      await fillContact();
      failIfStopped();

      updateUi('Setting preferences', 84);
      await setPreferences();
      failIfStopped();

      await handleModals();

      if (shouldContinue) {
        updateUi('Clicking Continue', 94);
        const submitted = await clickContinue();
        if (submitted) {
          await handleModals();
        }
      } else if (source === 'refill') {
        updateUi('Passenger data refilled. Continue was not clicked.', 100, 'success');
      }

      const elapsed = ((performance.now() - state.startTime) / 1000).toFixed(2);
      state.completedFillKey = runKey;
      updateUi(
        shouldContinue ? `Filled in ${elapsed} s. Continue clicked once; waiting for IRCTC.` : `Passenger data filled in ${elapsed} s.`,
        100,
        'success'
      );
      logEvent('info', `${source === 'refill' ? 'Passenger refill' : 'Passenger autofill'} completed in ${elapsed} s.`);
    } catch (error) {
      const message = error && error.message === 'Stopped' ? 'Stopped instantly' : `Error: ${error.message || 'Automation failed'}`;
      updateUi(message, 100, 'error');
      logEvent('error', message);
    } finally {
      state.isRunning = false;
      state.shouldStop = false;
      state.cached.clear();
    }
  };

  const isPassengerInputPage = () => /\/nget\/booking\/psgninput/i.test(location.pathname) ||
    Boolean(document.querySelector('#psgn-form, app-passenger-input'));

  const maybeRunAutoPilot = async (reason = 'page') => {
    if (state.isRunning || state.shouldStop || state.automationPaused) {
      return;
    }
    await loadConfig();
    updateAutopilotText();
    if (isReviewBookingPage()) {
      if (!state.config.preferences.autoReviewContinue) {
        updateUi('Review Journey ready. Enable Auto Continue review to proceed once.', 0, 'gold');
        return;
      }
      const reviewKey = reviewPageKey();
      if (state.reviewContinueKey === reviewKey) {
        return;
      }
      updateUi('Review page ready. Clicking Continue once.', 85);
      await waitForReady();
      await U.delay(AUTO_START_DELAY);
      if (state.config.preferences.autoReviewContinue && isReviewBookingPage() && !state.shouldStop) {
        const submitted = await clickReviewContinue();
        if (submitted) {
          updateUi('Review Continue sent once. Waiting for IRCTC.', 100, 'success');
        }
      }
      return;
    }
    if (isPaymentOptionsPage()) {
      if (state.config.preferences.paymentMode === 'upi' && state.config.preferences.autoPreparePayment) {
        await waitForReady();
        await preparePaymentSelection();
      } else {
        updateUi('Payment ready. Enable Last Payment Method or use Prepare UPI / Paytm.', 0, 'gold');
      }
      return;
    }
    if (!isPassengerInputPage()) {
      state.lastAutoPilotKey = '';
      state.lastAutoPilotAt = 0;
      state.completedFillKey = '';
      resetSubmitLock();
      return;
    }
    if (state.submitLocked && state.submitLockKey && state.submitLockKey !== passengerPageKey()) {
      resetSubmitLock();
    }
    if (state.submitLocked && state.submitLockKey === passengerPageKey()) {
      return;
    }
    if (!state.config.preferences.autoPilot || !hasUsablePassengerData()) {
      return;
    }
    if (!document.querySelector('#psgn-form, app-passenger-input') && controlCount() === 0) {
      updateUi('Autopilot waiting for passenger form', 2);
      return;
    }
    const runKey = `${location.pathname}${location.search}`;
    if (state.completedFillKey === runKey) {
      return;
    }
    const now = performance.now();
    if (state.lastAutoPilotKey === runKey && now - state.lastAutoPilotAt < 10000) {
      return;
    }
    state.lastAutoPilotKey = runKey;
    state.lastAutoPilotAt = now;
    updateUi(reason === 'toggle' ? 'Autopilot starting' : 'Autopilot armed', 3);
    await U.delay(AUTO_START_DELAY);
    if (state.config.preferences.autoPilot && isPassengerInputPage() && !state.isRunning) {
      runAutoBook({ source: 'autofill' });
    }
  };

  const scheduleAutoPilot = (reason = 'page') => {
    if (state.automationPaused) {
      return;
    }
    clearTimeout(state.routeCheckTimer);
    state.routeCheckTimer = setTimeout(() => {
      maybeRunAutoPilot(reason);
    }, 70);
  };

  const haltPageAutomation = () => {
    state.shouldStop = true;
    clearTimeout(state.routeCheckTimer);
    clearInterval(state.refreshTimer);
    state.autoPilotObserver?.disconnect();
  };

  const startAutoPilotWatcher = () => {
    if (state.autoPilotWatcherStarted) {
      return;
    }
    state.autoPilotWatcherStarted = true;
    const wrapHistory = (method) => {
      try {
        const original = history[method];
        history[method] = function wrappedHistoryState(...args) {
          const result = original.apply(this, args);
          scheduleAutoPilot('navigation');
          return result;
        };
      } catch (_error) {
        // History wrapping is best-effort; mutation and popstate watchers still cover page readiness.
      }
    };
    wrapHistory('pushState');
    wrapHistory('replaceState');
    addEventListener('popstate', () => scheduleAutoPilot('navigation'), U.passive);
    state.autoPilotObserver = new MutationObserver(U.debounce(() => {
      if (isPassengerInputPage() || isReviewBookingPage() || isPaymentOptionsPage()) {
        scheduleAutoPilot('page ready');
      }
    }, 55));
    state.autoPilotObserver.observe(document.documentElement, { childList: true, subtree: true });
    // IRCTC redirects to an external payment gateway in a new document. This
    // content script is scoped to irctc.co.in only; pagehide also stops its
    // timers before that hand-off so no DOM action can survive the navigation.
    addEventListener('pagehide', haltPageAutomation, U.passive);
  };

  const init = async () => {
    try {
      const data = await loadConfig();
      await saveDefaultIfNeeded();
      const mount = async () => {
        await injectPopup(data[POSITION_KEY]);
        startAutoPilotWatcher();
        scheduleAutoPilot('init');
        refreshPageStatus();
        clearInterval(state.refreshTimer);
        state.refreshTimer = setInterval(refreshPageStatus, 1000);
      };
      if (document.documentElement) {
        mount();
      } else {
        document.addEventListener('DOMContentLoaded', mount, { once: true });
      }
    } catch (error) {
      console.warn('TheTechnicalServer_AutoFill could not initialize:', error.message);
    }
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) {
      return;
    }
    const wasAutoPilot = Boolean(changes[STORAGE_KEY].oldValue?.preferences?.autoPilot);
    state.config = cloneConfig(changes[STORAGE_KEY].newValue || defaultConfig);
    renderChips();
    updateAutopilotText();
    refreshPageStatus();
    if (state.config.preferences.autoPilot && !wasAutoPilot) {
      state.lastAutoPilotKey = '';
      scheduleAutoPilot('storage');
    }
  });

  init();
})();
