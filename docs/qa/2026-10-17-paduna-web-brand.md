# Paduna Build web rollout - 17 Oktober 2026

Status: implemented in local source, not deployed. Native, package, repo and cloud identities remain a later phase.

## Change

- Approved outlined Temu/Paduna Build SVG: horizontal 240px login, compact 176px sidebar.
- Paduna Build title, application/Apple/PWA names, SVG/ICO favicon, PWA/Apple icons, Open Graph/Twitter image and copy.
- Visible installation, notification, onboarding, profile and reconciliation copy updated. Chart source caption uses the new product name.
- Public `/brand/` artwork and SVG favicon bypass session routing; protected pages retain their guard. No tenant RAB identity or client document code changed.
- PWA manifest id/start_url/scope remain `/`. Worker registration URL and legacy cache/tag namespaces remain compatible; shell-v3 refreshes the renamed offline page.
- Existing Button, FormSection, FormField, TextInput, navigation, feedback, motion and workflow owners reused. ProductLogo only wraps Next Image and approved assets; no new control primitive.

## Responsive evidence

Loopback synthetic API; no development/production database used. Login and dashboard were checked at each width, with one visible desktop logo and no page errors. Keyboard login and validation succeeded.

| Viewport | Horizontal login logo | Compact sidebar | Document overflow |
| -------- | --------------------- | --------------- | ----------------- |
| 320px    | 240px                 | Mobile chrome   | Tidak ada         |
| 360px    | 240px                 | Mobile chrome   | Tidak ada         |
| 390px    | 240px                 | Mobile chrome   | Tidak ada         |
| 430px    | 240px                 | Mobile chrome   | Tidak ada         |
| 1024px   | 240px                 | 176px           | Tidak ada         |
| 1280px   | 240px                 | 176px           | Tidak ada         |
| 1440px   | 240px                 | 176px           | Tidak ada         |

Fourteen screenshots and measurements: `output/qa/paduna-web-brand-2026-10-17/browser-verification.json`. The mobile matrix is built from the 320/360/390/430px captures. Dashboard fixture content is synthetic.

## Runtime and quality checks

- API, web and mobile typechecks passed.
- Workspace lint passed.
- 32 existing focused tests passed: service worker, shared app-top-bar, reconciliation DOM continuity and form summary. The 14 worker tests were rerun after checking migration from shell-v2 to v3.
- Web production build passed; final web build and formatting are recorded in the handoff quality-gates artifact.
- Public artwork returns 200 without a session; `/ledger` without a session still returns a login redirect.
- Manifest identity, icon endpoints, Next ICO decoding, Apple title and social metadata verified.
- Real production-preview network shutdown returns the renamed cached offline page. Cache contains `atria-shell-v3`; financial requests remain network-only. `pwa-verification.json` records the result.

The production preview used an ephemeral in-memory bridge credential and the synthetic API. No production guard was weakened. Earlier development-mode offline emulation was replaced by an actual network outage test.

## Independent finishing review

**disposition: ship**

| Element                  | Verdict    | Evidence                                                             |
| ------------------------ | ---------- | -------------------------------------------------------------------- |
| Temu symbol              | match      | Approved paired fields and diagonal negative space retained.         |
| TYPE                     | match      | Outlined Manrope width, weight and terminals; smaller Build suffix.  |
| MATERIAL                 | match      | Crisp flat vector matches the approved board.                        |
| Login lockup             | match      | 240px horizontal artwork remains legible across all supplied widths. |
| Sidebar lockup           | adaptation | 176px compact follows the approved narrow-header guideline.          |
| Canvas and palette       | match      | Existing cool canvas, white surfaces, ink and terracotta.            |
| Composition and controls | match      | Existing workflow hierarchy and shared owners preserved.             |
| Copy and metadata        | match      | Paduna Build consistent; candidate tagline absent.                   |

Material fixes: none. Unrelated modules were not redesigned. DESIGN.md and the sidecar record the built placement rule.

## Hook triage

One pre-existing literal 11px login-error style on a touched file was replaced with shared `text-support` (12px). No suppressions were added and no findings remain standing. The sidecar was refreshed through the scoped documenter update; unrelated tokens/rules/fields were preserved.

## Asset compatibility correction

The ICO exporter now emits RGBA embedded PNG frames, required by Next's ICO decoder. The complete brand kit was corrected and repacked with the same approved visual artwork. Other native assets remain uninstalled.
