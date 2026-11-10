import { CONTACT_EMAILS } from './contact-details'

export const OFFLINE_IOS_PRIVACY_PARAGRAPHS = [
  'The offline edition of TenAceIQ saves the date, format, result, and optional set scores for the matches you enter. It also saves the date and elapsed time of your latest saved session for each drill.',
  'The app uses these records on your device to show your latest practice and recent match form. TenAceIQ receives no match or practice records from the offline edition.',
  `To remove these records from this device, delete the app. For privacy or support questions, email ${CONTACT_EMAILS.support}.`,
] as const
