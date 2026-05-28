import type { Metadata } from 'next'
import { getAwardMetadataById } from '@/lib/route-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return getAwardMetadataById(String(id))
}

export default function AwardCertificateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
