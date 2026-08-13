import { chromium } from '@playwright/test'
import {
  PDFDict,
  PDFDocument,
  PDFName,
  StandardFonts,
  rgb,
} from 'pdf-lib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const outputRoot = process.env.TENACEIQ_VETTA_PACKAGE_OUTPUT
  ? path.resolve(process.env.TENACEIQ_VETTA_PACKAGE_OUTPUT)
  : path.join(projectRoot, 'output', 'vetta-sales-package')
const kitDir = path.join(outputRoot, '06-close-and-activation-kit')
const tiqLogo = await dataUri(path.join(projectRoot, 'public', 'brand', 'web', 'header-logo-transparent.png'))
const vettaLogo = await dataUri(path.join(outputRoot, '05-vetta-brand-concept', 'vetta-logo-current.svg'))

await mkdir(kitDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  await renderPdf(browser, 'TenAceIQ-Vetta-Club-Proposal', proposalHtml(), { fillable: true })
  await renderPdf(browser, 'TenAceIQ-Vetta-Club-Activation-Checklist', activationChecklistHtml())
  await renderPdf(browser, 'TenAceIQ-Vetta-Club-First-30-Days', firstThirtyDaysHtml())
  await renderPdf(browser, 'TenAceIQ-Vetta-Club-Meeting-Demo-Path', demoPathHtml())
} finally {
  await browser.close()
}

await Promise.all([
  writeFile(path.join(kitDir, 'README.md'), kitReadme(), 'utf8'),
  writeFile(path.join(kitDir, 'Vetta-Follow-Up-Email.md'), followUpEmail(), 'utf8'),
  writeFile(path.join(kitDir, 'Vetta-Internal-Implementation-Handoff.md'), internalHandoff(), 'utf8'),
  writeFile(path.join(kitDir, 'Vetta-Proposal-Conversation-Notes.md'), proposalNotes(), 'utf8'),
])

console.log(JSON.stringify({ ok: true, kitDir }, null, 2))

async function renderPdf(browserInstance, stem, html, options = {}) {
  const page = await browserInstance.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'screen' })
  const pdfPath = path.join(kitDir, `${stem}.pdf`)
  await page.pdf({
    path: pdfPath,
    width: '8.5in',
    height: '11in',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  })
  await page.close()
  if (options.fillable) await addProposalFields(pdfPath)
}

async function addProposalFields(pdfPath) {
  const source = await readFile(pdfPath)
  const pdf = await PDFDocument.load(source)
  const form = pdf.getForm()
  const page = pdf.getPages()[2]
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const border = rgb(0.10, 0.28, 0.42)
  const fill = rgb(0.98, 0.99, 0.98)
  const text = rgb(0.03, 0.08, 0.15)
  const fieldOptions = { borderColor: border, backgroundColor: fill, textColor: text, borderWidth: 1, font, fontSize: 9 }

  addText('vetta_contact_name', 55, 250, 334, 33)
  addText('vetta_contact_title', 427, 250, 334, 33)
  addCheck('workspace_organization_wide', 63, 357)
  addCheck('workspace_location_specific', 400, 357)
  addCheck('plan_club_starter', 63, 455)
  addCheck('plan_club_unlimited', 400, 455)
  addCheck('journey_player_development', 63, 553)
  addCheck('journey_team_operations', 243, 553)
  addCheck('journey_league', 423, 553)
  addCheck('journey_tournament', 592, 553)
  addCheck('result_tiq_rated', 63, 651)
  addCheck('result_public_history', 265, 651)
  addCheck('result_social_event', 505, 651)
  addText('target_launch_date', 55, 745, 214, 33)
  addText('vetta_owner', 301, 745, 214, 33)
  addText('tenaceiq_owner', 547, 745, 214, 33)
  addText('scope_notes', 55, 812, 706, 83, { multiline: true, fontSize: 8.5 })
  addText('decision_date', 55, 968, 214, 30)
  addText('decision_owner', 301, 968, 214, 30)
  addText('next_session_date', 547, 968, 214, 30)

  form.updateFieldAppearances(font)
  const output = await pdf.save({ useObjectStreams: false })
  await writeFile(pdfPath, output)
  await validateForm(pdfPath)

  function addText(name, x, y, width, height, extra = {}) {
    const field = form.createTextField(name)
    if (extra.multiline) field.enableMultiline()
    field.addToPage(page, { ...toPdfRect(x, y, width, height), ...fieldOptions, ...extra })
  }

  function addCheck(name, x, y) {
    const field = form.createCheckBox(name)
    field.addToPage(page, {
      ...toPdfRect(x, y, 23, 23),
      borderColor: border,
      backgroundColor: fill,
      borderWidth: 1.2,
    })
  }
}

