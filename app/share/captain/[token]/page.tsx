import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCaptainShareDescription, getCaptainShareLabel, getCaptainShareTitle } from '@/lib/captain-share-links'
import { getCaptainShareLink } from '@/lib/captain-share-links-server'
import CaptainShareRedirect from './captain-share-redirect'

type CaptainSharePageProps = { params: Promise<{ token: string }> }

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: CaptainSharePageProps): Promise<Metadata> {
  const { token } = await params
  const share = await getCaptainShareLink(token)
  if (!share) return { title: 'Captain update unavailable', robots: { index: false, follow: false } }
  const title = getCaptainShareTitle(share)
  const description = getCaptainShareDescription(share)
  const path = `/share/captain/${encodeURIComponent(token)}`
  const image = `${path}/opengraph-image`
  return {
    title: { absolute: `${title} | TenAceIQ` },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: 'TenAceIQ',
      title,
      description,
      url: path,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function CaptainSharePage({ params }: CaptainSharePageProps) {
  const { token } = await params
  const share = await getCaptainShareLink(token)
  if (!share) notFound()
  const label = getCaptainShareLabel(share)
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--background)', color: 'var(--foreground-strong)' }}>
      <CaptainShareRedirect href={share.targetHref} />
      <section style={{ width: 'min(560px, 100%)', padding: 32, border: '1px solid rgba(155,225,29,.28)', borderRadius: 24, background: '#0b2346' }}>
        <p style={{ margin: 0, color: '#9be11d', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</p>
        <h1 style={{ margin: '10px 0', fontSize: 'clamp(2rem, 7vw, 3.5rem)', lineHeight: 1 }}>{share.teamName || 'Team update'}</h1>
        <p style={{ color: '#d9e6f2', fontSize: 18 }}>{[share.opponent ? `vs ${share.opponent}` : '', share.matchDate, share.detail].filter(Boolean).join(' · ')}</p>
        <Link href={share.targetHref} style={{ display: 'inline-flex', marginTop: 12, padding: '12px 18px', borderRadius: 999, background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)', color: 'var(--foreground-strong)', fontWeight: 900, textDecoration: 'none' }}>
          Open {label.toLowerCase()}
        </Link>
      </section>
    </main>
  )
}
