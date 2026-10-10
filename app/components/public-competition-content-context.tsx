'use client'
import { createContext, useContext, type ReactNode } from 'react'
import type { PublicTeamEvidence } from '@/lib/public-competition-evidence'

type PublicCompetitionContent = { rankingsContent?: ReactNode; teamsContent?: ReactNode; teamContent?: ReactNode; teamName?: string; teamEvidence?: PublicTeamEvidence }
const Context = createContext<PublicCompetitionContent>({})
export function PublicCompetitionContentProvider({ children, ...content }: PublicCompetitionContent & { children: ReactNode }) {
  const inherited = useContext(Context)
  return <Context.Provider value={{ ...inherited, ...content }}>{children}</Context.Provider>
}
export function usePublicCompetitionContent() { return useContext(Context) }
