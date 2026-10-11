// Standalone headless QA. Uses only an isolated DB/profile and Node built-ins.
// Run after npm run build. BROWSER_EXECUTABLE can override the Edge executable.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import https from 'node:https'
import { setTimeout as delay } from 'node:timers/promises'

const browserPath = process.env.BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
assert.ok(existsSync(browserPath), 'Set BROWSER_EXECUTABLE to a Chromium browser executable')
assert.ok(existsSync('frontend/dist/index.html'), 'Run npm run build first')
const isolated = mkdtempSync(path.join(tmpdir(), 'csit-visual-'))
const openssl = process.env.OPENSSL_EXECUTABLE || 'C:/Program Files/Git/usr/bin/openssl.exe'
assert.ok(existsSync(openssl), 'Set OPENSSL_EXECUTABLE for the isolated HTTPS fixture')
const keyPath = path.join(isolated, 'key.pem')
const certPath = path.join(isolated, 'cert.pem')
const certificate = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { windowsHide: true, encoding: 'utf8' })
assert.equal(certificate.status, 0, certificate.stderr)
const output = path.resolve('artifacts/visual-qa')
mkdirSync(output, { recursive: true })
const expectedCohorts = ['', ...Array.from({ length: new Date().getFullYear() + 543 - 2566 + 1 }, (_, index) => String((2566 + index) % 100).padStart(2, '0'))]
process.env.NODE_ENV = 'test'
process.env.DATABASE_DRIVER = 'sqlite'
process.env.STORAGE_DRIVER = 'database'
process.env.SKIP_DB_SEED = '1'
process.env.JWT_SECRET = 'isolated-visual-qa-secret-never-used-for-production'
process.env.DATABASE_PATH = path.join(isolated, 'qa.sqlite')
for (let run = 0; run < 2; run++) {
  const result = spawnSync(process.execPath, ['backend/src/data/migrate.js'], { env: process.env, encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, result.stderr)
}
const { db } = await import('../backend/src/data/database.js')
const { hashPassword } = await import('../backend/src/services/password.service.js')
const longName = 'ผู้แบ่งปันความรู้และความเข้าใจในรายวิชาคอมพิวเตอร์ '.repeat(3).trim()
const insert = db.prepare('INSERT INTO users (id, username, display_name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)')
for (const [username, role] of [['user1', 'USER'], ['user2', 'USER'], ['admin1', 'ADMIN']]) {
  insert.run(username, username, username === 'user1' ? longName : username, `${username}@example.test`, hashPassword('Test@1234'), role)
}
db.prepare("UPDATE users SET program_code='CS', cohort='66' WHERE id='user1'").run()
db.prepare('INSERT INTO courses (id, name, code, description) VALUES (?, ?, ?, ?)').run('qa-course', 'Software Engineering และการพัฒนาระบบที่ใช้งานได้จริง '.repeat(3), 'CS270', 'Isolated QA fixture')
db.prepare("INSERT INTO program_courses(program_id,course_id) VALUES('program-cs','qa-course')").run()
db.prepare('INSERT INTO instructors (id, name) VALUES (?, ?)').run('qa-instructor', 'QA Teacher')
db.prepare("UPDATE instructors SET normalized_name='qa teacher',active=1 WHERE id='qa-instructor'").run()
db.prepare("INSERT INTO course_offerings(id,course_id,academic_year,semester,section) VALUES('qa-offering','qa-course','2569','1','')").run()
db.prepare("INSERT INTO course_offering_teachers(offering_id,teacher_id) VALUES('qa-offering','qa-instructor')").run()
db.prepare("INSERT INTO course_offering_programs(offering_id,program_id) VALUES('qa-offering','program-cs')").run()
let app
const frontendRoot = path.resolve('frontend/dist')
const server = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, (req, res) => {
  const pathname = new URL(req.url, 'https://127.0.0.1').pathname
  if (pathname.startsWith('/api/blob/')) {
    const [, , , kind, id, action] = pathname.split('/')
    if (kind === 'request') req.url = `/api/admin/upload-requests/${encodeURIComponent(id)}/file`
    else if (kind === 'version') req.url = `/api/admin/revisions/${encodeURIComponent(id)}/file`
    else req.url = `/api/documents/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/${encodeURIComponent(action)}`
    return app(req, res)
  }
  if (pathname.startsWith('/api/')) return app(req, res)
  if (pathname.startsWith('/assets/')) {
    const asset = path.resolve(frontendRoot, pathname.slice(1))
    if (asset.startsWith(`${path.join(frontendRoot, 'assets')}${path.sep}`) && existsSync(asset)) {
      res.setHeader('Content-Type', asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      return res.end(readFileSync(asset))
    }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(readFileSync(path.join(frontendRoot, 'index.html')))
}).listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const origin = `https://127.0.0.1:${server.address().port}`
process.env.ALLOWED_ORIGINS = origin
;({ default: app } = await import('../backend/src/app.js'))
const { createRefreshToken } = await import('../backend/src/services/token.service.js')
const { findContributorByUsername } = await import('../backend/src/repositories/contributor.repository.js')
let browserProcess
let socket
let cdp
let freshNavigation = true
let visualDocumentId = ''
let visualCollectionId = ''
let visualCollectionSlug = ''
const report = { migration: 'PASS (twice)', screenshots: [], checks: [], errors: [] }
const browserDiagnostics = []

async function api(route, token, body, method = 'GET') {
  const response = await new Promise((resolve, reject) => {
    const request = https.request(`${origin}/api${route}`, { method, ca: readFileSync(certPath), headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'content-type': 'application/json' } : {})
    } }, (res) => {
      let text = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { text += chunk });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    })
    request.on('error', reject); request.end(body ? JSON.stringify(body) : undefined)
  })
  const data = JSON.parse(response.text)
  assert.ok(response.status >= 200 && response.status < 300, `${route}: ${JSON.stringify(data)}`)
  return { data, cookie: response.headers['set-cookie']?.[0] }
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function waitFor(expression) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    try { if (await evaluate(expression)) return } catch { /* navigation replaces context */ }
    await delay(100)
  }
  throw new Error(`Browser condition timed out: ${expression}`)
}
async function navigate(route) {
  if (freshNavigation) {
    await cdp('Page.navigate', { url: `${origin}${route}` }); freshNavigation = false
  } else {
    await evaluate(`(() => { history.pushState({...history.state}, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate', {state: history.state})); })()`)
  }
  await waitFor(`location.pathname === ${JSON.stringify(route.split(/[?#]/)[0])} && document.readyState === 'complete' && !!document.querySelector('main') && !document.querySelector('.loading-state')`)
  await evaluate('document.fonts.ready')
  await delay(250)
}
async function capture(name, width) {
  await delay(300)
  const overflow = await evaluate(`(() => {
    return [...document.querySelectorAll('main *')].filter(e => {
      if (e.closest('.topic-strip, .sr-only, .table-wrap, .document-profile__graph-scroll, .document-profile__tabs')) return false;
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (r.right > innerWidth + 2 || r.left < -2);
    }).slice(0, 12).map(e => ({tag: e.tagName, class: e.className}));
  })()`)
  report.checks.push({ name, width, overflow })
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const file = `${name}-${width}.png`
  writeFileSync(path.join(output, file), Buffer.from(shot.data, 'base64'))
  report.screenshots.push(file)
  if (name === 'starter' || name === 'review' || name === 'documents' || name === 'version-detail') {
    const selector = name === 'starter' ? '.share-section' : name === 'review' ? '.duplicate-comparison' : name === 'version-detail' ? '.version-history' : '.semester-section'
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'start', behavior:'instant'})`)
    await delay(name === 'starter' ? 700 : 300)
    const detail = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const detailFile = `${name}-detail-${width}.png`
    writeFileSync(path.join(output, detailFile), Buffer.from(detail.data, 'base64'))
    report.screenshots.push(detailFile)
    await evaluate(`scrollTo({top:0, behavior:'instant'})`)
  }
  console.log(`Captured ${file}; overflow=${overflow.length}`)
}
async function actor(username) {
  await cdp('Network.clearBrowserCookies')
  // Fixture session; real login/refresh behaviour is exercised by backend tests.
  const value = await createRefreshToken({ id: username })
  await cdp('Network.setCookie', { name: 'refreshToken', value, url: `${origin}/api/auth`, path: '/api/auth', httpOnly: true, secure: true, sameSite: 'Strict' })
  freshNavigation = true
}

async function runBrowserLifecycle() {
  const title = 'Browser E2E Sheet'
  const filename = path.join(isolated, 'browser-e2e-sheet.txt')
  writeFileSync(filename, 'Unique browser three-actor knowledge sharing test material')
  await actor('user1'); await navigate('/dashboard/upload')
  await waitFor(`document.querySelector('select')?.options.length > 1`)
  const document = await cdp('DOM.getDocument')
  const fileInput = await cdp('DOM.querySelector', { nodeId: document.root.nodeId, selector: 'input[type=file]' })
  await cdp('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [filename] })
  await waitFor(`!!document.querySelector('.upload-file')`)
  await evaluate(`(() => {
    const form = document.querySelector('form');
    const selects = [...form.querySelectorAll('select')];
    const titleInput = form.querySelector('input[placeholder*="Algorithm"]'); titleInput.value = ${JSON.stringify(title)}; titleInput.dispatchEvent(new Event('input', {bubbles:true}));
    for (const [input, value] of [[selects[0], 'program-cs'], [selects[1], '2569'], [selects[2], '1'], [selects[3], 'Sheet']]) { input.value = value; input.dispatchEvent(new Event('change', {bubbles:true})); }
  })()`)
  await waitFor(`!document.querySelector('#course-code').disabled`)
  await evaluate(`(() => { const courseInput=document.querySelector('#course-code');courseInput.value='CS270';courseInput.dispatchEvent(new Event('input',{bubbles:true})); })()`)
  await waitFor(`!!document.querySelector('.course-suggestions [role=option]')`)
  await evaluate(`document.querySelector('.course-suggestions [role=option]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await waitFor(`!!document.querySelector('.teacher-field input[value=qa-instructor]')`)
  await evaluate(`document.querySelector('.teacher-field input[value=qa-instructor]').click()`)
  await evaluate(`document.querySelector('form').requestSubmit()`)
  await waitFor(`!![...document.querySelectorAll('.request-card')].find(e => e.textContent.includes(${JSON.stringify(title)}))`)
  const request = db.prepare('SELECT id, status FROM upload_requests WHERE title = ?').get(title)
  assert.equal(request.status, 'PENDING')
  await capture('e2e-pending', 1440)
  await actor('user2'); await navigate('/dashboard/search')
  const searchTitle = async () => {
    await evaluate(`(() => { const input = document.querySelector('input[type=search]'); input.value = ${JSON.stringify(title)}; input.dispatchEvent(new Event('input', {bubbles:true})); input.form.requestSubmit(); })()`)
    await waitFor(`!!document.querySelector('.search-section') && !document.querySelector('.loading-state')`)
  }
  await searchTitle()
  assert.equal(await evaluate(`document.querySelectorAll('.document-card').length`), 0)
  await capture('e2e-private', 1440)
  await actor('admin1'); await navigate('/admin/request')
  await evaluate(`([...document.querySelectorAll('.review-queue-card')].find(e => e.textContent.includes(${JSON.stringify(title)}))).querySelector('button').click()`)
  await waitFor(`document.querySelector('iframe')?.src.startsWith('blob:')`)
  assert.equal(await evaluate(`fetch(document.querySelector('iframe').src).then(response => response.text())`), 'Unique browser three-actor knowledge sharing test material')
  await evaluate(`(() => { const button = document.querySelector('[data-review-action="approve"]'); button.focus(); button.click(); })()`)
  await waitFor(`!!document.querySelector('[role=alertdialog]')`)
  await evaluate(`document.querySelector('[role=alertdialog] [data-dialog-action="confirm"]').click()`)
  await waitFor(`!!document.querySelector('[role=status]') && !document.querySelector('[role=alertdialog]') && !document.querySelector('.loading-state')`)
  assert.equal(db.prepare('SELECT status FROM upload_requests WHERE id = ?').get(request.id).status, 'COMPLETED')
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sheets WHERE source_request_id = ?').get(request.id).count, 1)
  await capture('e2e-approved', 1440)
  await actor('user2'); await navigate('/dashboard/search'); await searchTitle()
  assert.equal(await evaluate(`document.querySelectorAll('.document-card').length`), 1)
  await capture('e2e-discovered', 1440)
  await evaluate(`document.querySelector('.document-card a.user-identity').click()`)
  await waitFor(`location.pathname === '/dashboard/users/user1' && !!document.querySelector('.document-profile__popular-card') && !document.querySelector('.loading-state')`)
  await navigate('/dashboard/users/user1?tab=documents')
  await waitFor(`!!document.querySelector('.document-profile__row')`)
  const before = (await findContributorByUsername('user1')).contributionScore
  await evaluate(`([...document.querySelectorAll('.document-profile .document-profile__row')].find(e => e.textContent.includes(${JSON.stringify(title)}))).querySelector('.document-impact button[aria-pressed]').click()`)
  await waitFor(`!![...document.querySelectorAll('.document-profile .document-profile__row')].find(e => e.textContent.includes(${JSON.stringify(title)}))?.querySelector('.document-impact button[aria-pressed=true]')`)
  assert.equal((await findContributorByUsername('user1')).contributionScore, before + 5)
  await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(isolated, 'downloads') })
  for (let count = 0; count < 2; count++) {
    await evaluate(`([...document.querySelectorAll('.document-profile .document-profile__row')].find(e => e.textContent.includes(${JSON.stringify(title)}))).querySelector('.document-impact .table-actions').querySelectorAll('button')[1].click()`)
    await waitFor(`!!document.querySelector('.document-profile .document-profile__row') && !document.querySelector('.loading-state') && !document.querySelector('.document-profile button:disabled')`)
  }
  assert.equal((await findContributorByUsername('user1')).contributionScore, before + 7)
  await capture('e2e-impact', 1440)
  report.browserLifecycle = { status: 'PASS', actors: ['user1', 'user2', 'admin1'], pendingPrivate: true, publishedRecords: 1, contributorLink: true, helpfulDelta: 5, repeatedDownloadScoreDelta: 2 }
}

