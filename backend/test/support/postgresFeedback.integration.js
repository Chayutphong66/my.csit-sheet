import assert from 'node:assert/strict'
import crypto from 'node:crypto'

function requestId(label) {
  return `pg-feedback-${label}-0001`
}

function body(clientRequestId, approvedDocument, overrides = {}) {
  return {
    clientRequestId,
    category: 'BUG',
    subject: 'Postgres feedback lifecycle',
    description: 'PostgreSQL feedback integration verifies the complete lifecycle.',
    relatedPath: '/dashboard/search',
    relatedDocumentType: approvedDocument.type,
    relatedDocumentId: approvedDocument.id,
    ...overrides
  }
}

export async function verifyPostgresFeedback({
  api, db, pool, withTransaction, reporter, reporterToken, admin, adminCredentials, approvedDocument
}) {
  const columns = (await pool.query(`SELECT table_name,column_name,is_nullable,data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('feedback_reports','feedback_report_events')`)).rows
  const column = (table, name) => columns.find(item => item.table_name === table && item.column_name === name)
  assert.equal(column('feedback_reports', 'reporter_user_id').is_nullable, 'YES')
  assert.equal(column('feedback_reports', 'version').data_type, 'integer')
  assert.equal(column('feedback_report_events', 'internal_note').is_nullable, 'NO')

  const constraints = (await pool.query(`SELECT conrelid::regclass::text table_name,pg_get_constraintdef(oid) definition
    FROM pg_constraint WHERE conrelid IN ('feedback_reports'::regclass,'feedback_report_events'::regclass)`)).rows
  const definitions = constraints.map(item => `${item.table_name} ${item.definition}`).join('\n')
  assert.match(definitions, /UNIQUE \(reporter_user_id, client_request_id\)/)
  assert.match(definitions, /CHECK .*category.*BUG.*FEATURE_REQUEST/s)
  assert.match(definitions, /CHECK .*status.*IN_REVIEW.*DUPLICATE/s)
  assert.match(definitions, /FOREIGN KEY \(reporter_user_id\).*users\(id\).*ON DELETE SET NULL/s)
  assert.match(definitions, /FOREIGN KEY \(report_id\).*feedback_reports\(id\).*ON DELETE CASCADE/s)

  const indexes = (await pool.query(`SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename IN ('feedback_reports','feedback_report_events')`)).rows.map(row => row.indexname)
  for (const name of ['idx_feedback_reporter_created', 'idx_feedback_admin_queue', 'idx_feedback_events_report']) {
    assert.ok(indexes.includes(name), `Missing feedback index: ${name}`)
  }

  await assert.rejects(pool.query(`INSERT INTO feedback_reports
    (id,public_reference,reporter_user_id,client_request_id,category,subject,description)
    VALUES($1,$2,$3,$4,'INVALID','Invalid category','Database constraint check')`,
  [crypto.randomUUID(), 'FB-PG-BAD-CATEGORY', reporter.id, requestId('bad-category')]), error => error.code === '23514')
  await assert.rejects(pool.query(`INSERT INTO feedback_reports
    (id,public_reference,reporter_user_id,client_request_id,category,subject,description)
    VALUES($1,$2,'missing-user',$3,'BUG','Missing reporter','Foreign key check')`,
  [crypto.randomUUID(), 'FB-PG-BAD-REPORTER', requestId('bad-reporter')]), error => error.code === '23503')
  await assert.rejects(pool.query(`INSERT INTO feedback_reports
    (id,public_reference,reporter_user_id,client_request_id,category,subject,description,related_document_type,related_document_id)
    VALUES($1,$2,$3,$4,'BUG','Invalid relation','Relationship constraint','Sheet','')`,
  [crypto.randomUUID(), 'FB-PG-BAD-RELATION', reporter.id, requestId('bad-relation')]), error => error.code === '23514')

  const rollbackId = crypto.randomUUID()
  await assert.rejects(withTransaction(async () => {
    await db.prepare(`INSERT INTO feedback_reports
      (id,public_reference,reporter_user_id,client_request_id,category,subject,description)
      VALUES (?,?,?,?, 'BUG','Rollback check','This report must be rolled back')`)
      .run(rollbackId, 'FB-PG-ROLLBACK', reporter.id, requestId('rollback'))
    throw new Error('feedback rollback sentinel')
  }), /feedback rollback sentinel/)
  assert.equal(await db.prepare('SELECT id FROM feedback_reports WHERE id=?').get(rollbackId), undefined)

  assert.equal((await api('/feedback', { method: 'POST', body: body(requestId('unauthenticated'), approvedDocument) })).status, 401)
  assert.equal((await api('/feedback', { method: 'POST', token: reporterToken, body: body(requestId('category'), approvedDocument, { category: 'INVALID' }) })).status, 400)
  assert.equal((await api('/feedback', { method: 'POST', token: reporterToken, body: body(requestId('subject'), approvedDocument, { subject: 'bad' }) })).status, 400)
  assert.equal((await api('/feedback', { method: 'POST', token: reporterToken, body: body(requestId('oversized'), approvedDocument, { description: 'x'.repeat(4001) }) })).status, 400)
  assert.equal((await api('/feedback', { method: 'POST', token: reporterToken, body: body(requestId('unsafe-path'), approvedDocument, { relatedPath: 'https://example.invalid/private' }) })).status, 400)
  assert.equal((await api('/feedback', { method: 'POST', token: reporterToken, body: body(requestId('missing-document'), { type: 'Lecture', id: 'missing-document' }) })).status, 404)

  const first = await api('/feedback', { method: 'POST', token: reporterToken, body: body(requestId('sequential'), approvedDocument) })
  assert.equal(first.status, 201)
  const replay = await api('/feedback', { method: 'POST', token: reporterToken, body: body(requestId('sequential'), approvedDocument) })
  assert.equal(replay.status, 200)
  assert.equal(replay.data.reference, first.data.reference)
  assert.equal(replay.data.replayed, true)

  const concurrent = await Promise.all([1, 2].map(() => api('/feedback', {
    method: 'POST', token: reporterToken,
    body: body(requestId('concurrent'), approvedDocument, { subject: 'Postgres feedback concurrent retry' })
  })))
  assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 201])
  assert.equal(concurrent[0].data.reference, concurrent[1].data.reference)

  const markupSubject = '<img src=x onerror=alert(1)> Postgres feedback'
  const closeCandidate = await api('/feedback', {
    method: 'POST', token: reporterToken,
    body: body(requestId('close'), approvedDocument, { subject: markupSubject, description: '<script>alert(1)</script> remains inert text in JSON and Vue interpolation.' })
  })
  assert.equal(closeCandidate.status, 201)
  assert.equal(closeCandidate.data.subject, markupSubject)

  const otherCredentials = { username: 'pgfeedbackother', email: 'pg-feedback-other@example.invalid', password: 'FeedbackOther123', program: 'CS', cohort: '66' }
  assert.equal((await api('/auth/register', { method: 'POST', body: otherCredentials })).status, 201)
  const otherLogin = await api('/auth/login', { method: 'POST', body: { usernameOrEmail: otherCredentials.username, password: otherCredentials.password } })
  assert.equal(otherLogin.status, 200)
  assert.equal((await api(`/feedback/${first.data.reference}`, { token: otherLogin.data.accessToken })).status, 404)

  const firstPage = await api('/feedback/me?page=1&limit=1', { token: reporterToken })
  const secondPage = await api('/feedback/me?page=2&limit=1', { token: reporterToken })
  assert.equal(firstPage.status, 200)
  assert.equal(firstPage.data.total, 3)
  assert.equal(firstPage.data.items.length, 1)
  assert.equal(secondPage.data.items.length, 1)
  assert.notEqual(firstPage.data.items[0].reference, secondPage.data.items[0].reference)

  assert.equal((await api('/admin/feedback', { token: reporterToken })).status, 403)
  const adminLogin = await api('/auth/login', { method: 'POST', body: adminCredentials })
  assert.equal(adminLogin.status, 200)
  const adminToken = adminLogin.data.accessToken
  const filtered = await api('/admin/feedback?status=OPEN&category=BUG&search=Postgres&sort=oldest&page=1&limit=1', { token: adminToken })
  assert.equal(filtered.status, 200)
  assert.equal(filtered.data.total, 3)
  assert.equal(filtered.data.items.length, 1)
  const injectionProbe = await api(`/admin/feedback?search=${encodeURIComponent("%' OR 1=1 --")}`, { token: adminToken })
  assert.equal(injectionProbe.status, 200)
  assert.equal(injectionProbe.data.total, 0)
  assert.equal((await api('/admin/feedback/FB-DOES-NOT-EXIST', { token: adminToken })).status, 404)

  const reviewed = await api(`/admin/feedback/${first.data.reference}`, {
    method: 'PATCH', token: adminToken,
    body: { expectedVersion: 0, status: 'IN_REVIEW', internalNote: 'Postgres private review note', publicMessage: 'Review started' }
  })
  assert.equal(reviewed.status, 200)
  assert.equal(reviewed.data.version, 1)
  assert.ok(reviewed.data.events.some(event => event.internalNote === 'Postgres private review note'))
  const reporterView = await api(`/feedback/${first.data.reference}`, { token: reporterToken })
  assert.equal(reporterView.status, 200)
  assert.doesNotMatch(JSON.stringify(reporterView.data), /Postgres private review note/)
  assert.ok(reporterView.data.events.some(event => event.publicMessage === 'Review started'))
  assert.equal((await api(`/admin/feedback/${first.data.reference}`, { method: 'PATCH', token: adminToken, body: { expectedVersion: 0, status: 'RESOLVED' } })).status, 409)
  const resolved = await api(`/admin/feedback/${first.data.reference}`, { method: 'PATCH', token: adminToken, body: { expectedVersion: 1, status: 'RESOLVED' } })
  assert.equal(resolved.status, 200)
  assert.equal(resolved.data.status, 'RESOLVED')
  assert.equal((await api(`/admin/feedback/${first.data.reference}`, { method: 'PATCH', token: adminToken, body: { expectedVersion: 2, status: 'IN_REVIEW' } })).status, 409)

  const concurrentReference = concurrent[0].data.reference
  const adminRace = await Promise.all([
    api(`/admin/feedback/${concurrentReference}`, { method: 'PATCH', token: adminToken, body: { expectedVersion: 0, status: 'IN_REVIEW', internalNote: 'Reviewer A' } }),
    api(`/admin/feedback/${concurrentReference}`, { method: 'PATCH', token: adminToken, body: { expectedVersion: 0, status: 'IN_REVIEW', internalNote: 'Reviewer B' } })
  ])
  assert.deepEqual(adminRace.map(result => result.status).sort(), [200, 409])
  const raceWinner = adminRace.find(result => result.status === 200)
  assert.equal(raceWinner.data.version, 1)
  assert.equal(raceWinner.data.events.filter(event => event.type === 'STATUS_CHANGED').length, 1)
  assert.equal(raceWinner.data.events.filter(event => event.type === 'NOTE_ADDED').length, 1)
  const duplicate = await api(`/admin/feedback/${concurrentReference}`, { method: 'PATCH', token: adminToken, body: { expectedVersion: 1, status: 'DUPLICATE' } })
  assert.equal(duplicate.status, 200)
  assert.equal(duplicate.data.status, 'DUPLICATE')

  const inReviewForClose = await api(`/admin/feedback/${closeCandidate.data.reference}`, { method: 'PATCH', token: adminToken, body: { expectedVersion: 0, status: 'IN_REVIEW' } })
  assert.equal(inReviewForClose.status, 200)
  const closed = await api(`/admin/feedback/${closeCandidate.data.reference}`, { method: 'PATCH', token: adminToken, body: { expectedVersion: 1, status: 'CLOSED' } })
  assert.equal(closed.status, 200)
  assert.equal(closed.data.status, 'CLOSED')

  const storedEvents = await db.prepare(`SELECT event_type,internal_note FROM feedback_report_events
    WHERE report_id=(SELECT id FROM feedback_reports WHERE public_reference=?) ORDER BY created_at,id`).all(first.data.reference)
  assert.deepEqual(storedEvents.map(event => event.event_type).sort(), ['CREATED', 'NOTE_ADDED', 'PUBLIC_MESSAGE', 'STATUS_CHANGED', 'STATUS_CHANGED'].sort())
  assert.equal(storedEvents.filter(event => event.internal_note === 'Postgres private review note').length, 1)
  assert.equal(Number((await db.prepare('SELECT COUNT(*) count FROM feedback_reports WHERE reporter_user_id=?').get(reporter.id)).count), 3)
  assert.equal((await db.prepare('SELECT role FROM users WHERE id=?').get(admin.id)).role, 'ADMIN')
}
