import {defineConfig} from '@playwright/test'
import base from '../playwright.config'
export default defineConfig({...base,testDir:'./fixtures',webServer:undefined,retries:0,workers:1,projects:base.projects!.filter(p=>p.name==='mobile-webkit').map(p=>({...p,testMatch:'**/mobile-court-diagnostic.e2e.ts'}))})
