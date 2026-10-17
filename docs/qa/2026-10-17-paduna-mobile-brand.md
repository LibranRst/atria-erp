# Paduna Build — Expo branding verification

The authorized change carries the approved Paduna identity into the existing
Expo app: ordinary Paduna wordmark, Paduna Build display name, and Temu artwork
in ink/terracotta. It preserves the existing native UI and business behavior.

## Source and asset checks

- Login: approved parent artwork at 176dp, left aligned; launch: same artwork,
  centered. `PadunaLogo` wraps a bundled `expo-image` asset without recreating
  controls. Existing Button, FormField, FormSection and TextInput are reused.
- Expo name, visible legacy copy and permission copy identify Paduna Build.
  Launcher icon, Android adaptive layers, monochrome notification icon, iOS
  Icon Composer artwork and light/dark splash sources use canonical Temu assets.
- Source PNG/SVG are byte-identical to the canonical parent exports. Icon alpha,
  dimensions, Android layers, native manifest values and splash scales pass
  `output/qa/paduna-mobile-brand-2026-10-17/asset-verification.json`.
- Slug, scheme, bundle identifier, URL schemes, package/native module names and
  auth/storage identities remain compatible. No database or financial/material
  behavior changes are part of this rollout.

## Automated and supplemental checks

- Mobile TypeScript check, generated API contract declarations and mobile lint:
  passed. Targeted existing routing/session/access tests: 20 passed, 0 failed.
- iOS and Android Hermes export: passed with anonymous loopback QA URLs. These
  bundles are local verification output, not distribution artifacts.
- Expo public config: passed. Targeted Impeccable detector: no findings.
- Supplemental Expo web login at 320/360/390/430px: 176px logo, no horizontal
  overflow or page errors. This browser rendering is not native evidence.

## Native verification

Release simulator compilation passed (exit 0), followed by install and native
login on an isolated iPhone 17 Pro / iOS 26.5 simulator. The installed display
name is Paduna Build; the bundle identifier and URL schemes remain unchanged.
Actual native captures under `output/qa/paduna-mobile-brand-2026-10-17/`:

| Capture                         | Verified appearance                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ios-native-home.jpg`           | White Temu on terracotta; full Paduna Build launcher label.                                          |
| `ios-native-launch.jpg`         | Centered terracotta Temu on the light native splash canvas.                                          |
| `ios-native-login-keyboard.jpg` | Intact left-aligned Paduna logo, heading, fields and visible Masuk action with native keyboard open. |
| `ios-native-login.jpg`          | Complete login composition after keyboard dismissal.                                                 |

The initial unsigned QA binary could not access SecureStore. Rebuilding with
normal Xcode simulator ad-hoc signing resolved that startup failure without
changing auth code. The signed app remained running and displayed the anonymous
login. No real sign-in or authenticated business flow was exercised.

The fresh-context Impeccable finish review's final verdict is **ship**: its
native-evidence finding is resolved and nothing remains open. See
`output/qa/paduna-mobile-brand-2026-10-17/finish-review.md`.

The installed Xcode 27.1 / Swift 6.4 toolchain could not import precompiled Expo
modules built with Swift 6.3.1. The local ignored iOS workspace therefore uses
Expo's supported source-module opt-out. The pinned `expo-modules-jsi@57.0.4`
helper also needs a narrow interface-cleanup patch for the compiler's `__ObjC::`
syntax; the original filter only recognized `__ObjC.`. This is inferred from the
observed compiler output and installed helper, not an Expo recommendation.
No SDK/package version upgrade was introduced. The first MCP build request
timed out; subsequent compilation uses the same local DerivedData through CLI.

Android verification covers config, asset layers and Hermes export only; no
Android emulator/device binary was run. Dark splash sources/config were checked;
the installed native captures use the app's existing light appearance. Physical
devices, store distribution and push delivery remain outside this evidence set.

The API used for these checks returns an anonymous session and has no database
or production credentials. No store upload or cloud deployment was performed.

References: [Expo source-module opt-out](https://docs.expo.dev/guides/prebuilt-expo-modules/),
[Expo SDK 57 app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/),
[Apple keychain entitlement requirements](https://developer.apple.com/documentation/security/errsecmissingentitlement).
