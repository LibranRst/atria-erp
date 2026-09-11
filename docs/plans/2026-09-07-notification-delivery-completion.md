# Notification Delivery Completion

## Objective

Close the remaining notification gaps after in-app SSE synchronization: schedule condition
reconciliation in production, cover opening-inventory lifecycle events, add opt-in Web Push,
register Expo devices from the native client, and make external push delivery retryable and
observable.

## Scope

1. **Scheduler**
   - Add Vercel Cron configuration for the hourly condition job and a frequent delivery worker.
   - Accept Vercel `GET` requests authenticated by `CRON_SECRET` while preserving the generic
     bearer-authenticated `POST` endpoint.
   - Keep database locks and idempotency as the concurrency boundary.
2. **Opening inventory**
   - Create the Owner action notification inside the opening request transaction.
   - Resolve the pending action and notify the requester on approve/reject.
   - Notify relevant inventory users after an audited reversal.
3. **Durable push delivery**
   - Add a per-notification/per-subscription delivery outbox with attempts, retry time, provider
     ticket/receipt, terminal state, and error summary.
   - Claim due work with row locks, perform network calls outside the claim transaction, and recover
     expired processing leases.
   - Check Expo receipts after the recommended delay, retire `DeviceNotRegistered` tokens, and use
     bounded exponential retry for transient failures.
   - Deliver Web Push with VAPID, retiring expired subscriptions on HTTP 404/410.
4. **Web opt-in**
   - Register a service worker and request permission only after explicit user interaction.
   - Add enable/disable controls on the notification page with honest unsupported/blocked/error
     states.
   - Validate notification-click destinations before opening an internal route.
5. **Expo client**
   - Install/configure `expo-notifications` for SDK 57.
   - Register and refresh Expo tokens after authenticated app entry, without blocking the app when
     the device is offline or credentials are unavailable.
   - Route notification taps through the existing `atria` deep-link scheme.

## Deployment contract

- Required production secrets: `CRON_SECRET`, `WEB_PUSH_VAPID_PUBLIC_KEY`,
  `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT`.
- Native delivery additionally requires configured APNs/FCM credentials and a development or
  production build; Expo Go is not an acceptance environment for remote push.
- This implementation prepares Vercel configuration and runtime code. It does not create or modify
  Vercel project secrets or mobile signing credentials.

## Verification

- Migration upgrade from 0039 and isolated Postgres outbox tests.
- Opening-inventory request/approve/reject/reversal notification lifecycle.
- Web subscription register/unregister, safe service-worker navigation, expired endpoint cleanup.
- Expo ticket mapping, receipt success/error, token retirement, retry/backoff, and parallel claims.
- Cron authentication, task routing, lock behavior, TypeScript, lint, formatting, production build,
  and demo-seed verification.

## Implementation status

- Implemented the Vercel schedules, bearer-authenticated task routing, opening-inventory lifecycle events, session-bound subscription registration, durable outbox/lease/retry processing, Expo ticket receipts, Web Push delivery, browser opt-in controls, and Expo registration/tap routing.
- Local development secrets are generated in ignored `apps/web/.env`. Production Vercel secrets, the real EAS project ID, and APNs/FCM credentials remain deployment configuration and are intentionally not stored in the repository.
