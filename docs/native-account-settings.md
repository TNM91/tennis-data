# Native account settings

Account settings keeps Done and Log out in a fixed toolbar while the content scrolls. Your tools, Apple membership, saved sign-in and account controls have section shortcuts; unavailable platform sections are omitted. Shortcuts focus the section itself so asynchronous content updates do not remove its focus target.

The sheet uses the native navy tokens, consistent panel spacing, scalable text and compact action rows. Account deletion retains its separate confirmation flow. Face ID remains an optional saved sign-in; opening or returning to the app does not add a biometric lock.

Both the header and More entry pass their actual opener to the dialog. Closing returns focus to that button, including Safari where tapping a button does not necessarily focus it. Account load failures focus a readable error and keep Retry, Done and Log out available. Existing ownership checks, logout cleanup, purchase/restore behavior and deletion safeguards are retained.

Verification covers Chromium and WebKit at 320px and 390px, enlarged root text, persistent controls after scrolling, section focus, child-pane return, load-error retry, logout failures and late responses. iOS membership and saved-sign-in panels use a synthetic native bridge with no live purchases or account mutations. The production native bundle is checked separately with isolated account responses. Physical iPhone, Face ID and VoiceOver acceptance remain separate from browser checks.
