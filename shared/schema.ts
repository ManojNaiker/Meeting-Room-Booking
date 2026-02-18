import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  date,
  time,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (updated for email/password auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  employeeCode: varchar("employee_code").unique(),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  designation: varchar("designation"),
  department: varchar("department"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("user"), // admin, user, viewer
  isActivated: boolean("is_activated").default(false), // true after user sets password via activation link
  mustChangePassword: boolean("must_change_password").default(false), // true for auto-generated passwords
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  capacity: integer("capacity").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url"),
  equipment: jsonb("equipment").default("[]"), // Array of equipment strings
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  roomId: integer("room_id").notNull(),
  userId: varchar("user_id").notNull(),
  startDateTime: timestamp("start_date_time").notNull(),
  endDateTime: timestamp("end_date_time").notNull(),
  participants: jsonb("participants").default("[]"), // Array of email addresses
  repeatType: varchar("repeat_type").default("none"), // none, daily, weekly, custom
  repeatConfig: jsonb("repeat_config"), // Configuration for repeating bookings
  customDays: jsonb("custom_days").default("[]"), // Array of weekday numbers for custom repeat
  attachmentUrl: varchar("attachment_url"),
  attachmentName: varchar("attachment_name"),
  remindMe: boolean("remind_me").default(false),
  reminderTime: integer("reminder_time").default(15), // minutes before
  reminderSent: boolean("reminder_sent").default(false),
  status: varchar("status").default("confirmed"), // confirmed, cancelled, pending
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  action: varchar("action").notNull(), // create, update, delete, login, logout
  resourceType: varchar("resource_type").notNull(), // booking, room, user
  resourceId: varchar("resource_id"),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  smtpHost: varchar("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpUsername: varchar("smtp_username").notNull(),
  smtpPassword: varchar("smtp_password").notNull(),
  fromEmail: varchar("from_email").notNull(),
  fromName: varchar("from_name").notNull(),
  enableBookingNotifications: boolean("enable_booking_notifications").default(true),
  enableReminders: boolean("enable_reminders").default(true),
  enablePasswordReset: boolean("enable_password_reset").default(true),
  enableLdap: boolean("enable_ldap").default(false),
  ldapHost: varchar("ldap_host"),
  ldapPort: integer("ldap_port").default(389),
  ldapBaseDn: varchar("ldap_base_dn"),
  ldapBindDn: varchar("ldap_bind_dn"),
  ldapBindPassword: varchar("ldap_bind_password"),
  ldapSearchFilter: varchar("ldap_search_filter").default("(mail=*)"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  token: varchar("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calendarSync = pgTable("calendar_sync", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  provider: varchar("provider").notNull(), // 'google' or 'outlook'
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  calendarId: varchar("calendar_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type").notNull(), // booking, room, user, system, email
  isRead: boolean("is_read").default(false),
  relatedId: varchar("related_id"), // ID of related booking, room, etc.
  relatedType: varchar("related_type"), // booking, room, user, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  auditLogs: many(auditLogs),
  calendarSync: many(calendarSync),
  passwordResetTokens: many(passwordResetTokens),
  notifications: many(notifications),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  room: one(rooms, {
    fields: [bookings.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const calendarSyncRelations = relations(calendarSync, ({ one }) => ({
  user: one(users, {
    fields: [calendarSync.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDateTime: z.string().transform((val) => new Date(val)),
  endDateTime: z.string().transform((val) => new Date(val)),
});

export const updateBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
}).extend({
  startDateTime: z.string(),
  endDateTime: z.string(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertCalendarSyncSchema = createInsertSchema(calendarSync).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type CalendarSync = typeof calendarSync.$inferSelect;
export type InsertCalendarSync = z.infer<typeof insertCalendarSyncSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Booking with relations
export type BookingWithRelations = Booking & {
  room: Room;
  user: User;
};
