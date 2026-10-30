import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { nativeOnlyFiles, inspectWebsiteBuild } from './vercel-ignore-native-only.mjs'

test('only reviewed native and test paths can skip a website build', () => {
  assert.equal(nativeOnlyFiles(['mobile/src/main.ts','docs/native-tournament-entry.md','tests/fixtures/mobile-tournaments.ts','.github/workflows/mobile-ios-signed.yml']), true)
  assert.equal(nativeOnlyFiles(['docs/read-model-access-and-build-costs.md','README.md','AGENTS.md']), true)
  for (const file of ['app/api/mobile/tournaments/route.ts','app/page.tsx','lib/team-room.ts','public/brand/icons/app-icon-1024.png','package.json','package-lock.json','next.config.ts','vercel.json','scripts/build.mjs','supabase/migrations/change.sql','docs/data.json','app/content.md','mobile-new/main.ts','mobile/../app/page.tsx','mobile\\src\\main.ts','mobile/a\napp/page.tsx']) {
    assert.equal(nativeOnlyFiles(['mobile/src/main.ts',file]), false, file)
  }
  assert.equal(nativeOnlyFiles([]), false)
})

test('actual Git history preserves cumulative web changes and builds on uncertainty', () => {
  const cwd = mkdtempSync(join(tmpdir(),'tiq-native-build-'))
  const git = (...args) => execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  const commit = (path, text) => {
    mkdirSync(dirname(join(cwd,path)),{recursive:true})
    writeFileSync(join(cwd,path),text)
    git('add','--',path)
    git('-c','user.name=Local verification','-c','user.email=verification@example.invalid','commit','--no-gpg-sign','-m','Synthetic fixture')
    return git('rev-parse','HEAD')
  }
  try {
    git('init','-b','master')
    const base = commit('app/page.tsx','baseline')
    const native = commit('mobile/src/main.ts','native1')
    const context = {VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'master',VERCEL_GIT_PREVIOUS_SHA:base,VERCEL_GIT_COMMIT_SHA:native}
    assert.equal(inspectWebsiteBuild(cwd,context).skip,true)
    const entry = fileURLToPath(new URL('./vercel-ignore-native-only.mjs',import.meta.url))
    assert.equal(spawnSync(process.execPath,[entry],{cwd,env:{...process.env,...context},encoding:'utf8'}).status,0,'Vercel zero exit skips the verified native-only change')
    assert.equal(spawnSync(process.execPath,[entry],{cwd,env:{...process.env,...context,VERCEL_GIT_PREVIOUS_SHA:''},encoding:'utf8'}).status,1,'unknown baseline must issue a build')
    assert.equal(inspectWebsiteBuild(cwd,{...context,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'staging'}).skip,true)
    assert.equal(inspectWebsiteBuild(cwd,{}).skip,false)
    assert.equal(inspectWebsiteBuild(cwd,{...context,VERCEL_GIT_PREVIOUS_SHA:''}).skip,false)
    assert.equal(inspectWebsiteBuild(cwd,{...context,VERCEL_GIT_PREVIOUS_SHA:'a'.repeat(40)}).skip,false)
    assert.equal(inspectWebsiteBuild(cwd,{...context,VERCEL_GIT_COMMIT_SHA:base}).skip,false)
    const web = commit('app/page.tsx','website changed')
    const nextNative = commit('mobile/src/main.ts','native2')
    assert.equal(inspectWebsiteBuild(cwd,{...context,VERCEL_GIT_COMMIT_SHA:nextNative}).skip,false,'intervening website change must deploy')
    assert.equal(inspectWebsiteBuild(cwd,{...context,VERCEL_GIT_PREVIOUS_SHA:web,VERCEL_GIT_COMMIT_SHA:nextNative}).skip,true)
    assert.equal(inspectWebsiteBuild(cwd,{...context,VERCEL_GIT_PREVIOUS_SHA:nextNative,VERCEL_GIT_COMMIT_SHA:nextNative}).skip,false,'manual same-commit redeploy must run')
    git('checkout','--detach',base)
    const other = commit('mobile/other.ts','unrelated branch')
    assert.equal(inspectWebsiteBuild(cwd,{...context,VERCEL_GIT_PREVIOUS_SHA:nextNative,VERCEL_GIT_COMMIT_SHA:other}).skip,false)
  } finally {
    const resolved = realpathSync(cwd)
    assert.equal(dirname(resolved),realpathSync(tmpdir()))
    assert.ok(basename(resolved).startsWith('tiq-native-build-'))
    rmSync(resolved,{recursive:true,force:true})
  }
})
