import { storage } from "./storage";

export async function createSampleNotifications() {
  try {
    // Get all users to create notifications for
    const users = await storage.getAllUsers();
    
    if (users.length === 0) {
      console.log("No users found to create notifications for");
      return;
    }

    // Create sample notifications for each user
    for (const user of users) {
      // Create a welcome notification
      await storage.createNotification({
        userId: user.id,
        title: "Welcome to Room Booking System!",
        message: "Your account has been successfully set up. You can now start booking meeting rooms.",
        type: "system",
        isRead: false,
        relatedId: null,
        relatedType: null,
      });

      // Create a booking reminder notification
      await storage.createNotification({
        userId: user.id,
        title: "Room Booking Reminder",
        message: "Don't forget to book your meeting room in advance to ensure availability.",
        type: "booking",
        isRead: false,
        relatedId: null,
        relatedType: null,
      });

      // Create a system update notification
      await storage.createNotification({
        userId: user.id,
        title: "System Update",
        message: "We've added new features to improve your booking experience. Check out the room scheduler!",
        type: "system",
        isRead: true,
        relatedId: null,
        relatedType: null,
      });
    }

    console.log(`Created sample notifications for ${users.length} users`);
  } catch (error) {
    console.error("Error creating sample notifications:", error);
  }
}