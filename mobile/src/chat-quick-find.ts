import {html} from './match-details'
import {messageSearchRanges} from './message-search'
import type {ChatFilter} from './chat-filters'

export function chatQuickFindHtml(query:string,filter:ChatFilter,open:boolean){
 return `<form id="chat-quick-find-panel" class="chat-quick-find" role="search" aria-label="Find in conversation" ${open?'':'hidden'}><div class="chat-find-heading"><label for="chat-search">Find a message</label><button type="button" class="secondary" data-chat-find-close>Close</button></div><div class="chat-find-query"><input id="chat-search" type="search" maxlength="120" autocomplete="off" placeholder="Search loaded messages" aria-describedby="chat-search-status" value="${html(query)}"><button type="button" class="secondary" id="chat-search-clear">Clear</button></div><div class="chat-find-options"><label>Show<select id="chat-filter">${([['all','All messages'],['announcements','Announcements'],['media','Photos & GIFs'],['mentions','Mentions of you']] as const).map(([value,label])=>`<option value="${value}" ${filter===value?'selected':''}>${label}</option>`).join('')}</select></label><button type="button" class="secondary" id="chat-history-open">Search older history</button></div><p class="rating-context" role="status" id="chat-search-status"></p></form>`
}

/** Wrap only text nodes; message links, destinations and their handlers stay intact. */
export function highlightChatCopy(root:HTMLElement,query:string){
 for(const mark of root.querySelectorAll<HTMLElement>('mark[data-chat-highlight]')){const parent=mark.parentNode;mark.replaceWith(document.createTextNode(mark.textContent||''));parent?.normalize()}
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes:Text[]=[]
 let next:Node|null;while((next=walker.nextNode()))nodes.push(next as Text)
 const ranges=messageSearchRanges(nodes.map(node=>node.data).join(''),query)
 let offset=0
 for(const node of nodes){
  const start=offset,end=start+node.length;offset=end
  const hits=ranges.filter(range=>range.start<end&&range.end>start)
  if(!hits.length)continue
  const fragment=document.createDocumentFragment();let cursor=0
  for(const hit of hits){const from=Math.max(start,hit.start)-start,to=Math.min(end,hit.end)-start;fragment.append(document.createTextNode(node.data.slice(cursor,from)));const mark=document.createElement('mark');mark.dataset.chatHighlight='';mark.textContent=node.data.slice(from,to);fragment.append(mark);cursor=to}
  fragment.append(document.createTextNode(node.data.slice(cursor)));node.replaceWith(fragment)
 }
}
