'use client'

import { createContext, useContext, type ReactNode } from 'react'

type PublicPlayerContent = { directoryContent?: ReactNode; profileContent?: ReactNode; profileId?: string }
const PublicPlayerContentContext = createContext<PublicPlayerContent>({})

export function PublicPlayerContentProvider({ children, ...content }: PublicPlayerContent & { children: ReactNode }) {
  const inherited = useContext(PublicPlayerContentContext)
  return <PublicPlayerContentContext.Provider value={{ ...inherited, ...content }}>{children}</PublicPlayerContentContext.Provider>
}

export function usePublicPlayerContent() {
  return useContext(PublicPlayerContentContext)
}