async function validateForm(pdfPath) {
  const bytes = await readFile(pdfPath)
  const pdf = await PDFDocument.load(bytes)
  const fields = pdf.getForm().getFields()
  const expected = [
    'vetta_contact_name', 'vetta_contact_title',
    'workspace_organization_wide', 'workspace_location_specific',
    'plan_club_starter', 'plan_club_unlimited',
    'journey_player_development', 'journey_team_operations', 'journey_league', 'journey_tournament',
    'result_tiq_rated', 'result_public_history', 'result_social_event',
    'target_launch_date', 'vetta_owner', 'tenaceiq_owner', 'scope_notes',
    'decision_date', 'decision_owner', 'next_session_date',
  ]
  const actual = new Set(fields.map((field) => field.getName()))
  const missing = expected.filter((name) => !actual.has(name))
  if (missing.length) throw new Error(`Missing proposal fields: ${missing.join(', ')}`)

  let widgetCount = 0
  let appearanceCount = 0
  for (const page of pdf.getPages()) {
    const annots = page.node.Annots()
    if (!annots) continue
    for (const ref of annots.asArray()) {
      const annotation = pdf.context.lookup(ref)
      if (!(annotation instanceof PDFDict)) continue
      if (annotation.get(PDFName.of('Subtype')) === PDFName.of('Widget')) {
        widgetCount += 1
        const appearance = annotation.lookupMaybe(PDFName.of('AP'), PDFDict)
        if (appearance?.get(PDFName.of('N'))) appearanceCount += 1
      }
    }
  }
  if (widgetCount !== expected.length || appearanceCount !== expected.length) {
    throw new Error(`Proposal form validation failed: ${widgetCount} widgets, ${appearanceCount} appearances, ${expected.length} expected`)
  }
  console.log(JSON.stringify({ formValidated: true, fields: fields.length, widgetCount, appearanceCount }))
}

function toPdfRect(x, y, width, height) {
  const scale = 0.75
  return { x: x * scale, y: 792 - ((y + height) * scale), width: width * scale, height: height * scale }
}

function proposalHtml() {
  return documentShell([
    pageShell('PROPOSAL', 'A CONNECTED VETTA TENNIS EXPERIENCE', `
      <section class="hero proposal-hero">
        <p class="eyebrow">TENACEIQ CLUB FOR VETTA RACQUET SPORTS</p>
        <h1>CONNECT THE MEMBER.<br><em>KEEP THE TENNIS MOVING.</em></h1>
        <p class="big-lead">A branded Club workspace that connects Player ID, development, coaching, teams, leagues, and tournaments around the systems Vetta already uses.</p>
      </section>
      <section class="impact-grid">
        ${impact('01', 'KEEP THE IDENTITY', 'Current TenAceIQ members keep their Player ID and public match history. New members are invited and linked to the correct profile.')}
        ${impact('02', 'CONNECT THE WORK', 'Club context moves into My Lab, Coach Hub, Team Hub, League Office, and Tournament Desk.')}
        ${impact('03', 'CONTROL THE RESULT', 'Each league or tournament can be TIQ rated, public history only, or social/event only.')}
        ${impact('04', 'MAKE IT VETTA', 'Apply Vetta branding, programs, roles, people, teams, and competition structure to one premium experience.')}
      </section>
      <section class="why"><b>WHY VETTA WOULD PAY</b><span>To turn separate accounts, programs, and tennis tools into one visible relationship that members and staff can act on.</span></section>
      <section class="boundary"><b>PRODUCT BOUNDARY</b><span>TenAceIQ complements booking, registration, membership, point-of-sale, and payment systems. It connects the tennis experience around them.</span></section>
      <section class="connection-path"><p>THE CONNECTED EXPERIENCE</p><div><b>MEMBER JOINS</b><i>-&gt;</i><b>PLAYER ID CONNECTS</b><i>-&gt;</i><b>ROLE OPENS THE TOOLS</b><i>-&gt;</i><b>RESULT COUNTS AS CHOSEN</b></div></section>
    `, 1, 3),
    pageShell('SCOPE + PRICING', 'SAME PRODUCT. CHOOSE THE CAPACITY.', `
      <p class="page-lead">Both plans activate one branded Club workspace with Player, Coach, Captain, League, and Tournament experiences. The difference is capacity.</p>
      <section class="plan-grid">
        ${plan('CLUB STARTER', '$99', 'Focused rollout', ['1 branded Club workspace', 'Up to 10 coaches or staff', 'Up to 150 connected players', 'All Club tools and result policies'])}
        ${plan('CLUB UNLIMITED', '$199', 'Organization-scale capacity', ['1 branded Club workspace', 'Unlimited coaches and staff', 'Unlimited connected players', 'All Club tools and result policies'], true)}
      </section>
      <section class="scope-question">
        <p class="eyebrow">DECIDE THIS BEFORE QUOTING</p>
        <h2>ONE VETTA-WIDE WORKSPACE<br><em>OR SEPARATE LOCATION WORKSPACES?</em></h2>
        <div><b>ONE ORGANIZATION-WIDE WORKSPACE</b><span>One identity and operating layer across the racquet organization. Unlimited is the likely fit if adoption exceeds either Starter cap.</span></div>
        <div><b>LOCATION-SPECIFIC WORKSPACES</b><span>Distinct club homes by location. Confirm the number of workspaces and operating model before final commercial terms.</span></div>
      </section>
      <section class="deliverables">
        <h3>PROPOSED FIRST ACTIVATION</h3>
        <div><b>VETTA PROVIDES</b><span>Workspace decision, owner, branding, staff list, first member group, first journey, and launch timing.</span></div>
        <div><b>TENACEIQ CONFIGURES</b><span>Club home, roles, invitations, Player ID linking, relevant tools, result policies, and launch guidance.</span></div>
      </section>
      <p class="draft-note">Discussion draft. Final workspace count, billing terms, and rollout responsibilities are confirmed in the final order form.</p>
    `, 2, 3),
    pageShell('DECISION WORKSHEET', 'LEAVE THE MEETING WITH A SHAPE.', `
      <p class="form-intro">Use the interactive fields below to capture the decisions needed for a scoped activation. This worksheet is not a binding order form.</p>
      ${formSection('CONTACT', 110, '<span class="label left">Vetta contact</span><span class="label right">Title</span>')}
      ${formSection('WORKSPACE SHAPE', 213, '<span class="choice left-one">One Vetta-wide workspace</span><span class="choice left-two">Location-specific workspaces - scope count before quote</span>')}
      ${formSection('CAPACITY', 311, '<span class="choice left-one">Club Starter - $99/month</span><span class="choice left-two">Club Unlimited - $199/month</span>')}
      ${formSection('FIRST MEMBER JOURNEY', 409, '<span class="choice journey-one">Player development</span><span class="choice journey-two">Team operations</span><span class="choice journey-three">League</span><span class="choice journey-four">Tournament</span>')}
      ${formSection('DEFAULT RESULT POLICY', 507, '<span class="choice result-one">TIQ rated</span><span class="choice result-two">Public history only</span><span class="choice result-three">Social / event only</span>')}
      ${formSection('OWNERS + TIMING', 605, '<span class="label third-one">Target launch</span><span class="label third-two">Vetta owner</span><span class="label third-three">TenAceIQ owner</span>')}
      ${formSection('SCOPE NOTES', 683, '')}
      ${formSection('DECISION + NEXT SESSION', 827, '<span class="label third-one">Decision date</span><span class="label third-two">Decision owner</span><span class="label third-three">Next session</span>')}
    `, 3, 3, 'form-page'),
  ])
}

