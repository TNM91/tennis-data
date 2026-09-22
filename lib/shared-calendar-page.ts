// Standalone response: private bearer links must not load ads, analytics, or
// third-party scripts from the normal application shell.
export function sharedCalendarPage(shareId: string, nonce: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>Shared match calendar | TenAceIQ</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#06172f;color:#fff;font-family:system-ui,sans-serif;line-height:1.5}main{max-width:620px;margin:40px auto;padding:24px}img{width:210px;max-width:100%;height:auto;margin-bottom:24px}section{padding:24px;border:1px solid #36566b;border-radius:20px;background:#0c2236}h1{font-size:26px;line-height:1.2;overflow-wrap:break-word}h2{font-size:18px}p,li{color:#c4d1df}a,button{display:flex;align-items:center;justify-content:center;min-height:48px;padding:12px 16px;margin:12px 0;border:1px solid #476277;border-radius:12px;background:#102a40;color:white;text-decoration:none;font:inherit;font-weight:700;text-align:center;cursor:pointer}.primary{background:#9be11d;color:#06172f;border-color:#9be11d}summary{padding:14px 0;cursor:pointer;font-weight:700}input{width:100%;padding:12px;font:inherit;font-size:16px;background:#06172f;color:white;border:1px solid #476277;border-radius:10px}li{margin:10px 0;overflow-wrap:break-word}ul{padding-left:20px}small{color:#aac0d4}#feedback{color:#bbed77}a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible{outline:2px solid #9be11d;outline-offset:3px}[hidden]{display:none!important}@media(max-width:480px){main{margin:12px auto;padding:16px}section{padding:18px}h1{font-size:23px}}</style></head>
<body><main><img src="/brand/web/header-logo-transparent.png" alt="TenAceIQ"><section><small>SHARED MATCH CALENDAR</small><h1 id="title">Your courtside plans</h1><p id="status" role="status">Checking this calendar…</p><div id="ready" hidden><p>Read-only team matches. No TiQ account needed. Practices, personal reminders and availability are not included.</p><a id="apple" class="primary">Add to Apple Calendar</a><p>On iPhone, follow Calendar’s prompts: Find → Done, or Subscribe → Add on older versions. Choose iCloud to use it on your other Apple devices.</p><details><summary>Add to Google Calendar</summary><p>On a computer, copy the calendar link below. Open Google Calendar → Other calendars → + → From URL, paste it, then choose Add calendar. Turn this calendar on in your phone’s Google Calendar app.</p><a href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noopener noreferrer">Open Google Calendar setup</a></details><button id="copy" type="button">Copy calendar subscription link</button><p id="feedback" role="status"></p><details><summary>Calendar link &amp; help</summary><label>Subscription link<input id="url" readonly></label><p>If Apple does not open, use Safari or paste this link in Calendar → Calendars → Add Calendar → Add Subscription Calendar.</p><p>Subscribe once. Adding the same matches separately can create duplicates. Saved match changes appear when your calendar app refreshes; the owner must save changed team dates to TiQ first.</p><p>Anyone with this link can view the shared matches. The owner can stop future access, but cannot erase copies already saved on someone else’s device.</p></details><details><summary id="preview">Review matches</summary><ul id="matches"></ul></details></div></section></main>
<script nonce="${nonce}">(async()=>{
  const token=location.hash.slice(1);
  const status=document.getElementById('status');
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)){
    status.textContent='This link is incomplete. Ask the sender for the full sharing link.';return;
  }
  const feed=new URL('/api/calendar/shared/${shareId}/calendar.ics',location.origin);
  feed.searchParams.set('token',token);
  try{
    const response=await fetch(feed,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!response.ok){
      status.textContent=response.status===404?'This link is no longer available. Ask the sender for a new link.':'This calendar could not be loaded. Refresh to retry.';return;
    }
    const data=await response.json();
    const zones={'America/New_York':'Eastern','America/Chicago':'Central','America/Denver':'Mountain','America/Phoenix':'Arizona','America/Los_Angeles':'Pacific','America/Anchorage':'Alaska','Pacific/Honolulu':'Hawaii'};
    document.getElementById('title').textContent=data.teamName;
    status.textContent=data.count+' '+(data.count===1?'match':'matches')+' shared · match times use '+(zones[data.timeZone] || data.timeZone)+' time';
    document.getElementById('ready').hidden=false;
    document.getElementById('apple').href=feed.toString().replace(/^https?:/,'webcal:');
    document.getElementById('url').value=feed.toString();
    document.getElementById('copy').onclick=async()=>{
      try{await navigator.clipboard.writeText(feed.toString());document.getElementById('feedback').textContent='Link copied. Paste it in your calendar app to finish.'}
      catch{document.getElementById('feedback').textContent='Open Calendar link & help below to select and copy the link.'}
    };
    document.getElementById('url').onfocus=e=>e.target.select();
    document.getElementById('preview').textContent='Review '+data.count+' '+(data.count===1?'match':'matches');
    for(const match of data.matches){
      const li=document.createElement('li');
      const date=new Date(match.date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'});
      const time=match.time?new Date('2000-01-01T'+match.time.slice(0,5)+':00Z').toLocaleTimeString('en-US',{timeZone:'UTC',hour:'numeric',minute:'2-digit'}):'All day — time TBD';
      li.textContent=date+' · '+time+' · '+match.title+(match.location?' · '+match.location:'');
      document.getElementById('matches').append(li);
    }
  }catch{status.textContent='This calendar could not be loaded. Refresh to retry.'}
})();</script></body></html>`
}
