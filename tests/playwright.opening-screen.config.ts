import {defineConfig} from '@playwright/test'
import base from '../playwright.config'
import path from 'node:path'
export default defineConfig({...base, testDir: './e2e', webServer: undefined,
  outputDir: path.resolve('.next/playwright-opening-screen'),
  projects: base.projects!.filter(project => ['mobile-chrome', 'mobile-webkit'].includes(project.name!))
    .map(project => ({...project, testMatch: '**/mobile-opening-screen.e2e.ts'})),
})
