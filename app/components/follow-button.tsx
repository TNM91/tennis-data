'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { getPlanUnlockHref } from '@/lib/plan-intent'
import { rememberFollowIntent, takeFollowIntent } from '@/lib/follow-intent'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import {
  createFollow,
  isFollowing as checkIsFollowing,
  removeFollow,
  type FollowRecord,
} from '@/lib/follow-feeds'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type Props = {
  entityType: 'player' | 'team' | 'league'
  entityId: string
  entityName: string
  subtitle?: string
  showUnlock?: boolean
}

export default function FollowButton({
  entityType,
  entityId,
  entityName,
  subtitle,
  showUnlock = true,
}: Props) {
  const { userId, role, entitlements, authResolved, session } = useAuth()
  const pathname = usePathname()
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])
  const { isSmallMobile } = useViewportBreakpoints()

  const normalizedEntityId = useMemo(() => entityId.trim(), [entityId])
  const normalizedEntityName = useMemo(() => entityName.trim(), [entityName])
  const normalizedSubtitle = useMemo(() => subtitle?.trim() || undefined, [subtitle])
  const followKey = `${userId || ''}:${entityType}:${normalizedEntityId}`

  const [isFollowing, setIsFollowing] = useState(false)
  const [checkedFollowKey, setCheckedFollowKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!authResolved || !access.canUseAdvancedPlayerInsights) {
        return
      }

      setLoading(true)

      try {
        if (!normalizedEntityId || !userId) {
          if (!cancelled) {
            setIsFollowing(false)
            setCheckedFollowKey('')
          }
          return
        }

        const data = await checkIsFollowing({
          entity_type: entityType,
          entity_id: normalizedEntityId,
          entity_name: normalizedEntityName || normalizedEntityId,
          subtitle: normalizedSubtitle ?? null,
        })
        if (cancelled) return

        setIsFollowing(Boolean(data))
        setCheckedFollowKey(followKey)
      } catch (error) {
        console.error('Failed to check follow state', error)

        if (!cancelled) {
          setIsFollowing(false)
          setCheckedFollowKey('')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [access.canUseAdvancedPlayerInsights, authResolved, entityType, followKey, normalizedEntityId, normalizedEntityName, normalizedSubtitle, userId])

  useEffect(() => {
    if (!authResolved || !access.canUseAdvancedPlayerInsights || !userId || loading || saving || !normalizedEntityId || checkedFollowKey !== followKey) return
    const record: FollowRecord = {
      entity_type: entityType,
      entity_id: normalizedEntityId,
      entity_name: normalizedEntityName || normalizedEntityId,
      subtitle: normalizedSubtitle ?? null,
    }
    const intentStore = getFollowIntentStore()
    if (!intentStore || !takeFollowIntent(intentStore, record, pathname || '', userId) || isFollowing) return

    setSaving(true)
    setSaveError('')
    void createFollow(record)
      .then(() => {
        setIsFollowing(true)
        void trackProductUsageEvent({
          eventName: 'follow_intent_completed',
          surface: entityType === 'player' ? 'profile' : entityType === 'team' ? 'teams' : 'leagues',
          planId: 'player_plus',
          metadata: { entityType },
        }, session?.access_token)
      })
      .catch((error) => {
        console.error('Failed to finish follow after upgrade', error)
        setSaveError(error instanceof Error ? error.message : 'Could not save your follow.')
      })
      .finally(() => setSaving(false))
  }, [access.canUseAdvancedPlayerInsights, authResolved, checkedFollowKey, entityType, followKey, isFollowing, loading, normalizedEntityId, normalizedEntityName, normalizedSubtitle, pathname, saving, session?.access_token, userId])

  async function toggleFollow() {
    if (loading || saving || !normalizedEntityId || !userId || !access.canUseAdvancedPlayerInsights) return

    setSaving(true)
    setSaveError('')

    const record: FollowRecord = {
      entity_type: entityType,
      entity_id: normalizedEntityId,
      entity_name: normalizedEntityName || normalizedEntityId,
      subtitle: normalizedSubtitle ?? null,
    }

    try {
      if (isFollowing) {
        await removeFollow(record)
        setIsFollowing(false)
        return
      }

      await createFollow(record)
      setIsFollowing(true)
    } catch (error) {
      console.error('Failed to toggle follow state', error)
      setSaveError(error instanceof Error ? error.message : 'Could not save your follow.')

      try {
        const data = await checkIsFollowing(record)
        setIsFollowing(Boolean(data))
      } catch (refreshErr) {
        console.error('Failed to refresh follow state after toggle error', refreshErr)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!authResolved || !normalizedEntityId) return null
  if (!userId || !access.canUseAdvancedPlayerInsights) {
    if (!showUnlock) return null
    return (
      <Link
        href={getPlanUnlockHref('player_plus', pathname || '/mylab')}
        onClick={() => {
          const intentStore = getFollowIntentStore()
          if (intentStore) rememberFollowIntent(intentStore, {
            entity_type: entityType,
            entity_id: normalizedEntityId,
            entity_name: normalizedEntityName || normalizedEntityId,
            subtitle: normalizedSubtitle ?? null,
          }, pathname || '', userId)
          if (session?.access_token) void trackProductUsageEvent({
            eventName: 'follow_upgrade_clicked',
            surface: entityType === 'player' ? 'profile' : entityType === 'team' ? 'teams' : 'leagues',
            planId: 'player_plus',
            metadata: { entityType },
          }, session.access_token)
        }}
        aria-label={`Follow ${normalizedEntityName || 'this record'} with Player`}
        style={{
          display: 'inline-grid',
          gap: 4,
          justifyItems: 'start',
          alignContent: 'center',
          minHeight: 48,
          width: isSmallMobile ? '100%' : 'auto',
          padding: '8px 16px',
          borderRadius: 18,
          border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
          background: 'color-mix(in srgb, var(--brand-green) 20%, var(--shell-chip-bg) 80%)',
          color: 'var(--foreground-strong)',
          textDecoration: 'none',
        }}
      >
        <strong style={{ fontSize: '0.94rem', lineHeight: 1.05 }}>Follow with Player</strong>
        <small style={{ color: 'var(--shell-copy-muted)', fontWeight: 700 }}>Track in My Lab</small>
      </Link>
    )
  }
  if (loading) return null

  const label = saving
    ? 'Saving...'
    : isFollowing
      ? hovered
        ? 'Unfollow'
        : 'Following'
      : 'Follow'

  const helper = isFollowing
    ? hovered
      ? 'Remove from My Lab'
      : 'Tracked in My Lab'
    : 'Track in My Lab'

  return (
    <span style={{ display: 'inline-grid', gap: 4, width: isSmallMobile ? '100%' : 'auto' }}>
    <button
      type="button"
      onClick={toggleFollow}
      disabled={saving}
      aria-pressed={isFollowing}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        minHeight: '48px',
        width: isSmallMobile ? '100%' : 'auto',
        padding: '0 16px',
        borderRadius: '18px',
        fontWeight: 800,
        letterSpacing: 0,
        border: isFollowing
          ? `1px solid ${hovered ? 'rgba(248,113,113,0.36)' : 'rgba(116,190,255,0.18)'}`
          : '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
        background: isFollowing
          ? hovered
            ? 'linear-gradient(180deg, rgba(120, 28, 28, 0.4) 0%, rgba(55, 16, 16, 0.9) 100%)'
            : 'linear-gradient(180deg, rgba(24, 48, 88, 0.86) 0%, rgba(10, 22, 42, 0.98) 100%)'
          : hovered
            ? 'color-mix(in srgb, var(--brand-green) 26%, var(--shell-chip-bg) 74%)'
            : 'color-mix(in srgb, var(--brand-green) 20%, var(--shell-chip-bg) 80%)',
        color: isFollowing ? (hovered ? '#fecaca' : '#f8fbff') : 'var(--foreground-strong)',
        cursor: saving ? 'wait' : 'pointer',
        opacity: saving ? 0.8 : 1,
        boxShadow: isFollowing
          ? hovered
            ? '0 12px 28px rgba(69, 10, 10, 0.28), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 16px 36px rgba(5, 12, 25, 0.22), inset 0 1px 0 rgba(255,255,255,0.06)'
          : hovered
            ? '0 16px 38px color-mix(in srgb, var(--brand-green) 20%, transparent), inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)'
            : '0 12px 28px color-mix(in srgb, var(--brand-green) 14%, transparent), inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
        transition: 'all 160ms ease',
        transform: hovered && !saving ? 'translateY(-1px)' : 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '999px',
          background: isFollowing
            ? hovered
              ? '#fca5a5'
              : '#93c5fd'
            : 'var(--foreground-strong)',
          boxShadow: isFollowing
            ? hovered
              ? '0 0 0 4px rgba(248,113,113,0.16)'
              : '0 0 0 4px rgba(74,163,255,0.16)'
            : '0 0 0 4px rgba(155,225,29,0.16)',
          flexShrink: 0,
        }}
      />
      <span style={{ display: 'grid', justifyItems: 'start', lineHeight: 1.05 }}>
        <span style={{ fontSize: '0.94rem', fontWeight: 900 }}>{label}</span>
        <span
          style={{
            marginTop: '4px',
            fontSize: '0.72rem',
            color: isFollowing ? 'rgba(229,238,251,0.74)' : 'var(--shell-copy-muted)',
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {helper}
        </span>
      </span>
    </button>
    {saveError ? <small role="alert" style={{ color: '#fecaca' }}>{saveError}</small> : null}
    </span>
  )
}

function getFollowIntentStore() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
