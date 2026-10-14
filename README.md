# TheTechnicalServer AutoFill

Manifest V3 Chrome extension that stores passenger preferences locally and fills normal IRCTC passenger-form controls.

## Safety boundary

This extension never bypasses or completes login, CAPTCHA, OTP, queues, rate limits, payment, review-page approval, or final booking confirmation. It does not make external requests, and it does not send passenger data anywhere. After it fills the form, review the visible IRCTC fields and use IRCTC's own controls.

The **Auto-fill passenger details** option runs once for each passenger-page URL. When **Auto click Continue** is enabled, it presses only IRCTC's normal visible **Continue** button once after filling; it then locks that page against duplicate filling or repeat submission. **Auto Continue review** is a separate opt-in setting that presses the visible Review Journey **Continue** button once. **Refill data** is the deliberate recovery control and never presses Continue. The extension never accepts CAPTCHA, OTP, payment, or booking-confirmation dialogs.

The **Last Payment Method** setting is available only when BHIM/UPI is selected. When enabled, it uses IRCTC's exact **BHIM/UPI/USSD** and saved-provider card controls (default: **Paytm UPI**), waiting safely while IRCTC renders them. Once selected, it does not repeat the action. The floating panel also has a **Prepare UPI / Paytm** button for a deliberate one-time attempt. It clicks **Pay & Book** only if you opt in to **Click Pay & Book once** (off by default); the payment itself (scanning the QR / approving UPI) is always done by you. The shared **Stop** button immediately pauses all extension activity and changes to **Start**; click Start to resume. The content script is limited to `www.irctc.co.in`; on hand-off to an external payment gateway, its observer and timers stop and no extension script runs there.

## Features

- Passenger limits enforced locally: **Tatkal: 4** and **General: 6**.
- A movable, collapsible floating panel with current date/time, page stage, selected booking mode, active status, recovery controls, and an optional diagnostic log.
- Safe form assistance:
  - **Fill & Continue** populates saved passenger, contact, insurance, and payment-preference controls.
  - **Refill only (no submit)** populates fields again but never presses Continue or submits the passenger form.
- Payment preparation: choose BHIM/UPI and a saved provider (Paytm UPI by default) on the IRCTC payment-options page; verify the selection and press **Pay & Book** yourself.
- Duplicate-submit lock for a manually requested Continue action; no site buttons are disabled or altered.
- Mutation-observer-based waiting with time limits, cached selectors, and bounded diagnostic logs.
- Fast passenger path: shorter page-ready/debounce waits, 25 ms slot detection, and compact dropdown/payment delays while retaining IRCTC input/change events.
- Settings saves retry locally and fall back to the extension service worker if the options page storage context is temporarily unavailable.

## Install

1. Open `chrome://extensions` in Chrome or Edge.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this extension folder.
5. Reload the extension after replacing files during development.
6. To use it in a private window, open the extension's **Details** page and enable **Allow in incognito**. Chrome requires this user-controlled setting.

## Configure and use

1. Click the extension icon and choose General or Tatkal, passenger data, contact details, and preferences; then save. Enable **Auto Continue review** only if you want the review-page Continue action to run once.
2. Open the normal IRCTC passenger-details page and use **Fill & Continue** or **Refill data**.
3. On the review page, inspect the journey and use IRCTC's **Continue** button yourself. On Payment Options, verify the prepared provider and press **Pay & Book** yourself.
4. Complete every CAPTCHA, OTP, queue, authentication, payment, and confirmation step manually.

## Troubleshooting

- If IRCTC changes a control, reload the passenger page and use **Refill data** after the page is fully rendered.
- Turn on **Show diagnostic log** in settings to view the most recent extension events in the floating panel.
- Stored data is in `chrome.storage.local`. Removing the extension or clearing extension storage removes it.

## Project files

- `manifest.json` — Manifest V3 configuration with only `storage` and the IRCTC host permission.
- `background.js` — settings-page action and guarded storage fallback.
- `performance-utils.js` — storage, DOM, event, and mutation-wait helpers.
- `content.js` — floating panel, passenger-page autofill, payment preference, and recovery controls.
- `options.*` — accessible passenger settings interface.
