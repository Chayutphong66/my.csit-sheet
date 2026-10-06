export const requiredSchema = {
  users: ['id', 'username', 'display_name', 'email', 'password', 'role', 'program_code', 'cohort'],
  programs: ['id', 'code'], courses: ['id', 'code', 'name'], instructors: ['id', 'name'],
  program_courses: ['program_id', 'course_id'],
  course_offerings: ['id', 'course_id', 'academic_year', 'semester'],
  course_offering_teachers: ['offering_id', 'teacher_id'], course_offering_programs: ['offering_id', 'program_id'],
  sheets: ['id', 'status', 'current_version_id'], lectures: ['id', 'status', 'current_version_id'],
  file_assets: ['id', 'binary_hash', 'file_data', 'blob_key', 'file_size', 'mime_type'],
  upload_requests: ['id', 'user_id', 'status', 'file_asset_id', 'duplicate_status'],
  lecture_files: ['id', 'lecture_id', 'file_asset_id'], sheet_files: ['id', 'sheet_id', 'file_asset_id'],
  refresh_tokens: ['id', 'user_id', 'token_hash', 'expires_at', 'revoked_at'], notifications: ['id', 'user_id'],
  teacher_suggestions: ['id', 'status'], document_versions: ['id', 'document_type', 'document_id', 'version_number', 'status', 'source_version_id', 'file_asset_id'],
  upload_request_teachers: ['upload_request_id', 'teacher_id'], document_teachers: ['document_type', 'document_id', 'teacher_id'],
  document_stars: ['user_id', 'document_type', 'document_id'],
  document_interactions: ['user_id', 'document_type', 'document_id', 'interaction_type'],
  document_helpful_votes: ['user_id', 'document_type', 'document_id'], course_imports: ['id']
}

export function verifySchema(rows, externalReferences = true) {
  const columns = new Set(rows.map(row => `${row.table_name}.${row.column_name}`))
  const expected = Object.entries(requiredSchema).flatMap(([table, names]) => names.map(name => `${table}.${name}`))
  if (externalReferences) expected.push('file_assets.storage_key', 'file_assets.storage_provider')
  const missing = expected.filter(column => !columns.has(column))
  if (missing.length) {
    const error = new Error(`Required database schema is missing: ${missing.join(', ')}`)
    error.code = 'SCHEMA_NOT_READY'
    throw error
  }
}
