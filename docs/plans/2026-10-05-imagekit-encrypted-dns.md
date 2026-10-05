# ImageKit local DNS repair — 5 October 2026

The user requested repairing Mac network DNS access to ImageKit. Strict local HTTPS fails when the system resolves `ik.imagekit.io` to `internetpositif.id` / `36.86.63.185`. The active Wi-Fi resolver is DHCP-provided. Direct UDP and TCP queries addressed to Cloudflare/Google public resolvers receive the same misroute. HTTPS DNS queries return genuine CloudFront addresses, and a transient diagnostic connection to one genuine address validates TLS and returns ImageKit HTTP 404. No IP is permanently pinned and certificate validation remains enabled.

## Selected repair

Prepare a native macOS encrypted DNS profile using Apple's documented `com.apple.dnsSettings.managed` payload, HTTPS server `https://cloudflare-dns.com/dns-query`, bootstrap addresses 1.1.1.1/1.0.0.1 and `SupplementalMatchDomains=[imagekit.io]`. Only ImageKit hostname queries use Cloudflare; other domains retain their existing resolver. No VPN/proxy/root certificate/credential is added. The profile is removable. macOS 27 marks this payload deprecated, not removed; manual installation and actual resolver behavior must be verified on this Mac before claiming success.

The locally generated profile and baseline are under ignored `.atria-demo/network/imagekit-dns/`. Installation requires review and macOS administrator authorization by the user. Do not collect their password, change global DNS, disable TLS, modify `/etc/hosts`, or install a VPN as a shortcut.

## Acceptance

1. Review the exact profile scope/Cloudflare destination with the user, stage Device Management, and let the user authorize installation.
2. Verify OS `dns.lookup` and fresh Bun HTTPS no longer reach the block-page address and receive an ImageKit response with certificate verification enabled.
3. Verify an existing synthetic private attachment's authorized/signed original bytes if available; preserve real-data databases/accounts.
4. Restart/recheck local API DNS cache if needed, update the learning guide's limitation only after the repair works, and record removal/rollback instructions.

## Result

The initial locally generated profile omitted `PayloadScope`. Installation failed; the actual macOS `mdmclient` log identified the cause: `Failed to install DNS proxy/settings profile - profile must be scoped to system`. This was a profile configuration error, not evidence of unsupported macOS 27 behavior.

A revised, parsed profile explicitly sets `PayloadScope=System`, retaining the same ImageKit-only HTTPS resolver settings. The user installed **Atria ImageKit DNS — System** and completed administrator authorization. Device Management now lists it under Device with one setting. The failed downloaded draft was replaced/removed by the installer.

Post-install checks passed:

- macOS `dns.lookup` returns genuine CloudFront IPv4/IPv6 addresses, excluding the block-page address. Strict Node HTTPS returns ImageKit HTTP 404 at the public root with `x-server=ImageKit.io` (the missing account path is expected).
- The fresh Bun probe uses the app's exact ImageKit SDK signed/original delivery pattern, an existing synthetic QA attachment and a read-only database session. It changed from `CERT_HAS_EXPIRED` to HTTP 200, `image/png`, 37001 bytes, SHA-256 `c784375b8bbd7dc47df5df19b09eaf2da909347d7a2d242808644cd65c60cbc1`, matching the original fixture. No new upload, account, finance mutation or AI call occurred.
- Local API health/readiness remain HTTP 200. Default Wi-Fi resolver settings remain DHCP-provided; only ImageKit domains are assigned to the encrypted profile. No static hosts entry, VPN tunnel or TLS bypass was introduced.

Working profile: ignored `.atria-demo/network/imagekit-dns/Atria-ImageKit-DNS-System.mobileconfig`. Baseline/review screenshots and validation results are retained privately in that directory. A normal `dig` query goes directly to a plaintext DNS server and is not a reliable test of macOS encrypted/domain-specific DNS; use system lookup and actual HTTPS instead.

## Rollback

Open **System Settings → General → Device Management**, select **Atria ImageKit DNS — System**, remove that profile and authorize with the Mac administrator credentials when asked. The saved mobileconfig can restore it later. Removing it restores the prior DNS behavior for ImageKit; other network-service settings were not changed. Do not remove unrelated profiles.

Sources: [Apple payload schema](https://github.com/apple/device-management/blob/release/mdm/profiles/com.apple.dnsSettings.managed.yaml), [Cloudflare DoH](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/), [Apple profile installation](https://support.apple.com/en-au/guide/mac-help/mh35561/mac).
