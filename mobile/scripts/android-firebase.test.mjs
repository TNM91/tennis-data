import {test} from 'node:test'
import assert from 'node:assert/strict'
import {checkAndroidFirebaseConfig} from './android-firebase.mjs'
const config=()=>({project_info:{project_id:'tenaceiq-test',project_number:'1234567890'},client:[{
  client_info:{mobilesdk_app_id:'1:1234567890:android:abcdef1234',android_client_info:{package_name:'com.tenaceiq.app'}},
  api_key:[{current_key:'AIza'+'a'.repeat(35)}],
}]})
test('accepts only the exact Android production Firebase client with matching project metadata',()=>{
  assert.deepEqual(checkAndroidFirebaseConfig(JSON.stringify(config())),{project:'tenaceiq-test',app:'1:1234567890:android:abcdef1234'})
  for(const mutate of [c=>{c.client[0].client_info.android_client_info.package_name='com.other.app'},
    c=>{c.client.push(c.client[0])},c=>{c.project_info.project_number='9999999999'},c=>{c.client[0].api_key=[]}]){
    const c=config();mutate(c);assert.throws(()=>checkAndroidFirebaseConfig(JSON.stringify(c)))
  }
  assert.throws(()=>checkAndroidFirebaseConfig(JSON.stringify({...config(),type:'service_account',private_key:'never-bundle-server-credentials'})))
})
