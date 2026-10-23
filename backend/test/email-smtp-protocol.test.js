import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import nodemailer from 'nodemailer'
import { SMTPServer } from 'smtp-server'

process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.STORAGE_DRIVER = 'database'
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'csit-smtp-protocol-')), 'fixture.sqlite')

const { closeDatabase, db } = await import('../src/data/databaseClient.js')
const { sendEmail } = await import('../src/services/email.service.js')

const HOST = '127.0.0.1'
const USER = 'smtp-fixture@example.test'
const PASS = 'smtp-fixture-password'
const TOKEN = 'fixture-auth-token-never-log'
const BODY_SECRET = 'fixture-message-body-never-log'

function findOpenSslExecutable() {
  const candidates = [
    process.env.OPENSSL_EXECUTABLE,
    'openssl',
    ...(process.platform === 'win32'
      ? [
          'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
          'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe'
        ]
      : [])
  ].filter(Boolean)

  for (const candidate of [...new Set(candidates)]) {
    const probe = spawnSync(candidate, ['version'], {
      encoding: 'utf8',
      windowsHide: true
    })

    if (!probe.error && probe.status === 0) return candidate
  }

  throw new Error(
    'SMTP protocol tests require OpenSSL to generate disposable TLS credentials. ' +
      'Install OpenSSL or set OPENSSL_EXECUTABLE to its executable path.'
  )
}

function createLocalTlsFixture({ readFile = readFileSync } = {}) {
  const openSslExecutable = findOpenSslExecutable()
  const directory = mkdtempSync(path.join(tmpdir(), 'csit-smtp-tls-'))
  const certificatePath = path.join(directory, 'localhost-cert.pem')
  const privateKeyPath = path.join(directory, 'localhost-key.pem')
  try {
    const generation = spawnSync(
      openSslExecutable,
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-sha256',
        '-nodes',
        '-days',
        '2',
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1,DNS:localhost',
        '-keyout',
        privateKeyPath,
        '-out',
        certificatePath
      ],
      {
        encoding: 'utf8',
        windowsHide: true
      }
    )

    if (generation.error) throw generation.error
    if (generation.status !== 0) {
      const detail = generation.stderr?.trim()
      throw new Error(
        `OpenSSL failed to generate disposable localhost TLS credentials${detail ? `: ${detail}` : ''}`
      )
    }

    return {
      directory,
      certificate: readFile(certificatePath),
      privateKey: readFile(privateKeyPath)
    }
  } catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
}

const tlsFixture = createLocalTlsFixture()
const certificate = tlsFixture.certificate
const privateKey = tlsFixture.privateKey

process.env.SMTP_PASS = PASS

test.after(async () => {
  try {
    await closeDatabase()
  } finally {
    rmSync(tlsFixture.directory, { recursive: true, force: true })
  }
})

function configuration(port, secure, overrides = {}) {
  return {
    production: true,
    smtpHost: HOST,
    smtpPort: port,
    smtpSecure: secure,
    smtpUser: USER,
    smtpPass: PASS,
    mailFrom: 'CSIT Sheet <mailer@example.test>',
    ...overrides
  }
}

function realTransport({ trustCertificate = true, timeouts = {} } = {}) {
  return options => nodemailer.createTransport({
    ...options,
    connectionTimeout: 1_000,
    greetingTimeout: 1_000,
    socketTimeout: 2_000,
    ...timeouts,
    tls: trustCertificate
      ? { ca: certificate, minVersion: 'TLSv1.2' }
      : { minVersion: 'TLSv1.2' }
  })
}

test('TLS fixture cleanup removes generated credentials when certificate loading fails', () => {
  const readFailure = new Error('synthetic TLS fixture read failure')
  let generatedDirectory

  assert.throws(
    () => createLocalTlsFixture({
      readFile(filePath) {
        generatedDirectory = path.dirname(filePath)
        throw readFailure
      }
    }),
    error => error === readFailure
  )
  assert.ok(generatedDirectory)
  assert.equal(existsSync(generatedDirectory), false)
})

