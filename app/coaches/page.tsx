import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import ProductEventTracker from '@/app/components/product-event-tracker'
import {
  CommandHero,
  PublicPageShell,
  SectionHeader,
  TrustStrip,
  TwoColumnStory,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { TiqActionCard, TiqCoachAssignmentCard, TiqWorkspacePreview } from '@/app/components/tiq-product-preview-cards'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Coaches',
  description:
    'Coaching that continues after the lesson. Connect players, coaches, goals, assignments, match notes, and progress in TenAceIQ.',
  path: '/coaches',
})

export default function CoachesPage() {
  return (
    <PublicPageShell active="coaches">
      <main style={pageWrapStyle}>
        <ProductEventTracker
          event={{
            eventName: 'coach_page_viewed',
            surface: 'coach',
            metadata: {
              page: '/coaches',
            },
          }}
        />
        <JsonLd id="coaches-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Coaches', '/coaches')} />
        <CommandHero
          eyebrow="Coaches"
          title="Coaching that continues after the lesson."
          body="TenAceIQ connects players, coaches, goals, assignments, match notes, and progress in one tennis workspace."
          primary={{ href: '/resources?q=find%20a%20coach', label: 'Find a Coach' }}
          secondary={{ href: '/coach', label: 'Open Coach Hub' }}
          searchPlaceholder="Search coaches, player goals, serve practice, lesson notes, or development paths"
        />
        <TwoColumnStory
          leftTitle="For players"
          leftBody="Bring your match history, goals, questions, and progress into every lesson."
          rightTitle="For coaches"
          rightBody="Manage students, plan lessons, assign drills, track progress, and keep players moving between sessions."
        />
        <section style={nextActionSectionStyle} aria-labelledby="coach-next-actions-title">
          <SectionHeader
            eyebrow="Coaching next actions"
            title="Turn a lesson into the next useful tennis move."
            body="Start with the job in front of you: find coaching support, bring better context into a lesson, assign follow-through, or fix the data that should shape the next read."
            titleId="coach-next-actions-title"
          />
          <div style={nextActionGridStyle}>
            {coachNextActions.map((action) => (
              <TiqActionCard
                key={action.title}
                eyebrow={action.eyebrow}
                title={action.title}
                body={action.body}
                metrics={[...action.metrics]}
                href={action.href}
                cta={action.cta}
                event={action.event}
                trust={[...action.trust]}
              />
            ))}
          </div>
        </section>
        <section style={{ display: 'grid', gap: 14 }}>
          <SectionHeader
            eyebrow="Coach Hub preview"
            title="Match to goal to lesson to evidence."
            body="The loop is simple: Match, Goal, Lesson, Assignment, Evidence, Next Match."
          />
          <div style={previewGridStyle}>
            <TiqWorkspacePreview
              eyebrow="Coach Hub"
              title="Students"
              body="See linked players, lesson focus, due assignments, and next review."
              metrics={[
                { label: 'Players', value: '12' },
                { label: 'Due', value: '4' },
                { label: 'Review', value: '2' },
              ]}
              href="/coach"
              cta="Open Coach Hub"
              event={{
                eventName: 'coach_hub_clicked',
                surface: 'coach',
                metadata: {
                  location: 'coaches_preview',
                },
              }}
            />
            <TiqCoachAssignmentCard
              title="Serve target routine"
              body="Assign drills with evidence the player can bring back after practice."
              metrics={[
                { label: 'Due', value: 'Friday' },
                { label: 'Evidence', value: '3 points' },
                { label: 'Status', value: 'Active' },
              ]}
              href="/player-development"
              cta="Open Paths"
              event={{
                eventName: 'coach_assignment_preview_clicked',
                surface: 'coach',
                metadata: {
                  location: 'coaches_preview',
                },
              }}
            />
          </div>
        </section>
        <section style={{ display: 'grid', gap: 10 }}>
          <SectionHeader
            eyebrow="Trust and safety"
            title="Coach profiles should be clear about verification."
            body="Future coach profiles can show verified email, coaching location, adult/youth availability, certifications if provided, Safe Play or background-check status where applicable, and clear not-verified labels."
          />
          <TrustStrip
            context="Coaches trust strip"
            signals={[
              { label: 'Source', value: 'Coach profile', tone: 'info' },
              { label: 'Freshness', value: 'Owner updated', tone: 'info' },
              { label: 'Confidence', value: 'Provided fields', tone: 'warn' },
              { label: 'Status', value: 'Not verified by TenAceIQ', tone: 'warn' },
            ]}
          />
        </section>
      </main>
    </PublicPageShell>
  )
}

const coachNextActions = [
  {
    eyebrow: 'Find support',
    title: 'Find a coach',
    body: 'Start from the resource hub when a player needs a lesson, clinic, hitting plan, or coaching direction.',
    metrics: [
      { label: 'Need', value: 'Coach' },
      { label: 'Context', value: 'Goals' },
      { label: 'Next', value: 'Connect' },
    ],
    href: '/resources?q=find%20a%20coach',
    cta: 'Find a Coach',
    event: {
      eventName: 'find_coach_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_next_actions',
      },
    },
    trust: [
      { label: 'Source', value: 'Resource hub', tone: 'info' },
      { label: 'Status', value: 'Discovery ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Lesson prep',
    title: 'Bring match context',
    body: 'Use goals, matchup questions, and recent player evidence to make the next lesson sharper.',
    metrics: [
      { label: 'Prep', value: 'Goals' },
      { label: 'Evidence', value: 'Matches' },
      { label: 'Use', value: 'Lesson' },
    ],
    href: '/matchup',
    cta: 'Prep a Lesson',
    event: {
      eventName: 'matchup_started',
      surface: 'matchup',
      metadata: {
        location: 'coaches_lesson_prep',
      },
    },
    trust: [
      { label: 'Source', value: 'Player context', tone: 'info' },
      { label: 'Confidence', value: 'Improves with reviewed results', tone: 'warn' },
    ],
  },
  {
    eyebrow: 'Coach Hub',
    title: 'Assign follow-through',
    body: 'Coaches can turn a lesson focus into practice work, due dates, and evidence to review.',
    metrics: [
      { label: 'Assign', value: 'Drills' },
      { label: 'Due', value: 'Next week' },
      { label: 'Review', value: 'Evidence' },
    ],
    href: '/coach',
    cta: 'Open Coach Hub',
    event: {
      eventName: 'coach_hub_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_next_actions',
      },
    },
    trust: [
      { label: 'Status', value: 'Workspace action', tone: 'good' },
      { label: 'Freshness', value: 'Coach updated', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Fix data',
    title: 'Refresh player evidence',
    body: 'Upload scorecards or request a review when a player record, result, or coaching context looks incomplete.',
    metrics: [
      { label: 'Upload', value: 'Scorecard' },
      { label: 'Review', value: 'Needed' },
      { label: 'Feeds', value: 'Coach Hub' },
    ],
    href: '/data-assist?intent=upload-source&context=Coaches%20next%20actions',
    cta: 'Open Data Assist',
    event: {
      eventName: 'data_assist_opened',
      surface: 'data_assist',
      metadata: {
        location: 'coaches_next_actions',
      },
    },
    trust: [
      { label: 'Source', value: 'User upload', tone: 'info' },
      { label: 'Status', value: 'Review before use', tone: 'warn' },
    ],
  },
] as const

const nextActionSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const nextActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const previewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 14,
  minWidth: 0,
}
