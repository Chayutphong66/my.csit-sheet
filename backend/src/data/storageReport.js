import { db } from './database.js'

const report = {
  integrity: db.prepare('PRAGMA integrity_check').get().integrity_check,
  foreignKeyViolations: db.prepare('PRAGMA foreign_key_check').all().length,
  assets: db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS bytes FROM file_assets').get(),
  references: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM upload_requests WHERE file_asset_id IS NOT NULL) AS requests,
      (SELECT COUNT(*) FROM lecture_files WHERE file_asset_id IS NOT NULL) AS lectures,
      (SELECT COUNT(*) FROM sheet_files WHERE file_asset_id IS NOT NULL) AS sheets
  `).get(),
  legacyPayloads: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM upload_requests WHERE file_data IS NOT NULL AND length(file_data) > 0) AS requests,
      (SELECT COUNT(*) FROM lecture_files WHERE length(file_data) > 0) AS lectures,
      (SELECT COUNT(*) FROM sheet_files WHERE length(file_data) > 0) AS sheets
  `).get()
}

console.log(JSON.stringify(report))
db.close()
