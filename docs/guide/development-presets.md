# Local development presets

Run commands from the repository root. Configure the existing development database/auth/provider settings in `apps/api/.env` and matching server-only `API_BRIDGE_SECRET` values in web/admin first. Presets keep these settings and pass consistent local public origins/links to each child; they do not rewrite env files, reset/seed databases, build native binaries or deploy anything.

| Command                     | Starts                                                 |
| --------------------------- | ------------------------------------------------------ |
| `bun run dev:admin-api`     | Admin + API                                            |
| `bun run dev:web-api`       | Web + API                                              |
| `bun run dev:mobile-api`    | Metro/mobile + API                                     |
| `bun run dev:admin-web-api` | Admin + Web + API                                      |
| `bun run dev:all`           | Admin + Web + Metro/mobile + API                       |
| `bun run dev:stop`          | Stops Atria development process trees in this checkout |

`dev:mobile` is an alias for the mobile/API preset. Existing individual commands (`dev:api`, `dev:admin`, `dev:web`, `dev:expo`) retain their behavior.

To switch combinations:

```sh
bun run dev:stop
bun run dev:all
```

Each preset runs in one terminal, generates API declarations once, and launches the API exactly once. Ctrl-C stops the entire preset. If a child fails, all companions and descendants stop. A second preset is rejected while another is active; stop the old one first.

Default addresses:

- API: `http://localhost:3001` (`/health` checks startup).
- Admin: `http://localhost:3002`.
- Web: `http://localhost:3003` (avoids this Mac's unrelated port3000 listener).
- Expo Metro: port8081. Open the installed native app/simulator and connect to Metro; initial native builds use the existing iOS/Android scripts.

Mobile API/web fallback URLs use the detected private LAN address. Set `ATRIA_DEV_LAN_HOST` explicitly if a VPN/multiple interfaces make automatic selection unsuitable. The web launcher preserves the existing preferred-LAN helper. Manual frontend links use the preset web port.

Optional overrides apply to one invocation:

```sh
ATRIA_DEV_WEB_PORT=3004 bun run dev:admin-web-api
ATRIA_DEV_LAN_HOST=192.168.1.100 bun run dev:all
```

Other overrides: `ATRIA_DEV_API_PORT`, `ATRIA_DEV_ADMIN_PORT`, `ATRIA_DEV_METRO_PORT`. Ports must be distinct within the selected preset and available; the runner rejects conflicts rather than silently switching ports or killing the listener.

`dev:stop` uses ignored `.atria-dev/run.json` process identities and checks process generation before signaling. On macOS/Linux it also finds known manually started development entrypoints by this checkout's exact working directories and follows their descendants. It preserves unrelated projects, Hermes, database/operator scripts, build/test jobs and unrelated Node processes. Windows supports registered presets through taskkill; unregistered process discovery is intentionally omitted without a trustworthy cwd check.

The stop command ends with graceful termination followed by forced cleanup for remaining identified processes. It never uses global `pkill node` or kills an arbitrary process just because it occupies a common port.
