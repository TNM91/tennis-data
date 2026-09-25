'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { getMembershipTier, MY_LAB_STORY, type MembershipTierId } from '@/lib/product-story'
import { isSafeLocalNextHref } from '@/lib/plan-intent'
import { CAPTAIN_PILOT_PRICE_LABEL } from '@/lib/captain-pilot'
import { getAvailabilityEntry } from '@/lib/availability-onboarding'
import { isScorecardSignupIntent } from '@/lib/scorecard-signup'
import { getCaptainPilotClaimHref } from '@/lib/captain-pilot-source'
import { getPlayerProfileConnectPlayerId } from '@/lib/player-profile-acquisition'
import { supabase } from '@/lib/supabase'

const PLAN_IDS: MembershipTierId[] = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court']

type WelcomeStory = {
  eyebrow: string
  title: (name: string) => string
  body: string
  access: string
  primaryLabel: string
  checklist: string[]
}

const WELCOME_STORIES: Record<MembershipTierId | 'captain-pilot', WelcomeStory> = {
  free: {
    eyebrow: 'Your free account is ready',
    title: (name) => name ? `Welcome, ${name}.` : 'Welcome to TenAceiQ.',
    body: 'Start with the tennis context that helps today. You can add tools later when a specific player, team, coaching, or league need calls for them.',
    access: 'You have Free access now. No card is required.',
    primaryLabel: 'Explore tennis',
    checklist: ['Find players, teams, leagues, rankings, and public tennis context.', 'Open a team, schedule, or result that matters to you.', 'Upgrade only when the right tool will save you time or guesswork.'],
  },
  player_plus: {
    eyebrow: 'Your Player path is ready',
    title: (name) => name ? `${name}, build your game with more clarity.` : 'Build your game with more clarity.',
    body: 'Your account is confirmed. Activate Player when you are ready to make My Lab, matchup preparation, development tools, and follows work around your tennis.',
    access: 'You have Free access now. Player unlocks after activation.',
    primaryLabel: 'Activate Player',
    checklist: ['Activate Player to unlock My Lab.', 'Use matchup context to prepare for your next opponent.', 'Save the next useful development focus for your game.'],
  },
  coach: {
    eyebrow: 'Your Coach path is ready',
    title: (name) => name ? `${name}, give every player a better next step.` : 'Give every player a better next step.',
    body: 'Your account is confirmed. Activate Coach when you are ready to plan lessons, assign drills, track development, and follow through between sessions.',
    access: 'You have Free access now. Coach tools unlock after activation.',
    primaryLabel: 'Activate Coach',
    checklist: ['Activate Coach to open Coach Hub.', 'Plan the next lesson or practice block.', 'Connect the next drill, proof, or player follow-through.'],
  },
  captain: {
    eyebrow: 'Your Captain path is ready',
    title: (name) => name ? `${name}, make match week more manageable.` : 'Make match week more manageable.',
    body: 'Your account is confirmed. Activate Captain when you are ready to turn availability, lineups, scouting, readiness, and messages into clearer team decisions.',
    access: 'You have Free access now. Captain tools unlock after activation.',
    primaryLabel: 'Activate Captain',
    checklist: ['Activate Captain to open Team Hub.', 'Collect availability before the next lineup decision.', 'Use team and opponent context to make match week clearer.'],
  },
  league: {
    eyebrow: 'Your League path is ready',
    title: (name) => name ? `${name}, run the season with less admin work.` : 'Run the season with less admin work.',
    body: 'Your account is confirmed. Activate League when you are ready to set up participants, schedules, scores, standings, and organizer follow-through.',
    access: 'You have Free access now. League tools unlock after activation.',
    primaryLabel: 'Activate League',
    checklist: ['Activate League to open League Office.', 'Set up the people, teams, and schedule for the season.', 'Give everyone a clear view of scores and standings.'],
  },
  full_court: {
    eyebrow: 'Your Full-Court path is ready',
    title: (name) => name ? `${name}, connect every tennis role.` : 'Connect every tennis role.',
    body: 'Your account is confirmed. Activate Full-Court when you are ready to connect My Lab, Coach Hub, Team Hub, League Office, and Tournament Desk.',
    access: 'You have Free access now. Full-Court unlocks after activation.',
    primaryLabel: 'Activate Full-Court',
    checklist: ['Activate Full-Court to connect every role path.', 'Move between player, coach, captain, league, and event needs.', 'Keep the next useful tennis decision in one place.'],
  },
  'captain-pilot': {
    eyebrow: 'Fall Captain Pilot',
    title: (name) => name ? `Welcome, ${name}. Your captain’s chair is ready.` : 'Your captain’s chair is ready.',
    body: `Your account is confirmed. Complete the short team form to activate three months of Captain at $0—no card required. Add billing later only if you want to continue at ${CAPTAIN_PILOT_PRICE_LABEL}.`,
    access: 'Your account has Free access until the Captain Pilot activation is complete.',
    primaryLabel: 'Activate 3 months free',
    checklist: ['Confirm your name and team.', 'Activate three free months with no card.', 'Follow the guided team setup to add your team and prepare your first lineup.'],
  },
}

