// Isolated browser harness: synthetic responses only, no production API access.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const root = process.cwd(), port = 3041
const output = resolve(root, 'artifacts/team-availability-summary-fixture.js')
let failed = false, changed = false
const source = `import React from 'react'; import {createRoot} from 'react-dom/client'; import TeamHomeCard from './app/compete/teams/team-home-card'; import Summary from './app/compete/teams/team-availability-summary';
function App(){return <main style={{maxWidth:620,margin:'0 auto',padding:16,fontFamily:'Arial,sans-serif',color:'#fff'}}><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>{['Fail next check','Recover check','Player changes to No'].map((label,i)=><button key={label} style={{minHeight:44}} onClick={()=>fetch('/fixture-control/'+i,{method:'POST'})}>{label}</button>)}</div><TeamHomeCard name="SuperSmash Bros/Pottebaum-Meinart" league="2027 Fall Tri-Level" flight="Men 3.5/4.0/4.5" isDefault teamHref="/team" chatHref="/chat" lineupHref="/captain/lineup-builder?team=Aces" availabilityHref="/team#availability" nextMatch={{date:'2026-09-14',opponent:'Gontarz'}} availabilitySummary={<Summary token="synthetic" query="team=Aces" lineupHref="/captain/lineup-builder?team=Aces" scheduleHref="/team#schedule"/>}/></main>};createRoot(document.getElementById('root')).render(<App/>);`
await build({ stdin: { contents: source, resolveDir: root, loader: 'tsx' }, bundle: true, format: 'esm', outfile: output, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'local-link', setup(builder) {
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', resolveDir: root, contents: 'export default function Link(props){return <a {...props}/>}' }))
} }] })
http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`)
  const json = (body, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)) }
  if (url.pathname.startsWith('/fixture-control/')) {
    if (url.pathname.endsWith('/0')) failed = true
    if (url.pathname.endsWith('/1')) failed = false
    if (url.pathname.endsWith('/2')) changed = true
    return json({ ok: true })
  }
  if (url.pathname === '/api/captain/team-availability-summary') {
    if (failed) return json({ message: 'Availability could not be checked. Retry to see current answers.' }, 503)
    const people = [{key:'p1',name:'Sam Edwards',status:changed?'unavailable':'available',source:changed?'player':'captain',selected:true},{key:'p2',name:'Nathan Meinert',status:'available',source:'player',selected:true},{key:'p3',name:'David Cabrera',status:'waiting',source:null,selected:true},{key:'p4',name:'Diego Mateluna',status:'maybe',source:'season',selected:false}]
    return json({ summary: { people, roster:4, available:changed?1:2, waiting:1, maybe:1, unavailable:changed?1:0, captainConfirmed:changed?0:1, selectedCount:3, selectedWaiting:['David Cabrera'], selectedUnmatched:0 }, selection:'saved', scenarioId:'scenario', scope:{team:'Aces',league:'2027 Fall Tri-Level',flight:'Men 3.5/4.0/4.5',seasonKey:'fixture'}, match:{id:'fixture-match',home_team:'Aces',away_team:'Gontarz',match_date:'2026-09-14',match_time:'18:00:00'}, checkedAt:new Date().toISOString(),dayScopedAnswersOmitted:false })
  }
  if (url.pathname === '/api/captain/season-kickoff' && request.method === 'POST') return json({ ok: true })
  if (url.pathname === '/bundle.js' || url.pathname === '/bundle.css') { response.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css'); return response.end(await readFile(output.replace(/\.js$/, url.pathname.endsWith('.js') ? '.js' : '.css'))) }
  if (url.pathname.startsWith('/api/')) return json({ message: 'Fixture endpoint not implemented' }, 404)
  response.setHeader('Content-Type','text/html'); response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'")
  response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated captain summary</title><link rel="stylesheet" href="/bundle.css"></head><body style="margin:0;background:#081727"><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>')
}).listen(port, '127.0.0.1', () => console.log(`Isolated summary: http://localhost:${port}`))
