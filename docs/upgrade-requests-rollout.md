# Upgrade Requests Rollout

This checklist turns on persistent upgrade request capture, admin review, and one-click access activation.

## 1. Apply migrations

Apply these migrations to the Supabase project in order:

1. `supabase/migrations/20260502000100_add_player_plus_profile_entitlements.sql`
2. `supabase/migrations/20260502000200_create_upgrade_requests.sql`

The first migration creates `public.upgrade_requests` with public insert and admin read/update/delete policies.

The second migration adds explicit Player entitlement fields to `public.profiles`:

- `player_plus_subscription_active`
- `player_plus_subscription_status`

## 2. Configure server secret

Set this server-only environment variable in the deployed app environment:

```bash
SUPABASE_SERVICE_ROLE_KEY=
```

This is required only for admin one-click activation from `/admin/upgrade-requests`.

For local development, put the same key in `.env.local`. Never commit or paste the key into chat.

## 3. Verify setup

Sign in as an admin and open:

```text
/admin/upgrade-requests
```

The setup banner should show all three checks as ready:

- Upgrade request table
- Player entitlement fields
- Activation service key

## 4. CLI workflow

This repo is linked to the Supabase project with the Supabase CLI. For future schema changes:

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Use the dry run before applying remote changes. If schema was applied manually in the dashboard, repair migration history only after confirming the remote schema already matches the migration contents.

## 5. Test the funnel

Use a test email and run this path:

1. Open `/upgrade?plan=captain&next=%2Fcaptain`.
2. Submit the request form as a public visitor.
3. Create or sign in with the same email.
4. Return to the upgrade page so the request links to the account.
5. Open `/admin/upgrade-requests`.
6. Confirm the request shows an account id.
7. Click `Activate Captain`.
8. Confirm the request status becomes `converted`.
9. Open `/captain` and confirm Captain tools unlock for that account.

## Notes

The app has fallbacks while migrations are pending:

- Upgrade requests fall back to local browser storage when `upgrade_requests` is unavailable.
- Admin Access falls back to legacy entitlement fields when Player fields are unavailable.
- One-click activation stays disabled until the request is Supabase-backed, linked to an account, and the service key is configured.
