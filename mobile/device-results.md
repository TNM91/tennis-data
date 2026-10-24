# Device evidence

Native Android launch, sign-in with the Free QA fixture, account access, process-restart session restoration, and logout have now been verified. iOS and other membership tiers remain unverified. The history below records earlier failed checks as well as the successful correction.

Host preflight on 2026-10-23: Node 24.14.1 available; local Next.js `/login` returned HTTP 200 with viewport metadata and sign-in content. Android Java/SDK/build tools/ADB were absent at the initial check. This is host evidence only; it does not establish native layout, session, or sign-in success.

Local `/explore` returned 200. `/api/auth/access` initially returned HTML 404 under Turbopack. Restarting the same source with `--webpack` returned JSON 401 without credentials, matching the handler contract. The device harness instructions now use webpack. No authenticated API call was attempted.

Android setup on 2026-10-23: Android Studio 2026.2.1.8 and Microsoft OpenJDK 21 installed. API 36, build tools 35.0.0, platform-tools, and emulator runtime installed. The default Studio JBR is Java 25; the Gradle build used Java 21 instead.

The generated debug APK passed `apksigner verify`; package metadata reports `com.tenaceiq.prototype`, minimum API 24, target API 36, version code 1. The APK is approximately 4.1 MB and loads the development server at `http://10.0.2.2:3000`. Source HEAD was `78906c6a` with existing uncommitted web edits plus this mobile harness; this is not a clean-commit release candidate.

Gradle `assembleDebug` completed successfully: 93 tasks, exit code 0. APK SHA-256: `6E4239B683C27FE7953F3DA8EF4EF02926209B2239F44B41057659776F1F2BA6`.

The verified Android 36 Google APIs x86_64 revision 7 image is installed. Virtual device `TenAceIQ_Pixel6_API36` was created with the Pixel 6 profile (1080 × 2400, density 420, 2 GB RAM). The AVD manager emitted a missing optional image `devices.xml` warning but created the profile; emulator boot is still unverified.

Windows Hypervisor Platform enablement completed with exit code **3010: restart required**. No automatic restart was performed. The post-enable acceleration check still fails until reboot. No native device execution or authenticated login has been completed.

After the Windows restart at 08:11 on 2026-10-23, acceleration still failed. Administrator diagnostics confirmed `HypervisorPlatform` enabled but `Microsoft-Hyper-V-Hypervisor` disabled; CPU VM extensions, SLAT, and BIOS virtualization were available. Enabled `Microsoft-Hyper-V-Hypervisor` with dependencies and configured the current boot entry's `hypervisorlaunchtype` to `auto`. The operation confirmed `HypervisorState: Enabled` and `RestartNeeded: true`. A second restart is required to activate this missing component; none was performed automatically. Native execution remains unverified.

Final `doctor` checks passed Node, Java, API 36, build tools, and ADB; no running device was found. The login-route probe timed out during the fresh webpack compilation in this session, so the earlier host route checks must not be treated as a current end-to-end pass. Configuration tests passed (2/2).

| Date | Commit | Device / OS | Flow | Result / reproduction |
| --- | --- | --- | --- | --- |
| 2026-10-23 | 78906c6a + working tree | Pixel 6 / Android 16 API 36 | Acceleration and boot | WHPX usable; Android boot completed; ADB connected. |
| 2026-10-23 | Same | Same | APK installation and launch | Streamed install succeeded. Final localhost APK cold activity start: 4033 ms; Android reported `Status: ok`. |
| 2026-10-23 | Same | Same | Home rendering | WebView URL `http://localhost:3000/`, document ready complete; “Find your tennis.” visible. [Screenshot](evidence/android-home.png). |
| 2026-10-23 | Same | Same | Client → account-access API | Fetch from the actual WebView returned JSON 401 without credentials, as expected. No database access or authenticated data flow claimed. |
| 2026-10-23 | Same | Same | My Lab navigation | Native tap opened `/mylab` and its signed-out Player preview. [Screenshot](evidence/android-mylab.png). |
| 2026-10-23 | Same | Same | Sign-in entry | Server served `/login` with 200, but emulator process exited before screen verification. Windows Application Error 1000 identifies `qemu-system-x86_64-headless.exe`, exception `0xc0000005`. Login is not verified. |

Connection fix: the initial emulator alias `10.0.2.2` produced `ERR_ADDRESS_UNREACHABLE`. ADB reverse with `http://localhost:3000` rendered correctly. An intermediate `127.0.0.1` configuration triggered a Next.js development-origin warning. Final localhost APK SHA-256: `4879BEECF5700ED8083C5577B9B406CDA2BE165E94AEDAA205E7E85B52C5D1B2`.

