import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTACT_EMAILS, PUBLIC_EMAIL_CONTACTS } from '../contact-details'

describe('public contact email addresses', () => {
  it('publishes the three TenAceIQ email aliases', () => {
    expect(CONTACT_EMAILS).toEqual({
      info: 'info@tenaceiq.com',
      support: 'support@tenaceiq.com',
      nathan: 'nathan@tenaceiq.com',
    })

    expect(PUBLIC_EMAIL_CONTACTS.map((contact) => contact.address)).toEqual(
      Object.values(CONTACT_EMAILS),
    )
    expect(PUBLIC_EMAIL_CONTACTS.every((contact) => contact.href.startsWith(`mailto:${contact.address}`))).toBe(true)
  })

  it('uses the public contact list on the Contact page without exposing the forwarding inbox', () => {
    const contactSource = readFileSync('app/contact/page.tsx', 'utf8')
    const publicContactSource = readFileSync('lib/contact-details.ts', 'utf8')

    expect(contactSource).toContain('PUBLIC_EMAIL_CONTACTS.map')
    expect(`${contactSource}\n${publicContactSource}`).not.toMatch(/tenaceiq@gmail\.com/i)
  })
})
