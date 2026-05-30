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
import { TiqCoachAssignmentCard, TiqWorkspacePreview } from '@/app/components/tiq-product-preview-cards'
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

const previewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 14,
  minWidth: 0,
}
