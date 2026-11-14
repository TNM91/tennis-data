# Native league and tournament feedback

League and tournament requests use the same navy feedback panels and approved feature icons. Loading previews are decorative and hidden from assistive technology. Load failures focus an alert with an explicit Try again button; retry preserves the selected league, tournament or division. Existing data is cleared during loading and remains absent after a failed request.

Empty searches name the submitted query and offer Clear search. Clearing makes one explicit request and retains the current league browsing scope or tournament directory. Empty connected league entries still offer Browse leagues, and unpublished tournament divisions remain a distinct organizer-publication state.

There is no automatic retry, polling change, result inference, registration change or backend migration. Responses still pass the existing owner and request-version checks. Browser verification covers loading, retry, search clearing, stale data, delayed replies, account changes, keyboard focus and large text at 320px and 390px in Chromium and WebKit. Production-bundle checks use isolated synthetic data; physical iPhone and VoiceOver acceptance remain separate.
