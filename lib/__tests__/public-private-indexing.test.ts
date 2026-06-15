import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const robotsSource = readFileSync(join(process.cwd(), 'app/robots.ts'), 'utf8')
const sitemapSource = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8')
const siteNavigationSource = readFileSync(join(process.cwd(), 'lib/site-navigation.ts'), 'utf8')
const productStorySource = readFileSync(join(process.cwd(), 'lib/product-story.ts'), 'utf8')
const manifestSource = readFileSync(join(process.cwd(), 'app/manifest.ts'), 'utf8')
const myQuestPageSource = readFileSync(join(process.cwd(), 'app/level-up/my-quest/page.tsx'), 'utf8')
const myQuestClientSource = readFileSync(join(process.cwd(), 'app/level-up/my-quest/my-quest-client.tsx'), 'utf8')
const myQuestStylesSource = readFileSync(join(process.cwd(), 'app/level-up/my-quest/my-quest.module.css'), 'utf8')
const levelUpIdentityPageSource = readFileSync(join(process.cwd(), 'app/level-up/[identity]/page.tsx'), 'utf8')
const myLabPageSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const previewHomePage = readFileSync(join(process.cwd(), 'app/preview-home/page.tsx'), 'utf8')
const noindexRouteFiles = [
  'app/admin/layout.tsx',
  'app/captain/layout.tsx',
  'app/captain/season-dashboard/layout.tsx',
  'app/coach/layout.tsx',
  'app/compete/layout.tsx',
  'app/league-coordinator/layout.tsx',
  'app/messages/layout.tsx',
  'app/mylab/layout.tsx',
  'app/profile/layout.tsx',
  'app/login/layout.tsx',
  'app/join/layout.tsx',
  'app/level-up/my-quest/page.tsx',
  'app/forget-password/layout.tsx',
  'app/reset-password/layout.tsx',
  'app/tournaments/[id]/preferences/layout.tsx',
  'app/upgrade/layout.tsx',
  'app/preview-home/page.tsx',
  'app/tactics/page.tsx',
] as const

