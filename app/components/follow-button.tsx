'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
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
}

export default function FollowButton({
  entityType,
  entityId,
  entityName,
  subtitle,
}: Props) {
  const { userId, authResolved } = useAuth()
  const { isSmallMobile } = useViewportBreakpoints()

  const normalizedEntityId = useMemo(() => entityId.trim(), [entityId])
  const normalizedEntityName = useMemo(() => entityName.trim(), [entityName])
  const normalizedSubtitle = useMemo(() => subtitle?.trim() || undefined, [subtitle])

  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!authResolved) {
        return
      }

      setLoading(true)

      try {
        if (!normalizedEntityId || !userId) {
          if (!cancelled) {
            setIsFollowing(false)
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
      } catch (error) {
        console.error('Failed to check follow state', error)

        if (!cancelled) {
          setIsFollowing(false)
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
  }, [authResolved, entityType, normalizedEntityId, normalizedEntityName, normalizedSubtitle, userId])

  async function toggleFollow() {
    if (loading || saving || !normalizedEntityId || !userId) return

    setSaving(true)

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

  if (!authResolved || loading || !normalizedEntityId) return null
  if (!userId) return null

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
        letterSpacing: '-0.01em',
        border: isFollowing
          ? `1px solid ${hovered ? 'rgba(248,113,113,0.36)' : 'rgba(116,190,255,0.18)'}`
          : '1px solid rgba(155,225,29,0.35)',
        background: isFollowing
          ? hovered
            ? 'linear-gradient(180deg, rgba(120, 28, 28, 0.4) 0%, rgba(55, 16, 16, 0.9) 100%)'
            : 'linear-gradient(180deg, rgba(24, 48, 88, 0.86) 0%, rgba(10, 22, 42, 0.98) 100%)'
          : hovered
            ? 'linear-gradient(135deg, #b7f757 0%, #67efab 100%)'
            : 'linear-gradient(135deg,#9be11d,#4ade80)',
        color: isFollowing ? (hovered ? '#fecaca' : '#f8fbff') : '#04121f',
        cursor: saving ? 'wait' : 'pointer',
        opacity: saving ? 0.8 : 1,
        boxShadow: isFollowing
          ? hovered
            ? '0 12px 28px rgba(69, 10, 10, 0.28), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 16px 36px rgba(5, 12, 25, 0.22), inset 0 1px 0 rgba(255,255,255,0.06)'
          : hovered
            ? '0 16px 38px rgba(74, 222, 128, 0.32), 0 0 0 1px rgba(155,225,29,0.22)'
            : '0 12px 28px rgba(74, 222, 128, 0.22), 0 0 0 1px rgba(155,225,29,0.14)',
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
            : '#14532d',
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
            color: isFollowing ? 'rgba(229,238,251,0.74)' : 'rgba(8,17,29,0.72)',
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {helper}
        </span>
      </span>
    </button>
  )
}
