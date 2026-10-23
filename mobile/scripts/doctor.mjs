import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createDeviceConfig } from './prepare-device.mjs'

const windows = process.platform === 'win32'
const executable = name => windows ? `${name}.exe` : name
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
  (windows ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : join(process.env.HOME || '', 'Library', 'Android', 'sdk'))
const microsoftJavaRoot = 'C:/Program Files/Microsoft'
const microsoftJava21 = windows && existsSync(microsoftJavaRoot)
  ? readdirSync(microsoftJavaRoot).find(name => name.startsWith('jdk-21'))
  : undefined
const javaHome = process.env.JAVA_HOME || (microsoftJava21 ? join(microsoftJavaRoot, microsoftJava21) :
  windows ? 'C:/Program Files/Android/Android Studio/jbr' : '/Applications/Android Studio.app/Contents/jbr/Contents/Home')
const javaReleasePath = join(javaHome, 'release')
const javaMajor = existsSync(javaReleasePath)
  ? Number(readFileSync(javaReleasePath, 'utf8').match(/JAVA_VERSION="(\d+)/)?.[1]) : 0
let missing = false
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'NEEDS SETUP'} ${label}: ${detail}`)
  if (!ok) missing = true
}

check('Node', Number(process.versions.node.split('.')[0]) >= 22, process.versions.node)
check('Java', existsSync(join(javaHome, 'bin', executable('java'))) && javaMajor >= 21 && javaMajor <= 24,
  `Java ${javaMajor || 'not found'}; use Java 21 for this Gradle 8.14 prototype (newer Studio JBR may be incompatible)`)
check('Android SDK', existsSync(join(sdk, 'platforms', 'android-36', 'android.jar')), 'API 36 platform')
check('Build tools', existsSync(join(sdk, 'build-tools', '35.0.0')) || existsSync(join(sdk, 'build-tools', '36.0.0')), 'Install the version requested by Gradle through SDK Manager')
const adb = join(sdk, 'platform-tools', executable('adb'))
check('ADB', existsSync(adb), 'SDK platform-tools')
const emulator = join(sdk, 'emulator', executable('emulator'))
if (existsSync(emulator)) {
  const acceleration = spawnSync(emulator, ['-accel-check'], { encoding: 'utf8', timeout: 15000, windowsHide: true })
  check('Emulator acceleration', acceleration.status === 0,
    (acceleration.stdout || acceleration.stderr || 'Could not complete acceleration check').trim().replace(/\r?\n/g, ' '))
} else {
  check('Emulator runtime', false, 'Install Android Emulator through SDK Manager')
}
if (existsSync(adb)) {
  const result = spawnSync(adb, ['devices'], { encoding: 'utf8', timeout: 15000, windowsHide: true })
  const devices = (result.stdout || '').split(/\r?\n/).filter(line => /\sdevice$/.test(line.trim()))
  check('Device', result.status === 0 && devices.length > 0, `${devices.length} authorized device(s); start an emulator or connect a USB debugging device`)
}

const configPath = new URL('../capacitor.config.json', import.meta.url)
if (existsSync(configPath)) {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    createDeviceConfig(config.server?.url)
    // Emulator's 10.0.2.2 is an alias for this computer, not reachable from the host.
    const probe = new URL(config.server.url)
    if (probe.hostname === '10.0.2.2') probe.hostname = '127.0.0.1'
    probe.pathname = '/login'
    const response = await fetch(probe, { signal: AbortSignal.timeout(60000), redirect: 'manual' })
    check('Local login route', response.status === 200, `HTTP ${response.status}`)
    await response.body?.cancel()
    probe.pathname = '/api/auth/access'
    const access = await fetch(probe, { signal: AbortSignal.timeout(60000), redirect: 'manual' })
    const json = (access.headers.get('content-type') || '').includes('application/json')
    check('Private API route', access.status === 401 && json, `HTTP ${access.status}; expected JSON 401 without credentials`)
    await access.body?.cancel()
  } catch (error) {
    check('Local server', false, error.name === 'TimeoutError' ? 'Login route timed out; check Next.js compilation output' : 'Check local configuration, server, and network access')
  }
} else {
  check('Device configuration', false, 'Run npm run prepare:device -- http://10.0.2.2:3000')
}
console.log('These checks do not prove native compilation, login, or device behavior.')
process.exitCode = missing ? 1 : 0
