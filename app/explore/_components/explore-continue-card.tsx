'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import {
  chooseLatestExploreResumeState,
  getExploreResumeHref,
  loadExploreResumeStateFromCloud,
  readExploreResumeState,
  writeExploreResumeState,
  type ExploreResumeState,
  type ExploreResumeSurface,
} from '@/lib/explore-memory'

export default function ExploreContinueCard() {
  const { userId, authResolved, session } = useAuth()
  const [resume, setResume] = useState<ExploreResumeState | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    if (!authResolved) return
    const accessToken = session?.access_token || ''
    let active = true
    void (async () => {
      const localState = readExploreResumeState(userId)
      const cloudState = accessToken ? await loadExploreResumeStateFromCloud(accessToken) : null
      const latest = chooseLatestExploreResumeState(localState, cloudState)
      if (!active) return
      if (latest) writeExploreResumeState(latest, userId)
      setResume(latest)
    })().finally(() => {
      if (active) setResolved(true)
    })
    return () => {
      active = false
    }
  }, [authResolved, session?.access_token, userId])

  const href = getExploreResumeHref(resume)
  if (!resolved || !userId || !href || href === '/explore') return null

  return (
    <Link href={href} style={cardStyle} aria-label={`Continue ${resume?.lastSurfaceLabel || 'exploring'}`}>
      <TiqFeatureIcon name={getResumeIcon(resume?.lastSurface)} size="sm" variant="surface" />
      <span style={copyStyle}>
        <small style={eyebrowStyle}>Continue</small>
        <strong style={titleStyle}>{resume?.lastSurfaceLabel || 'Explore'}</strong>
        {resume?.contextLabel ? <em style={contextStyle}>{resume.contextLabel}</em> : null}
      </span>
      <span style={actionStyle}>Open</span>
    </Link>
  )
}

function getResumeIcon(surface?: ExploreResumeSurface): TiqFeatureIconName {
  if (surface === 'player' || surface === 'players') return 'playerRatings'
  if (surface === 'team' || surface === 'teams') return 'teamRankings'
  if (surface === 'league' || surface === 'leagues') return 'schedule'
  if (surface === 'rankings') return 'reports'
  return 'opponentScouting'
}

const cardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  border: '1px solid rgba(155,225,29,0.28)',
  borderRadius: 14,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.13), rgba(26,178,226,0.08))',
  color: 'var(--foreground-strong)',
  padding: '9px 11px',
  textDecoration: 'none',
}
const copyStyle: CSSProperties = { display: 'grid', gap: 2, minWidth: 0 }
const eyebrowStyle: CSSProperties = { color: 'var(--brand-green-3)', fontSize: 10, fontStyle: 'normal', fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { overflow: 'hidden', fontSize: 15, lineHeight: 1.12, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const contextStyle: CSSProperties = { overflow: 'hidden', color: 'var(--muted-strong)', fontSize: 12, fontStyle: 'normal', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const actionStyle: CSSProperties = { borderRadius: 999, background: 'var(--brand-green)', color: '#07101f', padding: '7px 10px', fontSize: 12, fontWeight: 950 }
