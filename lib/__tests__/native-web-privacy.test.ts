import {describe, expect, it} from 'vitest'
import {nativeWebUrl, nativeWebPrivacy, rememberNativeWebPrivacy, NATIVE_WEB_SESSION_KEY} from '../native-web-privacy'

describe('native web privacy visits', () => {
  it('marks only TenAceIQ HTML destinations and preserves their query and fragment', () => {
    const result = new URL(nativeWebUrl('https://www.tenaceiq.com/lineup-review/token?team=Ace%20Squad#private-reply'))
    expect(result.searchParams.get('tiq_app')).toBe('ios')
    expect(result.searchParams.get('team')).toBe('Ace Squad')
    expect(result.hash).toBe('#private-reply')
    expect(nativeWebUrl('https://tenaceiq.com/contact')).toBe('https://tenaceiq.com/contact?tiq_app=ios')
    expect(new URL(nativeWebUrl(result.href)).searchParams.getAll('tiq_app')).toEqual(['ios'])
  })
  it('does not modify other providers, signed API URLs, credentials or lookalike hosts', () => {
    for (const url of ['https://billing.stripe.com/p/session?secret=example', 'https://calendar.google.com/calendar/render?text=Tennis', 'https://www.tenaceiq.com/api/calendar?signature=example', 'https://tenaceiq.com.evil.example/contact', 'https://www.tenaceiq.com@evil.example/contact', 'https://user@example.com/contact', 'https://www.tenaceiq.com:8443/contact', 'http://www.tenaceiq.com/contact', 'mailto:support@tenaceiq.com', 'not a URL']) expect(nativeWebUrl(url)).toBe(url)
  })
  it('keeps an app-origin visit private across navigation and reload in the same tab', () => {
    const values = new Map<string, string>()
    const storage = {getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value) }}
    expect(nativeWebPrivacy('', storage)).toBe(false)
    expect(rememberNativeWebPrivacy('?tiq_app=ios', storage)).toBe(true)
    expect(values.get(NATIVE_WEB_SESSION_KEY)).toBe('1')
    expect(nativeWebPrivacy('?view=team', storage)).toBe(true)
    expect(nativeWebPrivacy('', storage)).toBe(true)
    expect(nativeWebPrivacy('', {getItem: () => null, setItem: () => {}})).toBe(false)
  })
  it('withholds third-party scripts if browser storage cannot be checked', () => {
    const unavailable = {getItem: () => {throw Error('blocked')}, setItem: () => {throw Error('blocked')}}
    expect(nativeWebPrivacy('', unavailable)).toBe(true)
    expect(rememberNativeWebPrivacy('?tiq_app=ios', unavailable)).toBe(true)
    expect(nativeWebPrivacy('?tiq_app=android', {getItem: () => null, setItem: () => {}})).toBe(false)
  })
})
