'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
  const normalizedEntityId = useMemo(() => entityId.trim(), [entityId])
  const normalizedEntityName = useMemo(() => entityName.trim(), [entityName])
  const normalizedSubtitle = useMemo(() => subtitle?.trim() || undefined, [subtitle])

  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      setLoading(true)

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError

        if (cancelled) return

        const nextUserId = user?.id ?? null
        setUserId(nextUserId)

        if (!normalizedEntityId || !nextUserId) {
          setIsFollowing(false)
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('user_follows')
          .select('id')
          .eq('user_id', nextUserId)
          .eq('entity_type', entityType)
          .eq('entity_id', normalizedEntityId)
          .maybeSingle()

        if (error) throw error
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
  }, [entityType, normalizedEntityId])

  async function toggleFollow() {
    if (loading || saving || !normalizedEntityId) return

    setSaving(true)

    try {
      let nextUserId = userId

      if (!nextUserId) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError
        nextUserId = user?.id ?? null
        setUserId(nextUserId)
      }

      if (!nextUserId) {
        console.warn('User must be signed in to follow items.')
        return
      }

      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('user_id', nextUserId)
          .eq('entity_type', entityType)
          .eq('entity_id', normalizedEntityId)

        if (error) throw error

        setIsFollowing(false)
        return
      }

      const { error } = await supabase.from('user_follows').upsert(
        {
          user_id: nextUserId,
          entity_type: entityType,
          entity_id: normalizedEntityId,
          entity_name: normalizedEntityName || normalizedEntityId,
          subtitle: normalizedSubtitle ?? null,
        },
        {
          onConflict: 'user_id,entity_type,entity_id',
        },
      )

      if (error) throw error

      setIsFollowing(true)
    } catch (error) {
      console.error('Failed to toggle follow state', error)

      try {
        if (userId && normalizedEntityId) {
          const { data, error: refreshError } = await supabase
            .from('user_follows')
            .select('id')
            .eq('user_id', userId)
            .eq('entity_type', entityType)
            .eq('entity_id', normalizedEntityId)
            .maybeSingle()

          if (refreshError) throw refreshError
          setIsFollowing(Boolean(data))
        }
      } catch (refreshErr) {
        console.error('Failed to refresh follow state after toggle error', refreshErr)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading || !normalizedEntityId) return null

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
      {saving ? (isFollowing ? 'Saving...' : 'Following...') : isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}