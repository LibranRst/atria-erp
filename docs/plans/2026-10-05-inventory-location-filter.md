# Inventory location filter with empty warehouses

## Observed gap

The local practice database has an active Gudang UTAMA location and zero Material Master/inventory rows. The inventory filter derives its locations from inventory rows, so its SegmentedTabs disappears and only + Lokasi remains. A configured location must remain visible before material setup or stock entry.

## Scope

- Extend the existing permission-guarded material dashboard API response with active configured location id/name options, sorted by name and id. Keep the action signature, stock rows, history, database and mutation behavior unchanged.
- Build inventory filter locations from that configured list, retaining existing inventory-backed location options for historical/archived stock visibility. Use a dedicated read-filter list; leave operational warehouse selectors and project reservation/use/return rules unchanged.
- Reuse SegmentedTabs and InlineStateRow. Distinguish a genuinely empty inventory at the selected location from search/status filters with no matching results. Do not create sample materials or duplicate warehouses.
- Verify the empty configured warehouse, populated inventory filtering, duplicate location IDs, legacy API payload fallback, and configured names. Run relevant API/web tests, typechecks, lint and production builds. Check 320/360/390/430 and 1024/1280/1440 on the local page, using its existing Gudang UTAMA and zero materials without modifying data.
- Prepare the reviewed release candidate and keep local/hosted clients compatible during rollout. Publish API before web if updating the existing hosted release; no migration or reset is required.
