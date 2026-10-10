import type { Metadata } from 'next'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildShareCardImageUrl } from '@/lib/share-card'
import { notFound } from 'next/navigation'
import { decodeTeamRouteSegment, buildTeamProfileHref } from '@/lib/team-routes'
import { getPublicTeamProfile } from '@/lib/public-competition-evidence-server'
import { isDiscoverablePublicTeam } from '@/lib/public-competition-evidence'
import { PublicCompetitionContentProvider } from '@/app/components/public-competition-content-context'
import PublicTeamProfileSnapshot from '@/app/components/public-team-profile-snapshot'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>
}): Promise<Metadata> {
  const { team } = await params
  const name = decodeTeamRouteSegment(String(team))
  const evidence = await getPublicTeamProfile(name)
  if (!evidence) return { robots: { index: false, follow: true } }
  const path = buildTeamProfileHref(name)
  const description = `Review scored public court results, opponents, and competition context for ${name}. Court results are separate from team-tie standings.`
  const metadata = buildRouteMetadata({ title: `${name} Team Intelligence`, description, path,
    image: buildShareCardImageUrl({ kind: 'team', title: name, subtitle: evidence.results[0]?.league || 'Public team evidence', detail: 'Court results · Opponents · Competition context' }),
  })
  return isDiscoverablePublicTeam(evidence) ? metadata : { ...metadata, robots: { index: false, follow: true } }
}

export default async function TeamDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ team: string }>
}) {
  const { team } = await params
  const name = decodeTeamRouteSegment(team)
  const evidence = await getPublicTeamProfile(name)
  if (!evidence) notFound()
  return <PublicCompetitionContentProvider teamName={name} teamEvidence={evidence} teamContent={<PublicTeamProfileSnapshot evidence={evidence} />}>{children}</PublicCompetitionContentProvider>
}
