# iPhone app lock

Account offers an optional device-local app lock. It defaults off and requires a successful Apple LocalAuthentication check before either enabling or disabling it. The setting applies on this iPhone, including after changing accounts. It never stores a password or creates a Supabase session. Signing out still requires password or email-code sign-in next time.

The native cover sits above the WebView and its HTML dialogs, disables underlying interaction and accessibility, and covers content before app-switcher snapshots. A cold start or real background transition requires another unlock. Transient inactivity from Face ID, notifications or StoreKit does not relock an already unlocked app. Canceling authentication keeps the current setting or lock; a background transition invalidates pending authentication and ignores late replies.

Apple's `deviceOwnerAuthentication` policy allows Face ID, Touch ID or the device passcode. A device passcode must be configured. The native lock screen has an explicit Unlock button so canceled prompts do not restart in a loop. If device authentication becomes unavailable, restore it in iPhone Settings. This is a local privacy feature, not server authorization or an account-password replacement.

Validation: `node --test mobile/scripts/ios-app-lock.test.mjs`, `node mobile/scripts/app-lock-ui-smoke.mjs` after bundling, and the existing Mac simulator workflow. The simulator executes real native lifecycle/persistence/cover code with an injected test authenticator in its unsigned generated Debug source; this does not prove a real face scan. Its report must also confirm the actual JavaScript-to-native status bridge. Test evaluators and probes must be absent from the signed Release binary. A physical iPhone test must confirm Face ID and device-passcode behavior after installing the beta.

Apple references: [LocalAuthentication](https://developer.apple.com/documentation/localauthentication/logging-a-user-into-your-app-with-face-id-or-touch-id), [device-owner policy](https://developer.apple.com/documentation/localauthentication/lapolicy/deviceownerauthentication).
