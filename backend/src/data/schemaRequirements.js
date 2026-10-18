export const requiredSchema = {
  users: ['id', 'username', 'display_name', 'email', 'password', 'role', 'program_code', 'cohort', 'email_verified_at', 'display_name_changed_at', 'bio', 'avatar_storage_key', 'profile_public', 'show_program', 'show_cohort', 'account_status', 'deactivated_at', 'deactivated_by', 'deactivation_reason'],
  admin_audit_logs: ['id', 'actor_user_id', 'target_user_id', 'action', 'changes_json', 'created_at'],
  collections: ['id', 'name', 'slug', 'description', 'status', 'created_by', 'collection_type', 'course_id', 'publication_status', 'visibility', 'moderation_status', 'cover_file_asset_id', 'version', 'created_at', 'updated_at'],
  collection_sections: ['id', 'collection_id', 'title', 'position', 'created_at', 'updated_at'],
  collection_documents: ['collection_id', 'document_type', 'document_id', 'section_id', 'position', 'added_at'],
  bulk_upload_jobs: ['id', 'created_by', 'collection_id', 'status', 'total_items', 'succeeded_items', 'failed_items', 'created_at', 'updated_at'],
  bulk_upload_items: ['id', 'job_id', 'client_key', 'request_id', 'status', 'error_code', 'error_message', 'attempt_count', 'created_at', 'updated_at'],
  programs: ['id', 'code'], courses: ['id', 'code', 'name'], instructors: ['id', 'name'],
  program_courses: ['program_id', 'course_id'],
  course_offerings: ['id', 'course_id', 'academic_year', 'semester'],
  course_offering_teachers: ['offering_id', 'teacher_id'], course_offering_programs: ['offering_id', 'program_id'],
  sheets: ['id', 'status', 'current_version_id'], lectures: ['id', 'status', 'current_version_id'],
  file_assets: ['id', 'binary_hash', 'file_data', 'blob_key', 'file_size', 'mime_type'],
  upload_requests: ['id', 'user_id', 'status', 'file_asset_id', 'duplicate_status', 'collection_id'],
  lecture_files: ['id', 'lecture_id', 'file_asset_id'], sheet_files: ['id', 'sheet_id', 'file_asset_id'],
  refresh_tokens: ['id', 'user_id', 'token_hash', 'expires_at', 'revoked_at'], notifications: ['id', 'user_id'],
  teacher_suggestions: ['id', 'status'], document_versions: ['id', 'document_type', 'document_id', 'version_number', 'status', 'source_version_id', 'file_asset_id'],
  upload_request_teachers: ['upload_request_id', 'teacher_id'], document_teachers: ['document_type', 'document_id', 'teacher_id'],
  document_stars: ['user_id', 'document_type', 'document_id'],
  document_interactions: ['user_id', 'document_type', 'document_id', 'interaction_type'],
  document_helpful_votes: ['user_id', 'document_type', 'document_id'], course_imports: ['id'],
  account_tokens: ['id', 'user_id', 'purpose', 'token_hash', 'expires_at', 'consumed_at'],
  user_follows: ['follower_id', 'followed_id'],
  profile_change_requests: ['id', 'user_id', 'category', 'status', 'reviewer_id'],
  notification_preferences: ['user_id', 'new_follower', 'followed_documents', 'document_activity', 'activity_email'],
  email_deliveries: ['id', 'template', 'recipient', 'status'],
  feedback_reports: ['id', 'public_reference', 'reporter_user_id', 'client_request_id', 'category', 'subject', 'description', 'related_path', 'related_document_type', 'related_document_id', 'status', 'version', 'created_at', 'updated_at', 'resolved_at'],
  feedback_report_events: ['id', 'report_id', 'actor_user_id', 'event_type', 'previous_status', 'new_status', 'internal_note', 'public_message', 'created_at']
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
