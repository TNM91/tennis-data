import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,access,unlink} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {androidAppId} from './native-bundle-target.mjs'
import {checkAndroidConfig,androidGradle,androidManifest,androidDataExtraction,androidMainActivity,androidLegacyIcon,androidAdaptiveIcon,androidStyles,androidStyles27,androidStyles29} from './android-project.mjs'

const mobile=fileURLToPath(new URL('../',import.meta.url)),project=resolve(mobile,'android'),marker=resolve(project,'.tenaceiq-project.json')
const exists=path=>access(path).then(()=>true,()=>false),hash=data=>createHash('sha256').update(data).digest('hex')
const config=JSON.parse(await readFile(resolve(mobile,'capacitor.config.json'),'utf8')),scope=JSON.parse(await readFile(resolve(mobile,'bundled/android-release.json'),'utf8'))
checkAndroidConfig(config,scope)
assert.deepEqual(JSON.parse(await readFile(resolve(mobile,'bundled/release-scope.json'),'utf8')),{profile:'first-party-full',version:1})
const present=await exists(project)
let previous=null
if(present){
  assert.ok(await exists(marker),'Existing Android project is not managed by this release lane. Preserve it and review before preparing.')
  previous=JSON.parse(await readFile(marker,'utf8'));assert.equal(previous.appId,androidAppId);assert.equal(previous.version,1)
  for(const [name,digest] of Object.entries(previous.files))assert.equal(hash(await readFile(resolve(project,name))),digest,'Preserve manually edited Android file: '+name)
}
const result=spawnSync(process.execPath,[resolve(mobile,'node_modules/@capacitor/cli/bin/capacitor'),present?'sync':'add','android'],{cwd:mobile,stdio:'inherit',windowsHide:true})
if(result.error)throw result.error
assert.equal(result.status,0,'Capacitor Android preparation failed')
const gradlePath=resolve(project,'app/build.gradle'),currentGradle=await readFile(gradlePath,'utf8')
const files={
  'app/build.gradle':androidGradle(currentGradle),
  'app/src/main/AndroidManifest.xml':androidManifest,
  'app/src/main/java/com/tenaceiq/app/MainActivity.java':androidMainActivity,
  'app/src/main/res/xml/data_extraction_rules.xml':androidDataExtraction,
  'app/src/main/res/values/tenaceiq_launcher.xml':'<resources><color name="tenaceiq_launcher_background">#061326</color><color name="tenaceiq_accent">#b5eb46</color></resources>\n',
  'app/src/main/res/values/styles.xml':androidStyles,
  'app/src/main/res/values-v27/styles.xml':androidStyles27,
  'app/src/main/res/values-v29/styles.xml':androidStyles29,
  'app/src/main/res/drawable-nodpi/tenaceiq_app_icon.png':await readFile(new URL('../../public/brand/approved/TiQ_AppIcon_Approved.png',import.meta.url)),
}
for(const name of ['ic_launcher','ic_launcher_round']){
  files[`app/src/main/res/mipmap-anydpi/${name}.xml`]=androidLegacyIcon
  files[`app/src/main/res/mipmap-anydpi-v26/${name}.xml`]=androidAdaptiveIcon
}
for(const name of Object.keys(previous?.files??{})){
  if(Object.hasOwn(files,name))continue
  const obsolete=resolve(project,name)
  assert.ok(obsolete.startsWith(project+'/')||obsolete.startsWith(project+'\\'))
  await unlink(obsolete)
}
for(const [name,content] of Object.entries(files)){const destination=resolve(project,name);assert.ok(destination.startsWith(project+'/')||destination.startsWith(project+'\\'));await mkdir(dirname(destination),{recursive:true});await writeFile(destination,content)}
const record={version:1,appId:androidAppId,files:Object.fromEntries(Object.entries(files).map(([name,data])=>[name,hash(data)]))}
await writeFile(marker,JSON.stringify(record,null,2)+'\n')
console.log('Prepared the full first-party Android project. Debug package: com.tenaceiq.app.dev. Google Play publication is not enabled.')
