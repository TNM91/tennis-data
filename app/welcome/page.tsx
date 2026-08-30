'use client'

import Link from 'next/link'
import { CSSProperties, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { getMembershipTier, type MembershipTierId } from '@/lib/product-story'
import { isSafeLocalNextHref } from '@/lib/plan-intent'
import { CAPTAIN_PILOT_PRICE_LABEL } from '@/lib/captain-pilot'

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
    body: `Your account is confirmed. Complete the short team form, then use secure checkout to activate three months of Captain at $0. Payment details are required for renewal at ${CAPTAIN_PILOT_PRICE_LABEL}, but you will not be charged today.`,
    access: 'Your account has Free access until the Captain Pilot activation is complete.',
    primaryLabel: 'Start my Captain Pilot',
    checklist: ['Tell us about your team and the captain problem you want to solve.', 'Complete secure checkout with three months at $0.', 'Open Team Hub and use Captain tools for the next match week.'],
  },
}

export default function WelcomePage() {
  return <SiteShell active="welcome"><WelcomeContent /></SiteShell>
}

function WelcomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authResolved, session } = useAuth()
  const planParam = searchParams.get('plan')
  const planId: MembershipTierId = PLAN_IDS.includes(planParam as MembershipTierId) ? planParam as MembershipTierId : 'free'
  const isCaptainPilot = planId === 'captain' && searchParams.get('next')?.startsWith('/captain-pilot')
  const storyKey = isCaptainPilot ? 'captain-pilot' : planId
  const story = WELCOME_STORIES[storyKey]
  const tier = getMembershipTier(planId)
  const fallbackHref = planId === 'free' ? '/explore' : `/upgrade?plan=${planId}`
  const nextHref = isSafeLocalNextHref(searchParams.get('next'), fallbackHref)
  const email = searchParams.get('email')?.trim() || ''
  const firstName = getFirstName(session?.user.user_metadata)

  useEffect(() => {
    if (authResolved && !session) {
      const params = new URLSearchParams({ plan: planId, next: nextHref })
      if (email) params.set('email', email)
      router.replace(`/login?${params.toString()}`)
    }
  }, [authResolved, email, nextHref, planId, router, session])

  if (!authResolved || !session) {
    return <section style={loadingShell}>Finishing your secure TenAceiQ welcome…</section>
  }

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
        <ol style={steps}>
          {story.checklist.map((step, index) => <li key={step} style={stepRow}><span style={stepNumber}>{index + 1}</span><span>{step}</span></li>)}
        </ol>
        <Link href={nextHref} style={primaryCta}>{story.primaryLabel}</Link>
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

const shell: CSSProperties = { width: 'min(760px, calc(100% - 28px))', margin: '30px auto 52px', display: 'grid', gap: 16 }
const hero: CSSProperties = { padding: '34px', borderRadius: 28, border: '1px solid rgba(125,211,252,0.16)', background: 'linear-gradient(145deg, rgba(6,23,47,0.98), rgba(11,36,70,0.94))', boxShadow: '0 24px 70px rgba(2,8,23,0.42)' }
const eyebrow: CSSProperties = { margin: 0, color: 'var(--brand-green)', fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }
const title: CSSProperties = { margin: '12px 0 14px', color: '#fff', fontSize: 'clamp(32px, 6vw, 48px)', lineHeight: 0.98, letterSpacing: '-0.04em' }
const body: CSSProperties = { margin: 0, maxWidth: 640, color: 'rgba(234,244,255,0.8)', fontSize: 17, lineHeight: 1.55 }
const accessPill: CSSProperties = { display: 'inline-flex', marginTop: 20, padding: '9px 12px', borderRadius: 999, background: 'rgba(155,225,29,0.13)', border: '1px solid rgba(155,225,29,0.3)', color: '#ebffd0', fontWeight: 800, fontSize: 13 }
const card: CSSProperties = { display: 'grid', gap: 16, padding: '28px 30px', borderRadius: 24, border: '1px solid rgba(125,211,252,0.16)', background: 'rgba(15,23,42,0.72)' }
const cardLabel: CSSProperties = { margin: 0, color: 'var(--home-eyebrow-color)', fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }
const steps: CSSProperties = { display: 'grid', gap: 12, padding: 0, margin: 0, listStyle: 'none' }
const stepRow: CSSProperties = { display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 11, alignItems: 'start', color: 'var(--foreground)', fontSize: 15, fontWeight: 650, lineHeight: 1.42 }
const stepNumber: CSSProperties = { display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 999, background: 'var(--brand-green)', color: '#06172f', fontSize: 12, fontWeight: 900 }
const primaryCta: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 15, padding: '0 20px', background: 'var(--brand-green)', color: '#06172f', textDecoration: 'none', fontWeight: 900, fontSize: 16 }
const secondaryCta: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, color: 'var(--foreground)', textDecoration: 'none', fontWeight: 800, fontSize: 14 }
const finePrint: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', fontSize: 13, lineHeight: 1.45, textAlign: 'center' }
const loadingShell: CSSProperties = { width: 'min(760px, calc(100% - 28px))', margin: '48px auto', padding: '22px', borderRadius: 20, color: 'var(--foreground-strong)', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(125,211,252,0.16)', fontWeight: 800 }
