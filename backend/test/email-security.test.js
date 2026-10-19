import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.STORAGE_DRIVER = 'database'
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'csit-email-security-')), 'fixture.sqlite')

const { closeDatabase, db } = await import('../src/data/databaseClient.js')
const { normalizeSupportedMailbox } = await import('../src/services/emailAddress.service.js')
const { sendEmail, smtpTransportOptions } = await import('../src/services/email.service.js')

test.after(async () => closeDatabase())

const smtp = {
  production: true,
  smtpHost: 'smtp.example.test',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: 'mailer@example.test',
  smtpPass: 'fixture-only-password',
  mailFrom: 'CSIT Sheet <mailer@example.test>'
}

test('shared mailbox policy normalizes supported addresses and rejects parser-sensitive shapes', () => {
  assert.equal(normalizeSupportedMailbox('  Member.Name+tag@Example.Test  '), 'member.name+tag@example.test')
  for (const value of [
    'ผู้ใช้@example.test',
    '"member"@example.test',
    'member..name@example.test',
    '.member@example.test',
    'member@example.test\r\nBcc: attacker@example.test',
    'member@example.test,attacker@example.test',
    ['member@example.test'],
    { address: 'member@example.test' }
  ]) {
    assert.throws(() => normalizeSupportedMailbox(value), /not supported/)
  }
})

test('SMTP transport requires encryption and disables file and URL content access', () => {
  assert.deepEqual(smtpTransportOptions(smtp), {
    host: 'smtp.example.test',
    port: 587,
    secure: false,
    requireTLS: true,
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: { user: 'mailer@example.test', pass: 'fixture-only-password' }
  })
  assert.throws(() => smtpTransportOptions({ ...smtp, smtpHost: 'smtp.example.test\r\nX-Injected: yes' }), /SMTP host is invalid/)
})

test('SMTP delivery uses a fixed sender and a closed message shape', async () => {
  let transportOptions
  let message
  const result = await sendEmail({
    to: ' Member@Example.Test ',
    template: 'security',
    data: { message: '<script>alert(1)</script>\r\nBcc: attacker@example.test' },
    attachments: [{ path: '/private/file' }],
    raw: 'malicious raw message'
  }, smtp, {
    createTransport(options) {
      transportOptions = options
      return { sendMail: async value => { message = value; return { messageId: 'fixture-message-id' } } }
    }
  })

  assert.equal(result.status, 'SENT')
  assert.equal(message.from, smtp.mailFrom)
  assert.equal(message.to, 'member@example.test')
  assert.deepEqual(Object.keys(message).sort(), ['from', 'html', 'subject', 'text', 'to'])
  assert.equal('attachments' in message, false)
  assert.equal('raw' in message, false)
  assert.equal('envelope' in message, false)
  assert.match(message.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.deepEqual(transportOptions, smtpTransportOptions(smtp))
})

test('invalid or structured recipients never reach the SMTP transport', async () => {
  const recipients = [
    'victim@example.test\r\nBcc: attacker@example.test',
    'victim@example.test(comment)',
    '"victim"@example.test',
    'victim@example.test,attacker@example.test',
    ['victim@example.test', 'attacker@example.test'],
    { address: 'victim@example.test' },
    `${'a'.repeat(245)}@example.test`
  ]

  for (const to of recipients) {
    let transportCreated = false
    const result = await sendEmail({ to, template: 'passwordChanged', data: {} }, smtp, {
      createTransport() {
        transportCreated = true
        return { sendMail: async () => ({ messageId: 'must-not-send' }) }
      }
    })
    assert.equal(result.status, 'FAILED')
    assert.equal(transportCreated, false)
  }
})

test('mock delivery applies the same recipient policy as SMTP and preserves a failed audit record', async () => {
  const result = await sendEmail({
    to: 'legacy(comment)@example.test', template: 'passwordChanged', data: {}
  }, { ...smtp, production: false, smtpHost: '', smtpUser: '', smtpPass: '' })

  assert.equal(result.status, 'FAILED')
  const delivery = await db.prepare("SELECT recipient,status FROM email_deliveries WHERE recipient='[invalid-recipient]' ORDER BY created_at DESC LIMIT 1").get()
  assert.equal(delivery.recipient, '[invalid-recipient]')
  assert.equal(delivery.status, 'FAILED')
})

test('invalid configured sender fails closed without exposing the SMTP secret', async () => {
  let transportCreated = false
  const result = await sendEmail({
    to: 'sender-failure@example.test', template: 'passwordChanged', data: {}
  }, { ...smtp, mailFrom: 'CSIT Sheet <mailer@example.test>\r\nBcc: attacker@example.test' }, {
    createTransport() {
      transportCreated = true
      return { sendMail: async () => ({ messageId: 'must-not-send' }) }
    }
  })

  assert.equal(result.status, 'FAILED')
  assert.equal(transportCreated, false)
  const delivery = await db.prepare("SELECT status,provider_message_id FROM email_deliveries WHERE recipient='sender-failure@example.test' LIMIT 1").get()
  assert.equal(delivery.status, 'FAILED')
  assert.equal(delivery.provider_message_id, null)
})