The bounded AndroidRuntime/chromium error-log checks returned no errors during successful home rendering. A System UI responsiveness warning appeared during initial Android boot. The host QEMU crash is a separate unresolved emulator reliability issue. A retry with Vulkan disabled was started; this is a troubleshooting attempt, not a confirmed fix.

The Vulkan-disabled retry booted and launched the reinstalled APK successfully (`Status: ok`, activity cold start 5975 ms). It stayed running for the immediate follow-up check, but long-term emulator stability has not been established. `/login` initially showed “Opening your next tennis tool...” and then returned to `/` without displaying the form. This redirect requires investigation before authenticated login, account switching, or session persistence can be accepted. No credentials were entered, no membership purchase was attempted, and no authenticated database result is claimed.

Do not record passwords, tokens, real player messages, or personal information.

## Native authentication correction

The earlier sign-in redirect did not reproduce through Home → menu → Sign in. A repeatable real-link smoke passed twice, including the email/password form remaining visible and JSON 401 while signed out. [Public sign-in screenshot](evidence/android-sign-in.png). No login redirect logic was changed.

The existing Free QA fixture then signed in and resolved member access with `/api/auth/access` returning 200. The initial process-stop/relaunch check lost both the session and a non-secret localStorage marker; the marker survived ordinary same-origin page navigation. This established that WebView localStorage was unsuitable for the tested session durability, rather than establishing a token rejection or an authorization failure.

Added `lib/native-auth-storage.ts`, selecting the native encrypted-storage plugin only on Capacitor. Android uses AES-GCM with Android Keystore keys. Browser storage selection is unchanged. Native failures propagate rather than falling back to plaintext storage. Supabase still performs server verification of account access. No roles or subscription entitlements were granted by the storage adapter.

Native adapter initialization wraps the Capacitor proxy before returning it from an async function; returning the proxy directly invokes its synthetic `then` method and can stall auth. Regression coverage includes that proxy behavior, browser isolation, missing sessions, and storage error propagation.

Verified with the updated APK and locally served development candidate:

| Check | Result |
| --- | --- |
| Free QA password sign-in | Member session present, auth resolved, access snapshot present; account-access HTTP 200. |
| Full Android process stop and cold relaunch | Session restored, auth resolved, access snapshot present; account-access HTTP 200. |
| Logout through actual app control | Logout control invoked; fixture signed out. |
| Process stop/relaunch after Logout | Home → menu → Sign in smoke passed; signed-out JSON 401; form stayed visible. |
| Focused native storage + auth-provider tests | 11 passed. |
| Root lint / TypeScript | Passed after excluding generated native output/dependencies from the web checks. |
| Full unit suite | 3,845 passed, 3 failed out of 3,848. Brand and gutter scan failures were 5-second timeouts and passed on rerun. The remaining Captain assertion concerns an unrelated working-tree change in `team-connection-invite.tsx`; this auth work did not edit it. |

No credentials or tokens were printed, no private authenticated screenshots were retained, and the QA fixture was signed out after testing. iOS keychain behavior, account switching, password recovery, token expiry, and all paid-tier/native purchase flows remain separate acceptance gates.

The local production-build invocation encountered another active build. That existing build subsequently produced a runnable local bundle containing the adapter; it was reused instead of rebuilding. Its Android smoke was interrupted by a second host QEMU crash, so that production device pass was not accepted. Repository metadata confirmed the direct download had selected beta emulator 37.3.5 (channel-2), not stable 37.2.12 (channel-0). Stable-runtime replacement is in progress; the beta is being retained as a backup.

### Final stable-runtime production check

Installed checksum-verified stable emulator 37.2.12 (build 16428233); preserved the beta runtime outside the SDK rather than deleting it. The stable Pixel 6 emulator booted with WHPX. The reused local production bundle started with `next start`; no cloud build or deployment was created. A cold smoke RPC initially timed out, but a focused network check returned JSON 401 both inside Android and on the host; the subsequent real-link entry check passed.

On that production bundle, Free QA sign-in resolved member session/access and account-access HTTP 200. A full Android process stop and relaunch restored the session and account access with HTTP 200 again (activity cold start 3314 ms). Logout was invoked through the app control, followed by the signed-out entry smoke and public screenshot capture. This supersedes the earlier unverified login/persistence status. No account credentials, tokens, private page contents, or authenticated screenshots were retained in repository evidence.

Current APK with the native plugin: SHA-256 `21689D48AD476319936CF19FB4370332040534EFA1D3354F2A8CE2C67C2A9EE4`. The APK still loads local web assets; production-bundle testing here verifies the shared code, not App Store readiness. Bundled-client API origins, native notifications, account deletion, store billing, physical Android devices, and iOS remain outstanding milestones.