async function startSmtpServer(options = {}) {
  const deliveries = []
  const server = new SMTPServer({
    name: 'localhost',
    banner: 'CSIT local SMTP protocol fixture',
    secure: false,
    key: privateKey,
    cert: certificate,
    logger: false,
    onAuth(auth, session, callback) {
      if (auth.username !== USER || auth.password !== PASS) {
        const error = new Error('Authentication rejected')
        error.responseCode = 535
        callback(error)
        return
      }
      callback(null, { user: auth.username })
    },
    onData(stream, session, callback) {
      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('error', callback)
      stream.on('end', () => {
        deliveries.push({
          envelope: session.envelope,
          secure: session.secure,
          message: Buffer.concat(chunks).toString('utf8')
        })
        callback(null, 'queued as csit-local-fixture')
      })
    },
    ...options
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, HOST, resolve)
  })
  const address = server.server.address()
  return {
    port: address.port,
    deliveries,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}

async function deliveryFor(recipient) {
  return db.prepare('SELECT template,recipient,status,provider_message_id FROM email_deliveries WHERE recipient=? ORDER BY created_at DESC LIMIT 1').get(recipient)
}

async function send(recipient, smtpConfiguration, transport = realTransport(), extra = {}) {
  return sendEmail({
    to: recipient,
    template: 'security',
    data: { message: BODY_SECRET },
    ...extra
  }, smtpConfiguration, { createTransport: transport })
}

test('implicit TLS performs authenticated delivery, preserves the closed message shape, and audits the provider message ID', async () => {
  const fixture = await startSmtpServer({ secure: true })
  const recipient = 'implicit-tls@example.test'
  try {
    const result = await send(recipient, configuration(fixture.port, true), realTransport(), {
      attachments: [{ path: 'C:\\private\\must-not-be-read.txt' }],
      raw: 'must-not-be-forwarded',
      envelope: { to: 'attacker@example.test' }
    })

    assert.deepEqual(result, { status: 'SENT', delivered: true, simulated: false })
    assert.equal(fixture.deliveries.length, 1)
    const received = fixture.deliveries[0]
    assert.equal(received.secure, true)
    assert.equal(received.envelope.mailFrom.address, 'mailer@example.test')
    assert.deepEqual(received.envelope.rcptTo.map(item => item.address), [recipient])
    assert.match(received.message, /Message-ID: <[^>]+>/i)
    assert.match(received.message, new RegExp(BODY_SECRET, 'i'))
    assert.doesNotMatch(received.message, /must-not-be-read|must-not-be-forwarded|attacker@example\.test/i)

    const messageId = received.message.match(/Message-ID: (<[^>]+>)/i)?.[1]
    const audit = await deliveryFor(recipient)
    assert.equal(audit.template, 'security')
    assert.equal(audit.recipient, recipient)
    assert.equal(audit.status, 'SENT')
    assert.equal(audit.provider_message_id, messageId)
  } finally {
    await fixture.close()
  }
})

test('STARTTLS with requireTLS upgrades the loopback connection before authenticated delivery', async () => {
  const fixture = await startSmtpServer()
  const recipient = 'starttls@example.test'
  try {
    const result = await send(recipient, configuration(fixture.port, false))
    assert.equal(result.status, 'SENT')
    assert.equal(fixture.deliveries.length, 1)
    assert.equal(fixture.deliveries[0].secure, true)
  } finally {
    await fixture.close()
  }
})

test('requireTLS rejects a server that does not advertise STARTTLS without plaintext delivery', async () => {
  const fixture = await startSmtpServer({ disabledCommands: ['STARTTLS'] })
  const recipient = 'starttls-required@example.test'
  try {
    const result = await send(recipient, configuration(fixture.port, false))
    assert.equal(result.status, 'FAILED')
    assert.equal(fixture.deliveries.length, 0)
    assert.equal((await deliveryFor(recipient)).status, 'FAILED')
  } finally {
    await fixture.close()
  }
})

