'use client'

import {
  pageBackground,
  orbOne,
  orbTwo,
  gridGlow,
  topBlueWash,
} from '@/lib/design-system'
import SiteHeader from './site-header'
import SiteFooter from './site-footer'

export default function SiteShell({
  children,
  active,
}: {
  children: React.ReactNode
  active?: string
}) {
  return (
    <main style={pageBackground}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />
      <div style={topBlueWash} />

      <SiteHeader active={active} />

      {children}

      <SiteFooter />
    </main>
  )
}