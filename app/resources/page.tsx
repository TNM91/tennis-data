import type { Metadata } from 'next'
import JsonLd from '@/app/components/json-ld'
import {
  ActionGrid,
  CommandHero,
  PublicPageShell,
  pageWrapStyle,
  type PublicActionCard,
} from '@/app/components/public-command-center'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Tennis Help and Resources',
  description: 'Learn TenAceIQ, improve your game, add tennis data, or get help.',
  path: '/resources',
})

const resourceActions: PublicActionCard[] = [
  {
    title: 'Learn how TenAceIQ works',
    body: 'See the simple path from free search to Player, Captain, Coach, and League tools.',
    href: '/how-it-works',
    cta: 'How TenAceIQ Works',
    meta: 'Start here',
  },
  {
    title: 'Work on your game',
    body: 'Open drills, skills, Level Up paths, and practical court work.',
    href: '/player-development',
    cta: 'Find Training',
    meta: 'Player help',
  },
  {
    title: 'Set up your tennis profile',
    body: 'Link your Player ID so My Lab, matchups, and team tools start with you.',
    href: '/profile',
    cta: 'Set Up Profile',
    meta: 'Account setup',
  },
  {
    title: 'Add or fix tennis data',
    body: 'Upload a scorecard, schedule, or Player Roster and review what TenAceIQ found.',
    href: '/data-assist?intent=upload-source&context=Resources',
    cta: 'Open Data Assist',
    meta: 'Data help',
  },
  {
    title: 'Get help from TenAceIQ',
    body: 'Find quick answers or send a support message when you are stuck.',
    href: '/faq',
    cta: 'Open Help',
    secondaryHref: '/messages?compose=support',
    secondaryCta: 'Contact Support',
    meta: 'Support',
  },
]

export default function ResourcesPage() {
  return (
    <PublicPageShell active="resources">
      <main style={pageWrapStyle}>
        <JsonLd id="resources-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Help', '/resources')} />
        <CommandHero
          eyebrow="Help"
          title="Find the help you need."
          body="Learn the platform, set up your account, improve your game, add tennis data, or contact support."
          primary={{ href: '/how-it-works', label: 'How TenAceIQ Works' }}
          secondary={{ href: '/faq', label: 'Open FAQ' }}
          showSearch={false}
          showBoard={false}
        />
        <ActionGrid cards={resourceActions} />
      </main>
    </PublicPageShell>
  )
}
