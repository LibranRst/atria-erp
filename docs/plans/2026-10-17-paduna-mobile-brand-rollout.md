# Paduna Build mobile branding rollout

## Authorized outcome

Apply the same approved Paduna identity to the existing Expo SDK 57 app: normal Paduna wordmark without Build suffix in artwork, visible app name Paduna Build, ink/terracotta palette, and Temu app/splash assets. Preserve the existing native UI, shared controls, domain workflows and user data.

## Scope and boundaries

- Update Expo display name and permission copy; keep slug, scheme `atria`, bundle ID, auth/storage keys, package names, local native module names and routes compatible.
- Reuse canonical parent-logo artwork and Build native icon layers from the brand kit. Replace the stock blue Expo Icon Composer layers with flat Temu/terracotta artwork.
- Replace the login initial badge and launch text with a shared branding image wrapper. Reuse Button, FormField, FormSection, TextInput, safe-area and keyboard owners. Keep operational route titles contextual; rename only visible legacy brand fallback/copy.
- Keep existing iOS workspace/scheme AtriaERP; update generated local native display/icon/splash resources without cleaning the native project or overwriting custom modules. Android consumes the config and checked asset layers; no Android project currently exists.

## Execution

- [x] Implement display identity, artwork and visible copy.
- [x] Validate Expo config, original artwork fidelity, dimensions/alpha and native icon composition.
- [x] Run mobile/API typechecks, lint, relevant tests and iOS/Android bundle exports.
- [x] Compile the existing iOS workspace and capture native UI/installed identity on the isolated iPhone 17 Pro / iOS 26.5 simulator; keep browser evidence separate.
- [x] Update current brand/design records with actual rollout and validation limits. Finish review: ship, no remaining material findings.

## Verification outcome

Signed Release simulator build, install and native login passed. Captures verify
the installed Paduna Build name/icon, native splash and login with/without the
keyboard. Mobile typecheck/lint, 20 existing tests, source/config/asset checks
and iOS/Android Hermes exports passed. Android native runtime and physical
devices were not exercised. See `docs/qa/2026-10-17-paduna-mobile-brand.md`.

Local Xcode 27.1 compatibility required Expo modules built from source and a
narrow `expo-modules-jsi@57.0.4` interface filter patch. No dependency version
upgrade or auth behavior change was introduced. Simulator signing is required
for SecureStore; the initial unsigned QA artifact was replaced by a normally
ad-hoc-signed simulator build.

## Source of truth

`docs/brand/paduna/`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `apps/mobile/app.json`, and the existing `apps/mobile/ios/AtriaERP.xcworkspace`. The existing Icon Composer path remains in use; native identity changes require a rebuilt binary. No store/cloud publishing is part of this task.
