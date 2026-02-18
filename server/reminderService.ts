import { storage } from "./storage";
import * as nodemailer from "nodemailer";
import { generateICS } from "./icsHelper";

export async function checkAndSendReminders() {
  try {
    console.log('[Reminder Service] Running reminder check...');
    const emailSettings = await storage.getEmailSettings();
    
    if (!emailSettings || !emailSettings.enableReminders) {
      console.log('[Reminder Service] Email reminders are disabled');
      return;
    }

    const now = new Date();
    const maxReminderDays = 7;
    const futureTime = new Date(now.getTime() + (maxReminderDays * 24 * 60 * 60 * 1000));
    
    console.log(`[Reminder Service] Checking bookings from ${now.toISOString()} to ${futureTime.toISOString()}`);
    
    const upcomingBookings = await storage.getUpcomingBookings(now, futureTime);
    console.log(`[Reminder Service] Found ${upcomingBookings.length} upcoming booking(s)`);
    
    for (const booking of upcomingBookings) {
      const startTime = new Date(booking.startDateTime);
      const reminderTimeMs = (booking.reminderTime || 15) * 60 * 1000;
      const sendReminderAt = new Date(startTime.getTime() - reminderTimeMs);
      
      console.log(`[Reminder Service] Booking ${booking.id} "${booking.title}": start=${startTime.toISOString()}, remindAt=${sendReminderAt.toISOString()}, remindMe=${booking.remindMe}, sent=${booking.reminderSent}`);
      
      if (!booking.remindMe) {
        console.log(`[Reminder Service] Skipping booking ${booking.id} - remindMe is disabled`);
        continue;
      }
      
      if (booking.reminderSent) {
        console.log(`[Reminder Service] Skipping booking ${booking.id} - reminder already sent`);
        continue;
      }
      
      if (now < sendReminderAt) {
        console.log(`[Reminder Service] Skipping booking ${booking.id} - not time yet (${Math.round((sendReminderAt.getTime() - now.getTime()) / 60000)} minutes remaining)`);
        continue;
      }
      
      if (now >= startTime) {
        console.log(`[Reminder Service] Skipping booking ${booking.id} - meeting already started`);
        continue;
      }

      console.log(`[Reminder Service] Sending reminder for booking ${booking.id}`);
      try {
        await sendReminderEmail(booking, emailSettings);
        await storage.markReminderSent(booking.id);
        console.log(`[Reminder Service] ✓ Successfully sent reminder for booking ${booking.id} - ${booking.title}`);
      } catch (error: any) {
        console.error(`[Reminder Service] ✗ Failed to send reminder for booking ${booking.id}:`, error.message);
      }
    }
    
    console.log('[Reminder Service] Check complete');
  } catch (error: any) {
    console.error('[Reminder Service] Error in reminder check:', error.message);
  }
}

async function sendReminderEmail(booking: any, emailSettings: any) {
  const transporter = nodemailer.createTransport({
    host: emailSettings.smtpHost,
    port: emailSettings.smtpPort,
    secure: emailSettings.smtpPort === 465,
    auth: {
      user: emailSettings.smtpUsername,
      pass: emailSettings.smtpPassword,
    },
  });

  const user = await storage.getUser(booking.userId);
  const room = await storage.getRoom(booking.roomId);
  
  if (!user || !room) {
    throw new Error('User or room not found');
  }

  const startDate = new Date(booking.startDateTime);
  const endDate = new Date(booking.endDateTime);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}/${year}`;
  };
  
  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const timeUntilMeeting = Math.floor((startDate.getTime() - new Date().getTime()) / 60000);
  const hoursUntil = Math.floor(timeUntilMeeting / 60);
  const minutesUntil = timeUntilMeeting % 60;
  
  let timeUntilText = '';
  if (hoursUntil > 0) {
    timeUntilText = `${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}`;
    if (minutesUntil > 0) {
      timeUntilText += ` and ${minutesUntil} minute${minutesUntil > 1 ? 's' : ''}`;
    }
  } else {
    timeUntilText = `${minutesUntil} minute${minutesUntil > 1 ? 's' : ''}`;
  }

  const icsContent = generateICS({
    title: booking.title,
    description: booking.description || undefined,
    location: room.name || 'Meeting Room',
    startDateTime: startDate,
    endDateTime: endDate,
    organizerName: `${user.firstName} ${user.lastName}`,
    organizerEmail: user.email || emailSettings.fromEmail,
    attendees: [],
  });

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">🔔 Meeting Reminder</h2>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; color: #92400e; font-weight: 600;">
          ⏰ Your meeting starts in ${timeUntilText}
        </p>
      </div>
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 8px 0;"><strong>Title:</strong> ${booking.title}</p>
        <p style="margin: 8px 0;"><strong>Room:</strong> ${room.name}</p>
        <p style="margin: 8px 0;"><strong>Date:</strong> ${formatDate(startDate)}</p>
        <p style="margin: 8px 0;"><strong>Time:</strong> ${formatTime(startDate)} - ${formatTime(endDate)}</p>
        ${booking.description ? `<p style="margin: 8px 0;"><strong>Description:</strong> ${booking.description}</p>` : ''}
      </div>
      <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
        Don't forget to prepare for your meeting!
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
    to: user.email,
    subject: `⏰ Reminder: ${booking.title} starts in ${timeUntilText}`,
    html: emailContent,
    icalEvent: {
      method: 'REQUEST',
      content: icsContent,
    },
    attachments: [
      {
        filename: 'meeting-reminder.ics',
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      },
    ],
  });
}

export function startReminderService() {
  console.log('[Reminder Service] Starting reminder service...');
  
  checkAndSendReminders();
  
  const intervalMinutes = 2;
  setInterval(() => {
    checkAndSendReminders();
  }, intervalMinutes * 60 * 1000);
  
  console.log(`[Reminder Service] Reminder service started, checking every ${intervalMinutes} minutes`);
}
