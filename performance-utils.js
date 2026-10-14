'use strict';

(() => {
  if (globalThis.IRCTCFastUtils) {
    return;
  }

  const raf = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const delay = (ms = 16) => new Promise((resolve) => setTimeout(resolve, ms));

  const debounce = (fn, wait = 80) => {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  const passive = { passive: true };
  const active = { passive: false };

  const isVisible = (el) => {
    if (!el || !el.isConnected) {
      return false;
    }
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const textOf = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

  const dispatchNative = (el, eventNames = ['input', 'change', 'blur']) => {
    for (const name of eventNames) {
      el.dispatchEvent(new Event(name, { bubbles: true, cancelable: true }));
    }
  };

  const setNativeValue = (el, value, eventNames = ['input', 'change', 'blur']) => {
    const tag = el.tagName;
    const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    dispatchNative(el, eventNames);
  };

  const onceMutation = (target, test, timeout = 1200) => new Promise((resolve) => {
    if (!target) {
      resolve(null);
      return;
    }
    const found = test();
    if (found) {
      resolve(found);
      return;
    }
    let observer = null;
    const finish = (value) => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      clearTimeout(timer);
      resolve(value || null);
    };
    const debounced = debounce(() => {
      const value = test();
      if (value) {
        finish(value);
      }
    }, 20);
    const timer = setTimeout(() => finish(null), timeout);
    observer = new MutationObserver(debounced);
    observer.observe(target, { childList: true, subtree: true });
  });

  /**
   * Waits for a visible element without polling the DOM. The observer is always
   * disconnected, including when the page never renders the requested control.
   */
  const waitForElement = (getElement, timeout = 2200, root = document.documentElement) => new Promise((resolve) => {
    const first = getElement();
    if (first) {
      resolve(first);
      return;
    }
    if (!root) {
      resolve(null);
      return;
    }
    let observer = null;
    const finish = (value) => {
      if (observer) {
        observer.disconnect();
      }
      clearTimeout(timer);
      resolve(value || null);
    };
    const check = debounce(() => {
      const value = getElement();
      if (value) {
        finish(value);
      }
    }, 24);
    const timer = setTimeout(() => finish(null), timeout);
    observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
  });

  const build = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) {
        continue;
      }
      if (key === 'class') {
        el.className = value;
      } else if (key === 'text') {
        el.textContent = value;
      } else if (key === 'dataset') {
        Object.assign(el.dataset, value);
      } else if (key in el) {
        el[key] = value;
      } else {
        el.setAttribute(key, String(value));
      }
    }
    const fragment = document.createDocumentFragment();
    for (const child of children) {
      fragment.append(child && child.nodeType ? child : document.createTextNode(String(child)));
    }
    el.append(fragment);
    return el;
  };

  const hasStorage = () => {
    try {
      return Boolean(globalThis.chrome && chrome.storage && chrome.storage.local);
    } catch (_error) {
      return false;
    }
  };

  const storageGet = (keys) => new Promise((resolve) => {
    if (!hasStorage()) {
      resolve({});
      return;
    }
    try {
      chrome.storage.local.get(keys, (items) => {
        resolve(chrome.runtime && chrome.runtime.lastError ? {} : (items || {}));
      });
    } catch (_error) {
      resolve({});
    }
  });

  const storageSet = (items) => new Promise((resolve) => {
    if (!hasStorage()) {
      resolve(false);
      return;
    }
    try {
      chrome.storage.local.set(items, () => {
        resolve(!(chrome.runtime && chrome.runtime.lastError));
      });
    } catch (_error) {
      resolve(false);
    }
  });

  globalThis.IRCTCFastUtils = Object.freeze({
    active,
    build,
    debounce,
    delay,
    dispatchNative,
    isVisible,
    onceMutation,
    passive,
    raf,
    setNativeValue,
    storageGet,
    storageSet,
    textOf,
    waitForElement
  });
})();
