# iOS build path from Windows

Status: Apple is the current priority; Android work is deferred. The owner reports completing enrollment; the Apple Developer account currently displays Pending. No Mac is available. The iOS source project is generated and checked locally. Certificate creation and TestFlight upload have not happened.

## First gate: unsigned simulator compile

Use the repository's GitHub Actions Mac runner rather than introducing another build-service account. The workflow is `.github/workflows/mobile-ios-simulator.yml`. It runs by manual dispatch or by explicitly adding the `ios-simulator` label to a PR; pushes and PR updates do not run it. It uses read-only repository permission, stops after 25 minutes, and retains one zipped simulator app for three days. This repository is currently public; standard GitHub-hosted runners are free for public repositories. Recheck visibility and Actions allowances if that changes. No budget or billing setting is changed.

The workflow installs both lockfiles, runs focused mobile checks, bundles the client, regenerates the ignored iOS project using Swift Package Manager, copies the approved icon unchanged, and compiles with Xcode 26.3 on `macos-15`. The explicit Xcode path avoids that image's older default Xcode. Runner images evolve: a missing selected Xcode is an actionable failure to review, not a reason to download a different toolchain automatically.

The workflow and every referenced source must be committed and reviewed together. For the first build before merging, apply the `ios-simulator` label to the reviewed PR once. This explicitly requests a Mac compile without merging into production; subsequent pushes do not restart it. GitHub's manual-dispatch workflow must exist on the default branch before its Run workflow button is available. Do not merge only the workflow while mobile sources remain untracked. Follow the repository's release workflow and CI gates before merging shared code; a merge to `master` also triggers the web production deployment.

After review and publication, choose **Actions → Mobile iOS simulator build → Run workflow** once for the intended commit. Inspect the result before retrying. A successful run produces `tenaceiq-ios-simulator-<commit>` containing `ios-simulator.zip`. Its `App.app` targets the runner's simulator architecture; it is **not an IPA**, cannot be installed on a physical iPhone, and does not establish auth/keychain behavior or an App Store release. The workflow does not boot a simulator or claim a launch test.

Reproduce source preparation on Windows or a Mac from the repository root:

```powershell
npm ci
npm ci --prefix mobile
npm run build:bundled --prefix mobile
npm run prepare:ios --prefix mobile
npm run check:ios --prefix mobile
node --test mobile/scripts/ios-workflow.test.mjs
```

`prepare:ios` creates an SPM project if none exists, otherwise syncs the existing SPM project. It refuses a different project layout or a server-loaded Capacitor config instead of deleting or migrating native work. `mobile/ios/` stays generated and ignored. Keep native changes reproducible in scripts or move to a deliberately tracked project before introducing custom native code. `check:ios` verifies source packaging and plugin references, not Swift compilation. Simulator artifacts and local derived data are ignored.

## Second gate: signed iPhone/TestFlight build

1. Enroll the owner in the Apple Developer Program. Choose the membership/legal entity that should appear as the seller. Organization enrollment requires the organization's eligibility and identity checks; don't use a guessed company identity. Enable the account's required security and accept Apple agreements directly with Apple.
2. Once enrolled, confirm the team ID and choose/register the final app bundle ID. `com.tenaceiq.prototype` is a development identifier, not an approved store identity. Create the App Store Connect app record with the matching bundle ID.
3. Establish the signing route for that team: an Apple distribution certificate/private key and matching App Store provisioning profile, plus an App Store Connect API key with appropriate access for upload. Store private material only in the chosen CI secret store. Never paste passwords, certificate private keys or API keys into chat, Git, workflow text or app assets.
4. Add a separate signed archive/export lane only after the identity and signing material exist. Do not modify this unsigned lane to upload automatically. Set an explicit release version/build number, review the generated native project, and validate privacy declarations, encryption/export answers, icons/splash, capabilities, and entitlements from actual behavior. No assertions about those declarations have been made by the simulator setup.
5. Run a signed beta through TestFlight, then verify login, encrypted session restoration, account switching, sign-out, recovery, browser handoff, keyboard, navigation and connection loss on an actual iPhone. Automatic email return links, account deletion, purchases/restore and native notifications remain separate release work.

No signed workflow is enabled yet: there is no verified Apple team, final bundle identifier, certificate, profile, or upload key. Enrollment is a user-owned account/purchase action; this task has not enrolled or paid on the owner's behalf.

## Primary references

- [Capacitor iOS setup](https://capacitorjs.com/docs/ios) and [SPM workflow](https://capacitorjs.com/docs/ios/spm).
- [Manual GitHub workflow runs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
- [Hosted runners and private-repository billing](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
- [Selected runner's Xcode inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-arm64-Readme.md).
- [Apple developer account and membership](https://developer.apple.com/help/account/basics/about-your-developer-account).
