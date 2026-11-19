import {defineConfig} from '@playwright/test'
import base from '../playwright.config'
import path from 'node:path'
export default defineConfig({...base,testDir:'./e2e',webServer:undefined,outputDir:path.resolve('.next/playwright-coach-activity'),
  projects:base.projects!.filter(p=>['mobile-chrome','mobile-webkit'].includes(p.name!)).map(p=>({...p,testMatch:['**/mobile-coach-activity.e2e.ts','**/mobile-coach-workspace.e2e.ts']})),
})
