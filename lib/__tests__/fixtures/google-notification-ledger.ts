import {readFile} from 'node:fs/promises'
import {googleLedgerFixture} from './google-purchase-ledger'

export async function googleNotificationLedgerFixture(){
 const f=await googleLedgerFixture()
 await f.db.exec('reset role')
 await f.db.exec(await readFile(new URL('../../../supabase/migrations/20261123000200_google_pro_notifications.sql',import.meta.url),'utf8'))
 await f.db.exec('set role service_role')
 return f
}
