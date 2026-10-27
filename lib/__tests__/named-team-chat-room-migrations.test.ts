import {it,expect} from 'vitest'
import {spawnSync} from 'node:child_process'
it('runs room and reaction migrations against PostgreSQL, including the production RLS policies',()=>{
 const result=spawnSync(process.execPath,['scripts/check-chat-room-migrations.mjs'],{cwd:process.cwd(),encoding:'utf8',timeout:25000})
 expect(result.error).toBeUndefined()
 expect(result.status,result.stderr||result.stdout).toBe(0)
 expect(result.stdout).toContain('PASS: migrations execute in PostgreSQL')
},30000)
