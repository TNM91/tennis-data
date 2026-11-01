import type {InternalNotification} from '../../lib/internal-notification-record'

const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ')

/** Searches only titles and previews already loaded in this account's inbox. */
export function createUpdatesFinder(rows:InternalNotification[]){
 const indexed=rows.map(row=>({row,fields:[row.title,row.body].map(normalize)}))
 return {find(query:string){const term=normalize(query.slice(0,160));return term?indexed.filter(item=>item.fields.some(field=>field.includes(term))).map(item=>item.row):rows}}
}
