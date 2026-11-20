import {defineConfig} from '@playwright/test'
import base from '../playwright.config'
import path from 'node:path'
export default defineConfig({...base,testDir:'./e2e',webServer:undefined,workers:1,outputDir:path.resolve('.next/playwright-tiq-growth'),
 projects:base.projects!.filter(project=>['mobile-chrome','mobile-webkit'].includes(project.name!))
  .map(project=>({...project,testMatch:'**/mobile-tiq-growth.e2e.ts'})),
})