try {
  assert.equal((await api('/health')).data.status, 'ok')
  const user = (await api('/auth/login', null, { usernameOrEmail: 'user1', password: 'Test@1234' }, 'POST')).data.accessToken
  const admin = (await api('/auth/login', null, { usernameOrEmail: 'admin1', password: 'Test@1234' }, 'POST')).data.accessToken
  const pdfFixture = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
  const payload = (type, contents) => ({ title: `เอกสารทดสอบ ${type} ${'ความรู้ที่ส่งต่อได้ '.repeat(7)}`, fileName: `${type}-${'long-file-name-'.repeat(10)}.${type === 'Lecture' ? 'pdf' : 'txt'}`, fileType: type === 'Lecture' ? 'application/pdf' : 'text/plain', fileData: Buffer.from(type === 'Lecture' ? pdfFixture : contents).toString('base64'), programId: 'program-cs', courseId: 'qa-course', instructorIds: ['qa-instructor'], documentType: type, academicYear: '2569', semester: '1' })
  for (const type of ['Sheet', 'Lecture']) {
    const result = await api('/upload-requests', user, payload(type, `${type} isolated test material`), 'POST')
    const id = result.data.id || result.data.request?.id
    assert.ok(id, JSON.stringify(result.data))
    await api(`/admin/upload-requests/${id}/approve`, admin, {}, 'PATCH')
  }
  visualDocumentId = db.prepare("SELECT id FROM lectures WHERE status='APPROVED' ORDER BY created_at DESC LIMIT 1").get().id
  const visualCollection = await api('/collections', user, { name: 'Visual QA Course Collection', description: 'Ordered materials for responsive verification', collectionType: 'COURSE', courseId: 'qa-course' }, 'POST')
  visualCollectionId = visualCollection.data.id; visualCollectionSlug = visualCollection.data.slug
  await api(`/collections/${visualCollectionId}/sections`, user, { title: 'เริ่มต้นเรียน' }, 'POST')
  const visualSection = db.prepare('SELECT id FROM collection_sections WHERE collection_id=?').get(visualCollectionId)
  await api(`/collections/${visualCollectionId}/documents`, user, { documentType: 'Lecture', documentId: visualDocumentId, sectionId: visualSection.id }, 'POST')
  await api(`/collections/${visualCollectionId}/lifecycle/publish`, user, {}, 'POST')
  const revision = await api(`/documents/lecture/${visualDocumentId}/revisions`, user, {
    revisionType: 'UPDATE_DOCUMENT',
    changeSummary: 'Visual QA pending revision with additional examples',
    fileName: 'visual-version-2.txt',
    fileType: 'text/plain',
    fileData: Buffer.from('Visual QA version two content with additional examples').toString('base64')
  }, 'POST')
  assert.equal(revision.data.status, 'PENDING')
  report.versioning = { pendingRevision: true, canonicalDocumentId: visualDocumentId }
  const pending = payload('Sheet', 'Pending document for isolated review')
  await api('/upload-requests', user, pending, 'POST')
  await api('/upload-requests', user, { ...pending, fileName: 'renamed-duplicate.txt' }, 'POST')
  const rejectedReview = await api('/upload-requests', user, payload('Sheet', 'Rejected document for review history'), 'POST')
  await api(`/admin/upload-requests/${rejectedReview.data.id}/reject`, admin, { reason: 'Visual QA rejection reason' }, 'PATCH')
  report.storage = { integrity: db.prepare('PRAGMA integrity_check').get().integrity_check, foreignKeys: db.prepare('PRAGMA foreign_key_check').all().length }
  assert.equal(report.storage.integrity, 'ok'); assert.equal(report.storage.foreignKeys, 0)

  browserProcess = spawn(browserPath, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors', '--disable-gpu', '--disable-extensions', '--disable-background-networking', '--disable-features=CalculateNativeWinOcclusion', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${path.join(isolated, 'browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  browserProcess.on('error', (error) => report.errors.push(error.message))
  const activePort = path.join(isolated, 'browser', 'DevToolsActivePort')
  const deadline = Date.now() + 15000
  while (!existsSync(activePort) && Date.now() < deadline && !report.errors.length) await delay(100)
  assert.ok(existsSync(activePort), `Headless browser did not start: ${report.errors.join('; ')}`)
  const port = readFileSync(activePort, 'utf8').split('\n')[0].trim()
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const target = targets.find((item) => item.type === 'page')
  assert.ok(target)
  report.devtoolsTarget = { id: target.id, type: target.type, url: target.url, webSocketDebuggerUrl: target.webSocketDebuggerUrl }
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let serial = 0
  const calls = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) { const call = calls.get(message.id); if (call) { calls.delete(message.id); clearTimeout(call.timer); message.error ? call.reject(new Error(JSON.stringify(message.error))) : call.resolve(message.result) } }
    if (message.method === 'Runtime.exceptionThrown') report.errors.push(JSON.stringify(message.params.exceptionDetails))
    if (message.method === 'Network.loadingFailed') browserDiagnostics.push(message.params)
    if (message.method === 'Log.entryAdded') browserDiagnostics.push(message.params.entry)
  })
  cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial
    const timer = setTimeout(() => { calls.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 15000)
    calls.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
  })
  await cdp('Browser.getVersion'); await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable'); await cdp('Log.enable')
  for (const width of [375, 768, 1024, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await cdp('Network.clearBrowserCookies')
    freshNavigation = true
    for (const [name, route] of [['starter', '/'], ['login', '/login'], ['register', '/register']]) {
      await navigate(route)
      if (name === 'register') {
        const registerIdentity = await evaluate(`(() => { const selects=[...document.querySelectorAll('form select')]; return { required: selects.map(item => item.required), programs: [...selects[0].options].map(item => item.value), cohorts: [...selects[1].options].map(item => item.value) } })()`)
        assert.deepEqual(registerIdentity.required, [true, true])
        assert.deepEqual(registerIdentity.programs, ['', 'CS', 'IT'])
        assert.deepEqual(registerIdentity.cohorts, expectedCohorts)
        report.checks.push({ name: 'register-community-identity', width, ...registerIdentity })
      }
      await capture(name, width)
    }
    await navigate('/')
    await evaluate(`document.querySelector('.motion-toggle').click()`)
    await waitFor(`document.querySelector('.starter-page').classList.contains('motion-paused')`)
    assert.equal(await evaluate(`document.querySelector('.starter-page').classList.contains('motion-paused')`), true)
    await evaluate(`document.querySelector('.motion-toggle').click()`)
    report.checks.push({ name: 'pause-control', width, overflow: [] })
    await actor('user2')
    for (const [name, route] of [['home', '/dashboard/home'], ['lectures', '/dashboard/lec'], ['sheets', '/dashboard/sheet'], ['course', '/dashboard/courses/qa-course'], ['course-collection', `/dashboard/c/${visualCollectionSlug}`], ['collection-reader', `/dashboard/c/${visualCollectionSlug}/read/lecture/${visualDocumentId}`], ['documents', '/dashboard/courses/qa-course/years/2569'], ['version-detail', `/dashboard/documents/lecture/${visualDocumentId}`], ['search', '/dashboard/search'], ['upload', '/dashboard/upload'], ['collections-empty', '/dashboard/collections'], ['profile', '/dashboard/profile'], ['contributor', '/dashboard/users/user1']]) {
      await navigate(route)
      if (name === 'search') {
        await evaluate(`(() => { const input = document.querySelector('input[type=search]'); input.value = '@user1'; input.dispatchEvent(new Event('input', {bubbles:true})); input.form.requestSubmit(); })()`)
        await waitFor(`!!document.querySelector('.contributor-card') && !document.querySelector('.loading-state')`)
      }
      if (name === 'profile') {
        assert.equal(await evaluate(`document.querySelector('.community-identity')?.textContent.includes('ยังไม่ได้ระบุสาขา') && document.querySelector('.community-identity')?.textContent.includes('ยังไม่ได้ระบุรุ่น')`), true)
      }
      if (name === 'contributor') {
        assert.equal(await evaluate(`document.querySelector('.community-identity')?.textContent.includes('CS') && document.querySelector('.community-identity')?.textContent.includes('รุ่น 66')`), true)
      }
      if (name === 'collection-reader') {
        await waitFor(`!!document.querySelector('.reader-frame')`)
        const pdfHeader = await evaluate(`fetch(document.querySelector('.reader-frame').src).then(response => response.arrayBuffer()).then(bytes => new TextDecoder().decode(bytes.slice(0, 8)))`)
        assert.ok(pdfHeader.startsWith('%PDF-1.4'))
        report.readerPdf = { status: 'PASS', blobUrl: true, pdfHeader: true }
      }
      await capture(name, width)
    }
    for (const section of ['public-profile', 'account', 'privacy', 'notifications', 'password']) {
      await navigate(`/dashboard/settings#${section}`)
      await waitFor(`document.querySelector('.settings-nav [aria-current=page]')?.getAttribute('href')?.endsWith('#${section}')`)
      const visibleSettings = await evaluate(`[...document.querySelectorAll('.settings-section')].filter(item => getComputedStyle(item).display !== 'none').map(item => item.id)`)
      assert.deepEqual(visibleSettings, [section])
      report.checks.push({ name: `settings-${section}-navigation`, width, overflow: [] })
    }
    await navigate('/dashboard/settings#privacy')
    await capture('settings-privacy', width)
    if (process.env.VISUAL_QA_SCOPE === 'admin-users') {
      await actor('admin1')
      await navigate('/admin/status')
      await waitFor(`!!document.querySelector('.admin-user-detail') && document.querySelectorAll('.admin-user-card').length > 0`)
      const management = await evaluate(`({
        users: document.querySelectorAll('.admin-user-card').length,
        details: !!document.querySelector('.admin-user-detail'),
        search: !!document.querySelector('.admin-user-filters input[type=search]'),
        status: !!document.querySelector('.admin-user-filters select'),
        roleInputs: document.querySelectorAll('input[name=role], select[name=role]').length,
        passwordInputs: document.querySelectorAll('input[type=password]').length
      })`)
      assert.ok(management.users > 0 && management.details && management.search && management.status)
      assert.equal(management.roleInputs, 0); assert.equal(management.passwordInputs, 0)
      report.checks.push({ name: 'admin-user-management-controls', width, overflow: [], ...management })
      await capture('admin-users', width)
      continue
    }
    if (process.env.VISUAL_QA_SCOPE === 'settings') continue
    await navigate('/dashboard/users/user1?tab=documents')
    await waitFor(`!!document.querySelector('.document-profile__row')`)
    await capture('profile-documents', width)
    await evaluate(`document.querySelector('.document-profile__metadata button').click()`)
    await waitFor(`!!document.querySelector('.document-profile__metadata button[aria-pressed=true]') && !document.querySelector('.document-profile button:disabled')`)
    await navigate('/dashboard/profile?tab=stars')
    await waitFor(`!!document.querySelector('.document-profile__row')`)
    if (width === 1440) {
      await cdp('Page.reload')
      await waitFor(`!!document.querySelector('.document-profile__row') && !document.querySelector('.loading-state')`)
    }
    await capture('profile-stars', width)
    await evaluate(`document.querySelector('.document-profile__metadata button').click()`)
    await waitFor(`!document.querySelector('.document-profile__row') && !document.querySelector('.loading-state')`)
    assert.ok(await evaluate(`document.querySelector('.document-profile__tabs [aria-current=page]').textContent.includes('Stars')`))
    await capture('profile-stars-empty', width)
    await actor('user1'); await navigate('/dashboard/profile?tab=requests')
    await waitFor(`!!document.querySelector('.document-profile__request')`)
    assert.equal(await evaluate(`document.querySelector('.community-identity')?.textContent.includes('CS') && document.querySelector('.community-identity')?.textContent.includes('รุ่น 66')`), true)
    await capture('profile-requests', width)
    await navigate('/dashboard/settings#account')
    await waitFor(`document.querySelector('.settings-nav [aria-current=page]')?.getAttribute('href')?.endsWith('#account')`)
    assert.equal(await evaluate(`document.querySelectorAll('#account form select').length === 2`), true)
    await capture('profile-edit-community', width)
    await navigate('/dashboard/users/user2?tab=requests')
    await waitFor(`!!document.querySelector('.document-profile__content .empty-state')`)
    assert.equal(await evaluate(`document.querySelectorAll('.document-profile__request').length`), 0)
    await capture('profile-requests-private', width)
    report.checks.push({ name: 'profile-star-persist-unstar-private-tabs', width, overflow: [] })
    await actor('user1'); await navigate('/dashboard/upload')
    await evaluate(`document.querySelector('#upload-tab-bulk').click()`)
    await waitFor(`!!document.querySelector('#upload-panel-bulk')`)
    await capture('user-bulk-upload', width)
    await navigate('/dashboard/collections')
    await waitFor(`!!document.querySelector('.collection-card')`)
    await capture('user-collections', width)
    await navigate(`/dashboard/collections/${visualCollectionId}/edit`)
    await waitFor(`!!document.querySelector('.collection-section')`)
    await capture('collection-editor', width)
    await navigate('/dashboard/upload')
    await evaluate(`([...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'การอัปโหลดของฉัน')).click()`)
    await waitFor(`!!document.querySelector('.request-card') && !document.querySelector('.loading-state')`)
    await capture('history', width)
    await actor('admin1')
    for (const [name, route] of [['admin', '/admin/dashboard'], ['academic-admin', '/admin/subject'], ['collections', '/admin/collections'], ['review', '/admin/request']]) {
      await navigate(route); await capture(name, width)
      if (name === 'academic-admin') {
        await evaluate(`([...document.querySelectorAll('[role=tab]')].find(e => e.textContent.includes('รายวิชาที่เปิดสอน'))).click()`)
        await capture('academic-offerings', width)
        await evaluate(`([...document.querySelectorAll('[role=tab]')].find(e => e.textContent.includes('คำขอเพิ่มอาจารย์'))).click()`)
        await capture('academic-suggestions', width)
      }
      if (name === 'review') {
        assert.equal(await evaluate(`[...document.querySelectorAll('[data-review-status]')].every(e => e.dataset.reviewStatus === 'PENDING')`), true)
        await evaluate(`document.querySelector('[data-review-filter="APPROVED"]').click()`)
        await waitFor(`location.search.includes('status=APPROVED') && document.querySelectorAll('[data-review-status]').length > 0 && [...document.querySelectorAll('[data-review-status]')].every(e => e.dataset.reviewStatus === 'APPROVED')`)
        await capture('review-approved', width)
        if (width === 1440) {
          await cdp('Page.reload')
          await waitFor(`location.search.includes('status=APPROVED') && document.querySelectorAll('[data-review-status]').length > 0 && [...document.querySelectorAll('[data-review-status]')].every(e => e.dataset.reviewStatus === 'APPROVED')`)
        }
        await evaluate(`document.querySelector('[data-review-filter="REJECTED"]').click()`)
        await waitFor(`document.querySelectorAll('[data-review-status]').length > 0 && [...document.querySelectorAll('[data-review-status]')].every(e => e.dataset.reviewStatus === 'REJECTED')`)
        await capture('review-rejected', width)
        await evaluate(`document.querySelector('[data-review-filter="ALL"]').click()`)
        await waitFor(`!location.search.includes('status=') && new Set([...document.querySelectorAll('[data-review-status]')].map(e => e.dataset.reviewStatus)).size === 3`)
        const browserCounts = await evaluate(`[...document.querySelectorAll('.queue-summary strong')].map(e => Number(e.textContent))`)
        assert.equal(browserCounts[3], browserCounts[0] + browserCounts[1] + browserCounts[2])
        await evaluate(`document.querySelector('[data-review-filter="PENDING"]').click()`)
        await waitFor(`location.search.includes('status=PENDING') && [...document.querySelectorAll('[data-review-status]')].every(e => e.dataset.reviewStatus === 'PENDING')`)
        await evaluate(`document.querySelector('.review-queue-card button').click()`)
        await waitFor(`!!document.querySelector('[data-review-action="approve"]')`)
        await evaluate(`document.querySelector('.preview-panel').scrollIntoView({block:'start', behavior:'instant'})`)
        await capture('file-preview', width)
      }
    }
    await evaluate(`(() => { const button = document.querySelector('[data-review-action="approve"]'); button.focus(); button.click(); })()`)
    await waitFor(`!!document.querySelector('[role=alertdialog]')`)
    assert.equal(await evaluate(`document.activeElement.dataset.dialogAction`), 'cancel')
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    assert.equal(await evaluate(`document.activeElement.dataset.dialogAction`), 'confirm')
    await capture('approval-dialog', width)
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await waitFor(`!document.querySelector('[role=alertdialog]')`)
    assert.equal(await evaluate(`document.activeElement.dataset.reviewAction`), 'approve')
    report.checks.push({ name: 'dialog-keyboard-focus', width, overflow: [] })
    if (width === 1440) await runBrowserLifecycle()
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await navigate('/')
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.topic-track')).animationName`), 'none')
    await capture('reduced-motion', width)
    await cdp('Emulation.setEmulatedMedia', { features: [] })
  }
  assert.ok(report.checks.every((check) => !(check.overflow ?? []).length), 'Responsive overflow detected; inspect report and screenshots')
  assert.equal(report.errors.length, 0, 'Browser runtime errors')
  assert.ok(!browserDiagnostics.some((entry) => entry.source === 'security' && entry.level === 'error'), 'Browser security policy blocked UI content')
  report.status = 'PASS'
} catch (error) {
  report.status = 'FAIL'; report.errors.push(error.message); process.exitCode = 1
  if (cdp) {
    try { report.diagnostic = await evaluate(`({url: location.href, title: document.title, body: document.body.innerText.slice(0, 500), scripts: [...document.scripts].map(s => s.src)})`) } catch { /* unavailable renderer */ }
  }
  report.browserDiagnostics = browserDiagnostics
  console.error(error.message)
} finally {
  report.browserDiagnostics = browserDiagnostics
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  if (cdp) { socket?.send(JSON.stringify({ id: 999999, method: 'Browser.close' })) }
  socket?.close()
  browserProcess?.kill()
  await new Promise((resolve) => server.close(resolve))
  db.close()
  console.log(`Visual QA ${report.status}: ${output}`)
}
