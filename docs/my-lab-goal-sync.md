# My Lab goal continuity

Goals, progress notes, and saved match preparation use private account storage scoped to the signed-in user and linked player. The active goal selection stays on the current device. Existing browser goals are imported when their IDs have no sync record yet.

Each goal carries an edit timestamp. Saves send only changed goals after a one-second pause. Different goals merge independently; the most recent edit wins when the same goal is edited on two devices. Device clocks determine edit order. Null payloads remember removed goals and prevent an older browser cache from restoring them.

The browser keeps a backup when offline or account storage is unavailable. Retry account save and the browser online event retry pending changes. A return visit reads account goals once; unchanged goals are not written again. There is no recurring polling.

## Release

Apply supabase/migrations/20261009000100_create_my_lab_goals.sql through the established database migration workflow before releasing the client. It creates a private table and an invoker-rights merge RPC. Row-level policies allow only the signed-in account to read or write its own goals. Anonymous callers cannot execute the RPC. No service credential is shipped to the browser.

If the migration is unavailable, My Lab remains usable with browser saving and explicitly reports that account sync is unavailable. Do not claim cross-device saving is live until the migration and signed-in two-browser smoke pass.

## Validation

Focused tests cover migration from local goals, independent edits from two devices, removal protection, edits during the initial read, offline retry, account-switch cleanup, and avoiding unchanged writes. A temporary local PostgreSQL check executes the migration and verifies own-account access, cross-account denial, anonymous denial, and stale deletion protection. Browser QA should save a unique goal in one isolated context, restore and edit it in another, then remove it and confirm a stale context does not restore it.
