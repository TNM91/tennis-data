const SITE_URL = 'https://tenaceiq.com'

type BreadcrumbItem = {
  name: string
  path: string
}

type FaqItem = {
  question: string
  answer: string
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TenAceIQ',
    url: SITE_URL,
    logo: `${SITE_URL}/tenaceiq-icon-512.png`,
    slogan: 'More Tennis. Less Chaos.',
    description:
      'TenAceIQ helps tennis players, coaches, captains, tournament directors, and league organizers find, prepare, improve, run events, and fix tennis data.',
  }
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TenAceIQ',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/explore?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildBreadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  }
}

export function buildPublicSectionBreadcrumbJsonLd(name: string, path: string) {
  return buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name, path },
  ])
}

export function buildFaqJsonLd(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
