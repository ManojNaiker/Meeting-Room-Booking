import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

export async function createNotificationForBooking(
  userId: string,
  action: 'created' | 'updated' | 'cancelled',
  bookingId: string,
  roomName: string,
  startTime: Date,
  endTime: Date
) {
  try {
    let title = '';
    let message = '';
    
    switch (action) {
      case 'created':
        title = 'Booking Confirmed';
        message = `Your booking for ${roomName} from ${startTime.toLocaleString()} to ${endTime.toLocaleString()} has been confirmed.`;
        break;
      case 'updated':
        title = 'Booking Updated';
        message = `Your booking for ${roomName} has been updated. New time: ${startTime.toLocaleString()} to ${endTime.toLocaleString()}.`;
        break;
      case 'cancelled':
        title = 'Booking Cancelled';
        message = `Your booking for ${roomName} from ${startTime.toLocaleString()} to ${endTime.toLocaleString()} has been cancelled.`;
        break;
    }
    
    const notification: InsertNotification = {
      userId,
      title,
      message,
      type: 'booking',
      isRead: false,
      relatedId: bookingId,
      relatedType: 'booking',
    };
    
    await storage.createNotification(notification);
    console.log(`Created ${action} notification for user ${userId} and booking ${bookingId}`);
  } catch (error) {
    console.error(`Error creating booking notification:`, error);
  }
}

export async function createNotificationForRoomUpdate(
  allUserIds: string[],
  action: 'created' | 'updated' | 'deleted',
  roomId: string,
  roomName: string,
  excludeUserId?: string
) {
  try {
    let title = '';
    let message = '';
    
    switch (action) {
      case 'created':
        title = 'New Room Available';
        message = `A new meeting room "${roomName}" has been added and is now available for booking.`;
        break;
      case 'updated':
        title = 'Room Updated';
        message = `The meeting room "${roomName}" has been updated. Please check the latest room details.`;
        break;
      case 'deleted':
        title = 'Room Unavailable';
        message = `The meeting room "${roomName}" is no longer available for booking.`;
        break;
    }
    
    // Send notification to all users except the one who made the change
    const usersToNotify = excludeUserId ? allUserIds.filter(id => id !== excludeUserId) : allUserIds;
    
    for (const userId of usersToNotify) {
      const notification: InsertNotification = {
        userId,
        title,
        message,
        type: 'room',
        isRead: false,
        relatedId: roomId,
        relatedType: 'room',
      };
      
      await storage.createNotification(notification);
    }
    
    console.log(`Created ${action} room notifications for ${usersToNotify.length} users`);
  } catch (error) {
    console.error(`Error creating room notifications:`, error);
  }
}

export async function createNotificationForUserUpdate(
  userId: string,
  action: 'welcome' | 'role_changed' | 'profile_updated',
  details?: { newRole?: string; adminUserId?: string }
) {
  try {
    let title = '';
    let message = '';
    
    switch (action) {
      case 'welcome':
        title = 'Welcome to Room Booking System!';
        message = 'Your account has been successfully created. You can now start booking meeting rooms and managing your schedule.';
        break;
      case 'role_changed':
        title = 'Role Updated';
        message = `Your role has been changed to ${details?.newRole || 'user'}. Your access permissions have been updated accordingly.`;
        break;
      case 'profile_updated':
        title = 'Profile Updated';
        message = 'Your profile information has been successfully updated.';
        break;
    }
    
    const notification: InsertNotification = {
      userId,
      title,
      message,
      type: 'user',
      isRead: false,
      relatedId: userId,
      relatedType: 'user',
    };
    
    await storage.createNotification(notification);
    console.log(`Created ${action} notification for user ${userId}`);
  } catch (error) {
    console.error(`Error creating user notification:`, error);
  }
}

export async function createSystemNotification(
  allUserIds: string[],
  title: string,
  message: string,
  excludeUserId?: string
) {
  try {
    const usersToNotify = excludeUserId ? allUserIds.filter(id => id !== excludeUserId) : allUserIds;
    
    for (const userId of usersToNotify) {
      const notification: InsertNotification = {
        userId,
        title,
        message,
        type: 'system',
        isRead: false,
        relatedId: null,
        relatedType: null,
      };
      
      await storage.createNotification(notification);
    }
    
    console.log(`Created system notification for ${usersToNotify.length} users`);
  } catch (error) {
    console.error(`Error creating system notification:`, error);
  }
}