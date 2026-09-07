// Local synthetic browser fixture. No production credentials or data are used.
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('artifacts/team-season-calendar')
await build({
  stdin: {
    contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import Calendar from './app/components/team-season-calendar';
const base = {id:'one',external_match_id:'101',home_team:'SuperSmash Bros/Pottebaum–Meinert',away_team:'Gontarz',match_date:'2026-09-14',match_time:'6:00 PM',facility:'Forest Park — Dwight Davis Tennis Center',league_name:'2026 STL Tri-Level 18 & Over',flight:'Men 3.5/4.0/4.5',match_type:null};
const params = new URLSearchParams(location.search); const rows = params.has('empty') ? [] : [base, {...base,id:'two',external_match_id:'102',match_date:'2026-09-21',match_time:null}, {...base,id:'old',external_match_id:'99',match_date:'2025-09-14'}];
createRoot(document.getElementById('root')).render(<Calendar team={base.home_team} matches={rows} userId="fixture-user" accessToken={params.has('signedout')?'':'fixture-token'} importHref="/data-assist?type=schedule" />);`,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, outfile: `${output}/fixture.js`, jsx: 'automatic', loader: { '.css': 'local-css' },
  alias: { '@': process.cwd() },
  plugins: [{ name: 'local-link', setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `import React from 'react'; export default function Link(props) { return React.createElement('a', props) }`, loader: 'js', resolveDir: process.cwd() }))
  } }],
})
const saves = []
createServer(async (req, res) => {
  if (req.url === '/api/player/calendar-items') {
    let body = ''; for await (const chunk of req) body += chunk
    const { items } = JSON.parse(body); saves.push(items)
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ok:true,savedCount:items.length})); return
  }
  if (req.url === '/saved') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(saves)); return }
  if (req.url === '/api/player/personal-calendar-link') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ok:true,calendarUrl:'https://calendar-fixture.example/api/calendar/player/fixture/calendar.ics?token=synthetic-only'})); return
  }
  if (req.url === '/fixture.js' || req.url === '/fixture.css') {
    res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css'); res.end(await readFile(path.join(output, req.url.slice(1)))); return
  }
  res.setHeader('Content-Type','text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;padding:16px;background:#071423;font-family:Arial,sans-serif}#root{max-width:900px;margin:auto}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>')
}).listen(3041, '127.0.0.1', () => console.log('Synthetic calendar fixture: http://127.0.0.1:3041'))
