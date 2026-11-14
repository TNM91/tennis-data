import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/app/components/auth-provider'
import styles from './player-chats.module.css'

export const metadata: Metadata = {
  title: 'Player chats',
  robots: { index:false,follow:false },
  referrer: 'no-referrer',
}

export default function PlayerChatLayout({children}:{children:ReactNode}) {
  return <AuthProvider><main className={styles.page}>{children}</main></AuthProvider>
}