function activationChecklistHtml() {
  return documentShell([
    pageShell('ACTIVATION CHECKLIST', 'FROM YES TO FIRST LIVE JOURNEY.', `
      <p class="page-lead">A clear launch sequence keeps the Club experience premium and prevents duplicate profiles, unclear roles, and competitions that count the wrong way.</p>
      <section class="stage-list">
        ${stage('01', 'SCOPE', ['Confirm organization-wide or location-specific workspace model', 'Choose Starter or Unlimited from actual capacity', 'Name the Vetta and TenAceIQ owners', 'Select the first member journey and target launch date'])}
        ${stage('02', 'BRAND + STRUCTURE', ['Approve logo, colors, Club name, and public description', 'Define locations, programs, groups, teams, and staff roles', 'Confirm who can invite, manage, publish, and record results'])}
        ${stage('03', 'IDENTITY + ACCESS', ['Import or invite the first staff and member group', 'Connect current TenAceIQ members to existing Player IDs', 'Resolve new or ambiguous Player IDs before competition begins', 'Test every role from the correct Club entry point'])}
      </section>
      <section class="gate"><b>LAUNCH GATE 1</b><span>No duplicate Player IDs. Every pilot user has the correct Club role and sees the right next action.</span></section>
      <section class="owner-grid"><div><b>VETTA OWNER</b><span>Approves structure, people, communication, and launch readiness.</span></div><div><b>TENACEIQ OWNER</b><span>Configures the connected experience and verifies role handoffs.</span></div><div><b>SHARED DECISION</b><span>Confirms scope, result behavior, success measures, and expansion.</span></div></section>
    `, 1, 2),
    pageShell('ACTIVATION CHECKLIST', 'PROVE THE EXPERIENCE BEFORE SCALE.', `
      <section class="stage-list compact-top">
        ${stage('04', 'CONFIGURE THE FIRST JOURNEY', ['Player development: connect My Lab, goals, assignments, tactics, and proof', 'Team operations: connect roster, availability, lineup, messages, and match week', 'League or tournament: define format, participants, schedule, publishing, and result policy'])}
        ${stage('05', 'RUN THE LIVE CHECK', ['Test member invitation and Player ID linking', 'Test each staff, coach, captain, and organizer handoff', 'Publish one program or competition item', 'Record a test result in the intended result mode', 'Confirm what is public, what affects TIQ, and what stays local'])}
        ${stage('06', 'LAUNCH + LEARN', ['Send role-specific launch messages', 'Track activation, Player ID connection, and first useful action', 'Hold a seven-day operating review', 'Confirm the next member group, program, or location'])}
      </section>
      <section class="gate"><b>LAUNCH GATE 2</b><span>The first journey works end to end, ownership is clear, and result behavior has been verified before member launch.</span></section>
      <section class="ready-grid">
        <div><b>READY TO LAUNCH WHEN</b><span>Owners, branding, roles, identities, first journey, competition policy, support path, and member communication are all confirmed.</span></div>
        <div><b>READY TO EXPAND WHEN</b><span>The first group is using the intended tools, staff can operate the workflow, and the next rollout is based on observed demand.</span></div>
      </section>
    `, 2, 2),
  ])
}

