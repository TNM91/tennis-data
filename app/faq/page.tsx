import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import InfoActionGrid, { type InfoActionCard } from '@/app/components/info-action-grid'
import TierPathway from '@/app/components/tier-pathway'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildFaqJsonLd, buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'FAQ',
  description:
    'Frequently asked questions about TenAceIQ, including Free, Player, Coach Hub, Team Hub, League Office, Tournament Desk, and Full-Court.',
  path: '/faq',
})

const faqActions: InfoActionCard[] = [
  {
    title: 'Which tier?',
    text: 'Free explores, My Lab personalizes, Team Hub leads match week, and League Office operates seasons.',
    href: '/pricing',
    cta: 'Compare tiers',
    icon: 'accountSecurity',
  },
  {
    title: 'Need data fixed?',
    text: DATA_ASSIST_STORY.shortCue,
    href: DATA_ASSIST_STORY.href,
    cta: DATA_ASSIST_STORY.cta,
    icon: 'reports',
  },
  {
    title: 'Need help?',
    text: 'Open support from inside TenAceIQ so account and data context stays together.',
    href: '/messages?compose=support',
    cta: 'Open support',
    icon: 'messagingCenter',
  },
]

const faqSchemaItems = [
  {
    question: 'Is TenAceIQ only for captains?',
    answer:
      'No. Free pages help anyone explore players, teams, leagues, and rankings. Player adds My Lab, data refreshes, Matchup, and Messages. Team Hub adds weekly team decisions. League Office adds the workspace for leagues of players or teams.',
  },
  {
    question: 'What kind of tennis information appears here?',
    answer:
      'TenAceIQ works with player, team, league, ranking, matchup, and scorecard-related context so users can understand performance, roster options, lineup tradeoffs, and season shape.',
  },
  {
    question: 'What is Free versus upgraded?',
    answer:
      'Free centers on discovery and exploration. My Lab makes the site personal. Team Hub adds weekly team decisions. League Office adds season operations. The upgrade path is meant to make life easier only when your needs grow.',
  },
  {
    question: 'How should I report a data issue?',
    answer:
      'Open a TenAceIQ support thread and include the affected league, team, date, player, or match reference. If you have the source record, start with Data Assist so the fix can be reviewed before it changes platform data.',
  },
] as const

export default function FaqPage() {
  return (
    <SiteShell active="/faq">
      <JsonLd id="faq-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('FAQ', '/faq')} />
      <JsonLd id="faq-page-jsonld" data={buildFaqJsonLd(faqSchemaItems)} />
      <InfoPage
        kicker="FAQ"
        title="Common questions about the platform."
        intro="These answers explain what TenAceIQ is built to do and how Free, My Lab, Coach Hub, Team Hub, League Office, Tournament Desk, and Full-Court fit together."
      >
        <InfoActionGrid cards={faqActions} />

        <TierPathway
          compact
          framed={false}
          title="The simple version"
          intro="Free explores, My Lab personalizes, Team Hub leads teams, League Office runs seasons, and Full-Court brings it together."
        />

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Is TenAceIQ only for captains?</h2>
          <p>
            No. Free pages help anyone explore players, teams, leagues, and rankings. Player adds
            My Lab, data refreshes, Matchup, and Messages. Team Hub adds weekly team decisions.
            League Office adds the workspace for leagues of players or teams.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What kind of tennis information appears here?</h2>
          <p>
            The site works with player, team, league, ranking, matchup, and scorecard-related
            context so users can understand performance, roster options, lineup tradeoffs, and
            season shape. {DATA_ASSIST_STORY.shortCue}
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What is Free versus upgraded?</h2>
          <p>
            Free centers on discovery and exploration. My Lab makes the site personal. Team Hub adds
            weekly team decisions. League Office adds season operations. The
            upgrade path is meant to make life easier only when your needs grow.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How should I report a data issue?</h2>
          <p>
            Open a <Link href="/messages?compose=support&category=data">TenAceIQ support thread</Link>{' '}
            and include the affected league, team, date, player, or match reference. If you have the
            source record, start with <Link href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</Link> so the
            fix can be reviewed before it changes platform data.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
