# Read-model access and native-only website builds

The October 30 read-model hardening migration removes inherited browser write privileges from nine existing views. It preserves the view queries, columns, underlying table permissions and RLS policies.

- Six existing public match/team projections retain SELECT for `anon` and `authenticated`.
- `internal_message_directory` retains signed-in SELECT for opted-in recipient discovery; anonymous access is removed. It must intentionally cross profile-owner RLS so teammates remain discoverable.
- `tennisrecord_admin_coverage_summary` and `tennisrecord_annual_label_candidates` remain backend-only. The coverage summary now uses invoker security.
- Table and column grants are both checked. Browser INSERT, UPDATE, DELETE and related grants are removed; backend grants are preserved.
- The opted-in directory gains a security barrier. Public factual projections retain their existing query-planning options. These limited read models intentionally expose only their existing public/member columns across private source-table RLS. The generic Security Definer View advisor can still flag those six reviewed projections. Do not hide the finding, grant access to raw source tables, or flip them to invoker without testing the consumers.

Before changing production, run `node scripts/verify-read-model-view-grants.mjs` and the normal release checks. The disposable PostgreSQL test reproduces the inherited-write problem, verifies actual role reads/writes, checks column-grant leaks, preserves opted-in discovery and profile RLS, and verifies atomic rollback on schema drift and an unavailable account-erasure catalog. The migration also guards live view identities, owners, columns, existing consumer/backend reads and account-erasure readiness, with short lock and statement timeouts.

After applying the exact reviewed migration, inspect effective table/column privileges, view options and `account_erasure_catalog_ready()`. Use zero-row API requests to verify denied anonymous directory/summary access, retained signed-in directory access, and retained public projection reads. Never test destructive writes against production members.

## Website build exclusion

`vercel.json` runs `scripts/vercel-ignore-native-only.mjs` before a build. It skips only a verified nonempty diff containing native app files, test files, Markdown under `docs/`, root README/AGENTS instructions, or the existing native/CI workflows. It compares against `VERCEL_GIT_PREVIOUS_SHA`, the branch's last successful deployment, so an intervening website change cannot be lost. Non-document data and Markdown within app/public content paths still build.

Website routes, APIs, shared libraries, public assets, migrations, dependencies, build scripts/configuration and unknown paths still build. Missing Git history, missing deployment metadata, an unrelated baseline, a mismatched checkout and a same-commit manual redeploy also build. It does not fetch history, change deployment branches, alter cron schedules or weaken CI/signing checks. Run `node --test scripts/vercel-ignore-native-only.test.mjs` to verify actual disposable Git histories.

For native-only releases that skip the website build, reuse the last ready production deployment and record why the verified cumulative diff has no website/backend changes. API or shared-source changes still require a ready deployment for the new source and a bounded live smoke. Keep account-specific usage and billing exports private; report usage, credits and subscription fees separately.

The league directory treats PostgreSQL statement timeout (`57014`) and its own seven-second cancellation as an incomplete bounded read. It retains loaded match counts and team discovery with the existing incomplete-window notice. It does not retry the failed page, extend the deadline, change the five-minute cache or suppress other database errors. This prevents an expected timeout response from aborting an otherwise valid production build.
