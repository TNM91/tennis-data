// Local-only synthetic browser harness. Real UI components; fake invitations
// and responses. No credentials, messages, or production database writes.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import path from 'node:path'

const root = process.cwd()
const token = '66666666-6666-4666-8666-666666666666'
const scope = { team: 'Aces', league: '2027 Fall', flight: '4.0', seasonKey: '["2027","2027 Fall","4.0"]' }
const matches = Array.from({ length: 14 }, (_, i) => ({ id: `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`, external_match_id: `test-${i}`, home_team: 'Aces', away_team: i % 2 ? 'Volleys' : 'Smash', league_name: '2027 Fall', flight: '4.0', match_date: i < 12 ? `2026-${i < 6 ? '09' : '12'}-${String(i + 14).padStart(2, '0')}` : `2027-01-${i === 12 ? '03' : '10'}`, match_time: '18:00:00', facility: '', line_number: null, match_type: null }))
const roster = ['Jordan', 'Taylor', 'Morgan'].map((name, i) => ({ key: `p${i}`, playerId: `p${i}`, name }))
let invites = []
let replies = []
await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import TeamSeasonCalendar from './app/components/team-season-calendar'; createRoot(document.getElementById('root')).render(<TeamSeasonCalendar team="Aces" matches={${JSON.stringify(matches)}} userId="test-captain" accessToken="synthetic" importHref="/unused" canStartSeason />);`, resolveDir: root, loader: 'tsx' }, bundle: true, format: 'esm', outfile: path.join(root, 'artifacts/season-kickoff-browser/fixture.js'), jsx: 'automatic', plugins: [{ name: 'fixture-link', setup(builder) {
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'fixture-link', namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default function Link(props) { return <a {...props} /> }', loader: 'jsx', resolveDir: root }))
} }], define: { 'process.env.NODE_ENV': '"production"' } })
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3021')
    if (url.pathname === '/captain-fixture') {
      res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{background:#06172f;font:16px system-ui;margin:0;padding:16px;box-sizing:border-box}#root{max-width:720px;margin:auto}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>'); return
    }
    if (['/fixture.js','/fixture.css'].includes(url.pathname)) {
      res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(await readFile(path.join(root, 'artifacts/season-kickoff-browser', url.pathname.slice(1)))); return
    }
    if (url.pathname.startsWith('/api/season-availability/') || url.pathname === '/api/captain/season-kickoff') {
      let body = ''; for await (const chunk of req) body += chunk
      const input = body ? JSON.parse(body) : {}
      if (url.pathname === '/api/captain/season-kickoff') {
        if (req.method === 'POST') invites = roster.filter(player => input.playerKeys.includes(player.key)).map((player, i) => ({ id: `invite-${i}`, roster_key: player.key, player_id: player.playerId, player_name: player.name, response_token: token, revoked_at: null, match_ids: matches.map(match => match.id) }))
        const readiness = matches.map(match => { const rows = replies.filter(reply => reply.match_id === match.id); return { matchId: match.id, available: rows.filter(row => row.status === 'available').length, maybe: rows.filter(row => row.status === 'maybe').length, unavailable: rows.filter(row => row.status === 'unavailable').length, waiting: Math.max(0, invites.length - rows.length) } })
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, roster, matches, invites, replies, readiness })); return
      }
      if (req.method === 'POST') {
        replies = [...replies.filter(reply => !input.responses.some(answer => answer.matchId === reply.match_id)), ...input.responses.map(answer => ({ invite_id: 'invite-0', match_id: answer.matchId, match_date: answer.matchDate, match_time: answer.matchTime, status: answer.status }))]
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, saved: input.responses.length })); return
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, scope, playerName: 'Jordan', matches, replies, today: '2026-09-07', calendarToken: '77777777-7777-4777-8777-777777777777' })); return
    }
    const upstream = await fetch(`http://localhost:3030${req.url}`, { headers: { 'accept-encoding': 'identity' }, redirect: 'manual' })
    res.statusCode = upstream.status
    upstream.headers.forEach((value, key) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) res.setHeader(key, value) })
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) { res.statusCode = 500; res.end(error.message) }
})
server.listen(3021, '127.0.0.1', () => console.log(`Synthetic UI harness: http://localhost:3021/captain-fixture and /season-availability#${token}`))
