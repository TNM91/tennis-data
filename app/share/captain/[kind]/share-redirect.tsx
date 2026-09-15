'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CaptainShareRedirect({ targetHref }: { targetHref: string }) {
  const router = useRouter()

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace(targetHref), 450)
    return () => window.clearTimeout(timer)
  }, [router, targetHref])

  return null
}
