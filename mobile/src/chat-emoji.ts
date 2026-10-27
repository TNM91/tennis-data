import {nativeActionIcon} from './native-action-icons'
/** Locally bundled choices: inserting an emoji never sends a message. */
export const chatEmojiChoices = [
 ['\u{1F3BE}','Tennis'],['\u{1F44F}','Applause'],['\u{1F525}','Fire'],['\u{1F4AA}','Strong'],
 ['\u{1F602}','Laughing'],['\u{1F389}','Celebrate'],['\u{1F44D}','Thumbs up'],['\u{2764}\u{FE0F}','Heart'],
 ['\u{1F64C}','Hands up'],['\u{1F3C6}','Trophy'],['\u{1F605}','Relieved'],['\u{1F440}','Eyes'],
 ['\u{1F60E}','Cool'],['\u{1F92F}','Mind blown'],['\u{1F914}','Thinking'],['\u{1F62E}','Wow'],
 ['\u{1F64F}','Thanks'],['\u{1F91D}','Handshake'],['\u{2705}','Ready'],['\u{1F4AF}','One hundred'],
 ['\u{1F4C5}','Calendar'],['\u{1F327}\u{FE0F}','Rain'],['\u{1F4CD}','Meet here'],['\u{1F6A8}','Heads up'],
] as const
export function insertChatEmoji(text:string,start:number,end:number,emoji:string,limit=2400){
 if(!chatEmojiChoices.some(([value])=>value===emoji)||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>text.length)return null
 // Never split a surrogate pair when restoring a saved selection.
 const split=(at:number)=>at>0&&at<text.length&&/[\uD800-\uDBFF]/.test(text[at-1])&&/[\uDC00-\uDFFF]/.test(text[at])
 if(split(start)||split(end))return null
 const value=text.slice(0,start)+emoji+text.slice(end)
 return value.length<=limit?{text:value,caret:start+emoji.length}:null
}
export function chatEmojiPickerHtml(disabled:boolean){
 return `<details class="chat-emoji-picker"><summary aria-label="Emoji">${nativeActionIcon('emoji')}<span class="sr-only">Emoji</span></summary><div class="chat-emoji-grid" role="group" aria-label="Choose an emoji">${chatEmojiChoices.map(([emoji,label])=>`<button type="button" class="secondary" data-chat-emoji="${emoji}" aria-label="Insert ${label}" ${disabled?'disabled':''}>${emoji}</button>`).join('')}</div></details>`
}
