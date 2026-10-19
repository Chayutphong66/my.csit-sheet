import crypto from 'node:crypto'
import { config } from '../config/environment.js'
import { db } from '../data/databaseClient.js'
import { normalizeSupportedMailbox } from './emailAddress.service.js'
import { renderEmail } from './emailTemplates.service.js'
import { logServerError } from './safeLogger.service.js'

let transporter

function safeHeader(value, name) {
  const header = String(value ?? '').trim()
  if (!header || /[\r\n]/.test(header)) throw new Error(`${name} is invalid`)
  return header
}

export function smtpTransportOptions(configuration = config) {
  return {
    host: safeHeader(configuration.smtpHost, 'SMTP host'),
    port: configuration.smtpPort,
    secure: configuration.smtpSecure,
    requireTLS: !configuration.smtpSecure,
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: { user: configuration.smtpUser, pass: configuration.smtpPass }
  }
}

export function emailMode(configuration = config) {
  if (configuration.smtpHost && configuration.smtpUser && configuration.smtpPass) return 'smtp'
  return configuration.production ? 'unavailable' : 'mock'
}

export async function sendEmail({ userId = null, to, template, data }, configuration = config, dependencies = {}) {
  const mode = emailMode(configuration)
  let status = mode === 'mock' ? 'MOCKED' : mode === 'unavailable' ? 'UNAVAILABLE' : 'FAILED'
  let providerMessageId = null
  let recipient = '[invalid-recipient]'
  try {
    recipient = normalizeSupportedMailbox(to)
    if (mode === 'smtp') {
      const rendered = renderEmail(template, data)
      const message = {
        from: safeHeader(configuration.mailFrom, 'Mail sender'),
        to: recipient,
        subject: safeHeader(rendered.subject, 'Mail subject'),
        html: rendered.html,
        text: rendered.text
      }
      const { default: nodemailer } = await import('nodemailer')
      const createTransport = dependencies.createTransport || nodemailer.createTransport
      const activeTransport = dependencies.createTransport
        ? createTransport(smtpTransportOptions(configuration))
        : (transporter ||= createTransport(smtpTransportOptions(configuration)))
      const result = await activeTransport.sendMail(message)
      status = 'SENT'; providerMessageId = result.messageId || null
    } else if (mode === 'mock') {
      renderEmail(template, data)
    }
  } catch (error) {
    status = 'FAILED'
    logServerError('email.delivery_failed', error, { template, mode })
  }
  await db.prepare('INSERT INTO email_deliveries(id,user_id,template,recipient,status,provider_message_id) VALUES(?,?,?,?,?,?)')
    .run(crypto.randomUUID(), userId, template, recipient, status, providerMessageId)
  return { status, delivered: status === 'SENT', simulated: status === 'MOCKED' }
}
