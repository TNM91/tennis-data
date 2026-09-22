'use client'

import { useAuth } from '@/app/components/auth-provider'
import { GuestTierPreview } from '@/app/components/public-command-center'

export default function GuestTierPreviewGate() {
  const { authResolved, userId, role } = useAuth()
  const authenticated = Boolean(userId) || role !== 'public'

  if (!authResolved || authenticated) return null
  return <GuestTierPreview />
}
