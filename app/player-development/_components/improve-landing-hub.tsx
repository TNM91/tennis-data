'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import RoleActionHome, { type RoleHomeAction } from '@/app/components/role-action-home'
import {
  chooseLatestPlayerImproveResumeState,
  getPlayerImproveResumeHref,
  loadPlayerImproveResumeStateFromCloud,
  readPlayerImproveResumeState,
  syncPlayerImproveResumeState,
  writePlayerImproveResumeState,
  type PlayerImproveResumeState,
  type PlayerImproveResumeSurface,
} from '@/lib/player-improve-memory'

type ImproveLandingHubProps = {
  identitySlug: string
  identityTitle: string
  tacticsHref: string
}

export default function ImproveLandingHub({ identitySlug, identityTitle, tacticsHref }: ImproveLandingHubProps) {
  const { userId, authResolved, session } = useAuth()
  const [resumeState, setResumeState] = useState<PlayerImproveResumeState | null>(null)
  const [resumeResolved, setResumeResolved] = useState(false)

  useEffect(() => {
    if (!authResolved) return

    const accessToken = session?.access_token || ''
    let active = true
    void (async () => {
      const localState = readPlayerImproveResumeState(userId)
      const cloudState = accessToken ? await loadPlayerImproveResumeStateFromCloud(accessToken) : null
      const latest = chooseLatestPlayerImproveResumeState(localState, cloudState)
      if (!active) return
      if (latest) writePlayerImproveResumeState(latest, userId)
      setResumeState(latest)
    })().finally(() => {
      if (active) setResumeResolved(true)
    })

    return () => {
      active = false
    }
  }, [authResolved, session?.access_token, userId])

  const primaryAction: RoleHomeAction = {
    detail: 'Run one court rep, score the proof, and save what comes next.',
    cta: 'Start Level Up',
    href: `/level-up/${identitySlug}#level-up-flow`,
    icon: 'reports',
    label: 'Start here',
    title: 'Start today\'s Level Up',
  }
  const resumeHref = getPlayerImproveResumeHref(resumeState)
  const continueAction: RoleHomeAction | null = resumeResolved && userId && resumeHref
    ? {
        label: 'Continue',
        title: `Continue ${resumeState?.lastSurfaceLabel || 'improving'}`,
        detail: [resumeState?.identityTitle, resumeState?.assignmentTitle].filter(Boolean).join(' / ') ||
          'Open the exact Player work you left.',
        cta: 'Continue',
        href: resumeHref,
        icon: resumeState?.lastSurface === 'conversation'
          ? 'messagingCenter'
          : resumeState?.lastSurface === 'assignment'
            ? 'matchPrep'
            : resumeState?.lastSurface === 'player-path'
              ? 'playerRatings'
              : 'reports',
      }
    : null
  const quickActions = [
    {
      detail: 'Goals, proof, and assignments',
      href: '/mylab#player-workshop',
      icon: 'myLab' as const,
      title: 'My Lab',
    },
    {
      detail: 'Map the next point pattern',
      href: tacticsHref,
      icon: 'scenarioBuilder' as const,
      title: 'Tactic plan',
    },
    {
      detail: 'Review your tennis identity',
      href: `/player-development/${identitySlug}`,
      icon: 'playerRatings' as const,
      title: 'Player path',
    },
    {
      detail: 'Prepare for the next opponent',
      href: '/matchup',
      icon: 'matchupAnalysis' as const,
      title: 'Match prep',
    },
  ]
  const steps = [
    { title: 'Choose one focus', detail: 'Open your Player path and pick the court habit that matters now.' },
    { title: 'Train and score it', detail: 'Run Level Up and save a simple 0-5 proof score.' },
    { title: 'Use the result', detail: 'Repeat, progress, or take the cue into your next match plan.' },
  ]

  function rememberAction(action: Pick<RoleHomeAction, 'title' | 'href'>) {
    const surface: PlayerImproveResumeSurface = action.href.includes('/messages')
      ? 'conversation'
      : action.href.includes('/level-up')
        ? resumeState?.lastSurface === 'assignment' ? 'assignment' : 'level-up'
        : action.href.includes('/player-development/')
          ? 'player-path'
          : action.href.includes('/mylab')
            ? 'my-lab'
            : 'improve'
    const nextState: PlayerImproveResumeState = {
      ...resumeState,
      identitySlug: resumeState?.identitySlug || identitySlug,
      identityTitle: resumeState?.identityTitle || identityTitle,
      lastSurface: surface,
      lastSurfaceLabel: action.title,
      lastHref: action.href,
      lastVisitedAt: new Date().toISOString(),
    }
    const saved = writePlayerImproveResumeState(nextState, userId)
    if (saved) setResumeState(saved)
    void syncPlayerImproveResumeState(nextState, userId, session?.access_token)
  }

  return (
    <RoleActionHome
      roleLabel="Improve"
      contextLabel="Player path"
      contextValue={resumeState?.identityTitle || identityTitle}
      primaryAction={continueAction || primaryAction}
      quickActions={quickActions}
      helpTitle="Need help getting started?"
      steps={steps}
      resumeKey={userId ? `improve:${userId}` : 'improve'}
      preferPrimaryAction={Boolean(continueAction)}
      onAction={rememberAction}
    />
  )
}
