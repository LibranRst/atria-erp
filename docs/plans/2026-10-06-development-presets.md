# Development command presets

Status: implemented and verified.

Provide root commands for Admin + API, Web + API, Mobile + API, Admin + Web + API, and all clients + API, plus a repository-scoped stop command. API is launched exactly once per preset. Preserve existing individual commands.

- Reuse the existing development process supervisor, extending it with per-child environment and lifecycle registration.
- Register supervisor/child identities in ignored local state; verify process generation before stopping to avoid stale PID reuse.
- Stop only recorded or positively identified development commands whose working directory belongs to this checkout. Preserve other projects, database/operator tools, and unrelated port listeners such as Hermes.
- Use stable local ports: API3001, Admin3002, Web3003, Metro8081. Validate custom port overrides and reject occupied ports without switching silently. Pass public origins/links to children consistently; keep existing database/secrets untouched.
- Generate API declarations once before clients start. Retain web LAN preference and use reachable LAN client URLs for mobile. Ctrl-C or a failing child shuts down all companions and descendants.
- Verify all preset compositions, graceful stop, descendants, unrelated workers, stale identities, occupied ports and environment forwarding with isolated process fixtures, without starting the live API or mutating a database.
- Update local development guides and root test integration. Run relevant lifecycle tests, TypeScript/lint/format and graph refresh.

Verification: 15 lifecycle/preset/token tests pass, zero failures. Strict TypeScript, workspace lint, targeted formatting and diff checks pass. Real isolated fixtures verified registered and manual stop, descendants, another checkout/unrelated worker preservation, stale identities, Ctrl-C, one declaration generation, preparation failure, and IPv4/IPv6 port conflicts. Both actual Next launchers accept forwarded flags. No live API/database or mobile native build was started. Actual `dev:stop` correctly found zero Atria dev processes and preserved Hermes on port3000.
