import type { ReactNode } from 'react'
import { AuthProvider } from '@/app/components/auth-provider'

export default function ClubsLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
