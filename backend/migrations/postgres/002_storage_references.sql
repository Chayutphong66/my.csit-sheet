-- Preserve the legacy blob_key column while introducing a provider-neutral reference.
ALTER TABLE file_assets ADD COLUMN storage_key TEXT;
ALTER TABLE file_assets ADD COLUMN storage_provider TEXT;
UPDATE file_assets SET storage_key = blob_key, storage_provider = 'netlify' WHERE blob_key IS NOT NULL;
