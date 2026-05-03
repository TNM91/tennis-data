import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Lab',
  description:
    'Use My Lab to follow players, teams, leagues, and rankings while keeping your tennis context in one place.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function MyLabLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
