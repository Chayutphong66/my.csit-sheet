import crypto from 'node:crypto'
import { config } from '../config/environment.js'
import { db } from '../data/databaseClient.js'
import { renderEmail } from './emailTemplates.service.js'
import { logServerError } from './safeLogger.service.js'

let transporter
export function emailMode(configuration = config) {
  if (configuration.smtpHost && configuration.smtpUser && configuration.smtpPass) return 'smtp'
  return configuration.production ? 'unavailable' : 'mock'
}

export async function sendEmail({ userId = null, to, template, data }, configuration = config) {
  const mode = emailMode(configuration)
  let status = mode === 'mock' ? 'MOCKED' : mode === 'unavailable' ? 'UNAVAILABLE' : 'FAILED'
  let providerMessageId = null
  try {
    if (mode === 'smtp') {
      const { default: nodemailer } = await import('nodemailer')
      transporter ||= nodemailer.createTransport({ host: configuration.smtpHost, port: configuration.smtpPort, secure: configuration.smtpSecure, auth: { user: configuration.smtpUser, pass: configuration.smtpPass } })
      const rendered = renderEmail(template, data)
      const result = await transporter.sendMail({ from: configuration.mailFrom, to, ...rendered })
      status = 'SENT'; providerMessageId = result.messageId || null
    } else if (mode === 'mock') {
      renderEmail(template, data)
    }
  } catch (error) {
    status = 'FAILED'
    logServerError('email.delivery_failed', error, { template, mode })
  }
  await db.prepare('INSERT INTO email_deliveries(id,user_id,template,recipient,status,provider_message_id) VALUES(?,?,?,?,?,?)')
    .run(crypto.randomUUID(), userId, template, String(to).toLowerCase(), status, providerMessageId)
  return { status, delivered: status === 'SENT', simulated: status === 'MOCKED' }
}
