'use client'

import { useEffect } from 'react'

export default function CaptainShareRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href)
  }, [href])

  return null
}
