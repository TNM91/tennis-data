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
await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import TeamSeasonCalendar from './app/components/team-season-calendar'; import SeasonKickoff from './app/components/season-kickoff'; createRoot(document.getElementById('root')).render(location.pathname === '/hub-fixture' ? <SeasonKickoff scope={${JSON.stringify(scope)}} token="synthetic" onCalendar={() => {}} /> : <TeamSeasonCalendar team="Aces" matches={${JSON.stringify(matches)}} userId="test-captain" accessToken="synthetic" importHref="/unused" canStartSeason />);`, resolveDir: root, loader: 'tsx' }, bundle: true, format: 'esm', outfile: path.join(root, 'artifacts/season-kickoff-browser/fixture.js'), jsx: 'automatic', plugins: [{ name: 'fixture-link', setup(builder) {
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'fixture-link', namespace: 'fixture' }))
  builder.onResolve({ filter: /app\/components\/auth-provider$/ }, () => ({ path: 'fixture-auth', namespace: 'fixture-auth' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture-auth' }, () => ({ contents: 'export function useAuth() { return { session: null, userId: null } }', loader: 'js' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default function Link(props) { return <a {...props} /> }', loader: 'jsx', resolveDir: root }))
} }], define: { 'process.env.NODE_ENV': '"production"' } })
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3021')
    if (url.pathname === '/phone-fixture') {
      res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><title>Synthetic phone preview</title></head><body style="margin:0;background:#ddd"><iframe title="390 pixel season availability preview" src="/hub-fixture" style="width:390px;height:850px;border:0;display:block;margin:16px auto"></iframe></body></html>'); return
    }
    if (['/captain-fixture', '/hub-fixture'].includes(url.pathname)) {
      res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{background:#06172f;font:16px system-ui;margin:0;padding:16px;box-sizing:border-box}#root{max-width:720px;margin:auto}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>'); return
    }
    if (['/fixture.js','/fixture.css'].includes(url.pathname)) {
      res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(await readFile(path.join(root, 'artifacts/season-kickoff-browser', url.pathname.slice(1)))); return
    }
    if (url.pathname.startsWith('/api/season-availability/') || url.pathname === '/api/captain/season-kickoff') {
      let body = ''; for await (const chunk of req) body += chunk
      const input = body ? JSON.parse(body) : {}
      if (url.pathname === '/api/captain/season-kickoff') {
        if (req.method === 'POST') {
          const keys = input.action === 'self' ? [roster[0].key] : input.playerKeys
          for (const player of roster.filter(player => keys.includes(player.key))) if (!invites.some(invite => invite.roster_key === player.key)) {
            const index = roster.findIndex(row => row.key === player.key)
            invites.push({ id: `invite-${index}`, roster_key: player.key, player_id: player.playerId, player_name: player.name, response_token: index ? `66666666-6666-4666-8666-${String(index).padStart(12,'0')}` : token, revoked_at: null, match_ids: matches.map(match => match.id) })
          }
        }
        const readiness = matches.map(match => { const rows = replies.filter(reply => reply.match_id === match.id); return { matchId: match.id, available: rows.filter(row => row.status === 'available').length, maybe: rows.filter(row => row.status === 'maybe').length, unavailable: rows.filter(row => row.status === 'unavailable').length, waiting: Math.max(0, invites.length - rows.length) } })
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, roster, matches, invites, replies, readiness, self: roster[0] })); return
      }
      if (req.method === 'POST') {
        const invite = invites.find(row => url.pathname.endsWith(row.response_token))
        if (!invite) { res.statusCode=404; res.end('{}'); return }
        replies = [...replies.filter(reply => reply.invite_id !== invite.id || !input.responses.some(answer => answer.matchId === reply.match_id)), ...input.responses.map(answer => ({ invite_id: invite.id, match_id: answer.matchId, match_date: answer.matchDate, match_time: answer.matchTime, status: answer.status }))]
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, saved: input.responses.length })); return
      }
      const invite = invites.find(row => url.pathname.endsWith(row.response_token))
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, scope, playerName: invite?.player_name || 'Jordan', matches, replies: replies.filter(reply => reply.invite_id === invite?.id), today: '2026-09-07', calendarToken: '77777777-7777-4777-8777-777777777777' })); return
    }
    const upstream = await fetch(`http://localhost:3030${req.url}`, { headers: { 'accept-encoding': 'identity' }, redirect: 'manual' })
    res.statusCode = upstream.status
    upstream.headers.forEach((value, key) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) res.setHeader(key, value) })
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) { res.statusCode = 500; res.end(error.message) }
})
server.listen(3021, '127.0.0.1', () => console.log(`Synthetic UI harness: http://localhost:3021/captain-fixture and /season-availability#${token}`))
