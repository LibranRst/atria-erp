# Web Push readiness after backend extraction

The browser profile still reads VAPID configuration from the Next process even though the independent API now owns notification credentials. Activation must use the public key from the same API configuration that sends pushes.

## Implementation

1. Return only the ready public VAPID key through the authenticated profile DTO; keep the private key and subject inside the API. Use the same configuration helper for delivery.
2. Preserve the existing shared activation controls and iPhone Home Screen instructions. Explain HTTPS requirements and missing server configuration in plain Indonesian.
3. Add an explicit test notification action for the current user's current session and registered browser endpoint only, with rate limiting. Reuse the production Web Push sender; success means provider acceptance, not confirmation that an OS banner was displayed.
4. Verify configuration, subscription ownership/session isolation, expired endpoints, service worker presentation and click routing with focused tests.
5. Run API/web/mobile typechecks, lint and formatting checks. Inspect the real profile in iOS Simulator and browser mobile widths. Attempt Home Screen registration and real delivery; record observed simulator limitations rather than substituting simulated APNs for Web Push proof.

## Boundaries

No finance/material mutations, database resets, production bulk notifications, credential rotation, or unsolicited notification permissions. Preserve existing uncommitted work. Production deployment and remote scheduler state are distinct from local code verification.

## Acceptance evidence

- Implemented API-owned public configuration, shared production/test sender, authenticated per-session test action, HTTPS status, and shared Button/StatusBadge composition. No new UI primitive.
- API notification/database/transport suites: 10 tests passed. Web notification/PWA suites: 68 tests passed. Providers are mocked in automated tests; these results do not prove OS delivery.
- API, web and mobile typechecks passed; workspace lint passed. Formatting passed for every changed file. Repository-wide formatting still reports 142 existing files outside this change. The manual design detector reported no findings; the hook's pre-existing profile typography findings were left outside this functional change, with no suppressions.
- Real local API configuration has a matching P-256 VAPID pair and a mailto subject (values were not printed or rotated).
- Inspected authenticated Safari on iPhone 17 Pro / iOS 26.5 at `http://localhost:3010/profile#notifications`: the API key is available and the expected Home Screen prerequisite is shown. Successfully installed and launched Atria as a Home Screen web app.
- User completed the separate Home Screen login. The app correctly shows **Terpasang** and offers **Aktifkan**. The system notification permission prompt appeared and **Allow** was selected. Subscription creation failed twice with `NotAllowedError`; no browser subscription was persisted in the API or the simulator Web Push database. UI correctly remains **Nonaktif**.
- Simulator `webpushd` logs at 15:35 and 15:37 WIB report: `Cannot subscribe because web clip origin <private> does not have correct permissions`. WebKit's `WebPushDaemon.mm` checks OS `UNNotificationSettings.authorizationStatus` before contacting the push provider. This is an observed OS permission failure; HTTPS/device comparison is still required before attributing it exclusively to simulator limitations.
- A real HTTP call to the new compatibility operation without a user session returned `data.success=false` / `UNAUTHORIZED` (HTTP 200 is the normal ActionResponse bridge envelope). No notification was sent.
- Push provider acceptance/banner/tap remain **unverified**, as does production deployment/scheduler state. Do not describe simulated APNs as Web Push evidence. The next acceptance run needs a trusted HTTPS build of this change and a device capable of registering its push endpoint.
