import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeviceConfig } from './prepare-device.mjs'

test('accepts emulator, loopback, and private LAN origins', () => {
  for (const origin of ['http://10.0.2.2:3000', 'http://localhost:3000', 'http://192.168.1.20:3000', 'https://172.16.0.4:3000', 'http://[::1]:3000']) {
    assert.equal(createDeviceConfig(origin).server.url, origin)
  }
  assert.equal(createDeviceConfig('https://localhost:3000').server.cleartext, false)
})

test('rejects public destinations and sensitive URL content', () => {
  for (const input of [undefined, '', 'https://tenaceiq.com', 'http://localhost.evil.com', 'http://172.32.0.1', 'file:///tmp', 'http://user:secret@localhost', 'http://localhost/login', 'http://localhost?token=secret', 'http://localhost/#secret']) {
    assert.throws(() => createDeviceConfig(input))
  }
})
