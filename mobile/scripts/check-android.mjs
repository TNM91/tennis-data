import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {checkAndroidConfig} from './android-project.mjs'
const mobile=fileURLToPath(new URL('../',import.meta.url)),project=resolve(mobile,'android'),read=name=>readFile(resolve(project,name),'utf8'),hash=data=>createHash('sha256').update(data).digest('hex')
const config=JSON.parse(await read('app/src/main/assets/capacitor.config.json')),scope=JSON.parse(await read('app/src/main/assets/public/android-release.json'))
checkAndroidConfig(config,scope)
const manifest=await read('app/src/main/AndroidManifest.xml'),gradle=await read('app/build.gradle')
assert.match(manifest,/android:allowBackup="false"/);assert.match(manifest,/android:usesCleartextTraffic="false"/);assert.doesNotMatch(manifest,/MANAGE_EXTERNAL_STORAGE|QUERY_ALL_PACKAGES|READ_CONTACTS/)
assert.match(gradle,/applicationId "com\.tenaceiq\.app"/);assert.match(gradle,/release \{\s+debuggable false/);assert.match(gradle,/applicationIdSuffix "\.dev"/)
assert.match(await read('variables.gradle'),/targetSdkVersion = 36/)
assert.deepEqual(JSON.parse(await read('app/src/main/assets/public/release-scope.json')),{profile:'first-party-full',version:1})
for(const name of ['app.js','premium-surfaces.css'])assert.deepEqual(await readFile(resolve(mobile,'bundled',name)),await readFile(resolve(project,'app/src/main/assets/public',name)))
assert.equal(hash(await readFile(new URL('../../public/brand/approved/TiQ_AppIcon_Approved.png',import.meta.url))),hash(await readFile(resolve(project,'app/src/main/res/drawable-nodpi/tenaceiq_app_icon.png'))))
assert.match(await read('app/src/main/java/com/tenaceiq/app/MainActivity.java'),/setWebContentsDebuggingEnabled\(BuildConfig\.DEBUG\)/)
console.log(JSON.stringify({platform:'android',profile:'first-party-full',distribution:scope.distribution,targetSdk:36,bundledAssetsMatch:true,approvedIconBytesMatch:true,sourceChecksPassed:true,googlePlaySubmissionReady:false}))
