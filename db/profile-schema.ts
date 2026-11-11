import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const characterProfiles = sqliteTable("character_profiles", {
  tokenHash: text("token_hash").primaryKey(),
  version: integer("version").notNull(),
  profileJson: text("profile_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [index("idx_character_profiles_updated").on(table.updatedAt)]);
