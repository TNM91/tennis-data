import { describe, expect, it } from 'vitest'
import { tokenizeTeamRoomMessageBody } from '@/lib/team-room-message-links'

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
})
