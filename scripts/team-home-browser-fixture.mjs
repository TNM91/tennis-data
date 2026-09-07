// Local synthetic team-card preview. No credentials or production writes.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
const directory = 'artifacts/team-home-browser'
await build({ entryPoints: ['scripts/team-home-browser-fixture.tsx'], bundle: true, jsx: 'automatic', format: 'esm', outfile: directory + '/fixture.js',
  plugins: [{ name: 'local-link', setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default function Link(p){return <a {...p}/>}', loader: 'jsx', resolveDir: process.cwd() }))
  } }], define: { 'process.env.NODE_ENV': '"production"' } })
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3022')
    if (url.pathname === '/phone-team') {
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><body style="margin:0;background:#ddd"><iframe title="Built team page at phone width" src="/teams/Meinert~2FThe%20Other%20Guys%20(F)?layer=usta&amp;league=2027+Adult+18+%26+Over+Fall&amp;flight=Men+4.5+%28F%29" style="border:0;display:block;margin:16px auto;width:390px;height:950px"></iframe></body></html>'); return
    }
    if (['/teams/', '/_next/', '/brand/', '/api/'].some(prefix => url.pathname.startsWith(prefix))) {
      // Anonymous local production-bundle preview; never forward browser cookies.
      const upstream = await fetch('http://localhost:3030' + req.url, { headers: { 'accept-encoding': 'identity' } })
      res.statusCode = upstream.status
      // Permit only this loopback preview's same-origin phone frame. Production headers stay untouched.
      upstream.headers.forEach((value, key) => {
        if (['content-encoding', 'content-length', 'transfer-encoding', 'x-frame-options'].includes(key)) return
        res.setHeader(key, key.startsWith('content-security-policy') ? value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") : value)
      })
      res.end(Buffer.from(await upstream.arrayBuffer())); return
    }
    if (url.pathname === '/phone') {
      const width = url.searchParams.get('width') === '320' ? 320 : 390
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><body style="margin:0;background:#ddd"><iframe title="Phone team preview" src="/" style="border:0;display:block;margin:16px auto;width:' + width + 'px;height:950px"></iframe></body></html>'); return
    }
    if (url.pathname === '/fixture.js' || url.pathname === '/fixture.css') {
      res.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript')
      res.end(await readFile(directory + url.pathname)); return
    }
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;background:#06172f;color:#b7c9d9;font:16px system-ui;padding:18px;box-sizing:border-box}main{max-width:1100px;margin:auto}p{margin:0}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>')
  } catch (e) { res.statusCode = 500; res.end(e.message) }
}).listen(3022, '127.0.0.1', () => console.log('Synthetic Teams preview: http://localhost:3022 and /phone'))
