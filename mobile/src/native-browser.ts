import {Browser as CapacitorBrowser} from '@capacitor/browser'
import {nativeWebUrl} from '../../lib/native-web-privacy'

/** Keep TenAceIQ pages opened from the app free of advertising and browser analytics. */
export function createNativeBrowser(open: typeof CapacitorBrowser.open = options => CapacitorBrowser.open(options)) {
  return {
    open(options: Parameters<typeof CapacitorBrowser.open>[0]) {
      return open({...options, url: nativeWebUrl(options.url)})
    },
  }
}

export const Browser = createNativeBrowser()