Final cleanup explicitly waited for asynchronous Logout to complete (public role, no session) before navigating. The final production Home → menu → Sign in check passed with JSON 401 and a stable form; the QA fixture was left signed out. The entry harness retries a cold SSR menu click once only when the menu is still closed, to avoid accepting an unhydrated control as a successful click. Targeted lint and syntax checks passed after that harness change.
# Bundled client acceptance — October 23, 2026

- Stable Android API 36 Pixel 6 emulator, debug package `com.tenaceiq.prototype`; APK SHA256 `97F7AB03DE41348A7F06CEA91B1FE0BDAD13473DAEC32806E3762E7CDEA377B5`.
- Generated config has `webDir: bundled` and no server URL. Removed all ADB reverse tunnels before installing/launching. WebView confirmed `https://localhost/` and bundled sign-in rendered.
- Synthetic Free QA sign-in and hosted profile read passed. Force-stop/relaunch restored the encrypted session and profile read passed again.
- Inspector network loss produced a visible unavailable/retry state; restoring connectivity automatically refreshed the profile successfully. Initial smoke attempted a redundant retry click while the online handler had already replaced the controls with loading UI; corrected the test to wait for automatic recovery, then reran successfully.
- Sign-out completed, and signed-out entry screenshot captured at `evidence/android-bundled-sign-in.png`. Fixture left signed out. No credentials, session tokens, or private profile screenshots saved.
- Signed-out page reload with inspector networking disabled also passed; bundled sign-in rendered offline. Connectivity restored in cleanup.
- Validation: full repository TypeScript check passed; focused bundled-source TypeScript and lint passed; secure-storage tests (3) and device-config tests (2) passed. Android debug build succeeded. Mobile runtime dependency audit reported zero known advisories; three moderate development-tool advisories remain outside shipped runtime dependencies. Full web suite was not repeated for this isolated mobile slice.
- Separate hosted API permission check passed: anonymous profile read denied, QA own profile readable, other profiles denied. No permission policies were changed.
- This is a read-only linked-profile slice of My Lab. No Next.js custom APIs or paid features are bundled yet. iOS, physical-device offline/reconnect, expiry, and account-switch acceptance remain outstanding.

# Bundled recent results — October 23, 2026

- Added latest ten connected matches with date/type/league/recorded score and result. Unknown winner or player-side data stays pending. Calendar dates do not shift with the phone's time zone. No database, access-policy, or deployment changes.
- Free QA Android sign-in passed with the unlinked-player state. Player QA hosted query and Android list passed with ten connected results. Query filters through `match_players!inner` before deterministic date/ID ordering and limit.
- On Android, blocking only `/rest/v1/matches` displayed the independent match-error state and left profile/sign-out controls usable. Unblock plus Retry matches passed. Full inspector network loss/reconnect passed as well.
- Fixture credentials and private match contents were not logged or saved in screenshots. iOS and physical-device acceptance remain open.
- Final APK SHA256: `38C2383D655EA109E8A55D885A2900CA265B5AFE9548EF55FED5DEC08B7CB239`. Reinstalled final APK, force-stopped/relaunched, and verified restored session plus populated results; then signed out successfully.
- Final checks passed: Android build, focused TypeScript, focused lint, six result/storage tests, two config tests, and Git whitespace check. Full web regression was not repeated for this isolated mobile change.

# Bundled match details and navigation — October 23, 2026

- Added View match → recorded score and participants on sides A/B, with the linked player's side marked. Back restores the unchanged list, scroll and focus. Detail selection is memory-only; hash is `#match` without identifiers. Participant reads have independent timeout, failure and retry handling.
- Android acceptance passed with the existing Player QA fixture: populated details, blocked participant endpoint → error → retry, list-scroll restoration, focus restoration, native system Back and sign-out. The final APK restored the existing encrypted session after installation/relaunch before these checks.
- System Back initially appeared broken. Navigation counters showed no Back event reached JavaScript; Android window diagnostics identified a System UI ANR dialog holding input focus over the foreground app. Dismissed it with Wait, confirmed app input focus, and repeated a clean system Back test successfully. This was an emulator input obstruction, not evidence of a remaining app navigation failure. Added explicit official App plugin handling for the intended Android navigation behavior.
- Layout inspected using `evidence/android-match-details-sample.png`; all visible fixture fields were replaced with sample text before capture. No private match screenshot was saved. QA fixture left signed out.
- Final APK SHA256: `2D638AD1A5C2AF56246266F801B89FD7D525951DEE252B55823FD640614619CC`. Android build, focused TypeScript, lint, nine detail/result/storage tests and two configuration tests passed. No backend deployment or policy changes. iOS and physical-device checks remain open.

