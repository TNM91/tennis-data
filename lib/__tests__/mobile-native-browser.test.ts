import {beforeEach, describe, expect, it, vi} from 'vitest'
import {readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import {createNativeBrowser} from '../../mobile/src/native-browser'
const open = vi.fn(async () => {})
const Browser = createNativeBrowser(open)

describe('native external page privacy', () => {
  beforeEach(() => open.mockClear())
  it('preserves browser options while opening our support page in private visit mode', async () => {
    await Browser.open({url: 'https://www.tenaceiq.com/contact', presentationStyle: 'popover'})
    expect(open).toHaveBeenCalledWith({url: 'https://www.tenaceiq.com/contact?tiq_app=ios', presentationStyle: 'popover'})
  })
  it('keeps a returned Apple or Stripe management URL exact', async () => {
    const url = 'https://billing.stripe.com/p/session?token=example'
    await Browser.open({url})
    expect(open).toHaveBeenCalledWith({url})
  })
  it('routes every bundled browser entry through the shared privacy helper', () => {
    const root = join(process.cwd(), 'mobile/src')
    const imports = readdirSync(root).filter(name => /\.tsx?$/.test(name)).filter(name => /from ['"]@capacitor\/browser['"]/.test(readFileSync(join(root, name), 'utf8')))
    expect(imports).toEqual(['native-browser.ts'])
  })
})
