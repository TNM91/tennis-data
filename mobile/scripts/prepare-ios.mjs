import {cameraPrivacyPlist} from './ios-camera.mjs'
import {iosPushSources,pushEntitlements} from './ios-push.mjs'
import { readFile, writeFile, access, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { iosIcon } from './ios-icon.mjs'

const mobile = fileURLToPath(new URL('../', import.meta.url))
const config = JSON.parse(await readFile(resolve(mobile, 'capacitor.config.json'), 'utf8'))
if (config.webDir !== 'bundled' || config.server || config.appId !== 'com.tenaceiq.prototype') {
  throw new Error('Run build:bundled first. iOS preparation requires bundled assets and the prototype identifier.')
}
const exists = async path => access(path).then(() => true, () => false)
const ios = resolve(mobile, 'ios')
const hasProject = await exists(ios)
if (hasProject && !await exists(resolve(ios, 'App/CapApp-SPM/Package.swift'))) {
  throw new Error('Existing iOS project is not the expected SPM template. Preserve it and review before regenerating.')
}
const result = spawnSync(process.execPath, [resolve(mobile, 'node_modules/@capacitor/cli/bin/capacitor'),
  ...(hasProject ? ['sync', 'ios'] : ['add', 'ios', '--packagemanager', 'SPM'])], {cwd: mobile, stdio: 'inherit'})
if (result.error) throw result.error
if (result.status !== 0) throw new Error('Capacitor iOS preparation failed.')

// Fresh CLI projects don't contain a shared scheme. Create one explicitly so
// the cloud build doesn't depend on Xcode's per-user auto-generated schemes.
const project = resolve(ios, 'App/App.xcodeproj')
const pbx = await readFile(resolve(project, 'project.pbxproj'), 'utf8')
const target = pbx.match(/([A-F0-9]{24}) \/\* App \*\/ = \{\s+isa = PBXNativeTarget;/)?.[1]
if (!target) throw new Error('Expected the template App target before creating a shared scheme.')
const schemes = resolve(project, 'xcshareddata/xcschemes')
const scheme = resolve(schemes, 'App.xcscheme')
if (!await exists(scheme)) {
  await mkdir(schemes, {recursive: true})
  const reference = `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${target}" BuildableName="App.app" BlueprintName="App" ReferencedContainer="container:App.xcodeproj"/>`
  await writeFile(scheme, `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${reference}</BuildActionEntry></BuildActionEntries></BuildAction>
  <TestAction buildConfiguration="Debug" shouldUseLaunchSchemeArgsEnv="YES"/>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">${reference}</BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">${reference}</BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
`)
}

const icons = resolve(ios, 'App/App/Assets.xcassets/AppIcon.appiconset')
const contents = JSON.parse(await readFile(resolve(icons, 'Contents.json'), 'utf8'))
if (contents.images.length !== 1 || contents.images[0].size !== '1024x1024') {
  throw new Error('Unexpected iOS icon layout; review approved artwork before applying it.')
}
contents.images[0].filename = 'tenaceiq-app-icon.png'
await writeFile(resolve(icons, 'tenaceiq-app-icon.png'), await iosIcon())
await writeFile(resolve(icons, 'Contents.json'), JSON.stringify(contents, null, 2) + '\n')
console.log('Prepared SPM iOS prototype and packaged the approved artwork on the opaque brand navy icon tile. Xcode compilation/signing is not verified on Windows.')

const delegatePath=resolve(ios,'App/App/AppDelegate.swift')
const pushSources=iosPushSources(await readFile(resolve(project,'project.pbxproj'),'utf8'),await readFile(delegatePath,'utf8'))
await writeFile(resolve(project,'project.pbxproj'),pushSources.project)
await writeFile(delegatePath,pushSources.delegate)
await writeFile(resolve(ios,'App/App/Push.entitlements'),pushEntitlements('development'))

const infoPath=resolve(ios,'App/App/Info.plist')
await writeFile(infoPath,cameraPrivacyPlist(await readFile(infoPath,'utf8')))
