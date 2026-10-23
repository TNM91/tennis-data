import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function createDeviceConfig(input) {
  let url
  try { url = new URL(input) } catch { throw new Error('Pass the local Next.js server URL, for example http://10.0.2.2:3000.') }
  const host = url.hostname
  const octets = host.split('.').map(Number)
  const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host) && octets.every(n => n >= 0 && n <= 255)
  const local = host === 'localhost' || host === '[::1]' || (ipv4 && (
    octets[0] === 127 || octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  ))
  if (!local || !['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use a local server origin only: no public hosts, credentials, paths, queries, or fragments.')
  }
  return {
    appId: 'com.tenaceiq.prototype',
    appName: 'TenAceIQ Prototype',
    webDir: 'www',
    loggingBehavior: 'none',
    server: { url: url.origin, cleartext: url.protocol === 'http:' },
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = createDeviceConfig(process.argv[2])
    writeFileSync(new URL('../capacitor.config.json', import.meta.url), `${JSON.stringify(config, null, 2)}\n`)
    console.log('Prepared local device prototype. Run add:android or add:ios once, then sync after URL changes.')
    console.log('Development only. Use test accounts. This configuration must not be submitted to a store.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
