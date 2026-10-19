export const PRIVACY_NOTICE_VERSION = '2026-10-19.1'
export const PRIVACY_NOTICE_KEY = 'csit-sheet:privacy-notice'

export function readPrivacyAcknowledgement(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(PRIVACY_NOTICE_KEY) || 'null')
    return value?.version === PRIVACY_NOTICE_VERSION ? value : null
  } catch { return null }
}

export function acknowledgePrivacyNotice(storage = globalThis.localStorage) {
  const acknowledgement = { version: PRIVACY_NOTICE_VERSION, acknowledgedAt: new Date().toISOString() }
  try { storage.setItem(PRIVACY_NOTICE_KEY, JSON.stringify(acknowledgement)) } catch { /* Browsing remains available when storage is disabled. */ }
  return acknowledgement
}