# Bundled password recovery and account help — October 23, 2026

- Added native recovery request form using the existing Supabase Auth service and fixed HTTPS website reset route; no redirect settings changed. Browser completion followed by manual app sign-in is the current flow. Native email callbacks/universal links are not implemented.
- Android intercepted recovery smoke passed success, 429/cooldown, network failure and late-response-after-back cases. Duplicate submissions produced one request per case. All recovery requests were intercepted; no real email sent and no password changed. Screenshot captured before entering the dummy `.invalid` address.
- Existing hosted reset, privacy, terms and contact routes each returned HTTP 200 on the canonical HTTPS origin. Android recovery system Back passed. Support opened Chrome's native custom tab to `tenaceiq.com`; Chrome first-run setup completed without adding an account. App credentials were not transferred.
- Live email delivery, redirect allowlist acceptance and real reset completion are not verified. These remain release gates. User has no Mac; iOS requires a cloud Mac/signing lane, which has not been provisioned.
- Final APK SHA256: `663B4EEA93E5BB0538A51E2468D4A0835618F472EAABDAE4D7C3749ED0BEF6B4`. Android build, focused TypeScript/lint, eleven mobile unit tests, two config tests and whitespace check passed. Ordinary Free QA sign-in/logout passed after browser handoff; app left signed out. No shared web code or backend deployment changed.

# iOS source and cloud build preparation — October 23, 2026

- Owner confirmed no Mac and no Apple Developer Program enrollment. Generated the Capacitor iOS SPM project locally on Windows, with secure storage, App and Browser plugins included.
- Added reproducible preparation/check scripts and an explicit shared App Xcode scheme. Approved 1024px icon copied unchanged; byte-for-byte source hash check passed. Config uses bundled assets, no development server, and the prototype ID.
- Added manual-only GitHub Mac simulator workflow: selected Xcode 26.3 on macos-15, Node 22, both npm lockfiles, focused tests, generated SPM project, unsigned simulator compile, one artifact retained three days, read-only repository permission and a 25-minute cap. No secrets, archive/export, Apple upload, automatic push/PR trigger, or paid-service provisioning.
- Local iOS source checks, repeated preparation, YAML/cost/signing-boundary tests, focused script lint and whitespace check passed. No Git push, workflow dispatch, Xcode compilation, simulator launch, physical iPhone test or signed IPA occurred. Future cloud execution still needs review/publication of the full mobile change and an Actions allowance check.
- Signing/enrollment handoff is in `ios-cloud-build.md`. Simulator output will not be installable on a physical iPhone. Enrollment is required for the later TestFlight lane, not the unsigned simulator compile.
# Apple-first clean candidate — October 23, 2026

- Owner completed enrollment and requested Apple priority, with Android deferred. Apple Developer account was inspected and currently shows Pending; no signing team, certificate or profile was created.
- Isolated the mobile work from unrelated website edits on a fresh current-master checkout (`codex/apple-mobile-build`). Clean-checkout lint, TypeScript, all 3,829 tests across 724 files, extension syntax and local production build passed. Signed-out production smoke returned Home 200, Login 200 and account-access 401; browser sign-in inputs rendered.
- Clean iOS generation and packaging checks passed, including all three plugins, shared scheme and unchanged approved artwork. Workflow/config tests passed. The Mac compile can be explicitly requested with an `ios-simulator` PR label, without requiring a production merge or rerunning on every push.
- The reviewed candidate remains local at this checkpoint. No push, PR, Mac compile, signing or TestFlight upload has occurred. Publication and the first Mac run are the next steps after owner authorization.


## Bounded team conversation history

- The bundled conversation opens with the latest 75 messages. Earlier messages replaces the current window with up to 75 older messages; Back to latest returns to the current window. Search covers only the loaded window.
- The read-only chat endpoint accepts a validated timestamp/UUID tuple, retains timestamp microseconds, and checks the current accepted team scope, participation, removals, and block settings for every page. It does not mark messages read, sign attachment URLs, create a room, or sync membership.
- Foreground activity refreshes the same older window so edits, removals, reactions, and block redaction remain current. Reading an older window does not advance the latest read position. No extra polling, persistent history cache, schema, or scheduled job is added.
- Local blocked-network phone fixture: multiple pages including timestamp ties, beginning of conversation, draft retention, loaded-window search, incoming activity without a jump/read write, failed page and retry, return to latest, inline photo, access removal, and team switch. Positive effects are synthetic only.
- Physical iPhone acceptance remains: use a team with over 75 posts; open Earlier messages, search, reply to an older post, view an older photo, background/resume, and return to latest. Confirm unread behavior from a second team member. Do not treat the synthetic fixture as physical-device acceptance.
