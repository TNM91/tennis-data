'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import {
  createFollow,
  isFollowing as checkIsFollowing,
  removeFollow,
  type FollowRecord,
} from '@/lib/follow-feeds'

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

  const normalizedEntityId = useMemo(() => entityId.trim(), [entityId])
  const normalizedEntityName = useMemo(() => entityName.trim(), [entityName])
  const normalizedSubtitle = useMemo(() => subtitle?.trim() || undefined, [subtitle])

  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={saving}
      aria-pressed={isFollowing}
      style={{
        padding: '10px 16px',
        borderRadius: '999px',
        fontWeight: 800,
        border: '1px solid rgba(155,225,29,0.35)',
        background: isFollowing
          ? 'rgba(255,255,255,0.08)'
          : 'linear-gradient(135deg,#9be11d,#4ade80)',
        color: isFollowing ? '#fff' : '#04121f',
        cursor: saving ? 'wait' : 'pointer',
        opacity: saving ? 0.8 : 1,
        transition: 'opacity 120ms ease',
      }}
    >
      {saving ? 'Saving...' : isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
