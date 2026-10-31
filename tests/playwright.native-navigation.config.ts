import {defineConfig} from '@playwright/test'
import base from '../playwright.config'

export default defineConfig({...base,testDir:'./e2e',webServer:undefined,
 projects:base.projects!.filter(project=>['mobile-chrome','mobile-webkit'].includes(project.name!))
  .map(project=>({...project,testMatch:'**/mobile-navigation.e2e.ts'})),
})
