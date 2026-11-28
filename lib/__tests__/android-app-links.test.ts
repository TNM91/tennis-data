import {describe, expect, it} from 'vitest'
import {GET} from '../../app/.well-known/assetlinks.json/route'
import {androidAppLinks} from '../android-app-links'
const components = androidAppLinks[0].relation_extensions['delegate_permission/common.handle_all_urls'].dynamic_app_link_components

describe('Android website association', () => {
  it('trusts only the production package and the verified Play distribution certificate', () => {
    expect(androidAppLinks).toHaveLength(1)
    expect(androidAppLinks[0].relation).toEqual(['delegate_permission/common.handle_all_urls'])
    expect(androidAppLinks[0].target).toEqual({
      namespace: 'android_app', package_name: 'com.tenaceiq.app',
      sha256_cert_fingerprints: ['F1:00:99:F0:01:12:60:B4:B0:5C:CD:C4:41:8F:17:88:7B:A2:D2:8A:1B:5A:4F:99:65:52:9D:9C:87:D4:6F:1F'],
    })
  })

  it('limits dynamic handling to the released content routes and required query fields', () => {
    expect(components.filter(rule => !rule.exclude).map(rule => rule['/'])).toEqual([
      '/coach/invite/*', '/team-room/join', '/team-room', '/chats/join', '/chats',
      '/explore/leagues/tiq/*', '/tournaments/*', '/matches/*',
    ])
    expect(components.find(rule => rule['/'] === '/chats')?.['?']).toEqual({room: '*'})
    expect(components.find(rule => rule['/'] === '/team-room' && !rule.exclude)?.['?']).toEqual({team: '*', league: '*'})
    expect(components.find(rule => rule['/'] === '/chats/join')?.['?']).toEqual({invite: '*'})
    expect(components.find(rule => rule['/'] === '/team-room/join')?.['?']).toEqual({token: '*'})
  })

  it('excludes redirect parameters, nested pages and unresolved practice links before allowing content', () => {
    expect(components.slice(0, 7)).toEqual([
      {'?': {next: '*'}, exclude: true},
      {'/': '/coach/invite/*/*', exclude: true},
      {'/': '/explore/leagues/tiq/*/*', exclude: true},
      {'/': '/tournaments/*/*', exclude: true},
      {'/': '/matches/*/*', exclude: true},
      {'/': '/team-room', '?': {practice: '*'}, exclude: true},
      {'/': '/team-room', '?': {practiceReminder: '*'}, exclude: true},
    ])
    expect(components.at(-1)).toEqual({'/': '*', exclude: true})
  })

  it('serves a public JSON response without an authentication or redirect handoff', async () => {
    const response = GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
    expect(response.headers.has('Location')).toBe(false)
    expect(response.headers.has('Set-Cookie')).toBe(false)
    expect(await response.json()).toEqual(androidAppLinks)
  })
})
