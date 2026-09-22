import { describe, expect, it } from 'vitest'
import { getTeamRoomMessageLinkLabel, tokenizeTeamRoomMessageBody } from '@/lib/team-room-message-links'

describe('Team Room message links', () => {
  it('turns safe web links into clickable segments and preserves surrounding copy', () => {
    expect(tokenizeTeamRoomMessageBody('Open https://tenaceiq.com/team-room?room=123, then reply.')).toEqual([
      { text: 'Open ' },
      { text: 'https://tenaceiq.com/team-room?room=123', href: 'https://tenaceiq.com/team-room?room=123' },
      { text: ',' },
      { text: ' then reply.' },
    ])
  })

  it('does not make non-web schemes clickable', () => {
    expect(tokenizeTeamRoomMessageBody('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }])
  })

  it('gives long team links a useful short label without changing their destination', () => {
    expect(getTeamRoomMessageLinkLabel('https://www.tenaceiq.com/pr/PDNpC97EQyGcQV-J2DN6Bg')).toBe('Open practice RSVP ↗')
    expect(getTeamRoomMessageLinkLabel('https://www.tenaceiq.com/share/captain/lineup?to=long-query')).toBe('Open shared lineup ↗')
    expect(getTeamRoomMessageLinkLabel('https://example.com/a/long/link')).toBe('example.com ↗')
  })
})
