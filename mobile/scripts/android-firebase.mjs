import assert from 'node:assert/strict'

/** Firebase's client config is public app metadata, never a server service key. */
export function checkAndroidFirebaseConfig(bytes) {
  const data = JSON.parse(String(bytes))
  assert.ok(data && typeof data === 'object' && !('private_key' in data) && !('type' in data), 'Use google-services.json, not a service-account key.')
  assert.match(data.project_info?.project_id ?? '', /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/)
  assert.match(data.project_info?.project_number ?? '', /^[0-9]{6,20}$/)
  assert.ok(Array.isArray(data.client), 'Firebase Android clients are missing.')
  const clients = data.client.filter(client => client?.client_info?.android_client_info?.package_name === 'com.tenaceiq.app')
  assert.equal(clients.length, 1, 'Firebase must contain exactly one production TenAceIQ Android client.')
  const client = clients[0]
  assert.match(client.client_info.mobilesdk_app_id ?? '', /^1:[0-9]{6,20}:android:[a-f0-9]+$/)
  assert.ok(client.client_info.mobilesdk_app_id.startsWith('1:'+data.project_info.project_number+':android:'), 'Firebase app and project disagree.')
  assert.ok(Array.isArray(client.api_key) && client.api_key.some(key => /^AIza[A-Za-z0-9_-]{35}$/.test(key.current_key ?? '')), 'Firebase client API key is missing.')
  return {project:data.project_info.project_id,app:client.client_info.mobilesdk_app_id}
}
