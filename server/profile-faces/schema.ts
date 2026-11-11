export const PROFILE_FACE_DDL = [
  `CREATE TABLE IF NOT EXISTS profile_face_jobs (job_id TEXT PRIMARY KEY, profile_hash TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, status TEXT NOT NULL, face_id TEXT, error_code TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_face_jobs_profile_key ON profile_face_jobs(profile_hash, idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS idx_profile_face_jobs_updated ON profile_face_jobs(updated_at)`,
  `CREATE TABLE IF NOT EXISTS profile_faces (face_id TEXT PRIMARY KEY, profile_hash TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_profile_faces_owner ON profile_faces(profile_hash, created_at)`,
] as const;