function firstThirtyDaysHtml() {
  return documentShell([
    pageShell('FIRST 30 DAYS', 'LAUNCH ONE JOURNEY. PROVE THE CONNECTION.', `
      <p class="page-lead">The first month should create visible member value and a repeatable Club operating rhythm - not attempt every possible workflow at once.</p>
      <section class="timeline">
        ${week('DAYS 0-3', 'DECIDE', 'Lock workspace shape, plan, owners, first member journey, branding, and launch date.', ['Workspace decision recorded', 'Pilot group named', 'Success measures agreed'])}
        ${week('DAYS 4-10', 'CONNECT', 'Configure the Club home, roles, invitations, and Player ID linking for the first member group.', ['Staff access verified', 'Members invited', 'Profile exceptions resolved'])}
        ${week('DAYS 11-17', 'ACTIVATE', 'Open the first useful workflow in My Lab, Coach Hub, Team Hub, League Office, or Tournament Desk.', ['First action completed', 'Role handoffs tested', 'Member message sent'])}
        ${week('DAYS 18-24', 'COMPETE', 'If competition is in scope, run a live test with the intended result policy and publishing behavior.', ['Result mode verified', 'Visibility verified', 'Organizer workflow proven'])}
        ${week('DAYS 25-30', 'REVIEW + EXPAND', 'Review adoption, friction, and observed value. Choose the next group, program, or location deliberately.', ['30-day review held', 'Next rollout selected', 'Capacity rechecked'])}
      </section>
    `, 1, 2),
    pageShell('FIRST 30 DAYS', 'MEASURE ACTION, NOT LOGINS.', `
      <section class="measure-grid">
        ${measure('IDENTITY', 'Connected Player IDs', 'How many invited members are tied to the correct Player ID?', 'Resolve exceptions before adding more competition.')}
        ${measure('ROLE VALUE', 'First useful action', 'Did each role complete the action the launch promised?', 'Player goal, coach assignment, captain decision, or organizer publish.')}
        ${measure('CONTINUITY', 'Cross-tool handoff', 'Did Club context appear in the right role-specific tool?', 'Confirm the member did not have to recreate identity or context.')}
        ${measure('COMPETITION', 'Result policy accuracy', 'Did the result publish and affect TIQ exactly as intended?', 'Audit TIQ rated, public history only, or social/event only behavior.')}
        ${measure('OPERATIONS', 'Owner confidence', 'Can Vetta staff repeat the workflow without TenAceIQ driving every click?', 'Document the operating owner and support path.')}
        ${measure('EXPANSION', 'Next rollout signal', 'Which group, program, or location has the clearest demand next?', 'Expand from observed value, then recheck plan capacity.')}
      </section>
      <section class="scorecard">
        <h3>30-DAY EXECUTIVE READOUT</h3>
        <div><b>WHAT WORKED</b><span>Member or staff behavior that proves the connected experience is useful.</span></div>
        <div><b>WHAT NEEDS UPLIFT</b><span>Identity, role, workflow, communication, or policy friction to fix before scale.</span></div>
        <div><b>WHAT EXPANDS NEXT</b><span>The next journey, program, group, or workspace decision supported by evidence.</span></div>
      </section>
    `, 2, 2),
  ])
}

