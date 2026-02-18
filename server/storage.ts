import {
  users,
  rooms,
  bookings,
  auditLogs,
  emailSettings,
  passwordResetTokens,
  notifications,
  type User,
  type UpsertUser,
  type Room,
  type InsertRoom,
  type Booking,
  type InsertBooking,
  type BookingWithRelations,
  type AuditLog,
  type InsertAuditLog,
  type EmailSettings,
  type InsertEmailSettings,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc, ilike, or, ne, lt, gt } from "drizzle-orm";

export interface IStorage {
  // User operations (updated for email/password auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  createBulkUsers(users: UpsertUser[]): Promise<{ success: User[], failed: { email: string, error: string }[] }>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserPassword(id: string, passwordHash: string): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;
  
  // Room operations
  getAllRooms(): Promise<Room[]>;
  getRoom(id: number): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: number, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: number): Promise<boolean>;
  
  // Booking operations
  getAllBookings(): Promise<BookingWithRelations[]>;
  getBooking(id: number): Promise<BookingWithRelations | undefined>;
  getUserBookings(userId: string): Promise<BookingWithRelations[]>;
  getRoomBookings(roomId: number, startDate?: Date, endDate?: Date): Promise<BookingWithRelations[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, updates: Partial<Booking>): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<boolean>;
  checkBookingConflict(roomId: number, startTime: Date, endTime: Date, excludeBookingId?: number): Promise<boolean>;
  getUpcomingBookings(startDate: Date, endDate: Date): Promise<BookingWithRelations[]>;
  markReminderSent(bookingId: number): Promise<boolean>;
  
  // Audit log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getUserAuditLogs(userId: string, limit?: number): Promise<AuditLog[]>;
  
  // Dashboard stats
  getDashboardStats(): Promise<{
    totalRooms: number;
    availableRooms: number;
    bookedToday: number;
    weeklyBookings: number;
  }>;
  
  // Email settings operations
  getEmailSettings(): Promise<EmailSettings | undefined>;
  upsertEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;
  
  // Password reset operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  getPasswordResetTokens(): Promise<PasswordResetToken[]>;
  markPasswordResetTokenUsed(id: number): Promise<boolean>;
  deletePasswordResetToken(token: string): Promise<boolean>;
  
  // Notification operations
  getAllNotifications(userId: string): Promise<Notification[]>;
  getNotification(id: number): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;
  deleteAllNotifications(userId: string): Promise<boolean>;
  getUnreadNotificationCount(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async createBulkUsers(usersData: UpsertUser[]): Promise<{ success: User[], failed: { email: string, error: string }[] }> {
    const success: User[] = [];
    const failed: { email: string, error: string }[] = [];

    for (const userData of usersData) {
      try {
        const existingUser = await this.getUserByEmail(userData.email);
        if (existingUser) {
          failed.push({ email: userData.email, error: 'Email already exists' });
          continue;
        }

        const [user] = await db
          .insert(users)
          .values(userData)
          .returning();
        success.push(user);
      } catch (error: any) {
        failed.push({ email: userData.email, error: error.message || 'Unknown error' });
      }
    }

    return { success, failed };
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.firstName));
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Room operations
  async getAllRooms(): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.isActive, true)).orderBy(asc(rooms.name));
  }

  async getRoom(id: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    const [newRoom] = await db.insert(rooms).values(room).returning();
    return newRoom;
  }

  async updateRoom(id: number, updates: Partial<Room>): Promise<Room | undefined> {
    const [room] = await db
      .update(rooms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();
    return room;
  }

  async deleteRoom(id: number): Promise<boolean> {
    const [room] = await db
      .update(rooms)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();
    return !!room;
  }

  // Booking operations
  async getAllBookings(): Promise<BookingWithRelations[]> {
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .orderBy(desc(bookings.startDateTime));
    
    return result.map(row => ({
      ...row.bookings,
      room: row.rooms!,
      user: row.users!,
    }));
  }

  async getBooking(id: number): Promise<BookingWithRelations | undefined> {
    const [result] = await db
      .select()
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.bookings,
      room: result.rooms!,
      user: result.users!,
    };
  }

  async getUserBookings(userId: string): Promise<BookingWithRelations[]> {
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.startDateTime));
    
    return result.map(row => ({
      ...row.bookings,
      room: row.rooms!,
      user: row.users!,
    }));
  }

  async getRoomBookings(roomId: number, startDate?: Date, endDate?: Date): Promise<BookingWithRelations[]> {
    const whereConditions = [eq(bookings.roomId, roomId)];
    
    if (startDate && endDate) {
      whereConditions.push(gte(bookings.startDateTime, startDate));
      whereConditions.push(lte(bookings.endDateTime, endDate));
    }
    
    const whereCondition = and(...whereConditions);
    
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(whereCondition)
      .orderBy(asc(bookings.startDateTime));
    
    return result.map(row => ({
      ...row.bookings,
      room: row.rooms!,
      user: row.users!,
    }));
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [newBooking] = await db.insert(bookings).values(booking).returning();
    return newBooking;
  }

  async updateBooking(id: number, updates: Partial<Booking>): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async deleteBooking(id: number): Promise<boolean> {
    const result = await db.delete(bookings).where(eq(bookings.id, id));
    return (result.rowCount || 0) > 0;
  }

  async checkBookingConflict(roomId: number, startTime: Date, endTime: Date, excludeBookingId?: number): Promise<boolean> {
    let whereCondition = and(
      eq(bookings.roomId, roomId),
      eq(bookings.status, "confirmed"),
      or(
        // Case 1: Existing booking starts within the new booking time range
        and(
          gte(bookings.startDateTime, startTime),
          lt(bookings.startDateTime, endTime)
        ),
        // Case 2: Existing booking ends within the new booking time range
        and(
          gt(bookings.endDateTime, startTime),
          lte(bookings.endDateTime, endTime)
        ),
        // Case 3: Existing booking completely encompasses the new booking
        and(
          lte(bookings.startDateTime, startTime),
          gte(bookings.endDateTime, endTime)
        ),
        // Case 4: New booking completely encompasses an existing booking
        and(
          gte(bookings.startDateTime, startTime),
          lte(bookings.endDateTime, endTime)
        )
      )
    );
    
    if (excludeBookingId) {
      whereCondition = and(
        whereCondition,
        ne(bookings.id, excludeBookingId)
      );
    }
    
    const conflicts = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(whereCondition);
    
    return conflicts.length > 0;
  }

  async getUpcomingBookings(startDate: Date, endDate: Date): Promise<BookingWithRelations[]> {
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(
        and(
          gte(bookings.startDateTime, startDate),
          lte(bookings.startDateTime, endDate),
          eq(bookings.status, "confirmed")
        )
      )
      .orderBy(asc(bookings.startDateTime));
    
    return result.map(row => ({
      ...row.bookings,
      room: row.rooms!,
      user: row.users!,
    }));
  }

  async markReminderSent(bookingId: number): Promise<boolean> {
    const result = await db
      .update(bookings)
      .set({ reminderSent: true, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));
    return (result.rowCount || 0) > 0;
  }

  // Audit log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values(log).returning();
    return auditLog;
  }

  async getAuditLogs(limit: number = 100): Promise<any[]> {
    return await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        timestamp: auditLogs.timestamp,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userRole: users.role,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  async getUserAuditLogs(userId: string, limit: number = 100): Promise<any[]> {
    return await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        timestamp: auditLogs.timestamp,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userRole: users.role,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  // Dashboard stats
  async getDashboardStats(): Promise<{
    totalRooms: number;
    availableRooms: number;
    bookedToday: number;
    weeklyBookings: number;
  }> {
    const totalRooms = await db.select().from(rooms).where(eq(rooms.isActive, true));
    
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const bookedToday = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "confirmed"),
          gte(bookings.startDateTime, todayStart),
          lte(bookings.startDateTime, todayEnd)
        )
      );
    
    const weeklyBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "confirmed"),
          gte(bookings.startDateTime, weekStart)
        )
      );
    
    // Get currently occupied rooms
    const now = new Date();
    const currentlyBooked = await db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "confirmed"),
          lte(bookings.startDateTime, now),
          gte(bookings.endDateTime, now)
        )
      );
    
    const availableRooms = totalRooms.length - currentlyBooked.length;
    
    return {
      totalRooms: totalRooms.length,
      availableRooms: Math.max(0, availableRooms),
      bookedToday: bookedToday.length,
      weeklyBookings: weeklyBookings.length,
    };
  }

  // Email settings operations
  async getEmailSettings(): Promise<EmailSettings | undefined> {
    const [settings] = await db
      .select()
      .from(emailSettings)
      .orderBy(desc(emailSettings.updatedAt))
      .limit(1);
    return settings;
  }

  async upsertEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    // First, try to get existing settings
    const existing = await this.getEmailSettings();
    
    if (existing) {
      // Update existing record
      const [result] = await db
        .update(emailSettings)
        .set({ 
          ...settings, 
          updatedAt: new Date() 
        })
        .where(eq(emailSettings.id, existing.id))
        .returning();
      return result;
    } else {
      // Insert new record
      const [result] = await db
        .insert(emailSettings)
        .values(settings)
        .returning();
      return result;
    }
  }

  // Password reset operations
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [result] = await db
      .insert(passwordResetTokens)
      .values(token)
      .returning();
    return result;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [result] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    return result;
  }

  async getPasswordResetTokens(): Promise<PasswordResetToken[]> {
    return await db
      .select()
      .from(passwordResetTokens)
      .orderBy(desc(passwordResetTokens.createdAt));
  }

  async markPasswordResetTokenUsed(id: number): Promise<boolean> {
    const result = await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deletePasswordResetToken(token: string): Promise<boolean> {
    const result = await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return (result.rowCount || 0) > 0;
  }

  // Notification operations
  async getAllNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return notification;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [result] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return result;
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
    return (result.rowCount || 0) > 0;
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return (result.rowCount || 0) > 0;
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(eq(notifications.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteAllNotifications(userId: string): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(eq(notifications.userId, userId));
    return (result.rowCount || 0) > 0;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.length;
  }
}

export const storage = new DatabaseStorage();
