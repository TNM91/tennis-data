'use client'

import { useEffect, useState } from 'react'
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
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkFollow()
  }, [entityId])

  async function checkFollow() {
    const { data } = await supabase
      .from('user_follows')
      .select('*')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .maybeSingle()

    setIsFollowing(!!data)
    setLoading(false)
  }

  async function toggleFollow() {
    if (isFollowing) {
      await supabase
        .from('user_follows')
        .delete()
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)

      setIsFollowing(false)
    } else {
      await supabase.from('user_follows').insert({
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        subtitle,
      })

      setIsFollowing(true)
    }
  }

  if (loading) return null

  return (
    <button
      onClick={toggleFollow}
      style={{
        padding: '10px 16px',
        borderRadius: '999px',
        fontWeight: 800,
        border: '1px solid rgba(155,225,29,0.35)',
        background: isFollowing
          ? 'rgba(255,255,255,0.08)'
          : 'linear-gradient(135deg,#9be11d,#4ade80)',
        color: isFollowing ? '#fff' : '#04121f',
        cursor: 'pointer',
      }}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}