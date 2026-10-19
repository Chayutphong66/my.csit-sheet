const LOCAL_ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
const LOCAL_PART = new RegExp(`^${LOCAL_ATOM}(?:\\.${LOCAL_ATOM})*$`)
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/

export function normalizeSupportedMailbox(value) {
  if (typeof value !== 'string') throw new Error('Email address is not supported')

  const mailbox = value.trim().toLowerCase()
  if (!mailbox || mailbox.length > 255 || /[\r\n]/.test(mailbox)) {
    throw new Error('Email address is not supported')
  }

  const parts = mailbox.split('@')
  if (parts.length !== 2) throw new Error('Email address is not supported')

  const [local, domain] = parts
  const labels = domain.split('.')
  if (local.length > 64 || !LOCAL_PART.test(local) || domain.length > 253 || labels.length < 2 || labels.some(label => !DOMAIN_LABEL.test(label))) {
    throw new Error('Email address is not supported')
  }

  return mailbox
}