const PLAYER_CONNECTION_WELCOME_STORY: WelcomeStory = {
  eyebrow: 'Your free account is ready',
  title: (name) => name ? `${name}, connect your player.` : 'Connect your player.',
  body: 'Your account is confirmed. Connect your player record to keep your tennis context together, then explore the matches and teams that matter to you.',
  access: 'You have Free access now. No card is required.',
  primaryLabel: 'Connect my player',
  checklist: ['Find and connect your player record.', 'Review your public match and team history.', MY_LAB_STORY.upgradeBody],
}

const FREE_DISCOVERY_WELCOME_STORY: WelcomeStory = {
  eyebrow: 'Your free account is ready',
  title: (name) => name ? `Welcome, ${name}.` : 'Welcome to TenAceIQ.',
  body: 'Start with a player, team, or league you know. Open the public record to see the tennis context that matters to you.',
  access: 'You have Free access now. No card is required.',
  primaryLabel: 'Find a player',
  checklist: [
    'Search a player by name.',
    'Open the profile for ratings, teams, and recent match context.',
    'Open the team or league that matters to your next match.',
  ],
}

export default function WelcomePage() {
  return <SiteShell active="welcome"><WelcomeContent /></SiteShell>
}

function WelcomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authResolved, session } = useAuth()
  const hasSession = Boolean(session)
  const planParam = searchParams.get('plan')
  const planId: MembershipTierId = PLAN_IDS.includes(planParam as MembershipTierId) ? planParam as MembershipTierId : 'free'
  const tier = getMembershipTier(planId)
  const fallbackHref = planId === 'free' ? '/explore' : `/upgrade?plan=${planId}`
  const nextHref = isSafeLocalNextHref(searchParams.get('next'), fallbackHref)
  const pilotClaimHref = planId === 'captain' ? getCaptainPilotClaimHref(nextHref) : null
  const isCaptainPilot = Boolean(pilotClaimHref)
  const storyKey = isCaptainPilot ? 'captain-pilot' : planId
  const isScorecardSignup = isScorecardSignupIntent(searchParams.get('source'), planId, nextHref)
  const selectedPlayerId = planId === 'free' ? getPlayerProfileConnectPlayerId(nextHref) : null
  const [loadedPlayerRecord, setLoadedPlayerRecord] = useState<{ id: string; name: string; location: string | null } | null>(null)
  const selectedPlayerRecord = loadedPlayerRecord?.id === selectedPlayerId ? loadedPlayerRecord : null
  const isPlayerConnectionWelcome = planId === 'free' && (nextHref === '/profile#profile-identity' || Boolean(selectedPlayerId))
  const isDefaultFreeWelcome = planId === 'free' && nextHref === '/explore' && !isScorecardSignup
  const story = isScorecardSignup || isPlayerConnectionWelcome ? PLAYER_CONNECTION_WELCOME_STORY : isDefaultFreeWelcome ? FREE_DISCOVERY_WELCOME_STORY : WELCOME_STORIES[storyKey]
  const primaryHref = pilotClaimHref ?? (isDefaultFreeWelcome ? '/explore/search?scope=players' : nextHref)
  const availabilityHref = planId === 'free' ? getAvailabilityEntry(nextHref)?.href || '' : ''
  const email = searchParams.get('email')?.trim() || ''
  const firstName = getFirstName(session?.user.user_metadata)
  const checklist = selectedPlayerRecord
    ? ['Confirm this is your player record.', ...PLAYER_CONNECTION_WELCOME_STORY.checklist.slice(1)]
    : story.checklist

  useEffect(() => {
    let cancelled = false
    if (!authResolved || !hasSession || !selectedPlayerId) return

    void supabase.from('players').select('name,location').eq('id', selectedPlayerId).maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.name?.trim()) {
          setLoadedPlayerRecord({ id: selectedPlayerId, name: data.name.trim(), location: data.location?.trim() || null })
        }
      })

    return () => { cancelled = true }
  }, [authResolved, hasSession, selectedPlayerId])

  useEffect(() => {
    if (authResolved && !session) {
      const params = new URLSearchParams({ plan: planId, next: nextHref })
      if (email) params.set('email', email)
      router.replace(`/login?${params.toString()}`)
    } else if (authResolved && session && availabilityHref) {
      router.replace(availabilityHref)
    }
  }, [authResolved, availabilityHref, email, nextHref, planId, router, session])

  if (!authResolved || !session) {
    return <section style={loadingShell}>Finishing your secure TenAceiQ welcome…</section>
  }

  if (availabilityHref) return <section style={loadingShell}><div style={card}><h1 style={title}>Your account is ready.</h1><p style={body} role="status">Opening your team’s availability…</p><Link href={availabilityHref} style={primaryCta}>Continue to availability</Link></div></section>

  return (
    <section style={shell}>
      <div style={hero}>
        <p style={eyebrow}>{story.eyebrow}</p>
        <h1 style={title}>{story.title(firstName)}</h1>
        <p style={body}>{story.body}</p>
        <div style={accessPill}>{story.access}</div>
      </div>

      <div style={card}>
        <p style={cardLabel}>Your next three moves</p>
        {selectedPlayerRecord ? (
          <div aria-label="Player record to confirm" style={selectedPlayerRecordStyle}>
            <span style={selectedPlayerRecordLabelStyle}>Record you opened</span>
            <strong>{selectedPlayerRecord.name}{selectedPlayerRecord.location ? ` · ${selectedPlayerRecord.location}` : ''}</strong>
            <span>Confirm this is you on the next page.</span>
          </div>
        ) : null}
        <ol style={steps}>
          {checklist.map((step, index) => <li key={step} style={stepRow}><span style={stepNumber}>{index + 1}</span><span>{step}</span></li>)}
        </ol>
        <Link href={primaryHref} style={primaryCta}>{selectedPlayerRecord ? 'Confirm my player' : story.primaryLabel}</Link>
        {selectedPlayerRecord ? <Link href="/profile#profile-identity" style={secondaryCta}>Choose a different player</Link> : null}
        {isDefaultFreeWelcome ? (
          <>
            <div style={freeChoiceRow} aria-label="Other ways to start exploring">
              <Link href="/explore/search?scope=teams" style={freeChoiceLink}>Find a team</Link>
              <Link href="/explore/search?scope=leagues" style={freeChoiceLink}>Find a league</Link>
            </div>
            <Link href="/profile#profile-identity" style={connectPlayerLink}>
              <strong>Connect my player</strong>
              <span>Bring your ratings, teams, and match history together.</span>
            </Link>
          </>
        ) : null}
        {planId !== 'free' ? <Link href="/explore" style={secondaryCta}>Explore Free first</Link> : null}
        <p style={finePrint}>{isCaptainPilot ? 'Your feedback will help shape the Captain experience for local teams.' : `${tier.name} is always there when you are ready. Start with the next useful tennis action.`}</p>
      </div>
    </section>
  )
}

