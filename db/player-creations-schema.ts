import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const playerCreations = sqliteTable("player_creations", {
  creationId: text("creation_id").primaryKey(), profileHash: text("profile_hash").notNull(), kind: text("kind").notNull(), title: text("title").notNull().default(""),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(), deletedAt: integer("deleted_at"), shareInRooms: integer("share_in_rooms").notNull().default(0),
  revision: integer("revision").notNull().default(0), state: text("state").notNull().default("draft"), draftJson: text("draft_json").notNull(), placementJson: text("placement_json").notNull(),
  currentObjectKey: text("current_object_key"), currentSha256: text("current_sha256"), currentByteSize: integer("current_byte_size"),
}, table => [index("idx_player_creations_owner").on(table.profileHash, table.deletedAt, table.createdAt), index("idx_player_creations_room_share").on(table.profileHash, table.shareInRooms, table.deletedAt, table.state)]);

export const playerCreationRevisions = sqliteTable("player_creation_revisions", {
  creationId: text("creation_id").notNull(), revision: integer("revision").notNull(), idempotencyKey: text("idempotency_key").notNull(), sourceJson: text("source_json").notNull(), placementJson: text("placement_json").notNull(),
  objectKey: text("object_key").notNull().unique(), sha256: text("sha256").notNull(), byteSize: integer("byte_size").notNull(), createdAt: integer("created_at").notNull(),
}, table => [uniqueIndex("idx_player_creation_revision_key").on(table.creationId, table.revision), uniqueIndex("idx_player_creation_idempotency").on(table.creationId, table.idempotencyKey), index("idx_player_creation_revisions_created").on(table.creationId, table.createdAt)]);
