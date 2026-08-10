export const CONTACT_EMAILS = {
  info: 'info@tenaceiq.com',
  support: 'support@tenaceiq.com',
  nathan: 'nathan@tenaceiq.com',
} as const

type ContactEmailKey = keyof typeof CONTACT_EMAILS

type PublicEmailContact = {
  key: ContactEmailKey
  title: string
  description: string
  address: (typeof CONTACT_EMAILS)[ContactEmailKey]
  href: string
}

function buildEmailHref(address: string, subject: string) {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`
}

export const PUBLIC_EMAIL_CONTACTS: PublicEmailContact[] = [
  {
    key: 'info',
    title: 'General questions',
    description: 'Questions about TenAceIQ, memberships, or where to get started.',
    address: CONTACT_EMAILS.info,
    href: buildEmailHref(CONTACT_EMAILS.info, 'TenAceIQ question'),
  },
  {
    key: 'support',
    title: 'Account and product support',
    description: 'Help with access, billing, data, or something that is not working.',
    address: CONTACT_EMAILS.support,
    href: buildEmailHref(CONTACT_EMAILS.support, 'TenAceIQ support request'),
  },
  {
    key: 'nathan',
    title: 'League and partnership inquiries',
    description: 'Talk with Nathan about leagues, clubs, partnerships, or product feedback.',
    address: CONTACT_EMAILS.nathan,
    href: buildEmailHref(CONTACT_EMAILS.nathan, 'TenAceIQ league or partnership inquiry'),
  },
]
