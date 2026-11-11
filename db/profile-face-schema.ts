import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
export const profileFaceJobs = sqliteTable("profile_face_jobs", {
  jobId: text("job_id").primaryKey(), profileHash: text("profile_hash").notNull(), idempotencyKey: text("idempotency_key").notNull(), requestHash: text("request_hash").notNull(), status: text("status").notNull(), faceId: text("face_id"), errorCode: text("error_code"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, table => [uniqueIndex("idx_profile_face_jobs_profile_key").on(table.profileHash, table.idempotencyKey), index("idx_profile_face_jobs_updated").on(table.updatedAt)]);
export const profileFaces = sqliteTable("profile_faces", {
  faceId: text("face_id").primaryKey(), profileHash: text("profile_hash").notNull(), objectKey: text("object_key").notNull().unique(), contentType: text("content_type").notNull(), byteSize: integer("byte_size").notNull(), createdAt: integer("created_at").notNull(),
}, table => [index("idx_profile_faces_owner").on(table.profileHash, table.createdAt)]);
