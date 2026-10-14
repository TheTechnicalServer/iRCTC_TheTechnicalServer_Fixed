'use strict';

const STORAGE_KEY = 'irctcPassengers';

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

const withChromeError = () => {
  const error = chrome.runtime.lastError;
  return error ? error.message : '';
};

const getStoredConfig = (callback) => {
  chrome.storage.local.get([STORAGE_KEY], (items) => {
    const error = withChromeError();
    callback(error ? null : (items[STORAGE_KEY] || null), error);
  });
};

const saveStoredConfig = (config, sendResponse) => {
  chrome.storage.local.set({ [STORAGE_KEY]: config }, () => {
    const error = withChromeError();
    sendResponse({ ok: !error, error, config });
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type || sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message.type === 'IRCTC_FAST_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage(() => {
      const error = withChromeError();
      sendResponse({ ok: !error, error });
    });
    return true;
  }

  if (message.type === 'IRCTC_FAST_SAVE_CONFIG') {
    saveStoredConfig(message.config || {}, sendResponse);
    return true;
  }

  if (message.type === 'IRCTC_FAST_SET_AUTOPILOT') {
    getStoredConfig((storedConfig, readError) => {
      if (readError) {
        sendResponse({ ok: false, error: readError });
        return;
      }

      const baseConfig = storedConfig || message.config || {};
      const nextConfig = {
        ...baseConfig,
        preferences: {
          ...(baseConfig.preferences || {}),
          autoPilot: Boolean(message.enabled)
        }
      };
      saveStoredConfig(nextConfig, sendResponse);
    });
    return true;
  }

  return false;
});
