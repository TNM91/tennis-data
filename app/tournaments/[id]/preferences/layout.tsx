import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  return {
    title: 'Tournament Notification Preferences',
    description:
      'Manage tournament notification preferences for a TenAceIQ event.',
    alternates: {
      canonical: `/tournaments/${encodeURIComponent(String(id))}/preferences`,
    },
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default function TournamentPreferencesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
