import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import JsonLd from '@/app/components/json-ld'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { TENNIS_GUIDES, getTennisGuide } from '@/lib/tennis-guides'

type GuideProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return TENNIS_GUIDES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: GuideProps): Promise<Metadata> {
  const guide = getTennisGuide((await params).slug)
  if (!guide) notFound()
  return buildRouteMetadata({ title: guide.title, description: guide.description, path: `/resources/guides/${guide.slug}` })
}

export default async function TennisGuidePage({ params }: GuideProps) {
  const guide = getTennisGuide((await params).slug)
  if (!guide) notFound()
  const url = `https://www.tenaceiq.com/resources/guides/${guide.slug}`
  return (
    <SiteShell active="resources">
      <div>
        <JsonLd id="tennis-guide-jsonld" data={{
          '@context': 'https://schema.org', '@type': 'Article', headline: guide.title,
          description: guide.description, datePublished: guide.published,
          author: { '@type': 'Organization', name: 'TenAceIQ', url: 'https://www.tenaceiq.com/about' },
          mainEntityOfPage: url,
        }} />
        <InfoPage kicker="Tennis intelligence guide" title={guide.title} intro={guide.description}>
          <article style={{ maxWidth: 780, lineHeight: 1.75, overflowWrap: 'anywhere' }}>
            <p>By <Link href="/about">TenAceIQ</Link> · Published <time dateTime={guide.published}>October 10, 2026</time></p>
            <p>Worked examples use hypothetical players and results. They explain how to read tennis evidence; they are not official USTA calculations or predictions about a named player.</p>
            {guide.sections.map((section) => (
              <section key={section.title} style={{ marginBlock: 28 }}>
                <h2 className="section-title">{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
            <section aria-label="Sources and next steps">
              <h2 className="section-title">Check the method and keep exploring</h2>
              <p>Rating explanations follow the <Link href="/methodology">TenAceIQ methodology</Link>. TiQ is an independent competitive signal. For official rating and eligibility questions, use your league coordinator and official USTA guidance.</p>
              <p><Link href={guide.nextHref}>{guide.nextLabel}</Link> · <Link href="/data-assist?intent=request-review&context=Tennis%20guide">Request a data correction</Link></p>
              <h3>Keep reading</h3>
              <ul>{TENNIS_GUIDES.filter(({ slug }) => slug !== guide.slug).map((related) => <li key={related.slug}><Link href={`/resources/guides/${related.slug}`}>{related.title}</Link></li>)}</ul>
              <Link href="/resources">All tennis resources</Link>
            </section>
          </article>
        </InfoPage>
      </div>
    </SiteShell>
  )
}
