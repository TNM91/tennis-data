'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const isAdmin = user?.id === ADMIN_ID

      setAuthorized(isAdmin)
      setLoading(false)

      if (!isAdmin && pathname !== '/admin') {
        router.push('/admin')
      }
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const isAdmin = session?.user?.id === ADMIN_ID
      setAuthorized(isAdmin)
      setLoading(false)

      if (!isAdmin && pathname !== '/admin') {
        router.push('/admin')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, pathname])

  if (loading) {
    return <p style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>Checking access...</p>
  }

  if (!authorized && pathname !== '/admin') {
    return null
  }

  return <>{children}</>
}