describe('public and private indexing boundaries', () => {
  it('disallows private workspaces without blocking public sections', () => {
    expect(robotsSource).toContain("'/coach/'")
    expect(robotsSource).toContain("'/league-coordinator/'")
    expect(robotsSource).toContain("'/messages'")
    expect(robotsSource).toContain("'/profile'")
    expect(robotsSource).toContain("'/preview-home'")
    expect(robotsSource).toContain("'/tactics'")
    expect(robotsSource).toContain("'/level-up/my-quest'")
    expect(robotsSource).toContain("'/tournaments/*/preferences'")
    expect(robotsSource).toContain("'/upgrade'")

    expect(robotsSource).not.toContain("'/coaches'")
    expect(robotsSource).not.toContain("'/tournaments',")
    expect(robotsSource).not.toContain("'/resources'")
    expect(robotsSource).not.toContain("'/data-assist'")
  })

  it('marks private layouts noindex and nofollow', () => {
    for (const path of noindexRouteFiles) {
      const source = readFileSync(join(process.cwd(), path), 'utf8')

      expect(source).toContain('robots')
      expect(source).toContain('index: false')
      expect(source).toContain('follow: false')
    }
  })

  it('keeps the legacy homepage preview out of indexing', () => {
    expect(previewHomePage).toContain('robots')
    expect(previewHomePage).toContain('index: false')
    expect(previewHomePage).toContain('follow: false')
  })

  it('keeps Nathan-only My Quest out of public discovery surfaces', () => {
    expect(sitemapSource).not.toContain('/level-up/my-quest')
    expect(siteNavigationSource).not.toContain('/level-up/my-quest')
    expect(productStorySource).not.toContain('/level-up/my-quest')
    expect(productStorySource).not.toContain('Operation Visible Abs')
    expect(manifestSource).not.toContain('/level-up/my-quest')
    expect(manifestSource).not.toContain('Operation Visible Abs')
    expect(manifestSource).toContain('Start Level Up drill')
    expect(manifestSource).toContain("url: '/level-up/relentless-competitor-4-0#level-up-flow'")
    expect(manifestSource).toContain("url: '/level-up'")
    expect(levelUpIdentityPageSource).toContain('getPublicLevelUpIdentity')
    expect(levelUpIdentityPageSource).toContain('notFound()')
    expect(myLabPageSource).toContain('canOpenPersonalQuest')
    expect(myLabPageSource).toContain('isPersonalQuestOwner')
    expect(myLabPageSource).toContain("href: '/level-up/my-quest'")
  })

  it('shows Not Found instead of private quest content to unauthorized visitors', () => {
    expect(myQuestPageSource).toContain("title: 'Not Found'")
    expect(myQuestPageSource).not.toContain("title: 'Level Up: My Quest")
    expect(myQuestPageSource).not.toContain('Operation Visible Abs')
    expect(myQuestClientSource).toContain('accessDenied')
    expect(myQuestClientSource).toContain('<h1>Not Found</h1>')
    expect(myQuestClientSource).not.toContain("router.replace('/mylab')")
  })

  it('keeps My Quest progress photos private and cleans up failed metadata writes', () => {
    expect(myQuestClientSource).toContain('createSignedUrls')
    expect(myQuestClientSource).not.toContain('getPublicUrl')
    expect(myQuestClientSource).toContain('.remove([storagePath])')
  })

  it('keeps Nathan-only My Quest phone-first without exposing it publicly', () => {
    expect(myQuestClientSource).toContain('mobileQuestShortcuts')
    expect(myQuestClientSource).toContain('My Quest iPhone mission control')
    expect(myQuestClientSource).toContain('todayFocusQuest')
    expect(myQuestClientSource).toContain('My Quest iPhone today focus')
    expect(myQuestClientSource).toContain('mobileFocusQuests')
    expect(myQuestClientSource).toContain('My Quest iPhone hero stats')
    expect(myQuestClientSource).toContain('My Quest iPhone quick quest rail')
    expect(myQuestClientSource).toContain('MOBILE_TAP_PLAN_GROUPS')
    expect(myQuestClientSource).toContain('My Quest iPhone tap plan')
    expect(myQuestClientSource).toContain('My Quest iPhone pocket mode')
    expect(myQuestClientSource).toContain('phone-mode-control')
    expect(myQuestClientSource).toContain('PHONE_MODE_PREFERENCE_KEY')
    expect(myQuestClientSource).toContain('readPhoneModePreference')
    expect(myQuestClientSource).toContain('writePhoneModePreference')
    expect(myQuestClientSource).toContain("data-phone-mode={phoneCompact ? 'pocket' : 'full'}")
    expect(myQuestClientSource).toContain("href: phoneCompact ? '#lock-screen' : '#today-quests'")
    expect(myQuestClientSource).toContain('MobilePocketPulse')
    expect(myQuestClientSource).toContain('mobilePocketPulse')
    expect(myQuestClientSource).toContain('My Quest iPhone coach pulse')
    expect(myQuestClientSource).toContain('MobilePriorityAction')
    expect(myQuestClientSource).toContain('mobilePriorityStack')
    expect(myQuestClientSource).toContain('My Quest iPhone pocket priority stack')
    expect(myQuestClientSource).toContain('MobileBossReadinessItem')
    expect(myQuestClientSource).toContain('mobileBossReadiness')
    expect(myQuestClientSource).toContain('My Quest iPhone weekly boss readiness')
    expect(myQuestClientSource).toContain('Boss readiness')
    expect(myQuestClientSource).toContain('MobileWeeklyFocusCue')
    expect(myQuestClientSource).toContain('mobileWeeklyFocusCue')
    expect(myQuestClientSource).toContain('My Quest iPhone weekly focus cue')
    expect(myQuestClientSource).toContain('Next best tap')
    expect(myQuestClientSource).toContain('mobilePocketDone')
    expect(myQuestClientSource).toContain('My Quest iPhone pocket done state')
    expect(myQuestClientSource).toContain('Done for now')
    expect(myQuestClientSource).toContain('Why today:')
    expect(myQuestClientSource).toContain('eveningCloseoutQuest')
    expect(myQuestClientSource).toContain('Evening closeout')
    expect(myQuestClientSource).toContain("['no_food_after_8', 'alcohol_limit', 'core_workout', 'water_80_oz']")
    expect(myQuestClientSource).toContain('morningRepairQuest')
    expect(myQuestClientSource).toContain('Recovery pulse')
    expect(myQuestClientSource).toContain('questDate')
    expect(myQuestClientSource).toContain("mobilePocketPulse.questDate ?? today")
    expect(myQuestClientSource).toContain('openFullDashboardSection')
    expect(myQuestClientSource).toContain('mobilePocketTools')
    expect(myQuestClientSource).toContain('My Quest iPhone full dashboard shortcuts')
    expect(myQuestClientSource).toContain('mobileCommandBar')
    expect(myQuestClientSource).toContain('mobileCommandPrimary')
    expect(myQuestClientSource).toContain('mobilePocketStateLabel')
    expect(myQuestClientSource).toContain('My Quest iPhone pocket state label')
    expect(myQuestClientSource).toContain('Closeout mode')
    expect(myQuestClientSource).toContain('Boss danger')
    expect(myQuestClientSource).toContain('confidence')
    expect(myQuestClientSource).toContain('1 tap to protect streak')
    expect(myQuestClientSource).toContain('Boss XP at risk')
    expect(myQuestClientSource).toContain('Repair keeps week honest')
    expect(myQuestClientSource).toContain('My Quest iPhone pocket command bar')
    expect(myQuestClientSource).toContain('Bank Next')
    expect(myQuestClientSource).toContain('Log IPA')
    expect(myQuestClientSource).toContain("'Repair'")
    expect(myQuestClientSource).toContain("'Close'")
    expect(myQuestClientSource).toContain("'Boss'")
    expect(myQuestClientSource).toContain('weekly-bosses')
    expect(myQuestClientSource).toContain('achievements')
    expect(myQuestClientSource).toContain('tool.value')
    expect(myQuestClientSource).toContain('Today focus mode')
    expect(myQuestClientSource).toContain('mobileQuickNote')
    expect(myQuestClientSource).toContain('IPA quick log')
    expect(myQuestClientSource).toContain('mobileIpaQuick')
    expect(myQuestClientSource).toContain('My Quest iPhone day complete summary')
    expect(myQuestClientSource).toContain('mobileReminderStrip')
    expect(myQuestClientSource).toContain('mobileIntelDrawer')
    expect(myQuestClientSource).toContain('mobileSupportDrawer')
    expect(myQuestClientSource).toContain('recordQuestClientIssue')
    expect(myQuestStylesSource).toContain('.mobileMissionControl')
    expect(myQuestStylesSource).toContain('.mobileTodayFocus')
    expect(myQuestStylesSource).toContain('.mobileHeroStats')
    expect(myQuestStylesSource).toContain('.mobileQuestRail')
    expect(myQuestStylesSource).toContain('.mobileTapPlan')
    expect(myQuestStylesSource).toContain('.mobilePocketToggle')
    expect(myQuestStylesSource).toContain('.mobilePocketPulse')
    expect(myQuestStylesSource).toContain('.mobilePocketWhy')
    expect(myQuestStylesSource).toContain('.mobileWeeklyFocusCue')
    expect(myQuestStylesSource).toContain('.mobileBossReadiness')
    expect(myQuestStylesSource).toContain('.mobilePriorityStack')
    expect(myQuestStylesSource).toContain('.mobilePocketDone')
    expect(myQuestStylesSource).toContain('.mobilePocketStateLabel')
    expect(myQuestStylesSource).toContain('.mobileCommandBar')
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobilePocketStateLabel")
    expect(myQuestStylesSource).toContain(".mobilePocketStateLabel[data-tone='red']")
    expect(myQuestStylesSource).toContain('.mobilePocketStateLabel small')
    expect(myQuestStylesSource).toContain(".mobileCommandBar button:first-child[data-tone='amber']")
    expect(myQuestStylesSource).toContain(".mobileCommandBar button:first-child[data-tone='red']")
    expect(myQuestStylesSource).toContain(".mobileCommandBar button:first-child[data-tone='blue']")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobilePocketPulse")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobileWeeklyFocusCue")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobileBossReadiness")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobilePriorityStack")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobilePocketDone")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobileCommandBar")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobileQuestRail")
    expect(myQuestStylesSource).toContain('.mobilePocketMore')
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .mobilePocketMore")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .todayCommand")
    expect(myQuestStylesSource).toContain(".pageShell[data-phone-mode='pocket'] .photoPanel")
    expect(myQuestStylesSource).toContain('.mobileModeRail')
    expect(myQuestStylesSource).toContain('.mobileQuickNote')
    expect(myQuestStylesSource).toContain('.mobileIpaQuick')
    expect(myQuestStylesSource).toContain('.mobileDayComplete')
    expect(myQuestStylesSource).toContain('.mobileReminderStrip')
    expect(myQuestStylesSource).toContain('.mobileIntelDrawer')
    expect(myQuestStylesSource).toContain('.mobileSupportDrawer')
    expect(myQuestStylesSource).toContain('scroll-snap-type: x proximity')
    expect(myQuestStylesSource).toContain('bottom: calc(8px + env(safe-area-inset-bottom))')
    expect(myQuestStylesSource).toContain('padding-bottom: calc(112px + env(safe-area-inset-bottom))')
    expect(myQuestStylesSource).toContain('.heroActions')
  })
})
