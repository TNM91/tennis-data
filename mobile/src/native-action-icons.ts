import websiteUi from '../generated/website-ui.json'
/** Build-time Phosphor icons; no React renderer is shipped for these controls. */
export function nativeActionIcon(name:keyof typeof websiteUi.actionIcons){return websiteUi.actionIcons[name]}
