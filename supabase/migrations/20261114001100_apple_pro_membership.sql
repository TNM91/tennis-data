begin;

alter table tenaceiq_private.apple_memberships
  drop constraint apple_memberships_product_id_check,
  add constraint apple_memberships_product_id_check check (product_id in (
    'com.tenaceiq.app.player.monthly',
    'com.tenaceiq.app.captain.monthly',
    'com.tenaceiq.app.pro.monthly'
  ));

create or replace function public.apple_purchase_access(p_owner uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ownerId', p_owner,
    'playerExpiresAt', max(m.expires_at),
    'captainExpiresAt', max(m.expires_at) filter (
      where m.product_id in ('com.tenaceiq.app.captain.monthly', 'com.tenaceiq.app.pro.monthly')
    ),
    'proExpiresAt', max(m.expires_at) filter (where m.product_id = 'com.tenaceiq.app.pro.monthly')
  )
  from tenaceiq_private.apple_memberships m
  join tenaceiq_private.apple_purchase_accounts a on a.owner_id = m.owner_id and a.account_token = m.account_token
  where m.owner_id = p_owner and m.status = 1 and not m.revoked and not m.upgraded and m.expires_at > now()
    and (m.environment = 'Production' or a.sandbox_enabled)
    and not exists (
      select 1 from public.account_deletion_requests where account_id = p_owner and automatic_consent
    );
$$;

create or replace function public.has_current_coach_access(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.profiles profile
    where profile.id = target_user_id
      and profile.coach_subscription_active = true
      and profile.coach_subscription_status in ('trial', 'active')
      and (profile.coach_access_expires_at is null or profile.coach_access_expires_at > timezone('utc', now()))
  ) or (
    target_user_id = (select auth.uid())
    and coalesce((public.my_apple_purchase_access()->>'proExpiresAt')::timestamptz > now(), false)
  );
$$;

notify pgrst, 'reload schema';
commit;
