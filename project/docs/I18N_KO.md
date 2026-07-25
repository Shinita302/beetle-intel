# Korean UI (i18n-ko)

This branch adds English / Korean language switching for BeetleIntel.

## What works now

- **EN | 한국어** switcher in the dashboard header, login, signup, and Settings
- Sidebar navigation in Korean
- Auth screens (login / signup)
- Settings page
- Main page titles (Dashboard, Add Beetle, Inventory, Growth, Pairing, Pest Risk)

Choice is saved in `localStorage` (`beetle-intel-locale`). Default is English so beta users are unchanged until they switch.

## What is not fully translated yet

Form field labels, table headers, import wizard copy, charts, and many buttons inside feature pages are still English. Add keys to:

- `src/i18n/locales/en.ts`
- `src/i18n/locales/ko.ts`

Then replace hardcoded strings with `t('some.key')`.

## How to test

1. Push `i18n-ko` → open Vercel **Preview** URL
2. Click **한국어** in the header
3. Confirm nav + Settings + login switch language
4. Keep Production (`main`) on English until you merge

## Merge later

When ready: PR `i18n-ko` → `main`. Users keep the same URL; English remains default.