function demoPathHtml() {
  return documentShell([
    pageShell('10-MINUTE DEMO PATH', 'SHOW THE CONNECTION. THEN CLOSE THE DECISION.', `
      <section class="demo-flow">
        ${demoStep('00:00', 'OPEN WITH THE MEMBER', 'Start at the branded Club home. Explain that Vetta becomes the context, while each person sees the right role and next action.', 'Proof: one premium Club entry point.')}
        ${demoStep('01:30', 'CONNECT PLAYER ID', 'Show a current TenAceIQ member linked to the Club without losing public match history. Explain how a new member is invited and matched.', 'Proof: the member does not start over.')}
        ${demoStep('03:00', 'FOLLOW THE PLAYER', 'Open My Lab. Show how Club context carries into goals, follows, matchup insight, tactics, video, and Level Up work.', 'Proof: participation becomes a development story.')}
        ${demoStep('04:30', 'FOLLOW THE COACH + CAPTAIN', 'Open Coach Hub and Team Hub. Show player assignments, notes, readiness, roster context, and match-week decisions.', 'Proof: staff acts from shared context.')}
        ${demoStep('06:30', 'CONTROL COMPETITION', 'Open League Office and Tournament Desk. Show TIQ rated, public history only, and social/event only result policies.', 'Proof: Vetta decides how results count.')}
        ${demoStep('08:15', 'CLOSE ON SCOPE', 'Return to pricing. Ask whether Vetta wants one organization-wide workspace or location-specific workspaces, then select capacity.', 'Close: shape first, capacity second.')}
      </section>
      <section class="ask"><b>FINAL ASK</b><span>Schedule a 45-minute activation session with the Vetta racquet-sports owner to confirm workspace shape, first journey, owner, and launch date.</span></section>
    `, 1, 1),
  ])
}

