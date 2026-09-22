// Local-only synthetic signup/player/team/reply flow. No real auth, email,
// roster, profile, or response writes. Unknown API paths fail closed.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import path from 'node:path'

const root = process.cwd()
const port = 3024
const output = path.join(root, 'artifacts/availability-onboarding/fixture.js')
const scope = { team: 'SuperSmash Bros / Autumn Aces', league: '2027 Adult 18 & Over Fall', flight: 'Men 4.0', seasonKey: '2027' }
const players = [{ id: 'fixture-player', name: 'Taylor Tennis', location: 'St. Louis, MO' }, { id: 'other-player', name: 'Taylor Tennis', location: 'Springfield, MO' }]
const matches = [0, 1, 2].map(i => ({ id: `fixture-${i}`, home_team: scope.team, away_team: 'Volleys', league_name: scope.league, flight: scope.flight, match_date: `2026-09-${14 + i * 7}`, match_time: '18:00:00', facility: 'Forest Park', line_number: null }))
let linked = process.env.TIQ_FIXTURE_CONNECTED === '1', accepted = linked, replies = []
await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import TeamAvailabilityClient from './app/team-availability/team-availability-client'; import JoinPage from './app/join/page'; import WelcomePage from './app/welcome/page'; createRoot(document.getElementById('root')).render(location.pathname === '/join' ? <JoinPage /> : location.pathname === '/welcome' ? <WelcomePage /> : <TeamAvailabilityClient query={location.search} />);`, resolveDir: root, loader: 'tsx' }, bundle: true, format: 'esm', outfile: output, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'isolated-fixture', setup(builder) {
  for (const [filter, name] of [[/^next\/link$/, 'link'], [/^next\/image$/, 'image'], [/^next\/navigation$/, 'navigation'], [/app\/components\/auth-provider$/, 'auth'], [/app\/components\/site-shell$/, 'shell'], [/(?:^|\/)supabase$/, 'supabase']]) builder.onResolve({ filter }, () => ({ path: name, namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ loader: 'jsx', resolveDir: root, contents: {
    link: 'export default function Link(props){return <a {...props} />}',
    image: 'export default function Image({priority, ...props}){return <img {...props} />}',
    shell: 'export default function Shell({children}){return <>{children}</>}',
    navigation: `export function useSearchParams(){return new URLSearchParams(location.search)}; export function useRouter(){return {replace:href=>location.assign(href),push:href=>location.assign(href),prefetch:()=>{}}}`,
    auth: `export function useAuth(){const signedIn=location.pathname!=='/join'&&!new URLSearchParams(location.search).has('signedOut');return {session:signedIn?{access_token:'synthetic',user:{id:'fixture-user',user_metadata:{}}}:null,userId:signedIn?'fixture-user':null,role:signedIn?'member':'public',entitlements:null,authResolved:true,refreshAuth:async()=>{}}}`,
    supabase: `export const supabase={from:()=>{const q={select:()=>q,ilike:()=>q,order:()=>q,limit:()=>q,abortSignal:signal=>fetch('/fixture-players',{signal}).then(r=>r.json()).then(data=>({data,error:null}))};return q}}; export const supabaseUrl='https://example.invalid'; export const supabaseKey='synthetic';`,
  }[name] }))
} }] })
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  const json = (data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) }
  try {
    if (url.pathname === '/fixture-players') return json(players)
    if (url.pathname === '/api/auth/signup') return json({ ok: true })
    if (url.pathname === '/api/profile/link') {
      let body = ''; for await (const part of req) body += part
      const player = players.find(row => row.id === JSON.parse(body).linkedPlayerId)
      if (!player) return json({ ok: false }, 400)
      linked = true; return json({ ok: true, player, profile: { linked_player_id: player.id, linked_player_name: player.name } })
    }
    if (url.pathname === '/api/team-availability') {
      if (!accepted) return json({ action: 'team', message: 'Connect your team.' }, 403)
      return json({ responseToken: 'fixture-response', focusMatchId: 'fixture-0' })
    }
    if (url.pathname === '/api/team-connections') {
      if (req.method === 'POST') { let body = ''; for await (const part of req) body += part; const input = JSON.parse(body); accepted = linked && input.action === 'accept' && input.connectionId === 'fixture-connection' }
      const connection = { id: 'fixture-connection', teamName: scope.team, leagueName: scope.league, flight: scope.flight, status: accepted ? 'accepted' : 'pending', roles: ['player'], archivedAt: '' }
      return json({ ok: true, pending: linked && !accepted ? [connection] : [], connections: accepted ? [connection] : [], connection })
    }
    if (url.pathname === '/api/season-availability/fixture-response') {
      if (req.method === 'POST') { let body='';for await(const part of req)body+=part;replies=JSON.parse(body).responses.map(answer=>({match_id:answer.matchId,match_date:answer.matchDate,match_time:answer.matchTime,status:answer.status})); return json({ok:true,saved:replies.length}) }
      return json({ scope, playerName: 'Taylor Tennis', matches, replies, today: '2026-09-07', calendarToken: 'fixture-calendar' })
    }
    if (url.pathname.startsWith('/api/')) return json({ message: 'No real APIs in this fixture.' }, 404)
    if (url.pathname === '/fixture.js' || url.pathname === '/fixture.css') { res.setHeader('Content-Type',url.pathname.endsWith('js')?'text/javascript':'text/css');res.end(await readFile(output.replace(/fixture.js$/,url.pathname.slice(1))));return }
    if (url.pathname.startsWith('/brand/')) {
      const base = path.resolve(root, 'public/brand')
      const file = path.resolve(root, 'public', '.' + url.pathname)
      if (!file.startsWith(base + path.sep)) return json({}, 404)
      res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':'image/png');res.end(await readFile(file));return
    }
    if (url.pathname === '/start') { res.writeHead(302,{Location:`/team-availability?${new URLSearchParams({...scope,match:'fixture-0',signedOut:'1'})}`});res.end();return }
    res.setHeader('Content-Security-Policy',"connect-src 'self'")
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic availability onboarding</title><link rel="stylesheet" href="/fixture.css"><style>*{box-sizing:border-box}body{margin:0;background:#06172f;color:white;font:16px system-ui}a{color:inherit}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>')
  } catch (error) { json({message:error.message},500) }
})
server.listen(port,'127.0.0.1',()=>console.log(`Synthetic onboarding: http://localhost:${port}/start`))