test('an untrusted certificate fails closed while certificate verification remains enabled', async () => {
  const fixture = await startSmtpServer({ secure: true })
  const recipient = 'untrusted-certificate@example.test'
  try {
    const result = await send(recipient, configuration(fixture.port, true), realTransport({ trustCertificate: false }))
    assert.equal(result.status, 'FAILED')
    assert.equal(fixture.deliveries.length, 0)
    assert.equal((await deliveryFor(recipient)).provider_message_id, null)
  } finally {
    await fixture.close()
  }
})

test('authentication failure is audited without disclosing credentials, tokens, or message bodies', async () => {
  const fixture = await startSmtpServer({ secure: true })
  const recipient = 'auth-failure@example.test'
  const logs = []
  const originalError = console.error
  console.error = (...values) => logs.push(values.join(' '))
  try {
    const result = await send(recipient, configuration(fixture.port, true, { smtpPass: `${PASS}-wrong` }), realTransport(), {
      authenticationToken: TOKEN
    })
    assert.deepEqual(result, { status: 'FAILED', delivered: false, simulated: false })
    assert.equal(fixture.deliveries.length, 0)
    const output = logs.join('\n')
    assert.doesNotMatch(output, new RegExp(USER.replace('.', '\\.')))
    assert.doesNotMatch(output, new RegExp(PASS))
    assert.doesNotMatch(output, new RegExp(TOKEN))
    assert.doesNotMatch(output, new RegExp(BODY_SECRET))
    assert.equal((await deliveryFor(recipient)).status, 'FAILED')
  } finally {
    console.error = originalError
    await fixture.close()
  }
})

test('unavailable SMTP outcomes fail safely within bounded timeouts', async t => {
  await t.test('connection refused', async () => {
    const reservation = net.createServer()
    await new Promise((resolve, reject) => reservation.listen(0, HOST, error => error ? reject(error) : resolve()))
    const port = reservation.address().port
    await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()))
    const result = await send('connection-refused@example.test', configuration(port, false))
    assert.equal(result.status, 'FAILED')
  })

  await t.test('greeting timeout', async () => {
    const sockets = new Set()
    const silentServer = net.createServer(socket => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })
    await new Promise((resolve, reject) => silentServer.listen(0, HOST, error => error ? reject(error) : resolve()))
    try {
      const result = await send(
        'connection-timeout@example.test',
        configuration(silentServer.address().port, false),
        realTransport({ timeouts: { connectionTimeout: 250, greetingTimeout: 250, socketTimeout: 500 } })
      )
      assert.equal(result.status, 'FAILED')
    } finally {
      for (const socket of sockets) socket.destroy()
      await new Promise((resolve, reject) => silentServer.close(error => error ? reject(error) : resolve()))
    }
  })

  await t.test('SMTP service unavailable', async () => {
    const fixture = await startSmtpServer({
      onConnect(session, callback) {
        const error = new Error('Service unavailable')
        error.responseCode = 421
        callback(error)
      }
    })
    try {
      const result = await send('service-unavailable@example.test', configuration(fixture.port, false))
      assert.equal(result.status, 'FAILED')
      assert.equal(fixture.deliveries.length, 0)
    } finally {
      await fixture.close()
    }
  })
})

test('delivery audit schema stores status and provider ID but no SMTP credentials or message bodies', async () => {
  const columns = await db.prepare('PRAGMA table_info(email_deliveries)').all()
  assert.deepEqual(columns.map(column => column.name), [
    'id', 'user_id', 'template', 'recipient', 'status', 'provider_message_id', 'created_at'
  ])
  const serialized = JSON.stringify(await db.prepare('SELECT * FROM email_deliveries').all())
  assert.doesNotMatch(serialized, new RegExp(USER.replace('.', '\\.')))
  assert.doesNotMatch(serialized, new RegExp(PASS))
  assert.doesNotMatch(serialized, new RegExp(TOKEN))
  assert.doesNotMatch(serialized, new RegExp(BODY_SECRET))
})
