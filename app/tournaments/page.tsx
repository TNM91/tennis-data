import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import {
  CommandHero,
  PublicPageShell,
  SectionHeader,
  TrustStrip,
  TwoColumnStory,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { TiqTournamentDrawCard, TiqWorkspacePreview } from '@/app/components/tiq-product-preview-cards'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Tournaments',
  description:
    'Tournament tennis without the chaos. Find tournaments, enter events, manage draws, schedule courts, collect results, and keep players informed.',
  path: '/tournaments',
})

export default function TournamentsPage() {
  return (
    <PublicPageShell active="tournaments">
      <main style={pageWrapStyle}>
        <JsonLd id="tournaments-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Tournaments', '/tournaments')} />
        <CommandHero
          eyebrow="Tournaments"
          title="Tournament tennis without the chaos."
          body="Find tournaments, enter events, manage draws, schedule courts, collect results, and keep players informed."
          primary={{ href: '#find', label: 'Find Tournaments' }}
          secondary={{ href: '#desk', label: 'Run a Tournament' }}
          searchPlaceholder="Search tournaments, draws, divisions, round robins, court schedules, or results"
        />
        <TwoColumnStory
          id="find"
          leftTitle="For players"
          leftBody="Find events, view divisions, see draws, know your schedule, and follow results."
          rightTitle="For organizers"
          rightBody="Create divisions, manage entries, build draws, schedule courts, collect scores, and publish results."
        />
        <section id="desk" style={{ display: 'grid', gap: 14 }}>
          <SectionHeader
            eyebrow="Tournament Desk"
            title="Entries, draws, courts, results, winners."
            body="Tournament results should feed player profiles, My Lab, Matchup, Coach Hub, rankings, and team or league context where appropriate."
          />
          <div style={previewGridStyle}>
            <TiqTournamentDrawCard
              title="Summer Doubles Classic"
              body="Divisions are open, entries are reviewed, and court blocks are drafted."
              metrics={[
                { label: 'Entries', value: '28' },
                { label: 'Draws', value: 'Draft' },
                { label: 'Courts', value: '6' },
              ]}
              href="/league-coordinator/tournaments"
              cta="Preview Draw"
              event={{
                eventName: 'draw_preview_clicked',
                surface: 'tournaments',
                metadata: {
                  location: 'tournaments_draw_preview',
                },
              }}
              trust={[
                { label: 'Source', value: 'Organizer draft', tone: 'info' },
                { label: 'Freshness', value: 'Updated today', tone: 'good' },
                { label: 'Confidence', value: 'Medium', tone: 'warn' },
                { label: 'Status', value: 'Draws reviewable', tone: 'good' },
              ]}
            />
            <TiqWorkspacePreview
              eyebrow="Results"
              title="Finals and awards"
              body="Publish outcomes, standings, winners, and award-ready recaps."
              metrics={[
                { label: 'Pending', value: '0' },
                { label: 'Winners', value: 'Ready' },
                { label: 'Notify', value: 'Players' },
              ]}
              href="/league-coordinator/tournaments"
              cta="Publish Results"
              event={{
                eventName: 'tournament_desk_clicked',
                surface: 'tournaments',
                metadata: {
                  location: 'tournaments_results_preview',
                },
              }}
              trust={[
                { label: 'Source', value: 'Director entry', tone: 'info' },
                { label: 'Freshness', value: 'Live event', tone: 'good' },
                { label: 'Confidence', value: 'High after review', tone: 'good' },
                { label: 'Status', value: 'Pending publish', tone: 'warn' },
              ]}
            />
          </div>
          <TrustStrip
            signals={[
              { label: 'Source', value: 'Tournament Desk', tone: 'info' },
              { label: 'Freshness', value: 'Schedule changes visible', tone: 'good' },
              { label: 'Confidence', value: 'Improves after score review', tone: 'warn' },
              { label: 'Status', value: 'Players can report issues', tone: 'good' },
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
