/** Shared factual help for the bundled app and public account-deletion explanation. */
export const ACCOUNT_HELP_LINKS = {
  privacy: 'https://www.tenaceiq.com/legal/privacy',
  terms: 'https://www.tenaceiq.com/legal/terms',
  support: 'https://www.tenaceiq.com/contact',
} as const

export const ACCOUNT_DELETION_SUMMARY = 'Open Account → Delete account. Verify your identity, review the consequences, and confirm permanent deletion. Cleanup runs automatically within seven days, and we email you when it is complete. Your account and associated private data and files are removed; you are signed out as processing begins.'

export const ACCOUNT_PRIVACY_SECTIONS = [
  {
    title: 'Your tennis account',
    body: 'Your email and account profile let you sign in, connect your player record, and use the tools available to your account. The iPhone app uses secure device storage for your sign-in session.',
  },
  {
    title: 'What you share',
    body: 'Messages, photos, GIFs, reactions, polls, availability, and practice responses are used for team communication. People with access to the conversation or team can see what you share. Data Assist files and photos are processed to prepare and review tennis imports.',
  },
  {
    title: 'Photos and team alerts',
    body: 'You choose when to use your camera, select a photo or GIF, or paste a GIF. Team alerts are optional. Alert delivery uses your device token and an installation identifier linked to your account. You can turn team alerts off in My Lab and change camera, photo, or notification permissions in iPhone Settings.',
  },
  {
    title: 'Delete your account',
    body: ACCOUNT_DELETION_SUMMARY,
  },
] as const

export const ACCOUNT_DELETION_DETAILS = [
  'Existing TenAceIQ web subscriptions are canceled during deletion. Deletion does not issue a refund. Any Apple subscription must be canceled in your Apple subscription settings.',
  'Independent public tennis records and shared team structures may remain. Shared records can retain their structure after the deleted account’s author reference is removed.',
  'We keep a minimal deletion receipt, timestamps, and a hashed account reference for audit and recovery checks. Required legal or financial records may also be retained. The completed deletion queue clears the account ID, email, and billing pointers.',
] as const

export const ACCOUNT_BACKUP_RETENTION = 'Restricted backup copies may retain database information after it has been removed from the active service, until those copies expire under the service provider’s retention settings. Database backups include file metadata, not the uploaded file contents. Backup retention is separate from the seven-day active-account deletion process.'
