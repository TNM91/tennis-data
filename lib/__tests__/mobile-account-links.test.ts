import { describe, expect, it } from 'vitest'
import { accountLink, PASSWORD_RESET_URL } from '../../mobile/src/account-actions'

describe('mobile account destinations', () => {
  it('opens only the fixed public help destinations', () => {
    expect(accountLink('privacy')).toBe('https://www.tenaceiq.com/legal/privacy')
    expect(accountLink('terms')).toBe('https://www.tenaceiq.com/legal/terms')
    expect(accountLink('support')).toBe('https://www.tenaceiq.com/contact')
    for (const key of ['https://evil.example', '//evil.example', 'javascript:alert(1)', 'constructor', '__proto__', 'privacy?token=secret', '']) {
      expect(accountLink(key)).toBeNull()
    }
  })
  it('uses the existing HTTPS password-reset route without account data', () => {
    const url = new URL(PASSWORD_RESET_URL)
    expect(url.origin).toBe('https://www.tenaceiq.com')
    expect(url.pathname).toBe('/reset-password')
    expect(url.search + url.hash).toBe('')
  })
})
