'use client'

import { createContext, useContext } from 'react'

export type PlayerProfilePreview = {
  name: string
  location: string | null
}

const PlayerProfilePreviewContext = createContext<PlayerProfilePreview | null>(null)

export function PlayerProfilePreviewProvider({
  preview,
  children,
}: {
  preview: PlayerProfilePreview
  children: React.ReactNode
}) {
  return <PlayerProfilePreviewContext.Provider value={preview}>{children}</PlayerProfilePreviewContext.Provider>
}

export function usePlayerProfilePreview() {
  return useContext(PlayerProfilePreviewContext)
}