function getFirstName(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return ''
  const firstName = (metadata as Record<string, unknown>).first_name
  return typeof firstName === 'string' ? firstName.replace(/\s+/g, ' ').trim().slice(0, 60) : ''
}

const shell: CSSProperties = { width: 'min(760px, calc(100% - clamp(20px, 5vw, 28px)))', margin: '30px auto 52px', display: 'grid', gap: 16 }
const hero: CSSProperties = { padding: '34px', borderRadius: 28, border: '1px solid rgba(125,211,252,0.16)', background: 'linear-gradient(145deg, rgba(6,23,47,0.98), rgba(11,36,70,0.94))', boxShadow: '0 24px 70px rgba(2,8,23,0.42)' }
const eyebrow: CSSProperties = { margin: 0, color: 'var(--brand-green)', fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }
const title: CSSProperties = { margin: '12px 0 14px', color: '#fff', fontSize: 'clamp(32px, 6vw, 48px)', lineHeight: 0.98, letterSpacing: '-0.04em' }
const body: CSSProperties = { margin: 0, maxWidth: 640, color: 'rgba(234,244,255,0.8)', fontSize: 17, lineHeight: 1.55 }
const accessPill: CSSProperties = { display: 'inline-flex', marginTop: 20, padding: '9px 12px', borderRadius: 999, background: 'rgba(155,225,29,0.13)', border: '1px solid rgba(155,225,29,0.3)', color: '#ebffd0', fontWeight: 800, fontSize: 13 }
const card: CSSProperties = { display: 'grid', gap: 16, padding: '28px 30px', borderRadius: 24, border: '1px solid rgba(125,211,252,0.16)', background: 'rgba(15,23,42,0.72)' }
const cardLabel: CSSProperties = { margin: 0, color: 'var(--home-eyebrow-color)', fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }
const selectedPlayerRecordStyle: CSSProperties = { display: 'grid', gap: 5, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(155,225,29,0.32)', background: 'rgba(155,225,29,0.08)', color: 'var(--foreground)', fontSize: 14 }
const selectedPlayerRecordLabelStyle: CSSProperties = { color: 'var(--brand-green)', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }
const steps: CSSProperties = { display: 'grid', gap: 12, padding: 0, margin: 0, listStyle: 'none' }
const stepRow: CSSProperties = { display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 11, alignItems: 'start', color: 'var(--foreground)', fontSize: 15, fontWeight: 650, lineHeight: 1.42 }
const stepNumber: CSSProperties = { display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 999, background: 'var(--brand-green)', color: '#071226', fontSize: 12, fontWeight: 900 }
const primaryCta: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 15, padding: '0 20px', background: 'var(--brand-green)', color: '#071226', textDecoration: 'none', fontWeight: 900, fontSize: 16 }
const secondaryCta: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, color: 'var(--foreground)', textDecoration: 'none', fontWeight: 800, fontSize: 14 }
const freeChoiceRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10 }
const freeChoiceLink: CSSProperties = { ...secondaryCta, flex: '1 1 180px', padding: '0 12px', border: '1px solid rgba(125,211,252,0.24)', borderRadius: 12 }
const connectPlayerLink: CSSProperties = { display: 'grid', gap: 3, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(155,225,29,0.32)', background: 'rgba(155,225,29,0.08)', color: 'var(--foreground)', textDecoration: 'none', fontSize: 14 }
const finePrint: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', fontSize: 13, lineHeight: 1.45, textAlign: 'center' }
const loadingShell: CSSProperties = { width: 'min(760px, calc(100% - clamp(20px, 5vw, 28px)))', margin: '48px auto', padding: '22px', borderRadius: 20, color: 'var(--foreground-strong)', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(125,211,252,0.16)', fontWeight: 800 }
