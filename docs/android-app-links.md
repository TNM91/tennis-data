# Android content links

`https://www.tenaceiq.com/.well-known/assetlinks.json` associates the canonical website with the production Play package `com.tenaceiq.app`. The public distribution-certificate fingerprint was independently verified from the Play-installed APK and matches Play Console. No upload, debug or developer certificate is authorized. No credential or payment setting is involved.

The static JSON route is public, cacheable for one hour and requires neither a cookie nor an authentication redirect. Android 15+ dynamic rules allow only existing native content destinations, reject nested pages and redirect parameters, and leave unresolved practice URLs on the website. The native router still validates exact parameters and current account permissions; domain verification grants no team membership or data access. Android 14 and earlier use the installed manifest's path restrictions rather than the dynamic extension.

The apex domain redirects to `www.tenaceiq.com`. It cannot independently verify while that redirect exists. Shared links use `www`; the next Android manifest declares that host alone and narrows team/chat paths to their exact supported pages. Build 5 still declares both hosts, so verify the canonical host independently on Android 12+ and do not claim Android 11-or-earlier acceptance for that old binary. Publishing this route does not replace the installed app or affect the Apple association/submission.

Before release, run the association/native-parser tests and full repository checks, then smoke the local production bundle for status 200, `application/json`, the exact package/certificate, public caching and no redirect. Use one Git deployment from `master`. After release, repeat that bounded public check and read Android's `pm get-app-links com.tenaceiq.app` status. Reverification must use Android's verifier, never a forced verified state. Check actual cold/warm invitation navigation separately; a verified domain is not proof that every app screen opened correctly.

## November 27 release evidence

PR #1875 passed all six CI gates and deployed as production commit `1d256c574e56bdd2ccba3e92584af32886cd6e57`. Local and live JSON-route checks returned matching response hashes, the exact Play package/certificate, public one-hour caching and no redirect or cookie. Android's verifier reports the canonical host verified on Play-installed build 5; domain ownership ranks the production package VERIFIED[4] and the developer package UNVERIFIED[-1]. No verification state or user link preference was forced.

The read-only resolver returned a chooser for the positive sample URLs. Actual cold/warm invitation navigation and dynamic practice-link exclusion remain pending; do not describe the diagnostic as successful screen-navigation acceptance. The apex still redirects and is unverified. The canonical-only manifest is prepared for the next app binary, not included in build 5. Apple review and Google checkout are unchanged.

References: [Android website associations](https://developer.android.com/training/app-links/configure-assetlinks) and [verification](https://developer.android.com/training/app-links/verify-applinks).
