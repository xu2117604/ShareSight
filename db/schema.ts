import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    phone: text("phone").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("users_created_at_idx").on(table.createdAt)],
);

export const folders = sqliteTable(
  "folders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    parentId: integer("parent_id").notNull().default(0),
    name: text("name").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("folders_parent_name_idx").on(table.parentId, table.name),
    index("folders_parent_idx").on(table.parentId, table.createdAt),
  ],
);

export const files = sqliteTable(
  "files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    objectKey: text("object_key").notNull().unique(),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    contentType: text("content_type").notNull(),
    category: text("category").notNull(),
    folder: text("folder").notNull().default("0"),
    notes: text("notes").notNull().default(""),
    uploaderPhone: text("uploader_phone").notNull(),
    uploaderName: text("uploader_name").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
  },
  (table) => [index("files_uploaded_at_idx").on(table.uploadedAt)],
);
