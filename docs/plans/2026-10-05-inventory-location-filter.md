# Inventory location filter with empty warehouses

## Observed gap

The local practice database has an active Gudang UTAMA location and zero Material Master/inventory rows. The inventory filter derives its locations from inventory rows, so its SegmentedTabs disappears and only + Lokasi remains. A configured location must remain visible before material setup or stock entry.

## Scope

- Extend the existing permission-guarded material dashboard API response with active configured location id/name options, sorted by name and id. Keep the action signature, stock rows, history, database and mutation behavior unchanged.
- Build inventory filter locations from that configured list, retaining existing inventory-backed location options for historical/archived stock visibility. Use a dedicated read-filter list; leave operational warehouse selectors and project reservation/use/return rules unchanged.
- Reuse SegmentedTabs and InlineStateRow. Distinguish a genuinely empty inventory at the selected location from search/status filters with no matching results. Do not create sample materials or duplicate warehouses.
- Verify the empty configured warehouse, populated inventory filtering, duplicate location IDs, legacy API payload fallback, and configured names. Run relevant API/web tests, typechecks, lint and production builds. Check 320/360/390/430 and 1024/1280/1440 on the local page, using its existing Gudang UTAMA and zero materials without modifying data.
- Prepare the reviewed release candidate and keep local/hosted clients compatible during rollout. Publish API before web if updating the existing hosted release; no migration or reset is required.

## Verification and release

- Runtime source `c8b1a7fd88657a8d5586988fc3189d3900a8c6ae` passed [CI 37283715978](https://github.com/LibranRst/atria-erp/actions/runs/37283715978): quality and disposable PostgreSQL integration jobs.
- Clean candidate API/web/mobile typechecks, workspace lint, changed-file Prettier check, API build and official Netlify production build passed. Netlify build took 1m 35.4s.
- The disposable in-memory Postgres loader regression passes active-location sorting, configured warehouses with no materials, inactive exclusion, authorization denial, stock preservation and no audit/stock writes. Eighteen web tests pass (69 expectations), including an actual hook + MaterialInventoryTab probe for empty setup, populated location filtering, zero stock, canonical names, deduplication and older response fallback.
- Actual local Gudang UTAMA appears alongside Semua lokasi with zero materials. Selecting it shows Belum ada inventori di lokasi ini and the material setup path. Required 320/360/390/430 and 1024/1280/1440 widths show both options without document overflow. Fresh 320px mobile loading keeps visual scale 1. Browser evidence is private under `.atria-demo/inventory-location-qa/` in the original checkout; use `local-final-cdp.png` for the full viewport screenshot and `widths.json` for measurements.
- API deployed first via the existing GitHub/CI Railway integration: active deployment `0df2f612-3bcd-4ec2-a63c-a96b945fa3a2`. `/health` and `/ready` return 200. The existing Netlify site published transformed production deploy `6ac3617e30717ce5f5867e5d` at https://atria-dekoria.netlify.app.
- Original-checkout notification work has unrelated type errors in push-token response codes and nullable notification delivery values. Those files were not changed or included in the release candidate. The original running local app is verified; do not describe its entire uncommitted workspace as typecheck-clean. The clean release candidate passes all workspace checks.
- Reused existing SegmentedTabs and InlineStateRow; no new UI primitive. No database migration, reset, warehouse/material insertion or stock/finance mutation occurred.