function documentShell(pages) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles()}</style></head><body>${pages.join('')}</body></html>`
}

function pageShell(kicker, title, content, pageNumber, total, extraClass = '') {
  return `<main class="page ${extraClass}">
    <header class="brandbar"><div class="co-brand"><img src="${vettaLogo}"><span>PROSPECTIVE CLUB CUSTOMER</span><img src="${tiqLogo}"></div><div class="doc-title"><p>${kicker}</p><strong>${title}</strong></div></header>
    <div class="page-content">${content}</div>
    <footer><span>VETTA CLUB CONCEPT - POWERED BY TENACEIQ</span><b>${pageNumber} / ${total}</b></footer>
  </main>`
}

function impact(number, title, copy) {
  return `<article><b>${number}</b><div><h3>${title}</h3><p>${copy}</p></div></article>`
}

function plan(name, price, audience, rows, recommended = false) {
  return `<article class="plan ${recommended ? 'recommended' : ''}"><p>${name}</p><h2>${price}<span>/MONTH</span></h2><strong>${audience}</strong><ul>${rows.map((row) => `<li>${row}</li>`).join('')}</ul></article>`
}

function formSection(title, top, body) {
  return `<section class="form-section" style="top:${top}px"><b>${title}</b>${body}</section>`
}

function stage(number, title, items) {
  return `<article class="stage"><b>${number}</b><div><h2>${title}</h2>${items.map((item) => `<p><i></i>${item}</p>`).join('')}</div></article>`
}

function week(days, title, copy, proof) {
  return `<article class="week"><div><b>${days}</b><strong>${title}</strong></div><p>${copy}</p><ul>${proof.map((item) => `<li>${item}</li>`).join('')}</ul></article>`
}

function measure(label, title, question, action) {
  return `<article><p>${label}</p><h2>${title}</h2><strong>${question}</strong><span>${action}</span></article>`
}

function demoStep(time, title, show, proof) {
  return `<article><b>${time}</b><div><h2>${title}</h2><p>${show}</p><strong>${proof}</strong></div></article>`
}

function styles() {
  return `
    @page{size:Letter;margin:0}*{box-sizing:border-box}html,body{margin:0;width:8.5in;background:#dfe5e8;color:#071426;font-family:"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact}.page{position:relative;width:8.5in;height:11in;overflow:hidden;background:radial-gradient(circle at 96% 0,#dff8ff,transparent 30%),#f7f8f5;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}.brandbar{height:1.05in;display:grid;grid-template-columns:3.35in 1fr;gap:.2in;align-items:center;padding:.15in .3in;background:#061326;color:white;border-bottom:7px solid #e31837}.co-brand{display:grid;grid-template-columns:1.07in .82in 1.03in;gap:7px;align-items:center}.co-brand img:first-child{width:1.05in;max-height:.38in;object-fit:contain;padding:4px;background:white;border-radius:4px}.co-brand img:last-child{width:1.01in;max-height:.32in;object-fit:contain}.co-brand span{font-size:6px;line-height:1.25;font-weight:950;letter-spacing:.08em;color:#58dfff}.doc-title{min-width:0}.doc-title p{margin:0;color:#9bea18;font-size:7px;font-weight:950;letter-spacing:.16em}.doc-title strong{display:block;margin-top:4px;font-family:Impact,"Arial Narrow",sans-serif;font-size:17px;line-height:1}.page-content{padding:.27in .36in .42in}footer{position:absolute;left:.36in;right:.36in;bottom:.14in;display:flex;justify-content:space-between;padding-top:5px;border-top:2px solid #e31837;color:#36506a;font-size:7px;font-weight:900;letter-spacing:.08em}.eyebrow{margin:0 0 .08in;color:#4dac1e;font-size:9px;font-weight:950;letter-spacing:.17em}.proposal-hero{padding:.17in .18in .19in;background:#061326;color:white;border-left:7px solid #9bea18}.proposal-hero h1{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:43px;line-height:.91}.proposal-hero h1 em,.scope-question h2 em{color:#58dfff;font-style:normal}.big-lead{margin:.13in 0 0;max-width:6.9in;color:#d7e2ec;font-size:13px;line-height:1.38;font-weight:720}.impact-grid{display:grid;grid-template-columns:1fr 1fr;gap:.13in;margin-top:.18in}.impact-grid article{display:grid;grid-template-columns:.45in 1fr;gap:.1in;min-height:1.48in;padding:.13in;border-top:5px solid #58dfff;background:white;box-shadow:0 8px 20px rgba(7,20,38,.07)}.impact-grid article:nth-child(2),.impact-grid article:nth-child(3){border-color:#9bea18}.impact-grid article:nth-child(4){border-color:#e31837}.impact-grid article>b{color:#4dac1e;font-family:Impact,"Arial Narrow",sans-serif;font-size:31px}.impact-grid h3{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:17px}.impact-grid p{margin:5px 0 0;color:#43536a;font-size:9px;line-height:1.38;font-weight:650}.why,.boundary{display:grid;grid-template-columns:1.55in 1fr;gap:.16in;margin-top:.16in;padding:.14in .16in;background:#061326;color:white}.why b,.boundary b{color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:18px}.why span,.boundary span{font-size:10px;line-height:1.4;font-weight:700}.boundary{margin-top:.12in;background:#e31837}.boundary b{color:white}.connection-path{margin-top:.14in;padding:.13in .16in;border-top:5px solid #58dfff;background:white}.connection-path p{margin:0 0 .08in;color:#4dac1e;font-size:8px;font-weight:950;letter-spacing:.15em}.connection-path div{display:grid;grid-template-columns:1fr auto 1.15fr auto 1.25fr auto 1.45fr;gap:8px;align-items:center}.connection-path b{font-family:Impact,"Arial Narrow",sans-serif;font-size:12px}.connection-path i{color:#e31837;font-size:13px;font-style:normal;font-weight:950}.page-lead{margin:0 auto .18in;max-width:7.45in;text-align:center;font-size:13px;line-height:1.4;font-weight:800}.plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:.18in}.plan{min-height:2.78in;padding:.18in;border:2px solid #58dfff;border-top:9px solid #58dfff;border-radius:12px;background:white}.plan.recommended{border-color:#9bea18}.plan>p{margin:0;color:#36506a;font-size:9px;font-weight:950;letter-spacing:.16em}.plan h2{margin:.04in 0 0;color:#2796b8;font-family:Impact,"Arial Narrow",sans-serif;font-size:42px}.plan.recommended h2{color:#4dac1e}.plan h2 span{margin-left:5px;color:#071426;font:900 10px "Segoe UI",Arial}.plan>strong{font-size:11px}.plan ul{margin:.1in 0 0;padding:0;list-style:none}.plan li{padding:.055in 0;border-top:1px solid #dce3e9;font-size:9px;font-weight:700}.scope-question{margin-top:.18in;padding:.17in;background:#061326;color:white}.scope-question h2{margin:0 0 .12in;font-family:Impact,"Arial Narrow",sans-serif;font-size:24px;line-height:.96}.scope-question>div{display:grid;grid-template-columns:2.1in 1fr;gap:.14in;padding:.1in 0;border-top:1px solid #30465f}.scope-question b{color:#9bea18;font-size:8px}.scope-question span{color:#d5dfeb;font-size:8px;line-height:1.4}.deliverables{margin-top:.14in;padding:.14in;background:white;border-left:6px solid #e31837}.deliverables h3{margin:0 0 .05in;font-family:Impact,"Arial Narrow",sans-serif;font-size:17px}.deliverables>div{display:grid;grid-template-columns:1.3in 1fr;gap:.12in;padding:.06in 0;border-top:1px solid #dce3e9}.deliverables b{font-size:8px}.deliverables span{font-size:8px;line-height:1.35}.draft-note{margin:.09in 0 0;color:#526277;font-size:7px;font-weight:700}.form-page .page-content{position:relative;height:9.55in;padding:.2in .36in}.form-intro{margin:0;font-size:10px;line-height:1.35;font-weight:700;color:#43536a}.form-section{position:absolute;left:.36in;right:.36in;height:76px;padding-top:19px;border-top:5px solid #071426}.form-section>b{position:absolute;top:3px;left:0;color:#4dac1e;font-size:8px;letter-spacing:.14em}.form-section .label,.form-section .choice{position:absolute;color:#36506a;font-size:7px;font-weight:800}.label{top:25px}.label.left{left:0}.label.right{left:372px}.choice{top:38px;padding-left:31px;line-height:1.2}.left-one{left:0}.left-two{left:337px}.journey-one{left:0}.journey-two{left:180px}.journey-three{left:360px}.journey-four{left:529px}.result-one{left:0}.result-two{left:202px}.result-three{left:442px}.third-one{left:0}.third-two{left:246px}.third-three{left:492px}.stage-list{display:grid;gap:.16in}.stage{display:grid;grid-template-columns:.7in 1fr;gap:.16in;padding:.16in .18in;background:white;border-left:8px solid #58dfff;box-shadow:0 8px 20px rgba(7,20,38,.06)}.stage:nth-child(2){border-color:#9bea18}.stage:nth-child(3){border-color:#e31837}.stage>b{color:#4dac1e;font-family:Impact,"Arial Narrow",sans-serif;font-size:44px}.stage h2{margin:0 0 .04in;font-family:Impact,"Arial Narrow",sans-serif;font-size:22px}.stage p{position:relative;margin:.04in 0;padding-left:.18in;color:#43536a;font-size:9px;line-height:1.3;font-weight:700}.stage i{position:absolute;left:0;top:3px;width:9px;height:9px;border:2px solid #4dac1e}.compact-top{margin-top:.06in}.gate{display:grid;grid-template-columns:1.4in 1fr;gap:.14in;margin-top:.18in;padding:.14in .17in;background:#061326;color:white}.gate b{color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:17px}.gate span{font-size:9px;line-height:1.4;font-weight:700}.owner-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.12in;margin-top:.14in}.owner-grid>div{padding:.12in;border-top:5px solid #58dfff;background:white}.owner-grid>div:nth-child(2){border-color:#9bea18}.owner-grid>div:nth-child(3){border-color:#e31837}.owner-grid b{display:block;font-family:Impact,"Arial Narrow",sans-serif;font-size:14px}.owner-grid span{display:block;margin-top:5px;color:#43536a;font-size:7px;line-height:1.35;font-weight:700}.ready-grid{display:grid;grid-template-columns:1fr 1fr;gap:.14in;margin-top:.15in}.ready-grid>div{padding:.14in;border-top:5px solid #58dfff;background:white}.ready-grid>div:last-child{border-color:#9bea18}.ready-grid b{display:block;margin-bottom:5px;font-family:Impact,"Arial Narrow",sans-serif;font-size:16px}.ready-grid span{color:#43536a;font-size:8px;line-height:1.35;font-weight:700}.timeline{display:grid;gap:.12in}.week{display:grid;grid-template-columns:1.25in 2.7in 1fr;gap:.16in;align-items:center;padding:.13in .16in;background:white;border-left:8px solid #58dfff}.week:nth-child(2),.week:nth-child(4){border-color:#9bea18}.week:nth-child(3),.week:nth-child(5){border-color:#e31837}.week>div b{display:block;color:#4dac1e;font-size:8px;letter-spacing:.12em}.week>div strong{font-family:Impact,"Arial Narrow",sans-serif;font-size:21px}.week>p{margin:0;color:#43536a;font-size:9px;line-height:1.4;font-weight:700}.week ul{margin:0;padding-left:15px}.week li{margin:3px 0;color:#36506a;font-size:7px;font-weight:700}.measure-grid{display:grid;grid-template-columns:1fr 1fr;gap:.14in}.measure-grid article{min-height:2.18in;padding:.16in;border-top:6px solid #58dfff;background:white}.measure-grid article:nth-child(2),.measure-grid article:nth-child(5){border-color:#9bea18}.measure-grid article:nth-child(3),.measure-grid article:nth-child(6){border-color:#e31837}.measure-grid p{margin:0;color:#4dac1e;font-size:8px;font-weight:950;letter-spacing:.15em}.measure-grid h2{margin:.05in 0;font-family:Impact,"Arial Narrow",sans-serif;font-size:20px}.measure-grid strong{display:block;font-size:9px;line-height:1.35}.measure-grid span{display:block;margin-top:.08in;padding-top:.08in;border-top:1px solid #dce3e9;color:#43536a;font-size:8px;line-height:1.4;font-weight:700}.scorecard{margin-top:.17in;padding:.16in;background:#061326;color:white}.scorecard h3{margin:0 0 .07in;color:#9bea18;font-family:Impact,"Arial Narrow",sans-serif;font-size:20px}.scorecard>div{display:grid;grid-template-columns:1.35in 1fr;gap:.12in;padding:.07in 0;border-top:1px solid #30465f}.scorecard b{font-size:8px}.scorecard span{color:#d5dfeb;font-size:8px;line-height:1.35}.demo-flow{display:grid;gap:.1in}.demo-flow article{display:grid;grid-template-columns:.72in 1fr;gap:.15in;padding:.13in .16in;background:white;border-left:8px solid #58dfff}.demo-flow article:nth-child(2),.demo-flow article:nth-child(5){border-color:#9bea18}.demo-flow article:nth-child(3),.demo-flow article:nth-child(6){border-color:#e31837}.demo-flow article>b{color:#4dac1e;font-family:Impact,"Arial Narrow",sans-serif;font-size:20px}.demo-flow h2{margin:0;font-family:Impact,"Arial Narrow",sans-serif;font-size:18px}.demo-flow p{margin:4px 0;color:#43536a;font-size:8px;line-height:1.35;font-weight:700}.demo-flow strong{color:#226b82;font-size:8px}.ask{display:grid;grid-template-columns:1.1in 1fr;gap:.15in;margin-top:.14in;padding:.15in .17in;background:#e31837;color:white}.ask b{font-family:Impact,"Arial Narrow",sans-serif;font-size:18px}.ask span{font-size:10px;line-height:1.4;font-weight:750}
    .form-page .choice{padding-left:55px}
  `
}

async function dataUri(filePath) {
  const bytes = await readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()
  const mime = extension === '.svg' ? 'image/svg+xml' : 'image/png'
  return `data:${mime};base64,${bytes.toString('base64')}`
}

function kitReadme() {
  return `# TenAceIQ x Vetta close and activation kit

Use this folder after the executive conversation moves from interest to scope.

## Recommended sequence

1. Use the Meeting Demo Path to run the 10-minute product story.
2. Use the fillable Proposal decision worksheet to capture workspace, plan, first journey, policy, owners, and timing.
3. Send the Follow-Up Email with the Proposal and Activation Checklist attached.
4. Move confirmed decisions into the Internal Implementation Handoff.
5. Run the First 30 Days plan and review observed value before expanding.

## Commercial language to keep exact

- Club Starter: $99/month for one branded Club workspace, up to 10 coaches or staff, and up to 150 connected players.
- Club Unlimited: $199/month for one branded Club workspace with unlimited coaches, staff, and connected players.
- Both plans use the same premium Club product. The difference is capacity.
- If Vetta wants separate workspaces by location, scope the number of workspaces before quoting.
`
}

function followUpEmail() {
  return `# Vetta follow-up email

## Subject

Vetta x TenAceIQ Club - proposed first activation

## Email

Hi [Name],

Thank you for the conversation. The clearest opportunity is to connect Vetta's tennis experience around the member: one Player ID, the right role, and a direct path into development, coaching, teams, leagues, and tournaments.

The key decisions for a scoped activation are:

- one Vetta-wide racquet workspace or location-specific workspaces;
- Club Starter at $99/month for up to 10 coaches or staff and 150 connected players, or Club Unlimited at $199/month with no staff or player caps;
- the first member journey to launch;
- who owns the rollout; and
- how league and tournament results should count.

I attached the proposal, activation checklist, and first-30-days plan. My recommended next step is a 45-minute activation session to confirm the workspace shape, first member group, owners, and target launch date.

Would [option one] or [option two] work for that session?

Thanks,
[Name]
TenAceIQ
`
}

function internalHandoff() {
  return `# Vetta internal implementation handoff

## Commercial scope

- Workspace model:
- Workspace count:
- Selected plan:
- Capacity confirmed against Starter limits:
- Final commercial owner:
- Order form status:

## Vetta operating model

- Executive sponsor:
- Racquet-sports owner:
- Day-to-day Club admin:
- Coaches or staff in first group:
- Connected players in first group:
- Locations represented:

## Experience configuration

- Club display name:
- Approved logo and primary color:
- Public description:
- Programs, groups, or teams:
- Role assignments:
- First member journey:
- Member invitation message owner:

## Identity readiness

- Existing TenAceIQ members identified:
- New members ready for invitation:
- Player ID matching owner:
- Duplicate or ambiguous profiles resolved:
- Test accounts for each role:

## Competition readiness

- First league or tournament:
- Default result policy:
- Publishing owner:
- Result-entry owner:
- Test result verified:
- Public and TIQ behavior confirmed:

## Launch operations

- Target launch date:
- Seven-day review:
- Thirty-day review:
- Support path:
- Escalation owner:
- Next rollout decision date:
`
}

function proposalNotes() {
  return `# Vetta proposal conversation notes

## Lead with the outcome

Vetta already has the programs. TenAceIQ Club connects the member identity and tennis context around them.

## Explain current and new members

- A current TenAceIQ member joins the Vetta Club workspace with the same account and Player ID.
- A new member receives an invitation, creates or uses an account, and connects to the correct Player ID.
- Club membership sets the relationship and roles; Player ID carries public tennis identity and match context.
- One person can hold multiple roles without duplicate profiles.

## Explain result policy

- TIQ rated: public match history and TIQ rating update.
- Public history only: visible match history without TIQ rating impact.
- Social/event only: local event record without public history or TIQ impact.

## Explain pricing

Both plans use the same product. Starter is limited to 10 coaches or staff and 150 connected players. Unlimited removes those capacity caps. Each quoted plan activates one branded Club workspace.

## Do not overpromise

- Do not say $199 automatically covers separate workspaces at every Vetta location.
- Do not describe Vetta branding as a live customer account.
- Do not position TenAceIQ as a replacement for booking, registration, membership, point-of-sale, or payment systems.
- Do not promise data integrations until the specific systems and data exchanges are scoped.
`
}
