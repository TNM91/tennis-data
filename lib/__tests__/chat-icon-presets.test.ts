import type {SupabaseClient} from '@supabase/supabase-js'
import {describe, expect, it, vi} from 'vitest'
import {readChatIcon} from '../chat-icon-url'
import {loadTeamLogoUrls, readTeamLogoChoice} from '../team-branding-storage'

const legacy = '11111111-1111-4111-8111-111111111111'
const builtin = '22222222-2222-4222-8222-222222222222'
const path = `team-logos/${legacy}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`
const signedUrl = `https://pwxppfazbyourjrsutgx.supabase.co/storage/v1/object/sign/team-room-files/${path}?token=test`

describe('built-in chat icons', () => {
  it('accepts only known presets or a return to initials in the launch app', () => {
    expect(readTeamLogoChoice({preset:'rally'}, true)).toBe('rally')
    expect(readTeamLogoChoice({preset:null}, true)).toBeNull()
    expect(readTeamLogoChoice({preset:'https://example.test/logo.jpg'}, true)).toBeUndefined()
    expect(readTeamLogoChoice({preset:'rally',photo:null}, true)).toBeUndefined()
    expect(readTeamLogoChoice({photo:null}, true)).toBeUndefined()
    expect(readChatIcon(signedUrl, true)).toBeUndefined()
    expect(readChatIcon('tiq-icon:unknown', true)).toBeUndefined()
  })

  it('returns the shared preset while leaving legacy file URLs unsigned for the launch app', async () => {
    const query = {select:vi.fn().mockReturnThis(),in:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),
      limit:vi.fn().mockResolvedValue({error:null,data:[
        {id:legacy,metadata:{teamLogo:{bucket:'team-room-files',path}}},
        {id:builtin,metadata:{teamLogo:{preset:'doubles'}}},
      ]})}
    const sign = vi.fn().mockResolvedValue({data:[{path,signedUrl}]})
    const service = {from:()=>query,storage:{from:()=>({createSignedUrls:sign})}} as unknown as SupabaseClient
    const ids = [legacy,builtin]
    expect(await loadTeamLogoUrls(service,ids,'team_room',true)).toEqual(new Map([[builtin,'tiq-icon:doubles']]))
    expect(sign).not.toHaveBeenCalled()
    expect(await loadTeamLogoUrls(service,ids)).toEqual(new Map([[legacy,signedUrl],[builtin,'tiq-icon:doubles']]))
  })
})
